// Silueta interior de la carcasa del chancador de conos del módulo 3 (estación 2.2), para recortar el corte del cono:
// la unión de las piezas impresas del cono en el dibujo de Emilio (caja de alimentación, plataforma, cuerpo facetado,
// embudo y cuello de atrás), encogida el ancho de un trazo (2,73 u). Así el corte queda por dentro del contorno impreso
// y nada sobresale de la carcasa. Escribe CONE_CLIP en js/stations/secundario-geo.js (unidades del SVG).
//
// Uso (puppeteer-core y sharp no son dependencias del proyecto, se instalan aparte):
//   npm i --no-save sharp@0.35.5 puppeteer-core
//   node tools/silueta-cono.mjs                  (CHROME=<ruta a chrome.exe> si no está en la ruta por defecto)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = async (name, env) => import(process.env[env] ? pathToFileURL(process.env[env]).href : name);
const { default: puppeteer } = await req("puppeteer-core", "PUPPETEER");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const SVG = path.join(ROOT, "assets/secundario/chancado-secundario.svg");
const GEO = path.join(ROOT, "js/stations/secundario-geo.js");
const HOPPER = [0, 0, 1, 0, 1, 3, 0, 20];   // grupo del cono del módulo 3 (MODS[3].path + hopper, ver chancado-secundario.js)
const BOX = [990, 310, 180, 190];           // zona que se rasteriza (unidades del SVG)
const PX = 8;                               // px por unidad
const STROKE = 2.73;                        // ancho del trazo del dibujo
const TOL = 0.25;                           // tolerancia de la simplificación (unidades)

const src = fs.readFileSync(SVG, "utf8");
const b = await puppeteer.launch({ executablePath: CHROME, headless: true });
const p = await b.newPage();
const [W, H] = [BOX[2] * PX, BOX[3] * PX];
await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await p.setContent(`<!doctype html><style>html,body{margin:0;background:#fff}svg{display:block}</style>${src}`);
await p.evaluate((HOPPER, BOX, W, H) => {
  const svg = document.querySelector("svg");
  svg.setAttribute("viewBox", BOX.join(" ")); svg.setAttribute("width", W); svg.setAttribute("height", H);
  const kids = (n) => [...n.children].filter((c) => !["defs", "style", "title", "metadata"].includes(c.tagName));
  const g = HOPPER.reduce((n, i) => kids(n)[i], svg);
  // sólo el grupo del cono, todo en negro (relleno y trazo: el borde exterior cuenta)
  svg.querySelectorAll("*").forEach((n) => { if (!["svg", "defs", "style"].includes(n.tagName) && !n.contains(g) && !g.contains(n)) n.style.display = "none"; });
  g.querySelectorAll("*").forEach((n) => { if (n.style.display !== "none") { n.style.fill = "#000"; n.style.stroke = "#000"; } });
}, HOPPER, BOX, W, H);
const png = await p.screenshot({ type: "png", encoding: "binary" });
await b.close();

// binario (negro = carcasa)
const { default: sharp } = await req("sharp", "SHARP");
const { data } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
const inside = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) inside[i] = data[i] < 128 ? 1 : 0;
// rellena huecos interiores (ventanas entre piezas): todo lo que no se alcanza desde el borde por fuera es carcasa
{
  const seen = new Uint8Array(W * H), st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) { const i = st.pop(); if (seen[i] || inside[i]) continue; seen[i] = 1; const x = i % W, y = (i / W) | 0;
    if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W); }
  for (let i = 0; i < W * H; i++) if (!seen[i]) inside[i] = 1;
}
// erosión: distancia euclidiana al exterior (dos pasadas de Felzenszwalb) > ancho del trazo
const INF = 1e12, d2 = new Float64Array(W * H);
for (let i = 0; i < W * H; i++) d2[i] = inside[i] ? INF : 0;
const dt1 = (f, n) => { const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1); let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) { let s; do { const r = v[k]; s = (f[q] + q * q - (f[r] + r * r)) / (2 * q - 2 * r); if (s <= z[k]) k--; else break; } while (k >= 0); k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; } return d; };
for (let x = 0; x < W; x++) { const col = new Float64Array(H); for (let y = 0; y < H; y++) col[y] = d2[y * W + x]; const r = dt1(col, H); for (let y = 0; y < H; y++) d2[y * W + x] = r[y]; }
for (let y = 0; y < H; y++) { const row = d2.subarray(y * W, y * W + W); const r = dt1(Float64Array.from(row), W); row.set(r); }
const R2 = (STROKE * PX) ** 2;
const m = (x, y) => (x >= 0 && y >= 0 && x < W && y < H && d2[y * W + x] > R2 ? 1 : 0);
// contorno (seguimiento de borde por cuadrados, Moore) del componente más grande
let start = -1, best = 0;
{
  const lab = new Int32Array(W * H); let id = 0;
  for (let i = 0; i < W * H; i++) { if (!m(i % W, (i / W) | 0) || lab[i]) continue; id++; let n = 0; const st = [i];
    while (st.length) { const j = st.pop(); if (lab[j] || !m(j % W, (j / W) | 0)) continue; lab[j] = id; n++; const x = j % W, y = (j / W) | 0;
      if (x > 0) st.push(j - 1); if (x < W - 1) st.push(j + 1); if (y > 0) st.push(j - W); if (y < H - 1) st.push(j + W); }
    if (n > best) { best = n; start = i; } }
}
const pts = [];
{
  // seguimiento de borde de Moore (8 vecinos, horario) desde el píxel más alto a la izquierda del componente
  const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const sx = start % W, sy = (start / W) | 0;
  let cx = sx, cy = sy, back = 4;
  do {
    pts.push([cx, cy]);
    let moved = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8, nx = cx + N8[d][0], ny = cy + N8[d][1];
      if (m(nx, ny)) { cx = nx; cy = ny; back = d % 2 ? (d + 5) % 8 : (d + 6) % 8; moved = true; break; }
    }
    if (!moved) break;
  } while (!(cx === sx && cy === sy) && pts.length < 1e6);
}
// Douglas–Peucker en unidades del SVG
const U = pts.map(([x, y]) => [BOX[0] + (x + 0.5) / PX, BOX[1] + (y + 0.5) / PX]);
function dp(a, i, j, out) {
  let k = -1, dm = 0; const [x1, y1] = a[i], [x2, y2] = a[j], L = Math.hypot(x2 - x1, y2 - y1) || 1;
  for (let t = i + 1; t < j; t++) { const d = Math.abs((x2 - x1) * (y1 - a[t][1]) - (x1 - a[t][0]) * (y2 - y1)) / L; if (d > dm) { dm = d; k = t; } }
  if (dm > TOL) { dp(a, i, k, out); dp(a, k, j, out); } else out.push(a[j]);
}
const half = Math.floor(U.length / 2), simp = [U[0]];
dp(U, 0, half, simp); dp(U.concat([U[0]]), half, U.length, simp);
const d = "M" + simp.slice(0, -1).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";
let geo = fs.readFileSync(GEO, "utf8").replace(/\n\/\/ Silueta interior de la carcasa del cono[\s\S]*$/, "");
geo += `\n// Silueta interior de la carcasa del cono (módulo 3): unión de sus piezas impresas encogida un trazo; recorta el corte
// del cono. Generada con tools/silueta-cono.mjs.
export const CONE_CLIP = "${d}";\n`;
fs.writeFileSync(GEO, geo);
console.log(`CONE_CLIP: ${simp.length - 1} vértices`);
