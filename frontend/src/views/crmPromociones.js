// frontend/src/views/crmPromociones.js
import { fetchAPI } from '../api.js';

let clientesSeleccionados = [];
const segmentos = ['🏆 Campeones', '❤️ Leales', '🤝 Potenciales', '😟 En Riesgo', '🥶 Hibernando', 'Sin Reservas'];

function renderTablaClientes() {
    const tbody = document.getElementById('clientes-tbody');
    const contador = document.getElementById('contador-clientes');

    contador.textContent = `${clientesSeleccionados.length} cliente(s) en este segmento.`;

    if (clientesSeleccionados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No se encontraron clientes en este segmento.</td></tr>';
        return;
    }

    tbody.innerHTML = clientesSeleccionados.map(c => `
        <tr class="border-b text-sm">
            <td class="py-2 px-3">${c.nombre}</td>
            <td class="py-2 px-3">${c.telefono}</td>
            <td class="py-2 px-3 text-center">${c.numeroDeReservas}</td>
            <td class="py-2 px-3 text-right">${(c.totalGastado || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</td>
        </tr>
    `).join('');
}

async function cargarClientes(segmento) {
    const loadingDiv = document.getElementById('loading-state');
    const tabla = document.getElementById('clientes-table');
    loadingDiv.classList.remove('hidden');
    tabla.classList.add('hidden');

    try {
        clientesSeleccionados = await fetchAPI(`/crm/segmento/${encodeURIComponent(segmento)}`);
        renderTablaClientes();
    } catch (error) {
        document.getElementById('contador-clientes').textContent = `Error al cargar clientes: ${error.message}`;
    } finally {
        loadingDiv.classList.add('hidden');
        tabla.classList.remove('hidden');
    }
}

function generarCampana() {
    const mensaje = document.getElementById('mensaje-promocion').value;
    const campanaContainer = document.getElementById('campana-container');
    
    if (!mensaje) {
        alert('Por favor, escribe un mensaje para la promoción.');
        return;
    }
    if (clientesSeleccionados.length === 0) {
        alert('No hay clientes en el segmento seleccionado para enviar la campaña.');
        return;
    }

    campanaContainer.classList.remove('hidden');
    const listaMensajes = document.getElementById('lista-mensajes');
    listaMensajes.innerHTML = clientesSeleccionados.map(cliente => {
        const mensajePersonalizado = mensaje.replace(/\[NOMBRE_CLIENTE\]/g, cliente.nombre.split(' ')[0]);
        const telefonoLimpio = cliente.telefono.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensajePersonalizado)}`;

        return `
            <div class="p-3 border rounded-md flex justify-between items-center bg-white">
                <div>
                    <p class="font-semibold">${cliente.nombre}</p>
                    <p class="text-xs text-gray-500">${cliente.telefono}</p>
                </div>
                <a href="${whatsappUrl}" target="_blank" class="btn-primary">Enviar WhatsApp</a>
            </div>
        `;
    }).join('');
}

export function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-8">
            <div>
                <h2 class="text-2xl font-semibold text-gray-900">CRM y Promociones</h2>
                <p class="text-gray-600 mt-2">Segmenta tus clientes y crea campañas de marketing directo por WhatsApp para fidelizarlos.</p>
            </div>

            <div class="border-t pt-6">
                <h3 class="text-lg font-semibold">1. Selección de Segmento</h3>
                <div class="flex items-end space-x-4 mt-2">
                    <div class="flex-grow">
                        <label for="segmento-select" class="block text-sm font-medium text-gray-700">Elige un segmento de clientes</label>
                        <select id="segmento-select" class="form-select mt-1">
                            <option value="Todos">Todos los Clientes</option>
                            ${segmentos.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                    </div>
                    <button id="recalcular-btn" class="btn-secondary">Actualizar Segmentación</button>
                </div>
                <div id="recalcular-status" class="text-sm mt-2"></div>
            </div>

            <div>
                <h3 class="text-lg font-semibold">2. Lista de Clientes</h3>
                <p id="contador-clientes" class="text-sm text-gray-500 mb-2"></p>
                <div id="loading-state" class="text-center py-8 hidden"><p>Cargando clientes...</p></div>
                <div id="clientes-table" class="table-container hidden">
                    <table class="min-w-full">
                        <thead>
                            <tr>
                                <th class="th">Nombre</th>
                                <th class="th">Teléfono</th>
                                <th class="th text-center">Nº Reservas</th>
                                <th class="th text-right">Gasto Histórico</th>
                            </tr>
                        </thead>
                        <tbody id="clientes-tbody"></tbody>
                    </table>
                </div>
            </div>

            <div class="border-t pt-6">
                <h3 class="text-lg font-semibold">3. Crear Campaña de WhatsApp</h3>
                <div class="mt-2">
                    <label for="mensaje-promocion" class="block text-sm font-medium text-gray-700">Mensaje de la Promoción</label>
                    <textarea id="mensaje-promocion" rows="5" class="form-input mt-1" placeholder="Hola [NOMBRE_CLIENTE], tenemos una oferta especial para ti..."></textarea>
                    <p class="text-xs text-gray-500 mt-1">Usa la etiqueta <code class="font-bold">[NOMBRE_CLIENTE]</code> para personalizar el saludo.</p>
                </div>
                <div class="text-right mt-4">
                    <button id="generar-campana-btn" class="btn-primary">Generar Campaña</button>
                </div>
            </div>

            <div id="campana-container" class="hidden border-t pt-6">
                <h3 class="text-lg font-semibold">4. Enviar Mensajes</h3>
                <p class="text-sm text-gray-500 mb-4">Haz clic en cada botón para abrir WhatsApp y enviar el mensaje personalizado.</p>
                <div id="lista-mensajes" class="space-y-3 max-h-96 overflow-y-auto pr-4"></div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    const segmentoSelect = document.getElementById('segmento-select');
    
    segmentoSelect.addEventListener('change', () => {
        cargarClientes(segmentoSelect.value);
    });

    document.getElementById('recalcular-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        const statusDiv = document.getElementById('recalcular-status');
        
        btn.disabled = true;
        btn.textContent = 'Actualizando...';
        statusDiv.textContent = 'Este proceso puede tardar unos segundos...';

        try {
            const response = await fetchAPI('/crm/recalcular-segmentos', { method: 'POST' });
            statusDiv.textContent = response.message;
            // Recargar los clientes del segmento actual
            await cargarClientes(segmentoSelect.value);
        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Actualizar Segmentación';
        }
    });

    document.getElementById('generar-campana-btn').addEventListener('click', generarCampana);

    // Carga inicial
    await cargarClientes(segmentoSelect.value);
}