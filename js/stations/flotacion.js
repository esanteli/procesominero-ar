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
// el lodo al cono y sale espesado (~65 % sólidos) hacia los filtros; el agua clara rebalsa por la canaleta perimetral y
// se recupera. El relave rougher va al segundo espesador (relaves) con el mismo mecanismo.
//
// Lógica de la skill anatomy: un modelo (flujo de aire → recuperación y ley) manda y el dibujo lo sigue; "sigue una
// partícula de sulfuro" en 6 pasos; selección de equipos con foco, ficha y detalle; cortes con deslizador en una celda y
// en el espesador de concentrado.
//
// Geometría: la lámina vive en px de la infografía. Cada dibujo se coloca con su registro (error medio < 0,4 px) y las
// capas vivas se dibujan en las unidades del dibujo que les corresponde (isometría 0,866 / 0,5).
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
const model = (air) => ({ air, R: 70 + 22 * (1 - Math.exp(-2.2 * air)), G: 34 - 8 * air, uf: 65, feedSol: 25, entrain: clamp((air - 0.6) / 1.0) });
const OMEGA_ROTOR = 7, OMEGA_RAKE = (Math.PI * 2) / 28;                 // rad/s (visual; las rastras reales dan ~1 vuelta cada 10–20 min)

// recorrido de la partícula de sulfuro
const TOUR = (() => {
  const T = [];
  const seg = (kind, dur, data = {}) => T.push({ kind, dur, ...data });
  seg("pipe", PL.feed.len / 22, { p: "feed" }); seg("cell", 1.2, { row: "r", i: 0, phase: "in" });          // 1
  seg("cell", 6, { row: "r", i: 0, phase: "rise" });                                                          // 2
  seg("cell", 4.5, { row: "r", i: 0, phase: "froth" });                                                       // 3
  seg("bank", 7, { row: "l" });                                                                               // 4
  seg("pipe", PL.bridge1.len / 12, { p: "bridge1" }); seg("well", 2.2);                                     // 5
  seg("settle", 7);                                                                                           // 6
  let t = 0; for (const s of T) { s.t0 = t; t += s.dur; s.t1 = t; }
  return { T, period: Math.round(t * 10) / 10 };
})();
export const PERIOD = TOUR.period;
const tAt = (i) => TOUR.T[i].t0;
export const STEPS = [
  { n: 1, id: "rougher", label: "La pulpa de molienda entra a la primera celda", t0: 0 },
  { n: 2, id: "rougher", label: "El rotor reparte el aire y el sulfuro se pega a una burbuja", t0: tAt(2) },
  { n: 3, id: "rougher", label: "La burbuja sube a la espuma y rebalsa; la ganga sigue al relave", t0: tAt(3) },
  { n: 4, id: "limpieza", label: "Las celdas de limpieza suben la ley del concentrado", t0: tAt(4) },
  { n: 5, id: "concentrado", label: "El concentrado entra al espesador con floculante", t0: tAt(5) },
  { n: 6, id: "concentrado", label: "Las rastras lo llevan al cono y sale espeso a filtros", t0: tAt(7) },
].map((s, i, a) => ({ ...s, t1: i + 1 < a.length ? a[i + 1].t0 : PERIOD }));
const stepAt = (t) => STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1];

// ---------------------------------------------------------------- fichas
const EQUIP = {
  rougher: { kicker: "Flotación primaria", title: "Celdas rougher", text: "Celdas en serie: el rotor gira dentro del estator, aspira el aire del eje hueco y lo reparte en burbujas finas. Los sulfuros, hidrofóbicos por el colector, se pegan a las burbujas y suben a la espuma, que rebalsa a la canaleta. La ganga sigue en la pulpa de celda en celda (cajones con válvula dardo) hasta el relave.",
    specs: (m) => [`Recuperación ~${Math.round(m.R)} %`, `Aire ${fdec(m.air, 1)}× nominal`, "Espumante: burbujas de 1–2 mm"] },
  limpieza: { kicker: "Flotación de limpieza", title: "Celdas de limpieza", text: "Reciben el concentrado rougher (normalmente remolido) y lo vuelven a flotar con menos aire y espuma más alta: la ganga arrastrada se lava y vuelve atrás, y el concentrado sube de ley.",
    specs: (m) => [`Ley del concentrado ~${Math.round(m.G)} % Cu`, "Colas → vuelven al circuito", "Espuma más profunda"] },
  concentrado: { kicker: "Separación sólido-líquido", title: "Espesador de concentrado", text: "La pulpa entra por la canaleta del puente al pozo de alimentación, donde se mezcla con floculante. Los flóculos decantan (agua clara arriba, zona de sedimentación y zona de compresión abajo), las rastras los llevan al cono y la descarga sale espesa hacia los filtros. El agua clara rebalsa por la canaleta perimetral y se recupera.",
    specs: (m) => [`Alimentación ~${m.feedSol} % sólidos`, `Descarga ~${m.uf} % sólidos → filtros`, "Rebalse: agua recuperada"] },
  relaves: { kicker: "Recuperación de agua", title: "Espesador de relaves", text: "Mismo principio que el de concentrado, con el relave de las celdas rougher: recupera el agua para la planta y entrega un relave espesado que se bombea al tranque.",
    specs: () => ["Descarga → tranque de relaves", "Rebalse → agua de proceso", "Floculante en el pozo"] },
};
const ORDER = ["rougher", "limpieza", "concentrado", "relaves"];

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
  const zc = 1.18 + 2.6, zs = zc + 3.2;
  let g = `<clipPath id="fl-tw"><path d="${win}"/></clipPath><g clip-path="url(#fl-tw)">`;
  g += `<path class="fl-void" d="${band(-1, 1.18)}"/><path class="fl-z-clear" d="${band(1.18, zc)}"/><path class="fl-z-settle${conc ? "" : " fl-z-tails"}" d="${band(zc, zs)}"/><path class="fl-z-bed${conc ? "" : " fl-z-tails"}" d="${band(zs, t.wall + 1)}"/>`;
  for (let j = 0; j < 46; j++) { const ph = (s.flow * 0.09 + hash(j * 3.7)) % 1, th = lerp(thA, thB, hash(j * 2.1)), dd = lerp(1.6, zs + 0.4, ph);
    g += circ(thP(t, th, dd), 0.16 + ph * 0.2, conc ? "fl-floc" : "fl-floc fl-floc--tails", 1 - smooth((ph - 0.85) / 0.15)); }
  // la rastra raspa el fondo: pasa por el corte cada media vuelta
  const ph = ((s.rake / Math.PI) % 1 + 1) % 1, thR = lerp(thB + 0.1, thA - 0.1, ph), a = thP(t, thR, t.wall - 2.4), b = thP(t, thR, t.wall - 0.3);
  g += `<path class="fl-rake-b" d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}"/>`;
  g += `</g><path class="fl-cut" d="${win}"/>`;
  return g;
}

// ---------------------------------------------------------------- detalle A: celda de flotación en corte (2D)
function cellSectionSvg(box, s, m) {
  const [bx, by, bw, bh] = box, cx = bx + bw * 0.46, top = by + 34, bot = by + bh - 10, hw = Math.min(bw * 0.3, 62), froth = top + 14;
  let g = "";
  // estanque, canaletas perimetrales (rebalse) y cajón de salida con válvula dardo
  g += `<path class="fl-a-tank" d="M${f1(cx - hw)} ${f1(top)}V${f1(bot - 8)}Q${f1(cx - hw)} ${f1(bot)} ${f1(cx - hw + 8)} ${f1(bot)}H${f1(cx + hw - 8)}Q${f1(cx + hw)} ${f1(bot)} ${f1(cx + hw)} ${f1(bot - 8)}V${f1(top)}"/>`;
  g += `<path class="fl-a-pulp" d="M${f1(cx - hw + 1)} ${f1(froth)}V${f1(bot - 8)}Q${f1(cx - hw + 1)} ${f1(bot - 1)} ${f1(cx - hw + 8)} ${f1(bot - 1)}H${f1(cx + hw - 8)}Q${f1(cx + hw - 1)} ${f1(bot - 1)} ${f1(cx + hw - 1)} ${f1(bot - 8)}V${f1(froth)}Z"/>`;
  g += `<rect class="fl-a-frothz" x="${f1(cx - hw + 1)}" y="${f1(top - 4)}" width="${f1(hw * 2 - 2)}" height="${f1(froth - top + 4)}"/>`;
  for (const sgn of [-1, 1]) { const x = cx + sgn * hw; g += `<path class="fl-a-launder" d="M${f1(x)} ${f1(top - 4)}V${f1(top + 8)}H${f1(x + sgn * 9)}V${f1(top - 6)}"/>`; }
  g += `<path class="fl-a-box" d="M${f1(cx + hw)} ${f1(bot - 26)}H${f1(cx + hw + 14)}V${f1(bot)}H${f1(cx + hw)}"/><path class="fl-a-dart" d="M${f1(cx + hw + 7)} ${f1(top + 10)}V${f1(bot - 12)}M${f1(cx + hw + 4)} ${f1(bot - 12)}L${f1(cx + hw + 7)} ${f1(bot - 7)}L${f1(cx + hw + 10)} ${f1(bot - 12)}Z"/>`;
  // alimentación (izquierda, abajo)
  g += `<path class="fl-a-feed" d="M${f1(bx + 4)} ${f1(bot - 20)}H${f1(cx - hw)}"/>`;
  // cono de espuma, eje hueco, motor y reductor, rotor/estator
  g += `<path class="fl-a-cone" d="M${f1(cx - 18)} ${f1(top - 3)}L${f1(cx - 4)} ${f1(froth + 4)}H${f1(cx + 4)}L${f1(cx + 18)} ${f1(top - 3)}Z"/>`;
  g += `<rect class="fl-a-beam" x="${f1(cx - hw - 12)}" y="${f1(top - 13)}" width="${f1(hw * 2 + 24)}" height="4"/>`;
  g += `<rect class="fl-a-motor" x="${f1(cx - 6)}" y="${f1(by + 15)}" width="12" height="9" rx="1.5"/><rect class="fl-a-motor" x="${f1(cx - 4)}" y="${f1(by + 24)}" width="8" height="5"/>`;
  g += `<path class="fl-a-air" d="M${f1(cx - 26)} ${f1(top - 13)}V${f1(by + 19)}H${f1(cx - 6)}"/>`;
  const rz = bot - 16;
  g += `<path class="fl-a-shaft" d="M${f1(cx - 1.6)} ${f1(by + 29)}V${f1(rz)}H${f1(cx + 1.6)}V${f1(by + 29)}"/>`;
  g += `<path class="fl-a-stator" d="M${f1(cx - 17)} ${f1(rz - 7)}V${f1(rz + 7)}M${f1(cx + 17)} ${f1(rz - 7)}V${f1(rz + 7)}M${f1(cx - 17)} ${f1(rz + 7)}H${f1(cx + 17)}"/>`;
  for (let i = 0; i < 6; i++) { const th = s.rot + (i / 6) * Math.PI * 2, x = cx + Math.cos(th) * 12, wv = Math.abs(Math.sin(th)) * 1.4 + 0.4; if (Math.sin(th) < -0.2) continue; g += `<rect class="fl-a-rotor" x="${f1(x - wv)}" y="${f1(rz - 6)}" width="${f1(wv * 2)}" height="12"/>`; }
  g += `<rect class="fl-a-hub" x="${f1(cx - 3)}" y="${f1(rz - 6)}" width="6" height="12"/>`;
  // aire que baja por el eje
  for (let j = 0; j < 5; j++) { const ph = (s.flow * 0.8 + j / 5) % 1; const y = lerp(by + 29, rz - 4, ph); g += circ([cx, y], 0.7, "fl-a-airb"); }
  // burbujas del rotor: suben, algunas con sulfuro pegado
  const nb = Math.round(30 + 20 * (m.air - 1));
  for (let j = 0; j < nb; j++) {
    const ph = (s.flow * (0.22 + 0.08 * hash(j)) + hash(j * 3.9)) % 1, side = hash(j * 1.3) < 0.5 ? -1 : 1, x0 = cx + side * 14, x = clamp(x0 + side * ph * (hw - 20) * hash(j * 6.6) + Math.sin(ph * 9 + j) * 2, cx - hw + 3, cx + hw - 3);
    const y = lerp(rz, froth + 1, Math.min(1, ph * 1.1)), r = 1.0 + ph * 0.8, loaded = hash(j * 2.7) < m.R / 140;
    g += circ([x, y], r, "fl-a-bub"); if (loaded && ph > 0.12) g += circ([x + r * 0.6, y + r * 0.6], 0.7, "fl-a-sulf");
  }
  // ganga: circula y sale por el cajón (relave)
  for (let j = 0; j < 16; j++) { const ph = (s.flow * 0.14 + hash(j * 8.3)) % 1, a = ph * Math.PI * 2 + j; let p = [cx + Math.cos(a) * (hw - 10) * hash(j * 2), lerp(froth + 6, bot - 4, (Math.sin(a) + 1) / 2)];
    if (j % 4 === 0) { const u = ph; p = [lerp(cx + hw - 6, cx + hw + 7, u), lerp(bot - 6, bot - 3, u)]; }
    g += circ(p, 0.8, "fl-a-gangue"); }
  // espuma: burbujas apretadas que avanzan hacia los bordes y caen a las canaletas
  for (let j = 0; j < 30; j++) { const ph = (s.flow * 0.12 + hash(j * 4.4)) % 1, side = j % 2 ? 1 : -1, x = cx + side * lerp(6, hw + 5, ph), y = lerp(froth - 2, top - 2, hash(j * 5.1)) + (ph > 0.88 ? (ph - 0.88) * 90 : 0);
    g += circ([x, y], 1.3 + hash(j) * 0.7, "fl-a-frothb"); if (hash(j * 7) < 0.7 - 0.25 * m.entrain) g += circ([x + 0.5, y + 0.5], 0.55, "fl-a-sulf"); else g += circ([x + 0.5, y + 0.5], 0.5, "fl-a-gangue"); }
  return { svg: g, pts: { motor: [cx + 6, by + 19], air: [cx - 26, by + 22], rotor: [cx + 12, rz], bub: [cx - 22, lerp(rz, froth, 0.5)], froth: [cx - hw * 0.5, froth - 6], launder: [cx + hw + 5, top + 2], dart: [cx + hw + 10, bot - 10], feed: [bx + 10, bot - 20], cone: [cx + 12, top + 2] } };
}

// ---------------------------------------------------------------- detalle B: espesador en corte (2D)
function thickSectionSvg(box, s, m, conc) {
  const [bx, by, bw, bh] = box, cx = bx + bw * 0.45, rim = by + 40, R = Math.min(bw * 0.38, 92), wallB = rim + 50, apex = wallB + 24;
  const zc = rim + 18, zs = rim + 36;                                    // fin del agua clara · tope del lecho
  let g = "";
  const tank = [[cx - R, rim], [cx - R, wallB], [cx - 8, apex], [cx + 8, apex], [cx + R, wallB], [cx + R, rim]];
  const inside = (y) => { const half = y <= wallB ? R : lerp(R, 8, (y - wallB) / (apex - wallB)); return [cx - half, cx + half]; };
  const bandP = (y0, y1) => { const pts = []; const ys = [y0]; if (y0 < wallB && y1 > wallB) ys.push(wallB); ys.push(y1); for (const y of ys) pts.push([inside(y)[0], y]); for (const y of ys.slice().reverse()) pts.push([inside(y)[1], y]); return pts; };
  g += `<path class="fl-b-clear" d="${D(bandP(rim + 2, zc))}"/><path class="fl-b-settle${conc ? "" : " fl-b-tails"}" d="${D(bandP(zc, zs))}"/><path class="fl-b-bed${conc ? "" : " fl-b-tails"}" d="${D(bandP(zs, apex))}"/>`;
  g += `<path class="fl-b-tank" d="${D(tank, false)}"/>`;
  // canaleta de rebalse perimetral (derecha) con el agua que sale
  g += `<path class="fl-b-launder" d="M${f1(cx + R)} ${f1(rim - 2)}V${f1(rim + 6)}H${f1(cx + R + 9)}V${f1(rim - 4)}"/>`;
  for (let j = 0; j < 6; j++) { const ph = (s.flow * 0.6 + j / 6) % 1; g += circ([lerp(cx + R * 0.4, cx + R + 4, ph), rim + 1 + (ph > 0.85 ? (ph - 0.85) * 30 : 0)], 0.9, "fl-b-water"); }
  // descarga: cono → bomba → filtros
  g += `<path class="fl-b-under" d="M${f1(cx)} ${f1(apex)}V${f1(apex + 6)}H${f1(cx + 34)}"/><circle class="fl-b-pump" cx="${f1(cx + 38)}" cy="${f1(apex + 6)}" r="4"/><path class="fl-b-under" d="M${f1(cx + 42)} ${f1(apex + 6)}H${f1(bx + bw - 6)}"/>`;
  for (let j = 0; j < 7; j++) { const ph = (s.flow * 0.35 + j / 7) % 1; const L1 = 6, L2 = 34, L3 = bx + bw - 6 - (cx + 42); const tot = L1 + L2 + L3, d = ph * tot; const p = d < L1 ? [cx, apex + d] : d < L1 + L2 ? [cx + d - L1, apex + 6] : [cx + 42 + (d - L1 - L2), apex + 6]; g += circ(p, 1.1, conc ? "fl-b-mud" : "fl-b-mud fl-b-mud--tails"); }
  // puente, accionamiento central, eje de torque y rastras (el brazo se acorta al girar: vista en corte)
  g += `<rect class="fl-b-bridge" x="${f1(cx - R - 6)}" y="${f1(rim - 14)}" width="${f1(R * 2 + 12)}" height="5"/>`;
  g += `<rect class="fl-b-drive" x="${f1(cx - 7)}" y="${f1(rim - 22)}" width="14" height="8" rx="1.5"/>`;
  g += `<path class="fl-b-shaft" d="M${f1(cx)} ${f1(rim - 14)}V${f1(apex - 4)}"/>`;
  for (let i = 0; i < 2; i++) { const c = Math.cos(s.rake + i * Math.PI), L = (R - 8) * c, y0 = apex - 6, y1 = lerp(apex - 6, wallB - 2, Math.abs(c));
    const x1 = cx + L; g += `<path class="fl-b-arm" d="M${f1(cx)} ${f1(y0)}L${f1(x1)} ${f1(y1)}"/>`;
    for (let k = 1; k <= 4; k++) { const u = k / 4.5, x = cx + L * u, y = lerp(y0, y1, u); g += `<path class="fl-b-blade" d="M${f1(x)} ${f1(y)}l${f1(Math.sign(L) * 2)} ${f1(3)}"/>`; } }
  // pozo de alimentación con la alimentación y el floculante
  g += `<path class="fl-b-well" d="M${f1(cx - 14)} ${f1(rim - 6)}V${f1(rim + 9)}M${f1(cx + 14)} ${f1(rim - 6)}V${f1(rim + 9)}"/>`;
  g += `<path class="fl-b-feed" d="M${f1(bx + 4)} ${f1(rim - 7)}H${f1(cx - 14)}"/>`;
  for (let j = 0; j < 6; j++) { const ph = (s.flow * 0.5 + j / 6) % 1; g += circ([lerp(bx + 6, cx - 15, ph), rim - 7], 1, conc ? "fl-b-mud" : "fl-b-mud fl-b-mud--tails"); }
  g += `<path class="fl-b-floc" d="M${f1(cx - 4)} ${f1(by + 15)}V${f1(rim - 6)}"/>`;
  for (let j = 0; j < 4; j++) { const ph = (s.flow * 0.9 + j / 4) % 1; g += circ([cx - 4, lerp(by + 16, rim - 6, ph)], 0.7, "fl-b-flocd"); }
  // flóculos que salen del pozo y decantan
  for (let j = 0; j < 34; j++) { const ph = (s.flow * 0.12 + hash(j * 3.1)) % 1, side = hash(j * 1.7) < 0.5 ? -1 : 1, spread = (12 + ph * (R - 20)) * hash(j * 5.3);
    const y = lerp(rim + 8, zs + 2, ph), x = cx + side * (6 + spread); g += circ([x, y], 0.6 + ph * 1.1, conc ? "fl-b-mud" : "fl-b-mud fl-b-mud--tails", 1 - smooth((ph - 0.85) / 0.15) * 0.6); }
  return { svg: g, pts: { well: [cx + 14, rim + 2], floc: [cx - 4, by + 18], clear: [cx - R * 0.7, rim + 7], settle: [cx - R * 0.55, (zc + zs) / 2], bed: [cx - R * 0.6, zs + 5], rake: (() => { const c = Math.cos(s.rake), L = (R - 8) * c, y1 = lerp(apex - 6, wallB - 2, Math.abs(c)); return [cx + L * 0.55, lerp(apex - 6, y1, 0.55)]; })(), launder: [cx + R + 5, rim], under: [bx + bw - 10, apex + 6] } };
}

// ---------------------------------------------------------------- lámina
export async function createFlotacion() {
  const root = document.createElement("div");
  root.className = "fl-plate";
  root.style.cssText = `position:absolute;left:${VIEW[0]}px;top:${VIEW[1]}px;width:${VIEW[2]}px;height:${VIEW[3]}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "fl-svg", role: "group", tabindex: "0",
    "aria-label": "Celdas de flotación: el aire se reparte en burbujas, los sulfuros suben a la espuma y rebalsan como concentrado; el espesador lo hace decantar y recupera el agua. Espacio pausa; coma y punto cambian de paso; 1 a 4 eligen un equipo." }, root);
  const defs = el("defs", {}, svg);
  const { SIL } = await import("./flotacion-geo.js");
  el("path", { d: SIL, class: "fl-sil" }, svg);
  async function loadArt(file, pre, R, cls) {
    const text = (await (await fetch(U(file))).text()).replace(/\bcls-(\d+)/g, `${pre}cls-$1`).replace(/(id="|url\(#)(clippath[-\d]*)/g, `$1${pre}$2`).replace(/\sid="(?!fl)[^"]*"/g, (m0) => (m0.includes("clippath") ? m0 : ""));
    const doc = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
    doc.querySelectorAll("metadata, title, desc").forEach((n) => n.remove());
    const st = doc.querySelector("style"); if (st) { el("style", {}, defs).textContent = st.textContent; st.remove(); }
    const g = el("g", { class: cls, transform: `translate(${R.tx} ${R.ty}) scale(${R.s})` }, svg);
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
  const L = (p, t, a = "start") => { el("text", { x: f1(p[0]), y: f1(p[1]), class: "fl-small", "text-anchor": a }, lab).textContent = t; };
  L(add(PIPES.feed[0], [-2, 9]), "desde molienda", "start");
  L(toP(ES, add(TH[0].rim, [14, 37])), "descarga → filtros", "start");
  L(toP(ES, add(TH[1].rim, [14, 37])), "descarga → tranque", "start");

  // partícula que se sigue
  const tourG = el("g", { class: "fl-tour" }, svg);
  const tourRing = el("circle", { r: 5, class: "fl-tour-ring" }, tourG), tourDot = el("circle", { r: 1.9, class: "fl-tour-dot" }, tourG);
  const tourPulse = el("circle", { r: 8, class: "fl-tour-pulse" }, svg);

  // detalles
  const CAL = {
    A: { box: [2880, 1010, 230, 150], at: toP(CE, cellP(CELLS.r[0], Math.PI / 4, 9)) },
    B: { box: [3335, 705, 256, 152], at: toP(ES, thP(TH[0], Math.PI / 4, 6)) },
  };
  const calG = el("g", { class: "fl-callouts" }, svg);
  for (const [key, C] of Object.entries(CAL)) {
    const [x, y, w, h] = C.box, g = el("g", { class: "fl-callout" }, calG);
    C.lead = el("path", { class: "fl-lead" }, g); el("circle", { r: 2.2, class: "fl-lead-dot", cx: f1(C.at[0]), cy: f1(C.at[1]) }, g);
    el("rect", { x, y, width: w, height: h, rx: 7, class: "fl-card" }, g);
    const clip = el("clipPath", { id: `fl-cal-${key}` }, defs); el("rect", { x: x + 0.6, y: y + 13, width: w - 1.2, height: h - 13.6, rx: 6 }, clip);
    C.body = el("g", { "clip-path": `url(#fl-cal-${key})` }, g); C.title = el("text", { x: x + 8, y: y + 9.5, class: "fl-cal-title" }, g); C.labels = el("g", {}, g); C.g = g;
    const e = key === "A" ? [x + w * 0.35, y] : [x, y + h * 0.7];
    C.lead.setAttribute("d", `M${f1(e[0])} ${f1(e[1])}C${f1(e[0] + (key === "A" ? 0 : -40))} ${f1(e[1] - (key === "A" ? 40 : 0))} ${f1(C.at[0])} ${f1(C.at[1] + (key === "A" ? 40 : -10))} ${f1(C.at[0])} ${f1(C.at[1])}`);
  }

  // etiquetas de foco
  const tagsG = el("g", { class: "fl-tags" }, svg);
  const TAGS = { rougher: ["Celdas rougher", toP(CE, add(CELLS.r[1], [15.7, 5]))], limpieza: ["Celdas de limpieza", toP(CE, add(CELLS.l[2], [15.7, -2]))], concentrado: ["Espesador de concentrado", toP(ES, add(TH[0].o, [32, 2]))], relaves: ["Espesador de relaves", toP(ES, add(TH[1].o, [40, 4]))] };
  const tagEls = {};
  for (const [id, [label, p]] of Object.entries(TAGS)) {
    const g = el("g", { class: "fl-tag", transform: `translate(${f1(p[0])} ${f1(p[1])})` }, tagsG);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -12, class: "fl-tag-line" }, g);
    const ww = label.length * 3.7 + 12; el("rect", { x: -ww / 2, y: -23, width: ww, height: 11, rx: 5.5, class: "fl-tag-pill" }, g);
    el("text", { x: 0, y: -15.6, class: "fl-tag-text", "text-anchor": "middle" }, g).textContent = label; tagEls[id] = g;
  }

  // unidades para el foco
  const units = new Map();
  const classify = (n, inh) => { if (["defs", "style", "clipPath"].includes(n.tagName) || n.classList?.contains("fl-win")) return; const eq = n.dataset?.eq || inh;
    if (n.querySelector?.("[data-eq]")) [...n.children].forEach((c) => classify(c, eq)); else units.set(n, eq || ""); };
  [zona, pipeBack, celdas, ...espW, topG].forEach((n) => classify(n, ""));

  // ------------------------------------------------------------ estado
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const S = { t: 0, rot: 0, rake: 0, flow: 0, air: 1, cell: 0, th: 0 };
  const shown = { cell: 0, th: 0 };
  let selected = null, playing = !still.matches, active = false, raf = 0, last = 0, sliderDetail = null;
  if (still.matches) S.t = STEPS[1].t0 + 2;
  function step(dt) { S.rot += OMEGA_ROTOR * dt; S.rake += OMEGA_RAKE * dt; S.flow += dt; S.t = (S.t + dt) % PERIOD; }
  const tourAt = (t) => { for (const s of TOUR.T) if (t >= s.t0 && t < s.t1) return { s, u: (t - s.t0) / s.dur }; const s = TOUR.T[TOUR.T.length - 1]; return { s, u: 1 }; };
  const live = () => ({ t: S.t, m: model(S.air), step: stepAt(S.t), tour: tourAt(S.t) });
  const detailNow = () => selected ? (["rougher", "limpieza"].includes(selected) ? "A" : "B") : sliderDetail;

  function draw() {
    const s = live(), m = s.m, fl = S.flow, sc = { rot: S.rot, rake: S.rake, flow: fl };
    // celdas: ventana en la primera rougher
    setHTML(cellWin, shown.cell > 0.005 ? cellWindowSvg(CELLS.r[0], shown.cell, sc, m) : "");
    // espesadores: rastras, canaleta perimetral, pozo; ventana en el de concentrado
    TH.forEach((t, i) => { setHTML(rakeL[i], rakesSvg(t, S.rake + i * 0.7)); setHTML(launL[i], launderSvg(t, fl)); setHTML(wellL[i], wellSvg(t, fl));
      setHTML(winTh[i], i === 0 && shown.th > 0.005 ? thWindowSvg(t, shown.th, sc, true) : ""); });
    for (const [k, p] of Object.entries(flow)) p.style.strokeDashoffset = k.startsWith("bridge") ? f2((-fl * 3) % 3.5) : f1((-fl * 10) % 7);
    setFront(selected === "concentrado" || (!selected && sliderDetail === "B") ? 0 : selected === "relaves" ? 1 : -1);
    // detalles
    const det = detailNow();
    for (const key of ["A", "B"]) { const C = CAL[key], on = det === key; C.g.style.display = on ? "" : "none"; if (!on) continue;
      const [bx, by, bw, bh] = C.box;
      if (key === "A") { const r = cellSectionSvg(C.box, sc, m); C.title.textContent = selected === "limpieza" ? "Detalle · Celda de limpieza en corte" : "Detalle · Celda de flotación en corte"; setHTML(C.body, r.svg);
        setHTML(C.labels, lbl(r.pts.motor, [bx + bw - 7, by + 22], "Motor y reductor", "end") + lbl(r.pts.air, [bx + 7, by + 22], "Aire → eje hueco", "start") + lbl(r.pts.cone, [bx + bw - 7, by + 34], "Cono de espuma", "end") +
          lbl(r.pts.froth, [bx + 7, by + 40], `Espuma → canaleta · ${Math.round(m.G)} % Cu`, "start") + lbl(r.pts.bub, [bx + 7, by + bh - 34], "Burbuja + sulfuro", "start") + lbl(r.pts.feed, [bx + 7, by + bh - 24], "Alimentación", "start") +
          lbl(r.pts.rotor, [bx + bw - 7, by + bh - 22], "Rotor y estator", "end") + lbl(r.pts.dart, [bx + bw - 7, by + bh - 8], "Ganga → válvula dardo → relave", "end")); }
      else { const conc = selected !== "relaves", r = thickSectionSvg(C.box, sc, m, conc); C.title.textContent = conc ? "Detalle · Espesador de concentrado en corte" : "Detalle · Espesador de relaves en corte"; setHTML(C.body, r.svg);
        setHTML(C.labels, lbl(r.pts.floc, [bx + bw * 0.62, by + 22], "Floculante", "start") + lbl(r.pts.well, [bx + bw - 7, by + 34], "Pozo de alimentación", "end") + lbl(r.pts.launder, [bx + bw - 7, by + 50], "Rebalse: agua clara", "end") +
          lbl(r.pts.clear, [bx + 7, by + 62], "Agua clara", "start") + lbl(r.pts.settle, [bx + 7, by + 84], "Sedimentación", "start") + lbl(r.pts.bed, [bx + 7, by + bh - 34], "Compresión", "start") +
          lbl(r.pts.rake, [bx + bw * 0.3, by + bh - 6], "Rastras", "middle") + lbl(r.pts.under, [bx + bw - 7, by + bh - 6], conc ? `~${m.uf} % sólidos → filtros` : "→ tranque", "end")); } }
    drawTour(s);
    for (const id of ORDER) tagEls[id].toggleAttribute("data-on", selected === id);
    listeners.forEach((fn) => fn(s, api));
  }
  function drawTour(s) {
    const { s: sg, u } = s.tour; let tp = null, inside = null;
    if (sg.kind === "pipe") tp = PL[sg.p].at(u * PL[sg.p].len);
    else if (sg.kind === "cell") { const T = CELLS[sg.row][sg.i];
      if (shown.cell > 0.3 && sg.phase !== "in") { const z = sg.phase === "rise" ? lerp(2.5, CELL.H - 4, u) : CELL.H - 3 + u; tp = toP(CE, cellP(T, Math.PI * 1.25, z, sg.phase === "rise" ? 3 + u * 2 : 5)); }
      else inside = toP(CE, cellP(T, Math.PI * 1.25, sg.phase === "in" ? 3 : sg.phase === "rise" ? lerp(3, CELL.H - 4, u) : CELL.H - 2, 2)); }
    else if (sg.kind === "bank") { const k = Math.min(3, Math.floor(u * 4)); inside = toP(CE, cellP(CELLS.l[k], Math.PI * 1.25, CELL.H - 3, 2)); }
    else if (sg.kind === "well") inside = toP(ES, add(TH[0].water, [0, 1.6]));
    else if (sg.kind === "settle") { const th = Math.PI * 1.25; inside = toP(ES, thP(TH[0], th, 4 + u * 6, TH[0].rW * (0.5 - u * 0.45))); }
    if (tp) { for (const n of [tourRing, tourDot]) { n.setAttribute("cx", f1(tp[0])); n.setAttribute("cy", f1(tp[1] - 1)); n.style.opacity = 1; } }
    else { tourRing.style.opacity = 0; tourDot.style.opacity = 0; }
    if (inside) { const ph = (performance.now() / 900) % 1; tourPulse.setAttribute("cx", f1(inside[0])); tourPulse.setAttribute("cy", f1(inside[1])); tourPulse.setAttribute("r", f1(4 + ph * 9)); tourPulse.style.opacity = (0.9 * (1 - ph)).toFixed(2); }
    else tourPulse.style.opacity = 0;
  }
  const lbl = (p, q, text, anchor) => `<path class="fl-cal-lead" d="M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1] + 2)}"/><circle class="fl-cal-dot" cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.3"/><text class="fl-cal-text" x="${f1(q[0])}" y="${f1(q[1])}" text-anchor="${anchor}">${text}</text>`;

  // ------------------------------------------------------------ reloj
  const listeners = new Set();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) step(dt);
    const k = 1 - Math.exp(-dt * 6);
    for (const key of ["cell", "th"]) { shown[key] += (S[key] - shown[key]) * k; if (Math.abs(S[key] - shown[key]) < 0.002) shown[key] = S[key]; }
    draw(); raf = active ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; }, get playing() { return playing; }, get detail() { return detailNow(); },
    get cell() { return S.cell; }, get th() { return S.th; }, get air() { return S.air; },
    live, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) kick(); else { cancelAnimationFrame(raf); raf = 0; } },
    play() { playing = true; kick(); }, pause() { playing = false; }, togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { S.t = ((v % PERIOD) + PERIOD) % PERIOD; draw(); },
    goStep(n) { api.seek(STEPS[clamp(n, 1, STEPS.length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(S.t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(S.t); api.goStep(S.t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    setCell(v, instant) { S.cell = clamp(v); if (instant || still.matches) shown.cell = S.cell; sliderDetail = S.cell > 0 ? "A" : S.th > 0 ? "B" : null; draw(); },
    setTh(v, instant) { S.th = clamp(v); if (instant || still.matches) shown.th = S.th; sliderDetail = S.th > 0 ? "B" : S.cell > 0 ? "A" : null; draw(); },
    setAir(v) { S.air = clamp(v, AIR_MIN, AIR_MAX); draw(); },
    select(id) { selected = id && EQUIP[id] ? id : null; root.toggleAttribute("data-sel", !!selected); units.forEach((eq, u) => u.classList.toggle("fl-dim", !!selected && eq !== selected)); draw(); },
    destroy() { api.setActive(false); listeners.clear(); document.removeEventListener("visibilitychange", onVis); root.remove(); },
  };
  svg.addEventListener("click", (e) => { const g = e.target.closest("[data-eq]"); api.select(g ? (selected === g.dataset.eq ? null : g.dataset.eq) : null); });
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); };
  document.addEventListener("visibilitychange", onVis);
  draw();
  return api;
}

// ---------------------------------------------------------------- panel (HUD)
export function bindPanel(fx, { onEscape, onFocus } = {}) {
  const $ = (q) => document.querySelector(q);
  const playBtn = $("[data-fl-play]"), stepsBox = $("[data-fl-steps]");
  stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", fx.STEPS.length);
  const stepBtns = fx.STEPS.map((s) => { const b = document.createElement("button"); b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n; b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
    b.addEventListener("click", () => fx.goStep(s.n)); stepsBox.appendChild(b); return b; });
  const info = $("[data-info]"), meter = $("[data-fl-meter]"), readout = $("[data-fl-readout]");
  const cellS = $("[data-fl-cell]"), cellO = $("[data-fl-cell-out]"), thS = $("[data-fl-th]"), thO = $("[data-fl-th-out]"), airS = $("[data-fl-air]"), airO = $("[data-fl-air-out]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = []; const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  function renderInfo(s) {
    const id = fx.selected;
    document.querySelectorAll("[data-fl-chip]").forEach((c) => c.toggleAttribute("data-on", c.dataset.flChip === id));
    if (!id) { if (info.dataset.owner === "fl") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs(s.m), sig = id + specs.join("|");
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig; info.dataset.owner = "fl";
    $("[data-info-kicker]").textContent = e.kicker; $("[data-info-title]").textContent = e.title; $("[data-info-text]").textContent = e.text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join(""); $("[data-info-actions]").innerHTML = ""; info.hidden = false;
  }
  off.push(fx.on((s) => {
    const st = s.step;
    if (st.n !== lastStep) { $("[data-fl-step-n]").textContent = st.n; $("[data-fl-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const k = Number(b.dataset.step); b.toggleAttribute("data-done", k < st.n); b.toggleAttribute("data-current", k === st.n); }); lastStep = st.n; }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", (s.m.R / 100).toFixed(3));
    const text = `Recup. ${Math.round(s.m.R)} % · Ley ${Math.round(s.m.G)} % Cu · Descarga ${s.m.uf} %`;
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(fx.playing)); playBtn.setAttribute("aria-label", fx.playing ? "Pausar" : "Reproducir");
    renderInfo(s);
  }));
  const sync = () => { cellS.value = Math.round(fx.cell * 100); cellO.textContent = `${cellS.value} %`; thS.value = Math.round(fx.th * 100); thO.textContent = `${thS.value} %`; airS.value = fx.air; airO.textContent = `${fdec(fx.air, 1)}×`; };
  on(cellS, "input", () => { fx.setCell(cellS.value / 100); cellO.textContent = `${cellS.value} %`; onFocus?.("A", cellS.value > 0 || fx.th > 0); });
  on(thS, "input", () => { fx.setTh(thS.value / 100); thO.textContent = `${thS.value} %`; onFocus?.("B", thS.value > 0 || fx.cell > 0); });
  on(airS, "input", () => { fx.setAir(Number(airS.value)); airO.textContent = `${fdec(Number(airS.value), 1)}×`; });
  on(playBtn, "click", () => fx.togglePlay());
  on($("[data-fl-prev]"), "click", () => fx.prevStep()); on($("[data-fl-next]"), "click", () => fx.nextStep());
  document.querySelectorAll("[data-fl-chip]").forEach((c) => on(c, "click", () => fx.select(fx.selected === c.dataset.flChip ? null : c.dataset.flChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "fl") fx.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "flotacion" || e.target.closest?.("input, [data-intro]")) return;
    if (e.key === " " && !e.target.closest("button")) fx.togglePlay();
    else if (e.key === ",") fx.prevStep(); else if (e.key === ".") fx.nextStep();
    else if (/^[1-4]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; fx.select(fx.selected === id ? null : id); }
    else if (e.key === "ArrowRight") { fx.setCell(fx.cell + 0.1); sync(); onFocus?.("A", fx.cell > 0); }
    else if (e.key === "ArrowLeft") { fx.setCell(fx.cell - 0.1); sync(); onFocus?.("A", fx.cell > 0); }
    else if (e.key === "ArrowUp") { fx.setTh(fx.th + 0.1); sync(); onFocus?.("B", fx.th > 0); }
    else if (e.key === "ArrowDown") { fx.setTh(fx.th - 0.1); sync(); onFocus?.("B", fx.th > 0); }
    else if (e.key === "Escape") { if (fx.selected) fx.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  sync(); fx.seek(fx.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "fl") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const ZOOM = { rougher: [2870, 800, 260, 370], limpieza: [2930, 770, 280, 300], concentrado: [3095, 700, 500, 270], relaves: [3160, 700, 440, 380], A: [2870, 820, 250, 350], B: [3095, 700, 500, 250] };
export async function mount({ layer, focus }) {
  const fx = await createFlotacion();
  layer.appendChild(fx.el);
  requestAnimationFrame(() => fx.el.setAttribute("data-in", ""));
  let focused = null;
  const want = (z, cap) => { const k = z ? JSON.stringify(z) : ""; if (k !== focused) { focused = k; focus?.(z, cap); } };
  const unbind = bindPanel(fx, { onEscape: () => { location.hash = ""; }, onFocus: (which, on) => want(on ? ZOOM[which] : null, 3.2) });
  const unzoom = fx.on(() => { if (fx.selected) want(ZOOM[fx.selected], 3); else if (fx.detail) want(ZOOM[fx.detail], 3.2); else want(null); });
  fx.setActive(true);
  window.pmFlo = fx;
  return { focus: [VIEW[0] + 20, VIEW[1] + 10, VIEW[2] - 40, VIEW[3] - 20], view: "flotacion",
    destroy: () => { unzoom(); unbind(); fx.destroy(); if (window.pmFlo === fx) delete window.pmFlo; } };
}
