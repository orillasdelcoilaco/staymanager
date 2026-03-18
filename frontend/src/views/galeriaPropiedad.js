/**
 * galeriaPropiedad.js
 *
 * Galería de fotos por propiedad.
 * Permite revisar, reasignar, confirmar o descartar fotos importadas.
 * Luego sincroniza las confirmadas al websiteData.images (SSR).
 *
 * Ruta: /galeria-propiedad
 */

import { fetchAPI } from '../api.js';

// ─── Estado ──────────────────────────────────────────────────────────────────
let state = {
    propiedades: [],
    propiedadId: null,
    propiedadNombre: '',
    componentes: [],      // componentes reales de la propiedad ({id, nombre})
    fotos: [],
    tab: 'auto',          // 'auto' | 'pendiente' | 'descartada'
    loading: false,
    syncing: false,
    uploading: false,
    error: null
};

// ─── Render principal ─────────────────────────────────────────────────────────
export async function render() {
    return `
    <div class="max-w-7xl mx-auto py-8 px-4">
        <div class="mb-6 flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">🖼️ Galería de Fotos</h1>
                <p class="text-gray-500 text-sm mt-1">Revisa, reasigna y confirma las fotos importadas de cada propiedad.</p>
            </div>
        </div>
        <div id="galeria-root"></div>
    </div>`;
}

export async function afterRender() {
    state = { propiedades: [], propiedadId: null, propiedadNombre: '', componentes: [], fotos: [], tab: 'auto', loading: false, syncing: false, uploading: false, error: null };
    await cargarPropiedades();
    renderRoot();
}

// ─── Carga de datos ───────────────────────────────────────────────────────────
async function cargarPropiedades() {
    try {
        const data = await fetchAPI('/propiedades');
        state.propiedades = Array.isArray(data) ? data : (data.propiedades || []);
    } catch (e) {
        state.error = 'No se pudieron cargar las propiedades.';
    }
}

async function cargarGaleria(propiedadId) {
    state.loading = true;
    state.error = null;
    renderRoot();
    try {
        state.fotos = await fetchAPI(`/galeria/${propiedadId}`);
        // Componentes reales de la propiedad (ya cargados en la lista)
        const prop = state.propiedades.find(p => p.id === propiedadId);
        const comps = prop?.componentes || [];
        state.componentes = comps.map(c => ({
            id: c.id,
            nombre: c.nombre || c.nombreTipo || c.tipo || 'Espacio'
        }));
    } catch (e) {
        state.error = 'Error al cargar la galería.';
        state.fotos = [];
    } finally {
        state.loading = false;
        renderRoot();
    }
}

// ─── Render root ──────────────────────────────────────────────────────────────
function renderRoot() {
    const root = document.getElementById('galeria-root');
    if (!root) return;

    if (!state.propiedadId) {
        root.innerHTML = renderSelector();
        bindSelector();
        return;
    }

    root.innerHTML = renderGaleria();
    bindGaleria();
}

// ─── Selector de propiedad ────────────────────────────────────────────────────
function renderSelector() {
    const opts = state.propiedades
        .map(p => `<option value="${p.id}">${p.nombre}</option>`)
        .join('');

    return `
    <div class="bg-white rounded-xl shadow p-8 max-w-lg mx-auto">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">Selecciona una propiedad</h2>
        ${state.error ? `<div class="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">${state.error}</div>` : ''}
        <select id="sel-propiedad" class="form-input w-full mb-4">
            <option value="">— Elige una propiedad —</option>
            ${opts}
        </select>
        <button id="btn-ver-galeria" class="btn-primary w-full py-2 rounded-lg" disabled>
            Ver galería →
        </button>
    </div>`;
}

function bindSelector() {
    const sel = document.getElementById('sel-propiedad');
    const btn = document.getElementById('btn-ver-galeria');

    sel?.addEventListener('change', () => {
        btn.disabled = !sel.value;
    });

    btn?.addEventListener('click', () => {
        const id = sel?.value;
        const nombre = sel?.options[sel.selectedIndex]?.text || '';
        if (!id) return;
        state.propiedadId = id;
        state.propiedadNombre = nombre;
        cargarGaleria(id);
    });
}

// ─── Vista de galería ─────────────────────────────────────────────────────────
function renderGaleria() {
    const fotosTab = state.fotos.filter(f => f.estado === state.tab);
    const counts = {
        auto:      state.fotos.filter(f => f.estado === 'auto' || f.estado === 'manual').length,
        pendiente: state.fotos.filter(f => f.estado === 'pendiente').length,
        descartada: state.fotos.filter(f => f.estado === 'descartada').length,
    };
    // Normalizar: 'manual' muestra en tab 'auto'
    const fotosVisibles = state.tab === 'auto'
        ? state.fotos.filter(f => f.estado === 'auto' || f.estado === 'manual')
        : fotosTab;

    return `
    <div class="flex items-center gap-3 mb-6 flex-wrap">
        <button id="btn-cambiar-prop" class="btn-secondary px-4 py-2 rounded-lg text-sm">← Cambiar propiedad</button>
        <h2 class="text-lg font-semibold text-gray-800">${state.propiedadNombre}</h2>
        <span class="ml-auto flex items-center gap-2">
            <label class="btn-secondary px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${state.uploading ? 'opacity-60 pointer-events-none' : ''}">
                ${state.uploading ? '⏳ Subiendo...' : '📤 Subir fotos'}
                <input type="file" id="input-upload-galeria" multiple accept="image/*" class="hidden">
            </label>
            <button id="btn-sync" class="btn-primary px-5 py-2 rounded-lg text-sm font-semibold ${state.syncing ? 'opacity-60 pointer-events-none' : ''}">
                ${state.syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar al sitio web'}
            </button>
        </span>
    </div>

    ${state.error ? `<div class="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">${state.error}</div>` : ''}

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 border-b border-gray-200">
        ${renderTab('auto',      `✅ Asignadas (${counts.auto})`)}
        ${renderTab('pendiente', `⏳ Pendientes (${counts.pendiente})`)}
        ${renderTab('descartada',`🗑️ Descartadas (${counts.descartada})`)}
    </div>

    ${state.loading ? `
    <div class="flex items-center justify-center py-20 text-gray-400">
        <svg class="animate-spin h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Cargando galería...
    </div>` : fotosVisibles.length === 0 ? `
    <div class="text-center py-20 text-gray-400">
        <p class="text-4xl mb-3">📷</p>
        <p>No hay fotos en esta categoría.</p>
        ${state.tab === 'pendiente' ? '<p class="text-sm mt-1">¡Excelente! Todas las fotos fueron clasificadas.</p>' : ''}
    </div>` : `
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        ${fotosVisibles.map(f => renderFotoCard(f)).join('')}
    </div>`}`;
}

function renderTab(key, label) {
    const active = state.tab === key;
    return `<button class="tab-btn px-4 py-2 text-sm font-medium border-b-2 transition-colors ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-tab="${key}">${label}</button>`;
}

function renderFotoCard(foto) {
    const imgSrc = foto.thumbnailUrl || foto.storageUrl || '';
    const conf = Math.round((foto.confianza || 0) * 100);
    const confColor = conf >= 80 ? 'bg-green-100 text-green-700' : conf >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

    // Dropdown con componentes reales de la propiedad (Dormitorio 1, Dormitorio 2, etc.)
    const espacioOpts = state.componentes.map(c =>
        `<option value="${c.id}" ${foto.espacioId === c.id ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');

    return `
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow" data-foto-id="${foto.id}">
        <div class="relative">
            <img src="${imgSrc}" alt="${foto.altText || ''}"
                class="w-full h-36 object-cover bg-gray-100"
                loading="lazy"
                onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 75%22><rect fill=%22%23e5e7eb%22 width=%22100%22 height=%2275%22/><text x=%2250%22 y=%2242%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2212%22>Sin imagen</text></svg>'">
            <span class="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${confColor}">${conf}%</span>
        </div>
        <div class="p-2 space-y-2">
            <select class="foto-espacio-sel form-input w-full text-xs py-1" data-foto-id="${foto.id}">
                <option value="">— Sin espacio —</option>
                ${espacioOpts}
            </select>
            <div class="flex gap-1">
                ${foto.estado === 'pendiente' ? `
                <button class="btn-confirmar flex-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg py-1 px-2 transition-colors" data-foto-id="${foto.id}">✓ Confirmar</button>` : ''}
                ${foto.estado !== 'descartada' ? `
                <button class="btn-descartar ${foto.estado === 'pendiente' ? '' : 'flex-1'} text-xs bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-lg py-1 px-2 transition-colors" data-foto-id="${foto.id}" title="Descartar">✕</button>` : `
                <button class="btn-restaurar flex-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg py-1 px-2 transition-colors" data-foto-id="${foto.id}">↩ Restaurar</button>`}
            </div>
        </div>
    </div>`;
}

// ─── Bind eventos de la galería ───────────────────────────────────────────────
function bindGaleria() {
    document.getElementById('btn-cambiar-prop')?.addEventListener('click', () => {
        state.propiedadId = null;
        state.fotos = [];
        renderRoot();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.tab = btn.dataset.tab;
            renderRoot();
        });
    });

    document.getElementById('btn-sync')?.addEventListener('click', handleSync);

    document.getElementById('input-upload-galeria')?.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        state.uploading = true;
        state.error = null;
        renderRoot();
        try {
            const formData = new FormData();
            for (const file of files) formData.append('images', file);
            const nuevas = await fetchAPI(`/galeria/${state.propiedadId}/upload`, { method: 'POST', body: formData });
            state.fotos.push(...nuevas);
            state.tab = 'pendiente';
        } catch (err) {
            state.error = 'Error al subir fotos. Intenta nuevamente.';
        } finally {
            state.uploading = false;
            renderRoot();
        }
    });

    // Cambiar espacio → guardar nombre del componente + ID para que sync funcione
    document.querySelectorAll('.foto-espacio-sel').forEach(sel => {
        sel.addEventListener('change', async () => {
            const fotoId = sel.dataset.fotoId;
            const compId = sel.value || null;
            const comp = state.componentes.find(c => c.id === compId);
            await patchFoto(fotoId, {
                espacio:   comp?.nombre || null,
                espacioId: compId
            });
        });
    });

    // Confirmar (pendiente → auto)
    document.querySelectorAll('.btn-confirmar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const fotoId = btn.dataset.fotoId;
            await fetchAPI(`/galeria/${state.propiedadId}/${fotoId}/confirmar`, { method: 'POST' });
            actualizarEstadoLocal(fotoId, { estado: 'auto', confianza: 1.0 });
            renderRoot();
        });
    });

    // Descartar
    document.querySelectorAll('.btn-descartar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const fotoId = btn.dataset.fotoId;
            await fetchAPI(`/galeria/${state.propiedadId}/${fotoId}`, { method: 'DELETE' });
            actualizarEstadoLocal(fotoId, { estado: 'descartada' });
            renderRoot();
        });
    });

    // Restaurar (descartada → pendiente)
    document.querySelectorAll('.btn-restaurar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const fotoId = btn.dataset.fotoId;
            await patchFoto(fotoId, { estado: 'pendiente' });
        });
    });
}

async function patchFoto(fotoId, updates) {
    try {
        await fetchAPI(`/galeria/${state.propiedadId}/${fotoId}`, {
            method: 'PATCH',
            body: updates
        });
        actualizarEstadoLocal(fotoId, updates);
        renderRoot();
    } catch (e) {
        state.error = 'Error al actualizar la foto.';
        renderRoot();
    }
}

function actualizarEstadoLocal(fotoId, updates) {
    const foto = state.fotos.find(f => f.id === fotoId);
    if (foto) Object.assign(foto, updates);
}

async function handleSync() {
    if (state.syncing) return;
    state.syncing = true;
    state.error = null;
    renderRoot();
    try {
        const result = await fetchAPI(`/galeria/${state.propiedadId}/sync`, { method: 'POST' });
        state.error = null;
        // Mostrar confirmación breve
        const btn = document.getElementById('btn-sync');
        if (btn) {
            btn.textContent = `✅ ${result.total} fotos sincronizadas`;
            btn.classList.add('bg-green-600');
            setTimeout(() => { state.syncing = false; renderRoot(); }, 3000);
            return;
        }
    } catch (e) {
        state.error = 'Error al sincronizar. Intenta nuevamente.';
    }
    state.syncing = false;
    renderRoot();
}
