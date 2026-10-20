// Orquesta la experiencia: monta la lámina viva, la ancla sobre la infografía (AR) o la muestra
// sobre la imagen de la infografía (demo), y conecta el HUD con live.js.
import { mountRig, GEO } from "./rig.js";
import { createLive } from "./live.js";
import { STEPS } from "./caex.js";
import * as M from "./model.js";

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
const figure = $("[data-figure]", plate);
ui.stage = figure;
const rig = await mountRig(figure, "assets/chancador_primario.svg");
const live = createLive(rig, ui);
window.pmLive = live; // acceso para QA desde la consola

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
  if (e.target.closest?.("input, [data-intro]") || document.body.dataset.mode === "intro") return;
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
  const s = Math.min((innerWidth - 24) / 1000, (innerHeight - 64 - panel.offsetHeight - 24) / (plate.offsetHeight || 760));
  document.documentElement.style.setProperty("--pin-s", Math.max(0.2, s).toFixed(3));
  void room;
};
new ResizeObserver(sizeHud).observe(panel);
addEventListener("resize", sizeHud);

// ---------------------------------------------------------------- posición de la lámina en el espacio del target
function plateOffset() {
  const vb = GEO.view;
  const pw = plate.offsetWidth, ph = plate.offsetHeight;
  const fx = (figure.offsetLeft) + ((STATION.svgPoint[0] - vb[0]) / vb[2]) * figure.offsetWidth;
  const fy = (figure.offsetTop) + ((STATION.svgPoint[1] - vb[1]) / vb[3]) * figure.offsetHeight;
  const t = STATION.target, s = 1000 / t.w;
  const px = (t.print[0] - t.w / 2) * s, py = -(t.print[1] - t.h / 2) * s; // y hacia arriba
  const k = STATION.scale;
  return { x: px - k * (fx - pw / 2), y: py + k * (fy - ph / 2), pw: pw * k, ph: ph * k, k };
}

// ---------------------------------------------------------------- intro / modos
const intro = $("[data-intro]");
const note = $("[data-ar-note]");
const canAR = window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
if (!canAR) {
  $("[data-start-ar]").disabled = true;
  note.textContent = "La cámara necesita HTTPS (o localhost). Abre la demo o publica la carpeta en un servidor seguro.";
}
$("[data-start-demo]").addEventListener("click", startDemo);
$("[data-start-ar]").addEventListener("click", startAR);
if (new URLSearchParams(location.search).has("demo")) startDemo();

function setMode(mode) {
  document.body.dataset.mode = mode;
  intro.hidden = true;
}

// ---------------------------------------------------------------- DEMO: la infografía completa, navegable por estaciones
// El target del chancador es un recorte ×1,5 de la infografía desde (580, 60): con eso la lámina se ubica
// sobre la infografía completa con el mismo registro que usa el AR.
const CROP = { x: 580, y: 60, k: 1.5 };
const PRINT_ON_POSTER = [CROP.x + STATION.target.print[0] / CROP.k, CROP.y + STATION.target.print[1] / CROP.k];
const PLATE_W_ON_POSTER = (STATION.scale * STATION.target.w) / CROP.k;
let explorer = null;

const chancadorStation = {
  enter({ layer }) {
    layer.appendChild(plate);
    plate.classList.add("plate--demo");
    plate.style.transform = "none";
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

// ---------------------------------------------------------------- AR: MindAR + CSS3D (la lámina sigue siendo DOM: se puede tocar)
let anchorObj = null, anchor = null, mindar = null;
async function startAR() {
  setMode("ar");
  showView("chancador", { n: "2", name: "Chancado Primario" });
  ui.status.textContent = "Iniciando cámara…";
  const scan = $("[data-scan]");
  try {
    const THREE = await import("three");
    const { CSS3DObject } = await import("three/addons/renderers/CSS3DRenderer.js");
    await import("../vendor/mindar/mindar-image-three.prod.js");
    mindar = new window.MINDAR.IMAGE.MindARThree({
      container: $("#ar"),
      imageTargetSrc: "assets/targets.mind",
      maxTrack: 1,
      uiLoading: "no", uiScanning: "no", uiError: "no",
      filterMinCF: 0.0001, filterBeta: 0.001, // menos temblor con la lámina grande
    });
    const { renderer, cssRenderer, cssScene, scene, camera } = mindar;
    anchor = mindar.addCSSAnchor(0);
    // se mide la lámina en el documento antes de pasarla a CSS3D
    plate.style.visibility = "hidden";
    document.body.appendChild(plate);
    const o = plateOffset();
    plate.style.visibility = "";
    anchorObj = new CSS3DObject(plate);
    anchorObj.position.set(o.x, o.y, STATION.lift);
    anchorObj.scale.setScalar(o.k);
    anchor.group.add(anchorObj);
    anchor.onTargetFound = () => {
      scan.hidden = true;
      ui.status.textContent = "Estación 2 · Chancado Primario";
      document.body.dataset.tracking = "on";
      live.setActive(true);
    };
    anchor.onTargetLost = () => {
      if (pinned) return;
      scan.hidden = false;
      ui.status.textContent = "Buscando la infografía…";
      delete document.body.dataset.tracking;
      live.setActive(false);
    };
    await mindar.start();
    scan.hidden = false;
    ui.status.textContent = "Buscando la infografía…";
    $("[data-pin]").hidden = false;
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
      cssRenderer.render(cssScene, camera);
    });
    void THREE;
  } catch (err) {
    console.error(err);
    ui.status.textContent = "No se pudo abrir la cámara · mostrando demo";
    startDemo();
  }
}

// ---------------------------------------------------------------- fijar la lámina en pantalla
let pinned = false;
const pinLayer = $("[data-pin-layer]");
$("[data-pin]").addEventListener("click", (e) => {
  pinned = !pinned;
  e.currentTarget.setAttribute("aria-pressed", String(pinned));
  if (pinned) {
    anchor.group.remove(anchorObj);           // CSS3D suelta el elemento…
    pinLayer.hidden = false;
    pinLayer.appendChild(plate);               // …y lo ponemos plano en pantalla
    plate.style.transform = "";
    plate.style.visibility = "visible";
    plate.classList.add("plate--pinned");
    sizeHud();
    $("[data-scan]").hidden = true;
    ui.status.textContent = "Lámina fijada en pantalla";
    live.setActive(true);
  } else {
    plate.classList.remove("plate--pinned");
    pinLayer.hidden = true;
    anchor.group.add(anchorObj);
    ui.status.textContent = document.body.dataset.tracking ? "Estación 2 · Chancado Primario" : "Buscando la infografía…";
    if (!document.body.dataset.tracking) { $("[data-scan]").hidden = false; live.setActive(false); }
  }
});
