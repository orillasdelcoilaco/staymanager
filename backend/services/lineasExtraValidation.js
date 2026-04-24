/**
 * Definiciones de líneas extra en desglose de checkout (§4).
 * Mantener alineado con `frontend/src/shared/lineasExtraValidation.js` (misma lógica).
 */

const TIPOS_LINEA_EXTRA = new Set(['porcentaje_total', 'porcentaje_neto', 'monto_fijo', 'por_noche', 'por_persona_noche']);

const TIPOS_LINEA_EXTRA_LISTA = [...TIPOS_LINEA_EXTRA].join(', ');

/**
 * @param {object} row
 * @returns {object|null}
 */
function sanitizeLineaExtraDef(row) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const tipo = String(row.tipo || '').trim();
    if (!TIPOS_LINEA_EXTRA.has(tipo)) return null;
    const etiqueta = String(row.etiqueta || '').trim();
    const etiquetaEn = String(row.etiquetaEn || '').trim();
    if (!etiqueta && !etiquetaEn) return null;
    const out = { tipo, etiqueta, etiquetaEn };
    if (tipo === 'porcentaje_total' || tipo === 'porcentaje_neto') {
        out.porcentaje = Math.min(100, Math.max(0, Number(row.porcentaje) || 0));
        if (out.porcentaje <= 0) return null;
    }
    if (tipo === 'monto_fijo') {
        out.montoCLP = Math.max(0, Math.round(Number(row.montoCLP) || 0));
        if (out.montoCLP <= 0) return null;
    }
    if (tipo === 'por_noche') {
        const per = Number(row.montoPorNocheCLP ?? row.montoCLP);
        out.montoPorNocheCLP = Math.max(0, Math.round(per) || 0);
        if (out.montoPorNocheCLP <= 0) return null;
    }
    if (tipo === 'por_persona_noche') {
        const per = Number(row.montoPorPersonaNocheCLP ?? row.montoCLP);
        out.montoPorPersonaNocheCLP = Math.max(0, Math.round(per) || 0);
        if (out.montoPorPersonaNocheCLP <= 0) return null;
    }
    return out;
}

/**
 * @param {unknown} row
 * @returns {string|null} mensaje de error, o null si la fila pasa las comprobaciones locales (no debería coincidir con sanitize null).
 */
function lineaExtraRejectionReason(row) {
    if (Array.isArray(row)) return 'no uses un array como ítem; debe ser un objeto con "tipo".';
    if (!row || typeof row !== 'object') return 'cada ítem debe ser un objeto JSON.';
    const tipo = String(row.tipo || '').trim();
    if (!TIPOS_LINEA_EXTRA.has(tipo)) {
        return tipo
            ? `"tipo" no reconocido ("${tipo}"). Permitidos: ${TIPOS_LINEA_EXTRA_LISTA}.`
            : `falta "tipo" (${TIPOS_LINEA_EXTRA_LISTA}).`;
    }
    const etiqueta = String(row.etiqueta || '').trim();
    const etiquetaEn = String(row.etiquetaEn || '').trim();
    if (!etiqueta && !etiquetaEn) return 'añade "etiqueta" y/o "etiquetaEn".';
    if (tipo === 'porcentaje_total' || tipo === 'porcentaje_neto') {
        const raw = Number(row.porcentaje);
        if (!Number.isFinite(raw)) return '"porcentaje" debe ser un número.';
        const clamped = Math.min(100, Math.max(0, raw));
        if (clamped <= 0) return '"porcentaje" debe ser mayor que 0 (tope 100%).';
        return null;
    }
    if (tipo === 'monto_fijo') {
        const raw = Number(row.montoCLP);
        if (!Number.isFinite(raw)) return '"montoCLP" debe ser un número.';
        const m = Math.max(0, Math.round(raw));
        if (m <= 0) return '"montoCLP" debe ser mayor que 0.';
        return null;
    }
    if (tipo === 'por_noche') {
        const per = Number(row.montoPorNocheCLP ?? row.montoCLP);
        if (!Number.isFinite(per)) return 'usa "montoPorNocheCLP" (o "montoCLP") numérico.';
        const m = Math.max(0, Math.round(per) || 0);
        if (m <= 0) return '"montoPorNocheCLP" debe ser mayor que 0.';
        return null;
    }
    if (tipo === 'por_persona_noche') {
        const per = Number(row.montoPorPersonaNocheCLP ?? row.montoCLP);
        if (!Number.isFinite(per)) return 'usa "montoPorPersonaNocheCLP" (o "montoCLP") numérico.';
        const m = Math.max(0, Math.round(per) || 0);
        if (m <= 0) return '"montoPorPersonaNocheCLP" debe ser mayor que 0.';
        return null;
    }
    return 'definición no válida para este tipo.';
}

/**
 * Valida estrictamente el array enviado por el panel (sin filtrar filas inválidas en silencio).
 * @param {unknown} raw
 * @returns {{ ok: true, lineasExtra: object[] } | { ok: false, errors: string[] }}
 */
function validateLineasExtraArray(raw) {
    if (raw === undefined || raw === null) return { ok: true, lineasExtra: [] };
    if (!Array.isArray(raw)) {
        return { ok: false, errors: ['lineasExtra debe ser un array JSON (p. ej. []).'] };
    }
    const errors = [];
    const lineasExtra = [];
    for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        const s = sanitizeLineaExtraDef(row);
        if (s) lineasExtra.push(s);
        else {
            const msg = lineaExtraRejectionReason(row);
            errors.push(`Fila ${i + 1}: ${msg || 'no cumple el esquema de línea extra.'}`);
        }
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true, lineasExtra };
}

module.exports = {
    TIPOS_LINEA_EXTRA,
    sanitizeLineaExtraDef,
    validateLineasExtraArray,
};
