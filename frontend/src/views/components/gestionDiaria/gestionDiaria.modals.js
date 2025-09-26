import { fetchAPI } from '../../../api.js';
import { getStatusInfo, formatCurrency, showPreview, handlePaste, openImageViewer } from './gestionDiaria.utils.js';
import { renderAjusteTarifaModal } from './modals/ajusteTarifaModal.js';
import { renderPagosModal } from './modals/pagosModal.js';
import { renderDocumentoModal } from './modals/documentoModal.js';

let currentGrupo = null;
let currentUserEmail = '';
let onActionComplete = () => {};

export function initializeModals(callback, userEmail) {
    onActionComplete = callback;
    currentUserEmail = userEmail;

    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => document.getElementById('gestion-modal').classList.add('hidden'));
    document.getElementById('bitacora-cancel-btn')?.addEventListener('click', () => document.getElementById('bitacora-modal').classList.add('hidden'));
    document.getElementById('bitacora-save-btn')?.addEventListener('click', saveNote);
    document.getElementById('image-viewer-close')?.addEventListener('click', () => document.getElementById('image-viewer-modal').classList.add('hidden'));
}

export function openManagementModal(type, grupo) {
    currentGrupo = grupo;
    const modal = document.getElementById('gestion-modal');
    document.getElementById('modal-title').textContent = `${type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')} (Reserva ${currentGrupo.reservaIdOriginal})`;

    const actionMap = {
        'bitacora': () => openBitacoraModal(grupo),
        'ajuste_tarifa': () => renderAjusteTarifaModal(grupo, onActionComplete),
        'pagos': () => renderPagosModal(grupo, onActionComplete),
        'boleta': () => renderDocumentoModal('boleta', grupo, onActionComplete),
        'gestionar_reserva': () => renderDocumentoModal('reserva', grupo, onActionComplete),
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

// --- INICIO DE LA CORRECCIÓN ---
export function openBitacoraModal(grupo) {
// --- FIN DE LA CORRECCIÓN ---
    currentGrupo = grupo;
    const modal = document.getElementById('bitacora-modal');
    document.getElementById('bitacora-modal-title').textContent = `Bitácora de Gestión (Reserva ${grupo.reservaIdOriginal})`;
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