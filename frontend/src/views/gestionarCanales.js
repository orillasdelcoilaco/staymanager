import { fetchAPI } from '../api.js';

let canales = [];
let editandoCanal = null;

function abrirModal(canal = null) {
    const modal = document.getElementById('canal-modal');
    const form = document.getElementById('canal-form');
    const modalTitle = document.getElementById('modal-title');
    
    if (canal) {
        editandoCanal = canal;
        modalTitle.textContent = 'Editar Canal';
        form.nombre.value = canal.nombre;
        form.clienteIdCanal.value = canal.clienteIdCanal || '';
        form.descripcion.value = canal.descripcion || '';
        form.moneda.value = canal.moneda || 'CLP';
        form.separadorDecimal.value = canal.separadorDecimal || ',';
    } else {
        editandoCanal = null;
        modalTitle.textContent = 'Nuevo Canal';
        form.reset();
        form.moneda.value = 'CLP';
        form.separadorDecimal.value = ',';
    }
    
    modal.classList.remove('hidden');
}

function cerrarModal() {
    const modal = document.getElementById('canal-modal');
    modal.classList.add('hidden');
    editandoCanal = null;
}

function renderTabla() {
    const tbody = document.getElementById('canales-tbody');
    if (!tbody) return;

    if (canales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">No hay canales registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = canales.map((c, index) => `
        <tr class="border-b">
            <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-3 px-4 font-medium">${c.nombre}</td>
            <td class="py-3 px-4">${c.moneda}</td>
            <td class="py-3 px-4">${c.separadorDecimal === ',' ? 'Coma (,)' : 'Punto (.)'}</td>
            <td class="py-3 px-4 truncate max-w-sm">${c.descripcion || '-'}</td>
            <td class="py-3 px-4">
                <button data-id="${c.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
                <button data-id="${c.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `).join('');
}


export async function render() {
    try {
        canales = await fetchAPI('/canales');
    } catch (error) {
        console.error("Error al cargar canales:", error);
        return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Canales de Venta</h2>
                <button id="add-canal-btn" class="btn-primary">
                    + Nuevo Canal
                </button>
            </div>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
                            <th class="th">Nombre</th>
                            <th class="th">Moneda Reporte</th>
                            <th class="th">Separador Decimal</th>
                            <th class="th">Descripción</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="canales-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="canal-modal" class="modal hidden">
            <div class="modal-content">
                <div class="flex justify-between items-center pb-3">
                    <h3 id="modal-title" class="text-xl font-semibold">Nuevo Canal</h3>
                    <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800">&times;</button>
                </div>
                <form id="canal-form">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="mb-4">
                            <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre del Canal</label>
                            <input type="text" id="nombre" name="nombre" required class="form-input mt-1">
                        </div>
                         <div class="mb-4">
                            <label for="clienteIdCanal" class="block text-sm font-medium text-gray-700">ID de Cliente (Opcional)</label>
                            <input type="text" id="clienteIdCanal" name="clienteIdCanal" class="form-input mt-1">
                        </div>
                        <div class="mb-4">
                            <label for="moneda" class="block text-sm font-medium text-gray-700">Moneda del Reporte</label>
                            <select id="moneda" name="moneda" class="form-select mt-1">
                                <option value="CLP">CLP (Peso Chileno)</option>
                                <option value="USD">USD (Dólar Americano)</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label for="separadorDecimal" class="block text-sm font-medium text-gray-700">Separador Decimal</label>
                            <select id="separadorDecimal" name="separadorDecimal" class="form-select mt-1">
                                <option value=",">Coma (ej: 1.234,56)</option>
                                <option value=".">Punto (ej: 1,234.56)</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-4">
                        <label for="descripcion" class="block text-sm font-medium text-gray-700">Descripción (Opcional)</label>
                        <textarea id="descripcion" name="descripcion" rows="3" class="form-input mt-1"></textarea>
                    </div>
                    <div class="flex justify-end pt-4">
                        <button type="button" id="cancel-btn" class="btn-secondary mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

export function afterRender() {
    renderTabla();

    document.getElementById('add-canal-btn').addEventListener('click', () => abrirModal());
    document.getElementById('close-modal-btn').addEventListener('click', cerrarModal);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    document.getElementById('canal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            nombre: form.nombre.value,
            clienteIdCanal: form.clienteIdCanal.value,
            descripcion: form.descripcion.value,
            moneda: form.moneda.value,
            separadorDecimal: form.separadorDecimal.value
        };

        try {
            if (editandoCanal) {
                await fetchAPI(`/canales/${editandoCanal.id}`, { method: 'PUT', body: datos });
            } else {
                await fetchAPI('/canales', { method: 'POST', body: datos });
            }
            canales = await fetchAPI('/canales');
            renderTabla();
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar el canal: ${error.message}`);
        }
    });

    document.getElementById('canales-tbody').addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('edit-btn')) {
            const canalAEditar = canales.find(c => c.id === id);
            if (canalAEditar) abrirModal(canalAEditar);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este canal?')) {
                try {
                    await fetchAPI(`/canales/${id}`, { method: 'DELETE' });
                    canales = await fetchAPI('/canales');
                    renderTabla();
                } catch (error) {
                    alert(`Error al eliminar el canal: ${error.message}`);
                }
            }
        }
    });
}