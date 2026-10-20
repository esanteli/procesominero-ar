// Modelo puro del chancado primario. Igual que model.mjs del circuito SAG (skill anatomy):
// todo número que muestra la lámina y todo movimiento salen de aquí, nunca del dibujo.

export const CAEX_PAYLOAD_T = 300;        // carga nominal de un CAEX de ~300 t (Komatsu 930E / CAT 795F)
export const POCKET_CAPACITY_T = 900;     // tolva de descarga (dump pocket): ~3 camiones
export const CRUSHER_CAPACITY_TPH = 10000; // giratorio 60"×113": del orden de 8.000–10.000 t/h
export const FEED = { min: 2000, max: 10000, nominal: 6000, step: 250 };
export const ECCENTRIC_RPM = 110;          // velocidad de la excéntrica de un giratorio grande
export const OSS_MM = 165;                 // abertura en posición abierta (open side setting)
export const TIME_SCALE = 7;               // 1 s de pantalla = 7 s de planta: un ciclo del CAEX (26,2 s) ≈ 3 min,
                                           // así 300 t por ciclo ≈ 6.000 t/h, la alimentación nominal

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Estado inicial de la planta. */
export function initialPlant() {
  return { stock: 450, crushed: 0, dumps: 0 };
}

/**
 * Avanza la planta dt segundos de pantalla.
 * feedTph: alimentación pedida por el operador. Devuelve el caudal real (0 si la tolva está vacía).
 */
export function step(plant, feedTph, dt) {
  const tph = Math.min(feedTph, CRUSHER_CAPACITY_TPH);
  const want = (tph / 3600) * dt * TIME_SCALE;          // toneladas que el chancador pide en este dt
  const take = Math.min(want, plant.stock);
  plant.stock -= take;
  plant.crushed += take;
  const flow = dt > 0 ? (take / (dt * TIME_SCALE)) * 3600 : 0; // t/h efectivas
  return flow;
}

/** Un camión vacía su tolva: las toneladas entran poco a poco mientras dura el vaciado. */
export function pour(plant, tons) {
  const room = POCKET_CAPACITY_T - plant.stock;
  const added = clamp(tons, 0, room);
  plant.stock += added;
  return added;
}

export const fill = (plant) => clamp(plant.stock / POCKET_CAPACITY_T, 0, 1);

/** Minutos de operación que quedan en la tolva al ritmo actual (tiempo de planta). */
export const autonomyMin = (plant, feedTph) => (feedTph > 0 ? (plant.stock / feedTph) * 60 : Infinity);

export const fmt = (n) => Math.round(n).toLocaleString("es-CL");
