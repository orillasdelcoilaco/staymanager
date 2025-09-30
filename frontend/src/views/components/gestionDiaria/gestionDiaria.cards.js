import { handleNavigation } from '../../../router.js'; 
import { getStatusInfo, formatCurrency, formatDate, formatUSD } from './gestionDiaria.utils.js';

// La función createNotificationBadge no cambia
function createNotificationBadge(isComplete = false, count = 0) {
    if (isComplete) {
        return `<span class="absolute -top-1 -right-1 flex h-4 w-4"><span class="relative inline-flex rounded-full h-4 w-4 bg-green-500 text-white items-center justify-center text-xs">✓</span></span>`;
    }
    if (count > 0) {
        return `<span class="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">${count}</span>`;
    }
    return '';
}

// Se unifica la creación de tarjetas en una sola función para el diagnóstico
function createGrupoCard(grupo) {
    const card = document.createElement('div');
    card.id = `card-${grupo.reservaIdOriginal}`;
    card.className = 'p-4 border rounded-lg shadow-sm flex flex-col';
    const alojamientos = grupo.reservasIndividuales.map(r => r.alojamientoNombre).join(', ');

    // Lógica para mostrar los estados de forma clara en el modo de diagnóstico
    const estadoReserva = grupo.estado || 'N/A';
    const estadoGestion = grupo.estadoGestion || 'N/A';
    let colorEstado = 'bg-gray-400';
    if (estadoReserva === 'Desconocido') colorEstado = 'bg-amber-500';
    if (estadoReserva === 'Confirmada') colorEstado = 'bg-blue-500';
    if (estadoReserva === 'Cancelada') colorEstado = 'bg-red-500';

    card.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <div>
                <span class="text-xs font-bold text-white px-2 py-1 rounded ${colorEstado}" title="Estado de la Reserva">${estadoReserva}</span>
                <span class="text-xs font-bold text-white px-2 py-1 rounded bg-gray-600 ml-2" title="Estado de Gestión">${estadoGestion}</span>
            </div>
            <span class="text-lg font-bold text-gray-800">${grupo.clienteNombre}</span>
        </div>
        <div class="text-sm text-gray-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>ID Reserva:</strong> ${grupo.reservaIdOriginal}</span>
            <span><strong>Estancia:</strong> ${formatDate(grupo.fechaLlegada)} al ${formatDate(grupo.fechaSalida)}</span>
        </div>
        <div class="border-t mt-2 pt-2">
             <p class="text-sm"><strong>Total Cliente:</strong> ${formatCurrency(grupo.valorTotalHuesped)}</p>
             <p class="text-sm"><strong>Abonado:</strong> ${formatCurrency(grupo.abonoTotal)}</p>
        </div>`;
    
    return card;
}

// Función de renderizado simplificada para el diagnóstico
export function renderGrupos(grupos) {
    const diagnosticoList = document.getElementById('diagnostico-list');
    const noPendientes = document.getElementById('no-pendientes');
    const diagnosticoContainer = document.getElementById('diagnostico-container');

    diagnosticoList.innerHTML = '';

    if (grupos.length === 0) {
        noPendientes.classList.remove('hidden');
        diagnosticoContainer.classList.add('hidden');
        return;
    }
    
    noPendientes.classList.add('hidden');
    diagnosticoContainer.classList.remove('hidden');
    
    grupos.forEach(g => diagnosticoList.appendChild(createGrupoCard(g)));
}