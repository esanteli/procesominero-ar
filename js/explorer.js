// Explorador de la infografía completa (modo "Ver demo sin cámara").
// La infografía es el mapa: se puede arrastrar, hacer zoom y tocar cada estación.
// Al abrir una estación la cámara vuela a su encuadre; si la estación tiene módulo, éste monta su
// visualización sobre la misma infografía (en coordenadas de la imagen); si no, se muestra su ficha.
// La URL lleva la estación (#rajo, #chancado-primario…): sirve para enlazar directo y el botón atrás funciona.
import { POSTER, STATIONS, byId } from "./stations.js";
import { bake } from "./halo.js";
import { nextFrame, idle } from "./frames.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const $ = (s, el = document) => el.querySelector(s);
const MAX_ZOOM = 2.2; // px de pantalla por px de la infografía (la imagen viene a 2× → se mantiene nítida)

/**
 * @param {object} o
 * @param {HTMLElement} o.stage    contenedor del mapa
 * @param {object} o.builtins      estaciones que viven en app.js (p. ej. chancador): { [name]: { enter(ctx) → {focus}, leave() } }
 * @param {(view:string, station?:object) => void} o.onView  avisa el cambio de vista ("map" | "station" | <builtin>)
 */
export function createExplorer({ stage, builtins = {}, onView = () => {}, occluded = () => ({}) }) {
  const world = $("[data-world]", stage);
  const spot = $("[data-spot]", stage);
  const hotspots = $("[data-hotspots]", stage);
  const layer = $("[data-layer]", stage);
  world.style.width = `${POSTER.w}px`;
  world.style.height = `${POSTER.h}px`;

  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let cam = { s: 0.3, x: 0, y: 0 };
  let anim = 0;
  let current = null;      // estación abierta
  let mounted = null;      // { leave() } de la estación montada
  let mapView = null;      // cámara del mapa para volver a ella

  // ---------------------------------------------------------------- cámara
  const apply = () => { world.style.transform = `translate(${cam.x.toFixed(2)}px, ${cam.y.toFixed(2)}px) scale(${cam.s.toFixed(5)})`; };
  // caja del mapa: se mide sólo cuando cambia de tamaño (medirla justo después de cambiar el panel obligaba a recalcular
  // todo el layout en el acto, al abrir una estación)
  let boxC = null;
  const box = () => boxC || (boxC = stage.getBoundingClientRect());
  new ResizeObserver(() => { boxC = null; }).observe(stage);
  addEventListener("resize", () => { boxC = null; });
  // zona visible del mapa: la caja menos lo que la tapa encima (barra superior, panel o columna lateral: occluded()).
  // El mapa ocupa la pantalla completa; las estaciones se encuadran en esta zona para que no queden tapadas.
  function visible() {
    const b = box(), o = occluded() || {};
    const t = o.top || 0, r = o.right || 0, bo = o.bottom || 0, l = o.left || 0;
    return { x: l, y: t, w: Math.max(120, b.width - l - r), h: Math.max(120, b.height - t - bo) };
  }
  function fitRect([x, y, w, h], pad = 0.08, cap = MAX_ZOOM) {
    const v = visible();
    // tope de zoom: más allá la imagen de la infografía se ve pixelada (una estación vectorial puede pedir más)
    const s = Math.min(v.w / (w * (1 + 2 * pad)), v.h / (h * (1 + 2 * pad)), cap);
    return { s, x: v.x + v.w / 2 - (x + w / 2) * s, y: v.y + v.h / 2 - (y + h / 2) * s };
  }
  function fitAll() {
    const b = box();
    let s = Math.min(b.width / POSTER.w, b.height / POSTER.h);
    // en pantallas angostas la infografía completa queda muy chica: se encuadra por alto y se arrastra
    if (s * POSTER.h < b.height * 0.55) s = Math.min((b.height * 0.92) / POSTER.h, (b.width * 2.6) / POSTER.w);
    const x = s * POSTER.w > b.width ? 16 : (b.width - s * POSTER.w) / 2;
    return { s, x, y: (b.height - s * POSTER.h) / 2 };
  }
  const minScale = () => Math.min(box().width / POSTER.w, box().height / POSTER.h) * 0.9;
  function bound(c) {
    const b = box(), W = POSTER.w * c.s, H = POSTER.h * c.s, m = 60;
    c.x = W <= b.width ? (b.width - W) / 2 : clamp(c.x, b.width - W - m, m);
    c.y = H <= b.height ? (b.height - H) / 2 : clamp(c.y, b.height - H - m, m);
    return c;
  }
  let aim = null; // destino del último vuelo (para no repetirlo en refit)
  function flyTo(target, ms = 750, done) {
    cancelAnimationFrame(anim);
    aim = { ...target };
    if (still.matches) { cam = { ...target }; apply(); done?.(); return; }
    const from = { ...cam }, t0 = performance.now();
    // zoom con interpolación logarítmica (se siente pareja al acercar y al alejar)
    const step = (now) => {
      const u = ease(clamp((now - t0) / ms, 0, 1));
      const s = Math.exp(Math.log(from.s) + (Math.log(target.s) - Math.log(from.s)) * u);
      cam = { s, x: from.x + (target.x - from.x) * u, y: from.y + (target.y - from.y) * u };
      apply();
      if (u < 1) anim = requestAnimationFrame(step); else done?.();
    };
    anim = requestAnimationFrame(step);
  }
  function zoomAt(factor, px, py) {
    const s = clamp(cam.s * factor, minScale(), MAX_ZOOM);
    const k = s / cam.s;
    cam = bound({ s, x: px - (px - cam.x) * k, y: py - (py - cam.y) * k });
    apply();
  }

  // ---------------------------------------------------------------- puntos de la infografía
  for (const st of STATIONS) {
    const [x, y, w, h] = st.label;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hotspot";
    b.dataset.station = st.id;
    b.dataset.tone = st.tone;
    b.dataset.status = st.status;
    b.style.cssText = `left:${x - 14}px;top:${y - 14}px;width:${w + 28}px;height:${h + 28}px`;
    b.setAttribute("aria-label", `Estación ${st.n}: ${st.name}${st.status === "lista" ? "" : " (en desarrollo)"}`);
    b.innerHTML = `<i class="hotspot-ring"></i><span class="hotspot-tip">${st.n} · ${st.name}</span>`;
    hotspots.appendChild(b);
  }

  // ---------------------------------------------------------------- arrastrar, pellizcar y rueda (sólo en la vista general)
  const pts = new Map();
  let drag = null, moved = false;
  stage.addEventListener("pointerdown", (e) => {
    if (current || e.target.closest(".map-tools")) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    cancelAnimationFrame(anim);
    moved = false;
    drag = { cam: { ...cam }, pts: new Map(pts) };
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    const b = box();
    const P = [...pts.values()], P0 = [...drag.pts.values()];
    if (P.length >= 2 && P0.length >= 2) {
      const d = Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]), d0 = Math.hypot(P0[0][0] - P0[1][0], P0[0][1] - P0[1][1]) || 1;
      const cx = (P[0][0] + P[1][0]) / 2 - b.left, cy = (P[0][1] + P[1][1]) / 2 - b.top;
      const c0x = (P0[0][0] + P0[1][0]) / 2 - b.left, c0y = (P0[0][1] + P0[1][1]) / 2 - b.top;
      const s = clamp(drag.cam.s * (d / d0), minScale(), MAX_ZOOM), k = s / drag.cam.s;
      cam = bound({ s, x: cx - (c0x - drag.cam.x) * k, y: cy - (c0y - drag.cam.y) * k });
      moved = true;
    } else {
      const [x0, y0] = P0[0] || [e.clientX, e.clientY];
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true;
        // se captura el puntero recién al arrastrar: así un toque simple sigue llegando a la etiqueta
        try { stage.setPointerCapture(e.pointerId); } catch {}
      }
      if (!moved) return;
      cam = bound({ ...drag.cam, x: drag.cam.x + dx, y: drag.cam.y + dy });
    }
    apply();
  });
  const release = (e) => {
    pts.delete(e.pointerId);
    drag = pts.size ? { cam: { ...cam }, pts: new Map(pts) } : null;
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("wheel", (e) => {
    if (current) return;
    e.preventDefault();
    const b = box();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - b.left, e.clientY - b.top);
  }, { passive: false });
  // un toque (sin arrastre) sobre una etiqueta abre la estación
  hotspots.addEventListener("click", (e) => {
    const h = e.target.closest(".hotspot");
    if (!h || moved) return;
    go(h.dataset.station);
  });
  $("[data-zoom-in]", stage).addEventListener("click", () => { const b = box(); zoomAt(1.4, b.width / 2, b.height / 2); });
  $("[data-zoom-out]", stage).addEventListener("click", () => { const b = box(); zoomAt(1 / 1.4, b.width / 2, b.height / 2); });
  $("[data-zoom-fit]", stage).addEventListener("click", () => flyTo(fitAll(), 500));

  // ---------------------------------------------------------------- abrir / cerrar estaciones
  function showSpot(rect) {
    if (!rect) { spot.hidden = true; return; }
    const [x, y, w, h] = rect;
    spot.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    spot.hidden = false;
  }
  // sombra horneada de una lámina (necesita estar en el documento: se mide). Invisible con opacity, no con
  // visibility (con visibility el horneado salta los trazos).
  function bakeOff(el) {
    if (el.dataset.baked) return;
    bake(el);
    el.dataset.baked = "1";
  }
  // lámina armada en reposo: se pone un instante (invisible) para hornear su sombra y se saca. No se deja puesta: muchas
  // láminas en el documento encarecen todo lo que lo recorre (estilos, búsquedas) mientras se usa otra estación.
  function prebake(el) {
    if (el.dataset.baked || el.isConnected) return;
    const op = el.style.opacity;
    el.style.opacity = "0";
    layer.appendChild(el);
    bakeOff(el);
    el.remove();
    el.style.opacity = op;
  }
  async function open(id) {
    const st = byId(id);
    if (!st) return close();
    if (current?.id === id) return;
    if (!current) mapView = { ...cam };
    leaveCurrent();
    current = st;
    stage.dataset.view = "station";
    const spotEl = hotspots.querySelector(`.hotspot[data-station="${CSS.escape(id)}"]`);
    hotspots.querySelectorAll(".hotspot").forEach((h) => h.toggleAttribute("data-active", h === spotEl));
    let focus = st.focus, view = "station";
    const mk = (s) => performance.mark(`pm:${id}:${s}`); // marcas para el perfil (Performance de DevTools / ?perf)
    const stale = () => { if (current === st) return false; spotEl?.removeAttribute("data-loading"); return true; }; // se fue a otra mientras cargaba
    mk("inicio");
    if (st.module?.startsWith("builtin:")) {
      const b = builtins[st.module.slice(8)];
      const m = b?.enter({ station: st, layer });
      focus = m?.focus || focus;
      mounted = { leave: () => b.leave?.() };
      view = st.module.slice(8);
      mk("montada");
    } else if (st.module) {
      // módulo externo: js/stations/<id>.js con export async function mount(ctx). Si ya se armó en reposo (precarga),
      // montar sólo la inserta. Entre pasos se cede un cuadro: ninguna tarea larga y la cámara no se traba.
      spotEl?.setAttribute("data-loading", "");
      try {
        const mod = await import(st.module.replace(/^\.\//, "./"));
        mk("importada");
        const m = await mod.mount({ station: st, layer, poster: POSTER, focus: focusTo });
        mk("montada");
        if (stale()) { m?.destroy?.(); return; }
        mounted = { leave: () => { m?.destroy?.(); queuePrebuild(st); } };
        await nextFrame();                                   // primer cuadro de la lámina (estilo y layout) por su lado
        if (stale()) return;
        for (const el of layer.children) if (el.querySelector("svg")) bakeOff(el);
        mk("sombra");
        focus = m?.focus || focus;
        view = m?.view || "station";
        await nextFrame();
        if (stale()) return;
      } catch (err) { console.error(err); }
      spotEl?.removeAttribute("data-loading");
    }
    showSpot(focus);
    stationFocus = focus;
    onView(view, st);
    mk("panel");
    aimRect = [focus, 0.06, MAX_ZOOM];
    flyTo(fitRect(focus, 0.06), 800);
  }

  // ---------------------------------------------------------------- precarga en reposo
  // Mientras se mira la infografía, en ratos libres: se importa cada estación, se arma su lámina (prebuild) y se hornea
  // su sombra. Abrirla después sólo la inserta. Una a la vez y cediendo el hilo entre pasos; al salir de una estación
  // se vuelve a preparar para la próxima vez.
  const pre = (window.pmPreload = { done: [], queue: [] });
  let preloading = false;
  function queuePrebuild(st) { if (!pre.queue.includes(st)) pre.queue.push(st); if (!preloading) runPreload(); }
  async function runPreload() {
    preloading = true;
    await idle(4000);
    while (pre.queue.length) {
      const st = pre.queue.shift();
      try {
        await idle(3000);
        if (st.module?.startsWith("builtin:")) { builtins[st.module.slice(8)]?.prepare?.({ station: st, layer }); }
        else if (st.module) {
          const mod = await import(st.module.replace(/^\.\//, "./"));
          await idle(3000);
          const api = await mod.prebuild?.();
          if (api?.el && current?.id !== st.id) { await idle(3000); if (current?.id !== st.id) prebake(api.el); }
        }
        if (!pre.done.includes(st.id)) pre.done.push(st.id);
      } catch (err) { console.warn("precarga", st.id, err); }
    }
    preloading = false;
  }

  // una estación puede acercar la cámara a una zona suya (p. ej. el equipo elegido); sin rect vuelve a su encuadre
  let stationFocus = null, aimRect = null;
  function focusTo(rect, maxZoom = MAX_ZOOM) {
    if (!current || !stationFocus) return;
    aimRect = [rect || stationFocus, rect ? 0.12 : 0.06, rect ? maxZoom : MAX_ZOOM];
    flyTo(fitRect(...aimRect), 650);
  }
  // lo que tapa el mapa cambió (el panel creció o se achicó): se vuelve a encuadrar lo que se estaba mirando
  function refit() {
    if (!current || !aimRect) return;
    const t = fitRect(...aimRect);
    if (aim && Math.abs(t.s / aim.s - 1) < 0.01 && Math.abs(t.x - aim.x) < 2 && Math.abs(t.y - aim.y) < 2) return;
    flyTo(t, 350);
  }
  function leaveCurrent() {
    mounted?.leave();
    mounted = null;
  }
  function close() {
    leaveCurrent();
    current = null;
    delete stage.dataset.view;
    showSpot(null);
    hotspots.querySelectorAll(".hotspot").forEach((h) => h.removeAttribute("data-active"));
    onView("map");
    flyTo(mapView ? bound({ ...mapView }) : fitAll(), 700);
  }
  const go = (id) => { location.hash = id ? `#${id}` : ""; };
  const route = () => { const id = decodeURIComponent(location.hash.slice(1)); id ? open(id) : current && close(); };
  addEventListener("hashchange", route);
  addEventListener("resize", () => {
    cancelAnimationFrame(anim);
    if (current) { cam = fitRect(spot.hidden ? current.focus : spotRect(), 0.06); apply(); }
    else { cam = bound(cam); apply(); }
  });
  const spotRect = () => [parseFloat(spot.style.left), parseFloat(spot.style.top), parseFloat(spot.style.width), parseFloat(spot.style.height)];

  // arranque
  cam = fitAll();
  apply();
  onView("map");
  queueMicrotask(route); // la URL puede traer una estación (#rajo): se abre cuando el explorador ya existe
  setTimeout(() => STATIONS.forEach((st) => st.module && queuePrebuild(st)), 1500); // precarga en reposo

  const idx = () => STATIONS.findIndex((s) => s.id === current?.id);
  return {
    open: go,
    refit,
    back: () => go(null),
    next: () => go(STATIONS[(idx() + 1) % STATIONS.length].id),
    prev: () => go(STATIONS[(idx() - 1 + STATIONS.length) % STATIONS.length].id),
    get current() { return current; },
    neighbours() {
      const i = idx();
      return { prev: STATIONS[(i - 1 + STATIONS.length) % STATIONS.length], next: STATIONS[(i + 1) % STATIONS.length] };
    },
  };
}
