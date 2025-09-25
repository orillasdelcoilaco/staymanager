import { fetchAPI } from '../api.js';

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('repair-status');
    if (!statusEl) return;
    
    let bgColor, textColor;
    switch (type) {
        case 'error': bgColor = 'bg-red-100'; textColor = 'text-red-800'; break;
        case 'success': bgColor = 'bg-green-100'; textColor = 'text-green-800'; break;
        default: bgColor = 'bg-blue-100'; textColor = 'text-blue-800';
    }
    
    statusEl.innerHTML = message;
    statusEl.className = `mt-6 p-4 rounded-md text-sm ${bgColor} ${textColor}`;
    statusEl.classList.remove('hidden');
}

export function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow max-w-4xl mx-auto">
            <h2 class="text-2xl font-semibold text-gray-900">Reparar y Verificar Contactos</h2>
            
            <div class="mt-6 border-t pt-6">
                <p class="text-gray-600 mt-2">
                    Esta herramienta realiza un barrido completo de tu base de datos de clientes para realizar dos tareas clave:
                </p>
                <ul class="list-disc list-inside text-gray-600 mt-2 space-y-1">
                    <li><strong>Normaliza Teléfonos:</strong> Corrige y estandariza los números de teléfono a un formato único.</li>
                    <li><strong>Verifica Sincronización:</strong> Comprueba qué clientes ya existen en tus Google Contacts y actualiza su estado en el sistema para que no necesites sincronizarlos manualmente.</li>
                </ul>
                <p class="text-gray-600 mt-4">
                   Este proceso puede tardar varios minutos dependiendo de la cantidad de clientes que tengas.
                </p>
                <div class="mt-4">
                    <button id="repair-btn" class="px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700">
                        Iniciar Proceso de Verificación
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
        if (!confirm('¿Estás seguro de iniciar el proceso de reparación y verificación? Se revisarán todos los clientes de tu empresa.')) {
            return;
        }

        repairBtn.disabled = true;
        repairBtn.textContent = 'Procesando...';
        showStatus('Analizando clientes y contactando a Google. Esto puede tomar varios minutos...', 'info');

        try {
            const result = await fetchAPI('/reparar/sincronizacion-contactos', { method: 'POST' });
            const { clientesRevisados, clientesActualizados, telefonosCorregidos } = result.summary;
            let summaryHtml = `
                <strong>¡Proceso completado!</strong>
                <ul class="list-disc list-inside mt-2">
                    <li>Clientes totales revisados: <strong>${clientesRevisados}</strong></li>
                    <li>Clientes marcados como "Sincronizados": <strong>${clientesActualizados}</strong></li>
                    <li>Números de teléfono corregidos: <strong>${telefonosCorregidos}</strong></li>
                </ul>
            `;
            showStatus(summaryHtml, 'success');
        } catch (error) {
            showStatus(`<strong>Error:</strong> ${error.message}`, 'error');
        } finally {
            repairBtn.disabled = false;
            repairBtn.textContent = 'Iniciar Proceso de Verificación';
        }
    });
}