import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { renderGrupos } from './components/gestionDiaria/gestionDiaria.cards.js';
import { openManagementModal, initializeModals } from './components/gestionDiaria/gestionDiaria.modals.js';

let allGrupos = [];
let currentUserEmail = '';
// Se eliminan las variables de paginación por ahora
// let hasMore = true;
// let lastVisible = null;
let isLoading = false;

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <h2 class="text-2xl font-semibold text-gray-900">Panel de Gestión Diaria</h2>
                <input type="text" id="search-input" placeholder="Buscar por nombre, reserva, teléfono..." class="mt-4 md:mt-0 form-input md:w-1/3">
            </div>
            
            <div id="diagnostico-container"><h3 class="text-xl font-bold text-purple-600 mb-4 border-b pb-2">Todas las Reservas (Modo de Diagnóstico)</h3><div id="diagnostico-list" class="space-y-4"></div></div>

            <div id="loading-state" class="text-center py-8"><p class="text-gray-500">Cargando tareas pendientes...</p></div>
            <div id="no-pendientes" class="text-center py-12 hidden"><p class="text-2xl font-semibold text-green-600">No se encontraron reservas.</p></div>
        </div>
        
        <div id="gestion-modal" class="modal hidden">
            <div class="modal-content !max-w-3xl">
                <h3 id="modal-title" class="text-xl font-semibold mb-4"></h3>
                <div id="modal-content-container" class="space-y-4 max-h-[70vh] overflow-y-auto pr-4"></div>
                <button type="button" id="modal-cancel-btn" class="btn-secondary w-full mt-4">Cerrar</button>
            </div>
        </div>

        <div id="bitacora-modal" class="modal hidden">
            <div class="modal-content !max-w-2xl">
                <h3 id="bitacora-modal-title" class="text-xl font-semibold mb-4">Bitácora de Gestión</h3>
                <div id="bitacora-list" class="max-h-60 overflow-y-auto space-y-3 mb-4 pr-2"></div>
                <div class="border-t pt-4">
                    <textarea id="bitacora-new-note" rows="3" class="form-input" placeholder="Añadir nueva nota..."></textarea>
                    <div id="bitacora-status" class="text-sm mt-2"></div>
                    <div class="mt-2 flex justify-end space-x-3">
                        <button type="button" id="bitacora-cancel-btn" class="btn-secondary">Cerrar</button>
                        <button type="button" id="bitacora-save-btn" class="btn-primary">Guardar Nota</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="image-viewer-modal" class="modal hidden items-center justify-center">
            <img id="image-viewer-src" src="" class="max-w-[90vw] max-h-[90vh] object-contain">
            <button id="image-viewer-close" class="absolute top-4 right-4 text-white text-4xl font-bold">&times;</button>
        </div>
    `;
}

async function loadAndRender() {
    if (isLoading) return;
    isLoading = true;

    const loadingState = document.getElementById('loading-state');
    const noPendientesEl = document.getElementById('no-pendientes');

    loadingState.classList.remove('hidden');
    allGrupos = []; 

    try {
        if (!currentUserEmail) {
            const user = await fetchAPI('/auth/me');
            currentUserEmail = user.email;
        }

        // Llamada a la API sin paginación
        const data = await fetchAPI('/gestion/pendientes', { method: 'POST' });

        allGrupos = data.grupos;
        
        renderGrupos(allGrupos);
        
        noPendientesEl.classList.toggle('hidden', allGrupos.length > 0);

    } catch(error) {
        loadingState.innerHTML = `<p class="text-red-500">Error al cargar las gestiones: ${error.message}</p>`;
    } finally {
        isLoading = false;
        loadingState.classList.add('hidden');
    }
}

function handleCardButtonClick(e) {
    const target = e.target.closest('.gestion-btn, .revert-btn');
    if (!target) return;

    const card = target.closest('div[id^="card-"]');
    if (!card) return;

    const reservaIdOriginal = card.id.replace('card-', '');
    const currentGrupo = allGrupos.find(g => g.reservaIdOriginal === reservaIdOriginal);
    if (!currentGrupo) return;
    
    if (target.classList.contains('gestion-btn')) {
        openManagementModal(target.dataset.gestion, currentGrupo);
    }
    
    if (target.classList.contains('revert-btn')) {
        openManagementModal('revertir_estado', currentGrupo);
    }
}

export async function afterRender() {
    await loadAndRender();

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        const filtro = searchInput.value.toLowerCase();
        if (filtro) {
            const gruposFiltrados = allGrupos.filter(g => 
                g.clienteNombre.toLowerCase().includes(filtro) ||
                g.reservaIdOriginal.toLowerCase().includes(filtro) ||
                (g.telefono && g.telefono.includes(filtro))
            );
            renderGrupos(gruposFiltrados);
        } else {
            renderGrupos(allGrupos);
        }
    });
    
    document.getElementById('diagnostico-list').addEventListener('click', handleCardButtonClick);
    
    initializeModals(() => loadAndRender(), currentUserEmail);
}