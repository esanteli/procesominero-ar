// Orquesta la experiencia: monta la lámina viva, la ancla sobre la infografía (AR) o la muestra
// sobre la imagen de la infografía (demo), y conecta el HUD con live.js.
import { mountRig, GEO } from "./rig.js";
import { createLive } from "./live.js";
import { STEPS } from "./caex.js";
import * as M from "./model.js";
import { bake } from "./halo.js";

// ---------------------------------------------------------------- registro lámina ↔ infografía
// El target (assets/target-chancado.png, 1140×780) es un recorte de la infografía alrededor de la estación 2.
// MindAR (anchor CSS) usa un espacio donde el ancho del target = 1000 px, origen al centro, y hacia arriba.
// La lámina se pone de modo que la tolva del SVG (650,454) quede sobre la tolva impresa (506,295 en el target).
const STATION = {
  target: { w: 1140, h: 780, print: [506, 295] }, // dónde está la tolva en el target, en px del target
  svgPoint: [650, 454],                            // la misma tolva en el SVG
  lift: 30,                                         // la lámina flota 30 px sobre el papel
  scale: 0.62,                                      // tamaño de la lámina: 1 = 1000 px = ancho del target
};

// ---------------------------------------------------------------- fichas de equipos
const EQUIP = {
  caex: {
    kicker: "Transporte",
    title: "CAEX · camión de extracción",
    text: "Trae el mineral desde el rajo. Retrocede hasta la tolva del chancador, levanta su tolva con cilindros hidráulicos y vacía la carga.",
    specs: () => ["Carga ~300 t", "Tracción diésel‑eléctrica", "Descarga en ~1 min"],
  },
  picarrocas: {
    kicker: "Apoyo a la tolva",
    title: "Picarrocas",
    text: "Brazo hidráulico con martillo junto a la tolva. Rompe las colpas sobretamaño que quedan atrapadas en la parrilla para que no bloqueen la entrada al chancador.",
    specs: () => ["Martillo hidráulico", "Operación local o remota", "Actúa tras cada descarga"],
  },
  chancador: {
    kicker: "Chancado primario",
    title: "Chancador giratorio",
    text: "Reduce colpas de hasta ~1,5 m a menos de ~20 cm. El manto gira excéntrico dentro de las cóncavas y tritura la roca por compresión.",
    specs: (l) => [`Hasta ${M.fmt(M.CRUSHER_CAPACITY_TPH)} t/h`, `Excéntrica ${M.ECCENTRIC_RPM} rpm`, `Ahora ${M.fmt(l.flow)} t/h`],
    action: { label: "Explorar interior", run: () => live.toggleInside() },
  },
  correa: {
    kicker: "Transporte de producto",
    title: "Correa transportadora",
    text: "Recibe el mineral chancado bajo el chancador y lo lleva al acopio de gruesos, desde donde sigue a molienda o al chancado secundario.",
    specs: (l) => ["Producto bajo ~200 mm", "Velocidad típica 2–4 m/s", `Ahora ${M.fmt(l.flow)} t/h`],
  },
};

const $ = (s, el = document) => el.querySelector(s);
const ui = {
  readout: $("[data-readout]"),
  meter: $("[data-meter]"),
  inside: $("[data-inside]"),
  insideOut: $("[data-inside-out]"),
  feed: $("[data-feed]"),
  feedOut: $("[data-feed-out]"),
  status: $("[data-status]"),
};

// ---------------------------------------------------------------- controles de la secuencia
const playBtn = $("[data-play]");
const stepsBox = $("[data-steps]");
const stepBtns = STEPS.map((s) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "seq-step";
  b.dataset.step = s.n;
  b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`);
  b.innerHTML = "<i></i>";
  stepsBox.appendChild(b);
  return b;
});
ui.onSeq = ({ playing, step }) => {
  playBtn.setAttribute("aria-pressed", String(playing));
  playBtn.setAttribute("aria-label", playing ? "Pausar la secuencia del CAEX" : "Reproducir la secuencia del CAEX");
  $("[data-step-n]").textContent = step.n;
  $("[data-step-label]").textContent = step.label;
  stepBtns.forEach((b) => b.toggleAttribute("data-done", Number(b.dataset.step) < step.n));
  stepBtns.forEach((b) => b.toggleAttribute("data-current", Number(b.dataset.step) === step.n));
};
ui.seqProgress = (n, p) => stepBtns[n - 1].style.setProperty("--p", p.toFixed(3));

// ---------------------------------------------------------------- ficha del equipo seleccionado
const info = $("[data-info]");
let infoTimer = 0;
function renderInfo(id) {
  const e = EQUIP[id];
  $("[data-info-kicker]").textContent = e.kicker;
  $("[data-info-title]").textContent = e.title;
  $("[data-info-text]").textContent = e.text;
  $("[data-info-specs]").innerHTML = e.specs(live.live()).map((s) => `<li>${s}</li>`).join("");
  const actions = $("[data-info-actions]");
  actions.innerHTML = "";
  if (e.action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "info-action";
    b.textContent = e.action.label;
    b.addEventListener("click", e.action.run);
    actions.appendChild(b);
  }
}
ui.onSelect = (id) => {
  clearInterval(infoTimer);
  document.querySelectorAll("[data-equip-chip]").forEach((c) => c.toggleAttribute("data-on", c.dataset.equipChip === id));
  if (!id) { info.hidden = true; return; }
  renderInfo(id);
  info.hidden = false;
  infoTimer = setInterval(() => renderInfo(id), 1000); // las cifras en vivo se refrescan
};

const plate = $("#plate-tpl").content.firstElementChild.cloneNode(true);
plate.classList.add("plate--bare"); // sin tarjeta blanca: el dibujo va directo sobre la infografía, con contorno blanco
const figure = $("[data-figure]", plate);
ui.stage = figure;
const rig = await mountRig(figure, "assets/chancador_primario.svg");
const live = createLive(rig, ui);
window.pmLive = live; // acceso para QA desde la consola
// contorno blanco + sombra del chancado primario (se hornea una vez, con la lámina ya en el documento)
const PLATE_ANIMATED = ".pm-caex, .pm-picarrocas, .pm-rocks, .pm-dust, .pm-road-dust";
const bakePlate = (ground) => bake(plate, { svg: rig.svg, halo: { skip: PLATE_ANIMATED }, ground, paper: true, hull: true });

// ---------------------------------------------------------------- HUD
ui.inside.addEventListener("input", () => live.setInside(Number(ui.inside.value) / 100));
ui.feed.addEventListener("input", () => live.setFeed(Number(ui.feed.value)));
playBtn.addEventListener("click", () => live.togglePlay());
$("[data-prev]").addEventListener("click", () => live.prevStep());
$("[data-next]").addEventListener("click", () => live.nextStep());
stepBtns.forEach((b) => b.addEventListener("click", () => live.goStep(Number(b.dataset.step))));
document.querySelectorAll("[data-equip-chip]").forEach((chip) => {
  chip.addEventListener("click", () => live.select(live.selected === chip.dataset.equipChip ? null : chip.dataset.equipChip));
});
$("[data-info-close]").addEventListener("click", () => live.select(null));
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, [data-intro]") || document.body.dataset.mode === "intro" || e.defaultPrevented) return;
  // otras vistas (mapa, ficha, rajo…): sus módulos manejan sus teclas; aquí sólo Escape vuelve al mapa
  if (document.body.dataset.view && document.body.dataset.view !== "chancador") {
    if (e.key === "Escape") { explorer?.back(); e.preventDefault(); }
    return;
  }
  const feed = Number(ui.feed.value), inside = Number(ui.inside.value) / 100;
  if (e.key === " " && !e.target.closest("button, [data-equip]")) live.togglePlay();
  else if (e.key === "," ) live.prevStep();
  else if (e.key === ".") live.nextStep();
  else if (/^[1-6]$/.test(e.key)) live.goStep(Number(e.key));
  else if (e.key === "ArrowRight") live.setFeed(feed + 250);
  else if (e.key === "ArrowLeft") live.setFeed(feed - 250);
  else if (e.key === "ArrowUp") live.setInside(inside + 0.1);
  else if (e.key === "ArrowDown") live.setInside(inside - 0.1);
  else if (e.key === "Escape") {
    if (document.body.dataset.view !== "chancador" || (!live.selected && Number(ui.inside.value) === 0)) explorer?.back();
    live.select(null); live.setInside(0);
  }
  else return;
  e.preventDefault();
});

// alto real del HUD → la escena demo / escaneo / lámina fijada usan el espacio que queda libre
const panel = $("[data-panel]");
const sizeHud = () => {
  document.documentElement.style.setProperty("--hud-h", `${panel.offsetHeight + 8}px`);
  const room = document.querySelector("[data-pin-layer]").getBoundingClientRect();
  const pe = document.querySelector(".plate--pinned") || plate;
  const s = Math.min((innerWidth - 24) / (pe.offsetWidth || 1000), (innerHeight - 64 - panel.offsetHeight - 24) / (pe.offsetHeight || 760));
  document.documentElement.style.setProperty("--pin-s", Math.max(0.2, s).toFixed(3));
  void room;
};
new ResizeObserver(sizeHud).observe(panel);
addEventListener("resize", sizeHud);

// ---------------------------------------------------------------- posición de la lámina en la infografía
// La lámina del chancado es una ampliación: su tolva (STATION.svgPoint) va sobre la tolva impresa (PRINT_ON_POSTER) y
// mide PLATE_W_ON_POSTER px de ancho en la infografía. Devuelve su centro en px de la infografía, cuántos px de la
// infografía mide cada px de la lámina (k) y el centro del contenedor del dibujo (donde va su sombra).
function platePoster() {
  const vb = GEO.view;
  const pw = plate.offsetWidth, ph = plate.offsetHeight;
  const fx = figure.offsetLeft + ((STATION.svgPoint[0] - vb[0]) / vb[2]) * figure.offsetWidth;
  const fy = figure.offsetTop + ((STATION.svgPoint[1] - vb[1]) / vb[3]) * figure.offsetHeight;
  const k = PLATE_W_ON_POSTER / pw;
  const cx = PRINT_ON_POSTER[0] + k * (pw / 2 - fx), cy = PRINT_ON_POSTER[1] + k * (ph / 2 - fy);
  // la sombra cubre el dibujo (el contenedor del SVG), que no está centrado en la lámina
  const pr = plate.getBoundingClientRect(), hr = rig.svg.parentNode.getBoundingClientRect(), u = pw / pr.width || 1;
  const dx = (hr.left + hr.width / 2 - pr.left - pr.width / 2) * u, dy = (hr.top + hr.height / 2 - pr.top - pr.height / 2) * u;
  return { cx, cy, k, w: pw * k, h: ph * k, gx: cx + dx * k, gy: cy + dy * k };
}

// ---------------------------------------------------------------- intro / modos
const intro = $("[data-intro]");
const note = $("[data-ar-note]");
const canAR = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
// los botones vienen deshabilitados en el HTML: se activan recién cuando la app está lista para responder
$("[data-start-demo]").addEventListener("click", startDemo, { once: true });
$("[data-start-ar]").addEventListener("click", startAR, { once: true });
$("[data-start-demo]").disabled = false;
$("[data-start-ar]").disabled = !canAR;
note.textContent = canAR ? "" : "La cámara necesita HTTPS (o localhost). Abre la demo o publica la carpeta en un servidor seguro.";
if (new URLSearchParams(location.search).has("demo")) startDemo();

function setMode(mode) {
  document.body.dataset.mode = mode;
  intro.hidden = true;
}

// ---------------------------------------------------------------- DEMO: la infografía completa, navegable por estaciones
// El target del chancador es un recorte ×1,5 de la infografía desde (580, 60) en la escala vieja (3012×812);
// la imagen actual mantiene el mismo registro a escala uniforme ×2 (5497×1623 ≈ el mismo arte a 2×, recortado
// de espacio en blanco sobrante), así que el recorte se reescala con el mismo factor ×2.
const CROP = { x: 580 * 2, y: 60 * 2, k: 1.5 / 2 };
const PRINT_ON_POSTER = [CROP.x + STATION.target.print[0] / CROP.k, CROP.y + STATION.target.print[1] / CROP.k];
const PLATE_W_ON_POSTER = (STATION.scale * STATION.target.w) / CROP.k;
let explorer = null;

const chancadorStation = {
  enter({ layer }) {
    layer.appendChild(plate);
    plate.classList.add("plate--demo");
    plate.style.transform = "none";
    if (!plate.dataset.baked) { bakePlate(false); plate.dataset.baked = "1"; }
    const vb = GEO.view;
    const fx = figure.offsetLeft + ((STATION.svgPoint[0] - vb[0]) / vb[2]) * figure.offsetWidth;
    const fy = figure.offsetTop + ((STATION.svgPoint[1] - vb[1]) / vb[3]) * figure.offsetHeight;
    const k = PLATE_W_ON_POSTER / plate.offsetWidth;
    const x = PRINT_ON_POSTER[0] - k * fx, y = PRINT_ON_POSTER[1] - k * fy;
    plate.style.transformOrigin = "0 0";
    plate.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    live.setActive(true);
    return { focus: [x, y, plate.offsetWidth * k, plate.offsetHeight * k] };
  },
  leave() {
    live.select(null);
    live.setActive(false);
    plate.remove();
  },
};

const views = document.querySelectorAll("[data-panel-view]");
const backBtn = $("[data-back]");
function showView(view, st) {
  document.body.dataset.view = view;
  views.forEach((v) => (v.hidden = v.dataset.panelView !== view));
  backBtn.hidden = document.body.dataset.mode !== "demo" || view === "map";
  document.querySelectorAll("[data-station-list] .st-chip").forEach((c) => c.toggleAttribute("data-on", c.dataset.id === st?.id));
  if (view === "map") { ui.status.textContent = "Infografía · Proceso minero"; return; }
  ui.status.textContent = `Estación ${st.n} · ${st.name}`;
  if (view === "station") {
    $("[data-st-n]").textContent = st.n;
    $("[data-st-n]").dataset.tone = st.tone;
    $("[data-st-kicker]").textContent = `Estación ${st.n}`;
    $("[data-st-title]").textContent = st.name;
    $("[data-st-text]").textContent = st.text;
    $("[data-st-status]").textContent = st.status === "lista" ? "Animación lista" : "Animación en desarrollo";
    $("[data-st-status]").dataset.status = st.status;
    const { prev, next } = explorer.neighbours();
    $("[data-st-prev-label]").textContent = prev.name;
    $("[data-st-next-label]").textContent = next.name;
  }
}

async function startDemo() {
  setMode("demo");
  const stage = $("[data-explorer]");
  stage.hidden = false;
  const { STATIONS } = await import("./stations.js");
  const { createExplorer } = await import("./explorer.js");
  // lista de estaciones del panel
  const list = $("[data-station-list]");
  list.innerHTML = STATIONS.map((st) => `<button type="button" class="st-chip" role="listitem" data-id="${st.id}" data-tone="${st.tone}" data-status="${st.status}"><b>${st.n}</b><span>${st.name}</span>${st.status === "lista" ? '<i aria-label="animación lista"></i>' : ""}</button>`).join("");
  list.addEventListener("click", (e) => { const c = e.target.closest(".st-chip"); if (c) explorer.open(c.dataset.id); });
  explorer = createExplorer({ stage, builtins: { chancador: chancadorStation }, onView: showView });
  backBtn.addEventListener("click", () => explorer.back());
  $("[data-st-prev]").addEventListener("click", () => explorer.prev());
  $("[data-st-next]").addEventListener("click", () => explorer.next());
}

// ---------------------------------------------------------------- AR: MindAR + CSS3D (las láminas siguen siendo DOM: se pueden tocar)
// assets/targets.mind trae once marcadores. El 0 es la infografía completa (a ×0,4), para el plano general: va primero
// porque MindAR se queda con el primer marcador que coincide, y desde él las diez estaciones quedan bien ubicadas.
// Luego diez recortes de assets/infografia.jpg SIN traslape entre ellos (si dos recortes comparten zona impresa, MindAR
// confunde las estaciones): 1 chancado, 2 rajo, 3 mina, 4 secundario, 5 pilas, 6 molienda, 7 flotación, 8 SX-EW,
// 9 fundición, 10 puerto.
// Los rectángulos de abajo son esos recortes, en px de la
// infografía: así cada lámina, que vive en esas coordenadas, se ubica sobre su marcador sin más cuentas.
// Si se recompila targets.mind, sube MIND_VERSION (Vercel guarda /assets en caché un día).
// Rajo y mina usan recortes bajos y anchos que incluyen su etiqueta: MindAR achica cada marcador hasta ~256 px de lado
// corto para seguirlo, y en los recortes altos las líneas finas desaparecían (el rajo quedaba con 9/4 puntos de
// seguimiento y se perdía a cada rato; ahora 16/16). Los demás se compilan ampliados ×2 (ver tools/compilar-marcador.html).
const MIND_VERSION = "16";
// LIFT: cuánto flota cada lámina sobre el papel (el ancho del marcador mide 1000); su sombra y un parche blanco que
// tapa lo impreso quedan en el papel (z = 0). Poco: con 80 la lámina se veía ~6 % más grande y corrida al inclinar
// el celular, y no calzaba con el dibujo impreso.
const LIFT = 12;
const CH_TARGET = { x: 1560, y: 280, w: 500, h: 400 };
const RAJO_TARGET = { x: 200, y: 440, w: 1150, h: 420 };
const MINA_TARGET = { x: 1230, y: 1060, w: 600, h: 300 };
const SEC_TARGET = { x: 2000, y: 690, w: 700, h: 300 };
const LIX_TARGET = { x: 2200, y: 260, w: 730, h: 425 };
const MOL_TARGET = { x: 1950, y: 1000, w: 520, h: 420 };
const FLO_TARGET = { x: 2780, y: 700, w: 900, h: 500 };
const SXEW_TARGET = { x: 2950, y: 300, w: 760, h: 395 };
const FUN_TARGET = { x: 4085, y: 925, w: 640, h: 400 };
const PUE_TARGET = { x: 4180, y: 420, w: 960, h: 450 };
// ---------------------------------------------------------------- AR: un solo "mundo" con todas las láminas
// Las diez láminas se arman en la pantalla de precarga y viven juntas en un grupo CSS3D (world), en las coordenadas
// del marcador de la infografía completa (marcador 0: ancho 1000 = ancho de la infografía, origen al centro, y hacia
// arriba). El grupo se cuelga del marcador que MindAR esté siguiendo (uno a la vez): un sector o la infografía entera.
// Así, al reconocer un solo sector aparecen también las estaciones vecinas en su lugar, y en un plano general se ven
// todas. Lejos sólo hay animación (sin panel ni toques); la estación que llena el centro de la pantalla se vuelve
// interactiva. Las que quedan fuera de la pantalla se ocultan y se pausan.
const POSTER = { x: 0, y: 0, w: 5497, h: 1623 };
const KW = 1000 / POSTER.w;
// enfoque: fracción de la pantalla que debe ocupar una estación (centrada) para volverse interactiva, y para dejar de serlo
const FOCUS_IN = 0.26, FOCUS_OUT = 0.14;
// deformación máxima aceptada de una lámina en pantalla (borde más largo / borde opuesto)
const MAX_WARP = 1.7;
// objeto CSS3D de un elemento centrado en (cx, cy) px de la infografía; s = px de la infografía por px del elemento
function worldObj(el, cx, cy, s, z, CSS3DObject) {
  const o = flat(new CSS3DObject(el));
  o.position.set((cx - POSTER.w / 2) * KW, -(cy - POSTER.h / 2) * KW, z);
  o.scale.setScalar(s * KW);
  o.visible = false;
  el.style.pointerEvents = "none";        // CSS3DObject lo deja en "auto": sólo la estación enfocada se puede tocar
  return o;
}
// will-change: la lámina se rasteriza una vez y la GPU sólo la mueve; sin esto el navegador la volvía a dibujar
// entera cada vez que el seguimiento cambiaba su escala (cada cuadro).
function flat(o) { o.element.style.willChange = "transform"; return o; }
// la lámina flota LIFT sobre el papel, medido en su propio marcador (ancho 1000), se vea desde un sector o de lejos
const liftOf = (T) => (LIFT * T.w) / POSTER.w;
// caja de la lámina en el mundo [x0, x1, y0, y1], para medir cuánto de la pantalla ocupa
const boxOf = (cx, cy, w, h) => [(cx - w / 2 - POSTER.w / 2) * KW, (cx + w / 2 - POSTER.w / 2) * KW, -(cy + h / 2 - POSTER.h / 2) * KW, -(cy - h / 2 - POSTER.h / 2) * KW];
// estaciones de stations/*.js: módulo, fábrica, global de QA, clase AR, recorte de su marcador
const AR_DEFS = [
  { id: "rajo", view: "rajo", st: { n: "1", name: "Rajo" }, mod: "./stations/rajo.js", make: "createRajo", qa: "pmRajo", cls: "rajo-plate--ar", T: RAJO_TARGET },
  { id: "mina", view: "mina", st: { n: "1", name: "Mina subterránea" }, mod: "./stations/mina-subterranea.js", make: "createMina", qa: "pmMina", T: MINA_TARGET,
    // al aparecer, el haz de radiografía barre el terreno
    active: (m, v) => { m.setActive(v); if (v) { m.setXray(0, true); m.setXray(1); } } },
  { id: "secundario", view: "secundario", st: { n: "2.2", name: "Chancado secundario y terciario" }, mod: "./stations/chancado-secundario.js", make: "createSecundario", qa: "pmSec", cls: "sec-plate--ar", T: SEC_TARGET },
  { id: "pilas", view: "pilas", st: { n: "3", name: "Pilas de lixiviación" }, mod: "./stations/pilas-lixiviacion.js", make: "createPilas", qa: "pmPilas", cls: "lx-plate--ar", T: LIX_TARGET },
  { id: "molienda", view: "molienda", st: { n: "2", name: "Molino SAG y de bolas" }, mod: "./stations/molienda.js", make: "createMolienda", qa: "pmMol", cls: "mo-plate--ar", T: MOL_TARGET },
  { id: "flotacion", view: "flotacion", st: { n: "3", name: "Celdas de flotación" }, mod: "./stations/flotacion.js", make: "createFlotacion", qa: "pmFlo", cls: "fl-plate--ar", T: FLO_TARGET },
  { id: "sxew", view: "sxew", st: { n: "4", name: "Extracción por solvente y electroobtención" }, mod: "./stations/sx-ew.js", make: "createSxEw", qa: "pmSx", cls: "sx-plate--ar", T: SXEW_TARGET },
  { id: "fundicion", view: "fundicion", st: { n: "4", name: "Fundición" }, mod: "./stations/fundicion.js", make: "createFundicion", qa: "pmFu", cls: "fu-plate--ar", T: FUN_TARGET },
  { id: "puerto", view: "puerto", st: { n: "5", name: "Puerto" }, mod: "./stations/puerto.js", make: "createPuerto", qa: "pmPu", cls: "pu-plate--ar", T: PUE_TARGET },
];
let mindar = null, pinned = false, pinnedS = null, camera3 = null, V3 = null, world = null, host = null;
const arStations = [];   // { id, view, st, T, obj, objs, el, box, setActive, unfocus, shown }
window.pmAR = arStations; // QA desde la consola: láminas armadas y cuáles se ven (shown)
window.pmARState = () => ({ host: host?.i ?? null, focus: arCurrent?.id ?? null, ar: document.body.dataset.ar, shown: arStations.filter((S) => S.shown).map((S) => S.id) });
window.pmARBoxes = () => (world ? arStations.filter((S) => S.shown).map((S) => [S.id, screenBox(S).map((v) => +v.toFixed(2))]) : []);
let arCurrent = null, cssDirty = true;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const painted = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
function camMessage(err) {
  const n = err?.name || "";
  if (n === "NotAllowedError" || n === "SecurityError") return "Permiso de cámara denegado · actívalo en el navegador y recarga";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "No se encontró una cámara trasera";
  if (n === "NotReadableError") return "La cámara está ocupada por otra app";
  return "No se pudo abrir la cámara";
}
// salir del escaneo: se apaga la cámara y se recarga la página de inicio (libera la cámara, el seguimiento y las láminas)
const exitBtn = $("[data-exit-ar]");
exitBtn.addEventListener("click", () => {
  try { mindar?.stop(); } catch {}
  document.querySelectorAll("video").forEach((v) => v.srcObject?.getTracks?.().forEach((t) => t.stop()));
  const q = new URLSearchParams(location.search);
  q.delete("demo");
  location.replace(location.pathname + (q.size ? `?${q}` : ""));
});

// ---------------------------------------------------------------- armado de las láminas (en la precarga)
const ground = (o) => { o.element.style.pointerEvents = "none"; return o; };
function buildChancado(CSS3DObject) {
  // en el documento un instante para medirla y hornear su sombra; oculta con opacity (con visibility el horneado
  // salta los trazos y quedaba vacío)
  plate.style.opacity = "0";
  document.body.appendChild(plate);
  const { shadow } = bakePlate(true);
  plate.dataset.baked = "1";
  const P = platePoster();
  plate.remove();
  plate.style.opacity = "";
  plate.classList.add("ar-plate");
  const obj = worldObj(plate, P.cx, P.cy, P.k, liftOf(CH_TARGET), CSS3DObject);
  const objs = shadow ? [ground(worldObj(shadow, P.gx, P.gy, P.k, 0, CSS3DObject)), obj] : [obj];
  return { id: "chancado", view: "chancador", st: { n: "2", name: "Chancado Primario" }, T: CH_TARGET, obj, objs, el: plate,
    box: boxOf(P.cx, P.cy, P.w, P.h), setActive: (v) => live.setActive(v), unfocus: () => live.select(null) };
}
async function buildStation(D, CSS3DObject) {
  const mod = await import(D.mod);
  const s = await mod[D.make]();
  window[D.qa] = s;
  if (D.cls) s.el.classList.add(D.cls);
  s.el.classList.add("ar-plate");
  s.el.style.opacity = "0";
  document.body.appendChild(s.el);
  const { shadow } = bake(s.el, { ground: true });
  s.el.remove();
  s.el.style.opacity = "";
  // la lámina vive en px de la infografía (left/top/width/height): su centro va a ese mismo punto del mundo
  const L = parseFloat(s.el.style.left), Tp = parseFloat(s.el.style.top), W = parseFloat(s.el.style.width), H = parseFloat(s.el.style.height);
  s.el.style.left = "0px"; s.el.style.top = "0px";
  const cx = L + W / 2, cy = Tp + H / 2;
  const obj = worldObj(s.el, cx, cy, 1, liftOf(D.T), CSS3DObject);
  const objs = shadow ? [ground(worldObj(shadow, cx, cy, 1, 0, CSS3DObject)), obj] : [obj];
  mod.bindPanel(s, { onEscape: () => s.select(null) });
  return { id: D.id, view: D.view, st: D.st, T: D.T, obj, objs, el: s.el, box: boxOf(cx, cy, W, H),
    setActive: D.active ? (v) => D.active(s, v) : (v) => s.setActive(v), unfocus: () => s.select?.(null) };
}

// ---------------------------------------------------------------- precarga → cámara
const pre = $("[data-preload]");
function progress(done, total, label) {
  pre.querySelector("[data-preload-bar]").style.transform = `scaleX(${(done / total).toFixed(3)})`;
  pre.querySelector("[data-preload-text]").textContent = label;
}
function toDemo(msg) {
  pre.hidden = true;
  exitBtn.hidden = true;
  delete document.body.dataset.ar;
  ui.status.textContent = msg;
  return startDemo();
}
async function startAR() {
  setMode("ar");
  exitBtn.hidden = false;
  document.body.dataset.ar = "loading";
  pre.hidden = false;
  const scan = $("[data-scan]");
  const total = AR_DEFS.length + 4;    // motor, marcadores, diez láminas, cámara
  let done = 0;
  const task = async (label, fn) => { progress(done, total, label); await painted(); try { return await fn(); } finally { progress(++done, total, label); } };
  let THREE, CSS3DObject, mindSrc;
  try {
    await task("Cargando el motor de realidad aumentada…", async () => {
      THREE = await import("three");
      ({ CSS3DObject } = await import("three/addons/renderers/CSS3DRenderer.js"));
      await import("../vendor/mindar/mindar-image-three.prod.js");
    });
    // los marcadores se descargan aquí y MindAR los lee de memoria (no se bajan dos veces)
    mindSrc = await task("Descargando los marcadores de la infografía…", async () => {
      const res = await fetch(`assets/targets.mind?v=${MIND_VERSION}`);
      if (!res.ok) throw new Error(`targets.mind: HTTP ${res.status}`);
      return URL.createObjectURL(await res.blob());
    });
  } catch (err) {
    console.error(err);
    return toDemo("No se pudo cargar el AR · mostrando demo");
  }
  const n = AR_DEFS.length + 1;
  arStations.push(await task(`Preparando las animaciones · 1 de ${n} · Chancado Primario`, () => buildChancado(CSS3DObject)));
  for (const [i, D] of AR_DEFS.entries()) {
    try { arStations.push(await task(`Preparando las animaciones · ${i + 2} de ${n} · ${D.st.name}`, () => buildStation(D, CSS3DObject))); }
    catch (err) { console.error(`[AR] no se pudo armar ${D.id}`, err); }
  }

  mindar = new window.MINDAR.IMAGE.MindARThree({
    container: $("#ar"),
    imageTargetSrc: mindSrc,
    maxTrack: 1,
    uiLoading: "no", uiScanning: "no", uiError: "no",
    filterMinCF: 0.001, filterBeta: 5,   // poco temblor sin que la lámina se arrastre al mover el celular
    warmupTolerance: 3, missTolerance: 8, // aparece rápido y no parpadea con un desenfoque breve
  });
  const { renderer, cssRenderer, cssScene, camera } = mindar;
  camera3 = camera; V3 = new THREE.Vector3();
  // MindAR crea un WebGL a pantalla completa (antialias, ×densidad del equipo: ×3 en iPhone) que aquí no dibuja nada:
  // todo va en CSS3D. Se libera su memoria de GPU y se deja de redibujar.
  renderer.setPixelRatio(1); renderer.setSize(1, 1);
  renderer.setSize = renderer.setPixelRatio = () => {};
  renderer.domElement.style.display = "none";
  try { renderer.dispose(); renderer.forceContextLoss(); } catch {}

  world = new THREE.Group();
  world.matrixAutoUpdate = false;
  cssScene.add(world);
  for (const S of arStations) S.objs.forEach((o) => world.add(o));
  // marcadores: del espacio del mundo (infografía completa) al de cada marcador → escala y desplazamiento
  const HOSTS = [POSTER, CH_TARGET, ...AR_DEFS.map((D) => D.T)].map((T, i) => {
    const s = POSTER.w / T.w, M = new THREE.Matrix4().makeScale(s, s, s);
    M.setPosition(((POSTER.w / 2 - T.x - T.w / 2) * 1000) / T.w, (-(POSTER.h / 2 - T.y - T.h / 2) * 1000) / T.w, 0);
    return { i, T, M, anchor: mindar.addCSSAnchor(i) };
  });
  for (const H of HOSTS) {
    H.anchor.onTargetFound = () => {
      host = H;
      scan.hidden = true;
      document.body.dataset.tracking = "on";
    };
    H.anchor.onTargetUpdate = () => {
      if (host !== H) return;
      world.matrix.multiplyMatrices(H.anchor.group.matrix, H.M);
      cssDirty = true;
      updateView();
    };
    H.anchor.onTargetLost = () => {
      if (host !== H) return;
      host = null;
      for (const S of arStations) show(S, false);
      if (pinned) return;
      setFocus(null);
      scan.hidden = false;
      delete document.body.dataset.tracking;
    };
  }

  // MindAR pide la cámara sin resolución y los navegadores entregan 640×480: a esa resolución el arte de líneas finas
  // (sobre todo el rajo) casi no deja puntos y el seguimiento no se engancha. A 1280×720 el rajo aparece al instante.
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) =>
    gum(c?.video && typeof c.video === "object" ? { ...c, video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...c.video } } : c);
  try {
    await task("Abriendo la cámara…", () => mindar.start());
  } catch (err) {
    console.error(err);
    return toDemo(`${camMessage(err)} · mostrando demo`);
  }
  URL.revokeObjectURL(mindSrc);
  pre.hidden = true;
  scan.hidden = false;
  setFocus(null);
  $("[data-pin]").hidden = false;
  // CSS3D se redibuja sólo cuando el seguimiento movió algo (MindAR entrega ~30 poses/s; la pantalla va a 60–120 Hz)
  addEventListener("resize", () => { cssDirty = true; });
  const loop = () => {
    if (cssDirty) { cssDirty = false; cssRenderer.render(cssScene, camera); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // al volver a la app la cámara puede quedar pausada o cortada (iOS la corta en segundo plano)
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resumeCamera(); });
  addEventListener("pagehide", () => { try { mindar.stop(); } catch {} });
}

// ---------------------------------------------------------------- qué se ve y qué se puede tocar
// mostrar/ocultar una lámina (y su sombra) y pausar su animación cuando no se ve
function show(S, v) {
  if (S === pinnedS || S.shown === v) return;
  S.shown = v;
  S.objs.forEach((o) => { o.visible = v; });
  S.setActive(v);
  cssDirty = true;
}
// rectángulo de la lámina en pantalla, en coordenadas normalizadas (-1…1), y si su proyección es confiable
const P4 = [[0, 0], [0, 0], [0, 0], [0, 0]];
function screenBox(S) {
  const [x0, x1, y0, y1] = S.box;
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity, behind = false;
  camera3.updateMatrixWorld();
  [[x0, y1], [x1, y1], [x0, y0], [x1, y0]].forEach(([x, y], i) => {
    V3.set(x, y, 0).applyMatrix4(world.matrix).project(camera3);
    if (V3.z > 1) behind = true;
    P4[i][0] = V3.x; P4[i][1] = V3.y;
    a = Math.min(a, V3.x); b = Math.max(b, V3.x); c = Math.min(c, V3.y); d = Math.max(d, V3.y);
  });
  // Una pose estimada desde un marcador chico (un sector visto de lejos) puede venir algo inclinada, y en las estaciones
  // lejanas ese error crece: la lámina sale gigante y deformada. Si un borde mide mucho más que el opuesto, no se muestra.
  const len = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) || 1e-6;
  const top = len(P4[0], P4[1]), bot = len(P4[2], P4[3]), lef = len(P4[0], P4[2]), rig = len(P4[1], P4[3]);
  const warp = Math.max(top / bot, bot / top, lef / rig, rig / lef);
  return [a, b, c, d, behind || warp > MAX_WARP];
}
function updateView() {
  let best = null, bestScore = 0;
  for (const S of arStations) {
    const [a, b, c, d, bad] = screenBox(S);
    const vw = Math.min(b, 1) - Math.max(a, -1), vh = Math.min(d, 1) - Math.max(c, -1);
    const on = !bad && vw > 0 && vh > 0;
    show(S, on);
    if (!on) continue;
    const cover = (vw * vh) / 4;    // fracción de la pantalla que ocupa
    const mx = (Math.max(a, -1) + Math.min(b, 1)) / 2, my = (Math.max(c, -1) + Math.min(d, 1)) / 2;
    const mine = S === arCurrent;
    if (Math.abs(mx) > 0.6 || Math.abs(my) > 0.6 || cover < (mine ? FOCUS_OUT : FOCUS_IN)) continue;
    const score = cover * (mine ? 1.4 : 1);   // la enfocada se queda salvo que otra la supere con claridad
    if (score > bestScore) { best = S; bestScore = score; }
  }

  if (!pinned) setFocus(best);
}
// la estación enfocada recibe toques y su panel; las demás sólo se animan
function setFocus(S) {
  const state = S ? "focus" : host ? "overview" : "scan";
  if (S === arCurrent && document.body.dataset.ar === state) return;
  const prev = arCurrent;
  if (prev && prev !== S) {
    prev.unfocus?.();
    prev.el.style.pointerEvents = "none";
    prev.el.classList.remove("is-focus");
  }
  arCurrent = S;
  document.body.dataset.ar = state;
  if (S) {
    if (prev !== S) { S.el.style.pointerEvents = "auto"; S.el.classList.add("is-focus"); reraster(S); }
    showView(S.view, S.st);
  } else {
    ui.status.textContent = host ? "Vista general · acércate a una estación para interactuar" : "Buscando la infografía…";
  }
}
// una lámina rasterizada chica (vista de lejos) se ve borrosa al acercarse: al enfocarla se vuelve a rasterizar
function reraster(S) {
  S.objs.forEach((o) => { o.element.style.willChange = "auto"; });
  requestAnimationFrame(() => requestAnimationFrame(() => S.objs.forEach((o) => { o.element.style.willChange = "transform"; })));
}
let resuming = false;
async function resumeCamera() {
  const v = mindar?.video;
  if (!v || resuming) return;
  const track = v.srcObject?.getVideoTracks?.()[0];
  if (track?.readyState === "live") { if (v.paused) v.play().catch(() => {}); return; }
  resuming = true;
  ui.status.textContent = "Reanudando cámara…";
  try {
    try { mindar.stop(); } catch {}
    await mindar.start();
    ui.status.textContent = "Buscando la infografía…";
  } catch (err) {
    console.error(err);
    ui.status.textContent = `${camMessage(err)} · recarga la página`;
  }
  resuming = false;
}

// ---------------------------------------------------------------- fijar la lámina en pantalla (la enfocada)
const pinLayer = $("[data-pin-layer]");
$("[data-pin]").addEventListener("click", (e) => {
  const S = pinned ? pinnedS : arCurrent;
  if (!S) return;
  pinned = !pinned;
  pinnedS = pinned ? S : null;
  e.currentTarget.setAttribute("aria-pressed", String(pinned));
  if (pinned) {
    S.objs.forEach((o) => world.remove(o)); // CSS3D suelta el elemento (y su sombra)…
    pinLayer.hidden = false;
    pinLayer.appendChild(S.el);              // …y lo ponemos plano en pantalla
    S.el.style.transform = "";
    S.el.style.display = "";
    S.el.style.visibility = "visible";
    S.el.style.pointerEvents = "auto";
    S.el.classList.add("plate--pinned");
    document.body.dataset.ar = "focus";
    showView(S.view, S.st);
    sizeHud();
    $("[data-scan]").hidden = true;
    ui.status.textContent = "Lámina fijada en pantalla";
    S.setActive(true);
  } else {
    S.el.classList.remove("plate--pinned");
    pinLayer.hidden = true;
    S.objs.forEach((o) => world.add(o));
    S.shown = null;
    cssDirty = true;
    if (host) { updateView(); if (arCurrent) showView(arCurrent.view, arCurrent.st); }
    else { show(S, false); setFocus(null); $("[data-scan]").hidden = false; }
  }
});
