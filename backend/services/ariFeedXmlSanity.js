/**
 * Comprobaciones mínimas de forma sobre XML tipo OTA Transaction (feed ARI / listados).
 * No valida esquema XSD completo; sirve para smoke en CI sin base de datos.
 */
function assertAriTransactionWellFormed(xml) {
    const errors = [];
    if (typeof xml !== 'string' || !xml.trim()) {
        errors.push('empty');
        return { ok: false, errors };
    }
    const x = xml.trim();
    if (!/^<\?xml\s+version=["']1\.0["']/i.test(x)) errors.push('xml_declaration');
    if (!/<Transaction\b/i.test(x)) errors.push('Transaction_open');
    if (!/<\/Transaction>/i.test(x)) errors.push('Transaction_close');
    if (!/<Result\b/i.test(x)) errors.push('Result');
    return { ok: errors.length === 0, errors };
}

module.exports = { assertAriTransactionWellFormed };
