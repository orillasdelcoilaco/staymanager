import { fetchAPI } from '../api.js';

let propiedades = [];
let editandoPropiedad = null;

function abrirModal(propiedad = null) {
    const modal = document.getElementById('propiedad-modal');
    const form = document.getElementById('propiedad-form');
    const modalTitle = document.getElementById('modal-title');
    
    if (propiedad) {
        editandoPropiedad = propiedad;
        modalTitle.textContent = `Editar Alojamiento: ${propiedad.nombre}`;
        form.nombre.value = propiedad.nombre || '';
        form.linkFotos.value = propiedad.linkFotos || '';
        form.numPiezas.value = propiedad.numPiezas || 0;
        form.numBanos.value = propiedad.numBanos || 0;
        form.descripcion.value = propiedad.descripcion || '';
        form.capacidad.value = propiedad.capacidad || 0;
        form.matrimoniales.value = propiedad.camas?.matrimoniales || 0;
        form.plazaYMedia.value = propiedad.camas?.plazaYMedia || 0;
        form.camarotes.value = propiedad.camas?.camarotes || 0;
        form.tinaja.checked = propiedad.equipamiento?.tinaja || false;
        form.parrilla.checked = propiedad.equipamiento?.parrilla || false;
        form.terrazaTechada.checked = propiedad.equipamiento?.terrazaTechada || false;
        form.juegoDeTerraza.checked = propiedad.equipamiento?.juegoDeTerraza || false;
        form.piezaEnSuite.checked = propiedad.equipamiento?.piezaEnSuite || false;
        form.dosPisos.checked = propiedad.equipamiento?.dosPisos || false;
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

function renderTabla() {
    const tbody = document.getElementById('propiedades-tbody');
    if (!tbody) return;

    if (propiedades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No hay alojamientos registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = propiedades.map(p => `
        <tr class="border-b">
            <td class="py-3 px-4 font-medium text-gray-800">${p.nombre}</td>
            <td class="py-3 px-4">${p.capacidad}</td>
            <td class="py-3 px-4">${p.numPiezas || 0}</td>
            <td class="py-3 px-4">${p.numBanos || 0}</td>
            <td class="py-3 px-4">
                <button data-id="${p.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Editar</button>
                <button data-id="${p.id}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

export async function render() {
    try {
        propiedades = await fetchAPI('/propiedades');
    } catch (error) {
        console.error("Error al cargar propiedades:", error);
        return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }

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
                            <th class="text-left py-3 px-4 font-semibold text-sm text-gray-600">Nº Piezas</th>
                            <th class="text-left py-3 px-4 font-semibold text-sm text-gray-600">Nº Baños</th>
                            <th class="text-left py-3 px-4 font-semibold text-sm text-gray-600">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="propiedades-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="propiedad-modal" class="modal hidden">
            <div class="modal-content !max-w-3xl">
                <div class="flex justify-between items-center pb-3 border-b mb-4">
                    <h3 id="modal-title" class="text-xl font-semibold"></h3>
                    <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <form id="propiedad-form">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Alojamiento</label>
                            <input type="text" id="nombre" name="nombre" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        <div>
                            <label for="linkFotos" class="block text-sm font-medium text-gray-700">Link a Fotos</label>
                            <input type="url" id="linkFotos" name="linkFotos" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        <div>
                            <label for="numPiezas" class="block text-sm font-medium text-gray-700">Nº Piezas</label>
                            <input type="number" id="numPiezas" name="numPiezas" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        <div>
                            <label for="numBanos" class="block text-sm font-medium text-gray-700">Nº Baños</label>
                            <input type="number" id="numBanos" name="numBanos" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                    </div>
                    <hr class="my-6">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <label for="matrimoniales" class="block text-sm font-medium text-gray-700">Matrimoniales</label>
                            <input type="number" id="matrimoniales" name="matrimoniales" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        <div>
                            <label for="plazaYMedia" class="block text-sm font-medium text-gray-700">1.5 Plazas</label>
                            <input type="number" id="plazaYMedia" name="plazaYMedia" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                         <div>
                            <label for="camarotes" class="block text-sm font-medium text-gray-700">Camarotes</label>
                            <input type="number" id="camarotes" name="camarotes" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        <div>
                            <label for="capacidad" class="block text-sm font-medium text-gray-700">Capacidad Calculada</label>
                            <input type="number" id="capacidad" name="capacidad" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                    </div>
                     <div class="mt-6">
                        <label for="descripcion" class="block text-sm font-medium text-gray-700">Descripción</label>
                        <textarea id="descripcion" name="descripcion" rows="6" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" style="min-height: 150px;"></textarea>
                    </div>
                    <hr class="my-6">
                    <div>
                        <label class="block text-base font-medium text-gray-800 mb-2">Equipamiento</label>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            ${checkbox('tinaja', 'Tinaja')}
                            ${checkbox('parrilla', 'Parrilla')}
                            ${checkbox('terrazaTechada', 'Terraza Techada')}
                            ${checkbox('juegoDeTerraza', 'Juego de Terraza')}
                            ${checkbox('piezaEnSuite', 'Pieza en Suite')}
                            ${checkbox('dosPisos', 'Dos Pisos')}
                        </div>
                    </div>
                    <div class="flex justify-end pt-6 border-t mt-6">
                        <button type="button" id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md mr-2 hover:bg-gray-300">Cancelar</button>
                        <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function checkbox(id, label) {
    return `
        <label for="${id}" class="flex items-center space-x-2 text-sm">
            <input type="checkbox" id="${id}" name="${id}" class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
            <span>${label}</span>
        </label>
    `;
}

export function afterRender() {
    renderTabla();

    const form = document.getElementById('propiedad-form');
    const tbody = document.getElementById('propiedades-tbody');
    
    document.getElementById('add-propiedad-btn').addEventListener('click', () => abrirModal());
    document.getElementById('close-modal-btn').addEventListener('click', cerrarModal);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const datos = {
            nombre: form.nombre.value,
            capacidad: parseInt(form.capacidad.value),
            linkFotos: form.linkFotos.value,
            numPiezas: parseInt(form.numPiezas.value) || 0,
            numBanos: parseInt(form.numBanos.value) || 0,
            descripcion: form.descripcion.value,
            camas: {
                matrimoniales: parseInt(form.matrimoniales.value) || 0,
                plazaYMedia: parseInt(form.plazaYMedia.value) || 0,
                camarotes: parseInt(form.camarotes.value) || 0,
            },
            equipamiento: {
                tinaja: form.tinaja.checked,
                parrilla: form.parrilla.checked,
                terrazaTechada: form.terrazaTechada.checked,
                juegoDeTerraza: form.juegoDeTerraza.checked,
                piezaEnSuite: form.piezaEnSuite.checked,
                dosPisos: form.dosPisos.checked,
            }
        };

        try {
            const endpoint = editandoPropiedad ? `/propiedades/${editandoPropiedad.id}` : '/propiedades';
            const method = editandoPropiedad ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method, body: datos });
            
            propiedades = await fetchAPI('/propiedades');
            renderTabla();
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    tbody.addEventListener('click', async (e) => {
        const target = e.target;
        if (!target.classList.contains('edit-btn') && !target.classList.contains('delete-btn')) return;

        const id = target.dataset.id;
        if (target.classList.contains('edit-btn')) {
            const propiedadAEditar = propiedades.find(p => p.id === id);
            if (propiedadAEditar) abrirModal(propiedadAEditar);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este alojamiento?')) {
                try {
                    await fetchAPI(`/propiedades/${id}`, { method: 'DELETE' });
                    propiedades = await fetchAPI('/propiedades');
                    renderTabla();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}