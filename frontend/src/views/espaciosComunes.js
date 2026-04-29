// frontend/src/views/espaciosComunes.js
// Gestión unificada de Espacios Comunes del recinto:
// CRUD de espacios, descripción con IA, fotos, y resumen de alojamientos vinculados.

import { fetchAPI } from '../api.js';
import { generarIdComponente } from './components/gestionarAlojamientos/alojamientos.utils.js';

const _ICONOS = ['🏊', '🔥', '🚗', '🌿', '🏋️', '🛖', '🎾', '⛵', '🏔️', '🌊', '🌳', '🍖', '☕', '🧺', '🅿️'];

let _espacios = [];
let _activo = false;
let _propiedades = [];
let _dirty = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _linkedCount(espacioId) {
    return _propiedades.filter(p =>
        (p.metadata?.areas_comunes_ids || []).includes(espacioId)
    ).length;
}

// ── Render ───────────────────────────────────────────────────────────────────

function _renderFoto(foto, areaId) {
    return `
    <div class="relative group aspect-square w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
        <img src="${_esc(foto.thumbnailUrl || foto.storageUrl)}"
            class="w-full h-full object-cover" loading="lazy"
            onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect fill=%22%23f3f4f6%22 width=%2264%22 height=%2264%22/></svg>'">
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <button class="btn-del-foto text-white text-sm font-bold leading-none"
                data-area-id="${_esc(areaId)}" data-foto-id="${_esc(foto.id)}">✕</button>
        </div>
    </div>`;
}

function _renderEspacio(area, idx) {
    const fotos = area.fotos || [];
    const linked = _linkedCount(area.id);
    const elems = (area.elementos || []).map(e =>
        `<span class="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">${_esc(e.nombre)}${e.capacity > 0 ? ` ×${e.capacity}` : ''}</span>`
    ).join('');

    return `
    <div class="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden" data-area-idx="${idx}">
        <div class="flex items-center gap-3 p-4 bg-gray-50 border-b">
            <span class="text-2xl">${_esc(area.icono || '🌿')}</span>
            <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900">${_esc(area.nombre)}</h3>
                ${elems ? `<div class="flex flex-wrap gap-1 mt-1">${elems}</div>` : ''}
            </div>
            <span class="text-xs text-gray-400 whitespace-nowrap" title="Alojamientos vinculados">${linked} aloj.</span>
            <button class="btn-delete-area text-gray-400 hover:text-danger-600 hover:bg-danger-50 p-1.5 rounded-lg transition-colors"
                data-area-id="${_esc(area.id)}" data-area-nombre="${_esc(area.nombre)}">✕</button>
        </div>
        <div class="p-4 space-y-4">
            <div>
                <label class="text-xs font-medium text-gray-500 block mb-1">Descripción para web pública</label>
                <div class="flex gap-2 items-start">
                    <textarea class="area-desc form-input flex-1 text-sm resize-y min-h-[72px]"
                        data-area-id="${_esc(area.id)}"
                        placeholder="Breve descripción para huéspedes (2-3 oraciones)…"
                    >${_esc(area.descripcion || '')}</textarea>
                    <button class="btn-gen-desc flex-shrink-0 btn-outline text-xs px-2 py-2 whitespace-nowrap"
                        data-area-id="${_esc(area.id)}" title="Generar descripción con IA">
                        🤖 IA
                    </button>
                </div>
            </div>
            <div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-medium text-gray-500">Fotos (${fotos.length})</span>
                    <label class="btn-outline text-xs px-2 py-1 cursor-pointer inline-flex items-center gap-1">
                        + Subir
                        <input type="file" class="hidden upload-foto-input" multiple accept="image/*"
                            data-area-id="${_esc(area.id)}">
                    </label>
                </div>
                <div class="flex flex-wrap gap-2 min-h-[32px]">
                    ${fotos.map(f => _renderFoto(f, area.id)).join('')}
                    ${fotos.length === 0 ? '<p class="text-xs text-gray-300 italic self-center">Sin fotos aún</p>' : ''}
                </div>
            </div>
        </div>
    </div>`;
}

function _renderAddForm() {
    return `
    <div class="bg-white border border-primary-100 rounded-xl p-4">
        <p class="text-xs font-medium text-primary-800 uppercase mb-3">Nuevo espacio común</p>
        <div class="flex gap-2 items-end flex-wrap">
            <div class="flex-1 min-w-[150px]">
                <label class="text-xs text-gray-500 block mb-1">Nombre</label>
                <input id="nuevo-nombre" type="text" class="form-input w-full text-sm"
                    placeholder="Ej: Piscina, Quincho, Estacionamiento…">
            </div>
            <div class="w-14">
                <label class="text-xs text-gray-500 block mb-1">Ícono</label>
                <select id="nuevo-icono" class="form-select w-full text-base text-center">
                    ${_ICONOS.map(ic => `<option value="${ic}">${ic}</option>`).join('')}
                </select>
            </div>
            <button id="btn-add-espacio" class="btn-primary text-sm whitespace-nowrap">+ Agregar</button>
        </div>
    </div>`;
}

function _renderListaVacia() {
    return `
    <div class="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
        <div class="text-4xl mb-2">🌿</div>
        <p class="text-sm">Sin espacios comunes. Agrega el primero con el formulario de arriba.</p>
    </div>`;
}

function _renderPage() {
    return `
    <div class="max-w-3xl mx-auto py-8 px-4">
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold text-gray-900">Espacios Comunes</h1>
                <p class="text-sm text-gray-400 mt-0.5">Instalaciones compartidas del recinto — piscina, quincho, jardín y más</p>
            </div>
            <button id="btn-guardar-todo" class="btn-primary">Guardar cambios</button>
        </div>
        ${_renderAddForm()}
        <div id="espacios-lista" class="mt-4 space-y-4">
            ${_espacios.length ? _espacios.map((a, i) => _renderEspacio(a, i)).join('') : _renderListaVacia()}
        </div>
    </div>`;
}

// ── Persistencia ─────────────────────────────────────────────────────────────

async function _guardar() {
    await fetchAPI('/website/empresa/areas-comunes', {
        method: 'PUT',
        body: { activo: _activo, espacios: _espacios },
    });
    _dirty = false;
}

function _rerender() {
    const lista = document.getElementById('espacios-lista');
    if (!lista) return;
    lista.innerHTML = _espacios.length
        ? _espacios.map((a, i) => _renderEspacio(a, i)).join('')
        : _renderListaVacia();
    _bindLista();
}

// ── Bind ─────────────────────────────────────────────────────────────────────

function _bindAddForm() {
    const agregar = () => {
        const nombre = document.getElementById('nuevo-nombre')?.value.trim();
        if (!nombre) return;
        const icono = document.getElementById('nuevo-icono')?.value || '🌿';
        _espacios.push({ id: generarIdComponente(nombre), nombre, icono, elementos: [], fotos: [] });
        document.getElementById('nuevo-nombre').value = '';
        _dirty = true;
        _rerender();
    };
    document.getElementById('btn-add-espacio')?.addEventListener('click', agregar);
    document.getElementById('nuevo-nombre')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); agregar(); }
    });
}

function _bindLista() {
    document.querySelectorAll('.btn-delete-area').forEach(btn => {
        btn.addEventListener('click', () => {
            const nombre = btn.dataset.areaNombre || 'este espacio';
            if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
            _espacios = _espacios.filter(a => a.id !== btn.dataset.areaId);
            _dirty = true;
            _rerender();
        });
    });

    document.querySelectorAll('.area-desc').forEach(ta => {
        ta.addEventListener('input', () => {
            const area = _espacios.find(a => a.id === ta.dataset.areaId);
            if (area) { area.descripcion = ta.value; _dirty = true; }
        });
    });

    document.querySelectorAll('.btn-gen-desc').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.areaId;
            const orig = btn.innerHTML;
            btn.innerHTML = '<svg class="animate-spin h-3 w-3 inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>';
            btn.disabled = true;
            try {
                const res = await fetchAPI(`/website/empresa/areas-comunes/${id}/generate-description`, { method: 'POST' });
                const ta = document.querySelector(`.area-desc[data-area-id="${id}"]`);
                if (ta && res.descripcion) {
                    ta.value = res.descripcion;
                    const area = _espacios.find(a => a.id === id);
                    if (area) { area.descripcion = res.descripcion; _dirty = true; }
                }
            } catch (err) {
                alert('Error al generar: ' + err.message);
            } finally {
                btn.innerHTML = orig;
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('.upload-foto-input').forEach(input => {
        input.addEventListener('change', async (e) => {
            const files = [...(e.target.files || [])];
            if (!files.length) return;
            const { areaId } = e.target.dataset;
            const label = e.target.closest('label');
            const origLabel = label?.innerHTML;
            if (label) label.textContent = 'Subiendo…';
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
                await _guardar();
                _rerender();
            } catch (err) {
                if (label && origLabel) label.innerHTML = origLabel;
                alert('Error al subir: ' + err.message);
            }
        });
    });

    document.querySelectorAll('.btn-del-foto').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar esta foto?')) return;
            const { areaId, fotoId } = btn.dataset;
            const area = _espacios.find(a => a.id === areaId);
            if (area) area.fotos = (area.fotos || []).filter(f => f.id !== fotoId);
            try {
                await _guardar();
            } catch (err) {
                alert('Error al eliminar: ' + err.message);
            }
            _rerender();
        });
    });
}

function _bindGuardar() {
    document.getElementById('btn-guardar-todo')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-guardar-todo');
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = 'Guardando…';
        try {
            await _guardar();
            btn.textContent = '✓ Guardado';
            setTimeout(() => { btn.textContent = 'Guardar cambios'; btn.disabled = false; }, 2000);
        } catch (err) {
            alert('Error al guardar: ' + err.message);
            btn.textContent = 'Guardar cambios';
            btn.disabled = false;
        }
    });
}

// ── Exports ───────────────────────────────────────────────────────────────────

export async function render() {
    return `<div id="espacios-root" class="min-h-screen bg-gray-50"></div>`;
}

export async function afterRender() {
    const root = document.getElementById('espacios-root');
    if (!root) return;
    root.innerHTML = `
    <div class="flex items-center justify-center py-24">
        <svg class="animate-spin h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
    </div>`;
    try {
        const [data, props] = await Promise.all([
            fetchAPI('/website/empresa/areas-comunes'),
            fetchAPI('/propiedades').catch(() => []),
        ]);
        _activo = data.activo ?? false;
        _espacios = data.espacios || [];
        _propiedades = Array.isArray(props) ? props : [];
        _dirty = false;

        root.innerHTML = _renderPage();
        _bindAddForm();
        _bindLista();
        _bindGuardar();
    } catch (err) {
        root.innerHTML = `<div class="p-8 text-danger-600">Error al cargar: ${_esc(err.message)}</div>`;
    }
}
