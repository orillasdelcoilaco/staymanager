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

function createGrupoCard(grupo, allEstados) {
    if (grupo.estado === 'Desconocido') {
        return createUnknownStateCard(grupo);
    }

    const card = document.createElement('div');
    card.id = `card-${grupo.reservaIdOriginal}`;
    card.className = 'p-4 border rounded-lg shadow-sm flex flex-col';
    const statusInfo = getStatusInfo(grupo.estadoGestion, allEstados);
    const alojamientos = grupo.reservasIndividuales.map(r => r.alojamientoNombre).join(', ');

    const isGestionPagosActive = statusInfo.level >= 3;
    const isGestionBoletaActive = statusInfo.level >= 4;
    const isGestionClienteActive = statusInfo.level >= 5;

    const clienteLink = `
        <div class="flex items-center gap-3">
            <a href="/cliente/${grupo.clienteId}" data-path="/cliente/${grupo.clienteId}" class="nav-link-style text-lg font-bold text-gray-800 hover:text-indigo-600" title="Abrir ficha del cliente">${grupo.clienteNombre}</a>
            <span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">${grupo.tipoCliente} (${grupo.numeroDeReservas})</span>
        </div>`;
    const revertButtonHtml = statusInfo.level > 1 && statusInfo.level < 99 ? `<button data-id="${grupo.reservaIdOriginal}" class="revert-btn ml-2 text-xl" title="Revertir estado">↩️</button>` : '';

    let statusHtml;
    const styleAttr = `style="background-color: ${statusInfo.color};"`;
    if (statusInfo.gestionType) {
        statusHtml = `<button data-gestion="${statusInfo.gestionType}" class="gestion-btn text-sm font-bold text-white px-2 py-1 rounded hover:opacity-80" ${styleAttr}>${statusInfo.text}</button>`;
    } else {
        statusHtml = `<span class="text-sm font-bold text-white px-2 py-1 rounded" ${styleAttr}>${statusInfo.text}</span>`;
    }

    let financialDetailsHtml;
    const saldo = grupo.valorTotalHuesped - grupo.abonoTotal;

    if (grupo.esUSD) {
        const valorDolar = grupo.reservasIndividuales[0]?.valorDolarDia || 0;
        financialDetailsHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 font-semibold w-full">
                <div class="text-sm space-y-1 p-2 bg-blue-50 rounded-md border border-blue-200">
                    <h4 class="font-bold text-blue-800 text-center mb-1">Valores en USD</h4>
                    <div class="flex justify-between"><span>Tarifa Base:</span> <span>${formatUSD(grupo.valoresUSD?.payout || 0)}</span></div>
                    <div class="flex justify-between text-gray-600"><span>(+) IVA:</span> <span>${formatUSD(grupo.valoresUSD?.iva || 0)}</span></div>
                    <div class="flex justify-between border-t border-blue-200 mt-1 pt-1 font-bold"><span>Total Cliente:</span> <span>${formatUSD(grupo.valoresUSD?.totalCliente || 0)}</span></div>
                </div>
                <div class="text-sm space-y-1 p-2 bg-gray-50 rounded-md">
                    <h4 class="font-bold text-gray-800 text-center mb-1">Equivalente en CLP (Dólar a ${formatCurrency(valorDolar)})</h4>
                    <div class="flex justify-between font-bold text-base"><span>Total a Pagar:</span> <span>${formatCurrency(grupo.valorTotalHuesped)}</span></div>
                     <div class="flex justify-between text-green-600"><span>Abonado:</span> <span>${formatCurrency(grupo.abonoTotal)}</span></div>
                    <div class="flex justify-between text-red-600"><span>Saldo Pendiente:</span> <span>${formatCurrency(saldo)}</span></div>
                </div>
            </div>
        `;
    } else {
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
    }

    const baseButtonClasses = "w-full px-3 py-1 text-xs font-semibold rounded-md transition-colors relative";
    const activeButtonClasses = "bg-gray-100 text-gray-800 hover:bg-gray-200";
    const disabledButtonClasses = "bg-gray-100 text-gray-400 cursor-not-allowed";

    card.innerHTML = `
        <div class="flex items-center mb-2">
            ${statusHtml}
            ${revertButtonHtml}
            <div class="ml-4 flex-grow">${clienteLink}</div>
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
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="pagos" class="gestion-btn ${baseButtonClasses} ${isGestionPagosActive ? activeButtonClasses : disabledButtonClasses}" ${!isGestionPagosActive ? 'disabled' : ''}>Gestionar Pagos ${createNotificationBadge(false, grupo.transaccionesCount)}</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="boleta" class="gestion-btn ${baseButtonClasses} ${isGestionBoletaActive ? activeButtonClasses : disabledButtonClasses}" ${!isGestionBoletaActive ? 'disabled' : ''}>Gestionar Boleta ${createNotificationBadge(!!grupo.documentos?.enlaceBoleta)}</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="gestionar_cliente" class="gestion-btn ${baseButtonClasses} ${isGestionClienteActive ? activeButtonClasses : disabledButtonClasses}" ${!isGestionClienteActive ? 'disabled' : ''}>Gestionar Cliente ${createNotificationBadge(grupo.clienteGestionado)}</button>
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

function createUnknownStateCard(grupo) {
    const card = document.createElement('div');
    card.id = `card-${grupo.reservaIdOriginal}`;
    card.className = 'p-4 border border-amber-300 bg-amber-50 rounded-lg shadow-sm flex flex-col';
    const alojamientos = grupo.reservasIndividuales.map(r => r.alojamientoNombre).join(', ');

    card.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-bold text-white px-2 py-1 rounded bg-amber-500">ESTADO DESCONOCIDO</span>
            <span class="text-lg font-bold text-gray-800">${grupo.clienteNombre}</span>
        </div>
        <div class="text-sm text-gray-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>ID Reserva:</strong> ${grupo.reservaIdOriginal}</span>
            <span><strong>Estancia:</strong> ${formatDate(grupo.fechaLlegada)} al ${formatDate(grupo.fechaSalida)}</span>
            <span><strong>Alojamientos:</strong> ${alojamientos}</span>
        </div>
        <div class="border-t mt-4 pt-3 flex justify-end items-center">
            <button data-gestion="corregir_estado" data-id="${grupo.reservasIndividuales[0].id}" class="gestion-btn px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700">
                Revisar y Corregir Estado
            </button>
        </div>`;
    return card;
}


export function renderGrupos(grupos, allEstados) {
    const revisionList = document.getElementById('revision-list');
    const hoyList = document.getElementById('hoy-list');
    const proximasList = document.getElementById('proximas-list');
    const noPendientes = document.getElementById('no-pendientes');
    const revisionContainer = document.getElementById('revision-container');
    const hoyContainer = document.getElementById('hoy-container');
    const proximasContainer = document.getElementById('proximas-container');
    
    revisionList.innerHTML = '';
    hoyList.innerHTML = '';
    proximasList.innerHTML = '';

    if (grupos.length === 0) {
        noPendientes.classList.remove('hidden');
        revisionContainer.classList.add('hidden');
        hoyContainer.classList.add('hidden');
        proximasContainer.classList.add('hidden');
        return;
    }
    
    noPendientes.classList.add('hidden');
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const paraRevision = grupos.filter(g => g.estado === 'Desconocido');
    const confirmados = grupos.filter(g => g.estado === 'Confirmada');

    const llegadasHoy = confirmados.filter(g => new Date(g.fechaLlegada).getTime() <= today.getTime());
    const proximasLlegadas = confirmados.filter(g => new Date(g.fechaLlegada).getTime() > today.getTime());

    if (paraRevision.length > 0) {
        paraRevision.forEach(g => revisionList.appendChild(createUnknownStateCard(g)));
        revisionContainer.classList.remove('hidden');
    } else {
        revisionContainer.classList.add('hidden');
    }

    if (llegadasHoy.length > 0) {
        llegadasHoy.forEach(g => hoyList.appendChild(createGrupoCard(g, allEstados)));
        hoyContainer.classList.remove('hidden');
    } else {
        hoyContainer.classList.add('hidden');
    }

    if (proximasLlegadas.length > 0) {
        proximasLlegadas.forEach(g => proximasList.appendChild(createGrupoCard(g, allEstados)));
        proximasContainer.classList.remove('hidden');
    } else {
        proximasContainer.classList.add('hidden');
    }
}