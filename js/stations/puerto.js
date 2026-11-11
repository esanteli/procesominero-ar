// Estación 5 · Puerto — lámina viva sobre los dibujos de Emilio (assets/puerto/: espesadores, puerto y barco).
//
// Flujo del concentrado (como en los puertos de concentrado del norte de Chile, p. ej. Coloso):
//   · Espesadores de la concentradora: el concentrado de flotación sedimenta, las rastras lo llevan al centro y sale
//     por abajo como pulpa espesa (~65 % sólidos); el agua clara rebalsa por el borde y vuelve al proceso.
//   · Bombas → mineroducto (~170 km, aquí comprimido con un corte) → estación terminal (disipa la presión).
//   · Planta de filtros (nave del portón): estanque de alimentación y filtro prensa; el queque sale con ~8–9 % de
//     humedad y el agua filtrada va a tratamiento.
//   · Galpón de acopio (cerrado, presión negativa): pila de concentrado; un cargador frontal alimenta la tolva.
//   · Correa cubierta → torre de transferencia (muestreo) → caballete del muelle → cargador de barcos de pedestal:
//     gira y extiende el brazo sobre cada bodega y baja un chute telescópico. Se carga por pasadas entre bodegas.
//   · Límite de humedad transportable (TML): si el queque sale sobre el TML no se puede embarcar (riesgo de
//     licuefacción en la bodega), así que el embarque se detiene.
//
// Misma lógica de la skill anatomy que las otras estaciones: un modelo (humedad del queque → tasa, horas por barco,
// TML) manda y el dibujo lo sigue; "sigue el concentrado" en 6 pasos con state(t) puro; equipos con foco, ficha y
// detalle; deslizadores para abrir las naves y la galería de la correa. La carga del barco es un reloj aparte que sólo
// avanza si la humedad está bajo el TML.
//
// Geometría: px de la infografía; los tres dibujos están a escala 2 (registro por correlación). Isometría de mundo
// W(e, n, z) en px con origen en el extremo de la correa en el muelle (fin de la galería): n a lo largo de la correa
// (hacia el barco), e a lo ancho, z hacia arriba.
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
// cañerías
const PUMP = { e0: -350, e1: -330, n0: -503, n1: -487 };
const PIPE_S = [[-385, -405, 1], [-385, -495, 1], [-350, -495, 1]];
const PIPE_B = [[-290, -482, 1], [-290, -495, 1], [-330, -495, 1]];
const MINERO = [[-340, -503, 1.5], [-340, -515, 1.5], [-128, -515, 1.5], [-128, -473.5, 1.5]];
const MINERO_IN = [[-128, -473.5, 1.5], [-128, -460, 1.5], [FEEDTANK[0], FEEDTANK[1] - 7, 1.5]];
const BREAK_E = -232;

// ---------------------------------------------------------------- modelo (humedad del queque)
const H_MIN = 7, H_MAX = 12, TML = 10, SHIP_T = 50000;
export const model = (h) => {
  const rate = Math.round((1800 - 150 * (10 - h)) / 10) * 10;   // t/h: secar más alarga el ciclo del filtro
  return { h, rate, hours: SHIP_T / rate, ok: h <= TML, solids: 65, km: 170, trip: 170000 / 1.6 / 3600 };
};

// ---------------------------------------------------------------- "sigue el concentrado" (state(t) puro)
export const PERIOD = 53;
export const STEPS = [
  { n: 1, id: "espesadores", label: "Los espesadores llevan la pulpa a ~65 % de sólidos y las bombas la impulsan", t0: 0 },
  { n: 2, id: "mineroducto", label: "La pulpa viaja ~170 km por el mineroducto hasta el puerto", t0: 8 },
  { n: 3, id: "filtros", label: "El filtro prensa le saca el agua: sale un queque con ~9 % de humedad", t0: 15 },
  { n: 4, id: "galpon", label: "El concentrado se acopia en el galpón cerrado y un cargador alimenta la tolva", t0: 25 },
  { n: 5, id: "embarque", label: "La correa cubierta lo lleva al muelle; en la torre se toman muestras", t0: 34 },
  { n: 6, id: "embarque", label: "El cargador de barcos llena las bodegas por pasadas para nivelar el barco", t0: 44 },
].map((s, i, a) => ({ ...s, t1: i + 1 < a.length ? a[i + 1].t0 : PERIOD }));
const stepAt = (t) => STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1];
const FP = PERIOD / 4, LP = PERIOD / 5;
// filtro prensa: llenado → prensado → soplado → descarga (placa por placa) → cierre
function pressAt(t) {
  const u = mod(t - 12.5, FP);
  const ph = u < 3.4 ? "llenado" : u < 6 ? "prensado" : u < 8.6 ? "soplado" : u < 12.2 ? "descarga" : "cierre";
  return { u, ph, fill: u < 3.4 ? u / 3.4 : u < 8.6 ? 1 : 0, open: ph === "descarga" ? (u - 8.6) / 3.6 : -1, squeeze: ph === "prensado" ? smooth((u - 3.4) / 1) : ph === "soplado" ? 1 : 0, air: ph === "soplado" };
}
// cargador frontal: carga en la pila → va a la tolva → vacía → vuelve
function loaderAt(t) {
  const u = mod(t - 26, LP), k = (a, b) => smooth((u - a) / (b - a));
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
  espesadores: { kicker: "Concentradora", title: "Espesadores de concentrado", text: "El concentrado de flotación sedimenta en los espesadores: las rastras lo arrastran al centro del fondo y sale como una pulpa espesa; el agua clara rebalsa por el borde y vuelve al proceso. Bombas de pistón impulsan la pulpa al mineroducto.",
    specs: (m) => [`Pulpa ~${m.solids} % de sólidos`, "Rebalse: agua clara a reutilización", "Bombas de desplazamiento positivo"] },
  mineroducto: { kicker: "Transporte", title: "Mineroducto", text: "Tubería de acero enterrada que lleva el concentrado como pulpa desde la concentradora hasta el puerto, aprovechando la bajada hacia la costa. Al llegar, la estación terminal disipa la presión antes de la planta de filtros.",
    specs: (m) => [`~${m.km} km (aquí, comprimido)`, "Pulpa a ~1,6 m/s", `Llega en ~${fdec(m.trip)} horas`] },
  filtros: { kicker: "Recepción", title: "Planta de filtros", text: "La pulpa pasa a un estanque agitado y de ahí a los filtros prensa: entre placas con telas se presiona, se sopla aire y el agua sale filtrada. Al abrir las placas cae el queque, un concentrado húmedo pero manejable.",
    specs: (m) => [`Queque con ~${fdec(m.h, 1)} % de humedad`, "Agua filtrada → tratamiento", `${fdec(m.rate)} t/h de concentrado`] },
  galpon: { kicker: "Almacenamiento", title: "Galpón de acopio", text: "El concentrado se acopia bajo techo, con presión negativa y filtros de aire para que el polvo no salga. Un cargador frontal lo lleva a la tolva que alimenta la correa de embarque.",
    specs: () => ["Acopio cerrado: sin polvo al exterior", "Cargador frontal → tolva → correa", "Reserva para varios barcos"] },
  embarque: { kicker: "Embarque", title: "Correa y cargador de barcos", text: "Una correa cubierta lleva el concentrado al muelle; en la torre de transferencia se toman muestras para certificar ley y humedad. El cargador gira y extiende el brazo sobre cada bodega y baja un chute telescópico para cargar sin levantar polvo.",
    specs: (m) => [`${fdec(m.rate)} t/h · barco de 50.000 t en ~${fdec(m.hours)} h`, `Humedad ${fdec(m.h, 1)} % · límite TML ${TML} %`, "Pasadas entre bodegas para nivelar el barco"] },
};
const ORDER = ["espesadores", "mineroducto", "filtros", "galpon", "embarque"];

// ---------------------------------------------------------------- utilidades SVG
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k2, v] of Object.entries(attrs)) e.setAttribute(k2, v); parent?.appendChild(e); return e; };
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
function pressSvg(pr, fl, h) {
  const P = PRESS, wet = clamp((h - H_MIN) / (H_MAX - H_MIN));
  let g = "";
  // estanque de alimentación agitado
  g += cylA([FEEDTANK[0], FEEDTANK[1], 0], [0, 0, 1], 13, 6, 6, "pu-tank");
  { const c = W(FEEDTANK[0], FEEDTANK[1], 13), r = 4.4, a = fl * 3; g += line([[c[0] + Math.cos(a) * r * 0.87, c[1] + Math.sin(a) * r * 0.5], [c[0] - Math.cos(a) * r * 0.87, c[1] - Math.sin(a) * r * 0.5]], "pu-stir"); }
  g += pipeSvg([[FEEDTANK[0], FEEDTANK[1] - 4, 3], [FEEDTANK[0] - 10, P.n0 - 4, 3], [P.e, P.n0 - 4, P.z0 + 4]], "pu-pipe--pulp");
  // bastidor: cabezal fijo, vigas laterales, cabezal móvil
  const e0 = P.e - P.we / 2, e1 = P.e + P.we / 2;
  for (const n of [P.n0 + 2, P.n1 - 2]) g += boxSvg(e0 - 1, e0 + 1, n - 1, n + 1, 0, P.z0, "pu-press-leg") + boxSvg(e1 - 1, e1 + 1, n - 1, n + 1, 0, P.z0, "pu-press-leg");
  // correa bajo el filtro (hacia −n) y transversal hacia el galpón
  const bz = 2.4;
  g += beam([P.e, P.n1 + 2, bz], [P.e, P.n0 - 12, bz], 4.4, 1.2, "pu-cbelt") + beam([P.e - 2, P.n0 - 12, bz], [B46.e1 + 2, P.n0 - 12, bz], 4.4, 1.2, "pu-cbelt");
  g += flowSvg([[P.e, P.n1, bz + 0.7], [P.e, P.n0 - 12, bz + 0.7], [B46.e1 + 2, P.n0 - 12, bz + 0.7]], "pu-flow--cake", -fl * 8);
  // placas (de atrás hacia adelante: mayor n primero)
  const gap0 = (P.n1 - P.n0 - 6) / P.N, open = pr.open;
  const nAt = (k) => { let n = P.n0 + 4 + k * gap0 * (1 - 0.15 * pr.squeeze); if (open >= 0) { const j = open * P.N; if (k > j) n += 0; else n -= 0; const d = j - k; if (d > 0 && d < 1.4) n -= 2.6 * Math.sin((d / 1.4) * Math.PI); } return n; };
  g += beam([e0 - 0.6, P.n0, P.z1 - 1], [e0 - 0.6, P.n1, P.z1 - 1], 1.2, 1.6, "pu-press-rail") ;
  g += boxSvg(e0 - 1, e1 + 1, P.n1 - 3, P.n1, P.z0 - 1, P.z1 + 1, "pu-press-head");
  const plateCol = pr.fill > 0 ? rgb(PULP.map((v, i) => lerp(v, CONC[i], 1 - wet * 0.3))) : null;
  for (let k = P.N - 1; k >= 0; k--) {
    const n = nAt(k);
    g += poly([W(e0, n, P.z0), W(e1, n, P.z0), W(e1, n, P.z1), W(e0, n, P.z1)], "pu-plate");
    g += poly([W(e1, n - 1.6, P.z0), W(e1, n, P.z0), W(e1, n, P.z1), W(e1, n - 1.6, P.z1)], "pu-plate pu-plate--edge");
    if (plateCol && pr.ph !== "descarga") g += poly([W(e0 + 1.2, n - 0.05, P.z0 + 1.2), W(e1 - 1.2, n - 0.05, P.z0 + 1.2), W(e1 - 1.2, n - 0.05, lerp(P.z0 + 1.2, P.z1 - 1.2, pr.fill)), W(e0 + 1.2, n - 0.05, lerp(P.z0 + 1.2, P.z1 - 1.2, pr.fill))], "pu-plate-fill", ` style="fill:${plateCol}"`);
  }
  g += boxSvg(e0 - 1, e1 + 1, P.n0 - 1, P.n0 + 2, P.z0 - 1, P.z1 + 1, "pu-press-head");
  // queques que caen de la placa que se separa
  if (open >= 0) { const j = Math.floor(open * P.N), f = open * P.N - j, n = nAt(j) - 1, z = lerp(P.z0, bz + 1, smooth(f)); if (j < P.N) g += poly([W(e0 + 1.4, n, z), W(e1 - 1.4, n, z), W(e1 - 1.4, n, z + 5), W(e0 + 1.4, n, z + 5)], "pu-cake"); }
  // agua filtrada (goteo en el colector) y aire de soplado
  if (pr.ph === "prensado" || pr.ph === "llenado") for (let j = 0; j < 6; j++) { const ph = mod(fl * 1.4 + j / 6, 1), n = lerp(P.n0 + 4, P.n1 - 4, hash(j * 3.3)); g += circ(W(e1 + 0.6, n, lerp(P.z0, 1, ph)), 0.45, "pu-drip", 1 - ph); }
  if (pr.air) for (let j = 0; j < 5; j++) { const ph = mod(fl * 0.9 + j / 5, 1); g += circ(W(e1 + 1, lerp(P.n0 + 4, P.n1 - 4, hash(j * 7.1)), P.z1 + ph * 7), 0.9 + ph * 1.6, "pu-air", (1 - ph) * 0.8); }
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

// ---------------------------------------------------------------- detalle A: filtro prensa en corte (2D)
function detailA(box, s, m, fl) {
  const [bx, by, bw, bh] = box, pr = s.press, x0 = bx + 26, x1 = bx + bw - 36, top = by + 40, bot = by + 92, N = 9;
  const wet = clamp((m.h - H_MIN) / (H_MAX - H_MIN));
  let g = `<rect class="pu-a-frame" x="${f1(x0 - 8)}" y="${f1(top - 7)}" width="${f1(x1 - x0 + 16)}" height="4" rx="1"/>`;
  g += `<rect class="pu-a-head" x="${f1(x0 - 12)}" y="${f1(top - 4)}" width="6" height="${f1(bot - top + 8)}" rx="1"/><rect class="pu-a-head" x="${f1(x1 + 6)}" y="${f1(top - 4)}" width="6" height="${f1(bot - top + 8)}" rx="1"/>`;
  const gap = (x1 - x0) / N, sq = pr.squeeze, open = pr.open;
  for (let k = 0; k < N; k++) {
    let xa = x0 + k * gap, w = gap - 2.2;
    if (open >= 0) { const j = open * N; if (k < j) { xa -= Math.min(1, j - k) * 0; } }
    const cx = xa + w / 2, ch = bot - top;
    // cámara (entre placas)
    const fillH = pr.ph === "descarga" ? 0 : ch * pr.fill;
    g += `<rect class="pu-a-chamber" x="${f1(xa + 1)}" y="${f1(top)}" width="${f1(w - 2 + sq * 0.6)}" height="${f1(ch)}"/>`;
    if (fillH > 0.5) g += `<rect class="pu-a-pulp" x="${f1(xa + 1)}" y="${f1(bot - fillH)}" width="${f1(w - 2)}" height="${f1(fillH)}" style="fill:${rgb(PULP.map((v, i) => lerp(v, CONC[i], pr.ph === "soplado" ? 0.6 + 0.4 * (1 - wet) : sq * 0.6)))}"/>`;
    g += `<rect class="pu-a-plate" x="${f1(xa + w - 1)}" y="${f1(top - 3)}" width="3" height="${f1(ch + 6)}" rx="0.6"/><path class="pu-a-cloth" d="M${f1(xa + w - 1.4)} ${f1(top)}V${f1(bot)}M${f1(xa + 1)} ${f1(top)}V${f1(bot)}"/>`;
    // queque que cae al abrir
    if (open >= 0) { const j = open * N, d = j - k; if (d > 0 && d < 1) g += `<rect class="pu-a-cake" x="${f1(xa + 1.5)}" y="${f1(lerp(top + 2, bot + 18, smooth(d)))}" width="${f1(w - 3)}" height="${f1(ch * 0.8)}" rx="1.5"/>`; }
    if (pr.air && k % 2 === 0) for (let i = 0; i < 3; i++) { const ph = mod(fl * 1.2 + i / 3 + k * 0.17, 1); g += circ([cx + Math.sin(ph * 9 + k) * 1.5, lerp(top + 4, bot - 4, ph)], 0.9, "pu-a-air", 1 - ph); }
    if (pr.ph === "prensado" || pr.ph === "llenado") { const ph = mod(fl * 1.5 + k * 0.23, 1); g += circ([xa + w - 0.5, lerp(bot, bot + 10, ph)], 0.7, "pu-a-drop", 1 - ph); }
  }
  // alimentación, colector de agua y correa del queque
  g += `<path class="pu-a-feed" d="M${f1(bx + 4)} ${f1((top + bot) / 2)}H${f1(x0 - 12)}"/>`;
  g += `<path class="pu-a-water" d="M${f1(x0)} ${f1(bot + 9)}H${f1(x1)}M${f1(x1)} ${f1(bot + 9)}H${f1(bx + bw - 4)}"/>`;
  g += `<rect class="pu-a-belt" x="${f1(x0 - 4)}" y="${f1(bot + 20)}" width="${f1(x1 - x0 + 8)}" height="3" rx="1.5"/>`;
  for (let j = 0; j < 7; j++) { const ph = mod(fl * 0.2 + j / 7, 1); g += `<rect class="pu-a-cake" x="${f1(lerp(x0, x1, ph))}" y="${f1(bot + 17)}" width="6" height="3" rx="1"/>`; }
  const phName = { llenado: "1 · llenado", prensado: "2 · prensado", soplado: "3 · soplado de aire", descarga: "4 · descarga del queque", cierre: "cierre" }[pr.ph];
  g += `<text class="pu-a-phase" x="${f1(bx + bw / 2)}" y="${f1(by + 26)}" text-anchor="middle">${phName}</text>`;
  return { svg: g, pts: { feed: [bx + 6, (top + bot) / 2], plate: [x0 + gap * 3 + gap - 0.5, top - 2], water: [x1 + 10, bot + 9], belt: [x0 + 10, bot + 21], cake: [x0 + gap * 6, bot - 6] } };
}
// ---------------------------------------------------------------- detalle B: cargador y bodega en corte (2D)
function detailB(box, s, m, fl) {
  const [bx, by, bw, bh] = box, sh = s.ship, hold = sh.to, lv = sh.lv[hold];
  const hx = bx + bw * 0.62, wl = by + bh - 34 + s.ship.load * 4, deck = by + 74, keel = by + bh - 16, half = 44;
  let g = `<rect class="pu-b-sea" x="${f1(bx + 1)}" y="${f1(wl)}" width="${f1(bw - 2)}" height="${f1(by + bh - wl - 1)}"/>`;
  // casco en corte (U) y bodega
  g += `<path class="pu-b-hull" d="M${f1(hx - half)} ${f1(deck)}V${f1(keel - 8)}Q${f1(hx - half)} ${f1(keel)} ${f1(hx - half + 8)} ${f1(keel)}H${f1(hx + half - 8)}Q${f1(hx + half)} ${f1(keel)} ${f1(hx + half)} ${f1(keel - 8)}V${f1(deck)}"/>`;
  g += `<path class="pu-b-hold" d="M${f1(hx - half + 6)} ${f1(deck)}V${f1(keel - 10)}Q${f1(hx - half + 6)} ${f1(keel - 5)} ${f1(hx - half + 11)} ${f1(keel - 5)}H${f1(hx + half - 11)}Q${f1(hx + half - 6)} ${f1(keel - 5)} ${f1(hx + half - 6)} ${f1(keel - 10)}V${f1(deck)}Z"/>`;
  // pila en la bodega
  const ph = (keel - 5 - deck) * lv * 0.95, rb = 8 + lv * 34, apx = hx + Math.sin(sh.trim * TAU) * 3 * (sh.pour ? 1 : 0);
  if (lv > 0.01) g += `<path class="pu-b-pile" d="M${f1(Math.max(hx - half + 6, apx - rb))} ${f1(keel - 5)}L${f1(apx)} ${f1(keel - 5 - ph)}L${f1(Math.min(hx + half - 6, apx + rb))} ${f1(keel - 5)}Z"/>`;
  g += `<path class="pu-b-coam" d="M${f1(hx - 14)} ${f1(deck)}V${f1(deck - 5)}M${f1(hx + 14)} ${f1(deck)}V${f1(deck - 5)}"/>`;
  // muelle, pedestal, brazo y chute telescópico
  const qx = bx + 22, boomY = by + 30;
  g += `<rect class="pu-b-quay" x="${f1(bx + 1)}" y="${f1(wl - 10)}" width="${f1(hx - half - bx - 14)}" height="10"/>`;
  g += `<rect class="pu-b-ped" x="${f1(qx - 4)}" y="${f1(boomY + 6)}" width="8" height="${f1(wl - 10 - boomY - 6)}"/>`;
  g += `<path class="pu-b-boom" d="M${f1(qx - 14)} ${f1(boomY + 10)}L${f1(apx + 3)} ${f1(boomY - 2)}"/>`;
  g += `<path class="pu-b-belt" d="M${f1(qx)} ${f1(boomY + 4)}L${f1(apx)} ${f1(boomY - 4)}" style="stroke-dashoffset:${f2(-fl * 12)}"/>`;
  const cb = Math.min(keel - 8 - ph, deck + 10);
  g += `<rect class="pu-b-chute" x="${f1(apx - 3)}" y="${f1(boomY)}" width="6" height="${f1(cb - boomY)}"/><rect class="pu-b-chute pu-b-chute--in" x="${f1(apx - 2)}" y="${f1(boomY + (cb - boomY) * 0.4)}" width="4" height="${f1((cb - boomY) * 0.6)}"/>`;
  if (sh.pour && m.ok) for (let j = 0; j < 8; j++) { const p = mod(fl * 1.8 + j / 8, 1); g += circ([apx + (hash(j) - 0.5) * 3, lerp(cb, keel - 6 - ph, p)], 1, "pu-b-grain", 1 - p * 0.5); }
  g += `<path class="pu-b-wl" d="M${f1(bx + 2)} ${f1(wl)}H${f1(bx + bw - 2)}"/>`;
  return { svg: g, pts: { boom: [lerp(qx, apx, 0.5), lerp(boomY + 4, boomY - 4, 0.5)], chute: [apx + 3, (boomY + cb) / 2], pile: [apx + 6, keel - 8 - ph * 0.5], wl: [hx + half + 2, wl], ped: [qx, boomY + 30] } };
}

// ---------------------------------------------------------------- lámina
export async function createPuerto() {
  const root = document.createElement("div");
  root.className = "pu-plate";
  root.style.cssText = `position:absolute;left:${VIEW[0]}px;top:${VIEW[1]}px;width:${VIEW[2]}px;height:${VIEW[3]}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "pu-svg", role: "group", tabindex: "0",
    "aria-label": "Puerto: el concentrado llega de los espesadores por el mineroducto, se filtra, se acopia en el galpón y una correa cubierta lo lleva al cargador, que llena las bodegas del barco. Espacio pausa; coma y punto cambian de paso; 1 a 5 eligen un equipo." }, root);
  const defs = el("defs", {}, svg);
  const geo = await import("./puerto-geo.js").catch(() => ({ SIL: "" }));
  el("path", { d: geo.SIL, class: "pu-sil" }, svg);
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
  B46g.int.innerHTML = hallSvg(B46); B54g.int.innerHTML = hallSvg(B54);
  const in46 = el("g", {}, B46g.int), in54 = el("g", {}, B54g.int);
  // ---- cargador de barcos (sobre todo lo del muelle)
  const gLoader = el("g", { "data-eq": "embarque" }, svg);
  const gFx = el("g", { class: "pu-fx" }, svg);

  // ---- capa superior: etiquetas, recorrido, detalle
  const topG = el("g", { class: "pu-top" }, svg);
  const lab = el("g", { class: "pu-labels" }, topG);
  const LB = (p, t, a = "start", cls = "pu-small") => { const e = el("text", { x: f1(p[0]), y: f1(p[1]), class: cls, "text-anchor": a }, lab); e.textContent = t; return e; };
  LB(v3.add(W(-235, -515, 2), [0, 11]), "mineroducto ≈ 170 km", "middle");
  LB(v3.add(W(PUMP.e0, PUMP.n0, 0), [-3, 6]), "bombas", "end");
  LB(v3.add(W(-150, -521, 0), [-2, 8]), "estación terminal", "middle");
  LB(v3.add(TP(TH.big, TH.big.R, -Math.PI * 0.25), [6, 6]), "rebalse: agua clara a reúso", "start");
  LB([4897, 622], "torre de transferencia · muestreo", "start");
  const tmlTag = LB([0, 0], "", "middle", "pu-warn");
  const tourG = el("g", { class: "pu-tour" }, topG);
  const tourRing = el("circle", { r: 5, class: "pu-tour-ring" }, tourG), tourDot = el("circle", { r: 1.9, class: "pu-tour-dot" }, tourG);
  const tourPulse = el("circle", { r: 8, class: "pu-tour-pulse" }, topG);
  const CAL = { A: [4342, 425, 250, 150], B: [4612, 425, 250, 150] };
  const calG = el("g", { class: "pu-callouts" }, topG), cardG = el("g", { class: "pu-callout" }, calG);
  CAL.lead = el("path", { class: "pu-lead" }, cardG); CAL.leadDot = el("circle", { r: 2.2, class: "pu-lead-dot" }, cardG);
  CAL.rect = el("rect", { rx: 7, class: "pu-card" }, cardG);
  const cclipR = el("rect", { rx: 6 }, el("clipPath", { id: "pu-cal" }, defs));
  CAL.body = el("g", { "clip-path": "url(#pu-cal)" }, cardG); CAL.title = el("text", { class: "pu-cal-title" }, cardG); CAL.labels = el("g", {}, cardG); CAL.g = cardG;
  const tagsG = el("g", { class: "pu-tags" }, topG);
  const TAGS = { espesadores: ["Espesadores", TP(TH.big, 0, 0, 14)], mineroducto: ["Mineroducto", W(-235, -515, 8)], filtros: ["Planta de filtros", W((B46.e0 + B46.e1) / 2, (B46.n0 + B46.n1) / 2, B46.H + 16)], galpon: ["Galpón de acopio", W((B54.e0 + B54.e1) / 2, (B54.n0 + B54.n1) / 2, B54.H + 6)], embarque: ["Cargador de barcos", null] };
  const tagEls = {};
  for (const [id, [label]] of Object.entries(TAGS)) {
    const g = el("g", { class: "pu-tag" }, tagsG);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -12, class: "pu-tag-line" }, g);
    const ww = label.length * 3.7 + 12; el("rect", { x: -ww / 2, y: -23, width: ww, height: 11, rx: 5.5, class: "pu-tag-pill" }, g);
    el("text", { x: 0, y: -15.6, class: "pu-tag-text", "text-anchor": "middle" }, g).textContent = label; tagEls[id] = g;
  }
  const units = [[gEsp, "espesadores"], [gPipe, "mineroducto"], [gShipW, "embarque"], [gLoader, "embarque"], ...[...gPort.children].map((c) => [c, c.dataset.eq ?? ""])];

  // ------------------------------------------------------------ estado
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const ST = { t: 0, flow: 0, h: 8.5, plant: 0, belt: 0, ship: 0.3 };
  const shown = { plant: 0, belt: 0 };
  let selected = null, playing = !still.matches, active = false, raf = 0, last = 0, sliderDetail = null;
  if (still.matches) ST.t = STEPS[2].t0 + 6;
  function step(dt) { ST.flow += dt; ST.t = (ST.t + dt) % PERIOD; const m = model(ST.h); if (m.ok) ST.ship = (ST.ship + (dt * m.rate) / 1575 / (3 * PERIOD)) % 1; }
  const live = () => { const m = model(ST.h); return { t: ST.t, m, step: stepAt(ST.t), press: pressAt(ST.t), fel: loaderAt(ST.t), ship: shipAt(ST.ship) }; };
  const detailNow = () => (selected ? (selected === "filtros" || selected === "galpon" ? "A" : selected === "embarque" ? "B" : null) : sliderDetail);
  let loaderNow = null;

  function draw() {
    const s = live(), m = s.m, fl = ST.flow, sh = s.ship;
    // ---- espesadores
    wBig.innerHTML = thickSvg(TH.big, fl * 0.25, fl, true) + launderFlow(TH.big, fl);
    wSmall.innerHTML = thickSvg(TH.small, -fl * 0.35, fl, false);
    // ---- cañerías: descarga de los espesadores, bombas, mineroducto con corte, estación terminal
    {
      let g = pipeSvg(PIPE_S, "pu-pipe--pulp") + pipeSvg(PIPE_B, "pu-pipe--pulp") + pipeSvg(MINERO, "pu-pipe--minero");
      g += flowSvg(PIPE_S, "pu-flow--pulp", -fl * 7) + flowSvg(PIPE_B, "pu-flow--pulp", -fl * 7) + flowSvg(MINERO, "pu-flow--pulp", -fl * 9);
      g += boxSvg(PUMP.e0, PUMP.e1, PUMP.n0, PUMP.n1, 0, 8, "pu-pump");
      for (let k = 0; k < 3; k++) g += cylA([PUMP.e0 + 4 + k * 6, PUMP.n0 - 3, 0], [0, 1, 0], 3, 1.6, 1.6, "pu-pumpcyl");
      g += boxSvg(-156, -144, -521, -509, 0, 6, "pu-pump pu-pump--term");
      const a = W(BREAK_E - 5, -515, 1.5), b = W(BREAK_E + 5, -515, 1.5);
      g += line([v3.add(a, [-2, 5]), v3.add(a, [2, -5])], "pu-break") + line([v3.add(b, [-2, 5]), v3.add(b, [2, -5])], "pu-break");
      gPipe.innerHTML = g;
    }
    // ---- naves: muros recortados a la altura del corte, techos que suben y se desvanecen
    for (const [b, gg, sv] of [[B46, B46g, shown.plant], [B54, B54g, shown.plant]]) {
      const zc = lerp(b.H + (b.ridge || 0) + 6, 7, smooth(sv));
      gg.cp.setAttribute("d", D(cutPoly(b, -6, zc).map((p) => toL(REG.port, p)), true, f2));
      gg.roof.setAttribute("transform", `translate(${REG.port[0]} ${f2(REG.port[1] - 34 * smooth(sv))}) scale(${S})`);
      gg.roof.style.opacity = f2(1 - smooth(sv * 1.6));
      gg.int.style.display = sv > 0.01 ? "" : "none";
    }
    if (shown.plant > 0.01) { in46.innerHTML = pressSvg(s.press, fl, m.h) + pipeSvg(MINERO_IN, "pu-pipe--minero") + flowSvg(MINERO_IN, "pu-flow--pulp", -fl * 9); in54.innerHTML = pileSvg(B54, s.fel, fl); }
    // ---- correa: galería (cubierta que se levanta), caballete abierto
    {
      const bz = 0.4, ok = m.ok ? 1 : 0.25, off = -fl * 12 * (m.rate / 1575);
      const strip = (n0, n1) => poly([W(-BELT.w, n0, bz), W(BELT.w, n0, bz), W(BELT.w, n1, bz), W(-BELT.w, n1, bz)], "pu-beltband");
      L.belt.innerHTML = shown.belt > 0.01 ? strip(BELT.g0, BELT.g1) + `<g style="opacity:${f2(ok)}">${flowSvg([[0, BELT.g0, bz + 0.3], [0, BELT.g1, bz + 0.3]], "pu-flow--belt", off)}</g>` : "";
      L.trestle.innerHTML = strip(BELT.g1, BELT.n1 - 3) + `<g style="opacity:${f2(ok)}">${flowSvg([[0, BELT.g1, bz + 0.3], [0, BELT.n1 - 3, bz + 0.3]], "pu-flow--belt", off)}</g>`;
      covers.forEach((c) => (c.style.opacity = f2(1 - 0.92 * smooth(shown.belt))));
    }
    // ---- barco: se hunde un poco al cargarse; escotillas y bodegas
    const dy = 2.6 * sh.load;
    shipArt.setAttribute("transform", `translate(${REG.ship[0]} ${f2(REG.ship[1] + dy)}) scale(${S})`);
    const hatches = hatchGeo(dy);
    let hg = ""; hatches.forEach((c, i) => { const r = holdSvg(c, sh.lv[i], sh.oc, `pu-hold-${i}`); holdClips[i].setAttribute("d", D(r.open, true, f2)); hg += r.svg; });
    gHolds.innerHTML = hg;
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
      gLoader.innerHTML = g;
      // chorro desde el chute hasta la pila (recortado a la escotilla)
      let fx = "";
      if (sh.pour && m.ok && sh.oc > 0.5) { const c = hatches[sh.to], lv = sh.lv[sh.to], zp = ZH - HOLD + 3 + lv * (HOLD + 2);
        let st = ""; for (let j = 0; j < 9; j++) { const p = mod(fl * 2 + j / 9, 1); st += circ(W(tgt[0] + (hash(j) - 0.5) * 2, c[1] + (hash(j * 3) - 0.5) * 2, lerp(ZH - 3, zp, p)), 0.85, "pu-grain", 1 - p * 0.4); }
        fx += `<g clip-path="url(#pu-hold-${sh.to})">${st}</g>`;
        for (let j = 0; j < 3; j++) { const p = mod(fl * 0.5 + j / 3, 1); fx += circ(W(tgt[0] + 2, c[1] - 6, ZH + 1 + p * 5), 1.2 + p * 2, "pu-dust", (1 - p) * 0.35); } }
      gFx.innerHTML = fx;
      tmlTag.textContent = m.ok ? "" : `Humedad ${fdec(m.h, 1)} % > TML ${TML} %: embarque detenido`;
      const tp = W(LOADER.e + 6, LOADER.n + 30, LOADER.head + 18); tmlTag.setAttribute("x", f1(tp[0])); tmlTag.setAttribute("y", f1(tp[1]));
    }
    lab.style.opacity = 1;
    // ---- detalles
    const det = detailNow();
    CAL.g.style.display = det ? "" : "none";
    if (det) {
      const box = CAL[det], [bx, by, bw, bh] = box;
      CAL.rect.setAttribute("x", bx); CAL.rect.setAttribute("y", by); CAL.rect.setAttribute("width", bw); CAL.rect.setAttribute("height", bh);
      cclipR.setAttribute("x", bx + 0.6); cclipR.setAttribute("y", by + 13); cclipR.setAttribute("width", bw - 1.2); cclipR.setAttribute("height", bh - 13.6);
      CAL.title.setAttribute("x", bx + 8); CAL.title.setAttribute("y", by + 9.5);
      const at = det === "A" ? W(PRESS.e, (PRESS.n0 + PRESS.n1) / 2, PRESS.z1) : P3(loaderNow.head);
      CAL.leadDot.setAttribute("cx", f1(at[0])); CAL.leadDot.setAttribute("cy", f1(at[1]));
      const e0 = [bx + bw * 0.5, by + bh];
      CAL.lead.setAttribute("d", `M${f1(e0[0])} ${f1(e0[1])}C${f1(e0[0])} ${f1(e0[1] + 40)} ${f1(at[0])} ${f1(at[1] - 50)} ${f1(at[0])} ${f1(at[1])}`);
      const T1 = by + 22, B1 = by + bh - 5;
      if (det === "A") { const r = detailA(box, s, m, fl); CAL.title.textContent = "Detalle · Filtro prensa en corte"; CAL.body.innerHTML = r.svg;
        CAL.labels.innerHTML = lbl(r.pts.feed, [bx + 8, T1], `Pulpa ~${m.solids} % sólidos`, "start") + lbl(r.pts.plate, [bx + bw - 7, T1], "Placas con telas filtrantes", "end") +
          lbl(r.pts.belt, [bx + 8, B1], `Queque ~${fdec(m.h, 1)} % humedad → galpón`, "start") + lbl(r.pts.water, [bx + bw - 7, B1], "Agua filtrada → tratamiento", "end"); }
      else { const r = detailB(box, s, m, fl); CAL.title.textContent = "Detalle · Cargador y bodega en corte"; CAL.body.innerHTML = r.svg;
        CAL.labels.innerHTML = lbl(r.pts.boom, [bx + 8, T1], `Correa del brazo · ${fdec(m.rate)} t/h`, "start") + lbl(r.pts.chute, [bx + bw - 7, T1], "Chute telescópico: carga sin polvo", "end") +
          lbl(r.pts.ped, [bx + 8, B1], m.ok ? `Humedad ${fdec(m.h, 1)} % ≤ TML ${TML} %` : `Humedad sobre el TML: no se embarca`, "start") + lbl(r.pts.pile, [bx + bw - 7, B1], `Bodega ${sh.to + 1}: ${Math.round(sh.lv[sh.to] * 100)} %`, "end"); }
    }
    drawTour(s);
    for (const id of ORDER) {
      const on = selected === id; tagEls[id].toggleAttribute("data-on", on);
      if (on) { const at = id === "embarque" ? P3(v3.add(loaderNow.root, [0, 0, 22])) : TAGS[id][1]; tagEls[id].setAttribute("transform", `translate(${f1(at[0])} ${f1(at[1])})`); }
    }
    listeners.forEach((fn) => fn(s, api));
  }
  function drawTour(s) {
    const t = s.t; let tp = null, inside = null;
    const along = (pts, u) => P3(polyline(pts).at(u * polyline(pts).len));
    if (t < 2) inside = TP(TH.small, 0, 0, 0);
    else if (t < 8) tp = along(PIPE_S, (t - 2) / 6);
    else if (t < 15) { const all = [...MINERO, ...MINERO_IN.slice(1)]; tp = along(all, (t - 8) / 7); if (shown.plant < 0.5 && (t - 8) / 7 > 0.83) { tp = null; inside = W(-128, -470, 2); } }
    else if (t < 21.2) { if (shown.plant > 0.5) tp = W(PRESS.e, lerp(PRESS.n0 + 6, PRESS.n1 - 6, (t - 15) / 6.2), (PRESS.z0 + PRESS.z1) / 2); else inside = W(PRESS.e, (PRESS.n0 + PRESS.n1) / 2, 10); }
    else if (t < 25) { const pts = [[PRESS.e, PRESS.n0 + 4, 8], [PRESS.e, PRESS.n0 + 4, 3], [PRESS.e, PRESS.n0 - 12, 3], [B46.e1 + 2, PRESS.n0 - 12, 3]]; if (shown.plant > 0.5) tp = along(pts, (t - 21.2) / 3.8); else inside = W(B46.e1, PRESS.n0 - 12, 6); }
    else if (t < 28) { if (shown.plant > 0.5) tp = W(PILE.e0 + 4, PILE.n, PILE.h + lerp(12, 0, (t - 25) / 3)); else inside = W(PILE.e0 + 10, PILE.n, 20); }
    else if (t < 32.3) { const ld = s.fel; if (shown.plant > 0.5) tp = W(ld.e + 6.5, HOPPER.n - 4, 1.5 + ld.bucket * 9 + 3); else inside = W(ld.e, HOPPER.n, 20); }
    else if (t < 35) { if (shown.plant > 0.5) tp = W(HOPPER.e, HOPPER.n, 10); else inside = W(HOPPER.e, HOPPER.n, 20); }
    else if (t < 44) { const u = (t - 35) / 9, n = lerp(BELT.n0, BELT.n1 - 2, u); if (n > BELT.g0 && n < BELT.g1 && shown.belt < 0.5) { inside = W(0, n, 5); } else tp = W(0, n, 1.5); }
    else if (t < 47.5) { const Lg = loaderNow; tp = P3(v3.lerp(Lg.root, Lg.head, (t - 44) / 3.5)); }
    else { const c = hatchGeo(2.6 * s.ship.load)[s.ship.to]; if (t < 50) tp = W(c[0], c[1], lerp(LOADER.head - 2, ZH - 6, (t - 47.5) / 2.5)); else inside = W(c[0], c[1], ZH - 4); }
    if (tp) { for (const n of [tourRing, tourDot]) { n.setAttribute("cx", f1(tp[0])); n.setAttribute("cy", f1(tp[1] - 1)); n.style.opacity = 1; } }
    else { tourRing.style.opacity = 0; tourDot.style.opacity = 0; }
    if (inside) { const ph = (performance.now() / 900) % 1; tourPulse.setAttribute("cx", f1(inside[0])); tourPulse.setAttribute("cy", f1(inside[1])); tourPulse.setAttribute("r", f1(4 + ph * 9)); tourPulse.style.opacity = (0.9 * (1 - ph)).toFixed(2); }
    else tourPulse.style.opacity = 0;
  }
  const lbl = (p, q, text, anchor) => {
    const w = text.length * 2.72, x0 = anchor === "end" ? q[0] - w : anchor === "middle" ? q[0] - w / 2 : q[0], x1 = x0 + w;
    const e = p[0] < x0 ? [x0 - 1.2, q[1] - 1.8] : p[0] > x1 ? [x1 + 1.2, q[1] - 1.8] : [p[0], p[1] < q[1] ? q[1] - 6 : q[1] + 2];
    return `<path class="pu-cal-lead" d="M${f1(p[0])} ${f1(p[1])}L${f1(e[0])} ${f1(e[1])}"/><circle class="pu-cal-dot" cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.3"/><text class="pu-cal-text" x="${f1(q[0])}" y="${f1(q[1])}" text-anchor="${anchor}">${text}</text>`;
  };

  // ------------------------------------------------------------ reloj
  const listeners = new Set();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) step(dt);
    const kk = 1 - Math.exp(-dt * 6);
    for (const key of ["plant", "belt"]) { shown[key] += (ST[key] - shown[key]) * kk; if (Math.abs(ST[key] - shown[key]) < 0.002) shown[key] = ST[key]; }
    draw(); raf = active ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; }, get playing() { return playing; }, get detail() { return detailNow(); },
    get plant() { return ST.plant; }, get belt() { return ST.belt; }, get h() { return ST.h; },
    live, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) kick(); else { cancelAnimationFrame(raf); raf = 0; } },
    play() { playing = true; kick(); }, pause() { playing = false; }, togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { ST.t = mod(v, PERIOD); draw(); },
    goStep(n) { api.seek(STEPS[clamp(n, 1, STEPS.length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(ST.t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(ST.t); api.goStep(ST.t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    setPlant(v, instant) { ST.plant = clamp(v); if (instant || still.matches) shown.plant = ST.plant; sliderDetail = ST.plant > 0 ? "A" : ST.belt > 0 ? "B" : null; draw(); },
    setBelt(v, instant) { ST.belt = clamp(v); if (instant || still.matches) shown.belt = ST.belt; sliderDetail = ST.belt > 0 ? "B" : ST.plant > 0 ? "A" : null; draw(); },
    setH(v) { ST.h = clamp(Math.round(v * 2) / 2, H_MIN, H_MAX); draw(); },
    setShip(v) { ST.ship = mod(v, 1); draw(); },
    select(id) { selected = id && EQUIP[id] ? id : null; root.toggleAttribute("data-sel", !!selected); units.forEach(([u, eq]) => u.classList.toggle("pu-dim", !!selected && eq !== selected)); draw(); },
    destroy() { api.setActive(false); listeners.clear(); root.remove(); },
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-eq]"); const id = g?.dataset.eq; api.select(id ? (selected === id ? null : id) : null); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); });
  draw();
  return api;
}

// ---------------------------------------------------------------- panel (HUD)
export function bindPanel(fx, { onEscape, onFocus } = {}) {
  const $ = (q) => document.querySelector(q);
  const playBtn = $("[data-pu-play]"), stepsBox = $("[data-pu-steps]");
  stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", fx.STEPS.length);
  const stepBtns = fx.STEPS.map((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n; b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
    b.addEventListener("click", () => fx.goStep(s.n)); stepsBox.appendChild(b); return b; });
  const info = $("[data-info]"), meter = $("[data-pu-meter]"), readout = $("[data-pu-readout]");
  const plS = $("[data-pu-plant]"), plO = $("[data-pu-plant-out]"), beS = $("[data-pu-belt]"), beO = $("[data-pu-belt-out]"), hS = $("[data-pu-h]"), hO = $("[data-pu-h-out]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = []; const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  function renderInfo(s) {
    const id = fx.selected;
    document.querySelectorAll("[data-pu-chip]").forEach((c) => c.toggleAttribute("data-on", c.dataset.puChip === id));
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
    const text = s.m.ok ? `Barco ${Math.round(s.ship.load * 100)} % · ${fdec(s.ship.load * 50, 1)} de 50 kt · ${fdec(s.m.rate)} t/h` : `Humedad ${fdec(s.m.h, 1)} % sobre el TML · embarque detenido`;
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(fx.playing)); playBtn.setAttribute("aria-label", fx.playing ? "Pausar" : "Reproducir");
    renderInfo(s);
  }));
  const sync = () => { plS.value = Math.round(fx.plant * 100); plO.textContent = `${plS.value} %`; beS.value = Math.round(fx.belt * 100); beO.textContent = `${beS.value} %`; hS.value = fx.h; hO.textContent = `${fdec(fx.h, 1)} %`; };
  on(plS, "input", () => { fx.setPlant(plS.value / 100); plO.textContent = `${plS.value} %`; onFocus?.("A", plS.value > 0 || fx.belt > 0); });
  on(beS, "input", () => { fx.setBelt(beS.value / 100); beO.textContent = `${beS.value} %`; onFocus?.("B", beS.value > 0 || fx.plant > 0); });
  on(hS, "input", () => { fx.setH(Number(hS.value)); hO.textContent = `${fdec(fx.h, 1)} %`; });
  on(playBtn, "click", () => fx.togglePlay());
  on($("[data-pu-prev]"), "click", () => fx.prevStep()); on($("[data-pu-next]"), "click", () => fx.nextStep());
  document.querySelectorAll("[data-pu-chip]").forEach((c) => on(c, "click", () => fx.select(fx.selected === c.dataset.puChip ? null : c.dataset.puChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "pu") fx.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "puerto" || e.target.closest?.("input, [data-intro]")) return;
    if (e.key === " " && !e.target.closest("button")) fx.togglePlay();
    else if (e.key === ",") fx.prevStep(); else if (e.key === ".") fx.nextStep();
    else if (/^[1-5]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; fx.select(fx.selected === id ? null : id); }
    else if (e.key === "ArrowRight") { fx.setPlant(fx.plant + 0.1); sync(); onFocus?.("A", fx.plant > 0); }
    else if (e.key === "ArrowLeft") { fx.setPlant(fx.plant - 0.1); sync(); onFocus?.("A", fx.plant > 0); }
    else if (e.key === "ArrowUp") { fx.setBelt(fx.belt + 0.1); sync(); onFocus?.("B", fx.belt > 0); }
    else if (e.key === "ArrowDown") { fx.setBelt(fx.belt - 0.1); sync(); onFocus?.("B", fx.belt > 0); }
    else if (e.key === "Escape") { if (fx.selected) fx.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  sync(); fx.seek(fx.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "pu") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const ZOOM = { espesadores: [4185, 500, 300, 230], mineroducto: [4190, 560, 300, 260], filtros: [4335, 420, 330, 420], galpon: [4335, 420, 330, 420], embarque: [4600, 420, 520, 300], A: [4335, 420, 330, 420], B: [4600, 420, 520, 300] };
export async function mount({ layer, focus }) {
  const fx = await createPuerto();
  layer.appendChild(fx.el);
  requestAnimationFrame(() => fx.el.setAttribute("data-in", ""));
  let focused = null;
  const want = (z, cap) => { const kz = z ? JSON.stringify(z) : ""; if (kz !== focused) { focused = kz; focus?.(z, cap); } };
  const unbind = bindPanel(fx, { onEscape: () => { location.hash = ""; }, onFocus: (which, on) => want(on ? ZOOM[which] : null, 3.2) });
  const unzoom = fx.on(() => { if (fx.selected) want(ZOOM[fx.selected], 3); else if (fx.detail) want(ZOOM[fx.detail], 3.2); else want(null); });
  fx.setActive(true);
  window.pmPu = fx;
  return { focus: [VIEW[0] + 10, VIEW[1] + 10, VIEW[2] - 20, VIEW[3] - 20], view: "puerto",
    destroy: () => { unzoom(); unbind(); fx.destroy(); if (window.pmPu === fx) delete window.pmPu; } };
}
