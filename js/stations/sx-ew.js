// Estación 4 · Extracción por solvente (SX) y electroobtención (EW) — lámina viva sobre los dibujos de Emilio
// (assets/sxew/: tuberías, nave EW (base y techo), puente grúa y su carga, nave SX, piscina y grúa horquilla).
//
// Proceso: el PLS (solución rica, ~4 g/L Cu) llega de las pilas por la canaleta a la piscina de PLS y se bombea a la
// nave SX. En los mezcladores-decantadores (2 de extracción y 1 de re-extracción) el PLS se mezcla con el orgánico
// (extractante en un diluyente parafínico): el cobre pasa al orgánico (Cu²⁺ + 2RH → CuR₂ + 2H⁺) y en el decantador las
// fases se separan por densidad (el orgánico flota). El acuoso agotado es el refino, que vuelve ácido a regar las pilas.
// En la re-extracción el electrolito pobre (muy ácido) le quita el cobre al orgánico y sale como electrolito rico
// (~48 g/L) hacia la nave de electroobtención. Ahí circula por celdas con ánodos de plomo y cátodos permanentes de
// acero inoxidable: la corriente continua deposita el cobre en el cátodo (Cu²⁺ + 2e⁻ → Cu) y en el ánodo se libera
// oxígeno y se regenera el ácido; el electrolito pobre vuelve a SX. Cada ~7 días el puente grúa cosecha los cátodos,
// la máquina despegadora separa las láminas de cobre (99,99 %), se arman paquetes y la grúa horquilla los despacha.
//
// Lógica de la skill anatomy: un modelo (densidad de corriente → voltaje, eficiencia, energía y depósito) manda y el
// dibujo lo sigue; "sigue un ion de cobre" en 6 pasos (state(t) puro: pausar o saltar no acumula errores); selección
// de equipos con foco, ficha y detalle; cortes con deslizador en la nave SX y en las celdas.
//
// Geometría: la lámina vive en px de la infografía. Todos los dibujos están a escala 2 (registro por correlación,
// error < 1 px) y comparten una isometría de mundo W(e, n, z): e → (0,866; 0,5), n → (0,866; −0,5), z hacia arriba,
// en px, con origen en la esquina izquierda del piso de la nave EW.
const NS = "http://www.w3.org/2000/svg";
const U = (f) => new URL(`../../assets/sxew/${f}`, import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const f2 = (n) => (Math.round(n * 100) / 100).toString();
const fdec = (n, d = 0) => n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const D = (pts, close = true, f = f1) => "M" + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L") + (close ? "Z" : "");

// ---------------------------------------------------------------- mundo y registro
export const VIEW = [2950, 288, 760, 322];
const O = [3067.5, 451.1];
const W = (e, n, z = 0) => [O[0] + 0.866 * (e + n), O[1] + 0.5 * (e - n) - z];
const WD = (pts) => pts.map((p) => W(...p));
const S = 2;                                                   // escala de todos los dibujos
const REG = { tub: [2961.5, 465.25], base: [3065.5, 371], techo: [3093.75, 324.5], puente: [3117.25, 386.25], sx: [3133.5, 426.25], pis: [3192.25, 480.75], fk: [3598.53, 500.5], fkc: [3587.25, 500.5] };
const toP = (R, [x, y]) => [R[0] + S * x, R[1] + S * y];
const toL = (R, [x, y]) => [(x - R[0]) / S, (y - R[1]) / S];

// nave EW: piso e 0…49,9 · n 0…92,7; filas de celdas (la 1 abierta, con los electrodos a la vista)
const EW = { E: 49.9, N: 92.7, H: 31.7 };
const ROWS = [{ e0: 4.4, e1: 11.5 }, { e0: 17.1, e1: 23.2 }, { e0: 29.9, e1: 36.1 }, { e0: 41.7, e1: 47.7 }].map((r) => ({ ...r, n0: 2.5, n1: 90.8, h: 3 }));
const HARVEST = { n0: 30.5, n1: 57, nc: 44 };                 // celda que se cosecha (grupo de electrodos del medio, fila 1)
// nave SX (local): e' 0…53,2 · n' 0…91,3 · muros 19,3
const SXO = [80.52, -2.58];
const SXB = { E: 53.2, N: 91.3, H: 19.3 };
const SXW = (e, n, z = 0) => W(SXO[0] + e, SXO[1] + n, z);
const UNITS = [{ id: "E2", a: 6 }, { id: "E1", a: 35 }, { id: "S1", a: 64 }].map((u) => ({ ...u, b: u.a + 22 }));
const SETTLER = { e0: 4, e1: 37, h: 5.2, aq: 2.7, org: 4.3 };
const MIXER = { e0: 39.5, e1: 49.5, h: 7.5 };
// piscina de PLS (borde interior): e 167…223 · n −12…90,6
const POND = { e0: 167, e1: 223, n0: -12, n1: 90.6 };
// máquina despegadora (agregada) y vía del puente grúa prolongada fuera de la nave
const MACHINE = { e0: 0.5, e1: 15, n0: -15.5, n1: -3, h: 9 };
const RAIL = { z: 20.6, n0: -17.5 };

// tuberías agregadas (mundo)
const PIPE_W = {
  pls: [[36.5, -19.4, 0.6], [176, -19.4, 0.6], [176, -6, 0.6]],
  feed: [[171, 40, 0.6], [162.5, 40, 0.6], [162.5, 40, 3.6], [133.7, 40, 3.6]].map(([e, n, z]) => [e, n + SXO[1] * 0, z]),
  rich: [[80.52, 66, 7], [48.6, 66, 7], [48.6, 66, 3.2]],
  lean: [[48.6, 74, 3.2], [48.6, 74, 9.5], [80.52, 74, 9.5]],
  ref: [[95, -2.58, 3.6], [95, -9, 3.6], [18.8, -9, 3.6], [18.8, -9, 0.7], [18.8, -15.6, 0.7]],
};
function polyline(pts) {
  const Sx = [0]; for (let i = 1; i < pts.length; i++) Sx.push(Sx[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = Sx[Sx.length - 1];
  const at = (s) => { s = clamp(s, 0, len); let i = 1; while (i < Sx.length - 1 && Sx[i] < s) i++; const u = (s - Sx[i - 1]) / (Sx[i] - Sx[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]; };
  return { len, at, d: D(pts, false), pts };
}
const PL = Object.fromEntries(Object.entries(PIPE_W).map(([k, v]) => [k, polyline(WD(v))]));
// canaletas (eje, en px): A = PLS desde las pilas (adelante) · B = refino hacia las pilas (atrás)
PL.canA = polyline([toP(REG.tub, [8.4, 38.1]), toP(REG.tub, [60.4, 6.95])]);
PL.canB = polyline([toP(REG.tub, [1.7, 33.0]), toP(REG.tub, [53.7, 1.85])]);

// ---------------------------------------------------------------- modelo
const J_MIN = 200, J_MAX = 400;
const FARADAY = 1.186;                                          // g de Cu por A·h (63,55 / (2 · 26,8))
export const model = (J) => {
  const eff = clamp(0.95 - 0.0003 * (J - 200) - Math.max(0, J - 330) * 0.0004, 0.8, 0.96);
  const V = 1.65 + 0.00115 * J;
  const kgm2d = (J * eff * FARADAY * 24) / 1000;               // kg/m²·día por cara
  return { J, eff, V, kwh: V / (FARADAY * eff), mmDay: kgm2d / 8.96, mm7: (kgm2d / 8.96) * 7, kgCat: kgm2d * 2 * 7, pls: 4, raf: 0.3, rich: 48, lean: 35 };
};

// ---------------------------------------------------------------- recorrido del ion de cobre (state(t) puro)
const TOUR = (() => {
  const T = []; const seg = (kind, dur, data = {}) => T.push({ kind, dur, ...data });
  seg("pipe", 5, { p: "canA" }); seg("pipe", 3.5, { p: "pls" }); seg("pond", 1.6);                          // 1
  seg("pipe", 2.6, { p: "feed" }); seg("mix", 3.6, { u: 1 });                                            // 2
  seg("org", 4.2); seg("strip", 2.6);                                                                     // 3
  seg("pipe", 3, { p: "rich" }); seg("manifold", 2);                                                     // 4
  seg("deposit", 5);                                                                                      // 5
  seg("harvest", 16);                                                                                     // 6
  let t = 0; for (const s of T) { s.t0 = t; t += s.dur; s.t1 = t; }
  return { T, period: Math.round(t * 10) / 10 };
})();
export const PERIOD = TOUR.period;
const tAt = (i) => TOUR.T[i].t0;
const T_HARV = tAt(10);
export const STEPS = [
  { n: 1, id: "piscina", label: "El PLS llega desde las pilas a la piscina", t0: 0 },
  { n: 2, id: "sx", label: "En el mezclador, el orgánico captura el cobre del PLS", t0: tAt(3) },
  { n: 3, id: "sx", label: "La re-extracción pasa el cobre al electrolito; el refino vuelve a las pilas", t0: tAt(5) },
  { n: 4, id: "celdas", label: "El electrolito rico entra a las celdas de electroobtención", t0: tAt(7) },
  { n: 5, id: "celdas", label: "La corriente deposita el cobre en el cátodo", t0: tAt(9) },
  { n: 6, id: "puente", label: "El puente grúa cosecha los cátodos y la grúa horquilla los despacha", t0: tAt(10) },
].map((s, i, a) => ({ ...s, t1: i + 1 < a.length ? a[i + 1].t0 : PERIOD }));
const stepAt = (t) => STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1];

// puente grúa: desplazamiento del puente (px a lo largo de n), del carro (a lo largo de e) y del gancho (px hacia abajo)
const CR = { dnCell: HARVEST.nc - 71.2, dnMach: -9 - 71.2, de: -6, up: -4, down: 8 };
function craneAt(t) {
  const u = t - T_HARV;
  const st = { dn: 0, de: 0, hz: CR.up, loaded: false, clip: null, drip: 0, phase: "idle" };
  if (u < 0) return st;
  const k = (a, b) => smooth((u - a) / (b - a));
  if (u < 2.6) { st.dn = lerp(0, CR.dnCell, k(0, 2.6)); st.de = lerp(0, CR.de, k(0, 2.6)); st.phase = "va"; return st; }
  st.de = CR.de;
  if (u < 4.3) { st.dn = CR.dnCell; st.hz = lerp(CR.up, CR.down, k(2.6, 3.8)); st.loaded = u > 3.8; st.clip = "cell"; st.phase = "baja"; return st; }
  if (u < 6.3) { st.dn = CR.dnCell; st.hz = lerp(CR.down, CR.up, k(4.3, 6.3)); st.loaded = true; st.clip = "cell"; st.drip = 1; st.phase = "sube"; return st; }
  if (u < 10.3) { st.dn = lerp(CR.dnCell, CR.dnMach, k(6.3, 10.3)); st.loaded = true; st.drip = clamp(1 - (u - 6.3) / 1.6); st.phase = "lleva"; return st; }
  if (u < 12) { st.dn = CR.dnMach; st.hz = lerp(CR.up, CR.down, k(10.3, 11.5)); st.loaded = true; st.clip = "machine"; st.phase = "despega"; return st; }
  if (u < 13) { st.dn = CR.dnMach; st.hz = lerp(CR.down, CR.up, k(12, 13)); st.phase = "vuelve"; return st; }
  st.dn = lerp(CR.dnMach, 0, k(13, 16)); st.de = lerp(CR.de, 0, k(13, 16)); st.phase = "vuelve";
  return st;
}
// los electrodos de la celda cosechada salen con la carga y vuelven (cátodos de acero limpios) al empezar el ciclo
const harvestedTicks = (t) => (t >= T_HARV + 4.3 ? 0 : t < 1.2 ? smooth(t / 1.2) : 1);
// grúa horquilla: subciclo de medio período (sale cargada, vuelve vacía, toma el paquete nuevo y lo levanta)
const FK = PERIOD / 2;
function forkAt(t) {
  const u = ((t % FK) + FK) % FK;
  const k = (a, b) => smooth((u - a) / (b - a));
  const st = { dx: 0, lift: 2.4, loaded: true, op: 1, pick: 0, moving: 0 };
  if (u < 2.5) return st;
  if (u < 7) { st.dx = 78 * k(2.5, 7); st.op = 1 - k(5.6, 7); st.moving = 1; return st; }
  st.loaded = false; st.lift = 0; st.pick = k(7.4, 8.6);
  if (u < 9) { st.op = 0; st.dx = 78; return st; }
  if (u < 13.5) { st.dx = 78 * (1 - k(9, 13.5)); st.op = k(9, 10.2); st.moving = 1; return st; }
  st.dx = 0; st.loaded = true; st.pick = 1; st.lift = 2.4 * k(13.5, 15); return st;
}
// avance del depósito de cobre en el ciclo (7 días comprimidos en el recorrido)
const growAt = (t) => (t >= T_HARV + 4.3 ? 0 : clamp(t / (T_HARV + 4.3)));

// ---------------------------------------------------------------- fichas
const EQUIP = {
  piscina: { kicker: "Solución rica", title: "Piscina de PLS", text: "El PLS (solución rica en cobre) llega de las pilas por la canaleta y se acumula en la piscina, que regula el caudal hacia la planta. Desde aquí se bombea a la extracción por solvente.",
    specs: (m) => [`PLS ~${m.pls} g/L Cu · pH 1,5–2`, "Llega por la canaleta desde las pilas", "Bomba → mezcladores de extracción"] },
  sx: { kicker: "Extracción por solvente", title: "Mezcladores-decantadores (2E + 1S)", text: "En cada mezclador el PLS y el orgánico (extractante en un diluyente parafínico) se agitan: el cobre pasa al orgánico y el ácido queda en el acuoso. En el decantador las fases se separan por densidad (el orgánico flota). El acuoso agotado es el refino y vuelve a regar las pilas; en la re-extracción el electrolito pobre recupera el cobre del orgánico.",
    specs: (m) => [`Extracción ~92 % · refino ~${fdec(m.raf, 1)} g/L Cu → pilas`, `Electrolito ${m.lean} → ${m.rich} g/L Cu`, "Cu²⁺ + 2RH ⇄ CuR₂ + 2H⁺"] },
  celdas: { kicker: "Electroobtención", title: "Celdas electrolíticas", text: "El electrolito rico circula por las celdas, conectadas en serie eléctricamente. Entre ánodos de plomo y cátodos permanentes de acero inoxidable pasa corriente continua: el cobre se deposita en el cátodo y en el ánodo se libera oxígeno y se regenera el ácido. El electrolito pobre vuelve a la re-extracción.",
    specs: (m) => [`${m.J} A/m² · ${fdec(m.V, 2)} V por celda`, `${fdec(m.kwh, 2)} kWh/kg · eficiencia ${Math.round(m.eff * 100)} %`, `Depósito ~${fdec(m.mm7, 1)} mm por cara en 7 días`] },
  puente: { kicker: "Cosecha", title: "Puente grúa", text: "Cada 6–7 días el puente grúa levanta con un bastidor un grupo de cátodos de una celda y los lleva a la máquina despegadora, que los lava y separa las láminas de cobre. Después devuelve los cátodos de acero limpios a la celda.",
    specs: (m) => ["Ciclo de cosecha: 7 días", `~${Math.round(m.kgCat)} kg de cobre por cátodo`, "Cobre 99,99 % (grado A)"] },
  horquilla: { kicker: "Despacho", title: "Paquetes de cátodos", text: "Las láminas de cobre se apilan, se pesan y se zunchan en paquetes. La grúa horquilla los lleva al patio y de ahí salen en camión o tren hacia el puerto.",
    specs: () => ["Paquete ~2,5 t de láminas", "Cobre 99,99 % Cu", "Destino: puerto"] },
};
const ORDER = ["piscina", "sx", "celdas", "puente", "horquilla"];

// ---------------------------------------------------------------- utilidades SVG
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
// reescribe una capa del dibujo sólo si su marcado cambió (muchas salen idénticas cuadro a cuadro: fondo, rieles…)
const setHTML = (n, s) => { if (n.__html !== s) { n.__html = s; n.innerHTML = s; } };
const circ = (p, r, cls, o) => `<circle class="${cls}" cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(r)}"${o != null ? ` style="opacity:${f2(o)}"` : ""}/>`;
const poly = (pts, cls, extra = "") => `<path class="${cls}" d="${D(pts, true, f2)}"${extra}/>`;
// caja isométrica (mundo): caras visibles (tapa, frente +e, costado −n)
function boxSvg(f, e0, e1, n0, n1, z0, z1, cls = "sx-box") {
  const top = [f(e0, n0, z1), f(e1, n0, z1), f(e1, n1, z1), f(e0, n1, z1)];
  const front = [f(e1, n0, z0), f(e1, n1, z0), f(e1, n1, z1), f(e1, n0, z1)];
  const side = [f(e0, n0, z0), f(e1, n0, z0), f(e1, n0, z1), f(e0, n0, z1)];
  return poly(side, `${cls} ${cls}--side`) + poly(front, `${cls} ${cls}--front`) + poly(top, `${cls} ${cls}--top`);
}

// ---------------------------------------------------------------- interior de la nave SX (corte)
function sxInteriorSvg(open, s, m) {
  const zc = lerp(SXB.H, 2.2, smooth(open));
  let g = "";
  // piso y caras interiores de los muros del fondo (e' = 0 y n' = N)
  g += poly([SXW(0, 0), SXW(SXB.E, 0), SXW(SXB.E, SXB.N), SXW(0, SXB.N)], "sx-floor");
  g += poly([SXW(0, 0, 0), SXW(0, SXB.N, 0), SXW(0, SXB.N, SXB.H), SXW(0, 0, SXB.H)], "sx-wall-in");
  g += poly([SXW(0, SXB.N, 0), SXW(SXB.E, SXB.N, 0), SXW(SXB.E, SXB.N, SXB.H), SXW(0, SXB.N, SXB.H)], "sx-wall-in sx-wall-in--end");
  // mezcladores-decantadores (de atrás hacia adelante: mayor n primero)
  for (const u of [...UNITS].reverse()) {
    const strip = u.id === "S1", a = u.a, b = u.b;
    // decantador: piso, paredes, capas (acuoso abajo, orgánico arriba) vistas por el costado de vidrio (−n)
    const se = SETTLER;
    g += poly([SXW(se.e0, a, se.h), SXW(se.e1, a, se.h), SXW(se.e1, b, se.h), SXW(se.e0, b, se.h)], "sx-set-rim");
    // superficie del orgánico con el flujo hacia atrás (rebalse)
    g += poly([SXW(se.e0 + 0.6, a + 0.6, se.org), SXW(se.e1 - 0.6, a + 0.6, se.org), SXW(se.e1 - 0.6, b - 0.6, se.org), SXW(se.e0 + 0.6, b - 0.6, se.org)], strip ? "sx-org sx-org--strip" : "sx-org");
    for (let j = 0; j < 7; j++) { const ph = (s.flow * 0.22 + j / 7) % 1, n = lerp(a + 2, b - 2, hash(j * 3.1 + a)), e = lerp(se.e1 - 3, se.e0 + 2, ph);
      g += `<path class="sx-org-flow" d="M${f2(SXW(e, n, se.org)[0])} ${f2(SXW(e, n, se.org)[1])}l${f2(-0.866 * 2.2)} ${f2(-0.5 * 2.2)}" style="opacity:${f2(Math.sin(ph * Math.PI))}"/>`; }
    // cerca de pickets a la entrada del decantador
    for (let j = 0; j <= 6; j++) { const n = lerp(a + 1, b - 1, j / 6), p = SXW(se.e1 - 3, n, se.org + 0.6), q = SXW(se.e1 - 3, n, se.h + 0.8); g += `<path class="sx-picket" d="M${f2(p[0])} ${f2(p[1])}L${f2(q[0])} ${f2(q[1])}"/>`; }
    // canaleta de rebalse del orgánico (fondo)
    g += boxSvg(SXW, se.e0 - 2.2, se.e0, a, b, 0, se.h + 0.6, "sx-launder");
    // costado de vidrio: capas
    const sideBand = (z0, z1, cls) => poly([SXW(se.e0, a, z0), SXW(se.e1, a, z0), SXW(se.e1, a, z1), SXW(se.e0, a, z1)], cls);
    g += sideBand(0, se.aq, strip ? "sx-aq sx-aq--elec" : u.id === "E2" ? "sx-aq sx-aq--raf" : "sx-aq");
    g += sideBand(se.aq, se.org, strip ? "sx-orgside sx-orgside--strip" : "sx-orgside");
    // gotas que decantan en el costado (la dispersión se separa hacia el fondo)
    for (let j = 0; j < 9; j++) { const ph = (s.flow * 0.3 + hash(j * 2.3 + a)) % 1, e = lerp(se.e1 - 2, se.e0 + 4, ph), zz = lerp(se.aq - 0.2, se.aq + 0.8, hash(j * 7.1)) + (hash(j) < 0.5 ? -1 : 1) * (1 - ph) * 0.9;
      g += circ(SXW(e, a, zz), 0.32, hash(j * 4.7 + a) < 0.5 ? "sx-drop-o" : "sx-drop-a", 1 - ph * 0.8); }
    g += poly([SXW(se.e0, a, 0), SXW(se.e1, a, 0), SXW(se.e1, a, se.h), SXW(se.e0, a, se.h)], "sx-glass");
    g += poly([SXW(se.e1, a, 0), SXW(se.e1, b, 0), SXW(se.e1, b, se.h), SXW(se.e1, a, se.h)], "sx-box sx-box--front");
    // mezcladores: dos estanques en serie con motor y agitador
    for (let k = 0; k < 2; k++) { const n0 = a + 1 + k * 10.5, n1 = n0 + 9.5, mx = MIXER;
      g += boxSvg(SXW, mx.e0, mx.e1, n0, n1, 0, mx.h, "sx-mixer");
      const c = SXW((mx.e0 + mx.e1) / 2, (n0 + n1) / 2, mx.h);
      // remolino en la superficie (vista desde arriba, el agitador gira)
      for (let i = 0; i < 3; i++) { const th = s.rot * (k ? 1.1 : 1) + (i / 3) * Math.PI * 2, r1 = 1.2, r2 = 3.6;
        const p = [c[0] + 0.866 * r1 * (Math.cos(th) - Math.sin(th)) * 0.5 * 2, c[1] + 0.5 * r1 * (Math.cos(th) + Math.sin(th)) * 0.5 * 2], q = [c[0] + 0.866 * r2 * (Math.cos(th + 0.6) - Math.sin(th + 0.6)) * 0.5 * 2, c[1] + 0.5 * r2 * (Math.cos(th + 0.6) + Math.sin(th + 0.6)) * 0.5 * 2];
        g += `<path class="${strip ? "sx-swirl sx-swirl--strip" : "sx-swirl"}" d="M${f2(p[0])} ${f2(p[1])}L${f2(q[0])} ${f2(q[1])}"/>`; }
      g += boxSvg(SXW, (mx.e0 + mx.e1) / 2 - 1.4, (mx.e0 + mx.e1) / 2 + 1.4, (n0 + n1) / 2 - 1.4, (n0 + n1) / 2 + 1.4, mx.h, mx.h + 3, "sx-motor");
    }
  }
  // muros cortados (adelante: frente e' = E y gablete n' = 0) hasta la altura de corte
  g += poly([SXW(0, 0, 0), SXW(SXB.E, 0, 0), SXW(SXB.E, 0, zc), SXW(0, 0, zc)], "sx-wall sx-wall--gable");
  g += poly([SXW(SXB.E, 0, 0), SXW(SXB.E, SXB.N, 0), SXW(SXB.E, SXB.N, zc), SXW(SXB.E, 0, zc)], "sx-wall sx-wall--front");
  g += `<path class="sx-cut" d="${D([SXW(0, 0, zc), SXW(SXB.E, 0, zc), SXW(SXB.E, SXB.N, zc)], false, f2)}"/>`;
  void m;
  return g;
}

// ---------------------------------------------------------------- nave EW: celdas abiertas (electrolito y electrodos)
function cellsSvg(open, s, m, grow) {
  let g = "";
  ROWS.forEach((r, i) => {
    if (i === 0) return;                                        // la fila 1 ya está abierta en el dibujo
    const o = smooth(open * 1.4 - (i - 1) * 0.15);
    if (o <= 0.01) return;
    const z = r.h, top = [W(r.e0, r.n0, z), W(r.e1, r.n0, z), W(r.e1, r.n1, z), W(r.e0, r.n1, z)];
    g += `<g style="opacity:${f2(o)}">` + poly(top, "sx-elyte");
    for (let n = r.n0 + 1.2, k = 0; n < r.n1 - 0.6; n += 1.75, k++) {
      const an = k % 2 === 0, a = W(r.e0 + 0.7, n, z + 0.2), b = W(r.e1 - 0.7, n, z + 0.2);
      g += `<path class="${an ? "sx-anode" : "sx-cathode"}" d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}"${an ? "" : ` style="stroke:${copperMix(grow)}"`}/>`;
      if (an && hash(k * 3.3 + i) < 0.55 + 0.25 * (m.J - 300) / 100) { const ph = (s.flow * 0.9 + hash(k * 1.7 + i)) % 1, e = lerp(r.e0 + 1, r.e1 - 1, hash(k * 5.1 + i)); g += circ(W(e, n + 0.5, z + 0.3 + ph * 1.8), 0.28, "sx-o2", 1 - ph); }
    }
    g += poly(top, "sx-elyte-rim") + "</g>";
  });
  return g;
}
const copperMix = (g) => { const a = [150, 160, 168], b = [201, 115, 62], k = smooth(g); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(",")})`; };

// ---------------------------------------------------------------- bastidor de cosecha: viga con ganchos y cátodos colgando
// (los cátodos van en planos e-z, uno tras otro a lo largo de n; se pintan del más lejano al más cercano)
const PLATES = { n: 9, gap: 1.75, w: 5.6, h: 7.4, top: 1.6 };
function cargaSvg(hook, loaded) {
  const P = (de, dn, dz) => [hook[0] + 0.866 * (de + dn), hook[1] + 0.5 * (de - dn) - dz];
  const span = (PLATES.n - 1) * PLATES.gap, n0 = -span / 2;
  let g = "";
  const plate = (n) => {
    const a = P(-PLATES.w / 2, n, -PLATES.top), b = P(PLATES.w / 2, n, -PLATES.top), c = P(PLATES.w / 2, n, -PLATES.top - PLATES.h), d = P(-PLATES.w / 2, n, -PLATES.top - PLATES.h);
    const ear = [P(-PLATES.w / 2 - 0.9, n, -PLATES.top + 0.4), P(PLATES.w / 2 + 0.9, n, -PLATES.top + 0.4)];
    return `<path class="sx-hbar" d="M${f2(ear[0][0])} ${f2(ear[0][1])}L${f2(ear[1][0])} ${f2(ear[1][1])}"/>` + poly([a, b, c, d], "sx-plate-cu");
  };
  // viga del bastidor (por arriba de las barras de suspensión)
  const beam = boxSvg((e, n, z) => P(e, n, z), -0.8, 0.8, n0 - 1.6, -n0 + 1.6, 0.4, 1.7, "sx-frame");
  if (loaded) for (let i = PLATES.n - 1; i >= 0; i--) g += plate(n0 + i * PLATES.gap);
  g += beam;
  // ganchos del bastidor a las orejas de los cátodos
  for (const n of [n0 + 0.6, -n0 - 0.6]) { const a = P(0, n, 0.5), b = P(0, n, -PLATES.top + 0.5); g += `<path class="sx-hook" d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}"/>`; }
  return g;
}

// ---------------------------------------------------------------- detalle A: mezclador-decantador en corte (2D)
function sxSectionSvg(box, s, m, strip) {
  const [bx, by, bw, bh] = box, top = by + 44, bot = by + bh - 30, mx0 = bx + 16, mx1 = mx0 + 40, st0 = mx1 + 4, st1 = bx + bw - 22;
  const aqY = lerp(top, bot, 0.58), orgY = top + 10;                 // interfaz acuoso / orgánico y superficie
  const AQ = strip ? "sx-a-elec" : "sx-a-pls", ORG = strip ? "sx-a-org sx-a-org--strip" : "sx-a-org";
  let g = "";
  // decantador: orgánico arriba, acuoso abajo
  g += `<rect class="${ORG}" x="${f1(st0)}" y="${f1(orgY)}" width="${f1(st1 - st0)}" height="${f1(aqY - orgY)}"/><rect class="${AQ}" x="${f1(st0)}" y="${f1(aqY)}" width="${f1(st1 - st0)}" height="${f1(bot - aqY)}"/>`;
  // dispersión que se separa: banda que se adelgaza hacia el fondo
  g += `<path class="sx-a-disp" d="M${f1(st0)} ${f1(orgY + 3)}L${f1(st0 + (st1 - st0) * 0.55)} ${f1(aqY - 1)}L${f1(st0 + (st1 - st0) * 0.55)} ${f1(aqY + 1)}L${f1(st0)} ${f1(bot - 6)}Z"/>`;
  for (let j = 0; j < 38; j++) { const ph = (s.flow * 0.16 + hash(j * 3.7)) % 1, x = lerp(st0 + 3, st0 + (st1 - st0) * 0.62, ph), org = hash(j * 1.3) < 0.5;
    const spread = (1 - ph) * (bot - orgY - 10) * 0.5, y = (orgY + bot) / 2 + (hash(j * 5.9) - 0.5) * 2 * spread; const tgt = org ? lerp(orgY + 2, aqY - 2, hash(j * 2.2)) : lerp(aqY + 2, bot - 2, hash(j * 2.2));
    g += circ([x, lerp(y, tgt, smooth(ph * 1.3))], 1.25 - ph * 0.5, org ? "sx-a-dropo" : "sx-a-dropa", 1 - smooth((ph - 0.75) / 0.25)); }
  // cobre: en el acuoso entra al mezclador; en el orgánico sale cargado (extracción) — al revés en la re-extracción
  for (let j = 0; j < 12; j++) { const ph = (s.flow * 0.12 + j / 12) % 1, x = lerp(st0 + 8, st1 - 8, ph), y = strip ? lerp(aqY + 3, bot - 3, hash(j * 4.1)) : lerp(orgY + 2, aqY - 3, hash(j * 4.1)); g += circ([x, y], 0.95, "sx-a-cu"); }
  // cerca de pickets
  for (let k = 0; k < 6; k++) g += `<rect class="sx-a-picket" x="${f1(st0 + 7)}" y="${f1(lerp(top - 2, bot - 4, k / 6) + 1)}" width="1.6" height="${f1((bot - top) / 6 - 3)}"/>`;
  // vertedero del orgánico (al fondo, arriba) y del acuoso (abajo)
  g += `<path class="sx-a-weir" d="M${f1(st1 - 8)} ${f1(orgY - 2)}V${f1(aqY - 6)}"/><path class="sx-a-under" d="M${f1(st1 - 14)} ${f1(bot)}V${f1(aqY + 6)}"/>`;
  g += `<path class="sx-a-tank" d="M${f1(st0)} ${f1(top - 4)}V${f1(bot)}H${f1(st1)}V${f1(top - 4)}"/>`;
  // salidas
  g += `<path class="${ORG.replace("sx-a-org", "sx-a-out sx-a-out--org")}" d="M${f1(st1)} ${f1(orgY + 1)}H${f1(bx + bw - 3)}"/><path class="sx-a-out ${strip ? "sx-a-out--elec" : "sx-a-out--raf"}" d="M${f1(st1)} ${f1(bot - 3)}H${f1(bx + bw - 3)}"/>`;
  // mezclador: estanque con agitador de turbina y motor
  g += `<rect class="sx-a-mixfill" x="${f1(mx0)}" y="${f1(top)}" width="${f1(mx1 - mx0)}" height="${f1(bot - top)}"/>`;
  for (let j = 0; j < 34; j++) { const ph = (s.flow * 0.5 + hash(j * 2.9)) % 1, th = ph * Math.PI * 2 + j, r = 6 + hash(j * 3.3) * 14, cx = (mx0 + mx1) / 2, cy = (top + bot) / 2 + 4;
    g += circ([cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.7], 1.1, hash(j) < 0.5 ? "sx-a-dropo" : "sx-a-dropa"); }
  g += `<path class="sx-a-tank" d="M${f1(mx0)} ${f1(top - 4)}V${f1(bot)}H${f1(mx1)}V${f1(top + 4)}"/>`;
  const cx = (mx0 + mx1) / 2, iz = bot - 12;
  g += `<rect class="sx-a-motor" x="${f1(cx - 6)}" y="${f1(top - 13)}" width="12" height="7" rx="1.5"/><path class="sx-a-shaft" d="M${f1(cx)} ${f1(top - 6)}V${f1(iz)}"/>`;
  for (let i = 0; i < 4; i++) { const th = s.rot + (i / 4) * Math.PI * 2, x = cx + Math.cos(th) * 9, w = Math.abs(Math.sin(th)) * 1.6 + 0.5; if (Math.sin(th) < -0.2) continue; g += `<rect class="sx-a-blade" x="${f1(x - w)}" y="${f1(iz - 3)}" width="${f1(w * 2)}" height="6"/>`; }
  g += `<rect class="sx-a-hub" x="${f1(cx - 2.5)}" y="${f1(iz - 3)}" width="5" height="6"/>`;
  // entradas (abajo, al mezclador): acuoso y orgánico
  g += `<path class="sx-a-in ${strip ? "sx-a-in--elec" : "sx-a-in--pls"}" d="M${f1(bx + 4)} ${f1(bot - 4)}H${f1(mx0)}"/><path class="sx-a-in sx-a-in--org" d="M${f1(bx + 4)} ${f1(bot - 10)}H${f1(mx0)}"/>`;
  g += `<text class="sx-a-eq" x="${f1(lerp(st0, st1, 0.62))}" y="${f1((orgY + aqY) / 2 + 2)}" text-anchor="middle">${strip ? "CuR₂ + 2H⁺ → Cu²⁺ + 2RH" : "Cu²⁺ + 2RH → CuR₂ + 2H⁺"}</text>`;
  return { svg: g, pts: { motor: [cx, top - 13], in: [bx + 5.5, bot - 4], mix: [mx0 + 6, bot - 6], picket: [st0 + 7.8, top + 2], aqi: [lerp(st0, st1, 0.3), aqY], outO: [bx + bw - 8, orgY + 1], outA: [bx + bw - 8, bot - 3] } };
}

// ---------------------------------------------------------------- detalle B: celda de electroobtención en corte (2D)
function ewSectionSvg(box, s, m, grow) {
  const [bx, by, bw, bh] = box, x0 = bx + 34, x1 = bx + bw - 34, top = by + 46, bot = by + bh - 30, lvl = top + 6, bus = by + 36;
  let g = "";
  g += `<rect class="sx-b-elyte" x="${f1(x0)}" y="${f1(lvl)}" width="${f1(x1 - x0)}" height="${f1(bot - lvl)}"/>`;
  g += `<path class="sx-b-tank" d="M${f1(x0)} ${f1(top - 4)}V${f1(bot)}H${f1(x1)}V${f1(top - 4)}"/>`;
  // electrodos: A C A C A
  const n = 5, gap = (x1 - x0) / (n + 1), dep = 0.3 + 2.6 * smooth(grow), xs = [];
  g += `<rect class="sx-b-bus sx-b-bus--a" x="${f1(x0 - 6)}" y="${f1(bus - 3)}" width="${f1(x1 - x0 + 12)}" height="3"/><rect class="sx-b-bus sx-b-bus--c" x="${f1(x0 - 6)}" y="${f1(bus + 2)}" width="${f1(x1 - x0 + 12)}" height="3"/>`;
  for (let i = 0; i < n; i++) { const x = x0 + gap * (i + 1), an = i % 2 === 0; xs.push([x, an]);
    g += `<path class="sx-b-hanger" d="M${f1(x)} ${f1(an ? bus : bus + 5)}V${f1(top - 2)}"/>`;
    if (an) g += `<rect class="sx-b-anode" x="${f1(x - 1.6)}" y="${f1(top - 2)}" width="3.2" height="${f1(bot - top - 6)}"/>`;
    else { g += `<rect class="sx-b-cu" x="${f1(x - 1 - dep)}" y="${f1(lvl + 2)}" width="${f1(2 + dep * 2)}" height="${f1(bot - lvl - 9)}"/><rect class="sx-b-steel" x="${f1(x - 1)}" y="${f1(top - 2)}" width="2" height="${f1(bot - top - 4)}"/>`; } }
  // iones Cu²⁺ que migran al cátodo más cercano y oxígeno que sube desde los ánodos
  const speed = 0.25 + 0.25 * (m.J / 300);
  for (let j = 0; j < 30; j++) { const ph = (s.flow * speed * 0.6 + hash(j * 2.7)) % 1, side = j % 4, aIdx = side < 2 ? 0 : 2, cIdx = side % 2 === 0 ? 1 : (side < 2 ? 1 : 3);
    const ax = xs[aIdx * 1 === 0 ? 0 : aIdx][0], cx = xs[cIdx][0]; const startX = lerp(ax, cx, 0.15 + 0.3 * hash(j * 6.1)), y = lerp(lvl + 6, bot - 8, hash(j * 4.3));
    const tx = cx + (startX < cx ? -1 - dep : 1 + dep); g += circ([lerp(startX, tx, smooth(ph)), y + Math.sin(ph * 8 + j) * 0.8], 1.05, "sx-b-ion", 1 - smooth((ph - 0.85) / 0.15)); }
  const nb = Math.round(10 + 16 * (m.J / 300));
  for (let j = 0; j < nb; j++) { const ph = (s.flow * 0.7 + hash(j * 3.9)) % 1, a = xs[(j % 3) * 2][0], side = hash(j * 1.9) < 0.5 ? -1 : 1, y = lerp(bot - 8, lvl + 1, ph);
    g += circ([a + side * (2.6 + ph * 1.4 + Math.sin(ph * 10 + j) * 0.5), y], 0.7 + ph * 0.5, "sx-b-o2", 1 - smooth((ph - 0.8) / 0.2)); }
  // rectificador y electrones (la corriente sale por el ánodo y entra por el cátodo)
  g += `<rect class="sx-b-rect" x="${f1(bx + 8)}" y="${f1(bus - 8)}" width="14" height="11" rx="2"/><text class="sx-b-sign" x="${f1(bx + 10.5)}" y="${f1(bus - 0.5)}">+</text><text class="sx-b-sign" x="${f1(bx + 16)}" y="${f1(bus - 0.5)}">−</text>`;
  g += `<path class="sx-b-wire" d="M${f1(bx + 22)} ${f1(bus - 1.5)}H${f1(x0 - 6)}"/><path class="sx-b-wire" d="M${f1(bx + 22)} ${f1(bus + 3.5)}H${f1(x0 - 6)}"/>`;
  for (let j = 0; j < 5; j++) { const ph = (s.flow * speed + j / 5) % 1; g += circ([lerp(x1 + 6, x0 - 6, ph), bus + 3.5], 0.8, "sx-b-e"); }
  // entrada y salida del electrolito
  g += `<path class="sx-b-in" d="M${f1(bx + 4)} ${f1(bot - 6)}H${f1(x0)}"/><path class="sx-b-out" d="M${f1(x1)} ${f1(lvl + 2)}H${f1(x1 + 14)}"/>`;
  const a0 = xs[0][0], c0 = xs[1][0];
  const c1 = xs[3][0], cL = xs[1][0];
  return { svg: g, pts: { anode: [a0, bot - 8], cathode: [cL, top - 4], cu: [c1 + 1 + dep, bot - 8], ion: [lerp(xs[2][0], c1, 0.6), bot - 12], rect: [bx + 15, bus - 8], in: [bx + 5.5, bot - 6], out: [x1 + 10, lvl + 2] } };
}

// ---------------------------------------------------------------- lámina
export async function createSxEw() {
  const root = document.createElement("div");
  root.className = "sx-plate";
  root.style.cssText = `position:absolute;left:${VIEW[0]}px;top:${VIEW[1]}px;width:${VIEW[2]}px;height:${VIEW[3]}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "sx-svg", role: "group", tabindex: "0",
    "aria-label": "Extracción por solvente y electroobtención: el PLS de las pilas pasa por los mezcladores-decantadores, el cobre llega en el electrolito a las celdas y se deposita en los cátodos, que el puente grúa cosecha. Espacio pausa; coma y punto cambian de paso; 1 a 5 eligen un equipo." }, root);
  const defs = el("defs", {}, svg);
  const geo = await import("./sx-ew-geo.js").catch(() => ({ SIL: "" }));
  el("path", { d: geo.SIL, class: "sx-sil" }, svg);
  async function loadArt(file, pre, R, cls, parent = svg) {
    const text = (await (await fetch(U(file))).text()).replace(/\bcls-(\d+)/g, `${pre}cls-$1`).replace(/(id="|url\(#)(clippath[-\d]*)/g, `$1${pre}$2`).replace(/\sid="(?!sx)[^"]*"/g, (m0) => (m0.includes("clippath") ? m0 : ""));
    const doc = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
    doc.querySelectorAll("metadata, title, desc").forEach((n) => n.remove());
    const st = doc.querySelector("style"); if (st) { el("style", {}, defs).textContent = st.textContent; st.remove(); }
    const g = el("g", { class: cls, transform: `translate(${R[0]} ${R[1]}) scale(${S})` }, parent);
    [...doc.children].forEach((n) => { if (n.tagName === "defs") [...n.children].forEach((c) => defs.appendChild(document.importNode(c, true))); else g.appendChild(document.importNode(n, true)); });
    return g;
  }
  const kids = (n) => [...n.children].filter((c) => !["defs", "style", "title", "clipPath"].includes(c.tagName));
  const deep = (n, path) => path.reduce((a, i) => kids(a)[i], n);

  // ---- canaletas (PLS y refino) con la solución que corre
  const tub = await loadArt("tuberias.svg", "sxt-", REG.tub, "sx-tub");
  deep(tub, [0, 0]).setAttribute("data-eq", "piscina"); deep(tub, [0, 1]).setAttribute("data-eq", "sx");
  const flow = {};
  flow.canA = el("path", { d: PL.canA.d, class: "sx-flow sx-flow--pls sx-flow--can", "data-eq": "piscina" }, svg);
  flow.canB = el("path", { d: PL.canB.d, class: "sx-flow sx-flow--raf sx-flow--can", "data-eq": "sx" }, svg);
  // ---- despegadora y vía prolongada (detrás de la nave, a la izquierda)
  // ---- nave EW (base), capas vivas y techo
  const base = await loadArt("nave-ew-base.svg", "sxb-", REG.base, "sx-base");
  base.setAttribute("data-eq", "celdas");
  const baseK = deep(base, [0, 0, 1]);
  const harvestTicks = [...kids(deep(baseK, [11]))].filter((t) => { const x = parseFloat(t.querySelector("path")?.getAttribute("d")?.slice(1) || "0"); return x > 18.5 && x < 31; });
  const machG = el("g", { class: "sx-machine", "data-eq": "puente" }, svg);
  const cellLayer = el("g", { class: "sx-cells" }, svg);
  const railG = el("g", { class: "sx-rail", "data-eq": "puente" }, svg);
  // puente grúa: el puente se mueve a lo largo de n; el carro a lo largo de e; el gancho sube y baja
  const crane = await loadArt("puente-grua.svg", "sxp-", REG.puente, "sx-crane");
  crane.setAttribute("data-eq", "puente");
  const craneK = deep(crane, [0]);
  const trolley = el("g", { class: "sx-trolley" }), hooks = el("g", { class: "sx-hooks" });
  const tk = kids(craneK);
  tk.slice(8, 18).forEach((n) => trolley.appendChild(n));
  tk.slice(0, 3).forEach((n) => hooks.appendChild(n));
  craneK.appendChild(hooks); craneK.appendChild(trolley);
  const cableG = el("g", { class: "sx-cables", "data-eq": "puente" }, svg);
  const cargaW = el("g", { class: "sx-carga-w", "data-eq": "puente" }, svg);
  const cargaClip = el("clipPath", { id: "sx-carga-clip", clipPathUnits: "userSpaceOnUse" }, defs); const cargaClipP = el("path", {}, cargaClip);
  const carga = el("g", { class: "sx-carga" }, cargaW);       // bastidor de cosecha con los cátodos (dibujado aquí)
  const dripG = el("g", { class: "sx-drips" }, svg);
  const techo = await loadArt("nave-ew-techo.svg", "sxr-", REG.techo, "sx-techo");
  techo.setAttribute("data-eq", "celdas");
  // ---- tuberías de electrolito (entre las naves, detrás de la nave SX)
  const pipeG = el("g", { class: "sx-pipes" }, svg);
  const mkPipe = (k, eq, parent = pipeG) => { const g = el("g", { class: "sx-pipe", "data-eq": eq }, parent); el("path", { d: PL[k].d, class: "sx-pipe-o" }, g); el("path", { d: PL[k].d, class: "sx-pipe-w" }, g); flow[k] = el("path", { d: PL[k].d, class: `sx-flow sx-flow--${k}` }, g); return g; };
  mkPipe("lean", "celdas"); mkPipe("rich", "celdas");
  // ---- nave SX: muros del dibujo (recortados por el corte), interior y techo que se levanta
  const sxG = el("g", { class: "sx-sxw", "data-eq": "sx" }, svg);
  const interior = el("g", { class: "sx-interior" }, sxG);
  const nave = await loadArt("nave-sx.svg", "sxs-", REG.sx, "sx-nave", sxG);
  const naveK = kids(deep(nave, [0]));
  const naveTop = naveK[3], naveRoof = naveK[4];
  const wallClip = el("clipPath", { id: "sx-wall-clip", clipPathUnits: "userSpaceOnUse" }, defs); const wallClipP = el("path", {}, wallClip);
  const wallsG = el("g", { "clip-path": "url(#sx-wall-clip)" }); deep(nave, [0]).prepend(wallsG);
  [0, 1, 2, 6, 5, 7].map((i) => naveK[i]).forEach((n) => wallsG.appendChild(n));
  const roofG = el("g", { class: "sx-roof" }, sxG); roofG.appendChild(naveRoof); roofG.setAttribute("transform", nave.getAttribute("transform"));
  // ---- tuberías del frente (refino, PLS, alimentación a SX) y piscina
  mkPipe("ref", "sx", svg); mkPipe("feed", "piscina", svg);
  const pumpG = el("g", { class: "sx-pump", "data-eq": "piscina" }, svg);
  mkPipe("pls", "piscina", svg);
  const pis = await loadArt("piscina.svg", "sxw-", REG.pis, "sx-pis");
  pis.setAttribute("data-eq", "piscina");
  const pondG = el("g", { class: "sx-pond", "data-eq": "piscina" }, svg);
  // ---- patio: paquete en el punto de carga y grúa horquilla
  const patio = el("g", { class: "sx-patio", "data-eq": "horquilla" }, svg);
  const fkW = el("g", { class: "sx-fk" }, patio);
  const fkAll = await loadArt("grua-horquilla-catodos.svg", "sxf-", REG.fkc, "sx-fkc", fkW);
  const fkK = deep(fkAll, [0, 0]);
  const bundleG = el("g", { class: "sx-bundle" }); fkK.appendChild(bundleG); bundleG.appendChild(kids(fkK)[1]);
  const truck = kids(fkK)[0];                                    // grúa horquilla (desplazada 5,64 en el dibujo)
  const truckK = deep(truck, [0]);
  const forks = deep(truckK, [1]);                               // horquillas, carro y mástil interior
  const wheels = [deep(truckK, [0]), deep(truckK, [4]), deep(truckK, [5])];
  void wheels;
  const pickG = el("g", { class: "sx-newbundle", transform: `translate(${REG.fkc[0]} ${REG.fkc[1]}) scale(${S})` }, patio);
  // ---- capas de arriba: etiquetas, ion, detalles
  const topG = el("g", { class: "sx-top" }, svg);
  const lab = el("g", { class: "sx-labels" }, topG);
  const L = (p, t, a = "start") => { el("text", { x: f1(p[0]), y: f1(p[1]), class: "sx-small", "text-anchor": a }, lab).textContent = t; };
  L(add(PL.canA.at(14), [-3, 13]), "PLS desde pilas", "start");
  L(add(PL.canB.at(34), [-3, -4]), "refino → pilas", "end");
  L(add(W(MACHINE.e0, MACHINE.n0, 0), [-4, 8]), "despegadora", "end");
  L([REG.fk[0] + 70, REG.fk[1] + 52], "→ despacho", "start");

  const tourG = el("g", { class: "sx-tour" }, svg);
  const tourRing = el("circle", { r: 5, class: "sx-tour-ring" }, tourG), tourDot = el("circle", { r: 1.9, class: "sx-tour-dot" }, tourG);
  const tourPulse = el("circle", { r: 8, class: "sx-tour-pulse" }, svg);

  const CAL = { box: [3296, 292, 252, 152] };
  const calG = el("g", { class: "sx-callouts" }, svg);
  const [cx0, cy0, cw, ch] = CAL.box, cardG = el("g", { class: "sx-callout" }, calG);
  CAL.lead = el("path", { class: "sx-lead" }, cardG); CAL.leadDot = el("circle", { r: 2.2, class: "sx-lead-dot" }, cardG);
  el("rect", { x: cx0, y: cy0, width: cw, height: ch, rx: 7, class: "sx-card" }, cardG);
  const cclip = el("clipPath", { id: "sx-cal" }, defs); el("rect", { x: cx0 + 0.6, y: cy0 + 13, width: cw - 1.2, height: ch - 13.6, rx: 6 }, cclip);
  CAL.body = el("g", { "clip-path": "url(#sx-cal)" }, cardG); CAL.title = el("text", { x: cx0 + 8, y: cy0 + 9.5, class: "sx-cal-title" }, cardG); CAL.labels = el("g", {}, cardG); CAL.g = cardG;
  const CAL_AT = { A: SXW(MIXER.e0, UNITS[1].a + 8, SETTLER.h), B: W(ROWS[3].e1, 66, 3) };

  // etiquetas de foco
  const tagsG = el("g", { class: "sx-tags" }, svg);
  const TAGS = { piscina: ["Piscina de PLS", W(195, 70, 0)], sx: ["Extracción por solvente", SXW(26, 60, SXB.H + 8)], celdas: ["Celdas de electroobtención", W(30, 70, EW.H)], puente: ["Puente grúa", W(10, 40, EW.H + 2)], horquilla: ["Grúa horquilla", [REG.fk[0] + 30, REG.fk[1] + 2]] };
  const tagEls = {};
  for (const [id, [label, p]] of Object.entries(TAGS)) {
    const g = el("g", { class: "sx-tag", transform: `translate(${f1(p[0])} ${f1(p[1])})` }, tagsG);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -12, class: "sx-tag-line" }, g);
    const ww = label.length * 3.7 + 12; el("rect", { x: -ww / 2, y: -23, width: ww, height: 11, rx: 5.5, class: "sx-tag-pill" }, g);
    el("text", { x: 0, y: -15.6, class: "sx-tag-text", "text-anchor": "middle" }, g).textContent = label; tagEls[id] = g;
  }
  // etiquetas de las unidades SX (con el corte abierto)
  const unitLab = el("g", { class: "sx-unit-labels" }, topG);
  UNITS.forEach((u) => { const p = SXW(MIXER.e0 + 5, u.a + 5, MIXER.h + 4.5); el("text", { x: f1(p[0]), y: f1(p[1]), class: "sx-unit", "text-anchor": "middle" }, unitLab).textContent = u.id; });

  // ---- piezas estáticas agregadas: vía prolongada, despegadora, bomba, superficie de la piscina
  {
    let r = "";
    const beam = (e, n0, n1) => boxSvg(W, e - 0.9, e + 0.9, n0, n1, RAIL.z - 1.4, RAIL.z, "sx-beam");
    const col = (e, n) => boxSvg(W, e - 0.8, e + 0.8, n - 0.8, n + 0.8, 0, RAIL.z - 1.4, "sx-beam");
    r += col(0, RAIL.n0 + 1) + beam(0, RAIL.n0, 1);
    r += col(EW.E, RAIL.n0 + 1) + col(EW.E, EW.N - 1) + beam(EW.E, RAIL.n0, EW.N);
    setHTML(railG, r);
    const M = MACHINE;
    let mg = boxSvg(W, M.e0, M.e1, M.n0, M.n1, 0, M.h, "sx-mbox");
    mg += poly([W(M.e0 + 3, M.n0 + 2, M.h), W(M.e1 - 3, M.n0 + 2, M.h), W(M.e1 - 3, M.n1 - 2, M.h), W(M.e0 + 3, M.n1 - 2, M.h)], "sx-mslot");
    mg += boxSvg(W, M.e1 - 2, M.e1 + 6, M.n0 + 1, M.n0 + 6, 0, 3.2, "sx-mbox");     // mesa de apilado
    setHTML(machG, mg);
    setHTML(pumpG, boxSvg(W, 161, 165.5, 37.6, 42.4, 0, 3.2, "sx-mbox") + boxSvg(W, 162.2, 164.3, 38.9, 41.1, 3.2, 5.6, "sx-mbox"));
  }
  const machStack = el("g", { class: "sx-mstack" }, machG);

  // unidades para el foco
  const units = new Map();
  const classify = (n, inh) => { if (["defs", "style", "clipPath"].includes(n.tagName)) return; const eq = n.dataset?.eq || inh;
    if (n.querySelector?.("[data-eq]")) [...n.children].forEach((c) => classify(c, eq)); else units.set(n, eq || ""); };
  [tub, flow.canA, flow.canB, machG, base, cellLayer, railG, crane, cableG, cargaW, techo, pipeG, sxG, svg.querySelectorAll(".sx-pipe")[2], svg.querySelectorAll(".sx-pipe")[3], pumpG, svg.querySelectorAll(".sx-pipe")[4], pis, pondG, patio].forEach((n) => n && classify(n, ""));

  // ------------------------------------------------------------ estado
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const ST = { t: 0, rot: 0, flow: 0, J: 300, sx: 0, cel: 0 };
  const shown = { sx: 0, cel: 0 };
  let selected = null, playing = !still.matches, active = false, raf = 0, last = 0, sliderDetail = null;
  if (still.matches) ST.t = STEPS[1].t0 + 2;
  function step(dt) { ST.rot += 6 * dt; ST.flow += dt; ST.t = (ST.t + dt) % PERIOD; }
  const tourAt = (t) => { for (const s of TOUR.T) if (t >= s.t0 && t < s.t1) return { s, u: (t - s.t0) / s.dur }; const s = TOUR.T[TOUR.T.length - 1]; return { s, u: 1 }; };
  const live = () => ({ t: ST.t, m: model(ST.J), step: stepAt(ST.t), tour: tourAt(ST.t), crane: craneAt(ST.t), fork: forkAt(ST.t), grow: growAt(ST.t) });
  const detailNow = () => (selected ? (selected === "sx" ? "A" : selected === "celdas" ? "B" : null) : sliderDetail);
  let hookPx = [0, 0];

  function draw() {
    const s = live(), m = s.m, fl = ST.flow, sc = { rot: ST.rot, flow: fl };
    // flujo en canaletas y tuberías
    for (const [k, p] of Object.entries(flow)) { const back = k === "canB" || k === "ref" || k === "lean"; p.style.strokeDashoffset = f1(((back ? -1 : -1) * fl * (k.startsWith("can") ? 8 : 10)) % 7); }
    // interior SX (corte) y muros recortados
    const o = shown.sx;
    setHTML(interior, o > 0.004 ? sxInteriorSvg(o, sc, m) : "");
    interior.style.display = o > 0.004 ? "" : "none";
    const zc = lerp(SXB.H + 30, 2.2, smooth(o));
    const cutPoly = [SXW(-1, -1, zc), SXW(SXB.E + 1, -1, zc), SXW(SXB.E + 1, SXB.N + 1, zc), SXW(SXB.E + 1, SXB.N + 1, -3), SXW(SXB.E + 1, -1, -3), SXW(-1, -1, -3)].map((p) => toL(REG.sx, p));
    wallClipP.setAttribute("d", D(cutPoly, true, f2));
    wallsG.style.opacity = o > 0.004 ? 0 : 1;
    naveTop.style.opacity = f2(1 - smooth(o * 3));
    roofG.setAttribute("transform", `translate(${REG.sx[0]} ${f2(REG.sx[1] - 34 * smooth(o))}) scale(${S})`); roofG.style.opacity = f2(1 - 0.85 * smooth(o));
    unitLab.style.opacity = f2(smooth((o - 0.55) / 0.3));
    // celdas abiertas
    setHTML(cellLayer, shown.cel > 0.004 ? cellsSvg(shown.cel, sc, m, s.grow) : "");
    // electrodos de la celda cosechada
    const ht = harvestedTicks(s.t); harvestTicks.forEach((n) => (n.style.opacity = f2(ht)));
    // puente grúa
    const c = s.crane;
    const dnx = 0.866 * c.dn, dny = -0.5 * c.dn, dex = 0.866 * c.de, dey = 0.5 * c.de;
    crane.setAttribute("transform", `translate(${f2(REG.puente[0] + dnx)} ${f2(REG.puente[1] + dny)}) scale(${S})`);
    trolley.setAttribute("transform", `translate(${f2(dex / S)} ${f2(dey / S)})`);
    hooks.setAttribute("transform", `translate(${f2(dex / S)} ${f2((dey + c.hz) / S)})`);
    const hook = [REG.puente[0] + dnx + dex + S * 13.9, REG.puente[1] + dny + dey + S * 13.6 + c.hz]; hookPx = hook;
    setHTML(carga, cargaSvg(hook, c.loaded));
    // recorte del bastidor: sólo se ve sobre el borde de la celda (o sobre la boca de la despegadora)
    if (c.clip) { const big = 400; let p0, p1;
      if (c.clip === "cell") { p0 = toP(REG.base, [7.01, 40.82]); p1 = toP(REG.base, [44.81, 18.57]); }
      else { p0 = W(MACHINE.e1 - 3, MACHINE.n0, MACHINE.h); p1 = W(MACHINE.e1 - 3, MACHINE.n1, MACHINE.h); }
      const k = (p1[1] - p0[1]) / (p1[0] - p0[0]), yAt = (x) => p0[1] + k * (x - p0[0]);
      const pts = [[hook[0] - big, yAt(hook[0] - big) - 0.6], [hook[0] + big, yAt(hook[0] + big) - 0.6], [hook[0] + big, hook[1] - big], [hook[0] - big, hook[1] - big]];
      cargaClipP.setAttribute("d", D(pts, true, f2)); cargaW.setAttribute("clip-path", "url(#sx-carga-clip)"); }
    else cargaW.removeAttribute("clip-path");
    // cables del carro al bastidor
    const tr = [REG.puente[0] + dnx + dex + S * 12.9, REG.puente[1] + dny + dey + S * 8.2];
    const ca = [hook[0] - 0.866 * 4.5, hook[1] + 0.5 * 4.5 - 1.7], cb = [hook[0] + 0.866 * 4.5, hook[1] - 0.5 * 4.5 - 1.7];
    setHTML(cableG, `<path class="sx-cable" d="M${f2(tr[0] - 1.6)} ${f2(tr[1])}L${f2(ca[0])} ${f2(ca[1])}M${f2(tr[0] + 1.6)} ${f2(tr[1] + 0.4)}L${f2(cb[0])} ${f2(cb[1])}"/>`);
    // gotas que escurren de los cátodos recién levantados
    let dr = ""; if (c.drip > 0) for (let j = 0; j < 6; j++) { const ph = (fl * 1.6 + j / 6) % 1, x = hook[0] + lerp(-6, 7, hash(j * 3.1)), y0 = hook[1] + 9; dr += circ([x - 0.4 * j, y0 + ph * 9], 0.55, "sx-drip", c.drip * (1 - ph)); }
    setHTML(dripG, dr);
    // despegadora: pila de láminas que crece al despegar
    const u6 = s.t - T_HARV, stackN = u6 >= 11.5 ? Math.min(6, Math.floor((u6 - 11.5) * 4) + 1) : 0;
    let ms = ""; for (let i = 0; i < stackN; i++) ms += boxSvg(W, MACHINE.e1 - 1.4, MACHINE.e1 + 5.4, MACHINE.n0 + 1.7, MACHINE.n0 + 5.3, 3.2 + i * 0.55, 3.75 + i * 0.55, "sx-cubox");
    setHTML(machStack, ms);
    // piscina: superficie con ondas
    setHTML(pondG, pondSvg(fl, s));
    // grúa horquilla
    const f = s.fork;
    fkW.setAttribute("transform", `translate(${f2(f.dx)} 0)`); fkW.style.opacity = f2(f.op);
    forks.setAttribute("transform", `translate(0 ${f2(-f.lift / S)})`);
    bundleG.setAttribute("transform", `translate(0 ${f2(-f.lift / S)})`);
    bundleG.style.display = f.loaded ? "" : "none";
    // paquete nuevo en el punto de carga (fijo en el piso: no se mueve con la grúa)
    pickG.style.display = !f.loaded && f.pick > 0 ? "" : "none";
    pickG.style.opacity = f2(f.pick);
    // detalles
    const det = detailNow();
    CAL.g.style.display = det ? "" : "none";
    if (det) {
      const [bx, by, bw, bh] = CAL.box, at = CAL_AT[det];
      CAL.leadDot.setAttribute("cx", f1(at[0])); CAL.leadDot.setAttribute("cy", f1(at[1]));
      const e0 = [bx, by + bh * 0.62];
      CAL.lead.setAttribute("d", `M${f1(e0[0])} ${f1(e0[1])}C${f1(e0[0] - 40)} ${f1(e0[1])} ${f1(at[0] + 30)} ${f1(at[1] - 30)} ${f1(at[0])} ${f1(at[1])}`);
      if (det === "A") { const strip = false, r = sxSectionSvg(CAL.box, sc, m, strip); CAL.title.textContent = "Detalle · Mezclador-decantador de extracción en corte"; setHTML(CAL.body, r.svg);
        const T1 = by + 23, B1 = by + bh - 15, B2 = by + bh - 5;
        setHTML(CAL.labels, lbl(r.pts.motor, [bx + 8, T1], "Motor del agitador", "start") + lbl(r.pts.picket, [bx + bw * 0.38, T1], "Cerca de pickets", "start") + lbl(r.pts.outO, [bx + bw - 7, T1], "Orgánico cargado → re-extracción", "end") +
          lbl(r.pts.mix, [bx + 8, B1], "Mezclador: el Cu pasa al orgánico", "start") + lbl(r.pts.aqi, [bx + bw - 7, B1], "Las fases se separan (el orgánico flota)", "end") +
          lbl(r.pts.in, [bx + 8, B2], `PLS ${m.pls} g/L + orgánico descargado`, "start") + lbl(r.pts.outA, [bx + bw - 7, B2], `Refino ${fdec(m.raf, 1)} g/L → pilas`, "end")); }
      else { const r = ewSectionSvg(CAL.box, sc, m, s.grow); CAL.title.textContent = "Detalle · Celda de electroobtención en corte"; setHTML(CAL.body, r.svg);
        const T1 = by + 23, B1 = by + bh - 15, B2 = by + bh - 5;
        setHTML(CAL.labels, lbl(r.pts.rect, [bx + 8, T1], `Rectificador · ${m.J} A/m² · ${fdec(m.V, 1)} V`, "start") + lbl(r.pts.cathode, [bx + bw * 0.47, T1], "Cátodo de acero 316L (−)", "start") +
          lbl(r.pts.out, [bx + bw - 7, T1], `Pobre ${m.lean} g/L → SX`, "end") +
          lbl(r.pts.anode, [bx + 8, B1], "Ánodo Pb-Ca-Sn (+): O₂ y ácido", "start") + lbl(r.pts.ion, [bx + bw - 7, B1], "Cu²⁺ + 2e⁻ → Cu", "end") +
          lbl(r.pts.in, [bx + 8, B2], `Electrolito rico ${m.rich} g/L`, "start") + lbl(r.pts.cu, [bx + bw - 7, B2], `Cobre depositado ${fdec(m.mm7 * smooth(s.grow), 1)} mm`, "end")); }
    }
    drawTour(s);
    for (const id of ORDER) tagEls[id].toggleAttribute("data-on", selected === id);
    listeners.forEach((fn) => fn(s, api));
  }
  function pondSvg(fl, s) {
    const P = POND, z = -0.4; let g = "";
    g += poly([W(P.e0 + 1, P.n0 + 1, z), W(P.e1 - 1, P.n0 + 1, z), W(P.e1 - 1, P.n1 - 1, z), W(P.e0 + 1, P.n1 - 1, z)], "sx-pond-w");
    for (let j = 0; j < 9; j++) { const ph = (fl * 0.12 + j / 9) % 1, e = lerp(P.e0 + 6, P.e1 - 6, hash(j * 2.3)), n = lerp(P.n0 + 8, P.n1 - 8, hash(j * 5.7)), r = 2 + ph * 7;
      const pts = []; for (let i = 0; i <= 24; i++) { const th = (i / 24) * Math.PI * 2; pts.push(W(e + Math.cos(th) * r, n + Math.sin(th) * r, z)); }
      g += `<path class="sx-ripple" d="${D(pts, true, f2)}" style="opacity:${f2((1 - ph) * 0.8)}"/>`; }
    // chorro de PLS que cae desde la tubería
    const out = W(176, -6, 0.6); for (let j = 0; j < 4; j++) { const ph = (fl * 1.4 + j / 4) % 1; g += circ([out[0] + ph * 1.5, out[1] + ph * 3], 0.5, "sx-jet", 1 - ph); }
    void s; return g;
  }
  function drawTour(s) {
    const { s: sg, u } = s.tour; let tp = null, inside = null, small = false;
    if (sg.kind === "pipe") tp = PL[sg.p].at(u * PL[sg.p].len);
    else if (sg.kind === "pond") inside = W(lerp(180, 190, u), lerp(-4, 10, u), 0);
    else if (sg.kind === "mix") { const a = UNITS[1].a + 5.5, th = u * Math.PI * 6; const p = SXW((MIXER.e0 + MIXER.e1) / 2 + Math.cos(th) * 2.5, a + Math.sin(th) * 2.5, MIXER.h - 1);
      if (shown.sx > 0.5) tp = p; else inside = SXW(45, UNITS[1].a + 8, 6); }
    else if (sg.kind === "org") { const a = UNITS[1].a + 11, b = UNITS[2].a + 6; const e = u < 0.45 ? lerp(SETTLER.e1 - 2, SETTLER.e0 + 1, u / 0.45) : u < 0.6 ? SETTLER.e0 - 1 : lerp(SETTLER.e0 - 1, MIXER.e0 + 4, (u - 0.6) / 0.4); const n = u < 0.45 ? a : u < 0.6 ? lerp(a, b, (u - 0.45) / 0.15) : b;
      const p = SXW(e, n, u < 0.45 ? SETTLER.org : SETTLER.h + 1); if (shown.sx > 0.5) tp = p; else inside = SXW(26, lerp(UNITS[1].a + 10, UNITS[2].a + 10, u), 8); }
    else if (sg.kind === "strip") { const p = SXW(lerp(SETTLER.e1 - 3, SETTLER.e0 + 2, u), UNITS[2].a + 14, SETTLER.aq - 0.8); if (shown.sx > 0.5) tp = p; else inside = SXW(20, UNITS[2].a + 12, 6); }
    else if (sg.kind === "manifold") inside = W(lerp(44, 8, u), lerp(66, HARVEST.nc, u), 3);
    else if (sg.kind === "deposit") { const n = HARVEST.nc + 0.9; tp = W(lerp(8, 8, u), lerp(n + 3, n, smooth(u * 1.4)), 3.4 + (1 - smooth(u * 1.4)) * 1.2); }
    else if (sg.kind === "harvest") { const c = s.crane; if (c.loaded) { tp = [hookPx[0] + 1, hookPx[1] + 10]; small = true; } else if (c.phase === "va") inside = W(8, HARVEST.nc, 3); else inside = W(MACHINE.e1 + 2, MACHINE.n0 + 3.5, 4); }
    tourRing.setAttribute("r", small ? 0 : 5);
    if (tp) { for (const n of [tourRing, tourDot]) { n.setAttribute("cx", f1(tp[0])); n.setAttribute("cy", f1(tp[1] - 1)); n.style.opacity = 1; } }
    else { tourRing.style.opacity = 0; tourDot.style.opacity = 0; }
    if (inside) { const ph = (performance.now() / 900) % 1; tourPulse.setAttribute("cx", f1(inside[0])); tourPulse.setAttribute("cy", f1(inside[1])); tourPulse.setAttribute("r", f1(4 + ph * 9)); tourPulse.style.opacity = (0.9 * (1 - ph)).toFixed(2); }
    else tourPulse.style.opacity = 0;
  }
  const lbl = (p, q, text, anchor) => {
    const w = text.length * 2.72, x0 = anchor === "end" ? q[0] - w : anchor === "middle" ? q[0] - w / 2 : q[0], x1 = x0 + w;
    const e = p[0] < x0 ? [x0 - 1.2, q[1] - 1.8] : p[0] > x1 ? [x1 + 1.2, q[1] - 1.8] : [p[0], p[1] < q[1] ? q[1] - 6 : q[1] + 2];
    return `<path class="sx-cal-lead" d="M${f1(p[0])} ${f1(p[1])}L${f1(e[0])} ${f1(e[1])}"/><circle class="sx-cal-dot" cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.3"/><text class="sx-cal-text" x="${f1(q[0])}" y="${f1(q[1])}" text-anchor="${anchor}">${text}</text>`;
  };

  // paquete nuevo: copia del paquete del dibujo
  pickG.appendChild(bundleG.firstElementChild.cloneNode(true));

  // ------------------------------------------------------------ reloj
  const listeners = new Set();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) step(dt);
    const k = 1 - Math.exp(-dt * 6);
    for (const key of ["sx", "cel"]) { shown[key] += (ST[key] - shown[key]) * k; if (Math.abs(ST[key] - shown[key]) < 0.002) shown[key] = ST[key]; }
    draw(); raf = active ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; }, get playing() { return playing; }, get detail() { return detailNow(); },
    get sx() { return ST.sx; }, get cel() { return ST.cel; }, get J() { return ST.J; },
    live, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) kick(); else { cancelAnimationFrame(raf); raf = 0; } },
    play() { playing = true; kick(); }, pause() { playing = false; }, togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { ST.t = ((v % PERIOD) + PERIOD) % PERIOD; draw(); },
    goStep(n) { api.seek(STEPS[clamp(n, 1, STEPS.length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(ST.t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(ST.t); api.goStep(ST.t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    setSx(v, instant) { ST.sx = clamp(v); if (instant || still.matches) shown.sx = ST.sx; sliderDetail = ST.sx > 0 ? "A" : ST.cel > 0 ? "B" : null; draw(); },
    setCel(v, instant) { ST.cel = clamp(v); if (instant || still.matches) shown.cel = ST.cel; sliderDetail = ST.cel > 0 ? "B" : ST.sx > 0 ? "A" : null; draw(); },
    setJ(v) { ST.J = clamp(Math.round(v), J_MIN, J_MAX); draw(); },
    select(id) { selected = id && EQUIP[id] ? id : null; root.toggleAttribute("data-sel", !!selected); units.forEach((eq, u) => u.classList.toggle("sx-dim", !!selected && eq !== selected)); draw(); },
    destroy() { api.setActive(false); listeners.clear(); document.removeEventListener("visibilitychange", onVis); root.remove(); },
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-eq]"); api.select(g ? (selected === g.dataset.eq ? null : g.dataset.eq) : null); });
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); };
  document.addEventListener("visibilitychange", onVis);
  draw();
  return api;
}
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];

// ---------------------------------------------------------------- panel (HUD)
export function bindPanel(fx, { onEscape, onFocus } = {}) {
  const $ = (q) => document.querySelector(q);
  const playBtn = $("[data-sx-play]"), stepsBox = $("[data-sx-steps]");
  stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", fx.STEPS.length);
  const stepBtns = fx.STEPS.map((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n; b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
    b.addEventListener("click", () => fx.goStep(s.n)); stepsBox.appendChild(b); return b; });
  const info = $("[data-info]"), meter = $("[data-sx-meter]"), readout = $("[data-sx-readout]");
  const sxS = $("[data-sx-in]"), sxO = $("[data-sx-in-out]"), celS = $("[data-sx-cel]"), celO = $("[data-sx-cel-out]"), jS = $("[data-sx-j]"), jO = $("[data-sx-j-out]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = []; const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  function renderInfo(s) {
    const id = fx.selected;
    document.querySelectorAll("[data-sx-chip]").forEach((c) => c.toggleAttribute("data-on", c.dataset.sxChip === id));
    if (!id) { if (info.dataset.owner === "sx") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs(s.m), sig = id + specs.join("|");
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig; info.dataset.owner = "sx";
    $("[data-info-kicker]").textContent = e.kicker; $("[data-info-title]").textContent = e.title; $("[data-info-text]").textContent = e.text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join(""); $("[data-info-actions]").innerHTML = ""; info.hidden = false;
  }
  off.push(fx.on((s) => {
    const st = s.step;
    if (st.n !== lastStep) { $("[data-sx-step-n]").textContent = st.n; $("[data-sx-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const k = Number(b.dataset.step); b.toggleAttribute("data-done", k < st.n); b.toggleAttribute("data-current", k === st.n); }); lastStep = st.n; }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", smooth(s.grow).toFixed(3));
    const days = Math.min(7, Math.round(s.grow * 7 * 10) / 10);
    const text = `Día ${fdec(days, 0)} de 7 · ${fdec(s.m.V, 2)} V · ${fdec(s.m.kwh, 2)} kWh/kg · η ${Math.round(s.m.eff * 100)} %`;
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(fx.playing)); playBtn.setAttribute("aria-label", fx.playing ? "Pausar" : "Reproducir");
    renderInfo(s);
  }));
  const sync = () => { sxS.value = Math.round(fx.sx * 100); sxO.textContent = `${sxS.value} %`; celS.value = Math.round(fx.cel * 100); celO.textContent = `${celS.value} %`; jS.value = fx.J; jO.textContent = `${fx.J} A/m²`; };
  on(sxS, "input", () => { fx.setSx(sxS.value / 100); sxO.textContent = `${sxS.value} %`; onFocus?.("A", sxS.value > 0 || fx.cel > 0); });
  on(celS, "input", () => { fx.setCel(celS.value / 100); celO.textContent = `${celS.value} %`; onFocus?.("B", celS.value > 0 || fx.sx > 0); });
  on(jS, "input", () => { fx.setJ(Number(jS.value)); jO.textContent = `${fx.J} A/m²`; });
  on(playBtn, "click", () => fx.togglePlay());
  on($("[data-sx-prev]"), "click", () => fx.prevStep()); on($("[data-sx-next]"), "click", () => fx.nextStep());
  document.querySelectorAll("[data-sx-chip]").forEach((c) => on(c, "click", () => fx.select(fx.selected === c.dataset.sxChip ? null : c.dataset.sxChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "sx") fx.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "sxew" || e.target.closest?.("input, [data-intro]")) return;
    if (e.key === " " && !e.target.closest("button")) fx.togglePlay();
    else if (e.key === ",") fx.prevStep(); else if (e.key === ".") fx.nextStep();
    else if (/^[1-5]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; fx.select(fx.selected === id ? null : id); }
    else if (e.key === "ArrowRight") { fx.setSx(fx.sx + 0.1); sync(); onFocus?.("A", fx.sx > 0); }
    else if (e.key === "ArrowLeft") { fx.setSx(fx.sx - 0.1); sync(); onFocus?.("A", fx.sx > 0); }
    else if (e.key === "ArrowUp") { fx.setCel(fx.cel + 0.1); sync(); onFocus?.("B", fx.cel > 0); }
    else if (e.key === "ArrowDown") { fx.setCel(fx.cel - 0.1); sync(); onFocus?.("B", fx.cel > 0); }
    else if (e.key === "Escape") { if (fx.selected) fx.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  sync(); fx.seek(fx.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "sx") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const ZOOM = { piscina: [3150, 440, 260, 150], sx: [3110, 290, 450, 240], celdas: [3030, 290, 530, 230], puente: [3010, 330, 220, 170], horquilla: [3440, 450, 330, 130], A: [3110, 290, 450, 240], B: [3030, 290, 530, 230] };
export async function mount({ layer, focus }) {
  const fx = await createSxEw();
  layer.appendChild(fx.el);
  requestAnimationFrame(() => fx.el.setAttribute("data-in", ""));
  let focused = null;
  const want = (z, cap) => { const k = z ? JSON.stringify(z) : ""; if (k !== focused) { focused = k; focus?.(z, cap); } };
  const unbind = bindPanel(fx, { onEscape: () => { location.hash = ""; }, onFocus: (which, on) => want(on ? ZOOM[which] : null, 3.2) });
  const unzoom = fx.on(() => { if (fx.selected) want(ZOOM[fx.selected], 3); else if (fx.detail) want(ZOOM[fx.detail], 3.2); else want(null); });
  fx.setActive(true);
  window.pmSx = fx;
  return { focus: [VIEW[0] + 10, VIEW[1] + 10, VIEW[2] - 20, VIEW[3] - 20], view: "sxew",
    destroy: () => { unzoom(); unbind(); fx.destroy(); if (window.pmSx === fx) delete window.pmSx; } };
}
