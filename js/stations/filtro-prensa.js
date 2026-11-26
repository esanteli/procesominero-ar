// Filtro prensa (compartido por Puerto y Flotación): bastidor en altura, placas con telas y queque, y su ciclo
// llenado → prensado → soplado → descarga (placa por placa) → cierre.
//
// Geometría en coordenadas de mundo (e, n, z) de la estación que lo usa, proyectadas con W(e, n, z): las placas se
// apilan a lo largo de n (de n0 a n1), el filtro tiene ancho `we` en e y va de z0 a z1. Se ven las caras +e, −n y la de
// arriba (isometría 0,866 / 0,5 con +e hacia abajo a la derecha y +n hacia arriba a la derecha).
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const mod = (a, b) => ((a % b) + b) % b;
const f2 = (n) => (Math.round(n * 100) / 100).toString();
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const D = (pts) => "M" + pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join("L") + "Z";
const poly = (pts, cls, extra = "") => `<path class="${cls}" d="${D(pts)}"${extra}/>`;
const circ = (p, r, cls, o) => `<circle class="${cls}" cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(r)}"${o != null ? ` style="opacity:${f2(clamp(o))}"` : ""}/>`;

// caja alineada a los ejes: caras −n (side), +e (front) y arriba
function box(W, e0, e1, n0, n1, z0, z1, cls) {
  const top = [W(e0, n0, z1), W(e1, n0, z1), W(e1, n1, z1), W(e0, n1, z1)];
  const front = [W(e1, n0, z0), W(e1, n1, z0), W(e1, n1, z1), W(e1, n0, z1)];
  const side = [W(e0, n0, z0), W(e1, n0, z0), W(e1, n0, z1), W(e0, n0, z1)];
  return poly(side, `${cls} ${cls}--side`) + poly(front, `${cls} ${cls}--front`) + poly(top, `${cls} ${cls}--top`);
}

// ---------------------------------------------------------------- ciclo
export const PRESS_CYCLE = 53 / 4;                       // s en pantalla
/** fase del ciclo en el instante u (se envuelve en PRESS_CYCLE) */
export function pressPhase(u) {
  u = mod(u, PRESS_CYCLE);
  const ph = u < 3.4 ? "llenado" : u < 6 ? "prensado" : u < 8.6 ? "soplado" : u < 12.2 ? "descarga" : "cierre";
  return { u, ph, fill: u < 3.4 ? u / 3.4 : u < 8.6 ? 1 : 0, open: ph === "descarga" ? (u - 8.6) / 3.6 : -1, squeeze: ph === "prensado" ? smooth((u - 3.4) / 1) : ph === "soplado" ? 1 : 0, air: ph === "soplado" };
}

// ---------------------------------------------------------------- dibujo
/**
 * @param {object} o
 * @param {(e:number,n:number,z:number)=>number[]} o.W   proyección de la estación
 * @param {{e:number,n0:number,n1:number,z0:number,z1:number,we:number,N:number}} o.P
 * @param {ReturnType<typeof pressPhase>} o.pr
 * @param {number} o.fl      reloj para goteo y aire
 * @param {string} o.cls     prefijo de clases (…-plate, …-press-leg, …-press-head, …-press-rail, …-cake, …-drip, …-air)
 * @param {string} o.fill    color del contenido de las placas
 * @param {number} o.cakeZ   altura donde cae el queque
 * @param {number} [o.dripZ] altura donde cae el agua filtrada
 * @param {string} [o.under] marcado que va entre las patas y el filtro (correa, pila…)
 */
export function filterPressSvg({ W, P, pr, fl, cls, fill, cakeZ, dripZ = 1, under = "" }) {
  const e0 = P.e - P.we / 2, e1 = P.e + P.we / 2, c = (k) => `${cls}-${k}`;
  let g = "";
  // patas del bastidor
  for (const n of [P.n0 + 2, P.n1 - 2]) g += box(W, e0 - 1, e0 + 1, n - 1, n + 1, 0, P.z0, c("press-leg")) + box(W, e1 - 1, e1 + 1, n - 1, n + 1, 0, P.z0, c("press-leg"));
  g += under;
  // placas (de atrás hacia adelante: mayor n primero); en la descarga cada una se separa un momento
  const gap0 = (P.n1 - P.n0 - 6) / P.N, open = pr.open;
  const nAt = (k) => { let n = P.n0 + 4 + k * gap0 * (1 - 0.15 * pr.squeeze); if (open >= 0) { const d = open * P.N - k; if (d > 0 && d < 1.4) n -= 2.6 * Math.sin((d / 1.4) * Math.PI); } return n; };
  g += railSvg(W, e0 - 0.6, P, c("press-rail"));
  g += box(W, e0 - 1, e1 + 1, P.n1 - 3, P.n1, P.z0 - 1, P.z1 + 1, c("press-head"));
  for (let k = P.N - 1; k >= 0; k--) {
    const n = nAt(k);
    g += poly([W(e0, n, P.z0), W(e1, n, P.z0), W(e1, n, P.z1), W(e0, n, P.z1)], c("plate"));
    g += poly([W(e1, n - 1.6, P.z0), W(e1, n, P.z0), W(e1, n, P.z1), W(e1, n - 1.6, P.z1)], `${c("plate")} ${c("plate")}--edge`);
    if (pr.fill > 0 && pr.ph !== "descarga") g += poly([W(e0 + 1.2, n - 0.05, P.z0 + 1.2), W(e1 - 1.2, n - 0.05, P.z0 + 1.2), W(e1 - 1.2, n - 0.05, lerp(P.z0 + 1.2, P.z1 - 1.2, pr.fill)), W(e0 + 1.2, n - 0.05, lerp(P.z0 + 1.2, P.z1 - 1.2, pr.fill))], c("plate-fill"), ` style="fill:${fill}"`);
  }
  g += box(W, e0 - 1, e1 + 1, P.n0 - 1, P.n0 + 2, P.z0 - 1, P.z1 + 1, c("press-head"));
  // queque que cae de la placa que se separa
  if (open >= 0) { const j = Math.floor(open * P.N), f = open * P.N - j, n = nAt(j) - 1, z = lerp(P.z0, cakeZ, smooth(f)); if (j < P.N) g += poly([W(e0 + 1.4, n, z), W(e1 - 1.4, n, z), W(e1 - 1.4, n, z + 5), W(e0 + 1.4, n, z + 5)], c("cake")); }
  // agua filtrada (goteo) y aire de soplado
  if (pr.ph === "prensado" || pr.ph === "llenado") for (let j = 0; j < 6; j++) { const ph = mod(fl * 1.4 + j / 6, 1), n = lerp(P.n0 + 4, P.n1 - 4, hash(j * 3.3)); g += circ(W(e1 + 0.6, n, lerp(P.z0, dripZ, ph)), 0.45, c("drip"), 1 - ph); }
  if (pr.air) for (let j = 0; j < 5; j++) { const ph = mod(fl * 0.9 + j / 5, 1); g += circ(W(e1 + 1, lerp(P.n0 + 4, P.n1 - 4, hash(j * 7.1)), P.z1 + ph * 7), 0.9 + ph * 1.6, c("air"), (1 - ph) * 0.8); }
  return g;
}

// viga lateral de apoyo de las placas (de n0 a n1, a un costado y bajo el borde superior): sólo las caras visibles
function railSvg(W, e, P, cls) {
  const w = 1.2, h = 1.6, z = P.z1 - 1;
  const e0 = e - w / 2, e1 = e + w / 2, z0 = z - h / 2, z1 = z + h / 2;
  return poly([W(e1, P.n0, z0), W(e1, P.n1, z0), W(e1, P.n1, z1), W(e1, P.n0, z1)], `${cls} ${cls}--s`)
    + poly([W(e0, P.n0, z1), W(e1, P.n0, z1), W(e1, P.n1, z1), W(e0, P.n1, z1)], `${cls} ${cls}--t`)
    + poly([W(e0, P.n0, z0), W(e1, P.n0, z0), W(e1, P.n0, z1), W(e0, P.n0, z1)], `${cls} ${cls}--e`);
}
