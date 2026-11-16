// Bordes protegidos en tablets. Quien sostiene la tablet apoya el pulgar en el borde de la pantalla; ese dedo
// contaba como un toque más y, al usar la otra mano, el par se leía como pellizco (zoom sin querer), arrastre o
// "toque fuera" (salía del enfoque). Aquí un toque que EMPIEZA en la franja del borde se ignora entero (no llega a
// ningún gesto de la app), salvo que caiga sobre un control (botones, barra superior, panel…), que debe seguir
// respondiendo. Mientras ese pulgar está apoyado, el navegador ya no genera "click" para el otro dedo (lo trata como
// multitoque), así que el toque simple de ese dedo se convierte en click aquí.
const SIDE = 64;    // px de franja a izquierda y derecha (donde va el pulgar al sostenerla)
const ENDS = 48;    // px arriba y abajo
const MIN_SIDE = 600; // sólo pantallas medianas o grandes (tablets); en el celular la franja quitaría demasiado
const CONTROLS = [
  "button:not(.hotspot):not(.ar-hotspot)", "a[href]", "input", "select", "textarea", "label", "summary",
  "[role=button]", "[role=slider]", "[data-panel]", ".topbar", ".zoom-hud", ".map-tools", ".coach", ".intro",
].join(",");
const TAP_MOVE = 12, TAP_MS = 600;

const active = () => Math.min(innerWidth, innerHeight) >= MIN_SIDE;
const inEdge = (x, y) => x < SIDE || x > innerWidth - SIDE || y < ENDS || y > innerHeight - ENDS;

export function guardEdges() {
  const guarded = new Set();     // pulgares apoyados en el borde
  const fingers = new Map();     // los demás dedos: para reconocer un toque simple
  let swallow = [];              // clicks que no deben llegar: el del pulgar al soltar y el duplicado de uno sintético
  const cap = { capture: true };
  const stop = (e) => { e.stopImmediatePropagation(); };

  addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    if (active() && inEdge(e.clientX, e.clientY) && !e.target.closest?.(CONTROLS)) {
      guarded.add(e.pointerId);
      for (const f of fingers.values()) f.thumb = true;
      return stop(e);
    }
    for (const f of fingers.values()) f.multi = true; // dos dedos de verdad: es un pellizco, no un toque
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), multi: fingers.size > 0, thumb: guarded.size > 0 });
  }, cap);

  addEventListener("pointermove", (e) => {
    if (guarded.has(e.pointerId)) return stop(e);
    const f = fingers.get(e.pointerId);
    if (f && Math.hypot(e.clientX - f.x, e.clientY - f.y) > TAP_MOVE) f.multi = true;
  }, cap);

  const end = (e) => {
    if (guarded.has(e.pointerId)) {
      guarded.delete(e.pointerId);
      swallow.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      return stop(e);
    }
    const f = fingers.get(e.pointerId);
    fingers.delete(e.pointerId);
    // toque simple con el pulgar apoyado en el borde (en algún momento del toque, aunque lo suelte justo antes):
    // el navegador no dará click, se genera uno
    if (!f || f.multi || !f.thumb || e.type !== "pointerup" || performance.now() - f.t > TAP_MS) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    swallow.push({ x: e.clientX, y: e.clientY, t: performance.now() }); // por si el navegador sí lo da
    // tras el pointerup (los gestos de la app lo procesan primero, como con un click normal)
    setTimeout(() => el.dispatchEvent(new MouseEvent("click", {
      bubbles: true, cancelable: true, composed: true, view: window, clientX: e.clientX, clientY: e.clientY, detail: 1,
    })), 0);
  };
  addEventListener("pointerup", end, cap);
  addEventListener("pointercancel", end, cap);

  addEventListener("click", (e) => {
    if (!e.isTrusted || !swallow.length) return;
    const now = performance.now();
    swallow = swallow.filter((s) => now - s.t < 700);
    const i = swallow.findIndex((s) => Math.hypot(e.clientX - s.x, e.clientY - s.y) < 30);
    if (i < 0) return;
    swallow.splice(i, 1);
    e.preventDefault();
    stop(e);
  }, cap);

  // iPad/Safari ignora user-scalable=no: el pellizco del navegador (zoom de toda la página) se corta aquí
  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });

  window.pmEdge = { SIDE, ENDS, MIN_SIDE, active, guarded };
}
