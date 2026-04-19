// frontend/src/views/gestionarEstados.js
import { fetchAPI } from '../api.js';
import { SEMANTICA_LABELS, invalidarCache } from './components/estadosStore.js';

let estados = [];
let editandoEstado = null;

function abrirModal(estado = null) {
    const modal = document.getElementById('estado-modal');
    const form = document.getElementById('estado-form');
    const modalTitle = document.getElementById('modal-title');
    
    const subtitle = document.getElementById('modal-estado-subtitle');
    if (estado) {
        editandoEstado = estado;
        modalTitle.textContent = 'Editar Estado';
        if (subtitle) subtitle.textContent = estado.nombre;
        form.nombre.value = estado.nombre;
        form.color.value = estado.color || 'rgb(204 204 204)';
        form.esEstadoDeGestion.checked = estado.esEstadoDeGestion || false;
        form.orden.value = estado.orden || 0;
        form.semantica.value = estado.semantica || '';
    } else {
        editandoEstado = null;
        modalTitle.textContent = 'Nuevo Estado';
        if (subtitle) subtitle.textContent = 'Configura el nombre, color y comportamiento';
        form.reset();
        form.color.value = 'rgb(204 204 204)';
    }
    
    modal.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('estado-modal').classList.add('hidden');
    editandoEstado = null;
}

function renderTabla() {
    const tbody = document.getElementById('estados-tbody');
    if (!tbody) return;

    if (estados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No hay estados configurados.</td></tr>';
        return;
    }

    tbody.innerHTML = estados.map(e => `
        <tr class="border-b">
            <td class="py-3 px-4 text-center">${e.orden}</td>
            <td class="py-3 px-4"><span class="px-2 py-1 font-semibold text-white rounded" style="background-color: ${e.color};">${e.nombre}</span></td>
            <td class="py-3 px-4">${e.esEstadoDeGestion ? 'Sí' : 'No'}</td>
            <td class="py-3 px-4">
                <button data-id="${e.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button data-id="${e.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Estados de Reserva</h2>
                <button id="add-estado-btn" class="btn-primary">+ Nuevo Estado</button>
            </div>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead><tr>
                        <th class="th">Orden</th>
                        <th class="th">Nombre</th>
                        <th class="th">Es Estado de Gestión</th>
                        <th class="th">Acciones</th>
                    </tr></thead>
                    <tbody id="estados-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="estado-modal" class="modal hidden">
            <div class="modal-content">
                <div class="flex items-center gap-4 mb-6 pb-5 border-b">
                    <div class="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 text-xl flex-shrink-0">🔖</div>
                    <div>
                        <h3 id="modal-title" class="text-xl font-semibold text-gray-900"></h3>
                        <p id="modal-estado-subtitle" class="text-sm text-gray-500">Configura el nombre, color y comportamiento</p>
                    </div>
                </div>
                <form id="estado-form" class="space-y-4">
                    <div><label for="nombre" class="label-form">Nombre del Estado</label><input type="text" name="nombre" required class="form-input"></div>
                    <div><label for="color" class="label-form">Color</label><input type="color" name="color" required class="form-input"></div>
                    <div><label for="orden" class="label-form">Orden de Aparición</label><input type="number" name="orden" required class="form-input"></div>
                    <div class="flex items-center"><input type="checkbox" name="esEstadoDeGestion" class="h-4 w-4 rounded"><label for="esEstadoDeGestion" class="ml-2">Es un estado del flujo de Gestión Diaria</label></div>
                    <div>
                        <label for="semantica" class="label-form">Semántica del Sistema</label>
                        <select name="semantica" class="form-select">
                            <option value="">— Sin semántica asignada —</option>
                            ${Object.entries(SEMANTICA_LABELS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}
                        </select>
                        <p class="text-xs text-gray-500 mt-1">Conecta este estado con el comportamiento del sistema (flujo de trabajo, disponibilidad, filtros).</p>
                    </div>
                    <div class="flex justify-end pt-4 border-t">
                        <button type="button" id="cancel-btn" class="btn-outline mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

async function fetchAndRender() {
    try {
        estados = await fetchAPI('/estados');
        renderTabla();
    } catch (error) {
        document.getElementById('estados-tbody').innerHTML = `<tr><td colspan="4" class="text-center text-danger-500 py-4">Error al cargar datos: ${error.message}</td></tr>`;
    }
}

export async function afterRender() {
    await fetchAndRender();

    document.getElementById('add-estado-btn').addEventListener('click', () => abrirModal());
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    document.getElementById('estado-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            nombre: form.nombre.value,
            color: form.color.value,
            esEstadoDeGestion: form.esEstadoDeGestion.checked,
            orden: parseInt(form.orden.value) || 0,
            semantica: form.semantica.value || null,
        };
        invalidarCache();

        try {
            const endpoint = editandoEstado ? `/estados/${editandoEstado.id}` : '/estados';
            const method = editandoEstado ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method, body: datos });
            await fetchAndRender();
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    document.getElementById('estados-tbody').addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains('edit-btn')) {
            const estado = estados.find(est => est.id === id);
            if (estado) abrirModal(estado);
        }

        if (e.target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este estado?')) {
                try {
                    await fetchAPI(`/estados/${id}`, { method: 'DELETE' });
                    await fetchAndRender();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}