// Estación 3 · Pilas de lixiviación — lámina viva sobre el dibujo de Emilio
// (assets/pilas/aglomerador.svg y apiladoras.svg; las pilas, las canaletas en arco y las franjas salen del PDF
// de la infografía, ×2).
//
// Lógica de la skill anatomy: un modelo manda y el dibujo lo sigue. El tambor aglomerador trabaja siempre; la
// correa lleva los glómeros a la casa de traspaso y un desviador los manda al módulo que se está apilando (pila
// de la izquierda) o sigue hacia otros módulos. El módulo recorre su ciclo de pila dinámica: se apila (la apiladora
// retrocede por la correa y su pluma telescópica reparte el mineral de lado a lado), se riega con solución ácida,
// la solución percola y sale como PLS por la carpeta hacia las canaletas, y al final la rotopala retira los ripios.
// Las otras tres pilas están en riego (estado estable). Dos cortes: "Interior del aglomerador" (una ventana en el
// manto del tambor + detalle A con la vista hacia adentro, como la referencia) y "Corte de la pila" (un plano corta la
// pila de la derecha + detalle B con la percolación).
//
// Geometría (px de la infografía): isométrica de la infografía, X → (0,8615 ; 0,5085), Y → (−0,8615 ; 0,5085),
// Z → (0 ; −1), ajustada a las losas de las pilas del PDF (140 × 80, losa de 6). Origen: esquina izquierda de la pila
// de la izquierda, a nivel del suelo. El tambor se dibuja en las unidades de su SVG (isometría 0,866 / 0,5).
import { ARCS, STRIPS, SIL } from "./pilas-geo.js";

const NS = "http://www.w3.org/2000/svg";
const A_AGLO = new URL("../../assets/pilas/aglomerador.svg", import.meta.url).href;
const A_API = new URL("../../assets/pilas/apiladoras.svg", import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const fmt = (n) => Math.round(n).toLocaleString("es-CL");
const fdec = (n, d = 1) => n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const mul = (p, k) => [p[0] * k, p[1] * k];
const D = (pts, close = true) => "M" + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join("L") + (close ? "Z" : "");

// ---------------------------------------------------------------- registro e isometría
export const VIEW = [2150, 220, 850, 540];                             // la lámina vive en px de la infografía
const AG = { tx: 2229.32, ty: 524.82, s: 0.57346 };                    // aglomerador.svg → infografía
const AP = { tx: 2313.07, ty: 357.41, s: 0.57299 };                    // apiladoras.svg → infografía
const EX = [0.8615, 0.5085], EY = [-0.8615, 0.5085];
const O = [2371.3, 389.0];
const W = (x, y, z = 0) => [O[0] + EX[0] * (x - y), O[1] + EX[1] * (x + y) - z];
const apP = ([x, y]) => [AP.tx + AP.s * x, AP.ty + AP.s * y];

// pilas (esquina izquierda de cada losa, en mundo) · losa 140 × 80 × 6
const PAD = { L: 140, B: 80, T: 6 };
const PADS = { tl: [0, 0], t: [-0.8, -115.8], b: [175.7, -0.95], r: [174.2, -119.9] };
const HEAP = { x0: 12, x1: 128, y0: 2, y1: 78, h: 6, k: 1.5 };        // relativo a la losa: base y altura
const heapBase = (id) => { const [px, py] = PADS[id]; return { xa: px + (id === "tl" ? 26 : HEAP.x0), xb: px + HEAP.x1, ya: py - HEAP.y1, yb: py - HEAP.y0, z0: PAD.T }; };

// correas (eje de la banda, en px de la infografía, desde apiladoras.svg)
const BELT4 = [apP([9.6, 385.5]), apP([331.2, 195.4])];               // del tambor a la casa de traspaso
const BELT2 = [apP([325.5, 203.4]), apP([80.9, 59.6])];               // casa de traspaso → módulo izquierdo
const BELT5 = [apP([328.7, 197.3]), apP([646.7, 5.8])];               // casa de traspaso → otros módulos
const JUNCTION = apP([324, 200]);
// apiladora izquierda (grupo 0.6): cara superior de la pluma corta A–B–C–D; z = 20 sobre el suelo
const BOOM = { A: apP([155.05, 74.2]), B: apP([183.14, 57.11]), C: apP([198.61, 65.56]), D: apP([170.78, 81.62]), z: 20, x: 52.7, y: -6.3 };
BOOM.root = mul(add(BOOM.A, BOOM.D), 0.5); BOOM.tip = mul(add(BOOM.B, BOOM.C), 0.5);
BOOM.trip = [BOOM.root[0], BOOM.root[1] + 17.2];                       // bajo la pluma, sobre la banda (tripper)
const DIR_Y = [-EY[0], -EY[1]];                                        // −Y en pantalla (hacia la pila)

function seg([a, b]) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]); return { a, b, len, at: (s) => [lerp(a[0], b[0], s / len), lerp(a[1], b[1], s / len)], u: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] }; }
const S4 = seg(BELT4), S2 = seg(BELT2), S5 = seg(BELT5);

// ---------------------------------------------------------------- modelo y secuencia
export const PERIOD = 60;
const V = 32;                                                          // px/s de las correas (constante)
const T = {
  divOn: 12.6, divOff: 33.5,                                           // el desviador manda al módulo izquierdo
  stack: [17, 35],                                                     // la apiladora forma la pila
  riego: [36, 50], perc: [42, 51], pls: [45, 54],                      // riego, frente de percolación, PLS
  ripios: [51, 60], back: [0, 14],                                     // rotopala: retira ripios · vuelve
  boomBack: [37, 50],                                                  // la apiladora vuelve al extremo lejano
};
export const STEPS = [
  { n: 1, id: "aglomerador", label: "En el tambor, el agua y el ácido aglomeran y curan el mineral", t0: 0 },
  { n: 2, id: "correas", label: "La correa lleva los glómeros a la casa de traspaso", t0: 9 },
  { n: 3, id: "apiladora", label: "La apiladora forma la pila mientras retrocede", t0: 20 },
  { n: 4, id: "solucion", label: "Los goteros riegan la pila con solución ácida", t0: 36 },
  { n: 5, id: "solucion", label: "La solución percola, disuelve el cobre y sale como PLS", t0: 44 },
  { n: 6, id: "pilas", label: "La rotopala retira los ripios y el módulo queda libre", t0: 51 },
].map((s, i, a) => ({ ...s, t1: i + 1 < a.length ? a[i + 1].t0 : PERIOD }));
const stepAt = (t) => STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1];
const phase = (t, [a, b]) => clamp((t - a) / (b - a));
const RATE_MIN = 6, RATE_MAX = 14;                                     // L/h·m² de riego
const AREA = 180000;                                                   // m² bajo riego (referencial)
const OMEGA = 0.8;                                                     // rad/s del tambor (visual)
const diverted = (tau) => { const t = ((tau % PERIOD) + PERIOD) % PERIOD; return t >= T.divOn && t < T.divOff; };

// estado del módulo izquierdo en el instante t
function moduleAt(t) {
  const b = heapBase("tl");
  if (t < T.stack[0]) return { stage: "vacío", xa: b.xa, xb: b.xa, h: 0, fill: 0, wet: 0, perc: 0, pls: 0 };
  if (t < T.stack[1]) { const u = phase(t, [T.stack[0] + 0.6, T.stack[1]]); const xb = lerp(b.xa + 18, b.xb, u);
    return { stage: "apilando", xa: b.xa, xb, h: HEAP.h * smooth((t - T.stack[0]) / 1.4), fill: (xb - b.xa) / (b.xb - b.xa), wet: 0, perc: 0, pls: 0 }; }
  const wet = smooth(phase(t, [T.riego[0], T.riego[0] + 5])) * (1 - smooth(phase(t, [T.riego[1], T.riego[1] + 3])) * 0.6);
  const perc = smooth(phase(t, T.perc));
  const pls = smooth(phase(t, [T.pls[0], T.pls[0] + 2])) * (1 - smooth(phase(t, [T.ripios[0] + 1, T.pls[1]])));
  if (t < T.ripios[0]) return { stage: t < T.riego[0] ? "lista" : t < T.riego[1] ? "en riego" : "drenando", xa: b.xa, xb: b.xb, h: HEAP.h, fill: 1, wet, perc, pls };
  const xa = lerp(b.xa, b.xb, smooth(phase(t, [T.ripios[0] + 0.8, T.ripios[1] - 0.3])));
  return { stage: "retirando ripios", xa, xb: b.xb, h: xa >= b.xb - 0.5 ? 0 : HEAP.h, fill: (b.xb - xa) / (b.xb - b.xa), wet: wet * 0.6, perc, pls };
}
// posición de la pluma (x en mundo) y extensión telescópica (0…64) de la apiladora izquierda
function stackerAt(t) {
  const xPark = 35;
  let x = xPark, ext = 0, feeding = false;
  if (t >= T.stack[0] && t < T.boomBack[0]) {
    const m = moduleAt(Math.min(t, T.stack[1] - 0.01)); x = clamp(m.xb - 9, xPark, 119);
    if (t < T.stack[1] + 0.2) { feeding = true; ext = lerp(6, 63, 0.5 - 0.5 * Math.cos(((t - T.stack[0]) / 3.4) * Math.PI * 2)); }
    ext *= 1 - smooth(phase(t, [T.stack[1] - 0.3, T.stack[1] + 0.6]));
  } else if (t >= T.boomBack[0] && t < T.boomBack[1]) x = lerp(119, xPark, smooth(phase(t, T.boomBack)));
  return { x, dx: x - BOOM.x, ext, feeding };
}
// rotopala: centro de la rueda (x en mundo), giro de la pluma y si está excavando
function rotoAt(t) {
  const b = heapBase("tl"), park = b.xa - 7;
  if (t >= T.ripios[0]) { const m = moduleAt(t); const dig = m.h > 0; return { x: dig ? m.xa - 1 : b.xb + 2, slew: dig ? Math.sin((t - T.ripios[0]) * 2.2) : 0, dig, wheel: dig }; }
  if (t < T.back[1]) return { x: lerp(b.xb + 2, park, smooth(phase(t, [T.back[0] + 1, T.back[1]]))), slew: 0, dig: false, wheel: false };
  return { x: park, slew: 0, dig: false, wheel: false };
}

// ---------------------------------------------------------------- fichas
const cuOf = (rate) => 3.0 * Math.pow(10 / rate, 0.7);
const EQUIP = {
  aglomerador: { kicker: "Aglomeración y curado", title: "Tambor aglomerador", text: "Tambor rotatorio levemente inclinado. Los levantadores suben el mineral y lo dejan caer en cascada mientras una barra de riego agrega agua y ácido sulfúrico: los finos se pegan a las partículas gruesas (glómeros) y el ácido empieza a atacar el cobre (curado).",
    specs: () => ["Barra de riego: agua + H₂SO₄", "Ácido ~10–25 kg/t (típico)", "Giro ~6–10 rpm (típico)"] },
  correas: { kicker: "Transporte", title: "Correas de traslado", text: "Reciben los glómeros del tambor y los llevan a la casa de traspaso. Allí un desviador los manda al módulo que se está apilando o los deja seguir hacia otros módulos.",
    specs: (s) => [`Destino: ${s.div ? "módulo en apilamiento" : "otros módulos"}`, "Velocidad constante", "Operación continua"] },
  apiladora: { kicker: "Apilamiento", title: "Apiladora sobre correa", text: "Un carro (tripper) recorre la correa a lo largo del módulo y desvía el mineral a una pluma telescópica que lo reparte de lado a lado. La pila crece mientras la apiladora retrocede por la correa, alejándose del frente ya apilado.",
    specs: (s) => [s.mod.stage === "apilando" ? `Módulo ${Math.round(s.mod.fill * 100)} % apilado` : "En espera", "Pluma telescópica", "Avance por la correa"] },
  pilas: { kicker: "Lixiviación", title: "Pilas dinámicas", text: "Sobre una carpeta impermeable se apila el mineral curado y se riega durante semanas. Al terminar el ciclo, una rotopala retira los ripios (mineral agotado) y el módulo se vuelve a cargar.",
    specs: (s) => [`Módulo izquierdo: ${s.mod.stage}`, "Ciclo de semanas (acelerado)", "Carpeta HDPE + drenes"] },
  solucion: { kicker: "Solución", title: "Riego y PLS", text: "Los goteros reparten refino ácido sobre la pila. La solución percola entre los glómeros, disuelve el cobre y llega a la carpeta como PLS (solución rica), que las canaletas llevan a la piscina y a extracción por solventes.",
    specs: (s) => [`Riego ${fdec(s.rate, 0)} L/h·m²`, `PLS ~${fdec(s.cu)} g/L Cu`, `Caudal ~${fmt(s.flow)} m³/h`] },
};
const ORDER = ["aglomerador", "correas", "apiladora", "pilas", "solucion"];

// ---------------------------------------------------------------- utilidades SVG
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
const ROCK = ["M-1.6 -.6L-.3 -1.7L1.4 -1.1L1.7 .6L.1 1.6L-1.4 1Z", "M-1.3 -1.2L1 -1.4L1.6 .4L.2 1.4L-1.6 .6Z", "M-1.7 0L-.7 -1.5L1.2 -1.4L1.4 1L-.6 1.4Z"];
const pool = (parent, n, cls, glom) => Array.from({ length: n }, (_, i) => glom ? el("circle", { r: 1, class: cls }, parent) : el("path", { d: ROCK[i % 3], class: cls }, parent));
const put = (r, p, sc, rot = 0, o = 1) => { if (!p || o <= 0.01) { r.style.opacity = 0; return; } r.setAttribute("transform", `translate(${f1(p[0])} ${f1(p[1])}) rotate(${Math.round(rot)}) scale(${f1(sc)})`); r.style.opacity = o.toFixed(2); };

// ---------------------------------------------------------------- pilas (strings SVG)
const padSvg = (id, cutX = Infinity) => {
  const [px, py] = PADS[id], x1 = Math.min(px + PAD.L, cutX), y0 = py - PAD.B, t = PAD.T;
  let s = `<path class="lx-slab" d="${D([W(px, py, 0), W(x1, py, 0), W(x1, py, t), W(px, py, t)])}"/>`;
  if (cutX >= px + PAD.L) s += `<path class="lx-slab" d="${D([W(x1, py, 0), W(x1, y0, 0), W(x1, y0, t), W(x1, py, t)])}"/>`;
  else s += `<path class="lx-sec" d="${D([W(x1, py, 0), W(x1, y0, 0), W(x1, y0, t), W(x1, py, t)])}"/><path class="lx-liner" d="${D([W(x1, y0, t), W(x1, py, t)], false)}"/>` +
    `<path class="lx-gravel" d="${D([W(x1, y0 + 2, t - 1.6), W(x1, py - 2, t - 1.6)], false)}"/>`;
  s += `<path class="lx-padtop" d="${D([W(px, py, t), W(x1, py, t), W(x1, y0, t), W(px, y0, t)])}"/>`;
  return s;
};
// pila como tronco de pirámide (caras visibles: frente +Y, lado +X y techo); cutX corta la pila con un plano x = cutX
function heapGeom(b, xa, xb, h, cutX = Infinity) {
  const k = HEAP.k; h = Math.min(h, (xb - xa) / (2 * k)); if (h <= 0.05) return null;
  const z0 = b.z0, z1 = z0 + h, kh = k * h, xr = Math.min(xb, cutX), xt1 = Math.min(xb - kh, cutX);
  const hAt = (x) => clamp(Math.min(x - xa, xb - x) / k, 0, h);
  const g = { h, z1, xa, xb, kh, xr, xt1, b };
  g.top = xt1 > xa + kh ? [W(xa + kh, b.yb - kh, z1), W(xt1, b.yb - kh, z1), W(xt1, b.ya + kh, z1), W(xa + kh, b.ya + kh, z1)] : null;
  if (cutX >= xb) {
    g.front = [W(xa, b.yb, z0), W(xb, b.yb, z0), W(xb - kh, b.yb - kh, z1), W(xa + kh, b.yb - kh, z1)];
    g.side = [W(xb, b.yb, z0), W(xb, b.ya, z0), W(xb - kh, b.ya + kh, z1), W(xb - kh, b.yb - kh, z1)];
  } else {
    const hc = hAt(cutX), kc = k * hc;
    g.front = [W(xa, b.yb, z0), W(cutX, b.yb, z0), W(cutX, b.yb - kc, z0 + hc), W(xa + kh, b.yb - kh, z1)];
    g.sec = [W(cutX, b.yb, z0), W(cutX, b.ya, z0), W(cutX, b.ya + kc, z0 + hc), W(cutX, b.yb - kc, z0 + hc)];
    g.hc = hc;
  }
  return g;
}
function heapSvg(g, o = {}) {
  if (!g) return "";
  const { wet = 0, perc = 0, pls = 0, drip = false, active = 0, t = 0 } = o;
  let s = `<path class="lx-heap-f" d="${D(g.front)}"/>`;
  if (g.side) s += `<path class="lx-heap-s" d="${D(g.side)}"/>`;
  if (g.top) s += `<path class="lx-heap-t" d="${D(g.top)}"/>`;
  // frente de percolación: la solución baja por la pila (se tiñe desde el techo hacia la base)
  if (perc > 0.01) {
    const b = g.b, z1 = g.z1, kh = g.kh, zf = z1 - g.h * perc, kf = kh * (1 - perc);
    const xR = g.side ? g.xb : g.xr;
    s += `<path class="lx-wet" style="opacity:${f1(0.5 * Math.min(1, perc * 1.6))}" d="${D([W(g.xa + kh, b.yb - kh, z1), W(Math.min(g.xb - kh, xR), b.yb - kh, z1), W(Math.min(g.xb - kf, xR), b.yb - kf, zf), W(g.xa + kf, b.yb - kf, zf)])}"/>`;
    if (g.side) s += `<path class="lx-wet" style="opacity:${f1(0.5 * Math.min(1, perc * 1.6))}" d="${D([W(g.xb - kh, b.yb - kh, z1), W(g.xb - kh, b.ya + kh, z1), W(g.xb - kf, b.ya + kf, zf), W(g.xb - kf, b.yb - kf, zf)])}"/>`;
  }
  if (g.top && wet > 0.01) s += `<path class="lx-wet" style="opacity:${f1(wet * 0.55)}" d="${D(g.top)}"/>`;
  // líneas de goteo sobre el techo (a lo largo de X)
  if (g.top && drip) {
    const b = g.b, x0 = g.xa + g.kh + 2, x1 = g.xt1 - 2, z = g.z1;
    for (const f of [0.2, 0.5, 0.8]) {
      const y = lerp(b.yb - g.kh, b.ya + g.kh, f);
      s += `<path class="lx-drip" d="${D([W(x0, y, z), W(x1, y, z)], false)}"/>`;
      if (active > 0.01) for (let x = x0 + 3; x < x1; x += 7) {
        const ph = (t * 1.3 + hash(x * 3.1 + f * 17)) % 1;
        const p = W(x, y, z);
        s += `<circle class="lx-drop" cx="${f1(p[0])}" cy="${f1(p[1] + ph * 1.6)}" r="${f1(0.55 + 0.25 * (1 - ph))}" style="opacity:${f1(active * (1 - ph))}"/>`;
      }
    }
  }
  // PLS que asoma en el pie de la pila (frente +Y) y escurre por la carpeta
  if (pls > 0.01) { const b = g.b; s += `<path class="lx-pls-toe" style="opacity:${f1(pls)}" d="${D([W(g.xa + 1, b.yb + 0.6, b.z0), W(g.xr - 1, b.yb + 0.6, b.z0)], false)}"/>`; }
  return s;
}

// ---------------------------------------------------------------- tambor (unidades de aglomerador.svg)
const DR = { C: [55.94, 91.56], R: 24.94, Rs: 24.2, L: 90.9, ring: 45.7 };
const dX = [0.866, 0.5], dA = [0.866, -0.5];                           // X del dibujo y eje del tambor (−Y)
// punto del tambor: a = distancia por el eje desde la boca de alimentación, θ en la sección (0 = +X, 90° = arriba)
const drumP = (a, th, r = DR.Rs) => [DR.C[0] + dA[0] * a + dX[0] * r * Math.cos(th), DR.C[1] + dA[1] * a + dX[1] * r * Math.cos(th) - r * Math.sin(th)];
const BED = { th1: (205 * Math.PI) / 180, th2: (322 * Math.PI) / 180 };   // cuerda del lecho (sube por el lado que asciende)

function drumWindowSvg(open, s) {
  // ventana en el manto del segmento frontal: θ ∈ [45° − w, 45° + w], a ∈ [a0, a1]
  const w = lerp(0.12, 1.25, open), thA = Math.PI / 4 - w, thB = Math.PI / 4 + w * 0.85;
  const a0 = lerp(22, 6, open), a1 = lerp(26, 41, open), n = 18;
  const rim = [];
  for (let i = 0; i <= n; i++) rim.push(drumP(a0, lerp(thA, thB, i / n)));
  for (let i = 0; i <= n; i++) rim.push(drumP(a1, lerp(thB, thA, i / n)));
  const win = D(rim);
  let g = `<clipPath id="lx-dwin"><path d="${win}"/></clipPath><path class="lx-dvoid" d="${win}"/><g clip-path="url(#lx-dwin)">`;
  // levantadores en la pared interior (se ven por la ventana los del lado opuesto) — giran con el tambor
  for (let i = 0; i < 12; i++) {
    const th = s.rot + (i / 12) * Math.PI * 2, c = Math.cos(th) + Math.sin(th);
    if (c > -0.2) continue;                                            // sólo la pared del fondo
    g += `<path class="lx-dlift" d="${D([drumP(0, th), drumP(DR.ring - 1, th)], false)}"/>`;
  }
  // lecho: superficie plana entre las dos generatrices de la cuerda
  g += `<path class="lx-dbed" d="${D([drumP(0, BED.th1), drumP(DR.ring, BED.th1), drumP(DR.ring, BED.th2), drumP(0, BED.th2)])}"/>`;
  for (let j = 0; j < 7; j++) { const a = ((s.flow * 4 + j * 6.5) % 45); const u = 0.15 + 0.7 * hash(j); const p = (th) => drumP(a, th); const p1 = p(BED.th1), p2 = p(BED.th2);
    g += `<path class="lx-dripple" d="${D([[lerp(p1[0], p2[0], u - 0.12), lerp(p1[1], p2[1], u - 0.12)], [lerp(p1[0], p2[0], u + 0.12), lerp(p1[1], p2[1], u + 0.12)]], false)}"/>`; }
  // cascada: el mineral se suelta de los levantadores y cae sobre el lecho
  for (let j = 0; j < 16; j++) {
    const a = 4 + hash(j * 2.7) * 38, ph = (s.flow * 0.9 + hash(j * 5.1)) % 1, th0 = BED.th1 - Math.PI * (0.52 + 0.1 * hash(j));
    const p0 = drumP(a, th0, DR.Rs * 0.93), pb = drumP(a, BED.th1 + 0.35 + 0.5 * hash(j * 3), DR.Rs * 0.86);
    const q = [lerp(p0[0], pb[0], ph * 0.6), lerp(p0[1], pb[1], ph * ph)];
    g += `<path class="lx-drock" d="${ROCK[j % 3]}" transform="translate(${f1(q[0])} ${f1(q[1])}) scale(.9) rotate(${Math.round(j * 40 + ph * 200)})"/>`;
  }
  // barra de riego (agua + ácido) a lo largo del eje, sobre el lecho
  const bar = (a) => drumP(a, (20 * Math.PI) / 180, DR.Rs * 0.52);
  g += `<path class="lx-dbar" d="${D([bar(-2), bar(DR.ring - 4)], false)}"/><path class="lx-dbar2" d="${D([add(bar(-2), [0, 1.6]), add(bar(DR.ring - 4), [0, 1.6])], false)}"/>`;
  for (let a = 4; a < DR.ring - 5; a += 6) { const n0 = add(bar(a), [0, 2]), bd = drumP(a, BED.th2 - 0.3, DR.Rs * 0.82);
    g += `<path class="lx-dspray" d="${D([n0, [bd[0] - 3.2, bd[1]], [bd[0] + 3.2, bd[1]]])}"/>`; }
  g += `</g><path class="lx-dcut" d="${win}"/>`;
  return g;
}

// ---------------------------------------------------------------- detalle A: el tambor por dentro (perspectiva hacia la boca de alimentación)
function drumInsideSvg(C, s) {
  const [bx, by, bw, bh] = C.box, cx = bx + bw * 0.5, cy = by + 24 + (bh - 24) * 0.46, f = 92, zf = 5.2;
  const P = (th, z, r = 1) => [cx + (f / z) * r * Math.cos(th), cy - (f / z) * r * Math.sin(th)];
  // vista desde la descarga mirando hacia la alimentación: el lado que asciende queda a la izquierda (como la referencia)
  const th1 = (196 * Math.PI) / 180, th2 = (330 * Math.PI) / 180;
  let g = `<rect class="lx-a-wall" x="${bx}" y="${by}" width="${bw}" height="${bh}"/>`;
  g += `<circle class="lx-a-end" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(f / zf)}"/>`;
  for (let i = 0; i < 4; i++) { const th = (i / 4) * Math.PI * 2 + 0.4; g += `<path class="lx-a-seam" d="${D([P(th, 1.05), P(th, zf)], false)}"/>`; }
  // levantadores (giran: el lado izquierdo sube)
  for (let i = 0; i < 14; i++) {
    const th = (i / 14) * Math.PI * 2 - s.rot;
    g += `<path class="lx-a-lift" d="${D([P(th, 1.02), P(th, zf)], false)}"/>`;
  }
  // chute de alimentación entrando por la boca del fondo
  const ch = P(-Math.PI / 2, zf, 0.62), chw = 6.5;
  g += `<path class="lx-a-chute" d="M${f1(cx - chw)} ${f1(cy - f / zf)}L${f1(cx + chw)} ${f1(cy - f / zf)}L${f1(cx + chw)} ${f1(ch[1])}L${f1(cx - chw)} ${f1(ch[1])}Z"/>`;
  // lecho: superficie entre las cuerdas (más alta a la izquierda), con ondas que avanzan hacia la descarga
  const bed = [P(th1, zf), P(th2, zf), P(th2, 0.2), P(-Math.PI / 2, 0.2), P(th1, 0.2)];   // todo el sector bajo la cuerda es lecho
  g += `<path class="lx-a-bed" d="${D(bed)}"/>`;
  for (let j = 0; j < 9; j++) {
    const z = zf - ((s.flow * 0.55 + j / 9) % 1) * (zf - 0.9);
    const p1 = P(th1, z, 0.995), p2 = P(th2, z, 0.995), w = 0.35 + 0.08 * Math.sin(j * 1.7);
    const m = [lerp(p1[0], p2[0], 0.5), lerp(p1[1], p2[1], 0.5) + (f / z) * 0.05];
    g += `<path class="lx-a-ripple" style="stroke-width:${f1(Math.min(1.4, 2.4 / z))}" d="M${f1(lerp(p1[0], p2[0], 0.5 - w))} ${f1(lerp(p1[1], p2[1], 0.5 - w))}Q${f1(m[0])} ${f1(m[1])} ${f1(lerp(p1[0], p2[0], 0.5 + w))} ${f1(lerp(p1[1], p2[1], 0.5 + w))}"/>`;
  }
  // glómeros que ruedan sobre el lecho (crecen al avanzar hacia la descarga)
  for (let j = 0; j < 22; j++) {
    const ph = (s.flow * 0.32 + hash(j * 1.9)) % 1, z = zf - ph * (zf - 1.1), u = (hash(j * 4.3) + s.flow * 0.25 * (0.5 + hash(j))) % 1;
    const p1 = P(th1, z, 0.99), p2 = P(th2, z, 0.99), q = [lerp(p1[0], p2[0], 0.12 + 0.76 * u), lerp(p1[1], p2[1], 0.12 + 0.76 * u)];
    g += `<circle class="lx-a-glom" cx="${f1(q[0])}" cy="${f1(q[1] - 1)}" r="${f1((0.5 + ph * 1.1) * (3 / z))}"/>`;
  }
  // cascada: se suelta desde los levantadores del lado izquierdo y cae sobre el lecho
  for (let j = 0; j < 26; j++) {
    const z = 1.25 + hash(j * 7.7) * 3.6, ph = (s.flow * 0.85 + hash(j * 3.3)) % 1;
    const thr = th1 - (0.55 + 0.45 * hash(j * 2.2)) * Math.PI * 0.5;   // punto de suelta (arriba a la izquierda)
    const p0 = P(thr, z, 0.94), land = P(th1 + 0.25 + 0.55 * hash(j * 5.5), z, 0.92);
    const q = [lerp(p0[0], land[0], ph * 0.85), lerp(p0[1], land[1], ph * ph)];
    g += `<path class="lx-a-rock" d="${ROCK[j % 3]}" transform="translate(${f1(q[0])} ${f1(q[1])}) rotate(${Math.round(j * 50 + ph * 260)}) scale(${f1(2.6 / z)})"/>`;
  }
  // barra de riego (estructura reticulada con cañería de agua y de ácido), arriba a la derecha; el ancho del reticulado es tangencial
  const thb = (24 * Math.PI) / 180, rb = 0.6, dth = 0.075;
  const pb = (z, dt = 0, dr = 0) => P(thb + dt, z, rb + dr);
  const nz = [1.1, 1.5, 2.0, 2.7, 3.6];
  for (const z of nz) { const n0 = pb(z, -dth), bd1 = P(th2 - 0.16, z, 0.93), bd2 = P(th2 - 0.62, z, 0.97);
    g += `<path class="lx-a-spray" d="${D([n0, bd1, bd2])}"/>`;
    for (let k = 0; k < 4; k++) { const ph = (s.flow * 1.6 + k / 4 + z) % 1, tq = [lerp(n0[0], lerp(bd1[0], bd2[0], hash(k + z * 3)), ph), lerp(n0[1], lerp(bd1[1], bd2[1], hash(k + z * 3)), ph)];
      g += `<circle class="lx-a-mist" cx="${f1(tq[0])}" cy="${f1(tq[1])}" r="${f1(0.9 / z + 0.25)}"/>`; } }
  let tr = "", up = true;
  for (let z = 0.42; z < 4.6; z *= 1.14) { const a = pb(z, up ? dth : -dth), b2 = pb(z * 1.14, up ? -dth : dth); tr += `M${f1(a[0])} ${f1(a[1])}L${f1(b2[0])} ${f1(b2[1])}`; up = !up; }
  g += `<path class="lx-a-truss" d="${tr}${D([pb(0.42, dth), pb(4.6, dth)], false)}${D([pb(0.42, -dth), pb(4.6, -dth)], false)}"/>`;
  g += `<path class="lx-a-acid" style="stroke-width:2.4" d="${D([pb(0.42, 0.02), pb(4.6, 0.02)], false)}"/>`;
  g += `<path class="lx-a-water" style="stroke-width:1.8" d="${D([pb(0.42, -0.025), pb(4.6, -0.025)], false)}"/>`;
  return { svg: g, pts: { lift: P(th1 - 1.1, 1.35, 1), casc: P(th1 - 0.6, 2.1, 0.7), bar: pb(1.5, dth), bed: P((th1 + th2) / 2 + 0.1, 1.6, 0.75), chute: [cx - 6.5, cy - f / zf * 0.5] } };
}

// ---------------------------------------------------------------- detalle B: corte de la pila (elevación)
function heapSectionSvg(C, s) {
  const [bx, by, bw, bh] = C.box;
  const k = 2.05, w = (HEAP.y1 - HEAP.y0) * k, h = HEAP.h * k * 3.2, kh = HEAP.k * HEAP.h * k * 1.6;   // la altura va exagerada (×3,2)
  const x0 = bx + (bw - w) / 2 + 10, base = by + bh - 26, x1 = x0 + w;
  let g = "";
  // losa y carpeta; dren y canaleta (a la izquierda: el frente de la pila, hacia las canaletas en arco)
  g += `<rect class="lx-b-slab" x="${f1(x0 - 22)}" y="${f1(base)}" width="${f1(w + 32)}" height="${f1(14)}"/>`;
  g += `<path class="lx-b-canal" d="M${f1(x0 - 30)} ${f1(base)}L${f1(x0 - 26)} ${f1(base + 10)}L${f1(x0 - 14)} ${f1(base + 10)}L${f1(x0 - 10)} ${f1(base)}"/>`;
  const plsF = s.mod.plsB;                                             // pila derecha: estado estable
  g += `<path class="lx-b-plsfill" style="opacity:${f1(plsF)}" d="M${f1(x0 - 28.4)} ${f1(base + 6)}L${f1(x0 - 26)} ${f1(base + 10)}L${f1(x0 - 14)} ${f1(base + 10)}L${f1(x0 - 11.6)} ${f1(base + 6)}Z"/>`;
  const heap = [[x0, base], [x0 + kh, base - h], [x1 - kh, base - h], [x1, base]];
  g += `<path class="lx-b-heap" d="${D(heap)}"/>`;
  // glómeros (textura fija)
  for (let j = 0; j < 70; j++) { const u = hash(j * 1.3), v = hash(j * 2.9); const yy = base - 3 - v * (h - 6); const half = (w - 2 * kh * ((base - yy) / h)) / 2 - 3;
    if (half <= 0) continue; const xx = (x0 + x1) / 2 + (u * 2 - 1) * half; g += `<circle class="lx-b-glom" cx="${f1(xx)}" cy="${f1(yy)}" r="${f1(1.3 + hash(j * 7) * 1.4)}"/>`; }
  // carpeta y drenes
  g += `<path class="lx-b-liner" d="M${f1(x0 - 22)} ${f1(base)}H${f1(x1 + 10)}"/>`;
  for (let j = 0; j < 5; j++) { const cx = lerp(x0 + 14, x1 - 14, j / 4); g += `<circle class="lx-b-drain" cx="${f1(cx)}" cy="${f1(base - 2.4)}" r="2.2"/>`; }
  // goteros en el techo
  const top = base - h, rate = s.rate;
  for (let j = 0; j < 6; j++) { const cx = lerp(x0 + kh + 6, x1 - kh - 6, j / 5); g += `<circle class="lx-b-emit" cx="${f1(cx)}" cy="${f1(top - 1.6)}" r="1.6"/>`; }
  g += `<path class="lx-b-pipe" d="M${f1(x0 + kh + 2)} ${f1(top - 1.6)}H${f1(x1 - kh - 2)}"/>`;
  // gotas que percolan: refino (turquesa) arriba → PLS (azul) abajo
  const nd = Math.round(18 + (rate - RATE_MIN) * 3.2);
  for (let j = 0; j < nd; j++) {
    const ph = (s.flow * (0.18 + rate * 0.012) + hash(j * 3.7)) % 1;
    const col = Math.floor(hash(j * 9.1) * 6), cx = lerp(x0 + kh + 6, x1 - kh - 6, col / 5) + Math.sin(ph * 9 + j) * 4 * ph;
    const yy = lerp(top + 1, base - 5, ph);
    g += `<circle class="${ph < 0.55 ? "lx-b-ref" : "lx-b-pls"}" cx="${f1(cx)}" cy="${f1(yy)}" r="${f1(1.25)}"/>`;
  }
  // PLS que corre sobre la carpeta hacia la canaleta (a la izquierda)
  for (let j = 0; j < 9; j++) { const ph = (s.flow * 0.5 + j / 9) % 1; const xx = lerp(x1 - 8, x0 - 20, ph);
    g += `<circle class="lx-b-pls" cx="${f1(xx)}" cy="${f1(base - 0.9 + (xx < x0 - 10 ? (Math.min(x0 - 10 - xx, 8)) : 0))}" r="1.1" style="opacity:${f1(plsF)}"/>`; }
  const pts = { emit: [x0 + kh + 6, top - 1.6], glom: [(x0 + x1) / 2 + 12, base - h * 0.55], liner: [x1 - 20, base], canal: [x0 - 20, base + 7], perc: [lerp(x0 + kh + 6, x1 - kh - 6, 0.6), base - h * 0.35] };
  return { svg: g, pts };
}

// ---------------------------------------------------------------- lámina
export async function createPilas() {
  const root = document.createElement("div");
  root.className = "lx-plate";
  root.style.cssText = `position:absolute;left:${VIEW[0]}px;top:${VIEW[1]}px;width:${VIEW[2]}px;height:${VIEW[3]}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "lx-svg", role: "group", tabindex: "0",
    "aria-label": "Pilas de lixiviación: el tambor aglomerador cura el mineral con agua y ácido, la correa lo lleva a las pilas, la apiladora forma el módulo, los goteros lo riegan con solución ácida y el PLS sale por las canaletas. Espacio pausa; coma y punto cambian de paso; 1 a 5 eligen un equipo." }, root);
  const defs = el("defs", {}, svg);
  const silP = el("path", { d: SIL, class: "lx-sil" }, svg);

  // dibujos de Emilio (se renombran clases e ids para que no choquen entre sí ni con otras láminas)
  async function loadArt(url, pre, T) {
    const text = (await (await fetch(url)).text()).replace(/\bcls-(\d+)/g, `${pre}cls-$1`).replace(/(id="|url\(#)(clippath[-\d]*)/g, `$1${pre}$2`);
    const doc = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
    doc.querySelectorAll("metadata, title, desc").forEach((n) => n.remove());
    const st = doc.querySelector("style"); if (st) { el("style", {}, defs).textContent = st.textContent; st.remove(); }
    const g = el("g", { transform: `translate(${T.tx} ${T.ty}) scale(${T.s})` });
    [...doc.children].forEach((n) => { if (n.tagName === "defs") [...n.children].forEach((c) => defs.appendChild(document.importNode(c, true))); else g.appendChild(document.importNode(n, true)); });
    return g;
  }
  const kids = (n) => [...n.children].filter((c) => !["defs", "style", "title", "clipPath"].includes(c.tagName));
  const tag = (n, eq) => n && n.setAttribute("data-eq", eq);

  // ---- suelo: canaletas (franjas entre pilas y arcos) con el PLS que corre
  const ground = el("g", { class: "lx-ground", "data-eq": "solucion" }, svg);
  for (const [w, o] of [...STRIPS, ...ARCS]) { el("path", { d: w, class: "lx-canal-w" }, ground); el("path", { d: o, class: "lx-canal-o" }, ground); }
  const flowG = el("g", { class: "lx-flow" }, ground);
  const arcC = [158.5, 42.5], arcR = [143.5, 109.2, 74.8];
  const arcPath = (R, th0, th1) => { const pts = []; for (let i = 0; i <= 40; i++) { const th = lerp(th0, th1, i / 40) * Math.PI / 180; pts.push(W(arcC[0] + R * Math.cos(th), arcC[1] + R * Math.sin(th), 0)); } return D(pts, false); };
  const flows = {
    left: arcR.map((R) => el("path", { d: arcPath(R, 176, 92), class: "lx-pls-flow" }, flowG)),
    right: arcR.map((R) => el("path", { d: arcPath(R, 3, 88), class: "lx-pls-flow" }, flowG)),
    strips: [el("path", { d: D([[2467.5, 343.2], [2577, 407.8]], false), class: "lx-pls-flow" }, flowG), el("path", { d: D([[2718, 493], [2608.5, 428.3]], false), class: "lx-pls-flow" }, flowG)],
  };

  // ---- pilas del fondo (T, R) y de adelante (TL, B)
  const padsBack = el("g", { class: "lx-pads", "data-eq": "pilas" }, svg);
  const padsFront = el("g", { class: "lx-pads", "data-eq": "pilas" }, svg);
  const backHeaps = el("g", {}, padsBack);
  const tlG = el("g", {}, padsFront), bG = el("g", {}, padsFront);
  const dripBack = el("g", { class: "lx-dripl", "data-eq": "solucion" }, padsBack);
  const tlDrip = el("g", { class: "lx-dripl", "data-eq": "solucion" }, padsFront), bDrip = el("g", { class: "lx-dripl", "data-eq": "solucion" }, padsFront);
  const rotoG = el("g", { class: "lx-roto", "data-eq": "pilas" }, padsFront);

  // ---- apiladoras y correas
  const apiArt = await loadArt(A_API, "lxp-", AP); svg.appendChild(apiArt);
  const apiTop = kids(apiArt)[0], ag = kids(apiTop);                     // 0 = escalera B · 1 = escalera izq. · 2–5 correas · 6, 7 apiladoras · 8 casa de traspaso
  [2, 3, 4, 5, 8].forEach((i) => tag(ag[i], "correas"));
  [0, 1, 6, 7].forEach((i) => tag(ag[i], "apiladora"));
  const beltRocksL = el("g", { class: "lx-rocks" }); ag[6].before(beltRocksL);
  const rock4 = pool(beltRocksL, 36, "lx-glom", true), rock2 = pool(beltRocksL, 30, "lx-glom", true), rock5 = pool(beltRocksL, 36, "lx-glom", true);
  const stackL = [ag[6], ag[1]];                                       // apiladora izquierda + su escalera (se desplazan juntas)
  const boomG = el("g", { class: "lx-boom", "data-eq": "apiladora" }, svg);
  const boomExt = el("path", { class: "lx-ext" }, boomG), boomExtS = el("path", { class: "lx-ext-s" }, boomG);
  const boomRocksL = el("g", { class: "lx-rocks" }, svg);
  const rockB = pool(boomRocksL, 16, "lx-glom", true), rockF = pool(boomRocksL, 10, "lx-glom", true);

  // ---- aglomerador
  const agl = await loadArt(A_AGLO, "lxa-", AG); svg.appendChild(agl); tag(agl, "aglomerador");
  const ga = kids(kids(kids(agl)[0])[0]);                              // hijos de 0.0
  const front = ga[14], rear = ga[13];
  const fk = kids(front); fk[8].style.display = "none";                // levantadores dibujados → se reemplazan por los que giran
  const liftG = el("g", { class: "lx-dl" }); front.after(liftG);
  const seamF = el("g", { class: "lx-seam" }); front.after(seamF);
  const seamR = el("g", { class: "lx-seam" }); rear.after(seamR);
  const winG = el("g", { class: "lx-dwin" }); liftG.after(winG);
  // alimentación: correa corta que llega a la tolva del tambor (desde el chancado terciario)
  const feedG = el("g", { class: "lx-feed", "data-eq": "correas" }, svg);
  const feedRocksL = el("g", { class: "lx-rocks" }, svg);
  const rockIn = pool(feedRocksL, 14, "lx-rock");

  // ---- la colpa/glómero que se sigue
  const tourG = el("g", { class: "lx-tour" }, svg);
  const tourRing = el("circle", { r: 5, class: "lx-tour-ring" }, tourG);
  const tourDot = el("circle", { r: 1.9, class: "lx-tour-glom" }, tourG);
  const tourPulse = el("circle", { r: 8, class: "lx-tour-pulse" }, svg);

  // ---- detalles ampliados
  const CAL = {
    A: { box: [2158, 232, 206, 158], at: [2275, 556], title: "Detalle A · Dentro del tambor" },
    B: { box: [2772, 236, 220, 106], at: [2690, 470], title: "Detalle B · Corte de la pila" },
  };
  const calG = el("g", { class: "lx-callouts" }, svg);
  for (const [key, C] of Object.entries(CAL)) {
    const [x, y, cw, ch] = C.box;
    const g = el("g", { class: "lx-callout", "data-cal": key }, calG);
    C.lead = el("path", { class: "lx-lead" }, g);
    C.dot = el("circle", { r: 2.2, class: "lx-lead-dot", cx: C.at[0], cy: C.at[1] }, g);
    el("rect", { x, y, width: cw, height: ch, rx: 7, class: "lx-card" }, g);
    const clip = el("clipPath", { id: `lx-cal-${key}` }, defs); el("rect", { x: x + 0.6, y: y + 13, width: cw - 1.2, height: ch - 13.6, rx: 6 }, clip);
    C.body = el("g", { "clip-path": `url(#lx-cal-${key})` }, g);
    el("text", { x: x + 8, y: y + 9.5, class: "lx-cal-title" }, g).textContent = C.title;
    C.labels = el("g", { class: "lx-cal-labels" }, g);
    C.g = g;
  }

  // ---- etiquetas de foco
  const tagsG = el("g", { class: "lx-tags" }, svg);
  const TAGS = { aglomerador: ["Tambor aglomerador", [2268, 520]], correas: ["Correas", [2430, 520]], apiladora: ["Apiladora", [2405, 384]], pilas: ["Pilas", [2580, 300]], solucion: ["Riego y PLS", [2345, 560]] };
  const tagEls = {};
  for (const [id, [label, p]] of Object.entries(TAGS)) {
    const g = el("g", { class: "lx-tag", transform: `translate(${p[0]} ${p[1]})` }, tagsG);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -12, class: "lx-tag-line" }, g);
    const ww = label.length * 3.7 + 12;
    el("rect", { x: -ww / 2, y: -23, width: ww, height: 11, rx: 5.5, class: "lx-tag-pill" }, g);
    el("text", { x: 0, y: -15.6, class: "lx-tag-text", "text-anchor": "middle" }, g).textContent = label;
    tagEls[id] = g;
  }

  // unidades para el foco
  const units = new Map();
  const classify = (n, inh) => {
    if (n.classList?.contains("lx-rocks") || n.tagName === "defs" || n.tagName === "style") return;
    const eq = n.dataset?.eq || inh;
    if (n.querySelector?.("[data-eq]")) [...n.children].forEach((c) => classify(c, eq)); else units.set(n, eq || "");
  };
  [ground, padsBack, padsFront, apiArt, boomG, agl, feedG].forEach((n) => classify(n, ""));

  // ------------------------------------------------------------ estado
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const S = { t: 0, rot: 0, flow: 0, rate: 10, drum: 0, cut: 0 };
  const shown = { drum: 0, cut: 0 };
  let selected = null, playing = !still.matches, active = false, raf = 0, last = 0;
  if (still.matches) S.t = STEPS[3].t0 + 3;
  const vis = new Map();
  const visible = (id, p) => { if (!vis.has(id)) { vis.set(id, hash(id * 1.37) < p); if (vis.size > 800) vis.delete(vis.keys().next().value); } return vis.get(id); };

  function step(dt) {
    S.rot += OMEGA * dt; S.flow += dt;
    S.t = (S.t + dt) % PERIOD;
  }
  const live = () => {
    const t = S.t, mod = moduleAt(t);
    mod.plsB = 1;
    const cu = cuOf(S.rate), flow = (S.rate * AREA) / 1000;
    return { t, rot: S.rot, flow: S.flow, rate: S.rate, cu, flowM3: flow, step: stepAt(t), mod, div: diverted(t), drum: shown.drum, cut: shown.cut, st: stackerAt(t), ro: rotoAt(t) };
  };

  // corte de la pila derecha: x del plano según el deslizador
  const bB = heapBase("b");
  const cutX = (c) => (c < 0.04 ? Infinity : lerp(bB.xb - HEAP.k * HEAP.h - 1, bB.xa + 46, (c - 0.04) / 0.96));

  function draw() {
    const s = live(), t = s.t, m = s.mod;
    const flowT = S.flow;
    const sv = { ...s, flow: flowT };
    // pilas del fondo: siempre en riego
    let back = "";
    for (const id of ["t", "r"]) back += padSvg(id);
    for (const id of ["t", "r"]) { const b = heapBase(id); back += heapSvg(heapGeom(b, b.xa, b.xb, HEAP.h), { wet: 0.55, perc: 1, pls: 1 }); }
    backHeaps.innerHTML = back;
    let dB = ""; for (const id of ["t", "r"]) { const b = heapBase(id); dB += heapSvg(heapGeom(b, b.xa, b.xb, HEAP.h), { drip: true, active: 0.55 + (S.rate - RATE_MIN) / 20, t: flowT }).replace(/<path class="lx-heap-[fst]"[^>]*>/g, ""); }
    dripBack.innerHTML = dB;
    // pila izquierda (dinámica)
    const bT = heapBase("tl");
    const gT = m.h > 0 ? heapGeom(bT, m.xa, m.xb, m.h) : null;
    tlG.innerHTML = padSvg("tl") + heapSvg(gT, { wet: m.wet, perc: m.perc, pls: m.pls });
    const riegoOn = t >= T.riego[0] && t < T.riego[1];
    tlDrip.innerHTML = gT && m.fill > 0.98 && t >= T.stack[1] ? heapSvg(gT, { drip: true, active: riegoOn ? smooth(phase(t, [T.riego[0], T.riego[0] + 1.2])) : 0, t: flowT }).replace(/<path class="lx-heap-[fst]"[^>]*>/g, "").replace(/<path class="lx-(wet|pls-toe)"[^>]*>/g, "") : "";
    // pila derecha (en riego) con corte
    const Xc = cutX(shown.cut), gB = heapGeom(bB, bB.xa, bB.xb, HEAP.h, Xc);
    let bs = padSvg("b", Xc < Infinity ? Xc + 8.5 : Infinity) + heapSvg(gB, { wet: 0.55, perc: 1, pls: 1 });
    if (gB.sec) bs += secFaceSvg(gB, sv);
    bG.innerHTML = bs;
    bDrip.innerHTML = heapSvg(gB, { drip: true, active: 0.55 + (S.rate - RATE_MIN) / 20, t: flowT }).replace(/<path class="lx-heap-[fst]"[^>]*>/g, "").replace(/<path class="lx-(wet|pls-toe)"[^>]*>/g, "");
    // canaletas: PLS (izquierda sólo cuando el módulo produce)
    const dash = -(flowT * (6 + S.rate * 0.6)) % 6.4;
    flows.right.forEach((p) => { p.style.strokeDashoffset = dash; p.style.opacity = 0.9; });
    flows.strips.forEach((p) => { p.style.strokeDashoffset = dash; p.style.opacity = 0.9; });
    flows.left.forEach((p) => { p.style.strokeDashoffset = dash; p.style.opacity = (0.9 * smooth((m.pls - 0.05) / 0.4)).toFixed(2); });

    // rotopala
    rotoG.innerHTML = rotoSvg(s.ro, t);

    // apiladora izquierda: se desplaza por la correa
    const st = s.st, sh = mul(EX, st.dx), shA = [sh[0] / AP.s, sh[1] / AP.s];
    stackL.forEach((n) => n.setAttribute("transform", `translate(${f1(shA[0])} ${f1(shA[1])})`));
    const tip = add(BOOM.tip, sh), half = mul(EX, 2.6), ext = st.ext;
    if (ext > 0.3) {
      const e0 = add(tip, mul(DIR_Y, -0.6)), e1 = add(tip, mul(DIR_Y, ext));
      const th = [0, 1.9];
      boomExt.setAttribute("d", D([add(e0, mul(half, -1)), add(e1, mul(half, -1)), add(e1, half), add(e0, half)]));
      boomExtS.setAttribute("d", D([add(e0, half), add(e1, half), add(add(e1, half), th), add(add(e0, half), th)]));
      boomG.style.display = "";
    } else boomG.style.display = "none";

    // correas: glómeros a espaciado fijo, una sola cadena tambor → casa de traspaso → (módulo | otros módulos)
    const sp = 6.4, base = (V * S.flow) % sp, idBase = Math.floor((V * S.flow) / sp);
    const tripS = Math.hypot(add(BOOM.trip, sh)[0] - S2.a[0], add(BOOM.trip, sh)[1] - S2.a[1]);
    const stub = Math.hypot(BOOM.tip[0] - BOOM.root[0], BOOM.tip[1] - BOOM.root[1]);
    let i4 = 0, i2 = 0, i5 = 0, ib = 0, iff = 0;
    for (let j = 0; j < 140; j++) {
      const sG = base + j * sp, id = idBase - j;
      if (!visible(id, 0.82)) continue;
      const jit = (hash(id * 3.3) - 0.5) * 2.2, r = 1.25 + hash(id) * 0.5;
      if (sG < S4.len) { if (i4 < rock4.length) { const q = S4.at(sG); put(rock4[i4++], [q[0] + jit * 0.5, q[1] - 1.6 + jit * 0.25], r); } continue; }
      const s2 = sG - S4.len, tau = S.t - s2 / V;
      if (diverted(tau)) {
        if (s2 < tripS) { if (i2 < rock2.length) { const q = S2.at(s2); put(rock2[i2++], [q[0] - jit * 0.5, q[1] - 1.6 + jit * 0.25], r); } continue; }
        const sb = s2 - tripS - 9;                                     // 9 px de subida dentro del tripper (oculto)
        if (sb < 0) continue;
        const L = stub + ext;
        if (sb < L) { if (ib < rockB.length) { const q = sb < stub ? add(add(BOOM.root, sh), mul([BOOM.tip[0] - BOOM.root[0], BOOM.tip[1] - BOOM.root[1]], sb / stub)) : add(tip, mul(DIR_Y, sb - stub)); put(rockB[ib++], [q[0] + jit * 0.4, q[1] - 1.2], r); } continue; }
        const fu = (sb - L) / 9;
        if (fu < 1 && iff < rockF.length) {
          const land = landingZ(st, ext, m), drop = BOOM.z - land;
          const q = add(add(tip, mul(DIR_Y, ext)), [jit * 0.6, -1.2 + drop * fu * fu]);
          put(rockF[iff++], q, r, 0, 1 - smooth((fu - 0.85) / 0.15));
        }
        continue;
      }
      if (s2 < S5.len && i5 < rock5.length) { const q = S5.at(s2); put(rock5[i5++], [q[0] + jit * 0.5, q[1] - 1.6 + jit * 0.25], r, 0, 1 - smooth((s2 - S5.len + 26) / 26)); }
    }
    for (; i4 < rock4.length; i4++) put(rock4[i4], null); for (; i2 < rock2.length; i2++) put(rock2[i2], null);
    for (; i5 < rock5.length; i5++) put(rock5[i5], null); for (; ib < rockB.length; ib++) put(rockB[ib], null); for (; iff < rockF.length; iff++) put(rockF[iff], null);

    // tambor: giro (costuras del manto y levantadores de la boca) y ventana
    seamF.innerHTML = seamsSvg(S.rot, 2.5, DR.ring - 2.5); seamR.innerHTML = seamsSvg(S.rot, DR.ring + 2.5, DR.L - 2.5);
    liftG.innerHTML = mouthLiftersSvg(S.rot);
    const dv = shown.drum;
    winG.innerHTML = dv > 0.005 ? drumWindowSvg(dv, { rot: S.rot, flow: flowT }) : "";
    // alimentación del tambor
    drawFeed(flowT);

    // detalles
    const showA = clamp(dv * 3) * (selected && selected !== "aglomerador" ? 0 : 1), showB = clamp(shown.cut * 3) * (selected && !["pilas", "solucion"].includes(selected) ? 0 : 1);
    CAL.A.g.style.opacity = showA.toFixed(3); CAL.A.g.style.display = showA > 0.01 ? "" : "none";
    CAL.B.g.style.opacity = showB.toFixed(3); CAL.B.g.style.display = showB > 0.01 ? "" : "none";
    if (showA > 0.01) {
      const r = drumInsideSvg(CAL.A, { rot: S.rot, flow: flowT });
      CAL.A.body.innerHTML = r.svg;
      const [bx, by, bw, bh] = CAL.A.box;
      CAL.A.labels.innerHTML = label(r.pts.lift, [bx + 7, by + 24], "Levantadores", "start") + label(r.pts.casc, [bx + 7, by + 92], "Cascada de mineral", "start") +
        label(r.pts.bar, [bx + bw - 7, by + 24], "Barra de riego: agua + H₂SO₄", "end") + label(r.pts.bed, [bx + bw - 7, by + bh - 9], "Lecho que rueda → glómeros", "end") + label(r.pts.chute, [bx + 7, by + 58], "Chute de alimentación", "start");
      leader(CAL.A, "left");
    }
    if (showB > 0.01) {
      const r = heapSectionSvg(CAL.B, { ...sv, mod: m });
      CAL.B.body.innerHTML = r.svg;
      const [bx, by, bw, bh] = CAL.B.box;
      CAL.B.labels.innerHTML = label(r.pts.emit, [bx + 7, r.pts.emit[1] - 9], `Goteros · refino ácido ${fdec(S.rate, 0)} L/h·m²`, "start") + label(r.pts.perc, [bx + bw - 7, r.pts.perc[1] - 34], "Percola y disuelve el cobre", "end") +
        label(r.pts.liner, [bx + bw - 7, by + bh - 7], "Carpeta HDPE + drenes", "end") + label(r.pts.canal, [bx + 7, by + bh - 7], `PLS ~${fdec(s.cu)} g/L → canaleta`, "start");
      leader(CAL.B, "right");
    }

    // glómero que se sigue
    drawTour(s, sh, ext);
    for (const id of ORDER) tagEls[id].toggleAttribute("data-on", selected === id);
    listeners.forEach((fn) => fn(s, api));
  }

  // cara del corte de la pila derecha (en la lámina)
  function secFaceSvg(g, s) {
    const b = g.b, x = g.xr, hc = g.hc, kc = HEAP.k * hc;
    let o = `<path class="lx-heap-sec" d="${D(g.sec)}"/>`;
    o += `<path class="lx-wet" style="opacity:.35" d="${D(g.sec)}"/>`;
    for (let j = 0; j < 16; j++) { const ph = (s.flow * (0.2 + s.rate * 0.01) + hash(j * 2.3)) % 1, yy = lerp(b.yb - kc - 3, b.ya + kc + 3, hash(j * 5.7)), zz = b.z0 + hc - ph * hc;
      const p = W(x, yy, zz); o += `<circle class="${ph < 0.55 ? "lx-ref-dot" : "lx-pls-dot"}" cx="${f1(p[0])}" cy="${f1(p[1])}" r=".7"/>`; }
    o += `<path class="lx-liner" d="${D([W(x, b.ya - 2, b.z0), W(x, b.yb + 2, b.z0)], false)}"/>`;
    return o;
  }
  function landingZ(st, ext, m) {
    const y = BOOM.y - ext, x = st.x;
    if (m.h <= 0) return PAD.T;
    const b = heapBase("tl"), k = HEAP.k;
    return PAD.T + clamp(Math.min(x - m.xa, m.xb - x, y - b.ya, b.yb - y) / k, 0, m.h);
  }
  function seamsSvg(rot, a0, a1) {
    let o = "";
    for (let i = 0; i < 6; i++) { const th = rot + (i / 6) * Math.PI * 2, c = Math.cos(th) + Math.sin(th); if (c < 0.15) continue;
      o += `<path class="lx-seam-l" style="opacity:${f1(clamp((c - 0.15) * 1.2))}" d="${D([drumP(a0, th), drumP(a1, th)], false)}"/>`; }
    return o;
  }
  function mouthLiftersSvg(rot) {
    let o = "";
    for (let i = 0; i < 16; i++) { const th = rot + (i / 16) * Math.PI * 2; o += `<path class="lx-mouth-l" d="${D([drumP(0, th, DR.R * 0.62), drumP(0, th, DR.R * 0.86)], false)}"/>`; }
    return o;
  }
  // rotopala: orugas, cuerpo, pluma con rueda de capachos (eje Y: gira en el plano XZ de la pluma)
  function rotoSvg(ro, t) {
    const yc = -38, x = ro.x - 12, z0 = PAD.T;                         // cuerpo detrás de la rueda, sobre la carpeta
    const box = (x0, x1, y0, y1, za, zb, cls) => `<path class="${cls}" d="${D([W(x0, y1, za), W(x1, y1, za), W(x1, y1, zb), W(x0, y1, zb)])}"/><path class="${cls}" d="${D([W(x1, y1, za), W(x1, y0, za), W(x1, y0, zb), W(x1, y1, zb)])}"/><path class="${cls}" d="${D([W(x0, y1, zb), W(x1, y1, zb), W(x1, y0, zb), W(x0, y0, zb)])}"/>`;
    let o = "";
    o += box(x - 6, x + 6, yc - 8, yc - 5, z0, z0 + 2.4, "lx-ro-f");
    o += box(x - 6, x + 6, yc + 5, yc + 8, z0, z0 + 2.4, "lx-ro-f");
    o += box(x - 5, x + 5, yc - 6, yc + 6, z0 + 2.4, z0 + 7, "lx-ro-f");
    o += box(x - 10, x - 4, yc - 2, yc + 2, z0 + 7, z0 + 9, "lx-ro-f");    // contrapeso
    // pluma hacia la cara de la pila (+X), con giro en planta
    const sl = ro.slew * 0.55, L = 11.5, pv = [x + 2, yc, z0 + 8];
    const wc = [pv[0] + L * Math.cos(sl), yc + L * Math.sin(sl), PAD.T + 3.8];
    o += `<path class="lx-ro-boom" d="${D([W(...pv), W(...wc)], false)}"/>`;
    // rueda: círculo en el plano vertical que contiene la pluma
    const u = [Math.cos(sl), Math.sin(sl)], rw = 4.2, spin = ro.wheel ? t * 3.2 : 0;
    const wp = (phi, r = rw) => W(wc[0] + u[0] * r * Math.cos(phi), wc[1] + u[1] * r * Math.cos(phi), wc[2] + r * Math.sin(phi));
    const ring = []; for (let i = 0; i < 20; i++) ring.push(wp((i / 20) * Math.PI * 2));
    o += `<path class="lx-ro-wheel" d="${D(ring)}"/>`;
    for (let i = 0; i < 8; i++) { const phi = spin + (i / 8) * Math.PI * 2; const a = wp(phi, rw), b = wp(phi + 0.25, rw + 1.4);
      o += `<path class="lx-ro-bucket${ro.dig && Math.sin(phi) > 0 ? " lx-ro-full" : ""}" d="${D([a, b, wp(phi + 0.5, rw)])}"/>`; }
    return o;
  }
  // correa corta de alimentación del tambor (desde el chancado terciario) + colpas que caen a la tolva
  const FEED = { a: [2228, 528], b: [2252.5, 543.5], drop: [2252.5, 553] };
  feedG.innerHTML = (() => { const n = [-3.4, 5.4], q = [1.7, -2.7]; const a = FEED.a, b = FEED.b;
    return `<path class="lx-belt" d="${D([add(a, mul(q, 1)), add(b, mul(q, 1)), add(b, mul(q, -1)), add(a, mul(q, -1))])}"/><path class="lx-belt" d="${D([add(a, mul(q, -1)), add(b, mul(q, -1)), add(add(b, mul(q, -1)), [0, 2.4]), add(add(a, mul(q, -1)), [0, 2.4])])}"/><path class="lx-belt" d="M${f1(a[0] + 4)} ${f1(a[1] + 4)}V${f1(a[1] + 40)}M${f1(a[0] + 7.5)} ${f1(a[1] + 2.5)}V${f1(a[1] + 38)}"/>`; })();
  function drawFeed(fl) {
    const L = Math.hypot(FEED.b[0] - FEED.a[0], FEED.b[1] - FEED.a[1]), sp = 5, total = L + 10;
    rockIn.forEach((r, j) => { const p = ((fl * 18) % sp) + j * sp; if (p > total) return put(r, null);
      const id = Math.floor((fl * 18) / sp) - j;
      if (p < L) { const u = p / L; put(r, [lerp(FEED.a[0], FEED.b[0], u), lerp(FEED.a[1], FEED.b[1], u) - 1.4], 0.55 + hash(id) * 0.25, id * 47, smooth(p / 6)); }
      else { const u = (p - L) / 10; put(r, [FEED.b[0] + 0.6, FEED.b[1] - 1.4 + 9 * u * u], 0.6, id * 47 + u * 90, 1 - smooth((u - 0.6) / 0.4)); } });
  }
  function drawTour(s, sh, ext) {
    const t = s.t;
    let tp = null, inside = null;
    const t0 = 9, s4end = t0 + S4.len / V;
    if (t < t0) inside = [2272, 560];
    else if (t < s4end) tp = S4.at((t - t0) * V);
    else {
      const s2 = (t - s4end) * V, trip = Math.hypot(add(BOOM.trip, sh)[0] - S2.a[0], add(BOOM.trip, sh)[1] - S2.a[1]);
      if (s2 < trip) tp = S2.at(s2);
      else if (s2 < trip + 9) inside = add(BOOM.trip, sh);
      else {
        const sb = s2 - trip - 9, stub = Math.hypot(BOOM.tip[0] - BOOM.root[0], BOOM.tip[1] - BOOM.root[1]), tip = add(BOOM.tip, sh);
        // la extensión que tenía la pluma cuando el glómero llegó: se usa la actual (cambia lento)
        if (sb < stub) tp = add(add(BOOM.root, sh), mul([BOOM.tip[0] - BOOM.root[0], BOOM.tip[1] - BOOM.root[1]], sb / stub));
        else if (sb < stub + ext) tp = add(tip, mul(DIR_Y, sb - stub));
        else if (t < STEPS[3].t0) { const st = s.st, land = landingZ(st, ext, s.mod); const fu = clamp((sb - stub - ext) / 9); tp = add(add(tip, mul(DIR_Y, ext)), [0, (BOOM.z - land) * fu * fu]);
          if (fu >= 1) { inside = tp; tp = null; } }
      }
    }
    if (t >= STEPS[3].t0 && t < STEPS[4].t0) inside = W(70, -40, 12);
    else if (t >= STEPS[4].t0 && t < STEPS[5].t0) inside = W(70, -2, 7);
    else if (t >= STEPS[5].t0) inside = W(s.ro.x, -38, 9);
    if (tp) {
      tp = [tp[0], tp[1] - 1.6];
      tourRing.setAttribute("cx", f1(tp[0])); tourRing.setAttribute("cy", f1(tp[1])); tourRing.style.opacity = 1;
      tourDot.setAttribute("cx", f1(tp[0])); tourDot.setAttribute("cy", f1(tp[1])); tourDot.style.opacity = 1;
    } else { tourRing.style.opacity = 0; tourDot.style.opacity = 0; }
    if (inside) { const ph = (performance.now() / 900) % 1; tourPulse.setAttribute("cx", f1(inside[0])); tourPulse.setAttribute("cy", f1(inside[1])); tourPulse.setAttribute("r", f1(4 + ph * 9)); tourPulse.style.opacity = (0.9 * (1 - ph)).toFixed(2); }
    else tourPulse.style.opacity = 0;
  }
  function label(p, q, text, anchor) {
    const tx = anchor === "end" ? q[0] : q[0];
    return `<path class="lx-cal-lead" d="M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1] + 2)}"/><circle class="lx-cal-dot" cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.3"/><text class="lx-cal-text" x="${f1(tx)}" y="${f1(q[1])}" text-anchor="${anchor}">${text}</text>`;
  }
  function leader(C, side) {
    const [x, y, cw, ch] = C.box, e = side === "left" ? [x + cw * 0.55, y + ch] : [x + cw * 0.3, y + ch];
    C.lead.setAttribute("d", `M${f1(e[0])} ${f1(e[1])}C${f1(e[0])} ${f1(e[1] + 60)} ${f1(C.at[0])} ${f1(C.at[1] - 60)} ${f1(C.at[0])} ${f1(C.at[1])}`);
  }

  // ------------------------------------------------------------ reloj
  const listeners = new Set();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) step(dt);
    const k = 1 - Math.exp(-dt * 6);
    for (const key of ["drum", "cut"]) { shown[key] += (S[key] - shown[key]) * k; if (Math.abs(S[key] - shown[key]) < 0.002) shown[key] = S[key]; }
    draw();
    raf = active ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; }, get playing() { return playing; },
    get drum() { return S.drum; }, get cut() { return S.cut; }, get rate() { return S.rate; },
    live, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) kick(); else { cancelAnimationFrame(raf); raf = 0; } },
    play() { playing = true; kick(); }, pause() { playing = false; }, togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { S.t = ((v % PERIOD) + PERIOD) % PERIOD; draw(); },
    goStep(n) { api.seek(STEPS[clamp(n, 1, STEPS.length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(S.t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(S.t); api.goStep(S.t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    setDrum(v, instant) { S.drum = clamp(v); if (instant || still.matches) shown.drum = S.drum; draw(); },
    setCut(v, instant) { S.cut = clamp(v); if (instant || still.matches) shown.cut = S.cut; draw(); },
    setRate(v) { S.rate = clamp(v, RATE_MIN, RATE_MAX); draw(); },
    select(id) {
      selected = id && EQUIP[id] ? id : null;
      root.toggleAttribute("data-sel", !!selected);
      units.forEach((eq, u) => u.classList.toggle("lx-dim", !!selected && eq !== selected));
      draw();
    },
    destroy() { api.setActive(false); listeners.clear(); root.remove(); },
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-eq]"); api.select(g ? (selected === g.dataset.eq ? null : g.dataset.eq) : null); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); });
  draw();
  return api;
}

// ---------------------------------------------------------------- panel (HUD)
export function bindPanel(px, { onEscape, onFocus } = {}) {
  const $ = (q) => document.querySelector(q);
  const playBtn = $("[data-lx-play]"), stepsBox = $("[data-lx-steps]");
  stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", px.STEPS.length);
  const stepBtns = px.STEPS.map((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n; b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
    b.addEventListener("click", () => px.goStep(s.n)); stepsBox.appendChild(b); return b;
  });
  const info = $("[data-info]"), meter = $("[data-lx-meter]"), readout = $("[data-lx-readout]");
  const drumS = $("[data-lx-drum]"), drumO = $("[data-lx-drum-out]"), cutS = $("[data-lx-cut]"), cutO = $("[data-lx-cut-out]"), rateS = $("[data-lx-rate]"), rateO = $("[data-lx-rate-out]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = [];
  const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  function renderInfo(s) {
    const id = px.selected;
    document.querySelectorAll("[data-lx-chip]").forEach((c) => c.toggleAttribute("data-on", c.dataset.lxChip === id));
    if (!id) { if (info.dataset.owner === "lx") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs({ ...s, flow: s.flowM3 }), sig = id + specs.join("|");
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig; info.dataset.owner = "lx";
    $("[data-info-kicker]").textContent = e.kicker; $("[data-info-title]").textContent = e.title; $("[data-info-text]").textContent = e.text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join(""); $("[data-info-actions]").innerHTML = "";
    info.hidden = false;
  }
  off.push(px.on((s) => {
    const st = s.step;
    if (st.n !== lastStep) {
      $("[data-lx-step-n]").textContent = st.n; $("[data-lx-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const k = Number(b.dataset.step); b.toggleAttribute("data-done", k < st.n); b.toggleAttribute("data-current", k === st.n); });
      lastStep = st.n;
    }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", s.mod.fill.toFixed(3));
    const stg = s.mod.stage[0].toUpperCase() + s.mod.stage.slice(1);
    const text = `${stg}${s.mod.stage === "apilando" ? ` ${Math.round(s.mod.fill * 100)} %` : ""} · PLS ${fdec(s.cu)} g/L · ${fmt(s.flowM3)} m³/h`;
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(px.playing));
    playBtn.setAttribute("aria-label", px.playing ? "Pausar" : "Reproducir");
    renderInfo(s);
  }));
  const sync = () => { drumS.value = Math.round(px.drum * 100); drumO.textContent = `${drumS.value} %`; cutS.value = Math.round(px.cut * 100); cutO.textContent = `${cutS.value} %`; rateS.value = px.rate; rateO.textContent = `${fdec(px.rate, 0)} L/h·m²`; };
  on(drumS, "input", () => { px.setDrum(drumS.value / 100); drumO.textContent = `${drumS.value} %`; onFocus?.("A", drumS.value > 0); });
  on(cutS, "input", () => { px.setCut(cutS.value / 100); cutO.textContent = `${cutS.value} %`; onFocus?.("B", cutS.value > 0); });
  on(rateS, "input", () => { px.setRate(Number(rateS.value)); rateO.textContent = `${fdec(Number(rateS.value), 0)} L/h·m²`; });
  on(playBtn, "click", () => px.togglePlay());
  on($("[data-lx-prev]"), "click", () => px.prevStep());
  on($("[data-lx-next]"), "click", () => px.nextStep());
  document.querySelectorAll("[data-lx-chip]").forEach((c) => on(c, "click", () => px.select(px.selected === c.dataset.lxChip ? null : c.dataset.lxChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "lx") px.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "pilas" || e.target.closest?.("input, [data-intro]")) return;
    if (e.key === " " && !e.target.closest("button")) px.togglePlay();
    else if (e.key === ",") px.prevStep();
    else if (e.key === ".") px.nextStep();
    else if (/^[1-5]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; px.select(px.selected === id ? null : id); }
    else if (e.key === "ArrowRight") { px.setDrum(px.drum + 0.1); sync(); onFocus?.("A", px.drum > 0); }
    else if (e.key === "ArrowLeft") { px.setDrum(px.drum - 0.1); sync(); onFocus?.("A", px.drum > 0); }
    else if (e.key === "ArrowUp") { px.setCut(px.cut + 0.1); sync(); onFocus?.("B", px.cut > 0); }
    else if (e.key === "ArrowDown") { px.setCut(px.cut - 0.1); sync(); onFocus?.("B", px.cut > 0); }
    else if (e.key === "Escape") { if (px.selected) px.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  sync(); px.seek(px.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "lx") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const ZOOM = { aglomerador: [2195, 470, 200, 300], correas: [2290, 340, 420, 380], apiladora: [2330, 300, 230, 260], pilas: [2340, 250, 500, 420], solucion: [2280, 290, 560, 460] }; // alto extra abajo: la ficha tapa esa zona
const CAL_ZOOM = { A: [2150, 225, 260, 410], B: [2650, 230, 350, 260] };

export async function mount({ layer, focus }) {
  const px = await createPilas();
  layer.appendChild(px.el);
  requestAnimationFrame(() => px.el.setAttribute("data-in", ""));
  let focused = null;
  const want = (z, cap) => { const k = z ? JSON.stringify(z) : ""; if (k !== focused) { focused = k; focus?.(z, cap); } };
  const unbind = bindPanel(px, {
    onEscape: () => { location.hash = ""; },
    onFocus: (which, on) => want(on ? CAL_ZOOM[which] : null, 4),
  });
  const unzoom = px.on(() => { if (px.selected) want(ZOOM[px.selected], 3); else if (!px.drum && !px.cut) want(null); });
  px.setActive(true);
  window.pmPilas = px;
  return {
    focus: [VIEW[0] + 20, VIEW[1] + 10, VIEW[2] - 30, VIEW[3] - 20],
    view: "pilas",
    destroy: () => { unzoom(); unbind(); px.destroy(); if (window.pmPilas === px) delete window.pmPilas; },
  };
}
