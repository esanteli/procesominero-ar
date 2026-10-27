// Estación 1 · Rajo — lámina viva sobre el pozo impreso (misma lógica que la skill anatomy):
//   el modelo (state(t), función pura) manda y el dibujo lo sigue; secuencia por pasos con play/pausa,
//   selección de equipos (perforadora, pala eléctrica, CAEX) con ficha y foco, teclado y movimiento reducido.
//
// Geometría: js/stations/rajo-geo.js (sale del .ai de Emilio con tools/extraer-rajo.py).
//   - Todo se dibuja en puntos del .ai; REG lo lleva a px de la infografía (la lámina calza sobre el pozo impreso).
//   - La ruta de bajada (roja) y la de subida (azul) son las que Emilio trazó en la mesa 5.
// Equipos: assets/rajo/*.svg (pala en 5 vistas de giro 0°–60°, orugas aparte, perforadora).
// El CAEX se dibuja con el modelo 3D simplificado (js/caex3d.js) en cualquier rumbo, con su carga.
import * as G from "./rajo-geo.js";
import { renderTruck, projector } from "../caex3d.js";

const NS = "http://www.w3.org/2000/svg";
const ASSET = (f) => new URL(`../../assets/rajo/${f}`, import.meta.url).href;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const easeIO = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const fmt = (n) => Math.round(n).toLocaleString("es-CL");

// ---------------------------------------------------------------- equipos (posiciones en puntos del .ai, mesa 1 = mesa 5)
// Pala: las orugas quedan fijas y la tornamesa gira; cada vista se ubica para que su pórtico (A) caiga en el mismo eje.
const PALA = {
  orugas: [438.66, 611.96],
  pivot: [463.43, 611.04],
  views: [ // g = pie del pórtico en la vista · tip = boca del balde (ambos en unidades del SVG de la vista)
    { a: 0, file: "pala-00.svg", g: [25.4, 18.1], tip: [67, 48.5] },
    { a: 15, file: "pala-15.svg", g: [25.5, 18.5], tip: [75, 42] },
    { a: 30, file: "pala-30.svg", g: [24.0, 19.0], tip: [79, 36] },
    { a: 45, file: "pala-45.svg", g: [25.8, 20.6], tip: [80, 27.5] },
    { a: 60, file: "pala-60.svg", g: [25.0, 27.0], tip: [79, 25.5] },
  ],
};
// perforadora: queda en su lugar del dibujo; a su izquierda, sobre el banco, crece la malla de pozos (3 × 2)
const DRILL = { at: [429.82, 512.71], holes: 6, grid: (k) => { const i = k % 3, j = Math.floor(k / 3); return [421 - 7.4 * i - 7.4 * j, 567 + 4.3 * i - 4.3 * j]; } };
const TRUCK_K = 0.44;              // unidades del modelo 3D → puntos del .ai (≈ 0,6 del ancho de la pala, como en el video)
const BED_TOP = [0, 3, 50];        // centro de la boca de la tolva, en ejes del camión
const CAPACITY = 300;              // t por CAEX
const PASSES = 3;                  // pases de pala (~100 t cada uno)

// ---------------------------------------------------------------- rutas (polilíneas con largo acumulado)
function polyline(pts) {
  const P = [pts[0]], S = [0];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - P[P.length - 1][0], pts[i][1] - P[P.length - 1][1]);
    if (d < 0.05) continue;
    P.push(pts[i]); S.push(S[S.length - 1] + d);
  }
  const len = S[S.length - 1];
  const at = (s) => {
    s = clamp(s, 0, len);
    let lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const u = (s - S[lo]) / (S[hi] - S[lo] || 1);
    return [lerp(P[lo][0], P[hi][0], u), lerp(P[lo][1], P[hi][1], u)];
  };
  const dir = (s, w = 4) => { const a = at(s - w), b = at(s + w); const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const tail = (s0) => P.filter((_, i) => S[i] > s0);           // puntos después de la distancia s0
  return { pts: P, len, at, dir, tail };
}
const bez = (p0, p1, p2, p3, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0], u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]];
});
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

// rumbo en el suelo (convención de caex3d.js) a partir de una dirección en pantalla, y al revés
const headingOf = ([dx, dy]) => { const X = (dx / 0.866 + 2 * dy) / 2, Y = (2 * dy - dx / 0.866) / 2; return ((Math.atan2(Y, X) * 180) / Math.PI + 360) % 360; };
const screenDir = (phi) => { const r = (phi * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return norm([0.866 * (c - s), 0.5 * (c + s)]); };
const angDiff = (a, b) => ((b - a + 540) % 360) - 180;

// vista de la pala por ángulo: posición del SVG y de la boca del balde
const viewOrigin = (v) => [PALA.pivot[0] - v.g[0], PALA.pivot[1] - v.g[1]];
const tipOf = (v) => add(viewOrigin(v), v.tip);
function tipAt(angle) {
  const k = clamp(angle / 15, 0, 4), i = Math.min(3, Math.floor(k)), u = k - i;
  const a = tipOf(PALA.views[i]), b = tipOf(PALA.views[i + 1]);
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
}

// ---------------------------------------------------------------- recorrido del CAEX
// 1) baja por la ruta roja · 2) rodea el círculo de maniobra (azul) y retrocede hasta dejar la tolva bajo el balde
// 3) se carga en 3 pases · 4) avanza y sube por la ruta azul hasta salir (rutas de la mesa 5 del .ai)
const DOWN = polyline(G.DOWN), UP = polyline(G.UP);
const B = G.UP[0];                                         // inicio de la subida = punto de maniobra (borde del círculo)
const C = G.LOOP.c, RAD = G.LOOP.r;
const DROP = add(tipAt(60), [1.5, 4]);                     // donde cae el material: boca de la tolva
// rumbo de carguío: el camión queda alineado con la recta de retroceso (de B al punto de carguío); se resuelve iterando
let phiL = 245, L = DROP;
for (let k = 0; k < 4; k++) {
  const o = projector(phiL).p(BED_TOP);
  L = [DROP[0] - o[0] * TRUCK_K, DROP[1] - o[1] * TRUCK_K]; // punto de carguío (eje trasero)
  phiL = headingOf(norm([B[0] - L[0], B[1] - L[1]]));
}
const dirLB = norm([B[0] - L[0], B[1] - L[1]]);
// bajada: ruta roja hasta antes de su remate, entra al círculo por su derecha y lo recorre (sentido horario) hasta B
const iCut = G.DOWN.reduce((bi, p, i) => (Math.hypot(p[0] - 541, p[1] - 591) < Math.hypot(G.DOWN[bi][0] - 541, G.DOWN[bi][1] - 591) ? i : bi), 0);
const thB = Math.atan2(B[1] - C[1], B[0] - C[0]) + 2 * Math.PI; // ángulo de B en el círculo (y hacia abajo → horario = creciente)
const rB = Math.hypot(B[0] - C[0], B[1] - C[1]);           // B queda un poco fuera del círculo dibujado: el arco se abre hasta él
const arc = Array.from({ length: 61 }, (_, i) => { const u = i / 60, th = u * thB, r = lerp(RAD, rB, smooth(u)); return [C[0] + r * Math.cos(th), C[1] + r * Math.sin(th)]; });
const pIn = arc[0];
const S1 = polyline([...G.DOWN.slice(0, iCut + 1), ...bez(G.DOWN[iCut], add(G.DOWN[iCut], DOWN.dir(DOWN.len - (G.DOWN.length - iCut)), 22), add(pIn, [0, 1], -22), pIn, 30).slice(1), ...arc.slice(1)]);
const S2 = polyline(Array.from({ length: 31 }, (_, i) => [lerp(B[0], L[0], i / 30), lerp(B[1], L[1], i / 30)])); // retroceso recto
const sJoin = 30, pJ = UP.at(sJoin);
const S3 = polyline([...bez(L, add(L, dirLB, 26), add(pJ, UP.dir(sJoin), -18), pJ, 40), ...UP.tail(sJoin)]); // avanza y toma la subida

// ---------------------------------------------------------------- línea de tiempo (segundos de animación)
// perfil de velocidad: el camión frena en las curvas cerradas (las horquillas de las rampas) y al partir / llegar.
// Se integra dt = ds / v(s) a lo largo del tramo; el estado sigue siendo una función pura del tiempo.
const ACCEL = 110;                                          // pt/s²
function profile(seg, V) {
  const n = Math.max(2, Math.ceil(seg.len)), ds = seg.len / n, T = [0];
  const ang = (s) => { const d = seg.dir(s, 3); return Math.atan2(d[1], d[0]); };
  for (let i = 1; i <= n; i++) {
    const s = (i - 0.5) * ds;
    let k = 0; for (const o of [-6, -3, 0, 3, 6]) k = Math.max(k, Math.abs(((ang(s + o + 1.5) - ang(s + o - 1.5) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) / 3);
    const v = Math.max(8, Math.min(V / (1 + 18 * k), Math.sqrt(2 * ACCEL * s + 30), Math.sqrt(2 * ACCEL * (seg.len - s) + 30)));
    T.push(T[i - 1] + ds / v);
  }
  const dur = T[n];
  const sAt = (t) => { if (t <= 0) return 0; if (t >= dur) return seg.len; let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; } return (lo + (t - T[lo]) / (T[hi] - T[lo])) * ds; };
  const tAt = (s) => T[Math.round(clamp(s / seg.len) * n)];
  return { dur, sAt, tAt };
}
const V_DOWN = 140, V_UP = 110;                             // pt/s (vacío baja más rápido que cargado sube)
const P1 = profile(S1, V_DOWN), D1 = P1.dur;
const T_BACK = D1 + 0.3, D2 = 2.6;                          // retroceso hasta la pala
const T_LOAD = T_BACK + D2 + 0.3;
const PASS = { swing: 1.3, dump: 1.0, back: 1.2, dig: 1.1 };
const PASS_T = PASS.swing + PASS.dump + PASS.back + PASS.dig;
const T_UP = T_LOAD + (PASSES - 1) * PASS_T + PASS.swing + PASS.dump + 0.45;
const P3 = profile(S3, V_UP), D3 = P3.dur;
export const PERIOD = T_UP + D3 + 1.0;

export const STEPS = [
  { n: 1, label: "El CAEX ingresa vacío al rajo", t0: 0 },
  { n: 2, label: "Baja por las rampas hacia la pala", t0: P1.tAt(150) },
  { n: 3, label: "Maniobra y retrocede hasta la pala", t0: P1.tAt(S1.len - RAD * thB - 20) },
  { n: 4, label: "La pala gira y carga la tolva", t0: T_LOAD },
  { n: 5, label: "Sube cargado por las rampas", t0: T_UP },
  { n: 6, label: "Sale del rajo hacia chancado", t0: T_UP + P3.tAt(S3.len - 150) },
].map((s, i, a) => ({ ...s, t1: i + 1 < a.length ? a[i + 1].t0 : PERIOD }));
const stepAt = (t) => STEPS.find((s) => t >= s.t0 && t < s.t1) || STEPS[STEPS.length - 1];

// ---------------------------------------------------------------- modelo: estado puro en función del tiempo
function truckAt(t) {
  if (t < D1) { const s = P1.sAt(t), d = S1.dir(s); return { p: S1.at(s), phi: headingOf(d), seg: 1, s, v: t > 0.2 && t < D1 - 0.2 }; }
  if (t < T_BACK) return { p: B, phi: headingOf(S1.dir(S1.len)), seg: 1.5, s: S1.len, v: false };
  if (t < T_BACK + D2) { const u = easeIO((t - T_BACK) / D2), s = u * S2.len; return { p: S2.at(s), phi: lerp(headingOf(S1.dir(S1.len)), headingOf(S1.dir(S1.len)) + angDiff(headingOf(S1.dir(S1.len)), phiL), smooth(u * 1.6)), seg: 2, s, v: u > 0.05 && u < 0.95 }; }
  if (t < T_UP) return { p: L, phi: phiL, seg: 2.5, s: 0, v: false };
  const s = P3.sAt(t - T_UP), d = S3.dir(s);
  return { p: S3.at(s), phi: headingOf(d), seg: 3, s, v: t < T_UP + D3 - 0.2 };
}
function palaAt(t) {
  // por defecto: espera con el balde lleno, mirando al frente (0°)
  const st = { angle: 0, loaded: true, dump: 0, dig: 0, pass: 0 };
  for (let k = 0; k < PASSES; k++) {
    const a = T_LOAD + k * PASS_T, b = a + PASS.swing, c = b + PASS.dump, d = c + PASS.back, e = d + PASS.dig;
    if (t < a) break;
    st.pass = k + 1;
    if (t < b) { st.angle = 60 * easeIO((t - a) / PASS.swing); return st; }
    if (t < c) { st.angle = 60; st.dump = (t - b) / PASS.dump; st.loaded = st.dump < 0.55; return st; }
    if (t < d) { st.angle = 60 * (1 - easeIO((t - c) / PASS.back)); st.loaded = false; return st; }
    if (t < e) { st.angle = 0; st.dig = (t - d) / PASS.dig; st.loaded = st.dig > 0.6; return st; }
  }
  return st;
}
function loadAt(t) { // t de carga en el CAEX
  let tons = 0;
  for (let k = 0; k < PASSES; k++) {
    const b = T_LOAD + k * PASS_T + PASS.swing;
    tons += (CAPACITY / PASSES) * smooth((t - b - 0.15) / (PASS.dump * 0.7));
  }
  return t >= T_UP ? CAPACITY : tons;
}
function drillAt(clock) {
  const DT = 6.4, n = Math.floor(clock / DT), u = (clock % DT) / DT;
  const r = n % (DRILL.holes + 1);                          // pozo en curso; el ciclo extra limpia la malla
  let head = 0, drilling = false;
  if (r < DRILL.holes) {
    if (u < 0.12) head = 0;
    else if (u < 0.78) { head = (u - 0.12) / 0.66; drilling = true; }
    else head = 1 - (u - 0.78) / 0.22;
  }
  const done = r === DRILL.holes ? DRILL.holes : u >= 0.78 ? r + 1 : r;
  const fade = r === DRILL.holes ? 1 - smooth((u - 0.3) / 0.5) : 1;
  return { head, drilling, done, r, fade, depth: drilling ? head * 16 : 0, pop: u >= 0.78 && r < DRILL.holes ? 1 - smooth((u - 0.78) / 0.12) : 0 };
}
export function state(t, clock = t) {
  t = ((t % PERIOD) + PERIOD) % PERIOD;
  const truck = truckAt(t);
  const fadeIn = smooth(truck.seg === 1 ? truck.s / 26 : 1);
  const fadeOut = truck.seg === 3 ? 1 - smooth((truck.s - (S3.len - 46)) / 40) : 1;
  return { t, step: stepAt(t), truck: { ...truck, load: loadAt(t), opacity: Math.min(fadeIn, fadeOut) }, pala: palaAt(t), drill: drillAt(clock) };
}

// ---------------------------------------------------------------- fichas
const EQUIP = {
  perforadora: {
    kicker: "Perforación",
    title: "Perforadora rotativa",
    text: "Abre una malla de pozos en el banco. Después se cargan con explosivo y la tronadura fragmenta la roca para que la pala pueda excavarla.",
    specs: (s) => [`Malla: ${s.drill.done} de ${DRILL.holes} pozos`, "Profundidad ~16 m", "Diámetro 10–12 pulgadas"],
  },
  pala: {
    kicker: "Carguío",
    title: "Pala eléctrica",
    text: "Excava el material tronado del frente y, girando sobre sus orugas, lo descarga en la tolva del CAEX. Llena un camión en tres pases.",
    specs: (s) => [`Pase ${Math.max(1, s.pala.pass)} de ${PASSES}`, "~100 t por pase", "Accionamiento eléctrico"],
  },
  caex: {
    kicker: "Transporte",
    title: "CAEX · camión de extracción",
    text: "Baja vacío por las rampas hasta la pala, se carga y sube con el mineral hacia el chancado primario (o el estéril hacia el botadero).",
    specs: (s) => [`Carga ahora ${fmt(s.truck.load)} t`, `Capacidad ~${CAPACITY} t`, "Rampas de ~10 % de pendiente"],
  },
};
const ORDER = ["perforadora", "pala", "caex"];

// ---------------------------------------------------------------- dibujo
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; };
async function loadSprite(url, prefix, defs, recolor = false) {
  const text = await (await fetch(url)).text();
  const root = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  root.querySelectorAll("metadata, title, desc").forEach((n) => n.remove());
  const style = root.querySelector("style");
  if (style) {
    let css = style.textContent.replace(/\.cls-(\d+)/g, `.${prefix}-cls-$1`);
    // las vistas expandidas traen tonos sueltos (antialias del 3D de Illustrator): todo lo que no es blanco va naranjo
    if (recolor) css = css.replace(/fill:\s*#(?!fff\b|ffffff\b)[0-9a-f]{3,6}/gi, "fill:#ef8c22");
    el("style", {}, defs).textContent = css;
  }
  root.querySelectorAll("[class]").forEach((n) => n.setAttribute("class", n.getAttribute("class").replace(/\bcls-(\d+)/g, `${prefix}-cls-$1`)));
  const g = document.createElementNS(NS, "g");
  [...root.children].filter((n) => n.tagName !== "defs").forEach((n) => g.appendChild(document.importNode(n, true)));
  return g;
}

/**
 * Crea la lámina del rajo. Devuelve el elemento (en px de la infografía: va en la capa del mapa o en el ancla AR)
 * y la API de control; el panel se conecta aparte con bindPanel().
 */
export async function createRajo() {
  const S = G.REG.s;
  const VB = [G.BBOX[0] - 10, 255, G.BBOX[2] - G.BBOX[0] + 20, G.BBOX[3] - 255 + 10]; // incluye la entrada/salida sobre el borde
  const root = document.createElement("div");
  root.className = "rajo-plate";
  root.style.cssText = `position:absolute;left:${f1(VB[0] * S + G.REG.tx)}px;top:${f1(VB[1] * S + G.REG.ty)}px;width:${f1(VB[2] * S)}px;height:${f1(VB[3] * S)}px`;
  const svg = el("svg", { viewBox: VB.map(f1).join(" "), class: "rj-svg", role: "group", tabindex: "0",
    "aria-label": "Rajo: un CAEX baja por las rampas, la pala lo carga y sube. Espacio pausa o reproduce; coma y punto cambian de paso; 1, 2 y 3 eligen un equipo." }, root);
  const defs = el("defs", {}, svg);
  const sil = el("path", { d: G.SIL, class: "rj-sil" }, svg);
  const lines = el("g", { class: "rj-lines" }, svg);
  for (const l of G.LINES) el("path", { d: l.d, stroke: l.c, "stroke-width": l.w, "stroke-dasharray": l.dash || "none", fill: "none" }, lines);
  const leaders = el("g", { class: "rj-leaders" }, svg);
  for (const l of G.LEADERS) el("path", l.fill ? { d: l.d, fill: l.c } : { d: l.d, fill: "none", stroke: l.c, "stroke-width": l.w }, leaders);

  // rutas (se muestran con el botón "Rutas")
  const routes = el("g", { class: "rj-routes" }, svg);
  const dpath = (pts) => "M" + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join("L");
  el("path", { d: dpath(S1.pts), class: "rj-route rj-route--down" }, routes);
  el("path", { d: dpath([...S2.pts, ...S3.pts]), class: "rj-route rj-route--up" }, routes);
  const arrow = (seg, s, cls) => { const p = seg.at(s), d = seg.dir(s), n = [-d[1], d[0]];
    el("path", { d: `M${f1(p[0] + d[0] * 4)} ${f1(p[1] + d[1] * 4)}L${f1(p[0] - d[0] * 2 + n[0] * 3)} ${f1(p[1] - d[1] * 2 + n[1] * 3)}L${f1(p[0] - d[0] * 2 - n[0] * 3)} ${f1(p[1] - d[1] * 2 - n[1] * 3)}Z`, class: cls }, routes); };
  [0.2, 0.45, 0.7, 0.93].forEach((k) => arrow(S1, S1.len * k, "rj-arrow rj-arrow--down"));
  [0.25, 0.5, 0.75, 0.95].forEach((k) => arrow(S3, S3.len * k, "rj-arrow rj-arrow--up"));

  // perforadora + malla de pozos
  const holes = el("g", { class: "rj-holes" }, svg);
  const holeEls = Array.from({ length: DRILL.holes }, () => el("ellipse", { rx: 1.9, ry: 1.05, class: "rj-hole" }, holes));
  const drillG = el("g", { class: "rj-eq", "data-equip": "perforadora", role: "button", tabindex: "-1", "aria-label": "Perforadora: ver descripción" }, svg);
  el("ellipse", { cx: DRILL.at[0] + 10, cy: DRILL.at[1] + 34, rx: 26, ry: 30, class: "rj-hit" }, drillG);
  const drillBody = el("g", {}, drillG);
  drillBody.appendChild(await loadSprite(ASSET("perforadora.svg"), "rjd", defs));
  const drillHead = el("rect", { x: 12.4, y: 3, width: 5.1, height: 3.4, rx: 0.6, class: "rj-drill-head" }, drillBody);
  const drillDust = el("g", { class: "rj-dust" }, svg);
  const drillPuffs = Array.from({ length: 5 }, () => el("circle", { r: 1, class: "rj-puff" }, drillDust));

  // CAEX (debajo de la pala: el balde pasa por encima de la tolva)
  const truckDust = el("g", { class: "rj-dust" }, svg);
  const truckPuffs = Array.from({ length: 7 }, () => el("circle", { r: 1, class: "rj-puff" }, truckDust));
  const truckG = el("g", { class: "rj-eq", "data-equip": "caex", role: "button", tabindex: "-1", "aria-label": "CAEX: ver descripción" }, svg);
  const truckHit = el("ellipse", { rx: 30, ry: 26, class: "rj-hit" }, truckG);
  const truckBody = el("g", { class: "rj-truck" }, truckG);

  // pala: orugas fijas + 5 vistas de la tornamesa (se cruzan al girar)
  const palaG = el("g", { class: "rj-eq", "data-equip": "pala", role: "button", tabindex: "-1", "aria-label": "Pala eléctrica: ver descripción" }, svg);
  el("ellipse", { cx: PALA.pivot[0] + 14, cy: PALA.pivot[1] + 8, rx: 46, ry: 34, class: "rj-hit" }, palaG);
  const oru = el("g", { transform: `translate(${PALA.orugas.join(" ")})` }, palaG);
  oru.appendChild(await loadSprite(ASSET("pala-orugas.svg"), "rjo", defs));
  const house = el("g", {}, palaG);
  const viewEls = [];
  for (const [i, v] of PALA.views.entries()) {
    const g = el("g", { transform: `translate(${viewOrigin(v).map(f1).join(" ")})`, class: "rj-view" }, house);
    g.appendChild(await loadSprite(ASSET(v.file), `rjp${i}`, defs, i > 0));
    viewEls.push(g);
  }
  const bucketLoad = el("path", { class: "rj-load", d: "M-4.2 0.6C-3.4 -2.4 -0.8 -3.6 1.2 -2.9C3.4 -3.3 4.8 -1.6 4.4 0.8Z" }, palaG);
  const digDust = el("g", { class: "rj-dust" }, svg);
  const digPuffs = Array.from({ length: 5 }, () => el("circle", { r: 1, class: "rj-puff" }, digDust));
  const rocksG = el("g", { class: "rj-rocks" }, svg);
  const rocks = Array.from({ length: 10 }, (_, i) => el("path", { class: "rj-rock", d: ["M-1.4 -0.6L-0.3 -1.5L1.3 -1L1.5 0.6L0.1 1.4L-1.3 0.9Z", "M-1.1 -1.1L0.9 -1.3L1.4 0.4L0.2 1.3L-1.4 0.5Z", "M-1.5 0L-0.6 -1.3L1 -1.2L1.2 0.9L-0.5 1.2Z"][i % 3] }, rocksG));

  // etiquetas (foco de anatomy): nombre + línea guía sobre el equipo elegido
  const tags = el("g", { class: "rj-tags" }, svg);
  const tagEls = {};
  for (const id of ORDER) {
    const g = el("g", { class: "rj-tag", "data-tag": id }, tags);
    el("line", { x1: 0, y1: 0, x2: 0, y2: -13, class: "rj-tag-line" }, g);
    const w = { perforadora: 52, pala: 56, caex: 30 }[id];
    el("rect", { x: -w / 2, y: -25, width: w, height: 12, rx: 6, class: "rj-tag-pill" }, g);
    el("text", { x: 0, y: -16.6, class: "rj-tag-text", "text-anchor": "middle" }, g).textContent = { perforadora: "Perforadora", pala: "Pala eléctrica", caex: "CAEX" }[id];
    tagEls[id] = g;
  }

  // ------------------------------------------------------------ render
  const truckCache = new Map();
  let truckKey = "";
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let selected = null, showRoutes = false;

  function draw(s) {
    // perforadora: el cabezal baja por el mástil mientras perfora; al terminar aparece el pozo en la malla
    const D = s.drill, jit = D.drilling && !still.matches ? Math.sin(s.t * 70) * 0.18 : 0;
    drillBody.setAttribute("transform", `translate(${f1(DRILL.at[0] + jit)} ${f1(DRILL.at[1])})`);
    drillHead.setAttribute("y", f1(3 + D.head * 27));
    holeEls.forEach((e, k) => {
      const p = DRILL.grid(k), last = k === D.done - 1;
      e.setAttribute("cx", f1(p[0])); e.setAttribute("cy", f1(p[1]));
      e.setAttribute("transform", last && D.pop ? `translate(${f1(p[0])} ${f1(p[1])}) scale(${f1(1 + D.pop * 0.8)}) translate(${f1(-p[0])} ${f1(-p[1])})` : "");
      e.style.opacity = k < D.done ? D.fade.toFixed(3) : 0;
    });
    drillPuffs.forEach((c, k) => {
      const ph = (s.t * 1.6 + k / drillPuffs.length) % 1;
      c.setAttribute("cx", f1(DRILL.at[0] + 6 + k * 4 + ph * (k % 2 ? 3 : -3)));
      c.setAttribute("cy", f1(DRILL.at[1] + 57 - ph * 5));
      c.setAttribute("r", f1(0.8 + ph * 2.2));
      c.style.opacity = D.drilling && !still.matches ? ((1 - ph) * 0.85).toFixed(3) : 0;
    });

    // CAEX
    const T = s.truck;
    const lv = Math.round((T.load / CAPACITY) * 12);
    const key = `${Math.round(T.phi)}|${lv}`;
    if (key !== truckKey) {
      if (!truckCache.has(key)) {
        const r = renderTruck(Math.round(T.phi), lv / 12);
        truckCache.set(key, r.paths.map((p) => `<path class="${p.c === "l" ? "pl" : p.c === "c" ? "pc" : "pf"}" d="${p.d}"/>`).join(""));
      }
      truckBody.innerHTML = truckCache.get(key);
      truckKey = key;
    }
    truckBody.setAttribute("transform", `translate(${f1(T.p[0])} ${f1(T.p[1])}) scale(${TRUCK_K})`);
    truckHit.setAttribute("cx", f1(T.p[0])); truckHit.setAttribute("cy", f1(T.p[1] - 18));
    truckBody.style.opacity = T.opacity.toFixed(3);
    truckG.style.pointerEvents = T.opacity > 0.3 ? "" : "none";
    // polvo del camino: estelas en posiciones anteriores del mismo recorrido (sale del modelo, no de un sistema aparte)
    truckPuffs.forEach((c, k) => {
      const age = (k + 1) * 0.11, past = truckAt(Math.max(0, s.t - age));
      const wheel = projector(past.phi).p([0, -6, 3]);
      const moving = T.v && past.v && !still.matches;
      c.setAttribute("cx", f1(past.p[0] + wheel[0] * TRUCK_K + (k % 2 ? 1.5 : -1.5)));
      c.setAttribute("cy", f1(past.p[1] + wheel[1] * TRUCK_K - k * 0.5));
      c.setAttribute("r", f1(1.4 + k * 0.75));
      c.style.opacity = moving ? ((1 - k / truckPuffs.length) * 0.75 * T.opacity).toFixed(3) : 0;
    });

    // pala: cruce entre las dos vistas vecinas (se afina para que no se vea doble)
    const P = s.pala, k = clamp(P.angle / 15, 0, 4), i = Math.min(3, Math.floor(k)), u = k - i;
    const w = smooth((u - 0.3) / 0.4);
    viewEls.forEach((g, n) => { const o = n === i ? 1 - w : n === i + 1 ? w : 0; g.style.opacity = o.toFixed(3); g.style.display = o > 0.01 ? "" : "none"; });
    const crowd = P.dig ? Math.sin(Math.PI * P.dig) * 1.4 : 0; // el balde empuja contra el frente
    house.setAttribute("transform", `translate(${f1(crowd * 0.8)} ${f1(crowd * 0.5)})`);
    const tip = add(tipAt(P.angle), [crowd * 0.8, crowd * 0.5]);
    bucketLoad.setAttribute("transform", `translate(${f1(tip[0])} ${f1(tip[1] - 0.5)})`);
    bucketLoad.style.opacity = P.loaded ? 1 : 0;
    digPuffs.forEach((c, n) => {
      const ph = clamp(P.dig * 1.3 - n * 0.08);
      c.setAttribute("cx", f1(tip[0] + 2 + (n - 2) * 2.4 + ph * 3));
      c.setAttribute("cy", f1(tip[1] + 4 - ph * 6));
      c.setAttribute("r", f1(1 + ph * 3));
      c.style.opacity = P.dig && !still.matches ? (Math.sin(Math.PI * ph) * 0.8).toFixed(3) : 0;
    });
    // vaciado: las colpas caen del balde a la tolva
    const bo = projector(T.phi).p(BED_TOP), bedPt = [T.p[0] + bo[0] * TRUCK_K, T.p[1] + bo[1] * TRUCK_K];
    rocks.forEach((r, n) => {
      const d0 = (n / rocks.length) * 0.45, uu = clamp((P.dump - d0) / 0.42);
      if (!P.dump || uu <= 0 || uu >= 1) { r.style.opacity = 0; return; }
      const x = lerp(tip[0] + (n % 3 - 1) * 1.6, bedPt[0] + (n % 4 - 1.5) * 2.2, uu);
      const y = lerp(tip[1] + 1, bedPt[1] + 2, uu * uu);
      r.setAttribute("transform", `translate(${f1(x)} ${f1(y)}) rotate(${Math.round(uu * 200 + n * 40)}) scale(1.35)`);
      r.style.opacity = 1;
    });

    // etiquetas siguen a su equipo
    const anchor = {
      perforadora: [DRILL.at[0] + 14.7, DRILL.at[1] - 2],
      pala: [PALA.pivot[0] + 2, PALA.pivot[1] - 22],
      caex: [T.p[0] + projector(T.phi).p([0, 20, 58])[0] * TRUCK_K, T.p[1] + projector(T.phi).p([0, 20, 58])[1] * TRUCK_K - 2],
    };
    for (const id of ORDER) {
      tagEls[id].setAttribute("transform", `translate(${f1(anchor[id][0])} ${f1(anchor[id][1])})`);
      tagEls[id].toggleAttribute("data-on", selected === id && (id !== "caex" || T.opacity > 0.5));
    }
  }

  // ------------------------------------------------------------ reloj, pasos y controles
  let t = 0, clock = 0, playing = !still.matches, active = false, raf = 0, last = 0;
  if (still.matches) t = STEPS[3].t0 + PASS.swing + PASS.dump * 0.5; // movimiento reducido: queda en el carguío, pausado
  const listeners = new Set();
  const emit = () => { const s = state(t, clock); listeners.forEach((fn) => fn(s, api)); return s; };
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    if (playing) { t = (t + dt) % PERIOD; clock += dt; }
    draw(emit());
    raf = active && playing ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (active && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } else if (active && !playing) draw(emit()); };
  const api = {
    el: root, svg, PERIOD, STEPS,
    get selected() { return selected; },
    get playing() { return playing; },
    live: () => state(t, clock),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setActive(v) { active = v; if (v) kick(); else { cancelAnimationFrame(raf); raf = 0; } },
    play() { playing = true; kick(); },
    pause() { playing = false; cancelAnimationFrame(raf); raf = 0; draw(emit()); },
    togglePlay() { playing ? api.pause() : api.play(); },
    seek(v) { t = ((v % PERIOD) + PERIOD) % PERIOD; draw(emit()); },
    goStep(n) { const st = STEPS[clamp(n, 1, STEPS.length) - 1]; api.seek(st.t0 + 0.01); },
    nextStep() { api.goStep((stepAt(t).n % STEPS.length) + 1); },
    prevStep() { const st = stepAt(t); api.goStep(t - st.t0 > 1.2 ? st.n : ((st.n + STEPS.length - 2) % STEPS.length) + 1); },
    select(id) {
      selected = id && EQUIP[id] ? id : null;
      root.toggleAttribute("data-sel", !!selected);
      root.querySelectorAll(".rj-eq").forEach((g) => g.toggleAttribute("data-on", g.dataset.equip === selected));
      draw(emit());
    },
    setRoutes(v) { showRoutes = v; root.toggleAttribute("data-routes", v); },
    get routes() { return showRoutes; },
    destroy() { api.setActive(false); listeners.clear(); root.remove(); },
  };
  // tocar un equipo lo selecciona (otra vez = soltar); tocar el pozo vacío suelta la selección
  svg.addEventListener("click", (e) => {
    const g = e.target.closest(".rj-eq");
    api.select(g ? (selected === g.dataset.equip ? null : g.dataset.equip) : null);
  });
  // pausa fuera de pantalla / pestaña oculta (como anatomy)
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); });
  draw(emit());
  return api;
}

// ---------------------------------------------------------------- panel (HUD) del rajo
export function bindPanel(rajo, { onEscape } = {}) {
  const $ = (s) => document.querySelector(s);
  const playBtn = $("[data-rj-play]"), stepsBox = $("[data-rj-steps]");
  stepsBox.innerHTML = "";
  const stepBtns = rajo.STEPS.map((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "seq-step"; b.dataset.step = s.n;
    b.setAttribute("aria-label", `Paso ${s.n}: ${s.label}`);
    b.innerHTML = "<i></i>";
    b.addEventListener("click", () => rajo.goStep(s.n));
    stepsBox.appendChild(b);
    return b;
  });
  const info = $("[data-info]");
  const meter = $("[data-rj-meter]"), readout = $("[data-rj-readout]");
  let lastStep = 0, lastText = "", lastInfo = "";
  const off = [];
  const on = (node, ev, fn, opt) => { node.addEventListener(ev, fn, opt); off.push(() => node.removeEventListener(ev, fn, opt)); };

  function renderInfo(s) {
    const id = rajo.selected;
    document.querySelectorAll("[data-rj-chip]").forEach((c) => c.toggleAttribute("data-on", c.dataset.rjChip === id));
    if (!id) { if (info.dataset.owner === "rajo") info.hidden = true; return; }
    const e = EQUIP[id], specs = e.specs(s);
    const sig = id + specs.join("|");
    if (sig === lastInfo && !info.hidden) return;
    lastInfo = sig;
    info.dataset.owner = "rajo";
    $("[data-info-kicker]").textContent = e.kicker;
    $("[data-info-title]").textContent = e.title;
    $("[data-info-text]").textContent = e.text;
    $("[data-info-specs]").innerHTML = specs.map((x) => `<li>${x}</li>`).join("");
    $("[data-info-actions]").innerHTML = "";
    info.hidden = false;
  }
  function readoutOf(s) {
    const T = s.truck, n = s.step.n;
    if (rajo.selected === "perforadora") return s.drill.drilling ? `Perforadora · pozo ${s.drill.r + 1} de ${DRILL.holes} · ${Math.round(s.drill.depth)} m` : `Perforadora · malla ${s.drill.done} de ${DRILL.holes} pozos`;
    if (n <= 2) return `CAEX vacío · bajando a la pala · ${fmt(T.load)} t`;
    if (n === 3) return "CAEX se posiciona bajo el balde · 0 t";
    if (n === 4) return `Pase ${Math.max(1, s.pala.pass)} de ${PASSES} · CAEX ${fmt(T.load)} t`;
    if (n === 5) return `CAEX cargado · subiendo · ${fmt(T.load)} t`;
    return `CAEX sale hacia chancado · ${fmt(T.load)} t`;
  }
  const unlisten = rajo.on((s) => {
    const st = s.step;
    if (st.n !== lastStep) {
      $("[data-rj-step-n]").textContent = st.n;
      $("[data-rj-step-label]").textContent = st.label;
      stepBtns.forEach((b) => { const k = Number(b.dataset.step); b.toggleAttribute("data-done", k < st.n); b.toggleAttribute("data-current", k === st.n); });
      lastStep = st.n;
    }
    stepBtns[st.n - 1].style.setProperty("--p", clamp((s.t - st.t0) / (st.t1 - st.t0)).toFixed(3));
    meter.style.setProperty("--fill", (s.truck.load / CAPACITY).toFixed(3));
    const text = readoutOf(s);
    if (text !== lastText) { readout.textContent = text; lastText = text; }
    playBtn.setAttribute("aria-pressed", String(rajo.playing));
    playBtn.setAttribute("aria-label", rajo.playing ? "Pausar la secuencia del rajo" : "Reproducir la secuencia del rajo");
    renderInfo(s);
  });
  off.push(unlisten);

  on(playBtn, "click", () => rajo.togglePlay());
  on($("[data-rj-prev]"), "click", () => rajo.prevStep());
  on($("[data-rj-next]"), "click", () => rajo.nextStep());
  document.querySelectorAll("[data-rj-chip]").forEach((c) => on(c, "click", () => rajo.select(rajo.selected === c.dataset.rjChip ? null : c.dataset.rjChip)));
  const routesBtn = $("[data-rj-routes]");
  routesBtn.setAttribute("aria-pressed", String(rajo.routes));
  on(routesBtn, "click", () => { rajo.setRoutes(!rajo.routes); routesBtn.setAttribute("aria-pressed", String(rajo.routes)); });
  on($("[data-info-close]"), "click", () => { if (info.dataset.owner === "rajo") rajo.select(null); });
  // teclado (fase de captura: Escape suelta la selección antes de que la app vuelva al mapa)
  on(window, "keydown", (e) => {
    if (document.body.dataset.view !== "rajo" || e.target.closest?.("input, [data-intro]")) return;
    if (e.key === " " && !e.target.closest("button")) rajo.togglePlay();
    else if (e.key === ",") rajo.prevStep();
    else if (e.key === ".") rajo.nextStep();
    else if (/^[1-3]$/.test(e.key)) rajo.select(ORDER[Number(e.key) - 1] === rajo.selected ? null : ORDER[Number(e.key) - 1]);
    else if (e.key === "r" || e.key === "R") routesBtn.click();
    else if (e.key === "Escape") { if (rajo.selected) rajo.select(null); else { onEscape?.(); } }
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  rajo.seek(rajo.live().t); // pinta el panel con el estado actual
  return () => {
    off.forEach((fn) => fn());
    if (info.dataset.owner === "rajo") { info.hidden = true; delete info.dataset.owner; }
  };
}

// ---------------------------------------------------------------- explorador (demo sin cámara)
// zonas para acercar la cámara al elegir un equipo (en puntos del .ai): el CAEX recorre todo el pozo
const ZOOM = { perforadora: [350, 478, 190, 240], pala: [405, 552, 190, 240], caex: null }; // alto extra abajo: la ficha tapa la mitad inferior
const toPoster = ([x, y, w, h]) => [x * G.REG.s + G.REG.tx, y * G.REG.s + G.REG.ty, w * G.REG.s, h * G.REG.s];

export async function mount({ layer, focus }) {
  const rajo = await createRajo();
  layer.appendChild(rajo.el);
  rajo.el.classList.add("rajo-plate--map");
  requestAnimationFrame(() => rajo.el.setAttribute("data-in", ""));
  const unbind = bindPanel(rajo, { onEscape: () => { location.hash = ""; } });
  let zoomed = null;
  const unzoom = rajo.on(() => {
    const z = rajo.selected && ZOOM[rajo.selected] ? rajo.selected : null;
    if (z !== zoomed) { zoomed = z; focus?.(z ? toPoster(ZOOM[z]) : null); }
  });
  rajo.setActive(true);
  window.pmRajo = rajo; // acceso para QA desde la consola
  const S = G.REG.s, [x0, y0, x1, y1] = G.BBOX;
  return {
    focus: [x0 * S + G.REG.tx - 20, y0 * S + G.REG.ty - 30, (x1 - x0) * S + 40, (y1 - y0) * S + 40],
    view: "rajo",
    destroy: () => { unzoom(); unbind(); rajo.destroy(); if (window.pmRajo === rajo) delete window.pmRajo; },
  };
}
