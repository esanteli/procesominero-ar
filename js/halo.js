// Silueta y sombra de una lámina. La silueta (path *-sil, blanca, con contorno blanco nítido por CSS) separa el
// dibujo del fondo; su sombra se hornea UNA vez en <canvas>: los drop-shadow de CSS sobre los SVG animados se
// recalculaban en cada cuadro y en el celular eran lo más caro de dibujar. Si la lámina no trae silueta (chancado
// primario), se le crea una con la envolvente de su dibujo estático.
const SIL = '[class$="-sil"], .mn-glow';
const SHAPES = "path, polygon, polyline, rect, circle, ellipse, line";
const FALLBACK = [{ c: "rgba(122,61,20,.14)", x: 0, y: 2, b: 3 }, { c: "rgba(122,61,20,.11)", x: 0, y: 12, b: 16 }];
const GROUND = { c: "rgba(70,35,10,.18)", x: 0, y: 4, b: 10 }; // sombra corta sobre el papel bajo la lámina que flota (AR)

function chain(svg, node) {
  let m = new DOMMatrix();
  for (let n = node; n && n !== svg; n = n.parentNode) {
    const t = n.transform?.baseVal?.consolidate?.();
    if (t) { const k = t.matrix; m = new DOMMatrix([k.a, k.b, k.c, k.d, k.e, k.f]).multiply(m); }
  }
  return m;
}
function viewBoxMatrix(svg, w, h) {
  const vb = svg.viewBox?.baseVal;
  if (!vb || !vb.width) return new DOMMatrix();
  const s = Math.min(w / vb.width, h / vb.height);
  return new DOMMatrix().translate((w - vb.width * s) / 2, (h - vb.height * s) / 2).scale(s).translate(-vb.x, -vb.y);
}
const num = (n, k) => parseFloat(n.getAttribute(k)) || 0;
function shapeOf(n) {
  const P = new Path2D();
  switch (n.tagName) {
    case "path": return new Path2D(n.getAttribute("d") || "");
    case "polygon": case "polyline": {
      const p = (n.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i + 1 < p.length; i += 2) i ? P.lineTo(p[i], p[i + 1]) : P.moveTo(p[i], p[i + 1]);
      if (n.tagName === "polygon") P.closePath();
      return P;
    }
    case "rect": P.rect(num(n, "x"), num(n, "y"), num(n, "width"), num(n, "height")); return P;
    case "circle": P.arc(num(n, "cx"), num(n, "cy"), num(n, "r"), 0, Math.PI * 2); return P;
    case "ellipse": P.ellipse(num(n, "cx"), num(n, "cy"), num(n, "rx"), num(n, "ry"), 0, 0, Math.PI * 2); return P;
    case "line": P.moveTo(num(n, "x1"), num(n, "y1")); P.lineTo(num(n, "x2"), num(n, "y2")); return P;
  }
  return null;
}
// envolvente convexa de los píxeles opacos de un canvas (filas: extremo izquierdo y derecho), en px del canvas
function hullOf(c) {
  const w = c.width, h = c.height, a = c.getContext("2d").getImageData(0, 0, w, h).data, pts = [];
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] >= 128) { if (l < 0) l = x; r = x; }
    if (l >= 0) pts.push([l, y], [r, y]);
  }
  if (pts.length < 3) return [];
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
// Silueta para una lámina que no la trae (chancado primario): la envolvente convexa del dibujo estático, algo
// agrandada, como <polygon class="pm-sil"> al fondo del SVG. Es vector: su contorno blanco queda nítido a cualquier
// escala, y como la lámina es una ampliación, tapa entera la estación impresa (más chica) que queda debajo.
function hullSil(svg, base, w, h, halo) {
  const pad = 40, c = document.createElement("canvas");
  c.width = Math.ceil(w + pad * 2); c.height = Math.ceil(h + pad * 2);
  const ctx = c.getContext("2d");
  ctx.fillStyle = ctx.strokeStyle = "#fff";
  ctx.lineJoin = ctx.lineCap = "round";
  const toCanvas = new DOMMatrix().translate(pad, pad).multiply(base);
  for (const n of svg.querySelectorAll(SHAPES)) {
    if (n.closest("defs, clipPath, mask, symbol, pattern, .pm-paper, .pm-sil") || (halo.skip && n.closest(halo.skip))) continue;
    const cs = getComputedStyle(n);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const bb = n.getBBox?.();
    if (bb && bb.width < 2 && bb.height < 2) continue; // trazos sueltos de 1 px: estiraban la silueta hasta la etiqueta
    const P = shapeOf(n);
    if (!P) continue;
    const t = toCanvas.multiply(chain(svg, n));
    ctx.setTransform(t);
    ctx.lineWidth = (parseFloat(cs.strokeWidth) || 1) + 2 / scaleOf(t);
    ctx.stroke(P);
    if (cs.fill !== "none" && n.tagName !== "line" && n.tagName !== "polyline") ctx.fill(P);
  }
  const hull = hullOf(c);
  if (hull.length < 3) return null;
  // un poco más grande que el dibujo (halo.grow px del contenedor), para que no asome lo impreso en el borde
  const g = halo.grow ?? 12, mx = hull.reduce((s, p) => s + p[0], 0) / hull.length, my = hull.reduce((s, p) => s + p[1], 0) / hull.length;
  const inv = toCanvas.inverse();
  const pts = hull.map(([x, y]) => {
    const d = Math.hypot(x - mx, y - my) || 1, q = inv.transformPoint({ x: x + ((x - mx) / d) * g, y: y + ((y - my) / d) * g });
    return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  });
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  poly.setAttribute("class", "pm-sil");
  poly.setAttribute("points", pts.join(" "));
  svg.insertBefore(poly, svg.firstChild);
  return poly;
}
const scaleOf = (m) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;

// drop-shadow(...) del estilo calculado → capas { c, x, y, b } en unidades del elemento
function shadowsOf(el) {
  const out = [];
  for (const m of (getComputedStyle(el).filter || "").matchAll(/drop-shadow\(((?:[^()]|\([^()]*\))*)\)/g)) {
    const color = (m[1].match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i) || [""])[0];
    const nums = m[1].replace(color, "").match(/-?[\d.]+px/g)?.map(parseFloat) || [];
    if (color && nums.length >= 2) out.push({ c: color, x: nums[0], y: nums[1], b: nums[2] || 0 });
  }
  return out;
}

/**
 * root: la lámina (debe estar en el documento para leer sus estilos). opts:
 *   svg    → el SVG del dibujo (por defecto, el primero de root)
 *   halo   → { skip, grow }: la lámina no trae silueta (*-sil): se le crea una con la envolvente del dibujo estático
 *            (skip = selector de lo animado, que no cuenta)
 *   ground → la sombra se devuelve suelta (para ponerla en el papel, bajo la lámina que flota) en vez de insertarla
 * La silueta lleva un contorno blanco nítido (CSS: stroke con vector-effect: non-scaling-stroke); aquí sólo se hornea
 * su sombra. Devuelve { shadow, w, h }: el canvas de la sombra, centrado sobre el contenedor del SVG, y su tamaño en px.
 */
export function bake(root, opts = {}) {
  const svg = opts.svg || root.querySelector("svg");
  const host = svg?.parentNode;
  const w = host?.offsetWidth || parseFloat(host?.style.width) || 0;
  const h = host?.offsetHeight || parseFloat(host?.style.height) || 0;
  if (!svg || !w || !h) return { shadow: null, w, h };
  const base = viewBoxMatrix(svg, w, h);
  let sil = svg.querySelector(SIL);
  if (!sil && opts.halo) sil = hullSil(svg, base, w, h, opts.halo);
  if (!sil) return { shadow: null, w, h };
  let layers = shadowsOf(sil);
  let unit = scaleOf(base.multiply(chain(svg, sil)));  // px del contenedor por unidad del elemento de la silueta
  sil.style.filter = "none";
  if (!layers.length) { layers = FALLBACK; unit = 1; }
  if (opts.ground) layers = [...layers, { ...GROUND, x: GROUND.x / unit, y: GROUND.y / unit, b: GROUND.b / unit }];
  const pad = Math.ceil(Math.max(...layers.map((L) => (Math.abs(L.x) + Math.abs(L.y) + L.b * 1.6) * unit))) + 4;
  const W = Math.ceil(w + pad * 2), H = Math.ceil(h + pad * 2);

  // máscara: la silueta en blanco (px del contenedor + margen)
  const mask = document.createElement("canvas");
  mask.width = W; mask.height = H;
  const ctx = mask.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.setTransform(new DOMMatrix().translate(pad, pad).multiply(base).multiply(chain(svg, sil)));
  const P = shapeOf(sil);
  if (P) ctx.fill(P);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // sombra: se dibuja la máscara fuera del lienzo y sólo su sombra cae adentro; a media resolución (va desenfocada)
  const q = 0.5, shadow = document.createElement("canvas");
  shadow.width = Math.ceil(W * q); shadow.height = Math.ceil(H * q);
  const sx = shadow.getContext("2d"), far = shadow.width + 64;
  for (const L of layers) {
    sx.shadowColor = L.c;
    sx.shadowBlur = L.b * unit * q;
    sx.shadowOffsetX = far + L.x * unit * q;
    sx.shadowOffsetY = L.y * unit * q;
    sx.drawImage(mask, -far, 0, shadow.width, shadow.height);
  }
  svg.style.position = "relative";
  if (opts.ground) shadow.style.cssText = `width:${W}px;height:${H}px;pointer-events:none`;
  else {
    shadow.className = "pm-baked";
    shadow.style.cssText = `position:absolute;left:${-pad}px;top:${-pad}px;width:${W}px;height:${H}px;pointer-events:none`;
    host.insertBefore(shadow, host.firstChild);
  }
  return { shadow, w: W, h: H };
}
