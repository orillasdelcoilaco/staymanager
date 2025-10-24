// frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js
import { formatCurrency, formatDate } from '../../../utils.js';
import api from '../../../api.js';

/**
 * Define los estados de reserva permitidos y su orden.
 * (Propuesta, Pendiente, Confirmada, Cancelada, Bloqueo)
 */
const ESTADOS_RESERVA_ORDENADOS = [
    { id: 'Confirmada', nombre: 'Confirmada' },
    { id: 'Cancelada', nombre: 'Cancelada' },
    { id: 'Propuesta', nombre: 'Propuesta' },
    { id: 'Pendiente', nombre: 'Pendiente' },
    { id: 'Bloqueo', nombre: 'Bloqueo' }
];

/**
 * Genera el HTML para el dropdown de Estados de Gestión
 */
function crearDropdownEstadosGestion(reserva, estadosGestion) {
    // Filtrar y ordenar estados de gestión
    const estadosFiltrados = estadosGestion
        .filter(e => e.tipo === reserva.tipoGestion)
        .sort((a, b) => a.orden - b.orden);

    const opcionesGestion = estadosFiltrados.map(estado =>
        `<option value="${estado.id}" ${reserva.estadoGestion === estado.id ? 'selected' : ''}>
            ${estado.nombre}
        </option>`
    ).join('');

    return `
        <div class="mb-2">
            <label class="block text-xs font-medium text-gray-500">Estado Gestión:</label>
            <select data-reserva-id="${reserva.id}" class="gestion-estado-select mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                ${opcionesGestion}
            </select>
            <span id="loader-estado-${reserva.id}" class="text-xs text-blue-500 hidden">Guardando...</span>
        </div>
    `;
}

// --- INICIO: NUEVA FUNCIÓN PARA DROPDOWN ESTADO RESERVA ---
/**
 * Genera el HTML para el dropdown de Estados de Reserva (Confirmada, Cancelada, etc.)
 */
function crearDropdownEstadosReserva(reserva) {
    
    // Usar la lista ordenada de estados de reserva
    const opcionesReserva = ESTADOS_RESERVA_ORDENADOS.map(estado =>
        `<option value="${estado.id}" ${reserva.estado === estado.id ? 'selected' : ''}>
            ${estado.nombre}
        </option>`
    ).join('');

    // Define un color de fondo basado en el estado
    let bgColorClass = 'bg-gray-100'; // Default
    if (reserva.estado === 'Confirmada') {
        bgColorClass = 'bg-green-100';
    } else if (reserva.estado === 'Cancelada' || reserva.estado === 'Bloqueo') {
        bgColorClass = 'bg-red-100';
    } else if (reserva.estado === 'Propuesta' || reserva.estado === 'Pendiente') {
        bgColorClass = 'bg-yellow-100';
    }

    return `
        <div class="mb-3">
            <label class="block text-xs font-medium text-gray-500">Estado Reserva:</label>
            <select data-reserva-id="${reserva.id}" class="reserva-estado-select mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${bgColorClass}">
                ${opcionesReserva}
            </select>
            <span id="loader-estado-reserva-${reserva.id}" class="text-xs text-blue-500 hidden">Guardando...</span>
        </div>
    `;
}
// --- FIN: NUEVA FUNCIÓN ---


/**
 * Genera el HTML para una sola tarjeta de reserva en Gestión Diaria
 */
export function crearCardReserva(reserva, estadosGestion, empresaConfig) {
    const {
        id, nombreCliente, telefonoCliente, fechaLlegada, fechaSalida,
        alojamientoNombre, numAdultos, numNinos, numBebes,
        origen, notaInterna, transacciones, documentos,
        valores, estado, estadoGestion
    } = reserva;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const llegada = new Date(fechaLlegada);
    llegada.setHours(0, 0, 0, 0);
    const diasParaLlegada = Math.round((llegada - hoy) / (1000 * 60 * 60 * 24));
    let badgeDias = '';
    if (diasParaLlegada > 0) {
        badgeDias = `<span class="badge-blue">Faltan ${diasParaLlegada} días</span>`;
    } else if (diasParaLlegada === 0) {
        badgeDias = `<span class="badge-green">Llegan Hoy</span>`;
    } else {
        // Para check-out
        const salida = new Date(fechaSalida);
        salida.setHours(0, 0, 0, 0);
        const diasParaSalida = Math.round((salida - hoy) / (1000 * 60 * 60 * 24));
        if (diasParaSalida === 0) {
            badgeDias = `<span class="badge-red">Salen Hoy</span>`;
        } else if (diasParaSalida > 0) {
             badgeDias = `<span class="badge-gray">En casa (Quedan ${diasParaSalida}d)</span>`;
        } else {
             badgeDias = `<span class="badge-gray-light">Finalizada</span>`;
        }
    }
    
    // Info Pagos
    const totalPagado = transacciones.reduce((sum, t) => sum + (t.monto || 0), 0);
    const totalReserva = valores?.valorHuesped || 0;
    const saldoPendiente = totalReserva - totalPagado;
    const abonoRequerido = totalReserva * (empresaConfig.porcentajeAbono / 100);
    const pagadoCheck = totalPagado >= abonoRequerido;

    // Info Documentos
    const docBoleta = documentos.find(d => d.tipo === 'Boleta');
    const docReserva = documentos.find(d => d.tipo === 'Doc. Reserva');

    // --- MODIFICADO: Añadir el nuevo dropdown de Estado Reserva ---
    return `
        <div classs="gestion-card" id="card-${id}">
            <div class="p-4 border border-gray-200 rounded-lg shadow-sm bg-white">
                
                <div class="flex justify-between items-center mb-3">
                    <h3 class="text-lg font-semibold text-gray-900 truncate" title="${alojamientoNombre}">
                        ${alojamientoNombre}
                    </h3>
                    <span class="badge-gray-light">${origen}</span>
                </div>

                <div class="mb-2">
                    <p class="text-sm font-medium text-indigo-600">${nombreCliente}</p>
                    <p class="text-sm text-gray-600">${formatDate(fechaLlegada)} al ${formatDate(fechaSalida)}</p>
                </div>
                
                <div class="mb-3">
                    ${badgeDias}
                </div>
                
                ${crearDropdownEstadosReserva(reserva)}
                ${crearDropdownEstadosGestion(reserva, estadosGestion)}
                <div class="mt-4 pt-4 border-t border-gray-100">
                    <p class="text-xs font-medium text-gray-500 mb-2">Acciones:</p>
                    <div class="flex flex-wrap gap-2">
                        <button class="btn-icon btn-blue" data-action="pagos" data-id="${id}" title="Ver/Añadir Pagos">
                            <i class="fas fa-dollar-sign"></i>
                        </button>
                        <button class="btn-icon btn-gray" data-action="nota" data-id="${id}" title="Ver/Editar Nota Interna">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="btn-icon btn-gray" data-action="documentos" data-id="${id}" title="Ver/Añadir Documentos">
                            <i class="fas fa-file-alt"></i>
                        </button>
                        <button class="btn-icon btn-gray" data-action="analisis" data-id="${id}" title="Análisis Financiero">
                            <i class="fas fa-chart-line"></i>
                        </button>
                        <button class="btn-icon btn-green" data-action="mensaje" data-id="${id}" title="Generar Mensaje">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                        <a href="https://wa.me/56${(telefonoCliente || '').replace(/\s+/g, '')}" target="_blank" class="btn-icon btn-whatsapp" title="WhatsApp: ${telefonoCliente || 'N/A'}">
                            <i class="fab fa-whatsapp"></i>
                        </a>
                        <a href="/admin/gestionar-reservas?reservaId=${id}" target="_blank" class="btn-icon btn-gray" title="Editar Reserva Completa">
                            <i class="fas fa-edit"></i>
                        </a>
                    </div>
                </div>
                
                <div class="mt-4 pt-4 border-t border-gray-100">
                    <p class="text-xs font-medium text-gray-500 mb-2">Indicadores:</p>
                    <div class="flex flex-wrap gap-2 text-xs">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800" title="Pax">
                            <i class="fas fa-users mr-1"></i> ${numAdultos || 0}a ${numNinos || 0}n ${numBebes || 0}b
                        </span>
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${saldoPendiente <= 0 ? 'bg-green-100 text-green-800' : (pagadoCheck ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800')}" title="Saldo Pendiente: ${formatCurrency(saldoPendiente)}">
                            <i class="fas fa-money-check-alt mr-1"></i> ${formatCurrency(saldoPendiente)}
                        </span>
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${docBoleta ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}" title="Boleta">
                            <i class="fas fa-file-invoice-dollar mr-1"></i> B
                        </span>
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${docReserva ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}" title="Doc. Reserva">
                            <i class="fas fa-file-signature mr-1"></i> R
                        </span>
                        ${notaInterna ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" title="Tiene Nota: ${notaInterna}">
                            <i class="fas fa-sticky-note mr-1"></i> N
                        </span>` : ''}
                    </div>
                </div>

            </div>
        </div>
    `;
}


/**
 * Añade los event listeners para las acciones de las tarjetas (cambio de estado, botones)
 */
export function adjuntarListenersCards(viewElement, handlers) {
    
    // Listener para ESTADO GESTIÓN (sin cambios)
    viewElement.querySelectorAll('.gestion-estado-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const reservaId = e.target.dataset.reservaId;
            const nuevoEstado = e.target.value;
            const loader = viewElement.querySelector(`#loader-estado-${reservaId}`);
            
            try {
                loader.classList.remove('hidden');
                e.target.disabled = true;
                
                await api.post('/gestion/actualizar-estado', { reservaId, nuevoEstado });
                
                // Opcional: actualizar el estado en el objeto de datos local si es necesario
                // O simplemente recargar la vista
                
            } catch (error) {
                console.error('Error al actualizar estado de gestión:', error);
                alert('No se pudo actualizar el estado de gestión.');
                // Revertir el cambio visual si falla
                e.target.value = handlers.getEstadoGestionActual(reservaId); 
            } finally {
                loader.classList.add('hidden');
                e.target.disabled = false;
            }
        });
    });

    // --- INICIO: NUEVO LISTENER PARA ESTADO RESERVA ---
    viewElement.querySelectorAll('.reserva-estado-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const reservaId = e.target.dataset.reservaId;
            const nuevoEstadoReserva = e.target.value;
            const loader = viewElement.querySelector(`#loader-estado-reserva-${reservaId}`);

            const confirmacion = confirm(`¿Estás seguro de cambiar el ESTADO DE LA RESERVA a "${nuevoEstadoReserva}"?\n\nEsto puede afectar la disponibilidad y los reportes.`);
            
            if (!confirmacion) {
                // Revertir el cambio visual si el usuario cancela
                e.target.value = handlers.getEstadoReservaActual(reservaId);
                return;
            }

            try {
                loader.classList.remove('hidden');
                e.target.disabled = true;

                // Llamar al nuevo endpoint
                await api.post('/gestion/actualizar-estado-reserva', { reservaId, nuevoEstadoReserva });
                
                // Éxito: Actualizar el color del select y el estado local
                handlers.setEstadoReservaActual(reservaId, nuevoEstadoReserva);
                
                // Quitar clases de color antiguas
                e.target.classList.remove('bg-gray-100', 'bg-green-100', 'bg-red-100', 'bg-yellow-100');

                // Añadir nueva clase de color
                if (nuevoEstadoReserva === 'Confirmada') {
                    e.target.classList.add('bg-green-100');
                } else if (nuevoEstadoReserva === 'Cancelada' || nuevoEstadoReserva === 'Bloqueo') {
                    e.target.classList.add('bg-red-100');
                } else if (nuevoEstadoReserva === 'Propuesta' || nuevoEstadoReserva === 'Pendiente') {
                    e.target.classList.add('bg-yellow-100');
                } else {
                    e.target.classList.add('bg-gray-100');
                }
                
                // Opcional: Recargar toda la vista para re-filtrar (ej. si una cancelada ya no debe mostrarse)
                // handlers.recargarVista(); 

            } catch (error) {
                console.error('Error al actualizar estado de reserva:', error);
                alert('No se pudo actualizar el estado de la reserva.');
                // Revertir el cambio visual si falla
                e.target.value = handlers.getEstadoReservaActual(reservaId); 
            } finally {
                loader.classList.add('hidden');
                e.target.disabled = false;
            }
        });
    });
    // --- FIN: NUEVO LISTENER ---

    // Listener para botones de acción (sin cambios)
    viewElement.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            const reservaId = e.currentTarget.dataset.id;
            
            switch(action) {
                case 'pagos':
                    handlers.onAbrirPagos(reservaId);
                    break;
                case 'nota':
                    handlers.onAbrirNota(reservaId);
                    break;
                case 'documentos':
                    handlers.onAbrirDocumentos(reservaId);
                    break;
                case 'analisis':
                    handlers.onAbrirAnalisis(reservaId);
                    break;
                case 'mensaje':
                    handlers.onAbrirMensaje(reservaId);
                    break;
                // Los clicks en <a> (whatsapp, edit) no se manejan aquí
            }
        });
    });
}