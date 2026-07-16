# San Pedro — Pueblo 3D ligero y realista

Esta versión sustituye el visor pesado de Cesium por una experiencia más focalizada y liviana basada en **MapLibre GL JS**.

## Objetivo

Mostrar solamente:

- el casco urbano de San Pedro;
- el parque principal;
- el corredor de acceso;
- el borde rural cercano;
- algunos puntos específicos para obras o intervenciones.

No se carga el Valle del Cauca completo ni se intenta mantener un globo mundial activo.

## Por qué es más ligera

- el movimiento queda limitado a un área pequeña alrededor del pueblo;
- no se cargan edificios 3D globales;
- no se usa Cesium Ion;
- no requiere token;
- usa pocas capas y pocos marcadores;
- las imágenes satelitales se cargan solo según el nivel de zoom visible;
- el relieve puede apagarse con un botón para mejorar rendimiento en celulares.

## Realismo

La apariencia realista se logra con:

- imagen satelital real de ArcGIS World Imagery;
- relieve 3D mediante un DEM raster;
- hillshade separado del terreno;
- inclinación de cámara;
- calles de OpenStreetMap como capa opcional.

## Cómo abrir

No abras el HTML con doble clic. Desde esta carpeta ejecuta:

```bash
python -m http.server 8080
```

Luego abre:

```text
http://localhost:8080
```

En Windows también puedes ejecutar `INICIAR_SERVIDOR.bat`.

## Dependencias externas

El proyecto utiliza:

- MapLibre GL JS 5.24.0 desde UNPKG;
- ArcGIS World Imagery;
- OpenStreetMap;
- Mapterhorn DEM para relieve.

Por eso necesita conexión a internet para mostrar la imagen satelital, calles y elevación.

## Obras reales

Las tarjetas de obras incluidas son plantillas claramente identificadas. Para reemplazarlas, edita:

```text
assets/js/data.js
```

Cada obra puede incluir:

- nombre;
- coordenadas;
- descripción;
- zoom;
- inclinación;
- orientación de cámara.

## Archivos

```text
san_pedro_pueblo_3d_ligero/
├── index.html
├── README.md
├── INICIAR_SERVIDOR.bat
├── iniciar_servidor.sh
├── assets/
│   ├── css/styles.css
│   ├── js/app.js
│   ├── js/data.js
│   └── images/cartografia_fallback.png
```
