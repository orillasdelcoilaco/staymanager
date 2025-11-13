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

const formatForeign = (value, currency) => {
    if (!currency || currency === 'CLP') return formatCurrency(value);
    // Formatear a 2 decimales para monedas extranjeras
    return `${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

const formatPercent = (value) => {
    if (!value || value === 0) return '0%';
    return `${value.toFixed(1)}%`;
};

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
    contentEl.classList.add('hidden');
    document.getElementById('view-loading-state').classList.remove('hidden');

    try {
        const data = await fetchAPI(`/reservas/${reservaId}`);
        
        const infoGrupoEl = document.getElementById('view-info-grupo');
        if (data.datosGrupo && data.datosGrupo.propiedades.length > 1) {
            infoGrupoEl.innerHTML = `
                <div class="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm mb-4">
                    <p>Esta reserva es parte de un grupo de <strong>${data.datosGrupo.propiedades.length} propiedades</strong> (${data.datosGrupo.propiedades.join(', ')}).</p>
                    <p class="font-semibold">Valor Total del Grupo: ${formatCurrency(data.datosGrupo.valorTotal)} | Abonado: ${formatCurrency(data.datosGrupo.abonoTotal)} | Saldo: ${formatCurrency(data.datosGrupo.saldo)}</p>
                </div>`;
            infoGrupoEl.classList.remove('hidden');
        } else {
            infoGrupoEl.classList.add('hidden');
        }

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
        
        
        const { datosIndividuales } = data;
        const moneda = datosIndividuales.moneda || 'CLP';
        const esMonedaExtranjera = moneda !== 'CLP';
        const noches = data.totalNoches > 0 ? data.totalNoches : 1;

        const createRow = (label, clpValue, usdValue = null, isBold = false) => {
            const clpFormatted = formatCurrency(clpValue);
            const usdFormatted = esMonedaExtranjera ? formatForeign(usdValue, moneda) : '';
            const boldClass = isBold ? 'font-bold' : '';
            return `
                <tr class="border-b ${boldClass}">
                    <td class="py-1 pr-4">${label}</td>
                    ${esMonedaExtranjera ? `<td class="py-1 pr-4 text-right">${usdFormatted}</td>` : ''}
                    <td class="py-1 text-right ${boldClass}">${clpFormatted}</td>
                </tr>
            `;
        };
        
        const createHeader = () => {
             return `
                <thead class="bg-gray-50">
                    <tr class="text-gray-600">
                        <th class="py-2 pr-4 text-left font-semibold">Concepto</th>
                        ${esMonedaExtranjera ? `<th class="py-2 pr-4 text-right font-semibold">Moneda Original (${moneda})</th>` : ''}
                        <th class="py-2 text-right font-semibold">${esMonedaExtranjera ? 'Conversión (CLP)' : 'Valor (CLP)'}</th>
                    </tr>
                </thead>`;
        };

        const desgloseEl = document.getElementById('view-desglose-valores');
        let desgloseHTML = '<table class="w-full">_HEADER_<tbody>_ROWS_</tbody></table>';
        let desgloseRows = '';
        
        const subtotalCLP = (datosIndividuales.payoutFinalReal || 0) + (datosIndividuales.comision || 0);
        const subtotalUSD = (datosIndividuales.valorTotalOriginal || 0) + (datosIndividuales.comisionOriginal || 0);

        desgloseRows += createRow('Payout (Anfitrión)', datosIndividuales.payoutFinalReal, datosIndividuales.valorTotalOriginal, true);
        desgloseRows += createRow('(+) Comisión (Sumable)', datosIndividuales.comision, datosIndividuales.comisionOriginal);
        desgloseRows += createRow('(=) Subtotal (Base IVA)', subtotalCLP, subtotalUSD);
        desgloseRows += createRow('(+) IVA (Calculado)', datosIndividuales.iva, datosIndividuales.ivaOriginal);
        desgloseRows += createRow('Total Cliente (A)', datosIndividuales.valorTotalHuesped, datosIndividuales.valorHuespedOriginal, true);
        desgloseRows += createRow('(Info) Costo Canal', datosIndividuales.costoCanal, datosIndividuales.costoCanalOriginal);
        desgloseRows += createRow('Valor Noche (Canal)', (datosIndividuales.valorTotalHuesped / noches), (datosIndividuales.valorHuespedOriginal / noches));
        
        desgloseEl.innerHTML = desgloseHTML.replace('_HEADER_', createHeader()).replace('_ROWS_', desgloseRows);

        const cobranzaEl = document.getElementById('view-analisis-cobranza');
        let cobranzaHTML = '<table class="w-full">_HEADER_<tbody>_ROWS_</tbody></table>';
        let cobranzaRows = '';
        cobranzaRows += createRow('Total Cliente (A)', datosIndividuales.valorTotalHuesped, datosIndividuales.valorHuespedOriginal, true);
        cobranzaRows += createRow('(-) Abonos Recibidos', datosIndividuales.abonoProporcional, 0);
        
        let saldoUSD = datosIndividuales.valorHuespedOriginal;
        if(datosIndividuales.valorDolarUsado > 0 && datosIndividuales.abonoProporcional > 0) {
             saldoUSD = datosIndividuales.valorHuespedOriginal - (datosIndividuales.abonoProporcional / datosIndividuales.valorDolarUsado);
        }
        cobranzaRows += createRow('Saldo Pendiente', datosIndividuales.saldo, saldoUSD, true);
        
        if (esMonedaExtranjera && datosIndividuales.valorDolarUsado) {
            let etiquetaDolar = `(Flotante)`;
            if (datosIndividuales.esValorFijo) {
                etiquetaDolar = `(Fijo al ${formatDate(data.fechaLlegada)})`;
            }
            cobranzaRows += `<tr class="border-t"><td class="pt-2 text-gray-500" colspan="3">Valor Dólar Usado: ${formatCurrency(datosIndividuales.valorDolarUsado)} ${etiquetaDolar}</td></tr>`;
        }
        cobranzaEl.innerHTML = cobranzaHTML.replace('_HEADER_', createHeader()).replace('_ROWS_', cobranzaRows);

        const kpiEl = document.getElementById('view-analisis-kpi');
        let kpiHTML = '<table class="w-full">_HEADER_<tbody>_ROWS_</tbody></table>';
        let kpiRows = '';
        
        const kpiAnclaCLP = datosIndividuales.valorPotencialOriginal_DB;
        const kpiAnclaUSD = (esMonedaExtranjera && datosIndividuales.valorDolarUsado > 0) 
            ? (kpiAnclaCLP / datosIndividuales.valorDolarUsado) 
            : (datosIndividuales.valorDolarUsado > 0 ? (kpiAnclaCLP / datosIndividuales.valorDolarUsado) : 0);

        kpiRows += createRow('Valor Tarifa Base (KPI)', kpiAnclaCLP, kpiAnclaUSD);
        
        kpiRows += createRow('(-) Total Cliente (A)', datosIndividuales.valorTotalHuesped, datosIndividuales.valorHuespedOriginal);
        kpiRows += createRow('Valor Potencial (Pérdida)', datosIndividuales.valorPotencial, (datosIndividuales.valorPotencial / (datosIndividuales.valorDolarUsado || 1)), true);
        kpiRows += `<tr class="border-t"><td class="pt-2 text-gray-500" colspan="3">Descuento Potencial: <span class="font-bold text-red-600">${formatPercent(datosIndividuales.descuentoPotencialPct)}</span></td></tr>`;

        kpiEl.innerHTML = kpiHTML.replace('_HEADER_', createHeader()).replace('_ROWS_', kpiRows);
        
        const historialEl = document.getElementById('view-historial-ajustes');
        const anclaUSD = datosIndividuales.valorOriginalCalculado;
        const historialAjustes = datosIndividuales.historialAjustes;
        
        let dolarAncla = (historialAjustes.length > 0 ? historialAjustes[0].valorDolarUsado : datosIndividuales.valorDolarUsado);
        if (moneda === 'CLP' && !dolarAncla && historialAjustes.length > 0) {
             dolarAncla = historialAjustes[0].valorDolarUsado || 950;
        } else if (moneda === 'CLP' && !dolarAncla) {
             dolarAncla = 950;
        } else if (!dolarAncla) {
             dolarAncla = 1;
        }
       
        const anclaCLP = (moneda === 'CLP') 
            ? datosIndividuales.valorPotencialOriginal_DB
            : anclaUSD * dolarAncla;

        let historialHTML = `
            <table class="w-full text-left text-xs">
                <thead class="bg-gray-50 text-gray-600">
                    <tr>
                        <th class="py-2 px-2">Fecha</th>
                        <th class="py-2 px-2">Fuente</th>
                        <th class="py-2 px-2">Usuario</th>
                        ${esMonedaExtranjera ? `
                            <th class="py-2 px-2 text-right">Valor Anterior (USD)</th>
                            <th class="py-2 px-2 text-right">Valor Nuevo (USD)</th>
                            <th class="py-2 px-2 text-right">Ajuste (USD)</th>
                        ` : `
                            <th class="py-2 px-2 text-right">Valor Anterior (CLP)</th>
                            <th class="py-2 px-2 text-right">Valor Nuevo (CLP)</th>
                            <th class="py-2 px-2 text-right">Ajuste (CLP)</th>
                        `}
                    </tr>
                </thead>
                <tbody>
        `;
        
        historialHTML += `
            <tr class="border-b bg-gray-50 font-semibold">
                <td class="py-2 px-2" colspan="3">Valor Original (Ancla)</td>
                ${esMonedaExtranjera ? `
                    <td class="py-2 px-2 text-right">${formatForeign(anclaUSD, moneda)}</td>
                    <td class="py-2 px-2 text-right">${formatCurrency(anclaCLP)}</td>
                    <td class="py-2 px-2 text-right"></td>
                ` : `
                    <td class="py-2 px-2 text-right">${formatCurrency(anclaCLP)}</td>
                    <td class="py-2 px-2 text-right"></td>
                    <td class="py-2 px-2 text-right"></td>
                `}
            </tr>
        `;

        if (historialAjustes.length === 0) {
            historialHTML += `<tr><td colspan="6" class="py-3 px-2 text-center text-gray-500">No hay ajustes manuales registrados.</td></tr>`;
        } else {
            historialAjustes.forEach(log => {
                const dolarParaCalculo = log.valorDolarUsado || 1;
                const ajusteColor = log.ajusteUSD > 0 ? 'text-green-600' : 'text-red-600';
                
                if (esMonedaExtranjera) {
                    const anteriorCLP = log.valorAnteriorUSD * dolarParaCalculo;
                    const nuevoCLP = log.valorNuevoUSD * dolarParaCalculo;
                    const ajusteCLP = log.ajusteUSD * dolarParaCalculo;
                    
                    historialHTML += `
                        <tr class="border-b">
                            <td class="py-2 px-2">${log.fecha}</td>
                            <td class="py-2 px-2">${log.fuente}</td>
                            <td class="py-2 px-2">${log.usuarioEmail.split('@')[0]}</td>
                            <td class="py-2 px-2 text-right">${formatForeign(log.valorAnteriorUSD, moneda)}<br><span class="text-gray-500">${formatCurrency(anteriorCLP)}</span></td>
                            <td class="py-2 px-2 text-right">${formatForeign(log.valorNuevoUSD, moneda)}<br><span class="text-gray-500">${formatCurrency(nuevoCLP)}</span></td>
                            <td class="py-2 px-2 text-right font-medium ${ajusteColor}">${formatForeign(log.ajusteUSD, moneda)}<br><span class="text-gray-500">${formatCurrency(ajusteCLP)}</span></td>
                        </tr>
                    `;
                } else {
                    const anteriorCLP = log.valorAnteriorUSD * dolarParaCalculo;
                    const nuevoCLP = log.valorNuevoUSD * dolarParaCalculo;
                    const ajusteCLP = log.ajusteUSD * dolarParaCalculo;
                    
                    historialHTML += `
                        <tr class="border-b">
                            <td class="py-2 px-2">${log.fecha}</td>
                            <td class="py-2 px-2">${log.fuente}</td>
                            <td class="py-2 px-2">${log.usuarioEmail.split('@')[0]}</td>
                            <td class="py-2 px-2 text-right">${formatCurrency(anteriorCLP)}</td>
                            <td class="py-2 px-2 text-right">${formatCurrency(nuevoCLP)}</td>
                            <td class="py-2 px-2 text-right font-medium ${ajusteColor}">${formatCurrency(ajusteCLP)}</td>
                        </tr>
                    `;
                }
            });
        }
        
        historialHTML += `
            <tr class="border-t bg-gray-100 font-bold">
                <td class="py-2 px-2" colspan="3">Valor Actual (Total Cliente)</td>
                ${esMonedaExtranjera ? `
                    <td class="py-2 px-2 text-right">${formatForeign(datosIndividuales.valorHuespedOriginal, moneda)}</td>
                    <td class="py-2 px-2 text-right">${formatCurrency(datosIndividuales.valorTotalHuesped)}</td>
                    <td class="py-2 px-2 text-right"></td>
                ` : `
                    <td class="py-2 px-2 text-right">${formatCurrency(datosIndividuales.valorTotalHuesped)}</td>
                    <td class="py-2 px-2 text-right"></td>
                    <td class="py-2 px-2 text-right"></td>
                `}
            </tr>
        `;
        
        historialHTML += `</tbody></table>`;
        historialEl.innerHTML = historialHTML;

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

function calcularValorFinal(form, source) {
    const valorDolar = parseFloat(form.valorDolarDia.value) || 0;
    const valorOriginalInput = form.querySelector('[name="valorOriginal"]');
    const valorTotalInput = form.querySelector('[name="valorTotal"]');

    if (form.moneda.value === 'USD' && valorDolar > 0) {
        if (source === 'original') {
            const valorOriginal = parseFloat(valorOriginalInput.value) || 0;
            valorTotalInput.value = Math.round(valorOriginal * valorDolar);
        } else { // source === 'total' or 'dolar'
            const valorTotal = parseFloat(valorTotalInput.value) || 0;
            valorOriginalInput.value = (valorTotal / valorDolar).toFixed(2);
        }
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
        
        const resumenGrupoEl = document.getElementById('resumen-grupo-container');
        if (editandoReserva.datosGrupo.propiedades.length > 1) {
            resumenGrupoEl.innerHTML = `
                <div class="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
                    <p>Esta reserva es parte de un grupo de <strong>${editandoReserva.datosGrupo.propiedades.length} propiedades</strong> (${editandoReserva.datosGrupo.propiedades.join(', ')}).</p>
                    <p>Valor Total del Grupo: <strong>${formatCurrency(editandoReserva.datosGrupo.valorTotal)}</strong></p>
                </div>`;
            resumenGrupoEl.classList.remove('hidden');
        } else {
            resumenGrupoEl.classList.add('hidden');
        }

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
        form.valorTotal.value = editandoReserva.datosIndividuales?.valorTotalHuesped || 0;
        form.valorDolarDia.value = editandoReserva.datosIndividuales?.valorDolarUsado || '';
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
            <div id="resumen-grupo-container" class="hidden mb-4"></div>
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

                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Montos (Individual)</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label for="moneda" class="label">Moneda</label><select name="moneda" class="form-select"><option value="CLP">CLP</option><option value="USD">USD</option></select></div>
                        <div><label for="valorOriginal" class="label">Valor Original (KPI)</label><input type="number" name="valorOriginal" step="0.01" class="form-input"></div>
                        <div><label for="valorTotal" class="label">Valor Final (Huésped CLP)</label><input type="number" name="valorTotal" step="1" class="form-input"></div>
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
                        <section>
                            <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">📈 Desglose de Valores (Fuente de la Verdad)</h4>
                            <div id="view-desglose-valores" class="overflow-x-auto text-sm"></div>
                        </section>
                        <section>
                            <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">💸 Análisis de Cobranza (Saldos)</h4>
                            <div id="view-analisis-cobranza" class="overflow-x-auto text-sm"></div>
                        </section>
                        <section>
                            <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">📊 Análisis de Rentabilidad (KPI)</h4>
                            <div id="view-analisis-kpi" class="overflow-x-auto text-sm"></div>
                        </section>
                        <section>
                            <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">✏️ Historial de Ajustes (Trazabilidad)</h4>
                            <div id="view-historial-ajustes" class="overflow-x-auto text-sm">
                            </div>
                        </section>
                        <section>
                            <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Transacciones y Pagos (Grupo)</h4>
                            <div id="view-transacciones-list" class="space-y-2 text-sm max-h-40 overflow-y-auto"></div>
                        </section>
                        <section>
                            <h4 class="font-semibold text-gray-800 border-b pb-1 mb-2">Bitácora de Gestión (Grupo)</h4>
                            <div id="view-notas-list" class="space-y-2 text-xs max-h-40 overflow-y-auto"></div>
                        </section>
                    </div>
                </div>
            </div>
        </div>

        <div id="modal-confirmar-borrado-grupo" class="modal hidden">
            <div class="modal-content !max-w-lg">
                <h3 class="text-xl font-semibold text-red-700 mb-4">⚠️ ¡Advertencia! Reserva con Datos Vinculados</h3>
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
        const valorTotalInput = formEdit.querySelector('[name="valorTotal"]');
        const valorDolarInput = formEdit.querySelector('[name="valorDolarDia"]');
        
        monedaSelect.addEventListener('change', () => toggleDolarFields(formEdit));
        valorOriginalInput.addEventListener('input', () => calcularValorFinal(formEdit, 'original'));
        valorTotalInput.addEventListener('input', () => calcularValorFinal(formEdit, 'total'));
        valorDolarInput.addEventListener('input', () => calcularValorFinal(formEdit, 'dolar'));

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
            const reserva = todasLasReservas.find(r => r.id === id);
            if (!reserva) return;
            
            const grupoReservas = todasLasReservas.filter(r => r.idReservaCanal === reserva.idReservaCanal);
            
            if (grupoReservas.length <= 1) {
                if (!confirm(`¿Estás seguro de que quieres eliminar esta reserva (${reserva.alojamientoNombre})?\n\nSe borrarán también todos sus pagos, notas y documentos asociados (si existen).`)) {
                    return;
                }
            }

            try {
                await fetchAPI(`/reservas/${id}`, { method: 'DELETE' });
                
                todasLasReservas = todasLasReservas.filter(r => r.id !== id);
                renderTabla(getFiltros());
                alert('Reserva individual eliminada con éxito.');

            } catch (error) {
                if (error.status === 409 && error.data) {
                    const { idReservaCanal, grupoInfo, message } = error.data;
                    
                    const modal = document.getElementById('modal-confirmar-borrado-grupo');
                    const infoEl = modal.querySelector('#borrado-grupo-info');
                    const listaEl = modal.querySelector('#borrado-grupo-lista');
                    const confirmBtn = modal.querySelector('#borrado-grupo-confirmar');
                    
                    infoEl.querySelector('p').textContent = message;
                    listaEl.innerHTML = grupoInfo.map(r => 
                        `<p class="text-sm">${r.nombre} (${formatCurrency(r.valor)})</p>`
                    ).join('');
                    
                    confirmBtn.dataset.idReservaCanal = idReservaCanal;
                    modal.classList.remove('hidden');
                } else {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });

    document.getElementById('borrado-grupo-cancelar').addEventListener('click', () => {
        document.getElementById('modal-confirmar-borrado-grupo').classList.add('hidden');
    });

    document.getElementById('borrado-grupo-confirmar').addEventListener('click', async (e) => {
        const idReservaCanal = e.target.dataset.idReservaCanal;
        if (!idReservaCanal) return;
        
        e.target.disabled = true;
        e.target.textContent = 'Eliminando...';

        try {
            await fetchAPI('/reservas/grupo/eliminar', {
                method: 'POST',
                body: { idReservaCanal }
            });

            todasLasReservas = todasLasReservas.filter(r => r.idReservaCanal !== idReservaCanal);
            renderTabla(getFiltros());
            document.getElementById('modal-confirmar-borrado-grupo').classList.add('hidden');
            alert('¡Grupo completo eliminado con éxito!');

        } catch (error) {
            alert(`Error al borrar el grupo: ${error.message}`);
        } finally {
            e.target.disabled = false;
            e.target.textContent = 'Sí, Borrar Grupo Completo';
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
            moneda: formEdit.moneda.value,
            valorDolarDia: parseFloat(formEdit.valorDolarDia.value) || null,
            valores: {
                ...editandoReserva.valores,
                valorOriginal: parseFloat(formEdit.valorOriginal.value) || 0,
                valorHuesped: Math.round(parseFloat(formEdit.valorTotal.value)) || 0
            }
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
