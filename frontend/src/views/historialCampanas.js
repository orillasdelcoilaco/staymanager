// frontend/src/views/historialCampanas.js
import { fetchAPI } from '../api.js';

let todasLasCampanas = [];
let interaccionesCache = {};

const formatDateTime = (dateString) => new Date(dateString).toLocaleString('es-CL');

function renderTablaCampanas() {
    const tbody = document.getElementById('campanas-tbody');
    if (todasLasCampanas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">Aún no has creado ninguna campaña.</td></tr>';
        return;
    }

    tbody.innerHTML = todasLasCampanas.map(c => `
        <tr class="border-b text-sm">
            <td class="py-2 px-3 font-semibold">${c.nombre}</td>
            <td class="py-2 px-3">${formatDateTime(c.fechaCreacion)}</td>
            <td class="py-2 px-3">${c.segmento}</td>
            <td class="py-2 px-3 text-center">${c.totalEnviados}</td>
            <td class="py-2 px-3 text-center font-bold text-green-600">${c.estados.Reservo || 0}</td>
            <td class="py-2 px-3 text-center">
                <button data-campana-id="${c.id}" class="ver-detalles-btn btn-table-view">Ver Detalles</button>
            </td>
        </tr>
    `).join('');
}

async function abrirModalDetalles(campanaId) {
    const modal = document.getElementById('detalles-modal');
    const campana = todasLasCampanas.find(c => c.id === campanaId);
    if (!campana) return;

    document.getElementById('detalles-modal-title').textContent = `Detalle de Campaña: ${campana.nombre}`;
    const tbody = document.getElementById('detalles-tbody');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4">Cargando...</td></tr>';
    modal.classList.remove('hidden');

    try {
        if (!interaccionesCache[campanaId]) {
            interaccionesCache[campanaId] = await fetchAPI(`/crm/campanas/${campanaId}/interacciones`);
        }
        const interacciones = interaccionesCache[campanaId];

        if (interacciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-4">No se encontraron interacciones.</td></tr>';
            return;
        }

        tbody.innerHTML = interacciones.map(i => `
            <tr class="border-b text-xs">
                <td class="py-2 px-3">${i.clienteNombre}</td>
                <td class="py-2 px-3">${i.estado}</td>
                <td class="py-2 px-3">${formatDateTime(i.fechaUltimaActualizacion)}</td>
            </tr>
        `).join('');

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-red-500 py-4">Error: ${error.message}</td></tr>`;
    }
}

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">Historial de Campañas</h2>
            <div class="table-container">
                <table class="min-w-full">
                    <thead>
                        <tr>
                            <th class="th">Nombre de Campaña</th>
                            <th class="th">Fecha de Creación</th>
                            <th class="th">Segmento</th>
                            <th class="th text-center">Enviados</th>
                            <th class="th text-center">Conversiones (Reservas)</th>
                            <th class="th text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="campanas-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="detalles-modal" class="modal hidden">
            <div class="modal-content !max-w-2xl">
                <h3 id="detalles-modal-title" class="text-xl font-semibold mb-4"></h3>
                <div class="table-container max-h-[60vh]">
                    <table class="min-w-full">
                        <thead><tr>
                            <th class="th">Cliente</th>
                            <th class="th">Último Estado</th>
                            <th class="th">Última Actualización</th>
                        </tr></thead>
                        <tbody id="detalles-tbody"></tbody>
                    </table>
                </div>
                <div class="text-right mt-4">
                    <button id="cerrar-detalles-btn" class="btn-secondary">Cerrar</button>
                </div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    const tbody = document.getElementById('campanas-tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Cargando historial...</td></tr>';
    
    try {
        todasLasCampanas = await fetchAPI('/crm/campanas');
        renderTablaCampanas();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-4">Error: ${error.message}</td></tr>`;
    }

    tbody.addEventListener('click', e => {
        if (e.target.classList.contains('ver-detalles-btn')) {
            abrirModalDetalles(e.target.dataset.campanaId);
        }
    });

    document.getElementById('cerrar-detalles-btn').addEventListener('click', () => {
        document.getElementById('detalles-modal').classList.add('hidden');
    });
}