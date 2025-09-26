import { fetchAPI } from '../../../../api.js';
import { formatCurrency } from '../gestionDiaria.utils.js';

let currentGrupo = null;
let onActionComplete = () => {};

async function renderAnalisisFinanciero() {
    const contentContainer = document.getElementById('modal-tab-content');
    contentContainer.innerHTML = `<p class="text-sm text-gray-500">Calculando análisis...</p>`;

    try {
        const analisis = await fetchAPI('/gestion/analisis', { method: 'POST', body: currentGrupo });

        const renderFila = (label, valor) => {
            const valorCLP = analisis.moneda === 'USD' ? valor * analisis.valorDolarDia : valor;
            return `
                <div class="grid grid-cols-3 gap-4 py-2 border-b">
                    <span class="font-medium text-gray-700">${label}</span>
                    <span class="text-right">${analisis.moneda === 'USD' ? formatCurrency(valor) : ''}</span>
                    <span class="text-right font-semibold">${formatCurrency(valorCLP)}</span>
                </div>`;
        };
        
        const totalCostoCanal = analisis.descuentos + analisis.costoCanal;

        contentContainer.innerHTML = `
            <div class="text-sm">
                <div class="grid grid-cols-3 gap-4 font-bold text-gray-500 pb-2">
                    <span>Concepto</span>
                    <span class="text-right">${analisis.moneda === 'USD' ? 'Valor (USD)' : ''}</span>
                    <span class="text-right">Valor (CLP)</span>
                </div>
                ${renderFila('Valor Tarifa (Tu Precio Lista)', analisis.valorLista)}
                ${renderFila('(-) Descuentos de Canal', analisis.descuentos)}
                ${renderFila('(-) Comisión / Tarifas', analisis.costoCanal)}
                <div class="grid grid-cols-3 gap-4 py-2 border-b bg-gray-50 font-bold">
                    <span class="text-gray-800">(=) Payout Neto para ti</span>
                    <span class="text-right">${analisis.moneda === 'USD' ? formatCurrency(analisis.payout) : ''}</span>
                    <span class="text-right text-green-600">${formatCurrency(analisis.moneda === 'USD' ? analisis.payout * analisis.valorDolarDia : analisis.payout)}</span>
                </div>
                <div class="grid grid-cols-3 gap-4 py-2 font-bold mt-4">
                    <span class="text-gray-800">Costo Total del Canal</span>
                    <span class="text-right">${analisis.moneda === 'USD' ? formatCurrency(totalCostoCanal) : ''}</span>
                    <span class="text-right text-red-600">${formatCurrency(analisis.moneda === 'USD' ? totalCostoCanal * analisis.valorDolarDia : totalCostoCanal)}</span>
                </div>
                ${analisis.moneda === 'USD' ? `<p class="text-xs text-right text-gray-500 mt-2">Valor Dólar usado: ${formatCurrency(analisis.valorDolarDia)}</p>` : ''}
            </div>
        `;
    } catch (error) {
        contentContainer.innerHTML = `<p class="text-sm text-red-500">Error al calcular: ${error.message}</p>`;
    }
}


function renderTabContent(tabName) {
    const contentContainer = document.getElementById('modal-tab-content');
    if (!contentContainer) return;
    const valorActualTotal = currentGrupo.valorTotalHuesped;

    switch(tabName) {
        case 'analisis':
            renderAnalisisFinanciero();
            break;
        case 'kpi':
            // ... (código existente sin cambios)
            break;
        case 'ajuste':
            // ... (código existente sin cambios)
            break;
        case 'distribuir':
            // ... (código existente sin cambios)
            break;
    }
}


// --- (El resto del archivo, con las funciones handleSave, etc. no necesita cambios) ---

export function renderAjusteTarifaModal(grupo, callback) {
    currentGrupo = grupo;
    onActionComplete = callback;

    const contentContainer = document.getElementById('modal-content-container');
    contentContainer.innerHTML = `
        <div class="border-b border-gray-200">
            <nav id="modal-tabs" class="-mb-px flex space-x-6" aria-label="Tabs">
                <button data-tab="analisis" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600">Análisis Financiero</button>
                <button data-tab="ajuste" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Ajustar Cobro</button>
                <button data-tab="kpi" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Calcular Potencial (KPI)</button>
                ${currentGrupo.reservasIndividuales.length > 1 ? `<button data-tab="distribuir" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Distribuir Valores</button>` : ''}
            </nav>
        </div>
        <div id="modal-tab-content" class="mt-5"></div>
    `;

    const tabs = contentContainer.querySelectorAll('.modal-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('border-indigo-500', 'text-indigo-600');
                t.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            tab.classList.add('border-indigo-500', 'text-indigo-600');
            tab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            renderTabContent(tab.dataset.tab);
        });
    });

    renderTabContent('analisis'); // <-- Abrir en la nueva pestaña por defecto
}