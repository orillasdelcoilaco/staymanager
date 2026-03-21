import { fetchAPI } from '../api.js';

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('repair-status');
    if (!statusEl) return;
    
    let bgColor, textColor;
    switch (type) {
        case 'error': bgColor = 'bg-danger-100'; textColor = 'text-danger-800'; break;
        case 'success': bgColor = 'bg-success-100'; textColor = 'text-success-800'; break;
        default: bgColor = 'bg-primary-100'; textColor = 'text-primary-800';
    }
    
    statusEl.innerHTML = message;
    statusEl.className = `mt-6 p-4 rounded-md text-sm ${bgColor} ${textColor}`;
    statusEl.classList.remove('hidden');
}

export function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto">
            <h2 class="text-2xl font-semibold text-gray-900">Reparar Historial del Dólar</h2>
            
            <div class="mt-6 border-t pt-6">
                <p class="text-gray-600 mt-2">
                    Esta herramienta analizará todo tu historial de valores del dólar y rellenará los días faltantes (fines de semana, feriados) utilizando un valor de respaldo inteligente.
                </p>
                <p class="text-gray-600 mt-2">
                    Para cada día sin valor, el sistema buscará el valor del día anterior y del día siguiente, y usará el <strong>mayor de los dos</strong> para rellenar el vacío. Los valores rellenados se marcarán como "manuales" para protegerlos de futuras cargas de archivos.
                </p>
                <div class="mt-4">
                    <button id="repair-btn" class="px-6 py-3 bg-danger-600 text-white font-semibold rounded-md hover:bg-danger-700">
                        Iniciar Proceso de Reparación de Historial
                    </button>
                </div>
                <div id="repair-status" class="mt-6 hidden"></div>
            </div>
        </div>
    `;
}

export function afterRender() {
    const repairBtn = document.getElementById('repair-btn');
    if (!repairBtn) return;

    repairBtn.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de que quieres iniciar el proceso de reparación del historial del dólar? El sistema rellenará todos los días faltantes.')) {
            return;
        }

        repairBtn.disabled = true;
        repairBtn.textContent = 'Procesando...';
        showStatus('Analizando historial y rellenando vacíos. Esto puede tardar unos momentos...', 'info');

        try {
            const result = await fetchAPI('/reparar/dolar-historico', { method: 'POST' });
            const { rangoAnalizado, diasRellenados } = result.summary;
            let summaryHtml = `
                <strong>¡Proceso completado!</strong>
                <ul class="list-disc list-inside mt-2">
                    <li>Rango de fechas analizado: <strong>${rangoAnalizado}</strong></li>
                    <li>Días faltantes rellenados: <strong>${diasRellenados}</strong></li>
                </ul>
            `;
            showStatus(summaryHtml, 'success');
        } catch (error) {
            showStatus(`<strong>Error:</strong> ${error.message}`, 'error');
        } finally {
            repairBtn.disabled = false;
            repairBtn.textContent = 'Iniciar Proceso de Reparación de Historial';
        }
    });
}