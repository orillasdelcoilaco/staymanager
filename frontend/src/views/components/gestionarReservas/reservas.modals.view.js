// reservas.modals.view.js — Modal de visualización de detalle de reserva (solo lectura)

import { fetchAPI } from '../../../api.js';
import { formatDate, formatCurrency, formatStars, formatForeign, formatPercent } from './reservas.utils.js';

export function renderDocumentoLink(docUrl, defaultText = 'No adjunto') {
    if (!docUrl) return `<span class="text-gray-500">${defaultText}</span>`;
    if (docUrl === 'SIN_DOCUMENTO') return '<span class="font-semibold">Declarado sin documento</span>';
    return `<a href="${docUrl}" target="_blank" class="text-primary-600 hover:underline">Ver Documento</a>`;
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
                <div class="p-3 bg-primary-50 border border-primary-200 rounded-md text-sm mb-4">
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

        const createHeader = () => `
            <thead class="bg-gray-50">
                <tr class="text-gray-600">
                    <th class="py-2 pr-4 text-left font-semibold">Concepto</th>
                    ${esMonedaExtranjera ? `<th class="py-2 pr-4 text-right font-semibold">Moneda Original (${moneda})</th>` : ''}
                    <th class="py-2 text-right font-semibold">${esMonedaExtranjera ? 'Conversión (CLP)' : 'Valor (CLP)'}</th>
                </tr>
            </thead>`;

        const buildTable = (rows) =>
            `<table class="w-full">${createHeader()}<tbody>${rows}</tbody></table>`;

        // Desglose de valores
        const subtotalCLP = (datosIndividuales.payoutFinalReal || 0) + (datosIndividuales.comision || 0);
        const subtotalUSD = (datosIndividuales.valorTotalOriginal || 0) + (datosIndividuales.comisionOriginal || 0);
        let desgloseRows = '';
        desgloseRows += createRow('Payout (Anfitrión)', datosIndividuales.payoutFinalReal, datosIndividuales.valorTotalOriginal, true);
        desgloseRows += createRow('(+) Comisión (Sumable)', datosIndividuales.comision, datosIndividuales.comisionOriginal);
        desgloseRows += createRow('(=) Subtotal (Base IVA)', subtotalCLP, subtotalUSD);
        desgloseRows += createRow('(+) IVA (Calculado)', datosIndividuales.iva, datosIndividuales.ivaOriginal);
        desgloseRows += createRow('Total Cliente (A)', datosIndividuales.valorTotalHuesped, datosIndividuales.valorHuespedOriginal, true);
        desgloseRows += createRow('(Info) Costo Canal', datosIndividuales.costoCanal, datosIndividuales.costoCanalOriginal);
        desgloseRows += createRow('Valor Noche (Canal)', (datosIndividuales.valorTotalHuesped / noches), (datosIndividuales.valorHuespedOriginal / noches));
        document.getElementById('view-desglose-valores').innerHTML = buildTable(desgloseRows);

        // Cobranza
        let cobranzaRows = '';
        cobranzaRows += createRow('Total Cliente (A)', datosIndividuales.valorTotalHuesped, datosIndividuales.valorHuespedOriginal, true);
        cobranzaRows += createRow('(-) Abonos Recibidos', datosIndividuales.abonoProporcional, 0);
        let saldoUSD = datosIndividuales.valorHuespedOriginal;
        if (datosIndividuales.valorDolarUsado > 0 && datosIndividuales.abonoProporcional > 0) {
            saldoUSD = datosIndividuales.valorHuespedOriginal - (datosIndividuales.abonoProporcional / datosIndividuales.valorDolarUsado);
        }
        cobranzaRows += createRow('Saldo Pendiente', datosIndividuales.saldo, saldoUSD, true);
        if (esMonedaExtranjera && datosIndividuales.valorDolarUsado) {
            const etiquetaDolar = datosIndividuales.esValorFijo
                ? `(Fijo al ${formatDate(data.fechaLlegada)})`
                : `(Flotante)`;
            cobranzaRows += `<tr class="border-t"><td class="pt-2 text-gray-500" colspan="3">Valor Dólar Usado: ${formatCurrency(datosIndividuales.valorDolarUsado)} ${etiquetaDolar}</td></tr>`;
        }
        document.getElementById('view-analisis-cobranza').innerHTML = buildTable(cobranzaRows);

        // KPI
        const kpiAnclaCLP = datosIndividuales.valorPotencialOriginal_DB;
        const kpiAnclaUSD = (esMonedaExtranjera && datosIndividuales.valorDolarUsado > 0)
            ? (kpiAnclaCLP / datosIndividuales.valorDolarUsado)
            : (datosIndividuales.valorDolarUsado > 0 ? (kpiAnclaCLP / datosIndividuales.valorDolarUsado) : 0);
        let kpiRows = '';
        kpiRows += createRow('Valor Tarifa Base (KPI)', kpiAnclaCLP, kpiAnclaUSD);
        kpiRows += createRow('(-) Total Cliente (A)', datosIndividuales.valorTotalHuesped, datosIndividuales.valorHuespedOriginal);
        kpiRows += createRow('Valor Potencial (Pérdida)', datosIndividuales.valorPotencial, (datosIndividuales.valorPotencial / (datosIndividuales.valorDolarUsado || 1)), true);
        kpiRows += `<tr class="border-t"><td class="pt-2 text-gray-500" colspan="3">Descuento Potencial: <span class="font-bold text-danger-600">${formatPercent(datosIndividuales.descuentoPotencialPct)}</span></td></tr>`;
        document.getElementById('view-analisis-kpi').innerHTML = buildTable(kpiRows);

        // Historial de ajustes
        const anclaUSD = datosIndividuales.valorOriginalCalculado;
        const historialAjustes = datosIndividuales.historialAjustes;
        let dolarAncla = (historialAjustes.length > 0 ? historialAjustes[0].valorDolarUsado : datosIndividuales.valorDolarUsado);
        if (moneda === 'CLP' && !dolarAncla && historialAjustes.length > 0) dolarAncla = historialAjustes[0].valorDolarUsado || 950;
        else if (moneda === 'CLP' && !dolarAncla) dolarAncla = 950;
        else if (!dolarAncla) dolarAncla = 1;
        const anclaCLP = (moneda === 'CLP') ? datosIndividuales.valorPotencialOriginal_DB : anclaUSD * dolarAncla;

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
            </tr>`;

        if (historialAjustes.length === 0) {
            historialHTML += `<tr><td colspan="6" class="py-3 px-2 text-center text-gray-500">No hay ajustes manuales registrados.</td></tr>`;
        } else {
            historialAjustes.forEach(log => {
                const dolarParaCalculo = log.valorDolarUsado || 1;
                const ajusteColor = log.ajusteUSD > 0 ? 'text-success-600' : 'text-danger-600';
                const anteriorCLP = log.valorAnteriorUSD * dolarParaCalculo;
                const nuevoCLP    = log.valorNuevoUSD * dolarParaCalculo;
                const ajusteCLP   = log.ajusteUSD * dolarParaCalculo;
                historialHTML += `
                    <tr class="border-b">
                        <td class="py-2 px-2">${log.fecha}</td>
                        <td class="py-2 px-2">${log.fuente}</td>
                        <td class="py-2 px-2">${log.usuarioEmail.split('@')[0]}</td>
                        ${esMonedaExtranjera ? `
                            <td class="py-2 px-2 text-right">${formatForeign(log.valorAnteriorUSD, moneda)}<br><span class="text-gray-500">${formatCurrency(anteriorCLP)}</span></td>
                            <td class="py-2 px-2 text-right">${formatForeign(log.valorNuevoUSD, moneda)}<br><span class="text-gray-500">${formatCurrency(nuevoCLP)}</span></td>
                            <td class="py-2 px-2 text-right font-medium ${ajusteColor}">${formatForeign(log.ajusteUSD, moneda)}<br><span class="text-gray-500">${formatCurrency(ajusteCLP)}</span></td>
                        ` : `
                            <td class="py-2 px-2 text-right">${formatCurrency(anteriorCLP)}</td>
                            <td class="py-2 px-2 text-right">${formatCurrency(nuevoCLP)}</td>
                            <td class="py-2 px-2 text-right font-medium ${ajusteColor}">${formatCurrency(ajusteCLP)}</td>
                        `}
                    </tr>`;
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
            </tbody></table>`;
        document.getElementById('view-historial-ajustes').innerHTML = historialHTML;

        // Transacciones
        const transaccionesContainer = document.getElementById('view-transacciones-list');
        transaccionesContainer.innerHTML = data.transacciones.length > 0
            ? data.transacciones.map(t => `
                <div class="bg-gray-50 p-2 rounded grid grid-cols-4 gap-2 items-center">
                    <span>${t.tipo}</span>
                    <span class="font-semibold">${formatCurrency(t.monto)}</span>
                    <span>${t.medioDePago}</span>
                    <div>${renderDocumentoLink(t.enlaceComprobante, 'Sin comprobante')}</div>
                </div>`).join('')
            : '<p class="text-gray-500">No hay transacciones registradas.</p>';

        // Notas
        const notasContainer = document.getElementById('view-notas-list');
        notasContainer.innerHTML = data.notas.length > 0
            ? data.notas.map(n => `
                <div class="bg-gray-50 p-2 rounded">
                    <p class="whitespace-pre-wrap">${n.texto}</p>
                    <p class="text-gray-500 text-right">-- ${n.autor} el ${n.fecha}</p>
                </div>`).join('')
            : '<p class="text-gray-500">Sin notas en la bitácora.</p>';

        contentEl.classList.remove('hidden');
    } catch (error) {
        document.getElementById('view-loading-state').innerHTML =
            `<p class="text-danger-500 text-center">Error al cargar los detalles: ${error.message}</p>`;
    } finally {
        if (!contentEl.classList.contains('hidden')) {
            document.getElementById('view-loading-state').classList.add('hidden');
        }
    }
}
