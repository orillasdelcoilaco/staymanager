// frontend/src/views/components/gestionDiaria/gestionDiaria.modals.js
import { fetchAPI } from '../../../api.js';
import { getStatusInfo } from './gestionDiaria.utils.js';
import { getEstadosGestion } from '../estadosStore.js';
import { renderAjusteTarifaModal } from './modals/ajusteTarifaModal.js';
import { renderPagosModal } from './modals/pagosModal.js';
import { renderDocumentoModal } from './modals/documentoModal.js';
import { renderMensajeModal } from './modals/mensajeModal.js';
import { handleNavigation } from '../../../router.js';
// Importamos el modal unificado de clientes
import { abrirModalCliente } from '../gestionarClientes/clientes.modals.js';

let currentGrupo = null;
let currentAllEstados = [];
let currentUserEmail = '';
let onActionComplete = () => {};
let currentNotas = [];

function getNotaTipo(texto) {
    const t = String(texto || '');
    if (t.includes('[Comparador OTA]')) return 'comparador';
    if (t.includes('[Garantía]') || t.includes('[Garantia]')) return 'garantia';
    if (/\b(pago|abono|transacci[oó]n)\b/i.test(t)) return 'pagos';
    return 'manual';
}

function renderNotasFiltradas() {
    const listEl = document.getElementById('bitacora-list');
    const filterEl = document.getElementById('bitacora-filter-select');
    const chipsWrap = document.getElementById('bitacora-stats-chips');
    if (!listEl) return;
    const counts = currentNotas.reduce((acc, n) => {
        const k = getNotaTipo(n.texto);
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, { comparador: 0, garantia: 0, pagos: 0, manual: 0 });
    const total = currentNotas.length;
    const filtro = String(filterEl?.value || 'all');
    if (chipsWrap) {
        const chip = (tipo, label, n) => `
            <button
                type="button"
                data-chip-tipo="${tipo}"
                class="${filtro === tipo ? 'btn-primary' : 'btn-outline'} text-xs py-1 px-2"
            >
                ${label} (${n})
            </button>`;
        chipsWrap.innerHTML = `${chip('all', 'Todo', total)} ${chip('comparador', 'Comparador', counts.comparador || 0)} ${chip('garantia', 'Garantía', counts.garantia || 0)} ${chip('pagos', 'Pagos', counts.pagos || 0)} ${chip('manual', 'Manual', counts.manual || 0)}`;
        chipsWrap.querySelectorAll('[data-chip-tipo]').forEach((btn) => {
            btn.onclick = () => {
                if (filterEl) filterEl.value = btn.dataset.chipTipo;
                renderNotasFiltradas();
            };
        });
    }
    const notas = filtro === 'all'
        ? currentNotas
        : currentNotas.filter((n) => getNotaTipo(n.texto) === filtro);
    if (notas.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500 text-center">No hay notas para este filtro.</p>';
        return;
    }
    listEl.innerHTML = notas.map((nota) => `
        <div class="bg-gray-50 p-3 rounded-md border">
            <p class="text-gray-800 whitespace-pre-wrap">${nota.texto}</p>
            <p class="text-xs text-gray-500 mt-1">Por: ${nota.autor} - ${nota.fecha}</p>
        </div>
    `).join('');
}

export function initializeModals(callback, userEmail) {
    onActionComplete = callback;
    currentUserEmail = userEmail;

    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => document.getElementById('gestion-modal').classList.add('hidden'));
    document.getElementById('bitacora-cancel-btn')?.addEventListener('click', () => document.getElementById('bitacora-modal').classList.add('hidden'));
    document.getElementById('bitacora-save-btn')?.addEventListener('click', saveNote);
    document.getElementById('image-viewer-close')?.addEventListener('click', () => document.getElementById('image-viewer-modal').classList.add('hidden'));
}

// Función auxiliar para cargar cliente y abrir modal
async function abrirEdicionCliente(clienteId) {
    try {
        // Cerramos el modal de gestión si está abierto para evitar superposiciones
        document.getElementById('gestion-modal').classList.add('hidden');
        
        const cliente = await fetchAPI(`/clientes/${clienteId}`);
        abrirModalCliente(cliente);
    } catch (error) {
        alert('Error al cargar datos del cliente: ' + error.message);
    }
}

export function openManagementModal(type, grupo, allEstados = []) {
    currentGrupo = grupo;
    currentAllEstados = allEstados;
    const modal = document.getElementById('gestion-modal');
    document.getElementById('modal-title').textContent = `${type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')} (Reserva ${currentGrupo.reservaIdOriginal})`;

    const actionMap = {
        'enviar_bienvenida': () => renderMensajeModal(grupo, 'bienvenida', onActionComplete, allEstados),
        'enviar_cobro': () => renderMensajeModal(grupo, 'cobro', onActionComplete, allEstados),
        'enviar_salida': () => renderMensajeModal(grupo, 'salida', onActionComplete, allEstados),
        'bitacora': () => openBitacoraModal(grupo),
        'ajuste_tarifa': () => renderAjusteTarifaModal(grupo, onActionComplete),
        'pagos': () => renderPagosModal(grupo, onActionComplete),
        'boleta': () => renderDocumentoModal('boleta', grupo, onActionComplete),
        'gestionar_reserva': () => renderDocumentoModal('reserva', grupo, onActionComplete),
        
        'gestionar_cliente': () => {
            abrirEdicionCliente(grupo.clienteId);
            fetchAPI('/gestion/marcar-cliente-gestionado', {
                method: 'POST',
                body: { reservaIdOriginal: grupo.reservaIdOriginal }
            }).catch(e => console.warn('marcar-cliente-gestionado:', e.message));
            return false;
        },
        
        'corregir_estado': () => {
            handleNavigation(`/gestionar-reservas?reservaId=${grupo.reservasIndividuales[0].id}`);
            return false;
        },
    };

    const shouldOpenModal = actionMap[type] ? actionMap[type]() : true;
    
    if (type !== 'bitacora' && shouldOpenModal !== false) {
        modal.classList.remove('hidden');
    }
}

export function openRevertModal(grupo, allEstados = []) {
    currentGrupo = grupo;
    currentAllEstados = allEstados;
    const modal = document.getElementById('gestion-modal');
    const contentContainer = document.getElementById('modal-content-container');
    document.getElementById('modal-title').textContent = `Revertir Estado (Reserva ${grupo.reservaIdOriginal})`;

    const estadoActualInfo = getStatusInfo(grupo.estadoGestion, allEstados);
    const estadosGestion = getEstadosGestion(allEstados);
    // Si hay estados dinámicos configurados, filtrar por level; si no, usar nombres legacy
    const candidatos = estadosGestion.length > 0
        ? estadosGestion.filter(e => getStatusInfo(e.nombre, allEstados).level < estadoActualInfo.level)
            .map(e => ({ value: e.nombre, text: e.nombre }))
        : ['Pendiente Bienvenida','Pendiente Cobro','Pendiente Pago','Pendiente Boleta','Pendiente Cliente']
            .filter(n => getStatusInfo(n, allEstados).level < estadoActualInfo.level)
            .map(n => ({ value: n, text: n }));
    const opcionesHtml = candidatos.map(c => `<option value="${c.value}">${c.text}</option>`).join('');

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

export function openBitacoraModal(grupo) {
    currentGrupo = grupo;
    const modal = document.getElementById('bitacora-modal');
    document.getElementById('bitacora-modal-title').textContent = `Bitácora de Gestión (Reserva ${grupo.reservaIdOriginal})`;
    document.getElementById('bitacora-new-note').value = '';
    document.getElementById('bitacora-status').textContent = '';
    const filterEl = document.getElementById('bitacora-filter-select');
    if (filterEl) {
        filterEl.value = 'all';
        filterEl.onchange = () => renderNotasFiltradas();
    }
    modal.classList.remove('hidden');
    loadNotes();
}

async function loadNotes() {
    const listEl = document.getElementById('bitacora-list');
    listEl.innerHTML = '<p class="text-gray-500">Cargando notas...</p>';
    try {
        const notas = await fetchAPI(`/gestion/notas/${currentGrupo.reservaIdOriginal}`);
        currentNotas = Array.isArray(notas) ? notas : [];
        if (currentNotas.length === 0) {
            listEl.innerHTML = '<p class="text-gray-500 text-center">No hay notas para esta reserva.</p>';
        } else {
            renderNotasFiltradas();
        }
    } catch (error) {
        listEl.innerHTML = `<p class="text-danger-500">Error al cargar las notas.</p>`;
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