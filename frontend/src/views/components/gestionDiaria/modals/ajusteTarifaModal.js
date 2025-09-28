import { fetchAPI } from '../../../../api.js';
import { formatCurrency } from '../gestionDiaria.utils.js';

let currentGrupo = null;
let onActionComplete = () => {};

function renderTabContent(tabName) {
    const contentContainer = document.getElementById('modal-tab-content');
    if (!contentContainer) return;

    switch(tabName) {
        case 'payout':
            const descuentoGuardado = currentGrupo.reservasIndividuales[0].valores.descuentoManualPct || '';
            const payoutGuardado = currentGrupo.valorTotalPayout;
            const valorDeLista = currentGrupo.potencialTotal || currentGrupo.valorTotalHuesped;
            contentContainer.innerHTML = `
                <p class="text-sm text-gray-600 mb-3">Registra un descuento manual (ej. Genius) que no aparece en el reporte. Esto recalculará el <strong>Payout final</strong> para reflejar la rentabilidad real de la reserva.</p>
                <div class="space-y-4 mt-4">
                    <div>
                        <label for="descuento-manual-pct" class="block text-sm font-medium text-gray-700">Porcentaje de Descuento Manual (%)</label>
                        <input type="number" id="descuento-manual-pct" placeholder="Ej: 15" class="form-input" value="${descuentoGuardado}">
                    </div>
                    <div>
                        <p class="text-sm">Valor de Lista (Base): <span class="font-semibold">${formatCurrency(valorDeLista)}</span></p>
                        <p class="text-sm">Payout Actual: <span class="font-semibold text-green-600">${formatCurrency(payoutGuardado)}</span></p>
                    </div>
                    <div id="payout-status" class="text-sm"></div>
                    <div class="text-right"><button id="payout-save-btn" class="btn-primary">Calcular y Guardar Payout</button></div>
                </div>`;
            contentContainer.querySelector('#payout-save-btn').addEventListener('click', handleSavePayout);
            break;

        case 'ajuste':
            const valorActualTotal = currentGrupo.valorTotalHuesped;
            contentContainer.innerHTML = `
                <p class="text-sm text-gray-600 mb-3">Modifica el monto final que se cobrará al cliente. El nuevo valor se distribuirá proporcionalmente entre las cabañas y sus valores asociados. <strong>Esta acción es permanente.</strong></p>
                <div class="space-y-4">
                     <div>
                        <label for="nuevo-valor-final" class="block text-sm font-medium text-gray-700">Nuevo Valor Final a Cobrar (CLP)</label>
                        <input type="number" id="nuevo-valor-final" class="form-input" value="${Math.round(valorActualTotal)}">
                    </div>
                     <p class="text-sm">Valor Original: <span class="font-semibold">${formatCurrency(valorActualTotal)}</span></p>
                     <div id="ajuste-status" class="text-sm"></div>
                     <div class="text-right"><button id="ajuste-save-btn" class="btn-danger">Ajustar Monto Final</button></div>
                </div>`;
            contentContainer.querySelector('#ajuste-save-btn').addEventListener('click', handleSaveAjusteFinal);
            break;

        case 'simulador':
            renderSimuladorVentaDirecta();
            break;
    }
}

function renderSimuladorVentaDirecta() {
    const contentContainer = document.getElementById('modal-tab-content');
    const reservaPrincipal = currentGrupo.reservasIndividuales[0];
    const { moneda, valorDolarDia } = reservaPrincipal;
    const costoCanal = currentGrupo.costoCanal;
    const payoutActual = currentGrupo.valorTotalPayout;
    const valorDeLista = currentGrupo.potencialTotal || currentGrupo.valorTotalHuesped;

    const costoCanalDisplay = moneda === 'USD' 
        ? `${formatCurrency(costoCanal)} (USD ${(costoCanal / (valorDolarDia || 1)).toFixed(2)} @ ${valorDolarDia})`
        : formatCurrency(costoCanal);

    const descuentoSugerido = valorDeLista > 0 ? ((valorDeLista - payoutActual) / valorDeLista) * 100 : 0;

    contentContainer.innerHTML = `
        <p class="text-sm text-gray-600 mb-4">Compara la rentabilidad de esta reserva contra una venta directa para tomar mejores decisiones de precios.</p>
        <div class="space-y-4">
            <div class="p-3 bg-gray-50 border rounded-md">
                <h4 class="font-semibold text-gray-800">1. Rentabilidad de la Reserva Actual (${reservaPrincipal.canalNombre})</h4>
                <dl class="mt-2 text-sm space-y-1">
                    <div class="flex justify-between">
                        <dt class="text-gray-600">Valor de Lista (Tarifa Base):</dt>
                        <dd class="font-medium">${formatCurrency(valorDeLista)}</dd>
                    </div>
                    <div class="flex justify-between">
                        <dt class="text-gray-600">Costo del Canal:</dt>
                        <dd class="font-medium text-red-600">- ${costoCanalDisplay}</dd>
                    </div>
                    <div class="flex justify-between border-t pt-1 mt-1">
                        <dt class="font-semibold">Payout Final de esta Reserva:</dt>
                        <dd class="font-semibold text-green-700">${formatCurrency(payoutActual)}</dd>
                    </div>
                </dl>
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 class="font-semibold text-blue-800">2. Potencial de Venta Directa</h4>
                <p class="mt-2 text-sm text-blue-700">Para igualar el Payout del canal, podrías ofrecer un descuento de hasta un <strong>${descuentoSugerido.toFixed(1)}%</strong> sobre tu Valor de Lista en una venta directa.</p>
            </div>
        </div>`;
}


async function handleSavePayout() {
    const descuentoManualPct = document.getElementById('descuento-manual-pct').value;
    const statusEl = document.getElementById('payout-status');
    
    if (!descuentoManualPct || parseFloat(descuentoManualPct) < 0) {
        statusEl.textContent = 'Por favor, ingresa un porcentaje de descuento válido.';
        return;
    }

    try {
        await fetchAPI('/gestion/ajustar-payout', {
            method: 'POST',
            body: {
                idsIndividuales: currentGrupo.reservasIndividuales.map(r => r.id),
                descuentoManualPct
            }
        });
        document.getElementById('gestion-modal').classList.add('hidden');
        await onActionComplete();
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
    }
}

async function handleSaveAjusteFinal() {
    const nuevoTotalHuesped = document.getElementById('nuevo-valor-final').value;
    const valoresCabanas = currentGrupo.reservasIndividuales.map(res => ({ id: res.id }));

    try {
        await fetchAPI('/gestion/ajustar-valores', { 
            method: 'POST', 
            body: { valoresCabanas, nuevoTotalHuesped }
        });
        document.getElementById('gestion-modal').classList.add('hidden');
        await onActionComplete();
    } catch (error) {
        document.getElementById('ajuste-status').textContent = `Error: ${error.message}`;
    }
}

export function renderAjusteTarifaModal(grupo, callback) {
    currentGrupo = grupo;
    onActionComplete = callback;

    const contentContainer = document.getElementById('modal-content-container');
    contentContainer.innerHTML = `
        <div class="border-b border-gray-200">
            <nav id="modal-tabs" class="-mb-px flex space-x-6" aria-label="Tabs">
                <button data-tab="payout" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600">Ajustar Payout (KPI)</button>
                <button data-tab="ajuste" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Ajustar Cobro</button>
                <button data-tab="simulador" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Simulador Venta Directa</button>
            </nav>
        </div>
        <div id="modal-tab-content" class="mt-5"></div>
    `;

    const tabs = contentContainer.querySelectorAll('.modal-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('border-indigo-500', 'text-indigo-600'));
            tab.classList.add('border-indigo-500', 'text-indigo-600');
            renderTabContent(tab.dataset.tab);
        });
    });

    renderTabContent('payout');
}