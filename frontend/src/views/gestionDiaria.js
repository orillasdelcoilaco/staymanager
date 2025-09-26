import { fetchAPI } from '../api.js'; // <-- RUTA CORREGIDA
import { handleNavigation } from '../router.js'; // <-- RUTA CORREGIDA
import { renderGrupos } from './components/gestionDiaria/gestionDiaria.cards.js';
import { openManagementModal, initializeModals, openRevertModal, openBitacoraModal } from './components/gestionDiaria/gestionDiaria.modals.js';

let allGrupos = [];
let currentUserEmail = '';

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <h2 class="text-2xl font-semibold text-gray-900">Panel de Gestión Diaria</h2>
                <input type="text" id="search-input" placeholder="Buscar por nombre, reserva, teléfono..." class="mt-4 md:mt-0 form-input md:w-1/3">
            </div>
            <div id="loading-state" class="text-center py-8"><p class="text-gray-500">Cargando tareas pendientes...</p></div>
            <div id="hoy-container" class="hidden"><h3 class="text-xl font-bold text-red-600 mb-4 border-b pb-2">Requiere Acción Inmediata (Llegadas de hoy o pasadas)</h3><div id="hoy-list" class="space-y-4"></div></div>
            <div id="proximas-container" class="mt-8 hidden"><h3 class="text-xl font-semibold text-blue-600 mb-4 border-b pb-2">Próximas Llegadas</h3><div id="proximas-list" class="space-y-4"></div></div>
            <div id="no-pendientes" class="text-center py-12 hidden"><p class="text-2xl font-semibold text-green-600">¡Todo al día!</p><p class="text-gray-500 mt-2">No hay reservas con gestiones pendientes.</p></div>
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
    const loadingState = document.getElementById('loading-state');
    try {
        const user = await fetchAPI('/auth/me');
        currentUserEmail = user.email;
        allGrupos = await fetchAPI('/gestion/pendientes');
        loadingState.classList.add('hidden');
        renderGrupos(allGrupos);
    } catch(error) {
        loadingState.innerHTML = `<p class="text-red-500">Error al cargar las gestiones: ${error.message}</p>`;
    }
}

function handleCardButtonClick(e) {
    const target = e.target;
    // --- INICIO DE LA CORRECCIÓN ---
    // Se corrige el selector para que busque el elemento con el ID que empieza con 'card-'
    const card = target.closest('div[id^="card-"]');
    // --- FIN DE LA CORRECCIÓN ---
    if (!card) return;

    const reservaIdOriginal = card.id.replace('card-', '');
    const currentGrupo = allGrupos.find(g => g.reservaIdOriginal === reservaIdOriginal);
    if (!currentGrupo) return;
    
    if (target.classList.contains('gestion-btn')) {
        // --- INICIO DE LA CORRECCIÓN ---
        // Se elimina el paso de 'loadAndRender' y 'currentUserEmail' de aquí, ya que se maneja en 'initializeModals'
        openManagementModal(target.dataset.gestion, currentGrupo);
        // --- FIN DE LA CORRECCIÓN ---
    }
    
    if (target.classList.contains('revert-btn')) {
        openRevertModal(currentGrupo);
    }
}

export async function afterRender() {
    await loadAndRender();

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        const filtro = searchInput.value.toLowerCase();
        const gruposFiltrados = allGrupos.filter(g => 
            g.clienteNombre.toLowerCase().includes(filtro) ||
            g.reservaIdOriginal.toLowerCase().includes(filtro) ||
            (g.telefono && g.telefono.includes(filtro))
        );
        renderGrupos(gruposFiltrados);
    });

    document.getElementById('hoy-list').addEventListener('click', handleCardButtonClick);
    document.getElementById('proximas-list').addEventListener('click', handleCardButtonClick);
    
    // --- INICIO DE LA CORRECCIÓN ---
    // Se pasa la función 'loadAndRender' y el 'currentUserEmail' a 'initializeModals'
    // para que los módulos de los modales puedan invocar el refresco de la vista.
    initializeModals(loadAndRender, currentUserEmail);
    // --- FIN DE LA CORRECCIÓN ---
}