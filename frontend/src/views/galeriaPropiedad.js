/**
 * galeriaPropiedad.js — Galería de Fotos
 * Ruta: /galeria-propiedad
 */
import { fetchAPI } from '../api.js';
import { openLightbox, openEditor } from './components/galeria/galeria.editor.js';

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
    propiedades: [], counts: {}, propiedadId: null, propiedadNombre: '',
    componentes: [], fotos: [], tab: 'auto',
    loading: false, syncing: false, error: null,
    uploadTotal: 0, uploadActual: 0, uploadNombre: '',
};
let uploadOverlay = null;

// ─── Entry points ─────────────────────────────────────────────────────────────
export async function render() {
    return `<div id="galeria-root" class="min-h-screen bg-gray-50"></div>`;
}

export async function afterRender() {
    state = {
        propiedades: [], counts: {}, propiedadId: null, propiedadNombre: '',
        componentes: [], fotos: [], tab: 'auto',
        loading: false, syncing: false, error: null,
        uploadTotal: 0, uploadActual: 0, uploadNombre: '',
    };
    uploadOverlay = null;
    await cargarPropiedades();
    renderRoot();
}

// ─── Carga de datos ───────────────────────────────────────────────────────────
async function cargarPropiedades() {
    try {
        const [data, counts] = await Promise.all([
            fetchAPI('/propiedades'),
            fetchAPI('/galeria/counts').catch(() => ({}))
        ]);
        state.propiedades = Array.isArray(data) ? data : (data.propiedades || []);
        state.counts = counts || {};
    } catch {
        state.error = 'No se pudieron cargar las propiedades.';
    }
}

async function cargarGaleria(propiedadId) {
    state.loading = true; state.error = null;
    renderRoot();
    try {
        state.fotos = await fetchAPI(`/galeria/${propiedadId}`);
        const prop = state.propiedades.find(p => p.id === propiedadId);
        state.componentes = (prop?.componentes || []).map(c => ({
            id: c.id, nombre: c.nombre || c.nombreTipo || c.tipo || 'Espacio'
        }));
    } catch {
        state.error = 'Error al cargar la galería.'; state.fotos = [];
    } finally {
        state.loading = false; renderRoot();
    }
}

// ─── Render root ──────────────────────────────────────────────────────────────
function renderRoot() {
    const root = document.getElementById('galeria-root');
    if (!root) return;
    root.innerHTML = state.propiedadId ? renderGaleria() : renderSelector();
    state.propiedadId ? bindGaleria() : bindSelector();
}

// ─── Selector de propiedad ────────────────────────────────────────────────────
function renderSelector() {
    const totalFotos = Object.values(state.counts)
        .reduce((s, c) => s + c.asignadas + c.pendientes, 0);

    const cards = state.propiedades.map(p => {
        const cnt   = state.counts[p.id] || { asignadas: 0, pendientes: 0, descartadas: 0, portadaUrl: null };
        const total = cnt.asignadas + cnt.pendientes + cnt.descartadas;
        const imgHtml = cnt.portadaUrl
            ? `<img src="${esc(cnt.portadaUrl)}" class="w-full h-full object-cover" loading="lazy"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : '';
        const placeholderStyle = cnt.portadaUrl ? 'display:none' : '';
        return `
        <button class="prop-card group text-left bg-white rounded-2xl border-2 border-gray-100
                hover:border-primary-300 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col"
                data-id="${esc(p.id)}" data-nombre="${esc(p.nombre)}">
            <div class="relative h-32 bg-gray-100 overflow-hidden flex-shrink-0">
                ${imgHtml}
                <div class="w-full h-full flex-col items-center justify-center text-gray-300"
                     style="${placeholderStyle}; display:${cnt.portadaUrl ? 'none' : 'flex'}">
                    <svg class="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span class="text-xs">Sin fotos</span>
                </div>
                ${total > 0 ? `<div class="absolute bottom-2 right-2 bg-black/55 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full font-medium">${total} fotos</div>` : ''}
            </div>
            <div class="p-4 flex flex-col gap-2 flex-1">
                <div>
                    <h3 class="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors truncate">${esc(p.nombre)}</h3>
                    <p class="text-xs text-gray-400 mt-0.5">${(p.componentes || []).length} espacio(s) · Cap. ${p.capacidad || '—'}</p>
                </div>
                <div class="flex items-center gap-3 flex-wrap min-h-[18px]">
                    ${cnt.asignadas  > 0 ? `<span class="flex items-center gap-1 text-xs text-success-700"><span class="h-1.5 w-1.5 rounded-full bg-success-400 flex-shrink-0"></span>${cnt.asignadas} asignadas</span>` : ''}
                    ${cnt.pendientes > 0 ? `<span class="flex items-center gap-1 text-xs text-warning-700"><span class="h-1.5 w-1.5 rounded-full bg-warning-400 flex-shrink-0"></span>${cnt.pendientes} pendientes</span>` : ''}
                    ${cnt.descartadas > 0 ? `<span class="flex items-center gap-1 text-xs text-danger-600"><span class="h-1.5 w-1.5 rounded-full bg-danger-300 flex-shrink-0"></span>${cnt.descartadas} descartadas</span>` : ''}
                    ${total === 0 ? `<span class="text-xs text-gray-300">Sin fotos aún</span>` : ''}
                </div>
                <div class="flex items-center gap-1.5 mt-auto pt-2 border-t border-gray-50">
                    <span class="text-xs text-primary-600 font-medium">Ver galería</span>
                    <i class="fa-solid fa-arrow-right text-[10px] text-primary-400"></i>
                </div>
            </div>
        </button>`;
    }).join('');

    return `
    <div class="max-w-5xl mx-auto py-10 px-4">
        <div class="mb-8">
            <div class="flex items-center gap-3 mb-1">
                <div class="h-9 w-9 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600"><i class="fa-solid fa-images"></i></div>
                <h1 class="text-2xl font-bold text-gray-900">Galería de Fotos</h1>
            </div>
            <p class="text-gray-500 text-sm ml-12">Selecciona una propiedad para gestionar sus fotos</p>
        </div>
        ${state.error ? `<div class="bg-danger-50 border border-danger-200 text-danger-700 rounded-xl p-4 mb-6 text-sm flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation flex-shrink-0"></i>${state.error}</div>` : ''}
        <div class="grid grid-cols-3 gap-4 mb-8">
            ${stat('fa-solid fa-house', state.propiedades.length, 'Propiedades', 'primary')}
            ${stat('fa-solid fa-check-circle', state.propiedades.reduce((s, p) => s + (p.componentes?.length || 0), 0), 'Espacios totales', 'success')}
            ${stat('fa-solid fa-images', totalFotos || '—', 'Fotos clasificadas', 'warning')}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            ${cards || '<p class="text-gray-400 col-span-4 text-center py-10">No hay propiedades disponibles.</p>'}
        </div>
    </div>`;
}

function stat(faIcon, val, label, color) {
    return `
    <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-${color}-50 flex items-center justify-center text-${color}-500"><i class="${faIcon}"></i></div>
        <div><p class="text-2xl font-bold text-gray-900">${val}</p><p class="text-xs text-gray-500">${label}</p></div>
    </div>`;
}

function bindSelector() {
    document.querySelectorAll('.prop-card').forEach(card => {
        card.addEventListener('click', () => {
            state.propiedadId    = card.dataset.id;
            state.propiedadNombre = card.dataset.nombre;
            state.tab = 'auto';
            cargarGaleria(state.propiedadId);
        });
    });
}

// ─── Vista de galería ─────────────────────────────────────────────────────────
function renderGaleria() {
    const counts = {
        auto:       state.fotos.filter(f => f.estado === 'auto' || f.estado === 'manual').length,
        pendiente:  state.fotos.filter(f => f.estado === 'pendiente').length,
        descartada: state.fotos.filter(f => f.estado === 'descartada').length,
    };
    const fotosVisibles = state.tab === 'auto'
        ? state.fotos.filter(f => f.estado === 'auto' || f.estado === 'manual')
        : state.fotos.filter(f => f.estado === state.tab);

    return `
    <div class="max-w-7xl mx-auto py-6 px-4">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div class="flex items-center gap-3 flex-1 min-w-0">
                <button id="btn-cambiar-prop"
                    class="flex-shrink-0 h-9 w-9 rounded-xl bg-white border border-gray-200 hover:border-primary-300 flex items-center justify-center text-gray-500 hover:text-primary-600 transition-colors shadow-sm">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div class="min-w-0">
                    <h2 class="text-xl font-bold text-gray-900 truncate">${esc(state.propiedadNombre)}</h2>
                    <p class="text-xs text-gray-400">${state.fotos.length} foto(s) · Imágenes optimizadas WebP</p>
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <label class="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50 text-sm font-medium text-gray-600 hover:text-primary-700 transition-all cursor-pointer shadow-sm">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                    </svg>
                    Subir fotos
                    <input type="file" id="input-upload-galeria" multiple accept="image/*" class="hidden">
                </label>
                <button id="btn-sync"
                    class="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm
                        ${state.syncing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'btn-primary hover:shadow-md'}">
                    ${state.syncing
                        ? `<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Sincronizando...`
                        : `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Sincronizar`}
                </button>
            </div>
        </div>

        ${state.error ? `
        <div class="bg-danger-50 border border-danger-200 text-danger-700 rounded-xl p-3 mb-4 text-sm flex items-center gap-2">
            <i class="fa-solid fa-triangle-exclamation flex-shrink-0"></i>${state.error}
            <button class="ml-auto text-danger-400 hover:text-danger-600" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
        </div>` : ''}

        <div class="flex items-center gap-2 mb-5 flex-wrap">
            ${tab('auto',       counts.auto,       'success')}
            ${tab('pendiente',  counts.pendiente,  'warning')}
            <!-- Pestaña "Descartadas" eliminada porque las fotos se eliminan permanentemente -->
        </div>

        ${state.loading ? renderLoading()
            : fotosVisibles.length === 0 ? renderEmpty()
            : `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                ${fotosVisibles.map(f => renderFotoCard(f)).join('')}
               </div>`}
    </div>`;
}

function tab(key, count, color) {
    const active  = state.tab === key;
    const labels  = { auto: 'Asignadas', pendiente: 'Pendientes' };
    const dots    = { success: 'bg-success-400', warning: 'bg-warning-400', danger: 'bg-danger-300' };
    return `
    <button class="tab-btn flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
        ${active ? 'bg-white shadow-sm border border-gray-200 text-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-white/60'}"
        data-tab="${key}">
        <span class="h-2 w-2 rounded-full ${dots[color]} flex-shrink-0"></span>
        ${labels[key]}
        <span class="text-xs px-1.5 py-0.5 rounded-full font-semibold
            ${active ? 'bg-gray-100 text-gray-700' : 'bg-gray-100/50 text-gray-400'}">${count}</span>
    </button>`;
}

function renderLoading() {
    return `
    <div class="flex flex-col items-center justify-center py-24 text-gray-400">
        <svg class="animate-spin h-8 w-8 mb-4 text-primary-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p class="text-sm">Cargando galería...</p>
    </div>`;
}

function renderEmpty() {
    const msgs = {
        auto:       { icon: 'fa-solid fa-images',    title: 'No hay fotos asignadas',   sub: 'Confirma fotos desde la pestaña Pendientes.' },
        pendiente:  { icon: 'fa-solid fa-check',     title: 'Sin fotos pendientes',     sub: '¡Excelente! Todas las fotos fueron clasificadas.' },
        // descartada eliminada porque las fotos se eliminan permanentemente
    };
    const m = msgs[state.tab] || msgs.auto;
    return `
    <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="h-16 w-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
            <i class="${m.icon} text-2xl text-gray-300"></i>
        </div>
        <p class="font-medium text-gray-700">${m.title}</p>
        <p class="text-sm text-gray-400 mt-1">${m.sub}</p>
    </div>`;
}

function renderFotoCard(foto) {
    const imgSrc    = foto.thumbnailUrl || foto.storageUrl || '';
    const conf      = Math.round((foto.confianza || 0) * 100);
    const confBg    = conf >= 80 ? 'bg-success-500' : conf >= 50 ? 'bg-warning-500' : 'bg-danger-400';
    const isPortada = foto.rol === 'portada';
    const espacioOpts = state.componentes.map(c =>
        `<option value="${esc(c.id)}" ${foto.espacioId === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`
    ).join('');

    return `
    <div class="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm
                hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
         data-foto-id="${foto.id}">
        <div class="relative overflow-hidden">
            <img src="${esc(imgSrc)}" alt="${esc(foto.altText || '')}"
                class="w-full h-36 object-cover bg-gray-100 group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 160 120%22><rect fill=%22%23f3f4f6%22 width=%22160%22 height=%22120%22/><text x=%2280%22 y=%2265%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2210%22>Sin imagen</text></svg>'">

            <!-- Badge confianza -->
            <div class="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
                <span class="h-1.5 w-1.5 rounded-full ${confBg}"></span>
                <span class="text-white text-[10px] font-medium">${conf}%</span>
            </div>
            ${isPortada ? `<div class="absolute top-2 right-2 bg-warning-500 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><i class="fa-solid fa-star text-[9px]"></i> Portada</div>` : ''}

            <!-- Overlay hover -->
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2">
                <div class="flex items-center gap-1.5">
                    <button class="btn-zoom px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium backdrop-blur-sm transition-colors flex items-center gap-1"
                        data-foto-id="${foto.id}"><i class="fa-solid fa-magnifying-glass"></i> Ampliar</button>
                    <button class="btn-edit px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium backdrop-blur-sm transition-colors flex items-center gap-1"
                        data-foto-id="${foto.id}"><i class="fa-solid fa-pen"></i> Editar</button>
                </div>
                <div class="flex items-center gap-1.5">
                    ${foto.estado === 'pendiente' ? `
                    <button class="btn-confirmar flex items-center gap-1 px-3 py-1.5 bg-success-500 hover:bg-success-600 text-white rounded-lg text-xs font-medium shadow transition-colors"
                        data-foto-id="${foto.id}">
                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                        Confirmar
                    </button>` : ''}
                    ${foto.estado !== 'descartada' ? `
                    <button class="btn-descartar flex items-center gap-1 px-3 py-1.5 bg-white/90 hover:bg-danger-50 text-gray-600 hover:text-danger-600 rounded-lg text-xs font-medium shadow transition-colors"
                        data-foto-id="${foto.id}">
                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        Descartar
                    </button>` : `
                    <button class="btn-eliminar-permanentemente flex items-center gap-1 px-3 py-1.5 bg-danger-500 hover:bg-danger-600 text-white rounded-lg text-xs font-medium shadow transition-colors"
                        data-foto-id="${foto.id}"><i class="fa-solid fa-trash"></i> Eliminar permanentemente</button>`}
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="px-2.5 py-2">
            <div class="flex items-center justify-between mb-1.5">
                <p class="text-[10px] text-gray-400 truncate flex-1">${esc(foto.espacio || foto.altText || 'Sin clasificar')}</p>
                <button class="btn-portada flex-shrink-0 ml-1 leading-none transition-colors
                    ${isPortada ? 'text-warning-400' : 'text-gray-200 hover:text-warning-300'}"
                    data-foto-id="${foto.id}" title="${isPortada ? 'Es portada' : 'Marcar como portada'}">
                    <i class="fa-solid fa-star text-sm"></i>
                </button>
            </div>
            <select class="foto-espacio-sel w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50
                    focus:outline-none focus:ring-1 focus:ring-primary-400 text-gray-600"
                    data-foto-id="${foto.id}">
                <option value="">— Sin espacio —</option>
                ${espacioOpts}
            </select>
        </div>
    </div>`;
}

// ─── Bind galería ─────────────────────────────────────────────────────────────
function bindGaleria() {
    document.getElementById('btn-cambiar-prop')?.addEventListener('click', () => {
        state.propiedadId = null; state.fotos = []; renderRoot();
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => { state.tab = btn.dataset.tab; renderRoot(); });
    });
    document.getElementById('btn-sync')?.addEventListener('click', handleSync);
    document.getElementById('input-upload-galeria')?.addEventListener('change', handleUpload);

    document.querySelectorAll('.foto-espacio-sel').forEach(sel => {
        sel.addEventListener('change', async () => {
            const comp = state.componentes.find(c => c.id === sel.value);
            await patchFoto(sel.dataset.fotoId, { espacio: comp?.nombre || null, espacioId: sel.value || null });
        });
    });
    document.querySelectorAll('.btn-confirmar').forEach(btn => {
        btn.addEventListener('click', async () => {
            await fetchAPI(`/galeria/${state.propiedadId}/${btn.dataset.fotoId}/confirmar`, { method: 'POST' });
            actualizarLocal(btn.dataset.fotoId, { estado: 'auto', confianza: 1.0 });
            renderRoot();
        });
    });
    document.querySelectorAll('.btn-descartar').forEach(btn => {
        btn.addEventListener('click', async () => {
            const fotoId = btn.dataset.fotoId;
            if (!confirm('¿Estás seguro de que quieres descartar esta foto?\n\nLa foto será eliminada permanentemente del storage y de la base de datos.')) {
                return;
            }
            try {
                await fetchAPI(`/galeria/${state.propiedadId}/${fotoId}`, { method: 'DELETE' });
                // Eliminar localmente del estado (eliminación completa, no soft delete)
                state.fotos = state.fotos.filter(f => f.id !== fotoId);
                renderRoot();
            } catch (error) {
                console.error('Error descartando foto:', error);
                alert('Error al descartar la foto: ' + error.message);
            }
        });
    });
    document.querySelectorAll('.btn-eliminar-permanentemente').forEach(btn => {
        btn.addEventListener('click', async () => {
            const fotoId = btn.dataset.fotoId;
            if (!confirm('¿Estás seguro de que quieres eliminar esta foto permanentemente?\n\nEsta acción no se puede deshacer. La foto será eliminada del storage y de la base de datos.')) {
                return;
            }
            try {
                await fetchAPI(`/galeria/${state.propiedadId}/${fotoId}`, { method: 'DELETE' });
                // Eliminar localmente del estado
                state.fotos = state.fotos.filter(f => f.id !== fotoId);
                renderRoot();
            } catch (error) {
                console.error('Error eliminando foto:', error);
                alert('Error al eliminar la foto: ' + error.message);
            }
        });
    });
    document.querySelectorAll('.btn-portada').forEach(btn => {
        btn.addEventListener('click', async () => {
            const fotoId = btn.dataset.fotoId;
            await fetchAPI(`/galeria/${state.propiedadId}/${fotoId}/portada`, { method: 'POST' });
            state.fotos.forEach(f => {
                f.rol = f.id === fotoId ? 'portada' : (f.rol === 'portada' ? 'adicional' : f.rol);
            });
            renderRoot();
        });
    });
    document.querySelectorAll('.btn-zoom').forEach(btn => {
        btn.addEventListener('click', () => {
            const foto = state.fotos.find(f => f.id === btn.dataset.fotoId);
            if (foto) openLightbox(foto, state.propiedadId, onFotoSaved);
        });
    });
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const foto = state.fotos.find(f => f.id === btn.dataset.fotoId);
            if (foto) openEditor(foto, state.propiedadId, onFotoSaved);
        });
    });
}

function onFotoSaved(fotoId, result) {
    if (result?.storageUrl) actualizarLocal(fotoId, { storageUrl: result.storageUrl, thumbnailUrl: result.thumbnailUrl });
    renderRoot();
}

// ─── Upload overlay centrado ──────────────────────────────────────────────────
function showUploadOverlay() {
    if (uploadOverlay) return;
    uploadOverlay = document.createElement('div');
    uploadOverlay.id        = 'galeria-upload-overlay';
    uploadOverlay.className = 'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center';
    document.body.appendChild(uploadOverlay);
    updateUploadOverlay();
}

function updateUploadOverlay() {
    if (!uploadOverlay) return;
    const pct = Math.round((state.uploadActual / state.uploadTotal) * 100);
    uploadOverlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl p-6 w-[340px]">
            <div class="flex items-center gap-3 mb-5">
                <svg class="animate-spin h-6 w-6 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <p class="font-semibold text-gray-900">Subiendo fotos...</p>
            </div>
            <div class="flex justify-between items-baseline mb-2">
                <span class="text-sm text-gray-500">
                    Archivo <strong class="text-gray-800">${state.uploadActual}</strong>
                    de <strong class="text-gray-800">${state.uploadTotal}</strong>
                </span>
                <span class="text-3xl font-bold text-primary-600">${pct}%</span>
            </div>
            <div class="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div class="h-full bg-primary-500 rounded-full transition-all duration-300" style="width:${pct}%"></div>
            </div>
            <p class="text-xs text-gray-400 truncate flex items-center gap-1.5"><i class="fa-solid fa-file-image flex-shrink-0"></i>${esc(state.uploadNombre)}</p>
        </div>`;
}

function hideUploadOverlay() {
    if (uploadOverlay) { uploadOverlay.remove(); uploadOverlay = null; }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────
async function handleUpload(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    state.uploadTotal = files.length; state.uploadActual = 0; state.error = null;
    showUploadOverlay();
    for (let i = 0; i < files.length; i++) {
        state.uploadActual = i + 1;
        state.uploadNombre = files[i].name;
        updateUploadOverlay();
        try {
            const fd = new FormData();
            fd.append('images', files[i]);
            const nuevas = await fetchAPI(`/galeria/${state.propiedadId}/upload`, { method: 'POST', body: fd });
            if (Array.isArray(nuevas)) state.fotos.push(...nuevas);
        } catch { state.error = `Error al subir: ${files[i].name}`; }
    }
    hideUploadOverlay();
    state.uploadTotal = 0; state.uploadActual = 0; state.uploadNombre = '';
    state.tab = 'pendiente';
    renderRoot();
}

async function handleSync() {
    if (state.syncing) return;
    state.syncing = true; state.error = null; renderRoot();
    try {
        const result = await fetchAPI(`/galeria/${state.propiedadId}/sync`, { method: 'POST' });
        state.syncing = false;
        const btn = document.getElementById('btn-sync');
        if (btn) {
            btn.innerHTML = `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> ${result.total} sincronizadas`;
            btn.classList.remove('btn-primary'); btn.classList.add('bg-success-600', 'text-white');
            setTimeout(() => renderRoot(), 3000);
        }
    } catch { state.error = 'Error al sincronizar.'; state.syncing = false; renderRoot(); }
}

async function patchFoto(fotoId, updates) {
    try {
        await fetchAPI(`/galeria/${state.propiedadId}/${fotoId}`, { method: 'PATCH', body: updates });
        actualizarLocal(fotoId, updates);
        renderRoot();
    } catch { state.error = 'Error al actualizar la foto.'; renderRoot(); }
}

function actualizarLocal(fotoId, updates) {
    const foto = state.fotos.find(f => f.id === fotoId);
    if (foto) Object.assign(foto, updates);
}

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
