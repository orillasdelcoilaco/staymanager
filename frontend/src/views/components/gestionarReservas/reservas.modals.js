// frontend/src/views/components/gestionarReservas/reservas.modals.js

import { fetchAPI } from '../../../api.js';
import { formatDate, formatCurrency, formatStars, formatForeign, formatPercent } from './reservas.utils.js';

export function renderDocumentoLink(docUrl, defaultText = 'No adjunto') {
    if (!docUrl) return `<span class="text-gray-500">${defaultText}</span>`;
    if (docUrl === 'SIN_DOCUMENTO') return '<span class="font-semibold">Declarado sin documento</span>';
    return `<a href="${docUrl}" target="_blank" class="text-blue-600 hover:underline">Ver Documento</a>`;
}

export async function abrirModalVer(reservaId) {
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

export function toggleDolarFields(form) {
    const moneda = form.moneda.value;
    const dolarContainer = form.querySelector('#dolar-container');

    if (moneda === 'USD') {
        dolarContainer.style.display = 'grid';
    } else {
        dolarContainer.style.display = 'none';
    }
}

export function calcularValorFinal(form, source) {
    const valorDolar = parseFloat(form.valorDolarDia.value) || 0;
    const valorOriginalInput = form.querySelector('[name="valorOriginal"]');
    const valorTotalInput = form.querySelector('[name="valorTotal"]');

    if (form.moneda.value === 'USD' && valorDolar > 0) {
        if (source === 'original') {
            const valorOriginal = parseFloat(valorOriginalInput.value) || 0;
            valorTotalInput.value = Math.round(valorOriginal * valorDolar);
        } else {
            const valorTotal = parseFloat(valorTotalInput.value) || 0;
            valorOriginalInput.value = (valorTotal / valorDolar).toFixed(2);
        }
    }
}

export function renderizarGestorDocumento(form, tipo, docUrl) {
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

export async function handleGestionarDocumento(reservaId, tipo, archivo, accion, editandoReservaRef) {
    const formData = new FormData();
    formData.append('tipoDocumento', tipo);
    formData.append('accion', accion);
    if (archivo) {
        formData.append('documento', archivo);
    }
    
    try {
        const updatedReserva = await fetchAPI(`/reservas/${reservaId}/documento`, { method: 'POST', body: formData });
        
        const form = document.getElementById('reserva-form-edit');
        renderizarGestorDocumento(form, 'reserva', updatedReserva.documentos?.enlaceReserva);
        renderizarGestorDocumento(form, 'boleta', updatedReserva.documentos?.enlaceBoleta);
        
        return updatedReserva;
    } catch (error) {
        alert(`Error al gestionar el documento: ${error.message}`);
        throw error;
    }
}

export function renderizarListaTransacciones(form, transacciones) {
    const container = form.querySelector('#lista-transacciones-edit');

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

export async function abrirModalEditar(reservaId, alojamientos, clientes) {
    const modal = document.getElementById('reserva-modal-edit');
    const form = document.getElementById('reserva-form-edit');
    if (!modal || !form) return null;

    try {
        const editandoReserva = await fetchAPI(`/reservas/${reservaId}`);
        
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
        
        return editandoReserva;
    } catch (error) {
        alert(`Error al cargar los detalles de la reserva: ${error.message}`);
        return null;
    }
}

export function cerrarModalEditar() {
    document.getElementById('reserva-modal-edit').classList.add('hidden');
}