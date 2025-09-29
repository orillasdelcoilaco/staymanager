import { fetchAPI } from '../api.js';

let tipos = [];
let editandoTipo = null;

function abrirModal(tipo = null) {
    const modal = document.getElementById('tipo-modal');
    const form = document.getElementById('tipo-form');
    const modalTitle = document.getElementById('modal-title');
    
    if (tipo) {
        editandoTipo = tipo;
        modalTitle.textContent = 'Editar Tipo de Plantilla';
        form.nombre.value = tipo.nombre;
        form.descripcion.value = tipo.descripcion || '';
    } else {
        editandoTipo = null;
        modalTitle.textContent = 'Nuevo Tipo de Plantilla';
        form.reset();
    }
    
    modal.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('tipo-modal').classList.add('hidden');
    editandoTipo = null;
}

function renderTabla() {
    const tbody = document.getElementById('tipos-tbody');
    if (!tbody) return;

    if (tipos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-4">No hay tipos de plantilla registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = tipos.map(t => `
        <tr class="border-b">
            <td class="py-3 px-4 font-medium">${t.nombre}</td>
            <td class="py-3 px-4">${t.descripcion}</td>
            <td class="py-3 px-4">
                <button data-id="${t.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Editar</button>
                <button data-id="${t.id}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Tipos de Plantilla</h2>
                <button id="add-tipo-btn" class="btn-primary">+ Nuevo Tipo</button>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th">Nombre</th>
                            <th class="th">Descripción</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tipos-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="tipo-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="modal-title" class="text-xl font-semibold mb-4"></h3>
                <form id="tipo-form" class="space-y-4">
                    <div>
                        <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre</label>
                        <input type="text" name="nombre" required class="form-input">
                    </div>
                    <div>
                        <label for="descripcion" class="block text-sm font-medium text-gray-700">Descripción (Opcional)</label>
                        <textarea name="descripcion" rows="3" class="form-input"></textarea>
                    </div>
                    <div class="flex justify-end pt-4 border-t">
                        <button type="button" id="cancel-btn" class="btn-secondary mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

async function fetchAndRender() {
    try {
        tipos = await fetchAPI('/plantillas/tipos');
        renderTabla();
    } catch (error) {
        document.getElementById('tipos-tbody').innerHTML = `<tr><td colspan="3" class="text-center text-red-500 py-4">Error al cargar datos: ${error.message}</td></tr>`;
    }
}

export async function afterRender() {
    await fetchAndRender();

    document.getElementById('add-tipo-btn').addEventListener('click', () => abrirModal());
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    document.getElementById('tipo-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            nombre: form.nombre.value,
            descripcion: form.descripcion.value
        };

        try {
            const endpoint = editandoTipo ? `/plantillas/tipos/${editandoTipo.id}` : '/plantillas/tipos';
            const method = editandoTipo ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method, body: datos });
            await fetchAndRender();
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    document.getElementById('tipos-tbody').addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains('edit-btn')) {
            const tipo = tipos.find(t => t.id === id);
            if (tipo) abrirModal(tipo);
        }

        if (e.target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este tipo? Solo se puede eliminar si ninguna plantilla lo está usando.')) {
                try {
                    await fetchAPI(`/plantillas/tipos/${id}`, { method: 'DELETE' });
                    await fetchAndRender();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}