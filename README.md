# Chancado Primario AR · prueba de concepto

Lámina viva sobre la estación **2 · Chancado Primario** de la infografía *Proceso Minero* (Espacio CoWork).
Reutiliza el SVG de Illustrator tal cual y le aplica la lógica de animación e interacción de la skill `anatomy`
(la misma del circuito SAG en `anatomy-test/sag-circuit`).

## Cómo probar

```bash
cd procesominero_app/ar-chancador
npx serve .            # o "Live Server" de VS Code
```

- **Escritorio / sin cámara:** abre `http://localhost:3000/?demo`. La imagen de la infografía hace de papel escaneado.
- **AR en el celular:** la cámara exige **HTTPS**. Sube la carpeta a `cowork.ceim.cl` (o cualquier hosting estático con HTTPS)
  y escanea la estación 2 de la infografía impresa. También sirve un túnel temporal (`npx localtunnel --port 3000`).
- `?maxdt=0.4` sólo para QA en equipos muy lentos (deja que la simulación avance aunque haya pocos fps).

## Demo sin cámara: la infografía completa

"Ver demo sin cámara" abre la infografía entera (`assets/infografia.jpg`, exportada a 2× desde el PDF para que el zoom
sea nítido). Se arrastra, se hace zoom (rueda, pellizco o botones) y cada etiqueta impresa es un punto tocable.
Al tocar una estación la cámara vuela a su encuadre, el resto se apaga y el panel muestra su ficha.

- `js/stations.js` registra las 10 estaciones: número, nombre, zona de la etiqueta y encuadre (en px de la imagen de 3012 × 812),
  descripción, estado (`lista` / `en desarrollo`) y el módulo de su visualización.
- `js/explorer.js` maneja el mapa, la cámara, los puntos y la navegación (anterior/siguiente, volver, enlaces `#rajo`).
- Chancado primario ya abre su lámina viva sobre la misma infografía, con el mismo registro que usa el AR.
- Para dar vida a otra estación: copia `js/stations/plantilla.js` como `js/stations/<id>.js`, y en `stations.js` pon
  `module: "./stations/<id>.js"` y `status: "lista"`.
- Enlace directo a una estación: `index.html?demo#rajo`.

## Qué se puede hacer

| Interacción | Dónde | Qué pasa |
|---|---|---|
| Secuencia del CAEX | se reproduce sola en bucle; botón ▶/❚❚, barra de 6 pasos, ‹ ›, teclas espacio, `,` `.`, 1–6 | 1 ingresa cargado · 2 se posiciona de reversa · 3 levanta la tolva y descarga · 4 el picarrocas rompe las colpas atascadas · 5 baja la tolva y sale · 6 gira y vuelve al origen |
| Explorar interior | deslizador, flechas ↑↓, botón de la ficha del chancador | un plano de corte baja por la carcasa y la cámara hace zoom: manto girando (110 rpm), rocas que se reducen en las gargantas |
| Alimentación | deslizador, flechas ←→ | 2.000–10.000 t/h: acelera el flujo en la cámara y la correa y vacía la tolva más rápido |
| Equipos | tocar el equipo en la lámina o los chips CAEX / Picarrocas / Chancador / Correa | enfoca el equipo y abre su ficha con descripción y datos (los del chancador y la correa, en vivo) |
| Fijar | botón alfiler (AR) | saca la lámina del papel y la deja plana en pantalla |

Cada ciclo del CAEX entrega 300 t a la tolva. El tiempo va ×7: un ciclo (26,2 s) ≈ 3 min de planta, o sea ~6.000 t/h,
la alimentación nominal. Si subes la alimentación o pausas el camión, la tolva se vacía y el chancador se queda esperando.
Con *movimiento reducido* la secuencia parte pausada y los pasos muestran su pose final.

### Cómo está armada la secuencia (iteración 2)

- `js/caex.js` es una función pura `state(t)`: con el tiempo de la secuencia devuelve la pose del camión, la tolva,
  el picarrocas, las colpas y las rocas. Por eso pausar, saltar de paso o retroceder no acumula errores.
- Las posiciones salen de los keyframes `frames_chancador*.svg`; el camión se ancla por el punto centro‑abajo de cada sprite.
- Sprites: `assets/caex/` (cargada, descargando, vacía, giro180) y `assets/picarrocas.svg`, tal como se exportaron.
  El camión de reversa a la tolva es el sprite espejado (`scale(-1,1)`), como en los frames 2 y 5.
- Giro del paso 1 al 2: fundido por opacidad entre la vista normal y la espejada (sin deformar el sprite), con un leve giro en el plano y polvo de ruedas.
- La carga va dentro de la tolva levantada (`HEAP` en `caex.js`): sube con ella, se desliza hacia el labio y sale con el chorro, así la tolva se vacía de a poco.
- Giro del paso 5 al 6 y vuelta en U al volver al origen: vistas intermedias **generadas** con un modelo 3D simplificado del CAEX
  (`js/caex3d.js`), medido sobre los sprites (rueda 12, entre ejes 44, tolva 49) y proyectado con la misma isométrica
  de la infografía. En la app se calcula un fotograma por cuadro (cache por medio grado); en los extremos se funde con los
  sprites dibujados. `npm run giro` exporta esos fotogramas como SVG en `assets/caex/giro-generado/` para revisarlos en Illustrator.
- Polvo del camino: nubes deterministas que dejan las ruedas cuando el CAEX avanza (más grandes a mayor velocidad), detrás del camión.
- El picarrocas se articula por hombro y codo (`ARM` en `caex.js`); las colpas se ubican justo bajo la punta del martillo.
- Ajuste respecto a los keyframes: el tramo de reversa hasta la tolva sigue el eje isométrico (el frame 2 estaba ~37 px más
  abajo y el camión se habría deslizado de lado). La posición de descarga (frames 3–5) es exacta.

## Estructura

```
ar-chancador/
├─ index.html                 HUD, intro, plantilla de la lámina, importmap
├─ css/app.css                paleta de la infografía, HUD tipo glass, estados del SVG
├─ js/model.js                modelo puro (CAEX 300 t, tolva 900 t, giratorio 10.000 t/h, tiempo ×7)
├─ js/rig.js                  mapea las piezas del SVG y agrega capas vivas (carcasa, rocas, pila)
├─ js/caex.js                 secuencia del CAEX y del picarrocas como función pura del tiempo
├─ js/caex3d.js               modelo 3D simplificado del CAEX para las vistas intermedias de los giros
├─ js/live.js                 loop de animación e interacción (port de live.js del circuito SAG)
├─ js/app.js                  modos AR (MindAR + CSS3D) y demo; registro lámina ↔ infografía
├─ js/explorer.js             demo: infografía navegable, cámara, puntos y rutas por estación
├─ js/stations.js             registro de las 10 estaciones (zonas, encuadres, fichas, módulos)
├─ js/stations/plantilla.js   plantilla para la visualización de una estación nueva
├─ assets/chancador_primario.svg   SVG original de Illustrator, sin tocar (base de la escena)
├─ assets/caex/*.svg               sprites del CAEX (cargada, descargando, vacía, giro180)
├─ assets/picarrocas.svg           picarrocas articulado
├─ assets/infografia.jpg           infografía completa a 2× (demo sin cámara)
├─ assets/target-chancado.png      recorte de la infografía usado como marcador
├─ assets/targets.mind             marcador compilado para MindAR
├─ tools/compilar-marcador.html    compila nuevos recortes a targets.mind en el navegador
├─ tools/generar-giro-caex.mjs     exporta los fotogramas del giro como SVG (npm run giro)
└─ vendor/                    three 0.160 + MindAR 1.2.5 (autohospedados, sin CDN)
```

## De `anatomy` a la infografía

| anatomy (circuito SAG) | aquí |
|---|---|
| geometría isométrica construida con el kit | el SVG de Illustrator, envuelto por `rig.js` |
| `model.mjs` manda readout y movimiento | `model.js` manda readout, nivel de tolva, ritmo de partículas |
| perilla de bombas + seguimiento exponencial | deslizador de alimentación con el mismo `follow` |
| "Look inside the cyclone": zoom de `viewBox` | "Explorar interior": zoom de `viewBox` + plano de corte de la carcasa |
| chips por etapa con `data-focus` | los mismos chips, sobre etapas del chancado |
| tour, teclado, movimiento reducido, pausa fuera de pantalla | igual; en AR se pausa al perder el marcador |
| lámina con Fig · título · pista · lectura | igual, como objeto CSS3D anclado sobre la infografía |

La lámina es DOM real dentro de la escena (CSS3D), por eso los camiones se pueden tocar en AR.

## Para pasar de prueba a producción

1. **Nombrar capas en Illustrator** (`caex-1`, `caex-1-tolva`, `manto`, `carcasa`, `correa`…) y exportar con *IDs de objeto: nombres de capa*.
   `PARTS` en `rig.js` acepta `"#id"`, así el rig deja de depender del orden del archivo.
2. **Marcador en alta**: exportar la zona de la estación desde el `.ai` a ~2000 px y recompilar `targets.mind`
   (con `tools/compilar-marcador.html`). Hoy sale de un JPG de 3012 px.
3. **Una estación por marcador**: cada estación (rajo, concentradora, lixiviación…) = un recorte + su SVG + su `model.js`.
   MindAR compila varios recortes en un solo `.mind`; `addCSSAnchor(i)` por estación.
4. Ajustar `STATION.scale` / `lift` en `app.js` con la infografía impresa a tamaño real.
