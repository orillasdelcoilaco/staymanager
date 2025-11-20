// frontend/src/views/components/gestionarClientes/clientes.modals.js
import { fetchAPI } from '../../../api.js';

let onSaveCallback = null;
let editandoCliente = null;

/**
 * Retorna el HTML del modal de cliente.
 */
export const renderModalCliente = () => {
    return `
        <div id="cliente-modal" class="modal hidden">
            <div class="modal-content">
                <h3 id="modal-title" class="text-xl font-semibold mb-4">Nuevo Cliente</h3>
                <form id="cliente-form">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="mb-2">
                            <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Completo</label>
                            <input type="text" id="nombre" name="nombre" required class="form-input mt-1">
                        </div>
                        <div class="mb-2">
                            <label for="telefono" class="block text-sm font-medium text-gray-700">Teléfono</label>
                            <input type="tel" id="telefono" name="telefono" required class="form-input mt-1" placeholder="Ej: 56912345678">
                        </div>
                        <div class="mb-2">
                            <label for="email" class="block text-sm font-medium text-gray-700">Email (Opcional)</label>
                            <input type="email" id="email" name="email" class="form-input mt-1">
                        </div>
                         <div class="mb-2">
                            <label for="pais" class="block text-sm font-medium text-gray-700">País (Opcional)</label>
                            <input type="text" id="pais" name="pais" class="form-input mt-1" placeholder="Ej: CL">
                        </div>
                    </div>
                    <hr class="my-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="mb-2">
                            <label for="calificacion" class="block text-sm font-medium text-gray-700">Calificación</label>
                            <select id="calificacion" name="calificacion" class="form-select mt-1">
                                <option value="0">Sin calificar</option>
                                <option value="1">⭐</option><option value="2">⭐⭐</option><option value="3">⭐⭐⭐</option>
                                <option value="4">⭐⭐⭐⭐</option><option value="5">⭐⭐⭐⭐⭐</option>
                            </select>
                        </div>
                        <div class="mb-2">
                            <label for="ubicacion" class="block text-sm font-medium text-gray-700">Ubicación (Opcional)</label>
                            <input type="text" id="ubicacion" name="ubicacion" class="form-input mt-1" placeholder="Ej: Santiago, Chile">
                        </div>
                    </div>
                    <div class="mb-2">
                        <label for="notas" class="block text-sm font-medium text-gray-700">Notas (Opcional)</label>
                        <textarea id="notas" name="notas" rows="3" class="form-input mt-1"></textarea>
                    </div>
                    <div class="flex justify-end pt-4 mt-4 border-t">
                        <button type="button" id="cancel-cliente-btn" class="btn-secondary mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

/**
 * Abre el modal para crear o editar un cliente.
 * @param {Object|null} cliente - Objeto cliente para editar, o null para crear uno nuevo.
 */
export const abrirModalCliente = (cliente = null) => {
    const modal = document.getElementById('cliente-modal');
    const form = document.getElementById('cliente-form');
    const modalTitle = document.getElementById('modal-title');
    
    if (!modal || !form) return;

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
};

/**
 * Cierra el modal y limpia el estado.
 */
export const cerrarModalCliente = () => {
    const modal = document.getElementById('cliente-modal');
    if (modal) modal.classList.add('hidden');
    editandoCliente = null;
};

/**
 * Configura los event listeners del modal.
 * @param {Function} callback - Función a ejecutar tras un guardado exitoso.
 */
export const setupModalCliente = (callback) => {
    onSaveCallback = callback;
    
    const form = document.getElementById('cliente-form');
    if (!form) return;

    // 1. Clonamos y reemplazamos PRIMERO para limpiar eventos anteriores
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // 2. AHORA agregamos el listener al botón cancelar (que está dentro del NUEVO formulario)
    document.getElementById('cancel-cliente-btn')?.addEventListener('click', cerrarModalCliente);

    // 3. Agregamos el listener de submit al nuevo formulario
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = e.target;
        const datos = {
            nombre: formData.nombre.value,
            telefono: formData.telefono.value,
            email: formData.email.value,
            pais: formData.pais.value,
            calificacion: parseInt(formData.calificacion.value) || 0,
            ubicacion: formData.ubicacion.value,
            notas: formData.notas.value
        };

        try {
            const endpoint = editandoCliente ? `/clientes/${editandoCliente.id}` : '/clientes';
            const method = editandoCliente ? 'PUT' : 'POST';
            await fetchAPI(endpoint, { method, body: datos });
            
            cerrarModalCliente();
            if (onSaveCallback) onSaveCallback();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });
};