// frontend/src/views/components/gestionarPlantillas/plantillas.modals.js
import { fetchAPI } from '../../../api.js';

let editandoPlantilla = null;
let onSaveCallback = null;

function _escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** @param {Array<{ tag: string, descripcion: string }>} catalogo — GET /plantillas/etiquetas-motor */
function renderEtiquetasAyuda(catalogo = []) {
    if (!catalogo || catalogo.length === 0) {
        return `<p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded">No se pudo cargar el catálogo de etiquetas. Recarga la página o revisa la conexión con el servidor.</p>`;
    }
    return catalogo.map((row) => `
        <div class="flex items-center justify-between text-xs bg-gray-50 p-2 rounded border border-gray-200">
            <div class="min-w-0 pr-2">
                <span class="font-mono font-bold text-primary-700 select-all">${_escHtml(row.tag)}</span>
                <span class="text-gray-500 ml-2">— ${_escHtml(row.descripcion)}</span>
            </div>
            <button type="button" data-etiqueta="${_escHtml(row.tag)}" class="copy-tag-btn text-gray-400 hover:text-primary-600 ml-2 shrink-0" title="Copiar">
                <i class="fa-solid fa-clipboard"></i>
            </button>
        </div>
    `).join('');
}

export const renderModalPlantilla = (catalogoEtiquetas = []) => {
    return `
        <div id="plantilla-modal" class="modal hidden">
            <div class="modal-content !max-w-5xl h-[90vh] flex flex-col">
                <div class="flex items-center gap-4 mb-6 pb-5 border-b flex-shrink-0">
                    <div class="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 text-xl flex-shrink-0">✉️</div>
                    <div class="flex-1">
                        <h3 id="modal-title" class="text-xl font-semibold text-gray-900">Nueva Plantilla</h3>
                        <p id="modal-plantilla-subtitle" class="text-sm text-gray-500">Redacta el contenido del mensaje</p>
                    </div>
                    <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
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

                            <div class="mb-4">
                                <label for="plantilla-ia-instrucciones" class="block text-xs font-medium text-gray-600">Instrucciones opcionales para la IA</label>
                                <textarea id="plantilla-ia-instrucciones" name="plantillaIaInstrucciones" rows="2" class="form-input mt-1 text-sm" placeholder="Ej.: tono formal, mencionar política de cancelación, no usar emojis..."></textarea>
                            </div>

                            <div class="flex-grow flex flex-col mb-4 min-h-0">
                                <div class="mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <label for="texto" class="block text-sm font-medium text-gray-700">Contenido del Mensaje</label>
                                    <button type="button" id="plantilla-generar-ia-btn" class="btn-outline text-xs py-1.5 px-3 whitespace-nowrap flex items-center gap-1.5 shrink-0" title="Requiere tipo de mensaje. Usa las etiquetas [VARIABLE] del panel derecho.">
                                        <i class="fa-solid fa-wand-magic-sparkles"></i> Generar con IA
                                    </button>
                                </div>
                                <textarea id="texto" name="texto" required class="form-input flex-grow resize-none font-mono text-sm min-h-[200px]" placeholder="Hola [CLIENTE_NOMBRE]..."></textarea>
                            </div>

                            <div class="flex justify-end pt-4 border-t mt-auto flex-shrink-0">
                                <button type="button" id="cancel-btn" class="btn-outline mr-2">Cancelar</button>
                                <button type="submit" class="btn-primary">Guardar Plantilla</button>
                            </div>
                        </form>
                    </div>

                    <div class="w-full md:w-1/3 bg-gray-50 border-l p-4 overflow-y-auto flex-shrink-0 rounded-r-lg">
                        <h4 class="font-semibold text-gray-700 mb-3 text-sm">Etiquetas del motor</h4>
                        <p class="text-xs text-gray-500 mb-4">Solo estas variables se sustituyen al enviar el correo (mismo criterio que <strong>Generar con IA</strong>). Haz clic en el icono para copiar.</p>
                        <div id="etiquetas-container" class="space-y-2">
                            ${renderEtiquetasAyuda(catalogoEtiquetas)}
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

    const subtitle = document.getElementById('modal-plantilla-subtitle');
    if (plantilla) {
        editandoPlantilla = plantilla;
        modalTitle.textContent = 'Editar Plantilla';
        if (subtitle) subtitle.textContent = plantilla.nombre;
        form.nombre.value = plantilla.nombre;
        form.tipoId.value = plantilla.tipoId;
        form.asunto.value = plantilla.asunto || '';
        form.texto.value = plantilla.texto; // CORREGIDO: usar 'texto'
    } else {
        editandoPlantilla = null;
        modalTitle.textContent = 'Nueva Plantilla';
        if (subtitle) subtitle.textContent = 'Redacta el contenido del mensaje';
        form.reset();
    }
    const iaInstr = document.getElementById('plantilla-ia-instrucciones');
    if (iaInstr) iaInstr.value = '';
    
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

    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    document.getElementById('close-modal-btn').addEventListener('click', cerrarModalPlantilla);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModalPlantilla);

    const etiquetasContainer = document.getElementById('etiquetas-container');
    const newEtiquetasContainer = etiquetasContainer.cloneNode(true);
    etiquetasContainer.parentNode.replaceChild(newEtiquetasContainer, etiquetasContainer);

    newEtiquetasContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-tag-btn');
        if (btn) {
            const etiqueta = btn.dataset.etiqueta;
            navigator.clipboard.writeText(etiqueta).then(() => {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check text-success-500"></i>';
                setTimeout(() => { btn.innerHTML = originalHtml; }, 1500);
            });
        }
    });

    const genIaBtn = newForm.querySelector('#plantilla-generar-ia-btn');
    if (genIaBtn) {
        genIaBtn.addEventListener('click', async () => {
            const tipoId = newForm.tipoId?.value;
            if (!tipoId) {
                alert('Selecciona un tipo de mensaje para que la IA adapte el texto y las etiquetas del motor.');
                return;
            }
            const originalHtml = genIaBtn.innerHTML;
            genIaBtn.disabled = true;
            genIaBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
            try {
                const tipoOpt = newForm.tipoId.options[newForm.tipoId.selectedIndex];
                const tipoNombre = tipoOpt ? tipoOpt.textContent.trim() : '';
                const iaInstr = newForm.querySelector('#plantilla-ia-instrucciones');
                const data = await fetchAPI('/plantillas/generar-ia', {
                    method: 'POST',
                    body: {
                        tipoId,
                        tipoNombre,
                        nombreBorrador: newForm.nombre.value,
                        instrucciones: iaInstr?.value || '',
                    },
                });
                if (data.nombre) newForm.nombre.value = data.nombre;
                if (data.asunto != null) newForm.asunto.value = data.asunto;
                if (data.texto) newForm.texto.value = data.texto;
            } catch (err) {
                alert(err.message || String(err));
            } finally {
                genIaBtn.disabled = false;
                genIaBtn.innerHTML = originalHtml;
            }
        });
    }

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = e.target;
        const datos = {
            nombre: formData.nombre.value,
            tipoId: formData.tipoId.value,
            asunto: formData.asunto.value,
            texto: formData.texto.value // CORREGIDO: usar 'texto'
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