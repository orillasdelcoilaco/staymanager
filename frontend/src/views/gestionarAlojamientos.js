import { fetchAPI } from '../api.js';
import { renderFilasTabla } from './components/gestionarAlojamientos/alojamientos.table.js';
import { renderModalAlojamiento, setupModalAlojamiento, abrirModalAlojamiento } from './components/gestionarAlojamientos/alojamientos.modals.js';

let propiedades = [];
let canales = [];

async function cargarDatos() {
    try {
        [propiedades, canales] = await Promise.all([
            fetchAPI('/propiedades'),
            fetchAPI('/canales')
        ]);
        const tbody = document.getElementById('propiedades-tbody');
        if (tbody) {
            tbody.innerHTML = renderFilasTabla(propiedades);
        }
    } catch (error) {
        console.error("Error al cargar datos:", error);
        const container = document.querySelector('.table-container');
        if (container) {
            container.innerHTML = `<p class="text-red-500 p-4">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
        }
    }
}

export async function render() {
    try {
        [propiedades, canales] = await Promise.all([
            fetchAPI('/propiedades'),
            fetchAPI('/canales')
        ]);

        return `
            <div class="container mx-auto px-4 py-8">
                <div class="flex justify-between items-center mb-6">
                    <h1 class="text-2xl font-bold text-gray-800">Gestionar Alojamientos</h1>
                    <button id="add-propiedad-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
                        + Agregar Alojamiento
                    </button>
                </div>
                <div class="bg-white shadow-md rounded my-6 overflow-x-auto table-container">
                    <table class="min-w-full w-full table-auto">
                        <thead>
                            <tr class="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                                <th class="py-3 px-6 text-center">#</th>
                                <th class="py-3 px-6 text-left">ID Propiedad</th>
                                <th class="py-3 px-6 text-left">Nombre</th>
                                <th class="py-3 px-6 text-center">Capacidad</th>
                                <th class="py-3 px-6 text-center">Nº Piezas</th>
                                <th class="py-3 px-6 text-center">Nº Baños</th>
                                <th class="py-3 px-6 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="propiedades-tbody" class="text-gray-600 text-sm font-light">
                            ${renderFilasTabla(propiedades)}
                        </tbody>
                    </table>
                </div>
                ${renderModalAlojamiento()}
            </div>
        `;
    } catch (error) {
        console.error("Error rendering alojamientos:", error);
        return `<p class="text-red-500 p-8">Error crítico de conexión. Por favor, recargue la página.</p>`;
    }
}

export function afterRender() {
    setupModalAlojamiento(async () => {
        await cargarDatos();
    });

    const addBtn = document.getElementById('add-propiedad-btn');
    if (addBtn) {
        // Use a flag to prevent multiple listeners
        if (!addBtn.dataset.listenerAttached) {
            addBtn.addEventListener('click', () => {
                abrirModalAlojamiento(null, canales);
            });
            addBtn.dataset.listenerAttached = 'true';
        }
    }

    const tbody = document.getElementById('propiedades-tbody');
    if (tbody) {
        // Use a flag to prevent multiple listeners
        if (!tbody.dataset.listenerAttached) {
            tbody.addEventListener('click', async (e) => {
                const target = e.target.closest('button');
                if (!target) return;

                const id = target.dataset.id;
                if (!id) return;

                // Stop propagation to prevent bubbling issues
                e.stopPropagation();

                if (target.classList.contains('edit-btn')) {
                    // Fetch fresh data or use existing state
                    const propiedadAEditar = propiedades.find(p => p.id === id);
                    if (propiedadAEditar) {
                        abrirModalAlojamiento(propiedadAEditar, canales);
                    } else {
                        console.error('Propiedad no encontrada en memoria:', id);
                        alert('Error: No se pudo encontrar la propiedad. Recargando datos...');
                        await cargarDatos();
                    }
                }

                if (target.classList.contains('delete-btn')) {
                    if (confirm('¿Estás seguro de que quieres eliminar este alojamiento?')) {
                        try {
                            await fetchAPI(`/propiedades/${id}`, { method: 'DELETE' });
                            await cargarDatos();
                        } catch (error) {
                            alert(`Error al eliminar: ${error.message}`);
                        }
                    }
                }
            });
            tbody.dataset.listenerAttached = 'true';
        }
    }
}