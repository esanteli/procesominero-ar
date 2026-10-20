// "Rig" del SVG exportado desde Illustrator.
// El archivo original no trae IDs, así que cada pieza se ubica por su ruta en el árbol
// (índices de hijos desde <svg>, contando <defs>). Si en Illustrator nombras las capas
// (Exportar > SVG > IDs de objeto: nombres de capa), basta reemplazar la ruta por "#id".
// El SVG fuente no se modifica: el rig envuelve piezas y agrega capas vivas en tiempo de carga.

import { ARM } from "./caex.js";

const NS = "http://www.w3.org/2000/svg";
const ARM_ORIGIN = ARM.origin;

/**
 * Carga un SVG suelto de Illustrator como <g> listo para insertar.
 * Todos los exports usan .cls-1, .cls-2…; se renombran con un prefijo por archivo para que no choquen.
 */
async function loadSprite(url, prefix, defs) {
  const text = await (await fetch(url)).text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  root.querySelectorAll("metadata, title, desc").forEach((el) => el.remove());
  const style = root.querySelector("style");
  if (style) {
    const css = style.textContent.replace(/\.cls-(\d+)/g, `.${prefix}-cls-$1`);
    const st = document.createElementNS(NS, "style");
    st.textContent = css;
    defs.appendChild(st);
  }
  root.querySelectorAll("[class]").forEach((el) => el.setAttribute("class", el.getAttribute("class").replace(/\bcls-(\d+)/g, `${prefix}-cls-$1`)));
  const out = document.createElementNS(NS, "g");
  [...root.children].filter((el) => el.tagName !== "defs").forEach((el) => out.appendChild(document.importNode(el, true)));
  return out;
}

export const PARTS = {
  building: "2",
  pit: "5",
  platform: "8",
  crusher: "4",
  belt: "4.0",
  beltSurface: "4.0.1",
  chute: "4.1",
  body: "4.2",
  frame: "4.2.2",
  interior: "4.2.2.5",
  mantle: ["4.2.2.5.4", "4.2.2.5.5", "4.2.2.5.6", "4.2.2.5.7", "4.2.2.5.8"],
  postAfterInterior: "4.2.2.6",
  hopper: "4.2.2.9",
  housingCut: "4.2.2.10",
  hopperTop: "4.2.2.11",
  oldArm: "10",     // picarrocas del dibujo original: se reemplaza por assets/picarrocas.svg
  oldTruckA: "12",  // CAEX del dibujo original: se reemplazan por los sprites de assets/caex/
  oldTruckB: "13",
};

// Sprites separados por Emilio (Animación AR/Chancador Primario). Las clases .cls-N se renombran por archivo.
export const SPRITES = {
  cargada: "assets/caex/cargada.svg",
  descargando: "assets/caex/descargando.svg",
  vacia: "assets/caex/vacia.svg",
  giro180: "assets/caex/giro180.svg",
};
export const PICARROCAS = "assets/picarrocas.svg";

// Geometría de referencia en coordenadas del SVG (viewBox 0 0 1080 1080), medida sobre el dibujo.
export const GEO = {
  view: [80, 270, 920, 600],                 // encuadre de la lámina (incluye la tolva del CAEX levantada)
  focus: [650, 532],                          // centro del zoom "explorar interior"
  hopper: { c: [650, 454], inner: [[578, 454], [650, 494], [722, 454], [650, 414]] },
  shell: { cx: 650, top: 500, bottom: 582, rx: 58, ry: 33.5 },
  chamber: {
    // dos gargantas entre manto y cóncavas (izquierda y derecha), de arriba hacia la descarga
    left: [[628, 482], [604, 578]],
    right: [[672, 482], [698, 578]],
  },
  discharge: [[650, 590], [648, 617]],
  belt: { a: [648, 617.5], b: [737, 667], halfWidth: 7 },
};

function resolve(svg, path) {
  if (path.startsWith("#")) return svg.querySelector(path);
  let el = svg;
  for (const i of path.split(".")) {
    el = el && el.children[Number(i)];
  }
  if (!el) throw new Error(`rig: no encuentro la pieza ${path}`);
  return el;
}

const g = (attrs = {}) => {
  const el = document.createElementNS(NS, "g");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const node = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

/** Envuelve varios elementos (en su orden original) en un <g>, puesto donde estaba el último. */
function wrapAll(els, attrs) {
  const last = els[els.length - 1];
  const wrap = g(attrs);
  last.parentNode.insertBefore(wrap, last.nextSibling);
  els.forEach((el) => wrap.appendChild(el));
  return wrap;
}

/** Envuelve un elemento en un <g> nuevo (para poder transformarlo sin tocar sus hijos). */
function wrapOne(el, attrs) {
  const wrap = g(attrs);
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  return wrap;
}

export async function mountRig(container, url) {
  const text = await (await fetch(url)).text();
  container.innerHTML = text;
  const svg = container.querySelector("svg");
  // metadatos (C2PA, Illustrator) no son dibujo y desplazarían los índices de las rutas
  svg.querySelectorAll(":scope > metadata, :scope > title, :scope > desc").forEach((el) => el.remove());
  svg.removeAttribute("id");
  svg.classList.add("pm-svg");
  svg.setAttribute("viewBox", GEO.view.join(" "));
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Chancado primario: un camión CAEX descarga mineral en la tolva de un chancador giratorio; un picarrocas rompe las colpas atascadas y una correa se lleva el mineral chancado."
  );
  // el rectángulo de fondo blanco del export se vuelve transparente: la lámina pone su propio papel
  svg.querySelector(":scope > rect")?.setAttribute("class", "pm-paper");

  // 1) resolver TODAS las rutas antes de mover nada (los índices cambian al envolver)
  const r = {};
  for (const [k, v] of Object.entries(PARTS)) r[k] = Array.isArray(v) ? v.map((p) => resolve(svg, p)) : resolve(svg, v);

  // 2) piezas móviles del dibujo base
  const mantle = wrapAll(r.mantle, { "data-mantle": "" });
  const defs = svg.querySelector("defs") || svg.insertBefore(node("defs"), svg.firstChild);

  // 2b) CAEX: un contenedor con los cuatro sprites (cargada, descargando, vacía, giro 180°), en el lugar
  //     de los camiones originales pero bajo el picarrocas (como en los frames 3–6)
  const caex = g({ class: "pm-caex", "data-equip": "caex", tabindex: "0", role: "button", "aria-label": "CAEX: ver descripción" });
  r.oldArm.parentNode.insertBefore(caex, r.oldArm);
  const sprites = {};
  for (const [name, url] of Object.entries(SPRITES)) {
    const content = await loadSprite(url, `cx${name.slice(0, 3)}`, defs);
    const wrap = g({ class: "pm-sprite", "data-sprite": name });
    wrap.appendChild(content);
    wrap.style.display = "none";
    caex.appendChild(wrap);
    sprites[name] = { el: wrap, content };
  }
  // chorro de vaciado: sobre el camión, bajo el picarrocas
  const pourRocks = g({ class: "pm-rocks", "data-layer": "pour" });
  r.oldArm.parentNode.insertBefore(pourRocks, r.oldArm);

  // 2c) picarrocas articulado desde assets/picarrocas.svg (reemplaza al del dibujo base)
  const pick = g({ class: "pm-picarrocas", "data-equip": "picarrocas", tabindex: "0", role: "button", "aria-label": "Picarrocas: ver descripción", transform: `translate(${ARM_ORIGIN.join(" ")})` });
  pick.appendChild(await loadSprite(PICARROCAS, "pk", defs));
  r.oldArm.parentNode.insertBefore(pick, r.oldArm);
  r.oldArm.remove();
  r.oldTruckA.remove();
  r.oldTruckB.remove();
  // subgrupos del brazo: Asset_5 > g > g(brazo) > g > [0..11]
  const armParts = [...pick.firstElementChild.firstElementChild.firstElementChild.children[1].firstElementChild.children];

  // chancador y correa también se pueden seleccionar
  r.body.setAttribute("data-equip", "chancador");
  r.belt.setAttribute("data-equip", "correa");
  r.chute.setAttribute("data-equip", "correa");

  // grupos para el foco (los chips y la selección atenúan lo demás)
  const tag = (el, stage) => el.setAttribute("data-stage-of", stage);
  tag(caex, "caex"); tag(pourRocks, "caex"); tag(r.platform, "caex");
  tag(pick, "picarrocas");
  tag(r.body, "chancador");
  tag(r.belt, "correa"); tag(r.chute, "correa");
  [r.building, r.pit].forEach((el) => el.setAttribute("data-stage-of", "contexto"));

  // 3) capas vivas, insertadas en su lugar del orden de pintado
  const H = GEO.shell;
  // rocas dentro de la cámara: sobre el interior, bajo la carcasa
  const chamberRocks = g({ class: "pm-rocks", "data-layer": "chamber" });
  r.interior.parentNode.insertBefore(chamberRocks, r.postAfterInterior);
  // carcasa cerrada (se corta con un plano que baja al explorar el interior)
  const clipId = "pm-cut";
  const clip = node("clipPath", { id: clipId, clipPathUnits: "userSpaceOnUse" });
  const clipRect = node("rect", { x: H.cx - H.rx - 4, y: H.top - H.ry - 4, width: H.rx * 2 + 8, height: 200 });
  clip.appendChild(clipRect);
  defs.appendChild(clip);
  const shell = g({ class: "pm-shell" });
  const body = g({ "clip-path": `url(#${clipId})` });
  const L = H.cx - H.rx, R = H.cx + H.rx;
  body.appendChild(node("path", { class: "pm-shell-body", d: `M${L},${H.top} V${H.bottom} A${H.rx},${H.ry} 0 0 0 ${R},${H.bottom} V${H.top} Z` }));
  // bandas de refuerzo, pernos y placa: detalle real de la carcasa del giratorio
  for (const y of [H.top + 22, H.top + 50, H.bottom - 6]) {
    body.appendChild(node("path", { class: "pm-shell-line", d: `M${L},${y} A${H.rx},${H.ry} 0 0 0 ${R},${y}` }));
  }
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.12 + (0.76 * i) / 8);
    const x = H.cx - Math.cos(a) * H.rx * 0.97;
    const y = H.top + 22 + Math.sin(a) * H.ry * 0.97;
    body.appendChild(node("circle", { class: "pm-bolt", cx: x.toFixed(2), cy: (y - 3).toFixed(2), r: 0.9 }));
  }
  body.appendChild(node("rect", { class: "pm-shell-plate", x: H.cx - 9, y: H.top + 29, width: 18, height: 10, rx: 1.2 }));
  for (const dy of [32, 35, 38]) body.appendChild(node("line", { class: "pm-shell-line", x1: H.cx - 6, x2: H.cx + 4, y1: H.top + dy, y2: H.top + dy }));
  shell.appendChild(body);
  const cutRim = node("ellipse", { class: "pm-cut-rim", cx: H.cx, cy: H.top, rx: H.rx, ry: H.ry });
  shell.appendChild(cutRim);
  r.interior.parentNode.insertBefore(shell, r.postAfterInterior);

  // pila de mineral en la tolva, recortada a la boca de la tolva
  const pileClip = node("clipPath", { id: "pm-pile", clipPathUnits: "userSpaceOnUse" });
  pileClip.appendChild(node("polygon", { points: GEO.hopper.inner.map((p) => p.join(",")).join(" ") }));
  defs.appendChild(pileClip);
  const pile = g({ class: "pm-rocks", "data-layer": "pile", "clip-path": "url(#pm-pile)" });
  r.hopperTop.parentNode.insertBefore(pile, r.hopperTop.nextSibling);
  // colpas sobretamaño atrapadas en la parrilla (las rompe el picarrocas)
  const stuck = g({ class: "pm-rocks", "data-layer": "stuck", "clip-path": "url(#pm-pile)" });
  pile.parentNode.insertBefore(stuck, pile.nextSibling);

  // mineral sobre la correa: sobre la banda, bajo el borde frontal
  const beltRocks = g({ class: "pm-rocks", "data-layer": "belt" });
  r.beltSurface.parentNode.insertBefore(beltRocks, r.beltSurface.nextSibling);
  // polvo de los golpes del martillo: sobre todo
  const dust = g({ class: "pm-dust", "data-layer": "dust" });
  svg.appendChild(dust);

  svg.style.aspectRatio = `${GEO.view[2]} / ${GEO.view[3]}`;
  return { svg, caex, sprites, pick, armParts, mantle, shell, clipRect, cutRim, housingCut: r.housingCut, layers: { chamberRocks, pile, stuck, beltRocks, pourRocks, dust } };
}

/** Roca irregular (polígono de 6–7 lados), estilo línea de la infografía. */
export function rockPath(seed, r) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const n = 6 + Math.floor(rnd() * 2);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const k = 0.72 + rnd() * 0.36;
    pts.push(`${(Math.cos(a) * r * k).toFixed(2)},${(Math.sin(a) * r * k * 0.82).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

export function rockEl(parent, seed, r, cls = "pm-rock") {
  const el = document.createElementNS(NS, "path");
  el.setAttribute("class", cls);
  el.setAttribute("d", rockPath(seed, 1));
  el.dataset.r = r;
  parent.appendChild(el);
  return el;
}
