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
    officialOverlayVisible: false,
    routeVisible: false,
    streetLayerVisible: false,
    buildingsReady: false,
    terrainEnabled: true
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
        setProgress(22, 'Conectando con Cesium World Terrain…', 'Terreno con token');
        return await Cesium.createWorldTerrainAsync({ requestVertexNormals: true, requestWaterMask: true });
      } catch (err) {
        console.warn('Cesium World Terrain no disponible:', err);
      }
    }

    try {
      setProgress(22, 'Conectando con ArcGIS World Elevation…', 'Terreno global de respaldo');
      return await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
        'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
      );
    } catch (err) {
      console.warn('ArcGIS terrain no disponible, se usará el elipsoide:', err);
      showToast('No fue posible cargar el terreno real. Se activó el modo de respaldo sin relieve.');
      state.terrainEnabled = false;
      return new Cesium.EllipsoidTerrainProvider();
    }
  }

  function createViewer(terrainProvider) {
    const viewer = new Cesium.Viewer('cesiumContainer', {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
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
      requestRenderMode: false
    });

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyBox.show = true;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0007;
    viewer.scene.fog.screenSpaceErrorFactor = 1.5;
    viewer.scene.postProcessStages.fxaa.enabled = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 120;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 120000;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
    viewer.scene.verticalExaggeration = 1.08;

    viewer.imageryLayers.removeAll();
    const satellite = viewer.imageryLayers.addImageryProvider(
      new Cesium.ArcGisMapServerImageryProvider({
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
      })
    );
    satellite.alpha = 1;

    const labels = viewer.imageryLayers.addImageryProvider(
      new Cesium.ArcGisMapServerImageryProvider({
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer'
      })
    );
    labels.alpha = 0.9;

    const streets = viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })
    );
    streets.alpha = 0.86;
    streets.show = false;

    let territorialInfo = null;
    try {
      territorialInfo = viewer.imageryLayers.addImageryProvider(
        new Cesium.ArcGisMapServerImageryProvider({ url: DATA.sources.officialMapService })
      );
      territorialInfo.alpha = 0.78;
      territorialInfo.show = false;
    } catch (err) {
      console.warn('No se pudo crear la capa territorial oficial:', err);
    }

    state.layers.satellite = satellite;
    state.layers.labels = labels;
    state.layers.streets = streets;
    state.layers.territorialInfo = territorialInfo;
    state.viewer = viewer;
    return viewer;
  }

  async function loadMunicipalBoundary(viewer) {
    setProgress(38, 'Cargando límite municipal…', 'Fuente oficial');
    const style = {
      stroke: Cesium.Color.WHITE,
      strokeWidth: 3,
      fill: Cesium.Color.WHITE.withAlpha(0.05),
      clampToGround: true
    };

    try {
      const ds = await Cesium.GeoJsonDataSource.load(DATA.sources.boundaryGeoJson, style);
      ds.name = 'Límite municipal';
      viewer.dataSources.add(ds);
      state.dataSources.municipalBoundary = ds;
      emphasizeBoundary(ds.entities.values, false);
    } catch (err) {
      console.warn('No se pudo cargar el límite oficial; se usará respaldo local.', err);
      const ds = await Cesium.GeoJsonDataSource.load('data/fallback-boundary.geojson', style);
      ds.name = 'Límite municipal (respaldo)';
      viewer.dataSources.add(ds);
      state.dataSources.municipalBoundary = ds;
      emphasizeBoundary(ds.entities.values, true);
      showToast('Se cargó el límite municipal de respaldo. La fuente oficial no respondió.');
    }
  }

  function emphasizeBoundary(entities, approximate) {
    entities.forEach((entity) => {
      if (entity.polygon) {
        entity.polygon.outline = true;
        entity.polygon.outlineColor = Cesium.Color.WHITE;
        entity.polygon.fill = true;
        entity.polygon.material = Cesium.Color.WHITE.withAlpha(approximate ? 0.03 : 0.045);
        entity.polygon.classificationType = Cesium.ClassificationType.TERRAIN;
      }
      if (entity.polyline) {
        entity.polyline.width = 3;
        entity.polyline.material = Cesium.Color.WHITE;
        entity.polyline.clampToGround = true;
      }
    });
  }

  function createUrbanBoundaryDataSource() {
    const center = Cesium.Cartesian3.fromDegrees(DATA.focus.urban.lon, DATA.focus.urban.lat);
    const ds = new Cesium.CustomDataSource('Casco urbano (aprox.)');
    const positions = [];
    const lon = DATA.focus.urban.lon;
    const lat = DATA.focus.urban.lat;
    const radiusLon = 0.012;
    const radiusLat = 0.009;
    for (let i = 0; i <= 64; i += 1) {
      const a = (Math.PI * 2 * i) / 64;
      positions.push(Cesium.Cartesian3.fromDegrees(
        lon + Math.cos(a) * radiusLon,
        lat + Math.sin(a) * radiusLat,
        0
      ));
    }
    ds.entities.add({
      name: 'Casco urbano (aproximado)',
      description: '<p>Representación de referencia del casco urbano generada a partir del punto central disponible en el paquete. No sustituye un límite urbano oficial.</p>',
      polygon: {
        hierarchy: positions,
        material: Cesium.Color.fromCssColorString('#24c2eb').withAlpha(0.08),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#24c2eb'),
        classificationType: Cesium.ClassificationType.TERRAIN,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
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
        position: Cesium.Cartesian3.fromDegrees(place.lon, place.lat, 20),
        billboard: {
          image: createMarkerSvg(place.type.includes('urbano') ? '#24c2eb' : '#63e2c3'),
          width: 28,
          height: 28,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
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
    const photoHtml = place.photo ? `<img src="${place.photo}" alt="${place.name}" style="width:100%;border-radius:12px;margin-bottom:12px;" />` : '<div style="padding:12px;border-radius:12px;background:#eef4f8;color:#345;">Sin fotografía local en el paquete actual.</div>';
    return `
      <div style="font-family:Century Gothic, Arial, sans-serif; max-width:320px;">
        ${photoHtml}
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
        <g filter="url(#s)">
          <path d="M32 4c-10.5 0-19 8.5-19 19 0 13.5 16 31.6 18.6 34.5.2.2.5.4.8.4s.6-.1.8-.4C35 54.6 51 36.5 51 23 51 12.5 42.5 4 32 4z" fill="${color}"/>
          <circle cx="32" cy="23" r="8.5" fill="white"/>
        </g>
      </svg>`);
  }

  function createRouteDataSource(viewer) {
    const ds = new Cesium.CustomDataSource('Ruta cinematográfica');
    const pts = [
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
        positions: pts.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2])),
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.22, color: Cesium.Color.fromCssColorString('#f25f5c') }),
        clampToGround: false
      }
    });
    viewer.dataSources.add(ds);
    ds.show = false;
    state.dataSources.route = ds;
  }

  async function enableBuildingsIfPossible(viewer, enabled) {
    if (!enabled) return;
    if (!CONFIG.cesiumIonToken && !CONFIG.enableOsmBuildings) {
      showToast('Las edificaciones 3D requieren token de Cesium Ion o habilitación explícita en config/tokens.js.');
      return;
    }
    try {
      if (!state.layers.buildings) {
        state.layers.buildings = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(state.layers.buildings);
      }
      state.layers.buildings.show = true;
      state.buildingsReady = true;
    } catch (err) {
      console.warn('No se pudieron cargar los edificios 3D:', err);
      showToast('No se pudieron cargar las edificaciones 3D en esta sesión.');
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
        if (state.layers.territorialInfo) {
          state.layers.territorialInfo.show = checked;
          state.officialOverlayVisible = checked;
        } else {
          showToast('La capa vial oficial no está disponible en esta sesión.');
        }
        break;
      case 'streets':
        state.layers.streets.show = checked;
        state.streetLayerVisible = checked;
        break;
      case 'buildings':
        if (checked) {
          enableBuildingsIfPossible(state.viewer, true);
        } else if (state.layers.buildings) {
          state.layers.buildings.show = false;
        }
        break;
      case 'places':
        if (state.dataSources.places) state.dataSources.places.show = checked;
        break;
      case 'labels':
        state.layers.labels.show = checked;
        break;
      case 'route':
        if (state.dataSources.route) state.dataSources.route.show = checked;
        state.routeVisible = checked;
        break;
      case 'territorialInfo':
        if (state.layers.territorialInfo) state.layers.territorialInfo.show = checked;
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
      div.innerHTML = `
        <h4>${place.name}</h4>
        <p>${place.description}</p>
        <div class="actions">
          <button class="ui-btn small primary" data-fly-place="${place.id}">Volar al lugar</button>
        </div>`;
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
    const p = DATA.focus[name];
    if (!p) return;
    let pitch = -55;
    let heading = 0;
    if (name === 'urban') { pitch = -56; heading = 18; }
    if (name === 'rural') { pitch = -42; heading = 35; }
    if (name === 'valley') { pitch = -48; heading = 18; }
    if (name === 'plaza') { pitch = -35; heading = 28; }
    flyToLocation(p.lon, p.lat, p.height, heading, pitch, 3.0);
  }

  function flyToPlace(placeId) {
    const place = state.placesById[placeId];
    if (!place) return;
    flyToLocation(place.lon, place.lat, place.id === 'parque-principal' ? 1200 : 2200, 22, -42, 2.8);
  }

  async function runTour() {
    state.tourCancel = false;
    if (state.dataSources.route) state.dataSources.route.show = true;
    document.querySelector('[data-layer="route"]').checked = true;
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

  function cancelTour() {
    state.tourCancel = true;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function updateIndicators() {
    if (!state.viewer) return;
    const camera = state.viewer.camera;
    const carto = Cesium.Cartographic.fromCartesian(camera.position);
    const altitude = carto ? carto.height : 0;
    els.altitude.textContent = formatMeters(altitude);
    els.heading.textContent = `${Cesium.Math.toDegrees(camera.heading).toFixed(1)}°`;
    els.pitch.textContent = `${Cesium.Math.toDegrees(camera.pitch).toFixed(1)}°`;
    els.status.textContent = state.terrainEnabled ? 'Terreno activo' : 'Respaldo sin relieve';
  }

  function formatMeters(value) {
    if (!Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} km`;
    return `${value.toFixed(0)} m`;
  }

  function wireUI() {
    els.toggleSidebarBtn.addEventListener('click', () => toggleSidebar(true));
    els.closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    els.startTourBtn.addEventListener('click', runTour);
    els.exploreBtn.addEventListener('click', () => {
      cancelTour();
      showToast('Modo de exploración libre activado.');
    });
    els.homeBtn.addEventListener('click', () => flyToPreset('valley'));
    els.centerBtn.addEventListener('click', () => flyToPreset('municipal'));
    els.searchBtn.addEventListener('click', handleSearch);
    els.placeSearch.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') handleSearch();
    });

    document.querySelectorAll('[data-layer]').forEach((input) => {
      input.addEventListener('change', (ev) => {
        applyLayerToggle(ev.target.dataset.layer, ev.target.checked);
      });
    });

    els.placesList.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-fly-place]');
      if (!btn) return;
      flyToPlace(btn.dataset.flyPlace);
    });

    els.searchResults.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-fly-place]');
      if (!btn) return;
      flyToPlace(btn.dataset.flyPlace);
      els.searchResults.innerHTML = '';
    });

    state.viewer.scene.camera.changed.addEventListener(updateIndicators);
    window.addEventListener('resize', updateIndicators);
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

  async function initialize() {
    try {
      setProgress(6, 'Preparando dependencias…', 'CesiumJS');
      const terrainProvider = await createTerrainProvider();

      setProgress(28, 'Creando escena 3D…', 'Visor principal');
      const viewer = createViewer(terrainProvider);

      setProgress(36, 'Cargando capas territoriales…', 'GeoJSON y entidades');
      await loadMunicipalBoundary(viewer);
      const urbanDs = createUrbanBoundaryDataSource();
      viewer.dataSources.add(urbanDs);
      createPlaces(viewer);
      createRouteDataSource(viewer);

      setProgress(58, 'Aplicando entorno visual…', 'Atmósfera, sombras y cámara');
      buildPlacesUI();
      wireUI();
      updateIndicators();

      setProgress(74, 'Configurando navegación inicial…', 'Vuelo de apertura');
      flyToPreset('valley');

      setProgress(88, 'Optimizando experiencia…', 'Controles y eventos');
      viewer.scene.requestRender();

      setProgress(100, 'Visor listo', state.terrainEnabled ? 'Terreno real cargado' : 'Modo de respaldo activo');
      await sleep(450);
      els.loadingScreen.classList.add('hidden');
      els.app.classList.remove('hidden');
      showToast('Proyecto cargado. Puedes iniciar el recorrido o explorar libremente.');
    } catch (err) {
      console.error(err);
      setProgress(100, 'No fue posible inicializar completamente el visor.', 'Revisa la consola y las fuentes remotas.');
      showToast('Ocurrió un error al iniciar el proyecto. Revisa README y consola.', 7000);
      els.app.classList.remove('hidden');
      els.loadingScreen.classList.add('hidden');
    }
  }

  initialize();
})();
