import { handleNavigation } from '../../../router.js'; // <-- RUTA CORREGIDA
import { getStatusInfo, formatCurrency, formatDate } from './gestionDiaria.utils.js';

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
    const statusInfo = getStatusInfo(grupo.estadoGestion);
    const saldo = grupo.valorTotalCLP - grupo.abonoTotal;
    const alojamientos = grupo.reservasIndividuales.map(r => r.alojamientoNombre).join(', ');

    const isGestionPagosActive = statusInfo.level >= 2;
    const isGestionBoletaActive = statusInfo.level >= 4;

    const clienteLink = `<a href="/cliente/${grupo.clienteId}" data-path="/cliente/${grupo.clienteId}" class="nav-link-style ml-4 text-lg font-bold text-gray-800 hover:text-indigo-600" title="Abrir ficha del cliente">${grupo.clienteNombre}</a>`;
    const revertButtonHtml = statusInfo.level > 1 ? `<button data-id="${grupo.reservaIdOriginal}" class="revert-btn ml-2 text-xl" title="Revertir estado">↩️</button>` : '';

    let accionParaMarcar = null;
    if (grupo.estadoGestion === 'Pendiente Bienvenida') accionParaMarcar = 'marcar_bienvenida_enviada';
    else if (grupo.estadoGestion === 'Pendiente Cobro') accionParaMarcar = 'marcar_cobro_enviado';

    let statusHtml;
    if (accionParaMarcar) {
        const reservaIdParaLink = grupo.reservasIndividuales.length > 0 ? grupo.reservasIndividuales[0].id : 'no-id';
        const url = `/cliente/${grupo.clienteId}/mensaje/${reservaIdParaLink}`;
        statusHtml = `<a href="${url}" data-path="${url}" class="nav-link-style text-sm font-bold text-white px-2 py-1 rounded ${statusInfo.color} hover:opacity-80">${statusInfo.text}</a>`;
    } else {
        statusHtml = `<span class="text-sm font-bold text-white px-2 py-1 rounded ${statusInfo.color}">${statusInfo.text}</span>`;
    }

    const baseButtonClasses = "px-3 py-1 text-xs font-semibold rounded-md transition-colors relative";
    const activeButtonClasses = "bg-gray-100 text-gray-800 hover:bg-gray-200";
    const disabledButtonClasses = "bg-gray-100 text-gray-400 cursor-not-allowed";

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
             <div class="grid grid-cols-3 gap-4 font-semibold text-center w-full md:w-2/3">
                <div><span class="text-gray-500 font-medium">Total:</span> ${formatCurrency(grupo.valorTotalCLP)}</div>
                <div class="text-green-600"><span class="text-gray-500 font-medium">Abonado:</span> ${formatCurrency(grupo.abonoTotal)}</div>
                <div class="text-red-600"><span class="text-gray-500 font-medium">Saldo:</span> ${formatCurrency(saldo)}</div>
            </div>
            <div class="mt-3 md:mt-0 flex flex-wrap gap-2 justify-center">
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="gestionar_reserva" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Gestionar Reserva ${createNotificationBadge(!!grupo.documentos.enlaceReserva)}</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="ajuste_tarifa" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Ajustar Tarifa</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="pagos" class="gestion-btn ${baseButtonClasses} ${isGestionPagosActive ? activeButtonClasses : disabledButtonClasses}" ${!isGestionPagosActive ? 'disabled' : ''}>Gestionar Pagos ${createNotificationBadge(grupo.transaccionesCount > 0)}</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="boleta" class="gestion-btn ${baseButtonClasses} ${isGestionBoletaActive ? activeButtonClasses : disabledButtonClasses}" ${!isGestionBoletaActive ? 'disabled' : ''}>Gestionar Boleta ${createNotificationBadge(!!grupo.documentos.enlaceBoleta)}</button>
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
    const hoyList = document.getElementById('hoy-list');
    const proximasList = document.getElementById('proximas-list');
    const noPendientes = document.getElementById('no-pendientes');
    const hoyContainer = document.getElementById('hoy-container');
    const proximasContainer = document.getElementById('proximas-container');
    
    hoyList.innerHTML = '';
    proximasList.innerHTML = '';

    if (grupos.length === 0) {
        noPendientes.classList.remove('hidden');
        hoyContainer.classList.add('hidden');
        proximasContainer.classList.add('hidden');
        return;
    }
    
    noPendientes.classList.add('hidden');
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const llegadasHoy = grupos.filter(g => new Date(g.fechaLlegada).getTime() <= today.getTime());
    const proximasLlegadas = grupos.filter(g => new Date(g.fechaLlegada).getTime() > today.getTime());

    if (llegadasHoy.length > 0) {
        llegadasHoy.forEach(g => hoyList.appendChild(createGrupoCard(g)));
        hoyContainer.classList.remove('hidden');
    } else {
        hoyContainer.classList.add('hidden');
    }

    if (proximasLlegadas.length > 0) {
        proximasLlegadas.forEach(g => proximasList.appendChild(createGrupoCard(g)));
        proximasContainer.classList.remove('hidden');
    } else {
        proximasContainer.classList.add('hidden');
    }
}