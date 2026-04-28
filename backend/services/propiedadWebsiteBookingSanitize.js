/**
 * Normaliza y valida `websiteData.booking` a nivel alojamiento.
 * A diferencia de websiteSettings.booking (empresa), aquí los campos son opcionales:
 * solo se persisten si vienen explícitos en el payload.
 */

function _toIntOrNull(v) {
    const n = parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) ? n : null;
}

function _clampOptionalInt(v, min, max) {
    const n = _toIntOrNull(v);
    if (n == null) return undefined;
    return Math.min(max, Math.max(min, n));
}

function _sanitizeDiasSemanaLlegadaPermitidos(raw) {
    if (!Array.isArray(raw)) return undefined;
    const out = [];
    for (const d of raw) {
        const n = _toIntOrNull(d);
        if (n != null && n >= 0 && n <= 6) out.push(n);
    }
    return Array.from(new Set(out));
}

/**
 * @param {object} incoming websiteData.booking incoming
 * @returns {{ ok: true, booking: object } | { ok: false, errors: string[] }}
 */
function sanitizePropertyWebsiteBookingIncoming(incoming) {
    if (incoming == null || typeof incoming !== 'object') {
        return { ok: true, booking: {} };
    }

    const errors = [];
    const out = {};

    const minNoches = _clampOptionalInt(incoming.minNoches, 1, 365);
    if (minNoches !== undefined) out.minNoches = minNoches;

    const maxNochesEstadia = _clampOptionalInt(incoming.maxNochesEstadia, 0, 365);
    if (maxNochesEstadia !== undefined) out.maxNochesEstadia = maxNochesEstadia;

    const minDiasAnticipacionReserva = _clampOptionalInt(incoming.minDiasAnticipacionReserva, 0, 365);
    if (minDiasAnticipacionReserva !== undefined) out.minDiasAnticipacionReserva = minDiasAnticipacionReserva;

    const mesesReservableAdelante = _clampOptionalInt(incoming.mesesReservableAdelante, 0, 120);
    if (mesesReservableAdelante !== undefined) out.mesesReservableAdelante = mesesReservableAdelante;

    const diasSemanaLlegadaPermitidos = _sanitizeDiasSemanaLlegadaPermitidos(incoming.diasSemanaLlegadaPermitidos);
    if (diasSemanaLlegadaPermitidos !== undefined) out.diasSemanaLlegadaPermitidos = diasSemanaLlegadaPermitidos;

    if (
        out.maxNochesEstadia !== undefined &&
        out.maxNochesEstadia > 0 &&
        out.minNoches !== undefined &&
        out.maxNochesEstadia < out.minNoches
    ) {
        errors.push(
            `Estadía máxima (${out.maxNochesEstadia} noche(s)) no puede ser menor que la mínima (${out.minNoches}).`,
        );
    }

    if (errors.length) return { ok: false, errors };
    return { ok: true, booking: out };
}

module.exports = { sanitizePropertyWebsiteBookingIncoming };
