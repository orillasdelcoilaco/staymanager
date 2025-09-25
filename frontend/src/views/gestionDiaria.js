import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let allGrupos = [];
let currentUserEmail = '';
let currentGrupo = null;
let currentAction = null;
let allTransacciones = [];

function formatCurrency(value) { return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`; }
function formatDate(dateString) { return dateString ? new Date(dateString).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'N/A'; }

function getStatusInfo(status) {
    switch (status) {
        case 'Pendiente Bienvenida': return { level: 1, text: 'PENDIENTE BIENVENIDA', color: 'bg-yellow-500' };
        case 'Pendiente Cobro': return { level: 2, text: 'PENDIENTE COBRO', color: 'bg-orange-500' };
        case 'Pendiente Pago': return { level: 3, text: 'PENDIENTE PAGO', color: 'bg-red-600' };
        case 'Pendiente Boleta': return { level: 4, text: 'PENDIENTE BOLETA', color: 'bg-purple-600' };
        default: return { level: 99, text: status ? status.toUpperCase() : 'DESCONOCIDO', color: 'bg-gray-400' };
    }
}

function createGrupoCard(grupo) {
    const card = document.createElement('div');
    card.id = `card-${grupo.reservaIdOriginal}`;
    card.className = 'p-4 border rounded-lg shadow-sm flex flex-col';
    const statusInfo = getStatusInfo(grupo.estadoGestion);
    const saldo = grupo.valorTotalCLP - grupo.abonoTotal;
    const alojamientos = grupo.reservasIndividuales.map(r => r.alojamientoNombre).join(', ');

    const isGestionPagosActive = statusInfo.level >= 2;
    const isGestionBoletaActive = statusInfo.level >= 4;

    const clienteLink = `<a href="/cliente/${grupo.clienteId}" data-path="/cliente/${grupo.clienteId}" class="nav-link-style ml-4 text-lg font-bold text-gray-800 hover:text-indigo-600" title="Abrir ficha del cliente">${grupo.clienteNombre}</a>`;
    const revertButtonHtml = statusInfo.level > 1 ? `<button data-id="${grupo.reservaIdOriginal}" class="revert-btn ml-2 text-xl" title="Revertir estado">↩️</button>` : '';
    const badgeHtml = grupo.notasCount > 0 ? `<span class="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">${grupo.notasCount}</span>` : '';

    let accionParaMarcar = null;
    if (grupo.estadoGestion === 'Pendiente Bienvenida') accionParaMarcar = 'marcar_bienvenida_enviada';
    else if (grupo.estadoGestion === 'Pendiente Cobro') accionParaMarcar = 'marcar_cobro_enviado';

    let statusHtml;
    if (accionParaMarcar) {
        const url = `/cliente/${grupo.clienteId}/mensaje/${grupo.reservasIndividuales[0].id}`;
        statusHtml = `<a href="${url}" data-path="${url}" class="nav-link-style text-sm font-bold text-white px-2 py-1 rounded ${statusInfo.color} hover:opacity-80">${statusInfo.text}</a>`;
    } else {
        statusHtml = `<span class="text-sm font-bold text-white px-2 py-1 rounded ${statusInfo.color}">${statusInfo.text}</span>`;
    }

    // --- INICIO DE LA CORRECCIÓN DE ESTILO ---
    const baseButtonClasses = "px-3 py-1 text-xs font-semibold rounded-md transition-colors";
    const activeButtonClasses = "bg-gray-100 text-gray-800 hover:bg-gray-200";
    const disabledButtonClasses = "bg-gray-100 text-gray-400 cursor-not-allowed";
    // --- FIN DE LA CORRECCIÓN DE ESTILO ---

    card.innerHTML = `
        <div class="flex items-center mb-2">
            ${statusHtml}
            ${revertButtonHtml}
            ${clienteLink}
        </div>
        <div class="text-sm text-gray-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>Teléfono:</strong> ${grupo.telefono || 'N/A'}</span>
            <span><strong>ID Reserva:</strong> ${grupo.reservaIdOriginal}</span>
            <span><strong>Estancia:</strong> ${formatDate(grupo.fechaLlegada)} al ${formatDate(grupo.fechaSalida)}</span>
            <span><strong>Alojamientos (${grupo.reservasIndividuales.length}):</strong> ${alojamientos}</span>
        </div>
        <div class="border-t mt-4 pt-3 flex flex-col md:flex-row justify-between items-center text-sm">
             <div class="grid grid-cols-3 gap-4 font-semibold text-center w-full md:w-2/3">
                <div><span class="text-gray-500 font-medium">Total:</span> ${formatCurrency(grupo.valorTotalCLP)}</div>
                <div class="text-green-600"><span class="text-gray-500 font-medium">Abonado:</span> ${formatCurrency(grupo.abonoTotal)}</div>
                <div class="text-red-600"><span class="text-gray-500 font-medium">Saldo:</span> ${formatCurrency(saldo)}</div>
            </div>
            <div class="mt-3 md:mt-0 flex flex-wrap gap-2 justify-center">
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="gestionar_reserva" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Gestionar Reserva</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="ajuste_tarifa" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Ajustar Tarifa</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="pagos" class="gestion-btn ${baseButtonClasses} ${isGestionPagosActive ? activeButtonClasses : disabledButtonClasses}" ${!isGestionPagosActive ? 'disabled' : ''}>Gestionar Pagos</button>
                <button data-id="${grupo.reservaIdOriginal}" data-gestion="boleta" class="gestion-btn ${baseButtonClasses} ${isGestionBoletaActive ? activeButtonClasses : disabledButtonClasses}" ${!isGestionBoletaActive ? 'disabled' : ''}>Gestionar Boleta</button>
                <div class="relative">
                    <button data-id="${grupo.reservaIdOriginal}" data-gestion="bitacora" class="gestion-btn ${baseButtonClasses} ${activeButtonClasses}">Bitácora 🗂️</button>
                    ${badgeHtml}
                </div>
            </div>
        </div>`;
    
    card.querySelectorAll('.nav-link-style').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleNavigation(e.currentTarget.dataset.path);
        });
    });

    return card;
}

function renderGrupos(grupos) {
    const hoyList = document.getElementById('hoy-list');
    const proximasList = document.getElementById('proximas-list');
    const noPendientes = document.getElementById('no-pendientes');
    const hoyContainer = document.getElementById('hoy-container');
    const proximasContainer = document.getElementById('proximas-container');
    
    hoyList.innerHTML = '';
    proximasList.innerHTML = '';

    if (grupos.length === 0) {
        noPendientes.classList.remove('hidden');
        hoyContainer.classList.add('hidden');
        proximasContainer.classList.add('hidden');
        return;
    }
    
    noPendientes.classList.add('hidden');
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const llegadasHoy = grupos.filter(g => new Date(g.fechaLlegada).getTime() <= today.getTime());
    const proximasLlegadas = grupos.filter(g => new Date(g.fechaLlegada).getTime() > today.getTime());

    if (llegadasHoy.length > 0) {
        llegadasHoy.forEach(g => hoyList.appendChild(createGrupoCard(g)));
        hoyContainer.classList.remove('hidden');
    } else {
        hoyContainer.classList.add('hidden');
    }

    if (proximasLlegadas.length > 0) {
        proximasLlegadas.forEach(g => proximasList.appendChild(createGrupoCard(g)));
        proximasContainer.classList.remove('hidden');
    } else {
        proximasContainer.classList.add('hidden');
    }
}

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <h2 class="text-2xl font-semibold text-gray-900">Panel de Gestión Diaria</h2>
                <input type="text" id="search-input" placeholder="Buscar por nombre, reserva, teléfono..." class="mt-4 md:mt-0 form-input md:w-1/3">
            </div>
            <div id="loading-state" class="text-center py-8"><p class="text-gray-500">Cargando tareas pendientes...</p></div>
            <div id="hoy-container" class="hidden"><h3 class="text-xl font-bold text-red-600 mb-4 border-b pb-2">Requiere Acción Inmediata (Llegadas de hoy o pasadas)</h3><div id="hoy-list" class="space-y-4"></div></div>
            <div id="proximas-container" class="mt-8 hidden"><h3 class="text-xl font-semibold text-blue-600 mb-4 border-b pb-2">Próximas Llegadas</h3><div id="proximas-list" class="space-y-4"></div></div>
            <div id="no-pendientes" class="text-center py-12 hidden"><p class="text-2xl font-semibold text-green-600">¡Todo al día!</p><p class="text-gray-500 mt-2">No hay reservas con gestiones pendientes.</p></div>
        </div>
        
        <div id="gestion-modal" class="modal hidden">
            <div class="modal-content !max-w-3xl">
                <h3 id="modal-title" class="text-xl font-semibold mb-4"></h3>
                <div id="modal-content-container" class="space-y-4 max-h-[70vh] overflow-y-auto pr-4"></div>
                <button type="button" id="modal-cancel-btn" class="btn-secondary w-full mt-4">Cerrar</button>
            </div>
        </div>

        <div id="bitacora-modal" class="modal hidden">
            <div class="modal-content !max-w-2xl">
                <h3 id="bitacora-modal-title" class="text-xl font-semibold mb-4">Bitácora de Gestión</h3>
                <div id="bitacora-list" class="max-h-60 overflow-y-auto space-y-3 mb-4 pr-2"></div>
                <div class="border-t pt-4">
                    <textarea id="bitacora-new-note" rows="3" class="form-input" placeholder="Añadir nueva nota..."></textarea>
                    <div id="bitacora-status" class="text-sm mt-2"></div>
                    <div class="mt-2 flex justify-end space-x-3">
                        <button type="button" id="bitacora-cancel-btn" class="btn-secondary">Cerrar</button>
                        <button type="button" id="bitacora-save-btn" class="btn-primary">Guardar Nota</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadAndRender() {
    const loadingState = document.getElementById('loading-state');
    try {
        const user = await fetchAPI('/auth/me');
        currentUserEmail = user.email;
        allGrupos = await fetchAPI('/gestion/pendientes');
        loadingState.classList.add('hidden');
        renderGrupos(allGrupos);
    } catch(error) {
        loadingState.innerHTML = `<p class="text-red-500">Error al cargar las gestiones: ${error.message}</p>`;
    }
}

export async function afterRender() {
    await loadAndRender();

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        const filtro = searchInput.value.toLowerCase();
        const gruposFiltrados = allGrupos.filter(g => 
            g.clienteNombre.toLowerCase().includes(filtro) ||
            g.reservaIdOriginal.toLowerCase().includes(filtro) ||
            (g.telefono && g.telefono.includes(filtro))
        );
        renderGrupos(gruposFiltrados);
    });

    document.getElementById('hoy-list').addEventListener('click', handleCardButtonClick);
    document.getElementById('proximas-list').addEventListener('click', handleCardButtonClick);
    document.getElementById('modal-cancel-btn').addEventListener('click', () => document.getElementById('gestion-modal').classList.add('hidden'));
    document.getElementById('bitacora-cancel-btn').addEventListener('click', () => document.getElementById('bitacora-modal').classList.add('hidden'));
    document.getElementById('bitacora-save-btn').addEventListener('click', saveNote);
}

function handleCardButtonClick(e) {
    const target = e.target;
    const card = target.closest('.p-4.border');
    if (!card) return;

    const reservaIdOriginal = card.id.replace('card-', '');
    currentGrupo = allGrupos.find(g => g.reservaIdOriginal === reservaIdOriginal);
    if (!currentGrupo) return;
    
    if (target.classList.contains('gestion-btn')) {
        openManagementModal(target.dataset.gestion);
    }
    
    if (target.classList.contains('revert-btn')) {
        openRevertModal();
    }
}

function openManagementModal(type) {
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
        if(type !== 'bitacora') modal.classList.remove('hidden');
    }
}

function openBitacoraModal() {
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
        currentGrupo.notasCount++;
        renderGrupos(allGrupos);
        await loadNotes();
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Nota';
    }
}

function openRevertModal() {
    const modal = document.getElementById('gestion-modal');
    const contentContainer = document.getElementById('modal-content-container');
    document.getElementById('modal-title').textContent = `Revertir Estado (Reserva ${currentGrupo.reservaIdOriginal})`;

    const estadosPosibles = [
        { value: 'Pendiente Bienvenida', text: 'Pendiente Bienvenida' },
        { value: 'Pendiente Cobro', text: 'Pendiente Cobro' },
        { value: 'Pendiente Pago', text: 'Pendiente Pago' },
        { value: 'Pendiente Boleta', text: 'Pendiente Boleta' }
    ];
    const estadoActualInfo = getStatusInfo(currentGrupo.estadoGestion);
    const opcionesHtml = estadosPosibles
        .filter(estado => getStatusInfo(estado.value).level < estadoActualInfo.level)
        .map(estado => `<option value="${estado.value}">${estado.text}</option>`)
        .join('');

    contentContainer.innerHTML = `
        <p>Estado Actual: <strong class="font-semibold">${currentGrupo.estadoGestion}</strong></p>
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
        await loadAndRender();
    } catch (error) {
        document.getElementById('revert-status').textContent = `Error: ${error.message}`;
    }
}

// A partir de aquí, las funciones para los modales restantes...
function renderAjusteTarifaModal() {
    const contentContainer = document.getElementById('modal-content-container');
    const valorActualTotal = currentGrupo.valorTotalCLP;

    contentContainer.innerHTML = `
        <div class="border-b border-gray-200">
            <nav id="modal-tabs" class="-mb-px flex space-x-6" aria-label="Tabs">
                <button data-tab="kpi" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-indigo-500 text-indigo-600">Calcular Potencial (KPI)</button>
                <button data-tab="ajuste" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Ajustar Cobro</button>
                ${currentGrupo.reservasIndividuales.length > 1 ? `<button data-tab="distribuir" class="modal-tab whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">Distribuir Valores</button>` : ''}
            </nav>
        </div>
        <div id="modal-tab-content" class="mt-5"></div>
    `;

    const tabs = contentContainer.querySelectorAll('.modal-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('border-indigo-500', 'text-indigo-600'));
            tab.classList.add('border-indigo-500', 'text-indigo-600');
            renderTabContent(tab.dataset.tab);
        });
    });

    renderTabContent('kpi'); // Renderiza la primera pestaña por defecto
}

function renderTabContent(tabName) {
    const contentContainer = document.getElementById('modal-tab-content');
    const valorActualTotal = currentGrupo.valorTotalCLP;

    switch(tabName) {
        case 'kpi':
            const potencialGuardadoHtml = currentGrupo.potencialCalculado 
                ? `<div class="p-3 bg-blue-50 border border-blue-200 rounded-md"><p class="text-sm font-semibold text-blue-800">Valor Potencial Guardado: ${formatCurrency(currentGrupo.potencialTotal)}</p></div>` 
                : '';
            contentContainer.innerHTML = `
                <p class="text-sm text-gray-600 mb-3">Calcula el precio de lista (potencial) basado en el valor de cobro actual y un descuento. <strong>Esto no altera el valor a cobrar al cliente.</strong></p>
                ${potencialGuardadoHtml}
                <div class="space-y-4 mt-4">
                    <div>
                        <label for="descuento-pct" class="block text-sm font-medium text-gray-700">Porcentaje de Descuento (%)</label>
                        <input type="number" id="descuento-pct" placeholder="Ej: 15" class="form-input">
                    </div>
                    <div>
                        <p class="text-sm">Valor de Cobro Actual: <span class="font-semibold">${formatCurrency(valorActualTotal)}</span></p>
                        <p class="text-sm">Valor Potencial Calculado: <span id="valor-potencial-preview" class="font-semibold text-blue-600"></span></p>
                    </div>
                    <div id="kpi-status" class="text-sm"></div>
                    <div class="text-right"><button id="kpi-save-btn" class="btn-primary">Calcular y Guardar Potencial</button></div>
                </div>`;
            
            const descuentoInput = contentContainer.querySelector('#descuento-pct');
            descuentoInput.addEventListener('input', () => {
                const pct = parseFloat(descuentoInput.value);
                const previewEl = contentContainer.querySelector('#valor-potencial-preview');
                if (pct > 0 && pct < 100) {
                    const potencial = Math.round(valorActualTotal / (1 - (pct / 100)));
                    previewEl.textContent = formatCurrency(potencial);
                } else {
                    previewEl.textContent = '';
                }
            });
            contentContainer.querySelector('#kpi-save-btn').addEventListener('click', handleSaveKpi);
            break;

        case 'ajuste':
            contentContainer.innerHTML = `
                <p class="text-sm text-gray-600 mb-3">Modifica el monto final que se cobrará al cliente. El nuevo valor se distribuirá proporcionalmente entre las cabañas. <strong>Esta acción es permanente.</strong></p>
                <div class="space-y-4">
                     <div>
                        <label for="nuevo-valor-final" class="block text-sm font-medium text-gray-700">Nuevo Valor Final a Cobrar (CLP)</label>
                        <input type="number" id="nuevo-valor-final" class="form-input" value="${Math.round(valorActualTotal)}">
                    </div>
                     <p class="text-sm">Valor Original: <span class="font-semibold">${formatCurrency(valorActualTotal)}</span></p>
                     <div id="ajuste-status" class="text-sm"></div>
                     <div class="text-right"><button id="ajuste-save-btn" class="btn-danger">Ajustar Monto Final</button></div>
                </div>`;
            contentContainer.querySelector('#ajuste-save-btn').addEventListener('click', handleSaveAjusteFinal);
            break;

        case 'distribuir':
            renderAjusteGrupo();
            break;
    }
}

function renderAjusteGrupo() {
    const contentContainer = document.getElementById('modal-tab-content');
    let cabanasHtml = currentGrupo.reservasIndividuales.map(res => `
        <div class="grid grid-cols-2 gap-4 items-center">
            <label for="valor-${res.id}" class="text-sm font-medium">${res.alojamientoNombre}</label>
            <input type="number" id="valor-${res.id}" data-id="${res.id}" class="valor-input form-input" value="${Math.round(res.valorCLP)}">
        </div>`).join('');
    contentContainer.innerHTML = `
        <div class="space-y-4">
            <p class="text-sm text-gray-600">Corrige la distribución del valor total entre las cabañas del grupo.</p>
            <div class="space-y-2">${cabanasHtml}</div>
            <div class="border-t pt-3 flex justify-between items-center font-bold"><span>TOTAL:</span><span id="ajuste-valores-total"></span></div>
            <div id="ajuste-valores-status" class="text-sm"></div>
            <div class="text-right"><button id="ajuste-valores-save-btn" class="btn-primary">Guardar Distribución</button></div>
        </div>`;
    contentContainer.querySelectorAll('.valor-input').forEach(input => input.addEventListener('input', updateValoresTotal));
    contentContainer.querySelector('#ajuste-valores-save-btn').addEventListener('click', handleSaveAjusteGrupo);
    updateValoresTotal();
}

function updateValoresTotal() {
    let total = 0;
    document.querySelectorAll('.valor-input').forEach(input => { total += parseFloat(input.value) || 0; });
    document.getElementById('ajuste-valores-total').textContent = formatCurrency(total);
}

async function renderPagosModal() {
    const contentContainer = document.getElementById('modal-content-container');
    contentContainer.innerHTML = `
        <div id="pagos-summary" class="grid grid-cols-3 gap-4 font-semibold text-center w-full mb-4 p-2 bg-gray-50 rounded-md"></div>
        <div id="lista-pagos" class="space-y-2 max-h-48 overflow-y-auto pr-2 border-t border-b py-3">Cargando pagos...</div>
        <div id="pagos-form-container" class="pt-4 mt-4"></div>
        <div class="mt-4"><button id="btn-registrar-nuevo-pago" class="btn-primary w-full">Registrar Nuevo Pago</button></div>`;
    
    contentContainer.querySelector('#btn-registrar-nuevo-pago').addEventListener('click', () => showActionForm('registrar_pago'));
    await renderPagosList();
}

async function renderPagosList() {
    const listaPagosEl = document.getElementById('lista-pagos');
    const summaryEl = document.getElementById('pagos-summary');

    const ids = currentGrupo.reservasIndividuales.map(r => r.id);
    allTransacciones = await fetchAPI('/gestion/transacciones', { method: 'POST', body: { idsIndividuales: ids } });
    
    const totalAbonado = allTransacciones.reduce((sum, t) => sum + t.monto, 0);
    const saldo = currentGrupo.valorTotalCLP - totalAbonado;

    summaryEl.innerHTML = `
        <div><span class="text-gray-500 font-medium">Total:</span> ${formatCurrency(currentGrupo.valorTotalCLP)}</div>
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
        </div>`).join('');
}

function renderDocumentoModal(tipo) {
    showActionForm(tipo === 'boleta' ? 'marcar_boleta_enviada' : 'gestionar_reserva');
}

function showActionForm(action, transaccion = null) {
    currentAction = action;
    const container = document.getElementById('pagos-form-container') || document.getElementById('modal-content-container');
    const formTitle = action === 'registrar_pago' ? 'Registrar Nuevo Pago' : (action === 'marcar_boleta_enviada' ? 'Subir Boleta/Factura' : 'Subir Documento de Reserva');

    const saldoPendiente = currentGrupo.valorTotalCLP - currentGrupo.abonoTotal;

    container.innerHTML = `
        <form id="modal-form-accion" class="border p-4 rounded-md">
            <h4 class="font-semibold text-lg mb-4">${formTitle}</h4>
            <div class="${action.includes('pago') ? '' : 'hidden'} space-y-4">
                <div><label class="block text-sm">Monto (CLP)</label><input type="number" id="monto-input" required class="form-input" value="${transaccion?.monto || Math.round(saldoPendiente)}"></div>
                <div><label class="block text-sm">Medio de Pago</label><select id="medio-pago-select" class="form-select"></select></div>
                <div class="flex items-center"><input id="pago-final-checkbox" type="checkbox" class="h-4 w-4 rounded"><label for="pago-final-checkbox" class="ml-2 text-sm">¿Es el pago final?</label></div>
            </div>
            <div class="mt-4">
                <label class="block text-sm">Documento (Opcional)</label>
                <input type="file" id="documento-input" class="hidden"/>
                <div id="paste-zone" class="mt-1 p-4 border-2 border-dashed rounded-md text-center cursor-pointer text-gray-500 hover:border-indigo-500 hover:text-indigo-500"><p>Selecciona o pega una imagen</p></div>
                <div id="preview-container" class="mt-2 hidden"><p class="text-sm">Vista Previa:</p><img id="thumbnail" class="w-24 h-24 object-cover rounded-md"></div>
                <div class="flex items-center mt-3"><input id="sin-documento-checkbox" type="checkbox" class="h-4 w-4"><label for="sin-documento-checkbox" class="ml-2 text-sm">Registrar sin documento</label></div>
            </div>
            <div id="modal-status" class="mt-2 text-sm text-red-600"></div>
            <div class="mt-5 flex justify-end space-x-2">
                <button type="button" id="form-cancel-btn" class="btn-secondary">Cancelar</button>
                <button type="submit" id="modal-save-btn" class="btn-primary">Guardar</button>
            </div>
        </form>`;
    
    if (action.includes('pago')) {
        const mediosDePago = ['Transferencia', 'Efectivo', 'Tarjeta'];
        const select = container.querySelector('#medio-pago-select');
        mediosDePago.forEach(medio => select.add(new Option(medio, medio)));
    }
    
    const form = container.querySelector('#modal-form-accion');
    form.addEventListener('submit', handleGroupFormSubmit);
    form.querySelector('#form-cancel-btn').addEventListener('click', () => {
        if (action.includes('pago')) {
             container.innerHTML = '';
             document.getElementById('btn-registrar-nuevo-pago').classList.remove('hidden');
        } else {
            document.getElementById('gestion-modal').classList.add('hidden');
        }
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
    
    let endpoint = '';

    if(currentAction.includes('pago')) {
        endpoint = '/gestion/registrar-pago';
        detalles.monto = parseFloat(form.querySelector('#monto-input').value);
        detalles.medioDePago = form.querySelector('#medio-pago-select').value;
        detalles.esPagoFinal = form.querySelector('#pago-final-checkbox').checked;
    } else {
        endpoint = '/gestion/actualizar-documento';
        detalles.tipoDocumento = currentAction === 'marcar_boleta_enviada' ? 'boleta' : 'reserva';
        if (detalles.tipoDocumento === 'boleta') {
            detalles.avanzarEstado = 'Facturado';
        }
    }

    detalles.sinDocumento = form.querySelector('#sin-documento-checkbox').checked;
    const docInput = form.querySelector('#documento-input');
    if (docInput.files.length > 0 && !detalles.sinDocumento) {
        formData.append('documento', docInput.files[0]);
    }
    
    formData.append('detalles', JSON.stringify(detalles));

    try {
        await fetchAPI(endpoint, { method: 'POST', body: formData });
        document.getElementById('gestion-modal').classList.add('hidden');
        await loadAndRender();
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }
}

function showPreview(file, thumb, container) {
    if (file && file.type.startsWith('image/')) {
        thumb.src = URL.createObjectURL(file);
        container.classList.remove('hidden');
    }
}

function handlePaste(e, docInput, thumb, container) {
    if (!document.getElementById('gestion-modal').contains(e.target)) return;
    const items = (e.clipboardData || window.clipboardData).items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = item.getAsFile();
            const file = new File([blob], "captura.png", { type: blob.type });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            docInput.files = dataTransfer.files;
            showPreview(file, thumb, container);
            break;
        }
    }
}

async function handleSaveAjusteGrupo() {
    const valoresCabanas = Array.from(document.querySelectorAll('.valor-input')).map(input => ({ id: input.dataset.id, valor: input.value }));
    try {
        await fetchAPI('/gestion/ajustar-valores', { method: 'POST', body: { valoresCabanas }});
        document.getElementById('gestion-modal').classList.add('hidden');
        await loadAndRender();
    } catch (error) {
        document.getElementById('ajuste-valores-status').textContent = `Error: ${error.message}`;
    }
}

async function handleSaveAjusteFinal() {
    const nuevoTotalCLP = document.getElementById('nuevo-valor-final').value;
    const totalActual = currentGrupo.valorTotalCLP;
    const proporcion = totalActual > 0 ? parseFloat(nuevoTotalCLP) / totalActual : 0;
    
    const valoresCabanas = currentGrupo.reservasIndividuales.map(res => ({
        id: res.id,
        valor: Math.round(res.valorCLP * proporcion)
    }));

    try {
        await fetchAPI('/gestion/ajustar-valores', { method: 'POST', body: { valoresCabanas }});
        document.getElementById('gestion-modal').classList.add('hidden');
        await loadAndRender();
    } catch (error) {
        document.getElementById('ajuste-status').textContent = `Error: ${error.message}`;
    }
}

async function handleSaveKpi() {
    const descuento = document.getElementById('descuento-pct').value;
    try {
        await fetchAPI('/gestion/calcular-potencial', {
            method: 'POST',
            body: {
                idsIndividuales: currentGrupo.reservasIndividuales.map(r => r.id),
                descuento
            }
        });
        document.getElementById('gestion-modal').classList.add('hidden');
        await loadAndRender();
    } catch (error) {
        document.getElementById('kpi-status').textContent = `Error: ${error.message}`;
    }
}