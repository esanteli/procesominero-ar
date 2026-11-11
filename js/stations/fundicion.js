// Estación 4 · Fundición — lámina viva sobre el dibujo de Emilio (assets/fundicion/fundidora.svg).
//
// La nave se abre: el techo se levanta y el muro largo del frente se abate hacia afuera (gira sobre su borde inferior
// hasta quedar en el piso). Adentro, de izquierda a derecha, la línea de una fundición chilena:
//   · Convertidor Teniente (CT): el concentrado seco entra por toberas con aire enriquecido en oxígeno; el azufre y el
//     hierro se oxidan y dan el calor (fusión casi autógena). El baño se separa: metal blanco (Cu₂S, ~73 % Cu) abajo y
//     escoria (8–10 % Cu) arriba. La escoria sale a una olla de escoria; el metal blanco se sangra a una olla.
//   · Puente grúa y ollas: la grúa corre por el pasillo de la nave, toma la olla por sus muñones y la inclina.
//   · Convertidor Peirce-Smith (CPS): gira para recibir el metal blanco, sopla aire por toberas sumergidas
//     (Cu₂S + O₂ → 2Cu + SO₂) y gira otra vez para vaciar el cobre blíster (99,3 %) en una olla.
//   · Horno de ánodos (refinación a fuego): oxidación y reducción del blíster → cobre anódico 99,6 %; gira y vacía por
//     una canaleta a la rueda de moldeo, que avanza de a un molde; un brazo saca los ánodos y los deja en el estanque.
//   · Gases: campanas sobre las bocas → ducto colector → chimeneas del dibujo y planta de ácido (SO₂).
//
// Misma lógica de la skill anatomy que las otras estaciones: un modelo (oxígeno del aire de soplado → alimentación,
// ley del metal blanco, SO₂, producción) manda y el dibujo lo sigue; "sigue el cobre" en 6 pasos con state(t) puro;
// equipos con foco, ficha y detalle; deslizadores para abrir la nave y cortar los hornos.
//
// Geometría: px de la infografía. El dibujo está a escala 2 (registro por correlación) y la nave usa una isometría
// de mundo W(e, n, z): e → (0,866; 0,5) (hacia el frente), n → (0,866; −0,5) (a lo largo de la nave), z hacia arriba,
// con origen en la esquina izquierda-posterior del piso. Nave: e 0…112,9 · n 0…192,2 · muros 40,6.
const NS = "http://www.w3.org/2000/svg";
const U = (f) => new URL(`../../assets/fundicion/${f}`, import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const f2 = (n) => (Math.round(n * 100) / 100).toString();
const fdec = (n, d = 0) => n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const D = (pts, close = true, f = f1) => "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L") + (close ? "Z" : "");
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- mundo y registro
export const VIEW = [4075, 892, 640, 380];
const O = [4145.99, 1170.89];
const W = (e, n, z = 0) => [O[0] + 0.866 * (e + n), O[1] + 0.5 * (e - n) - z];
const P3 = (p) => W(p[0], p[1], p[2]);
const S = 2, REG = [4145.25, 964.75];
const B = { E: 112.9, N: 192.2, H: 40.6 };
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], lerp: (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)],
};
// partes del dibujo (hijos del grupo 0.0)
const ART = { left: [0, 1, 17, 20, 21, 22], front: [2, 9, 10, 15, 16, 18, 19, 23, 24, 32], roof: [3, 4, 5, 6, 7, 8, 33, 34, 35, 36], chim: [11, 12, 13, 14], annex: [25, 26, 27, 28, 29, 30, 31, 37] };
const CHIM_TOP = [[4202.2, 1029.6], [4237.9, 1008.8], [4275.7, 985.6], [4311.4, 964.8]];

// hornos: cilindros horizontales a lo largo de n (eje en e, z; radio r; anillos de rodadura y corona dentada)
const CT = { id: "ct", e: 30, z: 17, r: 13, n0: 44, n1: 110, mouth: 81, mw: 4.5, rings: [51, 101], gear: null };
const CPS = { id: "cps", e: 30, z: 14, r: 10, n0: 117, n1: 139, mouth: 128, mw: 3.6, rings: [119, 131], gear: 134.5 };
const AF = { id: "refino", e: 30, z: 15, r: 9.5, n0: 152, n1: 182, mouth: 167, mw: 2.8, rings: [155, 170], gear: 175 };
const TAP = { matte: { t: -0.44, n: 70 }, slag: { t: 0.16, n: 104 } };
// ollas en el piso y posiciones de la grúa
const HOME = [58, 70], CPSL = [54, 128], SLAGPOT = [58, 104];
const LAD = { r0: 4.2, r1: 5.6, h: 9, tz: 5.4, bail: 6.5 };
const RAIL = { e0: 45, e1: 111, z: 35 };
// rueda de moldeo y estanque de enfriamiento
const WH = { e: 80, n: 170, r: 14, rm: 10, z: 4, N: 14 };
const DW = TAU / WH.N, TAKE = 7.5 * DW;
const TANK = { e0: 94, e1: 109, n0: 163, n1: 184, h: 4.5 };
// canaletas y ductos
const FEED = [[0, 36, 34], [26, 36, 34], [26, 36, 21], [26, 43.4, 21]];
const L_MATTE = [[42.4, 70, 11.2], [55.4, 70, 10]], L_SLAG = [[43.6, 104, 19.6], [54.4, 104, 10.6]], L_AF = [[41.5, 170, 11.6], [67.5, 170, 8.6]];
const MANI = { e: 26, z: 42, n0: 36, n1: 184 };

// ---------------------------------------------------------------- modelo (oxígeno del aire de soplado del CT)
const O2_MIN = 25, O2_MAX = 45;
export const model = (o2) => {
  const feed = 1000 + 50 * (o2 - 21);                      // t/d de concentrado seco
  const wm = Math.min(76, 70 + 0.2 * (o2 - 21));           // % Cu del metal blanco
  const so2 = 6 + 0.75 * (o2 - 21);                        // % SO₂ en el gas de la boca
  const cu = feed * 0.28 * 0.97;                           // t/d de cobre (concentrado ~28 % Cu)
  return { o2, feed, wm, so2, cu, anodes: (cu * 1000) / 400, auto: o2 >= 30, T: 1230 + 1.2 * (o2 - 21) };
};

// ---------------------------------------------------------------- "sigue el cobre" (state(t) puro)
export const PERIOD = 53.5;
export const STEPS = [
  { n: 1, id: "ct", label: "El concentrado seco entra al convertidor Teniente con aire enriquecido", t0: 0 },
  { n: 2, id: "ct", label: "A ~1.250 °C el baño se separa: metal blanco abajo y escoria arriba", t0: 6 },
  { n: 3, id: "grua", label: "El puente grúa lleva la olla de metal blanco al convertidor Peirce-Smith", t0: 14 },
  { n: 4, id: "cps", label: "El soplado quema el azufre que queda: sale cobre blíster (99,3 %)", t0: 24 },
  { n: 5, id: "refino", label: "El blíster pasa al horno de ánodos, que lo refina a 99,6 %", t0: 34 },
  { n: 6, id: "rueda", label: "La rueda de moldeo cuela los ánodos de cobre", t0: 43 },
].map((s, i, a) => ({ ...s, t1: i + 1 < a.length ? a[i + 1].t0 : PERIOD }));
const stepAt = (t) => STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1];
const k = (t, a, b) => smooth((t - a) / (b - a));
const WHEEL = { t0: 44, t1: 53 }, WP = (WHEEL.t1 - WHEEL.t0) / WH.N;

// estado de la planta en el instante t (ollas, grúa, hornos, rueda)
function plantAt(t) {
  const st = {};
  // olla (muñón T, inclinación a, llenado f, material) y grúa (n del puente, e del carro, z del gancho)
  let T = [HOME[0], HOME[1], LAD.tz], a = 0, f = 0, kind = "wm", hook = null;
  const carry = (e, n, z) => [e, n, z];
  if (t < 14) { f = k(t, 9.5, 13.5); hook = [HOME[0], HOME[1], 34.5]; }
  else if (t < 15.2) { hook = [HOME[0], HOME[1], lerp(34.5, LAD.tz + LAD.bail, k(t, 14, 15.2))]; f = 1; }
  else if (t < 17) { T = carry(HOME[0], HOME[1], lerp(LAD.tz, 28, k(t, 15.2, 17))); f = 1; }
  else if (t < 20.4) { const u = k(t, 17, 20.4); T = carry(lerp(HOME[0], 48, u), lerp(HOME[1], CPS.mouth, u), 28); f = 1; }
  else if (t < 24) { T = [48, CPS.mouth, 28]; a = (80 * Math.PI / 180) * (k(t, 20.4, 21.2) - k(t, 23.3, 24)); f = 1 - k(t, 21.1, 23.3); }
  else if (t < 26.2) { const u = k(t, 24, 25), w = k(t, 24.8, 26.2); T = [lerp(48, CPSL[0], u), CPSL[1], lerp(28, LAD.tz, w)]; }
  else if (t < 34) { T = [CPSL[0], CPSL[1], LAD.tz]; f = k(t, 31.6, 33.5); kind = "bl"; }
  else if (t < 35.5) { T = [CPSL[0], CPSL[1], lerp(LAD.tz, 30, k(t, 34, 35.5))]; f = 1; kind = "bl"; }
  else if (t < 38.8) { const u = k(t, 35.5, 38.8); T = [lerp(CPSL[0], 48, u), lerp(CPSL[1], AF.mouth, u), 30]; f = 1; kind = "bl"; }
  else if (t < 43) { T = [48, AF.mouth, 30]; a = (80 * Math.PI / 180) * (k(t, 38.8, 39.6) - k(t, 42.4, 43)); f = 1 - k(t, 39.5, 42.4); kind = "bl"; }
  else if (t < 49) { const u = k(t, 43, 49); T = [lerp(48, HOME[0], u), lerp(AF.mouth, HOME[1], u), 30]; kind = "bl"; }
  else if (t < 50.6) { T = [HOME[0], HOME[1], lerp(30, LAD.tz, k(t, 49, 50.6))]; kind = "bl"; }
  else { hook = [HOME[0], HOME[1], lerp(LAD.tz + LAD.bail, 34.5, k(t, 50.8, 52))]; kind = "bl"; }
  if (!hook) hook = [T[0], T[1], T[2] + LAD.bail];
  st.ladle = { T, a, f, kind, held: hook[2] < T[2] + LAD.bail + 0.05 && Math.abs(hook[0] - T[0]) < 0.01 && Math.abs(hook[1] - T[1]) < 0.01 };
  st.hook = hook; st.crane = { n: hook[1], e: hook[0] };
  // convertidor Teniente: sangrías
  st.slagTap = t >= 7 && t < 10.2 ? k(t, 7, 7.4) * (1 - k(t, 9.8, 10.2)) : 0;
  st.matteTap = t >= 9.5 && t < 13.8 ? k(t, 9.5, 9.9) * (1 - k(t, 13.4, 13.8)) : 0;
  st.slagPot = t < 7 ? 0 : t < 40 ? k(t, 7.2, 10.2) : 1 - k(t, 40, 43);
  // Peirce-Smith: giro (rad), nivel, mezcla metal blanco → blíster, soplado, vaciado
  const deg = Math.PI / 180;
  st.cpsPsi = 55 * deg * (k(t, 18.6, 20.6) - k(t, 23.3, 24.4)) + 88 * deg * (k(t, 30.4, 31.5) - k(t, 33.5, 34.6));
  st.cpsLevel = 0.12 + 0.5 * k(t, 21.1, 23.3) - 0.5 * k(t, 31.6, 33.5);
  st.cpsMix = t < 21 ? 1 : t < 24.4 ? 1 - k(t, 21, 23.3) : k(t, 24.6, 30.4);
  st.cpsBlow = t >= 24.4 && t < 30.6 ? k(t, 24.4, 25) * (1 - k(t, 30, 30.6)) : 0;
  st.cpsPour = t >= 31.5 && t < 33.6 ? 1 : 0;
  st.cpsFill = t >= 21.1 && t < 23.3 ? 1 : 0;
  // horno de ánodos: gira para recibir (55°) y para colar (34°)
  st.afPsi = 55 * deg * (k(t, 37.2, 38.8) - k(t, 42.4, 43.4)) + 34 * deg * (k(t, 43.2, 44) - k(t, 53, 53.5));
  st.afLevel = 0.36 + 0.4 * k(t, 39.5, 42.4) - 0.4 * k(t, WHEEL.t0, WHEEL.t1);
  st.afFill = t >= 39.5 && t < 42.4 ? 1 : 0;
  st.afPour = t >= WHEEL.t0 && t < WHEEL.t1 ? 1 : 0;
  st.afRefine = t >= 42.4 && t < 44 ? 1 : 0.35;
  // rueda: avanza de a un molde y luego se llena el que quedó bajo la canaleta
  const u = clamp((t - WHEEL.t0) / WP, 0, WH.N), i = Math.min(WH.N - 1, Math.floor(u)), fr = u >= WH.N ? 1 : u - i;
  const inWheel = t >= WHEEL.t0 && t < WHEEL.t1;
  st.wheelRot = u >= WH.N ? WH.N : i + smooth(fr / 0.35);
  st.wheelPhi = Math.PI + st.wheelRot * DW;                // ángulo del molde 0 (la canaleta vacía en θ = π)
  st.wheelI = inWheel ? i : -1;                            // en el avance i se llena el molde (N − 1 − i)
  st.stationFill = smooth((fr - 0.4) / 0.5);
  st.pouring = inWheel && fr >= 0.38 && fr < 0.95;
  st.fly = inWheel && fr >= 0.3 ? (fr - 0.3) / 0.7 : -1;   // ánodo que el brazo lleva al estanque
  return st;
}
// ley de cobre y material que se sigue
function purityAt(t, m) {
  if (t < 6) return [28, "concentrado seco"];
  if (t < 10) return [lerp(28, m.wm, smooth((t - 6) / 4)), "fusión"];
  if (t < 24.4) return [m.wm, "metal blanco"];
  if (t < 30.6) return [lerp(m.wm, 99.3, smooth((t - 24.4) / 6.2)), "soplado"];
  if (t < 43) return [99.3, "cobre blíster"];
  return [lerp(99.3, 99.6, smooth((t - 43) / 2)), "cobre anódico"];
}

// ---------------------------------------------------------------- fichas
const EQUIP = {
  ct: { kicker: "Fusión", title: "Convertidor Teniente", text: "Horno cilíndrico horizontal creado en Chile (Caletones, 1977). El concentrado seco entra por toberas junto con aire enriquecido en oxígeno: el azufre y el hierro se oxidan y entregan el calor, por eso la fusión casi no necesita combustible. El baño se separa por densidad: el metal blanco queda abajo y la escoria flota.",
    specs: (m) => [`Concentrado ${fdec(m.feed)} t/d · aire con ${m.o2} % de O₂`, `Metal blanco ${fdec(m.wm, 1)} % Cu · escoria 8–10 % Cu`, m.auto ? `~${fdec(m.T)} °C · fusión autógena` : "Bajo 30 % de O₂ necesita combustible"] },
  cps: { kicker: "Conversión", title: "Convertidor Peirce-Smith", text: "Recibe el metal blanco en ollas y lo sopla con aire por toberas sumergidas. El oxígeno quema el azufre que queda y sale como SO₂ (Cu₂S + O₂ → 2Cu + SO₂). Luego el convertidor gira sobre sus anillos y vacía el cobre blíster en otra olla.",
    specs: (m) => [`SO₂ en los gases ~${fdec(m.so2)} % → planta de ácido`, "Cobre blíster 99,3 % Cu", "Gira para cargar, soplar y vaciar"] },
  grua: { kicker: "Traslado", title: "Puente grúa y ollas", text: "El material fundido se mueve en ollas de acero revestidas con ladrillo refractario. El puente grúa corre por el pasillo de la nave, toma la olla por sus muñones y la inclina para vaciarla en el horno siguiente.",
    specs: (m) => [`Metal a ~${fdec(m.T - 30)} °C`, "Teniente → Peirce-Smith → horno de ánodos", "La escoria va a limpieza para recuperar cobre"] },
  refino: { kicker: "Refinación a fuego", title: "Horno de ánodos", text: "Horno rotatorio que termina de limpiar el blíster: primero se inyecta aire para oxidar el azufre residual y después un reductor (gas natural o diésel) que quita el oxígeno disuelto. Luego gira y vacía el cobre por una canaleta hacia la rueda de moldeo.",
    specs: () => ["Cobre anódico 99,6 % Cu", "Oxidación → reducción → colada", "Quemador que mantiene ~1.200 °C"] },
  rueda: { kicker: "Moldeo", title: "Rueda de moldeo", text: "Una mesa giratoria con moldes avanza de a un molde: se llena, el ánodo se enfría con agua mientras la rueda gira y un brazo lo saca y lo deja en el estanque de enfriamiento. Los ánodos viajan a la refinería electrolítica.",
    specs: (m) => ["~400 kg por ánodo", `~${fdec(Math.round(m.anodes / 10) * 10)} ánodos al día`, "Destino: refinería electrolítica"] },
};
const ORDER = ["ct", "cps", "grua", "refino", "rueda"];

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
const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(",")})`;
const mixC = (a, b, u) => a.map((v, i) => lerp(v, b[i], clamp(u)));
const MELT = { wm: [247, 188, 66], bl: [238, 116, 44], an: [246, 146, 52], cool: [196, 112, 60], slag: [156, 70, 36] };
const meltOf = (kind, mix = 1) => (kind === "cps" ? mixC(MELT.wm, MELT.bl, mix) : MELT[kind] || MELT.bl);
// cilindro de eje cualquiera (para ductos, quemador y la base de la rueda): devuelve el casco y la tapa visible
function cylA(C, a, h, r0, r1, cls) {
  let u = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const d = u[0] * a[0] + u[1] * a[1] + u[2] * a[2]; u = v3.sub(u, v3.mul(a, d)); const l = Math.hypot(...u); u = v3.mul(u, 1 / l);
  const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const ring = (P, r, kk = 28) => { const out = []; for (let i = 0; i < kk; i++) { const t = (i / kk) * TAU; out.push(P3(v3.add(P, v3.add(v3.mul(u, r * Math.cos(t)), v3.mul(v, r * Math.sin(t)))))); } return out; };
  const top = v3.add(C, v3.mul(a, h)), R0 = ring(C, r0), R1 = ring(top, r1), vis = a[0] - a[1] + a[2] > 0;
  return poly(hull([...R0, ...R1]), cls) + poly(vis ? R1 : R0, `${cls} ${cls}--cap`);
}
const pipeSvg = (pts, cls) => { const d = D(pts.map(P3), false, f2); return `<path class="fu-pipe-o ${cls}" d="${d}"/><path class="fu-pipe-w" d="${d}"/>`; };

// ---------------------------------------------------------------- hornos
function piecesOf(V) {
  const feats = [...V.rings.map((n) => ({ n0: n, n1: n + 2.4, r: V.r + 1.3, cls: "fu-ring" }))];
  if (V.gear) feats.push({ n0: V.gear, n1: V.gear + 2.6, r: V.r + 2.4, cls: "fu-gear" });
  feats.sort((a, b) => a.n0 - b.n0);
  const out = []; let c = V.n0;
  for (const f of feats) { if (f.n0 > c) out.push({ n0: c, n1: f.n0, r: V.r, cls: "fu-shell" }); out.push(f); c = f.n1; }
  if (c < V.n1) out.push({ n0: c, n1: V.n1, r: V.r, cls: "fu-shell" });
  return out.sort((a, b) => b.n0 - a.n0);
}
const PIECES = new Map([CT, CPS, AF].map((V) => [V.id, piecesOf(V)]));
function pieceSvg(V, s, ec, psi) {
  const r = s.r, c = clamp((ec - V.e) / r, -1, 1);
  if (c <= -0.97) return "";
  const a0 = Math.acos(c), ts = []; for (let i = 0; i <= 40; i++) ts.push(a0 + (TAU - 2 * a0) * (i / 40));
  const P = (t, n) => W(V.e + r * Math.cos(t), n, V.z + r * Math.sin(t));
  const h = hull([...ts.map((t) => P(t, s.n0)), ...ts.map((t) => P(t, s.n1))]);
  let g = poly(h, `${s.cls} fu-solid`);
  if (c > 0.995) { const sh = []; for (let i = 0; i <= 14; i++) sh.push(-Math.PI / 4 + (Math.PI / 4 + 0.42) * (i / 14));
    g += poly([...sh.map((t) => P(t, s.n0)), ...sh.slice().reverse().map((t) => P(t, s.n1))], `${s.cls}--shade`); }
  g += poly(h, "fu-edge");
  g += poly(ts.map((t) => P(t, s.n0)), `${s.cls} ${s.cls}--cap`);
  if (s.cls === "fu-gear") for (let j = 0; j < 36; j++) { const t = (j / 36) * TAU + psi; if (Math.cos(t) + Math.sin(t) < 0.08 || Math.cos(t) > c) continue; g += line([P(t, s.n0 + 0.2), P(t, s.n1 - 0.2)], "fu-teeth"); }
  return g;
}
function mouthSvg(V, psi, ec, hot) {
  const tm = Math.PI / 2 - psi, c = (ec - V.e) / V.r;
  if (Math.cos(tm) > c + 0.02 || Math.cos(tm) + Math.sin(tm) < -0.15) return "";
  const r0 = V.r - 0.2, r1 = V.r + 1.6, dt = (V.mw * 0.95) / V.r, n0 = V.mouth - V.mw, n1 = V.mouth + V.mw;
  const Q = (rr, t, n) => W(V.e + rr * Math.cos(t), n, V.z + rr * Math.sin(t));
  let g = "";
  for (const sgn of [1, -1]) { const t = tm - sgn * dt; if (sgn * (Math.sin(t) - Math.cos(t)) > 0) g += poly([Q(r0, t, n0), Q(r0, t, n1), Q(r1, t, n1), Q(r1, t, n0)], "fu-lip fu-lip--side"); }
  g += poly([Q(r0, tm - dt, n0), Q(r0, tm + dt, n0), Q(r1, tm + dt, n0), Q(r1, tm - dt, n0)], "fu-lip fu-lip--side");
  if (Math.cos(tm) + Math.sin(tm) > 0) {
    g += poly([Q(r1, tm - dt, n0), Q(r1, tm + dt, n0), Q(r1, tm + dt, n1), Q(r1, tm - dt, n1)], "fu-lip");
    const kk = 0.62; g += poly([Q(r1, tm - dt * kk, n0 + 0.9), Q(r1, tm + dt * kk, n0 + 0.9), Q(r1, tm + dt * kk, n1 - 0.9), Q(r1, tm - dt * kk, n1 - 0.9)], hot ? "fu-mouth fu-mouth--hot" : "fu-mouth");
  }
  return g;
}
const mouthAt = (V, psi) => { const tm = Math.PI / 2 - psi; return [V.e + (V.r + 1.4) * Math.cos(tm), V.mouth, V.z + (V.r + 1.4) * Math.sin(tm)]; };
function tapSvg(V, t, n, ec, hot) {
  if (V.e + V.r * Math.cos(t) > ec + 0.05) return "";
  const Q = (dt, dn) => W(V.e + (V.r + 0.3) * Math.cos(t + dt), n + dn, V.z + (V.r + 0.3) * Math.sin(t + dt));
  return poly([Q(-0.08, -1), Q(0.08, -1), Q(0.08, 1), Q(-0.08, 1)], hot ? "fu-tap fu-tap--hot" : "fu-tap");
}
// corte del horno por el plano e = ec: revestimiento, gases, escoria y metal (con burbujas del soplado)
function sectionSvg(V, ec, st, fl) {
  const de = ec - V.e, c = de / V.r; if (c > 0.995) return "";
  const hh = Math.sqrt(Math.max(0, V.r * V.r - de * de)), ri = V.r - 1.9, hi = Math.sqrt(Math.max(0, ri * ri - de * de));
  const R = (n, z) => W(ec, n, V.z + z);
  const rect = (na, nb, za, zb) => [R(na, za), R(nb, za), R(nb, zb), R(na, zb)];
  let g = poly(rect(V.n0, V.n1, -hh, hh), "fu-sec");
  if (hi < 0.4) return g;
  const na = V.n0 + 1.9, nb = V.n1 - 1.9;
  g += poly(rect(na, nb, -hi, hi), "fu-sec-gas");
  const zm = clamp(-ri + 2 * ri * st.level, -hi, hi), zs = clamp(zm + (st.slag || 0), -hi, hi), col = meltOf(st.kind, st.mix);
  if (st.flame) { const zf = (zs + hi) / 2, L = Math.min(14, (nb - na) * 0.45); g += poly([R(na, zf - 1.4), R(na + L * 0.55, zf - 2), R(na + L, zf), R(na + L * 0.55, zf + 1.6), R(na, zf + 1.2)], "fu-flame", ` style="opacity:${f2(0.75 + 0.25 * Math.sin(fl * 23))}"`); }
  if (zm > -hi) g += poly(rect(na, nb, -hi, zm), "fu-melt", ` style="fill:${rgb(col)}"`);
  if (zs > zm + 0.05) g += poly(rect(na, nb, zm, zs), "fu-slag");
  const nB = Math.round(4 + 16 * st.blow);
  for (let j = 0; j < nB; j++) { const ph = (fl * (0.5 + 0.6 * st.blow) + hash(j * 2.1 + V.n0)) % 1, n = lerp(na + 1.5, nb - 1.5, hash(j * 5.3 + V.n0)), z = lerp(-hi + 0.8, zs - 0.4, ph);
    if (z < zs) g += circ(R(n, z), 0.4 + ph * 0.55, "fu-bub", 1 - smooth((ph - 0.8) / 0.2)); }
  // salpicaduras en la superficie con soplado fuerte
  if (st.blow > 0.2) for (let j = 0; j < 6; j++) { const ph = (fl * 1.7 + j / 6) % 1, n = lerp(na + 3, nb - 3, hash(j * 9.1 + V.n0)); g += circ(R(n, zs + Math.sin(ph * Math.PI) * 3 * st.blow), 0.45, "fu-spark", 1 - ph); }
  g += line([R(na, zm), R(nb, zm)], "fu-surf");
  return g;
}
function vesselSvg(V, st, ec, fl) {
  let g = "";
  for (const p of PIECES.get(V.id)) g += pieceSvg(V, p, ec, st.psi || 0);
  g += mouthSvg(V, st.psi || 0, ec, st.hot);
  if (st.taps) for (const tp of st.taps) g += tapSvg(V, tp.t - (st.psi || 0), tp.n, ec, tp.hot);
  g += sectionSvg(V, ec, st, fl);
  return g;
}
// pedestales y rodillos bajo los anillos
function pedestalsSvg(V) {
  let g = ""; const zt = V.z - V.r - 1.3 + 0.6;
  for (const n of [...V.rings, ...(V.gear && V.id !== "cps" ? [] : [])]) {
    g += boxSvg(V.e - V.r * 0.85, V.e + V.r * 0.85, n - 1.2, n + 3.6, 0, Math.max(1.2, zt - 1.4), "fu-ped");
    for (const de of [-V.r * 0.55, V.r * 0.55]) g += cylA([V.e + de, n - 0.6, zt - 0.9], [0, 1, 0], 3.6, 1.3, 1.3, "fu-roller");
  }
  return g;
}

// ---------------------------------------------------------------- olla
function ladleSvg(T, a, fill, kind, cls = "fu-ladle") {
  const ax = [-Math.sin(a), 0, Math.cos(a)], u = [0, 1, 0], v = [-ax[2], 0, ax[0]];
  const base = v3.sub(T, v3.mul(ax, LAD.tz)), top = v3.add(base, v3.mul(ax, LAD.h));
  const at = (C, r, t) => v3.add(C, v3.add(v3.mul(u, r * Math.cos(t)), v3.mul(v, r * Math.sin(t))));
  const ring = (C, r, kk = 26) => { const o = []; for (let i = 0; i < kk; i++) o.push(P3(at(C, r, (i / kk) * TAU))); return o; };
  const R0 = ring(base, LAD.r0), R1 = ring(top, LAD.r1), vis = ax[0] - ax[1] + ax[2] > 0;
  // asa (atrás), olla, aros, boca o fondo, asa (adelante)
  const leg = (s) => [P3(v3.add(T, [0, s * (LAD.r1 + 0.5), 0])), P3(v3.add(T, [0, s * (LAD.r1 + 0.5), LAD.bail - 1.5])), P3(v3.add(T, [0, 0, LAD.bail]))];
  let g = line(leg(1), "fu-bail");
  const hl = hull([...R0, ...R1]);
  g += poly(hl, `${cls} fu-solid`) + poly(hl, "fu-edge");
  for (const s of [2.4, 6.8]) { const C = v3.add(base, v3.mul(ax, s)), r = lerp(LAD.r0, LAD.r1, s / LAD.h) + 0.2, pts = [];
    for (let i = 0; i <= 24; i++) { const t = (i / 24) * TAU, nrm = v3.add(v3.mul(u, Math.cos(t)), v3.mul(v, Math.sin(t))); if (nrm[0] - nrm[1] + nrm[2] > 0) pts.push(P3(at(C, r, t))); else if (pts.length) break; }
    if (pts.length > 1) g += line(pts, "fu-hoop"); }
  let lip = null;
  if (vis) { g += poly(R1, "fu-ladle-rim"); g += poly(ring(top, LAD.r1 - 0.9), "fu-ladle-in");
    if (fill > 0.02) { const s = 1.2 + (LAD.h - 2.2) * fill, C = v3.add(base, v3.mul(ax, s)), r = lerp(LAD.r0, LAD.r1, s / LAD.h) - 1.1; g += poly(ring(C, r), "fu-melt-top", ` style="fill:${rgb(MELT[kind] || MELT.bl)}"`); } }
  else g += poly(R0, `${cls} ${cls}--bot`);
  // punto más bajo del borde (por donde cae el chorro)
  let best = null; for (let i = 0; i < 24; i++) { const p = at(top, LAD.r1, (i / 24) * TAU); if (!best || p[2] < best[2]) best = p; } lip = best;
  const trun = (s) => circ(P3(v3.add(T, [0, s * (LAD.r1 + 0.4), 0])), 0.9, "fu-trunnion");
  g += trun(-1) + line(leg(-1), "fu-bail");
  return { svg: g, lip, top };
}
function potSvg(p, fill) {
  let g = cylA([p[0], p[1], 0], [0, 0, 1], 8.5, 4, 5.4, "fu-ladle fu-slagpot");
  if (fill > 0.02) { const z = 1 + 6.6 * fill, r = lerp(4, 5.4, z / 8.5) - 0.9, pts = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * TAU; pts.push(W(p[0] + r * Math.cos(t), p[1] + r * Math.sin(t), z)); } g += poly(pts, "fu-slag fu-slag--top"); }
  return g;
}
// chorro de metal fundido entre dos puntos (cae con forma de parábola)
function streamSvg(p0, p1, col, fl, w = 1) {
  const c = [lerp(p0[0], p1[0], 0.6), lerp(p0[1], p1[1], 0.6), Math.max(p0[2], p1[2]) + 0.6];
  const a = P3(p0), b = P3(p1), q = P3(c), d = `M${f2(a[0])} ${f2(a[1])}Q${f2(q[0])} ${f2(q[1])} ${f2(b[0])} ${f2(b[1])}`;
  return `<path class="fu-stream-glow" d="${d}" style="stroke-width:${f2(2.6 * w)}"/><path class="fu-stream" d="${d}" style="stroke:${rgb(col)};stroke-width:${f2(1.25 * w)}"/><path class="fu-stream-hi" d="${d}" style="stroke-dashoffset:${f2(-fl * 12)}"/>`;
}
const qAt = (p0, p1, u) => { const c = [lerp(p0[0], p1[0], 0.6), lerp(p0[1], p1[1], 0.6), Math.max(p0[2], p1[2]) + 0.6]; return v3.add(v3.add(v3.mul(p0, (1 - u) ** 2), v3.mul(c, 2 * u * (1 - u))), v3.mul(p1, u * u)); };
// canaleta (artesa) entre dos puntos a lo largo de e
function launderSvg(p0, p1, w, flow, col, fl) {
  const [a, b] = [p0, p1], n = a[1], h = 1.3;
  const top = [W(a[0], n - w, a[2]), W(b[0], n - w, b[2]), W(b[0], n + w, b[2]), W(a[0], n + w, a[2])];
  const side = [W(a[0], n - w, a[2] - h), W(b[0], n - w, b[2] - h), W(b[0], n - w, b[2]), W(a[0], n - w, a[2])];
  const end = [W(b[0], n - w, b[2] - h), W(b[0], n + w, b[2] - h), W(b[0], n + w, b[2]), W(b[0], n - w, b[2])];
  let g = poly(top, "fu-laund-in") + poly(side, "fu-laund") + poly(end, "fu-laund fu-laund--end");
  if (flow > 0.02) { const d = D([W(a[0], n, a[2] - 0.2), W(b[0], n, b[2] - 0.2)], false, f2);
    g += `<path class="fu-stream-glow" d="${d}" style="opacity:${f2(flow)}"/><path class="fu-stream" d="${d}" style="stroke:${rgb(col)};opacity:${f2(flow)}"/><path class="fu-stream-hi" d="${d}" style="stroke-dashoffset:${f2(-fl * 12)};opacity:${f2(flow)}"/>`; }
  return g;
}

// ---------------------------------------------------------------- rueda de moldeo
function wheelSvg(st, fl) {
  let g = cylA([WH.e, WH.n, 0], [0, 0, 1], 2.4, 5, 5, "fu-wheel-base");
  g += cylA([WH.e, WH.n, 2.4], [0, 0, 1], 1.6, WH.r, WH.r, "fu-wheel");
  const anode = (th, rr, z, fillC, cls) => {
    const d = [Math.cos(th), Math.sin(th)], tg = [-Math.sin(th), Math.cos(th)], c = [WH.e + rr * d[0], WH.n + rr * d[1]];
    const Q = (a, b) => W(c[0] + a * d[0] + b * tg[0], c[1] + a * d[1] + b * tg[1], z);
    const body = [Q(-2.6, -1.9), Q(2.4, -1.9), Q(2.4, 1.9), Q(-2.6, 1.9)];
    const lugs = [Q(2.4, -2.9), Q(3.3, -2.9), Q(3.3, 2.9), Q(2.4, 2.9)];
    return poly(lugs, cls, fillC ? ` style="fill:${fillC}"` : "") + poly(body, cls, fillC ? ` style="fill:${fillC}"` : "");
  };
  for (let j = 0; j < WH.N; j++) {
    const th = st.wheelPhi + j * DW;
    let dd = (((th - Math.PI) % TAU) + TAU) % TAU; if (dd > TAU - 0.01) dd = 0;   // distancia angular desde la canaleta
    g += anode(th, WH.rm, WH.z + 0.02, null, "fu-mold");
    const fillA = st.wheelI >= 0 && j === (WH.N - 1 - st.wheelI) ? st.stationFill : dd <= TAKE ? 1 : 0;
    if (fillA > 0.02) { const cool = clamp(dd / (DW * 5)), col = mixC(MELT.an, MELT.cool, cool);
      const g2 = anode(th, WH.rm, WH.z + 0.05, rgb(col), cool < 0.4 ? "fu-anode fu-anode--hot" : "fu-anode");
      g += fillA < 0.98 ? `<g style="opacity:${f2(fillA)}">${g2}</g>` : g2; }
    // vapor del rociado en la zona de enfriamiento
    if (dd > DW * 1.5 && dd < DW * 5.5 && hash(j) < 0.8) { const ph = (fl * 0.7 + hash(j * 3.3)) % 1, p = [WH.e + WH.rm * Math.cos(th), WH.n + WH.rm * Math.sin(th), WH.z + 1 + ph * 7]; g += circ(P3(p), 0.8 + ph * 1.6, "fu-steam", (1 - ph) * 0.7); }
  }
  // brazo de extracción (fijo) y su riel
  const tk = Math.PI + TAKE, pk = [WH.e + WH.rm * Math.cos(tk), WH.n + WH.rm * Math.sin(tk)];
  g += line([W(pk[0], pk[1], 13), W((TANK.e0 + TANK.e1) / 2, TANK.n1 - 2, 13)], "fu-arm");
  for (const p of [[pk[0], pk[1]], [(TANK.e0 + TANK.e1) / 2, TANK.n1 - 2]]) g += line([W(p[0], p[1], 0), W(p[0], p[1], 13)], "fu-arm fu-arm--post");
  return g;
}
function flyingAnode(u) {
  const tk = Math.PI + TAKE, a = [WH.e + WH.rm * Math.cos(tk), WH.n + WH.rm * Math.sin(tk), WH.z + 0.2], b = [(TANK.e0 + TANK.e1) / 2, TANK.n1 - 2, 6];
  const p = u < 0.3 ? v3.lerp(a, [a[0], a[1], 12], smooth(u / 0.3)) : u < 0.75 ? v3.lerp([a[0], a[1], 12], [b[0], b[1], 12], smooth((u - 0.3) / 0.45)) : v3.lerp([b[0], b[1], 12], b, smooth((u - 0.75) / 0.25));
  const Q = (de, dz) => W(p[0] + de, p[1], p[2] + dz);
  return { svg: poly([Q(-3, -6), Q(3, -6), Q(3, 0), Q(-3, 0)], "fu-anode fu-anode--plate") + poly([Q(-4, -0.2), Q(4, -0.2), Q(4, 0.8), Q(-4, 0.8)], "fu-anode fu-anode--plate") + line([Q(0, 0.8), W(p[0], p[1], 13)], "fu-cable"), p };
}
function tankSvg(fl) {
  const T = TANK; let g = "";
  g += poly([W(T.e0, T.n0, T.h), W(T.e1, T.n0, T.h), W(T.e1, T.n1, T.h), W(T.e0, T.n1, T.h)], "fu-tank-in");
  g += poly([W(T.e0, T.n0, 0), W(T.e0, T.n1, 0), W(T.e0, T.n1, T.h), W(T.e0, T.n0, T.h)], "fu-tank-back");
  g += poly([W(T.e0 + 0.6, T.n0 + 0.6, T.h - 0.9), W(T.e1 - 0.6, T.n0 + 0.6, T.h - 0.9), W(T.e1 - 0.6, T.n1 - 0.6, T.h - 0.9), W(T.e0 + 0.6, T.n1 - 0.6, T.h - 0.9)], "fu-water");
  for (let i = 7; i >= 0; i--) { const n = T.n0 + 2.4 + i * 2.3, e0 = T.e0 + 3.2, e1 = T.e1 - 3.2, z0 = 1.2, z1 = 8.2;
    g += poly([W(e0, n, z0), W(e1, n, z0), W(e1, n, z1), W(e0, n, z1)], "fu-anode fu-anode--plate") + poly([W(e0 - 1, n, z1 - 0.2), W(e1 + 1, n, z1 - 0.2), W(e1 + 1, n, z1 + 0.8), W(e0 - 1, n, z1 + 0.8)], "fu-anode fu-anode--plate"); }
  g += poly([W(T.e0, T.n0, 0), W(T.e1, T.n0, 0), W(T.e1, T.n0, T.h), W(T.e0, T.n0, T.h)], "fu-tank fu-tank--side");
  g += poly([W(T.e1, T.n0, 0), W(T.e1, T.n1, 0), W(T.e1, T.n1, T.h), W(T.e1, T.n0, T.h)], "fu-tank fu-tank--front");
  for (let j = 0; j < 4; j++) { const ph = (fl * 0.5 + j / 4) % 1; g += circ(W(lerp(T.e0 + 3, T.e1 - 3, hash(j * 4.4)), lerp(T.n0 + 3, T.n1 - 3, hash(j * 2.9)), T.h + 1 + ph * 8), 1 + ph * 1.8, "fu-steam", (1 - ph) * 0.55); }
  return g;
}

// ---------------------------------------------------------------- puente grúa
function craneSvg(cn, ce, hz) {
  let g = "";
  const c0 = [ce, cn - 1.6, 40.5], c1 = [ce, cn + 1.6, 40.5], h = [ce, cn, hz + 1.6];
  g += line([P3(c1), P3(h)], "fu-cable") + line([P3(c0), P3(h)], "fu-cable");
  g += boxSvg(ce - 1.4, ce + 1.4, cn - 1.2, cn + 1.2, hz, hz + 2, "fu-hookblk");
  g += line([W(ce, cn, hz), W(ce + 0.6, cn, hz - 1.2), W(ce - 0.2, cn, hz - 1.6)], "fu-hookline");
  g += boxSvg(RAIL.e0 - 1.4, RAIL.e0 + 2.6, cn - 4.4, cn + 4.4, RAIL.z + 1, RAIL.z + 4, "fu-truck");
  g += boxSvg(RAIL.e0, RAIL.e1 + 1, cn - 2.2, cn + 2.2, 37, 40.5, "fu-bridge");
  g += boxSvg(RAIL.e1 - 1.6, RAIL.e1 + 2.4, cn - 4.4, cn + 4.4, RAIL.z + 1, RAIL.z + 4, "fu-truck");
  g += boxSvg(ce - 3.6, ce + 3.6, cn - 3.2, cn + 3.2, 40.5, 43.5, "fu-trolley");
  return g;
}

// ---------------------------------------------------------------- detalle A: convertidores en corte (2D)
function sectionCircle(cx, cy, R, level, slag, col, blow, fl, opt = {}) {
  let g = `<circle class="fu-a-shell" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R + 3)}"/><circle class="fu-a-gas" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R)}"/>`;
  const clip = opt.clip;
  const ym = cy + R - 2 * R * level, ys = ym - slag;
  g += `<g clip-path="url(#${clip})"><rect x="${f1(cx - R)}" y="${f1(ym)}" width="${f1(2 * R)}" height="${f1(2 * R)}" style="fill:${rgb(col)}"/>`;
  if (slag > 0) g += `<rect class="fu-a-slag" x="${f1(cx - R)}" y="${f1(ys)}" width="${f1(2 * R)}" height="${f1(slag)}"/>`;
  // burbujas del aire de las toberas (entran por el costado izquierdo, bajo el baño)
  const tx = cx - R * 0.93, ty = cy + R * 0.32, nb = Math.round(8 + 22 * blow);
  for (let j = 0; j < nb; j++) { const ph = (fl * (0.35 + 0.5 * blow) + hash(j * 3.1 + R)) % 1, x = tx + 3 + ph * R * (0.4 + 0.9 * hash(j * 1.7)), y = lerp(ty, ys + 1, ph) + Math.sin(ph * 9 + j) * 1.2;
    g += circ([x, y], 0.8 + ph * 1.2, "fu-a-bub", 1 - smooth((ph - 0.85) / 0.15)); }
  if (opt.conc) for (let j = 0; j < 10; j++) { const ph = (fl * 0.5 + j / 10) % 1; g += circ([tx + 2 + ph * R * 0.8, ty - 1 + Math.sin(ph * 7 + j) * 2 - ph * 4], 0.9, "fu-a-conc", 1 - ph); }
  g += "</g>";
  // toberas
  for (let j = -1; j <= 1; j++) g += `<path class="fu-a-tuyere" d="M${f1(tx - 9)} ${f1(ty + j * 2.6)}L${f1(tx + 2)} ${f1(ty + j * 0.8)}"/>`;
  // boca con gases
  g += `<path class="fu-a-mouth" d="M${f1(cx - 5)} ${f1(cy - R - 3)}V${f1(cy - R - 9)}M${f1(cx + 5)} ${f1(cy - R - 3)}V${f1(cy - R - 9)}"/>`;
  for (let j = 0; j < 5; j++) { const ph = (fl * 0.6 + j / 5) % 1; g += circ([cx + Math.sin(ph * 5 + j) * 2, cy - R - 4 - ph * 14], 1.2 + ph * 2, "fu-a-gasp", (1 - ph) * 0.85); }
  return { svg: g, pts: { mouth: [cx, cy - R - 9], tuy: [tx - 6, ty], slag: [cx + R * 0.55, ys + slag / 2], melt: [cx + R * 0.3, (ym + cy + R) / 2 + 2], shell: [cx + (R + 3) * 0.7, cy + (R + 3) * 0.71] } };
}
function detailA(box, s, m, fl) {
  const [bx, by, bw, bh] = box, cy = by + 74;
  const ct = sectionCircle(bx + 64, cy, 30, 0.42, 6, MELT.wm, 0.8, fl, { clip: "fu-clipA1", conc: true });
  const p = s.plant, cps = sectionCircle(bx + bw - 66, cy + 4, 25, clamp(p.cpsLevel * 0.9 + 0.08), 0, meltOf("cps", p.cpsMix), p.cpsBlow, fl, { clip: "fu-clipA2" });
  let g = ct.svg + cps.svg;
  g += `<text class="fu-a-name" x="${f1(bx + 64)}" y="${f1(by + bh - 26)}" text-anchor="middle">Convertidor Teniente</text><text class="fu-a-name" x="${f1(bx + bw - 66)}" y="${f1(by + bh - 26)}" text-anchor="middle">Peirce-Smith</text>`;
  g += `<text class="fu-a-eq" x="${f1(bx + 64)}" y="${f1(by + bh - 19)}" text-anchor="middle">2FeS + 3O₂ → 2FeO + 2SO₂</text><text class="fu-a-eq" x="${f1(bx + bw - 66)}" y="${f1(by + bh - 19)}" text-anchor="middle">Cu₂S + O₂ → 2Cu + SO₂</text>`;
  g += `<path class="fu-a-arrow" d="M${f1(bx + 100)} ${f1(cy - 4)}H${f1(bx + bw - 98)}"/><path class="fu-a-arrowhead" d="M${f1(bx + bw - 98)} ${f1(cy - 6.4)}L${f1(bx + bw - 94)} ${f1(cy - 4)}L${f1(bx + bw - 98)} ${f1(cy - 1.6)}Z"/><text class="fu-a-small" x="${f1(bx + bw / 2 + 1)}" y="${f1(cy - 7)}" text-anchor="middle">olla</text>`;
  return { svg: g, ct: ct.pts, cps: cps.pts };
}
// ---------------------------------------------------------------- detalle B: horno de ánodos y ánodo (2D)
function detailB(box, s, m, fl) {
  const [bx, by, bw, bh] = box, cx = bx + 62, cy = by + 74, R = 28, p = s.plant;
  const ox = p.afRefine > 0.5;
  const r = sectionCircle(cx, cy, R, clamp(p.afLevel), 0, MELT.an, ox ? 0.9 : 0.35, fl, { clip: "fu-clipB" });
  let g = r.svg;
  // quemador (llama desde la tapa del horno, vista de frente)
  g += `<path class="fu-a-flame" d="M${f1(cx + R + 3)} ${f1(cy - 10)}Q${f1(cx + 10)} ${f1(cy - 15 + Math.sin(fl * 20))} ${f1(cx - 4)} ${f1(cy - 9)}Q${f1(cx + 10)} ${f1(cy - 5)} ${f1(cx + R + 3)} ${f1(cy - 7)}Z"/>`;
  g += `<rect class="fu-a-burner" x="${f1(cx + R + 2)}" y="${f1(cy - 11)}" width="9" height="4.6" rx="1"/>`;
  // ánodo de frente
  const ax = bx + bw - 72, ay = by + 34, aw = 46, ah = 50;
  g += `<path class="fu-b-anode" d="M${f1(ax - 8)} ${f1(ay)}H${f1(ax + aw + 8)}V${f1(ay + 6)}H${f1(ax + aw)}V${f1(ay + ah)}H${f1(ax)}V${f1(ay + 6)}H${f1(ax - 8)}Z"/>`;
  g += `<path class="fu-b-dim" d="M${f1(ax)} ${f1(ay + ah + 5)}H${f1(ax + aw)}M${f1(ax)} ${f1(ay + ah + 3)}V${f1(ay + ah + 7)}M${f1(ax + aw)} ${f1(ay + ah + 3)}V${f1(ay + ah + 7)}"/><text class="fu-a-small" x="${f1(ax + aw / 2)}" y="${f1(ay + ah + 12)}" text-anchor="middle">~1 m · 4–5 cm de espesor</text>`;
  g += `<text class="fu-b-big" x="${f1(ax + aw / 2)}" y="${f1(ay + 25)}" text-anchor="middle">99,6 %</text><text class="fu-a-small fu-a-small--in" x="${f1(ax + aw / 2)}" y="${f1(ay + 33)}" text-anchor="middle">Cu</text>`;
  g += `<text class="fu-a-name" x="${f1(cx)}" y="${f1(by + bh - 26)}" text-anchor="middle">Horno de ánodos</text><text class="fu-a-eq" x="${f1(cx)}" y="${f1(by + bh - 19)}" text-anchor="middle">${ox ? "oxidación: S + O₂ → SO₂" : "reducción: quita el O₂ disuelto"}</text>`;
  return { svg: g, pts: { burner: [cx + R + 9, cy - 9], tuy: r.pts.tuy, melt: r.pts.melt, mouth: r.pts.mouth, lug: [ax - 6, ay + 3], anode: [ax + aw, ay + ah * 0.7] } };
}

// ---------------------------------------------------------------- lámina
export async function createFundicion() {
  const root = document.createElement("div");
  root.className = "fu-plate";
  root.style.cssText = `position:absolute;left:${VIEW[0]}px;top:${VIEW[1]}px;width:${VIEW[2]}px;height:${VIEW[3]}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "fu-svg", role: "group", tabindex: "0",
    "aria-label": "Fundición: la nave se abre y muestra el convertidor Teniente, el convertidor Peirce-Smith, el horno de ánodos y la rueda de moldeo; el puente grúa mueve las ollas de metal fundido. Espacio pausa; coma y punto cambian de paso; 1 a 5 eligen un equipo." }, root);
  const defs = el("defs", {}, svg);
  const geo = await import("./fundicion-geo.js").catch(() => ({ SIL: "" }));
  el("path", { d: geo.SIL, class: "fu-sil" }, svg);
  // dibujo de Emilio, separado en partes
  const text = (await (await fetch(U("fundidora.svg"))).text()).replace(/\bcls-(\d+)/g, "fua-cls-$1").replace(/\sid="[^"]*"/g, "");
  const doc = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  const st0 = doc.querySelector("style"); if (st0) { el("style", {}, defs).textContent = st0.textContent; st0.remove(); }
  const K = [...doc.querySelector("g g").children];
  const artG = (cls, idx, parent) => { const g = el("g", { class: cls, transform: `translate(${REG[0]} ${REG[1]}) scale(${S})` }, parent); idx.forEach((i) => g.appendChild(document.importNode(K[i], true))); return g; };
  const L = {};
  for (const n of ["roofBack", "back", "ducts", "chim", "vesselsB", "floorItems", "railB", "hang", "railF", "left", "front", "roofFront", "chimTop", "annex", "top"]) L[n] = el("g", { class: `fu-l-${n}` }, svg);
  const roof = artG("fu-roof", ART.roof, L.roofFront);
  const chim = artG("fu-chim", ART.chim, L.chimTop);
  artG("fu-left", ART.left, L.left);
  const frontOuter = el("g", { class: "fu-front" }, L.front); artG("", ART.front.slice(0, 2), frontOuter);
  const frontDet = artG("fu-front-det", ART.front.slice(2), frontOuter);   // ventanas y puertas: al pasar los 45° se ve la cara interior
  const annex = artG("fu-annex", ART.annex, L.annex);
  void chim;

  // ---- interior estático: piso, muros interiores, ductos, rieles, columnas
  const back = el("g", { class: "fu-inside", "data-eq": "" }, L.back);
  {
    let g = "";
    g += poly([W(0, 0), W(B.E, 0), W(B.E, B.N), W(0, B.N)], "fu-floor");
    for (let n = 24; n < B.N; n += 24) g += line([W(0, n, 0.02), W(B.E, n, 0.02)], "fu-floor-line");
    g += line([W(48, 0, 0.02), W(48, B.N, 0.02)], "fu-floor-line fu-floor-line--aisle");
    // muro posterior (cara interior) con pilastras y ventanales altos
    g += poly([W(0, 0, 0), W(0, B.N, 0), W(0, B.N, B.H), W(0, 0, B.H)], "fu-wall-in");
    g += poly([W(0, 6, 29), W(0, B.N - 6, 29), W(0, B.N - 6, 36), W(0, 6, 36)], "fu-glass");
    for (let n = 16; n < B.N; n += 16) g += line([W(0, n, 0), W(0, n, B.H)], "fu-pilaster");
    // muro del fondo (n = N, cara interior) con portón
    g += poly([W(0, B.N, 0), W(B.E, B.N, 0), W(B.E, B.N, B.H), W(0, B.N, B.H)], "fu-wall-in fu-wall-in--end");
    g += poly([W(62, B.N, 0), W(92, B.N, 0), W(92, B.N, 24), W(62, B.N, 24)], "fu-door");
    // coronamiento de los muros (espesor)
    g += poly([W(-1.6, 0, B.H), W(0, 0, B.H), W(0, B.N, B.H), W(-1.6, B.N + 1.6, B.H)], "fu-wall-top");
    g += poly([W(-1.6, B.N + 1.6, B.H), W(B.E, B.N + 1.6, B.H), W(B.E, B.N, B.H), W(0, B.N, B.H)], "fu-wall-top");
    // zócalo del muro abatido
    g += boxSvg(B.E - 1.6, B.E, 0, B.N, 0, 1.4, "fu-sill");
    back.innerHTML = g;
  }
  const ducts = el("g", { class: "fu-gasline", "data-eq": "" }, L.ducts);
  {
    let g = "";
    g += cylA([MANI.e, 100, MANI.z], [-1, 0, 0], MANI.e + 2, 2.1, 2.1, "fu-duct");
    const hood = (V, e0, e1, n0, n1, z0) => boxSvg(e0, e1, n0, n1, z0, z0 + 2.6, "fu-hood") + cylA([MANI.e + 1, (n0 + n1) / 2, z0 + 2.6], [0, 0, 1], MANI.z - z0 - 2.6, 1.6, 1.6, "fu-duct");
    g += hood(CT, 21, 39, 75, 87, 32.2) + hood(CPS, 21, 38, 122, 134, 27) + hood(AF, 21, 35, 177, 185, 27.2);
    g += cylA([MANI.e, MANI.n0, MANI.z], [0, 1, 0], MANI.n1 - MANI.n0, 2.2, 2.2, "fu-duct");
    // aire enriquecido: cañerías a las toberas (detrás de los convertidores)
    g += pipeSvg([[0, 46, 24], [16, 46, 24], [16, 108, 24]], "fu-pipe--air") + pipeSvg([[0, 118, 20], [17, 118, 20], [17, 138, 20]], "fu-pipe--air");
    ducts.innerHTML = g;
  }
  const railB = el("g", { class: "fu-rails", "data-eq": "grua" }, L.railB);
  {
    let g = "";
    for (const n of [40, 113.5, 146, 188]) g += boxSvg(RAIL.e0 - 0.8, RAIL.e0 + 0.8, n - 0.8, n + 0.8, 0, RAIL.z, "fu-col");
    g += boxSvg(RAIL.e0 - 1, RAIL.e0 + 1, 38, B.N - 1, RAIL.z, RAIL.z + 2, "fu-rail");
    railB.innerHTML = g;
  }
  const railF = el("g", { class: "fu-rails", "data-eq": "grua" }, L.railF);
  {
    let g = "";
    for (const n of [2, 64, 128, 190]) g += boxSvg(RAIL.e1 - 0.8, RAIL.e1 + 0.8, n - 0.8, n + 0.8, 0, RAIL.z, "fu-col");
    g += boxSvg(RAIL.e1 - 1, RAIL.e1 + 1, 1, B.N - 1, RAIL.z, RAIL.z + 2, "fu-rail");
    railF.innerHTML = g;
  }
  // ---- equipos (dinámicos)
  const gAF = el("g", { "data-eq": "refino" }, L.vesselsB), gCPS = el("g", { "data-eq": "cps" }, L.vesselsB);
  const gWheel = el("g", { "data-eq": "rueda" }, L.vesselsB), gLaundAF = el("g", { "data-eq": "refino" }, L.vesselsB);
  const gCT = el("g", { "data-eq": "ct" }, L.vesselsB), gCTx = el("g", { "data-eq": "ct" }, L.vesselsB);
  const gHang = el("g", { "data-eq": "grua" }, L.hang);
  const gFx = el("g", { class: "fu-fx" }, L.hang);
  const pedAF = pedestalsSvg(AF), pedCPS = pedestalsSvg(CPS), pedCT = pedestalsSvg(CT);
  const burner = cylA([AF.e, AF.n0 - 6, AF.z + 1.5], [0, 1, 0], 6, 1.3, 1.3, "fu-duct fu-burner");
  const feedPipe = pipeSvg(FEED, "fu-pipe--conc");

  // ---- capa superior: etiquetas, recorrido, detalle
  const topG = el("g", { class: "fu-top" }, L.top);
  const lab = el("g", { class: "fu-labels" }, topG);
  const LB = (p, t, a = "start") => { el("text", { x: f1(p[0]), y: f1(p[1]), class: "fu-small", "text-anchor": a }, lab).textContent = t; };
  LB(v3.add(W(0, 36, 34), [-3, -3]), "concentrado seco", "end");
  LB(v3.add(W(0, 100, 44), [-3, -2]), "SO₂ → planta de ácido", "end");
  LB(v3.add(W(SLAGPOT[0] + 6, SLAGPOT[1], 3), [3, 4]), "escoria → limpieza", "start");
  LB(v3.add(W(TANK.e1, TANK.n0 + 4, 0), [3, 7]), "ánodos → refinería", "start");
  LB(v3.add(W(0, 46, 24), [-3, 5]), "aire + O₂", "end");
  const tourG = el("g", { class: "fu-tour" }, topG);
  const tourRing = el("circle", { r: 5, class: "fu-tour-ring" }, tourG), tourDot = el("circle", { r: 1.9, class: "fu-tour-dot" }, tourG);
  const tourPulse = el("circle", { r: 8, class: "fu-tour-pulse" }, topG);
  const CAL = { box: [4450, 902, 252, 152] };
  const calG = el("g", { class: "fu-callouts" }, topG);
  const [cx0, cy0, cw, ch] = CAL.box, cardG = el("g", { class: "fu-callout" }, calG);
  CAL.lead = el("path", { class: "fu-lead" }, cardG); CAL.leadDot = el("circle", { r: 2.2, class: "fu-lead-dot" }, cardG);
  el("rect", { x: cx0, y: cy0, width: cw, height: ch, rx: 7, class: "fu-card" }, cardG);
  const cclip = el("clipPath", { id: "fu-cal" }, defs); el("rect", { x: cx0 + 0.6, y: cy0 + 13, width: cw - 1.2, height: ch - 13.6, rx: 6 }, cclip);
  el("circle", { cx: cx0 + 64, cy: cy0 + 74, r: 30 }, el("clipPath", { id: "fu-clipA1" }, defs));
  el("circle", { cx: cx0 + cw - 66, cy: cy0 + 78, r: 25 }, el("clipPath", { id: "fu-clipA2" }, defs));
  el("circle", { cx: cx0 + 62, cy: cy0 + 74, r: 28 }, el("clipPath", { id: "fu-clipB" }, defs));
  CAL.body = el("g", { "clip-path": "url(#fu-cal)" }, cardG); CAL.title = el("text", { x: cx0 + 8, y: cy0 + 9.5, class: "fu-cal-title" }, cardG); CAL.labels = el("g", {}, cardG); CAL.g = cardG;
  const CAL_AT = { A: W(CT.e + CT.r * 0.7, 92, CT.z + 4), B: W(AF.e + AF.r * 0.7, 160, AF.z + 3) };
  // etiquetas de foco
  const tagsG = el("g", { class: "fu-tags" }, topG);
  const TAGS = { ct: ["Convertidor Teniente", W(CT.e, 62, CT.z + CT.r + 6)], cps: ["Convertidor Peirce-Smith", W(CPS.e, 128, 38)], grua: ["Puente grúa", null], refino: ["Horno de ánodos", W(AF.e, 160, 36)], rueda: ["Rueda de moldeo", W(WH.e, WH.n, 12)] };
  const tagEls = {};
  for (const [id, [label]] of Object.entries(TAGS)) {
    const g = el("g", { class: "fu-tag" }, tagsG);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -12, class: "fu-tag-line" }, g);
    const ww = label.length * 3.7 + 12; el("rect", { x: -ww / 2, y: -23, width: ww, height: 11, rx: 5.5, class: "fu-tag-pill" }, g);
    el("text", { x: 0, y: -15.6, class: "fu-tag-text", "text-anchor": "middle" }, g).textContent = label; tagEls[id] = g;
  }
  const units = [[L.back, ""], [ducts, ""], [L.roofBack, ""], [L.chimTop, ""], [L.left, ""], [L.front, ""], [L.roofFront, ""], [L.annex, ""], [gAF, "refino"], [gLaundAF, "refino"], [gCPS, "cps"], [gWheel, "rueda"], [gCT, "ct"], [gCTx, "ct"], [gHang, "grua"], [railB, "grua"], [railF, "grua"], [gFx, ""]];

  // ------------------------------------------------------------ estado
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const ST = { t: 0, flow: 0, o2: 35, open: 1, cut: 0 };
  const shown = { open: 0, cut: 0 };
  let selected = null, playing = !still.matches, active = false, raf = 0, last = 0, sliderDetail = null;
  if (still.matches) { ST.t = STEPS[1].t0 + 2; shown.open = 1; }
  function step(dt) { ST.flow += dt; ST.t = (ST.t + dt) % PERIOD; }
  const live = () => { const m = model(ST.o2), [pur, mat] = purityAt(ST.t, m); return { t: ST.t, m, plant: plantAt(ST.t), step: stepAt(ST.t), pur, mat }; };
  const detailNow = () => (selected ? (selected === "ct" || selected === "cps" ? "A" : selected === "refino" || selected === "rueda" ? "B" : null) : sliderDetail);
  let roofIn = "front";

  function draw() {
    const s = live(), m = s.m, p = s.plant, fl = ST.flow;
    // ---- apertura: techo que sube (y pasa atrás a mitad de camino) y muro del frente que se abate
    const o = shown.open, ru = smooth(o / 0.75), wu = smooth((o - 0.12) / 0.88);
    const want = ru < 0.5 ? "front" : "back";
    if (want !== roofIn) { (want === "front" ? L.roofFront : L.roofBack).appendChild(roof); roofIn = want; }
    roof.setAttribute("transform", `translate(${f2(REG[0] - 9 * ru)} ${f2(REG[1] - 78 * ru)}) scale(${S})`);
    roof.style.opacity = f2(ru < 0.5 ? 1 - 1.6 * ru : 0.2 + 0.16 * (ru - 0.5) / 0.5);
    const ph = (Math.PI / 2) * wu, k1 = 0.866 * Math.sin(ph), k2 = 1 - Math.cos(ph) + 0.5 * Math.sin(ph), A = O[1] + B.E + O[0] / 1.732;
    frontOuter.setAttribute("transform", `matrix(${[1 - k1 / 1.732, -k2 / 1.732, -k1, 1 - k2, k1 * A, k2 * A].map((v) => v.toFixed(6)).join(" ")})`);
    annex.style.opacity = f2(1 - smooth(o * 2.2));
    frontDet.style.opacity = f2(1 - smooth((ph - 0.6) / 0.35));
    lab.style.opacity = f2(smooth((o - 0.7) / 0.3));
    // ---- hornos
    const cut = shown.cut, ecOf = (V) => V.e + (1 - cut) * V.r;
    const hotCT = true;
    gAF.innerHTML = pedAF + vesselSvg(AF, { psi: p.afPsi, level: p.afLevel, kind: "an", blow: p.afRefine, hot: true, flame: true }, ecOf(AF), fl) + burner;
    gCPS.innerHTML = pedCPS + vesselSvg(CPS, { psi: p.cpsPsi, level: p.cpsLevel, kind: "cps", mix: p.cpsMix, blow: p.cpsBlow, hot: p.cpsBlow > 0.1 || p.cpsFill || p.cpsPour }, ecOf(CPS), fl);
    gWheel.innerHTML = wheelSvg(p, fl) + tankSvg(fl) + (p.fly >= 0 ? flyingAnode(p.fly).svg : "");
    // canaleta del horno de ánodos a la rueda (y chorro al molde)
    {
      const sp = [AF.e + (AF.r + 1.6) * Math.cos(0.35 - p.afPsi), 170, AF.z + (AF.r + 1.6) * Math.sin(0.35 - p.afPsi)];
      let g = boxSvg(54, 56, 169, 171, 0, 9.4, "fu-ped") + launderSvg(L_AF[0], L_AF[1], 1.6, p.afPour, MELT.an, fl);
      if (p.afPour) { g += streamSvg(sp, L_AF[0], MELT.an, fl, 0.9); if (p.pouring) g += streamSvg(L_AF[1], [WH.e - WH.rm, WH.n, WH.z + 0.3], MELT.an, fl, 0.8); }
      gLaundAF.innerHTML = g;
    }
    gCT.innerHTML = pedCT + vesselSvg(CT, { psi: 0, level: 0.5, slag: 2.6, kind: "wm", blow: 0.45 + 0.4 * (m.o2 - O2_MIN) / (O2_MAX - O2_MIN), hot: hotCT, taps: [{ ...TAP.matte, hot: p.matteTap > 0 }, { ...TAP.slag, hot: p.slagTap > 0 }] }, ecOf(CT), fl);
    {
      const mt = [CT.e + (CT.r + 0.3) * Math.cos(TAP.matte.t), TAP.matte.n, CT.z + (CT.r + 0.3) * Math.sin(TAP.matte.t)];
      const sl = [CT.e + (CT.r + 0.3) * Math.cos(TAP.slag.t), TAP.slag.n, CT.z + (CT.r + 0.3) * Math.sin(TAP.slag.t)];
      let g = feedPipe;
      g += launderSvg(L_SLAG[0], L_SLAG[1], 1.4, p.slagTap, MELT.slag, fl) + launderSvg(L_MATTE[0], L_MATTE[1], 1.5, p.matteTap, MELT.wm, fl);
      if (p.slagTap > 0) g += streamSvg(sl, L_SLAG[0], MELT.slag, fl, 0.7 * p.slagTap) + streamSvg(L_SLAG[1], [SLAGPOT[0] - 1.5, SLAGPOT[1], 7], MELT.slag, fl, 0.8 * p.slagTap);
      if (p.matteTap > 0) g += streamSvg(mt, L_MATTE[0], MELT.wm, fl, 0.8 * p.matteTap) + streamSvg(L_MATTE[1], [HOME[0] - 1.5, HOME[1], 7.5], MELT.wm, fl, 0.9 * p.matteTap);
      // concentrado que avanza por la cañería de alimentación
      g += `<path class="fu-conc" d="${D(FEED.map(P3), false, f2)}" style="stroke-dashoffset:${f2(-fl * 9)}"/>`;
      g += potSvg(SLAGPOT, p.slagPot);
      gCTx.innerHTML = g;
    }
    // ---- olla, chorros de carga y vaciado, puente grúa
    {
      const ld = p.ladle, lad = ladleSvg(ld.T, ld.a, ld.f, ld.kind);
      let fx = "";
      if (p.cpsFill) fx += streamSvg(lad.lip, mouthAt(CPS, p.cpsPsi), MELT.wm, fl, 1);
      if (p.afFill) fx += streamSvg(lad.lip, mouthAt(AF, p.afPsi), MELT.bl, fl, 1);
      if (p.cpsPour) fx += streamSvg(mouthAt(CPS, p.cpsPsi), [CPSL[0] - 1.5, CPSL[1], 7.5], MELT.bl, fl, 1.2);
      // gases y chispas
      const gas = (pt, n, amp, cls = "fu-gas") => { let q = ""; for (let j = 0; j < n; j++) { const ph = (fl * 0.55 + j / n + hash(pt[1] + j)) % 1; q += circ(W(pt[0] - ph * 2, pt[1] + Math.sin(ph * 6 + j) * 1.5, pt[2] + ph * amp), 1 + ph * 2.2, cls, (1 - ph) * 0.75); } return q; };
      fx += gas(mouthAt(CT, 0), 4, 4) + (p.cpsBlow > 0.1 ? gas(mouthAt(CPS, p.cpsPsi), 5, 6) : "");
      if (p.cpsBlow > 0.1) { const mp = mouthAt(CPS, p.cpsPsi); for (let j = 0; j < 10; j++) { const ph = (fl * 1.3 + hash(j * 7.7)) % 1, ang = (hash(j * 3.1) - 0.5) * 1.4; fx += circ(W(mp[0] + Math.sin(ang) * ph * 9, mp[1] + (hash(j * 5.5) - 0.5) * 5, mp[2] + ph * 10 - ph * ph * 7), 0.45, "fu-spark", (1 - ph) * p.cpsBlow); } }
      // humo tenue en las chimeneas (gases ya limpios)
      CHIM_TOP.forEach((c, i) => { for (let j = 0; j < 3; j++) { const ph = (fl * 0.18 + j / 3 + i * 0.27) % 1; fx += circ([c[0] + ph * 9, c[1] - 3 - ph * 16], 2 + ph * 4, "fu-smoke", (1 - ph) * (0.25 + 0.4 * (m.so2 - 9) / 15)); } });
      gFx.innerHTML = fx;
      gHang.innerHTML = lad.svg + craneSvg(p.crane.n, p.crane.e, p.hook[2]);
    }
    // ---- detalles
    const det = detailNow();
    CAL.g.style.display = det ? "" : "none";
    if (det) {
      const [bx, by, bw, bh] = CAL.box, at = CAL_AT[det];
      CAL.leadDot.setAttribute("cx", f1(at[0])); CAL.leadDot.setAttribute("cy", f1(at[1]));
      const e0 = [bx, by + bh * 0.62];
      CAL.lead.setAttribute("d", `M${f1(e0[0])} ${f1(e0[1])}C${f1(e0[0] - 50)} ${f1(e0[1])} ${f1(at[0] + 40)} ${f1(at[1] - 40)} ${f1(at[0])} ${f1(at[1])}`);
      const T1 = by + 22, B1 = by + bh - 5;
      if (det === "A") { const r = detailA(CAL.box, s, m, fl); CAL.title.textContent = "Detalle · Convertidores en corte"; CAL.body.innerHTML = r.svg;
        CAL.labels.innerHTML = lbl(r.ct.mouth, [bx + 8, T1], `Gases ${fdec(m.so2)} % SO₂`, "start") + lbl(r.cps.mouth, [bx + bw - 7, T1], "Boca: carga y vaciado", "end") +
          lbl(r.ct.tuy, [bx + 8, B1], `Toberas: concentrado + aire ${m.o2} % O₂`, "start") + lbl(r.cps.melt, [bx + bw - 7, B1], p.cpsMix > 0.6 ? "Blíster 99,3 % Cu" : `Metal blanco ${fdec(m.wm, 0)} % Cu`, "end") +
          lbl(r.ct.slag, [bx + 104, by + 40], "Escoria 8–10 % Cu", "start") + lbl(r.ct.melt, [bx + 104, by + 50], `Metal blanco ${fdec(m.wm, 0)} % Cu`, "start"); }
      else { const r = detailB(CAL.box, s, m, fl); CAL.title.textContent = "Detalle · Refinación y moldeo"; CAL.body.innerHTML = r.svg;
        CAL.labels.innerHTML = lbl(r.pts.burner, [bx + 8, T1], "Quemador ~1.200 °C", "start") + lbl(r.pts.lug, [bx + bw - 7, T1], "Orejas: cuelga en la celda", "end") +
          lbl(r.pts.tuy, [bx + 8, B1], "Toberas: aire, luego gas reductor", "start") + lbl(r.pts.anode, [bx + bw - 7, B1], "Ánodo ~400 kg → refinería", "end"); }
    }
    drawTour(s);
    for (const id of ORDER) {
      const on = selected === id; tagEls[id].toggleAttribute("data-on", on);
      if (on) { const at = id === "grua" ? W(p.crane.e, p.crane.n, 44) : TAGS[id][1]; tagEls[id].setAttribute("transform", `translate(${f1(at[0])} ${f1(at[1])})`); }
    }
    listeners.forEach((fn) => fn(s, api));
  }
  function drawTour(s) {
    const t = s.t, p = s.plant; let tp = null, inside = null;
    const ladTop = () => { const ld = p.ladle; return v3.add(ld.T, [0, 0, 2.5]); };
    const insideOf = (V, n) => (shown.cut > 0.5 ? null : W(V.e, n, V.z));
    const inSec = (V, n, z) => (shown.cut > 0.5 ? W(V.e + (1 - shown.cut) * V.r, n, z) : null);
    if (t < 5) { const pl = FEED.map(P3); const u = t / 5; let tot = 0; const sg = []; for (let i = 1; i < pl.length; i++) { const d = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); sg.push(d); tot += d; }
      let s0 = u * tot, i = 0; while (i < sg.length - 1 && s0 > sg[i]) { s0 -= sg[i]; i++; } const w = clamp(s0 / sg[i]); tp = [lerp(pl[i][0], pl[i + 1][0], w), lerp(pl[i][1], pl[i + 1][1], w)]; }
    else if (t < 9.5) { tp = inSec(CT, lerp(50, 70, (t - 5) / 4.5), CT.z - 6 + 2 * Math.sin(t * 3)); inside = tp ? null : insideOf(CT, 70); }
    else if (t < 13.6) { const mt = [CT.e + CT.r * Math.cos(TAP.matte.t), TAP.matte.n, CT.z + CT.r * Math.sin(TAP.matte.t)], u = (t - 9.5) / 4.1;
      const path = [mt, ...L_MATTE, [HOME[0], HOME[1], 7.5]]; const seg = Math.min(2, Math.floor(u * 3)), w = u * 3 - seg; tp = P3(v3.lerp(path[seg], path[seg + 1], w)); }
    else if (t < 21.1 || (t >= 26.2 && t < 31.6) || (t >= 33.5 && t < 39.5)) { tp = P3(ladTop()); if (t >= 26.2 && t < 31.6) { tp = inSec(CPS, 128, CPS.z - 3); inside = tp ? null : insideOf(CPS, 128); } }
    else if (t < 23.3) { tp = P3(qAt(p.ladle.T, mouthAt(CPS, p.cpsPsi), smooth((t - 21.1) / 2.2))); }
    else if (t < 26.2) { tp = inSec(CPS, 128, CPS.z - 3); inside = tp ? null : insideOf(CPS, 128); }
    else if (t < 33.5) { tp = P3(qAt(mouthAt(CPS, p.cpsPsi), [CPSL[0], CPSL[1], 7.5], smooth((t - 31.6) / 1.9))); }
    else if (t < 42.4) { tp = P3(qAt(p.ladle.T, mouthAt(AF, p.afPsi), smooth((t - 39.5) / 2.9))); }
    else if (t < 44) { tp = inSec(AF, 167, AF.z - 3); inside = tp ? null : insideOf(AF, 167); }
    else if (t < 44.24) { tp = P3(v3.lerp(L_AF[0], L_AF[1], (t - 44) / 0.24)); }
    else { const r1 = p.wheelRot - 1;
      if (r1 < 0) tp = P3(L_AF[1]);
      else if (r1 < 7.5) { const ang = Math.PI + r1 * DW; tp = W(WH.e + WH.rm * Math.cos(ang), WH.n + WH.rm * Math.sin(ang), WH.z + 0.6); }
      else if (p.wheelI === 7 && p.fly >= 0) tp = P3(flyingAnode(p.fly).p);
      else tp = W((TANK.e0 + TANK.e1) / 2, TANK.n1 - 2, 9); }
    if (shown.open < 0.6) { tp = null; inside = null; }
    if (tp) { for (const n of [tourRing, tourDot]) { n.setAttribute("cx", f1(tp[0])); n.setAttribute("cy", f1(tp[1] - 1)); n.style.opacity = 1; } }
    else { tourRing.style.opacity = 0; tourDot.style.opacity = 0; }
    if (inside) { const ph2 = (performance.now() / 900) % 1; tourPulse.setAttribute("cx", f1(inside[0])); tourPulse.setAttribute("cy", f1(inside[1])); tourPulse.setAttribute("r", f1(4 + ph2 * 9)); tourPulse.style.opacity = (0.9 * (1 - ph2)).toFixed(2); }
    else tourPulse.style.opacity = 0;
  }
  const lbl = (p, q, text, anchor) => {
    const w = text.length * 2.72, x0 = anchor === "end" ? q[0] - w : anchor === "middle" ? q[0] - w / 2 : q[0], x1 = x0 + w;
    const e = p[0] < x0 ? [x0 - 1.2, q[1] - 1.8] : p[0] > x1 ? [x1 + 1.2, q[1] - 1.8] : [p[0], p[1] < q[1] ? q[1] - 6 : q[1] + 2];
    return `<path class="fu-cal-lead" d="M${f1(p[0])} ${f1(p[1])}L${f1(e[0])} ${f1(e[1])}"/><circle class="fu-cal-dot" cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.3"/><text class="fu-cal-text" x="${f1(q[0])}" y="${f1(q[1])}" text-anchor="${anchor}">${text}</text>`;
  };

  // ------------------------------------------------------------ reloj
  const listeners = new Set();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) step(dt);
    const kk = 1 - Math.exp(-dt * (shown.open < 0.999 && ST.open === 1 && !touched ? 1.6 : 6));
    for (const key of ["open", "cut"]) { shown[key] += (ST[key] - shown[key]) * kk; if (Math.abs(ST[key] - shown[key]) < 0.002) shown[key] = ST[key]; }
    draw(); raf = active ? requestAnimationFrame(frame) : 0;
  }
  let touched = false;
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; }, get playing() { return playing; }, get detail() { return detailNow(); },
    get open() { return ST.open; }, get cut() { return ST.cut; }, get o2() { return ST.o2; },
    live, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) kick(); else { cancelAnimationFrame(raf); raf = 0; } },
    play() { playing = true; kick(); }, pause() { playing = false; }, togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { ST.t = ((v % PERIOD) + PERIOD) % PERIOD; draw(); },
    goStep(n) { api.seek(STEPS[clamp(n, 1, STEPS.length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(ST.t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(ST.t); api.goStep(ST.t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    setOpen(v, instant) { touched = true; ST.open = clamp(v); if (instant || still.matches) shown.open = ST.open; draw(); },
    setCut(v, instant) { ST.cut = clamp(v); if (instant || still.matches) shown.cut = ST.cut; sliderDetail = ST.cut > 0 ? "A" : null; if (ST.cut > 0 && ST.open < 1) api.setOpen(1); draw(); },
    setO2(v) { ST.o2 = clamp(Math.round(v), O2_MIN, O2_MAX); draw(); },
    select(id) { selected = id && EQUIP[id] ? id : null; root.toggleAttribute("data-sel", !!selected); units.forEach(([u, eq]) => u.classList.toggle("fu-dim", !!selected && eq !== selected)); draw(); },
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
  const playBtn = $("[data-fu-play]"), stepsBox = $("[data-fu-steps]");
  stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", fx.STEPS.length);
  const stepBtns = fx.STEPS.map((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n; b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
    b.addEventListener("click", () => fx.goStep(s.n)); stepsBox.appendChild(b); return b; });
  const info = $("[data-info]"), meter = $("[data-fu-meter]"), readout = $("[data-fu-readout]");
  const opS = $("[data-fu-open]"), opO = $("[data-fu-open-out]"), cuS = $("[data-fu-cut]"), cuO = $("[data-fu-cut-out]"), oxS = $("[data-fu-o2]"), oxO = $("[data-fu-o2-out]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = []; const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  function renderInfo(s) {
    const id = fx.selected;
    document.querySelectorAll("[data-fu-chip]").forEach((c) => c.toggleAttribute("data-on", c.dataset.fuChip === id));
    if (!id) { if (info.dataset.owner === "fu") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs(s.m), sig = id + specs.join("|");
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig; info.dataset.owner = "fu";
    $("[data-info-kicker]").textContent = e.kicker; $("[data-info-title]").textContent = e.title; $("[data-info-text]").textContent = e.text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join(""); $("[data-info-actions]").innerHTML = ""; info.hidden = false;
  }
  off.push(fx.on((s) => {
    const st = s.step;
    if (st.n !== lastStep) { $("[data-fu-step-n]").textContent = st.n; $("[data-fu-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const kk = Number(b.dataset.step); b.toggleAttribute("data-done", kk < st.n); b.toggleAttribute("data-current", kk === st.n); }); lastStep = st.n; }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", (s.pur / 100).toFixed(3));
    const text = `${s.mat[0].toUpperCase() + s.mat.slice(1)} · ${fdec(s.pur, s.pur > 99 ? 1 : 0)} % Cu · ${fdec(s.m.feed)} t/d`;
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(fx.playing)); playBtn.setAttribute("aria-label", fx.playing ? "Pausar" : "Reproducir");
    renderInfo(s);
  }));
  const sync = () => { opS.value = Math.round(fx.open * 100); opO.textContent = `${opS.value} %`; cuS.value = Math.round(fx.cut * 100); cuO.textContent = `${cuS.value} %`; oxS.value = fx.o2; oxO.textContent = `${fx.o2} % O₂`; };
  on(opS, "input", () => { fx.setOpen(opS.value / 100); opO.textContent = `${opS.value} %`; });
  on(cuS, "input", () => { fx.setCut(cuS.value / 100); cuO.textContent = `${cuS.value} %`; opS.value = Math.round(fx.open * 100); opO.textContent = `${opS.value} %`; onFocus?.("A", cuS.value > 0); });
  on(oxS, "input", () => { fx.setO2(Number(oxS.value)); oxO.textContent = `${fx.o2} % O₂`; });
  on(playBtn, "click", () => fx.togglePlay());
  on($("[data-fu-prev]"), "click", () => fx.prevStep()); on($("[data-fu-next]"), "click", () => fx.nextStep());
  document.querySelectorAll("[data-fu-chip]").forEach((c) => on(c, "click", () => fx.select(fx.selected === c.dataset.fuChip ? null : c.dataset.fuChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "fu") fx.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "fundicion" || e.target.closest?.("input, [data-intro]")) return;
    if (e.key === " " && !e.target.closest("button")) fx.togglePlay();
    else if (e.key === ",") fx.prevStep(); else if (e.key === ".") fx.nextStep();
    else if (/^[1-5]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; fx.select(fx.selected === id ? null : id); }
    else if (e.key === "ArrowRight") { fx.setOpen(fx.open + 0.1); sync(); }
    else if (e.key === "ArrowLeft") { fx.setOpen(fx.open - 0.1); sync(); }
    else if (e.key === "ArrowUp") { fx.setCut(fx.cut + 0.1); sync(); onFocus?.("A", fx.cut > 0); }
    else if (e.key === "ArrowDown") { fx.setCut(fx.cut - 0.1); sync(); onFocus?.("A", fx.cut > 0); }
    else if (e.key === "Escape") { if (fx.selected) fx.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  sync(); fx.seek(fx.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "fu") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const ZOOM = { ct: [4160, 900, 550, 290], cps: [4160, 900, 550, 290], grua: [4180, 990, 250, 200], refino: [4230, 900, 480, 260], rueda: [4230, 900, 480, 260], A: [4160, 900, 550, 290], B: [4230, 900, 480, 260] };
export async function mount({ layer, focus }) {
  const fx = await createFundicion();
  layer.appendChild(fx.el);
  requestAnimationFrame(() => fx.el.setAttribute("data-in", ""));
  let focused = null;
  const want = (z, cap) => { const kz = z ? JSON.stringify(z) : ""; if (kz !== focused) { focused = kz; focus?.(z, cap); } };
  const unbind = bindPanel(fx, { onEscape: () => { location.hash = ""; }, onFocus: (which, on) => want(on ? ZOOM[which] : null, 3.2) });
  const unzoom = fx.on(() => { if (fx.selected) want(ZOOM[fx.selected], 3); else if (fx.detail) want(ZOOM[fx.detail], 3.2); else want(null); });
  fx.setActive(true);
  window.pmFu = fx;
  return { focus: [VIEW[0] + 10, VIEW[1] + 10, VIEW[2] - 20, VIEW[3] - 20], view: "fundicion",
    destroy: () => { unzoom(); unbind(); fx.destroy(); if (window.pmFu === fx) delete window.pmFu; } };
}
