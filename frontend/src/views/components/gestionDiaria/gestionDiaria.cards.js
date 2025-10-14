// frontend/src/views/components/gestionDiaria/gestionDiaria.cards.js
import { getStatusInfo, formatCurrency, formatDate, formatUSD } from './gestionDiaria.utils.js';

function renderFinancialDetails(grupo) {
    if (grupo.esUSD) {
        const valorDolar = grupo.reservasIndividuales[0]?.valorDolarDia || 0;
        const totalClienteUSD = grupo.valoresUSD?.totalCliente || 0;
        const ivaUSD = grupo.valoresUSD?.iva || 0;
        const costoCanalCLP = grupo.costoCanal || 0;
        const costoCanalUSD = valorDolar > 0 ? costoCanalCLP / valorDolar : 0;
        const payoutFinalRealUSD = valorDolar > 0 ? grupo.payoutFinalReal / valorDolar : 0;

        return `
            <div class="grid grid-cols-2 gap-x-4 text-xs">
                <div class="text-right border-r pr-2">
                    <div class="font-bold text-gray-500 mb-1">USD</div>
                    <div class="flex justify-between"><span>Total:</span> <span class="font-medium">${formatUSD(totalClienteUSD)}</span></div>
                    ${ivaUSD > 0 ? `<div class="flex justify-between"><span>IVA:</span> <span class="font-medium">${formatUSD(ivaUSD)}</span></div>` : ''}
                    <div class="flex justify-between"><span>Costo Canal:</span> <span class="font-medium text-red-600">-${formatUSD(costoCanalUSD)}</span></div>
                    <div class="flex justify-between border-t mt-1 pt-1"><span>Payout:</span> <span class="font-semibold text-green-700">${formatUSD(payoutFinalRealUSD)}</span></div>
                </div>
                <div class="text-right">
                    <div class="font-bold text-gray-800 mb-1">CLP</div>
                    <div class="flex justify-between"><span>Total:</span> <span class="font-medium">${formatCurrency(grupo.valorTotalHuesped)}</span></div>
                    <div class="flex justify-between"><span>Abonado:</span> <span class="font-medium text-green-600">${formatCurrency(grupo.abonoTotal)}</span></div>
                    <div class="flex justify-between border-t mt-1 pt-1"><span class="font-bold">Saldo:</span> <span class="font-bold text-red-600">${formatCurrency(grupo.valorTotalHuesped - grupo.abonoTotal)}</span></div>
                </div>
            </div>
        `;
    }
    // Si es solo CLP
    return `
        <div class="text-xs text-gray-500 space-y-1">
            <div class="flex justify-between"><span>Total Cliente:</span> <span class="font-semibold">${formatCurrency(grupo.valorTotalHuesped)}</span></div>
            <div class="flex justify-between"><span>Costo Canal:</span> <span class="font-semibold text-red-600">-${formatCurrency(grupo.costoCanal)}</span></div>
            <div class="flex justify-between font-bold border-t pt-1"><span>Payout:</span> <span class="text-green-700">${formatCurrency(grupo.payoutFinalReal)}</span></div>
            <hr class="my-1">
            <div class="flex justify-between"><span>Abonado:</span> <span class="text-green-600">${formatCurrency(grupo.abonoTotal)}</span></div>
            <div class="flex justify-between border-t border-gray-300 pt-1 mt-1"><span class="font-semibold">Saldo:</span> <span class="font-bold text-red-600">${formatCurrency(grupo.valorTotalHuesped - grupo.abonoTotal)}</span></div>
        </div>`;
}


function renderActionButtons(grupo) {
    const estadoInfo = getStatusInfo(grupo.estadoGestion);
    let buttons = `
        <button class="gestion-btn btn-table-copy text-xs" data-gestion="ajuste_tarifa">Ajuste Tarifa</button>
        <button class="gestion-btn btn-table-copy text-xs" data-gestion="bitacora">Bitácora (${grupo.notasCount})</button>
        <button class="gestion-btn btn-table-copy text-xs" data-gestion="gestionar_reserva">Doc. Reserva</button>
    `;
    
    // --- INICIO DE LA CORRECCIÓN ---
    // Añadir botones de Pagos y Boleta según el estado
    if (grupo.estadoGestion === 'Pendiente Pago' || grupo.estadoGestion === 'Pendiente Boleta' || grupo.estadoGestion === 'Facturado' || grupo.estadoGestion === 'Pendiente Cliente') {
        buttons += `<button class="gestion-btn btn-table-edit text-xs" data-gestion="pagos">Pagos (${grupo.transaccionesCount})</button>`;
    }

    if (grupo.estadoGestion === 'Pendiente Boleta' || grupo.estadoGestion === 'Facturado' || grupo.estadoGestion === 'Pendiente Cliente') {
        const docStatusClass = grupo.documentos.enlaceBoleta ? 'bg-green-500 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-700';
        buttons += `<button class="gestion-btn btn-table-edit text-xs ${docStatusClass}" data-gestion="boleta">Boleta</button>`;
    }
    // --- FIN DE LA CORRECCIÓN ---

    if (estadoInfo.level > 1) { // Puede revertir si no es el primer estado
        buttons += `<button class="revert-btn btn-table-delete text-xs">Revertir</button>`;
    }

    return buttons;
}

function createCard(grupo, allEstados) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkinDate = new Date(grupo.fechaLlegada);
    const diasParaLlegada = Math.round((checkinDate - today) / (1000 * 60 * 60 * 24));
    
    const estadoInfo = getStatusInfo(grupo.estadoGestion, allEstados);
    const alojamientosNombres = grupo.reservasIndividuales.map(r => r.alojamientoNombre).join(', ');

    // --- INICIO DE LA CORRECCIÓN ---
    // El estado principal ahora es un botón si tiene una acción asociada
    const estadoBotonHtml = estadoInfo.gestionType 
        ? `<button class="gestion-btn px-2 py-1 text-xs font-semibold rounded-full" data-gestion="${estadoInfo.gestionType}" style="background-color: ${estadoInfo.color}; color: white;">${estadoInfo.text}</button>`
        : `<span class="px-2 py-1 text-xs font-semibold rounded-full" style="background-color: ${estadoInfo.color}; color: white;">${estadoInfo.text}</span>`;
    // --- FIN DE LA CORRECCIÓN ---

    return `
    <div id="card-${grupo.reservaIdOriginal}" class="p-4 border rounded-lg bg-white shadow-sm flex flex-col md:flex-row gap-4">
        <div class="flex-grow">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-3">
                    ${estadoBotonHtml}
                    <a href="/cliente/${grupo.clienteId}?from-reserva=${grupo.reservaIdOriginal}" data-navigo class="text-lg font-bold text-blue-800 hover:underline">${grupo.clienteNombre}</a>
                    <span class="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded-full">${grupo.tipoCliente} (${grupo.numeroDeReservas})</span>
                </div>
                <span class="text-sm font-semibold text-gray-600">${diasParaLlegada > 0 ? `Llega en ${diasParaLlegada} día(s)` : (diasParaLlegada === 0 ? 'Llega HOY' : `Llegó hace ${-diasParaLlegada} día(s)`)}</span>
            </div>
            <div class="grid grid-cols-3 gap-4 text-sm">
                <div><span class="font-medium text-gray-500">Check-in:</span> ${formatDate(grupo.fechaLlegada)}</div>
                <div><span class="font-medium text-gray-500">Check-out:</span> ${formatDate(grupo.fechaSalida)}</div>
                <div><span class="font-medium text-gray-500">Noches:</span> ${grupo.totalNoches}</div>
                <div class="col-span-3"><span class="font-medium text-gray-500">Alojamientos:</span> ${alojamientosNombres}</div>
                <div class="col-span-3"><span class="font-medium text-gray-500">ID Reserva:</span> <span class="font-mono text-xs">${grupo.reservaIdOriginal}</span></div>
            </div>
        </div>
        <div class="flex-shrink-0 w-full md:w-96 space-y-3">
            ${renderFinancialDetails(grupo)}
            <div class="flex flex-wrap gap-2 justify-end pt-2 border-t">
                ${renderActionButtons(grupo)}
            </div>
        </div>
    </div>`;
}

export function renderGrupos(grupos, allEstados) {
    const revisionList = document.getElementById('revision-list');
    const hoyList = document.getElementById('hoy-list');
    const proximasList = document.getElementById('proximas-list');

    revisionList.innerHTML = '';
    hoyList.innerHTML = '';
    proximasList.innerHTML = '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    grupos.forEach(grupo => {
        const cardHtml = createCard(grupo, allEstados);
        const checkinDate = new Date(grupo.fechaLlegada);

        if (grupo.estadoGestion === 'Desconocido') {
            revisionList.innerHTML += cardHtml;
        } else if (checkinDate <= today) {
            hoyList.innerHTML += cardHtml;
        } else {
            proximasList.innerHTML += cardHtml;
        }
    });

    document.getElementById('revision-container').classList.toggle('hidden', revisionList.innerHTML === '');
    document.getElementById('hoy-container').classList.toggle('hidden', hoyList.innerHTML === '');
    document.getElementById('proximas-container').classList.toggle('hidden', proximasList.innerHTML === '');
}