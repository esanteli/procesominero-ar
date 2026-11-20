// Reloj de las animaciones de las láminas. Las estaciones usan nextTick(frame) / cancelTick(id) en vez de
// requestAnimationFrame / cancelAnimationFrame: sin límite (setFps(0), lo normal) es exactamente lo mismo.
//
// Con límite (vista general del AR: 30 cuadros/s por lámina) cada lámina se dibuja sólo en algunos cuadros, y las
// láminas se reparten entre cuadros distintos (la mitad en los pares, la mitad en los impares): cada cuadro hace la
// mitad del trabajo y cada lámina sigue animando a 30 cuadros/s. Las animaciones van por tiempo (dt), así que la
// velocidad no cambia. El movimiento de las láminas sobre la cámara (CSS3D) y el seguimiento siguen a pleno ritmo:
// esto sólo limita lo que pasa DENTRO de cada lámina.
//
// Calidad adaptativa (setAdaptive(true)): si el tiempo entre cuadros pasa de SLOW_MS durante 1 s, baja a la mitad
// (30 → 15); si se recupera (bajo FAST_MS un rato), vuelve a subir. Con histéresis, para no oscilar.
// ?hz=60 fija la frecuencia de pantalla supuesta (para medir sin vsync en el banco de pruebas).
const SLOW_MS = 22, FAST_MS = 15;
const q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const FORCED_HZ = Number(q.get("hz")) || 0;

let wanted = 0;          // cuadros/s pedidos por lámina (0 = sin límite)
let fps = 0;             // los que se aplican ahora (la calidad adaptativa puede bajarlos)
let adaptive = false;
let frameNo = 0, lastT = -1, hz = 60;
const dts = [];          // últimos intervalos entre cuadros (ms)
let slowSince = 0, fastSince = 0, backoff = 4000, lastDrop = 0;
const slots = new WeakMap(); let nextSlot = 0;
const handles = new Map(); let seq = 0;
export const clockState = { get fps() { return fps; }, get wanted() { return wanted; }, get div() { return div(); }, get hz() { return hz; }, drops: 0, raises: 0 };
if (typeof window !== "undefined") window.pmClock = clockState;

const div = () => (fps > 0 ? Math.max(1, Math.round((FORCED_HZ || hz) / fps)) : 1);
function observe(t) {
  if (lastT >= 0) {
    const dt = t - lastT;
    if (dt > 0 && dt < 1000) { dts.push(dt); if (dts.length > 120) dts.shift(); }
    // frecuencia de pantalla: el intervalo típico (mediana) de los cuadros más rápidos
    if (frameNo % 60 === 0 && dts.length > 30) { const s = [...dts].sort((a, b) => a - b); hz = Math.min(240, Math.max(30, 1000 / s[Math.floor(s.length * 0.25)])); }
    if (adaptive && wanted > 0) adapt(t);
  }
  lastT = t;
  frameNo++;
}
function adapt(t) {
  const recent = dts.slice(-Math.max(10, Math.round(hz / 2)));
  const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
  if (avg > SLOW_MS) { fastSince = 0; slowSince ||= t; } else slowSince = 0;
  if (avg < FAST_MS) fastSince ||= t; else fastSince = 0;
  const floor = Math.max(10, wanted / 4);
  if (slowSince && t - slowSince > 1000 && fps > floor) {
    fps = Math.max(floor, fps / 2); slowSince = 0; clockState.drops++;
    backoff = t - lastDrop < 15000 ? Math.min(backoff * 2, 30000) : 4000; lastDrop = t;
  } else if (fastSince && t - fastSince > backoff && fps < wanted) {
    fps = Math.min(wanted, fps * 2); fastSince = 0; clockState.raises++;
  }
}

/** Próximo cuadro para fn (como requestAnimationFrame). Devuelve un id para cancelTick. */
export function nextTick(fn) {
  const id = ++seq;
  if (!slots.has(fn)) slots.set(fn, nextSlot++);
  const run = (t) => {
    if (t !== lastT) observe(t);
    const d = div();
    if (d > 1 && (frameNo + slots.get(fn)) % d !== 0) { handles.set(id, requestAnimationFrame(run)); return; }
    handles.delete(id);
    fn(t);
  };
  handles.set(id, requestAnimationFrame(run));
  return id;
}
export function cancelTick(id) {
  const h = handles.get(id);
  if (h) cancelAnimationFrame(h);
  handles.delete(id);
}
/** Cuadros/s por lámina: 0 = sin límite. */
export function setFps(v) { wanted = v; fps = v; slowSince = fastSince = 0; }
export function setAdaptive(on) { adaptive = on; }
