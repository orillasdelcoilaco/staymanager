import { fetchAPI } from '../../../../api.js';
import { formatCurrency, formatUSD, formatDate } from '../gestionDiaria.utils.js';

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
            const valorOriginal = currentGrupo.valorTotalHuespedOriginal > 0 && currentGrupo.valorTotalHuespedOriginal !== valorActualTotal
                ? currentGrupo.valorTotalHuespedOriginal
                : valorActualTotal;

            contentContainer.innerHTML = `
                <p class="text-sm text-gray-600 mb-3">Modifica el monto final que se cobrará al cliente (Total Cliente). Esta acción es permanente y quedará registrada.</p>
                <div class="space-y-4">
                     <div>
                        <label for="nuevo-valor-final" class="block text-sm font-medium text-gray-700">Nuevo Valor Final a Cobrar (CLP)</label>
                        <input type="number" id="nuevo-valor-final" class="form-input" value="${Math.round(valorActualTotal)}">
                    </div>
                     <p class="text-sm">Valor Original: <span class="font-semibold">${formatCurrency(valorOriginal)}</span></p>
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
    
    const payoutFinalRealCLP = currentGrupo.payoutFinalReal;
    const costoCanalCLP = currentGrupo.costoCanal;
    const totalClienteCLP = currentGrupo.valorTotalHuesped;
    const totalNoches = currentGrupo.totalNoches;
    const numPropiedades = currentGrupo.reservasIndividuales.length;
    let dolarInfoHtml = '';

    let tarifaBaseTotalCLP;
    let tarifaBaseLabel = `Tarifa Base (${totalNoches} Noches x ${numPropiedades} Prop.):`;
    let totalClienteLabel = "Total Cliente:";
    let costoCanalLabel = "(-) Costos del Canal:";
    let payoutFinalLabel = "Payout Final (Ingreso Real):";
    let ivaLabel = "(+) IVA:";

    if (moneda === 'USD' && valorDolarDia) {
        const fechaCheckIn = formatDate(currentGrupo.fechaLlegada);
        dolarInfoHtml = `<p class="text-xs text-center text-gray-500 mb-4">Valor dólar usado para el cálculo (${fechaCheckIn}): <strong>${formatCurrency(valorDolarDia)}</strong></p>`;

        const tarifaBaseUSD = currentGrupo.valorListaBaseTotal;
        tarifaBaseTotalCLP = tarifaBaseUSD * valorDolarDia;
        tarifaBaseLabel = `Tarifa Base (USD ${formatUSD(tarifaBaseUSD, { includeSymbol: false })}):`;
        
        const totalClienteUSD = currentGrupo.valoresUSD.totalCliente;
        totalClienteLabel = `Total Cliente (USD ${formatUSD(totalClienteUSD, { includeSymbol: false })}):`;

        const costoCanalUSD = valorDolarDia > 0 ? costoCanalCLP / valorDolarDia : 0;
        costoCanalLabel = `(-) Costos del Canal (USD ${formatUSD(costoCanalUSD, { includeSymbol: false })}):`;
        
        const payoutFinalUSD = valorDolarDia > 0 ? payoutFinalRealCLP / valorDolarDia : 0;
        payoutFinalLabel = `Payout Final (Ingreso Real) (USD ${formatUSD(payoutFinalUSD, { includeSymbol: false })}):`;
        
        const ivaUSD = currentGrupo.valoresUSD.iva || 0;
        const ivaCLP = ivaUSD * valorDolarDia;
        ivaLabel = `(+) IVA (USD ${formatUSD(ivaUSD, { includeSymbol: false })}):`;

        const rentabilidadVsTarifa = payoutFinalRealCLP - tarifaBaseTotalCLP;

        contentContainer.innerHTML = `
        <p class="text-sm text-gray-600 mb-2">Analiza la rentabilidad real de esta reserva y compárala con una venta directa.</p>
        ${dolarInfoHtml}
        <div class="grid grid-cols-2 gap-4">
            <div class="p-3 bg-gray-50 border rounded-md">
                <h4 class="font-semibold text-gray-800">Análisis Financiero</h4>
                <dl class="mt-2 text-sm space-y-1">
                    <div class="flex justify-between text-gray-500"><dt>${totalClienteLabel}</dt><dd class="font-medium">${formatCurrency(totalClienteCLP)}</dd></div>
                    <div class="flex justify-between text-gray-500"><dt>${ivaLabel}</dt><dd class="font-medium">${formatCurrency(ivaCLP)}</dd></div>
                    <div class="flex justify-between text-red-600"><dt>${costoCanalLabel}</dt><dd class="font-medium">${formatCurrency(costoCanalCLP)}</dd></div>
                    <div class="flex justify-between border-t pt-1 mt-1 font-bold"><dt>${payoutFinalLabel}</dt><dd class="text-green-700">${formatCurrency(payoutFinalRealCLP)}</dd></div>
                </dl>
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-md">
                 <h4 class="font-semibold text-blue-800">Potencial Venta Directa</h4>
                 <dl class="mt-2 text-sm space-y-1">
                    <div class="flex justify-between"><dt>${tarifaBaseLabel}</dt><dd class="font-medium">${formatCurrency(tarifaBaseTotalCLP)}</dd></div>
                    <div class="flex justify-between border-t pt-1 mt-1 font-semibold"><dt>Rentabilidad vs Tarifa:</dt><dd class="${rentabilidadVsTarifa >= 0 ? 'text-green-700' : 'text-red-600'}">${formatCurrency(rentabilidadVsTarifa)}</dd></div>
                </dl>
            </div>
        </div>
        `;

    } else { // Si es CLP
        tarifaBaseTotalCLP = currentGrupo.valorListaBaseTotal;
        const rentabilidadVsTarifa = payoutFinalRealCLP - tarifaBaseTotalCLP;

        contentContainer.innerHTML = `
        <p class="text-sm text-gray-600 mb-2">Analiza la rentabilidad real de esta reserva y compárala con una venta directa.</p>
        <div class="grid grid-cols-2 gap-4">
            <div class="p-3 bg-gray-50 border rounded-md">
                <h4 class="font-semibold text-gray-800">Análisis Financiero</h4>
                <dl class="mt-2 text-sm space-y-1">
                    <div class="flex justify-between text-gray-500"><dt>${totalClienteLabel}</dt><dd class="font-medium">${formatCurrency(totalClienteCLP)}</dd></div>
                    <div class="flex justify-between text-red-600"><dt>${costoCanalLabel}</dt><dd class="font-medium">${formatCurrency(costoCanalCLP)}</dd></div>
                    <div class="flex justify-between border-t pt-1 mt-1 font-bold"><dt>${payoutFinalLabel}</dt><dd class="text-green-700">${formatCurrency(payoutFinalRealCLP)}</dd></div>
                </dl>
            </div>
            <div class="p-3 bg-blue-50 border border-blue-200 rounded-md">
                 <h4 class="font-semibold text-blue-800">Potencial Venta Directa</h4>
                 <dl class="mt-2 text-sm space-y-1">
                    <div class="flex justify-between"><dt>${tarifaBaseLabel}</dt><dd class="font-medium">${formatCurrency(tarifaBaseTotalCLP)}</dd></div>
                    <div class="flex justify-between border-t pt-1 mt-1 font-semibold"><dt>Rentabilidad vs Tarifa:</dt><dd class="${rentabilidadVsTarifa >= 0 ? 'text-green-700' : 'text-red-600'}">${formatCurrency(rentabilidadVsTarifa)}</dd></div>
                </dl>
            </div>
        </div>
        `;
    }
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
                <button data-tab="simulador" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600">Simulador de Rentabilidad</button>
                <button data-tab="potencial" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Calcular Potencial (KPI)</button>
                <button data-tab="ajuste" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Ajustar Cobro</button>
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

    renderTabContent('simulador');
}