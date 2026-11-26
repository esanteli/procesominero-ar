// Estación 2.2 · Chancado secundario y terciario — lámina viva sobre el dibujo de Emilio
// (assets/secundario/chancado-secundario.svg: correa inclinada, 4 líneas chancador de conos → alimentador → HPGR,
// correa de producto). Lectura del dibujo (sin tocar el SVG): la caja cuadrada de arriba es la tolva de alimentación
// del cono; el cuerpo facetado de abajo, la carcasa del cono; el cuello y la correa corta con rodillos, el alimentador
// del HPGR.
//
// Lógica de la skill anatomy: un modelo manda (alimentación y CSS → nivel de la tolva del cono → producción del cono
// → alimentador → carga del HPGR) y el dibujo lo sigue; secuencia "sigue una colpa" en 6 pasos con state(t) puro
// (llegada, acción y pausa); selección de equipos con foco y ficha; dos cortes: "Interior del cono" (pared frontal
// transparente: el cono en sección por su eje, con la cabeza girando excéntrica dentro de la taza) e "Interior de los
// rodillos" (un plano de corte avanza por el HPGR). Los detalles ampliados (A y B) repiten esa geometría.
//
// Geometría (unidades del SVG): isométrica de la infografía, X → (0,866 ; 0,5), Y → (−0,866 ; 0,5), Z → (0 ; −1).
// Las cotas del HPGR y de la tolva salen de los vértices del dibujo (ver README). Las correas avanzan a velocidad
// constante y lo que cambia es la carga (como en planta); el alimentador sí cambia de velocidad (regula la descarga).
import { SIL, CONE_CLIP } from "./secundario-geo.js";
import { createLayers } from "../layers.js";
import { nextTick, cancelTick } from "../clock.js";

const NS = "http://www.w3.org/2000/svg";
const ASSET = new URL("../../assets/secundario/chancado-secundario.svg", import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const f2 = (n) => (Math.round(n * 100) / 100).toString();
const fmt = (n) => Math.round(n).toLocaleString("es-CL");
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- registro e isometría
export const REG = { s: 0.36639, tx: 1948.74, ty: 670.13 };           // ajuste de las líneas del SVG sobre la infografía
const VIEW = [0, 0, 1212.64, 815.31];
const STEP = [132.1, 76.25];                                           // de un módulo al siguiente (152,5 u a lo largo de X)
const off = (m) => [(m - 3) * STEP[0], (m - 3) * STEP[1]];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const iso = (O, k = 1) => ([X, Y, Z]) => [O[0] + k * 0.866 * (X - Y), O[1] + k * (0.5 * (X + Y) - Z)];
const D = (pts) => "M" + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join("L") + "Z";

// índices de las piezas dentro de cada módulo del SVG (ruta de grupos → hijo)
const MODS = [
  { path: [0, 0, 1, 0, 1, 0, 0], plat: 5, motors: [6, 7, 8, 9], housing: 10, slab: 11, funnel: 12, fplat: 13, feeder: 14, hood: 15, hopper: 16, slabR: 17, funnelL: 18, frontL: 19, frame: 20, door: 22, fedges: [23, 24], slabF: 25 },
  { path: [0, 0, 1, 0, 1, 1, 0], plat: 6, motors: [7, 8, 9, 10], housing: 11, slab: 12, funnel: 13, fplat: 14, feeder: 15, hood: 16, hopper: 17, slabR: 18, funnelL: 19, frontL: 20, frame: 21, door: 23, fedges: [24, 25], slabF: 26, prod: [0] },
  { path: [0, 0, 1, 0, 1, 2, 0], plat: 6, motors: [7, 8, 9, 10], housing: 11, slab: 12, funnel: 13, fplat: 14, feeder: 15, hood: 16, hopper: 17, slabR: 18, funnelL: 19, frontL: 20, frame: 21, door: 23, fedges: [24, 25], slabF: 26, prod: [0] },
  { path: [0, 0, 1, 0, 1, 3, 0], plat: 9, motors: [10, 11, 12, 13], housing: 14, slab: 15, funnel: 16, fplat: 17, feeder: 18, hood: 19, hopper: 20, slabR: 21, funnelL: 22, frontL: 24, frame: 25, door: 27, fedges: [28, 29], slabF: 30, prod: [5, 6, 7, 8] },
];

// ---------------------------------------------------------------- recorridos del mineral (módulo 3; los demás con off(m))
const FEED = [[31.7, 35.8], [174.4, 111.2], [541.1, 15]];             // correa: tramo plano + inclinado (eje central)
const DIST0 = [622, 55.6], DIST1 = [1145, 357.6];                      // correa distribuidora sobre los marcos (su cabeza, dentro de la silueta)
const INLET = (m) => add([1082.7, 351], off(m));                       // boca de la caja de alimentación de cada tolva
const distY = (x) => 30.2 + (x - 578) * 0.57735;                       // eje de la distribuidora
const FEEDER = [[1061, 491], [998, 525.5]];                            // alimentador de correa: bajo la tolva → campana
const DROP = (m) => add([999.4, 672.9], off(m));                       // descarga del HPGR sobre la correa de producto
const PROD1 = [1193, 786.4];                                           // fin de la correa de producto
const O3 = [954.49, 628.9];                                            // HPGR m3: esquina frontal‑izq. inferior del cuerpo

function polyline(pts) {
  const S = [0]; for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = S[S.length - 1];
  const at = (s) => { s = clamp(s, 0, len); let i = 1; while (i < S.length - 1 && S[i] < s) i++; const u = (s - S[i - 1]) / (S[i] - S[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]; };
  return { len, at, S };
}
const FEEDP = polyline([...FEED, DIST0, DIST1]);
const P_INCL = FEEDP.S[2], P_DIST = FEEDP.S[3];                        // fin del tramo inclinado · inicio de la distribuidora
const pDropOf = (m) => P_DIST + Math.hypot(INLET(m)[0] - DIST0[0], distY(INLET(m)[0]) - DIST0[1]);
const PRODP = polyline([DROP(0), PROD1]);
const pProdOf = (m) => Math.hypot(DROP(m)[0] - DROP(0)[0], DROP(m)[1] - DROP(0)[1]);
const FEEDERP = polyline(FEEDER);
// la colpa marcada sobre una correa dibujada (módulo 3), o null si va por dentro de un equipo o bajo la plataforma
function beltPoint(stage, u) {
  if (stage === "incl") return FEEDP.at(lerp(14, P_INCL, u));          // desde un poco arriba de la cola (el anillo cabe en la silueta)
  if (stage === "dist") return FEEDP.at(lerp(P_DIST, pDropOf(3), u));
  if (stage === "feeder") return FEEDERP.at(u * FEEDERP.len);
  if (stage === "prod") { const q = PRODP.at(lerp(pProdOf(3), PRODP.len, u)); return q[0] < 1000 ? null : q; }
  return null;
}

// ---------------------------------------------------------------- HPGR: cotas (módulo 3, ejes locales desde O3)
// cuerpo X 0…57,8 · Y −45,8…0 · Z 0…34,74; losa superior X −13,4…69 · Y −46,2…2 · Z 34,74…40 (vértices del dibujo).
// Rodillos con eje en X (los motores del dibujo entran por −X): Ø 18, X 19…39; descansos X 40…48.
const HP = { x: 57.8, y: 45.8, z: 34.74, t: 2.6, slab: [-13.4, 69, -46.2, 2, 34.74, 40], slot: [-27, -18.8],
  r: 9, zc: 16.5, yf: -13.4, yb: -32.4, rx: [19, 39], bx: [40, 48], bhy: 6, bhz: 7 };
// ---------------------------------------------------------------- chancador de conos (en la carcasa del m3)
// Corte por el eje del cono en vista frontal 2D (el plano del eje es paralelo a la pantalla), sobre el revestimiento
// de atrás de la carcasa: se ve a través de la pared frontal transparente. Ubicación y escala medidas en
// assets/secundario/ref-cono.png (la referencia de Emilio, registrada sobre la lámina: 5,354 px por unidad del SVG).
// C(s, z) = [CUT.x + CUT.kx·s, CUT.y − CUT.kz·z], con s = distancia horizontal al eje y z = altura, en unidades del
// cono. Los círculos horizontales (excéntrica, órbita de la zona de cierre) se ven como elipses de alto kz·√½·r.
const CUT = {
  x: 1083.8, y: 459.2,            // eje del cono (X de la lámina, = el cuello impreso de atrás) y altura de la cota z = 0
  kx: 2.344, kz: 1.914,           // unidades del SVG por unidad del cono, en horizontal y en vertical (las de la referencia)
  // marco: el octógono del recorte de la referencia (la parte alta de la carcasa impresa); el corte se recorta con él y
  // con CONE_CLIP (la carcasa impresa encogida un trazo): nada sobresale de lo impreso
  frame: [[1083.8, 329.4], [1123.1, 350.5], [1115, 409.7], [1109.4, 428.4], [1100.1, 439.6], [1075.8, 440.2], [1042.4, 406], [1042.2, 352.4]],
  neckZ: -2,                      // fondo del cuello impreso (Y ≈ 463): hasta ahí bajan los finos, que siguen al alimentador
  neck: [-1.5, 6.5],              // ancho del cuello impreso en unidades del cono (está corrido a la derecha del eje)
};
// medidas del cono (unidades del cono): referenciales; la excentricidad va exagerada para que se vea
const CONE = { z0: 29, z1: 58, zh: 54, zp: 66, rc0: 13.5, rc1: 9, liner: 1.8, bowl: 3.2, gTop: 4.6, e: 1.2,
  nut: [54, 56.6, 3], plate: [56.8, 57.9, 5.6], hub: [4.4, 8.5], ecc: 17, zLev: [28, 72] };
const R2 = Math.SQRT1_2;
const C = (x, z) => [CUT.x + CUT.kx * x, CUT.y - CUT.kz * z];
// punto de un círculo horizontal del cono (radio r, altura z, ángulo a), con el centro corrido rc0 en el ángulo a0
const orb = (r, z, a, rc0 = 0, a0 = 0) => {
  const u = a + Math.PI / 4, v = a0 + Math.PI / 4;
  return [CUT.x + CUT.kx * (rc0 * Math.cos(v) + r * Math.cos(u)), CUT.y - CUT.kz * z + CUT.kz * R2 * (rc0 * Math.sin(v) + r * Math.sin(u))];
};
const rc = (z) => lerp(CONE.rc0, CONE.rc1, (z - CONE.z0) / (CONE.z1 - CONE.z0));              // cara interior del cóncavo
const cssU = (css) => 0.6 + ((css - 25) / 20) * 1.2;                                          // CSS en unidades del cono
const gapAt = (z, css) => lerp(cssU(css) + CONE.e, CONE.gTop, clamp((z - CONE.z0) / (CONE.zh - CONE.z0)));
const rh = (z, css) => rc(z) - gapAt(z, css);                                                // cara exterior del manto
const sway = (z) => (CONE.zp - z) / (CONE.zp - CONE.z0);                                      // la base se mueve más que la punta
const wallS = (z) => (z <= CONE.z1 ? rc(z) : rc(CONE.z1) + (z - CONE.z1) * 0.55);             // pared: cóncavo y, arriba, la tolva
const levelZ = (l) => lerp(CONE.zLev[0], CONE.zLev[1], l);
export const NUT_LEVEL = (CONE.nut[1] - CONE.zLev[0]) / (CONE.zLev[1] - CONE.zLev[0]);        // bajo esto: alimentación por goteo

// ---------------------------------------------------------------- modelo
const FEEDER_NOM = 2790, FEEDER_MAX = 3700;                            // t/h por línea (alimentador de correa típico)
const FEED_MIN = 6000, FEED_MAX = 13000;
const CSS_MIN = 25, CSS_MAX = 45, CSS_NOM = 35;
// capacidad del cono ahogado por línea (referencial): menor CSS, algo menos de capacidad; producto P80 ~1,2 × CSS
export const coneCap = (css) => 3100 * (css / CSS_NOM) ** 0.6;
export const p80 = (css) => Math.round(css * 1.2);
const CHOKE = 0.95;                                                    // nivel desde el que el cono saca toda su capacidad
const V_BELT = 60, V_PROD = 46;                                        // u/s en pantalla (velocidad constante)
const OMEGA = 1.4;                                                     // rad/s de los rodillos (visual)
const OMEGA_G = Math.PI * 2 * 0.75;                                    // giro excéntrico de la cabeza (visual; real ~4–5 vueltas/s)

// ---------------------------------------------------------------- "sigue una colpa" (state(t) puro)
// Cada paso: llegada (ARRIVE s: se ilumina el equipo y el resto baja a ~35 %), acción (tramos) y pausa (HOLD s con el
// resultado a la vista). `cut`: en esos pasos el corte del cono se abre solo.
const ARRIVE = 0.5, HOLD = 1.2;
const SEQ = [
  { id: "alim", lit: ["alim"], label: "La correa inclinada sube el mineral del primario", act: [["incl", 6]] },
  { id: "alim", lit: ["alim"], label: "La distribuidora lo reparte entre los 4 conos", act: [["head", 0.6], ["dist", 3.6]] },
  { id: "cono", lit: ["cono"], label: "La tolva mantiene el cono ahogado", act: [["fall", 0.7], ["bin", 3.3]], cut: true },
  { id: "cono", lit: ["cono"], label: "El manto gira excéntrico y comprime la roca contra el cóncavo", act: [["cone", 4.4], ["chute", 1.2]], cut: true },
  { id: "alimentador", lit: ["alimentador", "hpgr"], label: "El alimentador regula y los rodillos del HPGR la comprimen", act: [["feeder", 3.5], ["hood", 1], ["nip", 2.5]] },
  { id: "producto", lit: ["producto"], label: "Sale fina por la correa de producto", act: [["under", 1], ["prod", 4.5]] },
];
export const STEPS = [];
{
  let t = 0;
  SEQ.forEach((q, i) => {
    const t0 = t, ta = t0 + ARRIVE; let x = ta;
    const stages = q.act.map(([k, d]) => { const r = { k, a: x, b: x + d }; x += d; return r; });
    t = x + HOLD;
    STEPS.push({ n: i + 1, id: q.id, lit: q.lit, label: q.label, cut: !!q.cut, t0, ta, th: x, t1: t, stages });
  });
}
export const PERIOD = STEPS[STEPS.length - 1].t1;
const wrap = (t) => ((t % PERIOD) + PERIOD) % PERIOD;
const stepAt = (t) => { t = wrap(t); return STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1]; };
// estado de la secuencia en el tiempo t: paso, fase, tramo y su avance, cuánto va la llegada y cuán abierto el cono
export function state(t) {
  t = wrap(t);
  const step = stepAt(t), first = step.stages[0], last = step.stages[step.stages.length - 1];
  let ph = "act", sg = first, u = 0;
  if (t < step.ta) ph = "arrive";
  else if (t >= step.th) { ph = "hold"; sg = last; u = 1; }
  else { sg = step.stages.find((r) => t < r.b) || last; u = clamp((t - sg.a) / (sg.b - sg.a)); }
  const prev = STEPS[(step.n + STEPS.length - 2) % STEPS.length], k = smooth((t - step.t0) / ARRIVE);
  const open = step.cut ? (prev.cut ? 1 : k) : prev.cut ? 1 - k : 0;
  return { t, step, phase: ph, stage: sg.k, u, arrive: k, open };
}

// ---------------------------------------------------------------- fichas
const EQUIP = {
  alim: { kicker: "Transporte", title: "Correas de alimentación", text: "La correa inclinada sube el mineral del chancado primario hasta la casa de traspaso y la correa distribuidora, sobre los marcos, lo reparte entre los cuatro chancadores de conos.",
    specs: (s) => [`Alimentación ${fmt(s.feed)} t/h`, "Velocidad constante", "4 líneas en paralelo"] },
  cono: { kicker: "Chancado secundario", title: "Chancador de conos", text: "Recibe el mineral del chancado primario en su tolva, que lo mantiene ahogado. La cabeza, con su manto, gira de forma excéntrica dentro de la taza: el espacio con el cóncavo se cierra y se abre, y la roca se fractura por compresión mientras baja. La abertura mínima (CSS) fija el tamaño del producto, que cae al alimentador del HPGR.",
    specs: (s) => [`CSS ~${Math.round(s.css)} mm`, "Razón de reducción ~3–5:1", "Alimentación ahogada", `Tolva ${Math.round(s.level * 100)} % · ${fmt(s.draw)} t/h · P80 ~${p80(s.css)} mm (referencial)`] },
  alimentador: { kicker: "Regulación", title: "Alimentador del HPGR", text: "El cuello bajo el cono y la correa corta con rodillos. Cambia su velocidad para entregar a los rodillos un flujo parejo, al ritmo que produce el chancador de conos, y mantener el HPGR ahogado.",
    specs: (s) => [`${fmt(s.draw)} t/h`, `Velocidad ${Math.round((s.draw / FEEDER_MAX) * 100)} %`, `Máx. ~${fmt(FEEDER_MAX)} t/h`] },
  hpgr: { kicker: "Chancado terciario", title: "HPGR · rodillos de alta presión", text: "Dos rodillos giran en sentidos opuestos: uno fijo y otro flotante empujado por cilindros hidráulicos. El mineral se comprime en lecho entre ellos y sale como un queque fracturado.",
    specs: (s) => [`${fmt(s.draw)} t/h por línea`, `Gap ${f1(18 + s.gap * 14)} mm`, "Presión ~4 N/mm²"] },
  producto: { kicker: "Transporte de producto", title: "Correa de producto", text: "Recibe el producto de los cuatro HPGR bajo las plataformas y lo lleva a la siguiente etapa (harneado y molienda).",
    specs: (s) => [`${fmt(s.draw * 4)} t/h`, "Producto bajo ~6 mm", "Velocidad constante"] },
};
const ORDER = ["alim", "cono", "alimentador", "hpgr", "producto"];

// ---------------------------------------------------------------- utilidades SVG
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
// reescribe una capa del dibujo sólo si su marcado cambió (muchas salen idénticas cuadro a cuadro: fondo, rieles…)
const setHTML = (n, s) => { if (n.__html !== s) { n.__html = s; n.innerHTML = s; } };
const ROCK = ["M-1.6 -.6L-.3 -1.7L1.4 -1.1L1.7 .6L.1 1.6L-1.4 1Z", "M-1.3 -1.2L1 -1.4L1.6 .4L.2 1.4L-1.6 .6Z", "M-1.7 0L-.7 -1.5L1.2 -1.4L1.4 1L-.6 1.4Z"];
function pool(parent, n, cls, k = 1) { return Array.from({ length: n }, (_, i) => el("path", { d: ROCK[i % 3], class: cls, "data-k": k }, parent)); }
const put = (r, p, sc, rot = 0, o = 1) => { if (!p || o <= 0.01) { r.style.opacity = 0; return; } r.setAttribute("transform", `translate(${f1(p[0])} ${f1(p[1])}) rotate(${Math.round(rot)}) scale(${f1(sc)})`); r.style.opacity = o.toFixed(2); };
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };

// ---------------------------------------------------------------- HPGR en corte (string SVG, proyección P)
// Xc = posición del plano de corte (69 = sin corte). Todo lo que queda con X > Xc se quita.
function hpgrSvg(P, Xc, s, tour, k = 1, doorT = "") {
  const out = [];
  const Xh = Math.min(Xc, HP.x), cut = Xc < HP.x - 0.01, z0 = 0, z1 = HP.z;
  const quadY = (y, x0, x1, za, zb) => D([P([x0, y, za]), P([x1, y, za]), P([x1, y, zb]), P([x0, y, zb])]);
  const quadX = (x, y0, y1, za, zb) => D([P([x, y0, za]), P([x, y1, za]), P([x, y1, zb]), P([x, y0, zb])]);
  const quadZ = (z, x0, x1, y0, y1) => D([P([x0, y1, z]), P([x1, y1, z]), P([x1, y0, z]), P([x0, y0, z])]);
  // caras exteriores del cuerpo
  out.push(`<path class="hp-f" d="${quadY(0, 0, Xh, z0, z1)}"/>`);
  if (!cut) out.push(`<path class="hp-f" d="${quadX(HP.x, -HP.y, 0, z0, z1)}"/>`);
  out.push(`<g transform="${doorT}"><use href="#sc-door" class="hp-door" clip-path="url(#sc-doorclip)"/></g>`);
  if (cut) {
    const t = HP.t, iy0 = -HP.y + t, iy1 = -t, iz0 = t, iz1 = HP.z - t;
    const win = [P([Xc, iy0, iz0]), P([Xc, iy1, iz0]), P([Xc, iy1, iz1]), P([Xc, iy0, iz1])];
    const id = `hpw${k === 1 ? "" : "k"}`;
    out.push(`<clipPath id="${id}"><path d="${D(win)}"/></clipPath><path class="hp-void" d="${D(win)}"/><g clip-path="url(#${id})">`);
    const items = [];
    const yb = HP.yb - s.gap * 0.8;
    // rodillos (cilindros con eje X), su cara frontal en x1 = min(39, Xc)
    for (const [yc, dir, name] of [[yb, -1, "b"], [HP.yf, 1, "f"]]) {
      const x1 = Math.min(HP.rx[1], Xc), circ = (x) => Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2; return P([x, yc + HP.r * Math.cos(a), HP.zc + HP.r * Math.sin(a)]); });
      const hull = convexHull([...circ(HP.rx[0]), ...circ(x1)]);
      let g = `<path class="hp-roll" d="${D(hull)}"/><path class="${x1 < HP.rx[1] ? "hp-sec" : "hp-roll"}" d="${D(circ(x1))}"/>`;
      // estrías / pernos del revestimiento (giran: fijo +ω, flotante −ω, así ambos bajan en la garganta)
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + dir * s.rot, q = P([x1, yc + (HP.r - 1.2) * Math.cos(a), HP.zc + (HP.r - 1.2) * Math.sin(a)]);
        g += `<circle class="hp-stud" cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(0.55 * k)}"/>`;
      }
      const a0 = dir * s.rot, m0 = P([x1, yc, HP.zc]), m1 = P([x1, yc + (HP.r - 2.5) * Math.cos(a0), HP.zc + (HP.r - 2.5) * Math.sin(a0)]);
      g += `<path class="hp-mark" d="M${f1(m0[0])} ${f1(m0[1])}L${f1(m1[0])} ${f1(m1[1])}"/>`;
      const sh = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return P([x1, yc + 2.6 * Math.cos(a), HP.zc + 2.6 * Math.sin(a)]); });
      g += `<path class="hp-shaft" d="${D(sh)}"/>`;
      items.push({ z: x1 + yc + HP.zc - 100, svg: g, name });
    }
    // material: columna de alimentación, lecho comprimido entre los rodillos y queque bajo la garganta
    const xm = Math.min(Xc - 0.15, HP.rx[1] + 0.1), gapY0 = HP.yf - HP.r, gapY1 = yb + HP.r;
    const edgeF = (z) => HP.yf - Math.sqrt(Math.max(0, HP.r * HP.r - (z - HP.zc) ** 2));
    const edgeB = (z) => yb + Math.sqrt(Math.max(0, HP.r * HP.r - (z - HP.zc) ** 2));
    let mat = "";
    const zTop = HP.zc + HP.r * 0.92, load = clamp(s.draw / FEEDER_NOM, 0.15, 1.2);
    const bed = [];
    for (let z = zTop; z >= HP.zc; z -= 0.8) bed.push(P([xm, edgeB(z), z]));
    for (let z = HP.zc; z <= zTop; z += 0.8) bed.push(P([xm, edgeF(z), z]));
    mat += `<path class="hp-bed" d="${D(bed)}"/>`;
    const cake = [P([xm, gapY1, HP.zc]), P([xm, gapY0, HP.zc]), P([xm, gapY0 + 0.4, 8]), P([xm, gapY0 + 1.6, 3]), P([xm, gapY1 - 1.6, 3]), P([xm, gapY1 - 0.4, 8])];
    mat += `<path class="hp-cake" d="${D(cake)}"/>`;
    for (let i = 0; i < 4; i++) { const zz = 13.5 - i * 2.8 - ((s.flow * 0.9) % 2.8); const a = P([xm, gapY1 - 0.3, zz]), b = P([xm, gapY0 + 0.3, zz - 0.6]); mat += `<path class="hp-crack" d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}"/>`; }
    // colpas: caen por la ranura, se meten en el lecho y se achican hacia la garganta
    for (let i = 0; i < 12; i++) {
      const ph = (s.flow * 0.32 + i / 12) % 1; if (hash(i + Math.floor(s.flow * 0.32)) > 0.35 + 0.6 * load) continue;
      const z = lerp(HP.z + 2, HP.zc + 1, ph), wy = z > zTop ? [HP.slot[0] + 1.5, HP.slot[1] - 1.5] : [edgeB(z) + 1.4, edgeF(z) - 1.4];
      const q = P([xm, lerp(wy[0], wy[1], hash(i * 7.3)), z]), sz = lerp(1.25, 0.45, smooth((zTop - z) / (zTop - HP.zc))) * k;
      mat += `<path class="hp-rock" transform="translate(${f1(q[0])} ${f1(q[1])}) rotate(${Math.round(ph * 200 + i * 40)}) scale(${f1(sz)})" d="${ROCK[i % 3]}"/>`;
    }
    // fragmentos que caen del queque por la abertura del piso
    for (let i = 0; i < 6; i++) { const ph = (s.flow * 0.5 + i / 6) % 1, z = lerp(3.5, -1, ph), q = P([xm, lerp(gapY1, gapY0, hash(i * 3.1)), z]);
      mat += `<path class="hp-rock hp-rock--fine" transform="translate(${f1(q[0])} ${f1(q[1])}) rotate(${i * 60}) scale(${f1(0.5 * k)})" d="${ROCK[i % 3]}"/>`; }
    // la colpa que se sigue (paso 5)
    if (tour.stage === "nip") {
      const u = tour.u, z = u < 0.35 ? lerp(HP.z + 2, zTop, u / 0.35) : lerp(zTop, 4, (u - 0.35) / 0.65);
      const yy = z > zTop ? -22.9 : -22.9 + (edgeF(Math.max(z, HP.zc)) - edgeB(Math.max(z, HP.zc))) * 0;
      if (u < 0.55) { const q = P([xm, yy, z]); mat += `<g class="sc-tour-in" transform="translate(${f1(q[0])} ${f1(q[1])})"><circle r="${f1(3.2 * k)}" class="sc-tour-ring"/><path d="${ROCK[0]}" transform="scale(${f1(1.6 * k * (1 - smooth((u - 0.35) / 0.2) * 0.5))})" class="sc-tour-rock"/></g>`; }
      else for (let j = 0; j < 5; j++) { const q = P([xm, -22.9 + (j - 2) * 0.35, z - j * 0.9]); mat += `<path class="sc-tour-rock" transform="translate(${f1(q[0])} ${f1(q[1])}) scale(${f1(0.55 * k)})" d="${ROCK[j % 3]}"/>`; }
    }
    items.push({ z: xm + (gapY0 + gapY1) / 2 + HP.zc - 99, svg: mat });
    // descansos (cajas de rodamientos) y cilindros hidráulicos del rodillo flotante
    if (Xc > HP.bx[0]) {
      const x1 = Math.min(HP.bx[1], Xc), sec = x1 < HP.bx[1];
      for (const [yc, name] of [[yb, "b"], [HP.yf, "f"]]) {
        const y0 = yc - HP.bhy, y1 = yc + HP.bhy, za = HP.zc - HP.bhz, zb = HP.zc + HP.bhz;
        let g = `<path class="hp-f" d="${quadY(y1, HP.bx[0], x1, za, zb)}"/><path class="hp-f" d="${quadZ(zb, HP.bx[0], x1, y0, y1)}"/><path class="${sec ? "hp-sec" : "hp-f"}" d="${quadX(x1, y0, y1, za, zb)}"/>`;
        const sh = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return P([x1, yc + 2.6 * Math.cos(a), HP.zc + 2.6 * Math.sin(a)]); });
        g += `<path class="${sec ? "hp-shaft-sec" : "hp-shaft"}" d="${D(sh)}"/>`;
        if (name === "b") { // cilindros: de la pared trasera al descanso flotante
          for (const dz of [-4, 4]) { const xa = Math.min(HP.bx[0] + 3, x1), xb = Math.min(HP.bx[0] + 5, x1); if (xb <= xa) continue;
            g = `<path class="hp-cyl" d="${quadZ(HP.zc + dz + 1, xa, xb, -HP.y + HP.t, y0)}"/><path class="hp-cyl" d="${quadX(xb, -HP.y + HP.t, y0, HP.zc + dz - 1, HP.zc + dz + 1)}"/>` + g; }
        } else { // separador del rodillo fijo contra la pared frontal
          const xa = HP.bx[0] + 1, xb = Math.min(HP.bx[1] - 1, x1); if (xb > xa) g += `<path class="hp-f" d="${quadZ(HP.zc + 3, xa, xb, y1, -HP.t)}"/><path class="hp-f" d="${quadX(xb, y1, -HP.t, HP.zc - 3, HP.zc + 3)}"/>`;
        }
        items.push({ z: (HP.bx[0] + x1) / 2 + yc + HP.zc, svg: g });
      }
    }
    items.sort((a, b) => a.z - b.z).forEach((it) => out.push(it.svg));
    out.push("</g>");
    // sección de las paredes (anillo) con la ranura de alimentación y la abertura de descarga
    const inSlot = Xc > HP.rx[0] - 2 && Xc < HP.rx[1] + 2;
    const inner = [[iy0, iz0], [-26, iz0], [-26, 0.01], [-19.8, 0.01], [-19.8, iz0], [iy1, iz0], [iy1, iz1], ...(inSlot ? [[HP.slot[1], iz1], [HP.slot[1], HP.z], [HP.slot[0], HP.z], [HP.slot[0], iz1]] : []), [iy0, iz1]];
    out.push(`<path class="hp-sec" fill-rule="evenodd" d="${quadX(Xc, -HP.y, 0, 0, HP.z)}${D(inner.map(([y, z]) => P([Xc, y, z])))}"/>`);
  }
  // losa superior (cortada en el mismo plano)
  const [sx0, sx1, sy0, sy1, sz0, sz1] = HP.slab, Xs = Math.min(sx1, Xc), scut = Xs < sx1;
  out.push(`<path class="hp-f" d="${quadY(sy1, sx0, Xs, sz0, sz1)}"/><path class="hp-f" d="${quadZ(sz1, sx0, Xs, sy0, sy1)}"/>`);
  if (scut && Xs > HP.rx[0] - 2 && Xs < HP.rx[1] + 2) out.push(`<path class="hp-sec" d="${quadX(Xs, sy0, HP.slot[0], sz0, sz1)}"/><path class="hp-sec" d="${quadX(Xs, HP.slot[1], sy1, sz0, sz1)}"/>`);
  else out.push(`<path class="${scut ? "hp-sec" : "hp-f"}" d="${quadX(Xs, sy0, sy1, sz0, sz1)}"/>`);
  return out.join("");
}
function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/// ---------------------------------------------------------------- interior del cono (string SVG)
// Recortado por el marco y la carcasa impresa (clipPath cn-frame y cn-clip, en defs). Cabeza: el eje describe un
// círculo chico (no rota como rueda), así el espacio con el cóncavo se cierra de un lado y se abre en el opuesto; la
// zona de cierre recorre toda la cámara (se marca en la órbita de la base). Mineral ahogado sobre el manto; las colpas
// bajan por la cámara, se achican y caen finas por el chute y el cuello (éstas sólo con el recorte de la carcasa).
const zs = (a, b, n = 6) => Array.from({ length: n + 1 }, (_, i) => lerp(a, b, i / n));
// geometría del cono que depende del estado (la usan el dibujo, la colpa marcada y los rótulos del zoom)
function coneGeo(s) {
  const css = s.css, G0 = cssU(css) + CONE.e, sw = CONE.e * Math.cos(s.gyr + Math.PI / 4); // corrimiento hacia +s (derecha)
  const off = (z) => sw * sway(z), zl = levelZ(s.level);
  const head = (sg, z) => sg * rh(z, css) + off(z), mid = (sg, z) => (head(sg, z) + sg * rc(z)) / 2;
  const heap = (x) => zl + 2.2 * Math.max(0, 1 - Math.abs(x) / 9);
  // chorro de finos bajo la cámara (el chute): rodea el buje y entra al cuello impreso, hasta su fondo
  const z9 = CUT.neckZ, [n0, n1] = CUT.neck;
  const fall = (sg, v, j = 0) => { const z = lerp(CONE.z0 - 0.5, z9, v), x0 = sg * (rc(CONE.z0) - G0 / 2), xh = sg * (CONE.hub[0] + 1.2);
    return [z > CONE.hub[1] ? lerp(x0, xh, (CONE.z0 - z) / (CONE.z0 - CONE.hub[1])) : lerp(xh, lerp(n0 + 0.6, n1 - 0.6, 0.5 + j), smooth((CONE.hub[1] - z) / (CONE.hub[1] - z9))), z]; };
  const rm = rc(CONE.z0 + 1) - G0 / 2, zo = CONE.z0 + 0.6;                 // órbita de la zona de cierre (base de la cámara)
  return { css, G0, off, zl, head, mid, heap, fall, rm, zo, closing: orb(rm, zo, s.gyr) };
}
function coneSvg(s, tour) {
  const k = CUT.kz;                                                       // las colpas, a la escala del corte
  const Dp = (pts) => D(pts.map(([x, z]) => C(x, z)));
  const ln = (a, b, cls) => { const p = C(...a), q = C(...b); return `<path class="${cls}" d="M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}"/>`; };
  const rk = (x, z, sc, rot, i, cls = "hb-rock") => { const q = C(x, z); return `<path class="${cls}" transform="translate(${f1(q[0])} ${f1(q[1])}) rotate(${Math.round(rot)}) scale(${f1(sc * k)})" d="${ROCK[i % 3]}"/>`; };
  const ring = (r, z, n = 20, rc0 = 0, a0 = 0) => D(Array.from({ length: n }, (_, i) => orb(r, z, (i / n) * Math.PI * 2, rc0, a0)));
  const g = coneGeo(s), { css, G0, off, zl, head, mid, heap } = g, { z0: Z0, z1: Z1, zh: ZH, liner: L, bowl: B } = CONE;
  // revestimiento de atrás (el fondo del marco)
  const out = [`<g clip-path="url(#cn-clip)"><g clip-path="url(#cn-frame)">`, `<path class="hb-wall" d="${D(CUT.frame)}"/>`];
  // taza, cóncavo y bastidor con el embudo de descarga hacia el cuello (en sección)
  for (const sg of [-1, 1]) {
    const zz = zs(Z0 - 2, Z1 + 2), zc = zs(Z0, Z1), top = sg * (rc(Z0 - 2) + L), bot = sg * (CONE.hub[0] + 4);
    out.push(`<path class="cn-sec" d="${Dp([...zz.map((z) => [sg * (rc(z) + L), z]), ...zz.slice().reverse().map((z) => [sg * (rc(z) + L + B), z])])}"/>`);
    out.push(`<path class="cn-sec" d="${Dp([[top, Z0 - 2], [bot, CUT.neckZ], [bot + sg * 3, CUT.neckZ], [top + sg * B, Z0 - 2]])}"/>`);
    out.push(`<path class="cn-liner" d="${Dp([...zc.map((z) => [sg * rc(z), z]), ...zc.slice().reverse().map((z) => [sg * (rc(z) + L), z])])}"/>`);
  }
  // mineral: llena la cámara y, si alcanza, tapa el manto, la tuerca y el plato (alimentación ahogada)
  const zt = Math.max(Z0 + 0.5, zl), mat = [];
  for (const z of zs(Z0, zt)) mat.push([-wallS(z), z]);
  for (let i = 0; i <= 12; i++) { const x = lerp(-wallS(zt), wallS(zt), i / 12); mat.push([x, heap(x)]); }
  for (const z of zs(zt, Z0)) mat.push([wallS(z), z]);
  out.push(`<path class="hb-bed" d="${Dp(mat)}"/>`);
  // colpas sobre el manto, bajando con la descarga
  const stp = 3.4, dz = (s.mass * 3) % stp;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    const z = ZH - 1 + r * stp - dz + (c % 2) * 1.5, ws = wallS(z) - 1.3, x = lerp(-ws, ws, (c + 0.5) / 7 + (hash(r * 9 + c) - 0.5) * 0.06);
    if (z > heap(x) - 1 || (Math.abs(x - off(z)) < rh(Math.min(z, ZH), css) + 0.9 && z < CONE.plate[1] + 1)) continue;
    out.push(rk(x, z, 0.95 + hash(c * 3 + r) * 0.3, hash(r * 31 + c) * 360, r + c));
  }
  // cámara: las colpas bajan entre manto y cóncavo y se achican; donde el espacio se cierra, se fracturan
  const load = clamp(s.draw / FEEDER_NOM, 0.15, 1.2);
  for (const sg of [-1, 1]) for (let i = 0; i < 9; i++) {
    const v = (s.flow * 0.22 + i / 9 + (sg > 0 ? 0.055 : 0)) % 1, z = lerp(ZH + 0.5, Z0 + 0.4, v);
    if (z > zl) continue;
    const gap = Math.abs(sg * rc(z) - head(sg, z)), sz = Math.max(0.22, Math.min(lerp(1.1, 0.25 + cssU(css) * 0.22, v), gap * 0.3));
    out.push(rk(mid(sg, z), z, sz, v * 260 + i * 47, i));
    if (gap < G0 * 0.8 && z < Z0 + 9) out.push(ln([head(sg, z), z + 0.3], [sg * rc(z), z - 0.5], "hp-crack"));
  }
  // chorro de alimentación desde la tolva, sobre el plato
  for (let i = 0; i < 6; i++) {
    const ph = (s.feedS * 0.03 + i / 6) % 1; if (s.level > 0.97 || hash(i + Math.floor(s.feedS * 0.03)) > s.feed / FEED_MAX + 0.05) continue;
    const zt2 = Math.max(heap(0), CONE.plate[1]) + 1.2;
    out.push(rk((hash(i) - 0.5) * 5, lerp(78, zt2, ph * ph), 1.15, ph * 300 + i * 50, i));
  }
  // buje de la excéntrica (sección) y la excéntrica que gira: su centro describe el círculo
  out.push(`<path class="cn-sec" d="${Dp([[-CONE.hub[0], CONE.hub[1]], [CONE.hub[0], CONE.hub[1]], [CONE.hub[0], Z0 - 1.6], [-CONE.hub[0], Z0 - 1.6]])}"/>`);
  out.push(`<path class="cn-ecc" d="${ring(3.2, CONE.ecc)}"/>`);
  out.push(`<path class="cn-ecc-in" d="${ring(1.8, CONE.ecc, 14, 1.2, s.gyr)}"/>`);
  // cabeza con su manto, eje, tuerca del manto y plato de alimentación
  const zb = Z0 - 1.2, hz = zs(Z0, ZH, 8);
  out.push(`<path class="cn-head" d="${Dp([[head(-1, Z0), zb], ...hz.map((z) => [head(-1, z), z]), ...hz.slice().reverse().map((z) => [head(1, z), z]), [head(1, Z0), zb]])}"/>`);
  out.push(ln([off(CONE.ecc), CONE.ecc], [off(ZH), ZH], "cn-shaft"));
  for (const sg of [-1, 1]) out.push(`<path class="cn-liner" d="${Dp([...hz.map((z) => [head(sg, z), z]), ...hz.slice().reverse().map((z) => [head(sg, z) - sg * 1.4, z])])}"/>`);
  const [n0, n1, nr] = CONE.nut, [p0, p1, pr] = CONE.plate, on = off(n1), op = off(p1);
  out.push(`<path class="cn-nut${zl < n1 ? " cn-nut--bare" : ""}" d="${Dp([[-nr + on, n0], [nr + on, n0], [nr * 0.8 + on, n1], [-nr * 0.8 + on, n1]])}"/>`);
  out.push(`<path class="cn-plate" d="${Dp([[-pr + op, p0], [pr + op, p0], [pr + op, p1], [-pr + op, p1]])}"/>`);
  // zona de cierre: órbita en la base de la cámara y el tramo donde el manto está más cerca del cóncavo
  out.push(`<path class="cn-orbit" d="${ring(g.rm, g.zo, 36)}"/>`);
  const arc = Array.from({ length: 9 }, (_, i) => orb(g.rm, g.zo, s.gyr - 0.55 + (i / 8) * 1.1));
  out.push(`<path class="cn-close" d="M${arc.map((p) => `${f1(p[0])} ${f1(p[1])}`).join("L")}"/>`);
  // nivel en la pared
  out.push(ln([-wallS(zl), zl], [wallS(zl), zl], "hb-level"));
  // la colpa que se sigue: paso 3 cae a la tolva y baja con el lecho; paso 4 baja por la cámara
  const ring2 = (x, z, r) => { const q = C(x, z); return `<circle class="sc-tour-ring" cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(r * k)}"/>`; };
  if (tour.stage === "bin" || tour.stage === "cone") {
    const u = tour.u, ent = [mid(-1, ZH + 0.4), ZH + 0.4];
    if (tour.stage === "bin") {
      const top = Math.max(heap(-2), ZH + 1), x = u < 0.2 ? -2 : lerp(-2, ent[0], smooth((u - 0.2) / 0.8)), z = u < 0.2 ? lerp(76, top, (u / 0.2) ** 2) : lerp(top, ent[1], smooth((u - 0.2) / 0.8));
      out.push(ring2(x, z, 3.2), rk(x, z, 1.3, u * 120, 0, "sc-tour-rock"));
    } else {
      const z = lerp(ent[1], Z0 + 0.3, u), x = mid(-1, z);
      out.push(ring2(x, z, 3));
      if (u < 0.75) out.push(rk(x, z, lerp(1.25, 0.8, u / 0.75), u * 200, 0, "sc-tour-rock"));
      else for (let j = 0; j < 4; j++) out.push(rk(x + (j - 1.5) * 0.5, z + (j % 2) * 0.7 - (j > 1 ? 0.6 : 0), 0.45 + cssU(css) * 0.12, j * 80, j, "sc-tour-rock"));
    }
  }
  // finos que caen por el chute: dentro del marco mientras bajan por la taza; bajo el marco, por el cuello impreso
  const neck = [];
  for (let i = 0; i < 12; i++) {
    const ph = (s.flow * 0.5 + i / 12) % 1; if (hash(i + Math.floor(s.flow * 0.5)) > 0.3 + 0.6 * load) continue;
    const [x, z] = g.fall(i % 2 ? 1 : -1, ph, hash(i * 3.7) - 0.5);
    (z > CONE.hub[1] ? out : neck).push(rk(x, z, 0.28 + cssU(css) * 0.12, i * 60, i, "hp-rock hp-rock--fine"));
  }
  out.push("</g>", ...neck);
  // paso 4, al final: la colpa ya fina baja por el chute y el cuello
  if (tour.stage === "chute") {
    const [x, z] = g.fall(-1, tour.u);
    out.push(ring2(x, z, 2.8));
    for (let j = 0; j < 4; j++) out.push(rk(x + (j - 1.5) * 0.6, z + j * 0.5, 0.4 + cssU(css) * 0.1, j * 80, j, "sc-tour-rock"));
  }
  out.push("</g>");
  return out.join("");
}

// ---------------------------------------------------------------- lámina
export async function createSecundario() {
  const root = document.createElement("div");
  root.className = "sec-plate";
  root.style.cssText = `position:absolute;left:${f1(REG.tx)}px;top:${f1(REG.ty)}px;width:${f1(VIEW[2] * REG.s)}px;height:${f1(VIEW[3] * REG.s)}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "sc-svg", role: "group", tabindex: "0",
    "aria-label": "Chancado secundario y terciario: el mineral sube por la correa, se reparte entre cuatro chancadores de conos, los alimentadores lo llevan a los rodillos HPGR y sale por la correa de producto. Espacio pausa; coma y punto cambian de paso; 1 a 5 eligen un equipo." }, root);
  const defs = el("defs", {}, svg);
  el("path", { d: SIL, class: "sc-sil" }, svg);

  // dibujo de Emilio
  const text = await (await fetch(ASSET)).text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  doc.querySelectorAll("metadata, title, desc").forEach((n) => n.remove());
  const st = doc.querySelector("style"); if (st) el("style", {}, defs).textContent = st.textContent.replace(/\.cls-(\d+)/g, ".scd-cls-$1");
  doc.querySelectorAll("[class]").forEach((n) => n.setAttribute("class", n.getAttribute("class").replace(/\bcls-(\d+)/g, "scd-cls-$1")));
  doc.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  const art = el("g", { class: "sc-art" }, svg);
  [...doc.children].filter((n) => !["defs", "style"].includes(n.tagName)).forEach((n) => art.appendChild(document.importNode(n, true)));
  const kids = (n) => [...n.children].filter((c) => !["defs", "style", "title"].includes(c.tagName));
  const at = (path) => path.reduce((n, i) => kids(n)[i], art);
  const tag = (n, eq) => n && n.setAttribute("data-eq", eq);

  // equipos (para el foco): correa inclinada y largueros de la correa de producto
  const conv = at([0, 0, 1, 0, 0]);
  tag(conv, "alim"); kids(conv).slice(8, 10).forEach((n) => tag(n, "producto"));
  tag(at([0, 0, 0]), "producto");
  const mods = MODS.map((M, m) => {
    const g = at(M.path), c = kids(g);
    [...M.motors, M.housing, M.slab, M.funnel, M.slabR, M.funnelL, M.frontL, M.frame, M.door, M.slabF].forEach((i) => tag(c[i], "hpgr"));
    [M.fplat, M.feeder, M.hood, ...M.fedges].forEach((i) => tag(c[i], "alimentador"));
    // tolva (caja de arriba) y carcasa: el chancador de conos; el cuello bajo la carcasa (sus 4 primeras caras) va
    // con el alimentador del HPGR
    tag(c[M.hopper], "cono");
    kids(kids(c[M.hopper])[1]).slice(0, 4).forEach((n) => tag(n, "alimentador"));
    (M.prod || []).forEach((i) => tag(c[i], "producto"));
    // capa de colpas del alimentador: bajo la campana, sobre la correa
    const fl = el("g", { class: "sc-rocks" }); c[M.hood].before(fl);
    return { g, c, fl, rocks: pool(fl, 9, "sc-rock") };
  });
  const M3 = mods[3], c3 = M3.c, K3 = MODS[3];

  // HPGR del módulo 3: se reemplaza el cuerpo y la losa dibujados por los mismos volúmenes en 3D (cortables)
  const doorSrc = el("g", { id: "sc-door" }, defs);
  doorSrc.appendChild(c3[K3.frame].cloneNode(true)); doorSrc.appendChild(c3[K3.door].cloneNode(true));
  [K3.housing, K3.slab, K3.slabR, K3.slabF, K3.frontL, K3.frame, K3.door].forEach((i) => (c3[i].style.display = "none"));
  const doorClip = el("clipPath", { id: "sc-doorclip" }, defs); const doorRect = el("rect", { x: 0, y: 0, width: 0, height: 900 }, doorClip);
  const hpG = el("g", { class: "sc-hpgr", "data-eq": "hpgr" }); c3[K3.housing].before(hpG);
  // producto sobre la correa (bajo la plataforma del módulo 3)
  const prodL = el("g", { class: "sc-rocks" }); c3[K3.plat].before(prodL);
  const prodRocks = pool(prodL, 34, "sc-rock sc-rock--fine");
  // corte del cono del módulo 3: encima de todo el dibujo impreso (se ve a través de la pared frontal; ninguna pieza
  // de adelante lo tapa ni lo destiñe), recortado por la carcasa (CONE_CLIP: la carcasa impresa encogida un trazo, así
  // su contorno queda a la vista) y por el marco. Bajo la distribuidora: lo que cae a la tolva pasa por delante.
  const hopIn = el("g", { class: "sc-hopper-in" }); art.after(hopIn);
  el("path", { d: CONE_CLIP }, el("clipPath", { id: "cn-clip" }, defs));
  el("path", { d: D(CUT.frame) }, el("clipPath", { id: "cn-frame" }, defs));

  // correa distribuidora (sobre los marcos) + colpas de alimentación, encima del dibujo
  const top = el("g", { class: "sc-top" }, svg);
  const w = [7.8, -4.5], p0 = [DIST0[0] - 4, distY(DIST0[0] - 4)], p1 = DIST1;
  const belt = el("g", { class: "sc-dist", "data-eq": "alim" }, top);
  el("path", { class: "hp-f", d: D([add(p0, [-w[0], -w[1]]), add(p1, [-w[0], -w[1]]), add(p1, [-w[0], -w[1] + 3.5]), add(p0, [-w[0], -w[1] + 3.5])].map((p, i) => (i < 2 ? p : p))) }, belt);
  el("path", { class: "hp-f", d: D([add(p0, w), add(p1, w), add(p1, [-w[0], -w[1]]), add(p0, [-w[0], -w[1]])]) }, belt);
  el("path", { class: "hp-f", d: D([add(p1, w), add(p1, [-w[0], -w[1]]), add(p1, [-w[0], -w[1] + 3.5]), add(p1, [w[0], w[1] + 3.5])]) }, belt);
  for (let m = 0; m < 4; m++) { const q = [INLET(m)[0], distY(INLET(m)[0])]; el("path", { class: "sc-plow", d: `M${f1(q[0] - 6)} ${f1(q[1] - 1)}L${f1(q[0] + 4)} ${f1(q[1] + 5)}` }, belt); }
  const feedL = el("g", { class: "sc-rocks" }, top);
  const feedRocks = pool(feedL, 80, "sc-rock");
  const inclL = el("g", { class: "sc-rocks" }); conv.appendChild(inclL);
  const inclRocks = pool(inclL, 46, "sc-rock");

  // la colpa que se sigue (sobre correas) y marcador cuando va por dentro de un equipo
  const tourG = el("g", { class: "sc-tour" }, svg);
  const tourRing = el("circle", { r: 9, class: "sc-tour-ring" }, tourG);
  const tourRocks = Array.from({ length: 5 }, (_, i) => el("path", { d: ROCK[i % 3], class: "sc-tour-rock" }, tourG));
  // estela: sólo sobre las correas dibujadas (no cruza el aire ni el interior de los equipos)
  const trailEls = Array.from({ length: 14 }, () => { const e = el("path", { class: "sc-trail" }); tourG.insertBefore(e, tourRing); return e; });
  const tourPulse = el("circle", { r: 14, class: "sc-tour-pulse" }, svg);

  // etiquetas de foco
  const tagsG = el("g", { class: "sc-tags" }, svg);
  // (cada píldora entera dentro de la silueta de la lámina: revisado con ?qa=silueta)
  const TAGS = { alim: ["Correas de alimentación", [420, 115]], cono: ["Chancador de conos", [1045, 360]], alimentador: ["Alimentador", [1030, 500]], hpgr: ["HPGR", [995, 575]], producto: ["Correa de producto", [1015, 690]] };
  const tagEls = {};
  for (const [id, [label, p]] of Object.entries(TAGS)) {
    const g = el("g", { class: "sc-tag", transform: `translate(${p[0]} ${p[1]})` }, tagsG);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -26, class: "sc-tag-line" }, g);
    const ww = label.length * 8.6 + 26;
    el("rect", { x: -ww / 2, y: -50, width: ww, height: 24, rx: 12, class: "sc-tag-pill" }, g);
    el("text", { x: 0, y: -33.5, class: "sc-tag-text", "text-anchor": "middle" }, g).textContent = label;
    tagEls[id] = g;
  }

  // zoom sobre el dibujo ("Interior del cono" → el cono, "Interior rodillos" → el HPGR): los rótulos de las partes van
  // con guías ancladas al dibujo ampliado; aparecen al acercarse y se van al volver
  const zoomG = el("g", { class: "sc-zoom", "aria-hidden": "true" }, svg);
  // ?qa=silueta: revisión de que nada de lo vivo se pinte fuera de lo impreso. Contornos: silueta de la lámina (SIL,
  // cian), carcasa del cono (CONE_CLIP, magenta) y marco del corte (azul punteado). Encima, en rojo, todo lo que se
  // pinte fuera de la silueta (colpas, corte, colpa marcada, rótulos, etiquetas). Sin capas de pintado (todo en vivo).
  const QA = typeof location !== "undefined" && new URLSearchParams(location.search).get("qa") === "silueta";
  if (QA) {
    const live = [hopIn, top, tourG, tourPulse, tagsG, zoomG, prodL, inclL, ...mods.map((M) => M.fl)];
    live.forEach((n, i) => (n.id = `sc-qa-${i}`));
    const mask = el("mask", { id: "sc-qa-out", maskUnits: "userSpaceOnUse", x: -2000, y: -2000, width: 6000, height: 6000 }, defs);
    el("rect", { x: -2000, y: -2000, width: 6000, height: 6000, fill: "#fff" }, mask); el("path", { d: SIL, fill: "#000" }, mask);
    const red = el("filter", { id: "sc-qa-red", x: "-5%", y: "-5%", width: "110%", height: "110%" }, defs);
    el("feFlood", { "flood-color": "#ff0033", result: "c" }, red); el("feComposite", { in: "c", in2: "SourceAlpha", operator: "in" }, red);
    const qa = el("g", { class: "sc-qa", "pointer-events": "none" }, svg);
    const out = el("g", { mask: "url(#sc-qa-out)", filter: "url(#sc-qa-red)", class: "sc-qa-out" }, qa);
    live.forEach((n) => el("use", { href: `#${n.id}` }, out));
    el("path", { d: SIL, fill: "none", stroke: "#00b7ff", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }, qa);
    el("path", { d: CONE_CLIP, fill: "none", stroke: "#e600e6", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }, qa);
    el("path", { d: D(CUT.frame), fill: "none", stroke: "#2050ff", "stroke-width": 1, "stroke-dasharray": "3 2", "vector-effect": "non-scaling-stroke" }, qa);
    root.dataset.qa = "silueta";
  }

  // unidades para el foco: cada pieza queda con el equipo al que pertenece (las no marcadas se apagan siempre)
  const units = new Map();
  const classify = (n, inh) => {
    if (n.classList?.contains("sc-rocks") || n.classList?.contains("sc-hopper-in")) return;
    const eq = n.dataset?.eq || inh;
    if (n.querySelector?.("[data-eq]")) [...n.children].forEach((c) => classify(c, eq)); else units.set(n, eq || "");
  };
  classify(art, ""); units.set(belt, "alim");

  // ------------------------------------------------------------ estado
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const S = { feed: 10500, css: CSS_NOM, level: 0.8, draw: 2620, gap: 0.5, rot: 0, gyr: 0, flow: 0, mass: 0, feedS: 0, feederS: 0, prodS: 0, t: 0, hop: 0, cut: 0 };
  const shown = { hop: 0, cut: 0 };
  let selected = null, playing = !still.matches, active = false, raf = 0, last = 0, lastLit = null;
  if (still.matches) { S.t = STEPS[3].ta + 2; S.gyr = 2.2; }            // quieto: el cono en corte, a mitad del paso 4
  const feedVis = new Map(), prodVis = new Map();
  const visible = (map, id, p) => { if (!map.has(id)) { map.set(id, hash(id * 1.37) < p); if (map.size > 600) map.delete(map.keys().next().value); } return map.get(id); };

  function step(dt) {
    // por línea: entra feed/4 a la tolva del cono; el cono ahogado saca su capacidad (según CSS); bajo el nivel de
    // ahogo saca proporcional al nivel. El alimentador entrega al HPGR lo que produce el cono.
    const inflow = S.feed / 4, cap = coneCap(S.css);
    S.draw = cap * clamp(S.level / CHOKE);
    S.level = clamp(S.level + 0.25 * ((inflow - S.draw) / FEEDER_NOM) * dt, 0.05, 1);
    S.gap += (clamp(S.draw / FEEDER_MAX) - S.gap) * (1 - Math.exp(-dt * 2));
    S.rot += OMEGA * dt; S.gyr += OMEGA_G * dt; S.flow += dt * (0.6 + S.draw / FEEDER_MAX); S.mass += dt * (S.draw / FEEDER_MAX);
    S.feedS += V_BELT * dt; S.feederS += 26 * (S.draw / FEEDER_MAX) * dt; S.prodS += V_PROD * dt;
    S.t = (S.t + dt) % PERIOD;
  }
  const live = () => { const q = state(S.t); return { ...S, seq: q, step: q.step, tour: { stage: q.stage, u: q.u }, cut: shown.cut, hop: Math.max(shown.hop, q.open) }; };

  // zoom sobre el dibujo: encuadres (unidades del SVG) y columnas de los rótulos (bordes del equipo, a izq. y der.)
  const ZR = { A: [998, 318, 170, 156], B: [896, 552, 198, 122] };     // el cono con aire para los rótulos · la cara del corte del HPGR m3
  const ZL = { A: [1041, 1124], B: [958, 1032] };
  const OVER = [-10, -10, VIEW[2] + 20, VIEW[3] + 20];                  // vista general (= el encuadre de la estación)
  let zoomMode = "viewBox", onZoom = null, zoomKey = null, lastZoom = "", vb = VIEW.slice();
  // rectángulo intermedio: centro lineal y tamaño en escala logarítmica (el acercamiento se siente parejo)
  const mixRect = (a, b, u) => { const w = Math.exp(lerp(Math.log(a[2]), Math.log(b[2]), u)), h = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u));
    return [lerp(a[0] + a[2] / 2, b[0] + b[2] / 2, u) - w / 2, lerp(a[1] + a[3] / 2, b[1] + b[3] / 2, u) - h / 2, w, h]; };
  const fitAspect = ([x, y, w, h]) => { const a = VIEW[2] / VIEW[3]; return w / h > a ? [x, y - (w / a - h) / 2, w, w / a] : [x - (h * a - w) / 2, y, h * a, h]; };

  // Xc del plano de corte según el deslizador (0 = cerrado)
  const cutX = (c) => (c < 0.15 ? lerp(69, HP.x, c / 0.15) : lerp(HP.x, 37, (c - 0.15) / 0.85));
  let hpKey = "";

  function draw() {
    const s = live(), tour = s.tour;
    // correa inclinada + distribuidora: colpas a espaciado fijo; cada una va a la tolva m = id mod 4
    const sp = 15, base = S.feedS % sp, idBase = Math.floor(S.feedS / sp);
    let ii = 0, fi = 0;
    for (let j = 0; j < 130; j++) {
      const p = base + j * sp, id = idBase - j, m = ((id % 4) + 4) % 4, pd = pDropOf(m);
      if (p > pd + 34) continue;
      if (!visible(feedVis, id, S.feed / FEED_MAX * 0.95)) continue;
      const jit = (hash(id * 3.3) - 0.5) * 7;
      if (p < 10) continue;                                            // la cola de la correa queda al borde de la silueta
      if (p < P_INCL) { const q = FEEDP.at(p); if (ii < inclRocks.length) put(inclRocks[ii++], [q[0] - jit * 0.5, q[1] - 4.5 + jit * 0.3], 2.6 + hash(id) * 0.9, id * 47); }
      else if (p < P_DIST) continue;                                   // dentro de la casa de traspaso
      else if (fi < feedRocks.length) {
        if (p <= pd) { const q = FEEDP.at(p); put(feedRocks[fi++], [q[0] + jit * 0.5, q[1] - 4 + jit * 0.3], 2.6 + hash(id) * 0.9, id * 47); }
        else { const u = (p - pd) / 34, q = [INLET(m)[0] + jit * 0.3, distY(INLET(m)[0]) - 4 + 33 * u * u]; put(feedRocks[fi++], q, 2.6, id * 47 + u * 200, 1 - smooth((u - 0.7) / 0.3)); }
      }
    }
    for (; ii < inclRocks.length; ii++) put(inclRocks[ii], null); for (; fi < feedRocks.length; fi++) put(feedRocks[fi], null);
    // alimentadores (los cuatro, misma velocidad)
    const fsp = 8.5, fb = S.feederS % fsp, FP = polyline(FEEDER);
    mods.forEach((M, m) => M.rocks.forEach((r, j) => { const p = fb + j * fsp; if (p > FP.len) return put(r, null); const q = add(FP.at(p), off(m)), id = Math.floor(S.feederS / fsp) - j;
      put(r, [q[0] + (hash(id * 5 + m) - 0.5) * 6, q[1] - 3.5 + (hash(id * 7 + m) - 0.5) * 2], 2.4 + hash(id + m) * 0.8, id * 61 + m * 30, smooth(p / 6) * (1 - smooth((p - FP.len + 5) / 5))); }));
    // correa de producto: aparece donde el corte del dibujo la deja ver (tramo final)
    const psp = 6.5, pb = S.prodS % psp, pid = Math.floor(S.prodS / psp); let pi = 0;
    for (let j = 0; j < 140 && pi < prodRocks.length; j++) {
      const p = pb + j * psp, id = pid - j, m = ((Math.floor(hash(id * 2.1) * 4) % 4) + 4) % 4;
      if (p < pProdOf(m) || p > PRODP.len) continue;
      const q = PRODP.at(p); if (q[0] < 960) continue;
      if (!visible(prodVis, id, S.draw / FEEDER_MAX * 0.9)) continue;
      put(prodRocks[pi++], [q[0] + (hash(id * 4.1) - 0.5) * 9, q[1] - 2.5 + (hash(id * 6.7) - 0.5) * 4], 1.2 + hash(id) * 0.7, id * 37, 1 - smooth((p - PRODP.len + 25) / 25));
    }
    for (; pi < prodRocks.length; pi++) put(prodRocks[pi], null);

    // cono m3: el corte encima de la carcasa (el deslizador o, en los pasos 3 y 4, la secuencia)
    const hv = s.hop;
    setHTML(hopIn, hv > 0.005 ? coneSvg(s, tour) : "");
    hopIn.style.opacity = Math.min(1, hv * 1.6).toFixed(3);
    // HPGR m3: cuerpo, losa y corte
    const Xc = cutX(shown.cut), Xh = Math.min(Xc, HP.x);
    const dw = f1(O3[0] + 0.866 * Xh); if (doorRect.getAttribute("width") !== dw) doorRect.setAttribute("width", dw); // sólo si cambia (no repinta de balde)
    const key = Xc < HP.x - 0.01 ? "" : "closed";
    if (key === "" || hpKey !== key) { setHTML(hpG, hpgrSvg(iso(O3), Xc, s, tour)); hpKey = key; }

    // zoom sobre el dibujo y sus rótulos; las etiquetas de foco se apagan al acercarse (los rótulos las reemplazan)
    const z = applyZoom();
    zoomLabels(s, z, Xc);
    const tz = (1 - smooth(z * 2.5)).toFixed(3); if (tagsG.style.opacity !== tz) tagsG.style.opacity = tz;

    // colpa que se sigue (sobre las correas; por dentro de un equipo, el pulso si el corte está cerrado)
    const q = s.seq;
    let tp = beltPoint(q.stage, q.u), inside = null, frag = q.stage === "feeder" ? 1.6 : q.stage === "prod" ? 1.05 : 0;
    if (!tp) switch (q.stage) {
      case "head": inside = [578, 31]; break;
      case "fall": tp = [INLET(3)[0], distY(INLET(3)[0]) - 4 + 33 * q.u * q.u]; break;
      case "bin": case "cone": inside = hv > 0.3 ? null : C(0, 44); break;
      case "chute": if (q.u > 0.85) { tp = FEEDER[0]; frag = 1.6; } else inside = hv > 0.3 ? null : C(0, 6); break;
      case "hood": inside = [1000, 545]; break;
      case "nip": inside = Xc < HP.x - 3 ? null : [990, 612]; break;
      case "prod": inside = [999, 676]; break;
    }
    if (tp) {
      tp = [tp[0], tp[1] - 4];
      tourRing.setAttribute("cx", f1(tp[0])); tourRing.setAttribute("cy", f1(tp[1])); tourRing.setAttribute("r", frag ? 11 : 9); tourRing.style.opacity = 1;
      tourRocks.forEach((r, i) => (frag ? put(r, [tp[0] + (i - 2) * 3.4, tp[1] + ((i % 2) - 0.5) * 2.5], frag, i * 70) : put(r, i ? null : tp, 3.4, S.t * 40)));
    } else { tourRing.style.opacity = 0; tourRocks.forEach((r) => put(r, null)); }
    if (inside) { const ph = (performance.now() / 900) % 1; tourPulse.setAttribute("cx", f1(inside[0])); tourPulse.setAttribute("cy", f1(inside[1])); tourPulse.setAttribute("r", f1(8 + ph * 16)); tourPulse.style.opacity = (0.9 * (1 - ph)).toFixed(2); }
    else tourPulse.style.opacity = 0;
    // estela: el mismo recorrido unos instantes antes, mientras siga en el mismo tramo de correa
    const trail = [];
    if (beltPoint(q.stage, q.u)) for (let i = 0; i <= trailEls.length; i++) {
      const b = state(S.t - i * 0.07); if (b.step !== q.step || b.stage !== q.stage) break;
      const p = beltPoint(b.stage, b.u); if (!p) break; trail.push([p[0], p[1] - 4]);
    }
    trailEls.forEach((e, i) => {
      if (i + 1 >= trail.length) { e.style.opacity = 0; return; }
      e.setAttribute("d", `M${f1(trail[i][0])} ${f1(trail[i][1])}L${f1(trail[i + 1][0])} ${f1(trail[i + 1][1])}`);
      e.style.opacity = ((1 - i / trailEls.length) * 0.8).toFixed(2); e.style.strokeWidth = f1(5 * (1 - i / trailEls.length) + 1);
    });

    // foco del paso: se ilumina el equipo del paso y el resto baja a ~35 % (si no hay un equipo elegido); con zoom
    // sobre el dibujo, el equipo ampliado
    const lit = selected ? null : z > 0.3 ? [zoomKey === "A" ? "cono" : "hpgr"] : q.step.lit, litKey = lit ? lit.join() : "";
    if (litKey !== lastLit) {
      lastLit = litKey;
      units.forEach((eq, u) => u.classList.toggle("sc-stepdim", !!lit && !lit.includes(eq)));
      hopIn.classList.toggle("sc-stepdim", !!lit && !lit.includes("cono"));
    }
    for (const id of ORDER) tagEls[id].toggleAttribute("data-on", selected ? selected === id : lit.includes(id));
    listeners.forEach((fn) => fn(s, api));
  }
  // ------------------------------------------------------------ zoom sobre el dibujo
  // El valor del deslizador (ya con su seguimiento exponencial, `shown`) es el nivel de zoom: 0 = vista general, 1 =
  // el encuadre ZR. En AR se acerca el viewBox de la lámina; en el demo sin cámara, la cámara (mount → setZoomMode).
  function applyZoom() {
    const z = zoomKey === "A" ? shown.hop : zoomKey === "B" ? shown.cut : 0, sig = `${zoomKey}|${z.toFixed(4)}`;
    if (sig === lastZoom) return z;
    lastZoom = sig;
    if (zoomMode === "camera") onZoom?.(z > 0.001 ? mixRect(OVER, ZR[zoomKey], z) : null, z);
    else {
      vb = z > 0.001 ? mixRect(VIEW, fitAspect(ZR[zoomKey]), z) : VIEW.slice();
      svg.setAttribute("viewBox", vb.map((v) => v.toFixed(2)).join(" "));
      svg.style.overflow = z > 0.001 ? "hidden" : "";                  // acercada, nada se sale de la caja de la lámina
    }
    return z;
  }
  // lo que se ve del SVG ([x, y, w, h]) y cuánto mide un px de pantalla en unidades del SVG (los rótulos van en px).
  // En AR se lee el viewBox puesto ("Ampliar" con la escena fijada, js/app.js, se aplica encima del de la estación) y
  // la caja de la lámina en pantalla (proyectada por la cámara).
  function viewNow() {
    if (zoomMode === "camera") { const m = svg.getScreenCTM(); if (m && m.a) return { r: [-m.e / m.a, -m.f / m.d, innerWidth / m.a, innerHeight / m.d], u: 1 / m.a }; }
    const v = svg.viewBox.baseVal, r = v && v.width ? [v.x, v.y, v.width, v.height] : vb, w = svg.getBoundingClientRect().width;
    return { r, u: w > 1 ? r[2] / w : r[2] / VIEW[2] };
  }
  function zoomLabels(s, z, Xc) {
    const op = smooth((z - 0.55) / 0.35);
    const o = op.toFixed(3); if (zoomG.style.opacity !== o) zoomG.style.opacity = o;
    if (op <= 0.001) { setHTML(zoomG, ""); return; }
    const { r: vr, u } = viewNow(), L = [];
    let cols;
    if (zoomKey === "A") {
      // el cono en corte: tolva, plato, cóncavo, manto, CSS (donde cierra ahora), excéntrica y chute
      const g = coneGeo(s);
      L.push([0, C(-6, 64), "Tolva"], [0, C(-rc(50) - 0.9, 50), "Cóncavo"], [0, C(g.head(-1, 42) + 0.7, 42), "Manto"], [0, orb(3.2, CONE.ecc, Math.PI * 0.75), "Excéntrica"],
        [1, C(g.off(CONE.plate[1]) + CONE.plate[2] - 1, CONE.plate[1]), "Plato"], [1, g.closing, `CSS ${Math.round(s.css)} mm`], [0, C(-CONE.hub[0] - 1.3, 13), "Chute"]);
      cols = [ZL.A[0] - 4 * u, ZL.A[1] + 4 * u];
    } else if (Xc < HP.x - 3) {
      // el HPGR en corte (el plano avanza con el deslizador)
      const P = iso(O3), yb = HP.yb - s.gap * 0.8, xr = Math.min(Xc, HP.rx[1]);
      L.push([0, P([xr, HP.yf + 3, HP.zc - HP.r + 1]), "Rodillo fijo"], [1, P([xr, yb - 3, HP.zc + HP.r - 1]), "Rodillo flotante"],
        [1, P([xr, -22.9, HP.zc - 6]), `Queque · gap ${f1(18 + s.gap * 14)} mm`],
        Xc > HP.bx[0] + 3 ? [0, P([HP.bx[0] + 4, -HP.y + 3, HP.zc + 4]), "Cilindros hidráulicos"] : [0, P([xr, -22.9, HP.zc + 6]), "Lecho comprimido"]);
      cols = [ZL.B[0] - 4 * u, ZL.B[1] + 4 * u];
    } else { setHTML(zoomG, ""); return; }
    // cada columna: los textos a la altura de su ancla, sin pisarse (1,6 líneas de separación) y dentro de lo que se ve
    const fs = 11.5 * u, out = [];
    for (const side of [0, 1]) {
      const col = L.filter((l) => l[0] === side).sort((a, b) => a[1][1] - b[1][1]);
      const tw = Math.max(0, ...col.map((l) => l[2].length)) * 6.3 * u + 6 * u;   // ancho estimado del texto más largo
      const x = side ? Math.min(cols[1], vr[0] + vr[2] - tw) : Math.max(cols[0], vr[0] + tw), ex = side ? x - 3 * u : x + 3 * u;
      let y = vr[1] + fs * 0.4;
      for (const [, p, text] of col) {
        y = Math.min(Math.max(p[1] + fs * 0.35, y + fs * 1.6), vr[1] + vr[3] - fs * 0.6);
        out.push(`<path class="sc-zl-lead" stroke-width="${f2(u)}" d="M${f2(p[0])} ${f2(p[1])}L${f2(ex)} ${f2(y - fs * 0.35)}"/>`,
          `<circle class="sc-zl-dot" cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(2.4 * u)}"/>`,
          `<text class="sc-zl-text" x="${f2(x)}" y="${f2(y)}" font-size="${f2(fs)}" stroke-width="${f2(3 * u)}" text-anchor="${side ? "start" : "end"}">${text}</text>`);
      }
    }
    setHTML(zoomG, out.join(""));
  }

  // ------------------------------------------------------------ reloj
  const listeners = new Set();
  // capas de pintado: el dibujo quieto se rasteriza una vez; sólo se repinta lo que se mueve (ver js/layers.js)
  const layers = QA ? { tick() {}, destroy() {} } : createLayers(svg, { name: "secundario", dynamic: () => [...mods.map((M) => M.fl), prodL, feedL, inclL], roaming: () => [tourG, tourPulse, zoomG] });
  function frame(now) {
    layers.tick();
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) step(dt);
    const k = 1 - Math.exp(-dt * 6);                                  // los cortes siguen al valor pedido (seguimiento exponencial)
    for (const key of ["hop", "cut"]) { shown[key] += (S[key] - shown[key]) * k; if (Math.abs(S[key] - shown[key]) < 0.002) shown[key] = S[key]; }
    draw();
    raf = active ? nextTick(frame) : 0;
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = nextTick(frame); } };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; }, get playing() { return playing; },
    get hop() { return S.hop; }, get cut() { return S.cut; }, get feed() { return S.feed; }, get css() { return S.css; },
    get zoom() { return { key: zoomKey, rect: zoomKey ? ZR[zoomKey] : null, viewBox: vb.slice() }; },
    live, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) { kick(); } else { cancelTick(raf); raf = 0; } },
    play() { playing = true; kick(); }, pause() { playing = false; }, togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { S.t = ((v % PERIOD) + PERIOD) % PERIOD; draw(); },
    goStep(n) { api.seek(STEPS[clamp(n, 1, STEPS.length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(S.t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(S.t); api.goStep(S.t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    // cada deslizador acerca su equipo: manda el último que se movió (si vuelve a 0 y el otro está abierto, el otro)
    setHop(v, instant) { S.hop = clamp(v); if (instant || still.matches) shown.hop = S.hop; zoomKey = S.hop > 0 || S.cut === 0 ? "A" : "B"; draw(); },
    setCut(v, instant) { S.cut = clamp(v); if (instant || still.matches) shown.cut = S.cut; zoomKey = S.cut > 0 || S.hop === 0 ? "B" : "A"; draw(); },
    /** "viewBox" (AR: se acerca el dibujo dentro de la lámina) o "camera" (demo: fn(rect en unidades del SVG | null, nivel)) */
    setZoomMode(mode, fn = null) { zoomMode = mode; onZoom = fn; lastZoom = ""; if (mode === "camera" && vb[2] !== VIEW[2]) { vb = VIEW.slice(); svg.setAttribute("viewBox", VIEW.join(" ")); } draw(); },
    setFeed(v) { S.feed = clamp(v, FEED_MIN, FEED_MAX); draw(); },
    setCss(v) { S.css = clamp(v, CSS_MIN, CSS_MAX); draw(); },
    select(id) {
      selected = id && EQUIP[id] ? id : null;
      root.toggleAttribute("data-sel", !!selected);
      units.forEach((eq, u) => u.classList.toggle("sc-dim", !!selected && eq !== selected));
      hopIn.classList.toggle("sc-dim", !!selected && selected !== "cono");
      draw();
    },
    destroy() { api.setActive(false); layers.destroy(); listeners.clear(); document.removeEventListener("visibilitychange", onVis); root.remove(); },
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-eq]"); api.select(g ? (selected === g.dataset.eq ? null : g.dataset.eq) : null); });
  const onVis = () => { if (document.hidden) { cancelTick(raf); raf = 0; } else kick(); };
  document.addEventListener("visibilitychange", onVis);
  draw();
  return api;
}

// ---------------------------------------------------------------- panel (HUD)
export function bindPanel(sec, { onEscape } = {}) {
  const $ = (q) => document.querySelector(q);
  const playBtn = $("[data-sc-play]"), stepsBox = $("[data-sc-steps]");
  stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", sec.STEPS.length);
  const stepBtns = sec.STEPS.map((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n; b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
    b.addEventListener("click", () => sec.goStep(s.n)); stepsBox.appendChild(b); return b;
  });
  const info = $("[data-info]"), meter = $("[data-sc-meter]"), readout = $("[data-sc-readout]");
  const hopS = $("[data-sc-hop]"), hopO = $("[data-sc-hop-out]"), cutS = $("[data-sc-cut]"), cutO = $("[data-sc-cut-out]"), feedS = $("[data-sc-feed]"), feedO = $("[data-sc-feed-out]");
  const cssS = $("[data-sc-css]"), cssO = $("[data-sc-css-out]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = [];
  const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  const chips = [...document.querySelectorAll("[data-sc-chip]")]; // fijos en el panel: se buscan una vez, no en cada cuadro
  function renderInfo(s) {
    const id = sec.selected;
    chips.forEach((c) => c.toggleAttribute("data-on", c.dataset.scChip === id));
    if (!id) { if (info.dataset.owner === "sec") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs(s), sig = id + specs.join("|");
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig; info.dataset.owner = "sec";
    $("[data-info-kicker]").textContent = e.kicker; $("[data-info-title]").textContent = e.title; $("[data-info-text]").textContent = e.text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join(""); $("[data-info-actions]").innerHTML = "";
    info.hidden = false;
  }
  off.push(sec.on((s) => {
    const st = s.step;
    if (st.n !== lastStep) {
      $("[data-sc-step-n]").textContent = st.n; $("[data-sc-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const k = Number(b.dataset.step); b.toggleAttribute("data-done", k < st.n); b.toggleAttribute("data-current", k === st.n); });
      lastStep = st.n;
    }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", s.level.toFixed(3));
    // bajo la tuerca del manto el cono ya no trabaja ahogado
    const drip = s.level < NUT_LEVEL, warn = s.level > 0.95 ? " · ¡tolva llena!" : "";
    const text = drip ? `${fmt(s.feed)} t/h · tolva ${Math.round(s.level * 100)} % · alimentación por goteo: desgaste irregular y producto menos cúbico`
      : `${fmt(s.feed)} t/h · CSS ${Math.round(s.css)} mm · tolva ${Math.round(s.level * 100)} % · HPGR ${fmt(s.draw)} t/h${warn}`;
    readout.toggleAttribute("data-warn", drip || s.level > 0.95);
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(sec.playing));
    playBtn.setAttribute("aria-label", sec.playing ? "Pausar" : "Reproducir");
    renderInfo(s);
  }));
  const sync = () => { hopS.value = Math.round(sec.hop * 100); hopO.textContent = `${hopS.value} %`; cutS.value = Math.round(sec.cut * 100); cutO.textContent = `${cutS.value} %`; feedS.value = sec.feed; feedO.textContent = `${fmt(sec.feed)} t/h`; cssS.value = sec.css; cssO.textContent = `${sec.css} mm`; };
  on(cssS, "input", () => { sec.setCss(Number(cssS.value)); cssO.textContent = `${cssS.value} mm`; });
  // los cortes también son el zoom sobre el dibujo (la lámina lo resuelve: viewBox en AR, cámara en el demo)
  on(hopS, "input", () => { sec.setHop(hopS.value / 100); hopO.textContent = `${hopS.value} %`; });
  on(cutS, "input", () => { sec.setCut(cutS.value / 100); cutO.textContent = `${cutS.value} %`; });
  on(feedS, "input", () => { sec.setFeed(Number(feedS.value)); feedO.textContent = `${fmt(Number(feedS.value))} t/h`; });
  on(playBtn, "click", () => sec.togglePlay());
  on($("[data-sc-prev]"), "click", () => sec.prevStep());
  on($("[data-sc-next]"), "click", () => sec.nextStep());
  document.querySelectorAll("[data-sc-chip]").forEach((c) => on(c, "click", () => sec.select(sec.selected === c.dataset.scChip ? null : c.dataset.scChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "sec") sec.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "secundario" || e.target.closest?.("input, [data-intro]")) return;
    if (e.key === " " && !e.target.closest("button")) sec.togglePlay();
    else if (e.key === ",") sec.prevStep();
    else if (e.key === ".") sec.nextStep();
    else if (/^[1-5]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; sec.select(sec.selected === id ? null : id); }
    else if (e.key === "ArrowUp") { sec.setCut(sec.cut + 0.1); sync(); }
    else if (e.key === "ArrowDown") { sec.setCut(sec.cut - 0.1); sync(); }
    else if (e.key === "ArrowRight") { sec.setHop(sec.hop + 0.1); sync(); }
    else if (e.key === "ArrowLeft") { sec.setHop(sec.hop - 0.1); sync(); }
    else if (e.key === "Escape") { if (sec.selected) sec.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  sync(); sec.seek(sec.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "sec") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const toPoster = ([x, y, w, h]) => [x * REG.s + REG.tx, y * REG.s + REG.ty, w * REG.s, h * REG.s];
const ZOOM = { alim: [0, 0, 660, 560], cono: [985, 300, 180, 300], alimentador: [920, 440, 220, 300], hpgr: [890, 500, 250, 360], producto: [860, 580, 353, 330] }; // alto extra abajo: la ficha tapa esa zona
const ZOOM_CAP = 10;                                                   // tope del zoom sobre el dibujo (la lámina es vectorial)

// lámina armada de antemano, en reposo, mientras se mira la infografía (js/explorer.js): abrir sólo la inserta
let prebuilt = null;
export function prebuild() { return (prebuilt ||= createSecundario().catch(() => (prebuilt = null))); }
export async function mount({ layer, focus }) {
  const sec = (await prebuilt) || (await createSecundario());
  prebuilt = null;
  if (sec.el.parentNode !== layer) layer.appendChild(sec.el); // la precarga pudo dejarla ya puesta (estacionada)
  requestAnimationFrame(() => sec.el.setAttribute("data-in", ""));
  // cámara: el equipo elegido manda (vuelo como siempre); si no, el zoom sobre el dibujo de los deslizadores (sigue
  // cuadro a cuadro su valor, sin vuelo propio); si no, el encuadre de la estación
  let focused = null, zoomRect = null, zoomK = 0, lastSel = null;
  const want = (z, cap) => { const k = z ? JSON.stringify(z) : ""; if (k !== focused) { focused = k; focus?.(z ? toPoster(z) : null, cap); } };
  const toZoom = (ms) => { focused = "zoom"; focus?.(toPoster(zoomRect), ZOOM_CAP, ms, lerp(0.06, 0.03, zoomK)); };
  sec.setZoomMode("camera", (rect, k) => { zoomRect = rect; zoomK = k; if (sec.selected) return; if (rect) toZoom(0); else want(null); });
  const unbind = bindPanel(sec, { onEscape: () => { location.hash = ""; } });
  const unzoom = sec.on(() => {
    if (sec.selected === lastSel) return;
    lastSel = sec.selected;
    if (sec.selected) want(ZOOM[sec.selected], 2.8); else if (zoomRect) toZoom(650); else want(null);
  });
  sec.setActive(true);
  window.pmSec = sec;
  return {
    focus: toPoster([-10, -10, VIEW[2] + 20, VIEW[3] + 20]),
    view: "secundario",
    destroy: () => { unzoom(); unbind(); sec.destroy(); if (window.pmSec === sec) delete window.pmSec; },
  };
}
