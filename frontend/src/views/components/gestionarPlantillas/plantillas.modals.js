// frontend/src/views/components/gestionarPlantillas/plantillas.modals.js
import { fetchAPI } from '../../../api.js';

let editandoPlantilla = null;
let onSaveCallback = null;

// Definición de etiquetas para ayuda al usuario
const ETIQUETAS_DISPONIBLES = [
    { etiqueta: '[CLIENTE_NOMBRE]', descripcion: 'Nombre completo del cliente' },
    { etiqueta: '[RESERVA_ID_CANAL]', descripcion: 'ID de la reserva en el canal de origen' },
    { etiqueta: '[FECHA_LLEGADA]', descripcion: 'Fecha de check-in' },
    { etiqueta: '[FECHA_SALIDA]', descripcion: 'Fecha de check-out' },
    { etiqueta: '[ALOJAMIENTO_NOMBRE]', descripcion: 'Nombre(s) de el/los alojamiento(s) reservado(s)' },
    { etiqueta: '[TOTAL_NOCHES]', descripcion: 'Número total de noches de la estadía' },
    { etiqueta: '[CANTIDAD_HUESPEDES]', descripcion: 'Número de huéspedes en la reserva' },
    { etiqueta: '[SALDO_PENDIENTE]', descripcion: 'Monto del saldo adeudado por el cliente' },
    { etiqueta: '[COBRO]', descripcion: 'Genera un resumen detallado del cobro (Total, abonos, saldo, etc.)' },
    { etiqueta: '[RESUMEN_VALORES_PROPUESTA]', descripcion: '(Para Propuestas) Bloque completo con detalle de precios, descuentos y totales' },
    { etiqueta: '[PROPUESTA_ID]', descripcion: 'ID único generado para la propuesta de reserva' },
    { etiqueta: '[ENLACE_PAGO]', descripcion: 'Enlace para realizar pagos (si aplica)' },
    { etiqueta: '[ENLACE_CHECKIN]', descripcion: 'Enlace al formulario de check-in online' },
    { etiqueta: '[ENLACE_RESERVA]', descripcion: 'Enlace al documento PDF de la reserva' },
    { etiqueta: '[ENLACE_BOLETA]', descripcion: 'Enlace al documento de boleta/factura' }
];

function renderEtiquetasAyuda() {
    return ETIQUETAS_DISPONIBLES.map(tag => `
        <div class="flex items-center justify-between text-xs bg-gray-50 p-2 rounded border border-gray-200">
            <div>
                <span class="font-mono font-bold text-indigo-700 select-all">${tag.etiqueta}</span>
                <span class="text-gray-500 ml-2">- ${tag.descripcion}</span>
            </div>
            <button type="button" data-etiqueta="${tag.etiqueta}" class="copy-tag-btn text-gray-400 hover:text-indigo-600 ml-2" title="Copiar">
                📋
            </button>
        </div>
    `).join('');
}

export const renderModalPlantilla = () => {
    return `
        <div id="plantilla-modal" class="modal hidden">
            <div class="modal-content !max-w-5xl h-[90vh] flex flex-col">
                <div class="flex justify-between items-center pb-3 border-b mb-4 flex-shrink-0">
                    <h3 id="modal-title" class="text-xl font-semibold">Nueva Plantilla</h3>
                    <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                
                <div class="flex flex-col md:flex-row gap-6 flex-grow overflow-hidden">
                    <div class="flex-1 flex flex-col overflow-y-auto pr-2">
                        <form id="plantilla-form" class="flex flex-col h-full">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label for="nombre" class="block text-sm font-medium text-gray-700">Nombre Interno</label>
                                    <input type="text" id="nombre" name="nombre" required class="form-input mt-1" placeholder="Ej: Bienvenida Estándar">
                                </div>
                                <div>
                                    <label for="tipoId" class="block text-sm font-medium text-gray-700">Tipo de Mensaje</label>
                                    <select id="tipoId" name="tipoId" required class="form-select mt-1">
                                        </select>
                                </div>
                            </div>
                            
                            <div class="mb-4">
                                <label for="asunto" class="block text-sm font-medium text-gray-700">Asunto (para Email)</label>
                                <input type="text" id="asunto" name="asunto" class="form-input mt-1" placeholder="Ej: Confirmación de Reserva en [ALOJAMIENTO_NOMBRE]">
                            </div>

                            <div class="flex-grow flex flex-col mb-4">
                                <label for="contenido" class="block text-sm font-medium text-gray-700 mb-1">Contenido del Mensaje</label>
                                <textarea id="contenido" name="contenido" required class="form-input flex-grow resize-none font-mono text-sm" placeholder="Hola [CLIENTE_NOMBRE]..."></textarea>
                            </div>

                            <div class="flex justify-end pt-4 border-t mt-auto flex-shrink-0">
                                <button type="button" id="cancel-btn" class="btn-secondary mr-2">Cancelar</button>
                                <button type="submit" class="btn-primary">Guardar Plantilla</button>
                            </div>
                        </form>
                    </div>

                    <div class="w-full md:w-1/3 bg-gray-50 border-l p-4 overflow-y-auto flex-shrink-0 rounded-r-lg">
                        <h4 class="font-semibold text-gray-700 mb-3 text-sm">Variables Disponibles</h4>
                        <p class="text-xs text-gray-500 mb-4">Haz clic en el icono para copiar y pega en el contenido.</p>
                        <div id="etiquetas-container" class="space-y-2">
                            ${renderEtiquetasAyuda()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

export const abrirModalPlantilla = (plantilla = null, tipos = []) => {
    const modal = document.getElementById('plantilla-modal');
    const form = document.getElementById('plantilla-form');
    const modalTitle = document.getElementById('modal-title');
    const tipoSelect = document.getElementById('tipoId');

    if (!modal || !form) return;

    // Rellenar el select de tipos
    tipoSelect.innerHTML = '<option value="">-- Seleccionar Tipo --</option>' + 
        tipos.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');

    if (plantilla) {
        editandoPlantilla = plantilla;
        modalTitle.textContent = 'Editar Plantilla';
        form.nombre.value = plantilla.nombre;
        form.tipoId.value = plantilla.tipoId;
        form.asunto.value = plantilla.asunto || '';
        form.contenido.value = plantilla.contenido;
    } else {
        editandoPlantilla = null;
        modalTitle.textContent = 'Nueva Plantilla';
        form.reset();
    }
    
    modal.classList.remove('hidden');
};

export const cerrarModalPlantilla = () => {
    const modal = document.getElementById('plantilla-modal');
    if (modal) modal.classList.add('hidden');
    editandoPlantilla = null;
};

export const setupModalPlantilla = (callback) => {
    onSaveCallback = callback;
    
    const form = document.getElementById('plantilla-form');
    if (!form) return;

    // Clonar para limpiar eventos anteriores del formulario
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // Listeners de cierre
    document.getElementById('close-modal-btn').addEventListener('click', cerrarModalPlantilla);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModalPlantilla);

    // Listener de copiado de etiquetas (Delegación de eventos)
    // Nota: Como el HTML de etiquetas es estático en el render, podemos asignar el listener al contenedor padre una sola vez o aquí.
    // Para seguridad, lo reiniciamos clonando el contenedor si fuera necesario, pero como es estático, basta con asegurar que no se duplique.
    const etiquetasContainer = document.getElementById('etiquetas-container');
    const newEtiquetasContainer = etiquetasContainer.cloneNode(true);
    etiquetasContainer.parentNode.replaceChild(newEtiquetasContainer, etiquetasContainer);

    newEtiquetasContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-tag-btn');
        if (btn) {
            const etiqueta = btn.dataset.etiqueta;
            navigator.clipboard.writeText(etiqueta).then(() => {
                // Feedback visual temporal en el botón
                const originalHtml = btn.innerHTML;
                btn.textContent = '✅';
                setTimeout(() => { btn.innerHTML = originalHtml; }, 1500);
            });
        }
    });

    // Listener de Submit
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = e.target;
        const datos = {
            nombre: formData.nombre.value,
            tipoId: formData.tipoId.value,
            asunto: formData.asunto.value,
            contenido: formData.contenido.value
        };

        try {
            if (editandoPlantilla) {
                await fetchAPI(`/plantillas/${editandoPlantilla.id}`, { method: 'PUT', body: datos });
            } else {
                await fetchAPI('/plantillas', { method: 'POST', body: datos });
            }
            
            cerrarModalPlantilla();
            if (onSaveCallback) onSaveCallback();
        } catch (error) {
            alert(`Error al guardar la plantilla: ${error.message}`);
        }
    });
};