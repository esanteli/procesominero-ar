// Silueta blanca y sombra de una lámina, horneadas UNA vez en <canvas>.
// Los drop-shadow de CSS sobre los SVG animados se recalculaban en cada cuadro: en el celular eran lo más caro de
// dibujar. La sombra sale de la silueta de la lámina (path *-sil) o, si no tiene (chancado primario), de su dibujo
// estático dilatado, que además queda como contorno blanco sobre la infografía.
const SIL = '[class$="-sil"], .mn-glow';
const SHAPES = "path, polygon, polyline, rect, circle, ellipse, line";
const FALLBACK = [{ c: "rgba(122,61,20,.14)", x: 0, y: 2, b: 3 }, { c: "rgba(122,61,20,.11)", x: 0, y: 12, b: 16 }];
const GROUND = { c: "rgba(70,35,10,.22)", x: 0, y: 6, b: 22 }; // sombra sobre el papel cuando la lámina flota (AR)
const PAPER = "#fff";

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
// rellena los huecos encerrados de la máscara (p. ej. el marco de una correa): se inunda el vacío desde el borde y lo
// que no se alcanza queda adentro. Una vez por lámina, a media resolución.
function fillHoles(c, w, h) {
  const img = c.getImageData(0, 0, w, h), a = img.data, seen = new Uint8Array(w * h), stack = [];
  const push = (i) => { if (!seen[i] && a[i * 4 + 3] < 128) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  for (let i = 0; i < w * h; i++) if (!seen[i]) { a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = a[i * 4 + 3] = 255; }
  c.putImageData(img, 0, 0);
}
// rellena la envolvente convexa de la máscara: para láminas que no calzan 1:1 con lo impreso (el chancado primario es
// una ampliación), así el dibujo impreso más chico no asoma entre las líneas abiertas de la lámina
function fillHull(c, w, h, grow) {
  const a = c.getImageData(0, 0, w, h).data, pts = [];
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] >= 128) { if (l < 0) l = x; r = x; }
    if (l >= 0) pts.push([l, y], [r, y]);
  }
  if (pts.length < 3) return;
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
  c.fillStyle = c.strokeStyle = "#fff"; c.lineJoin = "round"; c.lineWidth = grow * 2;
  c.beginPath();
  hull.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill(); c.stroke();
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
 * root: la lámina (debe estar en el documento para leer sus estilos). El canvas se ubica sobre el contenedor directo
 * del SVG del dibujo. opts:
 *   svg   → el SVG del dibujo (por defecto, el primero de root)
 *   halo  → { skip, r }: dibuja también el contorno blanco dilatando el dibujo estático (skip = selector de lo animado)
 *   ground → la sombra se devuelve suelta (para ponerla en el papel, bajo la lámina que flota) en vez de insertarla,
 *            sobre un parche blanco difuminado con la forma del dibujo que tapa lo impreso debajo
 *   paper  → el mismo parche, pero dentro de la lámina bajo el dibujo (demo: tapa la infografía de fondo)
 *   hull   → el parche cubre la envolvente convexa del dibujo, no sólo su silueta
 * Devuelve { shadow, w, h }: el canvas de la sombra, centrado sobre el contenedor del SVG, y su tamaño en px.
 */
export function bake(root, opts = {}) {
  const svg = opts.svg || root.querySelector("svg");
  const host = svg?.parentNode;
  const w = host?.offsetWidth || parseFloat(host?.style.width) || 0;
  const h = host?.offsetHeight || parseFloat(host?.style.height) || 0;
  if (!svg || !w || !h) return { shadow: null, w, h };
  const base = viewBoxMatrix(svg, w, h);
  const sil = opts.halo ? null : svg.querySelector(SIL);
  let layers = sil ? shadowsOf(sil) : [];
  let unit = 1;                                     // px del contenedor por unidad del elemento de la silueta
  if (sil) { unit = scaleOf(base.multiply(chain(svg, sil))); sil.style.filter = "none"; }
  if (!layers.length) { layers = FALLBACK; unit = 1; }
  if (opts.ground) layers = [...layers, { ...GROUND, x: GROUND.x / unit, y: GROUND.y / unit, b: GROUND.b / unit }];
  // parche de papel (AR): la silueta dilatada R px y difuminada F px, en blanco, tapa el dibujo impreso bajo la lámina
  const P0 = opts.ground || opts.paper, S = Math.max(w, h), R = P0 ? Math.round(S * 0.012 + 6) : 0, F = P0 ? Math.round(S * 0.02 + 8) : 0;
  const pad = Math.ceil(Math.max(R + F * 1.6, ...layers.map((L) => (Math.abs(L.x) + Math.abs(L.y) + L.b * 1.6) * unit))) + 4;
  const W = Math.ceil(w + pad * 2), H = Math.ceil(h + pad * 2);

  // máscara: la silueta en blanco (px del contenedor + margen)
  const mask = document.createElement("canvas");
  mask.width = W; mask.height = H;
  const ctx = mask.getContext("2d");
  ctx.fillStyle = ctx.strokeStyle = "#fff";
  ctx.lineJoin = ctx.lineCap = "round";
  const at = (m) => { const t = new DOMMatrix().translate(pad, pad).multiply(base).multiply(m); ctx.setTransform(t); return scaleOf(t); };
  if (sil) {
    at(chain(svg, sil));
    const P = shapeOf(sil);
    if (P) ctx.fill(P);
  } else {
    const r = opts.halo?.r ?? 3.4;                 // el dibujo dilatado ~3 px, como las siluetas de las demás láminas
    for (const n of svg.querySelectorAll(SHAPES)) {
      if (n.closest("defs, clipPath, mask, symbol, pattern, .pm-paper") || (opts.halo?.skip && n.closest(opts.halo.skip))) continue;
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const P = shapeOf(n);
      if (!P) continue;
      const bb = n.getBBox?.();
      if (bb && bb.width < 2 && bb.height < 2) continue; // trazos sueltos de 1 px: dejaban puntos blancos y estiraban el parche
      const s = at(chain(svg, n));
      if (cs.fill !== "none" && n.tagName !== "line" && n.tagName !== "polyline") ctx.fill(P);
      ctx.lineWidth = (2 * r) / s + (parseFloat(cs.strokeWidth) || 1);
      ctx.stroke(P);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // sombra: se dibuja la máscara fuera del lienzo y sólo su sombra cae adentro; a media resolución (va desenfocada)
  const q = 0.5, shadow = document.createElement("canvas");
  shadow.width = Math.ceil(W * q); shadow.height = Math.ceil(H * q);
  const sx = shadow.getContext("2d"), far = shadow.width + 64;
  if (R) {
    // dilatación: la máscara estampada en dos anillos; el difuminado se hace con shadowBlur (ctx.filter no existe en Safari)
    const d = document.createElement("canvas");
    d.width = shadow.width; d.height = shadow.height;
    const dx = d.getContext("2d");
    for (const rr of [R / 2, R]) for (let a = 0; a < 16; a++) dx.drawImage(mask, rr * q * Math.cos((a * Math.PI) / 8), rr * q * Math.sin((a * Math.PI) / 8), d.width, d.height);
    if (opts.hull) fillHull(dx, d.width, d.height, R * q);
    else fillHoles(dx, d.width, d.height);
    sx.shadowColor = PAPER; sx.shadowBlur = F * q; sx.shadowOffsetX = far; sx.shadowOffsetY = 0;
    sx.drawImage(d, -far, 0); sx.drawImage(d, -far, 0); // dos veces: núcleo opaco, borde suave
  }
  for (const L of layers) {
    sx.shadowColor = L.c;
    sx.shadowBlur = L.b * unit * q;
    sx.shadowOffsetX = far + L.x * unit * q;
    sx.shadowOffsetY = L.y * unit * q;
    sx.drawImage(mask, -far, 0, shadow.width, shadow.height);
  }
  const place = (c) => { c.className = "pm-baked"; c.style.cssText = `position:absolute;left:${-pad}px;top:${-pad}px;width:${W}px;height:${H}px;pointer-events:none`; };
  svg.style.position = "relative";
  if (opts.halo) { place(mask); host.insertBefore(mask, svg); }
  if (opts.ground) shadow.style.cssText = `width:${W}px;height:${H}px;pointer-events:none`;
  else { place(shadow); host.insertBefore(shadow, host.firstChild); }
  return { shadow, w: W, h: H };
}
