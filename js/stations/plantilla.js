// Plantilla para la visualización de una estación (copiar como js/stations/<id>.js).
// Se activa en js/stations.js con  module: "./stations/<id>.js", status: "lista".
//
// mount(ctx) se llama al abrir la estación en el explorador:
//   ctx.station → la ficha de la estación (id, n, name, label, focus, text…)
//   ctx.layer   → capa sobre la infografía, en px de la imagen de 3012 × 812 (lo que se agrega aquí
//                 se mueve y escala con el mapa: se ancla a la ilustración impresa)
//   ctx.poster  → { src, w, h }
// Devuelve:
//   focus   → [x, y, w, h] encuadre de la cámara (opcional; por defecto station.focus)
//   view    → "station" para usar la ficha genérica del panel, u otro nombre si la estación trae su panel
//   destroy → limpia todo al salir
//
// Patrón recomendado (el mismo del chancador): SVG de Illustrator como base → rig.js que nombra piezas
// → una función pura state(t) para la secuencia → live.js que dibuja y responde a los controles.

export async function mount({ station, layer }) {
  const plate = document.createElement("div");
  plate.className = "plate plate--demo";
  plate.style.cssText = `transform-origin:0 0;transform:translate(${station.focus[0]}px,${station.focus[1]}px) scale(0.5)`;
  plate.innerHTML = `<header class="plate-head"><span class="plate-fig">Fig ${station.n}</span><span class="plate-title">${station.name}</span></header>`;
  layer.appendChild(plate);
  return {
    focus: station.focus,
    view: "station",
    destroy: () => plate.remove(),
  };
}
