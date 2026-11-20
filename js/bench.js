// Banco de rendimiento (bench.html): monta las 10 láminas del AR a la vez, animadas, en su lugar sobre la
// infografía, como la vista general (OVERVIEW) del AR pero sin cámara ni seguimiento. Usa las mismas fábricas que
// app.js (createRajo, createSecundario…), las mismas clases *-plate--ar y la misma sombra horneada.
// El HUD de js/perf.js mide cuadro, JS por cuadro y tareas largas; window.pmBench guarda cuánto tardó cada lámina
// en armarse (fábrica + horneado), para encontrar los tirones de la primera apertura.
import "./perf.js";
import { mountRig, GEO } from "./rig.js";
import { createLive } from "./live.js";
import { bake } from "./halo.js";

const q = new URLSearchParams(location.search);
const ONLY = q.get("only")?.split(",").filter(Boolean);
const ANIMATE = !q.has("static");
const world = document.querySelector("[data-world]");
const logEl = document.querySelector("[data-log]");
if (q.has("noposter")) world.classList.add("no-poster");

// mismas fábricas y clases que AR_DEFS en app.js
const DEFS = [
  { id: "rajo", mod: "./stations/rajo.js", make: "createRajo", cls: "rajo-plate--ar" },
  { id: "mina-subterranea", mod: "./stations/mina-subterranea.js", make: "createMina", active: (m, v) => { m.setActive(v); if (v) { m.setXray(0, true); m.setXray(1); } } },
  { id: "chancado-primario", chancador: true },
  { id: "chancado-secundario", mod: "./stations/chancado-secundario.js", make: "createSecundario", cls: "sec-plate--ar" },
  { id: "pilas-lixiviacion", mod: "./stations/pilas-lixiviacion.js", make: "createPilas", cls: "lx-plate--ar" },
  { id: "concentradora", mod: "./stations/molienda.js", make: "createMolienda", cls: "mo-plate--ar" },
  { id: "celdas-flotacion", mod: "./stations/flotacion.js", make: "createFlotacion", cls: "fl-plate--ar" },
  { id: "electroobtencion", mod: "./stations/sx-ew.js", make: "createSxEw", cls: "sx-plate--ar" },
  { id: "fundicion", mod: "./stations/fundicion.js", make: "createFundicion", cls: "fu-plate--ar" },
  { id: "puerto", mod: "./stations/puerto.js", make: "createPuerto", cls: "pu-plate--ar" },
];

// registro del chancado primario sobre la infografía: las mismas cuentas que platePoster() en app.js
const STATION = { target: { w: 1140, h: 780, print: [506, 295] }, svgPoint: [650, 454], scale: 0.62 };
const CROP = { x: 580 * 2, y: 60 * 2, k: 1.5 / 2 };
const PRINT_ON_POSTER = [CROP.x + STATION.target.print[0] / CROP.k, CROP.y + STATION.target.print[1] / CROP.k];
const PLATE_W_ON_POSTER = (STATION.scale * STATION.target.w) / CROP.k;

const fit = () => {
  const k = Number(q.get("k")) || Math.min(innerWidth / 5497, innerHeight / 1623);
  world.style.transform = `translate(${((innerWidth - 5497 * k) / 2).toFixed(1)}px, ${((innerHeight - 1623 * k) / 2).toFixed(1)}px) scale(${k})`;
};
fit();
addEventListener("resize", fit);

const place = (el, cx, cy, k) => {
  el.style.left = "0px"; el.style.top = "0px";
  el.style.transformOrigin = "50% 50%";
  el.style.transform = `translate(${(cx - el.offsetWidth / 2).toFixed(1)}px, ${(cy - el.offsetHeight / 2).toFixed(1)}px) scale(${k})`;
  el.style.willChange = "transform"; // como los CSS3DObject del AR: cada lámina en su capa
};

async function buildChancado() {
  const html = await (await fetch("index.html")).text();
  const tpl = new DOMParser().parseFromString(html, "text/html").querySelector("#plate-tpl");
  const plate = document.importNode(tpl.content.firstElementChild, true);
  plate.classList.add("plate--bare", "ar-plate");
  const figure = plate.querySelector("[data-figure]");
  const mk = (tag) => document.createElement(tag);
  const ui = { readout: mk("div"), meter: mk("div"), inside: mk("input"), insideOut: mk("span"), feed: mk("input"), feedOut: mk("span"), stage: figure };
  plate.style.opacity = "0";
  world.appendChild(plate);
  const rig = await mountRig(figure, "assets/chancador_primario.svg");
  const live = createLive(rig, ui);
  const { shadow } = bake(plate, { svg: rig.svg, halo: { skip: ".pm-caex, .pm-picarrocas, .pm-rocks, .pm-dust, .pm-road-dust" }, ground: true });
  // centro de la lámina en px de la infografía (platePoster)
  const vb = GEO.view, pw = plate.offsetWidth, ph = plate.offsetHeight;
  const fx = figure.offsetLeft + ((STATION.svgPoint[0] - vb[0]) / vb[2]) * figure.offsetWidth;
  const fy = figure.offsetTop + ((STATION.svgPoint[1] - vb[1]) / vb[3]) * figure.offsetHeight;
  const k = PLATE_W_ON_POSTER / pw;
  const cx = PRINT_ON_POSTER[0] + k * (pw / 2 - fx), cy = PRINT_ON_POSTER[1] + k * (ph / 2 - fy);
  if (shadow) { world.insertBefore(shadow, plate); place(shadow, cx, cy, k); }
  place(plate, cx, cy, k);
  plate.style.opacity = "";
  window.pmLive = live;
  return { setActive: (v) => live.setActive(v) };
}

async function buildStation(D) {
  const mod = await import(D.mod);
  const s = await mod[D.make]();
  if (D.cls) s.el.classList.add(D.cls);
  s.el.classList.add("ar-plate");
  s.el.style.opacity = "0";
  world.appendChild(s.el);
  const { shadow } = bake(s.el, { ground: true });
  const L = parseFloat(s.el.style.left), T = parseFloat(s.el.style.top), W = parseFloat(s.el.style.width), H = parseFloat(s.el.style.height);
  const cx = L + W / 2, cy = T + H / 2;
  if (shadow) { world.insertBefore(shadow, s.el); place(shadow, cx, cy, 1); }
  place(s.el, cx, cy, 1);
  s.el.style.opacity = "";
  return { setActive: D.active ? (v) => D.active(s, v) : (v) => s.setActive(v) };
}

const built = [], log = [];
const t0 = performance.now();
for (const D of DEFS) {
  if (ONLY && !ONLY.includes(D.id)) continue;
  logEl.textContent = `armando ${D.id}…\n` + log.join("\n");
  const a = performance.now();
  try {
    const b = await (D.chancador ? buildChancado() : buildStation(D));
    built.push({ id: D.id, ...b });
    log.push(`${D.id.padEnd(20)} ${(performance.now() - a).toFixed(0).padStart(5)} ms`);
  } catch (err) {
    console.error(D.id, err);
    log.push(`${D.id.padEnd(20)} ERROR ${err.message}`);
  }
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}
if (ANIMATE) built.forEach((b) => b.setActive(true));
const total = performance.now() - t0;
logEl.textContent = `${built.length} láminas${ANIMATE ? ", animadas" : " (quietas)"} · armado ${total.toFixed(0)} ms\n` + log.join("\n");
window.pmPerf?.reset();
window.pmBench = { ready: true, total, stations: built.map((b) => b.id), log, setActive: (v) => built.forEach((b) => b.setActive(v)) };
