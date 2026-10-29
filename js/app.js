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
// assets/targets.mind trae tres marcadores: 0 = chancado primario (target-chancado.png), 1 = rajo (target-rajo.png),
// 2 = mina subterránea (target-mina.png), 3 = chancado secundario y terciario (target-secundario.png),
// 4 = pilas de lixiviación (target-pilas.png), 5 = molino SAG y de bolas (target-molienda.png).
// MindAR sigue uno a la vez; al encontrar uno se activa su lámina y su panel.
// Recorte del rajo en la infografía (px de assets/infografia.jpg): así la lámina del rajo, que vive en esas
// coordenadas, se ubica sobre el marcador sin más cuentas.
const RAJO_TARGET = { x: 60, y: 440, w: 1400, h: 850, lift: 10 };
const MINA_TARGET = { x: 980, y: 880, w: 1070, h: 600, lift: 10 };
const SEC_TARGET = { x: 1880, y: 620, w: 840, h: 380, lift: 10 };
const LIX_TARGET = { x: 2190, y: 270, w: 740, h: 450, lift: 10 };
const MOL_TARGET = { x: 1900, y: 930, w: 560, h: 450, lift: 10 };
// lámina en px de la infografía → objeto CSS3D sobre su marcador (ancho del marcador = 1000 en el espacio del ancla)
function onTarget(el, T, CSS3DObject) {
  const L = parseFloat(el.style.left), Tp = parseFloat(el.style.top), W = parseFloat(el.style.width), H = parseFloat(el.style.height);
  el.style.left = "0px"; el.style.top = "0px";
  const k = 1000 / T.w, o = new CSS3DObject(el);
  o.position.set((L + W / 2 - T.x - T.w / 2) * k, -(Tp + H / 2 - T.y - T.h / 2) * k, T.lift);
  o.scale.setScalar(k);
  return o;
}
let mindar = null, pinned = false;
const arStations = [];   // { id, view, status, anchor, obj, el, setActive }
let arCurrent = null;
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

    // 0 · chancado primario: se mide la lámina en el documento antes de pasarla a CSS3D
    plate.style.visibility = "hidden";
    document.body.appendChild(plate);
    const o = plateOffset();
    plate.style.visibility = "";
    const chObj = new CSS3DObject(plate);
    chObj.position.set(o.x, o.y, STATION.lift);
    chObj.scale.setScalar(o.k);
    arStations.push({ id: "chancado", view: "chancador", st: { n: "2", name: "Chancado Primario" }, anchor: mindar.addCSSAnchor(0), obj: chObj, el: plate, setActive: (v) => live.setActive(v) });

    // 1 · rajo: la lámina está en px de la infografía; su centro se lleva al espacio del marcador (ancho = 1000)
    const { createRajo, bindPanel } = await import("./stations/rajo.js");
    const rajo = await createRajo();
    window.pmRajo = rajo;
    rajo.el.classList.add("rajo-plate--ar");
    const rjObj = onTarget(rajo.el, RAJO_TARGET, CSS3DObject);
    bindPanel(rajo, { onEscape: () => rajo.select(null) });
    arStations.push({ id: "rajo", view: "rajo", st: { n: "1", name: "Rajo" }, anchor: mindar.addCSSAnchor(1), obj: rjObj, el: rajo.el, setActive: (v) => rajo.setActive(v) });

    // 2 · mina subterránea: al encontrar el marcador, el haz de radiografía barre el terreno
    const M = await import("./stations/mina-subterranea.js");
    const mina = await M.createMina();
    window.pmMina = mina;
    const mnObj = onTarget(mina.el, MINA_TARGET, CSS3DObject);
    M.bindPanel(mina, { onEscape: () => mina.select(null) });
    arStations.push({ id: "mina", view: "mina", st: { n: "1", name: "Mina subterránea" }, anchor: mindar.addCSSAnchor(2), obj: mnObj, el: mina.el,
      setActive: (v) => { mina.setActive(v); if (v) { mina.setXray(0, true); mina.setXray(1); } } });

    // 3 · chancado secundario y terciario
    const SC = await import("./stations/chancado-secundario.js");
    const sec = await SC.createSecundario();
    window.pmSec = sec;
    sec.el.classList.add("sec-plate--ar");
    const scObj = onTarget(sec.el, SEC_TARGET, CSS3DObject);
    SC.bindPanel(sec, { onEscape: () => sec.select(null) });
    arStations.push({ id: "secundario", view: "secundario", st: { n: "2.2", name: "Chancado secundario y terciario" }, anchor: mindar.addCSSAnchor(3), obj: scObj, el: sec.el, setActive: (v) => sec.setActive(v) });

    // 4 · pilas de lixiviación
    const LX = await import("./stations/pilas-lixiviacion.js");
    const lix = await LX.createPilas();
    window.pmPilas = lix;
    lix.el.classList.add("lx-plate--ar");
    const lxObj = onTarget(lix.el, LIX_TARGET, CSS3DObject);
    LX.bindPanel(lix, { onEscape: () => lix.select(null) });
    arStations.push({ id: "pilas", view: "pilas", st: { n: "3", name: "Pilas de lixiviación" }, anchor: mindar.addCSSAnchor(4), obj: lxObj, el: lix.el, setActive: (v) => lix.setActive(v) });

    // 5 · molino SAG y de bolas
    const MO = await import("./stations/molienda.js");
    const mol = await MO.createMolienda();
    window.pmMol = mol;
    mol.el.classList.add("mo-plate--ar");
    const moObj = onTarget(mol.el, MOL_TARGET, CSS3DObject);
    MO.bindPanel(mol, { onEscape: () => mol.select(null) });
    arStations.push({ id: "molienda", view: "molienda", st: { n: "2", name: "Molino SAG y de bolas" }, anchor: mindar.addCSSAnchor(5), obj: moObj, el: mol.el, setActive: (v) => mol.setActive(v) });

    for (const S of arStations) {
      S.anchor.group.add(S.obj);
      S.anchor.onTargetFound = () => {
        if (pinned) return;
        arCurrent?.setActive(false);
        arCurrent = S;
        scan.hidden = true;
        showView(S.view, S.st);
        document.body.dataset.tracking = "on";
        S.setActive(true);
      };
      S.anchor.onTargetLost = () => {
        if (pinned || arCurrent !== S) return;
        scan.hidden = false;
        ui.status.textContent = "Buscando la infografía…";
        delete document.body.dataset.tracking;
        S.setActive(false);
      };
    }
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

// ---------------------------------------------------------------- fijar la lámina en pantalla (la que se está viendo)
const pinLayer = $("[data-pin-layer]");
$("[data-pin]").addEventListener("click", (e) => {
  const S = arCurrent || arStations[0];
  if (!S) return;
  pinned = !pinned;
  e.currentTarget.setAttribute("aria-pressed", String(pinned));
  if (pinned) {
    S.anchor.group.remove(S.obj);              // CSS3D suelta el elemento…
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
    S.anchor.group.add(S.obj);
    ui.status.textContent = document.body.dataset.tracking ? `Estación ${S.st.n} · ${S.st.name}` : "Buscando la infografía…";
    if (!document.body.dataset.tracking) { $("[data-scan]").hidden = false; S.setActive(false); }
  }
});
