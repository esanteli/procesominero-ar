// Registro de estaciones de la infografía "Proceso Minero" (assets/infografia.jpg, 3012 × 812 px).
// Todas las coordenadas están en píxeles de esa imagen:
//   label → la etiqueta naranja/amarilla impresa (zona clickeable, detectada sobre la imagen)
//   focus → el encuadre de la estación al hacer zoom (etiqueta + su ilustración)
// status: "lista" (tiene animación) · "en desarrollo" (vista preparada, sin animación aún)
// module: ruta a un módulo que exporte mount(ctx) — ver js/stations/plantilla.js. null = vista de espera.
//
// Para sumar la animación de una estación: crea js/stations/<id>.js a partir de la plantilla,
// pon aquí module: "./stations/<id>.js" y status: "lista".

// la imagen se exporta a 2× (6021 px, desde PDF/Proceso_Minero_CoWork_Act.pdf) para que el zoom se vea nítido;
// las coordenadas siguen en la escala de 3012 px
export const POSTER = { src: "assets/infografia.jpg", w: 3012, h: 812 };

export const STATIONS = [
  {
    id: "rajo", n: "1", name: "Rajo", tone: "naranja",
    label: [556, 285, 111, 50], focus: [40, 200, 700, 380],
    text: "Mina a cielo abierto. Se perfora y se tronada la roca en bancos; palas cargan los CAEX, que llevan el mineral a chancado y el estéril a botaderos. Del rajo salen minerales oxidados y sulfurados.",
    status: "en desarrollo", module: null,
  },
  {
    id: "mina-subterranea", n: "1", name: "Mina subterránea", tone: "naranja",
    label: [742, 561, 141, 50], focus: [560, 520, 360, 200],
    text: "Explotación bajo tierra por túneles y galerías. El mineral se arranca en el interior y se transporta a superficie para seguir el mismo proceso que el del rajo.",
    status: "en desarrollo", module: null,
  },
  {
    id: "chancado-primario", n: "2", name: "Chancado primario", tone: "naranja",
    label: [873, 156, 129, 51], focus: [760, 80, 330, 430],
    text: "Un chancador giratorio reduce colpas de hasta ~1,5 m a menos de ~20 cm. Los CAEX descargan en su tolva y una correa se lleva el mineral chancado.",
    status: "lista", module: "builtin:chancador",
  },
  {
    id: "concentradora", n: "2", name: "Concentradora", tone: "amarillo",
    label: [1029, 667, 161, 51], focus: [940, 450, 300, 290],
    text: "Molinos SAG y de bolas muelen el mineral sulfurado con agua hasta formar una pulpa fina, lista para la flotación.",
    status: "en desarrollo", module: null,
  },
  {
    id: "chancado-secundario", n: "2.2", name: "Chancado secundario y terciario", tone: "naranja",
    label: [1208, 441, 137, 50], focus: [940, 290, 420, 220],
    text: "Chancadores de cono reducen el mineral a pocos centímetros y harneros lo clasifican, preparándolo para la lixiviación o la molienda.",
    status: "en desarrollo", module: null,
  },
  {
    id: "pilas-lixiviacion", n: "3", name: "Pilas de lixiviación", tone: "naranja",
    label: [1317, 308, 141, 50], focus: [1090, 120, 390, 250],
    text: "El mineral oxidado se apila y se riega con una solución ácida que disuelve el cobre; la solución rica se recoge para extraer el metal.",
    status: "en desarrollo", module: null,
  },
  {
    id: "celdas-flotacion", n: "3", name: "Celdas de flotación", tone: "amarillo",
    label: [1538, 574, 141, 50], focus: [1340, 330, 530, 310],
    text: "La pulpa se agita con aire y reactivos: las partículas de sulfuro de cobre se pegan a las burbujas y forman un concentrado de ~25–30 % de cobre.",
    status: "en desarrollo", module: null,
  },
  {
    id: "electroobtencion", n: "4", name: "Electroobtención", tone: "naranja",
    label: [1654, 303, 167, 50], focus: [1450, 160, 420, 210],
    text: "La solución con cobre pasa por celdas electrolíticas y el metal se deposita en cátodos de 99,99 % de pureza.",
    status: "en desarrollo", module: null,
  },
  {
    id: "fundicion", n: "4", name: "Fundición", tone: "amarillo",
    label: [2100, 626, 131, 51], focus: [2040, 470, 300, 230],
    text: "El concentrado se funde y refina a alta temperatura hasta obtener ánodos de cobre de ~99,5 %.",
    status: "en desarrollo", module: null,
  },
  {
    id: "puerto", n: "5", name: "Puerto", tone: "naranja",
    label: [2476, 349, 122, 50], focus: [2080, 190, 520, 290],
    text: "Cátodos y concentrado se embarcan hacia los mercados internacionales.",
    status: "en desarrollo", module: null,
  },
];

export const byId = (id) => STATIONS.find((s) => s.id === id);
