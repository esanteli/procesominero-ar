// Estación 1 · Mina subterránea — "radiografía" del terreno: la lámina muestra el túnel por dentro y el carguío.
// Lógica de la skill anatomy: un modelo puro state(t) manda; el dibujo lo sigue. Secuencia en bucle con pasos,
// play/pausa, selección de equipos (cargador frontal y dumper) con ficha y foco, deslizador de radiografía y teclado.
//
// Recursos de Emilio (assets/mina/): tunel.svg, cargador.svg (LHD) y dumper.svg, en las mismas unidades.
// Para no inventar perspectivas (y evitar deformaciones), ambos equipos se mueven en el eje del túnel con su vista
// dibujada: el dumper entra en reversa y sale de frente; el cargador va y vuelve entre el punto de extracción y el dumper.
// La pala del cargador se articula como la real: los brazos giran sobre su pasador en el plano vertical del equipo
// (transformación isométrica exacta para ese plano) y el balde sube, se inclina para vaciar y se recoge. El balde se
// reconstruye en 3D desde la placa lateral del dibujo (js/stations/balde3d.js), así gira sin deformarse.

import { bucketFaces, lipPoint } from "./balde3d.js";

const NS = "http://www.w3.org/2000/svg";
const ASSET = (f) => new URL(`../../assets/mina/${f}`, import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const easeIO = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const f3 = (n) => (Math.round(n * 1000) / 1000).toString();
const fmt = (n) => Math.round(n).toLocaleString("es-CL");

// ---------------------------------------------------------------- registro túnel ↔ infografía
// El túnel (unidades del SVG, 536 × 451) se ubica dentro del bloque de terreno impreso, con su extremo derecho junto
// al portal dibujado, como en el frame "Inicio AR" del storyboard.
export const REG = { s: 0.688, tx: 975, ty: 1092 };
const VIEW = [0, 0, 536.27, 451.09];

// eje de la galería: los equipos avanzan por una línea paralela al eje X de la isométrica (0,866, 0,5), junto a la
// pared del fondo, pasando frente al punto de extracción (el nicho). d = distancia a lo largo de ese eje.
const E = [0.866, 0.5];
const along = (p, d) => [p[0] + E[0] * d, p[1] + E[1] * d];
const OUTLINE = "128.76 336.73 324.13 450.59 523.94 336.73 530.58 324.08 514.07 297.79 95.54 50.89 38.62 93.34 10.2 185.63 38.62 254.27 73.54 290.7 128.76 336.73";

// ---------------------------------------------------------------- equipos (puntos en unidades de sus SVG)
const LHD = {
  ref: [159, 114.5],              // centro del labio del balde (en el suelo, pala abajo)
  lip0: [190, 182],               // dónde queda ese punto al cargar en la marina (unidades del túnel)
  pivotNear: [102.7, 66.5], pivotFar: [118, 57.5],   // pasadores de los brazos (lado cercano / lejano)
  pinNear: [120.5, 88], pinFar: [134, 81], pin: [127.3, 84.5], // pasador del balde
  armNear: [107, 104, 105], armFar: [89, 86, 87, 76],
  bucket: [108, 109, 110, 111, 112, 119, 120],    // piezas del balde dibujado (se reemplazan por el balde 3D)
  brackets: [88, 106],                            // orejas del balde en la punta de los brazos
};
const DUMPER = {
  spot: [240, 184],               // origen del SVG del dumper en el punto de carguío
  rim: [[4, 23], [43, 0.5], [98, 33], [61, 55]], // borde de la tolva: trasero‑izq., trasero‑der., delantero‑der., delantero‑izq.
};
// marina que baja por gravedad desde el punto de extracción: borde delantero (hacia la galería) y subida al nicho
const PILE = {
  front: [[156, 176], [166, 190], [184, 199], [206, 201], [226, 194], [240, 182]],
  back: [[238, 164], [222, 140], [214, 124], [196, 117], [176, 124], [162, 142], [156, 160]],
  bite: [9, -6],                  // el balde muerde: el borde retrocede hacia la pared (‑Y)
};
const U_PILE = 0, U_BACK = -46, U_DUMP = 92;                // posición del cargador a lo largo del eje (d)
const U_DSPOT = 0, U_DIN = 340, U_DOUT = 430;               // posición del dumper a lo largo del eje: carguío / entrada / salida
const DUMPER_T = 30, PASSES = 3;                             // t por dumper · pases de 10 t

// ---------------------------------------------------------------- articulación isométrica
// Rotación en el plano vertical del equipo (eje paralelo a Y) alrededor del punto de pantalla P, en matriz SVG.
function planeRot(P, deg) {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), k = 0.866;
  const map = ([a, b]) => { const X = a / k, Z = 0.5 * X - b; const X2 = c * X - s * Z, Z2 = s * X + c * Z; return [k * X2, 0.5 * X2 - Z2]; };
  const [A, B] = map([1, 0]), [C, D] = map([0, 1]);
  return [A, B, C, D, P[0] - A * P[0] - C * P[1], P[1] - B * P[0] - D * P[1]];
}
const apply = (M, [x, y]) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
const mul = (M, N) => [M[0] * N[0] + M[2] * N[1], M[1] * N[0] + M[3] * N[1], M[0] * N[2] + M[2] * N[3], M[1] * N[2] + M[3] * N[3], M[0] * N[4] + M[2] * N[5] + M[4], M[1] * N[4] + M[3] * N[5] + M[5]];
const mstr = (M) => `matrix(${M.map(f3).join(" ")})`;

// ---------------------------------------------------------------- línea de tiempo
const T_IN = 4.6;                                   // dumper entra en reversa
const LEG = { go: 1.7, dump: 1.6, back: 1.7, dig: 1.3 };
const PASS_T = LEG.go + LEG.dump + LEG.back + LEG.dig;
const T_P0 = T_IN + 0.3;
const T_EXIT = T_P0 + (PASSES - 1) * PASS_T + LEG.go + LEG.dump + 0.2;
const D_EXIT = 4.2;
export const PERIOD = T_EXIT + D_EXIT + 0.8;
export const STEPS = [
  { n: 1, label: "El dumper ingresa en reversa", t0: 0 },
  { n: 2, label: "El cargador lleva el mineral al dumper", t0: T_P0 },
  { n: 3, label: "Levanta el balde y lo vacía en la tolva", t0: T_P0 + LEG.go * 0.55 },
  { n: 4, label: "Vuelve a cargar al punto de extracción (3 pases)", t0: T_P0 + LEG.go + LEG.dump },
  { n: 5, label: "El dumper sale cargado", t0: T_EXIT },
].map((s, i, a) => ({ ...s, t1: i + 1 < a.length ? a[i + 1].t0 : PERIOD }));
const stepAt = (t) => STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1];

// ---------------------------------------------------------------- modelo puro
function lhdAt(t) {
  // espera en el punto de extracción con el balde lleno y recogido (así el ciclo empata consigo mismo)
  const st = { u: U_PILE, lift: 10, tilt: 12, loaded: true, moving: false, dig: 0, pour: 0, pass: 0 };
  for (let k = 0; k < PASSES; k++) {
    const a = T_P0 + k * PASS_T, b = a + LEG.go, c = b + LEG.dump, d = c + LEG.back, e = d + LEG.dig;
    if (t < a) break;
    st.pass = k + 1;
    if (t < b) { const w = (t - a) / LEG.go; st.u = lerp(U_PILE, U_DUMP, easeIO(w)); st.lift = lerp(10, 30, smooth((w - 0.25) / 0.75)); st.tilt = 12; st.moving = w > 0.04 && w < 0.96; return st; }
    if (t < c) { const w = (t - b) / LEG.dump; st.u = U_DUMP; st.lift = 30;
      st.tilt = w < 0.3 ? lerp(12, -42, easeIO(w / 0.3)) : w < 0.72 ? -42 : lerp(-42, 4, easeIO((w - 0.72) / 0.28));
      st.pour = w > 0.18 && w < 0.8 ? (w - 0.18) / 0.62 : 0; st.loaded = w < 0.45; return st; }
    if (t < d) { const w = (t - c) / LEG.back; st.u = lerp(U_DUMP, U_BACK, easeIO(w)); st.lift = lerp(30, 0, smooth(w / 0.8)); st.tilt = lerp(4, 0, smooth(w)); st.loaded = false; st.moving = w > 0.04 && w < 0.96; return st; }
    if (t < e) { const w = (t - d) / LEG.dig;
      if (w < 0.5) { st.u = lerp(U_BACK, U_PILE, easeIO(w / 0.5)); st.lift = 0; st.tilt = 0; st.loaded = false; st.dig = w / 0.5; st.moving = true; }
      else { const q = (w - 0.5) / 0.5; st.u = U_PILE; st.lift = lerp(0, 10, smooth(q)); st.tilt = lerp(0, 12, smooth(q)); st.loaded = q > 0.35; st.dig = 1; }
      return st; }
  }
  return st;
}
function dumperAt(t) {
  if (t < T_IN) { const w = t / T_IN; return { u: lerp(U_DIN, U_DSPOT, easeIO(w)), moving: w > 0.03 && w < 0.97, reverse: true }; }
  if (t < T_EXIT) return { u: U_DSPOT, moving: false };
  const w = (t - T_EXIT) / D_EXIT;
  return { u: lerp(U_DSPOT, U_DOUT, w * w * (1.6 - 0.6 * w)), moving: w > 0.02, reverse: false };
}
function loadAt(t) {
  if (t >= T_EXIT) return DUMPER_T;
  let tons = 0;
  for (let k = 0; k < PASSES; k++) { const b = T_P0 + k * PASS_T + LEG.go; tons += (DUMPER_T / PASSES) * smooth((t - b - LEG.dump * 0.2) / (LEG.dump * 0.55)); }
  return tons;
}
function pileAt(t) {
  // el balde muerde la marina (el frente retrocede); luego el mineral vuelve a bajar desde el nicho
  let front = 0, flow = 0;
  for (let k = 0; k < PASSES; k++) {
    const d = T_P0 + k * PASS_T + LEG.go + LEG.dump + LEG.back, e = d + LEG.dig;
    if (t >= d + LEG.dig * 0.3 && t < e + PASS_T * 0.75) {
      const bite = smooth((t - d - LEG.dig * 0.3) / (LEG.dig * 0.5)), refill = smooth((t - e - LEG.go * 0.6) / (PASS_T * 0.4));
      front = bite * (1 - refill);
      flow = Math.max(flow, refill > 0 && refill < 1 ? Math.sin(Math.PI * refill) : 0);
    }
  }
  return { front, flow };
}
export function state(t) {
  t = ((t % PERIOD) + PERIOD) % PERIOD;
  const L = lhdAt(t), D = dumperAt(t);
  const fadeD = 1 - smooth((D.u - 200) / 120);              // entra/sale por el corte derecho del túnel
  return { t, step: stepAt(t), lhd: L, dumper: { ...D, load: loadAt(t), opacity: fadeD }, pile: pileAt(t) };
}

// ---------------------------------------------------------------- fichas
const EQUIP = {
  cargador: {
    kicker: "Carguío subterráneo",
    title: "Cargador frontal (LHD)",
    text: "Equipo bajo y articulado que carga el mineral en el punto de extracción, lo transporta con su balde y lo vacía en el dumper. Su sigla en inglés es LHD: load, haul, dump.",
    specs: (s) => [`Pase ${Math.max(1, s.lhd.pass)} de ${PASSES}`, "Balde ~10 t", "Dirección articulada"],
  },
  dumper: {
    kicker: "Transporte subterráneo",
    title: "Dumper (camión de bajo perfil)",
    text: "Camión articulado de bajo perfil para galerías estrechas. Entra en reversa hasta el cargador, recibe la carga y sale por la rampa hacia superficie o hacia un pique de traspaso.",
    specs: (s) => [`Carga ahora ${fmt(s.dumper.load)} t`, `Capacidad ~${DUMPER_T} t`, "Entra en reversa, sale de frente"],
  },
};
const ORDER = ["cargador", "dumper"];

// ---------------------------------------------------------------- dibujo
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
async function loadSvg(url, prefix, defs) {
  const text = await (await fetch(url)).text();
  const root = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  root.querySelectorAll("metadata, title, desc").forEach((n) => n.remove());
  const style = root.querySelector("style");
  if (style) el("style", {}, defs).textContent = style.textContent.replace(/\.cls-(\d+)/g, `.${prefix}-cls-$1`);
  root.querySelectorAll("[class]").forEach((n) => n.setAttribute("class", n.getAttribute("class").replace(/\bcls-(\d+)/g, `${prefix}-cls-$1`)));
  root.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  const g = document.createElementNS(NS, "g");
  [...root.children].filter((n) => n.tagName !== "defs" && n.tagName !== "style").forEach((n) => g.appendChild(document.importNode(n, true)));
  return g;
}
// baja por los <g> únicos hasta llegar al nivel donde están las piezas (el SVG de Illustrator envuelve en capas)
const partsOf = (g) => { let n = g; while (n.children.length === 1 && n.firstElementChild.tagName === "g") n = n.firstElementChild; return n; };

export async function createMina() {
  const root = document.createElement("div");
  root.className = "mina-plate";
  root.style.cssText = `position:absolute;left:${f1(VIEW[0] * REG.s + REG.tx)}px;top:${f1(VIEW[1] * REG.s + REG.ty)}px;width:${f1(VIEW[2] * REG.s)}px;height:${f1(VIEW[3] * REG.s)}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "mn-svg", role: "group", tabindex: "0",
    "aria-label": "Mina subterránea en radiografía: el dumper entra en reversa, el cargador frontal lo carga en tres pases y el dumper sale. Espacio pausa; coma y punto cambian de paso; 1 y 2 eligen un equipo; flechas arriba y abajo regulan la radiografía." }, root);
  const defs = el("defs", {}, svg);
  const clip = el("clipPath", { id: "mn-clip" }, defs); el("polygon", { points: OUTLINE }, clip);
  const reveal = el("clipPath", { id: "mn-reveal" }, defs);
  const revealRect = el("rect", { x: -20, y: -20, width: 0, height: VIEW[3] + 40 }, reveal);

  const scene = el("g", { "clip-path": "url(#mn-reveal)" }, svg);
  el("polygon", { points: OUTLINE, class: "mn-glow" }, scene);

  // túnel: base (piso, paredes, tuberías, nicho) y, aparte, el arco del frente (va sobre el cargador)
  const tunnel = partsOf(await loadSvg(ASSET("tunel.svg"), "mnt", defs));
  const tk = [...tunnel.children];
  const base = el("g", { class: "mn-tunnel" }, scene);
  tk.forEach((n, i) => { if (i !== 6) base.appendChild(n); });
  // marina en el punto de extracción
  const pileG = el("g", { class: "mn-pile" }, scene);
  const pilePath = el("path", { class: "mn-pile-body" }, pileG);
  const pileRocks = Array.from({ length: 9 }, (_, i) => el("path", { class: "mn-rock", d: ["M-2 -.8L-.4 -2.1L1.8 -1.4L2.1 .8L.1 2L-1.8 1.3Z", "M-1.6 -1.5L1.3 -1.8L2 .5L.3 1.8L-2 .7Z", "M-2.1 0L-.9 -1.8L1.4 -1.7L1.7 1.2L-.7 1.7Z"][i % 3] }, pileG));
  const flowRocks = Array.from({ length: 5 }, (_, i) => el("path", { class: "mn-rock", d: ["M-1.6 -.6L-.3 -1.7L1.4 -1.1L1.7 .6L.1 1.6L-1.4 1Z", "M-1.3 -1.2L1 -1.4L1.6 .4L.2 1.4L-1.6 .6Z"][i % 2] }, pileG));

  // dumper (debajo del cargador: el balde pasa sobre la tolva)
  const vehicles = el("g", { "clip-path": "url(#mn-clip)" }, scene);
  const dustG = el("g", { class: "mn-dust" }, vehicles);
  const puffs = Array.from({ length: 10 }, () => el("circle", { r: 1, class: "mn-puff" }, dustG));
  const dumperG = el("g", { class: "mn-eq", "data-equip": "dumper", role: "button", tabindex: "-1", "aria-label": "Dumper: ver descripción" }, vehicles);
  const dumperBody = el("g", {}, dumperG);
  el("ellipse", { cx: 78, cy: 58, rx: 78, ry: 56, class: "mn-hit" }, dumperBody);
  dumperBody.appendChild(await loadSvg(ASSET("dumper.svg"), "mnd", defs));
  const heap = el("path", { class: "mn-load" }, dumperBody);

  // cargador frontal: cuerpo + brazos + balde articulados
  const lhdG = el("g", { class: "mn-eq", "data-equip": "cargador", role: "button", tabindex: "-1", "aria-label": "Cargador frontal: ver descripción" }, vehicles);
  const lhdBody = el("g", {}, lhdG);
  el("ellipse", { cx: 92, cy: 66, rx: 92, ry: 60, class: "mn-hit" }, lhdBody);
  const lhdSvg = await loadSvg(ASSET("cargador.svg"), "mnc", defs);
  lhdBody.appendChild(lhdSvg);
  const lp = [...partsOf(lhdSvg).children];
  const wrap = (n) => { if (n.tagName === "g") return n; const g = document.createElementNS(NS, "g"); n.replaceWith(g); g.appendChild(n); return g; };
  const pick = (idx) => idx.map((i) => wrap(lp[i])).filter(Boolean);
  const R = { armNear: pick(LHD.armNear), armFar: pick(LHD.armFar), brackets: pick(LHD.brackets) };
  // balde 3D en el lugar del dibujado (mismo orden de pintado: sobre los brazos)
  const bucketG = el("g", { class: "mn-bucket" });
  lp[LHD.bucket[LHD.bucket.length - 1]].after(bucketG);
  LHD.bucket.forEach((i) => (lp[i].style.display = "none"));
  const bucketCache = new Map();
  const bucketSvg = (deg, load) => {
    const key = `${Math.round(deg)}|${Math.round(load * 6)}`;
    if (!bucketCache.has(key)) bucketCache.set(key, bucketFaces(Math.round(deg), Math.round(load * 6) / 6).map((f) => `<path class="mn-b${f.c}" d="${f.d}"/>`).join(""));
    return bucketCache.get(key);
  };
  let bucketKey = "";
  const ring = el("g", { class: "mn-ring" }, scene);
  ring.appendChild(tk[6]);
  const pour = el("g", { class: "mn-pour" }, scene);
  const pourRocks = Array.from({ length: 10 }, (_, i) => el("path", { class: "mn-rock", d: ["M-1.6 -.6L-.3 -1.7L1.4 -1.1L1.7 .6L.1 1.6L-1.4 1Z", "M-1.3 -1.2L1 -1.4L1.6 .4L.2 1.4L-1.6 .6Z", "M-1.7 0L-.7 -1.5L1.2 -1.4L1.4 1L-.6 1.4Z"][i % 3] }, pour));

  // haz de la radiografía (barre de izquierda a derecha al entrar)
  const beam = el("g", { class: "mn-beam" }, svg);
  el("rect", { x: -14, y: -30, width: 28, height: VIEW[3] + 60, class: "mn-beam-glow" }, beam);
  el("line", { x1: 0, y1: -30, x2: 0, y2: VIEW[3] + 30, class: "mn-beam-line" }, beam);

  // etiquetas de foco
  const tags = el("g", { class: "mn-tags" }, svg);
  const tagEls = {};
  for (const id of ORDER) {
    const g = el("g", { class: "mn-tag", "data-tag": id }, tags);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -20, class: "mn-tag-line" }, g);
    const w = { cargador: 98, dumper: 54 }[id];
    el("rect", { x: -w / 2, y: -38, width: w, height: 19, rx: 9.5, class: "mn-tag-pill" }, g);
    el("text", { x: 0, y: -24.6, class: "mn-tag-text", "text-anchor": "middle" }, g).textContent = { cargador: "Cargador frontal", dumper: "Dumper" }[id];
    tagEls[id] = g;
  }

  // ------------------------------------------------------------ render
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let selected = null, xray = 1, xrayShown = still.matches ? 1 : 0;
  const rockAt = (r, x, y, rot = 0, sc = 1, o = 1) => { r.setAttribute("transform", `translate(${f1(x)} ${f1(y)}) rotate(${Math.round(rot)}) scale(${f3(sc)})`); r.style.opacity = o; };
  function draw(s) {
    // radiografía: el recorte barre el túnel; el haz marca el borde
    const r = clamp(xrayShown);
    revealRect.setAttribute("width", f1(r * (VIEW[2] + 40)));
    beam.setAttribute("transform", `translate(${f1(-20 + r * (VIEW[2] + 40))} 0)`);
    beam.style.opacity = r > 0.01 && r < 0.99 ? 1 : 0;
    root.style.setProperty("--xray", f3(r));

    // marina: el borde delantero retrocede al morderla y vuelve a crecer con el mineral que baja del nicho
    const P = s.pile, bt0 = [PILE.bite[0] * P.front, PILE.bite[1] * P.front];
    const fr = PILE.front.map((p, i) => (i > 0 && i < PILE.front.length - 1 ? [p[0] + bt0[0], p[1] + bt0[1]] : p));
    const pp = [...fr, ...PILE.back];
    pilePath.setAttribute("d", "M" + pp.map((p, i) => { const q = pp[(i + 1) % pp.length]; return `${f1(p[0])} ${f1(p[1])}Q${f1(p[0])} ${f1(p[1])} ${f1((p[0] + q[0]) / 2)} ${f1((p[1] + q[1]) / 2)}`; }).join("T") + "Z");
    pileRocks.forEach((rk, i) => { const a = fr[1 + (i % 4)], b2 = PILE.back[1 + (i % 5)], k = 0.25 + (Math.floor(i / 4) % 3) * 0.25; rockAt(rk, lerp(a[0], b2[0], k), lerp(a[1], b2[1], k), i * 47, 1.4); });
    flowRocks.forEach((rk, i) => { const ph = (s.t * 0.9 + i / flowRocks.length) % 1, top = [190 + (i - 2) * 6, 122], bot = fr[1 + (i % 4)];
      rockAt(rk, lerp(top[0], bot[0], ph), lerp(top[1], bot[1] - 3, ph * ph), ph * 300 + i * 70, 1.3, P.flow > 0.05 && !still.matches ? Math.sin(Math.PI * ph) * P.flow : 0); });

    // dumper
    const D = s.dumper, dOff = along(DUMPER.spot, D.u);
    dumperBody.setAttribute("transform", `translate(${f1(dOff[0])} ${f1(dOff[1])})`);
    dumperG.style.opacity = D.opacity.toFixed(3);
    dumperG.style.pointerEvents = D.opacity > 0.3 ? "" : "none";
    const h = (D.load / DUMPER_T) * 15, [a, b, c, d] = DUMPER.rim;
    const bump = (p, q, k, hh) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k) - hh];
    heap.setAttribute("d", D.load < 0.3 ? "" : `M${a[0] + 3} ${a[1] + 1}` + [bump(a, b, 0.25, h * 0.7), bump(a, b, 0.55, h), bump(a, b, 0.85, h * 0.85), bump(b, c, 0.3, h * 0.95), bump(b, c, 0.7, h * 0.6), [c[0] - 3, c[1] + 0.5], bump(c, d, 0.5, h * 0.35), [d[0] + 1, d[1] - 1.5], bump(d, a, 0.5, h * 0.3)].map((p) => `L${f1(p[0])} ${f1(p[1])}`).join("") + "Z");

    // cargador: posición + brazos + balde
    const L = s.lhd, lp0 = along(LHD.lip0, L.u), off = [lp0[0] - LHD.ref[0], lp0[1] - LHD.ref[1]];
    lhdBody.setAttribute("transform", `translate(${f1(off[0])} ${f1(off[1])})`);
    const An = planeRot(LHD.pivotNear, L.lift), Af = planeRot(LHD.pivotFar, L.lift);
    R.armNear.forEach((g) => g.setAttribute("transform", mstr(An)));
    R.armFar.forEach((g) => g.setAttribute("transform", mstr(Af)));
    const pin = apply(An, LHD.pinNear), d0 = [pin[0] - LHD.pinNear[0], pin[1] - LHD.pinNear[1]]; // el balde viaja con los brazos
    R.brackets.forEach((g) => g.setAttribute("transform", `translate(${f1(d0[0])} ${f1(d0[1])})`));
    const bLoad = L.loaded ? (L.pour ? 1 - smooth(L.pour * 1.4) : 1) : 0;
    const bk = `${Math.round(L.tilt)}|${Math.round(bLoad * 6)}`;
    if (bk !== bucketKey) { bucketG.innerHTML = bucketSvg(L.tilt, bLoad); bucketKey = bk; }
    bucketG.setAttribute("transform", `translate(${f1(d0[0])} ${f1(d0[1])})`);

    // vaciado: colpas que caen del labio a la tolva
    const lip = lipPoint(L.tilt), from = [lip[0] + d0[0] + off[0], lip[1] + d0[1] + off[1]];
    const bedC = [(a[0] + b[0] + c[0] + d[0]) / 4 + dOff[0], (a[1] + b[1] + c[1] + d[1]) / 4 + dOff[1] - h * 0.6];
    pourRocks.forEach((rk, i) => {
      const k = clamp((L.pour - (i / pourRocks.length) * 0.5) / 0.5);
      if (!L.pour || k <= 0 || k >= 1) { rk.style.opacity = 0; return; }
      rockAt(rk, lerp(from[0] + (i % 3 - 1) * 4, bedC[0] + (i % 4 - 1.5) * 7, k), lerp(from[1], bedC[1], k * k), k * 260 + i * 50, 1.5);
    });

    // polvo: ruedas del equipo que se mueve, y del balde al morder la marina
    puffs.forEach((c, i) => {
      const ph = (s.t * 1.4 + i / puffs.length) % 1;
      let x = 0, y = 0, on = 0;
      if (i < 5 && L.moving) { const w = apply([1, 0, 0, 1, off[0], off[1]], [40 + (i % 2) * 58, 80 + (i % 2) * 26]); x = w[0] - ph * 8; y = w[1] - ph * 5; on = 0.7; }
      else if (i < 5 && L.dig > 0 && L.dig < 1) { const p = PILE.front[1 + (i % 4)]; x = p[0]; y = p[1] - 4 - ph * 8; on = 0.85; }
      else if (i >= 5 && D.moving) { const w = [dOff[0] + 16 + ((i - 5) % 2) * 66, dOff[1] + 70 + ((i - 5) % 2) * 38]; x = w[0] + (D.reverse ? -1 : 1) * ph * 8; y = w[1] - ph * 4; on = 0.6 * D.opacity; }
      c.setAttribute("cx", f1(x)); c.setAttribute("cy", f1(y)); c.setAttribute("r", f1(2.2 + ph * 5));
      c.style.opacity = on && !still.matches ? ((1 - ph) * on).toFixed(3) : 0;
    });

    // etiquetas
    const anc = { cargador: [off[0] + 92, off[1] + 18], dumper: [dOff[0] + 64, dOff[1] - 4] };
    for (const id of ORDER) {
      tagEls[id].setAttribute("transform", `translate(${f1(anc[id][0])} ${f1(anc[id][1])})`);
      tagEls[id].toggleAttribute("data-on", selected === id && (id !== "dumper" || D.opacity > 0.5));
    }
  }

  // ------------------------------------------------------------ reloj y controles
  let t = 0, playing = !still.matches, active = false, raf = 0, last = 0;
  if (still.matches) t = STEPS[2].t0 + 0.6;
  const listeners = new Set();
  const emit = () => { const s = state(t); listeners.forEach((fn) => fn(s, api)); return s; };
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) t = (t + dt) % PERIOD;
    xrayShown += (xray - xrayShown) * (1 - Math.exp(-dt * 2.2)); // el haz sigue al valor pedido (seguimiento exponencial)
    if (Math.abs(xray - xrayShown) < 0.002) xrayShown = xray;
    draw(emit());
    raf = active && (playing || xrayShown !== xray) ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; },
    get playing() { return playing; },
    get xray() { return xray; },
    live: () => state(t),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) { kick(); draw(emit()); } else { cancelAnimationFrame(raf); raf = 0; } },
    play() { playing = true; kick(); },
    pause() { playing = false; draw(emit()); },
    togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { t = ((v % PERIOD) + PERIOD) % PERIOD; draw(emit()); },
    goStep(n) { api.seek(STEPS[clamp(n, 1, STEPS.length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(t); api.goStep(t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    setXray(v, instant = false) { xray = clamp(v); if (instant || still.matches) xrayShown = xray; kick(); draw(emit()); },
    select(id) {
      selected = id && EQUIP[id] ? id : null;
      root.toggleAttribute("data-sel", !!selected);
      root.querySelectorAll(".mn-eq").forEach((g) => g.toggleAttribute("data-on", g.dataset.equip === selected));
      draw(emit());
    },
    destroy() { api.setActive(false); listeners.clear(); root.remove(); },
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest(".mn-eq"); api.select(g ? (selected === g.dataset.equip ? null : g.dataset.equip) : null); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); });
  draw(emit());
  return api;
}

// ---------------------------------------------------------------- panel (HUD)
export function bindPanel(mina, { onEscape } = {}) {
  const $ = (s) => document.querySelector(s);
  const playBtn = $("[data-mn-play]"), stepsBox = $("[data-mn-steps]");
  stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", mina.STEPS.length);
  const stepBtns = mina.STEPS.map((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n;
    b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
    b.addEventListener("click", () => mina.goStep(s.n));
    stepsBox.appendChild(b); return b;
  });
  const info = $("[data-info]"), meter = $("[data-mn-meter]"), readout = $("[data-mn-readout]");
  const xr = $("[data-mn-xray]"), xrOut = $("[data-mn-xray-out]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = [];
  const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  function renderInfo(s) {
    const id = mina.selected;
    document.querySelectorAll("[data-mn-chip]").forEach((c) => c.toggleAttribute("data-on", c.dataset.mnChip === id));
    if (!id) { if (info.dataset.owner === "mina") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs(s), sig = id + specs.join("|");
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig; info.dataset.owner = "mina";
    $("[data-info-kicker]").textContent = e.kicker; $("[data-info-title]").textContent = e.title; $("[data-info-text]").textContent = e.text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join(""); $("[data-info-actions]").innerHTML = "";
    info.hidden = false;
  }
  function readoutOf(s) {
    const n = s.step.n, D = s.dumper;
    if (n === 1) return "Dumper vacío · entrando en reversa · 0 t";
    if (n === 5) return `Dumper cargado · saliendo · ${fmt(D.load)} t`;
    return `Pase ${Math.max(1, s.lhd.pass)} de ${PASSES} · dumper ${fmt(D.load)} t`;
  }
  off.push(mina.on((s) => {
    const st = s.step;
    if (st.n !== lastStep) {
      $("[data-mn-step-n]").textContent = st.n; $("[data-mn-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const k = Number(b.dataset.step); b.toggleAttribute("data-done", k < st.n); b.toggleAttribute("data-current", k === st.n); });
      lastStep = st.n;
    }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", (s.dumper.load / DUMPER_T).toFixed(3));
    const text = readoutOf(s); if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(mina.playing));
    playBtn.setAttribute("aria-label", mina.playing ? "Pausar la secuencia de la mina" : "Reproducir la secuencia de la mina");
    renderInfo(s);
  }));
  const syncXray = () => { xr.value = Math.round(mina.xray * 100); xrOut.textContent = `${xr.value} %`; };
  on(xr, "input", () => { mina.setXray(Number(xr.value) / 100); xrOut.textContent = `${xr.value} %`; });
  on(playBtn, "click", () => mina.togglePlay());
  on($("[data-mn-prev]"), "click", () => mina.prevStep());
  on($("[data-mn-next]"), "click", () => mina.nextStep());
  document.querySelectorAll("[data-mn-chip]").forEach((c) => on(c, "click", () => mina.select(mina.selected === c.dataset.mnChip ? null : c.dataset.mnChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "mina") mina.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "mina" || e.target.closest?.("input, [data-intro]")) return;
    if (e.key === " " && !e.target.closest("button")) mina.togglePlay();
    else if (e.key === ",") mina.prevStep();
    else if (e.key === ".") mina.nextStep();
    else if (/^[1-2]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; mina.select(mina.selected === id ? null : id); }
    else if (e.key === "ArrowUp") { mina.setXray(mina.xray + 0.1); syncXray(); }
    else if (e.key === "ArrowDown") { mina.setXray(mina.xray - 0.1); syncXray(); }
    else if (e.key === "Escape") { if (mina.selected) mina.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  syncXray();
  mina.seek(mina.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "mina") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const ZOOM = { cargador: [20, 60, 330, 330], dumper: [120, 150, 300, 300] }; // en unidades del túnel (alto extra abajo: ficha)
const toPoster = ([x, y, w, h]) => [x * REG.s + REG.tx, y * REG.s + REG.ty, w * REG.s, h * REG.s];

export async function mount({ layer, focus }) {
  const mina = await createMina();
  layer.appendChild(mina.el);
  mina.el.classList.add("mina-plate--map");
  const unbind = bindPanel(mina, { onEscape: () => { location.hash = ""; } });
  mina.setActive(true);
  // la radiografía se revela al entrar (el haz barre el terreno), como el inicio del AR
  mina.setXray(0, true); requestAnimationFrame(() => mina.setXray(1));
  let zoomed = null;
  const unzoom = mina.on(() => { const z = mina.selected && ZOOM[mina.selected] ? mina.selected : null; if (z !== zoomed) { zoomed = z; focus?.(z ? toPoster(ZOOM[z]) : null); } });
  window.pmMina = mina;
  return {
    focus: toPoster([-30, -40, VIEW[2] + 60, VIEW[3] + 70]),
    view: "mina",
    destroy: () => { unzoom(); unbind(); mina.destroy(); if (window.pmMina === mina) delete window.pmMina; },
  };
}
