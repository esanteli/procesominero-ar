// Silueta blanca y sombra de una lámina, horneadas UNA vez en <canvas>.
// Los drop-shadow de CSS sobre los SVG animados se recalculaban en cada cuadro: en el celular eran lo más caro de
// dibujar. La sombra sale de la silueta de la lámina (path *-sil) o, si no tiene (chancado primario), de su dibujo
// estático dilatado, que además queda como contorno blanco sobre la infografía.
const SIL = '[class$="-sil"], .mn-glow';
const SHAPES = "path, polygon, polyline, rect, circle, ellipse, line";
const FALLBACK = [{ c: "rgba(122,61,20,.14)", x: 0, y: 2, b: 3 }, { c: "rgba(122,61,20,.11)", x: 0, y: 12, b: 16 }];
const GROUND = { c: "rgba(70,35,10,.22)", x: 0, y: 6, b: 22 }; // sombra sobre el papel cuando la lámina flota (AR)

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
 *   ground → la sombra se devuelve suelta (para ponerla en el papel, bajo la lámina que flota) en vez de insertarla
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
  const pad = Math.ceil(Math.max(...layers.map((L) => (Math.abs(L.x) + Math.abs(L.y) + L.b * 1.6) * unit))) + 4;
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
