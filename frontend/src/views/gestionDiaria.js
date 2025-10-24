// frontend/src/views/gestionDiaria.js
import api from '../api.js';
import { showModal, closeModal } from '../utils.js';
import { crearCardReserva, adjuntarListenersCards } from './components/gestionDiaria/gestionDiaria.cards.js';
import { inicializarModalPagos, abrirModalPagos } from './components/gestionDiaria/modals/pagosModal.js';
import { inicializarModalNota, abrirModalNota } from './components/gestionDiaria/modals/notaModal.js'; // Asumiendo que existe notaModal.js
import { inicializarModalDocumentos, abrirModalDocumentos } from './components/gestionDiaria/modals/documentoModal.js';
import { inicializarModalAnalisis, abrirModalAnalisis } from './components/gestionDiaria/modals/ajusteTarifaModal.js'; // Asumiendo que se renombró o adaptó
import { inicializarModalMensaje, abrirModalMensaje } from './components/gestionDiaria/modals/mensajeModal.js';

// Guardaremos las reservas cargadas aquí para acceder a ellas en los handlers
let reservasCargadas = [];
let estadosGestionCargados = [];
let empresaConfigCargada = {}; // Para el porcentaje de abono

const GestionDiaria = {
    async render() {
        return `
            <div class="container mx-auto px-4 py-8">
                <h1 class="text-3xl font-bold text-gray-800 mb-6">Gestión Diaria</h1>
                
                <div class="mb-6 flex flex-wrap gap-4 items-center">
                    <input type="text" id="filtro-nombre-gd" placeholder="Buscar por nombre..." class="form-input w-full sm:w-auto">
                    <select id="filtro-estado-gestion-gd" class="form-select w-full sm:w-auto">
                        <option value="">Todos los Estados Gestión</option>
                        </select>
                     <select id="filtro-estado-reserva-gd" class="form-select w-full sm:w-auto">
                        <option value="">Todos los Estados Reserva</option>
                        <option value="Confirmada">Confirmada</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Propuesta">Propuesta</option>
                        <option value="Cancelada">Cancelada</option>
                        <option value="Bloqueo">Bloqueo</option>
                    </select>
                    <button id="btn-recargar-gd" class="btn btn-secondary">
                        <i class="fas fa-sync-alt mr-2"></i>Recargar
                    </button>
                     <div id="conteo-tareas" class="ml-auto text-sm text-gray-600 space-x-4">
                        <span>Cargando conteos...</span>
                    </div>
                </div>

                <div id="gestion-diaria-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <p id="loading-message-gd">Cargando tareas pendientes...</p>
                </div>
            </div>

            ${inicializarModalPagos()}
            ${inicializarModalNota()}
            ${inicializarModalDocumentos()}
            ${inicializarModalAnalisis()}
            ${inicializarModalMensaje()}
        `;
    },

    async after_render() {
        console.log("GestionDiaria after_render");
        await cargarDatosIniciales();
        configurarFiltros();
        // Inicializar listeners de modales (si es necesario en cada modal.js)
    }
};

async function cargarDatosIniciales() {
    const loadingMessage = document.getElementById('loading-message-gd');
    const conteoTareasEl = document.getElementById('conteo-tareas');
    try {
        loadingMessage.textContent = 'Cargando datos...';
        conteoTareasEl.textContent = 'Cargando conteos...';

        // Cargar en paralelo
        const [pendientesRes, estadosRes, empresaRes, conteoRes] = await Promise.all([
            api.get('/gestion/pendientes'),
            api.get('/estados'), // Asume endpoint para estados de gestión
            api.get('/empresa'), // Asume endpoint para config de empresa
            api.get('/gestion/conteo-tareas')
        ]);
        
        reservasCargadas = pendientesRes.data || [];
        estadosGestionCargados = estadosRes.data || [];
        empresaConfigCargada = empresaRes.data || { porcentajeAbono: 10 }; // Default 10%

        // Actualizar conteos
        if (conteoRes.data) {
             conteoTareasEl.innerHTML = `
                <span title="Check-ins Pendientes"><i class="fas fa-sign-in-alt text-blue-500"></i> ${conteoRes.data.checkInsPendientes || 0}</span>
                <span title="Check-outs Pendientes"><i class="fas fa-sign-out-alt text-orange-500"></i> ${conteoRes.data.checkOutsPendientes || 0}</span>
                <span title="Limpiezas Pendientes"><i class="fas fa-broom text-purple-500"></i> ${conteoRes.data.limpiezasPendientes || 0}</span>
            `;
        } else {
            conteoTareasEl.textContent = 'Error al cargar conteos.';
        }


        // Poblar dropdown de estados de gestión para el filtro
        const filtroEstadoGestion = document.getElementById('filtro-estado-gestion-gd');
        filtroEstadoGestion.innerHTML = '<option value="">Todos los Estados Gestión</option>'; // Reset
        estadosGestionCargados
            .sort((a,b) => (a.tipo + a.orden) > (b.tipo + b.orden) ? 1 : -1) // Ordenar por tipo y luego orden
            .forEach(estado => {
                const option = document.createElement('option');
                option.value = estado.id;
                option.textContent = `${estado.tipo}: ${estado.nombre}`;
                filtroEstadoGestion.appendChild(option);
            });

        renderPendientes(); // Render inicial

    } catch (error) {
        console.error('Error al cargar datos iniciales de Gestión Diaria:', error);
        loadingMessage.textContent = 'Error al cargar los datos. Intente recargar.';
        conteoTareasEl.textContent = 'Error conteos.';
        reservasCargadas = [];
        estadosGestionCargados = [];
    }
}

function renderPendientes() {
    const container = document.getElementById('gestion-diaria-container');
    const loadingMessage = document.getElementById('loading-message-gd');
    const filtroNombre = document.getElementById('filtro-nombre-gd').value.toLowerCase();
    const filtroEstadoGestion = document.getElementById('filtro-estado-gestion-gd').value;
    const filtroEstadoReserva = document.getElementById('filtro-estado-reserva-gd').value;

    if (!container) return;
    container.innerHTML = ''; // Limpiar contenedor

    const reservasFiltradas = reservasCargadas.filter(reserva => {
        const nombreMatch = !filtroNombre || reserva.nombreCliente.toLowerCase().includes(filtroNombre);
        const estadoGestionMatch = !filtroEstadoGestion || reserva.estadoGestion === filtroEstadoGestion;
        const estadoReservaMatch = !filtroEstadoReserva || reserva.estado === filtroEstadoReserva;
        return nombreMatch && estadoGestionMatch && estadoReservaMatch;
    });

    if (reservasFiltradas.length === 0) {
        loadingMessage.textContent = 'No hay tareas pendientes que coincidan con los filtros.';
        loadingMessage.classList.remove('hidden');
        container.appendChild(loadingMessage); // Mostrar mensaje dentro del grid
    } else {
        loadingMessage.classList.add('hidden'); // Ocultar mensaje si hay resultados
        reservasFiltradas.forEach(reserva => {
            const cardHTML = crearCardReserva(reserva, estadosGestionCargados, empresaConfigCargada);
            container.insertAdjacentHTML('beforeend', cardHTML);
        });

        // --- INICIO: Modificación de la llamada a adjuntarListenersCards ---
        adjuntarListenersCards(container, {
            // Handlers existentes para modales
            onAbrirPagos: (id) => abrirModalPagos(id, reservasCargadas.find(r => r.id === id), empresaConfigCargada),
            onAbrirNota: (id) => abrirModalNota(id, reservasCargadas.find(r => r.id === id)),
            onAbrirDocumentos: (id) => abrirModalDocumentos(id, reservasCargadas.find(r => r.id === id)),
            onAbrirAnalisis: (id) => abrirModalAnalisis(id, reservasCargadas.find(r => r.id === id)),
            onAbrirMensaje: (id) => abrirModalMensaje(id, reservasCargadas.find(r => r.id === id)),
            
            // Handler para obtener estado de GESTIÓN actual (necesario para revertir si falla)
            getEstadoGestionActual: (reservaId) => {
                const reserva = reservasCargadas.find(r => r.id === reservaId);
                return reserva ? reserva.estadoGestion : '';
            },
            
            // --- NUEVOS Handlers para estado de RESERVA ---
            // Obtener estado de RESERVA actual (para revertir si falla o cancela)
            getEstadoReservaActual: (reservaId) => {
                const reserva = reservasCargadas.find(r => r.id === reservaId);
                return reserva ? reserva.estado : ''; // Devuelve el estado principal
            },
            // Actualizar estado de RESERVA en nuestro array local tras éxito
            setEstadoReservaActual: (reservaId, nuevoEstado) => {
                const reserva = reservasCargadas.find(r => r.id === reservaId);
                if (reserva) {
                    reserva.estado = nuevoEstado; // Actualiza el estado principal en la data local
                    console.log(`Estado reserva local actualizado para ${reservaId} a ${nuevoEstado}`);
                }
                // Opcional: Si el filtro de estado reserva está activo, re-renderizar
                // para que la card desaparezca si ya no cumple el filtro.
                if (document.getElementById('filtro-estado-reserva-gd').value) {
                     console.log("Filtro de estado reserva activo, re-renderizando...");
                     renderPendientes();
                }
            },
            // --- FIN NUEVOS Handlers ---

            // Opcional: Handler para recargar vista completa si es necesario
            // recargarVista: () => cargarDatosIniciales() 
        });
        // --- FIN: Modificación de la llamada a adjuntarListenersCards ---
    }
}


function configurarFiltros() {
    document.getElementById('filtro-nombre-gd').addEventListener('input', renderPendientes);
    document.getElementById('filtro-estado-gestion-gd').addEventListener('change', renderPendientes);
    document.getElementById('filtro-estado-reserva-gd').addEventListener('change', renderPendientes);
    document.getElementById('btn-recargar-gd').addEventListener('click', cargarDatosIniciales);
}

export default GestionDiaria;