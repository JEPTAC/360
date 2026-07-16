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
    localitiesById: {},
    worksById: {},
    terrainEnabled: true,
    routeVisible: false,
    streetMode: false,
    currentMode: 'San Pedro',
    tourCancel: false
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
    urbanBtn: document.getElementById('urbanBtn'),
    streetsBtn: document.getElementById('streetsBtn'),
    worksBtn: document.getElementById('worksBtn'),
    exploreBtn: document.getElementById('exploreBtn'),
    homeBtn: document.getElementById('homeBtn'),
    centerBtn: document.getElementById('centerBtn'),
    placeSearch: document.getElementById('placeSearch'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
    placesList: document.getElementById('placesList'),
    localitiesList: document.getElementById('localitiesList'),
    worksList: document.getElementById('worksList'),
    altitude: document.getElementById('altitudeIndicator'),
    heading: document.getElementById('headingIndicator'),
    pitch: document.getElementById('pitchIndicator'),
    status: document.getElementById('statusIndicator'),
    hudView: document.getElementById('hudView'),
    hudLayers: document.getElementById('hudLayers'),
    toast: document.getElementById('toast')
  };

  function setProgress(percent, message, detail) {
    const p = Math.max(0, Math.min(100, percent));
    els.loadingBar.style.width = `${p}%`;
    els.loadingPercent.textContent = `${Math.round(p)}%`;
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
        return await Cesium.createWorldTerrainAsync({ requestVertexNormals: true, requestWaterMask: true });
      } catch (error) {
        console.warn('Cesium World Terrain no disponible:', error);
      }
    }
    try {
      return await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
        'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
      );
    } catch (error) {
      console.warn('ArcGIS World Elevation no disponible; se usará elipsoide.', error);
      state.terrainEnabled = false;
      return new Cesium.EllipsoidTerrainProvider();
    }
  }

  function createViewer(terrainProvider) {
    const viewer = new Cesium.Viewer('cesiumContainer', {
      animation: false, timeline: false, baseLayerPicker: false, baseLayer: false,
      geocoder: false, homeButton: false, navigationHelpButton: false,
      sceneModePicker: false, fullscreenButton: false, selectionIndicator: true, infoBox: true,
      shadows: true, terrainProvider, shouldAnimate: true, requestRenderMode: false, showRenderLoopErrors: false
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
    scene.screenSpaceCameraController.maximumZoomDistance = 50000;
    scene.screenSpaceCameraController.enableCollisionDetection = true;
    scene.verticalExaggeration = 1.08;
    state.viewer = viewer;
    return viewer;
  }

  function makeUrlTemplateProvider(url, credit) {
    return new Cesium.UrlTemplateImageryProvider({ url, minimumLevel: 0, maximumLevel: 19, credit });
  }

  function addImageryLayers(viewer) {
    state.layers.satellite = viewer.imageryLayers.addImageryProvider(makeUrlTemplateProvider(DATA.sources.satelliteTiles, 'Esri, Maxar'));
    state.layers.labels = viewer.imageryLayers.addImageryProvider(makeUrlTemplateProvider(DATA.sources.labelsTiles, 'Esri'));
    state.layers.labels.alpha = 0.88;
    state.layers.streets = viewer.imageryLayers.addImageryProvider(makeUrlTemplateProvider(DATA.sources.streetMapTiles, '© OpenStreetMap contributors'));
    state.layers.streets.alpha = 0.88;
    state.layers.streets.show = false;
    updateHudLayers();
  }

  async function loadGeoJson(url, fallbackPath, options, name) {
    try {
      const ds = await Cesium.GeoJsonDataSource.load(url, options);
      ds.name = name;
      return ds;
    } catch (error) {
      console.warn(`${name} no respondió`, error);
      if (!fallbackPath) return null;
      const ds = await Cesium.GeoJsonDataSource.load(fallbackPath, options);
      ds.name = `${name} (respaldo)`;
      return ds;
    }
  }

  function addGroundOutline(dataSource, color, width) {
    const now = Cesium.JulianDate.now();
    const additions = [];
    dataSource.entities.values.forEach((entity) => {
      if (!entity.polygon) return;
      entity.polygon.outline = false;
      entity.polygon.material = color.withAlpha(0.05);
      entity.polygon.classificationType = Cesium.ClassificationType.TERRAIN;
      const hierarchy = entity.polygon.hierarchy && entity.polygon.hierarchy.getValue(now);
      if (hierarchy && hierarchy.positions) {
        const positions = hierarchy.positions.slice();
        positions.push(hierarchy.positions[0]);
        additions.push({ polyline: { positions, width, material: color, clampToGround: true } });
      }
    });
    additions.forEach((a) => dataSource.entities.add(a));
  }

  async function loadMunicipalBoundary(viewer) {
    const ds = await loadGeoJson(DATA.sources.boundaryGeoJson, 'data/fallback-boundary.geojson', {
      fill: Cesium.Color.WHITE.withAlpha(0.05), stroke: Cesium.Color.WHITE, strokeWidth: 2, clampToGround: true
    }, 'Límite municipal');
    if (!ds) return;
    addGroundOutline(ds, Cesium.Color.WHITE, 3);
    viewer.dataSources.add(ds);
    state.dataSources.municipalBoundary = ds;
  }

  async function loadOfficialVectorLayers(viewer) {
    const defs = [
      { key: 'roads', name: 'Red vial', url: DATA.sources.roadsGeoJson, options: { stroke: Cesium.Color.fromCssColorString('#ff8f47'), strokeWidth: 3, clampToGround: true } },
      { key: 'naturalBase', name: 'Base natural', url: DATA.sources.naturalBaseGeoJson, options: { stroke: Cesium.Color.fromCssColorString('#3cb496'), strokeWidth: 2, fill: Cesium.Color.fromCssColorString('#3cb496').withAlpha(0.06), clampToGround: true } },
      { key: 'conservation', name: 'Conservación', url: DATA.sources.conservationGeoJson, options: { stroke: Cesium.Color.fromCssColorString('#8bc45b'), strokeWidth: 1.5, fill: Cesium.Color.fromCssColorString('#8bc45b').withAlpha(0.08), clampToGround: true } }
    ];
    await Promise.all(defs.map(async (d) => {
      try {
        const ds = await Cesium.GeoJsonDataSource.load(d.url, d.options);
        ds.name = d.name;
        viewer.dataSources.add(ds);
        state.dataSources[d.key] = ds;
        if (d.key !== 'roads') {
          addGroundOutline(ds, d.options.stroke, d.options.strokeWidth);
          ds.show = false;
        }
      } catch (error) {
        console.warn(`No se pudo cargar ${d.name}`, error);
        state.dataSources[d.key] = null;
      }
    }));
  }

  function createUrbanBoundaryDataSource() {
    const ds = new Cesium.CustomDataSource('Casco urbano');
    const positions = [];
    const lon = DATA.focus.urban.lon, lat = DATA.focus.urban.lat, radiusLon = 0.012, radiusLat = 0.009;
    for (let i = 0; i <= 64; i += 1) {
      const a = (Math.PI * 2 * i) / 64;
      positions.push(Cesium.Cartesian3.fromDegrees(lon + Math.cos(a) * radiusLon, lat + Math.sin(a) * radiusLat, 0));
    }
    ds.entities.add({ polygon: { hierarchy: positions, material: Cesium.Color.fromCssColorString('#24c2eb').withAlpha(0.08), outline: false, classificationType: Cesium.ClassificationType.TERRAIN } });
    ds.entities.add({ polyline: { positions, width: 2, material: Cesium.Color.fromCssColorString('#24c2eb'), clampToGround: true } });
    state.dataSources.urbanBoundary = ds;
    return ds;
  }

  function makeMarker(color) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,.35)"/></filter></defs><g filter="url(#s)"><path d="M32 4c-10.5 0-19 8.5-19 19 0 13.5 16 31.6 18.6 34.5.2.2.5.4.8.4s.6-.1.8-.4C35 54.6 51 36.5 51 23 51 12.5 42.5 4 32 4z" fill="${color}"/><circle cx="32" cy="23" r="8.5" fill="white"/></g></svg>`);
  }

  function buildEntityDescription(item, group, extra) {
    return `<div style="font-family:Century Gothic,Arial,sans-serif;max-width:330px;"><h3 style="margin:0 0 8px;">${item.name}</h3><p style="margin:0 0 8px;"><strong>Categoría:</strong> ${group}</p><p style="margin:0 0 8px;">${item.description}</p><p style="margin:0;color:#567;">${extra || ''}</p></div>`;
  }

  function createPlaces(viewer) {
    const ds = new Cesium.CustomDataSource('Lugares');
    DATA.places.forEach((place) => {
      state.placesById[place.id] = place;
      ds.entities.add({
        id: place.id, name: place.name, position: Cesium.Cartesian3.fromDegrees(place.lon, place.lat, 0),
        billboard: { image: makeMarker('#24c2eb'), width: 28, height: 28, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: { text: place.name, font: '14px Century Gothic, Arial, sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE, fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.fromCssColorString('#071c35'), outlineWidth: 4, verticalOrigin: Cesium.VerticalOrigin.TOP, pixelOffset: new Cesium.Cartesian2(0, -34), disableDepthTestDistance: Number.POSITIVE_INFINITY, showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#071c35').withAlpha(0.55) },
        description: buildEntityDescription(place, place.type, `Precisión: ${place.exactness}`)
      });
    });
    viewer.dataSources.add(ds); state.dataSources.places = ds;
  }

  function createLocalities(viewer) {
    const ds = new Cesium.CustomDataSource('Localidades');
    DATA.localities.forEach((item) => {
      state.localitiesById[item.id] = item;
      ds.entities.add({
        id: item.id, name: item.name, position: Cesium.Cartesian3.fromDegrees(item.lon, item.lat, 0),
        billboard: { image: makeMarker('#63e2c3'), width: 26, height: 26, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        description: buildEntityDescription(item, item.kind, 'Sector listo para navegación y revisión visual.')
      });
    });
    viewer.dataSources.add(ds); state.dataSources.localities = ds;
  }

  function createWorks(viewer) {
    const ds = new Cesium.CustomDataSource('Obras');
    DATA.works.forEach((item) => {
      state.worksById[item.id] = item;
      ds.entities.add({
        id: item.id, name: item.name, position: Cesium.Cartesian3.fromDegrees(item.lon, item.lat, 0),
        billboard: { image: makeMarker('#9ae66e'), width: 26, height: 26, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        description: buildEntityDescription(item, 'Obra / seguimiento', `Estado: ${item.status} · Localidad: ${item.locality}`)
      });
    });
    viewer.dataSources.add(ds); state.dataSources.works = ds;
  }

  function createRouteDataSource(viewer) {
    const ds = new Cesium.CustomDataSource('Ruta guiada');
    const points = [
      [DATA.focus.municipal.lon, DATA.focus.municipal.lat, 13000],
      [DATA.focus.mountain.lon, DATA.focus.mountain.lat, 6200],
      [DATA.focus.roadAccess.lon, DATA.focus.roadAccess.lat, 2400],
      [DATA.focus.urban.lon, DATA.focus.urban.lat, 1700],
      [DATA.focus.plaza.lon, DATA.focus.plaza.lat, 1050]
    ];
    ds.entities.add({ polyline: { positions: points.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2])), width: 4, material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.22, color: Cesium.Color.fromCssColorString('#f25f5c') }) } });
    viewer.dataSources.add(ds); ds.show = false; state.dataSources.route = ds;
  }

  async function enableBuildingsIfPossible(enabled) {
    if (!enabled) return;
    if (!CONFIG.cesiumIonToken || !CONFIG.enableOsmBuildings) {
      showToast('Para edificaciones 3D activa Cesium Ion en config/tokens.js.');
      document.querySelector('[data-layer="buildings"]').checked = false;
      return;
    }
    try {
      if (!state.layers.buildings) {
        state.layers.buildings = await Cesium.createOsmBuildingsAsync();
        state.viewer.scene.primitives.add(state.layers.buildings);
      }
      state.layers.buildings.show = true;
    } catch (error) {
      console.warn('No se pudieron cargar las edificaciones 3D', error);
      showToast('No se pudieron cargar las edificaciones 3D.');
    }
  }

  function setAtmosphere(enabled) {
    const scene = state.viewer.scene;
    scene.skyAtmosphere.show = enabled; scene.skyBox.show = enabled; scene.fog.enabled = enabled; scene.globe.enableLighting = enabled;
  }

  function updateHudLayers() {
    const active = [];
    if (state.layers.streets && state.layers.streets.show) active.push('Calles');
    if (state.dataSources.roads && state.dataSources.roads.show) active.push('Vías');
    if (state.dataSources.works && state.dataSources.works.show) active.push('Obras');
    if (state.dataSources.places && state.dataSources.places.show) active.push('Lugares');
    els.hudLayers.textContent = active.length ? active.join(' · ') : 'Base';
  }

  function applyLayerToggle(layerName, checked) {
    switch (layerName) {
      case 'satellite': state.layers.satellite.show = checked; break;
      case 'terrain': state.viewer.scene.globe.show = checked; break;
      case 'municipalBoundary': if (state.dataSources.municipalBoundary) state.dataSources.municipalBoundary.show = checked; break;
      case 'urbanBoundary': if (state.dataSources.urbanBoundary) state.dataSources.urbanBoundary.show = checked; break;
      case 'roads': if (state.dataSources.roads) state.dataSources.roads.show = checked; break;
      case 'streets': state.layers.streets.show = checked; state.streetMode = checked; break;
      case 'buildings': if (checked) enableBuildingsIfPossible(true); else if (state.layers.buildings) state.layers.buildings.show = false; break;
      case 'places': if (state.dataSources.places) state.dataSources.places.show = checked; if (state.dataSources.localities) state.dataSources.localities.show = checked; break;
      case 'works': if (state.dataSources.works) state.dataSources.works.show = checked; break;
      case 'route': if (state.dataSources.route) state.dataSources.route.show = checked; state.routeVisible = checked; break;
      case 'territorialInfo': if (state.dataSources.naturalBase) state.dataSources.naturalBase.show = checked; if (state.dataSources.conservation) state.dataSources.conservation.show = checked; break;
      case 'atmosphere': setAtmosphere(checked); break;
      default: break;
    }
    updateHudLayers();
  }

  function makeCard(item, type, extraButtons) {
    const badgeClass = type === 'Obra' ? 'green' : type === 'Localidad' ? 'orange' : 'cyan';
    return `<div class="info-card"><div class="badge-row"><span class="badge ${badgeClass}">${type}</span></div><h4>${item.name}</h4><p>${item.description}</p><div class="actions">${extraButtons}</div></div>`;
  }

  function buildUILists() {
    els.placesList.innerHTML = DATA.places.map((place) => makeCard(place, 'Lugar', `<button class="ui-btn small primary" data-fly-kind="place" data-fly-id="${place.id}">Ver lugar</button><button class="ui-btn small" data-street-place="${place.id}">Ver calles</button>`)).join('');
    els.localitiesList.innerHTML = DATA.localities.map((loc) => makeCard(loc, 'Localidad', `<button class="ui-btn small primary" data-fly-kind="locality" data-fly-id="${loc.id}">Ir al sector</button>`)).join('');
    els.worksList.innerHTML = DATA.works.map((work) => makeCard(work, 'Obra', `<button class="ui-btn small primary" data-fly-kind="work" data-fly-id="${work.id}">Ubicar</button><button class="ui-btn small" data-street-work="${work.id}">Revisar calles</button>`)).join('');
  }

  function flyToLocation(lon, lat, height, heading, pitch, duration) {
    state.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      orientation: { heading: Cesium.Math.toRadians(heading), pitch: Cesium.Math.toRadians(pitch), roll: 0 },
      duration
    });
  }

  function setCurrentMode(label) {
    state.currentMode = label;
    els.hudView.textContent = label;
    els.status.textContent = label;
  }

  function flyToPreset(name) {
    const point = DATA.focus[name]; if (!point) return;
    let heading = 18, pitch = -50;
    if (name === 'urban') { heading = 20; pitch = -55; }
    if (name === 'plaza') { heading = 26; pitch = -38; }
    if (name === 'streets') { heading = 14; pitch = -62; }
    if (name === 'mountain') { heading = 42; pitch = -42; }
    if (name === 'roadAccess') { heading = 28; pitch = -48; }
    flyToLocation(point.lon, point.lat, point.height, heading, pitch, 3.0);
  }

  function flyToItem(kind, id, streetMode) {
    const sourceMap = kind === 'place' ? state.placesById : kind === 'locality' ? state.localitiesById : state.worksById;
    const item = sourceMap[id]; if (!item) return;
    if (streetMode) activateStreetMode(item.lon, item.lat, item.name);
    else {
      flyToLocation(item.lon, item.lat, kind === 'work' ? 1400 : 1800, 22, -50, 2.8);
      setCurrentMode(item.name);
    }
  }

  function activateStreetMode(lon = DATA.focus.streets.lon, lat = DATA.focus.streets.lat, label = 'Calles de San Pedro') {
    document.querySelector('[data-layer="streets"]').checked = true;
    applyLayerToggle('streets', true);
    flyToLocation(lon, lat, 850, 12, -65, 2.6);
    setCurrentMode(label);
    showToast('Modo calles activado. Se resaltó la vista urbana para revisar el tejido vial.');
  }

  function activateWorksMode() {
    document.querySelector('[data-layer="works"]').checked = true;
    applyLayerToggle('works', true);
    if (state.dataSources.route) {
      state.dataSources.route.show = false;
      const routeInput = document.querySelector('[data-layer="route"]'); if (routeInput) routeInput.checked = false;
    }
    flyToPreset('roadAccess');
    setCurrentMode('Obras y localidades');
    showToast('Se activó la lectura de obras y localidades dentro de San Pedro.');
  }

  async function runTour() {
    state.tourCancel = false;
    const routeInput = document.querySelector('[data-layer="route"]'); if (routeInput) routeInput.checked = true;
    applyLayerToggle('route', true);
    const steps = [
      { name: 'municipal', wait: 3500, label: 'Vista general del municipio' },
      { name: 'mountain', wait: 4200, label: 'Zona rural y relieve' },
      { name: 'roadAccess', wait: 3600, label: 'Conectividad vial' },
      { name: 'urban', wait: 3800, label: 'Casco urbano' },
      { name: 'plaza', wait: 4200, label: 'Parque principal' }
    ];
    for (const step of steps) {
      if (state.tourCancel) break;
      flyToPreset(step.name);
      setCurrentMode(step.label);
      await new Promise((resolve) => setTimeout(resolve, step.wait));
    }
  }

  function updateIndicators() {
    if (!state.viewer) return;
    const camera = state.viewer.camera;
    const c = Cesium.Cartographic.fromCartesian(camera.position);
    const height = c ? c.height : 0;
    els.altitude.textContent = height >= 1000 ? `${(height / 1000).toFixed(2)} km` : `${height.toFixed(0)} m`;
    els.heading.textContent = `${Cesium.Math.toDegrees(camera.heading).toFixed(1)}°`;
    els.pitch.textContent = `${Cesium.Math.toDegrees(camera.pitch).toFixed(1)}°`;
    if (!els.status.textContent || els.status.textContent === 'Inicializando') {
      els.status.textContent = state.terrainEnabled ? 'San Pedro' : 'Respaldo';
    }
  }

  function handleSearch() {
    const query = (els.placeSearch.value || '').trim().toLowerCase();
    els.searchResults.innerHTML = '';
    if (!query) return;
    const all = [
      ...DATA.places.map((item) => ({ ...item, category: 'Lugar', kind: 'place' })),
      ...DATA.localities.map((item) => ({ ...item, category: 'Localidad', kind: 'locality' })),
      ...DATA.works.map((item) => ({ ...item, category: 'Obra', kind: 'work' }))
    ];
    const results = all.filter((item) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query) || item.category.toLowerCase().includes(query));
    if (!results.length) {
      els.searchResults.innerHTML = '<div class="search-item"><p>No se encontraron coincidencias en el paquete local.</p></div>';
      return;
    }
    els.searchResults.innerHTML = results.map((item) => `<div class="search-item"><p><strong>${item.name}</strong></p><p>${item.category}</p><div class="actions" style="margin-top:8px"><button class="ui-btn small primary" data-fly-kind="${item.kind}" data-fly-id="${item.id}">Ver</button></div></div>`).join('');
  }

  function wireUI() {
    els.toggleSidebarBtn.addEventListener('click', () => toggleSidebar(true));
    els.closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    els.startTourBtn.addEventListener('click', runTour);
    els.urbanBtn.addEventListener('click', () => { flyToPreset('urban'); setCurrentMode('Casco urbano'); });
    els.streetsBtn.addEventListener('click', () => activateStreetMode());
    els.worksBtn.addEventListener('click', activateWorksMode);
    els.exploreBtn.addEventListener('click', () => { state.tourCancel = true; setCurrentMode('Exploración libre'); showToast('Exploración libre activada.'); });
    els.homeBtn.addEventListener('click', () => { flyToPreset('municipal'); setCurrentMode('San Pedro'); });
    els.centerBtn.addEventListener('click', () => { flyToPreset('municipal'); setCurrentMode('Centro del municipio'); });
    els.searchBtn.addEventListener('click', handleSearch);
    els.placeSearch.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(); });
    document.querySelectorAll('[data-layer]').forEach((input) => input.addEventListener('change', (e) => applyLayerToggle(e.target.dataset.layer, e.target.checked)));
    [els.placesList, els.localitiesList, els.worksList, els.searchResults].forEach((container) => {
      container.addEventListener('click', (event) => {
        const fly = event.target.closest('[data-fly-kind]');
        const streetPlace = event.target.closest('[data-street-place]');
        const streetWork = event.target.closest('[data-street-work]');
        if (fly) flyToItem(fly.dataset.flyKind, fly.dataset.flyId, false);
        if (streetPlace) flyToItem('place', streetPlace.dataset.streetPlace, true);
        if (streetWork) flyToItem('work', streetWork.dataset.streetWork, true);
      });
    });
    state.viewer.scene.camera.changed.addEventListener(updateIndicators);
    window.addEventListener('resize', updateIndicators);
  }

  async function initialize() {
    try {
      setProgress(8, 'Preparando terreno…', 'San Pedro');
      const terrainProvider = await createTerrainProvider();
      setProgress(22, 'Creando escena 3D…', 'Cesium');
      const viewer = createViewer(terrainProvider);
      setProgress(34, 'Cargando satélite y calles…', 'Capas base');
      addImageryLayers(viewer);
      setProgress(46, 'Cargando límite municipal…', 'San Pedro');
      await loadMunicipalBoundary(viewer);
      setProgress(58, 'Cargando información territorial…', 'Vías y base natural');
      await loadOfficialVectorLayers(viewer);
      const urbanDs = createUrbanBoundaryDataSource();
      viewer.dataSources.add(urbanDs);
      createPlaces(viewer);
      createLocalities(viewer);
      createWorks(viewer);
      createRouteDataSource(viewer);
      setProgress(78, 'Construyendo interfaz…', 'Tarjetas y acciones');
      buildUILists();
      wireUI();
      updateIndicators();
      updateHudLayers();
      setProgress(92, 'Centrando San Pedro…', 'Vista inicial');
      flyToPreset('municipal');
      setCurrentMode('San Pedro');
      setProgress(100, 'Visor listo', state.terrainEnabled ? 'Terreno real activo' : 'Modo de respaldo');
      await new Promise((resolve) => setTimeout(resolve, 450));
      els.loadingScreen.classList.add('hidden');
      els.app.classList.remove('hidden');
      showToast('Visor actualizado: ahora está enfocado en San Pedro, sus lugares, calles y fichas de obras/localidades.');
    } catch (error) {
      console.error(error);
      els.loadingScreen.classList.add('hidden');
      els.app.classList.remove('hidden');
      showToast('No fue posible iniciar completamente el visor. Revisa la consola.', 6500);
    }
  }

  initialize();
})();
