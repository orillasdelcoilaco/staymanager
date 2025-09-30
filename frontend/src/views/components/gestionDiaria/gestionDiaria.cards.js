import { handleNavigation } from '../../../router.js'; 
import { getStatusInfo, formatCurrency, formatDate, formatUSD } from './gestionDiaria.utils.js';

function createNotificationBadge(isComplete = false, count = 0) {
    if (isComplete) {
        return `<span class="absolute -top-1 -right-1 flex h-4 w-4"><span class="relative inline-flex rounded-full h-4 w-4 bg-green-500 text-white items-center justify-center text-xs">✓</span></span>`;
    }
    if (count > 0) {
        return `<span class="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">${count}</span>`;
    }
    return '';
}

function createGrupoCard(grupo) {
    const card = document.createElement('div');
    card.id = `card-${grupo.reservaIdOriginal}`;
    card.className = 'p-4 border rounded-lg shadow-sm flex flex-col';
    
    // Usamos el estado de gestión si existe, si no, usamos el estado de la reserva.
    const estadoMostrado = grupo.estadoGestion || grupo.estado;
    const statusInfo = getStatusInfo(estadoMostrado);
    
    const alojamientos = grupo.reservasIndividuales.map(r => r.alojamientoNombre).join(', ');

    const clienteLink = `<a href="/cliente/${grupo.clienteId}" data-path="/cliente/${grupo.clienteId}" class="nav-link-style ml-4 text-lg font-bold text-gray-800 hover:text-indigo-600" title="Abrir ficha del cliente">${grupo.clienteNombre}</a>`;
    const revertButtonHtml = `<button data-id="${grupo.reservaIdOriginal}" class="revert-btn ml-2 text-xl" title="Revertir estado">↩️</button>`;

    let statusHtml;
    const gestionType = statusInfo.gestionType;
    if (gestionType) {
        statusHtml = `<button data-gestion="${gestionType}" class="gestion-btn text-sm font-bold text-white px-2 py-1 rounded ${statusInfo.color} hover:opacity-80">${statusInfo.text}</button>`;
    } else {
        // Para estados como 'Cancelada' o 'Facturado' que no tienen acción directa
        statusHtml = `<span class="text-sm font-bold text-white px-2 py-1 rounded ${statusInfo.color}">${statusInfo.text}</span>`;
    }

    let financialDetailsHtml;
    const saldo = grupo.valorTotalHuesped - grupo.abonoTotal;

    financialDetailsHtml = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 font-semibold w-full md:w-2/3">
            <div class="col-span-full text-base flex justify-between">
                <span><span class="text-gray-500 font-medium">Payout Final:</span> ${formatCurrency(grupo.payoutFinalReal)}</span>
                <span class="text-orange-600" title="Costo del Canal (Comisiones + Tarifas)"><span class="text-gray-500 font-medium">Costo Canal:</span> ${formatCurrency(grupo.costoCanal)}</span>
            </div>
            <div class="text-right border-t pt-2 font-bold text-lg"><span class="text-gray-500 font-medium">Total Cliente:</span> ${formatCurrency(grupo.valorTotalHuesped)}</div>
            <div class="text-right border-t pt-2 grid grid-cols-2 gap-2">
                <div class="text-green-600"><span class="text-gray-500 font-medium">Abonado:</span> <span>${formatCurrency(grupo.abonoTotal)}</span></div>
                <div class="text-red-600"><span class="text-gray-500 font-medium">Saldo:</span> <span>${formatCurrency(saldo)}</span></div>
            </div>
        </div>
    `;

    const baseButtonClasses = "w-full px-3 py-1 text-xs font-semibold rounded-md transition-colors relative";
    const activeButtonClasses = "bg-gray-100 text-gray-800 hover:bg-gray-200";

    card.innerHTML = `
        <div class="flex items-center mb-2">
            ${statusHtml}
            ${revertButtonHtml}
            ${clienteLink}
        </div>
        <div class="text-sm text-gray-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>Teléfono:</strong> ${grupo.telefono || 'N/A'}</span>
            <span><strong>ID Reserva:</strong> ${grupo.reservaIdOriginal}</span>
            <span><strong>Estancia:</strong> ${formatDate(grupo.fechaLlegada)} al ${formatDate(grupo.fechaSalida)}</span>
            <span><strong>Alojamientos (${grupo.reservasIndividuales.length}):</strong> ${alojamientos}</span>
        </div>
        <div class="border-t mt-4 pt-3 flex flex-col md:flex-row justify-between items-center text-sm">
            ${financialDetailsHtml}
            <div class="mt-3 md:mt-0 grid grid-cols-3 gap-2 w-full md:w-auto">
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="gestionar_reserva" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Gestionar Reserva ${createNotificationBadge(!!grupo.documentos?.enlaceReserva)}</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="ajuste_tarifa" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Ajustar Tarifa ${createNotificationBadge(grupo.ajusteManualRealizado || grupo.potencialCalculado)}</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="pagos" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Gestionar Pagos ${createNotificationBadge(false, grupo.transaccionesCount)}</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="boleta" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Gestionar Boleta ${createNotificationBadge(!!grupo.documentos?.enlaceBoleta)}</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="gestionar_cliente" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Gestionar Cliente ${createNotificationBadge(grupo.clienteGestionado)}</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="bitacora" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Bitácora 🗂️ ${createNotificationBadge(false, grupo.notasCount)}</button>
            </div>
        </div>`;
    
    card.querySelectorAll('.nav-link-style').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleNavigation(e.currentTarget.dataset.path);
        });
    });

    return card;
}


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