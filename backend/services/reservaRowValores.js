/**
 * Normaliza `reservas.valores` (PG json/jsonb puede llegar como objeto o string).
 */

function parseValoresReservaRow(valores) {
    if (valores == null || valores === '') return {};
    if (typeof valores === 'string') {
        try {
            const o = JSON.parse(valores);
            return o && typeof o === 'object' ? o : {};
        } catch {
            return {};
        }
    }
    if (typeof valores === 'object') return valores;
    return {};
}

/**
 * Total huésped persistido: `valores.valorHuesped`, con respaldo desde `metadata.precioCheckoutVerificado`.
 */
function precioFinalDesdeReservaPgRow(resRow, metaRes) {
    const v = parseValoresReservaRow(resRow && resRow.valores);
    let p = Number(v.valorHuesped);
    if (Number.isFinite(p) && p > 0) return p;
    const pv = metaRes && typeof metaRes === 'object' ? metaRes.precioCheckoutVerificado : null;
    if (pv && typeof pv === 'object') {
        const pe = Number(pv.precioEnviadoCLP);
        if (Number.isFinite(pe) && pe > 0) return pe;
        const te = Number(pv.totalEsperadoCLP);
        if (Number.isFinite(te) && te > 0) return te;
    }
    return Number.isFinite(p) ? p : 0;
}

module.exports = { parseValoresReservaRow, precioFinalDesdeReservaPgRow };
