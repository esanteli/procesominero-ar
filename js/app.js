// Orquesta la experiencia: monta la lámina viva, la ancla sobre la infografía (AR) o la muestra
// sobre la imagen de la infografía (demo), y conecta el HUD con live.js.
import "./perf.js"; // ?perf: HUD de rendimiento (va primero: envuelve requestAnimationFrame)
import { report } from "./report.js"; // registro de errores (apagado salvo que se configure un destino)
import { mountRig, GEO } from "./rig.js";
import { createLive } from "./live.js";
import { STEPS } from "./caex.js";
import * as M from "./model.js";
import { bake } from "./halo.js";
import { guardEdges } from "./edge-guard.js";
import { setFps, setAdaptive } from "./clock.js";

guardEdges(); // tablets: el pulgar apoyado en el borde no cuenta como dedo (evita el zoom sin querer)

// Service worker (sólo en el build: dist/ marca <html data-build>; ?nosw lo salta): guarda la app para cuando se corta
// el wifi. Se registra con la página ya cargada, así no compite con ella por la red. Una versión nueva sólo toma el
// control en la pantalla de inicio (recarga una vez); a mitad de una sesión espera, para no mezclar versiones.
if ("serviceWorker" in navigator && document.documentElement.dataset.build && !new URLSearchParams(location.search).has("nosw")) {
  const hadController = !!navigator.serviceWorker.controller;
  const atIntro = () => document.body.dataset.mode === "intro";
  const start = () => setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      const offer = (w) => { if (w && hadController && atIntro()) w.postMessage("activar"); };
      offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => { if (w.state === "installed") offer(w); });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController && atIntro()) location.reload(); }, { once: true });
    } catch (err) { console.warn("service worker:", err); }
  }, 3000);
  if (document.readyState === "complete") start(); else addEventListener("load", start, { once: true });
}

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
    // sin nada elegido ni interior abierto, Esc vuelve: al mapa (demo) o a la infografía completa (AR)
    if (document.body.dataset.view !== "chancador" || (!live.selected && Number(ui.inside.value) === 0)) {
      if (document.body.dataset.mode === "ar") setFocus(null); else explorer?.back();
    }
    live.select(null); live.setInside(0);
  }
  else return;
  e.preventDefault();
});

// alto real del HUD → la escena demo / escaneo / lámina fijada usan el espacio que queda libre
const panel = $("[data-panel]");
const sizeHud = () => {
  // primero se lee todo y después se escribe (leer después de escribir obliga a recalcular el layout en el acto)
  const ph = panel.offsetHeight, pe = document.querySelector(".plate--pinned") || plate;
  const s = Math.min((innerWidth - 24) / (pe.offsetWidth || 1000), (innerHeight - 64 - ph - 24) / (pe.offsetHeight || 760));
  document.documentElement.style.setProperty("--hud-h", `${ph + 8}px`);
  document.documentElement.style.setProperty("--pin-s", Math.max(0.2, s).toFixed(3));
};
new ResizeObserver(sizeHud).observe(panel);
// demo: el mapa ocupa la pantalla completa y el panel va encima; si el panel cambia de alto (Controles, otra estación),
// la estación abierta se vuelve a encuadrar en lo que queda libre
new ResizeObserver(() => { if (document.body.dataset.mode === "demo") explorer?.refit(); }).observe(panel);
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
// (el demo se puede abrir otra vez tras volver al inicio con su botón "Inicio"; el AR, una sola vez por carga)
$("[data-start-demo]").addEventListener("click", () => { if (document.body.dataset.mode === "intro") startDemo(); });
let arStarted = false;
$("[data-start-ar]").addEventListener("click", () => { if (arStarted) return; arStarted = true; startAR(); });
$("[data-start-demo]").disabled = false;
$("[data-start-ar]").disabled = !canAR;
note.textContent = canAR ? "" : "La cámara necesita HTTPS (o localhost). Abre la demo o publica la carpeta en un servidor seguro.";

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
let art = null; // infografía viva (js/infografia-viva.js): entrada, ambiente, efecto al tocar y modo quiosco

const chancadorStation = {
  // precarga en reposo (js/explorer.js): hornea su silueta y sombra antes de la primera apertura (~100 ms con la CPU ×4)
  prepare({ layer }) {
    if (plate.dataset.baked || plate.isConnected) return;
    plate.classList.add("plate--demo");
    plate.style.transform = "none";
    plate.style.opacity = "0";
    layer.appendChild(plate);
    bakePlate(false);
    plate.dataset.baked = "1";
    plate.remove();
    plate.style.opacity = "";
  },
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
// menú flotante de estaciones (vista general del demo): cerrado por defecto; se cierra al elegir una estación, al tocar
// fuera de él o con Esc. Es una capa sobre el mapa: abrirlo o cerrarlo no cambia el tamaño del mapa ni lo mueve.
const stMenu = $("[data-st-menu]"), stPop = $("[data-st-pop]"), stFab = $("[data-st-fab]");
let swallowAt = 0; // el toque en el mapa que cierra el menú no abre ni arrastra nada
function setMenu(open) {
  stPop.hidden = !open;
  stFab.setAttribute("aria-expanded", String(open));
  stFab.querySelector("span").textContent = open ? "Cerrar" : "Estaciones";
  stFab.setAttribute("aria-label", open ? "Cerrar la lista de estaciones" : "Abrir la lista de estaciones");
}
stFab.addEventListener("click", () => setMenu(stPop.hidden));
addEventListener("pointerdown", (e) => {
  if (stPop.hidden || stMenu.contains(e.target)) return;
  setMenu(false);
  if (e.target.closest("[data-explorer]")) { swallowAt = performance.now(); e.stopPropagation(); }
}, true);
addEventListener("click", (e) => {
  if (performance.now() - swallowAt < 800 && e.target.closest("[data-explorer]")) { e.stopPropagation(); e.preventDefault(); }
  swallowAt = 0;
}, true);
addEventListener("keydown", (e) => { if (e.key === "Escape" && !stPop.hidden) { setMenu(false); stFab.focus(); e.preventDefault(); } }, true);
function showView(view, st) {
  document.body.dataset.view = view;
  setMenu(false);
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

// Lo que tapa el mapa del demo (en px, respecto de su caja): la barra superior siempre; el panel abajo (vertical) o la
// columna a la derecha (horizontal en celular). Con los grupos laterales de la tablet (panel transparente, sin toques)
// sólo se tapan las esquinas: no se descuenta (se acepta, como en el AR).
function demoOccluded(stage) {
  const ex = stage.getBoundingClientRect(), out = { top: 0, right: 0, bottom: 0, left: 0 };
  const vis = (e) => e && !e.hidden && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0;
  const tb = [...document.querySelectorAll(".topbar > *")].filter(vis).map((e) => e.getBoundingClientRect().bottom);
  if (tb.length) out.top = Math.max(0, Math.max(...tb) + 6 - ex.top);
  if (vis(panel) && document.body.dataset.view !== "map") {
    const r = panel.getBoundingClientRect(), cs = getComputedStyle(panel);
    if (r.left > ex.left + ex.width * 0.4 && r.width < ex.width * 0.6) out.right = Math.max(0, ex.right - r.left);
    else if (cs.pointerEvents !== "none") out.bottom = Math.max(0, ex.bottom - r.top);
  }
  return out;
}
// T11: del demo a la pantalla inicial sin recargar: se cierra la estación abierta, se oculta el demo y vuelven los
// botones del inicio (el demo queda armado: abrirlo de nuevo es instantáneo).
const homeBtn = $("[data-home]");
homeBtn.addEventListener("click", goHome);
function goHome() {
  if (document.body.dataset.mode !== "demo") return;
  explorer?.back(); // cierra la estación abierta (vía #)
  setMenu(false);
  $("[data-explorer]").hidden = true;
  art?.setActive(false);
  $("[data-notice]").hidden = true;
  homeBtn.hidden = true;
  backBtn.hidden = true;
  delete document.body.dataset.view;
  document.body.dataset.mode = "intro";
  intro.hidden = false;
  const ar = $("[data-start-ar]");
  ar.textContent = "Escanear infografía";
  ar.disabled = !canAR || arStarted;
  $("[data-start-demo]").disabled = false;
  const q = new URLSearchParams(location.search);
  if (q.has("demo")) { q.delete("demo"); history.replaceState(null, "", location.pathname + (q.size ? `?${q}` : "")); }
  ui.status.textContent = "Proceso Minero AR";
}
async function startDemo() {
  setMode("demo");
  homeBtn.hidden = false;
  const stage = $("[data-explorer]");
  stage.hidden = false;
  if (explorer) { showView("map"); art?.setActive(true); return; } // ya armado: se vuelve a mostrar (y repite la entrada)
  const { STATIONS } = await import("./stations.js");
  const { createExplorer } = await import("./explorer.js");
  const viva = await import("./infografia-viva.js");
  // lista de estaciones del panel
  const list = $("[data-station-list]");
  list.innerHTML = STATIONS.map((st) => `<button type="button" class="st-chip" role="listitem" data-id="${st.id}" data-tone="${st.tone}" data-status="${st.status}"><b>${st.n}</b><span>${st.name}</span>${st.status === "lista" ? '<i aria-label="animación lista"></i>' : ""}</button>`).join("");
  list.addEventListener("click", (e) => { const c = e.target.closest(".st-chip"); if (c) explorer.open(c.dataset.id); });
  explorer = createExplorer({ stage, builtins: { chancador: chancadorStation }, onView: (v, st) => { showView(v, st); art?.setView(v); },
    occluded: () => demoOccluded(stage), labelRect: viva.labelRect, shift: viva.SHIFT });
  // modo quiosco: sin interacción por un rato, de vuelta a la vista general y la entrada otra vez
  art = viva.createLiveArt({ stage, world: stage.querySelector("[data-world]"), onIdle: () => {
    if (document.body.dataset.mode !== "demo") return;
    setMenu(false);
    explorer.reset();
    art.replay();
  } });
  // sin foco ni estación marcada al volver (el foco del teclado dejaba la etiqueta resaltada)
  backBtn.addEventListener("click", () => { document.activeElement?.blur?.(); explorer.back(); });
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
// Dos estados, como el demo sin cámara:
//   OVERVIEW → todas las estaciones animadas, sin panel ni toques; un hotspot sobre cada etiqueta impresa.
//   FOCUS(S) → una estación: panel, toques, Fijar y Ampliar. Las demás se desvanecen y pausan su animación.
// Se enfoca tocando su hotspot (o acercándose mucho a ella); se vuelve con el botón "Salir", con Esc o tocando fuera.
const POSTER = { x: 0, y: 0, w: 5497, h: 1623 };
const KW = 1000 / POSTER.w;
// Corrección fina del anclaje en AR por estación, en px de la infografía ([dx, dy]; + = derecha / abajo). Vacía: en el
// demo y con cámara simulada todas calzan (< 1 px en la infografía). Si en la tablet una se ve corrida, abrir con
// ?calibrar, enfocarla, moverla con las flechas hasta que calce y copiar aquí el valor que muestra.
const AR_NUDGE = {};
// enfoque automático al acercarse: fracción de la pantalla que debe ocupar una estación centrada (y bajo la cual se
// vuelve a permitir después de salir de ella)
const FOCUS_IN = 0.3, FOCUS_OUT = 0.14;
// deformación máxima aceptada de una lámina en pantalla (borde más largo / borde opuesto)
const MAX_WARP = 1.7;
// estabilidad: filtro One Euro propio sobre la pose (posición, rotación y escala por separado)
const POSE = { minCutoff: 1.0, beta: 6, rotMinCutoff: 0.8, rotBeta: 1.2, dCutoff: 1.0 };
const JUMP = 1.45;      // salto máximo de escala entre dos poses seguidas; más que eso es una pose degenerada
const EDGE_ON = 0.12;   // coseno mínimo entre la normal del papel y la cámara (~83°): más de canto es degenerada
const REJECT_MAX = 8;   // poses rechazadas seguidas antes de aceptar la nueva (el papel sí cambió de lugar)
const FADE_MS = 320;       // al enfocar una estación, las demás se desvanecen en este tiempo
const LOST_FADE_MS = 400;  // al perder el marcador la escena se desvanece en este tiempo y su simulación se pausa
const LOST_REJECTS = 3;    // poses rechazadas seguidas que cuentan como pérdida
const SHAKY_MS = 2500, JITTER_MAX = 0.012;   // si el seguimiento se pierde o vibra este tiempo en FOCUS, se sugiere Fijar
const ZOOM_MAX = 3;
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
function nudge(objs, d) { if (d) for (const o of objs) { o.position.x += d[0] * KW; o.position.y -= d[1] * KW; } }
function flat(o) { o.element.style.willChange = "transform"; return o; }
// la lámina flota LIFT sobre el papel, medido en su propio marcador (ancho 1000), se vea desde un sector o de lejos
const liftOf = (T) => (LIFT * T.w) / POSTER.w;
// caja de un rectángulo de la infografía en el mundo [x0, x1, y0, y1]
const boxOf = (cx, cy, w, h) => [(cx - w / 2 - POSTER.w / 2) * KW, (cx + w / 2 - POSTER.w / 2) * KW, -(cy + h / 2 - POSTER.h / 2) * KW, -(cy - h / 2 - POSTER.h / 2) * KW];
const rectBox = ([x, y, w, h]) => boxOf(x + w / 2, y + h / 2, w, h);
// estaciones de stations/*.js: módulo, fábrica, global de QA, clase AR, recorte de su marcador, id en stations.js
const AR_DEFS = [
  { id: "rajo", demo: "rajo", view: "rajo", st: { n: "1", name: "Rajo" }, mod: "./stations/rajo.js", make: "createRajo", qa: "pmRajo", cls: "rajo-plate--ar", T: RAJO_TARGET },
  { id: "mina", demo: "mina-subterranea", view: "mina", st: { n: "1", name: "Mina subterránea" }, mod: "./stations/mina-subterranea.js", make: "createMina", qa: "pmMina", T: MINA_TARGET,
    // al aparecer, el haz de radiografía barre el terreno
    active: (m, v) => { m.setActive(v); if (v) { m.setXray(0, true); m.setXray(1); } } },
  { id: "secundario", demo: "chancado-secundario", view: "secundario", st: { n: "2.2", name: "Chancado secundario y terciario" }, mod: "./stations/chancado-secundario.js", make: "createSecundario", qa: "pmSec", cls: "sec-plate--ar", T: SEC_TARGET },
  { id: "pilas", demo: "pilas-lixiviacion", view: "pilas", st: { n: "3", name: "Pilas de lixiviación" }, mod: "./stations/pilas-lixiviacion.js", make: "createPilas", qa: "pmPilas", cls: "lx-plate--ar", T: LIX_TARGET },
  { id: "molienda", demo: "concentradora", view: "molienda", st: { n: "2", name: "Molino SAG y de bolas" }, mod: "./stations/molienda.js", make: "createMolienda", qa: "pmMol", cls: "mo-plate--ar", T: MOL_TARGET },
  { id: "flotacion", demo: "celdas-flotacion", view: "flotacion", st: { n: "3", name: "Celdas de flotación" }, mod: "./stations/flotacion.js", make: "createFlotacion", qa: "pmFlo", cls: "fl-plate--ar", T: FLO_TARGET },
  { id: "sxew", demo: "electroobtencion", view: "sxew", st: { n: "4", name: "Extracción por solvente y electroobtención" }, mod: "./stations/sx-ew.js", make: "createSxEw", qa: "pmSx", cls: "sx-plate--ar", T: SXEW_TARGET },
  { id: "fundicion", demo: "fundicion", view: "fundicion", st: { n: "4", name: "Fundición" }, mod: "./stations/fundicion.js", make: "createFundicion", qa: "pmFu", cls: "fu-plate--ar", T: FUN_TARGET },
  { id: "puerto", demo: "puerto", view: "puerto", st: { n: "5", name: "Puerto" }, mod: "./stations/puerto.js", make: "createPuerto", qa: "pmPu", cls: "pu-plate--ar", T: PUE_TARGET },
];
let mindar = null, pinned = false, pinnedS = null, camera3 = null, V3 = null, T3 = null, world = null, host = null, cssLayer = null;
let fadeTimer = 0, lostSince = 0, allowed = null, autoBlock = null;
const arStations = [];   // { id, idx, view, st, T, obj, objs, el, svg, box, label, setActive, unfocus, shown }
window.pmAR = arStations; // QA desde la consola: láminas armadas y cuáles se ven (shown)
window.pmARState = () => ({ host: host?.i ?? null, focus: arCurrent?.id ?? null, ar: document.body.dataset.ar, pinned, zoom: pinnedS?.zoom?.z ?? 1,
  shown: arStations.filter((S) => S.shown).map((S) => S.id), rejects: pose.rejected, jitter: +pose.jitter.toFixed(4) });
window.pmARBoxes = () => (world ? arStations.filter((S) => S.shown).map((S) => [S.id, screenBox(S.box).map((v) => +(+v).toFixed(2))]) : []);
let arCurrent = null, cssDirty = true;
const painted = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// ---------------------------------------------------------------- vertical en celular: deslizadores tras "Controles" (T8)
// Quedan a la vista la lectura, los equipos y la secuencia; el botón (al final de la fila de equipos) despliega los
// deslizadores. Sólo en vertical en pantallas angostas (CSS); en tablet y en horizontal se ven siempre.
{
  let open = false;
  const views = [...document.querySelectorAll(".panel-view")].filter((v) => v.querySelector(":scope > .controls"));
  const sync = () => views.forEach((v) => {
    v.toggleAttribute("data-ctl-open", open);
    const b = v.querySelector(":scope > .ctl-toggle");
    b.setAttribute("aria-expanded", String(open));
    b.querySelector("span").textContent = open ? "Ocultar" : "Controles";
  });
  for (const v of views) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ctl-toggle";
    b.setAttribute("aria-controls", (v.querySelector(":scope > .controls").id ||= `ctl-${v.dataset.panelView}`));
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg><span>Controles</span>';
    v.querySelector(":scope > .chips").after(b);
    b.addEventListener("click", () => { open = !open; sync(); });
  }
  sync();
}

// ---------------------------------------------------------------- fila de equipos que no cabe (T4)
// Si los chips se desplazan en horizontal, un degradado en el borde avisa que siguen (data-more: izquierda, derecha o
// ambos). Al elegir un equipo, su chip se trae a la vista.
for (const row of document.querySelectorAll(".panel-view .chips")) {
  const sync = () => {
    const over = row.scrollWidth > row.clientWidth + 2, l = row.scrollLeft > 2, r = row.scrollLeft < row.scrollWidth - row.clientWidth - 2;
    const v = !over ? "" : l && r ? "both" : l ? "left" : r ? "right" : "";
    if ((row.getAttribute("data-more") || "") !== v) v ? row.setAttribute("data-more", v) : row.removeAttribute("data-more");
  };
  row.addEventListener("scroll", sync, { passive: true });
  new ResizeObserver(sync).observe(row);
  setInterval(() => { if (row.offsetParent) sync(); }, 1000); // por si el panel pasó de oculto a visible sin cambiar de tamaño
  new MutationObserver((list) => {
    sync();
    const on = list.map((m) => m.target).find((t) => t.hasAttribute?.("data-on") && t.parentElement === row);
    if (on && row.scrollWidth > row.clientWidth + 2) on.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }).observe(row, { attributes: true, attributeFilter: ["data-on"], subtree: true });
}

// ---------------------------------------------------------------- siglas: botón "?" junto a la lectura de cada estación
// Las abreviaturas comunes van escritas completas; los términos técnicos que conviene conservar (Ley, SAG, PLS…) se
// explican aquí. Se lista sólo lo que aparece en esa estación (lectura, equipos y deslizadores); sin siglas, sin botón.
const GLOSARIO = [
  [/\bLey\b/, "Ley", "Porcentaje de cobre que contiene el material."],
  [/\bRecuperación\b/, "Recuperación", "Parte del cobre que entra a la planta y se logra capturar en el concentrado."],
  [/\bRougher\b/i, "Rougher", "Primera etapa de flotación: recupera la mayor parte del cobre; la limpieza lo concentra después."],
  [/\bDescarga\b/, "Descarga", "Porcentaje de sólidos en el lodo que sale por el fondo del espesador."],
  [/\bSAG\b/, "SAG", "Molino semiautógeno: muele el mineral con el propio mineral y algunas bolas de acero."],
  [/\bCC\b/, "CC", "Carga circulante: el material grueso que los hidrociclones devuelven al molino."],
  [/\bP80\b/, "P80", "Tamaño por el que pasa el 80 % del material molido."],
  [/\bHPGR\b/, "HPGR", "Rodillos de alta presión: trituran el mineral apretándolo entre dos cilindros."],
  [/\bPLS\b/, "PLS", "Solución rica en cobre que sale de las pilas de lixiviación."],
  [/\bSX\b/, "SX", "Extracción por solvente: un líquido orgánico captura el cobre del PLS."],
  [/\bEW\b/, "EW", "Electroobtención: la corriente deposita el cobre en los cátodos."],
  [/η/, "η", "Eficiencia de corriente: parte de la electricidad que de verdad deposita cobre."],
  [/kWh\/kg/, "kWh/kg", "Energía eléctrica gastada por cada kilo de cobre producido."],
  [/\bTML\b/, "TML", "Límite de humedad transportable: sobre él, la carga puede volverse fluida en el barco."],
  [/\bkt\b/, "kt", "Miles de toneladas."],
  [/\bCAEX\b/, "CAEX", "Camión de extracción de alto tonelaje (unas 300 t de carga)."],
  [/\bTeniente\b/, "Convertidor Teniente", "Horno que funde el concentrado; tecnología desarrollada en Chile."],
];
{
  const pop = document.createElement("div");
  pop.className = "gloss"; pop.hidden = true; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Ayuda de la estación");
  document.body.appendChild(pop);
  const termsOf = (view) => {
    const t = [...view.querySelectorAll(".readout, .chip, .ctl-label")].map((e) => [...e.childNodes].map((n) => n.textContent).join(" ")).join(" · "); // "01 Rougher", no "01Rougher"
    return GLOSARIO.filter(([re]) => re.test(t));
  };
  const close = () => { pop.hidden = true; document.querySelectorAll(".gloss-btn[aria-expanded=true]").forEach((b) => b.setAttribute("aria-expanded", "false")); };
  for (const row of document.querySelectorAll(".panel-view .readout-row")) {
    const view = row.closest(".panel-view"), btn = document.createElement("button");
    btn.type = "button"; btn.className = "gloss-btn"; btn.textContent = "?";
    btn.setAttribute("aria-label", "Ayuda: siglas y guía de controles"); btn.setAttribute("aria-expanded", "false");
    row.appendChild(btn);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!pop.hidden && btn.getAttribute("aria-expanded") === "true") return close();
      const terms = termsOf(view);
      pop.innerHTML = `<button type="button" class="gloss-guide">Ver la guía de controles</button>` +
        (terms.length ? `<dl>${terms.map(([, k, d]) => `<dt>${k}</dt><dd>${d}</dd>`).join("")}</dl>` : "");
      pop.querySelector(".gloss-guide").addEventListener("click", (ev) => { ev.stopPropagation(); close(); showGuide(view.dataset.panelView, true); });
      pop.hidden = false; btn.setAttribute("aria-expanded", "true");
      const r = btn.getBoundingClientRect(), w = Math.min(340, innerWidth - 24);
      pop.style.width = `${w}px`;
      pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left - 12))}px`;
      pop.style.bottom = `${innerHeight - r.top + 8}px`;
      pop.style.maxHeight = `${Math.max(160, r.top - 8 - 64)}px`; // cabe entre la barra superior y el botón (se desplaza si no)
    });
  }
  document.addEventListener("click", (e) => { if (!pop.hidden && !e.target.closest(".gloss")) close(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) close(); }, true);
}

// ---------------------------------------------------------------- guía de controles (primera vez en cada estación)
// 3 a 5 s, sobre los grupos del panel: equipos, deslizadores y secuencia. Un toque la salta; no vuelve a salir sola
// (se puede volver a ver desde el botón de ayuda «?» de la estación: showGuide(view, true)).
let showGuide = () => {};
{
  const el = document.createElement("div");
  el.className = "guide"; el.hidden = true;
  document.body.appendChild(el);
  let t = 0;
  const hide = () => { el.hidden = true; el.innerHTML = ""; clearTimeout(t); };
  const TIPS = [[".chips", "Toca un equipo para ver su ficha"], [".controls", "Desliza para mirar por dentro"], [".seq", "Sigue el recorrido paso a paso"]];
  function show(view, force = false) {
    const key = `pm-guia-${view}`;
    if (store.get(key) && !force) return;
    const pv = document.querySelector(`[data-panel-view="${CSS.escape(view)}"]`);
    if (!pv || pv.hidden || !pv.offsetParent) return;
    store.set(key, "1");
    const tips = TIPS.map(([sel, txt]) => {
      const g = pv.querySelector(`:scope > ${sel}`);
      if (!g || !g.offsetParent) return "";
      const r = g.getBoundingClientRect(), x = Math.max(12, Math.min(innerWidth - 232, r.left + r.width / 2 - 110));
      return `<p class="guide-tip" style="left:${x}px;top:${Math.max(70, r.top - 10)}px">${txt}</p>`;
    }).join("");
    if (!tips) return;
    el.innerHTML = `${tips}<button type="button" class="guide-skip">Entendido</button>`;
    el.hidden = false;
    clearTimeout(t); t = setTimeout(hide, 5000);
  }
  showGuide = show;
  el.addEventListener("click", hide);
  document.addEventListener("pointerdown", (e) => { if (!el.hidden && !e.target.closest(".guide")) hide(); }, true);
  new MutationObserver(() => {
    const v = document.body.dataset.view;
    hide();
    if (v && v !== "map" && v !== "station") setTimeout(() => requestAnimationFrame(() => { if (document.body.dataset.view === v) show(v); }), 700);
  }).observe(document.body, { attributes: true, attributeFilter: ["data-view"] });
}
function camMessage(err) {
  const n = err?.name || "";
  if (n === "NotAllowedError" || n === "SecurityError") return "Permiso de cámara denegado · actívalo en el navegador y recarga";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "No se encontró una cámara trasera";
  if (n === "NotReadableError") return "La cámara está ocupada por otra app";
  return "No se pudo abrir la cámara";
}
// botón de arriba: en FOCUS vuelve a la infografía; en la vista general sale del escaneo a la página de inicio
// pantalla completa: más espacio para la escena en la tablet. No aparece si el navegador no la permite (Safari en
// iPhone) o si la app ya corre instalada (manifest: display standalone).
{
  const fsBtn = $("[data-fullscreen]"), root = document.documentElement;
  const current = () => document.fullscreenElement || document.webkitFullscreenElement;
  const can = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  const installed = matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || navigator.standalone;
  fsBtn.hidden = !can || installed;
  const sync = () => {
    const on = !!current();
    fsBtn.setAttribute("aria-pressed", String(on));
    fsBtn.setAttribute("aria-label", on ? "Salir de pantalla completa" : "Pantalla completa");
    fsBtn.title = fsBtn.getAttribute("aria-label");
  };
  fsBtn.addEventListener("click", async () => {
    try {
      if (current()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else await (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: "hide" });
    } catch (err) { console.warn("pantalla completa:", err); }
  });
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
}
// La ficha del equipo se abre del lado contrario al equipo elegido (en horizontal), para no taparlo. Se mira dónde
// está en pantalla el equipo elegido (sus piezas data-eq / data-equip) y se cambia de lado sólo si cruza claramente el
// centro (al mover la tablet no salta de un lado a otro).
const sideOf = (() => {
  const apiOf = () => {
    const view = document.body.dataset.view;
    if (view === "chancador") return { selected: live.selected, root: plate, attr: "data-equip" };
    const D = AR_DEFS.find((d) => d.view === view), s = D && window[D.qa];
    return s ? { selected: s.selected, root: s.el, attr: "data-eq" } : null;
  };
  let side = "right";
  function update() {
    if (info.hidden) return;
    const a = apiOf();
    if (!a?.selected || !a.root) return;
    let l = Infinity, r = -Infinity;
    for (const e of a.root.querySelectorAll(`[${a.attr}="${CSS.escape(a.selected)}"]`)) {
      if (e.closest(".ly-copy")) continue;
      const b = e.getBoundingClientRect();
      if (b.width || b.height) { l = Math.min(l, b.left); r = Math.max(r, b.right); }
    }
    if (!Number.isFinite(l)) return;
    const cx = (l + r) / 2 / innerWidth;
    const next = cx > 0.58 ? "left" : cx < 0.42 ? "right" : side;   // margen: no salta cerca del centro
    if (next !== side || info.dataset.side !== next) { side = next; info.dataset.side = side; }
  }
  new MutationObserver(() => { update(); setTimeout(update, 900); }).observe(info, { attributes: true, attributeFilter: ["hidden"], childList: true, subtree: true, characterData: true });
  setInterval(update, 600); // en AR la lámina se mueve con la cámara
  addEventListener("resize", update);
  return () => side;
})();
// Ficha plegable: botón junto a cerrar; deslizarla hacia su borde (o hacia abajo) la pliega y deja sólo el título;
// tocarla o deslizarla hacia arriba la despliega. Una sola capa de detalle a la vez: si se abre un detalle flotante de
// la lámina (tarjetas *-callout: corte de la tolva, de la celda…), la ficha se pliega sola y vuelve al cerrarlo.
{
  const head = info.querySelector(".info-head"), title = info.querySelector("[data-info-title]");
  const fold = document.createElement("button");
  fold.type = "button"; fold.className = "info-fold";
  fold.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  head.insertBefore(fold, head.querySelector("[data-info-close]"));
  let auto = false;
  const folded = () => info.hasAttribute("data-folded");
  const setFold = (on, byAuto = false) => {
    info.toggleAttribute("data-folded", on);
    fold.setAttribute("aria-expanded", String(!on));
    fold.setAttribute("aria-label", on ? "Desplegar la ficha" : "Plegar la ficha");
    auto = on && byAuto;
  };
  setFold(false);
  fold.addEventListener("click", (e) => { e.stopPropagation(); setFold(!folded()); });
  info.addEventListener("click", (e) => { if (folded() && !e.target.closest("button")) setFold(false); });
  let sw = null;
  info.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  info.addEventListener("pointerup", (e) => {
    if (!sw || sw.id !== e.pointerId) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    const toEdge = info.dataset.side === "left" ? dx < -50 : dx > 50;
    if (!folded() && ((Math.abs(dx) > Math.abs(dy) && toEdge) || dy > 50)) setFold(true);
    else if (folded() && dy < -40) setFold(false);
  });
  info.addEventListener("pointercancel", () => { sw = null; });
  // otro equipo → ficha desplegada (salvo que haya un detalle abierto)
  let lastTitle = "";
  new MutationObserver(() => { if (title.textContent !== lastTitle) { lastTitle = title.textContent; setFold(detailOpen(), true); } }).observe(title, { childList: true, characterData: true, subtree: true });
  const activePlate = () => (document.body.dataset.mode === "ar" ? arCurrent?.el : document.querySelector(".map-layer > *"));
  function detailOpen() {
    const root = activePlate();
    if (!root) return false;
    for (const c of root.querySelectorAll('[class$="-callout"], [class*="-callout "]')) {
      if (c.closest(".ly-copy")) continue;
      const cs = getComputedStyle(c), b = c.getBoundingClientRect();
      if (cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0.05 && b.width > 4) return true;
    }
    return false;
  }
  setInterval(() => {
    if (info.hidden) return;
    const d = detailOpen();
    if (d && !folded()) setFold(true, true);
    else if (!d && auto) setFold(false);
  }, 300);
}
const exitBtn = $("[data-exit-ar]");
exitBtn.addEventListener("click", () => {
  if (document.body.dataset.mode === "ar" && arCurrent) { setFocus(null); return; }
  try { mindar?.stop(); } catch {}
  document.querySelectorAll("video").forEach((v) => v.srcObject?.getTracks?.().forEach((t) => t.stop()));
  const q = new URLSearchParams(location.search);
  q.delete("demo");
  location.replace(location.pathname + (q.size ? `?${q}` : ""));
});

// ---------------------------------------------------------------- armado de las láminas (en la precarga)
const ground = (o) => { o.element.style.pointerEvents = "none"; o.element.classList.add("ar-ground"); return o; };
function buildChancado(CSS3DObject) {
  // en el documento un instante para medirla y hornear su sombra; oculta con opacity (con visibility el horneado
  // salta los trazos)
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
  nudge(objs, AR_NUDGE.chancado);
  return { id: "chancado", demo: "chancado-primario", view: "chancador", st: { n: "2", name: "Chancado Primario" }, T: CH_TARGET, obj, objs, el: plate,
    svg: rig.svg, box: boxOf(P.cx, P.cy, P.w, P.h), setActive: (v) => live.setActive(v), unfocus: () => { live.select(null); live.setInside(0); } };
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
  nudge(objs, AR_NUDGE[D.id]);
  // Esc sin nada seleccionado vuelve a la infografía
  mod.bindPanel(s, { onEscape: () => { s.select(null); if (document.body.dataset.mode === "ar") setFocus(null); } });
  return { id: D.id, demo: D.demo, view: D.view, st: D.st, T: D.T, obj, objs, el: s.el, svg: s.el.querySelector("svg"), box: boxOf(cx, cy, W, H),
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
// en FOCUS, MindAR sólo busca el marcador de la estación activa (y el de la infografía completa, para sostenerla de
// lejos): menos carga y sin saltos a otro marcador. Se intercepta su paso de detección.
function patchController() {
  const c = mindar?.controller;
  if (!c || c.__pm) return;
  const detect = c._detectAndMatch.bind(c);
  c._detectAndMatch = (input, idx) => detect(input, allowed ? idx.filter((i) => allowed.has(i)) : idx);
  c.__pm = true;
}
// La cámara se pide apenas se toca "Escanear infografía", ANTES de preparar las diez láminas (~5 s): si la persona la
// rechaza, va directo al demo con la explicación de cómo reactivarla, sin pantalla de carga de por medio. Concedida,
// el mismo stream se le entrega a MindAR (no se abre la cámara dos veces).
const CAM = { audio: false, video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } };
let camStream = null;
async function askCamera() {
  const btn = $("[data-start-ar]");
  btn.disabled = true;
  btn.textContent = "Pidiendo la cámara…";
  try {
    camStream = await navigator.mediaDevices.getUserMedia(CAM);
    return true;
  } catch (err) {
    report("camara", err, "permiso");
    camDenied(err);
    return false;
  }
}
// sin cámara: al demo, con un aviso que explica qué pasó y cómo volver a intentarlo
function camDenied(err) {
  const n = err?.name || "";
  const how = n === "NotAllowedError" || n === "SecurityError"
    ? "Para usar la realidad aumentada, permite la cámara en los ajustes del sitio (el ícono junto a la dirección, o Ajustes › Safari › Cámara en iPhone y iPad) y toca Reintentar."
    : n === "NotReadableError" ? "Otra app está usando la cámara. Ciérrala y toca Reintentar."
      : "Mientras tanto, puedes recorrer la infografía en el demo.";
  const box = $("[data-notice]");
  box.querySelector("[data-notice-title]").textContent = camMessage(err).split(" · ")[0];
  box.querySelector("[data-notice-text]").textContent = how;
  box.hidden = false;
  return startDemo();
}
$("[data-notice-ok]").addEventListener("click", () => { $("[data-notice]").hidden = true; });
$("[data-notice-retry]").addEventListener("click", () => {
  const q = new URLSearchParams(location.search); q.delete("demo");
  location.replace(location.pathname + (q.size ? `?${q}` : ""));
});
async function startAR() {
  if (!(await askCamera())) return;
  setAdaptive(true);
  setMode("ar");
  exitBtn.hidden = false;
  document.body.dataset.ar = "loading";
  pre.hidden = false;
  const total = AR_DEFS.length + 4;    // motor, marcadores, diez láminas, cámara
  let done = 0;
  const task = async (label, fn) => { progress(done, total, label); await painted(); try { return await fn(); } finally { progress(++done, total, label); } };
  let THREE, CSS3DObject, mindSrc, LABELS;
  try {
    await task("Cargando el motor de realidad aumentada…", async () => {
      THREE = await import("three");
      ({ CSS3DObject } = await import("three/addons/renderers/CSS3DRenderer.js"));
      await import("../vendor/mindar/mindar-image-three.prod.js");
      const { STATIONS } = await import("./stations.js");
      LABELS = Object.fromEntries(STATIONS.map((st) => [st.id, st.label]));
    });
    // los marcadores se descargan aquí y MindAR los lee de memoria (no se bajan dos veces)
    mindSrc = await task("Descargando los marcadores de la infografía…", async () => {
      const res = await fetch(`assets/targets.mind?v=${MIND_VERSION}`);
      if (!res.ok) throw new Error(`targets.mind: HTTP ${res.status}`);
      return URL.createObjectURL(await res.blob());
    });
  } catch (err) {
    console.error(err);
    report("ar-carga", err, "motor o marcadores");
    return toDemo("No se pudo cargar el AR · mostrando demo");
  }
  T3 = THREE;
  const n = AR_DEFS.length + 1;
  arStations.push(await task(`Preparando las animaciones · 1 de ${n} · Chancado Primario`, () => buildChancado(CSS3DObject)));
  for (const [i, D] of AR_DEFS.entries()) {
    try { arStations.push(await task(`Preparando las animaciones · ${i + 2} de ${n} · ${D.st.name}`, () => buildStation(D, CSS3DObject))); }
    catch (err) { console.error(`[AR] no se pudo armar ${D.id}`, err); report("ar-lamina", err, D.id); }
  }
  // marcador de cada estación (1 chancado, 2… las de AR_DEFS), etiqueta impresa y su hotspot
  for (const S of arStations) {
    S.idx = S.id === "chancado" ? 1 : AR_DEFS.findIndex((D) => D.id === S.id) + 2;
    S.label = LABELS[S.demo] ? rectBox(LABELS[S.demo]) : S.box;
    S.zoom = S.svg ? zoomable(S.svg) : null;
    S.hot = hotspotFor(S);
  }

  mindar = new window.MINDAR.IMAGE.MindARThree({
    container: $("#ar"),
    imageTargetSrc: mindSrc,
    maxTrack: 1,
    uiLoading: "no", uiScanning: "no", uiError: "no",
    // MindAR filtra cada pose: corte bajo = menos temblor quieto; beta alto = menos retraso al moverse.
    // warmup/miss altos: "encontrado" y "perdido" no parpadean con un cuadro malo.
    filterMinCF: 0.0005, filterBeta: 20,
    warmupTolerance: 5, missTolerance: 10,
  });
  const { renderer, cssRenderer, cssScene, camera } = mindar;
  camera3 = camera; V3 = new THREE.Vector3();
  cssLayer = cssRenderer.domElement;
  cssLayer.classList.add("ar-layer");
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
  const raw = new THREE.Matrix4();
  for (const H of HOSTS) {
    H.anchor.onTargetFound = () => {
      endLost();
      pmTrack.found();
      if (host !== H) pose.ready = false;      // otro marcador: el filtro parte de cero
      host = H;
      syncUi();
    };
    H.anchor.onTargetUpdate = () => {
      if (host !== H || !H.anchor.visible) return;
      raw.multiplyMatrices(H.anchor.group.matrix, H.M);
      // pose degenerada: se mantiene la última válida; varias seguidas = MindAR "sigue" algo que no es el papel
      // (el piso, la mesa): se trata como pérdida, para que la lámina no quede congelada flotando sobre el entorno
      if (!poseUpdate(raw, performance.now())) { if (pose.rejected >= LOST_REJECTS) beginLost(); return; }
      endLost();
      if (pmTrack.open || pmTrack.searchFrom) pmTrack.found();
      cssDirty = true;
      updateView();
    };
    H.anchor.onTargetLost = () => { if (host === H) beginLost(); };
  }

  // cámara trasera a 1280×720 (~30 fps): equilibrio entre nitidez y fluidez. MindAR la pide sin resolución y los
  // navegadores entregan 640×480, donde el arte de líneas finas (sobre todo el rajo) casi no deja puntos.
  const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => {
    // la primera vez, el stream que se pidió al tocar "Escanear" (ya con permiso); después (al reanudar), uno nuevo
    if (c?.video && camStream?.getVideoTracks()[0]?.readyState === "live") { const s0 = camStream; camStream = null; return Promise.resolve(s0); }
    return gum(c?.video ? { ...c, video: { ...(typeof c.video === "object" ? c.video : {}), ...CAM.video } } : c)
      .catch((err) => { report("camara", err, "getUserMedia"); throw err; }); // MindAR rechaza sin el motivo: se registra aquí
  };
  try {
    await task("Abriendo la cámara…", () => mindar.start());
    pmTrack.start();
  } catch (err) {
    console.error(err);
    report("camara", err, "mindar.start");
    return toDemo(`${camMessage(err)} · mostrando demo`);
  }
  patchController();
  URL.revokeObjectURL(mindSrc);
  pre.hidden = true;
  syncUi();
  // CSS3D se redibuja sólo cuando el seguimiento movió algo (MindAR entrega ~30 poses/s; la pantalla va a 60–120 Hz)
  addEventListener("resize", () => { cssDirty = true; });
  const loop = () => {
    if (cssDirty) { cssDirty = false; cssRenderer.render(cssScene, camera); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  setInterval(watchShaky, 500);
  // al volver a la app la cámara puede quedar pausada o cortada (iOS la corta en segundo plano)
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resumeCamera(); });
  addEventListener("pagehide", () => { try { mindar.stop(); } catch {} });
}

// ---------------------------------------------------------------- pose estable
// One Euro sobre la pose descompuesta (posición, cuaternión, escala): quieto suaviza mucho (menos temblor) y al moverse
// sigue rápido (menos retraso). Antes, las poses degeneradas (saltos de escala, papel visto de canto o de espaldas) se
// descartan: eran las láminas "explotadas" al re-engancharse.
const pose = { ready: false, rejected: 0, jitter: 0 };
const lowpass = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
// Pérdida del marcador: la escena se desvanece de inmediato (LOST_FADE_MS) y al terminar se oculta y se pausan las
// simulaciones (show(S, false) → setActive(false)). Si el marcador vuelve durante el desvanecido, se recupera sin
// salto. La lámina fijada con el alfiler no está en esta capa: no se ve afectada.
// Sin marcador, en foco (T3): el panel se atenúa y queda bloqueado (inert: no responde a toques ni teclado) pero sigue
// en su lugar, con la lectura congelada en el último valor (la simulación está en pausa). La lámina fijada no se bloquea.
// Fijar y Ampliar NO se bloquean: Fijar sirve justamente para cuando se pierde la infografía (y el aviso lo sugiere).
function lockPanel() {
  const lock = !!arCurrent && !pinned && (!host || !!lostSince);
  if (panel.hasAttribute("data-lost") === lock) return;
  panel.toggleAttribute("data-lost", lock);
  const view = panel.querySelector(".panel-view:not([hidden])");
  const parts = view ? [...view.querySelectorAll(":scope > .readout-row, :scope > .chips, :scope > .controls, :scope > .seq > :not(.ar-actions)")] : [];
  for (const el of panel.querySelectorAll("[data-lost-part]")) { el.inert = false; el.removeAttribute("data-lost-part"); }
  if (lock) for (const el of parts) { el.inert = true; el.setAttribute("data-lost-part", ""); }
  if (lock) arCurrent.setActive(false); // la lectura se congela ya, no al terminar el desvanecido
}
// Seguimiento (T6): pérdidas del marcador, duración de cada una y parte de la sesión en "Buscando…" (desde que se abre
// la cámara). En el HUD de ?debug; pmTrack.export() lo entrega como objeto (o JSON con copy(pmTrack.json())) para
// comparar una sesión con otra.
const pmTrack = (window.pmTrack = {
  t0: 0, searchFrom: 0, searchMs: 0, losses: [], open: null,
  start() { const t = performance.now(); this.t0 = t; this.searchFrom = t; },
  search(on) {
    if (!this.t0) return;
    const t = performance.now();
    if (on && !this.searchFrom) this.searchFrom = t;
    if (!on && this.searchFrom) { this.searchMs += t - this.searchFrom; this.searchFrom = 0; }
  },
  lost() { if (this.t0 && !this.open) this.open = { at: performance.now() }; this.search(true); },
  found() {
    if (this.open) { this.losses.push({ desde_s: +((this.open.at - this.t0) / 1000).toFixed(1), duracion_s: +((performance.now() - this.open.at) / 1000).toFixed(2) }); this.open = null; }
    this.search(false);
  },
  export() {
    const t = performance.now(), ses = this.t0 ? t - this.t0 : 0, buscando = this.searchMs + (this.searchFrom ? t - this.searchFrom : 0);
    const d = this.losses.map((l) => l.duracion_s);
    return { sesion_s: +(ses / 1000).toFixed(1), perdidas: this.losses.length + (this.open ? 1 : 0), duraciones_s: d,
      duracion_media_s: d.length ? +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2) : 0, duracion_max_s: d.length ? Math.max(...d) : 0,
      buscando_pct: ses ? +(buscando / ses * 100).toFixed(1) : 0, perdida_abierta: !!this.open, detalle: this.losses };
  },
  json() { return JSON.stringify(this.export(), null, 1); },
});
window.pmHudExtra = () => {
  if (!pmTrack.t0) return "";
  const e = pmTrack.export(), last = e.duraciones_s.at(-1);
  return `AR     pérdidas ${e.perdidas}${last != null ? ` · última ${last} s` : ""} · buscando ${e.buscando_pct} % de ${e.sesion_s} s`;
};
function beginLost() {
  if (lostSince) return;
  lostSince = performance.now();
  pmTrack.lost();
  lockPanel();
  cssLayer.classList.add("ar-layer--out");
  hotLayer.hidden = true;
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    host = null;
    pose.ready = false;
    for (const S of arStations) show(S, false);
    cssLayer.classList.remove("ar-layer--out");
    syncUi();
  }, LOST_FADE_MS);
}
function endLost() {
  if (!lostSince) return;
  clearTimeout(fadeTimer);
  lostSince = 0;
  cssLayer.classList.remove("ar-layer--out");
  const was = panel.hasAttribute("data-lost");
  lockPanel();
  if (was && arCurrent?.shown) arCurrent.setActive(true);
}
function poseUpdate(m, now) {
  if (!pose.p) {
    pose.p = new T3.Vector3(); pose.q = new T3.Quaternion(); pose.s = new T3.Vector3();
    pose.rp = new T3.Vector3(); pose.rq = new T3.Quaternion(); pose.rs = new T3.Vector3(); pose.n = new T3.Vector3();
  }
  const { rp, rq, rs } = pose;
  const det = m.determinant();
  m.decompose(rp, rq, rs);
  // normal del papel frente a la cámara: la columna Z de la pose contra la dirección a la cámara
  const e = m.elements;
  const facing = (pose.n.set(e[8], e[9], e[10]).normalize().dot(V3.copy(rp).negate().normalize())) * Math.sign(det);
  const size = Math.cbrt(Math.abs(det));
  let ok = Number.isFinite(det) && size > 0 && Number.isFinite(rp.x) && Math.abs(facing) > EDGE_ON;
  if (ok && pose.ready) {
    const jump = size / pose.size;
    ok = jump < JUMP && jump > 1 / JUMP && Math.sign(facing) === pose.side;
  }
  if (!ok) {
    if (++pose.rejected < REJECT_MAX || !Number.isFinite(det) || size === 0) return false;
    pose.ready = false;            // demasiados seguidos: el papel sí cambió (re-sincronizar)
  }
  pose.rejected = 0;
  const dt = Math.min(Math.max((now - (pose.t || now)) / 1000, 1 / 120), 0.25);
  pose.t = now;
  if (!pose.ready) {
    pose.p.copy(rp); pose.q.copy(rq); pose.s.copy(rs);
    pose.v = 0; pose.w = 0; pose.jitter = 0; pose.side = Math.sign(facing);
    pose.ready = true;
  } else {
    // posición y escala: velocidad relativa a la distancia (no depende de las unidades)
    const dist = pose.p.length() || 1;
    const v = rp.distanceTo(pose.p) / dist / dt;
    pose.v += (v - pose.v) * lowpass(POSE.dCutoff, dt);
    const a = lowpass(POSE.minCutoff + POSE.beta * pose.v, dt);
    pose.p.lerp(rp, a);
    pose.s.lerp(rs, a);
    // rotación: velocidad angular → slerp
    const w = pose.q.angleTo(rq) / dt;
    pose.w += (w - pose.w) * lowpass(POSE.dCutoff, dt);
    pose.q.slerp(rq, lowpass(POSE.rotMinCutoff + POSE.rotBeta * pose.w, dt));
    // vibración medida: lo que se aparta la pose cruda de la suavizada
    pose.jitter += (rp.distanceTo(pose.p) / dist - pose.jitter) * 0.1;
  }
  pose.size = Math.cbrt(Math.abs(pose.s.x * pose.s.y * pose.s.z));
  world.matrix.compose(pose.p, pose.q, pose.s);
  return true;
}

// ---------------------------------------------------------------- qué se ve y qué se puede tocar
// mostrar/ocultar una lámina (y su sombra) y pausar su animación cuando no se ve
function show(S, v) {
  if (S === pinnedS || S.shown === v) return;
  clearTimeout(S.fadeT); S.fading = false;
  S.shown = v;
  S.objs.forEach((o) => {
    o.visible = v;
    o.element.classList.remove("ar-out");
    o.element.classList.toggle("ar-in", v);
  });
  S.setActive(v);
  cssDirty = true;
}
// en FOCUS, las demás se desvanecen y luego se ocultan (su animación se pausa)
function fadeOut(S) {
  if (!S.shown || S.fading || S === pinnedS) return;
  S.fading = true;
  S.objs.forEach((o) => { o.element.classList.remove("ar-in"); o.element.classList.add("ar-out"); });
  S.fadeT = setTimeout(() => { S.fading = false; if (arCurrent && arCurrent !== S) show(S, false); }, FADE_MS);
}
// rectángulo en pantalla (coordenadas normalizadas -1…1) de una caja del mundo, y si su proyección es confiable
const P4 = [[0, 0], [0, 0], [0, 0], [0, 0]];
function screenBox([x0, x1, y0, y1]) {
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
  let best = null, bestCover = 0;
  for (const S of arStations) {
    const [a, b, c, d, bad] = screenBox(S.box);
    const vw = Math.min(b, 1) - Math.max(a, -1), vh = Math.min(d, 1) - Math.max(c, -1);
    const on = !bad && vw > 0 && vh > 0;
    if (arCurrent) {                       // FOCUS: sólo la estación activa
      if (S === arCurrent) { show(S, on); focusCover = on ? (vw * vh) / 4 : 0; } else if (S.shown) fadeOut(S);
      continue;
    }
    show(S, on);
    if (!on) continue;
    // enfoque automático al acercarse mucho a una estación (centrada y ocupando buena parte de la pantalla)
    const cover = (vw * vh) / 4;
    const mx = (Math.max(a, -1) + Math.min(b, 1)) / 2, my = (Math.max(c, -1) + Math.min(d, 1)) / 2;
    if (S.id === autoBlock && cover < FOCUS_OUT) autoBlock = null;
    if (Math.abs(mx) < 0.5 && Math.abs(my) < 0.5 && cover >= FOCUS_IN && S.id !== autoBlock && cover > bestCover) { best = S; bestCover = cover; }
  }
  if (!arCurrent) {
    placeHotspots();
    if (best && !pinned) setFocus(best);
  } else releaseFocus();
}
// Soltar el foco al alejarse (T2): si la estación enfocada llegó a estar cerca (≥ FOCUS_NEAR de la pantalla) y ahora
// ocupa menos que FOCUS_OUT durante FOCUS_LEAVE_MS, se vuelve a la vista general. Si lo que se sigue pasa a ser el
// marcador de la infografía completa, sin esperar. No se suelta si está fijada ni si se eligió tocándola desde lejos
// (nunca hubo acercamiento). Las poses rechazadas no mueven la escena, así que no cuentan como alejarse.
const FOCUS_NEAR = FOCUS_IN * 0.8, FOCUS_LEAVE_MS = 600;
let focusCover = 0, focusMax = 0, farSince = 0;
function releaseFocus() {
  if (!arCurrent || pinned) { farSince = 0; return; }
  focusMax = Math.max(focusMax, focusCover);
  if (focusMax < FOCUS_NEAR || focusCover >= FOCUS_OUT) { farSince = 0; return; }
  const now = performance.now();
  farSince ||= now;
  if (host?.i === 0 || now - farSince > FOCUS_LEAVE_MS) setFocus(null);
}
// la estación enfocada recibe toques, su panel, Fijar y Ampliar; las demás se apagan
function setFocus(S) {
  if (S === arCurrent) { syncUi(); return; }
  const prev = arCurrent;
  if (prev) {
    if (pinned) togglePin(false);
    prev.unfocus?.();
    prev.el.style.pointerEvents = "none";
    prev.el.classList.remove("is-focus");
    autoBlock = prev.id;               // acercado a ella: que no se vuelva a enfocar sola al salir
  }
  arCurrent = S;
  allowed = S ? new Set([0, S.idx]) : null;
  focusCover = focusMax = farSince = 0;
  hideToast();
  shakySince = 0; toastShown = false;
  if (S) {
    S.el.style.pointerEvents = "auto";
    S.el.classList.add("is-focus");
    reraster(S);
    for (const O of arStations) if (O !== S) fadeOut(O);
    showView(S.view, S.st);
    placeActions(S);
    coach(false);
  }
  syncUi();
  if (host && pose.ready) updateView();
}
// enlaces entre estaciones desde una lámina (p. ej. los destinos de Flotación): en el demo, la estación por su hash;
// en AR, se enfoca esa estación
addEventListener("pm:goto", (e) => {
  if (document.body.dataset.mode === "ar") { const S = arStations.find((x) => x.id === e.detail); if (S) setFocus(S); return; }
  location.hash = `#${e.detail}`;
});

// estado de la interfaz: vista general / enfoque / buscando
// ?calibrar: flechas para mover la lámina enfocada de a 1 px de la infografía y ver cuánto (para AR_NUDGE)
const calib = new URLSearchParams(location.search).has("calibrar") ? (() => {
  const box = document.createElement("div");
  box.className = "calib";
  box.innerHTML = `<output data-calib-val></output><div>${[["←", -1, 0], ["→", 1, 0], ["↑", 0, -1], ["↓", 0, 1]].map(([t, x, y]) => `<button type="button" data-dx="${x}" data-dy="${y}" aria-label="Mover ${t}">${t}</button>`).join("")}</div>`;
  document.body.appendChild(box);
  const off = {};
  const show = () => { const S = arCurrent; box.hidden = !S; if (!S) return; const d = off[S.id] || [0, 0]; box.querySelector("[data-calib-val]").textContent = `AR_NUDGE.${S.id} = [${d[0]}, ${d[1]}]`; };
  box.addEventListener("click", (e) => {
    const bt = e.target.closest("button"), S = arCurrent; if (!bt || !S) return;
    const dx = +bt.dataset.dx, dy = +bt.dataset.dy, d = (off[S.id] ||= [0, 0]);
    d[0] += dx; d[1] += dy; nudge(S.objs, [dx, dy]); cssDirty = true; show();
    console.log(`AR_NUDGE.${S.id} = [${(AR_NUDGE[S.id]?.[0] || 0) + d[0]}, ${(AR_NUDGE[S.id]?.[1] || 0) + d[1]}]`);
  });
  return { show };
})() : null;
let lastClockState = "";
function syncUi() {
  calib?.show();
  lockPanel();
  const tracking = !!host;
  const state = arCurrent ? "focus" : tracking ? "overview" : "scan";
  document.body.dataset.ar = state;
  // vista general: las láminas animan a 30 cuadros/s, repartidas entre cuadros (y bajan a 15 si el equipo no da);
  // en foco, la estación elegida anima a pleno ritmo (js/clock.js)
  if (state !== lastClockState) { lastClockState = state; setFps(state === "focus" ? 0 : 30); }
  if (tracking) document.body.dataset.tracking = "on"; else delete document.body.dataset.tracking;
  exitBtn.querySelector("span").textContent = arCurrent ? "Salir" : "Inicio";
  exitBtn.setAttribute("aria-label", arCurrent ? "Salir de la estación y volver a la infografía" : "Salir del escaneo y volver al inicio");
  $("[data-scan]").hidden = tracking || pinned;
  hotLayer.hidden = state !== "overview";
  if (pinned) ui.status.textContent = "Escena fijada en pantalla";
  // en FOCUS sólo se busca el marcador de esa estación (o la infografía completa): se dice cuál
  else if (arCurrent) ui.status.textContent = tracking ? `Estación ${arCurrent.st.n} · ${arCurrent.st.name}` : `Buscando ${arCurrent.st.name}…`;
  else ui.status.textContent = tracking ? "Toca una estación para enfocarla" : "Buscando la infografía…";
  if (state === "overview" && !store.get("pm-coach-focus")) coach(true);
}
// una lámina rasterizada chica (vista de lejos) se ve borrosa al acercarse: al enfocarla se vuelve a rasterizar
function reraster(S) {
  S.objs.forEach((o) => { o.element.style.willChange = "auto"; });
  requestAnimationFrame(() => requestAnimationFrame(() => S.objs.forEach((o) => { o.element.style.willChange = "transform"; })));
}
// tocar fuera de la estación enfocada (en la cámara) vuelve a la infografía
document.addEventListener("click", (e) => {
  if (document.body.dataset.mode !== "ar" || !arCurrent || pinned || !e.target.closest?.("#ar")) return;
  if (e.target.closest(".ar-plate.is-focus")) return;
  setFocus(null);
});

// ---------------------------------------------------------------- hotspots sobre las etiquetas impresas
const hotLayer = $("[data-ar-hotspots]");
function hotspotFor(S) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ar-hotspot";
  b.setAttribute("aria-label", `Enfocar estación ${S.st.n}: ${S.st.name}`);
  b.innerHTML = '<i class="ar-hotspot-ring"></i>';
  b.addEventListener("click", (e) => { e.stopPropagation(); setFocus(S); });
  hotLayer.appendChild(b);
  return b;
}
// cada hotspot sigue a su etiqueta en pantalla; área táctil mínima de 44 px
function placeHotspots() {
  const W = innerWidth, H = innerHeight;
  for (const S of arStations) {
    const [a, b, c, d, bad] = screenBox(S.label);
    const x = ((a + 1) / 2) * W, y = ((1 - d) / 2) * H, w = ((b - a) / 2) * W, h = ((d - c) / 2) * H;
    const on = S.shown && !bad && x + w > 0 && x < W && y + h > 0 && y < H;
    S.hot.hidden = !on;
    if (!on) continue;
    const bw = Math.max(44, w + 12), bh = Math.max(44, h + 12);
    S.hot.style.cssText = `width:${bw.toFixed(0)}px;height:${bh.toFixed(0)}px;transform:translate(${(x + w / 2 - bw / 2).toFixed(1)}px,${(y + h / 2 - bh / 2).toFixed(1)}px)`;
    S.hot.dataset.x = (x + w / 2).toFixed(0); S.hot.dataset.y = (y - 4).toFixed(0);
  }
  if (!coachEl.hidden) placeCoach();
}
// coachmark: la primera vez que se ve la infografía, una burbuja sobre el hotspot más central
const coachEl = $("[data-coach]");
function coach(on) {
  if (!on) { if (!coachEl.hidden) { coachEl.hidden = true; store.set("pm-coach-focus", "1"); } return; }
  if (coachEl.hidden) { coachEl.hidden = false; placeCoach(); }
}
function placeCoach() {
  const hs = arStations.map((S) => S.hot).filter((h) => !h.hidden);
  if (!hs.length) { coachEl.style.visibility = "hidden"; return; }
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const h = hs.reduce((m, h) => (Math.hypot(h.dataset.x - cx, h.dataset.y - cy) < Math.hypot(m.dataset.x - cx, m.dataset.y - cy) ? h : m));
  coachEl.style.visibility = "";
  coachEl.style.left = `${Math.min(Math.max(+h.dataset.x, 140), innerWidth - 140)}px`;
  coachEl.style.top = `${+h.dataset.y}px`;
}
coachEl.querySelector("button").addEventListener("click", () => coach(false));

// ---------------------------------------------------------------- Fijar y Ampliar (junto al reproductor)
const actions = $("[data-ar-actions]");
const pinBtn = $("[data-pin]");
// la barra va dentro del reproductor del panel de la estación enfocada
function placeActions(S) {
  const seq = document.querySelector(`[data-panel-view="${S.view}"] .seq`);
  if (seq && actions.parentNode !== seq) seq.appendChild(actions);
  actions.hidden = !seq;
}
// aviso: si el seguimiento se pierde o vibra un rato, se sugiere Fijar (una vez por estación enfocada)
const toast = $("[data-toast]");
let shakySince = 0, toastShown = false, toastTimer = 0;
// T7b: tras SEARCH_DEMO_MS seguidos en "Buscando…" se ofrece el demo (no se fuerza). Pasar al demo no recarga:
// se detienen la cámara y MindAR, se apaga la escena AR y se abre el explorador.
const SEARCH_DEMO_MS = 12000;
const scanDemo = $("[data-scan-demo]");
function watchSearch() {
  const long = document.body.dataset.mode === "ar" && pmTrack.searchFrom && !pinned && performance.now() - pmTrack.searchFrom > SEARCH_DEMO_MS;
  if (scanDemo.hidden === !long) return;
  scanDemo.hidden = !long;
}
scanDemo.addEventListener("click", arToDemo);
function arToDemo() {
  if (document.body.dataset.mode !== "ar") return;
  try { mindar?.stop(); } catch {}
  document.querySelectorAll("video").forEach((v) => v.srcObject?.getTracks?.().forEach((t) => t.stop()));
  if (pinned) togglePin(false);
  if (arCurrent) { arCurrent.unfocus?.(); arCurrent.el.classList.remove("is-focus"); arCurrent = null; }
  for (const S of arStations) { S.objs.forEach((o) => (o.visible = false)); S.shown = false; S.setActive(false); }
  $("#ar").hidden = true;
  hotLayer.hidden = true;
  $("[data-scan]").hidden = true;
  scanDemo.hidden = true;
  hideToast();
  coach(false);
  panel.removeAttribute("data-lost");
  for (const el of panel.querySelectorAll("[data-lost-part]")) { el.inert = false; el.removeAttribute("data-lost-part"); }
  // la lámina del chancado primario vuelve a ser la del demo (el AR la había preparado como objeto 3D)
  plate.classList.remove("ar-plate", "is-focus");
  plate.removeAttribute("style");
  plate.style.pointerEvents = "";
  delete plate.dataset.baked;
  pmTrack.search(false);
  setFps(0);
  toDemo("Infografía · Proceso minero");
}
function watchShaky() {
  watchSearch();
  if (!arCurrent || pinned || toastShown) { shakySince = 0; return; }
  const shaky = (lostSince && performance.now() - lostSince > 300) || (host && pose.jitter > JITTER_MAX);
  if (!shaky) { shakySince = 0; return; }
  shakySince ||= performance.now();
  if (performance.now() - shakySince > SHAKY_MS) {
    toastShown = true;
    toast.hidden = false;
    pinBtn.classList.add("is-nudge");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }
}
function hideToast() { toast.hidden = true; pinBtn.classList.remove("is-nudge"); }
toast.addEventListener("click", () => { hideToast(); if (!pinned) togglePin(true); });

const pinLayer = $("[data-pin-layer]");
const zoomHud = $("[data-zoom-hud]");
// fijar: la lámina enfocada sale del seguimiento y queda plana en pantalla (sirve cuando el seguimiento está inestable)
function togglePin(on = !pinned) {
  const S = on ? arCurrent : pinnedS;
  if (!S || on === pinned) return;
  pinned = on;
  pinnedS = on ? S : null;
  pinBtn.setAttribute("aria-pressed", String(on));
  pinBtn.querySelector("span").textContent = on ? "Fijado" : "Fijar";
  hideToast();
  if (on) {
    S.objs.forEach((o) => world.remove(o)); // CSS3D suelta el elemento (y su sombra)…
    pinLayer.hidden = false;
    pinLayer.appendChild(S.el);              // …y lo ponemos plano en pantalla
    S.el.style.transform = "";
    S.el.style.display = "";
    S.el.style.visibility = "visible";
    S.el.style.pointerEvents = "auto";
    S.el.classList.remove("ar-out", "ar-in");
    S.el.classList.add("plate--pinned");
    sizeHud();
    S.setActive(true);
  } else {
    S.zoom?.reset();
    S.el.classList.remove("plate--pinned", "is-zoomed");
    pinLayer.hidden = true;
    S.objs.forEach((o) => world.add(o));
    S.shown = null;
    cssDirty = true;
    if (host && pose.ready) updateView(); else show(S, false);
  }
  zoomHud.hidden = !on;
  syncZoom();
  syncUi();
}
pinBtn.addEventListener("click", () => togglePin());

// zoom 1×–3× sobre la lámina fijada, escalando el viewBox de su SVG (como "Explorar interior"): los detalles
// chicos se mantienen nítidos y los toques siguen cayendo en su equipo. Ampliar fija la escena: el zoom
// amplificaría el temblor del seguimiento.
function zoomable(svg) {
  if (svg.__zoom) return svg.__zoom;
  const set = Element.prototype.setAttribute;
  let base = (svg.getAttribute("viewBox") || "0 0 100 100").split(/[\s,]+/).map(Number), z = 1, fx = 0.5, fy = 0.5;
  const view = () => {
    const [x, y, w, h] = base, W = w / z, H = h / z;
    return [Math.min(Math.max(x + fx * w - W / 2, x), x + w - W), Math.min(Math.max(y + fy * h - H / 2, y), y + h - H), W, H];
  };
  const apply = () => {
    const [x0, y0, W, H] = view(), [x, y, w, h] = base;
    fx = (x0 + W / 2 - x) / w; fy = (y0 + H / 2 - y) / h;
    set.call(svg, "viewBox", `${x0.toFixed(2)} ${y0.toFixed(2)} ${W.toFixed(2)} ${H.toFixed(2)}`);
  };
  // si la estación cambia su viewBox (el chancado al explorar el interior), el zoom se aplica sobre el nuevo
  svg.setAttribute = function (k, v) { if (k === "viewBox") { base = String(v).split(/[\s,]+/).map(Number); apply(); } else set.call(this, k, v); };
  return (svg.__zoom = {
    get z() { return z; },
    // nuevo zoom manteniendo fijo el punto que está en la fracción (px, py) del SVG en pantalla
    at(nz, px = 0.5, py = 0.5) {
      const [x0, y0, W, H] = view(), [x, y, w, h] = base;
      const ux = x0 + px * W, uy = y0 + py * H;
      z = Math.min(Math.max(nz, 1), ZOOM_MAX);
      const W2 = w / z, H2 = h / z;
      fx = (ux - px * W2 + W2 / 2 - x) / w; fy = (uy - py * H2 + H2 / 2 - y) / h;
      apply();
    },
    // desplazar una fracción del ancho/alto visible
    pan(dx, dy) { fx -= dx / z; fy -= dy / z; apply(); },
    reset() { z = 1; fx = fy = 0.5; apply(); },
  });
}
const zoomVal = $("[data-zoom-val]");
function syncZoom() {
  const S = pinnedS, z = S?.zoom?.z ?? 1;
  zoomVal.textContent = `${z.toFixed(1).replace(".", ",")}×`;
  S?.el.classList.toggle("is-zoomed", z > 1.01);
  pinLayer.classList.toggle("is-zoomed", z > 1.01);
}
function zoomBy(f, px, py) {
  const S = pinnedS;
  if (!S?.zoom) return;
  S.zoom.at(S.zoom.z * f, px, py);
  syncZoom();
}
// punto de la pantalla → fracción dentro del SVG de la lámina fijada
function svgFrac(cx, cy) {
  const r = pinnedS?.svg?.getBoundingClientRect();
  if (!r?.width) return [0.5, 0.5];
  return [Math.min(Math.max((cx - r.left) / r.width, 0), 1), Math.min(Math.max((cy - r.top) / r.height, 0), 1)];
}
$("[data-zoom]").addEventListener("click", () => {
  if (!pinned) togglePin(true);
  const z = pinnedS?.zoom?.z ?? 1;
  zoomBy((z < 1.9 ? 2 : Math.min(z + 0.5, ZOOM_MAX)) / z);
});
$("[data-zoom-in]").addEventListener("click", () => zoomBy(1.25));
$("[data-zoom-out]").addEventListener("click", () => zoomBy(0.8));
$("[data-zoom-reset]").addEventListener("click", () => { pinnedS?.zoom?.reset(); syncZoom(); });
// pellizco, arrastre (con zoom) y doble toque sobre la lámina fijada; rueda en el computador
{
  const pts = new Map();
  let pinch = null, dragged = false, lastTap = null;
  pinLayer.addEventListener("pointerdown", (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (pts.size === 1) dragged = false;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: pinnedS?.zoom?.z ?? 1 };
    }
  });
  pinLayer.addEventListener("pointermove", (e) => {
    const p = pts.get(e.pointerId);
    if (!p || !pinnedS?.zoom) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), [fx, fy] = svgFrac((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinnedS.zoom.at(pinch.z * (d / pinch.d), fx, fy);
      dragged = true;
      syncZoom();
    } else if (pts.size === 1 && pinnedS.zoom.z > 1.01) {
      if (!dragged && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) return;
      dragged = true;
      const r = pinnedS.svg.getBoundingClientRect();
      pinnedS.zoom.pan(dx / r.width, dy / r.height);
    }
  });
  const up = (e) => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!p || dragged || e.type === "pointercancel") return;
    // doble toque: alterna 1× ↔ 2× en ese punto
    const now = performance.now();
    if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      const [fx, fy] = svgFrac(e.clientX, e.clientY), z = pinnedS?.zoom?.z ?? 1;
      pinnedS?.zoom?.at(z > 1.4 ? 1 : 2, fx, fy);
      syncZoom();
      lastTap = null;
    } else lastTap = { t: now, x: e.clientX, y: e.clientY };
  };
  pinLayer.addEventListener("pointerup", up);
  pinLayer.addEventListener("pointercancel", up);
  // tras arrastrar o pellizcar, el "click" que sigue no debe elegir un equipo
  pinLayer.addEventListener("click", (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
  pinLayer.addEventListener("wheel", (e) => {
    if (!pinnedS?.zoom) return;
    e.preventDefault();
    const [fx, fy] = svgFrac(e.clientX, e.clientY);
    zoomBy(Math.exp(-e.deltaY * 0.0015), fx, fy);
  }, { passive: false });
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
    patchController();
    syncUi();
  } catch (err) {
    console.error(err);
    report("camara", err, "reanudar");
    ui.status.textContent = `${camMessage(err)} · recarga la página`;
  }
  resuming = false;
}

// ?demo abre el demo directo. Al final del módulo: startDemo usa constantes declaradas más arriba (homeBtn, la lista…)
if (new URLSearchParams(location.search).has("demo")) startDemo();
