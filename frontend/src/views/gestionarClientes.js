// frontend/src/views/gestionarClientes.js

import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { filtrarClientes } from './components/gestionarClientes/clientes.utils.js';
import { renderFilasTabla } from './components/gestionarClientes/clientes.table.js';
import { renderModalCliente, setupModalCliente, abrirModalCliente } from './components/gestionarClientes/clientes.modals.js';

let clientes = [];

function actualizarTabla() {
    const tbody = document.getElementById('clientes-tbody');
    const searchInput = document.getElementById('search-input');
    const tipoFilter = document.getElementById('tipo-cliente-filter');
    
    if (!tbody || !searchInput || !tipoFilter) return;

    const clientesFiltrados = filtrarClientes(clientes, searchInput.value, tipoFilter.value);
    tbody.innerHTML = renderFilasTabla(clientesFiltrados);
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
                <div class="w-full md:w-auto flex-grow flex items-center gap-4">
                    <input type="text" id="search-input" placeholder="Buscar por nombre, teléfono o email..." class="form-input w-full md:w-1/3">
                    <select id="tipo-cliente-filter" class="form-select w-full md:w-auto">
                        <option value="">-- Filtrar por Tipo --</option>
                        <option value="Cliente Nuevo">Cliente Nuevo</option>
                        <option value="Cliente Frecuente">Cliente Frecuente</option>
                        <option value="Cliente Premium">Cliente Premium</option>
                        <option value="Sin Reservas">Sin Reservas</option>
                    </select>
                </div>
                <button id="add-cliente-btn" class="btn-primary">+ Nuevo Cliente</button>
            </div>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
                            <th class="th">Nombre</th>
                            <th class="th">Teléfono</th>
                            <th class="th">Email</th>
                            <th class="th">Tipo Cliente</th>
                            <th class="th">País</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="clientes-tbody"></tbody>
                </table>
            </div>
        </div>
        
        ${renderModalCliente()}
    `;
}

export function afterRender() {
    actualizarTabla();

    // Configuramos el modal con su callback de éxito
    setupModalCliente(async () => {
        clientes = await fetchAPI('/clientes');
        actualizarTabla();
    });

    // Botón de crear nuevo
    document.getElementById('add-cliente-btn').addEventListener('click', () => abrirModalCliente());
    
    // Filtros
    document.getElementById('search-input').addEventListener('input', actualizarTabla);
    document.getElementById('tipo-cliente-filter').addEventListener('change', actualizarTabla);

    // Eventos de la tabla
    document.getElementById('clientes-tbody').addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        const cliente = clientes.find(c => c.id === id);
        if (!cliente) return;

        if (target.classList.contains('view-btn')) {
            handleNavigation(`/cliente/${id}`);
        }

        if (target.classList.contains('edit-btn')) {
            abrirModalCliente(cliente);
        }

        if (target.classList.contains('sync-btn')) {
            target.disabled = true;
            target.textContent = '...';
            try {
                const result = await fetchAPI(`/clientes/${id}/sincronizar-google`, { method: 'POST' });
                alert(result.message);
                const clienteIndex = clientes.findIndex(c => c.id === id);
                if (clienteIndex > -1) {
                    clientes[clienteIndex].googleContactSynced = true;
                }
                actualizarTabla();
            } catch (error) {
                alert(`Error al sincronizar: ${error.message}`);
                target.disabled = false;
                target.textContent = 'Sincronizar';
            }
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm(`¿Estás seguro de que quieres eliminar a ${cliente.nombre}?`)) {
                try {
                    await fetchAPI(`/clientes/${id}`, { method: 'DELETE' });
                    clientes = await fetchAPI('/clientes');
                    actualizarTabla();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}