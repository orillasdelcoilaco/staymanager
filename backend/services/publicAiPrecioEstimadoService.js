/**
 * Cotización por estadía para payloads de detalle IA (misma función que SSR /propiedad/:id/calcular-precio).
 * La orquestación vive en publicAiPrecioEstimadoCore.js para límites de complejidad.
 */
const { parseISO, isValid, format } = require('date-fns');
const { ejecutarCotizacionDetallePublico } = require('./publicAiPrecioEstimadoCore');

function parseStayDatesForAgentDetalle(query = {}) {
    const cin =
        query.checkin ||
        query.fechaLlegada ||
        query.fecha_inicio ||
        query.check_in ||
        query.fechaInicio;
    const cout =
        query.checkout ||
        query.fechaSalida ||
        query.fecha_fin ||
        query.check_out ||
        query.fechaFin;
    if (!cin || !cout) return null;
    const inicio = parseISO(String(cin).slice(0, 10) + 'T00:00:00Z');
    const fin = parseISO(String(cout).slice(0, 10) + 'T00:00:00Z');
    if (!isValid(inicio) || !isValid(fin) || inicio >= fin) return null;
    return {
        inicio,
        fin,
        checkin: format(inicio, 'yyyy-MM-dd'),
        checkout: format(fin, 'yyyy-MM-dd'),
    };
}

async function buildPrecioEstimadoDetallePublico(opts) {
    return ejecutarCotizacionDetallePublico(opts);
}

module.exports = {
    parseStayDatesForAgentDetalle,
    buildPrecioEstimadoDetallePublico,
};
