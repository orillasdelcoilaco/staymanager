// frontend/src/views/gestionarAlojamientos.js
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
        document.getElementById('propiedades-tbody').innerHTML = renderFilasTabla(propiedades);
    } catch (error) {
        console.error("Error al cargar datos:", error);
        document.querySelector('.table-container').innerHTML = `<p class="text-red-500 p-4">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }
}

export async function render() {
    // Iniciamos la carga de datos (se completará en afterRender para pintar la tabla)
    // Pero necesitamos los datos iniciales si el render se basa en ellos, 
    // aunque aquí la estructura es estática y la tabla se llena dinámicamente.
    try {
        [propiedades, canales] = await Promise.all([
            fetchAPI('/propiedades'),
            fetchAPI('/canales')
        ]);
    } catch (error) {
        return `<p class="text-red-500">Error crítico de conexión.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Alojamientos</h2>
                <button id="add-propiedad-btn" class="btn-primary">
                    + Nuevo Alojamiento
                </button>
            </div>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
                            <th class="th">ID Propiedad</th>
                            <th class="th">Nombre</th>
                            <th class="th text-center">Capacidad</th>
                            <th class="th text-center">Nº Piezas</th>
                            <th class="th text-center">Nº Baños</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="propiedades-tbody">
                        ${renderFilasTabla(propiedades)}
                    </tbody>
                </table>
            </div>
        </div>

        ${renderModalAlojamiento()}
    `;
}

export function afterRender() {
    // Configuración del modal con callback de recarga
    setupModalAlojamiento(async () => {
        await cargarDatos();
    });

    document.getElementById('add-propiedad-btn').addEventListener('click', () => {
        abrirModalAlojamiento(null, canales);
    });

    const tbody = document.getElementById('propiedades-tbody');
    
    tbody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('edit-btn')) {
            const propiedadAEditar = propiedades.find(p => p.id === id);
            if (propiedadAEditar) {
                 abrirModalAlojamiento(propiedadAEditar, canales);
            } else {
                alert('Error: No se pudo encontrar la propiedad en memoria.');
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
}