// Build de producción → dist/ (lo que se publica en Vercel o se copia a cowork.ceim.cl/ar2d/).
// El sitio sigue funcionando SIN build desde la raíz (npm run dev): esto sólo optimiza una copia.
//   · JS propio y three: minificados con esbuild, archivo por archivo (sin empaquetar: se mantienen los import()
//     dinámicos de las estaciones y las rutas relativas). mindar ya viene minificado y se copia tal cual.
//   · CSS minificado.
//   · SVG pasados por SVGO con plugins que NO agregan ni quitan elementos: rig.js y las estaciones ubican piezas
//     por id, por clase y por posición entre hermanos (children[i]); todo eso queda igual. Se vacía el <metadata>
//     (manifiesto C2PA de Illustrator, ~7,6 KB por archivo, no se usa) pero el elemento se conserva.
//   · Versionado: cada JS/CSS se sirve como archivo.js?v=<hash del contenido>. Los import relativos ("./rig.js")
//     se redirigen a su versión con el importmap de index.html (claves con URL relativa), así que el código no
//     cambia y las rutas siguen siendo relativas (sirve igual desde /ar2d/). Con eso pueden ir con caché larga
//     e immutable (vercel.json): al cambiar un archivo cambia su hash y el navegador lo pide de nuevo.
//   · sw.js recibe la versión del build y la lista de archivos a precachear (ver sw.js).
import { build as esbuild, transform } from "esbuild";
import { optimize } from "svgo";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);

// lo que NO se publica (queda en el repo como fuente o herramienta)
const SKIP = [
  /^assets\/caex\/giro-generado\//, // fotogramas exportados para revisar en Illustrator (tools/generar-giro-caex.mjs)
  /^assets\/target-[\w-]+\.png$/,   // recortes para compilar targets.mind (tools/compilar-marcador.html)
  /^assets\/infografia\.jpg$/,      // original CMYK: se publican infografia.avif/.webp/-srgb.jpg
  /^assets\/procesominero_sin_ar\.(svg|jpg)$/, // fuente de assets/infografia-capas/ (tools/capas-infografia.mjs)
];
const FILES = ["index.html", "bench.html", "sw.js", "manifest.webmanifest", ...["css", "js", "vendor", "assets"].flatMap((d) => walk(path.join(ROOT, d)).map(rel))]
  .filter((f) => fs.existsSync(path.join(ROOT, f)) && !SKIP.some((re) => re.test(f)));

const SVGO = {
  multipass: false,
  plugins: [
    "removeDoctype", "removeXMLProcInst", "removeComments", "cleanupAttrs", "removeEmptyAttrs",
    { name: "cleanupNumericValues", params: { floatPrecision: 3 } },
    { name: "convertPathData", params: { floatPrecision: 3 } },
    "convertColors",
    { name: "minifyStyles", params: { restructure: false, usage: false } },
    "removeUnusedNS",
    { name: "emptyMetadata", fn: () => ({ element: { enter: (node) => { if (node.name === "metadata") node.children = []; } } }) },
  ],
};

const t0 = performance.now();
// se vacía el contenido (no la carpeta: en Windows no se puede borrar si un servidor local la tiene abierta)
fs.mkdirSync(DIST, { recursive: true });
for (const e of fs.readdirSync(DIST)) fs.rmSync(path.join(DIST, e), { recursive: true, force: true });
const stats = { js: [0, 0], css: [0, 0], svg: [0, 0], otros: [0, 0] };
const versions = {};  // ruta → hash (JS y CSS)
const all = createHash("sha256"); // contenido de TODO lo publicado: define la versión del build (y del SW)
for (const f of FILES) {
  const src = path.join(ROOT, f), out = path.join(DIST, f);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const raw = fs.readFileSync(src);
  let data = raw, kind = "otros";
  if (f.endsWith(".js") && f !== "sw.js") {
    kind = "js";
    if (!/^vendor\/mindar\//.test(f)) {
      // sin empaquetar: cada módulo se minifica solo; los nombres exportados no cambian
      data = Buffer.from((await transform(raw.toString(), { loader: "js", format: "esm", minify: true, target: "es2022", legalComments: "none" })).code);
    }
    versions[f] = hash(data);
  } else if (f.endsWith(".css")) {
    kind = "css";
    data = Buffer.from((await transform(raw.toString(), { loader: "css", minify: true })).code);
    versions[f] = hash(data);
  } else if (f.endsWith(".svg")) {
    kind = "svg";
    data = Buffer.from(optimize(raw.toString(), { path: f, ...SVGO }).data);
  }
  stats[kind][0] += raw.length; stats[kind][1] += data.length;
  if (!/^(index|bench)\.html$|^sw\.js$/.test(f)) all.update(f).update(data);
  fs.writeFileSync(out, data);
}

// importmap con cada módulo versionado + three; script y hoja de estilo con ?v=
const v = (f) => `./${f}?v=${versions[f]}`;
const imports = { three: v("vendor/three.module.js"), "three/addons/": "./vendor/addons/" };
for (const f of Object.keys(versions).filter((f) => f.endsWith(".js"))) {
  imports[`./${f}`] = v(f);
  if (f.startsWith("vendor/addons/")) imports[`three/addons/${f.slice("vendor/addons/".length)}`] = v(f);
}
all.update(fs.readFileSync(path.join(ROOT, "index.html"))).update(fs.readFileSync(path.join(ROOT, "sw.js")));
const BUILD = all.digest("hex").slice(0, 10); // cambia con cualquier archivo publicado (SVG, marcadores, HTML…)
for (const page of ["index.html", "bench.html"]) {
  const p = path.join(DIST, page);
  let html = fs.readFileSync(p, "utf8");
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">${JSON.stringify({ imports })}</script>`);
  html = html.replace(/(src|href)="(js\/[\w/-]+\.js|css\/[\w/-]+\.css)"/g, (m, a, f) => (versions[f] ? `${a}="${v(f).slice(2)}"` : m));
  html = html.replace("<html lang=\"es\">", `<html lang="es" data-build="${BUILD}">`);
  fs.writeFileSync(p, html);
}

// service worker: versión y lista de archivos (los JS/CSS con su ?v=, igual que los pedirá la página)
const precache = FILES.filter((f) => !/^(sw\.js|bench\.html)$/.test(f) && !/^js\/(bench|perf)\.js$/.test(f))
  .map((f) => (versions[f] ? v(f).slice(2) : f));
const swPath = path.join(DIST, "sw.js");
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, "utf8").replace('"__BUILD__"', JSON.stringify(BUILD)).replace("[/*__PRECACHE__*/]", JSON.stringify(precache));
  fs.writeFileSync(swPath, (await transform(sw, { loader: "js", minify: true, target: "es2020" })).code);
}

const kb = (n) => `${(n / 1024).toFixed(0).padStart(6)} KB`;
console.log(`dist/ listo en ${((performance.now() - t0) / 1000).toFixed(1)} s · build ${BUILD} · ${FILES.length} archivos`);
for (const [k, [a, b]] of Object.entries(stats)) console.log(`  ${k.padEnd(6)} ${kb(a)} → ${kb(b)}  (${a ? ((1 - b / a) * 100).toFixed(0) : 0} % menos)`);
