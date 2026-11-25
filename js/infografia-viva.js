// Infografía viva del demo sin cámara.
//
// El arte es assets/procesominero_sin_ar (SVG + JPG), separado en capas por tools/capas-infografia.mjs: una base
// (terreno y rajo), una imagen por estación, una por etiqueta y las líneas de flujo como vectores
// (js/infografia-capas.js). Aquí se arma sobre el mapa del explorador y se anima:
//   · entrada (una vez al abrir el demo, ~3,5 s): fondo y rajo → líneas del flujo que se dibujan en el orden del
//     proceso → estaciones que aparecen cuando la línea llega → etiquetas al final. Un toque, la rueda o una tecla la
//     terminan de inmediato.
//   · al pasar el mouse, o al presionar con el dedo, una estación (su dibujo o su etiqueta) crece un poco y se ilumina.
//   · ambiente (después de la entrada): polvo que sube desde las máquinas del rajo y partículas que recorren las líneas.
//   · modo quiosco: tras PARAMS.kiosk.idle sin interacción se avisa (onIdle) para volver al inicio y repetir la entrada.
// Sólo se animan transform y opacity (lo único que la GPU compone sin repintar), salvo el trazo de las líneas en la
// entrada (stroke-dashoffset: un SVG chico, sólo esos 3 s). Con prefers-reduced-motion: entrada simple y sin ambiente.
// Las animaciones se pausan con la pestaña oculta, fuera del demo y mientras se mira una estación.
import ART from "./infografia-capas.js";

// ---------------------------------------------------------------- parámetros (ms, px del arte)
export const PARAMS = {
  intro: {
    base: 800,            // fundido del fondo y el rajo
    first: 450,           // aparece la primera estación (las demás según PROCESS, hasta `last`)
    last: 2700,
    station: 520,         // cada estación: opacidad 0 → 1 y escala `fromScale` → 1
    fromScale: 0.9,
    labels: 2850,         // etiquetas y textos, en el mismo orden
    label: 420,
    labelGap: 35,
    line: 420,            // duración mínima del trazo de una línea
  },
  flow: { speed: 150, gap: 380, size: 11 },                // partículas por las líneas: px/s, separación, diámetro
  smoke: { cycle: 5000, puffs: 3, opacity: 0.5, rise: 120, drift: 26, size: 80 }, // polvo del rajo (por emisor)
  kiosk: { idle: 3 * 60 * 1000 },                          // sin interacción → vuelve a empezar
};
// (la escala y el brillo al pasar el mouse están en css/app.css: --art-hover-scale y --art-hover-ms)

// orden del proceso: momento (0…1 entre intro.first e intro.last) en que aparece cada estación
const PROCESS = {
  rajo: 0, "mina-subterranea": 0.06, "chancado-primario": 0.2, "chancado-secundario": 0.36, concentradora: 0.42,
  "pilas-lixiviacion": 0.52, "celdas-flotacion": 0.62, electroobtencion: 0.7, fundicion: 0.84, puerto: 1,
};
// emisores de polvo del rajo (px del arte): el CAEX en la rampa y la perforadora del fondo
const DUST = [[818, 905], [806, 1136], [1040, 788]];

const [OX, OY] = ART.offset; // px del arte = px de stations.js + offset
const NS = "http://www.w3.org/2000/svg";
const assetUrl = (f) => new URL(`../assets/infografia-capas/${f}`, import.meta.url).href;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const still = matchMedia("(prefers-reduced-motion: reduce)");

/** Rectángulo de la etiqueta en coordenadas de stations.js (zona del botón de cada estación). */
export function labelRect(st) {
  const r = ART.labels[st.id]?.rect;
  return r ? [r[0] - OX, r[1] - OY, r[2], r[3]] : st.label;
}
/** Estaciones que el arte nuevo movió respecto de la infografía anterior: su módulo se desplaza igual. */
export const SHIFT = ART.shift;

const distToRect = ([x, y], [rx, ry, rw, rh]) => Math.hypot(Math.max(rx - x, 0, x - rx - rw), Math.max(ry - y, 0, y - ry - rh));
function nearestStation(p) {
  let best = null, d = Infinity;
  for (const [id, s] of Object.entries(ART.stations)) {
    const v = Math.min(distToRect(p, s.rect), ART.labels[id] ? distToRect(p, ART.labels[id].rect) : Infinity);
    if (v < d) { d = v; best = id; }
  }
  return best;
}

/**
 * @param {object} o
 * @param {HTMLElement} o.stage   el explorador (contenedor del mapa)
 * @param {HTMLElement} o.world   el mundo del mapa (px de stations.js)
 * @param {() => void} [o.onIdle] modo quiosco: nadie tocó nada en PARAMS.kiosk.idle
 */
export function createLiveArt({ stage, world, onIdle = () => {} }) {
  const I = PARAMS.intro;
  const at = (id) => I.first + (PROCESS[id] ?? 0.5) * (I.last - I.first);
  const root = world.querySelector("[data-art]") || world.insertBefore(document.createElement("div"), world.firstChild);
  root.className = "map-art";
  root.dataset.art = "";
  root.dataset.pre = ""; // invisible hasta que las imágenes estén listas
  root.style.cssText = `left:${-OX}px;top:${-OY}px;width:${ART.size[0]}px;height:${ART.size[1]}px`;
  root.innerHTML = "";
  const img = (src, cls, [x, y, w, h]) => {
    const i = new Image(w, h);
    i.className = cls; i.alt = ""; i.decoding = "async"; i.draggable = false; i.src = assetUrl(src);
    if (cls === "art-base") i.alt = "Infografía Proceso Minero de Espacio CoWork";
    else i.setAttribute("aria-hidden", "true");
    return i;
  };
  const place = (el, [x, y, w, h]) => { el.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`; return el; };

  // base
  const base = img(ART.base, "art-base", [0, 0, ...ART.size]);
  root.appendChild(base);

  // líneas y puntos (vectores: nítidos a cualquier zoom)
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "art-flow");
  svg.setAttribute("viewBox", `0 0 ${ART.size[0]} ${ART.size[1]}`);
  svg.setAttribute("aria-hidden", "true");
  root.appendChild(svg);
  const shape = (o) => {
    const el = document.createElementNS(NS, o.tag);
    for (const k of ["d", "points", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height"]) if (o[k] != null && !(k === "width" && o.stroke)) el.setAttribute(k, o[k]);
    el.setAttribute("transform", `matrix(${o.m.join(" ")})`);
    return el;
  };
  const near = (p, q, d = 16) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= d;
  const lines = ART.lines.map((o) => {
    const el = shape(o);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", o.stroke);
    el.setAttribute("stroke-width", o.width);
    el.setAttribute("stroke-miterlimit", "10");
    el.setAttribute("pathLength", "1");
    el.setAttribute("stroke-dasharray", "1 1");
    svg.appendChild(el);
    // de qué estación a cuál va: si sólo un extremo tiene punto, la línea sale de ahí (la flecha es la llegada);
    // si no, del extremo que está antes en el proceso
    const sa = nearestStation(o.a), sb = nearestStation(o.b);
    const da = ART.dots.some((d) => near(d.c, o.a)), db = ART.dots.some((d) => near(d.c, o.b));
    const fromA = da !== db ? da : (PROCESS[sa] ?? 0) <= (PROCESS[sb] ?? 0);
    const t0 = Math.min(at(sa), at(sb)) + (sa === sb ? 0 : I.station * 0.5), t1 = Math.max(at(sa), at(sb));
    return { el, o, fromA, t0, dur: Math.max(I.line, t1 - t0), start: fromA ? o.a : o.b, end: fromA ? o.b : o.a };
  });
  const dots = ART.dots.map((o) => {
    // la matriz va en un grupo: la animación (transform de CSS) reemplazaría el atributo transform del punto
    const g = document.createElementNS(NS, "g"), el = shape(o);
    g.setAttribute("transform", el.getAttribute("transform"));
    el.removeAttribute("transform");
    el.setAttribute("fill", o.fill);
    el.setAttribute("class", "art-dot");
    g.appendChild(el);
    svg.appendChild(g);
    // aparece cuando el trazo pasa por él (al empezar o al terminar su línea)
    let t = null;
    for (const l of lines) {
      if (near(o.c, l.start)) t = Math.min(t ?? Infinity, l.t0);
      else if (near(o.c, l.end)) t = Math.min(t ?? Infinity, l.t0 + l.dur - 60);
    }
    return { el, t: t ?? at(nearestStation(o.c)) };
  });

  // partículas por las líneas (debajo de las estaciones: pasan por detrás de los edificios, como las líneas)
  const run = document.createElement("div");
  run.className = "art-run";
  root.appendChild(run);

  // estaciones y su brillo
  const stations = {};
  for (const [id, s] of Object.entries(ART.stations)) {
    const el = place(document.createElement("div"), s.rect);
    el.className = "art-st";
    el.dataset.station = id;
    el.innerHTML = `<i class="art-glow"></i>`;
    el.appendChild(img(s.src, "", s.rect));
    root.appendChild(el);
    stations[id] = el;
  }
  // polvo del rajo (sobre las máquinas)
  const fx = document.createElement("div");
  fx.className = "art-fx";
  root.appendChild(fx);
  // etiquetas
  const labels = {};
  for (const [id, s] of Object.entries(ART.labels)) {
    const el = place(document.createElement("div"), s.rect);
    el.className = "art-lb";
    el.dataset.label = id;
    el.appendChild(img(s.src, "", s.rect));
    root.appendChild(el);
    labels[id] = el;
  }
  const hotspots = world.querySelector("[data-hotspots]");

  // ---------------------------------------------------------------- reloj: todas las animaciones pasan por aquí
  const intro = new Set(), ambient = new Set();
  const anim = (set, el, kf, opt) => { const a = el.animate(kf, opt); set.add(a); return a; };
  const cancel = (set) => { set.forEach((a) => a.cancel()); set.clear(); };
  let active = true, view = "map", introDone = false;
  const visible = () => active && !document.hidden;

  function playIntro() {
    cancel(intro);
    stopAmbient();
    introDone = false;
    delete root.dataset.pre;
    const ease = "cubic-bezier(.2,.7,.2,1)";
    const ord = Object.keys(stations).sort((a, b) => at(a) - at(b));
    if (still.matches) {
      // movimiento reducido: todo junto, un fundido corto
      for (const el of [root, hotspots]) anim(intro, el, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "backwards" });
    } else {
      anim(intro, base, [{ opacity: 0 }, { opacity: 1 }], { duration: I.base, easing: "ease-out", fill: "backwards" });
      for (const l of lines) anim(intro, l.el, [{ strokeDashoffset: l.fromA ? 1 : -1 }, { strokeDashoffset: 0 }], { duration: l.dur, delay: l.t0, easing: "cubic-bezier(.45,0,.4,1)", fill: "backwards" });
      for (const d of dots) anim(intro, d.el, [{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "scale(1)" }], { duration: 260, delay: d.t, easing: ease, fill: "backwards" });
      for (const id of ord) anim(intro, stations[id], [{ opacity: 0, transform: `scale(${I.fromScale})` }, { opacity: 1, transform: "scale(1)" }], { duration: I.station, delay: at(id), easing: ease, fill: "backwards" });
      const lbOrd = [...ord.filter((id) => labels[id]), ...Object.keys(labels).filter((id) => !stations[id])];
      lbOrd.forEach((id, i) => anim(intro, labels[id], [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: I.label, delay: I.labels + i * I.labelGap, easing: ease, fill: "backwards" }));
      anim(intro, hotspots, [{ opacity: 0 }, { opacity: 1 }], { duration: I.label, delay: I.labels + lbOrd.length * I.labelGap, fill: "backwards" });
    }
    stage.dataset.intro = "";
    const all = [...intro];
    Promise.all(all.map((a) => a.finished)).then(() => {
      if (all.some((a) => !intro.has(a))) return; // se canceló (otra entrada)
      intro.clear();
      introDone = true;
      delete stage.dataset.intro;
      startAmbient();
    }, () => {});
    if (!visible()) intro.forEach((a) => a.pause());
  }
  // un toque, la rueda o una tecla terminan la entrada de inmediato
  function skipIntro() { if (intro.size) intro.forEach((a) => a.finish()); }

  // ---------------------------------------------------------------- ambiente
  function startAmbient() {
    if (ambient.size || still.matches || !introDone) return;
    const F = PARAMS.flow, S = PARAMS.smoke;
    // partículas: recorren cada línea en el sentido del flujo (fotogramas de translate: sólo transform y opacity)
    run.innerHTML = "";
    for (const l of lines) {
      const len = l.o.len, n = Math.max(1, Math.round(len / F.gap)), dur = (len / F.speed) * 1000;
      const L = l.el.getTotalLength(), m = l.o.m, N = clamp(Math.round(len / 24), 12, 64);
      const kf = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, p = l.el.getPointAtLength((l.fromA ? u : 1 - u) * L);
        const x = m[0] * p.x + m[2] * p.y + m[4], y = m[1] * p.x + m[3] * p.y + m[5];
        kf.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`, opacity: u < 0.06 ? u / 0.06 : u > 0.94 ? (1 - u) / 0.06 : 1, offset: u });
      }
      for (let k = 0; k < n; k++) {
        const p = document.createElement("i");
        p.style.color = l.o.stroke;
        p.style.setProperty("--size", `${F.size}px`); // (css: nunca menos de ~5 px en pantalla)
        run.appendChild(p);
        anim(ambient, p, kf, { duration: dur, delay: -(k * dur) / n, iterations: Infinity, easing: "linear" });
      }
    }
    // polvo: bocanadas que suben, crecen y se disipan (desfasadas dentro del ciclo)
    fx.innerHTML = "";
    DUST.forEach(([x, y], e) => {
      for (let k = 0; k < S.puffs; k++) {
        const p = document.createElement("i");
        p.style.cssText = `left:${x}px;top:${y}px;width:${S.size}px;height:${S.size}px;margin:${-S.size / 2}px`;
        fx.appendChild(p);
        const dx = (k % 2 ? 1 : -1) * S.drift * (0.6 + 0.4 * ((e + k) % 3) / 2);
        anim(ambient, p, [
          { opacity: 0, transform: "translate(0, 0) scale(.3)" },
          { opacity: S.opacity, transform: `translate(${dx * 0.25}px, ${-S.rise * 0.2}px) scale(.7)`, offset: 0.18 },
          { opacity: 0, transform: `translate(${dx}px, ${-S.rise}px) scale(1.7)` },
        ], { duration: S.cycle, delay: -((k + e * 0.37) * S.cycle) / S.puffs, iterations: Infinity, easing: "cubic-bezier(.3,.6,.4,1)" });
      }
    });
    stage.dataset.ambient = "";
    syncPause();
  }
  function stopAmbient() { cancel(ambient); run.innerHTML = ""; fx.innerHTML = ""; delete stage.dataset.ambient; }
  // pausa: pestaña oculta, fuera del demo o mirando una estación (las partículas no compiten con la lámina)
  function syncPause() {
    const runAmbient = visible() && view === "map";
    ambient.forEach((a) => (runAmbient ? a.play() : a.pause()));
    intro.forEach((a) => (visible() ? a.play() : a.pause()));
    stage.toggleAttribute("data-art-paused", !runAmbient);
  }
  document.addEventListener("visibilitychange", () => { syncPause(); armKiosk(); });
  still.addEventListener?.("change", () => { if (still.matches) stopAmbient(); else startAmbient(); });

  // ---------------------------------------------------------------- al pasar el mouse o presionar: la estación crece
  let hot = null, hotT = 0;
  const idOf = (t) => t?.closest?.(".art-st, .hotspot")?.dataset.station || null;
  function setHot(id) {
    clearTimeout(hotT);
    if (hot === id) return;
    if (hot) { stations[hot]?.removeAttribute("data-hot"); labels[hot]?.removeAttribute("data-hot"); }
    hot = view === "map" ? id : null;
    if (hot) { stations[hot]?.setAttribute("data-hot", ""); labels[hot]?.setAttribute("data-hot", ""); }
  }
  world.addEventListener("pointerover", (e) => { if (e.pointerType === "mouse") setHot(idOf(e.target)); });
  world.addEventListener("pointerout", (e) => { if (e.pointerType === "mouse" && idOf(e.relatedTarget) !== hot) setHot(null); });
  // dedo o lápiz: mientras se presiona (y un instante después, para que el efecto se alcance a ver)
  world.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") setHot(idOf(e.target)); });
  const release = () => { if (hot) { clearTimeout(hotT); hotT = setTimeout(() => setHot(null), 220); } };
  addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") release(); });
  addEventListener("pointercancel", release);
  stage.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" && hot && e.buttons && (Math.abs(e.movementX) + Math.abs(e.movementY) > 4)) setHot(null); });
  world.addEventListener("focusin", (e) => setHot(idOf(e.target)));
  world.addEventListener("focusout", () => setHot(null));

  // ---------------------------------------------------------------- modo quiosco
  let kioskT = 0;
  function armKiosk() {
    clearTimeout(kioskT);
    if (visible()) kioskT = setTimeout(() => { if (visible()) onIdle(); armKiosk(); }, PARAMS.kiosk.idle);
  }
  const touched = () => { skipIntro(); armKiosk(); };
  for (const ev of ["pointerdown", "wheel", "keydown"]) addEventListener(ev, touched, { passive: true, capture: true });
  let movedAt = 0;
  addEventListener("pointermove", (e) => { const t = performance.now(); if (t - movedAt > 1000) { movedAt = t; armKiosk(); } }, { passive: true });

  // ---------------------------------------------------------------- arranque: con las imágenes listas
  const ready = Promise.race([
    Promise.allSettled([...root.querySelectorAll("img")].map((i) => i.decode())),
    new Promise((r) => setTimeout(r, 6000)),
  ]);
  let started = false;
  ready.then(() => { started = true; if (active) playIntro(); });
  armKiosk();

  return {
    /** vuelve a ejecutar la entrada (modo quiosco, o al volver a abrir el demo) */
    replay() { if (started) playIntro(); },
    /** el demo se muestra o se oculta */
    setActive(on) {
      active = on;
      if (!on) { setHot(null); cancel(intro); stopAmbient(); introDone = true; root.dataset.pre = ""; }
      else if (started) playIntro();
      syncPause();
      armKiosk();
    },
    /** vista del explorador: "map" o una estación */
    setView(v) {
      view = v === "map" ? "map" : "station";
      if (view !== "map") { setHot(null); skipIntro(); }
      syncPause();
    },
  };
}
