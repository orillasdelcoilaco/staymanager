// frontend/src/views/gestionarTiposAmenidad.js
import { fetchAPI } from '../api.js';

let tiposAmenidad = [];

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">Configuración de Amenidades</h2>
                    <p class="text-sm text-gray-500 mt-1">Define los tipos de camas, baños y equipamiento disponibles para tus alojamientos.</p>
                </div>
                <button id="btn-nuevo-tipo" class="btn-primary flex items-center gap-2">
                    <span class="text-xl">+</span> Nuevo Tipo
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                ${renderCategoryCard('CAMA', 'Tipos de Cama', '🛏️')}
                ${renderCategoryCard('BANO', 'Tipos de Baño', '🚿')}
                ${renderCategoryCard('EQUIPAMIENTO', 'Equipamiento General', '✨')}
            </div>

            <div id="modal-crear-tipo" class="hidden fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                <div class="relative bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
                    <h3 class="text-xl font-semibold mb-4">Crear Nuevo Tipo</h3>
                    <form id="form-crear-tipo">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700">Nombre</label>
                            <input type="text" name="nombre" required class="form-input mt-1 block w-full" placeholder="Ej: King Size, Jacuzzi, Sauna">
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700">Categoría</label>
                            <select name="categoria" required class="form-select mt-1 block w-full">
                                <option value="CAMA">Cama</option>
                                <option value="BANO">Baño</option>
                                <option value="EQUIPAMIENTO">Equipamiento</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700">Icono (Emoji)</label>
                            <input type="text" name="icono" class="form-input mt-1 block w-full" placeholder="Ej: 👑">
                        </div>
                        <div class="flex justify-end gap-3 mt-6">
                            <button type="button" id="btn-cancelar" class="btn-secondary">Cancelar</button>
                            <button type="submit" class="btn-primary">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

function renderCategoryCard(categoria, titulo, iconoDefault) {
    return `
        <div class="border rounded-lg p-4 bg-gray-50">
            <h3 class="font-semibold text-lg mb-4 flex items-center gap-2">
                <span>${iconoDefault}</span> ${titulo}
            </h3>
            <div id="lista-${categoria}" class="space-y-2">
                <p class="text-sm text-gray-400 italic">Cargando...</p>
            </div>
        </div>
    `;
}

export async function afterRender() {
    await cargarTipos();

    const modal = document.getElementById('modal-crear-tipo');
    const form = document.getElementById('form-crear-tipo');

    document.getElementById('btn-nuevo-tipo').addEventListener('click', () => {
        form.reset();
        modal.classList.remove('hidden');
    });

    document.getElementById('btn-cancelar').addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const datos = {
            nombre: formData.get('nombre'),
            categoria: formData.get('categoria'),
            icono: formData.get('icono') || '✨'
        };

        try {
            await fetchAPI('/amenidades', { method: 'POST', body: datos });
            modal.classList.add('hidden');
            await cargarTipos();
        } catch (error) {
            alert('Error al crear: ' + error.message);
        }
    });

    // Delegación de eventos para eliminar
    ['CAMA', 'BANO', 'EQUIPAMIENTO'].forEach(cat => {
        document.getElementById(`lista-${cat}`).addEventListener('click', async (e) => {
            if (e.target.closest('.btn-delete')) {
                const id = e.target.closest('.btn-delete').dataset.id;
                if (confirm('¿Eliminar este tipo?')) {
                    try {
                        await fetchAPI(`/amenidades/${id}`, { method: 'DELETE' });
                        await cargarTipos();
                    } catch (error) {
                        alert('Error al eliminar: ' + error.message);
                    }
                }
            }
        });
    });
}

async function cargarTipos() {
    try {
        tiposAmenidad = await fetchAPI('/amenidades');
        renderLista('CAMA');
        renderLista('BANO');
        renderLista('EQUIPAMIENTO');
    } catch (error) {
        console.error('Error cargando amenidades:', error);
    }
}

function renderLista(categoria) {
    const container = document.getElementById(`lista-${categoria}`);
    const items = tiposAmenidad.filter(t => t.categoria === categoria);

    if (items.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400 italic">Sin elementos definidos.</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="flex justify-between items-center bg-white p-2 rounded shadow-sm border">
            <div class="flex items-center gap-2">
                <span class="text-xl">${item.icono}</span>
                <span class="font-medium text-sm">${item.nombre}</span>
            </div>
            <button class="btn-delete text-red-400 hover:text-red-600" data-id="${item.id}">
                &times;
            </button>
        </div>
    `).join('');
}
