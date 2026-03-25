// frontend/src/views/gestionarReservas.js

import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { formatCurrency } from './components/gestionarReservas/reservas.utils.js';
import { renderCards } from './components/gestionarReservas/reservas.cards.js';
import { getEstados, getEstadosReserva, getEstadosGestion } from './components/estadosStore.js';
import {
    abrirModalVer,
    abrirModalEditar,
    cerrarModalEditar,
    toggleDolarFields,
    calcularValorFinal,
    handleGestionarDocumento,
} from './components/gestionarReservas/reservas.modals.js';

let todasLasReservas = [];
let historialCargas  = [];
let alojamientos     = [];
let clientes         = [];
let canales          = [];
let allEstados       = [];
let editandoReserva  = null;
let chipActivo       = '';

export async function render() {
    try {
        [todasLasReservas, historialCargas, alojamientos, clientes, canales, allEstados] = await Promise.all([
            fetchAPI('/reservas'),
            fetchAPI('/historial-cargas'),
            fetchAPI('/propiedades'),
            fetchAPI('/clientes'),
            fetchAPI('/canales'),
            getEstados(),
        ]);
    } catch (error) {
        return `<p class="text-danger-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }

    const opcionesCarga = historialCargas.map(h => `<option value="${h.id}">#${h.idNumerico} - ${h.nombreArchivo}</option>`).join('');
    const opcionesCanal = canales.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');

    const estadosGestion = getEstadosGestion(allEstados);
    const estadosGestionOptions = estadosGestion.length > 0
        ? estadosGestion.map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join('')
        : ['Pendiente Bienvenida','Pendiente Cobro','Pendiente Pago','Pendiente Boleta','Pendiente Cliente','Facturado','Propuesta']
            .map(e => `<option value="${e}">${e}</option>`).join('');

    const estadosReserva = getEstadosReserva(allEstados);
    const estadosReservaOptions = estadosReserva.length > 0
        ? estadosReserva.map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join('')
        : ['Confirmada','Cancelada','No Presentado','Desconocido','Propuesta']
            .map(e => `<option value="${e}">${e}</option>`).join('');

    return `
        <div class="bg-white p-6 rounded-lg shadow">
            <div class="flex items-center justify-between mb-5">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Reservas</h2>
                <button id="toggle-filters-btn" class="btn-outline text-xs">Filtros avanzados ▾</button>
            </div>

            <!-- Chips de filtro rápido -->
            <div class="flex flex-wrap gap-2 mb-4" id="chips-container">
                <button class="chip-filter active" data-chip="">Todas</button>
                <button class="chip-filter" data-chip="checkin-hoy">Check-in hoy</button>
                <button class="chip-filter" data-chip="checkout-hoy">Check-out hoy</button>
                <button class="chip-filter" data-chip="bienvenida-pendiente">Bienvenida pendiente</button>
                <button class="chip-filter" data-chip="sin-pago">Sin pago confirmado</button>
                <button class="chip-filter" data-chip="proximas-7">Próximas 7 días</button>
            </div>

            <!-- Búsqueda -->
            <input type="text" id="search-input" placeholder="Buscar por ID, cliente, alojamiento..." class="form-input mb-4">

            <!-- Filtros avanzados (colapsables) -->
            <div id="advanced-filters" class="hidden mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div><label class="label-filter">Desde (Llegada)</label><input type="date" id="fecha-inicio-filter" class="form-input"></div>
                    <div><label class="label-filter">Hasta (Llegada)</label><input type="date" id="fecha-fin-filter" class="form-input"></div>
                    <div><label class="label-filter">Canal</label><select id="canal-filter" class="form-select"><option value="">Todos</option>${opcionesCanal}</select></div>
                    <div><label class="label-filter">Estado Reserva</label><select id="estado-filter" class="form-select"><option value="">Todos</option>${estadosReservaOptions}</select></div>
                    <div><label class="label-filter">Estado Gestión</label><select id="estado-gestion-filter" class="form-select"><option value="">Todos</option>${estadosGestionOptions}</select></div>
                    <div><label class="label-filter">Reporte de Carga</label><select id="carga-filter" class="form-select"><option value="">Todos</option>${opcionesCarga}</select></div>
                </div>
            </div>

            <!-- Stats -->
            <div id="reservas-stats" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"></div>

            <!-- Cards grid -->
            <div id="reservas-cards-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
        </div>

        <!-- Modal Editar -->
        <div id="reserva-modal-edit" class="modal hidden"><div class="modal-content !max-w-4xl">
            <h3 id="modal-title-edit" class="text-xl font-semibold mb-4">Editar Reserva</h3>
            <div id="resumen-grupo-container" class="hidden mb-4"></div>
            <form id="reserva-form-edit" class="space-y-6 max-h-[75vh] overflow-y-auto pr-4">
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Datos de la Reserva</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="label">ID Reserva Canal</label><input type="text" name="idReservaCanal" class="form-input"></div>
                        <div><label class="label">Alojamiento</label><select id="alojamiento-select" name="alojamientoId" class="form-select"></select></div>
                    </div>
                </fieldset>
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Estados</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="label">Estado Reserva</label><select name="estado" class="form-select">${estadosReservaOptions}</select></div>
                        <div><label class="label">Estado Gestión</label><select name="estadoGestion" class="form-select"><option value="">N/A</option>${estadosGestionOptions}</select></div>
                    </div>
                </fieldset>
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Fechas y Huéspedes</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label class="label">Fecha Llegada</label><input type="date" name="fechaLlegada" class="form-input"></div>
                        <div><label class="label">Fecha Salida</label><input type="date" name="fechaSalida" class="form-input"></div>
                        <div><label class="label">Nº Huéspedes</label><input type="number" name="cantidadHuespedes" class="form-input"></div>
                    </div>
                </fieldset>
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Montos (Individual)</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label class="label">Moneda</label><select name="moneda" class="form-select"><option value="CLP">CLP</option><option value="USD">USD</option></select></div>
                        <div><label class="label">Valor Original (KPI)</label><input type="number" name="valorOriginal" step="0.01" class="form-input"></div>
                        <div><label class="label">Valor Final (Huésped CLP)</label><input type="number" name="valorTotal" step="1" class="form-input"></div>
                    </div>
                    <div id="dolar-container" class="hidden mt-4"><label class="label">Valor Dólar del Día</label><input type="number" step="0.01" name="valorDolarDia" class="form-input w-full md:w-1/3"></div>
                </fieldset>
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Datos del Cliente</legend>
                    <div><label class="label">Cliente</label><select id="cliente-select" name="clienteId" class="form-select"></select></div>
                </fieldset>
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Documentos</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="label">Documento Reserva</label><div id="documento-reserva-container"></div></div>
                        <div><label class="label">Boleta/Factura</label><div id="documento-boleta-container"></div></div>
                    </div>
                </fieldset>
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Transacciones y Pagos</legend>
                    <div id="lista-transacciones-edit" class="space-y-2 text-sm max-h-40 overflow-y-auto"></div>
                    <button type="button" id="add-pago-btn-edit" class="btn-secondary text-xs mt-2">+ Registrar Nuevo Pago</button>
                    <div id="form-pago-container-edit" class="hidden mt-2"></div>
                </fieldset>
                <div class="flex justify-end pt-4 border-t">
                    <button type="button" id="cancel-edit-btn" class="btn-secondary">Cancelar</button>
                    <button type="submit" class="btn-primary ml-2">Guardar Cambios</button>
                </div>
            </form>
        </div></div>

        <!-- Modal Ver -->
        <div id="reserva-modal-view" class="modal hidden">
            <div class="modal-content !max-w-4xl">
                <div class="flex justify-between items-center pb-3 border-b mb-4">
                    <h3 id="view-modal-title" class="text-xl font-semibold"></h3>
                    <button id="close-view-btn" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <div id="view-loading-state" class="text-center p-8"><p>Cargando detalles...</p></div>
                <div id="reserva-view-content" class="hidden space-y-6 max-h-[75vh] overflow-y-auto pr-4">
                    <div id="view-info-grupo" class="hidden"></div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-4">
                            <section>
                                <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Información de la Reserva</h4>
                                <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <dt class="text-gray-500">Alojamiento:</dt><dd id="view-alojamiento"></dd>
                                    <dt class="text-gray-500">Canal:</dt><dd id="view-canal"></dd>
                                    <dt class="text-gray-500">Check-in:</dt><dd id="view-checkin"></dd>
                                    <dt class="text-gray-500">Check-out:</dt><dd id="view-checkout"></dd>
                                    <dt class="text-gray-500">Noches:</dt><dd id="view-noches"></dd>
                                    <dt class="text-gray-500">Huéspedes:</dt><dd id="view-huespedes"></dd>
                                    <dt class="text-gray-500">Estado Reserva:</dt><dd id="view-estado-reserva" class="font-semibold"></dd>
                                    <dt class="text-gray-500">Estado Gestión:</dt><dd id="view-estado-gestion" class="font-semibold"></dd>
                                </dl>
                            </section>
                            <section>
                                <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Documentos</h4>
                                <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <dt class="text-gray-500">Doc. Reserva:</dt><dd id="view-doc-reserva"></dd>
                                    <dt class="text-gray-500">Boleta/Factura:</dt><dd id="view-doc-boleta"></dd>
                                </dl>
                            </section>
                        </div>
                        <div class="space-y-4">
                            <section>
                                <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Información del Cliente</h4>
                                <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <dt class="text-gray-500">Nombre:</dt><dd id="view-cliente-nombre"></dd>
                                    <dt class="text-gray-500">Teléfono:</dt><dd id="view-cliente-telefono"></dd>
                                    <dt class="text-gray-500">Email:</dt><dd id="view-cliente-email"></dd>
                                    <dt class="text-gray-500">País:</dt><dd id="view-cliente-pais"></dd>
                                    <dt class="text-gray-500">Calificación:</dt><dd id="view-cliente-calificacion"></dd>
                                    <dt class="text-gray-500">Ubicación:</dt><dd id="view-cliente-ubicacion"></dd>
                                    <dt class="text-gray-500 col-span-2">Notas Cliente:</dt>
                                    <dd id="view-cliente-notas" class="col-span-2 text-xs bg-gray-50 p-2 rounded whitespace-pre-wrap"></dd>
                                </dl>
                            </section>
                        </div>
                    </div>
                    <div class="space-y-4 border-t pt-4 mt-4">
                        <section><h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">📈 Desglose de Valores (Fuente de la Verdad)</h4><div id="view-desglose-valores" class="overflow-x-auto text-sm"></div></section>
                        <section><h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">💸 Análisis de Cobranza (Saldos)</h4><div id="view-analisis-cobranza" class="overflow-x-auto text-sm"></div></section>
                        <section><h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">📊 Análisis de Rentabilidad (KPI)</h4><div id="view-analisis-kpi" class="overflow-x-auto text-sm"></div></section>
                        <section><h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">✏️ Historial de Ajustes (Trazabilidad)</h4><div id="view-historial-ajustes" class="overflow-x-auto text-sm"></div></section>
                        <section><h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Transacciones y Pagos (Grupo)</h4><div id="view-transacciones-list" class="space-y-2 text-sm max-h-40 overflow-y-auto"></div></section>
                        <section><h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Bitácora de Gestión (Grupo)</h4><div id="view-notas-list" class="space-y-2 text-xs max-h-40 overflow-y-auto"></div></section>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal confirmar borrado -->
        <div id="modal-confirmar-borrado-grupo" class="modal hidden">
            <div class="modal-content !max-w-lg">
                <h3 class="text-xl font-semibold text-danger-700 mb-4">⚠️ ¡Advertencia! Reserva con Datos Vinculados</h3>
                <div id="borrado-grupo-info" class="text-sm space-y-3 mb-6">
                    <p>Esta reserva tiene pagos y/o notas asociadas. No se puede borrar individualmente sin corromper los datos financieros.</p>
                    <p class="font-semibold">Si continúas, se borrará el GRUPO COMPLETO y todos sus datos en cascada.</p>
                    <div id="borrado-grupo-lista" class="p-3 bg-gray-50 border rounded-md max-h-40 overflow-y-auto"></div>
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" id="borrado-grupo-cancelar" class="btn-secondary">Cancelar</button>
                    <button type="button" id="borrado-grupo-confirmar" class="btn-danger">Sí, Borrar Grupo Completo</button>
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    const searchInput         = document.getElementById('search-input');
    const cargaFilter         = document.getElementById('carga-filter');
    const canalFilter         = document.getElementById('canal-filter');
    const estadoFilter        = document.getElementById('estado-filter');
    const estadoGestionFilter = document.getElementById('estado-gestion-filter');
    const fechaInicioFilter   = document.getElementById('fecha-inicio-filter');
    const fechaFinFilter      = document.getElementById('fecha-fin-filter');
    const formEdit            = document.getElementById('reserva-form-edit');
    const grid                = document.getElementById('reservas-cards-grid');
    const urlParams           = new URLSearchParams(window.location.search);
    const reservaIdParaEditar = urlParams.get('reservaId');

    const getFiltros = () => ({
        busqueda:      searchInput.value,
        carga:         cargaFilter?.value        || '',
        canal:         canalFilter?.value        || '',
        estado:        estadoFilter?.value       || '',
        estadoGestion: estadoGestionFilter?.value || '',
        fechaInicio:   fechaInicioFilter?.value  || '',
        fechaFin:      fechaFinFilter?.value     || '',
        chip:          chipActivo,
    });

    renderCards(getFiltros(), todasLasReservas, historialCargas, allEstados);

    // Chips
    document.getElementById('chips-container').addEventListener('click', e => {
        const btn = e.target.closest('.chip-filter');
        if (!btn) return;
        document.querySelectorAll('.chip-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chipActivo = btn.dataset.chip;
        renderCards(getFiltros(), todasLasReservas, historialCargas, allEstados);
    });

    // Toggle filtros avanzados
    document.getElementById('toggle-filters-btn').addEventListener('click', () => {
        document.getElementById('advanced-filters').classList.toggle('hidden');
    });

    // Filtrado desde calendario: mostrar solo la reserva indicada
    const openReservaId = sessionStorage.getItem('openReserva');
    if (openReservaId) {
        sessionStorage.removeItem('openReserva');
        searchInput.value = openReservaId;
        renderCards(getFiltros(), todasLasReservas, historialCargas, allEstados);
    }

    // Filtros de texto y selects
    [searchInput, cargaFilter, canalFilter, estadoFilter, estadoGestionFilter, fechaInicioFilter, fechaFinFilter]
        .filter(Boolean)
        .forEach(el => el.addEventListener('input', () => renderCards(getFiltros(), todasLasReservas, historialCargas, allEstados)));

    // Botones Ver / Editar / Eliminar en las cards
    grid.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-id]');
        if (!btn) return;
        const id = btn.dataset.id;

        if (btn.classList.contains('view-btn')) {
            abrirModalVer(id);
        }
        if (btn.classList.contains('edit-btn')) {
            const reserva = await abrirModalEditar(id, alojamientos, clientes);
            if (reserva) editandoReserva = reserva;
        }
        if (btn.classList.contains('delete-btn')) {
            await handleDeleteReserva(id);
        }
    });

    // Cerrar modales
    document.getElementById('cancel-edit-btn').addEventListener('click', cerrarModalEditar);
    document.getElementById('close-view-btn').addEventListener('click', () => document.getElementById('reserva-modal-view').classList.add('hidden'));
    document.getElementById('borrado-grupo-cancelar').addEventListener('click', () => document.getElementById('modal-confirmar-borrado-grupo').classList.add('hidden'));

    // Form editar: listeners de moneda y valores
    if (formEdit) {
        const monedaSelect      = formEdit.querySelector('[name="moneda"]');
        const valorOriginalInput = formEdit.querySelector('[name="valorOriginal"]');
        const valorTotalInput    = formEdit.querySelector('[name="valorTotal"]');
        const valorDolarInput    = formEdit.querySelector('[name="valorDolarDia"]');

        monedaSelect.addEventListener('change', () => toggleDolarFields(formEdit));
        valorOriginalInput.addEventListener('input', () => calcularValorFinal(formEdit, 'original'));
        valorTotalInput.addEventListener('input', () => calcularValorFinal(formEdit, 'total'));
        valorDolarInput.addEventListener('input', () => calcularValorFinal(formEdit, 'dolar'));

        formEdit.addEventListener('change', async e => {
            if (e.target.classList.contains('doc-input')) {
                const updated = await handleGestionarDocumento(editandoReserva.id, e.target.dataset.tipo, e.target.files[0], 'upload');
                if (updated) editandoReserva = updated;
            }
        });
        formEdit.addEventListener('click', async e => {
            if (e.target.classList.contains('delete-doc-btn') && confirm('¿Seguro que quieres eliminar este documento?')) {
                const updated = await handleGestionarDocumento(editandoReserva.id, e.target.dataset.tipo, null, 'delete');
                if (updated) editandoReserva = updated;
            }
            if (e.target.id === 'add-pago-btn-edit') {
                document.getElementById('form-pago-container-edit').classList.toggle('hidden');
            }
        });

        formEdit.addEventListener('submit', e => handleSubmitEditar(e));
    }

    document.getElementById('borrado-grupo-confirmar').addEventListener('click', handleConfirmarBorradoGrupo);

    if (reservaIdParaEditar) {
        abrirModalEditar(reservaIdParaEditar, alojamientos, clientes).then(r => { if (r) editandoReserva = r; });
    }
}

// ─── Helpers internos ─────────────────────────────────────────────────────

async function handleDeleteReserva(id) {
    const reserva = todasLasReservas.find(r => r.id === id);
    if (!reserva) return;

    try {
        await fetchAPI(`/reservas/${id}`, { method: 'DELETE' });
        todasLasReservas = todasLasReservas.filter(r => r.id !== id);
        renderCards(getActiveFiltros(), todasLasReservas, historialCargas, allEstados);
        alert('Reserva eliminada con éxito.');
    } catch (error) {
        if (error.status === 409 && error.data) {
            mostrarModalBorradoGrupo(error.data);
        } else {
            alert(`Error al eliminar: ${error.message}`);
        }
    }
}

function mostrarModalBorradoGrupo({ idReservaCanal, grupoInfo, message }) {
    const modal     = document.getElementById('modal-confirmar-borrado-grupo');
    const mensajeEl = modal.querySelector('#borrado-grupo-info p');
    const listaEl   = modal.querySelector('#borrado-grupo-lista');
    const confirmBtn = modal.querySelector('#borrado-grupo-confirmar');

    mensajeEl.textContent = message;
    listaEl.innerHTML = grupoInfo.map(r =>
        `<div class="flex justify-between items-center py-1 border-b">
            <span class="font-medium">${r.nombre}</span>
            <span class="text-gray-600">${formatCurrency(r.valor)}</span>
        </div>`
    ).join('');
    confirmBtn.dataset.idReservaCanal = idReservaCanal;
    modal.classList.remove('hidden');
}

async function handleConfirmarBorradoGrupo(e) {
    const idReservaCanal = e.target.dataset.idReservaCanal;
    if (!idReservaCanal) return;
    e.target.disabled = true;
    e.target.textContent = 'Eliminando...';
    try {
        await fetchAPI('/reservas/grupo/eliminar', { method: 'POST', body: { idReservaCanal } });
        todasLasReservas = todasLasReservas.filter(r => r.idReservaCanal !== idReservaCanal);
        renderCards(getActiveFiltros(), todasLasReservas, historialCargas, allEstados);
        document.getElementById('modal-confirmar-borrado-grupo').classList.add('hidden');
        alert('¡Grupo completo eliminado con éxito!');
    } catch (error) {
        alert(`Error al borrar el grupo: ${error.message}`);
    } finally {
        e.target.disabled = false;
        e.target.textContent = 'Sí, Borrar Grupo Completo';
    }
}

async function handleSubmitEditar(e) {
    e.preventDefault();
    if (!editandoReserva) return;

    const formEdit = document.getElementById('reserva-form-edit');
    const idAntiguo = editandoReserva.idReservaCanal;
    const idNuevo   = formEdit.idReservaCanal.value;

    if (idAntiguo !== idNuevo) {
        if (!confirm(`Estás a punto de cambiar el ID de "${idAntiguo}" a "${idNuevo}". Esto actualizará todas las referencias en cascada. ¿Estás seguro?`)) {
            formEdit.idReservaCanal.value = idAntiguo;
            return;
        }
        try {
            const resultado = await fetchAPI(`/reservas/actualizar-id-canal/${editandoReserva.id}`, {
                method: 'PUT', body: { idAntiguo, idNuevo }
            });
            const { firestore, storage } = resultado.summary;
            let msg = '¡Actualización de ID en cascada completada!\n\nDocumentos actualizados:\n';
            for (const [k, v] of Object.entries(firestore)) msg += `- ${k}: ${v}\n`;
            msg += `\nArchivos renombrados: ${storage.renombrados}`;
            if (storage.errores > 0) msg += `\nArchivos con error: ${storage.errores}`;
            alert(msg);
        } catch (error) {
            alert(`Error crítico al actualizar el ID en cascada: ${error.message}`);
            return;
        }
    }

    const datosReserva = {
        idReservaCanal:    idNuevo,
        alojamientoId:     formEdit.alojamientoId.value,
        clienteId:         formEdit.clienteId.value,
        fechaLlegada:      formEdit.fechaLlegada.value,
        fechaSalida:       formEdit.fechaSalida.value,
        estado:            formEdit.estado.value,
        estadoGestion:     formEdit.estadoGestion.value || null,
        cantidadHuespedes: parseInt(formEdit.cantidadHuespedes.value) || 0,
        moneda:            formEdit.moneda.value,
        valorDolarDia:     parseFloat(formEdit.valorDolarDia.value) || null,
        valores: {
            ...editandoReserva.valores,
            valorOriginal: parseFloat(formEdit.valorOriginal.value) || 0,
            valorHuesped:  Math.round(parseFloat(formEdit.valorTotal.value)) || 0,
        }
    };

    try {
        await fetchAPI(`/reservas/${editandoReserva.id}`, { method: 'PUT', body: datosReserva });
        [todasLasReservas, clientes] = await Promise.all([fetchAPI('/reservas'), fetchAPI('/clientes')]);
        renderCards(getActiveFiltros(), todasLasReservas, historialCargas, allEstados);
        cerrarModalEditar();
        if (window.location.search.includes('reservaId')) handleNavigation('/gestion-diaria');
    } catch (error) {
        alert(`Error al guardar los cambios de la reserva: ${error.message}`);
    }
}

function getActiveFiltros() {
    return {
        busqueda:      document.getElementById('search-input')?.value          || '',
        carga:         document.getElementById('carga-filter')?.value          || '',
        canal:         document.getElementById('canal-filter')?.value          || '',
        estado:        document.getElementById('estado-filter')?.value         || '',
        estadoGestion: document.getElementById('estado-gestion-filter')?.value || '',
        fechaInicio:   document.getElementById('fecha-inicio-filter')?.value   || '',
        fechaFin:      document.getElementById('fecha-fin-filter')?.value      || '',
        chip:          chipActivo,
    };
}
