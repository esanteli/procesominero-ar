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
const PLATE_ANIMATED = ".pm-caex, .pm-picarrocas, .pm-rocks, .pm-dust";
const bakePlate = (ground) => bake(plate, { svg: rig.svg, halo: { skip: PLATE_ANIMATED }, ground });

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

// ---------------------------------------------------------------- posición de la lámina en el espacio del target
// El marcador del chancado (CH_TARGET, px de la infografía) es un recorte ajustado a la estación, sin traslape con
// las vecinas. La tolva impresa (PRINT_ON_POSTER) y el ancho de la lámina en la infografía se llevan a su espacio.
function plateOffset() {
  const vb = GEO.view;
  const pw = plate.offsetWidth, ph = plate.offsetHeight;
  const fx = (figure.offsetLeft) + ((STATION.svgPoint[0] - vb[0]) / vb[2]) * figure.offsetWidth;
  const fy = (figure.offsetTop) + ((STATION.svgPoint[1] - vb[1]) / vb[3]) * figure.offsetHeight;
  const T = CH_TARGET, s = 1000 / T.w;
  const px = (PRINT_ON_POSTER[0] - T.x - T.w / 2) * s, py = -(PRINT_ON_POSTER[1] - T.y - T.h / 2) * s; // y hacia arriba
  const k = (PLATE_W_ON_POSTER * s) / pw;
  return { x: px - k * (fx - pw / 2), y: py + k * (fy - ph / 2), pw: pw * k, ph: ph * k, k };
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
// assets/targets.mind trae diez marcadores, recortes de assets/infografia.jpg SIN traslape entre ellos (si dos recortes
// comparten zona impresa, MindAR confunde las estaciones): 0 chancado, 1 rajo, 2 mina, 3 secundario, 4 pilas,
// 5 molienda, 6 flotación, 7 SX-EW, 8 fundición, 9 puerto. Los rectángulos de abajo son esos recortes, en px de la
// infografía: así cada lámina, que vive en esas coordenadas, se ubica sobre su marcador sin más cuentas.
// Si se recompila targets.mind, sube MIND_VERSION (Vercel guarda /assets en caché un día).
// Rajo y mina usan recortes bajos y anchos que incluyen su etiqueta: MindAR achica cada marcador hasta ~256 px de lado
// corto para seguirlo, y en los recortes altos las líneas finas desaparecían (el rajo quedaba con 9/4 puntos de
// seguimiento y se perdía a cada rato; ahora 16/16). Los demás se compilan ampliados ×2 (ver tools/compilar-marcador.html).
const MIND_VERSION = "14";
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
// lámina en px de la infografía → objeto CSS3D sobre su marcador (ancho del marcador = 1000 en el espacio del ancla)
function onTarget(el, T, CSS3DObject) {
  const L = parseFloat(el.style.left), Tp = parseFloat(el.style.top), W = parseFloat(el.style.width), H = parseFloat(el.style.height);
  el.style.left = "0px"; el.style.top = "0px";
  const k = 1000 / T.w, o = flat(new CSS3DObject(el));
  o.position.set((L + W / 2 - T.x - T.w / 2) * k, -(Tp + H / 2 - T.y - T.h / 2) * k, LIFT);
  o.scale.setScalar(k);
  return o;
}
// will-change: la lámina se rasteriza una vez y la GPU sólo la mueve; sin esto el navegador la volvía a dibujar
// entera cada vez que el seguimiento cambiaba su escala (cada cuadro).
function flat(o) { o.element.style.willChange = "transform"; return o; }
// sombra horneada de la lámina, en el papel bajo ella (mismo centro y escala, z = 0)
function groundOf(shadow, o, CSS3DObject) {
  const g = flat(new CSS3DObject(shadow));
  shadow.style.pointerEvents = "none";
  g.position.set(o.position.x, o.position.y, 0);
  g.scale.copy(o.scale);
  return g;
}
// estaciones de estaciones/*.js: módulo, fábrica, global de QA, clase AR, recorte
const AR_DEFS = [
  { id: "rajo", view: "rajo", st: { n: "1", name: "Rajo" }, mod: "./stations/rajo.js", make: "createRajo", qa: "pmRajo", cls: "rajo-plate--ar", T: RAJO_TARGET },
  { id: "mina", view: "mina", st: { n: "1", name: "Mina subterránea" }, mod: "./stations/mina-subterranea.js", make: "createMina", qa: "pmMina", T: MINA_TARGET,
    // al encontrar el marcador, el haz de radiografía barre el terreno
    active: (m, v) => { m.setActive(v); if (v) { m.setXray(0, true); m.setXray(1); } } },
  { id: "secundario", view: "secundario", st: { n: "2.2", name: "Chancado secundario y terciario" }, mod: "./stations/chancado-secundario.js", make: "createSecundario", qa: "pmSec", cls: "sec-plate--ar", T: SEC_TARGET },
  { id: "pilas", view: "pilas", st: { n: "3", name: "Pilas de lixiviación" }, mod: "./stations/pilas-lixiviacion.js", make: "createPilas", qa: "pmPilas", cls: "lx-plate--ar", T: LIX_TARGET },
  { id: "molienda", view: "molienda", st: { n: "2", name: "Molino SAG y de bolas" }, mod: "./stations/molienda.js", make: "createMolienda", qa: "pmMol", cls: "mo-plate--ar", T: MOL_TARGET },
  { id: "flotacion", view: "flotacion", st: { n: "3", name: "Celdas de flotación" }, mod: "./stations/flotacion.js", make: "createFlotacion", qa: "pmFlo", cls: "fl-plate--ar", T: FLO_TARGET },
  { id: "sxew", view: "sxew", st: { n: "4", name: "Extracción por solvente y electroobtención" }, mod: "./stations/sx-ew.js", make: "createSxEw", qa: "pmSx", cls: "sx-plate--ar", T: SXEW_TARGET },
  { id: "fundicion", view: "fundicion", st: { n: "4", name: "Fundición" }, mod: "./stations/fundicion.js", make: "createFundicion", qa: "pmFu", cls: "fu-plate--ar", T: FUN_TARGET },
  { id: "puerto", view: "puerto", st: { n: "5", name: "Puerto" }, mod: "./stations/puerto.js", make: "createPuerto", qa: "pmPu", cls: "pu-plate--ar", T: PUE_TARGET },
];
let mindar = null, pinned = false, pinnedS = null;
const arStations = [];   // { id, view, st, anchor, build, ready, obj, objs, el, setActive, dispose, tracking, used }
window.pmAR = arStations; // QA desde la consola: qué láminas están armadas (obj) y cuál se está siguiendo
let arCurrent = null, useClock = 0, cssDirty = true;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Memoria: en el celular (sobre todo iPhone) armar todas las láminas a la vez, junto con la cámara y el seguimiento,
// agotaba la memoria de la pestaña y el navegador la cerraba. Se arman al encontrar su marcador y quedan vivas a lo
// más KEEP (además del chancado primario, que es parte de la página); la menos usada se libera y se rearma si vuelve.
const KEEP = 2;
function ensure(S) {
  if (!S.ready) {
    S.ready = S.build().then((r) => { Object.assign(S, r); r.objs.forEach((o) => S.anchor.group.add(o)); cssDirty = true; evict(); return true; })
      .catch((err) => { console.error(`[AR] no se pudo armar ${S.id}`, err); S.ready = null; return false; });
  }
  return S.ready;
}
function evict() {
  const built = () => arStations.filter((S) => S.dispose && S.obj);
  for (const S of built().sort((a, b) => (a.used || 0) - (b.used || 0))) {
    if (built().length <= KEEP) break;
    if (S === arCurrent || S === pinnedS || S.tracking) continue;
    S.setActive?.(false);
    S.dispose();
    Object.assign(S, { ready: null, obj: null, objs: null, el: null, setActive: null, dispose: null });
  }
}
function camMessage(err) {
  const n = err?.name || "";
  if (n === "NotAllowedError" || n === "SecurityError") return "Permiso de cámara denegado · actívalo en el navegador y recarga";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "No se encontró una cámara trasera";
  if (n === "NotReadableError") return "La cámara está ocupada por otra app";
  return "No se pudo abrir la cámara";
}
async function startAR() {
  setMode("ar");
  showView("chancador", { n: "2", name: "Chancado Primario" });
  ui.status.textContent = "Iniciando cámara…";
  const scan = $("[data-scan]");
  let THREE, CSS3DObject;
  try {
    THREE = await import("three");
    ({ CSS3DObject } = await import("three/addons/renderers/CSS3DRenderer.js"));
    await import("../vendor/mindar/mindar-image-three.prod.js");
    mindar = new window.MINDAR.IMAGE.MindARThree({
      container: $("#ar"),
      imageTargetSrc: `assets/targets.mind?v=${MIND_VERSION}`,
      maxTrack: 1,
      uiLoading: "no", uiScanning: "no", uiError: "no",
      filterMinCF: 0.001, filterBeta: 5,   // poco temblor sin que la lámina se arrastre al mover el celular
      warmupTolerance: 3, missTolerance: 8, // aparece rápido y no parpadea con un desenfoque breve
    });
  } catch (err) {
    console.error(err);
    ui.status.textContent = "No se pudo cargar el AR · mostrando demo";
    return startDemo();
  }
  const { renderer, cssRenderer, cssScene, camera } = mindar;
  void THREE;
  // MindAR crea un WebGL a pantalla completa (antialias, ×densidad del equipo: ×3 en iPhone) que aquí no dibuja nada:
  // todo va en CSS3D. Se libera su memoria de GPU y se deja de redibujar.
  renderer.setPixelRatio(1); renderer.setSize(1, 1);
  renderer.setSize = renderer.setPixelRatio = () => {};
  renderer.domElement.style.display = "none";
  try { renderer.dispose(); renderer.forceContextLoss(); } catch {}

  // 0 · chancado primario: se mide la lámina en el documento antes de pasarla a CSS3D
  const chS = { id: "chancado", view: "chancador", st: { n: "2", name: "Chancado Primario" }, anchor: mindar.addCSSAnchor(0) };
  chS.build = async () => {
    // oculta con opacity, no con visibility: el horneado salta los trazos con visibility hidden y quedaba vacío
    plate.style.opacity = "0";
    document.body.appendChild(plate);
    const { shadow } = bakePlate(true);
    plate.dataset.baked = "1";
    const o = plateOffset();
    // la sombra cubre el dibujo (el contenedor del SVG), que no está centrado en la lámina
    const pr = plate.getBoundingClientRect(), hr = rig.svg.parentNode.getBoundingClientRect(), u = plate.offsetWidth / pr.width || 1;
    const dx = (hr.left + hr.width / 2 - pr.left - pr.width / 2) * u, dy = (hr.top + hr.height / 2 - pr.top - pr.height / 2) * u;
    plate.style.opacity = "";
    const obj = flat(new CSS3DObject(plate));
    obj.position.set(o.x, o.y, LIFT);
    obj.scale.setScalar(o.k);
    const objs = [obj];
    if (shadow) { const g = groundOf(shadow, obj, CSS3DObject); g.position.x += dx * o.k; g.position.y -= dy * o.k; objs.unshift(g); }
    return { obj, objs, el: plate, setActive: (v) => live.setActive(v) };
  };
  arStations.push(chS);
  AR_DEFS.forEach((D, i) => {
    const S = { id: D.id, view: D.view, st: D.st, anchor: mindar.addCSSAnchor(i + 1) };
    S.build = async () => {
      const mod = await import(D.mod);
      const s = await mod[D.make]();
      window[D.qa] = s;
      if (D.cls) s.el.classList.add(D.cls);
      // en el documento un instante (oculta) para leer sus estilos y hornear la sombra
      s.el.style.opacity = "0";
      document.body.appendChild(s.el);
      const { shadow } = bake(s.el, { ground: true });
      s.el.remove();
      s.el.style.opacity = "";
      const obj = onTarget(s.el, D.T, CSS3DObject);
      const objs = shadow ? [groundOf(shadow, obj, CSS3DObject), obj] : [obj];
      const unbind = mod.bindPanel(s, { onEscape: () => s.select(null) });
      return {
        obj, objs, el: s.el,
        setActive: D.active ? (v) => D.active(s, v) : (v) => s.setActive(v),
        dispose: () => {
          objs.forEach((o) => S.anchor.group.remove(o));
          unbind?.();
          s.destroy();
          if (window[D.qa] === s) delete window[D.qa];
        },
      };
    };
    arStations.push(S);
  });

  for (const S of arStations) {
    S.anchor.onTargetUpdate = () => { cssDirty = true; };
    S.anchor.onTargetFound = () => {
      S.tracking = true;
      S.used = ++useClock;
      if (pinned) return;
      if (arCurrent && arCurrent !== S) arCurrent.setActive?.(false);
      arCurrent = S;
      scan.hidden = true;
      showView(S.view, S.st);
      document.body.dataset.tracking = "on";
      if (!S.obj) ui.status.textContent = `Estación ${S.st.n} · ${S.st.name} · cargando…`;
      ensure(S).then((ok) => {
        if (!ok || !S.tracking || arCurrent !== S || pinned) return;
        showView(S.view, S.st);
        S.setActive?.(true);
      });
    };
    S.anchor.onTargetLost = () => {
      S.tracking = false;
      if (pinned || arCurrent !== S) return;
      scan.hidden = false;
      ui.status.textContent = "Buscando la infografía…";
      delete document.body.dataset.tracking;
      S.setActive?.(false);
    };
  }

  // MindAR pide la cámara sin resolución y los navegadores entregan 640×480: a esa resolución el arte de líneas finas
  // (sobre todo el rajo) casi no deja puntos y el seguimiento no se engancha. A 1280×720 el rajo aparece al instante.
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) =>
    gum(c?.video && typeof c.video === "object" ? { ...c, video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...c.video } } : c);
  try {
    await mindar.start();
  } catch (err) {
    console.error(err);
    ui.status.textContent = `${camMessage(err)} · mostrando demo`;
    return startDemo();
  }
  scan.hidden = false;
  ui.status.textContent = "Buscando la infografía…";
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
  // los módulos de las estaciones se descargan de a uno en segundo plano (sólo el código: las láminas se arman al
  // encontrar su marcador), para que la primera aparición no espere la red
  (async () => {
    for (const D of AR_DEFS) { await wait(700); await import(D.mod).catch(() => {}); }
  })();
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

// ---------------------------------------------------------------- fijar la lámina en pantalla (la que se está viendo)
const pinLayer = $("[data-pin-layer]");
$("[data-pin]").addEventListener("click", (e) => {
  const S = arCurrent || arStations[0];
  if (!S?.obj) return;
  pinned = !pinned;
  pinnedS = pinned ? S : null;
  e.currentTarget.setAttribute("aria-pressed", String(pinned));
  if (pinned) {
    S.objs.forEach((o) => S.anchor.group.remove(o)); // CSS3D suelta el elemento (y su sombra)…
    pinLayer.hidden = false;
    pinLayer.appendChild(S.el);                // …y lo ponemos plano en pantalla
    S.el.style.transform = "";
    S.el.style.visibility = "visible";
    S.el.classList.add("plate--pinned");
    showView(S.view, S.st);
    sizeHud();
    $("[data-scan]").hidden = true;
    ui.status.textContent = "Lámina fijada en pantalla";
    S.setActive(true);
  } else {
    S.el.classList.remove("plate--pinned");
    pinLayer.hidden = true;
    S.objs.forEach((o) => S.anchor.group.add(o));
    cssDirty = true;
    ui.status.textContent = document.body.dataset.tracking ? `Estación ${S.st.n} · ${S.st.name}` : "Buscando la infografía…";
    if (!document.body.dataset.tracking) { $("[data-scan]").hidden = false; S.setActive(false); }
  }
});
