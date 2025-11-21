// frontend/src/views/gestionarCanales.js
import { fetchAPI } from '../api.js';
import { renderFilasTabla } from './components/gestionarCanales/canales.table.js';
import { renderModalCanal, setupModalCanal, abrirModalCanal } from './components/gestionarCanales/canales.modals.js';

let canales = [];

async function cargarCanales() {
    try {
        canales = await fetchAPI('/canales');
        document.getElementById('canales-tbody').innerHTML = renderFilasTabla(canales);
    } catch (error) {
        console.error("Error al cargar canales:", error);
        document.querySelector('.table-container').innerHTML = `<p class="text-red-500 p-4">Error al cargar los datos.</p>`;
    }
}

export async function render() {
    try {
        canales = await fetchAPI('/canales');
    } catch (error) {
        return `<p class="text-red-500">Error al cargar los datos.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Canales de Venta</h2>
                <button id="add-canal-btn" class="btn-primary">
                    + Nuevo Canal
                </button>
            </div>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
                            <th class="th">Nombre</th>
                            <th class="th">Moneda Reporte</th>
                            <th class="th">Separador Decimal</th>
                            <th class="th">Descripción</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="canales-tbody">
                        ${renderFilasTabla(canales)}
                    </tbody>
                </table>
            </div>
        </div>
        ${renderModalCanal()}
    `;
}

export function afterRender() {
    setupModalCanal(async () => {
        await cargarCanales();
    });

    document.getElementById('add-canal-btn').addEventListener('click', () => abrirModalCanal());

    document.getElementById('canales-tbody').addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('edit-btn')) {
            const canal = canales.find(c => c.id === id);
            if (canal) abrirModalCanal(canal);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este canal?')) {
                try {
                    await fetchAPI(`/canales/${id}`, { method: 'DELETE' });
                    await cargarCanales();
                } catch (error) {
                    alert(`Error al eliminar el canal: ${error.message}`);
                }
            }
        }
    });
}