// frontend/src/views/resenas.js
import { fetchAPI } from '../api.js';
import { renderModalManual, setupModalManual } from './components/resenas/resenas.modal.js';
import { renderModalAuto, setupModalAuto } from './components/resenas/resenas.auto.js';

const CATS = [
    { key: 'promedio_limpieza',     label: '🧹 Limpieza' },
    { key: 'promedio_ubicacion',    label: '📍 Ubicación' },
    { key: 'promedio_llegada',      label: '🛎️ Llegada' },
    { key: 'promedio_comunicacion', label: '💬 Comunicación' },
    { key: 'promedio_equipamiento', label: '🏡 Equipamiento' },
    { key: 'promedio_valor',        label: '💲 Valor/Precio' },
];

function estrellas(n) {
    if (!n) return '<span class="text-gray-300">—</span>';
    const llenas = Math.round(n);
    return Array.from({ length: 5 }, (_, i) =>
        `<span class="${i < llenas ? 'text-warning-500' : 'text-gray-200'}">★</span>`
    ).join('');
}

function badgeEstado(estado) {
    const map = {
        pendiente: 'bg-warning-100 text-warning-800',
        publicada:  'bg-success-100 text-success-800',
        oculta:     'bg-gray-100 text-gray-600',
    };
    return `<span class="px-2 py-0.5 text-xs font-semibold rounded-full ${map[estado] || ''}">${estado}</span>`;
}

function renderResumenKPIs(res) {
    if (!res || !res.total) return '<p class="text-gray-400 text-sm">Sin reseñas registradas todavía.</p>';
    return `
        <div class="flex flex-wrap gap-4 items-center">
            <div class="text-center">
                <div class="text-3xl font-bold text-primary-600">${res.promedio_general != null ? (parseFloat(res.promedio_general) * 2).toFixed(1) : '—'}</div>
                <div class="text-xs text-gray-500 mt-0.5">Promedio general (/10)</div>
                <div class="text-lg mt-0.5">${estrellas(res.promedio_general)}</div>
            </div>
            <div class="w-px h-12 bg-gray-200 hidden md:block"></div>
            <div class="flex flex-wrap gap-3 flex-1">
                ${CATS.map(c => `
                    <div class="text-center min-w-[70px]">
                        <div class="text-sm font-semibold text-gray-700">${res[c.key] ?? '—'}</div>
                        <div class="text-xs text-gray-400">${c.label}</div>
                    </div>`).join('')}
            </div>
            <div class="text-sm text-gray-500">${res.total} reseña${res.total !== 1 ? 's' : ''}
                ${res.pendientes > 0 ? `<span class="ml-2 px-2 py-0.5 bg-warning-100 text-warning-700 rounded-full text-xs font-semibold">${res.pendientes} pendiente${res.pendientes !== 1 ? 's' : ''}</span>` : ''}
            </div>
        </div>`;
}

function _renderFotos(r) {
    if (!r.foto1_url && !r.foto2_url) return '';
    return `<div class="flex gap-2 mt-2">
        ${r.foto1_url ? `<a href="${r.foto1_url}" target="_blank"><img src="${r.foto1_url}" class="h-16 w-16 object-cover rounded-lg border border-gray-200 hover:opacity-80"></a>` : ''}
        ${r.foto2_url ? `<a href="${r.foto2_url}" target="_blank"><img src="${r.foto2_url}" class="h-16 w-16 object-cover rounded-lg border border-gray-200 hover:opacity-80"></a>` : ''}
    </div>`;
}

function renderTarjeta(r) {
    const fechaDisplay = r.fecha_resena || r.created_at;
    const fecha = new Date(fechaDisplay).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const esManual = r.origen === 'manual';
    return `
        <div class="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3" id="resena-${r.id}">
            <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <span class="font-semibold text-gray-900">${r.nombre_huesped || r.cliente_nombre || 'Huésped'}</span>
                    ${r.propiedad_nombre ? `<span class="text-gray-400 text-sm ml-2">· ${r.propiedad_nombre}</span>` : ''}
                    <span class="text-gray-400 text-sm ml-2">· ${fecha}</span>
                    ${esManual ? '<span class="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary-50 text-primary-600 border border-primary-100">📥 Manual</span>' : ''}
                    ${r.origen === 'auto_seed' ? '<span class="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200">✨ Auto</span>' : ''}
                </div>
                <div class="flex items-center gap-2">
                    <div class="text-lg">${estrellas(r.punt_general)}</div>
                    ${badgeEstado(r.estado)}
                </div>
            </div>

            ${r.texto_positivo ? `<p class="text-gray-700 text-sm">✅ ${r.texto_positivo}</p>` : ''}
            ${r.texto_negativo ? `<p class="text-gray-500 text-sm">📝 ${r.texto_negativo}</p>` : ''}
            ${_renderFotos(r)}

            ${r.respuesta_texto ? `
                <div class="bg-primary-50 border-l-4 border-primary-300 rounded-r-lg p-3">
                    <p class="text-xs text-primary-500 font-semibold mb-1">Respuesta del anfitrión</p>
                    <p class="text-sm text-gray-700">${r.respuesta_texto}</p>
                </div>` : ''}

            <div class="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
                <button type="button" class="btn-outline text-xs py-1 px-3" onclick="abrirEditarResena('${r.id}')">Editar</button>
                <button type="button" class="btn-ghost text-xs py-1 px-3 text-danger-700 hover:bg-danger-50" onclick="eliminarResena('${r.id}')">Eliminar</button>
                <button type="button" class="btn-outline text-xs py-1 px-3" onclick="abrirRespuesta('${r.id}')">
                    ${r.respuesta_texto ? 'Editar respuesta' : 'Responder'}
                </button>
                ${r.estado !== 'publicada' ? `<button type="button" class="btn-success text-xs py-1 px-3" onclick="cambiarEstado('${r.id}', 'publicada')">Publicar</button>` : ''}
                ${r.estado !== 'oculta'    ? `<button type="button" class="btn-ghost text-xs py-1 px-3" onclick="cambiarEstado('${r.id}', 'oculta')">Ocultar</button>` : ''}
            </div>

            <div id="form-respuesta-${r.id}" class="hidden space-y-2 pt-2">
                <textarea class="form-input w-full text-sm" rows="3"
                    placeholder="Escribe tu respuesta pública al huésped...">${r.respuesta_texto || ''}</textarea>
                <div class="flex gap-2 justify-end">
                    <button class="btn-ghost text-xs" onclick="cerrarRespuesta('${r.id}')">Cancelar</button>
                    <button class="btn-primary text-xs" onclick="guardarRespuesta('${r.id}')">Guardar respuesta</button>
                </div>
            </div>
        </div>`;
}

export function render() {
    return `
        <div class="space-y-6">
            <div class="bg-white p-6 rounded-xl shadow-sm">
                <h2 class="text-xl font-semibold text-gray-900 mb-4">⭐ Reseñas</h2>
                <div id="resumen-kpis" class="text-gray-400 text-sm">Cargando...</div>
            </div>

            <div class="bg-white p-6 rounded-xl shadow-sm">
                <div class="flex flex-wrap gap-3 items-end mb-5">
                    <div class="min-w-[180px] flex-1 max-w-md">
                        <label class="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
                        <input type="search" id="buscar-resenas" class="form-input text-sm w-full" placeholder="Nombre, texto, alojamiento, reserva…" autocomplete="off">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Orden</label>
                        <select id="orden-resenas" class="form-select text-sm min-w-[200px]">
                            <option value="created_at_desc">Más recientes</option>
                            <option value="created_at_asc">Más antiguas</option>
                            <option value="punt_general_desc">Mayor puntuación</option>
                            <option value="punt_general_asc">Menor puntuación</option>
                            <option value="nombre_asc">Nombre A–Z</option>
                            <option value="nombre_desc">Nombre Z–A</option>
                            <option value="propiedad_asc">Alojamiento A–Z</option>
                            <option value="propiedad_desc">Alojamiento Z–A</option>
                            <option value="fecha_resena_desc">Fecha reseña (reciente)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                        <select id="filtro-estado" class="form-select text-sm">
                            <option value="">Todos</option>
                            <option value="pendiente">Pendientes</option>
                            <option value="publicada">Publicadas</option>
                            <option value="oculta">Ocultas</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Alojamiento</label>
                        <select id="filtro-propiedad" class="form-select text-sm">
                            <option value="">Todos</option>
                        </select>
                    </div>
                    <button id="btn-filtrar" type="button" class="btn-primary text-sm">Aplicar</button>
                    <div class="ml-auto flex flex-wrap gap-2 justify-end">
                        <button id="btn-generar-auto" type="button" class="btn-outline text-sm">✨ Generar automáticas</button>
                        <button id="btn-nueva-manual" type="button" class="btn-outline text-sm">📝 Cargar reseña manual</button>
                    </div>
                </div>
                <div id="lista-resenas" class="space-y-4">
                    <p class="text-gray-400 text-sm text-center py-8">Cargando reseñas...</p>
                </div>
            </div>
        </div>
        ${renderModalManual()}
        ${renderModalAuto()}
        ${renderModalEditResena()}`;
}

function renderModalEditResena() {
    return `
    <div id="modal-edit-resena" class="fixed inset-0 bg-black/50 z-50 hidden items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div class="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
                <h3 class="text-base font-semibold text-gray-900">Editar reseña</h3>
                <button type="button" id="modal-edit-close" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <form id="form-edit-resena" class="px-5 py-4 space-y-3 text-sm">
                <input type="hidden" id="edit-resena-id" />
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Nombre huésped</label>
                    <input type="text" id="edit-nombre" class="form-input w-full text-sm" />
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                    <select id="edit-estado" class="form-select w-full text-sm">
                        <option value="pendiente">Pendiente</option>
                        <option value="publicada">Publicada</option>
                        <option value="oculta">Oculta</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Puntuación general (1–5)</label>
                    <select id="edit-punt-general" class="form-select w-full text-sm"></select>
                </div>
                <details class="border border-gray-100 rounded-lg p-2">
                    <summary class="cursor-pointer text-xs font-medium text-gray-600">Dimensiones (opcional)</summary>
                    <div class="grid grid-cols-2 gap-2 mt-2">
                        ${['punt_limpieza', 'punt_ubicacion', 'punt_llegada', 'punt_comunicacion', 'punt_equipamiento', 'punt_valor'].map((k) => `
                        <div>
                            <label class="block text-xs text-gray-500 mb-0.5">${k.replace('punt_', '')}</label>
                            <select id="edit-${k}" class="form-select w-full text-xs punt-dim"></select>
                        </div>`).join('')}
                    </div>
                </details>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Texto positivo</label>
                    <textarea id="edit-texto-pos" rows="3" class="form-input w-full text-sm"></textarea>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Texto negativo / mejoras</label>
                    <textarea id="edit-texto-neg" rows="2" class="form-input w-full text-sm"></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t">
                    <button type="button" id="modal-edit-cancel" class="btn-outline text-sm">Cancelar</button>
                    <button type="submit" class="btn-primary text-sm">Guardar</button>
                </div>
            </form>
        </div>
    </div>`;
}

function _syncCacheResenas(rows) {
    window._cacheResenasById = Object.fromEntries((rows || []).map((x) => [String(x.id), x]));
}

function renderLista(resenas) {
    const el = document.getElementById('lista-resenas');
    if (!resenas?.length) {
        el.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">No hay reseñas con los filtros seleccionados.</p>';
        return;
    }
    el.innerHTML = resenas.map(renderTarjeta).join('');
}

function _paramsListaResenas() {
    const estado = document.getElementById('filtro-estado')?.value || '';
    const propiedadId = document.getElementById('filtro-propiedad')?.value || '';
    const q = document.getElementById('buscar-resenas')?.value?.trim() || '';
    const sort = document.getElementById('orden-resenas')?.value || 'created_at_desc';
    const params = new URLSearchParams();
    if (estado) params.set('estado', estado);
    if (propiedadId) params.set('propiedadId', propiedadId);
    if (q) params.set('q', q);
    if (sort) params.set('sort', sort);
    params.set('limit', '300');
    return params;
}

async function _recargar() {
    const data = await fetchAPI(`/resenas?${_paramsListaResenas()}`);
    _syncCacheResenas(data);
    renderLista(data);
}

async function _recargarResumenYLista() {
    const [nuevoResumen, nuevasResenas] = await Promise.all([
        fetchAPI('/resenas/resumen'),
        fetchAPI(`/resenas?${_paramsListaResenas()}`),
    ]);
    document.getElementById('resumen-kpis').innerHTML = renderResumenKPIs(nuevoResumen);
    _syncCacheResenas(nuevasResenas);
    renderLista(nuevasResenas);
}

function _fillSelectPunt(sel, current) {
    if (!sel) return;
    sel.innerHTML = '';
    for (let i = 1; i <= 5; i += 1) {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = String(i);
        const c = current != null ? Number(current) : null;
        if (c === i) o.selected = true;
        sel.appendChild(o);
    }
}

function _closeModalEdit() {
    const root = document.getElementById('modal-edit-resena');
    if (root) {
        root.classList.add('hidden');
        root.classList.remove('flex');
    }
}

export async function afterRender() {
    const paramsInicial = new URLSearchParams();
    paramsInicial.set('limit', '300');

    const [resumen, resenas, propiedades, canales] = await Promise.all([
        fetchAPI('/resenas/resumen'),
        fetchAPI(`/resenas?${paramsInicial}`),
        fetchAPI('/propiedades'),
        fetchAPI('/canales'),
    ]);

    document.getElementById('resumen-kpis').innerHTML = renderResumenKPIs(resumen);

    const sel = document.getElementById('filtro-propiedad');
    sel.innerHTML = '<option value="">Todos</option>';
    (propiedades || []).forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        sel.appendChild(opt);
    });

    _syncCacheResenas(resenas);
    renderLista(resenas);

    document.getElementById('btn-filtrar').addEventListener('click', () => _recargar());

    let searchTimer;
    document.getElementById('buscar-resenas')?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => _recargar(), 450);
    });
    document.getElementById('orden-resenas')?.addEventListener('change', () => _recargar());

    const modal = setupModalManual(canales || [], fetchAPI, _recargarResumenYLista);

    document.getElementById('btn-nueva-manual').addEventListener('click', () => modal.open());

    const modalAuto = setupModalAuto(fetchAPI, _recargarResumenYLista);
    document.getElementById('btn-generar-auto')?.addEventListener('click', () => modalAuto.open());

    window.abrirRespuesta = (id) => document.getElementById(`form-respuesta-${id}`)?.classList.remove('hidden');
    window.cerrarRespuesta = (id) => document.getElementById(`form-respuesta-${id}`)?.classList.add('hidden');

    window.guardarRespuesta = async (id) => {
        const textarea = document.querySelector(`#form-respuesta-${id} textarea`);
        const texto = textarea?.value?.trim();
        if (!texto) return;
        try {
            await fetchAPI(`/resenas/${id}/responder`, { method: 'PUT', body: { texto } });
            await _recargarResumenYLista();
        } catch (e) {
            alert('Error al guardar la respuesta: ' + e.message);
        }
    };

    window.cambiarEstado = async (id, estado) => {
        try {
            await fetchAPI(`/resenas/${id}/estado`, { method: 'PUT', body: { estado } });
            await _recargarResumenYLista();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    window.abrirEditarResena = (id) => {
        const r = window._cacheResenasById?.[String(id)];
        if (!r) {
            alert('Recarga la página e intenta de nuevo.');
            return;
        }
        document.getElementById('edit-resena-id').value = String(id);
        document.getElementById('edit-nombre').value = r.nombre_huesped || r.cliente_nombre || '';
        document.getElementById('edit-estado').value = r.estado || 'publicada';
        document.getElementById('edit-texto-pos').value = r.texto_positivo || '';
        document.getElementById('edit-texto-neg').value = r.texto_negativo || '';

        _fillSelectPunt(document.getElementById('edit-punt-general'), r.punt_general);

        const dims = ['punt_limpieza', 'punt_ubicacion', 'punt_llegada', 'punt_comunicacion', 'punt_equipamiento', 'punt_valor'];
        dims.forEach((k) => {
            _fillSelectPunt(document.getElementById(`edit-${k}`), r[k] ?? r.punt_general);
        });

        const root = document.getElementById('modal-edit-resena');
        root.classList.remove('hidden');
        root.classList.add('flex');
    };

    window.eliminarResena = async (id) => {
        if (!confirm('¿Eliminar esta reseña de forma permanente?')) return;
        try {
            await fetchAPI(`/resenas/${id}`, { method: 'DELETE' });
            await _recargarResumenYLista();
        } catch (e) {
            alert(e.message || 'No se pudo eliminar');
        }
    };

    document.getElementById('modal-edit-close')?.addEventListener('click', _closeModalEdit);
    document.getElementById('modal-edit-cancel')?.addEventListener('click', _closeModalEdit);

    document.getElementById('form-edit-resena')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const rid = document.getElementById('edit-resena-id').value;
        const body = {
            nombre_huesped: document.getElementById('edit-nombre').value?.trim() || null,
            estado: document.getElementById('edit-estado').value,
            texto_positivo: document.getElementById('edit-texto-pos').value?.trim() || null,
            texto_negativo: document.getElementById('edit-texto-neg').value?.trim() || null,
            punt_general: parseInt(document.getElementById('edit-punt-general').value, 10),
        };
        ['punt_limpieza', 'punt_ubicacion', 'punt_llegada', 'punt_comunicacion', 'punt_equipamiento', 'punt_valor'].forEach((k) => {
            const v = document.getElementById(`edit-${k}`)?.value;
            if (v !== undefined && v !== '') body[k] = parseInt(v, 10);
        });
        try {
            await fetchAPI(`/resenas/${rid}`, { method: 'PUT', body });
            _closeModalEdit();
            await _recargarResumenYLista();
        } catch (e) {
            alert(e.message || 'Error al guardar');
        }
    });
}
