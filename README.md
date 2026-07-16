# San Pedro, Valle del Cauca — Territorio 3D

Proyecto web 3D para explorar el municipio de **San Pedro, Valle del Cauca**, con navegación aérea, vista urbana, ruta cinematográfica, capas temáticas y una interfaz lista para **GitHub Pages** o para abrirse mediante un servidor local.

## Qué incluye

- `index.html`
- `assets/css/styles.css`
- `assets/js/app.js`
- `assets/js/data.js`
- `data/fallback-boundary.geojson`
- `config/tokens.js`
- `config/tokens.example.js`

## Tecnología elegida

Se utiliza **CesiumJS** porque permite:

- navegación 3D fluida;
- control de cámara, inclinación y vuelo;
- relieve real cuando la fuente está disponible;
- integración de imágenes satelitales;
- atmósfera, iluminación y sombras;
- visualización de entidades geográficas y recorridos.

## Cómo abrir el proyecto

### Opción 1: servidor local con Python

Desde la carpeta del proyecto:

```bash
python -m http.server 8080
```

Luego abre:

```text
http://localhost:8080
```

### Opción 2: GitHub Pages

1. Sube la carpeta completa a un repositorio.
2. Activa GitHub Pages apuntando a la rama principal.
3. Abre la URL publicada.

## Configuración de token

El proyecto trae un archivo `config/tokens.js` con esta estructura:

```js
window.APP_CONFIG = {
  cesiumIonToken: "",
  useCesiumWorldTerrain: true,
  enableOsmBuildings: false
};
```

### Si quieres mayor fidelidad

1. Crea o usa un token de **Cesium Ion**.
2. Pégalo en `cesiumIonToken`.
3. Si deseas edificios 3D, cambia `enableOsmBuildings` a `true`.

## Comportamiento con y sin token

### Con token

- intenta usar **Cesium World Terrain**;
- puede habilitar edificaciones 3D OSM.

### Sin token

- intenta usar **ArcGIS World Elevation** como respaldo;
- si la fuente no responde, cae a un modo de respaldo sin relieve real.

## Fuentes usadas en el proyecto

- ArcGIS World Imagery
- ArcGIS World Elevation
- OpenStreetMap
- Servicio cartográfico de Infraestructura Valle del Cauca
- Cartografía local incluida por el usuario

## Precisiones y limitaciones importantes

- El **límite municipal** se consulta desde la fuente oficial. Si falla, se usa `data/fallback-boundary.geojson`.
- El **casco urbano** en este paquete se representa como una **aproximación visual**, porque no se entregó un polígono urbano oficial independiente en el ZIP.
- Los **lugares importantes** incluidos se basan en la cartografía y referencias entregadas dentro del material disponible en esta conversación.
- Para llegar a una reconstrucción aún más exacta de veredas, edificios emblemáticos, vías y elevación detallada, se recomienda añadir al proyecto datos como:
  - GeoJSON/KML/SHP del límite municipal y del casco urbano,
  - DEM local o servicio de terreno confirmado,
  - capas viales y de veredas,
  - inventario de puntos emblemáticos con coordenadas verificadas.

## Estructura

```text
san_pedro_territorio_3d/
├── index.html
├── README.md
├── assets/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js
│       └── data.js
├── config/
│   ├── tokens.example.js
│   └── tokens.js
└── data/
    └── fallback-boundary.geojson
```

## Revisión técnica aplicada

- se evitó escribir tokens en el código público por defecto;
- se dejó fallback de límite territorial local;
- se preparó interfaz responsive para computador y celular;
- se añadieron mensajes claros cuando una fuente externa falla;
- se incluyó una ruta cinematográfica;
- se limitaron los controles de cámara para evitar atravesar el terreno.

## Recomendación final

Si quieres la versión **más fiel posible al territorio real**, el siguiente salto de precisión consiste en añadir:

- el shapefile/geojson real del municipio y casco urbano,
- DEM específico,
- POI verificados,
- y capas oficiales de vías/veredas.

Con eso, este proyecto puede evolucionar a una versión todavía más exacta sin cambiar la arquitectura base.

## Corrección V1.1 — error `getDerivedResource`

Esta versión corrige los errores reportados:

- se desactivó la capa Ion automática del `Viewer` mediante `baseLayer: false`;
- la imagen satelital y las etiquetas usan `UrlTemplateImageryProvider`, evitando construir `ArcGisMapServerImageryProvider` de forma incompatible;
- las capas oficiales de vías, base natural y conservación se cargan como GeoJSON, no como un MapServer de teselas inexistente;
- se eliminaron contornos de polígonos incompatibles con terreno y se dibujan líneas separadas adheridas al suelo;
- se eliminó el `heightReference` inválido del polígono urbano;
- se agregó un favicon vacío para evitar el 404 habitual de `/favicon.ico`;
- no se realiza ninguna petición a Cesium Ion sin un token explícito en `config/tokens.js`.
