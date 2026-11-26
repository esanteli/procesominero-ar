// Estación 5 · Puerto — lámina viva sobre los dibujos de Emilio (assets/puerto/: espesadores, puerto y barco).
//
// Flujo (coherente con la Ruta A de Flotación): el concentraducto, impulsado por las bombas de pistón de la planta,
// baja por gravedad a la costa → estación terminal (válvula y orificio: disipa la presión) → espesadores de recepción
// (vuelven a espesar y estabilizan la alimentación; rebalse a tratamiento) → bombas de alimentación → estanque agitado
// → filtros prensa (queque ~8–9 % de humedad) → galpón de acopio → correa → torre de muestreo → cargador de barcos.
// Límite de humedad transportable (TML): si el queque sale sobre el TML no se puede embarcar.
//
// Un modelo (humedad del queque y % de sólidos de llegada → ciclo del filtro, tasa, TML) manda y el dibujo lo sigue;
// "sigue el concentrado" en 6 pasos con state(t) puro; equipos con foco y ficha; zoom sobre el dibujo (naves que se
// abren, galería de la correa) con llamadas ancladas.
//
// Geometría: px de la infografía; los tres dibujos están a escala 2. Isometría de mundo W(e, n, z) con origen en el
// extremo de la correa en el muelle: n a lo largo de la correa (hacia el barco), e a lo ancho, z hacia arriba.
import { createLayers } from "../layers.js";
import { filterPressSvg, pressPhase, PRESS_CYCLE } from "./filtro-prensa.js";
import { shared } from "../shared.js";
import { nextTick, cancelTick } from "../clock.js";
const NS = "http://www.w3.org/2000/svg";
const U = (f) => new URL(`../../assets/puerto/${f}`, import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const f2 = (n) => (Math.round(n * 100) / 100).toString();
const fdec = (n, d = 0) => n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const D = (pts, close = true, f = f1) => "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L") + (close ? "Z" : "");
const TAU = Math.PI * 2;
const mod = (a, b) => ((a % b) + b) % b;

// ---------------------------------------------------------------- mundo y registro
export const VIEW = [4175, 418, 965, 452];
const O = [4945, 594];
const W = (e, n, z = 0) => [O[0] + 0.866 * (e + n), O[1] + 0.5 * (e - n) - z];
const P3 = (p) => W(p[0], p[1], p[2]);
const inv = ([x, y], z = 0) => { const s = (x - O[0]) / 0.866, d = 2 * (y - O[1] + z); return [(s + d) / 2, (s - d) / 2, z]; };
const S = 2;
const REG = { esp: [4209.75, 531.75], port: [4373, 423.75], ship: [4931.75, 430.75] };
const toL = (R, [x, y]) => [(x - R[0]) / S, (y - R[1]) / S];
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], lerp: (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm: (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); },
};
const VIEWDIR = [1, -1, 1];

// espesadores (centro del borde superior en px, radio de mundo, alto del muro)
const TH = { small: { c: [4257.3, 561.45], R: 38.2, h: 15.6, w: [-414, -380] }, big: { c: [4340.2, 647.65], R: 74.3, h: 5, w: [-290.5, -407.9] } };
// naves (mundo, piso z = 0)
const B46 = { e0: -181.5, e1: -108.6, n0: -473.5, n1: -353.7, H: 36.3, ridge: 14.7 };   // planta de filtros
const B54 = { e0: -74.75, e1: 40.25, n0: -474.25, n1: -426.05, H: 58.5 };              // galpón de acopio
// correa principal (e = 0, z = 0): sale de la nave de recuperación, galería cubierta, caballete del muelle
const BELT = { n0: -336, g0: -227, g1: 0, n1: 50, w: 2.2 };
const TOWER_N = -80;
// cargador de barcos (pedestal en el caballete) y bodegas
const LOADER = { e: 2, n: 50, z0: -4, root: 6, head: 30 };
const HATCH_PX = [[5010.0, 512.2], [5034.8, 527.7], [5061.1, 543.5]];
const ZH = 12, HOLD = 9, HE = 7.5, HN = 13;
// filtro prensa y galpón
const PRESS = { e: -150, n0: -458, n1: -404, z0: 6, z1: 18, we: 9, N: 16 };
const FEEDTANK = [-123, -452];
const PILE = { e0: -66, e1: -16, n: -452, hw: 15, h: 17 };
const HOPPER = { e: 24, n: -442 };
// ---- cañerías (Ruta A de Flotación): el concentraducto llega (lo impulsan las bombas de pistón de la planta; aquí baja
// por gravedad a la costa), la estación terminal disipa la presión y alimenta los dos espesadores de recepción
const DUCT = [[-128, -515, 1.5], [-340, -515, 1.5]];                     // llegada → fin del corredor
const FEED_B = [[-340, -515, 1.5], [-340, -495, 1], [-290, -495, 1], [-290, -482, 1]];   // → espesador grande
const FEED_S = [[-340, -495, 1], [-385, -495, 1], [-385, -405, 1]];       // → espesador chico
const STATION_E = -262, BREAK_E = -172;                                   // estación terminal · corte de la distancia
// descarga por el cono de cada espesador (enterrada: línea punteada) → bombas de alimentación en la planta de filtros
const UNDER_S = [[-430, -364, 0], [-430, -403, 0], [-296, -403, 0]];
const UNDER_B = [[-296, -403, 0], [-181, -403, 0]];
const UNDER_IN = [[-181, -403, 0], [-170, -392, 3]];
const FEEDPUMPS = [[-170, -388], [-170, -372]];                           // bombas de alimentación (dentro de la nave)
const PUMP_TANK = [[-170, -380, 3], [-123, -380, 3], [-123, -446, 3]];    // bombas → estanque agitado
const TANK_PRESS = [[-123, -456, 3], [-133, -462, 3], [-150, -462, 10]];  // estanque → filtro prensa

// ---------------------------------------------------------------- modelo (humedad del queque y % de sólidos)
const H_MIN = 7, H_MAX = 12, TML = 10, SHIP_T = 50000;
export const UF_MIN = 45, UF_MAX = 72, UF_NOM = 65;
export const model = (h, uf = UF_NOM) => {
  const cycle = uf < 55 ? 1 + (55 - uf) / 20 : 1;                          // pulpa diluida: el filtro tarda más
  const rate = Math.round((1800 - 150 * (10 - h)) / cycle / 10) * 10;       // t/h: secar más alarga el ciclo del filtro
  return { h, uf, cycle, rate, hours: SHIP_T / rate, ok: h <= TML, viscous: uf > 70, km: 170, trip: 170000 / 1.6 / 3600 };
};

// ---------------------------------------------------------------- "sigue el concentrado" (state(t) puro)
// Cada paso: llegada (ARRIVE s: se ilumina el equipo y el resto baja a ~35 %), acción (tramos) y pausa (HOLD s con el
// resultado a la vista). `cut`: qué se abre solo en ese paso.
const ARRIVE = 0.5, PAUSE = 1.2;
const SEQ_STEPS = [
  { id: "mineroducto", lit: ["mineroducto"], label: "Llega el concentraducto y la estación terminal disipa la presión", act: [["fast", 3.5], ["drop", 1.5], ["calm", 3]] },
  { id: "espesadores", lit: ["espesadores"], label: "El espesador de recepción vuelve a espesar la pulpa", act: [["settle", 5], ["cone", 1.5]] },
  { id: "filtros", lit: ["espesadores", "filtros"], cut: "plant", label: "Las bombas la llevan al estanque agitado y a los filtros", act: [["under", 2.5], ["pumps", 1], ["tank", 3], ["feed", 1.8]] },
  { id: "filtros", lit: ["filtros"], cut: "plant", label: "El filtro saca el agua: queque con ~9 % de humedad, bajo el TML", act: [["press", 9]] },
  { id: "galpon", lit: ["galpon"], cut: "galpon", label: "El queque se acopia en el galpón y un cargador alimenta la tolva", act: [["pile", 3], ["loader", 6]] },
  { id: "embarque", lit: ["embarque"], cut: "belt", label: "La correa pasa por la torre de muestreo y el cargador llena las bodegas", act: [["belt", 6], ["boom", 2.5], ["hold", 3]] },
];
export const STEPS = [];
{
  let t = 0;
  SEQ_STEPS.forEach((q, i) => {
    const t0 = t, ta = t0 + ARRIVE; let x = ta;
    const stages = q.act.map(([k, d]) => { const r = { k, a: x, b: x + d }; x += d; return r; });
    t = x + PAUSE;
    STEPS.push({ n: i + 1, id: q.id, lit: q.lit, label: q.label, cut: q.cut || null, t0, ta, th: x, t1: t, stages });
  });
}
export const PERIOD = STEPS[STEPS.length - 1].t1;
const stepAt = (t) => { t = mod(t, PERIOD); return STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1]; };
/** estado de la secuencia en t: paso, fase, tramo y avance, y qué está abierto */
export function state(t) {
  t = mod(t, PERIOD);
  const step = stepAt(t), first = step.stages[0], last = step.stages[step.stages.length - 1];
  let phase = "act", sg = first, u = 0;
  if (t < step.ta) phase = "arrive";
  else if (t >= step.th) { phase = "hold"; sg = last; u = 1; }
  else { sg = step.stages.find((r) => t < r.b) || last; u = clamp((t - sg.a) / (sg.b - sg.a)); }
  const prev = STEPS[(step.n + STEPS.length - 2) % STEPS.length], k = smooth((t - step.t0) / ARRIVE);
  const openOf = (key) => (step.cut === key ? (prev.cut === key ? 1 : k) : prev.cut === key ? 1 - k : 0);
  return { t, step, phase, stage: sg.k, u, arrive: k, open: { plant: openOf("plant"), galpon: openOf("galpon"), belt: openOf("belt") } };
}
// cargador frontal: carga en la pila → va a la tolva → vacía → vuelve (ciclo de LP segundos)
const LP = 10.6;
function loaderAt(t) {
  const u = mod(t, LP), k = (a, b) => smooth((u - a) / (b - a));
  const A = PILE.e1 + 5, Bp = HOPPER.e - 9;
  if (u < 2) return { e: A, bucket: k(0.4, 2) * 0.6, full: u > 1.2, dump: 0 };
  if (u < 5) return { e: lerp(A, Bp, k(2, 5)), bucket: 0.6 + 0.4 * k(2, 3), full: true, dump: 0 };
  if (u < 6.3) return { e: Bp, bucket: 1, full: u < 5.8, dump: k(5, 5.8) - k(5.8, 6.3) };
  if (u < 9.3) return { e: lerp(Bp, A, k(6.3, 9.3)), bucket: 1 - k(6.3, 7.5), full: false, dump: 0 };
  return { e: A, bucket: 0, full: false, dump: 0 };
}
// ciclo del barco (reloj propio 0…1): escotillas, 9 pasadas entre bodegas, cierre
const SEQ = [1, 0, 2, 1, 0, 2, 1, 0, 2];
function shipAt(s) {
  const oc = smooth(s / 0.04) * (1 - smooth((s - 0.955) / 0.04));
  const u = clamp((s - 0.05) / 0.89), done = s >= 0.94;
  const p = Math.min(8, Math.floor(u * 9)), fp = u * 9 - p;
  const lv = [0, 0, 0];
  for (let i = 0; i < 9; i++) { const part = i < p ? 1 : i === p ? clamp((fp - 0.18) / 0.82) : 0; lv[SEQ[i]] += part / 3; }
  const from = p > 0 ? SEQ[p - 1] : 1, to = SEQ[p];
  const pour = !done && s >= 0.05 && fp >= 0.18;
  return { oc, lv, from, to, move: done || s < 0.05 ? 1 : smooth(fp / 0.18), pour, park: done ? smooth((s - 0.94) / 0.02) : s < 0.05 ? 1 - smooth(s / 0.05) : 0, load: (lv[0] + lv[1] + lv[2]) / 3, trim: fp };
}

// ---------------------------------------------------------------- fichas
const EQUIP = {
  mineroducto: { kicker: "Transporte", title: "Concentraducto y estación terminal", text: "El concentrado viaja como pulpa por un concentraducto enterrado desde la concentradora. Lo impulsan las bombas de pistón de la planta (Flotación, Ruta A) y baja por gravedad hasta la costa. En la estación terminal, una válvula y un orificio disipan la presión: la pulpa llega rápida y sale tranquila.",
    specs: (m) => [`~${m.km} km (aquí, comprimido)`, `Pulpa ~${Math.round(m.uf)} % de sólidos`, `Llega en ~${fdec(m.trip)} horas`] },
  espesadores: { kicker: "Recepción", title: "Espesadores de recepción", text: "Reciben el concentrado del concentraducto, lo vuelven a espesar y dan una alimentación estable a los filtros. Las rastras llevan el sólido al cono, por donde sale hacia las bombas; el rebalse de agua clara va a tratamiento.",
    specs: (m) => [`Llega con ~${Math.round(m.uf)} % de sólidos`, "Rebalse: agua clara → tratamiento", m.viscous ? "Pulpa muy viscosa" : "Descarga por el cono → bombas"] },
  filtros: { kicker: "Filtrado", title: "Planta de filtros", text: "Las bombas de alimentación llevan la pulpa a un estanque agitado y de ahí a los filtros prensa: entre placas con telas se presiona, se sopla aire y el agua sale filtrada. Al abrir las placas cae el queque.",
    specs: (m) => [`Queque con ~${fdec(m.h, 1)} % de humedad`, m.cycle > 1.01 ? `Ciclo ${fdec(m.cycle, 1)}× (pulpa diluida)` : "Llenado · prensado · soplado · descarga · cierre", `${fdec(m.rate)} t/h de concentrado`] },
  galpon: { kicker: "Almacenamiento", title: "Galpón de acopio", text: "El queque se acopia bajo techo, con presión negativa y filtros de aire para que el polvo no salga. Un cargador frontal lo lleva a la tolva que alimenta la correa de embarque.",
    specs: () => ["Acopio cerrado: sin polvo al exterior", "Cargador frontal → tolva → correa", "Reserva para varios barcos"] },
  embarque: { kicker: "Embarque", title: "Correa y cargador de barcos", text: "Una correa cubierta lleva el queque al muelle; en la torre de transferencia se toman muestras para certificar ley y humedad. El cargador gira y extiende el brazo sobre cada bodega y baja un chute telescópico para cargar sin levantar polvo.",
    specs: (m) => [`${fdec(m.rate)} t/h · barco de 50.000 t en ~${fdec(m.hours)} h`, `Humedad ${fdec(m.h, 1)} % · límite TML ${TML} %`, "Pasadas entre bodegas para nivelar el barco"] },
};
const ORDER = ["mineroducto", "espesadores", "filtros", "galpon", "embarque"];

// ---------------------------------------------------------------- utilidades SVG
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k2, v] of Object.entries(attrs)) e.setAttribute(k2, v); parent?.appendChild(e); return e; };
// reescribe una capa del dibujo sólo si su marcado cambió (muchas salen idénticas cuadro a cuadro: fondo, rieles…)
const setHTML = (n, s) => { if (n.__html !== s) { n.__html = s; n.innerHTML = s; } };
const circ = (p, r, cls, o) => `<circle class="${cls}" cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(r)}"${o != null ? ` style="opacity:${f2(clamp(o))}"` : ""}/>`;
const poly = (pts, cls, extra = "") => `<path class="${cls}" d="${D(pts, true, f2)}"${extra}/>`;
const line = (pts, cls, extra = "") => `<path class="${cls}" d="${D(pts, false, f2)}"${extra}/>`;
function boxSvg(e0, e1, n0, n1, z0, z1, cls) {
  const top = [W(e0, n0, z1), W(e1, n0, z1), W(e1, n1, z1), W(e0, n1, z1)];
  const front = [W(e1, n0, z0), W(e1, n1, z0), W(e1, n1, z1), W(e1, n0, z1)];
  const side = [W(e0, n0, z0), W(e1, n0, z0), W(e1, n0, z1), W(e0, n0, z1)];
  return poly(side, `${cls} ${cls}--side`) + poly(front, `${cls} ${cls}--front`) + poly(top, `${cls} ${cls}--top`);
}
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function cylA(C, a, h, r0, r1, cls) {
  let u = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  u = v3.norm(v3.sub(u, v3.mul(a, v3.dot(u, a))));
  const v = v3.cross(a, u);
  const ring = (P, r, kk = 26) => { const out = []; for (let i = 0; i < kk; i++) { const t = (i / kk) * TAU; out.push(P3(v3.add(P, v3.add(v3.mul(u, r * Math.cos(t)), v3.mul(v, r * Math.sin(t)))))); } return out; };
  const top = v3.add(C, v3.mul(a, h)), R0 = ring(C, r0), R1 = ring(top, r1), vis = v3.dot(a, VIEWDIR) > 0;
  return poly(hull([...R0, ...R1]), cls) + poly(vis ? R1 : R0, `${cls} ${cls}--cap`);
}
// viga orientada (caja entre p0 y p1, ancho horizontal w, alto h): sólo las caras visibles
function beam(p0, p1, w, h, cls) {
  const d = v3.norm(v3.sub(p1, p0)); let u = v3.cross(d, [0, 0, 1]); if (Math.hypot(...u) < 1e-3) u = [1, 0, 0]; u = v3.norm(u); const v = v3.cross(u, d);
  const c = (p, a, b) => P3(v3.add(p, v3.add(v3.mul(u, (a * w) / 2), v3.mul(v, (b * h) / 2))));
  const Q = [c(p0, -1, -1), c(p0, 1, -1), c(p0, 1, 1), c(p0, -1, 1), c(p1, -1, -1), c(p1, 1, -1), c(p1, 1, 1), c(p1, -1, 1)];
  const F = [[u, [1, 5, 6, 2], "s"], [v3.mul(u, -1), [0, 3, 7, 4], "s"], [v, [3, 2, 6, 7], "t"], [v3.mul(v, -1), [0, 4, 5, 1], "b"], [d, [4, 7, 6, 5], "e"], [v3.mul(d, -1), [0, 1, 2, 3], "e"]];
  let g = ""; for (const [nrm, idx, k] of F) if (v3.dot(nrm, VIEWDIR) > 0) g += poly(idx.map((i) => Q[i]), `${cls} ${cls}--${k}`);
  return g;
}
const pipeSvg = (pts, cls = "") => { const d = D(pts.map(P3), false, f2); return `<path class="pu-pipe-o ${cls}" d="${d}"/><path class="pu-pipe-w" d="${d}"/>`; };
const flowSvg = (pts, cls, off) => `<path class="pu-flow ${cls}" d="${D(pts.map(P3), false, f2)}" style="stroke-dashoffset:${f2(off)}"/>`;
function polyline(pts) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(...v3.sub(pts[i], pts[i - 1])));
  const len = L[L.length - 1];
  return { len, at: (s) => { s = clamp(s, 0, len); let i = 1; while (i < L.length - 1 && L[i] < s) i++; const u = (s - L[i - 1]) / (L[i] - L[i - 1] || 1); return v3.lerp(pts[i - 1], pts[i], u); } };
}
// isometría local de un espesador: punto a radio r y ángulo th, a dz bajo/sobre el borde (en px)
const TP = (T, r, th, dz = 0) => { const de = r * Math.cos(th), dn = r * Math.sin(th); return [T.c[0] + 0.866 * (de + dn), T.c[1] + 0.5 * (de - dn) - dz]; };
const ring = (T, r, dz, k = 56) => { const o = []; for (let i = 0; i < k; i++) o.push(TP(T, r, (i / k) * TAU, dz)); return o; };
const CONC = [74, 72, 60], PULP = [96, 92, 74], WATER = [158, 196, 214];
const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(",")})`;

// color de la pulpa según el % de sólidos (más espesa, más oscura)
function pulpFill(uf) { const k = clamp((uf - UF_MIN) / (UF_MAX - UF_MIN)); return rgb([150, 170, 160].map((v, i) => lerp(v, [58, 70, 62][i], k))); }

// concentraducto, estación terminal (válvula y orificio), alimentación de los espesadores y descargas enterradas
function ductSvg(fl, m) {
  const col = pulpFill(m.uf);
  let g = pipeSvg(FEED_S, "pu-pipe--pulp") + pipeSvg(FEED_B, "pu-pipe--pulp") + pipeSvg(DUCT, "pu-pipe--minero");
  // la pulpa llega rápida y, pasada la estación terminal, sale tranquila (presión disipada)
  const st = [STATION_E, -515, 1.5];
  g += `<path class="pu-flow pu-flow--fast" d="${D([P3(DUCT[0]), P3(st)], false, f2)}" style="stroke:${col};stroke-dashoffset:${f2(-fl * 34)}"/>`;
  g += `<path class="pu-flow pu-flow--calm" d="${D([P3(st), P3(DUCT[1])], false, f2)}" style="stroke:${col};stroke-dashoffset:${f2(-fl * 5)}"/>`;
  for (const p of [FEED_B, FEED_S]) g += `<path class="pu-flow pu-flow--calm" d="${D(p.map(P3), false, f2)}" style="stroke:${col};stroke-dashoffset:${f2(-fl * 5)}"/>`;
  // corte de la distancia (≈ 170 km comprimidos)
  const a = W(BREAK_E - 5, -515, 1.5), b = W(BREAK_E + 5, -515, 1.5);
  g += line([v3.add(a, [-2, 5]), v3.add(a, [2, -5])], "pu-break") + line([v3.add(b, [-2, 5]), v3.add(b, [2, -5])], "pu-break");
  // llegada (extremo del corredor): brida
  g += cylA([DUCT[0][0] - 1.5, -515, 1.5], [1, 0, 0], 2.4, 3.2, 3.2, "pu-flange");
  // estación terminal sobre la tubería: orificio (brida con placa) y válvula con volante
  g += cylA([STATION_E + 9, -515, 1.5], [1, 0, 0], 1.6, 3.8, 3.8, "pu-flange") + cylA([STATION_E + 11, -515, 1.5], [1, 0, 0], 1.6, 3.8, 3.8, "pu-flange");
  g += cylA([STATION_E - 4.5, -515, 1.5], [1, 0, 0], 4.5, 3.2, 1.2, "pu-valve") + cylA([STATION_E, -515, 1.5], [1, 0, 0], 4.5, 1.2, 3.2, "pu-valve");
  g += cylA([STATION_E, -515, 2.5], [0, 0, 1], 6, 0.7, 0.7, "pu-stem") + cylA([STATION_E, -515, 8.5], [0, 0, 1], 1, 3.2, 3.2, "pu-wheel2");
  // turbulencia en el orificio (la energía se pierde ahí)
  for (let j = 0; j < 4; j++) { const ph = mod(fl * 1.7 + j / 4, 1); g += circ(W(STATION_E + 10 - ph * 8, -515, 4 + Math.sin(j * 2.1) * 2 + ph * 3), 0.6 + ph, "pu-turb", (1 - ph) * 0.8); }
  return g;
}

// descarga por el cono de cada espesador hacia las bombas (enterrada: línea punteada, bajo la nave de filtros)
function underSvg(fl, m) {
  const col = pulpFill(m.uf);
  let g = "";
  for (const p of [UNDER_S, UNDER_B]) g += `<path class="pu-under" d="${D(p.map(P3), false, f2)}"/><path class="pu-flow pu-flow--under" d="${D(p.map(P3), false, f2)}" style="stroke:${col};stroke-dashoffset:${f2(-fl * 5)}"/>`;
  for (const T of [UNDER_S[0], UNDER_B[0]]) g += circ(P3(T), 2.2, "pu-cone");
  return g;
}

// ---------------------------------------------------------------- espesadores
function thickSvg(T, rot, fl, big) {
  let g = poly(ring(T, T.R - 2.2, -1.2), "pu-th-water");
  g += poly(ring(T, T.R * 0.62, -1.4), "pu-th-cloud");
  // rastras bajo el agua (dos brazos con paletas) y su sombra
  for (const k of [0, Math.PI]) { const a = rot + k, p0 = TP(T, T.R * 0.12, a, -2.5), p1 = TP(T, T.R * 0.9, a, -2.5);
    g += line([p0, p1], "pu-th-rake");
    for (let j = 1; j <= 6; j++) { const r = (T.R * 0.9 * j) / 6.4, q = TP(T, r, a, -2.5), q2 = TP(T, r + 2.4, a - 0.12, -2.5); g += line([q, q2], "pu-th-blade"); } }
  // ondas que viajan hacia el rebalse
  for (let j = 0; j < 3; j++) { const ph = mod(fl * 0.08 + j / 3, 1); g += poly(ring(T, T.R * (0.25 + 0.7 * ph), -1.15, 40), "pu-th-ripple", ` style="opacity:${f2((1 - ph) * 0.7)}"`); }
  // pozo de alimentación al centro
  const fw = T.R * 0.13; g += poly(hull([...ring(T, fw, -1, 20), ...ring(T, fw, 2.6, 20)]), "pu-th-well") + poly(ring(T, fw, 2.6, 20), "pu-th-well pu-th-well--top");
  if (big) {
    // columna central con el accionamiento y pasarela desde el borde
    const a = -Math.PI * 0.75;
    g += line([TP(T, fw, a, 3.6), TP(T, T.R, a, 3.6)], "pu-th-walk") + line([TP(T, fw, a + 0.06, 3.6), TP(T, T.R, a + 0.03, 3.6)], "pu-th-walk");
    const c0 = TP(T, 0, 0, 2.6), c1 = TP(T, 0, 0, 7.5); g += `<rect class="pu-th-drive" x="${f2(c1[0] - 3)}" y="${f2(c1[1] - 1)}" width="6" height="${f2(c0[1] - c1[1] + 1)}" rx="1"/>`;
  }
  return g;
}
// rebalse que corre por la canaleta perimetral
const launderFlow = (T, fl) => `<path class="pu-th-over" d="${D(ring(T, T.R - 1, -0.2, 72), true, f2)}" style="stroke-dashoffset:${f2(-fl * 6)}"/>`;

// ---------------------------------------------------------------- naves por dentro
// región visible de los muros bajo la altura de corte (caras −n y +e), sin la planta
const cutPoly = (b, z0, z1) => [W(b.e0 - 1, b.n0 - 1, z1), W(b.e1 + 1, b.n0 - 1, z1), W(b.e1 + 1, b.n1 + 1, z1), W(b.e1 + 1, b.n1 + 1, z0), W(b.e1 + 1, b.n0 - 1, z0), W(b.e0 - 1, b.n0 - 1, z0)];
function hallSvg(b) {
  const H = Math.min(b.H, 22);
  let g = poly([W(b.e0, b.n0), W(b.e1, b.n0), W(b.e1, b.n1), W(b.e0, b.n1)], "pu-floor");
  g += poly([W(b.e0, b.n0, 0), W(b.e0, b.n1, 0), W(b.e0, b.n1, H), W(b.e0, b.n0, H)], "pu-wall-in");
  g += poly([W(b.e0, b.n1, 0), W(b.e1, b.n1, 0), W(b.e1, b.n1, H), W(b.e0, b.n1, H)], "pu-wall-in pu-wall-in--end");
  for (let n = b.n0 + 12; n < b.n1; n += 12) g += line([W(b.e0, n, 0), W(b.e0, n, H)], "pu-pilaster");
  g += line([W(b.e0, b.n0, H), W(b.e0, b.n1, H), W(b.e1, b.n1, H)], "pu-cutline");
  return g;
}
function agitTankSvg(fl, uf) {
  let g = cylA([FEEDTANK[0], FEEDTANK[1], 0], [0, 0, 1], 13, 6, 6, "pu-tank");
  const c = W(FEEDTANK[0], FEEDTANK[1], 13), r = 4.4, a = fl * 3;
  g += `<ellipse class="pu-slurry" cx="${f2(c[0])}" cy="${f2(c[1])}" rx="6.2" ry="3.4" style="fill:${pulpFill(uf)}"/>`;
  for (let k = 0; k < 2; k++) { const aa = a + (k * Math.PI) / 2; g += line([[c[0] + Math.cos(aa) * r * 0.87, c[1] + Math.sin(aa) * r * 0.5], [c[0] - Math.cos(aa) * r * 0.87, c[1] - Math.sin(aa) * r * 0.5]], "pu-stir"); }
  return g;
}
// bombas de alimentación (centrífugas): motor, voluta y succión
function feedPumpSvg([e, n], fl, on) {
  let g = boxSvg(e - 4.4, e + 3.8, n - 3, n + 3, 0, 1.2, "pu-pumpbase");
  g += boxSvg(e - 4, e - 0.6, n - 2.2, n + 2.2, 1.2, 5.4, "pu-feedpump");                            // motor
  g += cylA([e - 0.4, n, 3.2], [1, 0, 0], 2.2, 2.6, 2.6, "pu-volute");                               // voluta
  const c = P3([e + 1.8, n, 3.2]), a = on ? fl * 12 : 0;
  g += line([[c[0] - Math.cos(a) * 1.5, c[1] - Math.sin(a) * 1.5], [c[0] + Math.cos(a) * 1.5, c[1] + Math.sin(a) * 1.5]], "pu-impeller");
  return g;
}
function pressSvg(pr, fl, m) {
  const P = PRESS, wet = clamp((m.h - H_MIN) / (H_MAX - H_MIN));
  const pf = pulpFill(m.uf);
  let g = "";
  // llegada de la descarga de los espesadores, bombas de alimentación, estanque agitado y alimentación del filtro
  g += pipeSvg(UNDER_IN, "pu-pipe--pulp") + flowSvg(UNDER_IN, "pu-flow--pulp", -fl * 7);
  g += pipeSvg(PUMP_TANK, "pu-pipe--pulp") + flowSvg(PUMP_TANK, "pu-flow--pulp", -fl * 8);
  for (const p of FEEDPUMPS) g += feedPumpSvg(p, fl, true);
  g += agitTankSvg(fl, m.uf);
  g += pipeSvg(TANK_PRESS, "pu-pipe--pulp") + flowSvg(TANK_PRESS, "pu-flow--pulp", -fl * 8);
  // filtro prensa (compartido): patas, correa bajo el filtro y transversal hacia el galpón, placas y queque
  const bz = 2.4;
  const plateCol = rgb(PULP.map((v, i) => lerp(v, CONC[i], 1 - wet * 0.3)));
  const cbelt = beam([P.e, P.n1 + 2, bz], [P.e, P.n0 - 12, bz], 4.4, 1.2, "pu-cbelt") + beam([P.e - 2, P.n0 - 12, bz], [B46.e1 + 2, P.n0 - 12, bz], 4.4, 1.2, "pu-cbelt")
    + flowSvg([[P.e, P.n1, bz + 0.7], [P.e, P.n0 - 12, bz + 0.7], [B46.e1 + 2, P.n0 - 12, bz + 0.7]], "pu-flow--cake", -fl * 8);
  g += filterPressSvg({ W, P, pr, fl, cls: "pu", fill: plateCol || pf, cakeZ: bz + 1, under: cbelt });
  return g;
}
function pileSvg(b, ld, fl) {
  const P = PILE; let g = "";
  // pila alargada a lo largo de e (caras visibles: costado −n, cumbrera, extremo +e)
  const r0 = P.n - P.hw, r1 = P.n + P.hw, top = [P.e0 + 6, P.e1 - 6];
  g += poly([W(P.e0, r1, 0), W(P.e1, r1, 0), W(top[1], P.n, P.h), W(top[0], P.n, P.h)], "pu-pile pu-pile--back");
  g += poly([W(P.e0, r0, 0), W(P.e1, r0, 0), W(top[1], P.n, P.h), W(top[0], P.n, P.h)], "pu-pile");
  g += poly([W(P.e1, r0, 0), W(P.e1, r1, 0), W(top[1], P.n, P.h)], "pu-pile pu-pile--end");
  // caída del queque desde la correa que llega de la planta de filtros
  const drop = W(P.e0 + 4, P.n, P.h + 12); g += beam([b.e0, P.n, P.h + 14], [P.e0 + 6, P.n, P.h + 14], 4, 1.2, "pu-cbelt");
  for (let j = 0; j < 5; j++) { const ph = mod(fl * 1.6 + j / 5, 1); g += circ([drop[0] + (hash(j) - 0.5) * 2, drop[1] + ph * 14], 0.8, "pu-grain", 1 - ph * 0.6); }
  // tolva y correa de recuperación
  g += boxSvg(HOPPER.e - 6, HOPPER.e + 6, HOPPER.n - 7, HOPPER.n + 7, 4, 11, "pu-hopper");
  g += poly([W(HOPPER.e - 4.5, HOPPER.n - 5.5, 11.02), W(HOPPER.e + 4.5, HOPPER.n - 5.5, 11.02), W(HOPPER.e + 4.5, HOPPER.n + 5.5, 11.02), W(HOPPER.e - 4.5, HOPPER.n + 5.5, 11.02)], "pu-hopper-in");
  for (const de of [-5, 5]) for (const dn of [-6, 6]) g += line([W(HOPPER.e + de, HOPPER.n + dn, 0), W(HOPPER.e + de, HOPPER.n + dn, 4)], "pu-leg");
  // cargador frontal
  g += frontLoader(ld);
  return g;
}
function frontLoader(ld) {
  const e = ld.e, n = HOPPER.n - 4, bz = 1.5 + ld.bucket * 9;
  let g = "";
  g += boxSvg(e - 7, e + 2, n - 3.2, n + 3.2, 1.2, 4.6, "pu-fel");               // chasis
  g += boxSvg(e - 6.5, e - 3, n - 2.6, n + 2.6, 4.6, 8.8, "pu-fel pu-fel--cab");  // cabina
  for (const de of [-5.5, 0.5]) for (const dn of [-3.6]) g += circ(W(e + de, n + dn, 1.6), 1.6, "pu-wheel");
  g += line([W(e + 1.5, n - 2, 3.5), W(e + 5.5, n - 2, bz + 1)], "pu-arm") + line([W(e + 1.5, n + 2, 3.5), W(e + 5.5, n + 2, bz + 1)], "pu-arm");
  const tilt = ld.dump * 2.5;
  g += poly([W(e + 4.5, n - 3.6, bz), W(e + 8 + tilt, n - 3.6, bz - tilt * 0.6), W(e + 8 + tilt, n + 3.6, bz - tilt * 0.6), W(e + 4.5, n + 3.6, bz), W(e + 4.5, n + 3.6, bz + 3), W(e + 4.5, n - 3.6, bz + 3)], "pu-bucket");
  if (ld.full) g += poly([W(e + 5, n - 3, bz + 2.4), W(e + 7.5, n - 3, bz + 2.2), W(e + 7.5, n + 3, bz + 2.2), W(e + 5, n + 3, bz + 2.4), W(e + 6, n, bz + 4.2)], "pu-pile");
  if (ld.dump > 0.1) for (let j = 0; j < 4; j++) { const ph = mod(performance.now() / 300 + j / 4, 1); g += circ(W(e + 9, n + (j - 1.5) * 1.6, bz - ph * 6), 0.8, "pu-grain", 1 - ph); }
  return g;
}

// ---------------------------------------------------------------- barco y cargador
function hatchGeo(dy) { return HATCH_PX.map(([x, y]) => inv([x, y + dy], ZH)); }
function holdSvg(c, lv, oc, clipId) {
  const open = [W(c[0] - HE * oc, c[1] - HN, ZH), W(c[0] + HE * oc, c[1] - HN, ZH), W(c[0] + HE * oc, c[1] + HN, ZH), W(c[0] - HE * oc, c[1] + HN, ZH)];
  if (oc < 0.03) return { svg: "", open };
  let g = poly(open, "pu-hold");
  if (lv > 0.005) {
    const zb = ZH - HOLD, hgt = 2 + lv * (HOLD + 1.5), rb = 6 + lv * 16, apex = W(c[0], c[1], zb + hgt);
    const base = []; for (let i = 0; i < 28; i++) { const t = (i / 28) * TAU; base.push(W(c[0] + rb * Math.cos(t), c[1] + rb * Math.sin(t), zb)); }
    g += `<g clip-path="url(#${clipId})">${poly(hull([apex, ...base]), "pu-hold-pile")}${poly([apex, ...hull([apex, ...base]).filter((p) => p[0] >= apex[0])], "pu-hold-pile pu-hold-pile--lit")}</g>`;
  }
  g += line([...open, open[0]], "pu-coaming");
  return { svg: g, open };
}
// cargador: pedestal en el muelle, brazo que gira y se extiende hasta la escotilla, chute telescópico
function loaderGeo(target) {
  const root = [LOADER.e, LOADER.n, LOADER.root], head = [target[0], target[1], LOADER.head];
  const d = v3.norm(v3.sub(head, root)), tail = v3.sub(root, v3.mul([d[0], d[1], 0], 13));
  return { root, head, tail, d, len: Math.hypot(...v3.sub(head, root)) };
}
function loaderSvg(L, chuteZ, pour, fl, rateK) {
  let g = "";
  g += cylA([LOADER.e, LOADER.n, LOADER.z0], [0, 0, 1], LOADER.root - 2 - LOADER.z0, 3.6, 3.6, "pu-ped");
  g += cylA([LOADER.e, LOADER.n, LOADER.root - 2.2], [0, 0, 1], 1.6, 5.4, 5.4, "pu-slew");
  // contrapeso y brazo (tramo fijo + tramo telescópico)
  g += beam(L.tail, L.root, 4, 3, "pu-boom") + boxSvg(L.tail[0] - 3, L.tail[0] + 3, L.tail[1] - 3, L.tail[1] + 3, L.tail[2] - 5, L.tail[2] - 0.5, "pu-cw");
  const mid = v3.add(L.root, v3.mul(v3.sub(L.head, L.root), 0.58));
  g += beam(L.root, mid, 5.2, 3.8, "pu-boom");
  g += beam(v3.sub(mid, v3.mul(L.d, 6)), L.head, 4, 3, "pu-boom pu-boom--tele");
  // tirantes al mástil
  const mast = [LOADER.e, LOADER.n, LOADER.root + 12];
  g += line([P3(L.tail), P3(mast), P3(mid)], "pu-stay") + line([P3(L.root), P3(mast)], "pu-stay pu-stay--mast");
  // correa sobre el brazo
  if (rateK > 0) g += `<path class="pu-flow pu-flow--boom" d="${D([P3(v3.add(L.root, [0, 0, 1.8])), P3(v3.add(L.head, [0, 0, 1.4]))], false, f2)}" style="stroke-dashoffset:${f2(-fl * 10 * rateK)}"/>`;
  // cabezal y chute telescópico (3 tramos)
  g += boxSvg(L.head[0] - 2.4, L.head[0] + 2.4, L.head[1] - 2.4, L.head[1] + 2.4, L.head[2] - 2, L.head[2] + 2.6, "pu-head");
  const z0 = L.head[2] - 2, span = z0 - chuteZ;
  [[3, 2.2, 0, 0.36], [2.5, 1.9, 0.33, 0.7], [2, 1.6, 0.66, 1]].forEach(([r0, r1, a, b2]) => { g += cylA([L.head[0], L.head[1], z0 - span * b2], [0, 0, 1], span * (b2 - a), r1, r0, "pu-chute"); });
  return g;
}

// ---------------------------------------------------------------- lámina
export async function createPuerto() {
  const root = document.createElement("div");
  root.className = "pu-plate";
  root.style.cssText = `position:absolute;left:${VIEW[0]}px;top:${VIEW[1]}px;width:${VIEW[2]}px;height:${VIEW[3]}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "pu-svg", role: "group", tabindex: "0",
    "aria-label": "Puerto: el concentraducto trae la pulpa, la estación terminal disipa la presión, los espesadores de recepción la vuelven a espesar, las bombas la llevan a los filtros, el queque se acopia y una correa lo lleva al cargador, que llena las bodegas del barco. Espacio pausa; coma y punto cambian de paso; 1 a 5 eligen un equipo." }, root);
  const defs = el("defs", {}, svg);
  const geo = await import("./puerto-geo.js").catch(() => ({ SIL: "" }));
  const silEl = el("path", { d: geo.SIL, class: "pu-sil" }, svg);
  const printedAt = (x, y) => { const q = svg.createSVGPoint(); q.x = x; q.y = y; return silEl.isPointInFill(q); };
  async function loadDoc(file, pre) {
    const text = (await (await fetch(U(file))).text()).replace(/\bcls-(\d+)/g, `${pre}cls-$1`).replace(/(id="|url\(#)(clippath[-\d]*)/g, `$1${pre}$2`).replace(/\sid="(?!pu|[a-z]+-clippath)[^"]*"/g, (m0) => (m0.includes("clippath") ? m0 : ""));
    const doc = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
    doc.querySelectorAll("metadata, title, desc").forEach((n) => n.remove());
    const st = doc.querySelector("style"); if (st) { el("style", {}, defs).textContent = st.textContent; st.remove(); }
    doc.querySelectorAll("defs > *").forEach((n) => { if (n.tagName !== "style") defs.appendChild(document.importNode(n, true)); });
    doc.querySelectorAll("defs").forEach((n) => n.remove());
    return doc;
  }
  const kids = (n) => [...n.children].filter((c) => !["defs", "style", "title", "clipPath"].includes(c.tagName));
  const G = (cls, R, parent, attrs = {}) => el("g", { class: cls, transform: `translate(${R[0]} ${R[1]}) scale(${S})`, ...attrs }, parent);
  const imp = (n, g) => g.appendChild(document.importNode(n, true));

  // ---- espesadores (con el agua, las rastras y el rebalse intercalados en el dibujo)
  const espDoc = await loadDoc("espesadora_puerto.svg", "pe-");
  const espK = kids(kids(espDoc)[0]);                      // [anillo grande, espesador con puente]
  const gEsp = el("g", { "data-eq": "espesadores" }, svg);
  const thBig = el("g", {}, gEsp), thSmall = el("g", {}, gEsp);
  const bigK = kids(espK[0]);
  const a1 = G("", REG.esp, thBig); imp(bigK[0], a1); imp(bigK[1], a1);
  const wBig = el("g", { class: "pu-thw" }, thBig);
  const a2 = G("", REG.esp, thBig); imp(bigK[2], a2);
  const smK = kids(espK[1]), smK0 = kids(smK[0]);
  const s1 = G("", REG.esp, thSmall); imp(smK0[0], s1);
  const wSmall = el("g", { class: "pu-thw" }, thSmall);
  const s2 = G("", REG.esp, thSmall); smK0.slice(1).forEach((n) => imp(n, s2)); imp(smK[1], s2);

  const gUnder = el("g", { "data-eq": "espesadores" }, svg);
  // ---- cañerías y mineroducto (adelante de los espesadores)
  const gPipe = el("g", { "data-eq": "mineroducto" }, svg);

  // ---- barco (antes que el muelle) y bodegas
  const shipDoc = await loadDoc("barco.svg", "pb-");
  const gShipW = el("g", { "data-eq": "embarque" }, svg);
  const shipArt = G("pu-ship", REG.ship, gShipW); kids(shipDoc).forEach((n) => imp(n, shipArt));
  const gHolds = el("g", { class: "pu-holds" }, gShipW);
  const holdClips = [0, 1, 2].map((i) => { const c = el("clipPath", { id: `pu-hold-${i}`, clipPathUnits: "userSpaceOnUse" }, defs); return el("path", {}, c); });

  // ---- puerto: el dibujo en su orden, con capas propias intercaladas
  const portDoc = await loadDoc("puerto.svg", "pp-");
  const PK = kids(kids(portDoc)[0]);
  const COVER = new Set([14, 16, 18, 20, 22, 23, 24, 25, 26, 27, 28, 29]);
  const RAMP = new Set([30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 44]);
  const gPort = el("g", {}, svg);
  let cur = null, curKey = "";
  const into = (key, eq, cls = "") => { if (curKey !== key) { cur = G(cls, REG.port, gPort, eq != null ? { "data-eq": eq } : {}); curKey = key; } return cur; };
  const L = {};
  const B46g = {}, B54g = {};
  for (let i = 0; i < PK.length; i++) {
    if (i === 14) { L.belt = el("g", { class: "pu-belt", "data-eq": "embarque" }, gPort); curKey = ""; }
    if (i === 53) continue;                                // la rampa en S se reemplaza por el cargador
    if (i === 45) { imp(PK[i], into("b45", "galpon")); continue; }
    if (i === 46) {
      B46g.int = el("g", { class: "pu-int", "data-eq": "filtros" }, gPort);
      const fk = kids(PK[46]), faces = kids(fk[0]);
      B46g.walls = G("", REG.port, gPort, { "data-eq": "filtros" }); B46g.clip = el("g", {}, B46g.walls);
      [0, 5].forEach((k) => imp(faces[k], B46g.clip)); imp(fk[1], B46g.clip); imp(fk[2], B46g.clip);
      B46g.roof = G("pu-roof", REG.port, gPort, { "data-eq": "filtros" }); [6, 2, 1, 3, 4, 7, 8].forEach((k) => imp(faces[k], B46g.roof));
      gPort.appendChild(gPipe); curKey = ""; continue;
    }
    if (i === 54) {
      B54g.int = el("g", { class: "pu-int", "data-eq": "galpon" }, gPort);
      const fk = kids(PK[54]), faces = kids(fk[0]);
      B54g.walls = G("", REG.port, gPort, { "data-eq": "galpon" }); B54g.clip = el("g", {}, B54g.walls);
      [0, 1].forEach((k) => imp(faces[k], B54g.clip)); imp(fk[1], B54g.clip);
      B54g.roof = G("pu-roof", REG.port, gPort, { "data-eq": "galpon" }); imp(faces[2], B54g.roof);
      curKey = ""; continue;
    }
    const eq = i === 17 || i === 13 || i === 21 ? "" : "embarque";
    imp(PK[i], into(COVER.has(i) ? "cover" : RAMP.has(i) ? "ramp" : `x${eq}`, eq, COVER.has(i) ? "pu-cover" : ""));
    if (i === 15) { L.trestle = el("g", { class: "pu-belt", "data-eq": "embarque" }, gPort); curKey = ""; }
  }
  const covers = [...gPort.querySelectorAll(".pu-cover")];
  // clips de muros (en coordenadas del dibujo)
  const mkClip = (id, g) => { const c = el("clipPath", { id, clipPathUnits: "userSpaceOnUse" }, defs); const p = el("path", {}, c); g.setAttribute("clip-path", `url(#${id})`); return p; };
  B46g.cp = mkClip("pu-clip46", B46g.clip); B54g.cp = mkClip("pu-clip54", B54g.clip);
  setHTML(B46g.int, hallSvg(B46)); setHTML(B54g.int, hallSvg(B54));
  const in46 = el("g", {}, B46g.int), in54 = el("g", {}, B54g.int);
  // ---- cargador de barcos (sobre todo lo del muelle)
  const gLoader = el("g", { "data-eq": "embarque" }, svg);
  const gFx = el("g", { class: "pu-fx" }, svg);

  // ---- capa superior: etiquetas, recorrido, detalle
  const topG = el("g", { class: "pu-top" }, svg);
  const lab = el("g", { class: "pu-labels" }, topG);
  const LB = (p, t, a = "start", cls = "pu-small") => { const e = el("text", { x: f1(p[0]), y: f1(p[1]), class: cls, "text-anchor": a }, lab); e.textContent = t; return e; };
  const kmTag = LB([4368, 759], "concentraducto ≈ 170 km", "middle");
  LB([4308, 724], "estación terminal", "middle");
  LB([4340, 704], "rebalse: agua clara a tratamiento", "middle");
  LB([4932, 616], "torre de transferencia · muestreo", "middle");
  const tmlTag = LB([0, 0], "", "middle", "pu-warn");
  const viscTag = LB([4300, 606], "", "middle", "pu-warn");
  // enlace a quien impulsa el concentraducto: las bombas de pistón de la planta (Flotación, Ruta A)
  const src = el("g", { class: "pu-link", role: "link", tabindex: "0", "aria-label": "Desde la planta: bombas de pistón de Flotación (abrir la estación)", transform: "translate(4420 766)" }, topG);
  el("rect", { x: -36, y: -6, width: 72, height: 12, rx: 6, class: "pu-link-pill" }, src);
  el("text", { x: 0, y: 2.4, class: "pu-link-text", "text-anchor": "middle" }, src).textContent = "← bombas de la planta";
  const goPlant = (e) => { e.stopPropagation(); dispatchEvent(new CustomEvent("pm:goto", { detail: "celdas-flotacion" })); };
  src.addEventListener("click", goPlant); src.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goPlant(e); } });
  const tourG = el("g", { class: "pu-tour" }, topG);
  const tourRing = el("circle", { r: 5, class: "pu-tour-ring" }, tourG), tourDot = el("circle", { r: 1.9, class: "pu-tour-dot" }, tourG);
  const tourPulse = el("circle", { r: 8, class: "pu-tour-pulse" }, topG);
  // zoom sobre el dibujo: llamadas ancladas al dibujo ampliado
  const zoomG = el("g", { class: "pu-zoom", "aria-hidden": "true" }, svg);
  const tagsG = el("g", { class: "pu-tags" }, topG);
  // píldoras dentro de lo impreso (?qa=silueta)
  const TAGS = { espesadores: ["Espesadores de recepción", TP(TH.big, 0, 0, 14)], mineroducto: ["Concentraducto", [4336, 754]],  filtros: ["Planta de filtros", [4461, 677]], galpon: ["Galpón de acopio", [4541, 747]], embarque: ["Cargador de barcos", null] };
  const tagEls = {};
  for (const [id, [label]] of Object.entries(TAGS)) {
    const g = el("g", { class: "pu-tag" }, tagsG);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -12, class: "pu-tag-line" }, g);
    const ww = label.length * 3.7 + 12; el("rect", { x: -ww / 2, y: -23, width: ww, height: 11, rx: 5.5, class: "pu-tag-pill" }, g);
    el("text", { x: 0, y: -15.6, class: "pu-tag-text", "text-anchor": "middle" }, g).textContent = label; tagEls[id] = g;
  }
  const units = [[gEsp, "espesadores"], [gUnder, "espesadores"], [gShipW, "embarque"], [gLoader, "embarque"], ...[...gPort.children].map((c) => [c, c === gPipe ? "mineroducto" : c.dataset.eq ?? ""])];
  // ?qa=silueta: en rojo todo lo vivo que se pinte fuera de lo impreso (silueta de la lámina)
  const QA = typeof location !== "undefined" && new URLSearchParams(location.search).get("qa") === "silueta";
  if (QA) {
    const liveEls = [wBig, wSmall, gUnder, gPipe, B46g.int, B54g.int, B46g.roof, B54g.roof, L.belt, L.trestle, gShipW, gLoader, gFx, topG, zoomG];
    liveEls.forEach((n, i) => (n.id = `pu-qa-${i}`));
    const mask = el("mask", { id: "pu-qa-out", maskUnits: "userSpaceOnUse", x: 3000, y: 0, width: 3000, height: 2000 }, defs);
    el("rect", { x: 3000, y: 0, width: 3000, height: 2000, fill: "#fff" }, mask); el("path", { d: geo.SIL, fill: "#000" }, mask);
    const red = el("filter", { id: "pu-qa-red", x: "-5%", y: "-5%", width: "110%", height: "110%" }, defs);
    el("feFlood", { "flood-color": "#ff0033", result: "c" }, red); el("feComposite", { in: "c", in2: "SourceAlpha", operator: "in" }, red);
    const qa = el("g", { class: "pu-qa", "pointer-events": "none" }, svg);
    const out = el("g", { mask: "url(#pu-qa-out)", filter: "url(#pu-qa-red)" }, qa);
    liveEls.forEach((n) => { el("use", { href: `#${n.id}` }, out).dataset.src = n.id; });
    el("path", { d: geo.SIL, fill: "none", stroke: "#00b7ff", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }, qa);
    root.__qaFix = () => out.querySelectorAll("use").forEach((u) => { const n = svg.querySelector(`#${u.dataset.src}`); const a = n?.parentNode?.getCTM?.(), b = svg.getCTM(); if (a && b) { const m = b.inverse().multiply(a); u.setAttribute("transform", `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`); } });
  }

  // ------------------------------------------------------------ estado
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const ST = { t: 0, flow: 0, h: 8.5, uf: shared.uf ?? UF_NOM, seenUf: shared.uf, plant: 0, belt: 0, ship: 0.3, press: 0, loader: 0 };
  const shown = { plant: 0, galpon: 0, belt: 0, plantS: 0, beltS: 0 };
  let selected = null, playing = !still.matches, active = false, raf = 0, last = 0, lastLit = null;
  if (still.matches) ST.t = STEPS[3].ta + 2;
  const curModel = () => model(ST.h, ST.uf);
  function step(dt) {
    ST.flow += dt; ST.t = (ST.t + dt) % PERIOD; const m = curModel();
    ST.press += dt / m.cycle; ST.loader += dt;
    if (m.ok) ST.ship = (ST.ship + (dt * m.rate) / 1575 / (3 * 53)) % 1;
  }
  const live = () => {
    const m = curModel(), q = state(ST.t);
    // en los pasos 4 y 5 el filtro y el cargador siguen la secuencia; fuera de ellos, sus propios relojes
    const press = q.step.n === 4 ? pressPhase(q.stage === "press" ? q.u * (PRESS_CYCLE - 0.01) : q.phase === "arrive" ? 0 : PRESS_CYCLE - 0.3) : pressPhase(ST.press);
    const fel = loaderAt(q.step.n === 5 ? (q.stage === "loader" ? q.u * 9.3 : 0) : ST.loader);
    return { t: ST.t, m, step: q.step, seq: q, press, fel, ship: shipAt(ST.ship) };
  };
  // cuánto está abierta cada cosa: deslizadores («Interior planta» abre las dos naves), selección y secuencia
  const targets = () => {
    const q = state(ST.t), sel = (k) => (selected === k ? 1 : 0);
    return { plant: Math.max(ST.plant, sel("filtros"), selected ? 0 : q.open.plant), galpon: Math.max(ST.plant, sel("galpon"), selected ? 0 : q.open.galpon), belt: Math.max(ST.belt, selected ? 0 : q.open.belt), plantS: ST.plant, beltS: ST.belt };
  };
  let loaderNow = null;

  // ---- zoom sobre el dibujo (deslizadores): naves (A) y galería de la correa (B)
  const ZR = { A: [4372, 632, 262, 214], B: [4640, 430, 480, 330] };
  let zoomMode = "viewBox", onZoom = null, zoomKey = null, lastZoom = "", vb = VIEW.slice();
  const mixRect = (a, b, u) => { const w = Math.exp(lerp(Math.log(a[2]), Math.log(b[2]), u)), h = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u));
    return [lerp(a[0] + a[2] / 2, b[0] + b[2] / 2, u) - w / 2, lerp(a[1] + a[3] / 2, b[1] + b[3] / 2, u) - h / 2, w, h]; };
  const fitAspect = ([x, y, w, h]) => { const a = VIEW[2] / VIEW[3]; return w / h > a ? [x, y - (w / a - h) / 2, w, w / a] : [x - (h * a - w) / 2, y, h * a, h]; };
  function applyZoom() {
    const z = zoomKey === "A" ? shown.plantS : zoomKey === "B" ? shown.beltS : 0, sig = `${zoomKey}|${z.toFixed(4)}`;
    if (sig === lastZoom) return z;
    lastZoom = sig;
    if (zoomMode === "camera") onZoom?.(z > 0.001 ? mixRect(VIEW, ZR[zoomKey], z) : null, z);
    else { vb = z > 0.001 ? mixRect(VIEW, fitAspect(ZR[zoomKey]), z) : VIEW.slice(); svg.setAttribute("viewBox", vb.map((v) => v.toFixed(2)).join(" ")); svg.style.overflow = z > 0.001 ? "hidden" : ""; }
    return z;
  }
  function viewNow() {
    if (zoomMode === "camera") { const m = svg.getScreenCTM(); if (m && m.a) return { r: [-m.e / m.a, -m.f / m.d, innerWidth / m.a, innerHeight / m.d], u: 1 / m.a }; }
    const v = svg.viewBox.baseVal, r = v && v.width ? [v.x, v.y, v.width, v.height] : vb, w = svg.getBoundingClientRect().width;
    return { r, u: w > 1 ? r[2] / w : 1 };
  }
  // llamadas: [lado, punto, texto]; cada texto se corre hacia su ancla hasta quedar entero sobre lo impreso
  function callouts(list, cols, op) {
    const o = op.toFixed(3); if (zoomG.style.opacity !== o) zoomG.style.opacity = o;
    if (op <= 0.001 || !list.length) { setHTML(zoomG, ""); return; }
    const { r: vr, u } = viewNow(), fs = 11.5 * u, out = [], along = Array.from({ length: 9 }, (_, k) => k / 8);
    for (const side of [0, 1]) {
      const col = list.filter((l) => l[0] === side).sort((a, b) => a[1][1] - b[1][1]);
      const tw = Math.max(0, ...col.map((l) => l[2].length)) * 6.3 * u + 6 * u;
      const x = side ? Math.min(cols[1], vr[0] + vr[2] - tw) : Math.max(cols[0], vr[0] + tw);
      let y = vr[1] + fs * 0.4;
      for (const [, pt, text] of col) {
        y = Math.min(Math.max(pt[1] + fs * 0.35, y + fs * 1.6), vr[1] + vr[3] - fs * 0.6);
        const w = text.length * 5.8 * u + 4 * u, dir = side ? -1 : 1;
        let tx = x;
        for (let i = 0; i < 90; i++) { if (along.every((k) => { const q = tx - dir * w * k; return printedAt(q, y - fs * 0.8) && printedAt(q, y + fs * 0.2); })) break; tx += dir * 2 * u; }
        const ex = side ? tx - 3 * u : tx + 3 * u;
        out.push(`<path class="pu-zl-lead" stroke-width="${f2(u)}" d="M${f2(pt[0])} ${f2(pt[1])}L${f2(ex)} ${f2(y - fs * 0.35)}"/>`, `<circle class="pu-zl-dot" cx="${f2(pt[0])}" cy="${f2(pt[1])}" r="${f2(2.4 * u)}"/>`,
          `<text class="pu-zl-text" x="${f2(tx)}" y="${f2(y)}" font-size="${f2(fs)}" stroke-width="${f2(3 * u)}" text-anchor="${side ? "start" : "end"}">${text}</text>`);
      }
    }
    setHTML(zoomG, out.join(""));
  }
  const PHASE = { llenado: "llenado", prensado: "prensado", soplado: "soplado", descarga: "descarga", cierre: "cierre" };
  function drawCallouts(s, z) {
    const op = (v) => smooth((v - 0.55) / 0.35);
    if ((zoomKey === "A" && z > 0.001 && !selected) || selected === "filtros") {
      const o = selected ? smooth((shown.plant - 0.5) / 0.4) : op(z);
      callouts([[1, W(-170, -388, 5), "Bombas de alimentación"], [1, W(PRESS.e, -420, PRESS.z1), `Filtro prensa · ${PHASE[s.press.ph]}`],
        [0, W(FEEDTANK[0], FEEDTANK[1], 13), "Estanque agitado"], [0, W(PRESS.e + 5, -450, 2), "Agua filtrada"], [0, W(-135, PRESS.n0 - 12, 3), "Queque → galpón"]], [4400, 4505], o);
    } else if (selected === "galpon") {
      callouts([[0, W(-45, PILE.n, PILE.h), "Pila de queque"], [1, W(s.fel.e + 2, HOPPER.n - 4, 6), "Cargador frontal"], [1, W(HOPPER.e, HOPPER.n, 11), "Tolva"]], [4500, 4560], smooth((shown.galpon - 0.5) / 0.4));
    } else if (zoomKey === "B" && z > 0.001 && !selected && loaderNow) {
      callouts([[0, W(0, -190, 2), "Correa cubierta"], [0, W(0, TOWER_N, 6), "Torre de muestreo"], [1, P3(loaderNow.head), "Brazo y chute telescópico"], [1, W(...hatchGeo(2.6 * s.ship.load)[s.ship.to].slice(0, 2), ZH - 4), `Bodega ${s.ship.to + 1}`]], [4780, 4900], op(z));
    } else { setHTML(zoomG, ""); if (zoomG.style.opacity !== "0") zoomG.style.opacity = "0"; }
  }

  function draw() {
    const s = live(), m = s.m, fl = ST.flow, sh = s.ship;
    // ---- espesadores
    setHTML(wBig, thickSvg(TH.big, fl * 0.25, fl, true) + launderFlow(TH.big, fl));
    setHTML(wSmall, thickSvg(TH.small, -fl * 0.35, fl, false));
    // ---- concentraducto, estación terminal, alimentación y descargas
    setHTML(gPipe, ductSvg(fl, m));
    setHTML(gUnder, underSvg(fl, m));
    viscTag.textContent = m.viscous ? "pulpa muy viscosa" : "";
    // ---- naves: muros recortados a la altura del corte, techos que suben y se desvanecen
    for (const [b, gg, sv] of [[B46, B46g, shown.plant], [B54, B54g, shown.galpon]]) {
      const zc = lerp(b.H + (b.ridge || 0) + 6, 7, smooth(sv));
      gg.cp.setAttribute("d", D(cutPoly(b, -6, zc).map((p) => toL(REG.port, p)), true, f2));
      gg.roof.setAttribute("transform", `translate(${REG.port[0]} ${f2(REG.port[1] - 34 * smooth(sv))}) scale(${S})`);
      gg.roof.style.opacity = f2(1 - smooth(sv * 1.6));
      gg.int.style.display = sv > 0.01 ? "" : "none";
    }
    if (shown.plant > 0.01) setHTML(in46, pressSvg(s.press, fl, m));
    if (shown.galpon > 0.01) setHTML(in54, pileSvg(B54, s.fel, fl));
    // ---- correa: galería (cubierta que se levanta), caballete abierto
    {
      const bz = 0.4, ok = m.ok ? 1 : 0.25, off = -fl * 12 * (m.rate / 1575);
      const strip = (n0, n1) => poly([W(-BELT.w, n0, bz), W(BELT.w, n0, bz), W(BELT.w, n1, bz), W(-BELT.w, n1, bz)], "pu-beltband");
      setHTML(L.belt, shown.belt > 0.01 ? strip(BELT.g0, BELT.g1) + `<g style="opacity:${f2(ok)}">${flowSvg([[0, BELT.g0, bz + 0.3], [0, BELT.g1, bz + 0.3]], "pu-flow--belt", off)}</g>` : "");
      setHTML(L.trestle, strip(BELT.g1, BELT.n1 - 3) + `<g style="opacity:${f2(ok)}">${flowSvg([[0, BELT.g1, bz + 0.3], [0, BELT.n1 - 3, bz + 0.3]], "pu-flow--belt", off)}</g>`);
      covers.forEach((c) => (c.style.opacity = f2(1 - 0.92 * smooth(shown.belt))));
    }
    // ---- barco: se hunde un poco al cargarse; escotillas y bodegas
    const dy = 2.6 * sh.load;
    shipArt.setAttribute("transform", `translate(${REG.ship[0]} ${f2(REG.ship[1] + dy)}) scale(${S})`);
    const hatches = hatchGeo(dy);
    let hg = ""; hatches.forEach((c, i) => { const r = holdSvg(c, sh.lv[i], sh.oc, `pu-hold-${i}`); holdClips[i].setAttribute("d", D(r.open, true, f2)); hg += r.svg; });
    setHTML(gHolds, hg);
    // ---- cargador: apunta a la escotilla de la pasada (o se estaciona), chute dentro de la bodega
    {
      const park = [LOADER.e + 6, LOADER.n + 44, 0];
      const tgt0 = hatches[sh.from], tgt1 = hatches[sh.to];
      let tgt = v3.lerp(tgt0, tgt1, sh.move); tgt = v3.lerp(tgt, park, sh.park);
      const trim = sh.pour ? Math.sin(sh.trim * TAU * 2) * 2.2 : 0; tgt = [tgt[0] + trim, tgt[1], 0];
      const Lg = loaderGeo(tgt); loaderNow = Lg;
      const down = (1 - sh.park) * (sh.pour ? 1 : smooth(sh.move));
      const chuteZ = lerp(LOADER.head - 8, ZH - 3, down);
      let g = loaderSvg(Lg, chuteZ, sh.pour, fl, m.ok ? m.rate / 1575 : 0);
      setHTML(gLoader, g);
      // chorro desde el chute hasta la pila (recortado a la escotilla)
      let fx = "";
      if (sh.pour && m.ok && sh.oc > 0.5) { const c = hatches[sh.to], lv = sh.lv[sh.to], zp = ZH - HOLD + 3 + lv * (HOLD + 2);
        let st = ""; for (let j = 0; j < 9; j++) { const p = mod(fl * 2 + j / 9, 1); st += circ(W(tgt[0] + (hash(j) - 0.5) * 2, c[1] + (hash(j * 3) - 0.5) * 2, lerp(ZH - 3, zp, p)), 0.85, "pu-grain", 1 - p * 0.4); }
        fx += `<g clip-path="url(#pu-hold-${sh.to})">${st}</g>`;
        for (let j = 0; j < 3; j++) { const p = mod(fl * 0.5 + j / 3, 1); fx += circ(W(tgt[0] + 2, c[1] - 6, ZH + 1 + p * 5), 1.2 + p * 2, "pu-dust", (1 - p) * 0.35); } }
      setHTML(gFx, fx);
      tmlTag.textContent = m.ok ? "" : `Humedad ${fdec(m.h, 1)} % > TML ${TML} %: embarque detenido`;
      tmlTag.setAttribute("x", 5001); tmlTag.setAttribute("y", 528);
    }
    lab.style.opacity = 1;
    // zoom y llamadas
    const z = applyZoom();
    drawCallouts(s, z);
    const tz = (1 - smooth(z * 2.5)).toFixed(3); if (tagsG.style.opacity !== tz) tagsG.style.opacity = tz;
    const lz = ((1 - smooth(z * 2.5)) * (1 - smooth(shown.plant * 2))).toFixed(3); if (src.style.opacity !== lz) { src.style.opacity = kmTag.style.opacity = lz; src.style.pointerEvents = lz > 0.5 ? "" : "none"; }
    drawTour(s);
    // foco del paso: se ilumina el equipo y el resto baja a ~35 % (si no hay un equipo elegido)
    const lit = selected ? null : z > 0.3 ? null : s.seq.step.lit, litKey = lit ? lit.join() : "";
    if (litKey !== lastLit) { lastLit = litKey; units.forEach(([u, eq]) => u.classList.toggle("pu-stepdim", !!lit && !lit.includes(eq))); }
    for (const id of ORDER) {
      const on = selected ? selected === id : !!lit && lit.includes(id); tagEls[id].toggleAttribute("data-on", on);
      if (on && id === "embarque" && loaderNow) { const at = P3(v3.add(loaderNow.root, [0, 0, 22])); tagEls[id].setAttribute("transform", `translate(${f1(at[0])} ${f1(at[1])})`); }
      else if (on) tagEls[id].setAttribute("transform", `translate(${f1(TAGS[id][1][0])} ${f1(TAGS[id][1][1])})`);
    }
    root.__qaFix?.();
    listeners.forEach((fn) => fn(s, api));
  }
  function drawTour(s) {
    const q = s.seq, k = q.stage, u = q.u; let tp = null, inside = null;
    const along = (pts, v) => P3(polyline(pts).at(v * polyline(pts).len));
    const stationPt = [STATION_E, -515, 1.5];
    if (k === "fast") tp = along([DUCT[0], stationPt], u);
    else if (k === "drop") tp = W(STATION_E + 10 - 20 * smooth(u), -515, 1.5);
    else if (k === "calm") tp = along([[STATION_E - 10, -515, 1.5], ...FEED_B.slice(0)], u);
    else if (k === "settle") tp = TP(TH.big, TH.big.R * 0.5 * (1 - u), -Math.PI * 0.25 + u * 2, -2);
    else if (k === "cone") tp = P3(UNDER_B[0]);
    else if (k === "under") tp = along(UNDER_B, u);
    else if (k === "pumps") { if (shown.plant > 0.5) tp = along(UNDER_IN, u); else inside = W(-170, -388, 8); }
    else if (k === "tank") { if (shown.plant > 0.5) tp = along(PUMP_TANK, u); else inside = W(FEEDTANK[0], FEEDTANK[1], 14); }
    else if (k === "feed") { if (shown.plant > 0.5) tp = along(TANK_PRESS, u); else inside = W(PRESS.e, -430, 10); }
    else if (k === "press") { if (shown.plant > 0.5) tp = W(PRESS.e + 5, lerp(PRESS.n0 + 6, PRESS.n1 - 6, u), (PRESS.z0 + PRESS.z1) / 2); else inside = W(PRESS.e, -430, 10); }
    else if (k === "pile") { if (shown.galpon > 0.5) tp = W(PILE.e0 + 4, PILE.n, PILE.h + lerp(12, 0, u)); else inside = W(PILE.e0 + 10, PILE.n, 20); }
    else if (k === "loader") { const ld = s.fel; if (shown.galpon > 0.5) tp = u > 0.85 ? W(HOPPER.e, HOPPER.n, 11) : W(ld.e + 6.5, HOPPER.n - 4, 1.5 + ld.bucket * 9 + 3); else inside = W(HOPPER.e, HOPPER.n, 20); }
    else if (k === "belt") { const n = lerp(BELT.n0, BELT.n1 - 2, u); if (n > BELT.g0 && n < BELT.g1 && shown.belt < 0.5) inside = W(0, n, 5); else tp = W(0, n, 1.5); }
    else if (k === "boom" && loaderNow) tp = P3(v3.lerp(loaderNow.root, loaderNow.head, u));
    else if (k === "hold") { const c = hatchGeo(2.6 * s.ship.load)[s.ship.to]; if (u < 0.5) tp = W(c[0], c[1], lerp(LOADER.head - 2, ZH - 6, u * 2)); else inside = W(c[0], c[1], ZH - 4); }
    if (tp) { for (const n of [tourRing, tourDot]) { n.setAttribute("cx", f1(tp[0])); n.setAttribute("cy", f1(tp[1] - 1)); n.style.opacity = 1; } }
    else { tourRing.style.opacity = 0; tourDot.style.opacity = 0; }
    if (inside) { const ph = (performance.now() / 900) % 1; tourPulse.setAttribute("cx", f1(inside[0])); tourPulse.setAttribute("cy", f1(inside[1])); tourPulse.setAttribute("r", f1(4 + ph * 9)); tourPulse.style.opacity = (0.9 * (1 - ph)).toFixed(2); }
    else tourPulse.style.opacity = 0;
  }

  // ------------------------------------------------------------ reloj
  const listeners = new Set();
  // capas de pintado: el dibujo quieto se rasteriza una vez; sólo se repinta lo que se mueve (ver js/layers.js).
  // Lo animado se detecta solo; el marcador que sigue la partícula recorre toda la lámina.
  const layers = createLayers(svg, { name: "puerto", roaming: () => [tourG, tourPulse] });
  function frame(now) {
    layers.tick();
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    // el % de sólidos de Flotación manda cuando cambia
    if (shared.uf != null && shared.uf !== ST.seenUf) { ST.seenUf = shared.uf; ST.uf = shared.uf; }
    if (playing) step(dt);
    const kk = 1 - Math.exp(-dt * 6), tg = targets();
    for (const key of Object.keys(tg)) { shown[key] += (tg[key] - shown[key]) * kk; if (Math.abs(tg[key] - shown[key]) < 0.002) shown[key] = tg[key]; }
    draw(); raf = active ? nextTick(frame) : 0;
  }
  const redraw = (jump) => { if (jump || still.matches || !playing) Object.assign(shown, targets()); draw(); };
  const kick = () => { if (active && !raf) { last = performance.now(); raf = nextTick(frame); } };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; }, get playing() { return playing; },
    get plant() { return ST.plant; }, get belt() { return ST.belt; }, get h() { return ST.h; }, get uf() { return ST.uf; },
    get zoom() { return { key: zoomKey, viewBox: vb.slice() }; },
    live, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) kick(); else { cancelTick(raf); raf = 0; } },
    play() { playing = true; kick(); }, pause() { playing = false; }, togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { ST.t = mod(v, PERIOD); redraw(); },
    goStep(n) { api.seek(STEPS[clamp(n, 1, STEPS.length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(ST.t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(ST.t); api.goStep(ST.t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    setPlant(v, instant) { ST.plant = clamp(v); if (instant || still.matches) shown.plantS = ST.plant; zoomKey = ST.plant > 0 || ST.belt === 0 ? "A" : "B"; redraw(instant); },
    setBelt(v, instant) { ST.belt = clamp(v); if (instant || still.matches) shown.beltS = ST.belt; zoomKey = ST.belt > 0 || ST.plant === 0 ? "B" : "A"; redraw(instant); },
    setH(v) { ST.h = clamp(Math.round(v * 2) / 2, H_MIN, H_MAX); redraw(); },
    setUf(v) { ST.uf = clamp(Math.round(v), UF_MIN, UF_MAX); redraw(); },
    setShip(v) { ST.ship = mod(v, 1); redraw(); },
    setZoomMode(mode, fn = null) { zoomMode = mode; onZoom = fn; lastZoom = ""; if (mode === "camera" && vb[2] !== VIEW[2]) { vb = VIEW.slice(); svg.setAttribute("viewBox", VIEW.join(" ")); } draw(); },
    select(id) { selected = id && EQUIP[id] ? id : null; root.toggleAttribute("data-sel", !!selected); units.forEach(([u, eq]) => u.classList.toggle("pu-dim", !!selected && eq !== selected)); lastLit = null; redraw(); },
    destroy() { api.setActive(false); layers.destroy(); listeners.clear(); document.removeEventListener("visibilitychange", onVis); root.remove(); },
  };
  Object.assign(shown, targets());
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-eq]"); const id = g?.dataset.eq; api.select(id ? (selected === id ? null : id) : null); });
  const onVis = () => { if (document.hidden) { cancelTick(raf); raf = 0; } else kick(); };
  document.addEventListener("visibilitychange", onVis);
  draw();
  return api;
}

// ---------------------------------------------------------------- panel (HUD)
export function bindPanel(fx, { onEscape } = {}) {
  const $ = (q) => document.querySelector(q);
  const playBtn = $("[data-pu-play]"), stepsBox = $("[data-pu-steps]");
  stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", fx.STEPS.length);
  const stepBtns = fx.STEPS.map((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n; b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
    b.addEventListener("click", () => fx.goStep(s.n)); stepsBox.appendChild(b); return b; });
  const info = $("[data-info]"), meter = $("[data-pu-meter]"), readout = $("[data-pu-readout]");
  const plS = $("[data-pu-plant]"), plO = $("[data-pu-plant-out]"), beS = $("[data-pu-belt]"), beO = $("[data-pu-belt-out]"), hS = $("[data-pu-h]"), hO = $("[data-pu-h-out]");
  const ufS = $("[data-pu-uf]"), ufO = $("[data-pu-uf-out]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = []; const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  const chips = [...document.querySelectorAll("[data-pu-chip]")]; // fijos en el panel: se buscan una vez, no en cada cuadro
  function renderInfo(s) {
    const id = fx.selected;
    chips.forEach((c) => c.toggleAttribute("data-on", c.dataset.puChip === id));
    if (!id) { if (info.dataset.owner === "pu") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs(s.m), sig = id + specs.join("|");
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig; info.dataset.owner = "pu";
    $("[data-info-kicker]").textContent = e.kicker; $("[data-info-title]").textContent = e.title; $("[data-info-text]").textContent = e.text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join(""); $("[data-info-actions]").innerHTML = ""; info.hidden = false;
  }
  off.push(fx.on((s) => {
    const st = s.step;
    if (st.n !== lastStep) { $("[data-pu-step-n]").textContent = st.n; $("[data-pu-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const kk = Number(b.dataset.step); b.toggleAttribute("data-done", kk < st.n); b.toggleAttribute("data-current", kk === st.n); }); lastStep = st.n; }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", s.ship.load.toFixed(3));
    const warn = s.m.viscous ? " · pulpa muy viscosa" : s.m.cycle > 1.01 ? " · pulpa diluida: el filtro tarda más" : "";
    const text = (s.m.ok ? `Barco ${Math.round(s.ship.load * 100)} % · ${fdec(s.ship.load * 50, 1)} de 50 kt · ${fdec(s.m.rate)} t/h` : `Humedad ${fdec(s.m.h, 1)} % sobre el TML · embarque detenido`) + warn;
    readout.toggleAttribute("data-warn", !s.m.ok || !!warn);
    if (Number(ufS.value) !== Math.round(s.m.uf)) { ufS.value = s.m.uf; ufO.textContent = `${Math.round(s.m.uf)} %`; }
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(fx.playing)); playBtn.setAttribute("aria-label", fx.playing ? "Pausar" : "Reproducir");
    renderInfo(s);
  }));
  const sync = () => { plS.value = Math.round(fx.plant * 100); plO.textContent = `${plS.value} %`; beS.value = Math.round(fx.belt * 100); beO.textContent = `${beS.value} %`; hS.value = fx.h; hO.textContent = `${fdec(fx.h, 1)} %`; ufS.value = fx.uf; ufO.textContent = `${fx.uf} %`; };
  on(plS, "input", () => { fx.setPlant(plS.value / 100); plO.textContent = `${plS.value} %`; });
  on(beS, "input", () => { fx.setBelt(beS.value / 100); beO.textContent = `${beS.value} %`; });
  on(ufS, "input", () => { fx.setUf(Number(ufS.value)); ufO.textContent = `${ufS.value} %`; });
  on(hS, "input", () => { fx.setH(Number(hS.value)); hO.textContent = `${fdec(fx.h, 1)} %`; });
  on(playBtn, "click", () => fx.togglePlay());
  on($("[data-pu-prev]"), "click", () => fx.prevStep()); on($("[data-pu-next]"), "click", () => fx.nextStep());
  document.querySelectorAll("[data-pu-chip]").forEach((c) => on(c, "click", () => fx.select(fx.selected === c.dataset.puChip ? null : c.dataset.puChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "pu") fx.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "puerto" || e.target.closest?.("input, [data-intro], .pu-link")) return;
    if (e.key === " " && !e.target.closest("button")) fx.togglePlay();
    else if (e.key === ",") fx.prevStep(); else if (e.key === ".") fx.nextStep();
    else if (/^[1-5]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; fx.select(fx.selected === id ? null : id); }
    else if (e.key === "ArrowRight") { fx.setPlant(fx.plant + 0.1); sync(); }
    else if (e.key === "ArrowLeft") { fx.setPlant(fx.plant - 0.1); sync(); }
    else if (e.key === "ArrowUp") { fx.setBelt(fx.belt + 0.1); sync(); }
    else if (e.key === "ArrowDown") { fx.setBelt(fx.belt - 0.1); sync(); }
    else if (e.key === "Escape") { if (fx.selected) fx.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  sync(); fx.seek(fx.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "pu") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const ZOOM = { mineroducto: [4180, 620, 260, 220], espesadores: [4185, 500, 300, 260], filtros: [4372, 640, 220, 300], galpon: [4480, 700, 200, 280], embarque: [4600, 420, 520, 330] }; // alto extra abajo: la ficha tapa esa zona
const ZOOM_CAP = 12;
// lámina armada de antemano, en reposo, mientras se mira la infografía (js/explorer.js): abrir sólo la inserta
let prebuilt = null;
export function prebuild() { return (prebuilt ||= createPuerto().catch(() => (prebuilt = null))); }
export async function mount({ layer, focus }) {
  const fx = (await prebuilt) || (await createPuerto());
  prebuilt = null;
  if (fx.el.parentNode !== layer) layer.appendChild(fx.el); // la precarga pudo dejarla ya puesta (estacionada)
  requestAnimationFrame(() => fx.el.setAttribute("data-in", ""));
  // cámara: el equipo elegido manda; si no, el zoom sobre el dibujo de los deslizadores; si no, el encuadre
  let focused = null, zoomRect = null, zoomK = 0, lastSel = null;
  const want = (z, cap) => { const kz = z ? JSON.stringify(z) : ""; if (kz !== focused) { focused = kz; focus?.(z, cap); } };
  const toZoom = (ms) => { focused = "zoom"; focus?.(zoomRect, ZOOM_CAP, ms, lerp(0.06, 0.03, zoomK)); };
  fx.setZoomMode("camera", (rect, k) => { zoomRect = rect; zoomK = k; if (fx.selected) return; if (rect) toZoom(0); else want(null); });
  const unbind = bindPanel(fx, { onEscape: () => { location.hash = ""; } });
  const unzoom = fx.on(() => { if (fx.selected === lastSel) return; lastSel = fx.selected; if (fx.selected) want(ZOOM[fx.selected], 5); else if (zoomRect) toZoom(650); else want(null); });
  fx.setActive(true);
  window.pmPu = fx;
  return { focus: [VIEW[0] + 10, VIEW[1] + 10, VIEW[2] - 20, VIEW[3] - 20], view: "puerto",
    destroy: () => { unzoom(); unbind(); fx.destroy(); if (window.pmPu === fx) delete window.pmPu; } };
}
