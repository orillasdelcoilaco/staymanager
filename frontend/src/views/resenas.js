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
                <button class="btn-outline text-xs py-1 px-3" onclick="abrirRespuesta('${r.id}')">
                    ${r.respuesta_texto ? 'Editar respuesta' : 'Responder'}
                </button>
                ${r.estado !== 'publicada' ? `<button class="btn-success text-xs py-1 px-3" onclick="cambiarEstado('${r.id}', 'publicada')">Publicar</button>` : ''}
                ${r.estado !== 'oculta'    ? `<button class="btn-ghost text-xs py-1 px-3" onclick="cambiarEstado('${r.id}', 'oculta')">Ocultar</button>` : ''}
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
                    <button id="btn-filtrar" class="btn-primary text-sm">Filtrar</button>
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
        ${renderModalAuto()}`;
}

function renderLista(resenas) {
    const el = document.getElementById('lista-resenas');
    if (!resenas?.length) {
        el.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">No hay reseñas con los filtros seleccionados.</p>';
        return;
    }
    el.innerHTML = resenas.map(renderTarjeta).join('');
}

async function _recargar() {
    const estado = document.getElementById('filtro-estado')?.value || '';
    const propiedadId = document.getElementById('filtro-propiedad')?.value || '';
    const params = new URLSearchParams();
    if (estado) params.set('estado', estado);
    if (propiedadId) params.set('propiedadId', propiedadId);
    const data = await fetchAPI(`/resenas?${params}`);
    renderLista(data);
}

export async function afterRender() {
    const [resumen, resenas, propiedades, canales] = await Promise.all([
        fetchAPI('/resenas/resumen'),
        fetchAPI('/resenas'),
        fetchAPI('/propiedades'),
        fetchAPI('/canales'),
    ]);

    document.getElementById('resumen-kpis').innerHTML = renderResumenKPIs(resumen);

    const sel = document.getElementById('filtro-propiedad');
    sel.innerHTML = '<option value="">Todos</option>';
    (propiedades || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        sel.appendChild(opt);
    });

    renderLista(resenas);

    document.getElementById('btn-filtrar').addEventListener('click', _recargar);

    const modal = setupModalManual(canales || [], fetchAPI, async () => {
        const [nuevoResumen, nuevasResenas] = await Promise.all([
            fetchAPI('/resenas/resumen'),
            fetchAPI('/resenas'),
        ]);
        document.getElementById('resumen-kpis').innerHTML = renderResumenKPIs(nuevoResumen);
        renderLista(nuevasResenas);
    });

    document.getElementById('btn-nueva-manual').addEventListener('click', () => modal.open());

    const modalAuto = setupModalAuto(fetchAPI, async () => {
        const [nuevoResumen, nuevasResenas] = await Promise.all([
            fetchAPI('/resenas/resumen'),
            fetchAPI('/resenas'),
        ]);
        document.getElementById('resumen-kpis').innerHTML = renderResumenKPIs(nuevoResumen);
        renderLista(nuevasResenas);
    });
    document.getElementById('btn-generar-auto')?.addEventListener('click', () => modalAuto.open());

    window.abrirRespuesta  = (id) => document.getElementById(`form-respuesta-${id}`)?.classList.remove('hidden');
    window.cerrarRespuesta = (id) => document.getElementById(`form-respuesta-${id}`)?.classList.add('hidden');

    window.guardarRespuesta = async (id) => {
        const textarea = document.querySelector(`#form-respuesta-${id} textarea`);
        const texto = textarea?.value?.trim();
        if (!texto) return;
        try {
            await fetchAPI(`/resenas/${id}/responder`, { method: 'PUT', body: { texto } });
            await _recargar();
        } catch (e) {
            alert('Error al guardar la respuesta: ' + e.message);
        }
    };

    window.cambiarEstado = async (id, estado) => {
        try {
            await fetchAPI(`/resenas/${id}/estado`, { method: 'PUT', body: { estado } });
            await _recargar();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };
}
