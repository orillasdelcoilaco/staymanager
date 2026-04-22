// frontend/src/views/components/ubicacionWidget.js
//
// Widget reutilizable de ubicación con geocodificación (Nominatim) y mapa (Leaflet).
//
// Uso:
//   HTML:  renderUbicacionWidget('empresa-ubicacion', datos)
//   Setup: setupUbicacionWidget('empresa-ubicacion')
//   Read:  getUbicacionData('empresa-ubicacion')

import { fetchAPI } from '../../api.js';

// ── Leaflet loader ──────────────────────────────────────────────────────────

let leafletReady = false;
let leafletPromise = null;

function cargarLeaflet() {
    if (leafletReady) return Promise.resolve();
    if (leafletPromise) return leafletPromise;

    leafletPromise = new Promise((resolve) => {
        if (document.getElementById('leaflet-css')) {
            leafletReady = true;
            resolve();
            return;
        }

        const css = document.createElement('link');
        css.id = 'leaflet-css';
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => { leafletReady = true; resolve(); };
        document.head.appendChild(script);
    });

    return leafletPromise;
}

// ── Render HTML ──────────────────────────────────────────────────────────────

export function renderUbicacionWidget(widgetId, datos = {}) {
    return `
        <div class="ubicacion-widget space-y-3" data-widget-id="${widgetId}">
            <div class="flex gap-2">
                <input
                    type="text"
                    id="${widgetId}-direccion"
                    class="form-input flex-1"
                    placeholder="Dirección, ciudad, región..."
                    value="${datos.direccion || ''}"
                />
                <button type="button" id="${widgetId}-btn-buscar"
                    class="btn-outline whitespace-nowrap">
                    🔍 Buscar
                </button>
            </div>

            <!-- Sugerencias -->
            <ul id="${widgetId}-sugerencias"
                class="hidden bg-white border rounded-lg shadow-lg divide-y divide-gray-100 text-sm max-h-48 overflow-y-auto z-50">
            </ul>

            <!-- Mapa -->
            <div id="${widgetId}-mapa"
                class="${datos.lat ? '' : 'hidden'} rounded-lg border overflow-hidden"
                style="height: 220px;">
            </div>

            <!-- Campos ocultos con datos estructurados -->
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Ciudad</label>
                    <input type="text" id="${widgetId}-ciudad" class="form-input w-full text-sm"
                        placeholder="Ciudad" value="${datos.ciudad || ''}" />
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Región / Estado</label>
                    <input type="text" id="${widgetId}-region" class="form-input w-full text-sm"
                        placeholder="Región" value="${datos.region || ''}" />
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">País</label>
                    <input type="text" id="${widgetId}-pais" class="form-input w-full text-sm"
                        placeholder="País" value="${datos.pais || 'Chile'}" />
                </div>
                <div class="flex gap-2">
                    <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-500 mb-1">Latitud</label>
                        <input type="text" id="${widgetId}-lat" class="form-input w-full text-sm font-mono"
                            placeholder="–" value="${datos.lat || ''}" readonly />
                    </div>
                    <div class="flex-1">
                        <label class="block text-xs font-medium text-gray-500 mb-1">Longitud</label>
                        <input type="text" id="${widgetId}-lng" class="form-input w-full text-sm font-mono"
                            placeholder="–" value="${datos.lng || ''}" readonly />
                    </div>
                </div>
            </div>

            <p class="text-xs text-gray-400">
                💡 Puedes arrastrar el pin en el mapa para ajustar la ubicación exacta.
                Datos geográficos © <a href="https://www.openstreetmap.org/copyright"
                class="underline" target="_blank">OpenStreetMap</a>.
            </p>
        </div>
    `;
}

// ── Setup interactividad ─────────────────────────────────────────────────────

export async function setupUbicacionWidget(widgetId) {
    const btnBuscar = document.getElementById(`${widgetId}-btn-buscar`);
    const inputDireccion = document.getElementById(`${widgetId}-direccion`);
    const listaSugerencias = document.getElementById(`${widgetId}-sugerencias`);

    if (!btnBuscar || !inputDireccion) return;

    // Inicializar mapa si ya hay coordenadas
    const latInicial = parseFloat(document.getElementById(`${widgetId}-lat`)?.value);
    const lngInicial = parseFloat(document.getElementById(`${widgetId}-lng`)?.value);
    if (latInicial && lngInicial) {
        await inicializarMapa(widgetId, latInicial, lngInicial);
    }

    btnBuscar.addEventListener('click', () => buscar(widgetId));

    inputDireccion.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); buscar(widgetId); }
    });

    // Cerrar sugerencias al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest(`[data-widget-id="${widgetId}"]`)) {
            listaSugerencias.classList.add('hidden');
        }
    });
}

async function buscar(widgetId) {
    const inputDireccion = document.getElementById(`${widgetId}-direccion`);
    const listaSugerencias = document.getElementById(`${widgetId}-sugerencias`);
    const btnBuscar = document.getElementById(`${widgetId}-btn-buscar`);
    const q = inputDireccion.value.trim();

    if (!q) return;

    btnBuscar.disabled = true;
    btnBuscar.textContent = '⏳';

    try {
        const resultados = await fetchAPI(`/geocode?q=${encodeURIComponent(q)}`);

        if (!resultados.length) {
            listaSugerencias.innerHTML = `
                <li class="px-4 py-3 text-sm space-y-1">
                    <p class="text-gray-500 italic">Sin resultados para "${escAttr(q)}". Prueba con ciudad, región o país.</p>
                    <p class="text-xs text-primary-600">
                        💡 Si la dirección no aparece en el mapa (p.ej. caminos rurales), busca primero la <strong>ciudad o sector</strong>,
                        luego <strong>arrastra el pin</strong> al lugar exacto. El campo de dirección lo puedes editar libremente.
                    </p>
                </li>`;
            listaSugerencias.classList.remove('hidden');
            return;
        }

        // Un solo resultado: seleccionar automáticamente sin mostrar lista
        if (resultados.length === 1) {
            const li = crearLiDesdeResultado(resultados[0]);
            await seleccionarResultado(widgetId, li);
            return;
        }

        listaSugerencias.innerHTML = resultados.map((r, i) => `
            <li class="px-4 py-3 cursor-pointer hover:bg-primary-50 transition-colors text-sm"
                data-idx="${i}"
                data-lat="${r.lat}"
                data-lng="${r.lng}"
                data-ciudad="${escAttr(r.ciudad)}"
                data-region="${escAttr(r.region)}"
                data-pais="${escAttr(r.pais)}"
                data-display="${escAttr(r.display_name)}">
                📍 ${r.display_name}
            </li>
        `).join('');
        listaSugerencias.classList.remove('hidden');

        listaSugerencias.querySelectorAll('li[data-idx]').forEach(li => {
            li.addEventListener('click', () => seleccionarResultado(widgetId, li));
        });

    } catch (err) {
        console.error('[UbicacionWidget] Error geocode:', err);
        listaSugerencias.innerHTML = `<li class="px-4 py-3 text-danger-500 text-sm">Error: ${err.message}</li>`;
        listaSugerencias.classList.remove('hidden');
    } finally {
        btnBuscar.disabled = false;
        btnBuscar.textContent = '🔍 Buscar';
    }
}

function escAttr(str) {
    return (str || '').replace(/"/g, '&quot;');
}

function crearLiDesdeResultado(r) {
    const li = document.createElement('li');
    li.dataset.lat = r.lat;
    li.dataset.lng = r.lng;
    li.dataset.ciudad = r.ciudad;
    li.dataset.region = r.region;
    li.dataset.pais = r.pais;
    li.dataset.display = r.display_name;
    return li;
}

async function seleccionarResultado(widgetId, li) {
    const lat = parseFloat(li.dataset.lat);
    const lng = parseFloat(li.dataset.lng);

    document.getElementById(`${widgetId}-direccion`).value = li.dataset.display;
    document.getElementById(`${widgetId}-ciudad`).value = li.dataset.ciudad;
    document.getElementById(`${widgetId}-region`).value = li.dataset.region;
    document.getElementById(`${widgetId}-pais`).value = li.dataset.pais || 'Chile';
    document.getElementById(`${widgetId}-lat`).value = lat;
    document.getElementById(`${widgetId}-lng`).value = lng;

    document.getElementById(`${widgetId}-sugerencias`).classList.add('hidden');

    await inicializarMapa(widgetId, lat, lng);
}

const mapaInstancias = {};

async function inicializarMapa(widgetId, lat, lng) {
    await cargarLeaflet();

    const L = window.L;
    const mapaEl = document.getElementById(`${widgetId}-mapa`);
    if (!mapaEl) return;

    mapaEl.classList.remove('hidden');

    // Si existe una instancia previa pero su contenedor ya no está en el DOM (re-render),
    // destruirla antes de crear una nueva.
    if (mapaInstancias[widgetId]) {
        const { map, marker } = mapaInstancias[widgetId];
        const contenedorVivo = map.getContainer?.()?.isConnected;
        if (contenedorVivo) {
            map.setView([lat, lng], 15);
            marker.setLatLng([lat, lng]);
            setTimeout(() => map.invalidateSize(), 50);
            return;
        }
        try { map.remove(); } catch (_) {}
        delete mapaInstancias[widgetId];
    }

    // Crear mapa nuevo
    const map = L.map(mapaEl).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

    marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        const latVal = pos.lat.toFixed(6);
        const lngVal = pos.lng.toFixed(6);
        document.getElementById(`${widgetId}-lat`).value = latVal;
        document.getElementById(`${widgetId}-lng`).value = lngVal;

        // Reverse geocoding: actualizar solo ciudad/región/país (NO el campo de dirección libre)
        const inputCiudad = document.getElementById(`${widgetId}-ciudad`);
        const inputRegion = document.getElementById(`${widgetId}-region`);
        const inputPais   = document.getElementById(`${widgetId}-pais`);
        try {
            const r = await fetchAPI(`/geocode/reverse?lat=${latVal}&lng=${lngVal}`);
            if (inputCiudad && r.ciudad)  inputCiudad.value  = r.ciudad;
            if (inputRegion && r.region)  inputRegion.value  = r.region;
            if (inputPais   && r.pais)    inputPais.value    = r.pais;
        } catch (_) {
            // Fallo silencioso — solo coords ya actualizadas, los campos estructurados quedan igual
        }
    });

    mapaInstancias[widgetId] = { map, marker };

    setTimeout(() => map.invalidateSize(), 100);
}

// ── Leer datos ───────────────────────────────────────────────────────────────

export function getUbicacionData(widgetId) {
    const lat = parseFloat(document.getElementById(`${widgetId}-lat`)?.value);
    const lng = parseFloat(document.getElementById(`${widgetId}-lng`)?.value);
    return {
        direccion: document.getElementById(`${widgetId}-direccion`)?.value.trim() || '',
        ciudad:    document.getElementById(`${widgetId}-ciudad`)?.value.trim() || '',
        region:    document.getElementById(`${widgetId}-region`)?.value.trim() || '',
        pais:      document.getElementById(`${widgetId}-pais`)?.value.trim() || 'Chile',
        lat:       isNaN(lat) ? null : lat,
        lng:       isNaN(lng) ? null : lng,
    };
}
