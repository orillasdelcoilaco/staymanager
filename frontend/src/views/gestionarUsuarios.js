// frontend/src/views/gestionarUsuarios.js
import { fetchAPI } from '../api.js';
import { renderFilasTabla } from './components/gestionarUsuarios/usuarios.table.js';
import { renderModalUsuario, setupModalUsuario, abrirModalUsuario } from './components/gestionarUsuarios/usuarios.modals.js';

let usuarios = [];

async function cargarUsuarios() {
    try {
        usuarios = await fetchAPI('/usuarios');
        document.getElementById('usuarios-tbody').innerHTML = renderFilasTabla(usuarios);
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        const container = document.querySelector('.table-container');
        if(container) container.innerHTML = `<p class="text-red-500 p-4">Error al cargar los datos.</p>`;
    }
}

export async function render() {
    // Iniciamos carga
    try {
        usuarios = await fetchAPI('/usuarios');
    } catch (error) {
        return `<p class="text-red-500">Error crítico de conexión.</p>`;
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
                            <th class="th">Email</th>
                            <th class="th text-center">Rol</th>
                            <th class="th text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="usuarios-tbody">
                        ${renderFilasTabla(usuarios)}
                    </tbody>
                </table>
            </div>
        </div>
        
        ${renderModalUsuario()}
    `;
}

export function afterRender() {
    setupModalUsuario(async () => {
        await cargarUsuarios();
    });

    document.getElementById('add-usuario-btn').addEventListener('click', () => abrirModalUsuario());

    const tbody = document.getElementById('usuarios-tbody');
    
    tbody.addEventListener('click', async (e) => {
        const target = e.target;
        const uid = target.dataset.uid;
        if (!uid) return;

        if (target.classList.contains('edit-btn')) {
            const usuarioAEditar = usuarios.find(u => u.uid === uid);
            if (usuarioAEditar) {
                abrirModalUsuario(usuarioAEditar);
            } else {
                alert('Error: Usuario no encontrado en memoria.');
            }
        }

        if (target.classList.contains('delete-btn')) {
            const usuario = usuarios.find(u => u.uid === uid);
            const emailConfirm = usuario ? usuario.email : 'este usuario';
            
            if (confirm(`¿Estás seguro de que quieres eliminar a ${emailConfirm}?`)) {
                try {
                    await fetchAPI(`/usuarios/${uid}`, { method: 'DELETE' });
                    await cargarUsuarios();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}