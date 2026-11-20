// Genera las versiones web de la infografía a partir del original (assets/infografia.jpg, CMYK, 3,3 MB):
//   assets/infografia.avif       AVIF q65          (~210 KB)  navegadores actuales
//   assets/infografia.webp       WebP casi sin pérdida (~860 KB)  Safari 14–16.3 y otros sin AVIF
//   assets/infografia-srgb.jpg   JPG sRGB 4:4:4    (~900 KB)  último recurso
// Todas en sRGB (el original es CMYK: cada navegador lo convertía a su manera) y del mismo tamaño en px
// (5497 × 1623), así que las coordenadas de stations.js siguen valiendo. El original queda como fuente.
// Uso (sharp no es dependencia del proyecto, se instala aparte):
//   npm i --no-save sharp@0.35.5 && node tools/optimizar-infografia.mjs
import sharp from "sharp";

const SRC = "assets/infografia.jpg";
const srgb = () => sharp(SRC).toColourspace("srgb");
const out = [
  ["assets/infografia.avif", srgb().avif({ quality: 65, effort: 5 })],
  ["assets/infografia.webp", srgb().webp({ nearLossless: true, quality: 60, effort: 6 })],
  ["assets/infografia-srgb.jpg", srgb().jpeg({ quality: 82, mozjpeg: true, progressive: true, chromaSubsampling: "4:4:4" })],
];
for (const [file, pipe] of out) {
  const info = await pipe.toFile(file);
  console.log(`${file}: ${(info.size / 1024).toFixed(0)} KB (${info.width}×${info.height})`);
}
