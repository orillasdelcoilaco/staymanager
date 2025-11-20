// frontend/src/views/gestionDiaria.js
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { renderGrupos } from './components/gestionDiaria/gestionDiaria.cards.js';
import { openManagementModal, initializeModals, openRevertModal } from './components/gestionDiaria/gestionDiaria.modals.js';
// Importamos las utilidades del modal de clientes
import { renderModalCliente, setupModalCliente, abrirModalCliente } from './components/gestionarClientes/clientes.modals.js';

let allGrupos = [];
let allEstados = [];
let currentUserEmail = '';
let isLoading = false;

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <h2 class="text-2xl font-semibold text-gray-900">Panel de Gestión Diaria</h2>
                <input type="text" id="search-input" placeholder="Buscar por nombre, reserva, teléfono..." class="mt-4 md:mt-0 form-input md:w-1/3">
            </div>
            <div id="diagnostico-container"></div>
            <div id="revision-container" class="hidden"><h3 class="text-xl font-bold text-amber-600 mb-4 border-b pb-2">⚠️ Requiere Revisión Manual</h3><div id="revision-list" class="space-y-4"></div></div>
            <div id="hoy-container" class="mt-8 hidden"><h3 class="text-xl font-bold text-red-600 mb-4 border-b pb-2">Requiere Acción Inmediata (Llegadas de hoy o pasadas)</h3><div id="hoy-list" class="space-y-4"></div></div>
            <div id="proximas-container" class="mt-8 hidden"><h3 class="text-xl font-semibold text-blue-600 mb-4 border-b pb-2">Próximas Llegadas</h3><div id="proximas-list" class="space-y-4"></div></div>
            <div id="loading-state" class="text-center py-8"><p class="text-gray-500">Cargando tareas pendientes...</p></div>
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

        ${renderModalCliente()}
    `;
}

async function loadAndRender() {
    if (isLoading) return;
    isLoading = true;

    const loadingState = document.getElementById('loading-state');
    const noPendientesEl = document.getElementById('no-pendientes');
    
    loadingState.classList.remove('hidden');
    document.querySelectorAll('#revision-container, #hoy-container, #proximas-container').forEach(c => c.classList.add('hidden'));
    noPendientesEl.classList.add('hidden');

    try {
        if (!currentUserEmail) {
            const user = await fetchAPI('/auth/me');
            currentUserEmail = user.email;
        }

        const [data, estados] = await Promise.all([
            fetchAPI('/gestion/pendientes', { method: 'POST' }),
            fetchAPI('/estados')
        ]);
        allGrupos = data.grupos;
        allEstados = estados;
        
        renderGrupos(allGrupos, allEstados);
        
        noPendientesEl.classList.toggle('hidden', allGrupos.length > 0);

    } catch(error) {
        document.getElementById('diagnostico-container').innerHTML = `<p class="text-red-500">Error al cargar las gestiones: ${error.message}</p>`;
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
        openManagementModal(target.dataset.gestion, currentGrupo, allEstados);
    }
    
    if (target.classList.contains('revert-btn')) {
        openRevertModal(currentGrupo, allEstados);
    }
}

async function handleEstadoReservaChange(e) {
    const select = e.target;
    const idReservaCanal = select.dataset.reservaIdCanal;
    const nuevoEstadoReserva = select.value;
    const grupo = allGrupos.find(g => g.reservaIdOriginal === idReservaCanal);
    const estadoAnterior = grupo.estado;

    if (!grupo) return;

    const loader = document.getElementById(`loader-estado-reserva-${idReservaCanal}`);

    const confirmacion = confirm(`¿Estás seguro de cambiar el ESTADO DE LA RESERVA del grupo ${idReservaCanal} a "${nuevoEstadoReserva}"?\n\nEsto afectará la disponibilidad y los reportes.`);
    
    if (!confirmacion) {
        select.value = estadoAnterior; 
        return;
    }

    try {
        loader.classList.remove('hidden');
        select.disabled = true;

        await fetchAPI('/gestion/actualizar-estado-reserva', {
            method: 'POST',
            body: { idReservaCanal, nuevoEstadoReserva }
        });
        
        grupo.estado = nuevoEstadoReserva;
        
        select.classList.remove('bg-gray-100', 'bg-green-100', 'bg-red-100', 'bg-yellow-100');
        if (nuevoEstadoReserva === 'Confirmada') {
            select.classList.add('bg-green-100');
        } else if (nuevoEstadoReserva === 'Cancelada' || nuevoEstadoReserva === 'No Presentado') {
            select.classList.add('bg-red-100');
        } else if (nuevoEstadoReserva === 'Propuesta' || nuevoEstadoReserva === 'Desconocido') {
            select.classList.add('bg-yellow-100');
        } else {
            select.classList.add('bg-gray-100');
        }

    } catch (error) {
        alert(`Error al actualizar el estado: ${error.message}`);
        select.value = estadoAnterior; 
    } finally {
        loader.classList.add('hidden');
        select.disabled = false;
    }
}

export async function afterRender() {
    await loadAndRender();

    // Configuración del modal de cliente con recarga tras guardar
    setupModalCliente(async () => {
        console.log('Cliente actualizado, recargando datos...');
        await loadAndRender();
    });

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        const filtro = searchInput.value.toLowerCase();
        if (filtro) {
            const gruposFiltrados = allGrupos.filter(g => 
                (g.clienteNombre && g.clienteNombre.toLowerCase().includes(filtro)) ||
                (g.reservaIdOriginal && g.reservaIdOriginal.toLowerCase().includes(filtro)) ||
                (g.telefono && g.telefono.includes(filtro))
            );
            renderGrupos(gruposFiltrados, allEstados);
        } else {
            renderGrupos(allGrupos, allEstados);
        }
    });

    const listsContainer = [
        document.getElementById('revision-list'),
        document.getElementById('hoy-list'),
        document.getElementById('proximas-list')
    ];

    listsContainer.forEach(container => {
        if (!container) return; 
        container.addEventListener('click', async (e) => {
            // 1. Manejo del clic en el NOMBRE DEL CLIENTE
            if (e.target.classList.contains('client-trigger')) {
                const clienteId = e.target.dataset.clienteId;
                if (clienteId) {
                    try {
                        const cliente = await fetchAPI(`/clientes/${clienteId}`);
                        abrirModalCliente(cliente);
                    } catch (error) {
                        alert('Error al cargar datos del cliente: ' + error.message);
                    }
                }
                return;
            }

            // 2. Manejo de enlaces de navegación (si quedan)
            const link = e.target.closest('a[data-navigo]');
            if (link) {
                e.preventDefault();
                handleNavigation(link.getAttribute('href'));
                return;
            } 
            
            // 3. Manejo de botones de gestión
            handleCardButtonClick(e);

            if (e.target.classList.contains('reserva-estado-select')) {
                // No hacer nada en click, esperar a change
            }
        });

        container.addEventListener('change', (e) => {
            if (e.target.classList.contains('reserva-estado-select')) {
                handleEstadoReservaChange(e);
            }
        });
    });
    
    initializeModals(loadAndRender, currentUserEmail, () => allEstados);
}