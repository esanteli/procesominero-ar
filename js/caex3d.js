// Modelo 3D simplificado del CAEX para generar las vistas intermedias de un giro.
// Las medidas salen de los sprites de Emilio (vacia.svg y giro180.svg), medidas sobre una grilla:
// rueda r = 12, distancia entre ejes 44, trocha 44, tolva de 49 de ancho con labio trasero a 42 de alto.
// Se proyecta con la MISMA isométrica de la infografía (x = 0,866·(X−Y), y = 0,5·(X+Y) − Z),
// así cada fotograma intermedio es técnicamente consistente con las vistas dibujadas.
//
// Ejes locales del camión: x = hacia su izquierda, y = hacia adelante, z = arriba.
// Origen: centro del eje trasero, en el suelo. phi = rumbo del camión en el plano del suelo (grados):
//   270 → avanza hacia arriba‑derecha (como cargada.svg / vacia.svg)
//   180 → avanza hacia arriba‑izquierda (vacia.svg espejada, frames 2–5)
//    90 → avanza hacia abajo‑izquierda (giro180.svg, frame 6)

const box = (x0, x1, y0, y1, z0, z1, tag) => ({ kind: "prism", axis: "z", poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], a0: z0, a1: z1, tag });
// prisma con perfil en el plano (y,z) extruido a lo largo de x (paredes y piso de la tolva)
const sideways = (poly, x0, x1, tag) => ({ kind: "prism", axis: "x", poly, a0: x0, a1: x1, tag });
const wheel = (cx, cy, r, w, tag) => ({ kind: "wheel", cx, cy, r, w, tag });

export const PARTS = [
  // ruedas: traseras duales (más anchas), delanteras simples
  wheel(21, 0, 12, 12, "rueda"), wheel(-21, 0, 12, 12, "rueda"),
  wheel(22, 44, 12, 8.5, "rueda"), wheel(-22, 44, 12, 8.5, "rueda"),
  // chasis
  box(-8, 8, -8, 50, 9, 17, "chasis"),
  box(-15, 15, -3, 3, 9, 15, "eje"),
  box(-15.5, 15.5, 41, 47, 10, 15, "eje"),
  box(14, 24, 13, 30, 11, 21, "estanque"),          // estanque de combustible (lado izquierdo)
  box(-24, -14, 15, 30, 12, 20, "estanque"),        // estanque hidráulico (lado derecho)
  box(-15.5, 15.5, 56, 62, 7, 14, "parachoque"),
  box(-11, 11, 49, 60, 14, 24, "radiador"),
  box(-27, 27, 42, 62, 24, 27, "plataforma"),
  box(12, 26, 46, 59, 27, 40, "cabina"),
  box(-26, -13, 47, 57, 27, 32, "filtros"),
  // tolva (vacía): piso con rampa trasera, paredes laterales, frontal y visera sobre la cabina
  sideways([[-31, 40.5], [-4, 28], [35, 28], [35, 30], [-4, 30], [-31, 42.5]], -23.5, 23.5, "tolva"),
  sideways([[-31, 42.5], [-15, 48.5], [26, 48.5], [36, 55.5], [36, 30], [-4, 30], [-31, 40.5]], 23.5, 25, "tolva"),
  sideways([[-31, 42.5], [-15, 48.5], [26, 48.5], [36, 55.5], [36, 30], [-4, 30], [-31, 40.5]], -25, -23.5, "tolva"),
  sideways([[35, 30], [37, 30], [37, 55.5], [35, 55.5]], -23.5, 23.5, "tolva"),
  box(-25, 25, 36, 60, 55.5, 57.5, "visera"),
];

const rad = (d) => (d * Math.PI) / 180;
const VIEW = [1, 1, 1]; // dirección hacia el observador en la isométrica de la infografía

/** Proyecta un punto local del camión con rumbo phi. */
export function projector(phi) {
  const f = [Math.cos(rad(phi)), Math.sin(rad(phi))];   // adelante, en el suelo (X,Y)
  const l = [-Math.sin(rad(phi)), Math.cos(rad(phi))];  // izquierda
  const world = ([x, y, z]) => [x * l[0] + y * f[0], x * l[1] + y * f[1], z];
  const screen = ([X, Y, Z]) => [0.866 * (X - Y), 0.5 * (X + Y) - Z];
  // dirección del observador expresada en ejes locales
  const v = [VIEW[0] * l[0] + VIEW[1] * l[1], VIEW[0] * f[0] + VIEW[1] * f[1], VIEW[2]];
  return { world, screen, v, p: (pt) => screen(world(pt)) };
}

// caras de cada pieza en coordenadas locales: [{ pts:[[x,y,z]...], n:[nx,ny,nz], extra? }]
function facesOf(part) {
  if (part.kind === "prism") {
    const { poly, a0, a1, axis } = part;
    const P = (u, w, a) => (axis === "z" ? [u, w, a] : [a, u, w]); // poly en (x,y) o en (y,z)
    const faces = [];
    const cap = (a, sign) => {
      const pts = poly.map(([u, w]) => P(u, w, a));
      faces.push({ pts, n: axis === "z" ? [0, 0, sign] : [sign, 0, 0] });
    };
    cap(a0, -1); cap(a1, 1);
    // área con signo del perfil → normales hacia afuera
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const [a, b] = poly[i], [c, d] = poly[(i + 1) % poly.length]; area += a * d - c * b; }
    const s = area > 0 ? 1 : -1;
    for (let i = 0; i < poly.length; i++) {
      const [u0, w0] = poly[i], [u1, w1] = poly[(i + 1) % poly.length];
      const nu = s * (w1 - w0), nw = -s * (u1 - u0);
      const len = Math.hypot(nu, nw) || 1;
      faces.push({
        pts: [P(u0, w0, a0), P(u1, w1, a0), P(u1, w1, a1), P(u0, w0, a1)],
        n: axis === "z" ? [nu / len, nw / len, 0] : [0, nu / len, nw / len],
      });
    }
    return faces;
  }
  // rueda: cilindro con eje en x
  const { cx, cy, r, w } = part, N = 22, faces = [];
  const ring = (x, rr) => Array.from({ length: N }, (_, i) => [x, cy + rr * Math.cos((i / N) * 2 * Math.PI), r + rr * Math.sin((i / N) * 2 * Math.PI)]);
  const xo = cx + (cx > 0 ? w / 2 : -w / 2), xi = cx - (cx > 0 ? w / 2 : -w / 2);
  const sOut = cx > 0 ? 1 : -1;
  for (const [x, sg] of [[xo, sOut], [xi, -sOut]]) {
    faces.push({ pts: ring(x, r), n: [sg, 0, 0], rings: [ring(x, r * 0.72), ring(x, r * 0.42), ring(x, r * 0.2)] });
  }
  for (let i = 0; i < N; i++) {
    const a = ((i + 0.5) / N) * 2 * Math.PI;
    const A = ring(xo, r)[i], B = ring(xo, r)[(i + 1) % N], C = ring(xi, r)[(i + 1) % N], D = ring(xi, r)[i];
    faces.push({ pts: [A, B, C, D], n: [0, Math.cos(a), Math.sin(a)], tread: true });
  }
  return faces;
}

function bounds(part) {
  if (part.kind === "wheel") {
    const h = part.w / 2;
    return [[part.cx - h, part.cx + h], [part.cy - part.r, part.cy + part.r], [0, 2 * part.r]];
  }
  const us = part.poly.map((p) => p[0]), ws = part.poly.map((p) => p[1]);
  const U = [Math.min(...us), Math.max(...us)], W = [Math.min(...ws), Math.max(...ws)], A = [part.a0, part.a1];
  return part.axis === "z" ? [U, W, A] : [A, U, W];
}

const MODEL = PARTS.map((p) => ({ ...p, faces: facesOf(p), b: bounds(p) }));

// orden de pintado: si dos piezas están separadas a lo largo de un eje local, la que queda
// del lado del observador va encima; si no, se ordenan por profundidad del centro
export function paintOrder(v, project) {
  const n = MODEL.length, after = Array.from({ length: n }, () => new Set());
  // sólo importa el orden de piezas que de verdad se tapan en pantalla: silueta convexa proyectada (SAT 2D)
  const hulls = MODEL.map((m) => {
    const [X, Y, Z] = m.b, pts = [];
    for (const x of X) for (const y of Y) for (const z of Z) pts.push(project([x, y, z]));
    return convexHull(pts);
  });
  const overlap = (A, B) => {
    for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], nx = y1 - y0, ny = x0 - x1;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const [x, y] of A) { const d = x * nx + y * ny; if (d < a0) a0 = d; if (d > a1) a1 = d; }
      for (const [x, y] of B) { const d = x * nx + y * ny; if (d < b0) b0 = d; if (d > b1) b1 = d; }
      const tol = 0.02 * Math.hypot(nx, ny);
      if (a1 <= b0 + tol || b1 <= a0 + tol) return false;
    }
    return true;
  };
  const box2 = hulls;
  const center = (m) => m.b.map(([a, b]) => (a + b) / 2);
  const depth = (m) => { const c = center(m); return c[0] * v[0] + c[1] * v[1] + c[2] * v[2]; };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (!overlap(box2[i], box2[j])) continue;
    const A = MODEL[i].b, B = MODEL[j].b;
    for (let k = 0; k < 3; k++) {
      const eps = 1e-6;
      if (A[k][1] <= B[k][0] + eps) { v[k] > 0 ? after[j].add(i) : after[i].add(j); break; }
      if (B[k][1] <= A[k][0] + eps) { v[k] > 0 ? after[i].add(j) : after[j].add(i); break; }
    }
  }
  const order = [], done = new Set();
  const idx = [...MODEL.keys()].sort((a, b) => depth(MODEL[a]) - depth(MODEL[b]));
  const visit = (i, stack = new Set()) => {
    if (done.has(i)) return;
    if (stack.has(i)) return; // ciclo improbable: se resuelve por profundidad
    stack.add(i);
    for (const j of [...after[i]].sort((a, b) => depth(MODEL[a]) - depth(MODEL[b]))) visit(j, stack);
    done.add(i); order.push(i);
  };
  idx.forEach((i) => visit(i));
  return order.map((i) => MODEL[i]);
}

function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

const f2 = (n) => (Math.round(n * 100) / 100).toString();
const pathOf = (pts) => `M${pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join("L")}Z`;

/**
 * Dibuja el camión con rumbo phi. Devuelve las capas SVG (fondo blanco + línea naranja, como los sprites),
 * la caja que ocupa y su punto de apoyo (centro‑abajo), en coordenadas relativas al origen del camión.
 */
export function renderTruck(phi) {
  const pr = projector(phi);
  const out = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const grow = ([x, y]) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
  for (const m of paintOrder(pr.v, pr.p)) {
    const vis = m.faces.filter((f) => f.n[0] * pr.v[0] + f.n[1] * pr.v[1] + f.n[2] * pr.v[2] > 1e-4);
    if (m.kind === "wheel") {
      // banda de rodado: una sola silueta (envolvente de ambas tapas), luego la tapa visible con sus aros
      const all = m.faces.filter((f) => !f.tread).flatMap((f) => f.pts.map(pr.p));
      const hull = convexHull(all); hull.forEach(grow);
      out.push({ d: pathOf(hull), c: "f" });
      for (const f of vis.filter((f) => !f.tread)) {
        const pts = f.pts.map(pr.p); pts.forEach(grow);
        out.push({ d: pathOf(pts), c: "f" });
        f.rings.forEach((ring, k) => out.push({ d: pathOf(ring.map(pr.p)), c: k === 2 ? "f" : "l" }));
      }
      continue;
    }
    for (const f of vis) { const pts = f.pts.map(pr.p); pts.forEach(grow); out.push({ d: pathOf(pts), c: "f" }); }
  }
  return { paths: out, bbox: [minX, minY, maxX, maxY], anchor: [(minX + maxX) / 2, maxY] };
}

/** SVG de un fotograma (para revisarlo o editarlo en Illustrator). */
export function truckSvg(phi, pad = 2) {
  const { paths, bbox } = renderTruck(phi);
  const [x0, y0, x1, y1] = bbox;
  const body = paths.map((p) => `<path class="${p.c === "l" ? "cls-2" : "cls-1"}${p.c === "t" ? " t" : ""}" d="${p.d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f2(x0 - pad)} ${f2(y0 - pad)} ${f2(x1 - x0 + 2 * pad)} ${f2(y1 - y0 + 2 * pad)}"><defs><style>.cls-1{fill:#fff;stroke:#ef8c22;stroke-width:1.51;stroke-linejoin:round}.cls-2{fill:none;stroke:#ef8c22;stroke-width:1.51}.t{stroke-width:1.1}</style></defs><title>CAEX rumbo ${phi}°</title>${body}</svg>`;
}
