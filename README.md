# Proceso Minero AR · prueba de concepto

Láminas vivas sobre las estaciones **1 · Rajo**, **1 · Mina subterránea**, **2 · Chancado Primario**, **2.2 · Chancado secundario y terciario** y **3 · Pilas de lixiviación** de la infografía *Proceso Minero* (Espacio CoWork).
Reutiliza el SVG de Illustrator tal cual y le aplica la lógica de animación e interacción de la skill `anatomy`
(la misma del circuito SAG en `anatomy-test/sag-circuit`).

## Cómo probar

```bash
cd procesominero_app/ar-chancador
npx serve .            # o "Live Server" de VS Code
```

- **Escritorio / sin cámara:** abre `http://localhost:3000/?demo`. La imagen de la infografía hace de papel escaneado.
- **AR en el celular:** la cámara exige **HTTPS**. Sube la carpeta a `cowork.ceim.cl` (o cualquier hosting estático con HTTPS)
  y escanea el Rajo, la Mina subterránea, el Chancado Primario, el Chancado secundario o las Pilas de lixiviación de la infografía impresa. También sirve un túnel temporal (`npx localtunnel --port 3000`).
- `?maxdt=0.4` sólo para QA en equipos muy lentos (deja que la simulación avance aunque haya pocos fps).

## Demo sin cámara: la infografía completa

"Ver demo sin cámara" abre la infografía entera (`assets/infografia.jpg`, exportada a 2× desde el PDF para que el zoom
sea nítido). Se arrastra, se hace zoom (rueda, pellizco o botones) y cada etiqueta impresa es un punto tocable.
Al tocar una estación la cámara vuela a su encuadre, el resto se apaga y el panel muestra su ficha.

- `js/stations.js` registra las 10 estaciones: número, nombre, zona de la etiqueta y encuadre (en px de la imagen de 5497 × 1623),
  descripción, estado (`lista` / `en desarrollo`) y el módulo de su visualización.
- `js/explorer.js` maneja el mapa, la cámara, los puntos y la navegación (anterior/siguiente, volver, enlaces `#rajo`).
- Rajo y Chancado primario ya abren su lámina viva sobre la misma infografía, con el mismo registro que usa el AR.
- Para dar vida a otra estación: copia `js/stations/plantilla.js` como `js/stations/<id>.js`, y en `stations.js` pon
  `module: "./stations/<id>.js"` y `status: "lista"`.
- Enlace directo a una estación: `index.html?demo#rajo`.

## Estación 1 · Rajo (iteración 4)

La lámina del rajo es la **silueta del pozo** (blanca, con sus curvas de nivel) calzada sobre el pozo impreso, como el
video con alfa de referencia, y encima los equipos animados. Secuencia (≈ 49 s, en bucle), igual al storyboard:

| Paso | Qué pasa |
|---|---|
| 1 | El CAEX ingresa vacío por la rampa de entrada |
| 2 | Baja por las rampas (frena en las horquillas) |
| 3 | Rodea el círculo de maniobra y retrocede hasta dejar la tolva bajo el balde |
| 4 | La pala gira 0° → 60° y descarga: 3 pases de ~100 t (la carga crece en la tolva) |
| 5 | El CAEX avanza y sube cargado por las rampas |
| 6 | Sale del rajo hacia chancado |

| Interacción | Dónde | Qué pasa |
|---|---|---|
| Equipos | tocar la perforadora, la pala o el CAEX, o los chips; teclas 1–3 | foco de anatomy: el resto se apaga, etiqueta sobre el equipo, ficha con datos en vivo; en la demo la cámara se acerca |
| Secuencia | ▶/❚❚, barra de 6 pasos, ‹ ›, espacio, `,` `.` | pausa, salta de paso o retrocede sin acumular errores (`state(t)` es puro) |
| Rutas | chip "Rutas" o tecla R | muestra la ruta de bajada (roja) y la de subida (azul) que trazó Emilio en la mesa 5 |
| Perforadora | siempre activa | el cabezal baja por el mástil y la malla de pozos crece (6 pozos) junto a ella |
| Escape | | suelta la selección; otra vez, vuelve a la infografía |

Cómo está armada:
- `tools/extraer-rajo.py` lee `rajo_animacion_procesominero_v2.ai` (es un PDF por dentro) y genera `js/stations/rajo-geo.js`:
  curvas del pozo, silueta, rutas roja/azul, círculo de maniobra y líneas de minerales oxidados/sulfurados, en puntos del `.ai`.
  `REG` (escala 1,3731 + traslación) los lleva a px de la infografía; se obtuvo ajustando las curvas sobre la imagen (error < 1 px).
- `js/stations/rajo.js`: modelo puro `state(t)` (CAEX, pala, carga, perforadora), dibujo y panel. El CAEX usa el modelo 3D
  de `caex3d.js` (cualquier rumbo, ahora con carga en la tolva); la pala son las orugas fijas + 5 vistas de la tornamesa
  (`assets/rajo/pala-00…60.svg`) que se funden al girar, alineadas por el pie del pórtico.
- AR: `assets/targets.mind` ahora trae 2 marcadores (0 = chancado, 1 = rajo, recorte `assets/target-rajo.png`).
  Al encontrar uno se activa su lámina y su panel; el alfiler fija la que se está viendo.

## Estación 1 · Mina subterránea (iteración 5)

"Radiografía" del terreno: al abrir la estación (o encontrar su marcador) un haz barre el bloque impreso y deja ver el
túnel por dentro con el carguío. Secuencia (≈ 26 s, en bucle), según los frames Inicio AR · Carga · Descarga:

| Paso | Qué pasa |
|---|---|
| 1 | El dumper entra en reversa hasta el punto de carguío |
| 2 | El cargador frontal (LHD) sale del punto de extracción con el balde lleno y avanza al dumper |
| 3 | Levanta el balde, lo inclina y lo vacía en la tolva (la carga crece: 3 pases de ~10 t) |
| 4 | Vuelve en reversa, muerde la marina y carga otra vez (el mineral baja por gravedad desde el nicho) |
| 5 | El dumper sale cargado de frente |

| Interacción | Dónde | Qué pasa |
|---|---|---|
| Equipos | tocar el cargador o el dumper, o los chips; teclas 1–2 | foco: el resto se apaga, etiqueta, ficha con datos en vivo; en la demo la cámara se acerca |
| Radiografía | deslizador, flechas ↑↓ | 0–100 %: cuánto del interior se ve; el haz sigue el valor con seguimiento exponencial |
| Secuencia | ▶/❚❚, barra de 5 pasos, ‹ ›, espacio, `,` `.` | pausa, salta de paso o retrocede (`state(t)` puro) |

Cómo está armada:
- `js/stations/mina-subterranea.js`: modelo puro, dibujo, panel y montaje (demo y AR). Recursos en `assets/mina/`
  (`tunel.svg`, `cargador.svg`, `dumper.svg`, tal como los exportó Emilio). El arco del túnel se separa del resto para que
  el cargador quede detrás de él al entrar al frente; los equipos se recortan con la silueta del túnel.
- Sin perspectivas inventadas: ambos equipos se mueven por el eje de la galería con su vista dibujada (el dumper entra
  en reversa y sale de frente, como en la operación real).
- Pala del cargador articulada: los brazos giran sobre su pasador en el plano vertical del equipo (transformación
  isométrica exacta para ese plano) y el balde se reconstruye en 3D desde su placa lateral (`js/stations/balde3d.js`),
  así se inclina para vaciar sin deformarse y con el mismo trazo.
- Ubicación sobre la infografía: `REG` en el módulo (escala 0,688), dentro del bloque de terreno junto al portal impreso.
- AR: marcador 2 de `assets/targets.mind` (recorte `assets/target-mina.png`). Se probó la detección con cámara simulada;
  un recorte más ancho (con mucho blanco) no se detectaba, por eso el recorte va centrado en la etiqueta y el portal.

## Estación 2.2 · Chancado secundario y terciario (iteración 6)

Sobre el dibujo de Emilio (`assets/secundario/chancado-secundario.svg`): correa inclinada → distribuidora sobre los marcos
→ 4 tolvas → alimentadores de correa → HPGR → correa de producto. Todo el circuito se mueve a la vez; las correas van a
velocidad constante y cambia la carga; el alimentador cambia de velocidad para regular la tolva.

| Interacción | Dónde | Qué pasa |
|---|---|---|
| Interior tolva | deslizador, flechas ←→ | la pared frontal de la tolva (módulo 4) se vuelve transparente: nivel, cono de reposo bajo la entrada, flujo de masa hacia la descarga. Abre el **Detalle A** ampliado |
| Interior rodillos | deslizador, flechas ↑↓ | un plano de corte avanza por el HPGR (losa, cuerpo, descansos, rodillos): rodillo fijo y flotante en contrarrotación, cilindros hidráulicos, lecho comprimido y queque bajo la garganta. Abre el **Detalle B** ampliado |
| Alimentación | deslizador | 6.000–13.000 t/h: cambia la carga de las correas y el nivel de la tolva (sobre ~12.900 t/h la tolva se llena y aparece el aviso) |
| Equipos | chips o tocar el dibujo; teclas 1–5 | foco (el resto se apaga), etiqueta y ficha con datos en vivo; en la demo la cámara se acerca |
| Sigue una colpa | ▶/❚❚, 6 pasos, ‹ ›, `,` `.` | una colpa marcada recorre todo el circuito; cuando va por dentro de un equipo se marca con un pulso, y se ve si el corte está abierto |

Cómo está armada:
- `js/stations/chancado-secundario.js`: modelo (nivel ↔ alimentador ↔ HPGR), dibujo, detalles y panel. El cuerpo y la losa
  del HPGR del módulo 4 se redibujan como volúmenes 3D con las cotas exactas del dibujo (para poder cortarlos); la
  puerta y el marco frontal son los de Emilio, recortados en el plano de corte.
- Cotas del HPGR (unidades del SVG, ejes isométricos desde la esquina inferior del cuerpo): cuerpo 57,8 × 45,8 × 34,7,
  losa X −13,4…69 · Y −46,2…2 · Z 34,7…40; rodillos con eje en X (los motores del dibujo entran por −X), Ø 18, gap 1–1,8.
- Tolva: el perfil de la cara frontal sale de sus 6 vértices (resuelve a planos horizontales exactos) y el fondo a 23,1 / 16,5.
- `js/stations/secundario-geo.js`: silueta blanca del dibujo (rasterizado, cerrado y dilatado).
- AR: marcador 3 de `assets/targets.mind` (recorte `assets/target-secundario.png`).

## Estación 3 · Pilas de lixiviación (iteración 7)

Sobre los dibujos de Emilio (`assets/pilas/aglomerador.svg`, `apiladoras.svg`) más las losas, las franjas y los arcos
del PDF de la infografía (×2). Flujo: correa de alimentación → **tambor aglomerador** (agua + ácido: aglomerado y
curado) → correa a la **casa de traspaso** → un desviador manda los glómeros al módulo que se apila (o siguen "hacia
otros módulos") → **apiladora** (tripper + pluma telescópica) → **riego** con refino ácido → **percolación** → **PLS** por
la carpeta a las canaletas → al final del ciclo la **rotopala** retira los ripios (pila dinámica).

| Interacción | Dónde | Qué pasa |
|---|---|---|
| Interior tambor | deslizador, flechas ←→ | se abre una ventana en el manto del tambor (levantadores girando, lecho, cascada, barra de riego). Abre el **Detalle A**: la vista hacia adentro del tambor, como la referencia (levantadores, cascada, lecho que rueda y forma glómeros, barra reticulada con cañería de agua y de ácido, chute de alimentación) |
| Corte de la pila | deslizador, flechas ↑↓ | un plano corta la pila de la derecha (losa, carpeta, pila en riego). Abre el **Detalle B**: corte con goteros, gotas de refino que bajan y se vuelven PLS, carpeta HDPE con drenes y canaleta |
| Tasa de riego | deslizador | 6–14 L/h·m²: más gotas y PLS más rápido; el PLS se diluye al subir el riego (modelo referencial) |
| Equipos | chips o tocar el dibujo; teclas 1–5 | aglomerador, correas, apiladora, pilas (incluye la rotopala), riego y PLS: foco, etiqueta y ficha |
| Sigue un glómero | ▶/❚❚, 6 pasos, ‹ ›, `,` `.` | el glómero marcado sale del tambor, sube por la correa, pasa por la casa de traspaso y la apiladora y cae a la pila; luego el pulso sigue el riego, el PLS y la rotopala |

Ciclo del módulo izquierdo (60 s): vacío → apilando (17–35 s; la pila avanza desde el extremo lejano y la apiladora
retrocede) → riego (36–50 s) → percolación y PLS (42–54 s) → ripios con rotopala (51–60 s). Las otras tres pilas están
siempre en riego. Los arcos llevan PLS: la mitad izquierda sólo cuando el módulo izquierdo produce.

Interpretaciones por validar: franjas entre pilas = canaletas de PLS; arcos = canaletas que llevan el PLS a la piscina;
pluma telescópica agregada a la apiladora (la del dibujo llega sólo al borde de la pila); rotopala y correa corta de
alimentación agregadas; valores (ácido kg/t, rpm, g/L, m³/h) típicos/referenciales.

Cómo está armada:
- `js/stations/pilas-lixiviacion.js`: modelo del ciclo, dibujo (pilas en 3D isométrico ajustado a las losas del PDF:
  X → (0,8615; 0,5085), Y → (−0,8615; 0,5085), losa 140 × 80 × 6), tambor en las unidades de su SVG, detalles y panel.
- `js/stations/pilas-geo.js`: canaletas (franjas y arcos) del PDF y silueta blanca de la lámina.
- AR: marcador 4 de `assets/targets.mind` (recorte `assets/target-pilas.png`, x 2190 y 270, 740 × 450).

## Chancado primario · qué se puede hacer

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
├─ js/stations/rajo.js        estación 1: modelo, dibujo, panel y montaje (demo y AR)
├─ js/stations/rajo-geo.js    geometría del rajo extraída del .ai (generado)
├─ js/stations/mina-subterranea.js  estación 1 (mina): radiografía, carguío LHD → dumper, panel
├─ js/stations/balde3d.js     balde del cargador reconstruido en 3D (gira sin deformarse)
├─ js/stations/chancado-secundario.js  estación 2.2: flujo, tolva por dentro, corte del HPGR, detalles A/B
├─ js/stations/secundario-geo.js  silueta del dibujo del chancado secundario
├─ js/stations/pilas-lixiviacion.js  estación 3: aglomerador, apiladora, riego, PLS, rotopala, detalles A/B
├─ js/stations/pilas-geo.js      canaletas y silueta de las pilas
├─ assets/pilas/*.svg             dibujos de Emilio (aglomerador, apiladoras y correas)
├─ assets/target-pilas.png        marcador de las pilas de lixiviación
├─ assets/secundario/*.svg        dibujo de Emilio (correas, tolvas, alimentadores, HPGR)
├─ assets/target-secundario.png   marcador del chancado secundario y terciario
├─ assets/mina/*.svg              túnel, cargador frontal y dumper
├─ assets/target-mina.png         recorte de la infografía: marcador de la mina
├─ assets/rajo/*.svg              pala (orugas + 5 vistas de giro) y perforadora
├─ assets/target-rajo.png         recorte de la infografía: marcador del rajo
├─ assets/chancador_primario.svg   SVG original de Illustrator, sin tocar (base de la escena)
├─ assets/caex/*.svg               sprites del CAEX (cargada, descargando, vacía, giro180)
├─ assets/picarrocas.svg           picarrocas articulado
├─ assets/infografia.jpg           infografía completa a 2× (demo sin cámara)
├─ assets/target-chancado.png      recorte de la infografía usado como marcador
├─ assets/targets.mind             marcadores compilados para MindAR (0 chancado, 1 rajo, 2 mina, 3 secundario, 4 pilas)
├─ tools/compilar-marcador.html    compila nuevos recortes a targets.mind en el navegador
├─ tools/generar-giro-caex.mjs     exporta los fotogramas del giro como SVG (npm run giro)
├─ tools/extraer-rajo.py           .ai del rajo → js/stations/rajo-geo.js
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
3. **Una estación por marcador**: cada estación = un recorte + su SVG + su modelo. Ya funciona con chancado (0), rajo (1), mina (2) y secundario (3);
   para sumar otra, agrega su recorte a la compilación de `targets.mind` y su `addCSSAnchor(i)` en `app.js`.
4. **Infografía en CMYK**: `assets/infografia.jpg` viene en CMYK. Chrome y Safari la muestran bien, pero conviene exportarla en RGB (sRGB)
   para que los colores sean iguales en todos los equipos y pese menos.
5. Ajustar `STATION.scale` / `lift` y `RAJO_TARGET.lift` en `app.js` con la infografía impresa a tamaño real.
