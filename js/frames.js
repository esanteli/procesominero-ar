// Ceder el hilo entre pasos pesados, para que ninguna tarea dure mucho (la cámara del demo y los toques siguen fluidos).
// nextFrame: después del próximo cuadro (el navegador alcanza a pintar). idle: cuando el navegador está desocupado.
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
export const idle = (timeout = 2000) => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout }) : setTimeout(r, 50)));
