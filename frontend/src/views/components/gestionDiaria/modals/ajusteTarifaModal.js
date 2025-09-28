import { fetchAPI } from '../../../../api.js';
import { formatCurrency } from '../gestionDiaria.utils.js';

let currentGrupo = null;
let onActionComplete = () => {};

function renderTabContent(tabName) {
    const contentContainer = document.getElementById('modal-tab-content');
    if (!contentContainer) return;

    switch(tabName) {
        case 'potencial':
            const potencialGuardado = currentGrupo.potencialTotal || 0;
            const valorHuespedActual = currentGrupo.valorTotalHuesped;
            contentContainer.innerHTML = `
                <p class="text-sm text-gray-600 mb-3">Registra el descuento total (%) que un canal aplicó para calcular y guardar su <strong>precio de venta original (Valor Potencial)</strong>. Esto es solo para fines de KPI y no altera el cobro.</p>
                ${potencialGuardado > 0 ? `<div class="p-3 bg-blue-50 border border-blue-200 rounded-md"><p class="text-sm font-semibold text-blue-800">Valor Potencial Guardado: ${formatCurrency(potencialGuardado)}</p></div>` : ''}
                <div class="space-y-4 mt-4">
                    <div>
                        <label for="descuento-agregado-pct" class="block text-sm font-medium text-gray-700">Descuento Agregado del Canal (%)</label>
                        <input type="number" id="descuento-agregado-pct" placeholder="Ej: 45" class="form-input">
                    </div>
                    <div>
                        <p class="text-sm">Valor de Cobro (Total Cliente): <span class="font-semibold">${formatCurrency(valorHuespedActual)}</span></p>
                        <p class="text-sm">Valor Potencial de Venta (Calculado): <span id="valor-potencial-preview" class="font-semibold text-blue-600"></span></p>
                    </div>
                    <div id="potencial-status" class="text-sm"></div>
                    <div class="text-right"><button id="potencial-save-btn" class="btn-primary">Calcular y Guardar Potencial</button></div>
                </div>`;
            
            const descuentoInput = contentContainer.querySelector('#descuento-agregado-pct');
            descuentoInput.addEventListener('input', () => {
                const pct = parseFloat(descuentoInput.value);
                const previewEl = contentContainer.querySelector('#valor-potencial-preview');
                if (pct > 0 && pct < 100) {
                    const potencial = Math.round(valorHuespedActual / (1 - (pct / 100)));
                    previewEl.textContent = formatCurrency(potencial);
                } else {
                    previewEl.textContent = '';
                }
            });
            contentContainer.querySelector('#potencial-save-btn').addEventListener('click', handleSavePotencial);
            break;

        case 'ajuste':
            const valorActualTotal = currentGrupo.valorTotalHuesped;
            contentContainer.innerHTML = `
                <p class="text-sm text-gray-600 mb-3">Modifica el monto final que se cobrará al cliente (Total Cliente). Esta acción es permanente y quedará registrada.</p>
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
    const valorListaBase = currentGrupo.valorListaBaseTotal;
    const totalCliente = currentGrupo.valorTotalHuesped;
    const costoCanalFijo = currentGrupo.costoCanal;
    
    const sobreprecio = Math.max(0, totalCliente - valorListaBase);
    const payoutFinal = valorListaBase + (sobreprecio - costoCanalFijo);

    let recomendacionHtml = '';
    if (payoutFinal > valorListaBase) {
        recomendacionHtml = `
            <div class="p-3 bg-green-50 border border-green-200 rounded-md">
                <h4 class="font-semibold text-green-800">Recomendación</h4>
                <p class="mt-2 text-sm text-green-700">Esta reserva es <strong>muy rentable</strong>. El Payout Final es superior a tu Tarifa Base. No se recomienda ofrecer un descuento para una venta directa.</p>
            </div>`;
    } else {
        const descuentoSugerido = valorListaBase > 0 ? ((valorListaBase - payoutFinal) / valorListaBase) * 100 : 0;
        const montoAhorro = valorListaBase - payoutFinal;
        recomendacionHtml = `
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 class="font-semibold text-blue-800">Potencial de Venta Directa</h4>
                <p class="mt-2 text-sm text-blue-700">Para igualar el Payout del canal (${formatCurrency(payoutFinal)}), podrías ofrecer un descuento de hasta un <strong>${descuentoSugerido.toFixed(1)}%</strong> (equivalente a ${formatCurrency(montoAhorro)}) sobre tu Tarifa Base en una venta directa.</p>
            </div>`;
    }

    contentContainer.innerHTML = `
        <p class="text-sm text-gray-600 mb-4">Analiza la rentabilidad real de esta reserva y compárala con una venta directa.</p>
        <div class="space-y-4">
            <div class="p-3 bg-gray-50 border rounded-md">
                <h4 class="font-semibold text-gray-800">Rentabilidad de la Reserva Actual</h4>
                <dl class="mt-2 text-sm space-y-1">
                    <div class="flex justify-between"><dt class="text-gray-600">Tarifa Base (de tus Tarifas):</dt><dd class="font-medium">${formatCurrency(valorListaBase)}</dd></div>
                    <div class="flex justify-between text-blue-600"><dt>(+) Ajuste por Sobreprecio:</dt><dd class="font-medium">${formatCurrency(sobreprecio)}</dd></div>
                    <div class="flex justify-between text-red-600"><dt>(-) Costos Fijos del Canal:</dt><dd class="font-medium">${formatCurrency(costoCanalFijo)}</dd></div>
                    <div class="flex justify-between border-t pt-1 mt-1"><dt class="font-semibold">Payout Final Real:</dt><dd class="font-semibold text-green-700">${formatCurrency(payoutFinal)}</dd></div>
                </dl>
            </div>
            ${recomendacionHtml}
            ${currentGrupo.potencialCalculado ? `<p class="text-xs text-center text-gray-500">Dato KPI: El canal vendió esta reserva a un valor potencial de ${formatCurrency(currentGrupo.potencialTotal)}.</p>` : ''}
        </div>`;
}

async function handleSavePotencial() {
    const descuento = document.getElementById('descuento-agregado-pct').value;
    const statusEl = document.getElementById('potencial-status');
    
    if (!descuento || parseFloat(descuento) < 0) {
        statusEl.textContent = 'Por favor, ingresa un porcentaje de descuento válido.';
        return;
    }

    try {
        await fetchAPI('/gestion/calcular-potencial', {
            method: 'POST',
            body: {
                idsIndividuales: currentGrupo.reservasIndividuales.map(r => r.id),
                descuento
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
                <button data-tab="potencial" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600">Calcular Potencial (KPI)</button>
                <button data-tab="ajuste" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Ajustar Cobro</button>
                <button data-tab="simulador" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Simulador de Rentabilidad</button>
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

    renderTabContent('potencial');
}