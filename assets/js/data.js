window.SP3D_DATA = {
  extent: {
    west: -76.31260140197662,
    east: -76.09610801825956,
    south: 3.9037330228464007,
    north: 4.051111279937809
  },
  focus: {
    valley: { lon: -76.40, lat: 4.10, height: 68000 },
    municipal: { lon: -76.20435, lat: 3.97742, height: 14500 },
    urban: { lon: -76.22805, lat: 3.99557, height: 2500 },
    rural: { lon: -76.145, lat: 3.973, height: 6500 },
    plaza: { lon: -76.22805, lat: 3.99557, height: 1200 }
  },
  sources: {
    boundaryGeoJson: "https://infraestructura.valledelcauca.gov.co/server/rest/services/SAN_PEDRO_M_MIL1/MapServer/2/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
    officialMapService: "https://infraestructura.valledelcauca.gov.co/server/rest/services/SAN_PEDRO_M_MIL1/MapServer",
    streetMapTiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    topoTiles: "https://tile.opentopomap.org/{z}/{x}/{y}.png"
  },
  places: [
    {
      id: "parque-principal",
      name: "Parque principal de San Pedro",
      type: "Centro urbano",
      lat: 3.99557,
      lon: -76.22805,
      description: "Punto central de referencia para el casco urbano y destino final del recorrido cinematográfico.",
      photo: "",
      exactness: "referencia cartográfica"
    },
    {
      id: "casco-urbano",
      name: "Casco urbano",
      type: "Sector urbano",
      lat: 3.99557,
      lon: -76.22805,
      description: "Área urbana principal del municipio de San Pedro.",
      photo: "",
      exactness: "referencia cartográfica"
    },
    {
      id: "zona-rural-oriente",
      name: "Zona rural oriental",
      type: "Zona rural",
      lat: 3.973,
      lon: -76.145,
      description: "Sector orientado hacia laderas y áreas montañosas del municipio.",
      photo: "",
      exactness: "referencia cartográfica"
    },
    {
      id: "centro-municipal",
      name: "Centro del municipio",
      type: "Referencia territorial",
      lat: 3.97742,
      lon: -76.20435,
      description: "Punto de referencia usado para centrar el municipio en la navegación inicial.",
      photo: "",
      exactness: "referencia cartográfica"
    }
  ]
};
