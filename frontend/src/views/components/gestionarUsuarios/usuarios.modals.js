// frontend/src/views/components/gestionarUsuarios/usuarios.modals.js
import { fetchAPI } from '../../../api.js';

let editandoUsuario = null;
let onSaveCallback = null;

export const renderModalUsuario = () => {
    return `
        <div id="usuario-modal" class="modal hidden">
            <div class="modal-content !max-w-md">
                <div class="flex items-center gap-4 mb-6 pb-5 border-b">
                    <div class="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 text-xl flex-shrink-0">👤</div>
                    <div class="flex-1">
                        <h3 id="modal-title" class="text-xl font-semibold text-gray-900">Nuevo Usuario</h3>
                        <p id="modal-usuario-subtitle" class="text-sm text-gray-500">Acceso al panel de administración</p>
                    </div>
                    <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
                </div>
                <form id="usuario-form">
                    <div class="space-y-4">
                        <div>
                            <label for="email" class="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                            <input type="email" id="email" name="email" required class="form-input mt-1" placeholder="ejemplo@empresa.com">
                        </div>
                        <div>
                            <label for="password" class="block text-sm font-medium text-gray-700">Contraseña</label>
                            <input type="password" id="password" name="password" required class="form-input mt-1" placeholder="Contraseña temporal">
                            <p id="password-help" class="text-xs text-gray-500 mt-1 hidden">Dejar en blanco para mantener la contraseña actual.</p>
                        </div>
                    </div>
                    <div class="flex justify-end pt-6 mt-4 border-t">
                        <button type="button" id="cancel-btn" class="btn-outline mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

export const abrirModalUsuario = (usuario = null) => {
    const modal = document.getElementById('usuario-modal');
    const form = document.getElementById('usuario-form');
    const modalTitle = document.getElementById('modal-title');
    const passwordHelp = document.getElementById('password-help');
    
    if (!modal || !form) return;

    const subtitle = document.getElementById('modal-usuario-subtitle');
    if (usuario) {
        editandoUsuario = usuario;
        modalTitle.textContent = 'Editar Usuario';
        if (subtitle) subtitle.textContent = usuario.email;
        form.email.value = usuario.email;
        form.email.disabled = true; // El email es el identificador, no se suele cambiar fácilmente
        form.email.classList.add('bg-gray-100', 'cursor-not-allowed');
        
        form.password.required = false;
        form.password.placeholder = "••••••••";
        passwordHelp.classList.remove('hidden');
    } else {
        editandoUsuario = null;
        modalTitle.textContent = 'Nuevo Usuario';
        if (subtitle) subtitle.textContent = 'Acceso al panel de administración';
        form.reset();
        
        form.email.disabled = false;
        form.email.classList.remove('bg-gray-100', 'cursor-not-allowed');
        
        form.password.required = true;
        form.password.placeholder = "Contraseña temporal";
        passwordHelp.classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
};

export const cerrarModalUsuario = () => {
    const modal = document.getElementById('usuario-modal');
    if (modal) modal.classList.add('hidden');
    editandoUsuario = null;
};

export const setupModalUsuario = (callback) => {
    onSaveCallback = callback;
    
    const form = document.getElementById('usuario-form');
    if (!form) return;

    // Clonar para limpiar eventos anteriores
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    document.getElementById('close-modal-btn').addEventListener('click', cerrarModalUsuario);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModalUsuario);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = e.target;
        
        const datos = {
            email: formData.email.value,
            password: formData.password.value
        };

        // Si estamos editando y la contraseña está vacía, la eliminamos del payload
        if (editandoUsuario && !datos.password) {
            delete datos.password;
        }

        try {
            if (editandoUsuario) {
                // Asumimos que existe un endpoint PUT para actualizar. 
                // Si solo cambias la contraseña, el backend debe soportarlo.
                await fetchAPI(`/usuarios/${editandoUsuario.uid}`, { method: 'PUT', body: datos });
            } else {
                await fetchAPI('/usuarios', { method: 'POST', body: datos });
            }
            
            cerrarModalUsuario();
            if (onSaveCallback) onSaveCallback();
        } catch (error) {
            alert(`Error al guardar usuario: ${error.message}`);
        }
    });
};