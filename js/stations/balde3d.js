// Balde del cargador frontal reconstruido en 3D a partir del dibujo de Emilio (cargador.svg).
// La placa lateral del balde (grupo 112 del SVG) está en un plano vertical del equipo: con la isométrica de la
// infografía se recupera su perfil (X adelante, Z arriba) y se extruye a lo ancho (Y). Así el balde puede girar
// para vaciar sin deformarse, con el mismo trazo del dibujo (relleno blanco, línea naranja).
//
// Coordenadas: perfil relativo al pasador cercano del dibujo (120,5 ; 88), en la placa del lado cercano (Y = 0);
// la placa lejana está en Y = −2w. Pantalla (unidades del SVG): x = 120,5 + 0,866·(X − Y), y = 88 + 0,5·(X + Y) − Z.
export const PROFILE = [[20.83, -28.69], [18.41, -28.77], [16, -28.77], [13.6, -28.77], [11.2, -28.77], [8.8, -28.77], [6.4, -28.77], [4, -28.77], [1.59, -28.77], [-0.73, -28.62], [-2.85, -28.15], [-4.79, -27.4], [-6.56, -26.43], [-8.13, -25.23], [-9.5, -23.83], [-10.61, -22.19], [-11.36, -20.26], [-11.62, -18], [-10.97, -15.35], [-9.11, -12.71], [-6.45, -10.72], [-3.68, -9.2], [-0.92, -7.95], [1.84, -6.85], [3.2, -6.37], [4.41, -6.2], [4.79, -7.17], [5.17, -8.13], [5.94, -10.06], [6.7, -11.99], [7.45, -13.93], [8.21, -15.85], [9.35, -17.43], [10.96, -18.59], [12.56, -19.74], [14.18, -20.89], [15.79, -22.04], [17.4, -23.19], [19.01, -24.34], [20.2, -25.9], [21.27, -27.58]];
const TOP = 25;                 // del labio (0) al borde superior trasero (25) es chapa; de 25 al labio, la boca abierta
export const W2 = 47.1;         // ancho del balde (placa a placa)
export const PIVOT = [0.5, -3]; // eje de giro del balde (pasador), en el perfil
const O = [120.5, 88];

const rot = ([X, Z], a) => { const c = Math.cos(a), s = Math.sin(a), x = X - PIVOT[0], z = Z - PIVOT[1]; return [PIVOT[0] + c * x - s * z, PIVOT[1] + s * x + c * z]; };
const scr = ([X, Z], Y) => [O[0] + 0.866 * (X - Y), O[1] + 0.5 * (X + Y) - Z];
const f2 = (n) => (Math.round(n * 100) / 100).toString();
const path = (pts) => "M" + pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join("L") + "Z";

/**
 * Caras del balde con giro `deg` (positivo = recoge / labio arriba; negativo = vacía) y carga 0…1.
 * Devuelve [{ d, c }] en orden de pintado; c = "s" chapa sin borde (superficie curva), "f" chapa con borde,
 * "e" arista (sólo línea), "l" carga de mineral.
 */
export function bucketFaces(deg, load = 0) {
  const a = (deg * Math.PI) / 180;
  const P = PROFILE.map((p) => rot(p, a));
  const faces = [];
  const depth = (pts3) => pts3.reduce((s, [X, Y, Z]) => s + X + Y + Z, 0) / pts3.length; // hacia el observador (1,1,1)
  // chapas: tiras entre puntos consecutivos del perfil, de una placa a la otra
  for (let i = 0; i < TOP; i++) {
    const A = P[i], B = P[i + 1];
    const q3 = [[A[0], 0, A[1]], [B[0], 0, B[1]], [B[0], -W2, B[1]], [A[0], -W2, A[1]]];
    faces.push({ d: path([scr(A, 0), scr(B, 0), scr(B, -W2), scr(A, -W2)]), c: "s", z: depth(q3) });
  }
  faces.sort((p, q) => p.z - q.z);
  const out = [{ d: path(P.map((p) => scr(p, -W2))), c: "f" }, ...faces];
  // aristas a lo ancho, como en el dibujo: labio, quiebre piso/espalda y borde superior
  for (const i of [0, 8, 17, TOP]) out.push({ d: `M${f2(scr(P[i], 0)[0])} ${f2(scr(P[i], 0)[1])}L${f2(scr(P[i], -W2)[0])} ${f2(scr(P[i], -W2)[1])}`, c: "e" });
  // carga: un montón sobre la boca (entre el borde superior y el labio), siempre dentro del balde
  if (load > 0.02) {
    const m0 = P[TOP], m1 = P[0], n = [-(m1[1] - m0[1]), m1[0] - m0[0]], ln = Math.hypot(n[0], n[1]) || 1;
    const nx = n[0] / ln, nz = n[1] / ln, h = 8 * load;
    const at = (k, y, up) => { const p = [m0[0] + (m1[0] - m0[0]) * k, m0[1] + (m1[1] - m0[1]) * k]; return scr([p[0] + nx * h * up, p[1] + nz * h * up], y); };
    const ring = [at(0.05, -2, 0), at(0.35, -3, 0.8), at(0.5, -14, 1), at(0.42, -W2 / 2, 1.05), at(0.55, -W2 + 12, 0.95), at(0.4, -W2 + 2, 0.5), at(0.95, -W2 + 2, 0), at(0.95, -2, 0)];
    out.push({ d: "M" + ring.map((p, i) => { const q = ring[(i + 1) % ring.length]; return `${f2(p[0])} ${f2(p[1])}Q${f2(p[0])} ${f2(p[1])} ${f2((p[0] + q[0]) / 2)} ${f2((p[1] + q[1]) / 2)}`; }).join("T") + "Z", c: "l" });
  }
  out.push({ d: path(P.map((p) => scr(p, 0))), c: "f" });
  // labio (chapa gruesa del borde de ataque)
  const L0 = P[0], L1 = rot([PROFILE[0][0] + 0.2, PROFILE[0][1] - 2], a);
  out.push({ d: path([scr(L0, 0), scr(L0, -W2), scr(L1, -W2), scr(L1, 0)]), c: "f" });
  return out;
}

/** Punto medio del labio con giro `deg` (para que el mineral caiga desde ahí). */
export function lipPoint(deg) { return scr(rot(PROFILE[0], (deg * Math.PI) / 180), -W2 / 2); }
