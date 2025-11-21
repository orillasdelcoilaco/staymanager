// frontend/src/views/gestionarPlantillas.js
import { fetchAPI } from '../api.js';
import { renderFilasTabla } from './components/gestionarPlantillas/plantillas.table.js';
import { renderModalPlantilla, setupModalPlantilla, abrirModalPlantilla } from './components/gestionarPlantillas/plantillas.modals.js';

let plantillas = [];
let tipos = [];

async function fetchAndRender() {
    try {
        [plantillas, tipos] = await Promise.all([
            fetchAPI('/plantillas'),
            fetchAPI('/plantillas/tipos')
        ]);
        
        document.getElementById('plantillas-tbody').innerHTML = renderFilasTabla(plantillas, tipos);
    } catch (error) {
        console.error("Error al cargar datos:", error);
        const container = document.querySelector('.table-container');
        if(container) container.innerHTML = `<p class="text-red-500 p-4">Error al cargar los datos.</p>`;
    }
}

export async function render() {
    // Iniciamos carga
    try {
        [plantillas, tipos] = await Promise.all([
            fetchAPI('/plantillas'),
            fetchAPI('/plantillas/tipos')
        ]);
    } catch (error) {
        return `<p class="text-red-500">Error crítico de conexión.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Plantillas de Mensajes</h2>
                <button id="add-plantilla-btn" class="btn-primary">
                    + Nueva Plantilla
                </button>
            </div>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
                            <th class="th">Nombre</th>
                            <th class="th">Tipo</th>
                            <th class="th">Asunto</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="plantillas-tbody">
                        ${renderFilasTabla(plantillas, tipos)}
                    </tbody>
                </table>
            </div>
        </div>
        
        ${renderModalPlantilla()}
    `;
}

export function afterRender() {
    setupModalPlantilla(async () => {
        await fetchAndRender();
    });

    document.getElementById('add-plantilla-btn').addEventListener('click', () => abrirModalPlantilla(null, tipos));

    const tbody = document.getElementById('plantillas-tbody');
    
    tbody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('edit-btn')) {
            const plantilla = plantillas.find(p => p.id === id);
            if (plantilla) {
                abrirModalPlantilla(plantilla, tipos);
            }
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) {
                try {
                    await fetchAPI(`/plantillas/${id}`, { method: 'DELETE' });
                    await fetchAndRender();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}