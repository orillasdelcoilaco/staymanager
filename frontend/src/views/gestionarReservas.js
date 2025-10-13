// frontend/src/views/gestionarReservas.js

import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let todasLasReservas = [];
let historialCargas = [];
let alojamientos = [];
let clientes = [];
let canales = [];
let editandoReserva = null;
let transaccionesActuales = [];

// --- UTILS ---
const formatDate = (dateString) => {
    if (!dateString) return '-';
    const datePart = dateString.split('T')[0];
    return new Date(datePart + 'T00:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};
const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-CL');
};
const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;
const formatStars = (rating) => '⭐'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0));


// --- VIEW MODAL LOGIC ---
function renderDocumentoLink(docUrl, defaultText = 'No adjunto') {
    if (!docUrl) return `<span class="text-gray-500">${defaultText}</span>`;
    if (docUrl === 'SIN_DOCUMENTO') return '<span class="font-semibold">Declarado sin documento</span>';
    return `<a href="${docUrl}" target="_blank" class="text-blue-600 hover:underline">Ver Documento</a>`;
}

async function abrirModalVer(reservaId) {
    const modal = document.getElementById('reserva-modal-view');
    const contentEl = document.getElementById('reserva-view-content');
    
    modal.classList.remove('hidden');
    contentEl.classList.add('hidden'); // Ocultar contenido mientras carga
    document.getElementById('view-loading-state').classList.remove('hidden');

    try {
        const data = await fetchAPI(`/reservas/${reservaId}`);
        
        document.getElementById('view-modal-title').textContent = `Detalle Reserva: ${data.idReservaCanal}`;
        document.getElementById('view-alojamiento').textContent = data.alojamientoNombre;
        document.getElementById('view-canal').textContent = data.canalNombre;
        document.getElementById('view-checkin').textContent = formatDate(data.fechaLlegada);
        document.getElementById('view-checkout').textContent = formatDate(data.fechaSalida);
        document.getElementById('view-noches').textContent = data.totalNoches;
        document.getElementById('view-huespedes').textContent = data.cantidadHuespedes;
        document.getElementById('view-estado-reserva').textContent = data.estado;
        document.getElementById('view-estado-gestion').textContent = data.estadoGestion || 'N/A';
        document.getElementById('view-doc-reserva').innerHTML = renderDocumentoLink(data.documentos?.enlaceReserva);
        document.getElementById('view-doc-boleta').innerHTML = renderDocumentoLink(data.documentos?.enlaceBoleta);

        document.getElementById('view-cliente-nombre').textContent = data.cliente.nombre || '-';
        document.getElementById('view-cliente-telefono').textContent = data.cliente.telefono || '-';
        document.getElementById('view-cliente-email').textContent = data.cliente.email || '-';
        document.getElementById('view-cliente-pais').textContent = data.cliente.pais || '-';
        document.getElementById('view-cliente-calificacion').innerHTML = formatStars(data.cliente.calificacion);
        document.getElementById('view-cliente-ubicacion').textContent = data.cliente.ubicacion || '-';
        document.getElementById('view-cliente-notas').textContent = data.cliente.notas || 'Sin notas.';
        
        document.getElementById('view-total-cliente').textContent = formatCurrency(data.datosAgregados.valorTotalHuesped);
        document.getElementById('view-abonado').textContent = formatCurrency(data.datosAgregados.abonoTotal);
        document.getElementById('view-saldo').textContent = formatCurrency(data.datosAgregados.valorTotalHuesped - data.datosAgregados.abonoTotal);
        document.getElementById('view-payout').textContent = formatCurrency(data.datosAgregados.payoutFinalReal);
        document.getElementById('view-costo-canal').textContent = formatCurrency(data.datosAgregados.costoCanal);
        document.getElementById('view-valor-potencial').textContent = data.datosAgregados.valorPotencial > 0 ? formatCurrency(data.datosAgregados.valorPotencial) : 'No calculado';

        const transaccionesContainer = document.getElementById('view-transacciones-list');
        if (data.transacciones.length > 0) {
            transaccionesContainer.innerHTML = data.transacciones.map(t => `
                <div class="bg-gray-50 p-2 rounded grid grid-cols-4 gap-2 items-center">
                    <span>${t.tipo}</span>
                    <span class="font-semibold">${formatCurrency(t.monto)}</span>
                    <span>${t.medioDePago}</span>
                    <div>${renderDocumentoLink(t.enlaceComprobante, 'Sin comprobante')}</div>
                </div>
            `).join('');
        } else {
            transaccionesContainer.innerHTML = '<p class="text-gray-500">No hay transacciones registradas.</p>';
        }

        const notasContainer = document.getElementById('view-notas-list');
        if (data.notas.length > 0) {
            notasContainer.innerHTML = data.notas.map(n => `
                <div class="bg-gray-50 p-2 rounded">
                    <p class="whitespace-pre-wrap">${n.texto}</p>
                    <p class="text-gray-500 text-right">-- ${n.autor} el ${n.fecha}</p>
                </div>
            `).join('');
        } else {
            notasContainer.innerHTML = '<p class="text-gray-500">Sin notas en la bitácora.</p>';
        }

        contentEl.classList.remove('hidden');
    } catch (error) {
        document.getElementById('view-loading-state').innerHTML = `<p class="text-red-500 text-center">Error al cargar los detalles: ${error.message}</p>`;
    } finally {
        if (!contentEl.classList.contains('hidden')) {
            document.getElementById('view-loading-state').classList.add('hidden');
        }
    }
}


// --- EDIT MODAL LOGIC ---
function toggleDolarFields(form) {
    const moneda = form.moneda.value;
    const dolarContainer = form.querySelector('#dolar-container');

    if (moneda === 'USD') {
        dolarContainer.style.display = 'grid';
    } else {
        dolarContainer.style.display = 'none';
    }
}

function calcularValorFinal(form) {
    if (form.moneda.value === 'USD') {
        const valorOriginal = parseFloat(form.valorOriginal.value) || 0;
        const valorDolar = parseFloat(form.valorDolarDia.value) || 0;
        form.valorTotal.value = Math.round(valorOriginal * valorDolar);
    }
}

function renderizarGestorDocumento(form, tipo, docUrl) {
    const container = form.querySelector(`#documento-${tipo}-container`);
    let html = '';

    if (docUrl) {
        if (docUrl === 'SIN_DOCUMENTO') {
            html = '<p class="text-sm font-semibold">Declarado sin documento.</p>';
        } else {
            html = `<a href="${docUrl}" target="_blank" class="text-blue-600 hover:underline text-sm">Ver Documento Actual</a>`;
        }
        html += `<button type="button" data-tipo="${tipo}" class="delete-doc-btn text-red-600 text-xs ml-4">Eliminar</button>`;
    }

    html += `<input type="file" data-tipo="${tipo}" class="doc-input mt-2 text-sm">`;
    container.innerHTML = html;
}

async function handleGestionarDocumento(reservaId, tipo, archivo, accion) {
    const formData = new FormData();
    formData.append('tipoDocumento', tipo);
    formData.append('accion', accion);
    if (archivo) {
        formData.append('documento', archivo);
    }
    
    try {
        editandoReserva = await fetchAPI(`/reservas/${reservaId}/documento`, { method: 'POST', body: formData });
        
        const form = document.getElementById('reserva-form-edit');
        renderizarGestorDocumento(form, 'reserva', editandoReserva.documentos?.enlaceReserva);
        renderizarGestorDocumento(form, 'boleta', editandoReserva.documentos?.enlaceBoleta);
    } catch (error) {
        alert(`Error al gestionar el documento: ${error.message}`);
    }
}

function renderizarListaTransacciones(form, transacciones) {
    const container = form.querySelector('#lista-transacciones-edit');
    transaccionesActuales = transacciones;

    if (transacciones.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No hay pagos registrados.</p>';
        return;
    }

    container.innerHTML = transacciones.map(t => `
        <div class="bg-gray-50 p-2 rounded grid grid-cols-4 gap-2 items-center">
            <span>${t.tipo}</span>
            <span class="font-semibold">${formatCurrency(t.monto)}</span>
            <span>${renderDocumentoLink(t.enlaceComprobante, 'Sin Comp.')}</span>
            <button type="button" data-id="${t.id}" class="delete-pago-btn text-red-600 text-xs justify-self-end">Eliminar</button>
        </div>
    `).join('');
}


async function abrirModalEditar(reservaId) {
    const modal = document.getElementById('reserva-modal-edit');
    const form = document.getElementById('reserva-form-edit');
    if (!modal || !form) return;

    try {
        editandoReserva = await fetchAPI(`/reservas/${reservaId}`);
        
        document.getElementById('modal-title-edit').textContent = `Editar Reserva: ${editandoReserva.idReservaCanal}`;
        
        document.getElementById('alojamiento-select').innerHTML = alojamientos.map(a => `<option value="${a.id}" ${a.id === editandoReserva.alojamientoId ? 'selected' : ''}>${a.nombre}</option>`).join('');
        
        const clienteSelect = document.getElementById('cliente-select');
        clienteSelect.innerHTML = clientes.map(c => `<option value="${c.id}" ${c.id === editandoReserva.clienteId ? 'selected' : ''}>${c.nombre}</option>`).join('');

        form.idReservaCanal.value = editandoReserva.idReservaCanal || '';
        form.estado.value = editandoReserva.estado;
        form.estadoGestion.value = editandoReserva.estadoGestion || '';
        form.fechaLlegada.value = editandoReserva.fechaLlegada;
        form.fechaSalida.value = editandoReserva.fechaSalida;
        form.moneda.value = editandoReserva.moneda || 'CLP';
        form.valorOriginal.value = editandoReserva.valores?.valorOriginal || 0;
        form.valorTotal.value = editandoReserva.valores?.valorTotal || 0;
        form.valorDolarDia.value = editandoReserva.valorDolarDia || '';
        form.cantidadHuespedes.value = editandoReserva.cantidadHuespedes || 0;

        renderizarGestorDocumento(form, 'reserva', editandoReserva.documentos?.enlaceReserva);
        renderizarGestorDocumento(form, 'boleta', editandoReserva.documentos?.enlaceBoleta);
        renderizarListaTransacciones(form, editandoReserva.transacciones);

        toggleDolarFields(form);
        modal.classList.remove('hidden');
    } catch (error) {
        alert(`Error al cargar los detalles de la reserva: ${error.message}`);
    }
}

function cerrarModalEditar() {
    document.getElementById('reserva-modal-edit').classList.add('hidden');
    editandoReserva = null;
}

// --- MAIN TABLE RENDER ---
function renderTabla(filtros) {
    const tbody = document.getElementById('reservas-tbody');
    if (!tbody) return;
    
    const filtroLowerCase = filtros.busqueda.toLowerCase();
    
    const reservasFiltradas = todasLasReservas.filter(r => {
        const busquedaMatch = !filtroLowerCase ||
                              (r.nombreCliente?.toLowerCase().includes(filtroLowerCase)) ||
                              (r.alojamientoNombre?.toLowerCase().includes(filtroLowerCase)) ||
                              (r.idReservaCanal?.toLowerCase().includes(filtroLowerCase)) ||
                              (r.totalNoches?.toString().includes(filtroLowerCase));
        
        const cargaMatch = !filtros.carga || r.idCarga === filtros.carga;
        const canalMatch = !filtros.canal || r.canalNombre === filtros.canal;
        const estadoMatch = !filtros.estado || r.estado === filtros.estado;
        const estadoGestionMatch = !filtros.estadoGestion || r.estadoGestion === filtros.estadoGestion;
        const fechaMatch = (!filtros.fechaInicio || r.fechaLlegada >= filtros.fechaInicio) &&
                           (!filtros.fechaFin || r.fechaLlegada <= filtros.fechaFin);

        return busquedaMatch && cargaMatch && canalMatch && estadoMatch && estadoGestionMatch && fechaMatch;
    });

    if (reservasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="text-center text-gray-500 py-4">No se encontraron reservas que coincidan con los filtros.</td></tr>';
        return;
    }

    tbody.innerHTML = reservasFiltradas.map((r, index) => {
        const reporte = historialCargas.find(h => h.id === r.idCarga);
        const idNumericoCarga = reporte ? reporte.idNumerico : 'N/A';

        return `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-2 px-3 font-mono">${r.idReservaCanal}</td>
            <td class="py-2 px-3 font-mono text-center font-bold">${idNumericoCarga}</td>
            <td class="py-2 px-3 font-medium">${r.nombreCliente}</td>
            <td class="py-2 px-3">${r.alojamientoNombre}</td>
            <td class="py-2 px-3">${r.canalNombre}</td>
            <td class="py-2 px-3 whitespace-nowrap">${formatDate(r.fechaLlegada)}</td>
            <td class="py-2 px-3 whitespace-nowrap">${formatDate(r.fechaSalida)}</td>
            <td class="py-2 px-3 text-center">${r.totalNoches || '-'}</td>
            <td class="py-2 px-3">${r.estado}</td>
            <td class="py-2 px-3">${r.estadoGestion || 'N/A'}</td>
            <td class="py-2 px-3 text-right">
                <div class="font-semibold" title="Total Pagado por el Huésped">${formatCurrency(r.valores.valorHuesped)}</div>
                <div class="text-xs text-gray-600" title="Payout para el Anfitrión">${formatCurrency(r.valores.valorTotal)}</div>
            </td>
            <td class="py-2 px-3 whitespace-nowrap text-center space-x-2">
                <button data-id="${r.id}" class="view-btn btn-table-view">Ver</button>
                <button data-id="${r.id}" class="edit-btn btn-table-edit">Editar</button>
                <button data-id="${r.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `}).join('');
}


export async function render() {
    try {
        [todasLasReservas, historialCargas, alojamientos, clientes, canales] = await Promise.all([
            fetchAPI('/reservas'),
            fetchAPI('/historial-cargas'),
            fetchAPI('/propiedades'),
            fetchAPI('/clientes'),
            fetchAPI('/canales')
        ]);
    } catch (error) {
        return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }

    const opcionesCarga = historialCargas.map(h => `<option value="${h.id}">#${h.idNumerico} - ${h.nombreArchivo}</option>`).join('');
    const opcionesCanal = canales.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    const estadosGestionOptions = ['Pendiente Bienvenida', 'Pendiente Cobro', 'Pendiente Pago', 'Pendiente Boleta', 'Pendiente Cliente', 'Facturado', 'Propuesta'].map(e => `<option value="${e}">${e}</option>`).join('');
    const estadosReservaOptions = ['Confirmada', 'Cancelada', 'No Presentado', 'Desconocido', 'Propuesta'].map(e => `<option value="${e}">${e}</option>`).join('');

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-6">Gestionar Reservas</h2>
            
            <div class="p-4 border rounded-md bg-gray-50 mb-6 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" id="search-input" placeholder="Buscar por ID, cliente, noches..." class="form-input col-span-full">
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div><label class="label-filter">Desde (Llegada)</label><input type="date" id="fecha-inicio-filter" class="form-input"></div>
                    <div><label class="label-filter">Hasta (Llegada)</label><input type="date" id="fecha-fin-filter" class="form-input"></div>
                    <div><label class="label-filter">Canal</label><select id="canal-filter" class="form-select"><option value="">Todos</option>${opcionesCanal}</select></div>
                    <div><label class="label-filter">Estado Reserva</label><select id="estado-filter" class="form-select"><option value="">Todos</option>${estadosReservaOptions}</select></div>
                    <div><label class="label-filter">Estado Gestión</label><select id="estado-gestion-filter" class="form-select"><option value="">Todos</option>${estadosGestionOptions}</select></div>
                    <div><label class="label-filter">Reporte de Carga</label><select id="carga-filter" class="form-select"><option value="">Todos</option>${opcionesCarga}</select></div>
                </div>
            </div>

            <div class="table-container">
                <table class="min-w-full bg-white"><thead class="bg-gray-50"><tr>
                    <th class="th w-12">#</th>
                    <th class="th">ID Canal</th>
                    <th class="th">ID Carga</th>
                    <th class="th">Nombre</th>
                    <th class="th">Alojamiento</th>
                    <th class="th">Canal</th>
                    <th class="th">Check-in</th>
                    <th class="th">Check-out</th>
                    <th class="th">Noches</th>
                    <th class="th">Estado</th>
                    <th class="th">Estado Gestión</th>
                    <th class="th text-right">Datos Financieros</th>
                    <th class="th text-center">Acciones</th>
                </tr></thead><tbody id="reservas-tbody"></tbody></table>
            </div>
        </div>

        <div id="reserva-modal-edit" class="modal hidden"><div class="modal-content !max-w-4xl">
            <h3 id="modal-title-edit" class="text-xl font-semibold mb-4">Editar Reserva</h3>
            <form id="reserva-form-edit" class="space-y-6 max-h-[75vh] overflow-y-auto pr-4">
                
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Datos de la Reserva</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="idReservaCanal" class="label">ID Reserva Canal</label><input type="text" name="idReservaCanal" class="form-input"></div>
                        <div><label for="alojamiento-select" class="label">Alojamiento</label><select id="alojamiento-select" name="alojamientoId" class="form-select"></select></div>
                    </div>
                </fieldset>
                
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Estados</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="estado" class="label">Estado Reserva</label><select name="estado" class="form-select"><option value="Confirmada">Confirmada</option><option value="Cancelada">Cancelada</option><option value="No Presentado">No Presentado</option><option value="Desconocido">Desconocido</option><option value="Propuesta">Propuesta</option></select></div>
                        <div><label for="estadoGestion" class="label">Estado Gestión</label><select name="estadoGestion" class="form-select"><option value="">N/A</option>${estadosGestionOptions}</select></div>
                    </div>
                </fieldset>

                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Fechas y Huéspedes</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label for="fechaLlegada" class="label">Fecha Llegada</label><input type="date" name="fechaLlegada" class="form-input"></div>
                        <div><label for="fechaSalida" class="label">Fecha Salida</label><input type="date" name="fechaSalida" class="form-input"></div>
                        <div><label for="cantidadHuespedes" class="label">Nº Huéspedes</label><input type="number" name="cantidadHuespedes" class="form-input"></div>
                    </div>
                </fieldset>

                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Montos</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label for="moneda" class="label">Moneda</label><select name="moneda" class="form-select"><option value="CLP">CLP</option><option value="USD">USD</option></select></div>
                        <div><label for="valorOriginal" class="label">Valor Original (KPI)</label><input type="number" name="valorOriginal" class="form-input bg-gray-100" readonly></div>
                        <div><label for="valorTotal" class="label">Valor Final (Payout CLP)</label><input type="number" name="valorTotal" step="1" class="form-input bg-gray-100" readonly></div>
                    </div>
                    <div id="dolar-container" class="hidden mt-4"><label for="valorDolarDia" class="label">Valor Dólar del Día</label><input type="number" step="0.01" name="valorDolarDia" class="form-input w-full md:w-1/3"></div>
                </fieldset>

                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Datos del Cliente</legend>
                    <div><label for="cliente-select" class="label">Cliente</label><select id="cliente-select" name="clienteId" class="form-select"></select></div>
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

        <div id="reserva-modal-view" class="modal hidden">
            <div class="modal-content !max-w-4xl">
                 <div class="flex justify-between items-center pb-3 border-b mb-4">
                    <h3 id="view-modal-title" class="text-xl font-semibold"></h3>
                    <button id="close-view-btn" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <div id="view-loading-state" class="text-center p-8"><p>Cargando detalles...</p></div>
                <div id="reserva-view-content" class="hidden space-y-6 max-h-[75vh] overflow-y-auto pr-4">
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
                        <section>
                            <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Análisis Financiero</h4>
                            <dl class="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
                                <dt class="text-gray-500">Total Cliente:</dt><dd id="view-total-cliente" class="font-semibold"></dd><dd></dd>
                                <dt class="text-gray-500">Abonado:</dt><dd id="view-abonado" class="text-green-600"></dd><dd></dd>
                                <dt class="text-gray-500">Saldo:</dt><dd id="view-saldo" class="text-red-600 font-bold"></dd><dd></dd>
                                <dt class="text-gray-500">Payout (Ingreso Real):</dt><dd id="view-payout"></dd><dd></dd>
                                <dt class="text-gray-500">Costo del Canal:</dt><dd id="view-costo-canal"></dd><dd></dd>
                                <dt class="text-gray-500">Valor Potencial (KPI):</dt><dd id="view-valor-potencial"></dd>
                            </dl>
                        </section>
                        <section>
                            <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Transacciones y Pagos</h4>
                            <div id="view-transacciones-list" class="space-y-2 text-sm max-h-40 overflow-y-auto"></div>
                        </section>
                        <section>
                            <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Bitácora de Gestión</h4>
                            <div id="view-notas-list" class="space-y-2 text-xs max-h-40 overflow-y-auto"></div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    const searchInput = document.getElementById('search-input');
    const cargaFilter = document.getElementById('carga-filter');
    const canalFilter = document.getElementById('canal-filter');
    const estadoFilter = document.getElementById('estado-filter');
    const estadoGestionFilter = document.getElementById('estado-gestion-filter');
    const fechaInicioFilter = document.getElementById('fecha-inicio-filter');
    const fechaFinFilter = document.getElementById('fecha-fin-filter');

    const tbody = document.getElementById('reservas-tbody');
    const formEdit = document.getElementById('reserva-form-edit');
    const urlParams = new URLSearchParams(window.location.search);
    const reservaIdParaEditar = urlParams.get('reservaId');

    const getFiltros = () => ({
        busqueda: searchInput.value,
        carga: cargaFilter.value,
        canal: canalFilter.value,
        estado: estadoFilter.value,
        estadoGestion: estadoGestionFilter.value,
        fechaInicio: fechaInicioFilter.value,
        fechaFin: fechaFinFilter.value
    });
    
    renderTabla(getFiltros());

    [searchInput, cargaFilter, canalFilter, estadoFilter, estadoGestionFilter, fechaInicioFilter, fechaFinFilter].forEach(el => {
        el.addEventListener('input', () => renderTabla(getFiltros()));
    });
    
    document.getElementById('cancel-edit-btn').addEventListener('click', cerrarModalEditar);
    document.getElementById('close-view-btn').addEventListener('click', () => document.getElementById('reserva-modal-view').classList.add('hidden'));

    if (formEdit) {
        const monedaSelect = formEdit.querySelector('[name="moneda"]');
        const valorOriginalInput = formEdit.querySelector('[name="valorOriginal"]');
        const valorDolarInput = formEdit.querySelector('[name="valorDolarDia"]');
        
        monedaSelect.addEventListener('change', () => toggleDolarFields(formEdit));
        valorOriginalInput.addEventListener('input', () => calcularValorFinal(formEdit));
        valorDolarInput.addEventListener('input', () => calcularValorFinal(formEdit));

        formEdit.addEventListener('change', e => {
            if (e.target.classList.contains('doc-input')) {
                handleGestionarDocumento(editandoReserva.id, e.target.dataset.tipo, e.target.files[0], 'upload');
            }
        });
        formEdit.addEventListener('click', e => {
            if (e.target.classList.contains('delete-doc-btn')) {
                if (confirm('¿Seguro que quieres eliminar este documento?')) {
                    handleGestionarDocumento(editandoReserva.id, e.target.dataset.tipo, null, 'delete');
                }
            }
            if (e.target.id === 'add-pago-btn-edit') {
                document.getElementById('form-pago-container-edit').classList.toggle('hidden');
            }
        });
    }
    
    if (reservaIdParaEditar) {
        abrirModalEditar(reservaIdParaEditar);
    }

    tbody.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains('view-btn')) {
            abrirModalVer(id);
        }
        if (e.target.classList.contains('edit-btn')) {
            abrirModalEditar(id);
        }
        if (e.target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar esta reserva?')) {
                try {
                    await fetchAPI(`/reservas/${id}`, { method: 'DELETE' });
                    todasLasReservas = todasLasReservas.filter(r => r.id !== id);
                    renderTabla(getFiltros());
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });

    formEdit.addEventListener('submit', async(e) => {
        e.preventDefault();
        if (!editandoReserva) return;
        
        const idAntiguo = editandoReserva.idReservaCanal;
        const idNuevo = formEdit.idReservaCanal.value;

        if (idAntiguo !== idNuevo) {
            if (confirm(`Estás a punto de cambiar el ID de la reserva de "${idAntiguo}" a "${idNuevo}". Esto actualizará todas las referencias en cascada (pagos, notas, archivos). ¿Estás seguro?`)) {
                try {
                    const resultadoCascada = await fetchAPI(`/reservas/actualizar-id-canal/${editandoReserva.id}`, {
                        method: 'PUT',
                        body: { idAntiguo, idNuevo }
                    });
                    
                    const { firestore, storage } = resultadoCascada.summary;
                    let summaryText = '¡Actualización de ID en cascada completada!\n\n';
                    summaryText += 'Documentos actualizados en la base de datos:\n';
                    for (const [key, value] of Object.entries(firestore)) {
                        summaryText += `- ${key}: ${value} documento(s)\n`;
                    }
                    summaryText += `\nArchivos renombrados en Storage: ${storage.renombrados}\n`;
                    if (storage.errores > 0) {
                        summaryText += `Archivos con error al renombrar: ${storage.errores}\n`;
                    }
                    
                    alert(summaryText);

                } catch (error) {
                    alert(`Error crítico al actualizar el ID en cascada: ${error.message}`);
                    return;
                }
            } else {
                formEdit.idReservaCanal.value = idAntiguo;
                return;
            }
        }
        
        const datosReserva = {
            idReservaCanal: idNuevo,
            alojamientoId: formEdit.alojamientoId.value,
            clienteId: formEdit.clienteId.value,
            fechaLlegada: formEdit.fechaLlegada.value,
            fechaSalida: formEdit.fechaSalida.value,
            estado: formEdit.estado.value,
            estadoGestion: formEdit.estadoGestion.value || null,
            cantidadHuespedes: parseInt(formEdit.cantidadHuespedes.value) || 0,
        };

        try {
            await fetchAPI(`/reservas/${editandoReserva.id}`, { method: 'PUT', body: datosReserva });
            
            [todasLasReservas, clientes] = await Promise.all([fetchAPI('/reservas'), fetchAPI('/clientes')]);
            renderTabla(getFiltros());
            cerrarModalEditar();

            if (window.location.search.includes('reservaId')) {
                handleNavigation('/gestion-diaria');
            }
            
        } catch (error) {
            alert(`Error al guardar los cambios de la reserva: ${error.message}`);
        }
    });
}