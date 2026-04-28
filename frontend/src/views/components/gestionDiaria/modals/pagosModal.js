import { fetchAPI } from '../../../../api.js';
import { formatCurrency } from '../gestionDiaria.utils.js';
import { buildGarantiaOperacionReadonlyHtml } from '../../gestionarReservas/reservas.utils.js';
import { showPreview, handlePaste } from '../gestionDiaria.utils.js';

let currentGrupo = null;
let onActionComplete = () => {};
let allTransacciones = [];
let currentAction = null;
let mediosPagoCatalogo = [];
const OTA_COMPARATOR_LAST_CHANNEL_KEY = 'sm:otaComparator:lastCanalId';
const ESTADOS_GARANTIA = [
    { value: 'pendiente_garantia', label: 'Pendiente de garantía' },
    { value: 'garantia_validada', label: 'Garantía validada' },
    { value: 'garantia_rechazada', label: 'Garantía rechazada' },
];

const DEFAULT_MEDIOS = [
    { value: 'Transferencia', requiereComprobanteSugerido: true },
    { value: 'Efectivo', requiereComprobanteSugerido: false },
    { value: 'Tarjeta Débito (POS externo)', requiereComprobanteSugerido: true },
    { value: 'Tarjeta Crédito (POS externo)', requiereComprobanteSugerido: true },
];

async function ensureMediosPagoCatalogo() {
    if (mediosPagoCatalogo.length) return mediosPagoCatalogo;
    try {
        const resp = await fetchAPI('/gestion/medios-pago-manuales');
        if (Array.isArray(resp?.medios) && resp.medios.length) {
            mediosPagoCatalogo = resp.medios;
            return mediosPagoCatalogo;
        }
    } catch (_) {
        // fallback local
    }
    mediosPagoCatalogo = DEFAULT_MEDIOS;
    return mediosPagoCatalogo;
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
    const medioSeleccionado = form.querySelector('#medio-pago-select').value;
    const reqComp = mediosPagoCatalogo.find((x) => x.value === medioSeleccionado)?.requiereComprobanteSugerido;
    const docInput = form.querySelector('#documento-input');
    const hasDoc = !!(docInput && docInput.files.length > 0);
    const sinDocumento = form.querySelector('#sin-documento-checkbox').checked;
    if (reqComp && !hasDoc && !sinDocumento) {
        const proceed = confirm(
            'Para este medio de pago se recomienda adjuntar comprobante. ¿Deseas guardar de todas formas sin comprobante?'
        );
        if (!proceed) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar Pago';
            return;
        }
    }

    const detalles = {
        reservaIdOriginal: currentGrupo.reservaIdOriginal,
        idsIndividuales: currentGrupo.reservasIndividuales.map(r => r.id),
        monto: parseFloat(form.querySelector('#monto-input').value),
        medioDePago: medioSeleccionado,
        esPagoFinal: form.querySelector('#pago-final-checkbox').checked,
        sinDocumento,
        observacion: (form.querySelector('#observacion-pago-input')?.value || '').trim().slice(0, 200),
    };
    
    if (docInput && docInput.files.length > 0) {
        formData.append('documento', docInput.files[0]);
    }
    
    formData.append('detalles', JSON.stringify(detalles));

    try {
        await fetchAPI('/gestion/registrar-pago', { method: 'POST', body: formData });
        document.getElementById('gestion-modal').classList.add('hidden');
        await onActionComplete();
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
        document.getElementById('gestion-modal').classList.add('hidden');
        await onActionComplete();
    } catch (error) {
        alert(`Error al eliminar el pago: ${error.message}`);
    }
}

async function actualizarEstadoGarantiaOperacion() {
    const estadoSelect = document.getElementById('garantia-estado-select');
    const notaInput = document.getElementById('garantia-estado-nota');
    const btn = document.getElementById('garantia-estado-save-btn');
    const status = document.getElementById('garantia-estado-status');
    if (!estadoSelect || !btn || !status || !currentGrupo?.reservaIdOriginal) return;

    const estadoOperacion = estadoSelect.value;
    const nota = (notaInput?.value || '').trim().slice(0, 240);
    btn.disabled = true;
    status.textContent = 'Guardando estado...';

    try {
        const resp = await fetchAPI('/gestion/garantia-operacion-estado', {
            method: 'POST',
            body: {
                reservaIdOriginal: currentGrupo.reservaIdOriginal,
                estadoOperacion,
                nota,
            },
        });
        currentGrupo.garantiaOperacion = resp?.garantiaOperacion || {
            ...(currentGrupo.garantiaOperacion || {}),
            estadoOperacion,
            estadoOperacionNota: nota,
            estadoOperacionUpdatedAt: new Date().toISOString(),
        };

        const readonlyWrap = document.getElementById('garantia-estado-readonly');
        if (readonlyWrap) readonlyWrap.innerHTML = buildGarantiaOperacionReadonlyHtml(currentGrupo.garantiaOperacion);
        status.textContent = 'Estado de garantía actualizado.';
    } catch (error) {
        status.textContent = `Error: ${error.message}`;
    } finally {
        btn.disabled = false;
    }
}

function renderGarantiaEstadoForm(grupo) {
    if (!grupo?.garantiaOperacion) return '';
    const estadoActual = String(grupo.garantiaOperacion.estadoOperacion || 'pendiente_garantia');
    const opciones = ESTADOS_GARANTIA.map((x) => (
        `<option value="${x.value}" ${x.value === estadoActual ? 'selected' : ''}>${x.label}</option>`
    )).join('');
    return `
        <div class="mb-3 border border-gray-200 rounded-md p-3 bg-white">
            <p class="text-xs font-semibold text-gray-700 mb-2">Estado operativo de garantía</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div>
                    <label class="block text-xs text-gray-500 mb-1">Estado</label>
                    <select id="garantia-estado-select" class="form-select">${opciones}</select>
                </div>
                <div class="md:col-span-2">
                    <label class="block text-xs text-gray-500 mb-1">Nota de operación (opcional)</label>
                    <input id="garantia-estado-nota" type="text" class="form-input" maxlength="240" placeholder="Ej: comprobante validado por recepción.">
                </div>
            </div>
            <div class="mt-2 flex items-center justify-end gap-2">
                <span id="garantia-estado-status" class="text-xs text-gray-500"></span>
                <button id="garantia-estado-save-btn" type="button" class="btn-outline text-xs">Actualizar estado</button>
            </div>
        </div>
    `;
}

function renderComparadorOtaPanel(cmp) {
    if (!cmp || cmp.ok !== true) {
        return '<p class="text-xs text-gray-500">Comparador OTA no disponible para este grupo.</p>';
    }
    const directo = Number(cmp.totales?.directoCLP || 0);
    const comparado = Number(cmp.totales?.comparadoCLP || 0);
    const ahorro = Number(cmp.totales?.ahorroCLP || 0);
    const pct = Number(cmp.totales?.ahorroPctSobreComparado || 0);
    const canalComparado = cmp.canalComparado?.nombre || 'canal comparado';
    const comparableComplete = !!cmp.comparableComplete;
    const canalesComparables = Array.isArray(cmp.canalesComparables) ? cmp.canalesComparables : [];
    const badge = comparableComplete
        ? '<span class="text-xs font-semibold text-success-700">Completo</span>'
        : `<span class="text-xs font-semibold text-warning-700">Incompleto (${Number(cmp.nochesSinTarifaComparada || 0)} noche(s) sin tarifa)</span>`;
    const selectHtml = canalesComparables.length > 1
        ? `
            <div class="flex items-center gap-2">
                <label class="text-xs text-gray-600" for="gd-comparador-canal-select">Canal comparado:</label>
                <select id="gd-comparador-canal-select" class="form-select text-xs py-1 px-2">
                    ${canalesComparables.map((c) => `<option value="${c.id}" ${c.id === cmp.canalComparado?.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                </select>
            </div>`
        : '';
    let resumen = '';
    if (ahorro > 0) resumen = `Directo está ${formatCurrency(ahorro)} por debajo de ${canalComparado} (${pct}% aprox.).`;
    else if (ahorro === 0) resumen = `Directo y ${canalComparado} están al mismo total para estas fechas.`;
    else resumen = `${canalComparado} está ${formatCurrency(Math.abs(ahorro))} por debajo de directo.`;
    return `
        <div class="mb-3 border border-gray-200 rounded-md p-3 bg-white space-y-2">
            <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-semibold text-gray-700">Comparador OTA (referencial)</p>
                ${badge}
            </div>
            ${selectHtml}
            <p class="text-sm text-gray-700">${resumen}</p>
            <p class="text-xs text-gray-600">Directo: <strong>${formatCurrency(directo)}</strong> | ${canalComparado}: <strong>${formatCurrency(comparado)}</strong></p>
            <p class="text-xs text-gray-500">${cmp.disclaimer || 'Comparación referencial para decisión comercial; no modifica valores financieros de la reserva.'}</p>
            <div class="pt-2 border-t border-gray-200 space-y-2">
                <label class="block text-xs text-gray-600">Comentario operación (opcional)</label>
                <input id="gd-comparador-nota-input" type="text" class="form-input text-xs" maxlength="200" placeholder="Ej: se mantiene tarifa directa para cierre de hoy.">
                <div class="flex items-center justify-end gap-2">
                    <span id="gd-comparador-nota-status" class="text-xs text-gray-500"></span>
                    <button id="gd-comparador-guardar-nota-btn" type="button" class="btn-outline text-xs">Registrar decisión comercial</button>
                </div>
            </div>
        </div>
    `;
}

async function loadComparadorOtaPanel() {
    const wrap = document.getElementById('gd-comparador-ota-wrap');
    if (!wrap) return;
    const firstReservaId = currentGrupo?.reservasIndividuales?.[0]?.id;
    if (!firstReservaId) {
        wrap.innerHTML = '<p class="text-xs text-gray-500">Comparador OTA no disponible para este grupo.</p>';
        return;
    }
    const savedCanalId = String(sessionStorage.getItem(OTA_COMPARATOR_LAST_CHANNEL_KEY) || '').trim();
    let cmp = null;
    try {
        const qs = savedCanalId ? `?canalId=${encodeURIComponent(savedCanalId)}` : '';
        cmp = await fetchAPI(`/reservas/${firstReservaId}/comparador-ota${qs}`);
    } catch (_) {
        try {
            cmp = await fetchAPI(`/reservas/${firstReservaId}/comparador-ota`);
        } catch {
            cmp = null;
        }
    }
    wrap.innerHTML = renderComparadorOtaPanel(cmp);
    if (!cmp || cmp.ok !== true) return;

    const select = document.getElementById('gd-comparador-canal-select');
    if (select) {
        select.addEventListener('change', async () => {
            sessionStorage.setItem(OTA_COMPARATOR_LAST_CHANNEL_KEY, select.value);
            wrap.innerHTML = '<p class="text-xs text-gray-500">Recalculando comparador...</p>';
            try {
                const nextCmp = await fetchAPI(`/reservas/${firstReservaId}/comparador-ota?canalId=${encodeURIComponent(select.value)}`);
                wrap.innerHTML = renderComparadorOtaPanel(nextCmp);
                await loadComparadorOtaPanel();
            } catch (error) {
                wrap.innerHTML = `<p class="text-xs text-danger-500">Error cargando comparador: ${error.message}</p>`;
            }
        });
    }

    const saveBtn = document.getElementById('gd-comparador-guardar-nota-btn');
    const statusEl = document.getElementById('gd-comparador-nota-status');
    const notaInput = document.getElementById('gd-comparador-nota-input');
    if (saveBtn && statusEl) {
        saveBtn.addEventListener('click', async () => {
            const comentario = String(notaInput?.value || '').trim().slice(0, 200);
            const canalComparado = cmp.canalComparado?.nombre || 'canal comparado';
            const directo = Number(cmp.totales?.directoCLP || 0);
            const comparado = Number(cmp.totales?.comparadoCLP || 0);
            const ahorro = Number(cmp.totales?.ahorroCLP || 0);
            const pct = Number(cmp.totales?.ahorroPctSobreComparado || 0);
            const texto = `[Comparador OTA] Directo ${formatCurrency(directo)} vs ${canalComparado} ${formatCurrency(comparado)} | ahorro ${formatCurrency(ahorro)} (${pct}%) | ${cmp.comparableComplete ? 'completo' : `incompleto: ${Number(cmp.nochesSinTarifaComparada || 0)} noche(s) sin tarifa`}${comentario ? ` | comentario: ${comentario}` : ''}`;
            saveBtn.disabled = true;
            statusEl.textContent = 'Guardando en bitácora...';
            try {
                await fetchAPI('/gestion/notas', {
                    method: 'POST',
                    body: { reservaIdOriginal: currentGrupo.reservaIdOriginal, texto },
                });
                statusEl.textContent = 'Decisión registrada en bitácora.';
                if (notaInput) notaInput.value = '';
            } catch (error) {
                statusEl.textContent = `Error: ${error.message}`;
            } finally {
                saveBtn.disabled = false;
            }
        });
    }
}

async function showActionForm() {
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
                <div class="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2">
                    Registro manual: no se procesa cobro electrónico ni link de pago desde StayManager.
                    Solo se documenta el pago recibido por canal presencial/externo.
                </div>
            </div>
            <div class="mt-4">
                <label class="block text-sm">Observación (Opcional)</label>
                <input type="text" id="observacion-pago-input" class="form-input" maxlength="200" placeholder="Ej: POS externo terminal 2 / transferencia Banco X">
            </div>
            <div class="mt-4">
                <label class="block text-sm">Comprobante (Opcional)</label>
                <input type="file" id="documento-input" class="hidden"/>
                <div id="paste-zone" class="mt-1 p-4 border-2 border-dashed rounded-md text-center cursor-pointer text-gray-500 hover:border-primary-500 hover:text-primary-500"><p>Selecciona o pega una imagen</p></div>
                <div id="preview-container" class="mt-2 hidden"><p class="text-sm">Vista Previa:</p><img id="thumbnail" class="w-24 h-24 object-cover rounded-md"></div>
                <div class="flex items-center mt-3"><input id="sin-documento-checkbox" type="checkbox" class="h-4 w-4"><label for="sin-documento-checkbox" class="ml-2 text-sm">Registrar sin documento</label></div>
            </div>
            <div id="modal-status" class="mt-2 text-sm text-danger-600"></div>
            <div class="mt-5 flex justify-end space-x-2">
                <button type="button" id="form-cancel-btn" class="btn-secondary">Cancelar</button>
                <button type="submit" id="modal-save-btn" class="btn-primary">Guardar Pago</button>
            </div>
        </form>`;
    
    const mediosDePago = await ensureMediosPagoCatalogo();
    const select = container.querySelector('#medio-pago-select');
    mediosDePago.forEach((medio) => select.add(new Option(medio.value, medio.value)));
    const guidance = document.createElement('p');
    guidance.id = 'medio-pago-guidance';
    guidance.className = 'text-xs text-gray-500 mt-2';
    const updateGuidance = () => {
        const current = mediosPagoCatalogo.find((x) => x.value === select.value);
        guidance.textContent = current?.requiereComprobanteSugerido
            ? 'Sugerencia: adjunta comprobante para este medio de pago.'
            : 'Comprobante opcional para este medio de pago.';
    };
    select.parentElement.appendChild(guidance);
    select.addEventListener('change', updateGuidance);
    updateGuidance();
    
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

    try {
        const ids = currentGrupo.reservasIndividuales.map(r => r.id);
        allTransacciones = await fetchAPI('/gestion/transacciones', { method: 'POST', body: { idsIndividuales: ids } });
        
        const totalAbonado = allTransacciones.reduce((sum, t) => sum + t.monto, 0);
        currentGrupo.abonoTotal = totalAbonado;
        const saldo = currentGrupo.valorTotalHuesped - totalAbonado;

        summaryEl.innerHTML = `
            <div><span class="text-gray-500 font-medium">Total Cliente:</span> ${formatCurrency(currentGrupo.valorTotalHuesped)}</div>
            <div class="text-success-600"><span class="text-gray-500 font-medium">Abonado:</span> ${formatCurrency(totalAbonado)}</div>
            <div class="text-danger-600"><span class="text-gray-500 font-medium">Saldo:</span> ${formatCurrency(saldo)}</div>`;
        
        if (allTransacciones.length === 0) {
            listaPagosEl.innerHTML = '<p class="text-sm text-center text-gray-500 p-4">No hay pagos registrados.</p>';
            return;
        }
        
        listaPagosEl.innerHTML = allTransacciones.map(p => `
            <div class="p-2 border rounded-md flex justify-between items-center text-sm">
                <div>
                    <p class="font-semibold">${formatCurrency(p.monto)} - <span class="font-normal text-gray-600">${p.tipo} (${p.medioDePago})</span></p>
                    ${p.observacion ? `<p class="text-xs text-gray-500">Obs: ${p.observacion}</p>` : ''}
                    <p class="text-xs text-gray-500">Fecha: ${new Date(p.fecha).toLocaleString('es-CL')}</p>
                </div>
                <div class="flex items-center space-x-4">
                    ${p.enlaceComprobante && p.enlaceComprobante !== 'SIN_DOCUMENTO' ? `<a href="${p.enlaceComprobante}" target="_blank" class="text-xs text-primary-600 hover:underline">Ver Comp.</a>` : '<span class="text-xs text-gray-400">Sin Comp.</span>'}
                    <button data-id="${p.id}" class="delete-pago-btn text-xs text-danger-600 hover:text-danger-900">Eliminar</button>
                </div>
            </div>`).join('');

        listaPagosEl.querySelectorAll('.delete-pago-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleDeleteTransaction(e.target.dataset.id));
        });
    } catch (error) {
        listaPagosEl.innerHTML = `<p class="text-danger-500 text-center p-4">Error al cargar los pagos: ${error.message}</p>`;
    }
}

export function renderPagosModal(grupo, callback) {
    currentGrupo = grupo;
    onActionComplete = callback;
    const contentContainer = document.getElementById('modal-content-container');
    const bloqueGarantia = buildGarantiaOperacionReadonlyHtml(grupo.garantiaOperacion);
    contentContainer.innerHTML = `
        <div class="mb-3 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2">
            Operación vigente: StayManager solo registra pagos ya recibidos (sin pasarela integrada, sin links de cobro).
        </div>
        ${bloqueGarantia ? `<div id="garantia-estado-readonly" class="mb-3">${bloqueGarantia}</div>` : ''}
        ${renderGarantiaEstadoForm(grupo)}
        <div id="gd-comparador-ota-wrap" class="mb-3 border border-gray-200 rounded-md p-3 bg-white">
            <p class="text-xs text-gray-500">Cargando comparador OTA...</p>
        </div>
        <div id="pagos-summary" class="grid grid-cols-3 gap-4 font-semibold text-center w-full mb-4 p-2 bg-gray-50 rounded-md"></div>
        <div id="lista-pagos" class="space-y-2 max-h-48 overflow-y-auto pr-2 border-t border-b py-3">Cargando pagos...</div>
        <div id="pagos-form-container" class="pt-4 mt-4"></div>
        <div class="mt-4"><button id="btn-registrar-nuevo-pago" class="btn-primary w-full">Registrar Nuevo Pago</button></div>`;

    const btnGarantia = contentContainer.querySelector('#garantia-estado-save-btn');
    if (btnGarantia) btnGarantia.addEventListener('click', actualizarEstadoGarantiaOperacion);
    
    contentContainer.querySelector('#btn-registrar-nuevo-pago').addEventListener('click', () => {
        showActionForm();
    });
    
    loadComparadorOtaPanel();
    renderPagosList();
}