// Estación 3 · Celdas de flotación — lámina viva sobre el dibujo de Emilio
// (assets/flotacion/zona.svg: la etapa completa de la infografía; celdas.svg y espesadoras.svg: los dos equipos
// principales, dibujados encima en su mismo registro).
//
// Proceso (planta concentradora de cobre): el rebalse de los hidrociclones entra a la fila de adelante (celdas
// rougher) con colector y espumante. En cada celda el rotor gira dentro del estator, aspira el aire que baja por el
// eje hueco y lo corta en burbujas finas; las partículas de sulfuro (hidrofóbicas por el colector) se pegan a las
// burbujas y suben a la espuma, que rebalsa a la canaleta: es el concentrado. La ganga (hidrofílica) sigue mojada en la
// pulpa y pasa de celda en celda por los cajones con válvula dardo hasta salir como relave. El concentrado rougher se
// limpia en la fila de atrás (celdas de limpieza), sube de ley y llega al espesador de concentrado: entra por la canaleta
// del puente al pozo de alimentación, el floculante junta las partículas en flóculos que decantan, las rastras arrastran
// el lodo al cono y sale espesado hacia un estanque agitado; el agua clara rebalsa por la canaleta perimetral y se
// recupera. El relave rougher va al segundo espesador (relaves) con el mismo mecanismo.
//
// Desde el estanque el concentrado sale por una de dos rutas (interruptor «Filtrar en planta», ver flotacion-rutas.js):
// A, bombas de pistón y concentraducto al puerto; B, filtro prensa, pila de queque y camión a la fundición.
//
// Lógica de la skill anatomy: un modelo (flujo de aire → recuperación y ley; % de sólidos de la descarga) manda y el
// dibujo lo sigue; "sigue una partícula de sulfuro" en 7 pasos por ruta con state(t, ruta) puro; selección de equipos con
// foco y ficha; zoom sobre el dibujo (cortes de una celda y del espesador, edificios que se abren) con llamadas ancladas.
//
// Geometría: la lámina vive en px de la infografía. Cada dibujo se coloca con su registro (error medio < 0,4 px) y las
// capas vivas se dibujan en las unidades del dibujo que les corresponde (isometría 0,866 / 0,5).
import { nextTick, cancelTick } from "../clock.js";
import * as R from "./flotacion-rutas.js";
import { shared } from "../shared.js";
const { pulpColor } = R;
const NS = "http://www.w3.org/2000/svg";
const U = (f) => new URL(`../../assets/flotacion/${f}`, import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const f2 = (n) => (Math.round(n * 100) / 100).toString();
const fdec = (n, d = 0) => n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const D = (pts, close = true, f = f1) => "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L") + (close ? "Z" : "");

// ---------------------------------------------------------------- registro (cada dibujo → px de la infografía)
export const VIEW = [2755, 690, 950, 540];
const ZO = { tx: 2765.36, ty: 706.67, s: 1.99363 };                    // zona.svg
const CE = { tx: 2943.31, ty: 794.22, s: 1.99952 };                    // celdas.svg
const ES = { tx: 3107.2, ty: 797.05, s: 2.00009 };                     // espesadoras.svg
const toP = (R, [x, y]) => [R.tx + R.s * x, R.ty + R.s * y];
const IX = [0.866, 0.5], IY = [-0.866, 0.5];
const ring = (C, r, th) => [C[0] + r * (Math.cos(th) * IX[0] + Math.sin(th) * IY[0]), C[1] + r * (Math.cos(th) * IX[1] + Math.sin(th) * IY[1])];

// celdas (unidades de celdas.svg): traslado de cada celda respecto de la celda tipo (celda_de_flotacion_un.svg)
const CELLS = {
  r: [[0.0, 9.36], [21.43, 23.7], [49.67, 38.44], [71.1, 52.77]],      // fila de adelante: rougher (fluye hacia +X)
  l: [[22.32, -0.01], [43.75, 14.33], [71.99, 29.07], [93.42, 43.4]],  // fila de atrás: limpieza
};
const CELL = { top: [15.68, 15.2], r: 9.64, H: 22.5, deckBack: [16.7, 6.52] };
const cellBot = (T) => [T[0] + CELL.top[0], T[1] + CELL.top[1] + CELL.H];
const cellP = (T, th, z, r = CELL.r) => { const p = ring(cellBot(T), r, th); return [p[0], p[1] - z]; };

// espesadores (unidades de espesadoras.svg): 1 = concentrado (atrás), 2 = relaves (adelante)
const TH = [{ o: [0, 0] }, { o: [64.29, 38.05] }].map((t) => ({ ...t, rim: add(t.o, [32.84, 19.28]), water: add(t.o, [32.84, 20.46]), rR: 26.5, rW: 25.5, wall: 10.7,
  feed: [add(t.o, [10.2, 5.6]), add(t.o, [32.3, 18.4])] }));
const thP = (t, th, depth, r = t.rR) => { const p = ring(t.rim, r, th); return [p[0], p[1] + depth]; };

// tuberías agregadas (px de la infografía): alimentación desde molienda y concentrado de limpieza al espesador
const deckBackP = (T) => toP(CE, add(T, CELL.deckBack));
const PIPES = (() => {
  const feedIn = toP(CE, cellP(CELLS.r[0], (120 * Math.PI) / 180, 3));
  const a = deckBackP(CELLS.l[3]), b = toP(ES, TH[0].feed[0]);
  const riserTop = [a[0], b[1] + (a[0] - b[0]) * (0.5 / 0.866)];
  return {
    feed: [[feedIn[0] - 98, feedIn[1] + 56.6], feedIn],
    conc: [a, riserTop, b],
  };
})();

function polyline(pts) {
  const S = [0]; for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = S[S.length - 1];
  const at = (s) => { s = clamp(s, 0, len); let i = 1; while (i < S.length - 1 && S[i] < s) i++; const u = (s - S[i - 1]) / (S[i] - S[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]; };
  return { len, at, d: D(pts, false) };
}
const PL = { feed: polyline(PIPES.feed), conc: polyline(PIPES.conc), bridge1: polyline(TH[0].feed.map((p) => toP(ES, p))), bridge2: polyline(TH[1].feed.map((p) => toP(ES, p))) };

// ---------------------------------------------------------------- modelo
const AIR_MIN = 0.6, AIR_MAX = 1.6;
export const UF_MIN = 45, UF_MAX = 72, UF_NOM = 65;                     // % de sólidos en la descarga (referencial)
export const UF_WIN = [55, 68];                                          // ventana de transporte por concentraducto
export const inWindow = (uf) => uf >= UF_WIN[0] - 0.5 && uf <= UF_WIN[1] + 0.5;
export const solidsWarning = (uf) => (uf < 55 ? "pulpa diluida: viaja más agua y puede decantar si baja la velocidad" : uf > 70 ? "pulpa muy viscosa: exige mucha más presión de bombeo" : "");
const model = (air, uf = UF_NOM) => ({ air, R: 70 + 22 * (1 - Math.exp(-2.2 * air)), G: 34 - 8 * air, uf, feedSol: 25, entrain: clamp((air - 0.6) / 1.0), win: inWindow(uf), cycle: R.cycleFactor(uf) });
const OMEGA_ROTOR = 7, OMEGA_RAKE = (Math.PI * 2) / 28;                 // rad/s (visual; las rastras reales dan ~1 vuelta cada 10–20 min)

// ---------------------------------------------------------------- secuencia "sigue una partícula" (state(t, ruta) puro)
// Cada paso: llegada (ARRIVE s: se ilumina el equipo y el resto baja a ~35 %), acción (tramos) y pausa (HOLD s con el
// resultado a la vista). `cut`: qué se abre solo en ese paso (el equipo por dentro).
const ARRIVE = 0.5, HOLD = 1.2;
const COMMON = [
  { id: "rougher", lit: ["rougher"], cut: "cell", label: "La pulpa de molienda entra a la primera celda", act: [["pipe", PL.feed.len / 22], ["in", 1.2]] },
  { id: "rougher", lit: ["rougher"], cut: "cell", label: "El rotor reparte el aire y el sulfuro se pega a una burbuja", act: [["rise", 6]] },
  { id: "rougher", lit: ["rougher"], cut: "cell", label: "La burbuja sube a la espuma y rebalsa; la ganga sigue al relave", act: [["froth", 4.5]] },
  { id: "limpieza", lit: ["limpieza"], label: "Las celdas de limpieza suben la ley del concentrado", act: [["bank", 7]] },
  { id: "concentrado", lit: ["concentrado"], cut: "th", label: "El concentrado entra al espesador con floculante", act: [["bridge", PL.bridge1.len / 12], ["well", 2.2], ["settle", 4]] },
];
const ENDS = {
  A: [
    { id: "bombas", lit: ["concentrado", "estanque", "bombas"], cut: "bombas", label: "Las bombas de pistón impulsan la pulpa espesa", act: [["under", 2.5], ["toPumps", 1.5], ["pump", 3.5]] },
    { id: "bombas", lit: ["bombas"], label: "El concentraducto la lleva al puerto", act: [["duct", 5]] },
  ],
  B: [
    { id: "filtro", lit: ["concentrado", "estanque", "filtro"], cut: "galpon", label: "El filtro prensa le saca el agua y el filtrado vuelve al espesador", act: [["under", 2.5], ["toFilter", 2], ["press", 7], ["filtrate", 3.5]] },
    { id: "filtro", lit: ["filtro"], cut: "galpon", label: "El queque se acopia y sale en camión a la fundición", act: [["cake", 3], ["truck", 4.5]] },
  ],
};
function build(list) {
  let t = 0;
  return list.map((q, i) => {
    const t0 = t, ta = t0 + ARRIVE; let x = ta;
    const stages = q.act.map(([k, d]) => { const r = { k, a: x, b: x + d }; x += d; return r; });
    t = x + HOLD;
    return { n: i + 1, id: q.id, lit: q.lit, label: q.label, cut: q.cut || null, t0, ta, th: x, t1: t, stages };
  });
}
export const ROUTES = { A: build([...COMMON, ...ENDS.A]), B: build([...COMMON, ...ENDS.B]) };
export const periodOf = (ruta) => ROUTES[ruta][ROUTES[ruta].length - 1].t1;
const stepAt = (t, ruta) => { const P = periodOf(ruta); t = ((t % P) + P) % P; return ROUTES[ruta].find((s) => t >= s.t0 && t < s.t1) || ROUTES[ruta][ROUTES[ruta].length - 1]; };
/** estado de la secuencia en el tiempo t de la ruta: paso, fase, tramo y avance, y cuánto está abierto cada equipo */
export function state(t, ruta = "A") {
  const P = periodOf(ruta); t = ((t % P) + P) % P;
  const step = stepAt(t, ruta), first = step.stages[0], last = step.stages[step.stages.length - 1];
  let phase = "act", sg = first, u = 0;
  if (t < step.ta) phase = "arrive";
  else if (t >= step.th) { phase = "hold"; sg = last; u = 1; }
  else { sg = step.stages.find((r) => t < r.b) || last; u = clamp((t - sg.a) / (sg.b - sg.a)); }
  const prev = ROUTES[ruta][(step.n + ROUTES[ruta].length - 2) % ROUTES[ruta].length], k = smooth((t - step.t0) / ARRIVE);
  const openOf = (key) => (step.cut === key ? (prev.cut === key ? 1 : k) : prev.cut === key ? 1 - k : 0);
  return { t, ruta, step, phase, stage: sg.k, u, arrive: k, open: { cell: openOf("cell"), th: openOf("th"), bombas: openOf("bombas"), galpon: openOf("galpon") } };
}

// ---------------------------------------------------------------- fichas
const dest = (ruta) => (ruta === "B" ? "filtros" : "concentraducto");
const EQUIP = {
  rougher: { kicker: "Flotación primaria", title: "Celdas rougher", text: "Celdas en serie: el rotor gira dentro del estator, aspira el aire del eje hueco y lo reparte en burbujas finas. Los sulfuros, hidrofóbicos por el colector, se pegan a las burbujas y suben a la espuma, que rebalsa a la canaleta. La ganga sigue en la pulpa de celda en celda (cajones con válvula dardo) hasta el relave.",
    specs: (m) => [`Recuperación ~${Math.round(m.R)} %`, `Aire ${fdec(m.air, 1)}× nominal`, "Espumante: burbujas de 1–2 mm"] },
  limpieza: { kicker: "Flotación de limpieza", title: "Celdas de limpieza", text: "Reciben el concentrado rougher (normalmente remolido) y lo vuelven a flotar con menos aire y espuma más alta: la ganga arrastrada se lava y vuelve atrás, y el concentrado sube de ley.",
    specs: (m) => [`Ley del concentrado ~${Math.round(m.G)} % Cu`, "Colas → vuelven al circuito", "Espuma más profunda"] },
  concentrado: { kicker: "Separación sólido-líquido", title: "Espesador de concentrado",
    text: (m, ruta) => `La pulpa entra por la canaleta del puente al pozo de alimentación, donde se mezcla con floculante. Los flóculos decantan, las rastras los llevan al cono y la descarga sale espesa hacia el estanque agitado. ${ruta === "B" ? "De ahí va al filtro prensa, y el agua filtrada vuelve a este espesador." : "De ahí las bombas de pistón la impulsan por el concentraducto al puerto."} El agua clara rebalsa por la canaleta perimetral y se recupera.`,
    specs: (m, ruta) => [`Alimentación ~${m.feedSol} % de sólidos`, `Descarga ~${Math.round(m.uf)} % de sólidos → ${dest(ruta)}`, ruta === "B" ? "Recibe el filtrado" : "Rebalse: agua recuperada"] },
  relaves: { kicker: "Recuperación de agua", title: "Espesador de relaves", text: "Mismo principio que el de concentrado, con el relave de las celdas rougher: recupera el agua para la planta y entrega un relave espesado que se bombea al tranque.",
    specs: () => ["Descarga → tranque de relaves", "Rebalse → agua de proceso", "Floculante en el pozo"] },
  estanque: { kicker: "Almacenamiento de pulpa", title: "Estanque agitado de concentrado", text: "Recibe la descarga del espesador. El agitador mantiene los sólidos en suspensión para que no decanten, y da un volumen de reserva que empareja el flujo antes de bombear o filtrar.",
    specs: (m, ruta) => [`Pulpa ~${Math.round(m.uf)} % de sólidos`, "Agitación continua", ruta === "B" ? "Alimenta al filtro prensa" : "Alimenta a las bombas de pistón"] },
  bombas: { kicker: "Transporte de pulpa", title: "Casa de bombas del concentraducto", text: "Bombas de pistón de desplazamiento positivo: entregan un caudal casi constante contra la alta presión que exige mover pulpa espesa por muchos kilómetros de concentraducto.",
    specs: (m, ruta) => [ruta === "A" ? (m.win ? "Bombeando al puerto" : "Detenidas: fuera de la ventana de transporte") : "En espera (ruta a filtros)", `Ventana ${UF_WIN[0]}–${UF_WIN[1]} % de sólidos`, "Bombas de pistón"] },
  filtro: { kicker: "Filtrado", title: "Filtro prensa", text: "La pulpa entra a las cámaras entre placas con telas; se presiona y se sopla aire, el agua filtrada vuelve al espesador y al abrir las placas, una por una, cae el queque a la pila de acopio.",
    specs: (m, ruta) => ["Queque ~8–9 % de humedad", `Ciclo ${fdec(m.cycle, 1)}× el nominal (más agua, más largo)`, ruta === "B" ? "Llenado · prensado · soplado · descarga · cierre" : "En espera (ruta al concentraducto)"] },
};
const ORDER = ["rougher", "limpieza", "concentrado", "relaves", "estanque", "bombas", "filtro"];
const KEY_BUILDING = { bombas: "bombas", filtro: "galpon" };
// ---------------------------------------------------------------- utilidades SVG
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
// reescribe una capa del dibujo sólo si su marcado cambió (muchas salen idénticas cuadro a cuadro: fondo, rieles…)
const setHTML = (n, s) => { if (n.__html !== s) { n.__html = s; n.innerHTML = s; } };
const circ = (p, r, cls, o) => `<circle class="${cls}" cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(r)}"${o != null ? ` style="opacity:${f2(o)}"` : ""}/>`;

// ---------------------------------------------------------------- ventana en una celda (unidades de celdas.svg)
function cellWindowSvg(T, open, s, m) {
  const w = lerp(0.18, 1.15, open), thA = Math.PI / 4 - w, thB = Math.PI / 4 + w;
  const z0 = lerp(9, 1.2, open), z1 = lerp(13, CELL.H - 1.6, open), n = 16;
  const rim = []; for (let i = 0; i <= n; i++) rim.push(cellP(T, lerp(thA, thB, i / n), z0)); for (let i = 0; i <= n; i++) rim.push(cellP(T, lerp(thB, thA, i / n), z1));
  const win = D(rim, true, f2), C = cellBot(T), zf = CELL.H - 4;      // nivel de la interfaz pulpa / espuma
  let g = `<clipPath id="fl-cw"><path d="${win}"/></clipPath><path class="fl-void" d="${win}"/><g clip-path="url(#fl-cw)">`;
  // pared del fondo y pulpa
  const back = (z) => { const pts = []; for (let i = 0; i <= 24; i++) pts.push(cellP(T, lerp(Math.PI * 0.75, Math.PI * 1.75, i / 24), z)); return pts; };
  g += `<path class="fl-pulp" d="${D([...back(0), ...back(zf).reverse()], true, f2)}"/>`;
  g += `<path class="fl-froth" d="${D([...back(zf), ...back(CELL.H).reverse()], true, f2)}"/>`;
  // eje hueco, estator y rotor que gira
  const sh = (z) => [C[0], C[1] - z];
  g += `<path class="fl-shaft" d="M${f2(C[0])} ${f2(C[1] - 2.6)}V${f2(C[1] - CELL.H - 1)}"/>`;
  const st = []; for (let i = 0; i <= 20; i++) st.push(ring(sh(2.4), 3.1, (i / 20) * Math.PI * 2));
  g += `<path class="fl-stator" d="${D(st, true, f2)}"/>`;
  for (let i = 0; i < 6; i++) { const th = s.rot + (i / 6) * Math.PI * 2, a = ring(sh(2.4), 0.6, th), b = ring(sh(2.4), 2.4, th); if (Math.cos(th) + Math.sin(th) < -0.4) continue; g += `<path class="fl-rotor" d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1] - 0.9)}L${f2(b[0])} ${f2(b[1] + 0.9)}"/>`; }
  // burbujas que salen del rotor y suben; algunas cargadas con sulfuro
  const nb = Math.round(26 + 22 * (m.air - 1));
  for (let j = 0; j < nb; j++) {
    const ph = (s.flow * (0.18 + 0.06 * hash(j)) + hash(j * 3.1)) % 1, th = hash(j * 5.3) * Math.PI * 2, rr = 2.4 + ph * 6.2 * hash(j * 7.7);
    const p = ring(sh(2.4 + ph * (zf - 2.4)), rr, th + ph * 1.5), loaded = hash(j * 2.2) < 0.45;
    g += circ([p[0], p[1]], 0.38 + ph * 0.25, "fl-bub");
    if (loaded && ph > 0.15) g += circ([p[0] + 0.3, p[1] + 0.3], 0.2, "fl-sulf");
  }
  // ganga que circula en la pulpa
  for (let j = 0; j < 14; j++) { const ph = (s.flow * 0.12 + hash(j * 9.1)) % 1, th = ph * Math.PI * 2 + j; const p = ring(sh(1.5 + hash(j) * (zf - 4)), 2 + hash(j * 4) * 6, th); g += circ(p, 0.24, "fl-gangue"); }
  // espuma: burbujas apretadas en la capa de arriba
  for (let j = 0; j < 22; j++) { const th = Math.PI * 0.8 + hash(j * 1.9) * Math.PI * 0.9, p = cellP(T, th, zf + 0.6 + hash(j * 3.3) * 2.6, CELL.r * (0.3 + 0.7 * hash(j * 6.1))); g += circ(p, 0.55 + 0.3 * hash(j), "fl-frothb"); }
  g += `</g><path class="fl-cut" d="${win}"/>`;
  return g;
}

// ---------------------------------------------------------------- espesador: rastras que giran, canaleta y ventana (unidades de espesadoras.svg)
function rakesSvg(t, ang) {
  let o = "";
  for (let i = 0; i < 4; i++) { const th = ang + (i / 4) * Math.PI * 2, long = i % 2 === 0, a = ring(t.water, 3.2, th), b = ring(t.water, long ? t.rW - 0.9 : t.rW * 0.55, th);
    o += `<path class="fl-rake" d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}"/>`; }
  return o;
}
function launderSvg(t, flow) {
  const pts = []; for (let i = 0; i <= 64; i++) pts.push(ring([t.rim[0], (t.rim[1] + t.water[1]) / 2], (t.rR + t.rW) / 2, (i / 64) * Math.PI * 2));
  return `<path class="fl-over" style="stroke-dashoffset:${f2(-(flow * 2.2) % 3.2)}" d="${D(pts, false, f2)}"/>`;
}
function wellSvg(t, flow) {
  let o = ""; for (let i = 0; i < 3; i++) { const th = flow * 2 + (i / 3) * Math.PI * 2, a = ring(add(t.water, [0, 1.6]), 2.2, th), b = ring(add(t.water, [0, 1.6]), 2.2, th + 0.8); o += `<path class="fl-swirl" d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}"/>`; }
  return o;
}
function thWindowSvg(t, open, s, conc) {
  // corte en el manto: la cara del corte muestra las capas (agua clara, sedimentación, compresión) y los flóculos que bajan
  const w = lerp(0.15, 0.95, open), thA = Math.PI / 4 - w, thB = Math.PI / 4 + w, d0 = lerp(4, 0.4, open), d1 = lerp(7, t.wall - 0.2, open), n = 20;
  const rim = []; for (let i = 0; i <= n; i++) rim.push(thP(t, lerp(thA, thB, i / n), d0)); for (let i = 0; i <= n; i++) rim.push(thP(t, lerp(thB, thA, i / n), d1));
  const win = D(rim, true, f2);
  const band = (a, b) => { const top = [], bot = []; for (let i = 0; i <= n; i++) { const th = lerp(thA - 0.05, thB + 0.05, i / n); top.push(thP(t, th, a)); bot.push(thP(t, th, b)); } return D([...top, ...bot.reverse()], true, f2); };
  // el lecho sube y se oscurece con más % de sólidos en la descarga
  const zc = 1.18 + 2.6, zs = zc + lerp(4.4, 1.8, clamp((s.uf - 45) / 27));
  let g = `<clipPath id="fl-tw"><path d="${win}"/></clipPath><g clip-path="url(#fl-tw)">`;
  g += `<path class="fl-void" d="${band(-1, 1.18)}"/><path class="fl-z-clear" d="${band(1.18, zc)}"/><path class="fl-z-settle${conc ? "" : " fl-z-tails"}" d="${band(zc, zs)}"/><path class="fl-z-bed${conc ? "" : " fl-z-tails"}" d="${band(zs, t.wall + 1)}"${conc ? ` style="fill:${pulpColor(s.uf)}"` : ""}/>`;
  for (let j = 0; j < 46; j++) { const ph = (s.flow * 0.09 + hash(j * 3.7)) % 1, th = lerp(thA, thB, hash(j * 2.1)), dd = lerp(1.6, zs + 0.4, ph);
    g += circ(thP(t, th, dd), 0.16 + ph * 0.2, conc ? "fl-floc" : "fl-floc fl-floc--tails", 1 - smooth((ph - 0.85) / 0.15)); }
  // la rastra raspa el fondo: pasa por el corte cada media vuelta
  const ph = ((s.rake / Math.PI) % 1 + 1) % 1, thR = lerp(thB + 0.1, thA - 0.1, ph), a = thP(t, thR, t.wall - 2.4), b = thP(t, thR, t.wall - 0.3);
  g += `<path class="fl-rake-b" d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}"/>`;
  g += `</g><path class="fl-cut" d="${win}"/>`;
  return g;
}

// ---------------------------------------------------------------- lámina
export async function createFlotacion() {
  const root = document.createElement("div");
  root.className = "fl-plate";
  root.style.cssText = `position:absolute;left:${VIEW[0]}px;top:${VIEW[1]}px;width:${VIEW[2]}px;height:${VIEW[3]}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "fl-svg", role: "group", tabindex: "0",
    "aria-label": "Celdas de flotación: el aire se reparte en burbujas, los sulfuros suben a la espuma y rebalsan como concentrado; el espesador lo hace decantar y desde un estanque agitado sale al puerto o a los filtros. Espacio pausa; coma y punto cambian de paso; 1 a 7 eligen un equipo; F filtra en planta; R muestra ambas rutas." }, root);
  const defs = el("defs", {}, svg);
  const { SIL } = await import("./flotacion-geo.js");
  const bridgeEl = el("path", { d: R.BRIDGE, class: "fl-sil" }, svg);     // base bajo las cañerías al galpón
  const silEl = el("path", { d: SIL, class: "fl-sil" }, svg);
  // ¿el punto está sobre lo impreso? (para que ninguna llamada se salga)
  const printedAt = (x, y) => { const q = svg.createSVGPoint(); q.x = x; q.y = y; return silEl.isPointInFill(q) || bridgeEl.isPointInFill(q); };
  async function loadArt(file, pre, Rg, cls) {
    const text = (await (await fetch(U(file))).text()).replace(/\bcls-(\d+)/g, `${pre}cls-$1`).replace(/(id="|url\(#)(clippath[-\d]*)/g, `$1${pre}$2`).replace(/\sid="(?!fl)[^"]*"/g, (m0) => (m0.includes("clippath") ? m0 : ""));
    const doc = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
    doc.querySelectorAll("metadata, title, desc").forEach((n) => n.remove());
    const st = doc.querySelector("style"); if (st) { el("style", {}, defs).textContent = st.textContent; st.remove(); }
    const g = el("g", { class: cls, transform: `translate(${Rg.tx} ${Rg.ty}) scale(${Rg.s})` }, svg);
    [...doc.children].forEach((n) => { if (n.tagName === "defs") [...n.children].forEach((c) => defs.appendChild(document.importNode(c, true))); else g.appendChild(document.importNode(n, true)); });
    return g;
  }
  const kids = (n) => [...n.children].filter((c) => !["defs", "style", "title", "clipPath"].includes(c.tagName));
  const deep = (n, path) => path.reduce((a, i) => kids(a)[i], n);

  const zona = await loadArt("zona.svg", "flz-", ZO, "fl-zona");
  // tuberías agregadas detrás de los equipos
  const pipeBack = el("g", { class: "fl-pipes" }, svg);
  const celdas = await loadArt("celdas.svg", "flc-", CE, "fl-celdas");
  const esp = await loadArt("espesadoras.svg", "fle-", ES, "fl-esp");

  // ---- edificios y estanques de zona.svg: interiores, techo que sube y muros bajo la altura de corte
  const zr = deep(zona, [0, 0, 0]);                                       // grupo con las piezas de la planta
  const zk = kids(zr);
  const toZ = ([x, y]) => [(x - ZO.tx) / ZO.s, (y - ZO.ty) / ZO.s];
  // lo impreso (silueta de zona.svg y la base al galpón), en las unidades de zona
  const printed = el("clipPath", { id: "fl-printed", clipPathUnits: "userSpaceOnUse" }, defs);
  for (const d of [SIL, R.BRIDGE]) el("path", { d, transform: `scale(${1 / ZO.s}) translate(${-ZO.tx} ${-ZO.ty})` }, printed);
  const infoG = (parent, before) => { const g = el("g", { transform: `scale(${1 / ZO.s}) translate(${-ZO.tx} ${-ZO.ty})` }); parent.insertBefore(g, before); return g; }; // dibuja en px de infografía dentro de zona
  // concentraducto: entre la plataforma y los equipos del fondo (que lo tapan donde pasa por detrás)
  const ductG = infoG(zr, zk[1]);
  const pipeSvg = (d) => `<path class="fl-pipe-o" d="${d}"/><path class="fl-pipe-w" d="${d}"/>`;
  const mkBuilding = (id, roofEls, wallEls, parent, beforeInt, cfg, W) => {
    const interior = el("g", { "data-eq": id, class: "fl-int" }); parent.insertBefore(interior, beforeInt);
    const intG = el("g", { transform: `scale(${1 / ZO.s}) translate(${-ZO.tx} ${-ZO.ty})` }, interior);
    const cp = el("path", {}, el("clipPath", { id: `fl-cut-${id}`, clipPathUnits: "userSpaceOnUse" }, defs));
    wallEls.forEach((w) => { w.setAttribute("clip-path", `url(#fl-cut-${id})`); w.setAttribute("data-eq", id); });
    const keep = el("g", { "clip-path": "url(#fl-printed)" }); roofEls[0].before(keep);
    const roof = el("g", { "data-eq": id, class: "fl-roof" }, keep); roofEls.forEach((r) => roof.appendChild(r));
    return { id, interior: intG, cp, roof, cfg, W, shown: 0, target: 0 };
  };
  const shed = zk[R.ZONA_SHED.g[0]], sk = kids(shed);
  const buildings = {
    galpon: mkBuilding("filtro", R.ZONA_SHED.roof.map((i) => sk[i]), R.ZONA_SHED.wall.map((i) => sk[i]), shed, shed.firstChild, R.SHED, R.Ws),
    bombas: mkBuilding("bombas", R.ZONA_PUMPH.roof.map((i) => zk[i]), R.ZONA_PUMPH.wall.map((i) => zk[i]), zr, zk[3], R.PUMPH, R.Wp),
  };
  kids(zk[1]).forEach((n) => n.setAttribute("data-eq", "estanque"));      // los dos estanques con agitador
  const agitG = infoG(zr, zk[2]); agitG.setAttribute("data-eq", "estanque"); agitG.classList.add("fl-agitators");

  // equipos
  const rows = { r: [deep(celdas, [0, 0, 1]), deep(celdas, [0, 0, 3])], l: [deep(celdas, [0, 0, 0]), deep(celdas, [0, 0, 2])] };
  rows.r.forEach((n) => n.setAttribute("data-eq", "rougher")); rows.l.forEach((n) => n.setAttribute("data-eq", "limpieza"));
  const thG = [deep(esp, [0, 0]), deep(esp, [0, 1])];
  thG[0].setAttribute("data-eq", "concentrado"); thG[1].setAttribute("data-eq", "relaves");
  // rastras dibujadas → se reemplazan por las que giran (debajo del puente y del accionamiento)
  const rakeL = [], launL = [], wellL = [], winTh = [];
  thG.forEach((g, i) => { const k = kids(g); [k[2], k[16], k[17], k[18]].forEach((n) => n && (n.style.display = "none"));
    rakeL[i] = el("g", { class: "fl-rakes" }); k[1].after(rakeL[i]); launL[i] = el("g", { class: "fl-laund" }); rakeL[i].after(launL[i]); wellL[i] = el("g", { class: "fl-well" }); k[4].after(wellL[i]);
    winTh[i] = el("g", { class: "fl-win" }); k[1].after(winTh[i]); });
  // ventana en la primera celda rougher: va justo después de su cuerpo (lo de adelante la tapa)
  const r1 = deep(celdas, [0, 0, 1, 0]);
  const cellWin = el("g", { class: "fl-win" }); kids(r1)[1].after(cellWin);
  // tuberías (alimentación detrás de la celda; concentrado delante de la fila de atrás)
  const pipeG = { feed: el("g", { class: "fl-pipe", "data-eq": "rougher" }, pipeBack) };
  const flow = {};
  for (const [k, g] of Object.entries(pipeG)) { el("path", { d: PL[k].d, class: "fl-pipe-o" }, g); el("path", { d: PL[k].d, class: "fl-pipe-w" }, g); flow[k] = el("path", { d: PL[k].d, class: `fl-flow fl-flow--${k}` }, g); }

  // ---- rutas del concentrado: cañerías con soportes (delante de la plataforma, detrás de celdas y espesadores)
  const RT = {};
  for (const key of ["under", "toPumps", "toFilter", "filtrate", "duct"]) {
    const P = R.polyline(R.PIPES[key]);
    const host = key === "duct" ? ductG : pipeBack;
    const g = el("g", { class: "fl-route", "data-route": R.ROUTE_OF[key], "data-pipe": key }, host);
    g.innerHTML = (key === "duct" ? "" : R.supportsSvg(key)) + pipeSvg(P.d) + `<path class="fl-rflow${key === "filtrate" ? " fl-rflow--water" : ""}" d="${P.d}"/>`;
    RT[key] = { g, P, flow: g.querySelector(".fl-rflow") };
  }
  // punta de flecha del concentraducto (hacia el puerto)
  { const [a, b] = R.PIPES.duct, d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d), u = [d[0] / l, d[1] / l], n = [-u[1], u[0]], tip = add(b, [u[0] * 5, u[1] * 5]);
    el("path", { class: "fl-arrow", d: D([tip, add(b, [n[0] * 3.4, n[1] * 3.4]), add(b, [-n[0] * 3.4, -n[1] * 3.4])]) }, RT.duct.g); }

  const topG = el("g", { class: "fl-top" }, svg);
  // alimentación por la canaleta del puente: dentro de cada espesador (en sus unidades), sobre el puente
  thG.forEach((g, i) => { flow[`bridge${i + 1}`] = el("path", { d: D(TH[i].feed, false, f2), class: `fl-flow fl-flow--local fl-flow--${i ? "tails" : "conc"}` }, g); });
  // orden de pintado: los espesadores quedan detrás de las celdas; pasan adelante sólo cuando se eligen (o se cortan)
  // cada espesador va en su propio grupo (misma transformación) para poder adelantar sólo el elegido
  const espW = thG.map((g, i) => { const w = i ? el("g", { class: "fl-esp", transform: esp.getAttribute("transform") }) : esp; if (i) { esp.after(w); w.appendChild(g); } return w; });
  espW.forEach((w) => celdas.before(w));
  let thFront = -1;
  const setFront = (i) => { if (i === thFront) return; thFront = i; espW.forEach((w, j) => (j === i ? celdas.after(w) : celdas.before(w))); };
  const lab = el("g", { class: "fl-labels" }, topG);
  const L = (p, t, a = "start") => { const e = el("text", { x: f1(p[0]), y: f1(p[1]), class: "fl-small", "text-anchor": a }, lab); e.textContent = t; return e; };
  L(add(PIPES.feed[0], [-2, 9]), "desde molienda", "start");
  const underLab = L(toP(ES, add(TH[0].rim, [14, 37])), "descarga → concentraducto", "start");
  L(toP(ES, add(TH[1].rim, [14, 37])), "descarga → tranque", "start");

  // destinos: etiquetas enlazadas a la estación (puerto, fundición)
  const destG = el("g", { class: "fl-dests" }, svg);
  const mkDest = (route, goto, text, p) => {
    const w = text.length * 3.5 + 12, g = el("g", { class: "fl-dest", "data-route": route, role: "link", tabindex: "0", "aria-label": `${text.replace("→", "hacia")}: abrir la estación`, transform: `translate(${p[0]} ${p[1]})` }, destG);
    el("rect", { x: -w / 2, y: -6, width: w, height: 12, rx: 6, class: "fl-dest-pill" }, g);
    el("text", { x: 0, y: 2.4, class: "fl-dest-text", "text-anchor": "middle" }, g).textContent = text;
    const go = (e) => { e.stopPropagation(); dispatchEvent(new CustomEvent("pm:goto", { detail: goto })); };
    g.addEventListener("click", go);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } });
    return g;
  };
  const dests = { A: mkDest("A", "puerto", "concentraducto → Puerto", [2993, 738]), B: mkDest("B", "fundicion", "camión → Fundición", [2816, 816]) };

  // partícula que se sigue
  const tourG = el("g", { class: "fl-tour" }, svg);
  const tourRing = el("circle", { r: 5, class: "fl-tour-ring" }, tourG), tourDot = el("circle", { r: 1.9, class: "fl-tour-dot" }, tourG);
  const tourPulse = el("circle", { r: 8, class: "fl-tour-pulse" }, svg);

  // etiquetas de foco
  const tagsG = el("g", { class: "fl-tags" }, svg);
  const TAGS = { rougher: ["Celdas rougher", toP(CE, add(CELLS.r[1], [15.7, 5]))], limpieza: ["Celdas de limpieza", toP(CE, add(CELLS.l[2], [15.7, -2]))], concentrado: ["Espesador de concentrado", [3157, 823]], relaves: ["Espesador de relaves", toP(ES, add(TH[1].o, [40, 4]))],
    estanque: ["Estanque agitado", [2958, 770]], bombas: ["Casa de bombas", [3082, 780]], filtro: ["Filtro prensa", [2888, 804]] };   // píldoras dentro de lo impreso (?qa=silueta)
  const tagEls = {};
  for (const [id, [label, p]] of Object.entries(TAGS)) {
    const g = el("g", { class: "fl-tag", transform: `translate(${f1(p[0])} ${f1(p[1])})` }, tagsG);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -12, class: "fl-tag-line" }, g);
    const ww = label.length * 3.7 + 12; el("rect", { x: -ww / 2, y: -23, width: ww, height: 11, rx: 5.5, class: "fl-tag-pill" }, g);
    el("text", { x: 0, y: -15.6, class: "fl-tag-text", "text-anchor": "middle" }, g).textContent = label; tagEls[id] = g;
  }
  // zoom sobre el dibujo: llamadas ancladas al dibujo ampliado
  const zoomG = el("g", { class: "fl-zoom", "aria-hidden": "true" }, svg);

  // ?qa=silueta: en rojo todo lo vivo que se pinte fuera de lo impreso (silueta de zona.svg + la base al galpón)
  const QA = typeof location !== "undefined" && new URLSearchParams(location.search).get("qa") === "silueta";
  if (QA) {
    const liveEls = [pipeBack, ductG, agitG, buildings.galpon.interior.parentNode, buildings.bombas.interior.parentNode, cellWin, ...winTh, topG, destG, tourG, tourPulse, tagsG, zoomG];
    liveEls.forEach((n, i) => (n.id = `fl-qa-${i}`));
    const mask = el("mask", { id: "fl-qa-out", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 6000, height: 3000 }, defs);
    el("rect", { x: 0, y: 0, width: 6000, height: 3000, fill: "#fff" }, mask); el("path", { d: SIL, fill: "#000" }, mask); el("path", { d: R.BRIDGE, fill: "#000" }, mask);
    const red = el("filter", { id: "fl-qa-red", x: "-5%", y: "-5%", width: "110%", height: "110%" }, defs);
    el("feFlood", { "flood-color": "#ff0033", result: "c" }, red); el("feComposite", { in: "c", in2: "SourceAlpha", operator: "in" }, red);
    const qa = el("g", { class: "fl-qa", "pointer-events": "none" }, svg);
    const out = el("g", { mask: "url(#fl-qa-out)", filter: "url(#fl-qa-red)", class: "fl-qa-out" }, qa);
    // <use> de los vivos: los que están dentro de zona o de los espesadores se repiten con su transformación
    liveEls.forEach((n) => { const m = n.parentNode.getCTM && svg.getCTM() ? null : null; const u = el("use", { href: `#${n.id}` }, out); u.dataset.src = n.id; });
    el("path", { d: SIL, fill: "none", stroke: "#00b7ff", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }, qa);
    el("path", { d: R.BRIDGE, fill: "none", stroke: "#e600e6", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }, qa);
    // las transformaciones de los grupos padres no viajan con <use>: se copian una vez en el DOM ya armado
    root.__qaFix = () => out.querySelectorAll("use").forEach((u) => { const n = svg.querySelector(`#${u.dataset.src}`); const a = n?.parentNode?.getCTM?.(), b = svg.getCTM(); if (a && b) { const m = b.inverse().multiply(a); u.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`); } });
    root.dataset.qa = "silueta";
  }

  // unidades para el foco
  const units = new Map();
  const classify = (n, inh) => { if (["defs", "style", "clipPath"].includes(n.tagName) || n.classList?.contains("fl-win") || n.classList?.contains("fl-route")) return; const eq = n.dataset?.eq || inh;
    if (n.querySelector?.("[data-eq]")) [...n.children].forEach((c) => classify(c, eq)); else units.set(n, eq || ""); };
  [zona, pipeBack, celdas, ...espW, topG].forEach((n) => classify(n, ""));

  // ------------------------------------------------------------ estado
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const S = { t: 0, rot: 0, rake: 0, flow: 0, air: 1, cell: 0, th: 0, uf: UF_NOM, ruta: "A", rutas: false, press: 0, pile: 0.5, truck: 0, stroke: 0, agit: 0 };
  const shown = { cell: 0, th: 0, uf: UF_NOM, bombas: 0, galpon: 0 };
  let selected = null, playing = !still.matches, active = false, raf = 0, last = 0, lastLit = null;
  const steps = () => ROUTES[S.ruta];
  if (still.matches) S.t = steps()[1].t0 + 2;
  function step(dt) {
    S.rot += OMEGA_ROTOR * dt; S.rake += OMEGA_RAKE * dt; S.flow += dt; S.t = (S.t + dt) % periodOf(S.ruta);
    // ruta A: las bombas sólo empujan dentro de la ventana; ruta B: el ciclo del filtro se alarga con más agua
    const m = model(S.air, shown.uf);
    if (S.ruta === "A" && m.win) S.stroke += dt * 4.2;
    S.agit += dt * 2.4;
    if (S.ruta === "B") { S.press += dt / m.cycle; const k = mod(S.press, R.PRESS_CYCLE * 3) / (R.PRESS_CYCLE * 3); S.truck = k; }
  }
  const mod = (a, b) => ((a % b) + b) % b;
  const live = () => {
    const q = state(S.t, S.ruta), m = model(S.air, shown.uf);
    return { t: S.t, m, step: q.step, seq: q, tour: { kind: q.stage, u: q.u }, ruta: S.ruta };
  };
  const openOf = (key, seq) => Math.max(seq.open[key], selected && KEY_BUILDING[selected] === key ? 1 : 0);

  // ---- zoom sobre el dibujo (cortes de la celda y del espesador): sigue al deslizador
  const ZR = { A: [2930, 836, 96, 66], B: [3086, 822, 176, 80], bombas: [3040, 748, 110, 96], filtro: [2760, 790, 160, 112] };
  const OVER = VIEW.slice();
  let zoomMode = "viewBox", onZoom = null, zoomKey = null, lastZoom = "", vb = VIEW.slice();
  const mixRect = (a, b, u) => { const w = Math.exp(lerp(Math.log(a[2]), Math.log(b[2]), u)), h = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u));
    return [lerp(a[0] + a[2] / 2, b[0] + b[2] / 2, u) - w / 2, lerp(a[1] + a[3] / 2, b[1] + b[3] / 2, u) - h / 2, w, h]; };
  const fitAspect = ([x, y, w, h]) => { const a = VIEW[2] / VIEW[3]; return w / h > a ? [x, y - (w / a - h) / 2, w, w / a] : [x - (h * a - w) / 2, y, h * a, h]; };
  function applyZoom() {
    const z = zoomKey === "A" ? shown.cell : zoomKey === "B" ? shown.th : 0, sig = `${zoomKey}|${z.toFixed(4)}`;
    if (sig === lastZoom) return z;
    lastZoom = sig;
    if (zoomMode === "camera") onZoom?.(z > 0.001 ? mixRect(OVER, ZR[zoomKey], z) : null, z);
    else {
      vb = z > 0.001 ? mixRect(VIEW, fitAspect(ZR[zoomKey]), z) : VIEW.slice();
      svg.setAttribute("viewBox", vb.map((v) => v.toFixed(2)).join(" "));
      svg.style.overflow = z > 0.001 ? "hidden" : "";
    }
    return z;
  }
  function viewNow() {
    if (zoomMode === "camera") { const m = svg.getScreenCTM(); if (m && m.a) return { r: [-m.e / m.a, -m.f / m.d, innerWidth / m.a, innerHeight / m.d], u: 1 / m.a }; }
    const v = svg.viewBox.baseVal, r = v && v.width ? [v.x, v.y, v.width, v.height] : vb, w = svg.getBoundingClientRect().width;
    return { r, u: w > 1 ? r[2] / w : 1 };
  }
  // llamadas: [lado, punto, texto]; lado 0 = columna izquierda, 1 = derecha
  function callouts(list, cols, op) {
    const o = op.toFixed(3); if (zoomG.style.opacity !== o) zoomG.style.opacity = o;
    if (op <= 0.001 || !list.length) { setHTML(zoomG, ""); return; }
    const { r: vr, u } = viewNow(), fs = 11.5 * u, out = [];
    for (const side of [0, 1]) {
      const col = list.filter((l) => l[0] === side).sort((a, b) => a[1][1] - b[1][1]);
      const tw = Math.max(0, ...col.map((l) => l[2].length)) * 6.3 * u + 6 * u;
      const x = side ? Math.min(cols[1], vr[0] + vr[2] - tw) : Math.max(cols[0], vr[0] + tw);
      let y = vr[1] + fs * 0.4;
      for (const [, p, text] of col) {
        y = Math.min(Math.max(p[1] + fs * 0.35, y + fs * 1.6), vr[1] + vr[3] - fs * 0.6);
        // el texto se corre hacia adentro hasta quedar entero sobre lo impreso
        const w = text.length * 5.8 * u + 4 * u, dir = side ? -1 : 1, along = Array.from({ length: 9 }, (_, k) => k / 8);
        let tx = x;
        for (let i = 0; i < 80; i++) { if (along.every((k) => { const q = tx - dir * w * k; return printedAt(q, y - fs * 0.8) && printedAt(q, y + fs * 0.2); })) break; tx += dir * 2 * u; }
        const ex2 = side ? tx - 3 * u : tx + 3 * u;
        out.push(`<path class="fl-zl-lead" stroke-width="${f2(u)}" d="M${f2(p[0])} ${f2(p[1])}L${f2(ex2)} ${f2(y - fs * 0.35)}"/>`, `<circle class="fl-zl-dot" cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(2.4 * u)}"/>`,
          `<text class="fl-zl-text" x="${f2(tx)}" y="${f2(y)}" font-size="${f2(fs)}" stroke-width="${f2(3 * u)}" text-anchor="${side ? "start" : "end"}">${text}</text>`);
      }
    }
    setHTML(zoomG, out.join(""));
  }
  function drawCallouts(s, z) {
    if (zoomKey === "A" && z > 0.001 && !selected) {
      const T = CELLS.r[0], P = (th, h, r) => toP(CE, cellP(T, th, h, r));
      callouts([[0, P(0, CELL.H - 1, 0), "Aire por el eje hueco"], [0, P(Math.PI * 0.95, 12, 5.5), "Burbuja + sulfuro"], [0, P(Math.PI * 0.9, 5, 7), "Ganga en la pulpa"],
        [1, P(Math.PI / 4 - 0.55, CELL.H - 2, 9), "Espuma → canaleta"], [1, P(Math.PI / 4, 3, 3), "Rotor y estator"]], [2960, 2996], smooth((z - 0.55) / 0.35));
    } else if (zoomKey === "B" && z > 0.001 && !selected) {
      const t = TH[0], P = (th, d, r) => toP(ES, thP(t, th, d, r)), zc = 3.78, zs = zc + lerp(4.4, 1.8, clamp((s.m.uf - 45) / 27));
      callouts([[0, P(Math.PI / 4 + 0.35, 2.4), "Agua clara"], [0, P(Math.PI / 4 + 0.3, (zc + zs) / 2), "Sedimentación"], [0, P(Math.PI / 4 + 0.25, zs + 1.6), "Compresión"],
        [1, P(Math.PI / 4 - 0.3, 2.2), "Floculante y flóculos"], [1, P(Math.PI / 4 - 0.25, t.wall - 1.2), "Rastras"], [1, P(Math.PI / 4, t.wall + 0.5), `Descarga ~${Math.round(s.m.uf)} % de sólidos`]], [3140, 3206], smooth((z - 0.55) / 0.35));
    } else if (selected === "bombas" && shown.bombas > 0.3) {
      callouts([[0, R.Wp(-24, 8, 7), "Cabezal con válvulas"], [0, R.Wp(-24, 19, 6), "Émbolo"], [0, R.Wp(-9, 29, 9), "Bomba de pistón"], [1, R.Wp(-24, 38, 4), "Impulsión → concentraducto"], [1, R.Wp(-4, 5, 3), "Succión del estanque"]], [3058, 3118], smooth((shown.bombas - 0.5) / 0.4));
    } else if (selected === "filtro" && shown.galpon > 0.3) {
      const P = R.PRESS;
      callouts([[0, R.Ws(P.e + 4.5, 50, P.z1), "Cabezal móvil"], [0, R.Ws(P.e + 4.5, 30, 23), "Placas con telas"], [0, R.Ws(-66, 22, 8), "Camión"], [1, R.Ws(-30, 44, 5), "Pila de queque"], [1, R.Ws(P.e + 5, 12, 6), "Agua filtrada"]], [2812, 2856], smooth((shown.galpon - 0.5) / 0.4));
    } else { setHTML(zoomG, ""); if (zoomG.style.opacity !== "0") zoomG.style.opacity = "0"; }
  }

  function draw() {
    const s = live(), m = s.m, fl = S.flow, sc = { rot: S.rot, rake: S.rake, flow: fl, uf: m.uf }, seq = s.seq, ruta = S.ruta;
    // celdas: ventana en la primera rougher (deslizador o paso 1–3)
    const cellOpen = Math.max(shown.cell, seq.open.cell * (selected && selected !== "rougher" ? 0 : 1));
    setHTML(cellWin, cellOpen > 0.005 ? cellWindowSvg(CELLS.r[0], cellOpen, sc, m) : "");
    const thOpen = Math.max(shown.th, seq.open.th * (selected && selected !== "concentrado" ? 0 : 1));
    // espesadores: rastras, canaleta perimetral, pozo; ventana en el de concentrado
    TH.forEach((t, i) => { setHTML(rakeL[i], rakesSvg(t, S.rake + i * 0.7)); setHTML(launL[i], launderSvg(t, fl)); setHTML(wellL[i], wellSvg(t, fl));
      setHTML(winTh[i], i === 0 && thOpen > 0.005 ? thWindowSvg(t, thOpen, sc, true) : ""); });
    for (const [k, p] of Object.entries(flow)) p.style.strokeDashoffset = k.startsWith("bridge") ? f2((-fl * 3) % 3.5) : f1((-fl * 10) % 7);
    setFront(selected === "concentrado" || (!selected && (zoomKey === "B" && shown.th > 0.05 || seq.step.id === "concentrado")) ? 0 : selected === "relaves" ? 1 : -1);

    // agitadores
    setHTML(agitG, R.TANKS.map((_, i) => R.agitatorSvg(i, S.agit, m.uf, 0.75)).join(""));
    // edificios: techo que sube, muros bajo el corte e interior
    for (const key of ["bombas", "galpon"]) {
      const b = buildings[key], sv = shown[key];
      const zc = lerp(b.cfg.H, -8, smooth(sv));
      b.cp.setAttribute("d", D(R.cutPoly(b.W, b.cfg, -8, zc).map(toZ), true, f2));
      b.roof.setAttribute("transform", `translate(0 ${f2(-R.ROOF_LIFT * smooth(sv) / ZO.s)})`);
      b.roof.style.opacity = f2(1 - smooth(sv * 1.6));
    }
    const b = buildings;
    if (shown.bombas > 0.01) setHTML(b.bombas.interior, R.hallSvg(R.Wp, R.PUMPH) + R.pumpHouseSvg({ stroke: S.stroke, flow: m.win && ruta === "A" ? fl : 0, uf: m.uf })); else setHTML(b.bombas.interior, "");
    if (shown.galpon > 0.01) {
      // en los pasos 6 y 7 de la ruta B el ciclo lo marca la secuencia; fuera de ellos, el reloj del filtro
      let pr, pile = 0.55 + 0.35 * S.truck, truck = { go: clamp((S.truck - 0.62) / 0.38), load: clamp(S.truck / 0.55) };
      if (ruta === "B" && seq.step.n === 6) pr = R.pressPhase(seq.stage === "press" ? seq.u * (R.PRESS_CYCLE - 0.01) : seq.stage === "filtrate" ? 12.9 : 0.1);
      else if (ruta === "B" && seq.step.n === 7) { pr = R.pressPhase(seq.stage === "cake" ? 8.6 + seq.u * 3.6 : 12.9); const u = seq.stage === "cake" ? 0 : seq.u; pile = seq.stage === "cake" ? 0.3 + 0.7 * seq.u : 1 - 0.55 * clamp(u / 0.5); truck = { load: seq.stage === "truck" ? clamp(u / 0.5) : 0, go: seq.stage === "truck" ? clamp((u - 0.5) / 0.5) : 0 }; }
      else if (ruta === "B") pr = R.pressPhase(S.press);
      else pr = R.pressPhase(0.1);
      setHTML(b.galpon.interior, R.hallSvg(R.Ws, R.SHED) + R.shedSvg({ pr, fl, uf: m.uf, pile, truck }));
    } else setHTML(b.galpon.interior, "");

    // rutas: la activa con partículas; la otra punteada y apagada; con «Rutas», ambas
    const offA = !m.win;
    for (const [key, r] of Object.entries(RT)) {
      const ro = R.ROUTE_OF[key], on = ro.includes(ruta), show = on || S.rutas;
      const moving = show && !(ro === "A" && offA) && (S.ruta === "A" || ro.includes("B") || S.rutas);
      r.g.toggleAttribute("data-off", !show);
      r.g.toggleAttribute("data-stop", show && ro === "A" && offA);
      r.flow.style.display = moving ? "" : "none";
      r.flow.style.strokeDashoffset = f1((-fl * (key === "filtrate" ? 9 : 12)) % 8);
      if (key !== "filtrate") r.flow.style.stroke = pulpColor(m.uf);
    }
    dests.A.toggleAttribute("data-on", ruta === "A" || S.rutas); dests.B.toggleAttribute("data-on", ruta === "B" || S.rutas);
    underLab.textContent = `descarga → ${ruta === "B" ? "filtros" : "concentraducto"}`;
    underLab.style.fill = pulpColor(clamp(m.uf, 52, 72));

    // zoom y llamadas
    const z = applyZoom();
    drawCallouts(s, z);
    const tz = (1 - smooth(z * 2.5)).toFixed(3); if (tagsG.style.opacity !== tz) tagsG.style.opacity = tz;

    drawTour(s);
    // foco del paso: se ilumina el equipo y el resto baja a ~35 % (si no hay un equipo elegido)
    const lit = selected ? null : z > 0.3 ? [zoomKey === "A" ? "rougher" : "concentrado"] : seq.step.lit, litKey = lit ? lit.join() : "";
    if (litKey !== lastLit) { lastLit = litKey; units.forEach((eq, u) => u.classList.toggle("fl-stepdim", !!lit && !lit.includes(eq))); }
    for (const id of ORDER) tagEls[id].toggleAttribute("data-on", selected ? selected === id : !!lit && lit.includes(id));
    root.__qaFix?.();
    listeners.forEach((fn) => fn(s, api));
  }
  function drawTour(s) {
    const { kind: k, u } = s.tour, seq = s.seq; let tp = null, inside = null, color = "";
    const T = CELLS.r[0];
    const open = (key) => shown[key] > 0.5;
    if (seq.phase === "arrive") { /* en la llegada la partícula espera donde empieza el paso */ }
    if (k === "pipe") tp = PL.feed.at(u * PL.feed.len);
    else if (k === "in" || k === "rise" || k === "froth") {
      const z = k === "in" ? 3 : k === "rise" ? lerp(2.5, CELL.H - 4, u) : CELL.H - 3 + u;
      if (Math.max(shown.cell, seq.open.cell) > 0.3 && k !== "in") tp = toP(CE, cellP(T, Math.PI * 1.25, z, k === "rise" ? 3 + u * 2 : 5)); else inside = toP(CE, cellP(T, Math.PI * 1.25, z, 2)); }
    else if (k === "bank") { const j = Math.min(3, Math.floor(u * 4)); inside = toP(CE, cellP(CELLS.l[j], Math.PI * 1.25, CELL.H - 3, 2)); }
    else if (k === "bridge") tp = PL.bridge1.at(u * PL.bridge1.len);
    else if (k === "well") inside = toP(ES, add(TH[0].water, [0, 1.6]));
    else if (k === "settle") { const th = Math.PI * 1.25; inside = toP(ES, thP(TH[0], th, 4 + u * 6, TH[0].rW * (0.5 - u * 0.45))); }
    else if (k === "under" || k === "toPumps" || k === "toFilter" || k === "filtrate" || k === "duct") {
      const r = RT[k === "duct" ? "duct" : k]; tp = r.P.at(u * r.P.len); color = k === "filtrate" ? "#6fb6dc" : pulpColor(s.m.uf);
      if (k === "duct" && u > 0.98) tp = r.P.at(r.P.len);
    } else if (k === "pump") { if (open("bombas")) tp = R.Wp(lerp(-2, -28, u), u < 0.5 ? 5 : 38, 4); else inside = R.Wp(-16, 24, 20); }
    else if (k === "press") { if (open("galpon")) tp = R.Ws(R.PRESS.e + 5, lerp(8, 54, u), 22); else inside = R.Ws(-34, 30, 28); }
    else if (k === "cake") { if (open("galpon")) tp = R.Ws(R.PRESS.e, 30, lerp(R.PRESS.z0, 6, u)); else inside = R.Ws(-34, 30, 28); }
    else if (k === "truck") { if (open("galpon")) tp = R.Ws(lerp(-62, -86, smooth((u - 0.5) / 0.5)), 22, 13); else inside = R.Ws(-60, 22, 20); }
    if (S.ruta === "A" && !s.m.win && ["pump", "duct", "toPumps"].includes(k)) { tp = k === "toPumps" ? RT.toPumps.P.at(0) : null; inside = null; }
    if (tp) { for (const n of [tourRing, tourDot]) { n.setAttribute("cx", f1(tp[0])); n.setAttribute("cy", f1(tp[1] - 1)); n.style.opacity = 1; } tourDot.style.fill = color; }
    else { tourRing.style.opacity = 0; tourDot.style.opacity = 0; }
    if (inside) { const ph = (performance.now() / 900) % 1; tourPulse.setAttribute("cx", f1(inside[0])); tourPulse.setAttribute("cy", f1(inside[1])); tourPulse.setAttribute("r", f1(4 + ph * 9)); tourPulse.style.opacity = (0.9 * (1 - ph)).toFixed(2); }
    else tourPulse.style.opacity = 0;
  }

  // ------------------------------------------------------------ reloj
  const listeners = new Set();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) step(dt);
    const k = 1 - Math.exp(-dt * 6);
    const seq = state(S.t, S.ruta);
    const target = { cell: S.cell, th: S.th, uf: S.uf, bombas: openOf("bombas", seq), galpon: openOf("galpon", seq) };
    for (const key of Object.keys(target)) { shown[key] += (target[key] - shown[key]) * k; if (Math.abs(target[key] - shown[key]) < (key === "uf" ? 0.05 : 0.002)) shown[key] = target[key]; }
    draw(); raf = active ? nextTick(frame) : 0;
  }
  // quieto (movimiento reducido o saltos): los valores seguidos van directo a su destino
  const settle = () => { const seq = state(S.t, S.ruta); shown.bombas = openOf("bombas", seq); shown.galpon = openOf("galpon", seq); };
  const kick = () => { if (active && !raf) { last = performance.now(); raf = nextTick(frame); } };
  const redraw = (jump) => { if (still.matches || jump || !playing) settle(); draw(); };
  const api = {
    el: root, svg,
    get STEPS() { return steps(); }, get PERIOD() { return periodOf(S.ruta); },
    get selected() { return selected; }, get playing() { return playing; }, get ruta() { return S.ruta; }, get rutas() { return S.rutas; },
    get cell() { return S.cell; }, get th() { return S.th; }, get air() { return S.air; }, get uf() { return S.uf; },
    live, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) kick(); else { cancelTick(raf); raf = 0; } },
    play() { playing = true; kick(); }, pause() { playing = false; }, togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { const P = periodOf(S.ruta); S.t = ((v % P) + P) % P; redraw(); },
    goStep(n) { api.seek(steps()[clamp(n, 1, steps().length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(S.t, S.ruta).n % steps().length) + 1); },
    prevStep() { const st = stepAt(S.t, S.ruta); api.goStep(S.t - st.t0 > 1.2 ? st.n : ((st.n + steps().length - 2) % steps().length) + 1); },
    setRuta(r) { if (r === S.ruta) return; const n = stepAt(S.t, S.ruta).n; S.ruta = r === "B" ? "B" : "A"; S.t = steps()[n - 1].t0 + 0.01; lastLit = null; redraw(); },
    setRutas(v) { S.rutas = !!v; redraw(); },
    setCell(v, instant) { S.cell = clamp(v); if (instant || still.matches) shown.cell = S.cell; zoomKey = S.cell > 0 || S.th === 0 ? "A" : "B"; redraw(); },
    setTh(v, instant) { S.th = clamp(v); if (instant || still.matches) shown.th = S.th; zoomKey = S.th > 0 || S.cell === 0 ? "B" : "A"; redraw(); },
    setAir(v) { S.air = clamp(v, AIR_MIN, AIR_MAX); redraw(); },
    setUf(v, instant) { S.uf = clamp(v, UF_MIN, UF_MAX); shared.uf = S.uf; if (instant || still.matches) shown.uf = S.uf; redraw(); },
    setZoomMode(mode, fn = null) { zoomMode = mode; onZoom = fn; lastZoom = ""; if (mode === "camera" && vb[2] !== VIEW[2]) { vb = VIEW.slice(); svg.setAttribute("viewBox", VIEW.join(" ")); } draw(); },
    get zoom() { return { key: zoomKey, viewBox: vb.slice() }; },
    rects: ZR,
    select(id) { selected = id && EQUIP[id] ? id : null; root.toggleAttribute("data-sel", !!selected); units.forEach((eq, u) => u.classList.toggle("fl-dim", !!selected && eq !== selected)); lastLit = null; redraw(); },
    destroy() { api.setActive(false); listeners.clear(); document.removeEventListener("visibilitychange", onVis); root.remove(); },
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-eq]"); api.select(g ? (selected === g.dataset.eq ? null : g.dataset.eq) : null); });
  const onVis = () => { if (document.hidden) { cancelTick(raf); raf = 0; } else kick(); };
  document.addEventListener("visibilitychange", onVis);
  settle();
  draw();
  return api;
}

// ---------------------------------------------------------------- panel (HUD)
export function bindPanel(fx, { onEscape } = {}) {
  const $ = (q) => document.querySelector(q);
  const playBtn = $("[data-fl-play]"), stepsBox = $("[data-fl-steps]");
  let stepBtns = [], stepsKey = "";
  const buildSteps = () => {
    stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", fx.STEPS.length);
    stepBtns = fx.STEPS.map((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n; b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
      b.addEventListener("click", () => fx.goStep(s.n)); stepsBox.appendChild(b); return b; });
    stepsKey = fx.ruta;
    $("[data-fl-step-n]").dataset.total = fx.STEPS.length;
  };
  buildSteps();
  const info = $("[data-info]"), meter = $("[data-fl-meter]"), readout = $("[data-fl-readout]");
  const cellS = $("[data-fl-cell]"), cellO = $("[data-fl-cell-out]"), thS = $("[data-fl-th]"), thO = $("[data-fl-th-out]"), airS = $("[data-fl-air]"), airO = $("[data-fl-air-out]");
  const ufS = $("[data-fl-uf]"), ufO = $("[data-fl-uf-out]"), sw = $("[data-fl-filter]"), rutasBtn = $("[data-fl-rutas]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = []; const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  const chips = [...document.querySelectorAll("[data-fl-chip]")]; // fijos en el panel: se buscan una vez, no en cada cuadro
  function renderInfo(s) {
    const id = fx.selected;
    chips.forEach((c) => c.toggleAttribute("data-on", c.dataset.flChip === id));
    if (!id) { if (info.dataset.owner === "fl") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs(s.m, s.ruta), text = typeof e.text === "function" ? e.text(s.m, s.ruta) : e.text, sig = id + specs.join("|") + text;
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig; info.dataset.owner = "fl";
    $("[data-info-kicker]").textContent = e.kicker; $("[data-info-title]").textContent = e.title; $("[data-info-text]").textContent = text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join(""); $("[data-info-actions]").innerHTML = ""; info.hidden = false;
  }
  const syncRoute = () => { sw.setAttribute("aria-checked", String(fx.ruta === "B")); rutasBtn.setAttribute("aria-pressed", String(fx.rutas)); rutasBtn.toggleAttribute("data-on", fx.rutas); };
  off.push(fx.on((s) => {
    if (stepsKey !== fx.ruta) { buildSteps(); lastStep = 0; syncRoute(); }
    const st = s.step;
    if (st.n !== lastStep) { $("[data-fl-step-n]").textContent = st.n; $("[data-fl-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const k = Number(b.dataset.step); b.toggleAttribute("data-done", k < st.n); b.toggleAttribute("data-current", k === st.n); }); lastStep = st.n; }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", (s.m.R / 100).toFixed(3));
    const uf = Math.round(s.m.uf), warn = solidsWarning(uf);
    const route = s.ruta === "B" ? `filtro ${fdec(s.m.cycle, 1)}× · queque ~8–9 %` : s.m.win ? "concentraducto en ventana" : "fuera de la ventana de transporte";
    const text = `Recuperación ${Math.round(s.m.R)} % · Ley ${Math.round(s.m.G)} % Cu · ${uf} % de sólidos · ${route}${warn ? ` · ${warn}` : ""}`;
    readout.toggleAttribute("data-warn", !!warn || (s.ruta === "A" && !s.m.win));
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(fx.playing)); playBtn.setAttribute("aria-label", fx.playing ? "Pausar" : "Reproducir");
    renderInfo(s);
  }));
  const sync = () => { cellS.value = Math.round(fx.cell * 100); cellO.textContent = `${cellS.value} %`; thS.value = Math.round(fx.th * 100); thO.textContent = `${thS.value} %`; airS.value = fx.air; airO.textContent = `${fdec(fx.air, 1)}×`; ufS.value = fx.uf; ufO.textContent = `${fx.uf} %`; syncRoute(); };
  const toggleRoute = () => { fx.setRuta(fx.ruta === "A" ? "B" : "A"); syncRoute(); };
  const toggleRutas = () => { fx.setRutas(!fx.rutas); syncRoute(); };
  on(cellS, "input", () => { fx.setCell(cellS.value / 100); cellO.textContent = `${cellS.value} %`; });
  on(thS, "input", () => { fx.setTh(thS.value / 100); thO.textContent = `${thS.value} %`; });
  on(airS, "input", () => { fx.setAir(Number(airS.value)); airO.textContent = `${fdec(Number(airS.value), 1)}×`; });
  on(ufS, "input", () => { fx.setUf(Number(ufS.value)); ufO.textContent = `${ufS.value} %`; });
  on(sw, "click", toggleRoute);
  on(rutasBtn, "click", toggleRutas);
  on(playBtn, "click", () => fx.togglePlay());
  on($("[data-fl-prev]"), "click", () => fx.prevStep()); on($("[data-fl-next]"), "click", () => fx.nextStep());
  document.querySelectorAll("[data-fl-chip]").forEach((c) => on(c, "click", () => fx.select(fx.selected === c.dataset.flChip ? null : c.dataset.flChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "fl") fx.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "flotacion" || e.target.closest?.("input, [data-intro], .fl-dest")) return;
    const k = e.key.toLowerCase();
    if (e.key === " " && !e.target.closest("button")) fx.togglePlay();
    else if (e.key === ",") fx.prevStep(); else if (e.key === ".") fx.nextStep();
    else if (/^[1-7]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; fx.select(fx.selected === id ? null : id); }
    else if (k === "f" && !e.ctrlKey && !e.metaKey) toggleRoute();
    else if (k === "r" && !e.ctrlKey && !e.metaKey) toggleRutas();
    else if (e.key === "ArrowRight") { fx.setCell(fx.cell + 0.1); sync(); }
    else if (e.key === "ArrowLeft") { fx.setCell(fx.cell - 0.1); sync(); }
    else if (e.key === "ArrowUp") { fx.setTh(fx.th + 0.1); sync(); }
    else if (e.key === "ArrowDown") { fx.setTh(fx.th - 0.1); sync(); }
    else if (e.key === "Escape") { if (fx.selected) fx.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  sync(); fx.seek(fx.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "fl") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const ZOOM = { rougher: [2870, 800, 260, 370], limpieza: [2930, 770, 280, 300], concentrado: [3095, 700, 500, 270], relaves: [3160, 700, 440, 380], estanque: [2880, 735, 130, 230], bombas: [3030, 740, 130, 220], filtro: [2756, 785, 170, 250] }; // alto extra abajo: la ficha tapa esa zona
const ZOOM_CAP = 12;
// lámina armada de antemano, en reposo, mientras se mira la infografía (js/explorer.js): abrir sólo la inserta
let prebuilt = null;
export function prebuild() { return (prebuilt ||= createFlotacion().catch(() => (prebuilt = null))); }
export async function mount({ layer, focus }) {
  const fx = (await prebuilt) || (await createFlotacion());
  prebuilt = null;
  if (fx.el.parentNode !== layer) layer.appendChild(fx.el); // la precarga pudo dejarla ya puesta (estacionada)
  requestAnimationFrame(() => fx.el.setAttribute("data-in", ""));
  // cámara: el equipo elegido manda; si no, el zoom sobre el dibujo de los deslizadores; si no, el encuadre
  let focused = null, zoomRect = null, zoomK = 0, lastSel = null;
  const want = (z, cap) => { const k = z ? JSON.stringify(z) : ""; if (k !== focused) { focused = k; focus?.(z, cap); } };
  const toZoom = (ms) => { focused = "zoom"; focus?.(zoomRect, ZOOM_CAP, ms, lerp(0.06, 0.03, zoomK)); };
  fx.setZoomMode("camera", (rect, k) => { zoomRect = rect; zoomK = k; if (fx.selected) return; if (rect) toZoom(0); else want(null); });
  const unbind = bindPanel(fx, { onEscape: () => { location.hash = ""; } });
  const unzoom = fx.on(() => {
    if (fx.selected === lastSel) return;
    lastSel = fx.selected;
    if (fx.selected) want(ZOOM[fx.selected], 5); else if (zoomRect) toZoom(650); else want(null);
  });
  fx.setActive(true);
  window.pmFlo = fx;
  return { focus: [VIEW[0] + 20, VIEW[1] + 10, VIEW[2] - 40, VIEW[3] - 20], view: "flotacion",
    destroy: () => { unzoom(); unbind(); fx.destroy(); if (window.pmFlo === fx) delete window.pmFlo; } };
}
