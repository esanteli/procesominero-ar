// Estación 3 · rutas del concentrado desde el espesador: asignación de los edificios de zona.svg (por validar, ver
// README), geometría en isometría y sus interiores 3D. Todo en px de la infografía (las unidades de la lámina).
//
//   Ruta A: descarga del espesador → estanque agitado → bombas de pistón (casa de bombas) → concentraducto → Puerto.
//   Ruta B: descarga → estanque agitado → filtro prensa (galpón largo) → queque → pila de acopio → camión → Fundición;
//           el filtrado vuelve al espesador de concentrado.
//
// Isometría del dibujo: (0,866 ; 0,5) hacia abajo a la derecha y (0,866 ; −0,5) hacia arriba a la derecha. Cada edificio
// usa coordenadas de mundo W(e, n, z) desde su esquina inferior de adelante: e ∈ [−largo, 0], n ∈ [0, ancho].
import { filterPressSvg, pressPhase, PRESS_CYCLE } from "./filtro-prensa.js";

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const f2 = (n) => (Math.round(n * 100) / 100).toString();
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mod = (a, b) => ((a % b) + b) % b;
const D = (pts, close = true) => "M" + pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join("L") + (close ? "Z" : "");
const poly = (pts, cls, extra = "") => `<path class="${cls}" d="${D(pts)}"${extra}/>`;
const line = (pts, cls, extra = "") => `<path class="${cls}" d="${D(pts, false)}"${extra}/>`;
const circ = (p, r, cls, o) => `<circle class="${cls}" cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(r)}"${o != null ? ` style="opacity:${f2(clamp(o))}"` : ""}/>`;
const world = (F) => (e, n, z = 0) => [F[0] + 0.866 * (e + n), F[1] + 0.5 * (e - n) - z];
function box(W, e0, e1, n0, n1, z0, z1, cls) {
  return poly([W(e0, n0, z0), W(e1, n0, z0), W(e1, n0, z1), W(e0, n0, z1)], `${cls} ${cls}--side`)
    + poly([W(e1, n0, z0), W(e1, n1, z0), W(e1, n1, z1), W(e1, n0, z1)], `${cls} ${cls}--front`)
    + poly([W(e0, n0, z1), W(e1, n0, z1), W(e1, n1, z1), W(e0, n1, z1)], `${cls} ${cls}--top`);
}

// ---------------------------------------------------------------- edificios (vértices de zona.svg)
export const SHED = { F: [2848.8, 908], e: -95, n: 63, H: 35, ridge: 11 };       // galpón largo: filtros y acopio
export const PUMPH = { F: [3085.5, 842], e: -33, n: 47, H: 46, ridge: 7 };       // edificio cúbico: casa de bombas
export const Ws = world(SHED.F), Wp = world(PUMPH.F);
// piezas de zona.svg (rutas dentro de su grupo raíz [0,0,0]): índice del edificio y qué hijos son techo o muro
export const ZONA_SHED = { g: [17], roof: [2, 3, 4, 5], wall: [0, 1, 6] };
export const ZONA_PUMPH = { parts: [3, 4, 5, 6, 7, 8, 9], roof: [5, 6, 7, 8], wall: [3, 4, 9] };
// estanques agitados de concentrado (centro de la tapa, radio y alto, medidos en el dibujo)
export const TANKS = [{ c: [2910.8, 754.8], r: 16.2, h: 37.7 }, { c: [2958.1, 783], r: 16.2, h: 37.7 }];
export const ROOF_LIFT = 34;                                                    // el mismo recurso que las naves del puerto
// región visible de los muros bajo la altura de corte (caras −n y +e)
export const cutPoly = (W, b, z0, z1) => [W(b.e - 1, -1, z1), W(1, -1, z1), W(1, b.n + 1, z1), W(1, b.n + 1, z0), W(1, -1, z0), W(b.e - 1, -1, z0)];

// ---------------------------------------------------------------- cañerías (sobre soportes)
const onLine = (y0, x0) => (x) => [x, y0 + (x - x0) * 0.57735];                  // recta isométrica hacia abajo a la derecha
const under = onLine(794.3, 2977.7), suction = onLine(770, 2977.7), back = onLine(714, 2990.5), ret = onLine(784.3, 2977.7);
export const PIPES = {
  under: [under(3128), under(2977.7)],                                           // descarga del espesador → estanque
  toPumps: [suction(2976), suction(3062)],                                       // estanque → casa de bombas
  duct: [back(3092), back(2997)],                                                // concentraducto → (Puerto)
  toFilter: [[2938, 817], [2869, 856.8]],                                        // estanque → filtro prensa
  filtrate: [[2862, 838], [2967.4, 777.2], ret(3122)],                           // filtrado → espesador
};
export const ROUTE_OF = { under: "AB", toPumps: "A", duct: "A", toFilter: "B", filtrate: "B" };
// soportes: [x, y de la cañería, largo hasta el suelo]
const SUPPORTS = {
  under: [[3040, under(3040)[1], 20], [3005, under(3005)[1], 20]],
  filtrate: [[2896, 818.4, 28], [2930, 798.8, 24], [3030, ret(3030)[1], 28]],
  toFilter: [[2920, 827.4, 18], [2890, 844.7, 14]],
};
export const supportsSvg = (k) => (SUPPORTS[k] || []).map(([x, y, h]) => `<path class="fl-sup" d="M${f2(x)} ${f2(y)}v${f2(h)}M${f2(x - 3)} ${f2(y + h)}h6"/>`).join("");
// base blanca bajo las dos cañerías que cruzan el hueco entre el galpón y la plataforma (única parte fuera de zona.svg)
export const BRIDGE = D([[2858, 833], [2927, 793], [2951, 807], [2949, 830], [2924, 852], [2884, 876], [2866, 866], [2856, 848]]);

export function polyline(pts) {
  const S = [0]; for (let i = 1; i < pts.length; i++) S.push(S[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = S[S.length - 1];
  const at = (s) => { s = clamp(s, 0, len); let i = 1; while (i < S.length - 1 && S[i] < s) i++; const u = (s - S[i - 1]) / (S[i] - S[i - 1] || 1); return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]; };
  return { len, at, d: D(pts, false) };
}

// color de la pulpa según el % de sólidos (más espesa, más oscura)
export function pulpColor(uf) {
  const k = clamp((uf - 45) / 27), a = [150, 170, 160], b = [58, 70, 62];
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(",")})`;
}

// ---------------------------------------------------------------- interiores
// piso y muros del fondo (como las naves del puerto)
export function hallSvg(W, b) {
  const H = Math.min(b.H, 26);
  let g = poly([W(b.e, 0), W(0, 0), W(0, b.n), W(b.e, b.n)], "fl-floor");
  g += poly([W(b.e, 0, 0), W(b.e, b.n, 0), W(b.e, b.n, H), W(b.e, 0, H)], "fl-wall-in");
  g += poly([W(b.e, b.n, 0), W(0, b.n, 0), W(0, b.n, H), W(b.e, b.n, H)], "fl-wall-in fl-wall-in--end");
  for (let e = b.e + 12; e < 0; e += 12) g += line([W(e, b.n, 0), W(e, b.n, H)], "fl-pilaster");
  return g + line([W(b.e, 0, H), W(b.e, b.n, H), W(0, b.n, H)], "fl-cutline");
}

// filtro prensa en altura, pila de queque debajo y camión; `s` = estado del dibujo
export const PRESS = { e: -34, n0: 6, n1: 56, z0: 15, z1: 27, we: 9, N: 12 };
const PILE = { e0: -43, e1: -25, n0: 10, n1: 52 };
const TRUCK = { n: 22, e0: -62, e1: -86 };                                      // de dónde carga a dónde sale
export function pileTop(level) { return 2 + 8 * clamp(level); }
export function shedSvg(s) {
  const { pr, fl, uf, pile, truck } = s;
  let g = "";
  // pila de acopio bajo el filtro (cumbrera a lo largo de n)
  const h = pileTop(pile), em = (PILE.e0 + PILE.e1) / 2, w = (PILE.e1 - PILE.e0) / 2 * lerp(0.6, 1, clamp(pile));
  const base = (n, side) => Ws(em + side * w, n, 0.3), ridge = (n) => Ws(em, n, h);
  const heap = poly([base(PILE.n0, 1), base(PILE.n1, 1), ridge(PILE.n1 - 7), ridge(PILE.n0 + 7)], "fl-cake")
    + poly([base(PILE.n0, -1), base(PILE.n0, 1), ridge(PILE.n0 + 7)], "fl-cake fl-cake--side");
  g += filterPressSvg({ W: Ws, P: PRESS, pr, fl, cls: "fx", fill: pulpColor(lerp(uf, 72, 0.5)), cakeZ: h + 0.5, dripZ: h + 1, under: heap });
  // camión: tolva con la carga y cabina, sale hacia el extremo del galpón
  const e = lerp(TRUCK.e0, TRUCK.e1, smooth(truck.go)), n = TRUCK.n, o = 1 - smooth((truck.go - 0.82) / 0.18);
  let t = "";
  t += [[e + 5, n - 3], [e - 6, n - 3]].map(([we, wn]) => circ(Ws(we, wn, 2.2), 2.2, "fl-wheel")).join("");
  t += box(Ws, e - 8, e + 3, n - 4, n + 4, 3, 8, "fl-truck");
  if (truck.load > 0.02) { const z = 8 + 3.5 * truck.load; t += poly([Ws(e - 7, n - 3, 8), Ws(e + 2, n - 3, 8), Ws(e - 1, n, z), Ws(e - 4, n, z)], "fl-cake") + poly([Ws(e + 2, n - 3, 8), Ws(e + 2, n + 3, 8), Ws(e - 1, n, z)], "fl-cake fl-cake--side"); }
  t += box(Ws, e - 13, e - 8.5, n - 3.5, n + 3.5, 3, 11, "fl-truck-cab");
  t += circ(Ws(e - 11, n - 3.6, 2.2), 2.2, "fl-wheel");
  return g + `<g style="opacity:${f2(o)}">${t}</g>`;
}

// casa de bombas: dos bombas de pistón (el émbolo va y viene), colector de succión y de impulsión
export function pumpHouseSvg(s) {
  const { stroke, uf } = s;
  let g = "";
  const col = pulpColor(uf);
  const pipe = (pts) => line(pts, "fl-pipe-o") + line(pts, "fl-pipe-w");
  g += pipe([Wp(-30, 38, 4), Wp(-4, 38, 4)]);                                    // colector de impulsión (al concentraducto)
  for (const [i, e] of [[0, -24], [1, -9]]) {
    const c = Math.sin(stroke + i * Math.PI), ext = 3 + 3 * c;
    g += box(Wp, e - 5, e + 5, 22, 36, 0, 9, "fl-pump");                          // cuerpo hidráulico
    g += box(Wp, e - 2.2, e + 2.2, 16 - ext, 22, 3, 7.4, "fl-piston");            // émbolo que va y viene
    g += box(Wp, e - 4, e + 4, 5, 16 - ext, 1.5, 9, "fl-pumphead");              // cabezal con válvulas
    g += box(Wp, e - 3, e + 3, 28, 33, 9, 14, "fl-pumphead");                     // amortiguador de pulsaciones
    g += circ(Wp(e, 6.5, 11), 1.6, "fl-valve");
  }
  g += pipe([Wp(-30, 5, 3), Wp(-2, 5, 3)]);                                      // colector de succión (desde el estanque)
  for (let j = 0; j < 6; j++) { const ph = mod(s.flow * 0.5 + j / 6, 1); g += circ(Wp(lerp(-2, -30, ph), 5, 3), 1, "fl-slug", 1).replace('class="fl-slug"', `class="fl-slug" fill="${col}"`) + circ(Wp(lerp(-4, -30, ph), 38, 4), 1, "fl-slug").replace('class="fl-slug"', `class="fl-slug" fill="${col}"`); }
  return g;
}

// agitador de un estanque (paletas que giran sobre la tapa, con la pulpa del color de la descarga)
export function agitatorSvg(i, ang, uf, level) {
  const T = TANKS[i], z = [T.c[0], T.c[1] + 4 + 6 * (1 - level)], r = T.r * 0.82;
  const ell = []; for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2; ell.push([z[0] + 1.2247 * r * Math.cos(a), z[1] + 0.7071 * r * Math.sin(a)]); }
  let g = poly(ell, "fl-slurry", ` style="fill:${pulpColor(uf)}"`);
  for (let k = 0; k < 2; k++) { const a = ang + k * Math.PI / 2 + i, dx = 1.2247 * r * 0.7 * Math.cos(a), dy = 0.7071 * r * 0.7 * Math.sin(a); g += line([[z[0] - dx, z[1] - dy], [z[0] + dx, z[1] + dy]], "fl-agit"); }
  return g + circ(z, 1.4, "fl-hubc");
}

// ---------------------------------------------------------------- estado del filtro y del camión
// relación agua/sólidos de la pulpa respecto de 65 % de sólidos: más agua, ciclo más largo
export const cycleFactor = (uf) => clamp(0.6 + 0.4 * (((100 - uf) / uf) / (35 / 65)), 0.7, 2.2);
export { pressPhase, PRESS_CYCLE };
