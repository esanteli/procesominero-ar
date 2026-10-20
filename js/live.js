// Movimiento e interacción del chancado primario (iteración 2).
// Sigue la lógica de live.js del circuito SAG (skill anatomy):
//  - el modelo manda (model.js) y la secuencia del CAEX es una función pura del tiempo (caex.js)
//  - seguimiento exponencial para los controles continuos (nada salta)
//  - "explorar interior" = zoom de viewBox + corte de la carcasa
//  - selección de equipos con foco, teclado, movimiento reducido y pausa fuera de pantalla
import * as M from "./model.js";
import * as C from "./caex.js";
import { GEO, rockEl } from "./rig.js";
import { renderTruck } from "./caex3d.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const follow = (v, target, dt, tau) => v + (target - v) * (1 - Math.exp(-dt / tau));
const place = (el, x, y, r, extra = "") => el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${r.toFixed(2)})${extra}`);
const NS = "http://www.w3.org/2000/svg";

export function createLive(rig, ui) {
  const { svg } = rig;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const W0 = GEO.view[2], H0 = GEO.view[3];
  const plant = M.initialPlant();
  const MAX_DT = Number(new URLSearchParams(location.search).get("maxdt")) || 1 / 20; // ?maxdt=0.5 sólo para QA en equipos lentos

  // ------------------------------------------------------------- estado
  let feed = M.FEED.nominal, feedTarget = M.FEED.nominal;
  let inside = 0, insideTarget = 0;
  let flow = 0;
  let last = 0, frame = 0, active = false;
  let pinned = false, readoutText = "";
  let mantlePhase = 0;
  let seqT = 0, playing = !still.matches, prevShare = 0;
  let selected = null;
  let lastStep = 0, lastPhase = "";

  // ------------------------------------------------------------- piezas del CAEX y del picarrocas
  const bedEl = rig.sprites.descargando.content.firstElementChild.firstElementChild.children[C.BED.group];
  const armBoom = C.ARM.boom.map((i) => rig.armParts[i]);
  const armHammer = C.ARM.hammer.map((i) => rig.armParts[i]);

  // ------------------------------------------------------------- partículas
  const L = rig.layers;
  const chamber = [], belt = [];
  let seed = 1, spawnChamber = 0, spawnBelt = 0;
  const pourPool = Array.from({ length: 16 }, (_, i) => rockEl(L.pourRocks, 200 + i, 1));
  const stuckPool = Array.from({ length: 10 }, (_, i) => rockEl(L.stuck, 300 + i, 1, "pm-rock pm-rock--boulder"));
  const dustPool = Array.from({ length: 10 }, () => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("class", "pm-dust-puff");
    L.dust.appendChild(c);
    return c;
  });

  // pila en la tolva: posiciones fijas dentro de la boca
  const pile = [];
  for (let i = 0; i < 26; i++) {
    const row = Math.floor(i / 6);
    const u = ((i * 37) % 11) / 10 - 0.5;
    const v = ((i * 53) % 7) / 6 - 0.5;
    const x = 650 + u * (64 - row * 9) + v * 10;
    const y = 470 - row * 6 + v * 8 - Math.abs(u) * 10;
    const r = 3.6 + ((i * 17) % 5) * 0.5;
    pile.push({ el: rockEl(L.pile, seed++, r, "pm-rock pm-rock--pile"), x, y, r, k: i / 26 });
  }
  function spawnChamberRock() {
    if (chamber.length > 60) return;
    const side = Math.random() < 0.5 ? "left" : "right";
    chamber.push({ el: rockEl(L.chamberRocks, seed++, 1), side, u: 0, j: (Math.random() - 0.5) * 8, r0: 3.6 + Math.random() * 2.2, spin: Math.random() * 360 });
  }
  function spawnBeltRock() {
    if (belt.length > 60) return;
    belt.push({ el: rockEl(L.beltRocks, seed++, 1), u: 0, w: (Math.random() - 0.5) * 14, r: 1.1 + Math.random() * 1.1 });
  }

  // carga dentro de la tolva levantada (va dentro del subgrupo de la tolva: sube y gira con ella)
  const heapLayer = document.createElementNS(NS, "g");
  heapLayer.setAttribute("class", "pm-rocks pm-heap");
  const heapClip = document.createElementNS(NS, "clipPath");
  heapClip.id = "pm-heap-clip";
  heapClip.setAttribute("clipPathUnits", "userSpaceOnUse");
  const heapPoly = document.createElementNS(NS, "polygon");
  heapPoly.setAttribute("points", C.HEAP.clip.map((p) => p.join(",")).join(" "));
  heapClip.appendChild(heapPoly);
  svg.querySelector("defs").appendChild(heapClip);
  heapLayer.setAttribute("clip-path", "url(#pm-heap-clip)");
  bedEl.appendChild(heapLayer);
  const heapPool = C.HEAP.rocks.map((rock) => ({ rock, el: rockEl(heapLayer, rock.seed, 1, "pm-rock pm-rock--load") }));

  // vistas intermedias del giro, generadas con el modelo 3D (caex3d.js); se cachean por medio grado
  const proxy = document.createElementNS(NS, "g");
  proxy.setAttribute("class", "pm-sprite pm-proxy");
  rig.caex.appendChild(proxy);
  proxy.style.display = "none";
  const proxyCache = new Map();
  let proxyKey = null;
  function drawProxy(layer, pos) {
    if (!layer || layer.op <= 0.001) { proxy.style.display = "none"; return; }
    const key = Math.round(layer.phi * 2) / 2;
    let fr = proxyCache.get(key);
    if (!fr) {
      const r = renderTruck(key);
      fr = { html: r.paths.map((p) => `<path class="${p.c === "l" ? "pl" : "pf"}" d="${p.d}"/>`).join(""), anchor: r.anchor };
      proxyCache.set(key, fr);
    }
    if (proxyKey !== key) { proxy.innerHTML = fr.html; proxyKey = key; }
    proxy.style.display = "";
    proxy.style.opacity = layer.op < 0.999 ? layer.op.toFixed(3) : "";
    proxy.setAttribute("transform", `translate(${(pos[0] - fr.anchor[0]).toFixed(2)} ${(pos[1] - fr.anchor[1]).toFixed(2)})`);
  }

  // polvo del camino: detrás del camión
  const road = document.createElementNS(NS, "g");
  road.setAttribute("class", "pm-road-dust");
  rig.caex.parentNode.insertBefore(road, rig.caex);
  const roadPool = Array.from({ length: 48 }, () => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("class", "pm-dust-puff");
    road.appendChild(c);
    return c;
  });

  // copia del sprite cargado para el giro por opacidad (las dos vistas a la vez)
  const ghost = { el: rig.sprites.cargada.el.cloneNode(true) };
  ghost.el.removeAttribute("data-sprite");
  rig.sprites.cargada.el.parentNode.insertBefore(ghost.el, rig.sprites.cargada.el);
  ghost.el.style.display = "none";
  function drawLayer(sp, name, layer, pos) {
    sp.el.style.display = "";
    sp.el.style.opacity = layer.op < 0.999 ? layer.op.toFixed(3) : "";
    const [ax, ay] = C.ANCHOR[name];
    sp.el.setAttribute("transform", `translate(${pos[0].toFixed(2)} ${pos[1].toFixed(2)}) rotate(${(layer.rot || 0).toFixed(2)}) scale(${layer.sx.toFixed(3)} 1) translate(${-ax} ${-ay})`);
  }

  // ------------------------------------------------------------- secuencia del CAEX → dibujo
  function drawSequence(st) {
    drawProxy(st.layers.find((l) => l.sprite === "proxy"), st.pos);
    roadPool.forEach((el, i) => {
      const d = st.road[i];
      if (!d) { el.style.display = "none"; return; }
      el.style.display = "";
      el.setAttribute("cx", d.x.toFixed(1)); el.setAttribute("cy", d.y.toFixed(1)); el.setAttribute("r", d.r.toFixed(2));
      el.style.opacity = d.op.toFixed(2);
    });
    // sprites del camión
    // un mismo sprite puede ir dos veces (giro por opacidad entre la vista normal y la espejada)
    const extraCargada = st.layers.filter((l) => l.sprite === "cargada")[1];
    if (extraCargada) drawLayer(ghost, "cargada", extraCargada, st.pos); else ghost.el.style.display = "none";
    for (const [name, sp] of Object.entries(rig.sprites)) {
      const layer = st.layers.find((l) => l.sprite === name);
      if (!layer || layer.op <= 0.001) { sp.el.style.display = "none"; continue; }
      sp.el.style.display = "";
      sp.el.style.opacity = layer.op < 0.999 ? layer.op.toFixed(3) : "";
      const [ax, ay] = C.ANCHOR[name];
      const sx = Math.abs(layer.sx) < 0.12 ? 0.12 * Math.sign(layer.sx || 1) : layer.sx; // el giro no se adelgaza hasta desaparecer
      sp.el.setAttribute("transform", `translate(${st.pos[0].toFixed(2)} ${st.pos[1].toFixed(2)}) rotate(${(layer.rot || 0).toFixed(2)}) scale(${sx.toFixed(3)} 1) translate(${-ax} ${-ay})`);
    }
    bedEl.setAttribute("transform", `rotate(${st.bed.toFixed(2)} ${C.BED.pivot[0]} ${C.BED.pivot[1]})`);

    // carga en la tolva levantada: las rocas se deslizan hacia el labio y salen (las del labio primero)
    const F = C.HEAP.floor, UP = C.HEAP.up, s = st.heapSlide;
    heapPool.forEach(({ el, rock }) => {
      const u = rock.u + s * 1.12;
      if (u >= 1.02) { el.style.display = "none"; return; }
      el.style.display = "";
      const v = rock.v, h = rock.h * (1 - 0.45 * s);
      const fx = lerp(lerp(F[0][0], F[1][0], v), lerp(F[3][0], F[2][0], v), u);
      const fy = lerp(lerp(F[0][1], F[1][1], v), lerp(F[3][1], F[2][1], v), u);
      place(el, fx + UP[0] * h, fy + UP[1] * h, rock.r, ` rotate(${(rock.seed * 47 + s * 160) % 360})`);
      el.style.opacity = u > 0.94 ? ((1.02 - u) / 0.08).toFixed(2) : "";
    });

    // picarrocas: hombro y codo
    const [t1, t2] = st.arm;
    const S = C.ARM.shoulder, E = C.ARM.elbow;
    const boomT = `rotate(${t1.toFixed(2)} ${S[0]} ${S[1]})`;
    armBoom.forEach((el) => el.setAttribute("transform", boomT));
    armHammer.forEach((el) => el.setAttribute("transform", `${boomT} rotate(${t2.toFixed(2)} ${E[0]} ${E[1]})`));

    // colpas y sus pedazos
    stuckPool.forEach((el, i) => {
      const b = st.boulders[i];
      if (!b) { el.style.display = "none"; return; }
      el.style.display = "";
      el.style.opacity = b.op.toFixed(2);
      place(el, b.x, b.y, b.r, ` rotate(${(b.seed * 37) % 360})`);
    });
    dustPool.forEach((el, i) => {
      const d = st.dust[i];
      if (!d) { el.style.display = "none"; return; }
      el.style.display = "";
      el.setAttribute("cx", d.x.toFixed(1)); el.setAttribute("cy", d.y.toFixed(1)); el.setAttribute("r", d.r.toFixed(2));
      el.style.opacity = (d.op ?? 1).toFixed(2);
    });

    // chorro de vaciado desde el labio de la tolva levantada
    const lip = C.lipPoint(C.ANCHOR.descargando, st.pos, st.bed);
    pourPool.forEach((el, k) => {
      const q = st.pour[k];
      if (!q) { el.style.display = "none"; return; }
      el.style.display = "";
      const x = lerp(lip[0] + (q.jx - 0.5) * 6, q.tx, q.u);
      const y = lerp(lip[1], q.ty, q.u * q.u) - Math.sin(q.u * Math.PI) * 3;
      place(el, x, y, q.r, ` rotate(${(q.u * 200 + q.i * 40).toFixed(0)})`);
      el.style.opacity = q.u > 0.85 ? ((1 - q.u) / 0.15).toFixed(2) : "1";
    });
  }

  // ------------------------------------------------------------- explorar interior (corte + zoom)
  const H = GEO.shell;
  const viewFor = (t) => {
    const e = smooth(t), ZOOM = 2.35;
    const w = W0 / (1 + (ZOOM - 1) * e), h = H0 / (1 + (ZOOM - 1) * e);
    const cx = lerp(GEO.view[0] + W0 / 2, GEO.focus[0], e);
    const cy = lerp(GEO.view[1] + H0 / 2, GEO.focus[1], e);
    return `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  };
  const clipPath = rig.clipRect.parentNode;
  const clipShape = document.createElementNS(NS, "path");
  clipPath.replaceChild(clipShape, rig.clipRect);
  function cut(t) {
    const e = smooth(clamp(t, 0, 1));
    const yc = lerp(H.top - 1, H.bottom + 3, e);
    const l = H.cx - H.rx - 3, r = H.cx + H.rx + 3;
    clipShape.setAttribute("d", `M${l},${yc} L${H.cx - H.rx},${yc} A${H.rx},${H.ry} 0 0 0 ${H.cx + H.rx},${yc} L${r},${yc} L${r},${yc + 400} L${l},${yc + 400} Z`);
    rig.cutRim.setAttribute("cy", yc.toFixed(2));
    rig.cutRim.style.opacity = (clamp(e / 0.06, 0, 1) * clamp((1 - e) / 0.08, 0, 1)).toFixed(3);
    rig.housingCut.style.opacity = smooth(clamp((e - 0.55) / 0.45, 0, 1)).toFixed(3);
    svg.toggleAttribute("data-xray", t > 0.45);
    svg.setAttribute("viewBox", viewFor(t));
  }

  // ------------------------------------------------------------- loop
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60;
    last = now;
    const calm = still.matches;

    // secuencia del CAEX
    const before = seqT;
    if (playing && !calm) seqT = (seqT + dt) % C.PERIOD;
    const st = C.state(seqT);
    // el vaciado entrega 300 t a la tolva mientras se reproduce (no al saltar entre pasos)
    if (seqT < before) prevShare = 0;
    if (playing && st.pourShare > prevShare) M.pour(plant, M.CAEX_PAYLOAD_T * (st.pourShare - prevShare));
    prevShare = st.pourShare;
    drawSequence(st);
    if (st.step.n !== lastStep || st.phase !== lastPhase) {
      lastStep = st.step.n; lastPhase = st.phase;
      ui.onSeq?.({ playing, step: st.step, phase: st.phase });
    }
    ui.seqProgress?.(st.step.n, st.stepProgress);

    feed = calm ? feedTarget : follow(feed, feedTarget, dt, 0.35);
    inside = calm ? insideTarget : follow(inside, insideTarget, dt, 0.32);
    if (Math.abs(inside - insideTarget) < 0.001) inside = insideTarget;
    flow = M.step(plant, feed, calm ? 0 : dt);
    const running = flow > 1;
    const k = feed / M.FEED.nominal;

    // manto: giro excéntrico (excentricidad exagerada ×20 para que se lea)
    mantlePhase += calm ? 0 : dt * (M.ECCENTRIC_RPM / 60) * Math.PI * 2;
    const ex = Math.cos(mantlePhase) * 0.9, ey = Math.sin(mantlePhase) * 0.45;
    rig.mantle.setAttribute("transform", `translate(${ex.toFixed(2)} ${ey.toFixed(2)})`);

    // pila de la tolva
    const f = M.fill(plant);
    for (const p of pile) {
      const s = clamp((f - p.k) * 26, 0, 1);
      if (s <= 0.001) { p.el.style.display = "none"; continue; }
      p.el.style.display = "";
      place(p.el, p.x, p.y + (1 - s) * 4, p.r * (0.4 + 0.6 * s));
    }

    // cámara: sólo se dibuja cuando se ve (interior abierto)
    if (!calm && running && inside > 0.04) {
      spawnChamber += dt * (6 + 12 * (flow / M.FEED.nominal));
      while (spawnChamber >= 1) { spawnChamber--; spawnChamberRock(); }
    }
    const vDown = 0.18 + 0.24 * clamp(k, 0.3, 1.7);
    for (let i = chamber.length - 1; i >= 0; i--) {
      const c = chamber[i];
      if (!calm) c.u += dt * vDown * (0.8 + 0.4 * c.u);
      const [a, b] = GEO.chamber[c.side];
      const squeeze = 1 - c.u * 0.85;
      const x = lerp(a[0], b[0], c.u) + c.j * squeeze * 0.4 + ex * c.u;
      const y = lerp(a[1], b[1], c.u);
      const r = lerp(c.r0, 1.3, c.u); // la roca se reduce a medida que baja por la garganta
      place(c.el, x, y, r, ` rotate(${(c.spin + c.u * 90).toFixed(0)})`);
      c.el.style.opacity = (c.u < 0.06 ? c.u / 0.06 : c.u > 0.92 ? (1 - c.u) / 0.08 : 1).toFixed(2);
      if (c.u >= 1) { c.el.remove(); chamber.splice(i, 1); }
    }

    // correa: densidad ∝ caudal, velocidad ∝ alimentación
    if (!calm && running) {
      spawnBelt += dt * (1.5 + 9 * (flow / M.FEED.nominal));
      while (spawnBelt >= 1) { spawnBelt--; spawnBeltRock(); }
    }
    const vBelt = 0.16 + 0.22 * clamp(k, 0.3, 1.7);
    const { a, b } = GEO.belt;
    for (let i = belt.length - 1; i >= 0; i--) {
      const p = belt[i];
      if (!calm) p.u += dt * vBelt;
      const x = lerp(a[0], b[0], p.u) - 0.866 * p.w * 0.5;
      const y = lerp(a[1], b[1], p.u) + 0.5 * p.w * 0.5 - p.r * 0.6;
      place(p.el, x, y, p.r);
      p.el.style.opacity = (p.u < 0.04 ? p.u / 0.04 : p.u > 0.9 ? (1 - p.u) / 0.1 : 1).toFixed(2);
      if (p.u >= 1) { p.el.remove(); belt.splice(i, 1); }
    }

    cut(inside);
    syncUi();

    const busy = playing || chamber.length || belt.length;
    const settled = calm && !busy && Math.abs(feed - feedTarget) < 1 && inside === insideTarget;
    frame = active && !document.hidden && !settled ? requestAnimationFrame(tick) : 0;
  }

  function syncUi() {
    if (document.activeElement !== ui.inside) ui.inside.value = String(Math.round(inside * 100));
    ui.insideOut.textContent = `${Math.round(inside * 100)} %`;
    if (document.activeElement !== ui.feed) ui.feed.value = String(Math.round(feedTarget / M.FEED.step) * M.FEED.step);
    ui.feedOut.textContent = `${M.fmt(feed)} t/h`;
    ui.meter.style.setProperty("--fill", M.fill(plant).toFixed(3));
    const text = plant.stock <= 0.5
      ? "Tolva vacía · el chancador espera al próximo CAEX"
      : `${M.fmt(flow)} t/h · tolva ${Math.round(M.fill(plant) * 100)} % · ${M.fmt(plant.crushed)} t chancadas`;
    if (!pinned && text !== readoutText) {
      ui.readout.textContent = text;
      readoutText = text;
      ui.stage?.setAttribute("aria-valuetext", text);
    }
  }

  function wake() {
    if (!frame && active && !document.hidden) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }
  const announce = () => {
    const st = C.state(seqT);
    lastStep = 0;
    ui.onSeq?.({ playing, step: st.step, phase: st.phase });
  };

  // ------------------------------------------------------------- API pública (HUD, teclado y toques)
  const api = {
    setInside(v) { insideTarget = clamp(v, 0, 1); wake(); },
    toggleInside() { insideTarget = insideTarget > 0.5 ? 0 : 1; wake(); },
    setFeed(v) { feedTarget = clamp(v, M.FEED.min, M.FEED.max); wake(); },
    play() { playing = true; announce(); wake(); },
    pause() { playing = false; announce(); wake(); },
    togglePlay() { playing ? api.pause() : api.play(); },
    get playing() { return playing; },
    goStep(n) {
      const s = C.STEPS[clamp(n, 1, C.STEPS.length) - 1];
      // con movimiento reducido se muestra la pose final del paso; si no, el paso parte desde el inicio
      seqT = still.matches || !playing ? Math.min(s.end - 0.02, s.start + (s.end - s.start) * 0.85) : s.start + 0.001;
      prevShare = C.state(seqT).pourShare;
      announce();
      wake();
      if (!frame) tick(performance.now());
    },
    /** Salta a un tiempo exacto de la secuencia (0..PERIOD). */
    seek(t) { seqT = ((t % C.PERIOD) + C.PERIOD) % C.PERIOD; prevShare = C.state(seqT).pourShare; announce(); wake(); if (!frame) tick(performance.now()); },
    nextStep() { api.goStep((C.state(seqT).step.n % C.STEPS.length) + 1); },
    prevStep() { const n = C.state(seqT).step.n; api.goStep(n === 1 ? C.STEPS.length : n - 1); },
    select(id) {
      selected = id || null;
      if (selected) svg.dataset.focus = selected; else delete svg.dataset.focus;
      ui.onSelect?.(selected);
      wake();
    },
    get selected() { return selected; },
    setActive(on) { active = on; if (on) wake(); },
    live: () => ({ flow, feed, fill: M.fill(plant), stock: plant.stock }),
  };

  // ------------------------------------------------------------- toques sobre el dibujo: seleccionar equipo
  svg.addEventListener("click", (event) => {
    const hit = event.target.closest("[data-equip]");
    const id = hit?.dataset.equip || null;
    api.select(id && id !== selected ? id : null);
  });
  svg.addEventListener("keydown", (e) => {
    const hit = e.target.closest?.("[data-equip]");
    if (hit && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); api.select(hit.dataset.equip); }
  });
  document.addEventListener("visibilitychange", wake);

  cut(0);
  announce();
  tick(performance.now());
  return api;
}
