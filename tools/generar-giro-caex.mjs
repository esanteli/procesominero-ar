// Exporta los fotogramas intermedios del giro del CAEX como SVG sueltos (para revisarlos o retocarlos en Illustrator).
// Usa el mismo modelo que la app (js/caex3d.js), así lo que se exporta es exactamente lo que se anima.
//
//   node tools/generar-giro-caex.mjs              → rumbos 90°…270° cada 5° (los que usa la secuencia)
//   node tools/generar-giro-caex.mjs 0 355 5      → desde, hasta, paso
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { truckSvg } from "../js/caex3d.js";

const here = dirname(fileURLToPath(import.meta.url));
const [from = 90, to = 270, step = 5] = process.argv.slice(2).map(Number);
const out = join(here, "..", "assets", "caex", "giro-generado");
mkdirSync(out, { recursive: true });
let n = 0;
for (let phi = from; phi <= to; phi += step) {
  writeFileSync(join(out, `caex_rumbo_${String(phi).padStart(3, "0")}.svg`), truckSvg(phi));
  n++;
}
console.log(`${n} fotogramas en ${out}`);
