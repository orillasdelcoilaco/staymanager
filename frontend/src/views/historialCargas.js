import { fetchAPI } from '../api.js';

let historial = [];

async function fetchHistorial() {
    historial = await fetchAPI('/historial-cargas');
    renderTabla();
}

function renderTabla() {
    const tbody = document.getElementById('historial-tbody');
    if (!tbody) return;

    if (historial.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No se han cargado reportes todavía.</td></tr>';
        return;
    }

    tbody.innerHTML = historial.map(item => `
        <tr class="border-b">
            <td class="py-3 px-4 font-bold text-center">${item.idNumerico || '-'}</td>
            <td class="py-3 px-4 font-mono text-sm">${item.nombreArchivo}</td>
            <td class="py-3 px-4">${item.fechaCarga}</td>
            <td class="py-3 px-4">${item.usuarioEmail}</td>
            <td class="py-3 px-4 text-center">
                <button data-id="${item.id}" data-nombre-archivo="${item.nombreArchivo}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">
                    Eliminar Carga
                </button>
            </td>
        </tr>
    `).join('');
}


export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">Historial de Reportes Cargados</h2>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th">ID Carga</th>
                            <th class="th">Nombre del Archivo</th>
                            <th class="th">Fecha y Hora de Carga</th>
                            <th class="th">Usuario</th>
                            <th class="th text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="historial-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export async function afterRender() {
    await fetchHistorial();

    const tbody = document.getElementById('historial-tbody');
    tbody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const idCarga = e.target.dataset.id;
            const nombreArchivo = e.target.dataset.nombreArchivo;
            
            try {
                const conteo = await fetchAPI(`/historial-cargas/${idCarga}/count`);
                const numReservas = conteo.count;

                const mensajeConfirmacion = `Atención: Se eliminarán ${numReservas} reserva(s) y el registro de la carga del archivo "${nombreArchivo}".\n\n¿Está seguro de proceder? Esta acción no se puede deshacer.`;

                if (confirm(mensajeConfirmacion)) {
                    const result = await fetchAPI(`/historial-cargas/${idCarga}`, { method: 'DELETE' });
                    alert(result.message);
                    await fetchHistorial(); // Refrescar la tabla después de eliminar
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        }
    });
}