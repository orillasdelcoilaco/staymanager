import { fetchAPI } from '../api.js';

let propiedades = [];
let editandoPropiedad = null;

// Lógica para manejar el modal
function abrirModal(propiedad = null) {
    const modal = document.getElementById('propiedad-modal');
    const form = document.getElementById('propiedad-form');
    const modalTitle = document.getElementById('modal-title');
    
    if (propiedad) {
        editandoPropiedad = propiedad;
        modalTitle.textContent = 'Editar Alojamiento';
        form.nombre.value = propiedad.nombre;
        form.capacidad.value = propiedad.capacidad;
        form.descripcion.value = propiedad.descripcion || '';
    } else {
        editandoPropiedad = null;
        modalTitle.textContent = 'Nuevo Alojamiento';
        form.reset();
    }
    
    modal.classList.remove('hidden');
}

function cerrarModal() {
    const modal = document.getElementById('propiedad-modal');
    modal.classList.add('hidden');
    editandoPropiedad = null;
}

// Lógica para renderizar la tabla de propiedades
function renderTabla() {
    const tbody = document.getElementById('propiedades-tbody');
    if (!tbody) return;

    if (propiedades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay alojamientos registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = propiedades.map(p => `
        <tr class="border-b">
            <td class="py-3 px-4">${p.nombre}</td>
            <td class="py-3 px-4">${p.capacidad}</td>
            <td class="py-3 px-4 truncate max-w-xs">${p.descripcion || '-'}</td>
            <td class="py-3 px-4">
                <button data-id="${p.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Editar</button>
                <button data-id="${p.id}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

// Lógica principal de la vista
export async function render() {
    // Obtener los datos iniciales
    try {
        propiedades = await fetchAPI('/propiedades');
    } catch (error) {
        console.error("Error al cargar propiedades:", error);
        return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }

    // Devolver el HTML de la vista
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Alojamientos</h2>
                <button id="add-propiedad-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                    + Nuevo Alojamiento
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="text-left py-3 px-4 font-semibold text-sm text-gray-600">Nombre</th>
                            <th class="text-left py-3 px-4 font-semibold text-sm text-gray-600">Capacidad</th>
                            <th class="text-left py-3 px-4 font-semibold text-sm text-gray-600">Descripción</th>
                            <th class="text-left py-3 px-4 font-semibold text-sm text-gray-600">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="propiedades-tbody">
                        </tbody>
                </table>
            </div>
        </div>

        <div id="propiedad-modal" class="modal hidden">
            <div class="modal-content">
                <div class="flex justify-between items-center pb-3">
                    <h3 id="modal-title" class="text-xl font-semibold">Nuevo Alojamiento</h3>
                    <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800">&times;</button>
                </div>
                <form id="propiedad-form">
                    <div class="mb-4">
                        <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre</label>
                        <input type="text" id="nombre" name="nombre" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    </div>
                    <div class="mb-4">
                        <label for="capacidad" class="block text-sm font-medium text-gray-700">Capacidad (Nº personas)</label>
                        <input type="number" id="capacidad" name="capacidad" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    </div>
                    <div class="mb-4">
                        <label for="descripcion" class="block text-sm font-medium text-gray-700">Descripción (Opcional)</label>
                        <textarea id="descripcion" name="descripcion" rows="3" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"></textarea>
                    </div>
                    <div class="flex justify-end pt-4">
                        <button type="button" id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md mr-2 hover:bg-gray-300">Cancelar</button>
                        <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// Post-render, para añadir event listeners
export function afterRender() {
    renderTabla();

    // Event listeners para los botones principales
    document.getElementById('add-propiedad-btn').addEventListener('click', () => abrirModal());
    document.getElementById('close-modal-btn').addEventListener('click', cerrarModal);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    // Event listener para el formulario
    document.getElementById('propiedad-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            nombre: form.nombre.value,
            capacidad: parseInt(form.capacidad.value),
            descripcion: form.descripcion.value
        };

        try {
            if (editandoPropiedad) {
                // Actualizar
                await fetchAPI(`/propiedades/${editandoPropiedad.id}`, {
                    method: 'PUT',
                    body: datos
                });
            } else {
                // Crear
                await fetchAPI('/propiedades', {
                    method: 'POST',
                    body: datos
                });
            }
            // Recargar la lista de propiedades
            propiedades = await fetchAPI('/propiedades');
            renderTabla();
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    // Event listeners para los botones de la tabla (usando delegación de eventos)
    const tbody = document.getElementById('propiedades-tbody');
    tbody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;

        if (target.classList.contains('edit-btn')) {
            const propiedadAEditar = propiedades.find(p => p.id === id);
            if (propiedadAEditar) {
                abrirModal(propiedadAEditar);
            }
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este alojamiento?')) {
                try {
                    await fetchAPI(`/propiedades/${id}`, { method: 'DELETE' });
                    // Recargar la lista
                    propiedades = await fetchAPI('/propiedades');
                    renderTabla();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}