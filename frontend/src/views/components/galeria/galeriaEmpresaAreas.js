// frontend/src/views/components/galeria/galeriaEmpresaAreas.js
// Galería de fotos para Instalaciones del Recinto (áreas comunes de empresa).
// Las fotos se guardan en empresas.configuracion.areas_comunes[i].fotos[]
// (no en la tabla galeria, que requiere FK propiedad_id).

import { fetchAPI } from '../../../api.js';

let _espacios = [];  // copia local de areas_comunes.espacios (con fotos)
let _activo   = false;

// ── Render ─────────────────────────────────────────────────────────────────────

function _renderLoading() {
    return `<div class="flex items-center justify-center py-24">
        <svg class="animate-spin h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
    </div>`;
}

function _renderEmpty() {
    return `
    <div class="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
        <div class="text-5xl mb-3">🌿</div>
        <p class="font-medium text-gray-700">No hay instalaciones configuradas</p>
        <p class="text-sm text-gray-400 mt-1">
            Configura primero las instalaciones en
            <strong>Gestionar Alojamientos → Instalaciones del Recinto</strong>
        </p>
    </div>`;
}

function _renderFotoThumb(foto, areaId) {
    return `
    <div class="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
        <img src="${_esc(foto.thumbnailUrl || foto.storageUrl)}"
            class="w-full h-full object-cover" loading="lazy"
            onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22><rect fill=%22%23f3f4f6%22 width=%2280%22 height=%2280%22/></svg>'">
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button class="btn-del-area-foto bg-danger-600 hover:bg-danger-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow"
                data-area-id="${_esc(areaId)}" data-foto-id="${_esc(foto.id)}">✕</button>
        </div>
    </div>`;
}

function _renderAreaCard(area) {
    const fotos = area.fotos || [];
    return `
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b bg-gray-50">
            <div class="flex items-center gap-2">
                <span class="text-xl">${area.icono || '🌿'}</span>
                <h3 class="font-semibold text-gray-800">${_esc(area.nombre)}</h3>
                <span class="text-xs text-gray-400">${fotos.length} foto(s)</span>
            </div>
            <label class="btn-chip-area cursor-pointer">
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                Subir fotos
                <input type="file" class="hidden upload-area-input" multiple accept="image/*"
                    data-area-id="${_esc(area.id)}" data-area-nombre="${_esc(area.nombre)}">
            </label>
        </div>
        <div class="p-3 min-h-[80px]">
            ${fotos.length === 0
                ? '<p class="text-xs text-gray-400 text-center py-4 italic">Sin fotos aún — usa el botón "Subir fotos"</p>'
                : `<div class="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    ${fotos.map(f => _renderFotoThumb(f, area.id)).join('')}
                   </div>`
            }
        </div>
    </div>`;
}

function _renderContent() {
    if (_espacios.length === 0) return _renderEmpty();
    return `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${_espacios.map(a => _renderAreaCard(a)).join('')}
    </div>`;
}

function _renderPage(goBack) {
    return `
    <div class="max-w-5xl mx-auto py-6 px-4">
        <div class="flex items-center gap-3 mb-6">
            <button id="btn-back-empresa-galeria"
                class="flex-shrink-0 h-9 w-9 rounded-xl bg-white border border-gray-200 hover:border-primary-300 flex items-center justify-center text-gray-500 hover:text-primary-600 transition-colors shadow-sm">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div>
                <h2 class="text-xl font-bold text-gray-900">Instalaciones del Recinto</h2>
                <p class="text-xs text-gray-400">Fotos de áreas comunes compartidas entre todos los alojamientos</p>
            </div>
        </div>
        <div id="empresa-areas-content">${_renderContent()}</div>
    </div>`;
}

// ── Persistencia ───────────────────────────────────────────────────────────────

async function _guardarAreas() {
    await fetchAPI('/website/empresa/areas-comunes', {
        method: 'PUT',
        body: { activo: _activo, espacios: _espacios },
    });
}

// ── Bind ───────────────────────────────────────────────────────────────────────

function _bindPage(containerEl, goBack) {
    containerEl.querySelector('#btn-back-empresa-galeria')
        ?.addEventListener('click', goBack);

    _bindUploads(containerEl, goBack);
    _bindDeletes(containerEl, goBack);
}

function _bindUploads(containerEl, goBack) {
    containerEl.querySelectorAll('.upload-area-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const files = [...(e.target.files || [])];
            if (!files.length) return;
            const { areaId, areaNombre } = e.target.dataset;

            const label = e.target.closest('label');
            const originalLabel = label?.innerHTML;
            if (label) {
                label.innerHTML = '<svg class="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Subiendo...';
            }

            try {
                const fd = new FormData();
                files.forEach(f => fd.append('images', f));
                fd.append('areaId', areaId);
                const nuevas = await fetchAPI('/galeria/empresa/area-foto/upload', { method: 'POST', body: fd });

                const area = _espacios.find(a => a.id === areaId);
                if (area) {
                    if (!area.fotos) area.fotos = [];
                    area.fotos.push(...(nuevas || []));
                }
                await _guardarAreas();
                _rerenderContent(containerEl, goBack);
            } catch (err) {
                if (label && originalLabel) label.innerHTML = originalLabel;
                alert('Error al subir: ' + err.message);
            }
        });
    });
}

function _bindDeletes(containerEl, goBack) {
    containerEl.querySelectorAll('.btn-del-area-foto').forEach(btn => {
        btn.addEventListener('click', async () => {
            const { areaId, fotoId } = btn.dataset;
            if (!confirm('¿Eliminar esta foto?')) return;
            const area = _espacios.find(a => a.id === areaId);
            if (area) area.fotos = (area.fotos || []).filter(f => f.id !== fotoId);
            try {
                await _guardarAreas();
            } catch (err) {
                alert('Error al eliminar: ' + err.message);
            }
            _rerenderContent(containerEl, goBack);
        });
    });
}

function _rerenderContent(containerEl, goBack) {
    const content = containerEl.querySelector('#empresa-areas-content');
    if (content) {
        content.innerHTML = _renderContent();
        _bindUploads(containerEl, goBack);
        _bindDeletes(containerEl, goBack);
    }
}

// ── Util ───────────────────────────────────────────────────────────────────────

function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Export ─────────────────────────────────────────────────────────────────────

/**
 * Carga las áreas comunes y renderiza la galería de empresa dentro de containerEl.
 * @param {HTMLElement} containerEl
 * @param {Function}    goBack — callback para volver al selector de propiedades
 */
export async function renderGaleriaEmpresa(containerEl, goBack) {
    containerEl.innerHTML = _renderLoading();
    try {
        const data = await fetchAPI('/website/empresa/areas-comunes');
        _activo   = data.activo ?? false;
        _espacios = data.espacios || [];
        containerEl.innerHTML = _renderPage(goBack);
        _bindPage(containerEl, goBack);
    } catch (err) {
        containerEl.innerHTML = `<div class="p-6 text-danger-600">Error al cargar: ${err.message}</div>`;
    }
}
