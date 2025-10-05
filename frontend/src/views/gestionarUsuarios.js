import { fetchAPI } from '../api.js';

let usuarios = [];
let editandoUsuario = null;

function abrirModal(usuario = null) {
    const modal = document.getElementById('usuario-modal');
    const form = document.getElementById('usuario-form');
    const modalTitle = document.getElementById('modal-title');
    
    if (usuario) {
        editandoUsuario = usuario;
        modalTitle.textContent = 'Editar Usuario';
        form.email.value = usuario.email;
        form.email.disabled = true;
        form.password.required = false;
        form.password.placeholder = "Dejar en blanco para no cambiar";
    } else {
        editandoUsuario = null;
        modalTitle.textContent = 'Nuevo Usuario';
        form.reset();
        form.email.disabled = false;
        form.password.required = true;
        form.password.placeholder = "Contraseña temporal";
    }
    
    modal.classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('usuario-modal').classList.add('hidden');
    editandoUsuario = null;
}

function renderTabla() {
    const tbody = document.getElementById('usuarios-tbody');
    if (!tbody) return;

    if (usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay usuarios registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = usuarios.map((u, index) => `
        <tr class="border-b">
            <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-3 px-4 font-medium">${u.email}</td>
            <td class="py-3 px-4">${u.rol}</td>
            <td class="py-3 px-4">
                <button data-uid="${u.uid}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

export async function render() {
    try {
        usuarios = await fetchAPI('/usuarios');
    } catch (error) {
        return `<p class="text-red-500">Error al cargar los usuarios.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Usuarios</h2>
                <button id="add-usuario-btn" class="btn-primary">
                    + Nuevo Usuario
                </button>
            </div>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
                            <th class="th">Email (Usuario)</th>
                            <th class="th">Rol</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="usuarios-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="usuario-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="modal-title" class="text-xl font-semibold mb-4">Nuevo Usuario</h3>
                <form id="usuario-form" class="space-y-4">
                    <div>
                        <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
                        <input type="email" name="email" required class="form-input">
                    </div>
                    <div>
                        <label for="password" class="block text-sm font-medium text-gray-700">Contraseña</label>
                        <input type="password" name="password" required class="form-input">
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

export function afterRender() {
    renderTabla();

    document.getElementById('add-usuario-btn').addEventListener('click', () => abrirModal());
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    document.getElementById('usuario-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const datos = {
            email: form.email.value,
            password: form.password.value
        };

        try {
            await fetchAPI('/usuarios', { method: 'POST', body: datos });
            usuarios = await fetchAPI('/usuarios');
            renderTabla();
            cerrarModal();
        } catch (error) {
            alert(`Error al crear usuario: ${error.message}`);
        }
    });

    document.getElementById('usuarios-tbody').addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const uid = e.target.dataset.uid;
            const usuario = usuarios.find(u => u.uid === uid);
            if (confirm(`¿Estás seguro de que quieres eliminar al usuario ${usuario.email}?`)) {
                try {
                    await fetchAPI(`/usuarios/${uid}`, { method: 'DELETE' });
                    usuarios = await fetchAPI('/usuarios');
                    renderTabla();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}