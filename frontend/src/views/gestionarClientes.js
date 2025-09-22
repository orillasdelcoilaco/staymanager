import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let clientes = [];
let editandoCliente = null;

function abrirModal(cliente = null) {
    const modal = document.getElementById('cliente-modal');
    const form = document.getElementById('cliente-form');
    const modalTitle = document.getElementById('modal-title');
    
    if (cliente) {
        editandoCliente = cliente;
        modalTitle.textContent = 'Editar Cliente';
        form.nombre.value = cliente.nombre || '';
        form.email.value = cliente.email || '';
        form.telefono.value = cliente.telefono || '';
        form.pais.value = cliente.pais || '';
        form.calificacion.value = cliente.calificacion || 0;
        form.ubicacion.value = cliente.ubicacion || '';
        form.notas.value = cliente.notas || '';
    } else {
        editandoCliente = null;
        modalTitle.textContent = 'Nuevo Cliente';
        form.reset();
    }
    
    modal.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('cliente-modal').classList.add('hidden');
    editandoCliente = null;
}

function renderTabla(filtro = '') {
    const tbody = document.getElementById('clientes-tbody');
    if (!tbody) return;

    const clientesFiltrados = clientes.filter(c => 
        (c.nombre && c.nombre.toLowerCase().includes(filtro.toLowerCase())) ||
        (c.telefono && c.telefono.includes(filtro)) ||
        (c.email && c.email.toLowerCase().includes(filtro.toLowerCase()))
    );

    if (clientesFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No se encontraron clientes.</td></tr>';
        return;
    }

    tbody.innerHTML = clientesFiltrados.map(c => `
        <tr class="border-b hover:bg-gray-50 text-sm">
            <td class="py-2 px-3 font-medium">${c.nombre}</td>
            <td class="py-2 px-3">${c.telefono}</td>
            <td class="py-2 px-3">${c.email || '-'}</td>
            <td class="py-2 px-3">${c.pais || '-'}</td>
            <td class="py-2 px-3 whitespace-nowrap">
                <button data-id="${c.id}" class="view-btn text-indigo-600 hover:text-indigo-800 font-medium mr-3">Ver Perfil</button>
                <button data-id="${c.id}" class="delete-btn text-red-600 hover:text-red-800 font-medium">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

export async function render() {
    try {
        clientes = await fetchAPI('/clientes');
    } catch (error) {
        return `<p class="text-red-500">Error al cargar los clientes. Por favor, intente de nuevo.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Clientes</h2>
                <div class="w-full md:w-1/3">
                    <input type="text" id="search-input" placeholder="Buscar por nombre, teléfono o email..." class="form-input w-full">
                </div>
                <button id="add-cliente-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 w-full md:w-auto">
                    + Nuevo Cliente
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th text-sm">Nombre</th>
                            <th class="th text-sm">Teléfono</th>
                            <th class="th text-sm">Email</th>
                            <th class="th text-sm">País</th>
                            <th class="th text-sm">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="clientes-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="cliente-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="modal-title" class="text-xl font-semibold mb-4">Nuevo Cliente</h3>
                <form id="cliente-form">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="mb-2">
                            <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Completo</label>
                            <input type="text" id="nombre" name="nombre" required class="mt-1 form-input">
                        </div>
                        <div class="mb-2">
                            <label for="telefono" class="block text-sm font-medium text-gray-700">Teléfono</label>
                            <input type="tel" id="telefono" name="telefono" required class="mt-1 form-input" placeholder="Ej: 56912345678">
                        </div>
                        <div class="mb-2">
                            <label for="email" class="block text-sm font-medium text-gray-700">Email (Opcional)</label>
                            <input type="email" id="email" name="email" class="mt-1 form-input">
                        </div>
                         <div class="mb-2">
                            <label for="pais" class="block text-sm font-medium text-gray-700">País (Opcional)</label>
                            <input type="text" id="pais" name="pais" class="mt-1 form-input" placeholder="Ej: CL">
                        </div>
                    </div>
                    <hr class="my-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="mb-2">
                            <label for="calificacion" class="block text-sm font-medium text-gray-700">Calificación</label>
                            <select id="calificacion" name="calificacion" class="mt-1 form-select">
                                <option value="0">Sin calificar</option>
                                <option value="1">⭐</option><option value="2">⭐⭐</option><option value="3">⭐⭐⭐</option>
                                <option value="4">⭐⭐⭐⭐</option><option value="5">⭐⭐⭐⭐⭐</option>
                            </select>
                        </div>
                        <div class="mb-2">
                            <label for="ubicacion" class="block text-sm font-medium text-gray-700">Ubicación (Opcional)</label>
                            <input type="text" id="ubicacion" name="ubicacion" class="mt-1 form-input" placeholder="Ej: Santiago, Chile">
                        </div>
                    </div>
                    <div class="mb-2">
                        <label for="notas" class="block text-sm font-medium text-gray-700">Notas (Opcional)</label>
                        <textarea id="notas" name="notas" rows="3" class="mt-1 form-input"></textarea>
                    </div>
                    <div class="flex justify-end pt-4 mt-4 border-t">
                        <button type="button" id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md mr-2 hover:bg-gray-300">Cancelar</button>
                        <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

export function afterRender() {
    renderTabla();

    document.getElementById('add-cliente-btn').addEventListener('click', () => abrirModal());
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);
    document.getElementById('search-input').addEventListener('input', (e) => renderTabla(e.target.value));

    document.getElementById('cliente-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            nombre: form.nombre.value,
            telefono: form.telefono.value,
            email: form.email.value,
            pais: form.pais.value,
            calificacion: parseInt(form.calificacion.value) || 0,
            ubicacion: form.ubicacion.value,
            notas: form.notas.value
        };

        try {
            const endpoint = editandoCliente ? `/clientes/${editandoCliente.id}` : '/clientes';
            const method = editandoCliente ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method, body: datos });
            
            clientes = await fetchAPI('/clientes');
            renderTabla(document.getElementById('search-input').value);
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    document.getElementById('clientes-tbody').addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        const cliente = clientes.find(c => c.id === id);
        if (!cliente) return;

        if (target.classList.contains('view-btn')) {
            handleNavigation(`/cliente/${id}`);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm(`¿Estás seguro de que quieres eliminar a ${cliente.nombre}?`)) {
                try {
                    await fetchAPI(`/clientes/${id}`, { method: 'DELETE' });
                    clientes = await fetchAPI('/clientes');
                    renderTabla(document.getElementById('search-input').value);
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}