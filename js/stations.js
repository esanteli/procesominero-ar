// Registro de estaciones de la infografía "Proceso Minero" (assets/infografia.jpg, 5497 × 1623 px).
// Todas las coordenadas están en píxeles de esa imagen:
//   label → la etiqueta naranja/amarilla impresa (zona clickeable, detectada sobre la imagen)
//   focus → el encuadre de la estación al hacer zoom (etiqueta + su ilustración)
// status: "lista" (tiene animación) · "en desarrollo" (vista preparada, sin animación aún)
// module: ruta a un módulo que exporte mount(ctx) — ver js/stations/plantilla.js. null = vista de espera.
//
// Para sumar la animación de una estación: crea js/stations/<id>.js a partir de la plantilla,
// pon aquí module: "./stations/<id>.js" y status: "lista".

export const POSTER = { src: "assets/infografia.jpg", w: 5497, h: 1623 };

export const STATIONS = [
  {
    id: "rajo", n: "1", name: "Rajo", tone: "naranja",
    label: [1112, 570, 222, 100], focus: [80, 400, 1400, 760],
    text: "Mina a cielo abierto. Se perfora y se tronada la roca en bancos; palas cargan los CAEX, que llevan el mineral a chancado y el estéril a botaderos. Del rajo salen minerales oxidados y sulfurados.",
    status: "lista", module: "./stations/rajo.js",
  },
  {
    id: "mina-subterranea", n: "1", name: "Mina subterránea", tone: "naranja",
    label: [1484, 1122, 282, 100], focus: [1120, 1040, 720, 400],
    text: "Explotación bajo tierra por túneles y galerías. El mineral se arranca en el interior y se transporta a superficie para seguir el mismo proceso que el del rajo.",
    status: "lista", module: "./stations/mina-subterranea.js",
  },
  {
    id: "chancado-primario", n: "2", name: "Chancado primario", tone: "naranja",
    label: [1746, 312, 258, 102], focus: [1520, 160, 660, 860],
    text: "Un chancador giratorio reduce colpas de hasta ~1,5 m a menos de ~20 cm. Los CAEX descargan en su tolva y una correa se lleva el mineral chancado.",
    status: "lista", module: "builtin:chancador",
  },
  {
    id: "concentradora", n: "2", name: "Molino SAG y de bolas", tone: "amarillo",
    label: [2058, 1334, 322, 102], focus: [1880, 900, 600, 580],
    text: "El molino SAG y los molinos de bolas muelen el mineral sulfurado con agua hasta una pulpa fina; los hidrociclones devuelven los gruesos a molienda y mandan los finos a flotación.",
    status: "lista", module: "./stations/molienda.js",
  },
  {
    id: "chancado-secundario", n: "2.2", name: "Chancado secundario y terciario", tone: "naranja",
    label: [2416, 882, 274, 100], focus: [1880, 580, 840, 440],
    text: "Chancadores de cono reducen el mineral a pocos centímetros y harneros lo clasifican, preparándolo para la lixiviación o la molienda.",
    status: "lista", module: "./stations/chancado-secundario.js",
  },
  {
    id: "pilas-lixiviacion", n: "3", name: "Pilas de lixiviación", tone: "naranja",
    label: [2634, 616, 282, 100], focus: [2180, 240, 780, 500],
    text: "El mineral oxidado se apila y se riega con una solución ácida que disuelve el cobre; la solución rica se recoge para extraer el metal.",
    status: "lista", module: "./stations/pilas-lixiviacion.js",
  },
  {
    id: "celdas-flotacion", n: "3", name: "Celdas de flotación", tone: "amarillo",
    label: [3076, 1148, 282, 100], focus: [2680, 660, 1060, 620],
    text: "La pulpa se agita con aire y reactivos: las partículas de sulfuro de cobre se pegan a las burbujas y forman un concentrado de ~25–30 % de cobre.",
    status: "en desarrollo", module: null,
  },
  {
    id: "electroobtencion", n: "4", name: "Electroobtención", tone: "naranja",
    label: [3308, 606, 334, 100], focus: [2900, 320, 840, 420],
    text: "La solución con cobre pasa por celdas electrolíticas y el metal se deposita en cátodos de 99,99 % de pureza.",
    status: "en desarrollo", module: null,
  },
  {
    id: "fundicion", n: "4", name: "Fundición", tone: "amarillo",
    label: [4200, 1252, 262, 102], focus: [4080, 940, 600, 460],
    text: "El concentrado se funde y refina a alta temperatura hasta obtener ánodos de cobre de ~99,5 %.",
    status: "en desarrollo", module: null,
  },
  {
    id: "puerto", n: "5", name: "Puerto", tone: "naranja",
    label: [4952, 698, 244, 100], focus: [4160, 380, 1040, 580],
    text: "Cátodos y concentrado se embarcan hacia los mercados internacionales.",
    status: "en desarrollo", module: null,
  },
];

export const byId = (id) => STATIONS.find((s) => s.id === id);
