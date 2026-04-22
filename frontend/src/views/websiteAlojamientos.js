/**
 * websiteAlojamientos.js — Contenido Web por Alojamiento
 * Ruta: /website-alojamientos
 *
 * FIX 2026-04-14: Botón "Cambiar portada" desaparecía cuando imágenes fallaban
 * Problema: El onerror de la imagen reemplazaba todo el innerHTML del contenedor padre,
 * eliminando el botón y el badge de porcentaje.
 * Solución: Cambiar onerror para ocultar imagen y mostrar placeholder oculto,
 * preservando todos los elementos hermanos (botón y badge).
 */
import { fetchAPI } from '../api.js';
import { renderWizard, bindWizard } from './components/configurarWebPublica/webPublica.wizard.js';
import { initPaso2 } from './components/configurarWebPublica/webPublica.paso2.fotos.js';
import { renderSelectorHtml } from './websiteAlojamientos.selector.js';
import { esc } from './websiteAlojamientos.utils.js';

// ─── Estado ───────────────────────────────────────────────────────────────────
let state = {
    propiedades: [],
    loading: false,
    error: null,
    // Wizard
    propiedadId: null,
    propiedadNombre: '',
    propiedadData: null,
    propiedadComponentes: [],
    fotoPlan: {},
    paso: 1,
};

// ─── Entry points ─────────────────────────────────────────────────────────────
export async function render() {
    return `<div id="wa-root" class="min-h-screen bg-gray-50"></div>`;
}

export async function afterRender() {
    state = {
        propiedades: [], loading: false, error: null,
        propiedadId: null, propiedadNombre: '', propiedadData: null,
        propiedadComponentes: [], fotoPlan: {}, paso: 1,
    };
    window.__waState = state;
    await cargarPropiedades();
    renderRoot();
}

// ─── Carga de datos ───────────────────────────────────────────────────────────
async function cargarPropiedades() {
    state.loading = true;
    try {
        // /propiedades ya incluye metadata completo (websiteData, fotoStats, componentes).
        // /galeria/counts aporta asignadas, pendientes y portadaUrl.
        const [props, galeriaCounts] = await Promise.all([
            fetchAPI('/propiedades'),
            fetchAPI('/galeria/counts').catch(() => ({}))
        ]);
        const lista = Array.isArray(props) ? props : (props.propiedades || []);

        state.propiedades = lista.map(p => ({
            ...p,
            galeriaStats: {
                ...(galeriaCounts[p.id] || { asignadas: 0, pendientes: 0 }),
                slotsTotal:     p.fotoStats?.slotsTotal     || 0,
                slotsCumplidos: p.fotoStats?.slotsCumplidos || 0,
            },
        }));
    } catch (err) {
        state.error = 'No se pudieron cargar los alojamientos.';
    } finally {
        state.loading = false;
    }
}

async function loadWizard(propiedadId) {
    state.loading = true;
    renderRoot();
    try {
        const prop       = state.propiedades.find(p => p.id === propiedadId);
        const [wd, plan, buildCtx, galeriaPorEspacio, galeriaFlat] = await Promise.all([
            fetchAPI(`/website/propiedad/${propiedadId}`),
            fetchAPI(`/website/propiedad/${propiedadId}/photo-plan`).catch(() => ({})),
            fetchAPI(`/website/propiedad/${propiedadId}/build-context`).catch(() => null),
            fetchAPI(`/galeria/${propiedadId}/por-espacio`).catch(() => ({})),
            fetchAPI(`/galeria/${propiedadId}`).catch(() => []),
        ]);
        state.propiedadId         = propiedadId;
        state.propiedadNombre     = prop?.nombre || '';
        state.propiedadData       = wd;
        state.propiedadComponentes = (prop?.componentes || []).map(c => ({
            id: c.id,
            nombre: c.nombre || c.nombreTipo || c.tipo || 'Espacio',
            tipo: c.tipo || c.nombreTipo || c.nombre || 'Espacio',
        }));
        state.fotoPlan    = plan || {};
        state.buildContext = buildCtx || null;
        state.paso        = 1;
        // Pre-inicializar el módulo galería (carga photo-plan IA) antes de llegar al paso 2
        // Priorizar fotos vivas de galería sobre el snapshot de websiteData
        const imagesPorEspacio = Object.keys(galeriaPorEspacio).length > 0
            ? galeriaPorEspacio
            : (wd.images || {});
        state.imagesPorEspacio = imagesPorEspacio || {};
        state.galeriaFlat = Array.isArray(galeriaFlat)
            ? galeriaFlat.filter((f) => f && f.estado !== 'descartada')
            : [];
        await initPaso2(propiedadId, imagesPorEspacio);
    } catch (err) {
        state.error = 'Error al cargar el alojamiento.';
        state.propiedadId = null;
    } finally {
        state.loading = false;
        renderRoot();
    }
}

// ─── Render root ──────────────────────────────────────────────────────────────
function renderRoot() {
    const root = document.getElementById('wa-root');
    if (!root) return;
    window.__waState = state;
    if (state.loading) {
        root.innerHTML = renderLoading();
        return;
    }
    if (state.propiedadId) {
        root.innerHTML = renderWizard(state);
        bindWizardCallbacks();
    } else {
        root.innerHTML = renderSelectorHtml(state);
        bindSelector();
    }
}

function bindSelector() {
    document.querySelectorAll('.btn-editar-contenido').forEach(btn => {
        btn.addEventListener('click', () => loadWizard(btn.dataset.id));
    });
    document.querySelectorAll('.btn-cambiar-portada').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirPortadaPicker(btn.dataset.id);
        });
    });

    document.querySelectorAll('[data-navigate]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            import('../router.js').then(m => m.handleNavigation(a.dataset.navigate));
        });
    });
}

async function abrirPortadaPicker(propiedadId) {
    document.getElementById('portada-picker-modal')?.remove();

    const prop = state.propiedades.find(p => p.id === propiedadId);
    const wd   = prop?.websiteData || {};

    // Siempre cargar desde galería completa + websiteData para no perder fotos
    let fotos = [];
    try {
        const [galeria, wdFresh] = await Promise.all([
            fetchAPI(`/galeria/${propiedadId}`),
            fetchAPI(`/website/propiedad/${propiedadId}`).catch(() => wd)
        ]);
        const fotosGaleria = Array.isArray(galeria)
            ? galeria.filter(f => f.estado !== 'descartada').map(f => ({
                imageId: f.id,
                storagePath: f.storageUrl || f.thumbnailUrl || '',
                altText: f.espacio || f.altText || ''
              }))
            : [];
        const fotosWebsite = Object.values(wdFresh?.images || wd.images || {}).flat();

        // Unir ambas fuentes deduplicando por imageId
        const mapaIds = new Set(fotosGaleria.map(f => f.imageId));
        const extras  = fotosWebsite.filter(f => !mapaIds.has(f.imageId));
        fotos = [...fotosGaleria, ...extras];
    } catch { alert('No se pudieron cargar las fotos.'); return; }

    if (!fotos.length) { alert('Este alojamiento no tiene fotos aún. Agrega fotos en la Galería o en el Paso 2.'); return; }
    _mostrarPortadaPickerModal(propiedadId, fotos, wd.cardImage?.imageId);
}

function _mostrarPortadaPickerModal(propiedadId, fotos, currentPortadaId, onSuccess = null) {
    const fotosHtml = fotos.map(img => `
        <button class="pp-foto relative rounded-xl overflow-hidden border-2 transition-all
            ${img.imageId === currentPortadaId ? 'border-primary-500 ring-2 ring-primary-200' : 'border-transparent hover:border-primary-300'}"
            data-image-id="${esc(img.imageId)}"
            data-storage-path="${esc(img.storagePath)}"
            data-alt="${esc(img.altText || '')}">
            <img src="${esc(img.storagePath)}" class="w-full h-24 object-cover bg-gray-100"
                onerror="this.src=''">
            ${img.imageId === currentPortadaId
                ? `<div class="absolute inset-0 bg-primary-500/20 flex items-end justify-center pb-1">
                       <span class="text-[10px] bg-primary-600 text-white px-1.5 py-0.5 rounded font-bold">Portada actual</span>
                   </div>` : ''}
        </button>`).join('');

    const html = `
    <div id="portada-picker-modal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden flex flex-col max-h-[80vh]">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <div>
                    <h3 class="font-semibold text-gray-900">Imagen de portada</h3>
                    <p class="text-xs text-gray-400 mt-0.5">Elige la foto que aparece en la tarjeta del alojamiento</p>
                </div>
                <button id="pp-close" class="btn-ghost text-xl leading-none"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="pp-status" class="hidden px-4 py-2 bg-primary-50 text-primary-700 text-xs flex items-center gap-2 flex-shrink-0">
                <i class="fa-solid fa-circle-notch fa-spin"></i> Guardando portada...
            </div>
            <div class="flex-1 overflow-y-auto p-4">
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">${fotosHtml}</div>
            </div>
            <div class="px-6 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
                <button id="pp-cancel" class="btn-ghost">Cancelar</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    const closeModal = () => document.getElementById('portada-picker-modal')?.remove();
    document.getElementById('pp-close').addEventListener('click', closeModal);
    document.getElementById('pp-cancel').addEventListener('click', closeModal);

    document.querySelector('#portada-picker-modal .grid').addEventListener('click', async (e) => {
        const btn = e.target.closest('.pp-foto');
        if (!btn) return;
        const imageId     = btn.dataset.imageId;
        const storagePath = btn.dataset.storagePath;
        const altText     = btn.dataset.alt;

        document.getElementById('pp-status').classList.remove('hidden');
        document.querySelectorAll('.pp-foto').forEach(b => b.disabled = true);

        try {
            await fetchAPI(`/website/propiedad/${propiedadId}/portada`, {
                method: 'PUT', body: { cardImage: { imageId, storagePath, altText } }
            });
            const cardImage = { imageId, storagePath, altText };
            if (onSuccess) {
                onSuccess(cardImage);
            } else {
                const prop = state.propiedades.find(p => p.id === propiedadId);
                if (prop) prop.websiteData.cardImage = cardImage;
                renderRoot();
            }
            closeModal();
        } catch (err) {
            document.getElementById('pp-status').classList.add('hidden');
            document.querySelectorAll('.pp-foto').forEach(b => b.disabled = false);
            alert('Error al guardar: ' + err.message);
        }
    });
}


// ─── Wizard callbacks ─────────────────────────────────────────────────────────
function bindWizardCallbacks() {
    bindWizard(state, {
        onBack:     () => { state.propiedadId = null; cargarPropiedades().then(() => renderRoot()); },
        onNextStep: () => { if (state.paso < 3) { state.paso++; renderRoot(); } },
        onPrevStep: () => { if (state.paso > 1) { state.paso--; renderRoot(); } },
        onGoToPaso: (n) => { state.paso = n; renderRoot(); },
        onFinish:   () => { state.propiedadId = null; cargarPropiedades().then(() => renderRoot()); },
        onCambiarPortada: async () => {
            const wd = state.propiedadData || {};
            let fotos = [];
            try {
                const [galeria] = await Promise.all([fetchAPI(`/galeria/${state.propiedadId}`)]);
                const fotosGaleria = Array.isArray(galeria)
                    ? galeria.filter(f => f.estado !== 'descartada').map(f => ({
                        imageId: f.id,
                        storagePath: f.storageUrl || f.thumbnailUrl || '',
                        altText: f.espacio || f.altText || ''
                      }))
                    : [];
                const fotosWebsite = Object.values(wd.images || {}).flat();
                const mapaIds = new Set(fotosGaleria.map(f => f.imageId));
                fotos = [...fotosGaleria, ...fotosWebsite.filter(f => !mapaIds.has(f.imageId))];
            } catch { alert('No se pudieron cargar las fotos.'); return; }
            if (!fotos.length) { alert('Este alojamiento no tiene fotos aún.'); return; }
            _mostrarPortadaPickerModal(state.propiedadId, fotos, wd.cardImage?.imageId, (cardImage) => {
                if (!state.propiedadData) state.propiedadData = {};
                state.propiedadData.cardImage = cardImage;
                renderRoot();
            });
        },
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function renderLoading() {
    return `
    <div class="flex flex-col items-center justify-center min-h-screen text-gray-400">
        <svg class="animate-spin h-8 w-8 mb-4 text-primary-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <p class="text-sm">Cargando alojamientos...</p>
    </div>`;
}

