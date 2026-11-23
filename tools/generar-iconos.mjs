// Íconos de la app instalable (manifest.webmanifest): naranja de la infografía con un rajo en anillos y "AR".
// Uso: npm i --no-save sharp@0.35.5 && node tools/generar-iconos.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#ef7835"/>
  <g transform="translate(256 226) scale(${pad ? 0.78 : 1})" fill="none" stroke="#fff" stroke-linecap="round">
    <ellipse rx="150" ry="92" stroke-width="20"/>
    <ellipse rx="104" ry="62" cy="10" stroke-width="16" opacity=".9"/>
    <ellipse rx="60" ry="34" cy="20" stroke-width="14" opacity=".8"/>
  </g>
  <text x="256" y="${pad ? 410 : 438}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${pad ? 84 : 104}" fill="#fff">AR</text>
</svg>`;

mkdirSync("assets/icons", { recursive: true });
const out = [
  ["assets/icons/icon-192.png", 192, false],
  ["assets/icons/icon-512.png", 512, false],
  ["assets/icons/icon-maskable-512.png", 512, true],   // con margen: Android lo recorta en círculo o gota
  ["assets/icons/apple-touch-icon.png", 180, true],    // iOS pone sus propias esquinas
];
for (const [file, size, pad] of out) {
  await sharp(Buffer.from(svg(pad))).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(file, size);
}
