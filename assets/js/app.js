(function () {
  'use strict';

  const DATA = window.SP3D_DATA;
  const CONFIG = window.APP_CONFIG || {};
  const Cesium = window.Cesium;

  const state = {
    viewer: null,
    layers: {},
    dataSources: {},
    placesById: {},
    tourCancel: false,
    buildingsReady: false,
    terrainEnabled: true,
    renderRecoveryAttempted: false
  };

  const els = {
    loadingScreen: document.getElementById('loadingScreen'),
    loadingBar: document.getElementById('loadingBar'),
    loadingMessage: document.getElementById('loadingMessage'),
    loadingPercent: document.getElementById('loadingPercent'),
    resourceState: document.getElementById('resourceState'),
    app: document.getElementById('app'),
    sidebar: document.getElementById('sidebar'),
    toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    startTourBtn: document.getElementById('startTourBtn'),
    exploreBtn: document.getElementById('exploreBtn'),
    homeBtn: document.getElementById('homeBtn'),
    centerBtn: document.getElementById('centerBtn'),
    placeSearch: document.getElementById('placeSearch'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
    placesList: document.getElementById('placesList'),
    altitude: document.getElementById('altitudeIndicator'),
    heading: document.getElementById('headingIndicator'),
    pitch: document.getElementById('pitchIndicator'),
    status: document.getElementById('statusIndicator'),
    toast: document.getElementById('toast')
  };

  function setProgress(percent, message, detail) {
    const clamped = Math.max(0, Math.min(100, percent));
    els.loadingBar.style.width = `${clamped}%`;
    els.loadingPercent.textContent = `${Math.round(clamped)}%`;
    if (message) els.loadingMessage.textContent = message;
    if (detail) els.resourceState.textContent = detail;
  }

  function showToast(message, delay = 4200) {
    els.toast.textContent = message;
    els.toast.classList.remove('hidden');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => els.toast.classList.add('hidden'), delay);
  }

  function toggleSidebar(forceOpen) {
    const open = typeof forceOpen === 'boolean' ? forceOpen : !els.sidebar.classList.contains('open');
    els.sidebar.classList.toggle('open', open);
  }

  async function createTerrainProvider() {
    if (CONFIG.cesiumIonToken) {
      Cesium.Ion.defaultAccessToken = CONFIG.cesiumIonToken;
    }

    if (CONFIG.useCesiumWorldTerrain && CONFIG.cesiumIonToken) {
      try {
        setProgress(20, 'Conectando con Cesium World Terrain…', 'Terreno con token');
        return await Cesium.createWorldTerrainAsync({
          requestVertexNormals: true,
          requestWaterMask: true
        });
      } catch (error) {
        console.warn('Cesium World Terrain no disponible; se intentará ArcGIS.', error);
      }
    }

    try {
      setProgress(20, 'Conectando con ArcGIS World Elevation…', 'Terreno real sin token');
      return await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
        'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
        { token: undefined }
      );
    } catch (error) {
      console.warn('ArcGIS World Elevation no disponible; se usará elipsoide.', error);
      state.terrainEnabled = false;
      return new Cesium.EllipsoidTerrainProvider();
    }
  }

  function createViewer(terrainProvider) {
    const viewer = new Cesium.Viewer('cesiumContainer', {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      baseLayer: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      fullscreenButton: false,
      selectionIndicator: true,
      infoBox: true,
      shadows: true,
      terrainProvider,
      shouldAnimate: true,
      requestRenderMode: false,
      showRenderLoopErrors: false
    });

    const scene = viewer.scene;
    scene.globe.depthTestAgainstTerrain = true;
    scene.globe.enableLighting = true;
    scene.skyAtmosphere.show = true;
    scene.skyBox.show = true;
    scene.fog.enabled = true;
    scene.fog.density = 0.0007;
    scene.fog.screenSpaceErrorFactor = 1.5;
    scene.postProcessStages.fxaa.enabled = true;
    scene.screenSpaceCameraController.minimumZoomDistance = 120;
    scene.screenSpaceCameraController.maximumZoomDistance = 120000;
    scene.screenSpaceCameraController.enableCollisionDetection = true;
    scene.verticalExaggeration = 1.08;

    scene.renderError.addEventListener((_scene, error) => {
      console.error('Cesium render error:', error);
      if (!state.renderRecoveryAttempted) {
        state.renderRecoveryAttempted = true;
        if (state.layers.labels) state.layers.labels.show = false;
        if (state.layers.streets) state.layers.streets.show = false;
        if (viewer.cesiumWidget) viewer.cesiumWidget.useDefaultRenderLoop = true;
        showToast('Se desactivaron capas opcionales para recuperar el renderizado.', 6500);
      }
    });

    state.viewer = viewer;
    return viewer;
  }

  function makeUrlTemplateProvider(url, options = {}) {
    const provider = new Cesium.UrlTemplateImageryProvider({
      url,
      minimumLevel: 0,
      maximumLevel: options.maximumLevel || 19,
      credit: options.credit || ''
    });
    provider.errorEvent.addEventListener((error) => {
      console.warn(`Error de tesela en ${url}:`, error);
    });
    return provider;
  }

  function addImageryLayers(viewer) {
    const satelliteProvider = makeUrlTemplateProvider(DATA.sources.satelliteTiles, {
      maximumLevel: 19,
      credit: 'Esri, Maxar, Earthstar Geographics'
    });
    const satellite = viewer.imageryLayers.addImageryProvider(satelliteProvider);
    satellite.alpha = 1;

    const labelsProvider = makeUrlTemplateProvider(DATA.sources.labelsTiles, {
      maximumLevel: 19,
      credit: 'Esri'
    });
    const labels = viewer.imageryLayers.addImageryProvider(labelsProvider);
    labels.alpha = 0.86;

    const streetsProvider = makeUrlTemplateProvider(DATA.sources.streetMapTiles, {
      maximumLevel: 19,
      credit: '© OpenStreetMap contributors'
    });
    const streets = viewer.imageryLayers.addImageryProvider(streetsProvider);
    streets.alpha = 0.82;
    streets.show = false;

    state.layers.satellite = satellite;
    state.layers.labels = labels;
    state.layers.streets = streets;
  }

  async function loadGeoJsonWithFallback(url, fallbackPath, options, name) {
    try {
      const ds = await Cesium.GeoJsonDataSource.load(url, options);
      ds.name = name;
      return ds;
    } catch (error) {
      console.warn(`${name}: la fuente remota no respondió.`, error);
      if (!fallbackPath) return null;
      const ds = await Cesium.GeoJsonDataSource.load(fallbackPath, options);
      ds.name = `${name} (respaldo)`;
      return ds;
    }
  }

  function addGroundOutline(dataSource, color, width) {
    const now = Cesium.JulianDate.now();
    const toAdd = [];
    dataSource.entities.values.forEach((entity) => {
      if (!entity.polygon) return;
      entity.polygon.outline = false;
      entity.polygon.material = color.withAlpha(0.045);
      entity.polygon.classificationType = Cesium.ClassificationType.TERRAIN;
      const hierarchy = entity.polygon.hierarchy && entity.polygon.hierarchy.getValue(now);
      if (hierarchy && hierarchy.positions && hierarchy.positions.length > 1) {
        const positions = hierarchy.positions.slice();
        positions.push(hierarchy.positions[0]);
        toAdd.push({
          name: `${entity.name || dataSource.name} — contorno`,
          polyline: {
            positions,
            width,
            material: color,
            clampToGround: true
          }
        });
      }
    });
    toAdd.forEach((definition) => dataSource.entities.add(definition));
  }

  async function loadMunicipalBoundary(viewer) {
    setProgress(36, 'Cargando límite municipal…', 'Fuente oficial');
    const ds = await loadGeoJsonWithFallback(
      DATA.sources.boundaryGeoJson,
      'data/fallback-boundary.geojson',
      {
        fill: Cesium.Color.WHITE.withAlpha(0.04),
        stroke: Cesium.Color.WHITE,
        strokeWidth: 2,
        clampToGround: true
      },
      'Límite municipal'
    );
    if (!ds) return;
    addGroundOutline(ds, Cesium.Color.WHITE, 3);
    viewer.dataSources.add(ds);
    state.dataSources.municipalBoundary = ds;
  }

  async function loadOfficialVectorLayers(viewer) {
    const definitions = [
      {
        key: 'roads',
        name: 'Infraestructura vial',
        url: DATA.sources.roadsGeoJson,
        options: {
          stroke: Cesium.Color.fromCssColorString('#ff6a4d'),
          strokeWidth: 3,
          fill: Cesium.Color.TRANSPARENT,
          clampToGround: true
        }
      },
      {
        key: 'naturalBase',
        name: 'Base natural e hidrografía',
        url: DATA.sources.naturalBaseGeoJson,
        options: {
          stroke: Cesium.Color.fromCssColorString('#3cb496'),
          strokeWidth: 2,
          fill: Cesium.Color.fromCssColorString('#3cb496').withAlpha(0.07),
          clampToGround: true
        }
      },
      {
        key: 'conservation',
        name: 'Conservación ambiental',
        url: DATA.sources.conservationGeoJson,
        options: {
          stroke: Cesium.Color.fromCssColorString('#8bc45b'),
          strokeWidth: 1.5,
          fill: Cesium.Color.fromCssColorString('#8bc45b').withAlpha(0.08),
          clampToGround: true
        }
      }
    ];

    await Promise.all(definitions.map(async (definition) => {
      try {
        const ds = await Cesium.GeoJsonDataSource.load(definition.url, definition.options);
        ds.name = definition.name;
        viewer.dataSources.add(ds);
        state.dataSources[definition.key] = ds;
        if (definition.key !== 'roads') {
          addGroundOutline(ds, definition.options.stroke, definition.options.strokeWidth);
          ds.show = false;
        }
      } catch (error) {
        console.warn(`No se pudo cargar ${definition.name}.`, error);
        state.dataSources[definition.key] = null;
      }
    }));
  }

  function createUrbanBoundaryDataSource() {
    const ds = new Cesium.CustomDataSource('Casco urbano (aprox.)');
    const positions = [];
    const lon = DATA.focus.urban.lon;
    const lat = DATA.focus.urban.lat;
    const radiusLon = 0.012;
    const radiusLat = 0.009;
    for (let i = 0; i <= 64; i += 1) {
      const angle = (Math.PI * 2 * i) / 64;
      positions.push(Cesium.Cartesian3.fromDegrees(
        lon + Math.cos(angle) * radiusLon,
        lat + Math.sin(angle) * radiusLat,
        0
      ));
    }
    ds.entities.add({
      name: 'Casco urbano (aproximado)',
      description: '<p>Referencia visual aproximada. No sustituye un límite urbano oficial.</p>',
      polygon: {
        hierarchy: positions,
        material: Cesium.Color.fromCssColorString('#24c2eb').withAlpha(0.08),
        outline: false,
        classificationType: Cesium.ClassificationType.TERRAIN
      }
    });
    ds.entities.add({
      name: 'Contorno del casco urbano (aproximado)',
      polyline: {
        positions,
        width: 2,
        material: Cesium.Color.fromCssColorString('#24c2eb'),
        clampToGround: true
      }
    });
    state.dataSources.urbanBoundary = ds;
    return ds;
  }

  function createPlaces(viewer) {
    const ds = new Cesium.CustomDataSource('Lugares importantes');
    DATA.places.forEach((place) => {
      state.placesById[place.id] = place;
      ds.entities.add({
        id: place.id,
        name: place.name,
        position: Cesium.Cartesian3.fromDegrees(place.lon, place.lat, 0),
        billboard: {
          image: createMarkerSvg(place.type.includes('urbano') ? '#24c2eb' : '#63e2c3'),
          width: 28,
          height: 28,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: place.name,
          font: '14px Century Gothic, Arial, sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.fromCssColorString('#071c35'),
          outlineWidth: 4,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, -34),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#071c35').withAlpha(0.55)
        },
        description: buildPlaceDescription(place)
      });
    });
    viewer.dataSources.add(ds);
    state.dataSources.places = ds;
  }

  function buildPlaceDescription(place) {
    return `
      <div style="font-family:Century Gothic,Arial,sans-serif;max-width:320px;">
        <div style="padding:12px;border-radius:12px;background:#eef4f8;color:#345;margin-bottom:12px;">Sin fotografía local verificada en el paquete actual.</div>
        <h3 style="margin:0 0 8px;">${place.name}</h3>
        <p style="margin:0 0 8px;"><strong>Tipo:</strong> ${place.type}</p>
        <p style="margin:0 0 8px;"><strong>Coordenadas:</strong> ${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}</p>
        <p style="margin:0 0 8px;">${place.description}</p>
        <p style="margin:0;color:#567;"><strong>Precisión:</strong> ${place.exactness}</p>
      </div>`;
  }

  function createMarkerSvg(color) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,.35)"/></filter></defs>
        <g filter="url(#s)"><path d="M32 4c-10.5 0-19 8.5-19 19 0 13.5 16 31.6 18.6 34.5.2.2.5.4.8.4s.6-.1.8-.4C35 54.6 51 36.5 51 23 51 12.5 42.5 4 32 4z" fill="${color}"/><circle cx="32" cy="23" r="8.5" fill="white"/></g>
      </svg>`);
  }

  function createRouteDataSource(viewer) {
    const ds = new Cesium.CustomDataSource('Ruta cinematográfica');
    const points = [
      [DATA.focus.valley.lon, DATA.focus.valley.lat, DATA.focus.valley.height],
      [DATA.focus.municipal.lon, DATA.focus.municipal.lat, 18000],
      [-76.16, 4.02, 11000],
      [DATA.focus.rural.lon, DATA.focus.rural.lat, 5500],
      [-76.205, 3.992, 3200],
      [DATA.focus.plaza.lon, DATA.focus.plaza.lat, 1200]
    ];
    ds.entities.add({
      name: 'Ruta cinematográfica',
      polyline: {
        positions: points.map((point) => Cesium.Cartesian3.fromDegrees(point[0], point[1], point[2])),
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.22,
          color: Cesium.Color.fromCssColorString('#f25f5c')
        }),
        clampToGround: false
      }
    });
    viewer.dataSources.add(ds);
    ds.show = false;
    state.dataSources.route = ds;
  }

  async function enableBuildingsIfPossible(viewer, enabled) {
    if (!enabled) return;
    if (!CONFIG.cesiumIonToken || !CONFIG.enableOsmBuildings) {
      showToast('Edificaciones 3D: agrega un token válido y habilita enableOsmBuildings en config/tokens.js.');
      document.querySelector('[data-layer="buildings"]').checked = false;
      return;
    }
    try {
      if (!state.layers.buildings) {
        state.layers.buildings = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(state.layers.buildings);
      }
      state.layers.buildings.show = true;
      state.buildingsReady = true;
    } catch (error) {
      console.warn('No se pudieron cargar los edificios 3D:', error);
      showToast('No se pudieron cargar las edificaciones 3D. Revisa el token.');
      document.querySelector('[data-layer="buildings"]').checked = false;
    }
  }

  function setAtmosphereEnabled(enabled) {
    const scene = state.viewer.scene;
    scene.skyAtmosphere.show = enabled;
    scene.skyBox.show = enabled;
    scene.fog.enabled = enabled;
    scene.globe.enableLighting = enabled;
  }

  function applyLayerToggle(layerName, checked) {
    switch (layerName) {
      case 'satellite':
        state.layers.satellite.show = checked;
        break;
      case 'terrain':
        state.viewer.scene.globe.show = checked;
        break;
      case 'municipalBoundary':
        if (state.dataSources.municipalBoundary) state.dataSources.municipalBoundary.show = checked;
        break;
      case 'urbanBoundary':
        if (state.dataSources.urbanBoundary) state.dataSources.urbanBoundary.show = checked;
        break;
      case 'roads':
        if (state.dataSources.roads) {
          state.dataSources.roads.show = checked;
        } else {
          showToast('La capa vial oficial no respondió.');
          document.querySelector('[data-layer="roads"]').checked = false;
        }
        break;
      case 'streets':
        state.layers.streets.show = checked;
        break;
      case 'buildings':
        if (checked) enableBuildingsIfPossible(state.viewer, true);
        else if (state.layers.buildings) state.layers.buildings.show = false;
        break;
      case 'places':
        if (state.dataSources.places) state.dataSources.places.show = checked;
        break;
      case 'labels':
        state.layers.labels.show = checked;
        break;
      case 'route':
        if (state.dataSources.route) state.dataSources.route.show = checked;
        break;
      case 'territorialInfo':
        if (state.dataSources.naturalBase) state.dataSources.naturalBase.show = checked;
        if (state.dataSources.conservation) state.dataSources.conservation.show = checked;
        if (!state.dataSources.naturalBase && !state.dataSources.conservation) {
          showToast('Las capas territoriales oficiales no respondieron.');
          document.querySelector('[data-layer="territorialInfo"]').checked = false;
        }
        break;
      case 'atmosphere':
        setAtmosphereEnabled(checked);
        break;
      default:
        break;
    }
  }

  function buildPlacesUI() {
    els.placesList.innerHTML = '';
    DATA.places.forEach((place) => {
      const div = document.createElement('div');
      div.className = 'place-card';
      div.innerHTML = `<h4>${place.name}</h4><p>${place.description}</p><div class="actions"><button class="ui-btn small primary" data-fly-place="${place.id}">Volar al lugar</button></div>`;
      els.placesList.appendChild(div);
    });
  }

  function flyToLocation(lon, lat, height, heading = 0, pitch = -45, duration = 2.8) {
    state.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      orientation: {
        heading: Cesium.Math.toRadians(heading),
        pitch: Cesium.Math.toRadians(pitch),
        roll: 0
      },
      duration
    });
  }

  function flyToPreset(name) {
    const point = DATA.focus[name];
    if (!point) return;
    let pitch = -55;
    let heading = 0;
    if (name === 'urban') { pitch = -56; heading = 18; }
    if (name === 'rural') { pitch = -42; heading = 35; }
    if (name === 'valley') { pitch = -48; heading = 18; }
    if (name === 'plaza') { pitch = -35; heading = 28; }
    flyToLocation(point.lon, point.lat, point.height, heading, pitch, 3.0);
  }

  function flyToPlace(placeId) {
    const place = state.placesById[placeId];
    if (!place) return;
    flyToLocation(place.lon, place.lat, place.id === 'parque-principal' ? 1200 : 2200, 22, -42, 2.8);
  }

  async function runTour() {
    state.tourCancel = false;
    if (state.dataSources.route) state.dataSources.route.show = true;
    const routeCheckbox = document.querySelector('[data-layer="route"]');
    if (routeCheckbox) routeCheckbox.checked = true;
    const steps = [
      { name: 'valley', wait: 3800 },
      { name: 'municipal', wait: 4200 },
      { name: 'rural', wait: 4200 },
      { name: 'urban', wait: 4200 },
      { name: 'plaza', wait: 4500 }
    ];
    showToast('Recorrido cinematográfico iniciado.');
    for (const step of steps) {
      if (state.tourCancel) break;
      flyToPreset(step.name);
      await sleep(step.wait);
    }
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function updateIndicators() {
    if (!state.viewer) return;
    const camera = state.viewer.camera;
    const cartographic = Cesium.Cartographic.fromCartesian(camera.position);
    els.altitude.textContent = formatMeters(cartographic ? cartographic.height : 0);
    els.heading.textContent = `${Cesium.Math.toDegrees(camera.heading).toFixed(1)}°`;
    els.pitch.textContent = `${Cesium.Math.toDegrees(camera.pitch).toFixed(1)}°`;
    els.status.textContent = state.terrainEnabled ? 'Terreno activo' : 'Respaldo sin relieve';
  }

  function formatMeters(value) {
    if (!Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} km`;
    return `${value.toFixed(0)} m`;
  }

  function handleSearch() {
    const query = (els.placeSearch.value || '').trim().toLowerCase();
    els.searchResults.innerHTML = '';
    if (!query) return;
    const results = DATA.places.filter((place) => (
      place.name.toLowerCase().includes(query) ||
      place.type.toLowerCase().includes(query) ||
      place.description.toLowerCase().includes(query)
    ));
    if (!results.length) {
      els.searchResults.innerHTML = '<div class="search-item"><p>No se encontraron coincidencias en el paquete local.</p></div>';
      return;
    }
    results.forEach((place) => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = `<p><strong>${place.name}</strong></p><p>${place.type}</p><div class="actions" style="margin-top:8px"><button class="ui-btn small primary" data-fly-place="${place.id}">Volar al lugar</button></div>`;
      els.searchResults.appendChild(div);
    });
  }

  function wireUI() {
    els.toggleSidebarBtn.addEventListener('click', () => toggleSidebar(true));
    els.closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    els.startTourBtn.addEventListener('click', runTour);
    els.exploreBtn.addEventListener('click', () => {
      state.tourCancel = true;
      showToast('Modo de exploración libre activado.');
    });
    els.homeBtn.addEventListener('click', () => flyToPreset('valley'));
    els.centerBtn.addEventListener('click', () => flyToPreset('municipal'));
    els.searchBtn.addEventListener('click', handleSearch);
    els.placeSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') handleSearch();
    });

    document.querySelectorAll('[data-layer]').forEach((input) => {
      input.addEventListener('change', (event) => {
        applyLayerToggle(event.target.dataset.layer, event.target.checked);
      });
    });

    els.placesList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-fly-place]');
      if (button) flyToPlace(button.dataset.flyPlace);
    });

    els.searchResults.addEventListener('click', (event) => {
      const button = event.target.closest('[data-fly-place]');
      if (!button) return;
      flyToPlace(button.dataset.flyPlace);
      els.searchResults.innerHTML = '';
    });

    state.viewer.scene.camera.changed.addEventListener(updateIndicators);
    window.addEventListener('resize', updateIndicators);
  }

  async function initialize() {
    try {
      setProgress(5, 'Preparando dependencias…', 'CesiumJS');
      const terrainProvider = await createTerrainProvider();

      setProgress(28, 'Creando escena 3D…', 'Sin capa Ion predeterminada');
      const viewer = createViewer(terrainProvider);

      setProgress(34, 'Cargando imagen satelital…', 'ArcGIS World Imagery');
      addImageryLayers(viewer);

      setProgress(43, 'Cargando límite municipal…', 'GeoJSON oficial');
      await loadMunicipalBoundary(viewer);

      setProgress(55, 'Cargando capas territoriales…', 'Vías, base natural y conservación');
      await loadOfficialVectorLayers(viewer);

      const urbanDataSource = createUrbanBoundaryDataSource();
      viewer.dataSources.add(urbanDataSource);
      createPlaces(viewer);
      createRouteDataSource(viewer);

      setProgress(72, 'Configurando navegación…', 'Cámara y controles');
      buildPlacesUI();
      wireUI();
      updateIndicators();

      setProgress(88, 'Preparando vista inicial…', 'Vuelo regional');
      flyToPreset('valley');
      viewer.scene.requestRender();

      setProgress(100, 'Visor listo', state.terrainEnabled ? 'Terreno real cargado' : 'Modo de respaldo activo');
      await sleep(450);
      els.loadingScreen.classList.add('hidden');
      els.app.classList.remove('hidden');
      showToast('Versión corregida cargada: sin capa Ion automática y sin constructor ArcGIS incompatible.');
    } catch (error) {
      console.error('Error de inicialización:', error);
      setProgress(100, 'No fue posible inicializar completamente el visor.', 'Revisa la consola y README.');
      els.app.classList.remove('hidden');
      els.loadingScreen.classList.add('hidden');
    }
  }

  initialize();
})();
