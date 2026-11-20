// Capas de pintado para una lámina SVG animada.
//
// Problema: en un SVG grande, cualquier cosa que se mueva (colpas, partículas) invalida su zona y el navegador vuelve
// a rasterizar TODO el dibujo que hay debajo, cuadro a cuadro. En el chancado secundario: 10–11 ms por cuadro con
// todo; 1,5 ms con el dibujo quieto oculto. El costo no es JavaScript (0,4 ms) sino el raster.
//
// Solución: el dibujo se reparte en una pila de capas del compositor, de abajo hacia arriba, alternando COPIAS QUIETAS
// del SVG (se rasterizan una vez y se reutilizan) y CAPAS ANIMADAS (SVG chicos con sólo lo que se mueve). Cada pieza,
// en orden de pintado, va a la capa más baja de su tipo que quede por encima de todo lo ya pintado que la toca, así
// que entre piezas que se superponen el orden de pintado es el mismo de siempre → la imagen es la misma.
//   · Lo animado se MUEVE (con una copia de la cadena de grupos que lo contenía: mismas clases y transformaciones), así
//     que el código de la estación sigue moviendo los mismos elementos.
//   · El SVG original queda debajo, con lo quieto en visibility:hidden: no se pinta, pero sigue recibiendo los toques
//     (pointer-events "painted"), con sus ids, clases y data-eq de siempre.
//   · Por dónde pasa cada cosa animada se aprende mirándola correr (celdas de GRID px). Lo que recorre toda la lámina
//     (un marcador que sigue una colpa) se declara "roaming" y cuenta como si estuviera en todas partes.
//
// Seguridad: un MutationObserver vigila la lámina. Si cambia algo quieto (elegir un equipo atenúa piezas, un
// deslizador abre un corte, la lámina entra con una transición…), se vuelve AL INSTANTE al SVG completo (modo vivo) y,
// tras QUIET_MS sin cambios, se rehacen las capas. Si algo animado aparece fuera de las celdas conocidas, también.
// El armado se reparte en varios cuadros (sin tareas largas). ?nolayers lo apaga todo, para comparar.
const QUIET_MS = 700;        // sin cambios en lo quieto durante este tiempo → se rehacen las capas
const OBSERVE_MS = 2000;     // modo automático: mirando qué cambia antes de decidir qué es animado
const WARMUP_MS = 2000;      // mirando por dónde pasa lo animado antes de la primera separación
const PROMOTE = 3;          // algo quieto que cambia en tantos cuadros distintos…
const PROMOTE_MS = 5000;    // …dentro de este tiempo pasa a ser animado
const ROAM_AFTER = 3;       // algo animado que sigue apareciendo en zonas nuevas tras tantos rearmados: "recorre todo"
const SAMPLE_EVERY = 6;      // después, cada cuántos cuadros se vuelve a mirar lo animado
const GRID = 8;              // px (de la caja del SVG) por celda
const PAD = 4;               // margen de las cajas: trazos y antialias, en px
const BUDGET_MS = 10;        // tiempo máximo por cuadro para armar copias
const RESCALE = 0.12;        // si la lámina cambia de escala en pantalla más que esto (y se queda quieta), se rasteriza de nuevo
const OFF = typeof location !== "undefined" && new URLSearchParams(location.search).has("nolayers");
const SKIP = "defs, clipPath, mask, symbol, pattern, marker, style, title, desc, metadata, script, linearGradient, radialGradient, filter";
const SHAPES = "path, polygon, polyline, rect, circle, ellipse, line, text, image, use";
const SKIP_DEFS = "defs, clipPath, mask, symbol, pattern, marker, linearGradient, radialGradient, filter";
// capa propia con translateZ(0); will-change sólo si el contenedor lo tiene (AR, que lo alterna al enfocar para
// rasterizar de nuevo): congela la escala de raster, y en el demo, al hacer zoom, las copias se verían borrosas
const LAYER_CSS = ";position:absolute;left:0;top:0;width:100%;height:100%;margin:0;pointer-events:none;transform:translateZ(0);will-change:inherit";
const registry = (globalThis.pmLayers ||= []);
// las copias nunca reciben toques (las hojas de estilo de las estaciones ponen pointer-events:auto en [data-eq], que
// ganaría dentro de una copia): los toques pasan al SVG original, debajo
if (typeof document !== "undefined" && !document.getElementById("ly-style")) {
  const css = document.createElement("style");
  css.id = "ly-style";
  css.textContent = ".ly-copy, .ly-copy * { pointer-events: none !important; }";
  document.head.appendChild(css);
}
const inter = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const num = (n, k) => parseFloat(n.getAttribute(k)) || 0;
function shape(n) {
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
  return null; // text, use, image y grupos: se usa su caja entera
}

/**
 * svg: el SVG vivo de la lámina (en su contenedor). opts:
 *   dynamic → () => Element[]  lo que se anima por cuadro (grupos o piezas); todo lo demás se trata como quieto
 *   roaming → () => Element[]  animado que puede pasar por cualquier parte de la lámina
 *   auto    → (por defecto true) además, mira qué cambia los primeros segundos y lo trata como animado; lo que empieza
 *             a cambiar después (algo que llega cada tanto) se suma solo
 *   name    → para depurar (window.pmLayers)
 * Devuelve { tick, refresh, hold, destroy, state }. tick() va al comienzo de cada cuadro de la lámina.
 */
export function createLayers(svg, { dynamic, roaming, auto = true, name = "" } = {}) {
  const st = { name, mode: OFF ? "apagado" : "esperando", layers: "", statics: 0, dyn: 0, rebuilds: 0, lastMs: 0, lastChange: "" };
  const noop = { tick() {}, refresh() {}, hold() {}, destroy() {}, state: st };
  if (OFF || !svg) return noop;
  registry.push(st);

  let started = 0, frame = 0, dyn = [], roam = new Set(), dynSet = new Set();
  let gw = 0, gh = 0, cover = new Map(), built = new Map();   // unidad animada → celdas recorridas / las usadas al armar
  let layers = null, plan = null, dirtyAt = 0, needBuild = true, held = false, mo = null, destroyed = false;
  let geo = new WeakMap();                                      // pieza quieta → { box, cells } (se borra si algo cambia)
  let rasterK = 0, lastK = 0;                                   // escala en pantalla al rasterizar las capas / en la última mirada
  let phase = "", explicit = [], promoted = new Set(), growth = new Map(), builtAt = 0;
  const seen = new Map();                                       // elemento → cuadros en que cambió (detección y promoción)

  // ---------------------------------------------------------------- vigilancia de cambios en lo quieto
  const isDyn = (n) => { for (let e = n; e && e !== svg.parentNode; e = e.parentNode) if (dynSet.has(e)) return true; return false; };
  function watch() {
    mo = new MutationObserver((list) => {
      for (const m of list) {
        if (isDyn(m.target)) continue;
        if (m.type === "childList" && [...m.addedNodes, ...m.removedNodes].every((n) => n.nodeType !== 1)) continue;
        if (m.type === "attributes" && m.oldValue === m.target.getAttribute(m.attributeName)) continue; // mismo valor
        // el style del contenedor (posición, matrix3d del AR cuadro a cuadro, will-change, opacidad de entrada) afecta a
        // todas las capas por igual, que están dentro: no cambia el dibujo
        if (m.type === "attributes" && m.attributeName === "style" && m.target === svg.parentNode) continue;
        // qué cambia y cuándo: para detectar lo animado y para sumar lo que empieza a moverse después. Un cambio dentro
        // de <defs> (un clipPath que crece, un degradado) cuenta para las piezas que lo usan.
        const t0 = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        const targets = !auto || !t0 || t0 === svg || !svg.contains(t0) ? [] : t0.closest(SKIP_DEFS) ? users(t0.closest(SKIP_DEFS)) : [t0];
        if (t0?.closest?.(SKIP_DEFS) && svg.contains(t0) && !targets.length) continue; // def sin usuarios: no se ve
        if (targets.length && targets.every(isDyn)) continue;
        const now = performance.now();
        for (const t of targets) { let r = seen.get(t); if (!r) seen.set(t, (r = [])); if (r[r.length - 1] !== frame) r.push(frame, now); }
        if (phase === "observe") continue;
        const often = targets.filter((t) => { const r = seen.get(t); let n = 0; for (let i = 1; i < r.length; i += 2) if (r[i] > now - PROMOTE_MS) n++; return n >= PROMOTE; });
        if (often.length) { often.forEach((t) => promoted.add(t)); promote(); return; }
        dirtyAt = performance.now();
        st.lastChange = `${m.type}:${m.attributeName || ""} <${m.target.tagName} class="${m.target.getAttribute?.("class") || ""}">`;
        geo = new WeakMap();
        plan = null;
        if (layers) toLive();
        needBuild = true;
        return;
      }
    });
    mo.observe(svg.parentNode, { attributes: true, attributeOldValue: true, childList: true, characterData: true, subtree: true });
    mo.observe(document.body, { attributes: true, attributeOldValue: true }); // data-mode / data-ar cambian estilos
  }

  // unidades animadas: sin repetir lo que ya está dentro de otra; si todos los hijos de un grupo son animados, el grupo
  function normalize(list) {
    const set = new Set(list.filter((e) => e && e !== svg && svg.contains(e) && !e.closest(SKIP_DEFS)));
    for (const e of [...set]) for (let a = e.parentNode; a && a !== svg; a = a.parentNode) if (set.has(a)) { set.delete(e); break; }
    for (let changed = true; changed;) {
      changed = false;
      const parents = new Map();
      for (const e of set) { const q = e.parentNode; if (q && q !== svg) { if (!parents.has(q)) parents.set(q, []); parents.get(q).push(e); } }
      for (const [q, kids] of parents) {
        // todos animados, o un "pool" (los que aún no se movieron son del mismo tipo y clase que los que sí)
        const all = [...q.children].filter((c) => !c.matches(SKIP));
        const kinds = new Set(kids.map((k) => `${k.tagName}.${k.getAttribute("class") || ""}`));
        if (all.length >= 2 && all.every((c) => set.has(c) || kinds.has(`${c.tagName}.${c.getAttribute("class") || ""}`))) { kids.forEach((k) => set.delete(k)); set.add(q); changed = true; }
      }
    }
    return [...set];
  }
  function setDyn() {
    dyn = normalize([...explicit, ...promoted, ...roam]);
    dynSet = new Set(dyn);
    st.dyn = dyn.length;
  }
  // piezas que usan un def (clip-path, mask, fill/stroke url(#…), href)
  function users(def) {
    const id = def.id;
    if (!id) return [];
    const ref = `#${CSS.escape(id)}`;
    return [...svg.querySelectorAll(`[clip-path*="${ref}"], [mask*="${ref}"], [fill*="${ref}"], [stroke*="${ref}"], [filter*="${ref}"], [href="${ref}"], [style*="${ref}"]`)].filter((e) => !e.closest(SKIP_DEFS));
  }
  // algo que se tenía por quieto cambia seguido: pasa a animado y se rehacen las capas
  function promote() {
    setDyn();
    st.promoted = promoted.size;
    if (layers) toLive();
    plan = null;
    needBuild = true;
    dirtyAt = performance.now();
  }

  // ---------------------------------------------------------------- geometría (px de la caja del SVG)
  function boxOf(el) {
    try {
      const b = el.getBBox(), m = el.getCTM();
      if (!m || (!b.width && !b.height)) return null;
      const X = [b.x, b.x + b.width], Y = [b.y, b.y + b.height], xs = [], ys = [];
      for (const x of X) for (const y of Y) { xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f); }
      const sw = parseFloat(getComputedStyle(el).strokeWidth) || 0, p = PAD + (sw * (Math.hypot(m.a, m.b) || 1)) / 2;
      return [Math.min(...xs) - p, Math.min(...ys) - p, Math.max(...xs) + p, Math.max(...ys) + p];
    } catch { return null; }
  }
  const range = (b) => [Math.max(0, Math.floor(b[0] / GRID)), Math.max(0, Math.floor(b[1] / GRID)), Math.min(gw - 1, Math.floor(b[2] / GRID)), Math.min(gh - 1, Math.floor(b[3] / GRID))];
  function sizeGrid() {
    const w = svg.clientWidth || svg.getBoundingClientRect().width, h = svg.clientHeight || svg.getBoundingClientRect().height;
    const nw = Math.ceil(w / GRID) + 1, nh = Math.ceil(h / GRID) + 1;
    if (nw !== gw || nh !== gh) { gw = nw; gh = nh; cover = new Map(); built = new Map(); geo = new WeakMap(); }
  }
  function dilate(c) {
    const o = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (c[y * gw + x])
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) o[yy * gw + xx] = 1; }
    return o;
  }
  // marca por dónde pasa lo animado; true si apareció fuera de lo que se usó para armar las capas
  function sample() {
    let grew = false;
    for (const d of dyn) {
      if (roam.has(d)) continue;
      let c = cover.get(d);
      if (!c) cover.set(d, (c = new Uint8Array(gw * gh)));
      const B = built.get(d);
      let dGrew = false;
      for (const e of d.matches(SHAPES) ? [d] : d.querySelectorAll(SHAPES)) {
        if (e.style.opacity === "0" || e.style.display === "none") continue;
        const b = boxOf(e);
        if (!b) continue;
        const [x0, y0, x1, y1] = range(b);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const k = y * gw + x;
          if (!c[k]) { c[k] = 1; if (layers && B && !B[k]) { grew = true; dGrew = true; } }
        }
      }
      // sigue apareciendo en zonas nuevas después de varios rearmados: se trata como si recorriera toda la lámina
      if (dGrew) { const g = (growth.get(d) || 0) + 1; growth.set(d, g); if (g >= ROAM_AFTER) roam.add(d); }
    }
    return grew;
  }
  // celdas que pinta de verdad una pieza (no su caja): su forma dibujada en un lienzo de una celda por píxel.
  // Los polígonos de Illustrator tienen cajas enormes; comparar cajas dejaba casi todo "tocándose".
  let cv = null, cx = null;
  function cellsOf(el, box) {
    const [x0, y0, x1, y1] = range(box);
    if (x1 < x0 || y1 < y0) return null;
    const P = shape(el), m = P && el.getCTM();
    const out = [];
    if (!P || !m) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(y * gw + x); return out; }
    if (!cv) { cv = document.createElement("canvas"); cx = cv.getContext("2d", { willReadFrequently: true }); }
    if (cv.width !== gw || cv.height !== gh) { cv.width = gw; cv.height = gh; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, cs = getComputedStyle(el);
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(x0, y0, w, h);
    cx.setTransform(m.a / GRID, m.b / GRID, m.c / GRID, m.d / GRID, m.e / GRID, m.f / GRID);
    if (cs.fill !== "none" && !/^(line|polyline)$/.test(el.tagName)) cx.fill(P);
    if (cs.stroke !== "none") { cx.lineWidth = Math.max(parseFloat(cs.strokeWidth) || 1, 0.1); cx.lineCap = cx.lineJoin = "round"; cx.stroke(P); }
    const d = cx.getImageData(x0, y0, w, h).data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) out.push((y0 + y) * gw + x0 + x);
    return out;
  }

  // ---------------------------------------------------------------- reparto
  // piezas en orden de pintado: hojas quietas y unidades animadas (subárbol entero). Un grupo quieto con opacidad < 1,
  // máscara o filtro no se parte (sus hijos se mezclan juntos).
  function items() {
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (c.matches(SKIP)) continue;
        if (dynSet.has(c)) { out.push({ el: c, dyn: true }); continue; }
        if (!c.children.length || c.tagName === "text") { out.push({ el: c, dyn: false }); continue; }
        if (!dyn.some((d) => c.contains(d))) {
          const cs = getComputedStyle(c);
          if (parseFloat(cs.opacity) < 1 || cs.filter !== "none" || (cs.mask && cs.mask !== "none") || c.hasAttribute("mask") || c.hasAttribute("filter")) { out.push({ el: c, dyn: false }); continue; }
        }
        walk(c);
      }
    };
    walk(svg);
    return out;
  }
  // ¿se puede sacar del SVG? sólo si ningún grupo que lo contiene recorta, enmascara, filtra o transparenta
  function movable(d) {
    for (let e = d.parentNode; e && e !== svg; e = e.parentNode) {
      if (e.tagName === "svg" || e.tagName === "a" || e.tagName === "switch") return false;
      const cs = getComputedStyle(e);
      if (parseFloat(cs.opacity) < 1 || cs.filter !== "none" || (cs.clipPath && cs.clipPath !== "none") || (cs.mask && cs.mask !== "none")) return false;
    }
    return true;
  }
  function assign() {
    const list = items(), n = list.length;
    if (!list.some((it) => it.dyn) || list.some((it) => it.dyn && !movable(it.el))) return null;
    const covers = new Map(dyn.map((d) => [d, roam.has(d) ? null : dilate(cover.get(d) || new Uint8Array(gw * gh))]));
    for (const it of list) {
      if (it.dyn) continue;
      let g = geo.get(it.el);
      if (!g) { const box = boxOf(it.el), cells = box ? cellsOf(it.el, box) : null; g = { box, cells: cells && cells.length ? cells : null }; geo.set(it.el, g); }
      it.box = g.box; it.cells = g.cells;
    }
    // ¿se tocan? quietas: por las celdas que pintan; animadas: por las que recorren
    const stamp = new Uint32Array(gw * gh); let tok = 0, stamped = null;
    const touch = (a, b) => {
      if (a.dyn && b.dyn) { const ca = covers.get(a.el), cb = covers.get(b.el); if (!ca || !cb) return true; for (let k = 0; k < ca.length; k++) if (ca[k] && cb[k]) return true; return false; }
      if (a.dyn || b.dyn) { const d = a.dyn ? a : b, s = a.dyn ? b : a; if (!s.cells) return false; const c = covers.get(d.el); if (!c) return true; for (const k of s.cells) if (c[k]) return true; return false; }
      if (!a.cells || !b.cells || !inter(a.box, b.box)) return false;
      if (stamped !== a) { tok++; for (const k of a.cells) stamp[k] = tok; stamped = a; }
      for (const k of b.cells) if (stamp[k] === tok) return true;
      return false;
    };
    // la capa más baja de su tipo por encima de todo lo ya pintado que la toca (o la misma, si es de su tipo)
    const stack = [], idx = new Array(n);
    for (let i = 0; i < n; i++) {
      const type = list[i].dyn ? "D" : "S";
      let lb = -1;
      for (let j = 0; j < i; j++) if (idx[j] > lb && touch(list[i], list[j])) lb = idx[j];
      let k = -1;
      for (let q = Math.max(lb, 0); q < stack.length; q++) if (stack[q].type === type) { k = q; break; }
      if (k < 0) { stack.push({ type, items: [] }); k = stack.length - 1; }
      stack[k].items.push(list[i]); idx[i] = k;
    }
    if (globalThis.PM_LAYERS_DEBUG) st.debug = { list, idx, stack, touch };
    return { list, stack, covers };
  }

  // ---------------------------------------------------------------- armado (repartido en varios cuadros)
  function startPlan() {
    const t0 = performance.now();
    const A = assign();
    needBuild = false;
    if (!A) { st.mode = "vivo (no se puede separar)"; return; }
    const statics = A.list.filter((it) => !it.dyn).length;
    if (statics < 8 || A.stack.length < 2) { st.mode = "vivo (nada que separar)"; return; }
    // índices de los elementos del SVG (para ubicarlos en las copias) y de los que tienen ids o referencias url(#…)
    const all = [...svg.querySelectorAll("*")], index = new Map(all.map((e, i) => [e, i])), ids = [], refs = [];
    all.forEach((e, i) => {
      if (e.id) ids.push(i);
      for (const at of e.attributes) if (at.value.includes("url(") || ((at.name === "href" || at.name === "xlink:href") && at.value[0] === "#")) { refs.push(i); break; }
    });
    const pe = A.list.filter((it) => !it.dyn).map((it) => [it.el, it.el.style.getPropertyValue("visibility"), it.el.style.getPropertyValue("pointer-events"), getComputedStyle(it.el).pointerEvents]);
    plan = { ...A, statics, index, ids, refs, pe, copies: A.stack.map(() => null), next: 0, ms: performance.now() - t0 };
    st.mode = "armando";
  }
  function cloneLayer(keep) {
    const c = svg.cloneNode(true), dst = c.querySelectorAll("*");
    for (const it of plan.list) if (!keep.has(it.el)) { const e = dst[plan.index.get(it.el)]; e?.style.setProperty("display", "none", "important"); }
    // ids propios de la copia: si no, url(#…) del SVG vivo podría resolver a la copia, que no se actualiza
    const map = new Map();
    for (const i of plan.ids) { const e = dst[i], nid = `${e.id}--ly${i}`; map.set(e.id, nid); e.id = nid; }
    if (map.size) for (const i of plan.refs) for (const at of [...dst[i].attributes]) {
      if ((at.name === "href" || at.name === "xlink:href") && at.value[0] === "#") { const t = map.get(at.value.slice(1)); if (t) dst[i].setAttribute(at.name, `#${t}`); }
      else if (at.value.includes("url(")) dst[i].setAttribute(at.name, at.value.replace(/url\(\s*["']?#([^"')\s]+)["']?\s*\)/g, (m, id) => (map.has(id) ? `url(#${map.get(id)})` : m)));
    }
    for (const a of ["tabindex", "role", "aria-label", "id"]) c.removeAttribute(a);
    c.setAttribute("aria-hidden", "true");
    c.classList.add("ly-copy");
    c.style.cssText += LAYER_CSS;
    return c;
  }
  function overlay(units) {
    const o = svg.cloneNode(false);
    for (const a of ["tabindex", "role", "aria-label", "id"]) o.removeAttribute(a);
    o.setAttribute("aria-hidden", "true");
    o.classList.add("ly-copy");
    o.style.cssText += LAYER_CSS;
    for (const d of units) {
      // la cadena de grupos que lo contenía (copias sin hijos: mismas clases, transformaciones y estilos heredables)
      let at = o;
      const chain = [];
      for (let e = d.parentNode; e && e !== svg; e = e.parentNode) chain.unshift(e);
      for (const g of chain) { const w = g.cloneNode(false); w.removeAttribute("id"); at.appendChild(w); at = w; }
      at.appendChild(d);
    }
    return o;
  }
  // un paso del armado: copias quietas hasta agotar el presupuesto del cuadro; al final, se cambian de una vez
  function stepPlan() {
    const t0 = performance.now(), P = plan;
    while (P.next < P.stack.length && performance.now() - t0 < BUDGET_MS) {
      const l = P.stack[P.next];
      if (l.type === "S") P.copies[P.next] = cloneLayer(new Set(l.items.map((it) => it.el)));
      P.next++;
    }
    P.ms += performance.now() - t0;
    if (P.next < P.stack.length) return;
    const t1 = performance.now();
    plan = null;
    const units = P.list.filter((it) => it.dyn).map((it) => it.el);
    const snap = (d) => { const m = d.getCTM(), cs = getComputedStyle(d); return [m ? [m.a, m.b, m.c, m.d, m.e, m.f] : null, cs.fill, cs.stroke, cs.opacity, cs.visibility]; };
    const before = units.map(snap);
    const marks = units.map((d) => { const m = document.createComment("ly"); d.before(m); return m; });
    P.stack.forEach((l, i) => { if (l.type === "D") P.copies[i] = overlay(l.items.map((it) => it.el)); });
    let after = svg;
    for (const L of P.copies) { after.after(L); after = L; }
    if (!svg.style.position) svg.style.position = "relative";
    layers = { copies: P.copies, hidden: P.pe, moved: units, marks };
    applyHidden(true);
    // comprobación: lo movido debe quedar exactamente igual (posición y estilo); si no, se deshace
    const same = units.every((d, i) => {
      const a = before[i], b = snap(d);
      const g = (!a[0] && !b[0]) || (a[0] && b[0] && a[0].every((v, k) => Math.abs(v - b[0][k]) < 0.01));
      return g && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4];
    });
    if (!same) { toLive(); st.mode = "vivo (al mover cambió algo)"; return; }
    built = new Map([...P.covers].filter(([, c]) => c));
    rasterK = lastK = screenK();
    builtAt = performance.now();
    P.ms += performance.now() - t1;
    Object.assign(st, { mode: "capas", layers: P.stack.map((l) => `${l.type}${l.items.length}`).join(" "), statics: P.statics, dyn: units.length, rebuilds: st.rebuilds + 1, lastMs: +P.ms.toFixed(1) });
  }
  function applyHidden(on) {
    for (const [e, vis, pe, cpe] of layers.hidden) {
      if (on) { e.style.setProperty("visibility", "hidden"); if (cpe !== "none") e.style.setProperty("pointer-events", "painted"); } // sigue recibiendo toques
      else { vis ? e.style.setProperty("visibility", vis) : e.style.removeProperty("visibility"); pe ? e.style.setProperty("pointer-events", pe) : e.style.removeProperty("pointer-events"); }
    }
    mo?.takeRecords(); // los cambios propios no cuentan
  }
  function toLive() {
    if (!layers) return;
    applyHidden(false);
    layers.moved.forEach((e, i) => layers.marks[i].replaceWith(e));
    layers.copies.forEach((L) => L.remove());
    layers = null;
    st.mode = "vivo";
    mo?.takeRecords();
  }

  // ---------------------------------------------------------------- escala de raster
  // Las capas se rasterizan a la escala que tiene la lámina en pantalla al crearlas; bajo un contenedor con
  // will-change (la cámara del demo, el AR) esa escala queda fija. Si la lámina se acerca o aleja y se queda quieta, se
  // reinsertan las capas: el navegador las vuelve a rasterizar nítidas a la escala nueva (como el SVG original).
  const screenK = () => { const r = svg.getBoundingClientRect(); return svg.clientWidth ? r.width / svg.clientWidth : 1; };
  function checkScale() {
    const k = screenK(), stable = Math.abs(k / (lastK || k) - 1) < 0.01;
    lastK = k;
    if (!stable || !rasterK || Math.abs(k / rasterK - 1) < RESCALE) return;
    let after = svg;
    for (const L of layers.copies) { L.remove(); after.after(L); after = L; }
    mo?.takeRecords();
    rasterK = k;
    st.rescales = (st.rescales || 0) + 1;
  }

  // ---------------------------------------------------------------- por cuadro
  function tick() {
    if (destroyed || !svg.isConnected) return;
    if (!mo) {
      if (!svg.getCTM() || !svg.clientWidth) return;
      roam = new Set((roaming?.() || []).filter((e) => e && svg.contains(e)));
      explicit = (dynamic?.() || []).filter((e) => e && svg.contains(e));
      setDyn();
      sizeGrid();
      watch();
      phase = auto ? "observe" : "sample";
      started = performance.now();
    }
    frame++;
    if (phase === "observe") {
      st.mode = "mirando";
      if (performance.now() - started < OBSERVE_MS) return;
      // lo que cambió en más de un cuadro es animado
      for (const [e, r] of seen) if (r.length >= 4 && !isDyn(e)) promoted.add(e); // [cuadro, ms] por cambio: ≥ 2 cuadros
      setDyn();
      st.promoted = promoted.size;
      phase = "sample";
      started = performance.now();
    }
    const warm = performance.now() - started < WARMUP_MS;
    // ya estable (10 s sin rearmar): se mira lo animado cada vez menos seguido
    const every = layers && performance.now() - builtAt > 10000 ? SAMPLE_EVERY * 5 : SAMPLE_EVERY;
    if (warm || frame % every === 0) {
      if (sample()) { toLive(); plan = null; needBuild = true; dirtyAt = performance.now() - QUIET_MS + 200; }
    }
    if (layers && frame % 10 === 0) checkScale();
    if (warm || held || layers) return;
    if (plan) { stepPlan(); return; }
    if (!needBuild) return;
    if (performance.now() - dirtyAt < QUIET_MS) { st.mode = "vivo (cambios)"; return; }
    startPlan();
  }
  const api = {
    tick,
    refresh() { toLive(); plan = null; geo = new WeakMap(); needBuild = true; dirtyAt = 0; },
    // QA: hold(true) deja el SVG completo (vivo) hasta hold(false), para comparar las dos formas de pintar
    hold(v) { held = !!v; if (held) { toLive(); plan = null; } else { needBuild = true; dirtyAt = 0; } },
    destroy() { destroyed = true; toLive(); mo?.disconnect(); const i = registry.indexOf(st); if (i >= 0) registry.splice(i, 1); },
    state: st,
  };
  Object.defineProperty(st, "ctl", { value: api, enumerable: false });
  return api;
}
