// Secuencia del CAEX como función pura del tiempo: state(t) → poses de camión, picarrocas, colpas y rocas.
// Al ser pura, se puede pausar, saltar a un paso o retroceder sin acumular errores (igual que el modelo
// de anatomy: el dibujo sólo muestra lo que dice la función).
//
// Las posiciones salen de los keyframes de Emilio (Animación AR/Chancador Primario/frames_chancador*.svg),
// pasadas al sistema de coordenadas de la escena (la del frame 1). Cada pose se ancla por el punto
// "centro-abajo" del sprite (donde la rueda toca el suelo), así los sprites de distinto tamaño calzan.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (i, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------- keyframes (escena)
export const KEY = {
  origin: [155.4, 466.8], // frame 1: CAEX cargado, mirando hacia arriba-derecha
  turnIn: [330, 418],     // donde gira para quedar de reversa a la tolva
  dump: [552.5, 426.4],   // frames 3–5: punto de descarga sobre la tolva
  turnOut: [400, 400],    // donde gira de regreso (antes del frame 6)
};
const U_FWD = [0.866, -0.5];  // hacia arriba-derecha (eje isométrico)
const U_REV = [0.866, 0.5];   // hacia abajo-derecha (reversa hacia la tolva)

// curvas Bézier con reparametrización por largo de arco (velocidad pareja)
function bezier(p0, p1, p2, p3) {
  const at = (u) => {
    const v = 1 - u;
    return [
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ];
  };
  const N = 80, lut = [0];
  let prev = at(0), total = 0;
  for (let i = 1; i <= N; i++) {
    const p = at(i / N);
    total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    lut.push(total);
    prev = p;
  }
  return (s) => {
    const d = clamp(s, 0, 1) * total;
    let i = 1;
    while (i < N && lut[i] < d) i++;
    const f = (d - lut[i - 1]) / Math.max(lut[i] - lut[i - 1], 1e-6);
    return at((i - 1 + f) / N);
  };
}
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const K = KEY;
// giro de regreso (paso 5 → 6): el camión no gira en el sitio, describe un arco corto entre la salida y el retorno
const TURN_OUT = { a: [K.turnOut[0] + 16, K.turnOut[1] - 2], b: [K.turnOut[0] - 10, K.turnOut[1] + 6] };
const PATH = {
  turn2: bezier(TURN_OUT.a, [TURN_OUT.a[0] - 12, TURN_OUT.a[1]], add(TURN_OUT.b, [-0.866, 0.5], -10), TURN_OUT.b),
  enter: bezier(K.origin, add(K.origin, U_FWD, 90), [K.turnIn[0] - 80, K.turnIn[1]], K.turnIn),
  reverse: bezier(K.turnIn, [K.turnIn[0] + 70, K.turnIn[1]], add(K.dump, U_REV, -60), K.dump),
  exit: bezier(K.dump, add(K.dump, U_REV, -60), [TURN_OUT.a[0] + 60, TURN_OUT.a[1]], TURN_OUT.a),
  ret: bezier(TURN_OUT.b, add(TURN_OUT.b, [-0.866, 0.5], 50), add(K.origin, [-0.866, 0.5], -80), K.origin),
};

// ---------------------------------------------------------------- fases y pasos
const PH = [
  ["enter", 2.8], ["turn1", 1.2], ["reverse", 3.0],
  ["raise", 1.6], ["pour", 2.4],
  ["reachA", 0.8], ["hammerA", 1.2], ["reachB", 0.5], ["hammerB", 1.1], ["home", 0.8],
  ["lower", 1.4], ["exit", 2.6],
  ["turn2", 1.6], ["ret", 3.2], ["load", 2.0],
];
export const PHASES = [];
{
  let t = 0;
  for (const [name, d] of PH) { PHASES.push({ name, start: t, end: t + d }); t += d; }
}
export const PERIOD = PHASES[PHASES.length - 1].end;
const at = (name) => PHASES.find((p) => p.name === name);

export const STEPS = [
  { n: 1, label: "Ingresa con la tolva cargada", from: "enter", to: "turn1" },
  { n: 2, label: "Se posiciona para descargar", from: "reverse", to: "reverse" },
  { n: 3, label: "Levanta la tolva y descarga", from: "raise", to: "pour" },
  { n: 4, label: "El picarrocas rompe las colpas", from: "reachA", to: "home" },
  { n: 5, label: "Baja la tolva y sale", from: "lower", to: "exit" },
  { n: 6, label: "Gira y vuelve al origen", from: "turn2", to: "load" },
].map((s) => ({ ...s, start: at(s.from).start, end: at(s.to).end }));

// ---------------------------------------------------------------- picarrocas (cinemática directa, en coords del asset)
export const ARM = {
  origin: [553.8, 412],       // posición del asset picarrocas en la escena
  shoulder: [19.1, 48.2],     // pasador del hombro
  elbow: [38.6, 14.5],        // pasador del codo
  tip: [46.2, 41.6],          // punta del puntero
  boom: [1, 9, 10],           // subgrupos que giran con el hombro (placas del brazo + pasador del codo)
  hammer: [2, 4, 5, 6, 8],    // subgrupos que además giran en el codo (soporte, martillo, puntero)
  poseA: [22, -22],
  poseB: [35, -30],
};
const rotPt = ([x, y], [cx, cy], deg) => {
  const a = (deg * Math.PI) / 180, dx = x - cx, dy = y - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
};
export function armTip(t1, t2) {
  const e = rotPt(ARM.elbow, ARM.shoulder, t1);
  const p = rotPt(rotPt(ARM.tip, ARM.shoulder, t1), e, t2);
  return [p[0] + ARM.origin[0], p[1] + ARM.origin[1]];
}
// colpas sobretamaño atrapadas en la parrilla: justo bajo la punta en cada pose de golpe
const TIP_A = armTip(...ARM.poseA), TIP_B = armTip(...ARM.poseB);
export const BOULDERS = [
  { x: TIP_A[0] + 1.5, y: TIP_A[1] + 6.6, r: 7.4, breakAt: "hammerA", seed: 3 },
  { x: TIP_B[0] + 2, y: TIP_B[1] + 5.8, r: 6.4, breakAt: "hammerB", seed: 7 },
];

// ---------------------------------------------------------------- sprites del camión
// descargando.svg: tolva levantada (subgrupo 43). Para "bajarla" se rota en torno a la bisagra trasera.
export const BED = { group: 43, pivot: [108, 116], down: -12, lip: [120, 118] };
// punto de apoyo (centro-abajo del contenido) de cada sprite, en sus coordenadas locales
export const ANCHOR = { cargada: [65.7, 112.6], vacia: [65.7, 112.6], descargando: [64.55, 143.3], giro180: [67.4, 101.9] };
const POUR = { n: 36, every: 0.065, fall: 0.55 };
POUR.start = at("pour").start - 0.2;        // las primeras rocas salen cuando la tolva termina de subir
const STUCK_AT = at("pour").end - 0.9;       // las colpas quedan a la vista con las últimas rocas
// carga dentro de la tolva levantada: se desliza hacia el labio y se vacía durante el vaciado
export const HEAP = {
  // piso interior de la tolva levantada (descargando.svg, subgrupo 43): frente-izq, frente-der, labio-der, labio-izq
  floor: [[54.4, 79.3], [91.0, 61.2], [114.9, 97.0], [77.7, 116.2]],
  up: [-4, -26],                           // "hacia arriba" desde el piso, en pantalla
  clip: [[44.5, 50.1], [91.0, 26.2], [94.1, 45.2], [122.4, 86.8], [125.9, 106.2], [79.8, 130.9], [77.1, 111.9], [48.7, 70.7]],
  rocks: Array.from({ length: 64 }, (_, i) => {
    const u = 0.02 + 0.96 * ((i + hash(i, 11)) / 64), v = 0.04 + 0.92 * hash(i, 12);
    const mound = 0.25 + Math.sin(Math.PI * v) * (0.45 + 0.35 * u);  // carga colmada: más alta al centro
    return { u, v, h: mound * (0.3 + 0.7 * hash(i, 13)), r: 4.2 + hash(i, 14) * 2.8, seed: 400 + i };
  }).sort((a, b) => a.h - b.h),            // de abajo hacia arriba: las de encima se pintan al final
};

/** Estado completo de la escena para un tiempo t de la secuencia (0..PERIOD). */
export function state(t, lite = false) {
  t = ((t % PERIOD) + PERIOD) % PERIOD;
  const ph = PHASES.find((p) => t >= p.start && t < p.end) || PHASES[PHASES.length - 1];
  const f = clamp((t - ph.start) / (ph.end - ph.start), 0, 1);
  const out = { t, phase: ph.name, layers: [], pos: K.origin, bed: 0, arm: [0, 0], boulders: [], pour: [], dust: [], groundDust: [] };
  const L = (sprite, sx, op = 1, rot = 0, phi = 0) => out.layers.push({ sprite, sx, op, rot, phi });

  // ---- camión
  switch (ph.name) {
    case "enter": out.pos = PATH.enter(easeIn(f) * 0.6 + f * 0.4); L("cargada", 1); break;
    case "turn1": {
      // giro por opacidad: la vista que llega y la que sale se funden sin deformarse; un leve giro en el
      // plano (±5°) y el polvo de las ruedas cuentan el cambio de rumbo
      out.pos = K.turnIn;
      const x = smooth(clamp((f - 0.1) / 0.8, 0, 1));
      if (x < 1) L("cargada", 1, 1 - x, 5 * x);
      if (x > 0) L("cargada", -1, x, -5 * (1 - x));
      for (let k = 0; k < 7; k++) {
        const life = clamp((f - k * 0.08) / 0.6, 0, 1);
        if (life <= 0 || life >= 1) continue;
        const side = k % 2 ? 1 : -1;
        out.groundDust.push({
          x: K.turnIn[0] + side * (26 + hash(k, 21) * 14) + life * side * 6,
          y: K.turnIn[1] - 4 - hash(k, 22) * 8 - life * 5,
          r: 2 + life * (4 + hash(k, 23) * 3), op: 0.9 * (1 - life),
        });
      }
      break;
    }
    case "reverse": out.pos = PATH.reverse(easeInOut(f)); L("cargada", -1); break;
    case "raise": {
      // los sprites no traen la tolva a medio levantar: se funde la tolva baja con la alta
      // mientras la alta termina de girar los últimos grados (se lee como un levante)
      out.pos = K.dump;
      const x = smooth(clamp(f / 0.45, 0, 1));
      if (x < 1) L("cargada", -1, 1 - x);
      L("descargando", 1, x);
      out.bed = BED.down * (1 - easeInOut(f));
      break;
    }
    case "pour": out.pos = K.dump; L("descargando", 1); out.bed = Math.sin(t * 22) * 0.5; break;
    case "reachA": case "hammerA": case "reachB": case "hammerB": case "home":
      out.pos = K.dump; L("descargando", 1); break;
    case "lower": {
      out.pos = K.dump;
      out.bed = BED.down * easeInOut(f);
      const x = smooth(clamp((f - 0.5) / 0.5, 0, 1));
      if (x < 1) L("descargando", 1, 1 - x);
      if (x > 0) L("vacia", -1, x);
      break;
    }
    case "exit": out.pos = PATH.exit(easeIn(f) * 0.5 + f * 0.5); L("vacia", -1); break;
    case "turn2": {
      // vistas intermedias generadas (caex3d.js): rumbo 180° (arriba‑izq.) → 90° (abajo‑izq.), con la
      // misma isométrica; en los extremos se funden con los sprites dibujados
      out.pos = PATH.turn2(easeInOut(f));
      const phi = 180 - 90 * easeInOut(clamp((f - 0.06) / 0.88, 0, 1));
      const a = smooth(clamp(f / 0.12, 0, 1)), b = smooth(clamp((f - 0.88) / 0.12, 0, 1));
      if (a < 1) L("vacia", -1, 1 - a);
      L("proxy", 1, Math.min(a, 1 - b), 0, phi);
      if (b > 0) L("giro180", 1, b);
      break;
    }
    case "ret": out.pos = PATH.ret(easeOut(f) * 0.6 + f * 0.4); L("giro180", 1); break;
    case "load": {
      // vuelta en U generada (90° → 270°) y, al final, aparece cargado (se funde con cargada.svg)
      out.pos = K.origin;
      const phi = 90 + 180 * easeInOut(clamp((f - 0.06) / 0.72, 0, 1));
      const a = smooth(clamp(f / 0.1, 0, 1)), b = smooth(clamp((f - 0.8) / 0.18, 0, 1));
      if (a < 1) L("giro180", 1, 1 - a);
      L("proxy", 1, Math.min(a, 1 - b), 0, phi);
      if (b > 0) L("cargada", 1, b);
      out.loading = true;
      break;
    }
  }

  if (lite) return out;

  // ---- polvo del camino: nubes que dejan las ruedas mientras el CAEX se mueve (deterministas, como todo)
  out.road = roadDust(t).concat(out.groundDust);

  // ---- picarrocas
  const A = ARM.poseA, B = ARM.poseB;
  const hammer = (base, tt) => [base[0] + Math.sin(tt * 2 * Math.PI * 7) * 0.9, base[1] + Math.sin(tt * 2 * Math.PI * 7 + 0.6) * 3.2];
  if (ph.name === "reachA") out.arm = [lerp(0, A[0], easeInOut(f)), lerp(0, A[1], easeInOut(f))];
  else if (ph.name === "hammerA") out.arm = hammer(A, t);
  else if (ph.name === "reachB") out.arm = [lerp(A[0], B[0], easeInOut(f)), lerp(A[1], B[1], easeInOut(f))];
  else if (ph.name === "hammerB") out.arm = hammer(B, t);
  else if (ph.name === "home") out.arm = [lerp(B[0], 0, easeInOut(f)), lerp(B[1], 0, easeInOut(f))];

  // ---- colpas: aparecen con las últimas rocas del vaciado y se rompen al final de cada martilleo
  const appear = clamp((t - STUCK_AT) / 0.5, 0, 1);
  for (const b of BOULDERS) {
    const brk = at(b.breakAt);
    if (t < STUCK_AT || t >= brk.end + 0.7) continue;
    if (t < brk.end) {
      const hitting = t >= brk.start;
      const shake = hitting ? Math.sin(t * 90) * 0.5 : 0;
      out.boulders.push({ x: b.x + shake, y: b.y - (1 - appear) * 7, r: b.r * (0.7 + 0.3 * appear), op: appear, seed: b.seed });
      if (hitting && Math.sin(t * 2 * Math.PI * 7) > 0.6) out.dust.push({ x: b.x - 1 + hash(Math.floor(t * 14), 1) * 3, y: b.y - b.r, r: 1.2 + hash(Math.floor(t * 14), 2) * 1.4, op: 1 });
    } else {
      // se parte en 4 pedazos que caen por la parrilla
      const u = (t - brk.end) / 0.7;
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI * 0.9 + k * 0.6 + hash(k, b.seed) * 0.3;
        out.boulders.push({
          x: b.x + Math.cos(a) * b.r * 0.55 * (1 + u * 0.6),
          y: b.y + Math.sin(a) * b.r * 0.35 + u * u * 14,
          r: b.r * 0.45 * (1 - u * 0.35), op: 1 - smooth(clamp((u - 0.5) / 0.5, 0, 1)), seed: b.seed * 10 + k,
        });
      }
    }
  }

  // ---- chorro de vaciado: rocas deterministas (cada una tiene su hora de salida)
  for (let i = 0; i < POUR.n; i++) {
    const t0 = POUR.start + i * POUR.every;
    const u = (t - t0) / POUR.fall;
    if (u < 0 || u >= 1) continue;
    out.pour.push({ i, u, jx: hash(i, 1), tx: 616 + hash(i, 2) * 44, ty: 450 + hash(i, 3) * 18, r: 2.8 + hash(i, 4) * 2.6 });
  }
  out.pourShare = clamp((t - POUR.start) / (POUR.n * POUR.every + POUR.fall), 0, 1);
  // la carga sigue en la tolva al subir y se va deslizando hacia el labio mientras sale el chorro
  out.heapSlide = ph.start < at("pour").end && t < at("pour").end ? easeInOut(clamp((t - POUR.start + 0.15) / (POUR.n * POUR.every + 0.15), 0, 1)) : 1;
  out.step = STEPS.find((s) => t >= s.start && t < s.end) || STEPS[STEPS.length - 1];
  out.stepProgress = (t - out.step.start) / (out.step.end - out.step.start);
  return out;
}

// polvo del camino ---------------------------------------------------------------
const DUST = { every: 0.07, life: 1.15, minSpeed: 10 };
const posAt = (t) => state(t, true).pos;
/** Pasa un vector de pantalla al suelo (X,Y), lo gira 90° y lo devuelve a pantalla: el "costado" del movimiento. */
function sideOf([sx, sy]) {
  const X = (sx / 0.866 + 2 * sy) / 2, Y = (2 * sy - sx / 0.866) / 2;
  const px = -Y, py = X;
  const v = [0.866 * (px - py), 0.5 * (px + py)];
  const n = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / n, v[1] / n];
}
function roadDust(t) {
  const out = [];
  const k1 = Math.floor(t / DUST.every);
  for (let k = k1; k > k1 - Math.ceil(DUST.life / DUST.every); k--) {
    const te = k * DUST.every;
    const age = t - te;
    if (te < 0 || age < 0 || age > DUST.life) continue;
    const p0 = posAt(te - 0.04), p1 = posAt(te + 0.04);
    const vx = (p1[0] - p0[0]) / 0.08, vy = (p1[1] - p0[1]) / 0.08, sp = Math.hypot(vx, vy);
    if (sp < DUST.minSpeed) continue;
    const m = [vx / sp, vy / sp], side = sideOf(m), pos = posAt(te);
    const u = age / DUST.life, grow = Math.min(1, sp / 60);
    for (const s of [-1, 1]) {
      const j = hash(k, s > 0 ? 31 : 37);
      out.push({
        x: pos[0] - m[0] * (14 + u * 10) + side[0] * s * (13 + j * 4),
        y: pos[1] - m[1] * (14 + u * 10) + side[1] * s * (13 + j * 4) - 2 - u * 7,
        r: (1.6 + u * (5 + 3 * j)) * (0.6 + 0.4 * grow),
        op: 0.6 * (1 - u) * (u < 0.12 ? u / 0.12 : 1) * (0.5 + 0.5 * grow),
      });
    }
  }
  return out;
}

/** Punto del labio trasero de la tolva levantada, en la escena, para un ángulo de tolva dado. */
export function lipPoint(spriteAnchorLocal, pos, bed) {
  const p = rotPt(BED.lip, BED.pivot, bed);
  return [pos[0] + p[0] - spriteAnchorLocal[0], pos[1] + p[1] - spriteAnchorLocal[1]];
}
