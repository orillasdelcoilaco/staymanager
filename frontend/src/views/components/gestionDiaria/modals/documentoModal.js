import { fetchAPI } from '../../../../api.js';
import { showPreview, handlePaste, openImageViewer } from '../gestionDiaria.utils.js';

let currentGrupo = null;
let onActionComplete = () => {};
let currentAction = null;

async function handleGroupFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const saveBtn = form.querySelector('#modal-save-btn');
    const statusEl = form.querySelector('#modal-status');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
    statusEl.textContent = '';
    
    const formData = new FormData();
    const detalles = {
        reservaIdOriginal: currentGrupo.reservaIdOriginal,
        idsIndividuales: currentGrupo.reservasIndividuales.map(r => r.id)
    };
    
    const endpoint = '/gestion/actualizar-documento';
    detalles.tipoDocumento = currentAction === 'boleta' ? 'boleta' : 'reserva';
    if (detalles.tipoDocumento === 'boleta') {
        detalles.avanzarEstado = 'Facturado';
    }

    const docInput = form.querySelector('#documento-input');
    if (docInput && docInput.files.length > 0) {
        formData.append('documento', docInput.files[0]);
    } else {
        statusEl.textContent = 'Debes seleccionar un archivo para subir.';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
        return;
    }
    
    formData.append('detalles', JSON.stringify(detalles));

    try {
        await fetchAPI(endpoint, { method: 'POST', body: formData });
        document.getElementById('gestion-modal').classList.add('hidden');
        await onActionComplete();
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

export function renderDocumentoModal(tipo, grupo, callback) {
    currentGrupo = grupo;
    onActionComplete = callback;
    currentAction = tipo;

    const contentContainer = document.getElementById('modal-content-container');
    const enlaceExistente = tipo === 'boleta' ? currentGrupo.documentos.enlaceBoleta : currentGrupo.documentos.enlaceReserva;

    let contentHtml = '';
    if (enlaceExistente && enlaceExistente !== 'SIN_DOCUMENTO') {
        contentHtml += `
            <div class="border rounded-md p-4">
                <p class="font-semibold">Documento Actual:</p>
                <img src="${enlaceExistente}" alt="Vista previa del documento" class="mt-2 max-w-full h-auto max-h-60 object-contain cursor-pointer view-image-btn">
                <a href="${enlaceExistente}" target="_blank" class="text-blue-600 hover:underline text-sm">Abrir en nueva pestaña</a>
            </div>`;
    }

    contentHtml += `
        <form id="modal-form-accion" class="border p-4 rounded-md ${enlaceExistente ? 'mt-4' : ''}">
            <h4 class="font-semibold text-lg mb-4">${enlaceExistente ? 'Reemplazar Documento' : 'Subir Documento'}</h4>
            <div>
                <label class="block text-sm">Documento</label>
                <input type="file" id="documento-input" class="hidden"/>
                <div id="paste-zone" class="mt-1 p-4 border-2 border-dashed rounded-md text-center cursor-pointer text-gray-500 hover:border-indigo-500 hover:text-indigo-500"><p>Selecciona o pega una imagen</p></div>
                <div id="preview-container" class="mt-2 hidden"><p class="text-sm">Vista Previa:</p><img id="thumbnail" class="w-24 h-24 object-cover rounded-md"></div>
            </div>
            <div id="modal-status" class="mt-2 text-sm text-red-600"></div>
            <div class="mt-5 flex justify-end space-x-2"><button type="submit" id="modal-save-btn" class="btn-primary">Guardar</button></div>
        </form>`;
    
    contentContainer.innerHTML = contentHtml;

    const form = contentContainer.querySelector('#modal-form-accion');
    form.addEventListener('submit', handleGroupFormSubmit);
    
    const docInput = form.querySelector('#documento-input');
    const pasteZone = form.querySelector('#paste-zone');
    const previewContainer = form.querySelector('#preview-container');
    const thumbnail = form.querySelector('#thumbnail');
    
    pasteZone.addEventListener('click', () => docInput.click());
    docInput.addEventListener('change', () => { if(docInput.files.length) showPreview(docInput.files[0], thumbnail, previewContainer); });
    document.addEventListener('paste', e => handlePaste(e, docInput, thumbnail, previewContainer));
    
    contentContainer.querySelectorAll('.view-image-btn').forEach(img => {
        img.addEventListener('click', () => openImageViewer(img.src));
    });
}