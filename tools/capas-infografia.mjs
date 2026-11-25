// Separa la infografía nueva (assets/procesominero_sin_ar.svg + .jpg) en capas para animarla en el demo sin cámara.
//
// El SVG viene de Illustrator en una sola capa con ~12.000 piezas sueltas (cubos, cilindros, trazos) sin grupos por
// estación, y sus textos usan Gotham (no viene incrustada). Por eso no se usa directo en la página: se usa como
// fuente para sacar, en un Chrome sin interfaz, una imagen por capa:
//   base.webp            terreno y rajo (sin estaciones, etiquetas ni líneas de flujo), fondo blanco
//   st-<id>.webp         la ilustración de cada estación, fondo transparente
//   lb-<id>.webp         la etiqueta de cada estación; los píxeles salen del JPG (tipografía correcta) y la forma
//                        (transparencia) del SVG
//   js/infografia-capas.js  posición de cada imagen y las líneas de flujo como vectores (se dibujan en la página)
// Todo en px del JPG (5944 × 2062 = 2 × el viewBox del SVG). En la página la capa se ubica con ART.offset sobre las
// coordenadas de stations.js (las de la infografía anterior: el arte es el mismo dibujo, a la misma escala).
//
// Uso (puppeteer-core y sharp no son dependencias del proyecto, se instalan aparte):
//   npm i --no-save sharp@0.35.5 puppeteer-core
//   node tools/capas-infografia.mjs                  (CHROME=<ruta a chrome.exe> si no está en la ruta por defecto)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = async (name, env) => import(process.env[env] ? pathToFileURL(process.env[env]).href : name);
const { default: puppeteer } = await req("puppeteer-core", "PUPPETEER");
const { default: sharp } = await req("sharp", "SHARP");

const SRC_SVG = path.join(ROOT, "assets/procesominero_sin_ar.svg");
const SRC_JPG = path.join(ROOT, "assets/procesominero_sin_ar.jpg");
const OUT = path.join(ROOT, "assets/infografia-capas");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const W = 5944, H = 2062;
// px del JPG = px de la infografía anterior (stations.js) + OFFSET; Fundición se movió en el arte nuevo
const OFFSET = [204, 232];
const SHIFT = { fundicion: [-84, 64] };

// Zonas de cada estación en px del JPG: una pieza del SVG es de la estación si su caja cabe entera en la zona.
// art: la ilustración; label: la etiqueta (tarjeta, número e ícono). max: tamaño máximo de una pieza (en el rajo
// sólo las máquinas: las curvas de nivel quedan en la base).
const ZONES = [
  { id: "rajo", art: [[760, 690, 320, 470]], max: 95, label: [1290, 780, 260, 125] },
  { id: "mina-subterranea", art: [[1390, 1435, 270, 230]], label: [1660, 1330, 315, 125] },
  { id: "chancado-primario", art: [[1905, 640, 320, 380]], label: [1925, 520, 290, 125] },
  { id: "chancado-secundario", art: [[2140, 890, 470, 320]], label: [2600, 1090, 300, 130] },
  { id: "concentradora", art: [[2140, 1175, 470, 365]], label: [2240, 1540, 350, 130] },
  { id: "pilas-lixiviacion", art: [[2420, 500, 610, 380]], label: [2815, 820, 310, 130] },
  { id: "electroobtencion", art: [[3150, 540, 740, 280]], label: [3490, 815, 365, 130] },
  { id: "celdas-flotacion", art: [[2950, 920, 960, 540]], label: [3255, 1355, 310, 130] },
  { id: "fundicion", art: [[4255, 1250, 300, 290]], label: [4295, 1528, 295, 130] },
  { id: "puerto", art: [[4400, 640, 940, 450]], label: [5135, 905, 275, 130] },
];
// "Minerales oxidados / sulfurados" del rajo: textos, líneas guía y sus puntos (aparecen con las etiquetas)
const CAPTIONS = [[930, 1050, 670, 120], [1005, 1278, 380, 42]];
const FLOW = ["cls-24", "cls-27"]; // líneas del flujo del mineral (amarillas y rojas de 1,5 px; las punteadas son contornos del rajo)

const args = new Set(process.argv.slice(2));
const svgText = fs.readFileSync(SRC_SVG, "utf8").replace(/<\?xml[^>]*>/, "");

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000,
  args: ["--force-color-profile=srgb", "--disable-lcd-text", "--max-gum-fps=1"] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body></body></html>`);
await page.evaluate((txt, W, H) => {
  document.body.innerHTML = txt;
  const svg = document.querySelector("svg");
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("preserveAspectRatio", "none");
}, svgText, W, H);

// ---------------------------------------------------------------- clasificación
const plan = await page.evaluate(({ ZONES, CAPTIONS, FLOW }) => {
  const inside = (r, [x, y, w, h], m = 0) => r.left >= x - m && r.top >= y - m && r.right <= x + w + m && r.bottom <= y + h + m;
  const LEAF = new Set(["path", "polygon", "polyline", "line", "rect", "circle", "ellipse", "text", "image", "use"]);
  const groups = new Map(); // nodo → capa
  let n = 0;
  const tag = (el, key) => { el.dataset.capa = key; groups.set(el, key); };
  const isFlow = (el) => FLOW.some((c) => el.classList.contains(c));
  const visit = (el) => {
    const t = el.tagName.toLowerCase();
    if (t === "defs" || t === "clippath" || t === "style" || t === "mask") return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0 && t !== "g") return;
    // puntos de las líneas (círculos chicos rellenos)
    const fill = getComputedStyle(el).fill;
    const dot = LEAF.has(t) && r.width <= 16 && r.height <= 16 && (fill === "rgb(240, 179, 52)" || fill === "rgb(233, 91, 19)");
    if ((isFlow(el) || dot || t === "text") && CAPTIONS.some((c) => inside(r, c, 4))) return tag(el, "lb:captions");
    if (isFlow(el)) return tag(el, "flow");
    for (const z of ZONES) if (inside(r, z.label, 4)) return tag(el, `lb:${z.id}`);
    if (dot) return tag(el, "dot");
    for (const z of ZONES) if (z.art.some((a) => inside(r, a)) && (!z.max || Math.max(r.width, r.height) <= z.max)) return tag(el, `st:${z.id}`);
    if (t === "g" || t === "svg") { for (const c of el.children) visit(c); return; }
    n++;
    tag(el, "base");
  };
  visit(document.querySelector("svg"));
  // Piezas de la base que en el SVG se pintan encima de una estación (p. ej. el muro blanco del talud delante de las
  // patas del chancado primario): se renderizan también en la capa de la estación, en su orden, recortadas a la
  // silueta de la estación. Si no, al poner la estación sobre la base asoma lo que el dibujo tapaba.
  const order = [...groups];
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const occ = {};
  for (const z of ZONES) {
    const mine = [];
    order.forEach(([el, k], i) => {
      if (k === `st:${z.id}`) { mine.push(el.getBoundingClientRect()); return; }
      if (k !== "base" || !mine.length) return;
      const cs = getComputedStyle(el);
      if (cs.fill === "none" || cs.fillOpacity === "0") return; // sólo lo que tapa (rellenos y contornos dibujados como relleno)
      const r = el.getBoundingClientRect();
      if (!mine.some((m) => hit(m, r))) return;
      el.dataset.occ = `${el.dataset.occ || ""} ${z.id}`.trim();
      occ[z.id] = (occ[z.id] || 0) + 1;
    });
  }
  const count = {};
  for (const k of groups.values()) count[k] = (count[k] || 0) + 1;
  return { count, occ };
}, { ZONES, CAPTIONS, FLOW });
console.log("piezas por capa", plan.count, "piezas de la base que tapan una estación", plan.occ);

// ---------------------------------------------------------------- líneas de flujo y puntos como vectores
const vectors = await page.evaluate(() => {
  const r2 = (v) => Math.round(v * 100) / 100;
  const out = { lines: [], dots: [] };
  for (const el of document.querySelectorAll('[data-capa="flow"], [data-capa="dot"]')) {
    const m = el.getScreenCTM();
    const cs = getComputedStyle(el);
    const item = { tag: el.tagName.toLowerCase(), m: [m.a, m.b, m.c, m.d, m.e, m.f].map((v) => Math.round(v * 10000) / 10000) };
    for (const a of ["d", "points", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height"]) if (el.hasAttribute(a)) item[a] = el.getAttribute(a);
    if (el.dataset.capa === "flow") {
      item.stroke = cs.stroke; item.width = parseFloat(cs.strokeWidth); item.dash = cs.strokeDasharray === "none" ? null : cs.strokeDasharray;
      // extremos (px del JPG) para ordenar el dibujo según el proceso
      const len = el.getTotalLength(), p0 = el.getPointAtLength(0), p1 = el.getPointAtLength(len);
      const tp = (p) => [r2(m.a * p.x + m.c * p.y + m.e), r2(m.b * p.x + m.d * p.y + m.f)];
      item.a = tp(p0); item.b = tp(p1); item.len = r2(len * Math.hypot(m.a, m.b));
      out.lines.push(item);
    } else {
      const b = el.getBoundingClientRect();
      item.fill = cs.fill; item.c = [r2(b.left + b.width / 2), r2(b.top + b.height / 2)];
      out.dots.push(item);
    }
  }
  return out;
});
console.log(`líneas ${vectors.lines.length}, puntos ${vectors.dots.length}`);
if (args.has("--dump")) { console.log(JSON.stringify(vectors.lines.map((l) => ({ a: l.a, b: l.b, len: l.len, stroke: l.stroke, dash: l.dash })), null, 0)); }

// ---------------------------------------------------------------- render de cada capa
const show = (key, occ = null) => page.evaluate((key, occ) => {
  for (const el of document.querySelectorAll("[data-capa]")) {
    const on = el.dataset.capa === key || (occ && (el.dataset.occ || "").split(" ").includes(occ));
    el.style.display = on ? "" : "none";
  }
  // caja de lo visible
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const el of document.querySelectorAll(`[data-capa="${key}"]`)) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
  }
  return [x0, y0, x1, y1];
}, key, occ);
const clipOf = ([x0, y0, x1, y1], pad = 6) => {
  const x = Math.max(0, Math.floor(x0 - pad)), y = Math.max(0, Math.floor(y0 - pad));
  return { x, y, width: Math.min(W, Math.ceil(x1 + pad)) - x, height: Math.min(H, Math.ceil(y1 + pad)) - y };
};

fs.mkdirSync(OUT, { recursive: true });
const manifest = { size: [W, H], offset: OFFSET, shift: SHIFT, base: "base.webp", stations: {}, labels: {}, lines: [], dots: [] };
const kb = (f) => `${(fs.statSync(f).size / 1024).toFixed(0)} KB`;

// base: opaca sobre blanco
await show("base");
{
  const png = await page.screenshot({ type: "png", omitBackground: true, captureBeyondViewport: false });
  const f = path.join(OUT, "base.webp");
  await sharp(png).flatten({ background: "#ffffff" }).webp({ quality: 82, effort: 6, smartSubsample: true }).toFile(f);
  console.log("base", kb(f));
}
const jpg = sharp(SRC_JPG);
for (const z of ZONES) {
  // ilustración
  const box = await show(`st:${z.id}`);
  if (Number.isFinite(box[0])) {
    const clip = clipOf(box);
    let png = await page.screenshot({ type: "png", omitBackground: true, clip });
    if (plan.occ[z.id]) {
      // con las piezas que la tapan, recortado a la silueta de la estación sola (engrosada 1-2 px por el antialias)
      const fp = await sharp(png).extractChannel(3).blur(1.2).threshold(4).raw().toBuffer();
      await show(`st:${z.id}`, z.id);
      const { data, info } = await sharp(await page.screenshot({ type: "png", omitBackground: true, clip })).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < fp.length; i++) data[i * 4 + 3] = (data[i * 4 + 3] * fp[i]) / 255;
      png = await sharp(data, { raw: info }).png().toBuffer();
    }
    const f = path.join(OUT, `st-${z.id}.webp`);
    await sharp(png).webp({ quality: 88, alphaQuality: 90, effort: 6 }).toFile(f);
    manifest.stations[z.id] = { src: `st-${z.id}.webp`, rect: [clip.x, clip.y, clip.width, clip.height] };
    console.log(`st-${z.id}`, kb(f), clip);
  } else console.warn("sin ilustración:", z.id);
  // etiqueta: forma del SVG, píxeles del JPG
  for (const key of [z.id]) await label(key);
}
await label("captions");
async function label(key) {
  const box = await show(`lb:${key}`);
  if (!Number.isFinite(box[0])) return console.warn("sin etiqueta:", key);
  const grow = key === "captions" ? 7 : 2.5; // las leyendas son texto suelto: el Gotham del JPG no calza con la letra del render
  const clip = clipOf(box, Math.ceil(grow * 2) + 2);
  const png = await page.screenshot({ type: "png", omitBackground: true, clip });
  // máscara: alfa del render, engrosada (alrededor el JPG es blanco o trae las mismas líneas de la base: no se nota)
  const alpha = await sharp(png).extractChannel(3).blur(grow).threshold(6).blur(0.8).toBuffer();
  const rgb = await jpg.clone().extract({ left: clip.x, top: clip.y, width: clip.width, height: clip.height }).removeAlpha().toBuffer();
  const f = path.join(OUT, `lb-${key}.webp`);
  await sharp(rgb).joinChannel(alpha).webp({ quality: 90, alphaQuality: 95, effort: 6 }).toFile(f);
  manifest.labels[key] = { src: `lb-${key}.webp`, rect: [clip.x, clip.y, clip.width, clip.height] };
  console.log(`lb-${key}`, kb(f), clip);
}

// vectores: sólo lo necesario para la página (path en coordenadas del SVG + su matriz al JPG)
manifest.lines = vectors.lines.map(({ tag, m, d, points, x1, y1, x2, y2, stroke, width, dash, a, b, len }) => ({ tag, m, d, points, x1, y1, x2, y2, stroke, width, dash, a, b, len }));
manifest.dots = vectors.dots.map(({ tag, m, d, points, cx, cy, r, rx, ry, x, y, width, height, fill, c }) => ({ tag, m, d, points, cx, cy, r, rx, ry, x, y, width, height, fill, c }));
// los datos van como módulo JS (el build lo versiona con ?v=<hash> como el resto del código)
const DATA = path.join(ROOT, "js/infografia-capas.js");
fs.writeFileSync(DATA, `// Generado por tools/capas-infografia.mjs: no editar a mano.
// Capas de assets/infografia-capas/ (px del JPG ${W}×${H}) y líneas de flujo como vectores.
export default ${JSON.stringify(manifest)};
`);
console.log("js/infografia-capas.js", kb(DATA));
await browser.close();
