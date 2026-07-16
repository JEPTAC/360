# San Pedro, Valle del Cauca — Territorio 3D (enfoque local)

Esta versión del proyecto se reorientó para mostrar **solamente San Pedro** y facilitar tres usos principales:

1. **mostrar lugares del municipio**;
2. **revisar calles y red vial**;
3. **mostrar obras / localidades con un diseño más presentable**.

## Novedades de esta versión

- La vista inicial ya no abre el Valle del Cauca completo: **arranca centrada en San Pedro**.
- Se añadieron botones rápidos para:
  - **Casco urbano**
  - **Ver calles**
  - **Ver obras**
- Se incorporaron paneles visuales para:
  - **lugares destacados**
  - **localidades y sectores**
  - **obras y seguimiento**
- Se mantuvo la navegación 3D con Cesium y el relieve real cuando la fuente responde.
- La red vial municipal y el modo calles se pueden alternar desde los botones y desde el selector de capas.

## Importante sobre las obras

La experiencia ya tiene la **estructura visual completa** para mostrar obras por localidad, pero el paquete actual **no trae aún el inventario oficial de obras con coordenadas, fotos y fichas**.

Por eso las tarjetas de obras quedaron listas para reemplazar por información real. Si me compartes ese inventario, se puede cargar directamente en `assets/js/data.js` o en un GeoJSON adicional.

## Cómo abrir

Desde la carpeta del proyecto:

```bash
python -m http.server 8080
```

Luego abre:

```text
http://localhost:8080
```

## Token opcional

Para edificios 3D OSM necesitas configurar `config/tokens.js`:

```js
window.APP_CONFIG = {
  cesiumIonToken: "",
  useCesiumWorldTerrain: true,
  enableOsmBuildings: false
};
```

## Archivos principales

- `index.html`
- `assets/css/styles.css`
- `assets/js/data.js`
- `assets/js/app.js`
- `data/fallback-boundary.geojson`

## Próximo paso recomendado

Si quieres una versión todavía mejor, el siguiente salto consiste en cargar:

- **obras reales con coordenadas**,
- **fotos reales de cada localidad u obra**,
- **calles urbanas más específicas**,
- y **puntos emblemáticos adicionales**.
