import { fetchAPI } from '../../../../api.js';
import { formatCurrency } from '../gestionDiaria.utils.js';
import { showPreview, handlePaste } from '../gestionDiaria.utils.js';

let currentGrupo = null;
let onActionComplete = () => {};
let allTransacciones = [];
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
        idsIndividuales: currentGrupo.reservasIndividuales.map(r => r.id),
        monto: parseFloat(form.querySelector('#monto-input').value),
        medioDePago: form.querySelector('#medio-pago-select').value,
        esPagoFinal: form.querySelector('#pago-final-checkbox').checked,
        sinDocumento: form.querySelector('#sin-documento-checkbox').checked
    };
    
    const docInput = form.querySelector('#documento-input');
    if (docInput && docInput.files.length > 0) {
        formData.append('documento', docInput.files[0]);
    }
    
    formData.append('detalles', JSON.stringify(detalles));

    try {
        await fetchAPI('/gestion/registrar-pago', { method: 'POST', body: formData });
        // --- INICIO DE CAMBIOS ---
        document.getElementById('gestion-modal').classList.add('hidden');
        await onActionComplete();
        // --- FIN DE CAMBIOS ---
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Pago';
    }
}

async function handleDeleteTransaction(transaccionId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este pago? Esta acción no se puede deshacer.')) return;
    try {
        await fetchAPI(`/gestion/transaccion/${transaccionId}`, { method: 'DELETE' });
        // --- INICIO DE CAMBIOS ---
        // Recargar el modal en lugar de toda la página para una mejor UX
        const updatedGrupos = await fetchAPI('/gestion/pendientes');
        const updatedGrupo = updatedGrupos.find(g => g.reservaIdOriginal === currentGrupo.reservaIdOriginal);
        if (updatedGrupo) {
            renderPagosModal(updatedGrupo, onActionComplete);
        } else {
             document.getElementById('gestion-modal').classList.add('hidden');
             await onActionComplete();
        }
        // --- FIN DE CAMBIOS ---
    } catch (error) {
        alert(`Error al eliminar el pago: ${error.message}`);
    }
}


function showActionForm() {
    currentAction = 'pagos';
    const container = document.getElementById('pagos-form-container');
    const saldoPendiente = currentGrupo.valorTotalHuesped - currentGrupo.abonoTotal;

    container.innerHTML = `
        <form id="modal-form-accion" class="border p-4 rounded-md">
            <h4 class="font-semibold text-lg mb-4">Registrar Nuevo Pago</h4>
            <div class="space-y-4">
                <div><label class="block text-sm">Monto (CLP)</label><input type="number" id="monto-input" required class="form-input" value="${Math.round(saldoPendiente)}"></div>
                <div><label class="block text-sm">Medio de Pago</label><select id="medio-pago-select" class="form-select"></select></div>
                <div class="flex items-center"><input id="pago-final-checkbox" type="checkbox" class="h-4 w-4 rounded"><label for="pago-final-checkbox" class="ml-2 text-sm">¿Es el pago final?</label></div>
            </div>
            <div class="mt-4">
                <label class="block text-sm">Comprobante (Opcional)</label>
                <input type="file" id="documento-input" class="hidden"/>
                <div id="paste-zone" class="mt-1 p-4 border-2 border-dashed rounded-md text-center cursor-pointer text-gray-500 hover:border-indigo-500 hover:text-indigo-500"><p>Selecciona o pega una imagen</p></div>
                <div id="preview-container" class="mt-2 hidden"><p class="text-sm">Vista Previa:</p><img id="thumbnail" class="w-24 h-24 object-cover rounded-md"></div>
                <div class="flex items-center mt-3"><input id="sin-documento-checkbox" type="checkbox" class="h-4 w-4"><label for="sin-documento-checkbox" class="ml-2 text-sm">Registrar sin documento</label></div>
            </div>
            <div id="modal-status" class="mt-2 text-sm text-red-600"></div>
            <div class="mt-5 flex justify-end space-x-2">
                <button type="button" id="form-cancel-btn" class="btn-secondary">Cancelar</button>
                <button type="submit" id="modal-save-btn" class="btn-primary">Guardar Pago</button>
            </div>
        </form>`;
    
    const mediosDePago = ['Transferencia', 'Efectivo', 'Tarjeta'];
    const select = container.querySelector('#medio-pago-select');
    mediosDePago.forEach(medio => select.add(new Option(medio, medio)));
    
    const form = container.querySelector('#modal-form-accion');
    form.addEventListener('submit', handleGroupFormSubmit);
    form.querySelector('#form-cancel-btn').addEventListener('click', () => {
        container.innerHTML = '';
        document.getElementById('btn-registrar-nuevo-pago').classList.remove('hidden');
    });

    const docInput = form.querySelector('#documento-input');
    const pasteZone = form.querySelector('#paste-zone');
    const previewContainer = form.querySelector('#preview-container');
    const thumbnail = form.querySelector('#thumbnail');
    
    pasteZone.addEventListener('click', () => docInput.click());
    docInput.addEventListener('change', () => { if(docInput.files.length) showPreview(docInput.files[0], thumbnail, previewContainer); });
    document.addEventListener('paste', e => handlePaste(e, docInput, thumbnail, previewContainer));

    if (document.getElementById('btn-registrar-nuevo-pago')) {
        document.getElementById('btn-registrar-nuevo-pago').classList.add('hidden');
    }
}

async function renderPagosList() {
    const listaPagosEl = document.getElementById('lista-pagos');
    const summaryEl = document.getElementById('pagos-summary');

    const ids = currentGrupo.reservasIndividuales.map(r => r.id);
    allTransacciones = await fetchAPI('/gestion/transacciones', { method: 'POST', body: { idsIndividuales: ids } });
    
    const totalAbonado = allTransacciones.reduce((sum, t) => sum + t.monto, 0);
    currentGrupo.abonoTotal = totalAbonado;
    const saldo = currentGrupo.valorTotalHuesped - totalAbonado;

    summaryEl.innerHTML = `
        <div><span class="text-gray-500 font-medium">Total Cliente:</span> ${formatCurrency(currentGrupo.valorTotalHuesped)}</div>
        <div class="text-green-600"><span class="text-gray-500 font-medium">Abonado:</span> ${formatCurrency(totalAbonado)}</div>
        <div class="text-red-600"><span class="text-gray-500 font-medium">Saldo:</span> ${formatCurrency(saldo)}</div>`;
    
    if (allTransacciones.length === 0) {
        listaPagosEl.innerHTML = '<p class="text-sm text-center text-gray-500 p-4">No hay pagos registrados.</p>';
        return;
    }
    
    listaPagosEl.innerHTML = allTransacciones.map(p => `
        <div class="p-2 border rounded-md flex justify-between items-center">
            <div>
                <p class="font-semibold">${formatCurrency(p.monto)} - <span class="font-normal text-gray-600">${p.tipo} (${p.medioDePago})</span></p>
                <p class="text-xs text-gray-500">Fecha: ${new Date(p.fecha).toLocaleString('es-CL')}</p>
            </div>
            <div>
                <button data-id="${p.id}" class="delete-pago-btn text-xs text-red-600 hover:text-red-900">Eliminar</button>
            </div>
        </div>`).join('');

    listaPagosEl.querySelectorAll('.delete-pago-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleDeleteTransaction(e.target.dataset.id));
    });
}

export function renderPagosModal(grupo, callback) {
    currentGrupo = grupo;
    onActionComplete = callback;
    const contentContainer = document.getElementById('modal-content-container');
    contentContainer.innerHTML = `
        <div id="pagos-summary" class="grid grid-cols-3 gap-4 font-semibold text-center w-full mb-4 p-2 bg-gray-50 rounded-md"></div>
        <div id="lista-pagos" class="space-y-2 max-h-48 overflow-y-auto pr-2 border-t border-b py-3">Cargando pagos...</div>
        <div id="pagos-form-container" class="pt-4 mt-4"></div>
        <div class="mt-4"><button id="btn-registrar-nuevo-pago" class="btn-primary w-full">Registrar Nuevo Pago</button></div>`;
    
    contentContainer.querySelector('#btn-registrar-nuevo-pago').addEventListener('click', showActionForm);
    
    renderPagosList();
}