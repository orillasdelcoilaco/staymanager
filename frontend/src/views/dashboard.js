// frontend/src/views/dashboard.js
import { fetchAPI } from '../api.js';
import { renderCharts } from './components/dashboard/charts.js';

let fullKpiResults = null;

function formatCurrency(value) {
    return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;
}

function displayKPIs(kpis) {
    const kpiCardsContainer = document.getElementById('kpi-cards');
    if (!kpiCardsContainer) return;

    kpiCardsContainer.innerHTML = `
        <div class="p-4 bg-green-100 rounded-lg"><div class="text-sm font-medium text-green-700">Ingreso Real (Facturado)</div><div class="text-2xl font-bold text-green-900">${formatCurrency(kpis.ingresoFacturado)}</div></div>
        <div class="p-4 bg-green-100 rounded-lg"><div class="text-sm font-medium text-green-700">Payout Neto (Facturado)</div><div class="text-2xl font-bold text-green-900">${formatCurrency(kpis.payoutFacturado)}</div></div>
        <div class="p-4 bg-green-100 rounded-lg"><div class="text-sm font-medium text-green-700">Costo de Canales (Fact.)</div><div class="text-2xl font-bold text-green-900">${formatCurrency(kpis.costoCanalFacturado)}</div></div>
        
        <div class="p-4 bg-blue-100 rounded-lg"><div class="text-sm font-medium text-blue-700">Ingreso Proyectado</div><div class="text-2xl font-bold text-blue-900">${formatCurrency(kpis.ingresoProyectado)}</div></div>
        <div class="p-4 bg-red-100 rounded-lg"><div class="text-sm font-medium text-red-700">Dsctos. Canal Externo</div><div class="text-2xl font-bold text-red-900">${formatCurrency(kpis.descuentosDeCanalExterno)}</div></div>
        <div class="p-4 bg-yellow-100 rounded-lg"><div class="text-sm font-medium text-yellow-700">Ajustes Internos</div><div class="text-2xl font-bold text-yellow-800">${formatCurrency(kpis.ajustesManualesInternos)}</div></div>

        <div class="p-4 bg-gray-100 rounded-lg"><div class="text-sm font-medium text-gray-600">Ocup. (Confirmada)</div><div class="text-2xl font-bold text-gray-900">${kpis.tasaOcupacionConfirmada.toFixed(1)}%</div></div>
        <div class="p-4 bg-gray-100 rounded-lg"><div class="text-sm font-medium text-gray-600">ADR (Facturado)</div><div class="text-2xl font-bold text-gray-900">${formatCurrency(kpis.adrFacturado)}</div></div>
        <div class="p-4 bg-gray-100 rounded-lg"><div class="text-sm font-medium text-gray-600">RevPAR (Facturado)</div><div class="text-2xl font-bold text-gray-900">${formatCurrency(kpis.revParFacturado)}</div></div>
    `;
}

function renderRankingOperativoTable(data) {
    const tableBody = document.getElementById('ranking-operativo-body');
    if (!tableBody) return;

    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-4">No hay datos.</td></tr>`;
        return;
    }

    tableBody.innerHTML = data.sort((a,b) => b.nochesOcupadasConfirmadas - a.nochesOcupadasConfirmadas).map(prop => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${prop.nombre}</td>
            <td class="px-4 py-3 text-sm text-center">${prop.ocupacion.toFixed(1)}%</td>
            <td class="px-4 py-3 text-sm text-center font-bold">${prop.reservasFacturadas}</td>
            <td class="px-4 py-3 text-sm text-center">${prop.nochesOcupadasConfirmadas} / ${prop.nochesDisponibles}</td>
            <td class="px-4 py-3 text-sm text-center">${prop.duracionPromedio.toFixed(1)} noches</td>
            <td class="px-4 py-3 text-sm">${Object.entries(prop.nochesPorCanal).map(([canal, noches]) => `${canal}: ${noches}`).join(', ')}</td>
        </tr>
    `).join('');
}

function renderRankingFinancieroTable(data) {
    const tableBody = document.getElementById('ranking-financiero-body');
    if (!tableBody) return;

    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay datos.</td></tr>`;
        return;
    }
    
    tableBody.innerHTML = data.sort((a,b) => b.ingresoTotalFacturado - a.ingresoTotalFacturado).map(prop => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${prop.nombre}</td>
            <td class="px-4 py-3 text-sm text-right font-bold">${formatCurrency(prop.ingresoTotalFacturado)}</td>
            <td class="px-4 py-3 text-sm text-right text-green-700 font-semibold">${formatCurrency(prop.payoutTotalFacturado)}</td>
            <td class="px-4 py-3 text-sm text-right">${formatCurrency(prop.valorPromedioReserva)}</td>
            <td class="px-4 py-3 text-sm text-right">${formatCurrency(prop.adr)}</td>
            <td class="px-4 py-3 text-sm text-right text-red-600">${formatCurrency(prop.descuentosDeCanalExterno)}</td>
            <td class="px-4 py-3 text-sm text-right text-yellow-800">${formatCurrency(prop.ajustesManualesInternos)}</td>
        </tr>
    `).join('');
}

function renderCanalTable(data) {
    const tableBody = document.getElementById('canal-analysis-body');
    if (!tableBody) return;

    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay datos.</td></tr>`;
        return;
    }

    tableBody.innerHTML = data.sort((a,b) => b.ingresoTotal - a.ingresoTotal).map(canal => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${canal.nombre}</td>
            <td class="px-4 py-3 text-sm text-center font-bold">${canal.numeroReservas}</td>
            <td class="px-4 py-3 text-sm text-center">${canal.nochesVendidas}</td>
            <td class="px-4 py-3 text-sm text-right font-semibold">${formatCurrency(canal.ingresoTotal)}</td>
            <td class="px-4 py-3 text-sm text-right text-green-700">${formatCurrency(canal.payoutNeto)}</td>
            <td class="px-4 py-3 text-sm text-right">${formatCurrency(canal.ingresoPromedioPorReserva)}</td>
            <td class="px-4 py-3 text-sm text-right text-red-600">${formatCurrency(canal.costoPromedioPorReserva)}</td>
        </tr>
    `).join('');
}


export async function render() {
    const canales = await fetchAPI('/canales');
    const canalOptions = canales.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-8">
            <h2 class="text-2xl font-semibold text-gray-900">Dashboard de Rendimiento</h2>
            
            <div class="p-4 border rounded-md bg-gray-50">
                <div class="flex flex-col md:flex-row items-end space-y-4 md:space-y-0 md:space-x-4">
                    <div>
                        <label for="kpi-fecha-inicio" class="block text-sm font-medium text-gray-700">Fecha de Inicio</label>
                        <input type="date" id="kpi-fecha-inicio" class="mt-1 form-input">
                    </div>
                    <div>
                        <label for="kpi-fecha-fin" class="block text-sm font-medium text-gray-700">Fecha de Fin</label>
                        <input type="date" id="kpi-fecha-fin" class="mt-1 form-input">
                    </div>
                    <div>
                        <label for="kpi-canal-filtro" class="block text-sm font-medium text-gray-700">Filtrar por Canal</label>
                        <select id="kpi-canal-filtro" class="mt-1 form-select">
                            <option value="">Todos los canales</option>
                            ${canalOptions}
                        </select>
                    </div>
                    <button id="kpi-calculate-btn" class="btn-primary w-full md:w-auto">Calcular</button>
                </div>
            </div>

            <div id="status-container" class="text-center text-gray-500 hidden p-4"></div>
            
            <div id="empty-state-container" class="hidden text-center py-12 px-4 border-2 border-dashed rounded-lg">
                <h3 class="text-xl font-semibold text-gray-700">Aún no hay datos para mostrar</h3>
                <p class="mt-2 text-sm text-gray-500">Aquí verás tus métricas de rendimiento una vez que tengas reservas confirmadas o facturadas en el período seleccionado.</p>
                <p class="mt-2 text-sm text-gray-500">Intenta seleccionar otro rango de fechas o procesa nuevas reservas.</p>
            </div>

            <div id="kpi-results-container" class="hidden space-y-12">
                <div id="kpi-cards" class="grid grid-cols-2 md:grid-cols-3 gap-4 text-center"></div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Ingreso vs Payout por Canal</h3>
                        <canvas id="income-chart"></canvas>
                    </div>
                    <div>
                         <h3 class="text-lg font-semibold text-gray-800 mb-2">Distribución de Noches por Canal</h3>
                        <canvas id="nights-chart"></canvas>
                    </div>
                </div>

                <div>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Tabla 1: Rendimiento Operativo por Propiedad</h3>
                    <div class="table-container">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50"><tr>
                                <th class="th">Propiedad</th>
                                <th class="th text-center">Ocupación (%)</th>
                                <th class="th text-center">Nº Reservas</th>
                                <th class="th text-center">Noches (Vendidas/Disp)</th>
                                <th class="th text-center">Duración Prom.</th>
                                <th class="th">Desglose Noches</th>
                            </tr></thead>
                            <tbody id="ranking-operativo-body" class="bg-white divide-y divide-gray-200"></tbody>
                        </table>
                    </div>
                </div>
                
                <div>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Tabla 2: Análisis Financiero por Propiedad</h3>
                    <div class="table-container">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50"><tr>
                                <th class="th">Propiedad</th>
                                <th class="th text-right">Ingreso (Fact.)</th>
                                <th class="th text-right">Payout (Fact.)</th>
                                <th class="th text-right">Valor Prom. Reserva</th>
                                <th class="th text-right">ADR (Fact.)</th>
                                <th class="th text-right">Dsctos. Canal</th>
                                <th class="th text-right">Dsctos. Internos</th>
                            </tr></thead>
                            <tbody id="ranking-financiero-body" class="bg-white divide-y divide-gray-200"></tbody>
                        </table>
                    </div>
                </div>
                
                <div>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Tabla 3: Análisis por Canal de Venta</h3>
                    <div class="table-container">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50"><tr>
                                <th class="th">Canal</th>
                                <th class="th text-center">Nº Reservas</th>
                                <th class="th text-center">Noches Vendidas</th>
                                <th class="th text-right">Ingreso Total</th>
                                <th class="th text-right">Payout Neto</th>
                                <th class="th text-right">Ing. Prom/Reserva</th>
                                <th class="th text-right">Costo Prom/Reserva</th>
                            </tr></thead>
                            <tbody id="canal-analysis-body" class="bg-white divide-y divide-gray-200"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    const calculateBtn = document.getElementById('kpi-calculate-btn');
    const resultsContainer = document.getElementById('kpi-results-container');
    const statusContainer = document.getElementById('status-container');
    const emptyStateContainer = document.getElementById('empty-state-container');
    const fechaInicioInput = document.getElementById('kpi-fecha-inicio');
    const fechaFinInput = document.getElementById('kpi-fecha-fin');
    
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    fechaInicioInput.value = firstDay.toISOString().split('T')[0];
    fechaFinInput.value = lastDay.toISOString().split('T')[0];
    
    const performCalculation = async () => {
        const fechaInicio = fechaInicioInput.value;
        const fechaFin = fechaFinInput.value;
        const canal = document.getElementById('kpi-canal-filtro').value;

        if (!fechaInicio || !fechaFin) {
            alert('Por favor, selecciona una fecha de inicio y una de fin.');
            return;
        }

        statusContainer.textContent = 'Calculando KPIs, esto puede tardar unos segundos...';
        statusContainer.classList.remove('hidden');
        resultsContainer.classList.add('hidden');
        emptyStateContainer.classList.add('hidden');
        calculateBtn.disabled = true;

        try {
            const params = new URLSearchParams({ fechaInicio, fechaFin });
            if (canal) params.append('canal', canal);
            
            const kpiResults = await fetchAPI(`/kpis?${params.toString()}`);
            fullKpiResults = kpiResults;

            if (kpiResults.kpisGenerales.nochesOcupadasConfirmadas === 0 && kpiResults.kpisGenerales.nochesOcupadasFacturadas === 0) {
                statusContainer.classList.add('hidden');
                resultsContainer.classList.add('hidden');
                emptyStateContainer.classList.remove('hidden');
            } else {
                displayKPIs(kpiResults.kpisGenerales);
                // NOTA: Los gráficos necesitan adaptarse a la nueva estructura de datos si se mantienen.
                // Por ahora, se mantendrán los datos de `reservasPorCanal` si existen.
                if (kpiResults.reservasPorCanal) {
                     renderCharts(kpiResults);
                }
                renderRankingOperativoTable(kpiResults.rendimientoPorPropiedad);
                renderRankingFinancieroTable(kpiResults.rendimientoPorPropiedad);
                renderCanalTable(kpiResults.analisisPorCanal);
                
                statusContainer.classList.add('hidden');
                emptyStateContainer.classList.add('hidden');
                resultsContainer.classList.remove('hidden');
            }

        } catch (error) {
            statusContainer.textContent = `Error al calcular KPIs: ${error.message}`;
            statusContainer.classList.remove('text-gray-500');
            statusContainer.classList.add('text-red-500');
        } finally {
            calculateBtn.disabled = false;
        }
    };

    calculateBtn.addEventListener('click', performCalculation);
    
    performCalculation();
}