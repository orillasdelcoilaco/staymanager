import { fetchAPI } from '../api.js';

let historial = [];

function renderTabla() {
    const tbody = document.getElementById('historial-tbody');
    if (!tbody) return;

    if (historial.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No se han cargado reportes todavía.</td></tr>';
        return;
    }

    tbody.innerHTML = historial.map(item => `
        <tr class="border-b">
            <td class="py-3 px-4 font-mono text-sm">${item.nombreArchivo}</td>
            <td class="py-3 px-4">${item.fechaCarga}</td>
            <td class="py-3 px-4">${item.usuarioEmail}</td>
        </tr>
    `).join('');
}


export async function render() {
    try {
        historial = await fetchAPI('/historial-cargas');
    } catch (error) {
        return `<p class="text-red-500">Error al cargar el historial de cargas.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">Historial de Reportes Cargados</h2>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th">Nombre del Archivo</th>
                            <th class="th">Fecha y Hora de Carga</th>
                            <th class="th">Usuario</th>
                        </tr>
                    </thead>
                    <tbody id="historial-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export function afterRender() {
    renderTabla();
}