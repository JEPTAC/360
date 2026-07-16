(function () {
  'use strict';

  const DATA = window.SAN_PEDRO_LIGHT_DATA;
  const state = {
    map: null,
    markers: [],
    terrainEnabled: true,
    streetsEnabled: false,
    tourCancelled: false,
    loaded: false
  };

  const els = {
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loadingText'),
    loadingState: document.getElementById('loadingState'),
    progressBar: document.getElementById('progressBar'),
    progressValue: document.getElementById('progressValue'),
    app: document.getElementById('app'),
    panel: document.getElementById('panel'),
    openPanel: document.getElementById('openPanel'),
    closePanel: document.getElementById('closePanel'),
    siteCards: document.getElementById('siteCards'),
    workCards: document.getElementById('workCards'),
    townBtn: document.getElementById('townBtn'),
    tourBtn: document.getElementById('tourBtn'),
    streetsBtn: document.getElementById('streetsBtn'),
    terrainBtn: document.getElementById('terrainBtn'),
    resetBtn: document.getElementById('resetBtn'),
    pitchBtn: document.getElementById('pitchBtn'),
    satelliteToggle: document.getElementById('satelliteToggle'),
    streetsToggle: document.getElementById('streetsToggle'),
    hillshadeToggle: document.getElementById('hillshadeToggle'),
    markersToggle: document.getElementById('markersToggle'),
    viewLabel: document.getElementById('viewLabel'),
    statusText: document.getElementById('statusText'),
    toast: document.getElementById('toast'),
    fallback: document.getElementById('fallback')
  };

  function setProgress(value, text, stateText) {
    const p = Math.max(0, Math.min(100, value));
    els.progressBar.style.width = `${p}%`;
    els.progressValue.textContent = `${Math.round(p)}%`;
    if (text) els.loadingText.textContent = text;
    if (stateText) els.loadingState.textContent = stateText;
  }

  function showToast(message, delay = 3500) {
    els.toast.textContent = message;
    els.toast.classList.remove('hidden');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), delay);
  }

  function setViewLabel(label) {
    els.viewLabel.textContent = label;
  }

  function updateStatus() {
    const active = [];
    if (els.satelliteToggle.checked) active.push('satélite');
    if (state.terrainEnabled) active.push('relieve 3D');
    if (state.streetsEnabled) active.push('calles');
    els.statusText.textContent = active.length ? active.join(' + ') : 'vista básica';
  }

  function showFallback(message) {
    console.error(message);
    els.loading.classList.add('hidden');
    els.app.classList.remove('hidden');
    els.fallback.classList.remove('hidden');
  }

  function createStyle() {
    return {
      version: 8,
      sources: {
        satellite: {
          type: 'raster',
          tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Esri, Maxar, Earthstar Geographics'
        },
        streets: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '© OpenStreetMap contributors'
        },
        terrainSource: {
          type: 'raster-dem',
          url: 'https://tiles.mapterhorn.com/tilejson.json',
          tileSize: 512
        },
        hillshadeSource: {
          type: 'raster-dem',
          url: 'https://tiles.mapterhorn.com/tilejson.json',
          tileSize: 512
        },
        urbanArea: {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: { name: 'Casco urbano de referencia' },
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [-76.2396, 3.9879], [-76.2160, 3.9879], [-76.2130, 3.9972],
                  [-76.2182, 4.0045], [-76.2366, 4.0040], [-76.2420, 3.9970],
                  [-76.2396, 3.9879]
                ]]
              }
            }]
          }
        }
      },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#081827' } },
        { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-opacity': 1, 'raster-fade-duration': 0 } },
        { id: 'hillshade', type: 'hillshade', source: 'hillshadeSource', paint: {
          'hillshade-exaggeration': 0.22,
          'hillshade-shadow-color': '#142213',
          'hillshade-highlight-color': '#f4efe1',
          'hillshade-accent-color': '#506043'
        } },
        { id: 'streets', type: 'raster', source: 'streets', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.72, 'raster-fade-duration': 0 } },
        { id: 'urban-fill', type: 'fill', source: 'urbanArea', paint: { 'fill-color': '#2fc8ef', 'fill-opacity': 0.025 } },
        { id: 'urban-line', type: 'line', source: 'urbanArea', paint: { 'line-color': '#60d9f3', 'line-width': 1.6, 'line-opacity': 0.82 } }
      ],
      terrain: { source: 'terrainSource', exaggeration: 1.08 },
      sky: {
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 10, 0.12, 16, 0]
      }
    };
  }

  function createMarkerElement(type) {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    const pulse = document.createElement('span');
    pulse.className = 'marker-pulse';
    pulse.style.left = '-8px';
    pulse.style.top = '-8px';
    const marker = document.createElement('div');
    marker.className = `marker ${type}`;
    wrapper.appendChild(pulse);
    wrapper.appendChild(marker);
    return wrapper;
  }

  function addMarker(item, type) {
    const element = createMarkerElement(type);
    const popup = new maplibregl.Popup({ offset: 28, closeButton: true }).setHTML(
      `<div class="popup-card"><span class="popup-badge">${item.category}</span><h3>${item.name}</h3><p>${item.description}</p></div>`
    );
    const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
      .setLngLat(item.coordinates)
      .setPopup(popup)
      .addTo(state.map);
    state.markers.push({ marker, element, item, type });
  }

  function flyTo(item, label) {
    state.tourCancelled = true;
    state.map.flyTo({
      center: item.coordinates,
      zoom: item.zoom,
      pitch: item.pitch,
      bearing: item.bearing,
      duration: 2200,
      essential: true
    });
    setViewLabel(label || item.name);
  }

  function renderCards(items, type) {
    return items.map((item) => `
      <article class="site-card">
        <div class="meta"><span class="badge ${type === 'work' ? 'work' : ''}">${item.category}</span></div>
        <h4>${item.name}</h4>
        <p>${item.description}</p>
        <div class="card-actions">
          <button class="primary" data-fly-type="${type}" data-fly-id="${item.id}">Ver en 3D</button>
          <button data-street-type="${type}" data-street-id="${item.id}">Ver calles</button>
        </div>
      </article>`).join('');
  }

  function findItem(type, id) {
    return (type === 'work' ? DATA.works : DATA.sites).find((item) => item.id === id);
  }

  function setStreetMode(enabled) {
    state.streetsEnabled = enabled;
    els.streetsToggle.checked = enabled;
    if (state.map.getLayer('streets')) {
      state.map.setLayoutProperty('streets', 'visibility', enabled ? 'visible' : 'none');
    }
    els.streetsBtn.classList.toggle('active', enabled);
    updateStatus();
  }

  function setTerrainMode(enabled) {
    state.terrainEnabled = enabled;
    if (enabled) {
      state.map.setTerrain({ source: 'terrainSource', exaggeration: 1.08 });
      if (state.map.getLayer('hillshade')) state.map.setLayoutProperty('hillshade', 'visibility', els.hillshadeToggle.checked ? 'visible' : 'none');
    } else {
      state.map.setTerrain(null);
      if (state.map.getLayer('hillshade')) state.map.setLayoutProperty('hillshade', 'visibility', 'none');
    }
    els.terrainBtn.classList.toggle('active', enabled);
    updateStatus();
  }

  function goTown() {
    state.tourCancelled = true;
    state.map.flyTo({ ...DATA.townView, duration: 2200, essential: true });
    setViewLabel('Vista del pueblo');
  }

  function goAerial() {
    state.tourCancelled = true;
    state.map.flyTo({ ...DATA.aerialView, duration: 1800, essential: true });
    setViewLabel('Vista aérea');
  }

  async function runTour() {
    state.tourCancelled = false;
    const sequence = DATA.sites.slice(0, 4);
    for (const item of sequence) {
      if (state.tourCancelled) break;
      state.map.flyTo({ center: item.coordinates, zoom: item.zoom, pitch: item.pitch, bearing: item.bearing, duration: 2200, essential: true });
      setViewLabel(item.name);
      await new Promise((resolve) => setTimeout(resolve, 3400));
    }
  }

  function wireUI() {
    els.siteCards.innerHTML = renderCards(DATA.sites, 'site');
    els.workCards.innerHTML = renderCards(DATA.works, 'work');

    [els.siteCards, els.workCards].forEach((container) => {
      container.addEventListener('click', (event) => {
        const fly = event.target.closest('[data-fly-id]');
        const street = event.target.closest('[data-street-id]');
        if (fly) {
          const item = findItem(fly.dataset.flyType, fly.dataset.flyId);
          if (item) flyTo(item);
        }
        if (street) {
          const item = findItem(street.dataset.streetType, street.dataset.streetId);
          if (item) {
            setStreetMode(true);
            flyTo({ ...item, zoom: Math.max(item.zoom, 17.0), pitch: 63 }, `${item.name} — calles`);
          }
        }
      });
    });

    els.townBtn.addEventListener('click', goTown);
    els.resetBtn.addEventListener('click', goTown);
    els.pitchBtn.addEventListener('click', goAerial);
    els.tourBtn.addEventListener('click', runTour);
    els.streetsBtn.addEventListener('click', () => setStreetMode(!state.streetsEnabled));
    els.terrainBtn.addEventListener('click', () => setTerrainMode(!state.terrainEnabled));
    els.satelliteToggle.addEventListener('change', () => {
      if (state.map.getLayer('satellite')) state.map.setLayoutProperty('satellite', 'visibility', els.satelliteToggle.checked ? 'visible' : 'none');
      updateStatus();
    });
    els.streetsToggle.addEventListener('change', () => setStreetMode(els.streetsToggle.checked));
    els.hillshadeToggle.addEventListener('change', () => {
      if (state.map.getLayer('hillshade')) state.map.setLayoutProperty('hillshade', 'visibility', els.hillshadeToggle.checked && state.terrainEnabled ? 'visible' : 'none');
    });
    els.markersToggle.addEventListener('change', () => {
      state.markers.forEach(({ element }) => { element.style.display = els.markersToggle.checked ? '' : 'none'; });
    });
    els.openPanel.addEventListener('click', () => els.panel.classList.add('open'));
    els.closePanel.addEventListener('click', () => els.panel.classList.remove('open'));
  }

  function initializeMap() {
    if (typeof window.maplibregl === 'undefined') {
      showFallback('MapLibre no pudo cargarse.');
      return;
    }

    setProgress(16, 'Creando mapa enfocado en San Pedro…', 'Mapa base');
    const map = new maplibregl.Map({
      container: 'map',
      style: createStyle(),
      center: DATA.townView.center,
      zoom: DATA.townView.zoom,
      pitch: DATA.townView.pitch,
      bearing: DATA.townView.bearing,
      maxBounds: DATA.bounds,
      minZoom: 13.7,
      maxZoom: 18.5,
      maxPitch: 78,
      renderWorldCopies: false,
      fadeDuration: 0,
      attributionControl: true,
      cooperativeGestures: false
    });
    state.map = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-right');

    map.on('load', () => {
      setProgress(58, 'Satélite cargado. Preparando relieve…', 'Relieve 3D');
      DATA.sites.forEach((item) => addMarker(item, 'site'));
      DATA.works.forEach((item) => addMarker(item, 'work'));
      wireUI();
      updateStatus();
      setProgress(82, 'Preparando controles y sitios…', 'Interfaz');
    });

    map.on('idle', () => {
      if (state.loaded) return;
      state.loaded = true;
      setProgress(100, 'San Pedro está listo para explorar.', 'Visor cargado');
      setTimeout(() => {
        els.loading.classList.add('hidden');
        els.app.classList.remove('hidden');
        showToast('Versión ligera cargada: solo el pueblo y sitios cercanos.');
      }, 350);
    });

    map.on('error', (event) => {
      const message = event && event.error ? event.error.message : 'Error desconocido del mapa';
      console.warn('MapLibre:', message);
      if (!state.loaded) {
        els.loadingState.textContent = 'Cargando fuentes de respaldo';
      }
    });

    setTimeout(() => {
      if (!state.loaded) {
        setProgress(92, 'La red está tardando; el visor seguirá cargando en segundo plano.', 'Esperando teselas');
        els.loading.classList.add('hidden');
        els.app.classList.remove('hidden');
        showToast('El mapa está tardando en descargar teselas. Puedes esperar o revisar la conexión.', 5000);
      }
    }, 12000);
  }

  setProgress(5, 'Inicializando experiencia ligera…', 'MapLibre GL JS');
  initializeMap();
})();
