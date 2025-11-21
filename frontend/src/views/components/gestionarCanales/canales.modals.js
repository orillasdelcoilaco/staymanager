// frontend/src/views/components/gestionarCanales/canales.modals.js
import { fetchAPI } from '../../../api.js';

let editandoCanal = null;
let onSaveCallback = null;

export const renderModalCanal = () => {
    return `
        <div id="canal-modal" class="modal hidden">
            <div class="modal-content !max-w-3xl">
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
                     <div class="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="mb-4">
                            <label for="modificadorTipo" class="block text-sm font-medium text-gray-700">Modificador de Tarifa</label>
                            <select id="modificadorTipo" name="modificadorTipo" class="form-select mt-1">
                                <option value="">Sin modificador</option>
                                <option value="porcentaje">Porcentaje (%)</option>
                                <option value="fijo">Monto Fijo</option>
                            </select>
                        </div>
                        <div class="mb-4">
                            <label for="modificadorValor" class="block text-sm font-medium text-gray-700">Valor del Modificador</label>
                            <input type="number" id="modificadorValor" name="modificadorValor" class="form-input mt-1" value="0" step="0.01">
                             <p class="text-xs text-gray-500 mt-1">Ej: 18 para +18%, o 5000 para +$5.000</p>
                        </div>
                    </div>
                    <div class="mb-4">
                        <label for="descripcion" class="block text-sm font-medium text-gray-700">Descripción (Opcional)</label>
                        <textarea id="descripcion" name="descripcion" rows="3" class="form-input mt-1"></textarea>
                    </div>
                    <div class="space-y-2">
                        <label for="esCanalPorDefecto" class="flex items-center">
                            <input type="checkbox" id="esCanalPorDefecto" name="esCanalPorDefecto" class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
                            <span class="ml-2 text-sm text-gray-600">⭐ Marcar como canal por defecto para la tarifa base.</span>
                        </label>
                        <label for="esCanalIcal" class="flex items-center">
                            <input type="checkbox" id="esCanalIcal" name="esCanalIcal" class="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
                            <span class="ml-2 text-sm text-gray-600">🗓️ Usar este canal para las reservas creadas desde la sincronización iCal.</span>
                        </label>
                    </div>
                    <div class="flex justify-end pt-4 mt-4 border-t">
                        <button type="button" id="cancel-btn" class="btn-secondary mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

export const abrirModalCanal = (canal = null) => {
    const modal = document.getElementById('canal-modal');
    const form = document.getElementById('canal-form');
    const modalTitle = document.getElementById('modal-title');
    
    if (!modal || !form) return;

    if (canal) {
        editandoCanal = canal;
        modalTitle.textContent = 'Editar Canal';
        form.nombre.value = canal.nombre;
        form.clienteIdCanal.value = canal.clienteIdCanal || '';
        form.descripcion.value = canal.descripcion || '';
        form.moneda.value = canal.moneda || 'CLP';
        form.separadorDecimal.value = canal.separadorDecimal || ',';
        form.esCanalPorDefecto.checked = canal.esCanalPorDefecto || false;
        form.esCanalIcal.checked = canal.esCanalIcal || false;
        form.modificadorTipo.value = canal.modificadorTipo || '';
        form.modificadorValor.value = canal.modificadorValor || 0;
    } else {
        editandoCanal = null;
        modalTitle.textContent = 'Nuevo Canal';
        form.reset();
        form.moneda.value = 'CLP';
        form.separadorDecimal.value = ',';
    }
    
    modal.classList.remove('hidden');
};

export const cerrarModalCanal = () => {
    const modal = document.getElementById('canal-modal');
    if (modal) modal.classList.add('hidden');
    editandoCanal = null;
};

export const setupModalCanal = (callback) => {
    onSaveCallback = callback;
    
    const form = document.getElementById('canal-form');
    if (!form) return;

    // Clonar para limpiar eventos anteriores
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    document.getElementById('close-modal-btn').addEventListener('click', cerrarModalCanal);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModalCanal);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = e.target;
        const datos = {
            nombre: formData.nombre.value,
            clienteIdCanal: formData.clienteIdCanal.value,
            descripcion: formData.descripcion.value,
            moneda: formData.moneda.value,
            separadorDecimal: formData.separadorDecimal.value,
            esCanalPorDefecto: formData.esCanalPorDefecto.checked,
            esCanalIcal: formData.esCanalIcal.checked,
            modificadorTipo: formData.modificadorTipo.value,
            modificadorValor: parseFloat(formData.modificadorValor.value) || 0
        };

        try {
            if (editandoCanal) {
                await fetchAPI(`/canales/${editandoCanal.id}`, { method: 'PUT', body: datos });
            } else {
                await fetchAPI('/canales', { method: 'POST', body: datos });
            }
            
            cerrarModalCanal();
            if (onSaveCallback) onSaveCallback();
        } catch (error) {
            alert(`Error al guardar el canal: ${error.message}`);
        }
    });
};