import { fetchAPI } from '../../../api.js';
import { getStatusInfo, formatCurrency, showPreview, handlePaste, openImageViewer } from './gestionDiaria.utils.js';

let currentGrupo = null;
let currentUserEmail = '';
let allTransacciones = [];
let onActionComplete = () => {}; // Callback para refrescar la vista principal

export function initializeModals(callback, userEmail) {
    onActionComplete = callback;
    currentUserEmail = userEmail;

    // Listeners para cerrar modales
    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => document.getElementById('gestion-modal').classList.add('hidden'));
    document.getElementById('bitacora-cancel-btn')?.addEventListener('click', () => document.getElementById('bitacora-modal').classList.add('hidden'));
    document.getElementById('bitacora-save-btn')?.addEventListener('click', saveNote);
    document.getElementById('image-viewer-close')?.addEventListener('click', () => document.getElementById('image-viewer-modal').classList.add('hidden'));
}

export function openManagementModal(type, grupo) {
    currentGrupo = grupo;
    const modal = document.getElementById('gestion-modal');
    document.getElementById('modal-title').textContent = `${type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} (Reserva ${currentGrupo.reservaIdOriginal})`;

    const actionMap = {
        'bitacora': openBitacoraModal,
        'ajuste_tarifa': renderAjusteTarifaModal,
        'pagos': renderPagosModal,
        'boleta': () => renderDocumentoModal('boleta'),
        'gestionar_reserva': () => renderDocumentoModal('reserva'),
    };

    if (actionMap[type]) {
        actionMap[type]();
        if (type !== 'bitacora') modal.classList.remove('hidden');
    }
}

export function openRevertModal(grupo) {
    currentGrupo = grupo;
    const modal = document.getElementById('gestion-modal');
    const contentContainer = document.getElementById('modal-content-container');
    document.getElementById('modal-title').textContent = `Revertir Estado (Reserva ${grupo.reservaIdOriginal})`;

    const estadosPosibles = [
        { value: 'Pendiente Bienvenida', text: 'Pendiente Bienvenida' },
        { value: 'Pendiente Cobro', text: 'Pendiente Cobro' },
        { value: 'Pendiente Pago', text: 'Pendiente Pago' },
        { value: 'Pendiente Boleta', text: 'Pendiente Boleta' }
    ];
    const estadoActualInfo = getStatusInfo(grupo.estadoGestion);
    const opcionesHtml = estadosPosibles
        .filter(estado => getStatusInfo(estado.value).level < estadoActualInfo.level)
        .map(estado => `<option value="${estado.value}">${estado.text}</option>`)
        .join('');

    contentContainer.innerHTML = `
        <p>Estado Actual: <strong class="font-semibold">${grupo.estadoGestion}</strong></p>
        <div>
            <label for="revert-select" class="block text-sm font-medium text-gray-700">Selecciona el estado al que quieres volver:</label>
            <select id="revert-select" class="form-select">${opcionesHtml}</select>
        </div>
        <div id="revert-status" class="text-sm"></div>
        <div class="text-right"><button id="revert-confirm-btn" class="btn-danger">Confirmar Reversión</button></div>`;

    contentContainer.querySelector('#revert-confirm-btn').addEventListener('click', handleRevertState);
    modal.classList.remove('hidden');
}

async function handleRevertState() {
    const nuevoEstado = document.getElementById('revert-select').value;
    if (!confirm(`¿Estás seguro de que quieres revertir el estado a "${nuevoEstado}"?`)) return;

    try {
        await fetchAPI('/gestion/actualizar-estado', {
            method: 'POST',
            body: {
                idsIndividuales: currentGrupo.reservasIndividuales.map(r => r.id),
                nuevoEstado
            }
        });
        document.getElementById('gestion-modal').classList.add('hidden');
        await onActionComplete();
    } catch (error) {
        document.getElementById('revert-status').textContent = `Error: ${error.message}`;
    }
}

export function openBitacoraModal() {
    const modal = document.getElementById('bitacora-modal');
    document.getElementById('bitacora-modal-title').textContent = `Bitácora de Gestión (Reserva ${currentGrupo.reservaIdOriginal})`;
    document.getElementById('bitacora-new-note').value = '';
    document.getElementById('bitacora-status').textContent = '';
    modal.classList.remove('hidden');
    loadNotes();
}

async function loadNotes() {
    const listEl = document.getElementById('bitacora-list');
    listEl.innerHTML = '<p class="text-gray-500">Cargando notas...</p>';
    try {
        const notas = await fetchAPI(`/gestion/notas/${currentGrupo.reservaIdOriginal}`);
        if (notas.length === 0) {
            listEl.innerHTML = '<p class="text-gray-500 text-center">No hay notas para esta reserva.</p>';
        } else {
            listEl.innerHTML = notas.map(nota => `
                <div class="bg-gray-50 p-3 rounded-md border">
                    <p class="text-gray-800 whitespace-pre-wrap">${nota.texto}</p>
                    <p class="text-xs text-gray-500 mt-1">Por: ${nota.autor} - ${nota.fecha}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        listEl.innerHTML = `<p class="text-red-500">Error al cargar las notas.</p>`;
    }
}

async function saveNote() {
    const noteInput = document.getElementById('bitacora-new-note');
    const statusEl = document.getElementById('bitacora-status');
    const saveBtn = document.getElementById('bitacora-save-btn');
    const texto = noteInput.value.trim();

    if (!texto) {
        statusEl.textContent = 'La nota no puede estar vacía.';
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
    statusEl.textContent = '';

    try {
        await fetchAPI('/gestion/notas', {
            method: 'POST',
            body: { reservaIdOriginal: currentGrupo.reservaIdOriginal, texto, autor: currentUserEmail }
        });
        noteInput.value = '';
        await onActionComplete();
        await loadNotes();
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Nota';
    }
}

function renderDocumentoModal(tipo) {
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
    
    let endpoint = '/gestion/actualizar-documento';
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