window.SP3D_DATA = {
  extent: {
    west: -76.31260140197662,
    east: -76.09610801825956,
    south: 3.9037330228464007,
    north: 4.051111279937809
  },
  focus: {
    municipal: { lon: -76.20435, lat: 3.97742, height: 13500 },
    urban: { lon: -76.22805, lat: 3.99557, height: 2500 },
    plaza: { lon: -76.22805, lat: 3.99557, height: 1100 },
    streets: { lon: -76.22805, lat: 3.99557, height: 900 },
    mountain: { lon: -76.145, lat: 3.973, height: 6500 },
    roadAccess: { lon: -76.205, lat: 3.992, height: 2400 }
  },
  sources: {
    boundaryGeoJson: "https://infraestructura.valledelcauca.gov.co/server/rest/services/SAN_PEDRO_M_MIL1/MapServer/2/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
    roadsGeoJson: "https://infraestructura.valledelcauca.gov.co/server/rest/services/SAN_PEDRO_M_MIL1/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
    naturalBaseGeoJson: "https://infraestructura.valledelcauca.gov.co/server/rest/services/SAN_PEDRO_M_MIL1/MapServer/1/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
    conservationGeoJson: "https://infraestructura.valledelcauca.gov.co/server/rest/services/SAN_PEDRO_M_MIL1/MapServer/3/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
    satelliteTiles: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labelsTiles: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    streetMapTiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  },
  places: [
    {
      id: "parque-principal",
      name: "Parque principal de San Pedro",
      type: "Lugar emblemático",
      lat: 3.99557,
      lon: -76.22805,
      description: "Nodo central del casco urbano y referencia principal para la visita territorial.",
      exactness: "referencia cartográfica"
    },
    {
      id: "casco-urbano",
      name: "Casco urbano",
      type: "Sector urbano",
      lat: 3.99557,
      lon: -76.22805,
      description: "Concentración principal de calles, equipamientos y actividad municipal.",
      exactness: "referencia cartográfica"
    },
    {
      id: "corredor-vial",
      name: "Corredor vial de acceso",
      type: "Conectividad",
      lat: 3.992,
      lon: -76.205,
      description: "Zona estratégica para observar el acceso, el tejido vial y el enlace con el casco urbano.",
      exactness: "referencia cartográfica"
    },
    {
      id: "zona-rural-oriente",
      name: "Zona rural oriental",
      type: "Paisaje rural",
      lat: 3.973,
      lon: -76.145,
      description: "Área útil para leer pendientes, relieve y transición entre zonas verdes y áreas rurales.",
      exactness: "referencia cartográfica"
    }
  ],
  localities: [
    {
      id: "centro",
      name: "Centro urbano",
      kind: "Localidad",
      lat: 3.99557,
      lon: -76.22805,
      description: "Sector ideal para revisar calles, espacio público y puntos principales del municipio."
    },
    {
      id: "oriente-rural",
      name: "Oriental rural y montañoso",
      kind: "Localidad",
      lat: 3.973,
      lon: -76.145,
      description: "Franja con lectura clara del relieve y de la relación entre vías y paisaje."
    },
    {
      id: "sur-vial",
      name: "Acceso vial sur",
      kind: "Localidad",
      lat: 3.962,
      lon: -76.214,
      description: "Punto de interés para revisar conectividad, acceso y recorrido hacia el área urbana."
    }
  ],
  works: [
    {
      id: "obra-centro",
      name: "Seguimiento de obra · Centro urbano",
      status: "Ficha lista para datos reales",
      lat: 3.99557,
      lon: -76.22805,
      description: "Espacio preparado para mostrar una obra real con fotos, avance, contratista y evidencias cuando se carguen los datos oficiales.",
      locality: "Centro urbano"
    },
    {
      id: "obra-vial",
      name: "Seguimiento de obra · Corredor vial",
      status: "Ficha lista para datos reales",
      lat: 3.992,
      lon: -76.205,
      description: "Preparado para revisar obras viales o de mejoramiento en un sector de conectividad municipal.",
      locality: "Corredor vial"
    },
    {
      id: "obra-rural",
      name: "Seguimiento de obra · Zona rural",
      status: "Ficha lista para datos reales",
      lat: 3.973,
      lon: -76.145,
      description: "Preparado para ubicar intervenciones en veredas o áreas rurales con su evidencia correspondiente.",
      locality: "Zona rural oriental"
    }
  ]
};
