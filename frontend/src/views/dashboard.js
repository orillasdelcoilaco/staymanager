// frontend/src/views/dashboard.js
import { fetchAPI } from '../api.js';
import { renderCharts } from './components/dashboard/charts.js';

let fullKpiResults = null;

function formatCurrency(value) {
    return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;
}

function displayKPIs(results) {
    const kpis = results; // Corregido: Se accede directamente a los resultados
    const kpiCardsContainer = document.getElementById('kpi-cards');
    if (!kpiCardsContainer) return;

    kpiCardsContainer.innerHTML = `
        {/* Fila Facturado */}
        <div class="p-4 bg-green-100 rounded-lg"><div class="text-sm font-medium text-green-700">Ingreso Facturado</div><div class="text-2xl font-bold text-green-900">${formatCurrency(kpis.ingresoFacturado)}</div></div>
        <div class="p-4 bg-green-100 rounded-lg"><div class="text-sm font-medium text-green-700">Payout Facturado</div><div class="text-2xl font-bold text-green-900">${formatCurrency(kpis.payoutFacturado)}</div></div>
        <div class="p-4 bg-green-100 rounded-lg"><div class="text-sm font-medium text-green-700">Costo Canal (Fact.)</div><div class="text-2xl font-bold text-green-900">${formatCurrency(kpis.costoCanalFacturado)}</div></div>
        
        {/* Fila Proyectado */}
        <div class="p-4 bg-blue-100 rounded-lg"><div class="text-sm font-medium text-blue-700">Ingreso Proyectado</div><div class="text-2xl font-bold text-blue-900">${formatCurrency(kpis.ingresoProyectado)}</div></div>
        <div class="p-4 bg-blue-100 rounded-lg"><div class="text-sm font-medium text-blue-700">Payout Proyectado</div><div class="text-2xl font-bold text-blue-900">${formatCurrency(kpis.payoutProyectado)}</div></div>
        <div class="p-4 bg-red-100 rounded-lg"><div class="text-sm font-medium text-red-700">Descuento Identificado</div><div class="text-2xl font-bold text-red-900">${formatCurrency(kpis.descuentoTotalIdentificado)}</div></div>

        {/* Fila Operacional */}
        <div class="p-4 bg-gray-100 rounded-lg"><div class="text-sm font-medium text-gray-600">Ocup. (Confirmada)</div><div class="text-2xl font-bold text-gray-900">${kpis.tasaOcupacionProyectada.toFixed(1)}%</div></div>
        <div class="p-4 bg-gray-100 rounded-lg"><div class="text-sm font-medium text-gray-600">ADR (Facturado)</div><div class="text-2xl font-bold text-gray-900">${formatCurrency(kpis.adrFacturado)}</div></div>
        <div class="p-4 bg-gray-100 rounded-lg"><div class="text-sm font-medium text-gray-600">RevPAR (Facturado)</div><div class="text-2xl font-bold text-gray-900">${formatCurrency(kpis.revParFacturado)}</div></div>
    `;
}

function renderRankingTable(rankingData) {
    const tableBody = document.getElementById('ranking-table-body');
    if (!tableBody) return;

    if (!rankingData || Object.keys(rankingData).length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-4">No hay datos de rendimiento para mostrar.</td></tr>`;
        return;
    }

    const sortedData = Object.values(rankingData).sort((a, b) => b.ingresoTotalFacturado - a.ingresoTotalFacturado);

    tableBody.innerHTML = sortedData.map(prop => `
        <tr class="hover:bg-gray-50 cursor-pointer" data-prop-nombre="${prop.nombre}">
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${prop.nombre}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">${prop.nochesOcupadasFacturadas}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">${prop.nochesOcupadasConfirmadas}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-center">${prop.tasaOcupacion.toFixed(1)}%</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">${formatCurrency(prop.ingresoTotalFacturado)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">${formatCurrency(prop.payoutTotalFacturado)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">${formatCurrency(prop.adr)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-red-600 text-right">${formatCurrency(prop.descuentoPromedio)}</td>
        </tr>
    `).join('');
}

function showDetailModal(propNombre) {
    const propData = fullKpiResults.rendimientoPorPropiedad[propNombre];
    if (!propData) return;

    const modal = document.getElementById('detail-modal');
    document.getElementById('detail-modal-title').textContent = `Detalle por Canal - ${propNombre}`;
    
    document.getElementById('detail-modal-content').innerHTML = `<pre class="bg-gray-100 p-4 rounded-md">${JSON.stringify(propData, null, 2)}</pre>`;
    
    modal.classList.remove('hidden');
}

export async function render() {
    const canales = await fetchAPI('/canales');
    const canalOptions = canales.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');

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

            <div id="kpi-results-container" class="hidden space-y-8">
                <div id="kpi-cards" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 text-center"></div>
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div class="lg:col-span-2">
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Ingreso vs Payout por Canal</h3>
                        <canvas id="income-chart"></canvas>
                    </div>
                    <div class="lg:col-span-3">
                         <h3 class="text-lg font-semibold text-gray-800 mb-2">Distribución de Noches por Canal</h3>
                        <canvas id="nights-chart"></canvas>
                    </div>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Rendimiento por Propiedad</h3>
                    <div class="table-container">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="th">Propiedad</th>
                                    <th class="th text-center">Noches (Fact.)</th>
                                    <th class="th text-center">Noches (Conf.)</th>
                                    <th class="th text-center">Ocupación (%)</th>
                                    <th class="th text-right">Ingreso (Fact.)</th>
                                    <th class="th text-right">Payout (Fact.)</th>
                                    <th class="th text-right">ADR (Fact.)</th>
                                    <th class="th text-right">Descuento Promedio</th>
                                </tr>
                            </thead>
                            <tbody id="ranking-table-body" class="bg-white divide-y divide-gray-200"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div id="detail-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="detail-modal-title" class="text-xl font-semibold mb-4"></h3>
                <div id="detail-modal-content"></div>
                <button id="detail-modal-close-btn" class="btn-secondary w-full mt-4">Cerrar</button>
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
    
    // Establecer fechas por defecto para el mes actual
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

            if (kpiResults.nochesOcupadasConfirmadas === 0 && kpiResults.nochesOcupadasFacturadas === 0) {
                statusContainer.classList.add('hidden');
                resultsContainer.classList.add('hidden');
                emptyStateContainer.classList.remove('hidden');
            } else {
                displayKPIs(kpiResults);
                renderCharts(kpiResults);
                renderRankingTable(kpiResults.rendimientoPorPropiedad);
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

    document.getElementById('ranking-table-body').addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.dataset.propNombre) {
            showDetailModal(row.dataset.propNombre);
        }
    });

    document.getElementById('detail-modal-close-btn').addEventListener('click', () => {
        document.getElementById('detail-modal').classList.add('hidden');
    });

    // Cargar automáticamente los datos del mes actual al iniciar la vista
    performCalculation();
}