// Service worker: guarda la app entera (marcadores, SVG, JS, infografía) para que funcione aunque el wifi del
// espacio se corte. Sólo se registra en el build (dist/), que reemplaza BUILD y PRECACHE (scripts/build.mjs).
//   · Un caché por versión ("pm-<build>"): al publicar otra versión, el SW nuevo arma su caché y borra el viejo.
//   · Páginas HTML: primero la red (con 3 s de espera máx.), así una versión nueva llega apenas hay conexión; sin
//     red, la copia guardada.
//   · Todo lo demás: primero el caché (JS/CSS van con ?v=<hash>, su contenido no cambia), si no, la red y se guarda.
//   · Al instalarse descarga la lista completa, pero con la caché HTTP: lo que la página ya bajó no viaja dos veces.
//     Los archivos SIN ?v= (SVG, infografía, marcadores) se revalidan (ETag → 304 si no cambiaron) para no guardar
//     una copia vieja de la caché HTTP.
//   · Rutas relativas a sw.js: funciona igual servido desde /ar2d/ (su alcance es esa carpeta).
const BUILD = "__BUILD__";
const PRECACHE = [/*__PRECACHE__*/];
const CACHE = `pm-${BUILD}`;
const FONTS = "pm-fuentes";
const SCOPE = new URL("./", self.location).href;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // de a pocos: no saturar una conexión débil; un archivo que falle no aborta la instalación
    const list = ["./", ...PRECACHE];
    for (let i = 0; i < list.length; i += 6) {
      await Promise.all(list.slice(i, i + 6).map(async (path) => {
        const url = new URL(path, SCOPE).href;
        try {
          const res = await fetch(url, { cache: /[?&]v=/.test(path) ? "default" : "no-cache" });
          if (res.ok) await cache.put(url, res);
        } catch { /* sin red: se guardará cuando la página lo pida */ }
      }));
    }
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("pm-") && k !== CACHE && k !== FONTS) await caches.delete(k);
    await self.clients.claim();
  })());
});

// la página pide activar la versión nueva sólo desde la pantalla de inicio (y recarga): nunca a mitad de una sesión
self.addEventListener("message", (e) => { if (e.data === "activar") self.skipWaiting(); });

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // fuentes de Google: la copia guardada al tiro y se refresca por detrás
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(FONTS), hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
    return;
  }
  if (!req.url.startsWith(SCOPE)) return;
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), timeout(3000)]);
        if (res.ok) cache.put(url.origin + url.pathname, res.clone());
        return res;
      } catch {
        return (await cache.match(url.origin + url.pathname)) || (await cache.match(SCOPE)) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // los assets se piden con o sin ?v= (targets.mind?v=16): dentro de un mismo build hay una sola copia de cada uno
    const hit = (await cache.match(req)) || (url.pathname.includes("/assets/") ? await cache.match(req, { ignoreSearch: true }) : null);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  })());
});
