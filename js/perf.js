// Medición de rendimiento: agrega ?debug (o ?debug=hud, sin la consola) a la URL (o window.PM_PERF = true antes de cargar) para ver un HUD con
//   cuadro → ms entre cuadros (promedio y p95 del último segundo) y cuadros por segundo
//   JS     → ms de JavaScript por cuadro: suma de lo que tardan los callbacks de requestAnimationFrame
//   largas → tareas largas (> 50 ms, PerformanceObserver "longtask"): cuántas y la mayor
// Debe importarse ANTES que todo lo demás (primera línea de app.js): envuelve requestAnimationFrame.
// window.pmPerf.reset() / snapshot() sirven para medir un tramo desde la consola o desde un script.
// Nota de método: un tab de automatización (o en segundo plano) limita rAF a ~1 fps: mide en una ventana visible.
const Q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
// una sola bandera: ?debug (HUD + consola) o ?debug=hud (sólo el HUD). ?perf queda como alias de ?debug=hud.
const ON = typeof window !== "undefined" && (window.PM_PERF || Q.has("debug") || Q.has("perf"));

function install() {
  const raf0 = window.requestAnimationFrame.bind(window);
  let js = 0;                       // ms de JS de rAF acumulados desde el último cuadro
  window.requestAnimationFrame = (cb) => raf0((t) => {
    const a = performance.now();
    try { cb(t); } finally { js += performance.now() - a; }
  });

  // muestras: [instante, ms del cuadro, ms de JS]; tareas largas: [instante, duración]
  let frames = [], longs = [], last = 0, since = performance.now();
  const sample = (t) => {
    const now = performance.now();
    if (last) frames.push([now, now - last, js]);
    js = 0; last = now;
    if (frames.length > 4000) frames = frames.slice(-2000);
    raf0(sample);
  };
  raf0(sample);
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) longs.push([e.startTime, e.duration]); })
      .observe({ type: "longtask", buffered: true });
  } catch { /* navegador sin longtask */ }

  const stats = (from = since, to = performance.now()) => {
    const F = frames.filter((f) => f[0] >= from && f[0] <= to), L = longs.filter((l) => l[0] >= from && l[0] <= to);
    const ms = F.map((f) => f[1]).sort((a, b) => a - b), n = ms.length || 1;
    const sum = (a) => a.reduce((s, v) => s + v, 0);
    return {
      frames: F.length,
      frame: +(sum(ms) / n).toFixed(2),
      p95: +(ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))] || 0).toFixed(2),
      fps: +(F.length / Math.max(0.001, (to - from) / 1000)).toFixed(1),
      js: +(sum(F.map((f) => f[2])) / n).toFixed(2),
      longTasks: L.length,
      longMax: +Math.max(0, ...L.map((l) => l[1])).toFixed(0),
      longs: L.map((l) => +l[1].toFixed(0)),
    };
  };
  window.pmPerf = {
    reset() { since = performance.now(); },
    snapshot() { return stats(since); },
    stats,
    get longs() { return longs.map((l) => ({ at: +l[0].toFixed(0), ms: +l[1].toFixed(0) })); },
  };

  // HUD: esquina superior derecha, sin capturar toques
  const hud = document.createElement("pre");
  hud.setAttribute("aria-hidden", "true");
  hud.style.cssText = "position:fixed;top:6px;right:6px;z-index:2147483647;margin:0;padding:6px 8px;border-radius:6px;" +
    "background:rgba(20,12,6,.78);color:#fff;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;pointer-events:none;white-space:pre";
  const put = () => { if (!hud.isConnected && document.body) document.body.appendChild(hud); };
  if (document.body) put(); else addEventListener("DOMContentLoaded", put);
  setInterval(() => {
    const now = performance.now(), s = stats(now - 1000, now), all = stats(0, now);
    const recent = longs.filter((l) => l[0] > now - 10000);
    hud.textContent =
      `cuadro ${s.frame.toFixed(1)} ms  p95 ${s.p95.toFixed(1)}  ${s.fps.toFixed(0)} fps\n` +
      `JS     ${s.js.toFixed(2)} ms/cuadro\n` +
      `largas ${recent.length} en 10 s${recent.length ? ` (máx ${Math.max(...recent.map((l) => l[1])).toFixed(0)} ms)` : ""} · total ${all.longTasks}` +
      (window.pmHudExtra ? `
${window.pmHudExtra()}` : ""); // p. ej. el seguimiento del AR (app.js)
  }, 500);
}

if (ON && !window.pmPerf) install();
