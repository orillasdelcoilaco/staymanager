import { fetchAPI } from '../api.js';

let clientes = [];
let editandoCliente = null;

// --- Lógica del Modal ---
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

// --- Lógica de la Tabla y Búsqueda ---
function renderTabla(filtro = '') {
    const tbody = document.getElementById('clientes-tbody');
    if (!tbody) return;

    const clientesFiltrados = clientes.filter(c => 
        c.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        c.telefono.includes(filtro) ||
        c.email.toLowerCase().includes(filtro.toLowerCase())
    );

    if (clientesFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No se encontraron clientes.</td></tr>';
        return;
    }

    tbody.innerHTML = clientesFiltrados.map(c => `
        <tr class="border-b">
            <td class="py-3 px-4 font-medium">${c.nombre}</td>
            <td class="py-3 px-4">${c.telefono}</td>
            <td class="py-3 px-4">${c.email || '-'}</td>
            <td class="py-3 px-4">${c.pais || '-'}</td>
            <td class="py-3 px-4">
                <button data-id="${c.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Editar</button>
                <button data-id="${c.id}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

// --- Lógica Principal de la Vista ---
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
                            <th class="th">Nombre</th>
                            <th class="th">Teléfono</th>
                            <th class="th">Email</th>
                            <th class="th">País</th>
                            <th class="th">Acciones</th>
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
                    <div class="mb-4">
                        <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Completo</label>
                        <input type="text" id="nombre" name="nombre" required class="mt-1 form-input">
                    </div>
                    <div class="mb-4">
                        <label for="telefono" class="block text-sm font-medium text-gray-700">Teléfono</label>
                        <input type="tel" id="telefono" name="telefono" required class="mt-1 form-input" placeholder="Ej: 56912345678">
                    </div>
                    <div class="mb-4">
                        <label for="email" class="block text-sm font-medium text-gray-700">Email (Opcional)</label>
                        <input type="email" id="email" name="email" class="mt-1 form-input">
                    </div>
                     <div class="mb-4">
                        <label for="pais" class="block text-sm font-medium text-gray-700">País (Opcional)</label>
                        <input type="text" id="pais" name="pais" class="mt-1 form-input" placeholder="Ej: CL">
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

    // --- Event Listeners ---
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

        if (target.classList.contains('edit-btn')) {
            abrirModal(cliente);
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