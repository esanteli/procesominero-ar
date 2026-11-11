// Estación 2 · Molino SAG y de bolas (concentradora) — lámina viva sobre el dibujo de Emilio
// (assets/molienda/molienda.svg: molino SAG con trómel y harnero, cajón, dos molinos de bolas con su batería de
// hidrociclones y su bomba de alimentación).
//
// Flujo (circuito SABC sin chancado de pebbles visible): correa de alimentación → SAG → descarga por parrillas al
// trómel → harnero: los pebbles (sobretamaño) salen por su correa hacia el chancado de pebbles y vuelven al circuito;
// la pulpa (bajo tamaño) cae por el chute al cajón → bombas → hidrociclones → la descarga (gruesos) entra al molino de
// bolas → su descarga vuelve al mismo cajón (circuito cerrado) y el rebalse (finos) sigue a flotación.
// Lectura del dibujo: los tubos que nacen del cajón son las succiones de las dos bombas; los tubos cortos que llegan al
// cajón desde los molinos de bolas son sus descargas; los chutes junto a cada batería llevan la descarga de los
// hidrociclones a la alimentación del molino (extremo derecho).
//
// Lógica de la skill anatomy: un modelo manda (alimentación → llenado del SAG, carga circulante, P80 del rebalse) y
// el dibujo lo sigue; "sigue una partícula" en 6 pasos con play/pausa; selección de equipos con foco, ficha y detalle
// ampliado (SAG y molino de bolas por dentro, harnero, bomba e hidrociclón en corte); cortes con deslizador en el
// manto del SAG y de los molinos de bolas.
//
// Geometría: unidades del SVG (isometría 0,866 / 0,5). Las cotas de los tambores salen de ajustar las elipses del
// dibujo (centro, radio y eje); los tubos, de esqueletizar su relleno (ver README).
const NS = "http://www.w3.org/2000/svg";
const ASSET = new URL("../../assets/molienda/molienda.svg", import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const fmt = (n) => Math.round(n).toLocaleString("es-CL");
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const mul = (p, k) => [p[0] * k, p[1] * k];
const D = (pts, close = true) => "M" + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join("L") + (close ? "Z" : "");

// ---------------------------------------------------------------- registro
export const REG = { s: 1.03196, tx: 1678.94, ty: 851.94 };            // SVG → px de la infografía
export const VIEW = [185, 60, 565, 440];
const EY = [-0.866, 0.5], EZ = [0, -1];

// tambores: centro del anillo del extremo izquierdo, eje (por unidad), radio del anillo y del manto, largo
const SAG = { C: [362.3, 153.3], A: [0.866, 0.5528], R: 26.9, Rs: 25.4, L: 38.8 };
const BM = [
  { C: [536.2, 261.0], A: [0.866, 0.522], R: 15.4, Rs: 14.5, L: 57.5 },    // molino de bolas 1 (atrás)
  { C: [439.8, 317.7], A: [0.866, 0.5217], R: 14.35, Rs: 13.5, L: 53.6 },  // molino de bolas 2 (adelante)
];
const drumP = (M, a, th, r = M.Rs) => [M.C[0] + M.A[0] * a + r * (Math.cos(th) * EY[0]), M.C[1] + M.A[1] * a + r * (Math.cos(th) * EY[1] - Math.sin(th))];

// harnero (cubierta superior: origen, eje X del harnero, eje −Y)
const DECK = { P: [387.07, 219.91], U: [25.4, 14.26], V: [23.13, -13.92] };
const deckP = (u, v) => [DECK.P[0] + DECK.U[0] * u + DECK.V[0] * v, DECK.P[1] + DECK.U[1] * u + DECK.V[1] * v];
const CHUTE = { top: [431.3, 222.2], bot: [447.6, 267.4] };
const CAJON = [451.9, 270.4];
// tubos (eje, en el sentido del flujo)
const rev = (a) => a.slice().reverse();
const PIPE = {
  p10: rev([[536.7, 410.59], [513.95, 424.09], [508.95, 425.09], [502.82, 424.09], [349.45, 338.97], [346.32, 336.97], [344.2, 334.72], [342.95, 332.34], [341.95, 326.97], [343.2, 321.09], [345.95, 317.34], [432.82, 267.09]]),
  p11: [[453.03, 256.34], [515.91, 221.09], [520.41, 219.72], [524.78, 219.22], [529.53, 219.72], [533.53, 220.84], [686.28, 308.09], [688.53, 309.97], [689.28, 311.34], [690.03, 315.34], [689.03, 319.47], [687.16, 321.59], [664.16, 336.22], [657.66, 334.97]],
  p0: rev([[467.08, 266.33], [494.58, 250.7], [499.08, 248.95], [502.21, 248.58], [507.33, 249.58], [519.96, 257.2]]),
  p3: rev([[436.69, 284.27], [408.94, 300.02], [406.82, 301.77], [405.94, 303.27], [405.32, 307.15], [405.69, 309.27], [406.69, 311.27], [409.07, 313.27], [421.44, 320.9]]),
  p8: [[550.03, 385.33], [549.4, 314.83]],
  p17: [[647.36, 327.32], [646.73, 256.57]],
  u1: [[636.3, 264.08], [633.3, 261.95], [631.05, 261.33], [628.68, 262.2], [622.55, 267.45], [621.43, 270.95], [621.3, 277.08], [620.68, 280.7], [620.05, 281.95], [617.93, 283.58]],
  u2: [[537.67, 320.94], [534.54, 318.94], [532.29, 318.32], [529.92, 319.19], [523.92, 324.32], [523.17, 325.57], [522.67, 327.94], [522.54, 334.07], [521.79, 338.19], [519.17, 340.57]],
  of1: [[646.5, 243], [646.5, 236], [651, 233.4], [680, 250.1]],               // rebalse (agregado) → flotación
  of2: [[549.5, 300.5], [549.5, 293.5], [554, 290.9], [574, 302.4]],
};
const PUMP = [[668.5, 352.5], [571, 411]];                               // carcasas (bomba 1, bomba 2)
const CYC = [[646, 262], [549, 320]];                                    // baterías (1, 2)
const FEED = { a: [262, 86.5], b: [333, 110.5] };                        // correa de alimentación (agregada)
const PEB = { a: [436.5, 225.5], b: [474, 203.8] };                      // correa de pebbles (agregada)

function polyline(pts) {
  const S = [0]; for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = S[S.length - 1];
  const at = (s) => { s = clamp(s, 0, len); let i = 1; while (i < S.length - 1 && S[i] < s) i++; const u = (s - S[i - 1]) / (S[i] - S[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]; };
  return { len, at, pts, d: D(pts, false) };
}
const PL = Object.fromEntries(Object.entries(PIPE).map(([k, v]) => [k, polyline(v)]));
const FEEDP = polyline([FEED.a, FEED.b]), PEBP = polyline([PEB.a, PEB.b]);

// ---------------------------------------------------------------- modelo
const F_MIN = 2500, F_MAX = 5500, F_NOM = 4000;
const model = (F) => { const u = (F - F_MIN) / (F_MAX - F_MIN);
  return { F, J: 22 + 10 * u, CL: 250 + 100 * u, P80: 120 + 70 * u, MW: 15 + 7 * u, peb: 0.18 * F * (0.8 + 0.4 * u), Q: (F / 0.62 / 2.7 + F / 0.62 * 0.38) * (1 + (250 + 100 * u) / 100) * 0.42 }; };
const OMEGA_SAG = 0.9, OMEGA_BM = 1.3;                                   // rad/s (visual)

// recorrido de la partícula que se sigue: tramos con su duración
const TOUR = (() => {
  const T = [];
  const seg = (kind, dur, data = {}) => T.push({ kind, dur, ...data });
  seg("belt", 5.5); seg("drop", 0.6);                                        // 1 · alimentación
  seg("sag", 8);                                                              // 2 · dentro del SAG
  seg("trommel", 1.4); seg("fall", 0.5); seg("deck", 1.6); seg("chute", 1.4); seg("cajon", 0.8);   // 3 · harnero → cajón
  seg("pipe", PL.p10.len / 70, { p: "p10" }); seg("pump", 0.9, { i: 1 }); seg("pipe", PL.p8.len / 45, { p: "p8" }); seg("cyc", 1.4, { i: 1 });   // 4
  seg("pipe", PL.u2.len / 20, { p: "u2" }); seg("mill", 6, { i: 1 }); seg("pipe", PL.p3.len / 30, { p: "p3" }); seg("cajon", 0.6);           // 5
  seg("pipe", PL.p11.len / 75, { p: "p11" }); seg("pump", 0.7, { i: 0 }); seg("pipe", PL.p17.len / 45, { p: "p17" }); seg("cyc", 1.4, { i: 0, fine: true });
  seg("pipe", PL.of1.len / 18, { p: "of1", fine: true }); seg("rest", 1.5, { fine: true });   // 6
  let t = 0; for (const s of T) { s.t0 = t; t += s.dur; s.t1 = t; }
  return { T, period: Math.round(t * 10) / 10 };
})();
export const PERIOD = TOUR.period;
const tAt = (i) => TOUR.T[i].t0;
export const STEPS = [
  { n: 1, id: "sag", label: "La correa alimenta el molino SAG", t0: 0 },
  { n: 2, id: "sag", label: "El SAG muele con bolas y con el impacto del propio mineral", t0: tAt(2) },
  { n: 3, id: "harnero", label: "El harnero separa: los pebbles salen y la pulpa cae al cajón", t0: tAt(3) },
  { n: 4, id: "bombas", label: "La bomba impulsa la pulpa a los hidrociclones", t0: tAt(8) },
  { n: 5, id: "bolas", label: "Los gruesos vuelven al molino de bolas y regresan al cajón", t0: tAt(12) },
  { n: 6, id: "hidrociclones", label: "Los finos salen por el rebalse hacia flotación", t0: tAt(16) },
].map((s, i, a) => ({ ...s, t1: i + 1 < a.length ? a[i + 1].t0 : PERIOD }));
const stepAt = (t) => STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1];

// ---------------------------------------------------------------- fichas
const EQUIP = {
  sag: { kicker: "Molienda primaria", title: "Molino SAG", text: "Tambor de gran diámetro que gira lento. Los levantadores suben la carga y la dejan caer: el mineral se muele por el impacto de bolas de acero y de sus propias rocas (semiautógeno). La pulpa sale por parrillas hacia el trómel.",
    specs: (m) => [`Llenado ~${Math.round(m.J)} %`, `${fmt(m.F)} t/h`, `Potencia ~${Math.round(m.MW)} MW (típico)`] },
  harnero: { kicker: "Clasificación", title: "Trómel y harnero", text: "La descarga del SAG cae al harnero vibratorio. Los pebbles (sobretamaño, roca dura que el SAG no alcanza a moler) siguen por su correa al chancado de pebbles y vuelven al circuito; la pulpa fina atraviesa la malla y baja por el chute al cajón.",
    specs: (m) => [`Pebbles ~${fmt(m.peb)} t/h`, "Abertura ~10–12 mm (típico)", "Pulpa → cajón"] },
  bolas: { kicker: "Molienda secundaria", title: "Molinos de bolas", text: "Reciben la descarga gruesa de los hidrociclones y la muelen fino con bolas de acero en cascada. Su descarga vuelve al cajón: el circuito con los hidrociclones es cerrado, hasta que la partícula sale fina por el rebalse.",
    specs: (m) => [`Carga circulante ~${Math.round(m.CL)} %`, "Bolas de 2–3\" (típico)", "Llenado ~35 %"] },
  bombas: { kicker: "Impulsión", title: "Bombas de pulpa", text: "Bombas centrífugas: el impulsor gira dentro de la voluta, toma la pulpa del cajón por el centro y la descarga con presión por la tubería vertical hasta la batería de hidrociclones.",
    specs: (m) => [`~${fmt(m.Q / 2)} m³/h por bomba`, "Pulpa ~60–65 % sólidos", "Velocidad variable"] },
  hidrociclones: { kicker: "Clasificación fina", title: "Hidrociclones", text: "La pulpa entra a presión y tangencial: gira y las partículas gruesas y pesadas se van a la pared y bajan por el cono (descarga → molino de bolas); las finas quedan al centro y suben por el buscador de vórtice (rebalse → flotación).",
    specs: (m) => [`Rebalse P80 ~${Math.round(m.P80)} µm`, "Descarga → molino de bolas", "Presión ~70–100 kPa (típico)"] },
};
const ORDER = ["sag", "harnero", "bolas", "bombas", "hidrociclones"];

// ---------------------------------------------------------------- utilidades SVG
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
const ROCK = ["M-1.6 -.6L-.3 -1.7L1.4 -1.1L1.7 .6L.1 1.6L-1.4 1Z", "M-1.3 -1.2L1 -1.4L1.6 .4L.2 1.4L-1.6 .6Z", "M-1.7 0L-.7 -1.5L1.2 -1.4L1.4 1L-.6 1.4Z"];
const pool = (parent, n, cls) => Array.from({ length: n }, (_, i) => el("path", { d: ROCK[i % 3], class: cls }, parent));
const put = (r, p, sc, rot = 0, o = 1) => { if (!p || o <= 0.01) { r.style.opacity = 0; return; } r.setAttribute("transform", `translate(${f1(p[0])} ${f1(p[1])}) rotate(${Math.round(rot)}) scale(${f1(sc)})`); r.style.opacity = o.toFixed(2); };
const rockAt = (p, sc, rot, cls = "mo-rock") => `<path class="${cls}" d="${ROCK[Math.abs(Math.round(rot)) % 3]}" transform="translate(${f1(p[0])} ${f1(p[1])}) rotate(${Math.round(rot)}) scale(${f1(sc)})"/>`;

// ---------------------------------------------------------------- ventana en el manto de un tambor (lámina)
// carga: superficie plana entre la generatriz del pie (θ1, atrás abajo) y la del hombro (θ2, adelante): el tambor gira
// de modo que la carga sube por el lado de adelante.
function drumWindowSvg(M, id, open, s, o) {
  const w = lerp(0.15, 1.2, open), thA = Math.PI / 4 - w, thB = Math.PI / 4 + w * 0.9;
  const a0 = lerp(o.a1 * 0.55, o.a0, open), a1 = lerp(o.a1 * 0.62, o.a1, open), n = 18;
  const rim = [];
  for (let i = 0; i <= n; i++) rim.push(drumP(M, a0, lerp(thA, thB, i / n)));
  for (let i = 0; i <= n; i++) rim.push(drumP(M, a1, lerp(thB, thA, i / n)));
  const win = D(rim), J = o.J;
  const th1 = Math.PI + 0.62 + (J - 0.26) * 1.2, th2 = -0.32 + (J - 0.26) * 0.9;   // pie y hombro según el llenado
  let g = `<clipPath id="${id}"><path d="${win}"/></clipPath><path class="mo-dvoid" d="${win}"/><g clip-path="url(#${id})">`;
  for (let i = 0; i < o.lift; i++) {                                      // levantadores en la pared del fondo
    const th = -s.rot + (i / o.lift) * Math.PI * 2, c = Math.cos(th) + Math.sin(th);
    if (c > -0.15) continue;
    g += `<path class="mo-dlift" d="${D([drumP(M, -2, th), drumP(M, M.L + 2, th)], false)}"/>`;
  }
  g += `<path class="mo-dbed" d="${D([drumP(M, -2, th1), drumP(M, M.L + 2, th1), drumP(M, M.L + 2, th2), drumP(M, -2, th2)])}"/>`;
  // bolas y rocas sobre la superficie de la carga (se mueven del hombro al pie)
  for (let j = 0; j < o.nb; j++) {
    const a = a0 - 2 + hash(j * 2.3) * (a1 - a0 + 4), u = (hash(j * 5.9) + s.flow * o.roll * (0.6 + hash(j))) % 1;
    const p1 = drumP(M, a, th2), p2 = drumP(M, a, th1), q = [lerp(p1[0], p2[0], u), lerp(p1[1], p2[1], u)];
    g += j % 3 === 0 && o.rocks ? rockAt([q[0], q[1] - 0.4], o.rk, j * 40 + u * 300, "mo-drock") : `<circle class="mo-dball" cx="${f1(q[0])}" cy="${f1(q[1] - o.br * 0.7)}" r="${f1(o.br)}"/>`;
  }
  // catarata: se sueltan cerca del hombro y caen hacia el pie
  for (let j = 0; j < o.nc; j++) {
    const a = a0 + hash(j * 7.1) * (a1 - a0), ph = (s.flow * o.cat + hash(j * 3.7)) % 1;
    const p0 = drumP(M, a, th2 + 0.5 + 0.35 * hash(j), M.Rs * 0.9), pe = drumP(M, a, th1 - 0.15 - 0.3 * hash(j * 1.7), M.Rs * 0.85);
    const q = [lerp(p0[0], pe[0], ph), lerp(p0[1], pe[1], ph) - Math.sin(ph * Math.PI) * M.Rs * 0.35 + ph * ph * M.Rs * 0.2];
    g += j % 2 && o.rocks ? rockAt(q, o.rk * 0.9, j * 70 + ph * 300, "mo-drock") : `<circle class="mo-dball" cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(o.br * 0.9)}"/>`;
  }
  g += `</g><path class="mo-dcut" d="${win}"/>`;
  return g;
}
// costuras/pernos del manto que corren con el giro (indicio de rotación)
function seamsSvg(M, rot, a0, a1, n = 6) {
  let o = "";
  for (let i = 0; i < n; i++) { const th = -rot + (i / n) * Math.PI * 2, c = Math.cos(th) + Math.sin(th); if (c < 0.2) continue;
    o += `<path class="mo-seam" style="opacity:${f1(clamp((c - 0.2) * 1.3))}" d="${D([drumP(M, a0, th), drumP(M, a1, th)], false)}"/>`; }
  return o;
}

// ---------------------------------------------------------------- detalles (2D, en la tarjeta)
// molino en corte transversal: giro antihorario, la carga sube por la derecha (hombro) y cae al pie (izquierda)
function millSectionSvg(box, s, o) {
  const [bx, by, bw, bh] = box, cx = bx + bw * 0.42, cy = by + 14 + (bh - 14) * 0.52, R = Math.min(bw * 0.36, (bh - 22) * 0.46);
  const P = (th, r = 1) => [cx + R * r * Math.cos(th), cy - R * r * Math.sin(th)];
  const J = o.J, toe = Math.PI + 0.75 - J * 1.4, sh = -0.55 + J * 1.5;
  let g = `<circle class="mo-s-shell" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R * 1.07)}"/><circle class="mo-s-in" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R)}"/>`;
  // carga: arco del manto desde el pie, pasando por abajo, hasta el hombro, y cuerda de vuelta
  const pts = []; for (let i = 0; i <= 30; i++) pts.push(P(lerp(toe, sh + Math.PI * 2, i / 30), 0.985));
  g += `<path class="mo-s-charge" d="${D(pts)}"/>`;
  // relleno de la carga: bolas y mineral (fijos en el marco que gira lento, se reacomodan)
  for (let j = 0; j < o.n; j++) {
    const th = lerp(toe, sh + Math.PI * 2, hash(j * 1.7)), r = 0.25 + 0.7 * Math.sqrt(hash(j * 3.1));
    const q = P(th - s.rot * 0.03 * (1 - r), r);
    const inside = (() => { const a = P(toe, 0.985), b = P(sh, 0.985); return (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) > 0; })();
    if (!inside) continue;
    g += j % o.rockEvery === 0 ? rockAt(q, o.rock * (0.8 + hash(j) * 0.6), j * 37, "mo-s-rock") : `<circle class="mo-s-ball" cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(o.ball * (0.8 + hash(j * 2) * 0.4))}"/>`;
  }
  // levantadores (giran con el tambor)
  for (let i = 0; i < o.lift; i++) { const th = s.rot + (i / o.lift) * Math.PI * 2, a = P(th, 1), b = P(th, 0.9), w = 0.06;
    g += `<path class="mo-s-lift" d="${D([P(th - w, 1), P(th + w, 1), P(th + w * 0.7, 0.9), P(th - w * 0.7, 0.9)])}"/>`; void a; void b; }
  // catarata (trayectorias parabólicas del hombro al pie) y cascada sobre la superficie
  for (let j = 0; j < o.nc; j++) {
    const ph = (s.flow * o.cat + hash(j * 4.3)) % 1, th0 = sh + 0.35 + 0.45 * hash(j * 1.3), p0 = P(th0, 0.93);
    const v = [-(1.2 + hash(j) * 0.6) * R, -0.2 * R], g2 = 2.6 * R, tt = ph * 0.9;
    const q = [p0[0] + v[0] * tt, p0[1] + v[1] * tt + 0.5 * g2 * tt * tt];
    if (Math.hypot(q[0] - cx, q[1] - cy) > R * 0.97) continue;
    g += j % o.rockEvery === 1 ? rockAt(q, o.rock * 0.8, j * 50 + ph * 400, "mo-s-rock") : `<circle class="mo-s-ball" cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(o.ball * 0.9)}"/>`;
  }
  if (o.trajectory) { const p0 = P(sh + 0.55, 0.93), p1 = [p0[0] - 0.6 * R, p0[1] - 0.05 * R], p2 = P(toe + 0.1, 0.8);
    g += `<path class="mo-s-traj" d="M${f1(p0[0])} ${f1(p0[1])}Q${f1(p1[0])} ${f1(p1[1])} ${f1(p2[0])} ${f1(p2[1])}"/>`; }
  // flecha de giro
  const ar = []; for (let i = 0; i <= 10; i++) ar.push(P(Math.PI * 0.3 + i * 0.05, 1.16));
  g += `<path class="mo-s-arrow" d="${D(ar, false)}"/><path class="mo-s-arrowh" d="${D([P(Math.PI * 0.3 + 0.55, 1.16), add(P(Math.PI * 0.3 + 0.45, 1.24), [0, 0]), add(P(Math.PI * 0.3 + 0.45, 1.08), [0, 0])])}"/>`;
  return { svg: g, pts: { lift: P(s.rot % (Math.PI * 2 / o.lift) + Math.PI * 0.62, 0.95), shoulder: P(sh + 0.2, 0.9), toe: P(toe - 0.05, 0.9), charge: P(-Math.PI / 2, 0.55), cat: P(Math.PI * 0.5, 0.25) }, R, cx, cy };
}

// harnero en vista lateral: cubierta inclinada que vibra; los gruesos avanzan al extremo, los finos caen a la batea
function screenSvg(box, s, m) {
  const [bx, by, bw, bh] = box, x0 = bx + 22, x1 = bx + bw - 34, y0 = by + 40, y1 = by + bh - 34;
  const vib = [Math.cos(s.flow * 38) * 0.8, Math.sin(s.flow * 38) * 0.8];
  const deck = (u) => [lerp(x0, x1, u) + vib[0], lerp(y0, y1, u) + vib[1]];
  let g = "";
  // batea (bajo tamaño) que lleva la pulpa al chute
  g += `<path class="mo-h-pan" d="${D([[x0 + 4, y0 + 14], [x1, y1 + 10], [x1 + 2, y1 + 22], [x1 - 12, y1 + 22], [x0 + 4, y0 + 22]])}"/>`;
  for (let j = 0; j < 8; j++) { const ph = (s.flow * 0.6 + j / 8) % 1, q = [lerp(x0 + 10, x1 - 4, ph), lerp(y0 + 19, y1 + 17, ph)]; g += `<circle class="mo-h-pulp" cx="${f1(q[0])}" cy="${f1(q[1])}" r="1.1"/>`; }
  // chute del sobretamaño (pebbles) y de la pulpa
  g += `<path class="mo-h-out" d="${D([[x1 + vib[0], y1 + vib[1] - 2], [x1 + 18, y1 + 4], [x1 + 18, y1 + 8], [x1 + vib[0], y1 + vib[1] + 2]])}"/>`;
  // cubierta con aberturas
  const dk0 = deck(0), dk1 = deck(1);
  g += `<path class="mo-h-deck" d="M${f1(dk0[0])} ${f1(dk0[1])}L${f1(dk1[0])} ${f1(dk1[1])}"/><path class="mo-h-holes" d="M${f1(dk0[0])} ${f1(dk0[1])}L${f1(dk1[0])} ${f1(dk1[1])}"/>`;
  // resortes y estructura
  for (const u of [0.12, 0.88]) { const p = deck(u); g += `<path class="mo-h-spring" d="M${f1(p[0])} ${f1(p[1] + 3)}l-2 2l4 2l-4 2l4 2l-2 2"/><path class="mo-h-leg" d="M${f1(p[0])} ${f1(p[1] + 15)}V${f1(by + bh - 6)}"/>`; }
  // barras de agua
  for (const u of [0.35, 0.65]) { const p = deck(u); g += `<path class="mo-h-spray" d="M${f1(p[0] - 10)} ${f1(p[1] - 16)}H${f1(p[0] + 10)}"/>`;
    for (let k = 0; k < 4; k++) { const ph = (s.flow * 1.4 + k / 4 + u) % 1; g += `<circle class="mo-h-drop" cx="${f1(p[0] - 7 + k * 4.5)}" cy="${f1(p[1] - 15 + ph * 11)}" r=".7"/>`; } }
  // descarga del trómel cae al inicio de la cubierta
  for (let j = 0; j < 6; j++) { const ph = (s.flow * 1.1 + j / 6) % 1, q = [x0 + 6 + hash(j) * 10, by + 18 + ph * (y0 - by - 18)]; g += rockAt(q, 1 + hash(j * 3) * 0.8, j * 60 + ph * 300, "mo-h-rock"); }
  // partículas: gruesas avanzan saltando por la cubierta; finas la atraviesan
  const nP = 16;
  for (let j = 0; j < nP; j++) {
    const coarse = hash(j * 2.9) < 0.4, ph = (s.flow * (coarse ? 0.22 : 0.35) + hash(j * 7.3)) % 1;
    if (coarse) { const u = ph, p = deck(u), hop = Math.abs(Math.sin(s.flow * 19 + j)) * 2.2; g += rockAt([p[0], p[1] - 2.4 - hop], 1.5 + hash(j) * 0.4, j * 40 + ph * 500, "mo-h-rock"); }
    else { const u = 0.08 + hash(j * 5.1) * 0.8, fall = ph; const p = deck(u); g += `<circle class="mo-h-fine" cx="${f1(p[0] + fall * 3)}" cy="${f1(p[1] - 2 + fall * 18)}" r=".9"/>`; }
  }
  return { svg: g, pts: { deck: deck(0.5), peb: [x1 + 14, y1 + 5], pan: [x1 - 8, y1 + 20], spray: [deck(0.35)[0] - 10, deck(0.35)[1] - 16], feed: [x0 + 10, by + 22] } };
}

// bomba centrífuga en corte: voluta, impulsor que gira, succión al centro y descarga tangencial hacia arriba
function pumpSvg(box, s) {
  const [bx, by, bw, bh] = box, cx = bx + bw * 0.42, cy = by + 14 + (bh - 14) * 0.58, R = Math.min(bw * 0.24, (bh - 14) * 0.3);
  let g = "";
  // voluta (espiral que crece hasta la descarga)
  const vol = []; for (let i = 0; i <= 40; i++) { const th = -Math.PI / 2 + (i / 40) * Math.PI * 2, r = R * (1.18 + 0.32 * (i / 40)); vol.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]); }
  const top = vol[vol.length - 1];
  g += `<path class="mo-p-casing" d="${D([...vol, [top[0], by + 18], [top[0] - R * 0.62, by + 18], [cx - R * 0.6 + R * 0.05, cy - R * 1.18]])}"/>`;
  g += `<path class="mo-p-pipe" d="M${f1(top[0] - R * 0.31)} ${f1(by + 18)}V${f1(by + 13.5)}"/>`;
  // impulsor
  g += `<circle class="mo-p-imp" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R)}"/>`;
  for (let i = 0; i < 6; i++) { const th = s.flow * 9 + (i / 6) * Math.PI * 2; const p0 = [cx + R * 0.32 * Math.cos(th), cy + R * 0.32 * Math.sin(th)], pc = [cx + R * 0.7 * Math.cos(th + 0.25), cy + R * 0.7 * Math.sin(th + 0.25)], p1 = [cx + R * 0.97 * Math.cos(th + 0.75), cy + R * 0.97 * Math.sin(th + 0.75)];
    g += `<path class="mo-p-vane" d="M${f1(p0[0])} ${f1(p0[1])}Q${f1(pc[0])} ${f1(pc[1])} ${f1(p1[0])} ${f1(p1[1])}"/>`; }
  g += `<circle class="mo-p-eye" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R * 0.3)}"/>`;
  // pulpa: entra por el ojo, sale girando por la voluta y sube por la descarga
  for (let j = 0; j < 18; j++) { const ph = (s.flow * 0.55 + j / 18) % 1; let q;
    if (ph < 0.75) { const th = ph / 0.75 * Math.PI * 1.85 - Math.PI / 2 + 0.3, r = R * (1.1 + 0.35 * ph / 0.75) ; q = [cx + r * Math.cos(th), cy + r * Math.sin(th)]; }
    else { const u = (ph - 0.75) / 0.25; q = [top[0] - R * 0.31 + (hash(j) - 0.5) * R * 0.3, lerp(cy - R * 1.3, by + 15, u)]; }
    g += `<circle class="mo-p-pulp" cx="${f1(q[0])}" cy="${f1(q[1])}" r="1.1"/>`; }
  // succión (de frente: círculo con flecha)
  return { svg: g, pts: { eye: [cx, cy], imp: [cx + R * 0.7, cy + R * 0.5], vol: [cx - R * 1.3, cy + R * 0.6], out: [top[0] - R * 0.31, by + 18] } };
}

// hidrociclón en corte: cilindro con entrada tangencial, buscador de vórtice, cono y ápex
function cycloneSvg(box, s, m) {
  const [bx, by, bw, bh] = box, cx = bx + bw * 0.45, top = by + 22, Rc = Math.min(bw * 0.18, 20), hc = 16, apex = by + bh - 12, ra = Rc * 0.18;
  let g = "";
  const body = [[cx - Rc, top], [cx + Rc, top], [cx + Rc, top + hc], [cx + ra, apex], [cx - ra, apex], [cx - Rc, top + hc]];
  g += `<path class="mo-c-body" d="${D(body)}"/>`;
  // entrada tangencial (lado derecho) y rebalse (tubo central hacia arriba)
  g += `<path class="mo-c-inlet" d="${D([[cx + Rc, top + 2], [cx + Rc + 16, top + 2], [cx + Rc + 16, top + 9], [cx + Rc, top + 9]])}"/>`;
  g += `<path class="mo-c-vf" d="${D([[cx - Rc * 0.32, by + 13], [cx + Rc * 0.32, by + 13], [cx + Rc * 0.32, top + hc + 2], [cx - Rc * 0.32, top + hc + 2]])}"/>`;
  g += `<path class="mo-c-air" d="M${f1(cx)} ${f1(top + hc + 4)}V${f1(apex - 2)}"/>`;
  // remolino (líneas que avanzan)
  for (let j = 0; j < 7; j++) { const yy = top + 4 + ((j / 7 + s.flow * 0.25) % 1) * (apex - top - 8), rr = yy < top + hc ? Rc : lerp(Rc, ra, (yy - top - hc) / (apex - top - hc));
    g += `<path class="mo-c-swirl" d="M${f1(cx - rr * 0.9)} ${f1(yy)}Q${f1(cx)} ${f1(yy + 3)} ${f1(cx + rr * 0.9)} ${f1(yy - 1)}"/>`; }
  // partículas: gruesas por la pared hacia abajo (espiral), finas por el centro hacia arriba
  const fineShare = clamp(1 - (m.P80 - 120) / 140, 0.45, 0.8);
  for (let j = 0; j < 30; j++) {
    const coarse = hash(j * 3.3) > fineShare, ph = (s.flow * (coarse ? 0.22 : 0.3) + hash(j * 5.7)) % 1;
    if (coarse) { const yy = lerp(top + 6, apex + 8, ph), rr = yy < top + hc ? Rc * 0.86 : Math.max(ra * 0.6, lerp(Rc, ra, (yy - top - hc) / (apex - top - hc)) * 0.86);
      const xx = cx + rr * Math.sin(s.flow * 5 + j * 1.3 + ph * 9); g += `<circle class="mo-c-coarse" cx="${f1(yy > apex ? cx + (hash(j) - 0.5) * 3 : xx)}" cy="${f1(yy)}" r="${f1(1.4 + hash(j) * 0.6)}"/>`; }
    else { const yy = lerp(apex - 10, by + 8, ph), rr = Math.min(Rc * 0.28, 2 + 0.06 * (yy - top)); const xx = cx + rr * Math.sin(s.flow * 7 + j * 2.1 + ph * 12);
      g += `<circle class="mo-c-fine" cx="${f1(xx)}" cy="${f1(yy)}" r=".75"/>`; }
  }
  return { svg: g, pts: { inlet: [cx + Rc + 12, top + 5.5], over: [cx, by + 15], under: [cx, apex + 2], wall: [cx + Rc * 0.62, top + hc + 22], core: [cx, top + hc + 10] } };
}

// ---------------------------------------------------------------- lámina
export async function createMolienda() {
  const root = document.createElement("div");
  root.className = "mo-plate";
  root.style.cssText = `position:absolute;left:${f1(REG.tx + VIEW[0] * REG.s)}px;top:${f1(REG.ty + VIEW[1] * REG.s)}px;width:${f1(VIEW[2] * REG.s)}px;height:${f1(VIEW[3] * REG.s)}px`;
  const svg = el("svg", { viewBox: VIEW.join(" "), class: "mo-svg", role: "group", tabindex: "0",
    "aria-label": "Molino SAG y de bolas: la correa alimenta el SAG, el harnero separa pebbles y pulpa, las bombas llevan la pulpa a los hidrociclones; los gruesos vuelven al molino de bolas y los finos siguen a flotación. Espacio pausa; coma y punto cambian de paso; 1 a 5 eligen un equipo." }, root);
  const defs = el("defs", {}, svg);
  const { SIL } = await import("./molienda-geo.js");
  el("path", { d: SIL, class: "mo-sil" }, svg);

  // correa de alimentación (bajo el dibujo: la caja de alimentación tapa su cabeza)
  const feedG = el("g", { class: "mo-feed", "data-eq": "sag" }, svg);
  { const n = [-3.2, 1.85], a = FEED.a, b = FEED.b;
    el("path", { class: "mo-belt", d: D([add(a, n), add(b, n), sub(b, n), sub(a, n)]) }, feedG);
    el("path", { class: "mo-belt", d: D([sub(a, n), sub(b, n), add(sub(b, n), [0, 2.4]), add(sub(a, n), [0, 2.4])]) }, feedG);
    el("path", { class: "mo-belt", d: `M${f1(a[0] + 8)} ${f1(a[1] + 6)}v18M${f1(a[0] + 30)} ${f1(a[1] + 13)}v16` }, feedG); }
  const feedRocksL = el("g", { class: "mo-rocks" }, svg);
  const rockFeed = pool(feedRocksL, 22, "mo-rock");

  // dibujo de Emilio
  const text = (await (await fetch(ASSET)).text()).replace(/\bcls-(\d+)/g, "mo-cls-$1").replace(/(id="|url\(#)(clippath[-\d]*)/g, "$1mo-$2");
  const doc = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  doc.querySelectorAll("metadata, title, desc").forEach((n) => n.remove());
  const st = doc.querySelector("style"); if (st) { el("style", {}, defs).textContent = st.textContent; st.remove(); }
  const art = el("g", { class: "mo-art" }, svg);
  [...doc.children].forEach((n) => { if (n.tagName === "defs") [...n.children].forEach((c) => defs.appendChild(document.importNode(c, true))); else art.appendChild(document.importNode(n, true)); });
  doc.querySelectorAll("[id]").forEach(() => 0);
  const kids = (n) => [...n.children].filter((c) => !["defs", "style", "title", "clipPath"].includes(c.tagName));
  const tag = (n, eq) => n && n.setAttribute("data-eq", eq);
  const [g0, g1] = kids(art), k0 = kids(g0), k1 = kids(g1);
  // equipos
  [k0[13], k0[19], k0[12], k0[14], k0[18], k0[20], k0[0], k0[3]].forEach((n) => tag(n, "bolas"));
  [k0[22], k0[15], k0[21]].forEach((n) => tag(n, "hidrociclones"));
  [k0[7], k0[9], k0[10], k0[11], k0[8], k0[1], k0[2], k0[4], k0[5], k0[6], k0[16], k0[23]].forEach((n) => tag(n, "bombas"));
  const k17 = kids(k0[17]); [k17[3], k17[0], k17[4]].forEach((n) => tag(n, "bombas")); [k17[6]].forEach((n) => tag(n, "hidrociclones")); [k17[1], k17[2], k17[5]].forEach((n) => tag(n, "bombas"));
  [k1[18], k1[19], k1[34], k1[35], k1[36], k1[37], k1[41], k1[42], k1[43]].forEach((n) => tag(n, "harnero"));
  [20, 21, 22, 23, 24, 25, 28, 29, 30, 31, 32, 33].forEach((i) => tag(k1[i], "sag"));
  const dashed = [k1[32], k1[33]];                                     // líneas de pernos del manto del SAG (corren con el giro)

  // capas vivas insertadas en el orden del dibujo (lo que va delante las tapa)
  const after = (n, cls) => { const g = el("g", { class: cls }); n.after(g); return g; };
  const flow = {};
  const flowPath = (key, n, cls = "mo-flow") => { const g = after(n, "mo-flowg"); flow[key] = el("path", { d: PL[key].d, class: cls }, g); return g; };
  flowPath("p10", k0[10]); flowPath("p11", k0[11]); flowPath("p0", k0[0]); flowPath("p3", k0[3]);
  flowPath("p8", k0[8]); flowPath("u2", k0[21], "mo-flow mo-flow--coarse"); flowPath("p17", k17[4]); flowPath("u1", k0[15], "mo-flow mo-flow--coarse");
  const bmSeams = [after(k0[13], "mo-seams"), after(k0[19], "mo-seams")];
  const bmWin = [after(bmSeams[0], "mo-win"), after(bmSeams[1], "mo-win")];
  const pumpSpin = [after(k17[3], "mo-spin"), after(k0[7], "mo-spin")];
  const sagWin = after(k1[33], "mo-win");
  const deckL = after(k1[19], "mo-rocks");                              // partículas sobre la cubierta del harnero
  const rockDeck = pool(deckL, 26, "mo-rock");
  const pebG = el("g", { class: "mo-peb", "data-eq": "harnero" }); k1[14].before(pebG);
  { const n = [-1.9, -3.3], a = PEB.a, b = PEB.b;
    el("path", { class: "mo-belt", d: D([add(a, n), add(b, n), sub(b, n), sub(a, n)]) }, pebG);
    el("path", { class: "mo-belt", d: D([sub(a, n), sub(b, n), add(sub(b, n), [0, 2]), add(sub(a, n), [0, 2])]) }, pebG); }
  const pebL = el("g", { class: "mo-rocks" }); pebG.after(pebL);
  const rockPeb = pool(pebL, 10, "mo-rock mo-rock--peb");
  const vibG = [k1[19], k1[34]];                                        // la caja del harnero vibra

  // rebalses (agregados) → flotación, delante del dibujo
  const topG = el("g", { class: "mo-top" }, svg);
  const ofG = el("g", { class: "mo-of", "data-eq": "hidrociclones" }, topG);
  for (const k of ["of1", "of2"]) { el("path", { d: PL[k].d, class: "mo-pipe-o" }, ofG); el("path", { d: PL[k].d, class: "mo-pipe-w" }, ofG); flow[k] = el("path", { d: PL[k].d, class: "mo-flow mo-flow--fine" }, ofG); }
  const ofTag = el("g", { class: "mo-oftag" }, topG);
  for (const k of ["of1", "of2"]) { const p = PL[k].at(PL[k].len); el("text", { x: f1(p[0] + 2), y: f1(p[1] + 7), class: "mo-small" }, ofTag).textContent = "→ flotación"; }
  { const p = PEBP.at(PEBP.len); el("text", { x: f1(p[0] + 3), y: f1(p[1] - 3), class: "mo-small" }, ofTag).textContent = "pebbles → chancado"; }

  // partícula que se sigue
  const tourG = el("g", { class: "mo-tour" }, svg);
  const tourRing = el("circle", { r: 4.2, class: "mo-tour-ring" }, tourG);
  const tourDot = el("circle", { r: 1.6, class: "mo-tour-dot" }, tourG);
  const tourPulse = el("circle", { r: 7, class: "mo-tour-pulse" }, svg);

  // detalle ampliado (una tarjeta, arriba a la derecha)
  const CARD = { box: [540, 104, 172, 114] };
  const calG = el("g", { class: "mo-callout" }, svg);
  CARD.lead = el("path", { class: "mo-lead" }, calG);
  CARD.dot = el("circle", { r: 2, class: "mo-lead-dot" }, calG);
  { const [x, y, w, h] = CARD.box; el("rect", { x, y, width: w, height: h, rx: 7, class: "mo-card" }, calG);
    const clip = el("clipPath", { id: "mo-cal" }, defs); el("rect", { x: x + 0.6, y: y + 13, width: w - 1.2, height: h - 13.6, rx: 6 }, clip);
    CARD.body = el("g", { "clip-path": "url(#mo-cal)" }, calG);
    CARD.title = el("text", { x: x + 8, y: y + 9.5, class: "mo-cal-title" }, calG);
    CARD.labels = el("g", { class: "mo-cal-labels" }, calG); }

  // etiquetas de foco
  const tagsG = el("g", { class: "mo-tags" }, svg);
  const TAGS = { sag: ["Molino SAG", [372, 118]], harnero: ["Harnero", [412, 200]], bolas: ["Molinos de bolas", [470, 300]], bombas: ["Bombas", [570, 396]], hidrociclones: ["Hidrociclones", [549, 294]] };
  const tagEls = {};
  for (const [id, [label, p]] of Object.entries(TAGS)) {
    const g = el("g", { class: "mo-tag", transform: `translate(${p[0]} ${p[1]})` }, tagsG);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -12, class: "mo-tag-line" }, g);
    const ww = label.length * 3.6 + 12;
    el("rect", { x: -ww / 2, y: -23, width: ww, height: 11, rx: 5.5, class: "mo-tag-pill" }, g);
    el("text", { x: 0, y: -15.6, class: "mo-tag-text", "text-anchor": "middle" }, g).textContent = label;
    tagEls[id] = g;
  }

  // unidades para el foco
  const units = new Map();
  const classify = (n, inh) => {
    if (n.classList?.contains("mo-rocks") || ["defs", "style", "clipPath"].includes(n.tagName)) return;
    const eq = n.dataset?.eq || inh;
    if (n.querySelector?.("[data-eq]")) [...n.children].forEach((c) => classify(c, eq)); else units.set(n, eq || "");
  };
  [feedG, art, topG].forEach((n) => classify(n, ""));

  // ------------------------------------------------------------ estado
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const S = { t: 0, rotS: 0, rotB: 0, flow: 0, feed: F_NOM, sag: 0, bm: 0, detail: null };
  const shown = { sag: 0, bm: 0 };
  let selected = null, playing = !still.matches, active = false, raf = 0, last = 0, sliderDetail = null;
  if (still.matches) S.t = STEPS[3].t0 + 1;
  const vis = new Map();
  const visible = (id, p) => { if (!vis.has(id)) { vis.set(id, hash(id * 1.37) < p); if (vis.size > 600) vis.delete(vis.keys().next().value); } return vis.get(id); };

  function step(dt) { S.rotS += OMEGA_SAG * dt; S.rotB += OMEGA_BM * dt; S.flow += dt; S.t = (S.t + dt) % PERIOD; }
  const tourAt = (t) => { for (let i = 0; i < TOUR.T.length; i++) { const s = TOUR.T[i]; if (t >= s.t0 && t < s.t1) return { i, s, u: (t - s.t0) / s.dur }; } const i = TOUR.T.length - 1; return { i, s: TOUR.T[i], u: 1 }; };
  const live = () => ({ t: S.t, flow: S.flow, rotS: S.rotS, rotB: S.rotB, feed: S.feed, m: model(S.feed), step: stepAt(S.t), tour: tourAt(S.t), sag: shown.sag, bm: shown.bm });
  const detailNow = () => selected || sliderDetail;

  function draw() {
    const s = live(), m = s.m, fl = S.flow, load = (S.feed - F_MIN) / (F_MAX - F_MIN);
    // correa de alimentación: carga según la alimentación
    { const sp = 4.2, base = (fl * 14) % sp, id0 = Math.floor((fl * 14) / sp); let i = 0;
      for (let j = 0; j < 30 && i < rockFeed.length; j++) { const p = base + j * sp, id = id0 - j; if (p > FEEDP.len + 9) continue; if (!visible(id, 0.45 + 0.5 * load)) continue;
        if (p < FEEDP.len) { const q = FEEDP.at(p); put(rockFeed[i++], [q[0] + (hash(id) - 0.5) * 2, q[1] - 2], 0.8 + hash(id * 3) * 0.5, id * 47); }
        else { const u = (p - FEEDP.len) / 9; put(rockFeed[i++], [FEED.b[0] + 1, FEED.b[1] - 2 + 10 * u * u], 0.9, id * 47 + u * 90, 1 - smooth((u - 0.5) / 0.5)); } }
      for (; i < rockFeed.length; i++) put(rockFeed[i], null); }
    // SAG: pernos que corren y ventana
    dashed.forEach((n) => n && (n.style.strokeDashoffset = f1((-S.rotS * 26) % 15.5)));
    sagWin.innerHTML = shown.sag > 0.005 ? drumWindowSvg(SAG, "mo-sw", shown.sag, { rot: S.rotS, flow: fl }, { a0: 5, a1: 33, J: m.J / 100, lift: 16, nb: 34, roll: 0.25, nc: 18, cat: 0.7, br: 1.15, rk: 1.05, rocks: true }) : "";
    // molinos de bolas: costuras que corren y ventanas
    BM.forEach((M, i) => {
      bmSeams[i].innerHTML = seamsSvg(M, S.rotB, 1.5, M.L * 0.5 - 1.5) + seamsSvg(M, S.rotB, M.L * 0.5 + 1.5, M.L - 1);
      bmWin[i].innerHTML = shown.bm > 0.005 ? drumWindowSvg(M, `mo-bw${i}`, shown.bm, { rot: S.rotB, flow: fl }, { a0: 3, a1: M.L * 0.5 - 2.5, J: 0.35, lift: 14, nb: 40, roll: 0.35, nc: 16, cat: 0.9, br: 0.55, rk: 0.5, rocks: false }) : "";
    });
    // bombas: rotación del impulsor (marca que gira)
    pumpSpin.forEach((g, i) => { const c = PUMP[i]; let o = ""; for (let k = 0; k < 3; k++) { const th = fl * 9 + (k / 3) * Math.PI * 2; o += `<path class="mo-spinl" d="M${f1(c[0])} ${f1(c[1])}l${f1(Math.cos(th) * 3.4)} ${f1(Math.sin(th) * 3.4 * 0.85)}"/>`; } g.innerHTML = o; });
    // flujos por los tubos (velocidad según la alimentación)
    const v = 9 + 6 * load;
    for (const [k, p] of Object.entries(flow)) p.style.strokeDashoffset = f1((-fl * v * (k.startsWith("u") ? 0.6 : k.startsWith("of") ? 0.8 : 1)) % 7);
    // harnero: vibración + partículas (gruesas avanzan, finas caen)
    const vb = [Math.cos(fl * 42) * 0.32, Math.sin(fl * 42) * 0.32];
    vibG.forEach((n) => n.setAttribute("transform", `translate(${f1(vb[0])} ${f1(vb[1])})`));
    { let i = 0;
      for (let j = 0; j < rockDeck.length; j++) {
        const coarse = hash(j * 2.9) < 0.35, ph = (fl * (coarse ? 0.45 : 0.8) + hash(j * 7.3)) % 1, v0 = 0.25 + hash(j * 4.1) * 0.55;
        if (!visible(9000 + j + Math.floor(fl * (coarse ? 0.45 : 0.8) + hash(j * 7.3)) * 31, 0.5 + 0.45 * load)) { put(rockDeck[i++], null); continue; }
        if (coarse) { const u = 0.15 + ph * 0.85, q = deckP(u, v0); put(rockDeck[i++], [q[0] + vb[0], q[1] - 1.4 + vb[1] - Math.abs(Math.sin(fl * 17 + j)) * 0.8], 1.05, j * 40 + ph * 400, 1 - smooth((ph - 0.9) / 0.1)); }
        else { const u = 0.15 + hash(j * 5.3) * 0.55, q = deckP(u, v0); put(rockDeck[i++], [q[0] + vb[0], q[1] - 1 + vb[1] + ph * 2.2], 0.45, j * 30, 1 - smooth((ph - 0.5) / 0.5)); }
      }
      for (; i < rockDeck.length; i++) put(rockDeck[i], null); }
    // correa de pebbles
    { const sp = 7, base = (fl * 11) % sp, id0 = Math.floor((fl * 11) / sp); let i = 0;
      for (let j = 0; j < 12 && i < rockPeb.length; j++) { const p = base + j * sp, id = id0 - j; if (p > PEBP.len) continue; if (!visible(id + 5000, 0.4 + 0.5 * load)) continue;
        const q = PEBP.at(p); put(rockPeb[i++], [q[0], q[1] - 1.8], 1.0 + hash(id) * 0.4, id * 61, smooth(p / 4) * (1 - smooth((p - PEBP.len + 7) / 7))); }
      for (; i < rockPeb.length; i++) put(rockPeb[i], null); }

    // detalle
    const det = detailNow();
    const showC = det ? 1 : 0;
    calG.style.display = showC ? "" : "none";
    if (det) {
      const [bx, by, bw, bh] = CARD.box; let r, L = "", title = "", at = [0, 0];
      const sc = { rot: det === "bolas" ? S.rotB : S.rotS, flow: fl };
      if (det === "sag") { title = "Detalle · Molino SAG por dentro"; at = SAG.C.map((c, k) => c + SAG.A[k] * 18);
        r = millSectionSvg(CARD.box, sc, { J: m.J / 100, n: 120, ball: 1.7, rock: 1.9, rockEvery: 2, lift: 18, nc: 26, cat: 0.55, trajectory: true });
        L = label(r.pts.lift, [bx + 7, by + 24], "Levantadores", "start") + label(r.pts.cat, [bx + bw - 7, by + 24], "Catarata: impacto", "end") + label(r.pts.shoulder, [bx + bw - 7, by + 52], "Hombro", "end") +
          label(r.pts.toe, [bx + 7, by + bh - 24], "Pie de la carga", "start") + label(r.pts.charge, [bx + bw - 7, by + bh - 8], `Bolas + mineral · ${Math.round(m.J)} %`, "end"); }
      else if (det === "bolas") { title = "Detalle · Molino de bolas por dentro"; at = BM[1].C.map((c, k) => c + BM[1].A[k] * 14);
        r = millSectionSvg(CARD.box, sc, { J: 0.36, n: 230, ball: 1.15, rock: 0.7, rockEvery: 9, lift: 14, nc: 22, cat: 0.8, trajectory: false });
        L = label(r.pts.lift, [bx + 7, by + 24], "Revestimiento y levantadores", "start") + label(r.pts.shoulder, [bx + bw - 7, by + 40], "Cascada: abrasión", "end") +
          label(r.pts.charge, [bx + bw - 7, by + bh - 8], "Bolas de acero + pulpa", "end") + label(r.pts.toe, [bx + 7, by + bh - 24], `Carga circulante ${Math.round(m.CL)} %`, "start"); }
      else if (det === "harnero") { title = "Detalle · Harnero"; at = deckP(0.5, 0.5);
        r = screenSvg(CARD.box, { flow: fl }, m);
        L = label(r.pts.feed, [bx + 7, by + 24], "Descarga del SAG (trómel)", "start") + label(r.pts.spray, [bx + bw * 0.5, by + 24], "Agua", "start") + label(r.pts.deck, [bx + bw - 7, by + 40], "Malla vibratoria", "end") +
          label(r.pts.peb, [bx + bw - 7, by + bh - 46], "Pebbles → chancado", "end") + label(r.pts.pan, [bx + 7, by + bh - 7], "Pulpa fina → chute → cajón", "start"); }
      else if (det === "bombas") { title = "Detalle · Bomba de pulpa"; at = PUMP[1];
        r = pumpSvg(CARD.box, { flow: fl });
        L = label(r.pts.out, [bx + bw - 7, by + 24], "Descarga → hidrociclones", "end") + label(r.pts.imp, [bx + bw - 7, by + bh - 24], "Impulsor", "end") +
          label(r.pts.vol, [bx + 7, by + 34], "Voluta", "start") + label(r.pts.eye, [bx + 7, by + bh - 8], "Succión desde el cajón", "start"); }
      else if (det === "hidrociclones") { title = "Detalle · Hidrociclón en corte"; at = CYC[0];
        r = cycloneSvg(CARD.box, { flow: fl }, m);
        L = label(r.pts.over, [bx + 7, by + 24], `Rebalse: finos P80 ${Math.round(m.P80)} µm → flotación`, "start") + label(r.pts.inlet, [bx + bw - 7, by + 40], "Alimentación a presión", "end") +
          label(r.pts.wall, [bx + bw - 7, by + 70], "Gruesos por la pared", "end") + label(r.pts.core, [bx + 7, by + 62], "Finos al centro", "start") + label(r.pts.under, [bx + 7, by + bh - 8], "Descarga: gruesos → molino de bolas", "start"); }
      CARD.title.textContent = title; CARD.body.innerHTML = r ? r.svg : ""; CARD.labels.innerHTML = L;
      CARD.dot.setAttribute("cx", f1(at[0])); CARD.dot.setAttribute("cy", f1(at[1]));
      const e = [bx, by + bh * 0.6];
      CARD.lead.setAttribute("d", `M${f1(e[0])} ${f1(e[1])}C${f1(e[0] - 40)} ${f1(e[1])} ${f1(at[0] + 10)} ${f1(at[1] - 40)} ${f1(at[0])} ${f1(at[1])}`);
    }

    drawTour(s);
    for (const id of ORDER) tagEls[id].toggleAttribute("data-on", selected === id);
    listeners.forEach((fn) => fn(s, api));
  }
  function drawTour(s) {
    const { s: sg, u } = s.tour; let tp = null, inside = null, fine = !!sg.fine;
    switch (sg.kind) {
      case "belt": tp = FEEDP.at(u * FEEDP.len); break;
      case "drop": tp = [FEED.b[0] + 1, FEED.b[1] - 2 + 10 * u * u]; break;
      case "sag": inside = shown.sag > 0.3 ? null : drumP(SAG, lerp(4, SAG.L - 3, u), Math.PI * 1.3, SAG.Rs * 0.5); if (shown.sag > 0.3) tp = drumP(SAG, lerp(6, 32, u), Math.PI * 1.2 + Math.sin(u * 20) * 0.4, SAG.Rs * 0.8); break;
      case "trommel": inside = [420, 196]; break;
      case "fall": tp = [425, lerp(207, deckP(0.35, 0.5)[1] - 1, u * u)]; break;
      case "deck": { const q = deckP(lerp(0.35, 0.6, u), 0.5); tp = [q[0], q[1] - 1 + (u > 0.6 ? (u - 0.6) * 8 : 0)]; break; }
      case "chute": inside = [lerp(CHUTE.top[0], CHUTE.bot[0], u), lerp(CHUTE.top[1], CHUTE.bot[1], u)]; break;
      case "cajon": inside = CAJON; break;
      case "pipe": tp = PL[sg.p].at(u * PL[sg.p].len); break;
      case "pump": inside = PUMP[sg.i]; break;
      case "cyc": inside = CYC[sg.i]; break;
      case "mill": { const M = BM[sg.i]; if (shown.bm > 0.3) tp = drumP(M, lerp(M.L * 0.5 - 4, 4, u), Math.PI * 1.25 + Math.sin(u * 18) * 0.3, M.Rs * 0.75); else inside = drumP(M, lerp(M.L - 4, 4, u), Math.PI * 1.3, M.Rs * 0.4); break; }
      case "rest": inside = PL.of1.at(PL.of1.len); break;
    }
    if (tp) {
      tourRing.setAttribute("cx", f1(tp[0])); tourRing.setAttribute("cy", f1(tp[1] - 1)); tourRing.style.opacity = 1;
      tourDot.setAttribute("cx", f1(tp[0])); tourDot.setAttribute("cy", f1(tp[1] - 1)); tourDot.setAttribute("r", fine ? 0.9 : 1.6); tourDot.style.opacity = 1;
    } else { tourRing.style.opacity = 0; tourDot.style.opacity = 0; }
    if (inside) { const ph = (performance.now() / 900) % 1; tourPulse.setAttribute("cx", f1(inside[0])); tourPulse.setAttribute("cy", f1(inside[1])); tourPulse.setAttribute("r", f1(3.5 + ph * 8)); tourPulse.style.opacity = (0.9 * (1 - ph)).toFixed(2); }
    else tourPulse.style.opacity = 0;
  }
  function label(p, q, text, anchor) {
    return `<path class="mo-cal-lead" d="M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1] + 2)}"/><circle class="mo-cal-dot" cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.2"/><text class="mo-cal-text" x="${f1(q[0])}" y="${f1(q[1])}" text-anchor="${anchor}">${text}</text>`;
  }

  // ------------------------------------------------------------ reloj
  const listeners = new Set();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) step(dt);
    const k = 1 - Math.exp(-dt * 6);
    for (const key of ["sag", "bm"]) { shown[key] += (S[key] - shown[key]) * k; if (Math.abs(S[key] - shown[key]) < 0.002) shown[key] = S[key]; }
    draw();
    raf = active ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; }, get playing() { return playing; }, get detail() { return detailNow(); },
    get sag() { return S.sag; }, get bm() { return S.bm; }, get feed() { return S.feed; },
    live, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) kick(); else { cancelAnimationFrame(raf); raf = 0; } },
    play() { playing = true; kick(); }, pause() { playing = false; }, togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { S.t = ((v % PERIOD) + PERIOD) % PERIOD; draw(); },
    goStep(n) { api.seek(STEPS[clamp(n, 1, STEPS.length) - 1].t0 + 0.01); },
    nextStep() { api.goStep((stepAt(S.t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(S.t); api.goStep(S.t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    setSag(v, instant) { S.sag = clamp(v); if (instant || still.matches) shown.sag = S.sag; sliderDetail = S.sag > 0 ? "sag" : S.bm > 0 ? "bolas" : null; draw(); },
    setBm(v, instant) { S.bm = clamp(v); if (instant || still.matches) shown.bm = S.bm; sliderDetail = S.bm > 0 ? "bolas" : S.sag > 0 ? "sag" : null; draw(); },
    setFeed(v) { S.feed = clamp(v, F_MIN, F_MAX); draw(); },
    select(id) {
      selected = id && EQUIP[id] ? id : null;
      root.toggleAttribute("data-sel", !!selected);
      units.forEach((eq, u) => u.classList.toggle("mo-dim", !!selected && eq !== selected));
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
export function bindPanel(mo, { onEscape, onFocus } = {}) {
  const $ = (q) => document.querySelector(q);
  const playBtn = $("[data-mo-play]"), stepsBox = $("[data-mo-steps]");
  stepsBox.innerHTML = ""; stepsBox.style.setProperty("--n", mo.STEPS.length);
  const stepBtns = mo.STEPS.map((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n; b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`); b.innerHTML = "<i></i>";
    b.addEventListener("click", () => mo.goStep(s.n)); stepsBox.appendChild(b); return b;
  });
  const info = $("[data-info]"), meter = $("[data-mo-meter]"), readout = $("[data-mo-readout]");
  const sagS = $("[data-mo-sag]"), sagO = $("[data-mo-sag-out]"), bmS = $("[data-mo-bm]"), bmO = $("[data-mo-bm-out]"), feedS = $("[data-mo-feed]"), feedO = $("[data-mo-feed-out]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = [];
  const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };
  function renderInfo(s) {
    const id = mo.selected;
    document.querySelectorAll("[data-mo-chip]").forEach((c) => c.toggleAttribute("data-on", c.dataset.moChip === id));
    if (!id) { if (info.dataset.owner === "mo") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs(s.m), sig = id + specs.join("|");
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig; info.dataset.owner = "mo";
    $("[data-info-kicker]").textContent = e.kicker; $("[data-info-title]").textContent = e.title; $("[data-info-text]").textContent = e.text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join(""); $("[data-info-actions]").innerHTML = "";
    info.hidden = false;
  }
  off.push(mo.on((s) => {
    const st = s.step;
    if (st.n !== lastStep) {
      $("[data-mo-step-n]").textContent = st.n; $("[data-mo-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const k = Number(b.dataset.step); b.toggleAttribute("data-done", k < st.n); b.toggleAttribute("data-current", k === st.n); });
      lastStep = st.n;
    }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", (s.m.J / 40).toFixed(3));
    const text = `${fmt(s.m.F)} t/h · SAG ${Math.round(s.m.J)} % · CC ${Math.round(s.m.CL)} % · P80 ${Math.round(s.m.P80)} µm`;
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(mo.playing));
    playBtn.setAttribute("aria-label", mo.playing ? "Pausar" : "Reproducir");
    renderInfo(s);
  }));
  const sync = () => { sagS.value = Math.round(mo.sag * 100); sagO.textContent = `${sagS.value} %`; bmS.value = Math.round(mo.bm * 100); bmO.textContent = `${bmS.value} %`; feedS.value = mo.feed; feedO.textContent = `${fmt(mo.feed)} t/h`; };
  on(sagS, "input", () => { mo.setSag(sagS.value / 100); sagO.textContent = `${sagS.value} %`; onFocus?.("sag", sagS.value > 0 || mo.bm > 0); });
  on(bmS, "input", () => { mo.setBm(bmS.value / 100); bmO.textContent = `${bmS.value} %`; onFocus?.("bolas", bmS.value > 0 || mo.sag > 0); });
  on(feedS, "input", () => { mo.setFeed(Number(feedS.value)); feedO.textContent = `${fmt(Number(feedS.value))} t/h`; });
  on(playBtn, "click", () => mo.togglePlay());
  on($("[data-mo-prev]"), "click", () => mo.prevStep());
  on($("[data-mo-next]"), "click", () => mo.nextStep());
  document.querySelectorAll("[data-mo-chip]").forEach((c) => on(c, "click", () => mo.select(mo.selected === c.dataset.moChip ? null : c.dataset.moChip)));
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "mo") mo.select(null); });
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "molienda" || e.target.closest?.("input, [data-intro]")) return;
    if (e.key === " " && !e.target.closest("button")) mo.togglePlay();
    else if (e.key === ",") mo.prevStep();
    else if (e.key === ".") mo.nextStep();
    else if (/^[1-5]$/.test(e.key)) { const id = ORDER[Number(e.key) - 1]; mo.select(mo.selected === id ? null : id); }
    else if (e.key === "ArrowRight") { mo.setSag(mo.sag + 0.1); sync(); onFocus?.("sag", mo.sag > 0); }
    else if (e.key === "ArrowLeft") { mo.setSag(mo.sag - 0.1); sync(); onFocus?.("sag", mo.sag > 0); }
    else if (e.key === "ArrowUp") { mo.setBm(mo.bm + 0.1); sync(); onFocus?.("bolas", mo.bm > 0); }
    else if (e.key === "ArrowDown") { mo.setBm(mo.bm - 0.1); sync(); onFocus?.("bolas", mo.bm > 0); }
    else if (e.key === "Escape") { if (mo.selected) mo.select(null); else onEscape?.(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  sync(); mo.seek(mo.live().t);
  return () => { off.forEach((fn) => fn()); if (info.dataset.owner === "mo") { info.hidden = true; delete info.dataset.owner; } };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
const toPoster = ([x, y, w, h]) => [x * REG.s + REG.tx, y * REG.s + REG.ty, w * REG.s, h * REG.s];
const ZOOM = { sag: [320, 98, 400, 190], harnero: [370, 98, 350, 240], bolas: [390, 98, 330, 320], bombas: [520, 98, 200, 380], hidrociclones: [505, 98, 215, 260] }; // alto extra abajo: la ficha tapa esa zona
export async function mount({ layer, focus }) {
  const mo = await createMolienda();
  layer.appendChild(mo.el);
  requestAnimationFrame(() => mo.el.setAttribute("data-in", ""));
  let focused = null;
  const want = (z, cap) => { const k = z ? JSON.stringify(z) : ""; if (k !== focused) { focused = k; focus?.(z ? toPoster(z) : null, cap); } };
  const unbind = bindPanel(mo, { onEscape: () => { location.hash = ""; }, onFocus: (which, on) => want(on ? ZOOM[which] : null, 3.5) });
  const unzoom = mo.on(() => { if (mo.selected) want(ZOOM[mo.selected], 3.2); else if (mo.detail) want(ZOOM[mo.detail], 3.5); else want(null); });
  mo.setActive(true);
  window.pmMol = mo;
  return {
    focus: toPoster([VIEW[0] + 40, VIEW[1] + 20, VIEW[2] - 50, VIEW[3] - 40]),
    view: "molienda",
    destroy: () => { unzoom(); unbind(); mo.destroy(); if (window.pmMol === mo) delete window.pmMol; },
  };
}
