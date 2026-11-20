// Registro de errores para producción: fallas de cámara, de seguimiento (MindAR) y errores de JavaScript, enviados a un
// endpoint configurable. APAGADO por defecto: sólo envía si hay un destino configurado, en este orden:
//   1. window.PM_REPORT_URL = "https://…"            (antes de cargar la app)
//   2. <meta name="pm-report" content="https://…">  (en index.html; vacío = apagado)
// Se manda un JSON corto como text/plain (sin preflight CORS) con navigator.sendBeacon (o fetch keepalive):
//   { kind, message, stack, where, page, mode, build, ua, session, ts }
// Sin datos personales: ni la query de la URL ni nada de lo que la persona escribe. Máximo MAX por sesión y sin repetir
// el mismo mensaje. window.pmReport(kind, err, where) lo llama la app; window.pmReports guarda lo enviado (o lo que se
// habría enviado, con el registro apagado), para revisar en la consola.
const MAX = 20;
const meta = typeof document !== "undefined" ? document.querySelector('meta[name="pm-report"]')?.content?.trim() : "";
const URL_ = (typeof window !== "undefined" && window.PM_REPORT_URL) || meta || "";
const session = Math.random().toString(36).slice(2, 10);
const seen = new Set();
const log = (globalThis.pmReports ||= []);
// avisos del navegador que no son fallas (y "Script error.", que llega sin datos desde otro origen)
const NOISE = /^(ResizeObserver loop|Script error\.?$)/;
const safeJson = (o) => { try { return JSON.stringify(o, Object.getOwnPropertyNames(o)).slice(0, 500); } catch { return String(o); } };

export function report(kind, err, where = "") {
  try {
    // MindAR a veces rechaza con algo que no es un Error: se guarda lo que traiga
    const raw = err?.message || err?.reason?.message || (typeof err === "object" && err ? safeJson(err) : String(err ?? ""));
    const message = String(raw || "(sin mensaje)").slice(0, 500);
    if (NOISE.test(message)) return;
    const key = `${kind}|${message}|${where}`;
    if (seen.has(key) || log.length >= MAX) return;
    seen.add(key);
    const body = {
      kind, message, where,
      name: err?.name || "",
      stack: String(err?.stack || "").slice(0, 2000),
      page: location.origin + location.pathname + (location.hash || ""),
      mode: [document.body?.dataset.mode, document.body?.dataset.ar].filter(Boolean).join("/"),
      build: document.documentElement.dataset.build || "dev",
      ua: navigator.userAgent,
      session,
      ts: new Date().toISOString(),
    };
    log.push(body);
    if (!URL_) return; // apagado
    const blob = new Blob([JSON.stringify(body)], { type: "text/plain" });
    if (!(navigator.sendBeacon && navigator.sendBeacon(URL_, blob))) fetch(URL_, { method: "POST", body: blob, keepalive: true, mode: "no-cors" }).catch(() => {});
  } catch { /* el registro nunca debe romper la app */ }
}

if (typeof window !== "undefined") {
  window.pmReport = report;
  addEventListener("error", (e) => report("error", e.error || e.message, `${(e.filename || "").split("/").pop()}:${e.lineno || 0}`));
  addEventListener("unhandledrejection", (e) => report("promesa", e.reason));
}
