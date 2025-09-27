import { fetchAPI } from '../../../../api.js';
import { formatCurrency } from '../gestionDiaria.utils.js';

let currentGrupo = null;
let onActionComplete = () => {};

// ... (renderTabContent y otras funciones auxiliares no cambian)
function renderTabContent(tabName) {
    const contentContainer = document.getElementById('modal-tab-content');
    if (!contentContainer) return;
    const valorActualTotal = currentGrupo.valorTotalHuesped; // <-- Usar Total Cliente

    switch(tabName) {
        case 'kpi':
            const potencialGuardadoHtml = currentGrupo.potencialCalculado 
                ? `<div class="p-3 bg-blue-50 border border-blue-200 rounded-md"><p class="text-sm font-semibold text-blue-800">Valor Potencial Guardado: ${formatCurrency(currentGrupo.potencialTotal)}</p></div>` 
                : '';
            contentContainer.innerHTML = `
                <p class="text-sm text-gray-600 mb-3">Calcula el precio de lista (potencial) basado en el valor de cobro actual y un descuento. <strong>Esto no altera el valor a cobrar al cliente.</strong></p>
                ${potencialGuardadoHtml}
                <div class="space-y-4 mt-4">
                    <div>
                        <label for="descuento-pct" class="block text-sm font-medium text-gray-700">Porcentaje de Descuento (%)</label>
                        <input type="number" id="descuento-pct" placeholder="Ej: 15" class="form-input">
                    </div>
                    <div>
                        <p class="text-sm">Valor de Cobro Actual: <span class="font-semibold">${formatCurrency(valorActualTotal)}</span></p>
                        <p class="text-sm">Valor Potencial Calculado: <span id="valor-potencial-preview" class="font-semibold text-blue-600"></span></p>
                    </div>
                    <div id="kpi-status" class="text-sm"></div>
                    <div class="text-right"><button id="kpi-save-btn" class="btn-primary">Calcular y Guardar Potencial</button></div>
                </div>`;
            
            const descuentoInput = contentContainer.querySelector('#descuento-pct');
            descuentoInput.addEventListener('input', () => {
                const pct = parseFloat(descuentoInput.value);
                const previewEl = contentContainer.querySelector('#valor-potencial-preview');
                if (pct > 0 && pct < 100) {
                    const potencial = Math.round(valorActualTotal / (1 - (pct / 100)));
                    previewEl.textContent = formatCurrency(potencial);
                } else {
                    previewEl.textContent = '';
                }
            });
            contentContainer.querySelector('#kpi-save-btn').addEventListener('click', handleSaveKpi);
            break;

        case 'ajuste':
            contentContainer.innerHTML = `
                <p class="text-sm text-gray-600 mb-3">Modifica el monto final que se cobrará al cliente. El nuevo valor se distribuirá proporcionalmente entre las cabañas y sus valores asociados (payout, etc). <strong>Esta acción es permanente.</strong></p>
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

        case 'distribuir':
            renderAjusteGrupo();
            break;
    }
}

function renderAjusteGrupo() {
    const contentContainer = document.getElementById('modal-tab-content');
    let cabanasHtml = currentGrupo.reservasIndividuales.map(res => `
        <div class="grid grid-cols-2 gap-4 items-center">
            <label for="valor-${res.id}" class="text-sm font-medium">${res.alojamientoNombre}</label>
            <input type="number" id="valor-${res.id}" data-id="${res.id}" class="valor-input form-input" value="${Math.round(res.valorHuesped)}">
        </div>`).join('');
    contentContainer.innerHTML = `
        <div class="space-y-4">
            <p class="text-sm text-gray-600">Corrige la distribución del valor total (Total Cliente) entre las cabañas del grupo.</p>
            <div class="space-y-2">${cabanasHtml}</div>
            <div class="border-t pt-3 flex justify-between items-center font-bold"><span>TOTAL:</span><span id="ajuste-valores-total"></span></div>
            <div id="ajuste-valores-status" class="text-sm"></div>
            <div class="text-right"><button id="ajuste-valores-save-btn" class="btn-primary">Guardar Distribución</button></div>
        </div>`;
    contentContainer.querySelectorAll('.valor-input').forEach(input => input.addEventListener('input', updateValoresTotal));
    contentContainer.querySelector('#ajuste-valores-save-btn').addEventListener('click', handleSaveAjusteGrupo);
    updateValoresTotal();
}

function updateValoresTotal() {
    let total = 0;
    document.querySelectorAll('.valor-input').forEach(input => { total += parseFloat(input.value) || 0; });
    document.getElementById('ajuste-valores-total').textContent = formatCurrency(total);
}

async function handleSaveKpi() {
    const descuento = document.getElementById('descuento-pct').value;
    const statusEl = document.getElementById('kpi-status');
    
    if (!descuento || parseFloat(descuento) <= 0) {
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

async function handleSaveAjusteGrupo() {
    const nuevoTotalHuesped = Array.from(document.querySelectorAll('.valor-input')).reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    const valoresCabanas = currentGrupo.reservasIndividuales.map(res => ({ id: res.id }));
    
    // En este caso, el total es la suma de los inputs, y la lógica de proporción se aplica igual en el backend.
    try {
        await fetchAPI('/gestion/ajustar-valores', { 
            method: 'POST', 
            body: { valoresCabanas, nuevoTotalHuesped }
        });
        document.getElementById('gestion-modal').classList.add('hidden');
        await onActionComplete();
    } catch (error) {
        document.getElementById('ajuste-valores-status').textContent = `Error: ${error.message}`;
    }
}


export function renderAjusteTarifaModal(grupo, callback) {
    currentGrupo = grupo;
    onActionComplete = callback;

    const contentContainer = document.getElementById('modal-content-container');
    contentContainer.innerHTML = `
        <div class="border-b border-gray-200">
            <nav id="modal-tabs" class="-mb-px flex space-x-6" aria-label="Tabs">
                <button data-tab="kpi" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600">Calcular Potencial (KPI)</button>
                <button data-tab="ajuste" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Ajustar Cobro</button>
                ${currentGrupo.reservasIndividuales.length > 1 ? `<button data-tab="distribuir" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Distribuir Valores</button>` : ''}
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

    renderTabContent('kpi');
}