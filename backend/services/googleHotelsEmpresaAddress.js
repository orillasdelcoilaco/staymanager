/**
 * Dirección Google Hotels: por propiedad o fallback empresa (complejo / hotel).
 * TASKS/venta-ia.md §7 — mismo criterio que negocio "una sede" en Configuración Empresa.
 */
function _safeObj(v) {
    return v && typeof v === 'object' ? v : {};
}

function _hasText(v) {
    return String(v || '').trim().length > 0;
}

function guessCountryCodeFromPais(pais) {
    const p = String(pais || '').trim().toLowerCase();
    if (!p) return '';
    const map = {
        chile: 'CL',
        argentina: 'AR',
        peru: 'PE',
        perú: 'PE',
        uruguay: 'UY',
        colombia: 'CO',
        mexico: 'MX',
        méxico: 'MX',
        bolivia: 'BO',
        ecuador: 'EC',
    };
    if (map[p]) return map[p];
    if (p.length === 2) return p.toUpperCase();
    return '';
}

/**
 * @param {{ googleHotelData?: object }|null} propiedad
 * @param {object} empresaConfig - empresas.configuracion
 * @returns {{ street: string, city: string, countryCode: string, province: string, postalCode: string }|null}
 */
function resolveEffectiveGoogleHotelsAddress(propiedad, empresaConfig) {
    const cfg = _safeObj(empresaConfig);
    const gh = _safeObj(propiedad?.googleHotelData);
    const addr = _safeObj(gh.address);
    if (_hasText(addr.street) && _hasText(addr.city) && _hasText(addr.countryCode)) {
        return {
            street: String(addr.street).trim(),
            city: String(addr.city).trim(),
            countryCode: String(addr.countryCode).trim().toUpperCase(),
            province: String(addr.province || addr.region || addr.state || '').trim(),
            postalCode: String(addr.postalCode || addr.postal_code || '').trim(),
        };
    }

    const tipo = String(cfg.tipoNegocio || 'complejo').toLowerCase();
    if (tipo !== 'complejo' && tipo !== 'hotel') {
        return null;
    }

    const ubi = _safeObj(cfg.ubicacion);
    const contact = _safeObj(cfg.websiteSettings?.contact);
    const general = _safeObj(cfg.websiteSettings?.general);

    /** `ubicacion.calle`: línea corta “calle y número” para addr1 en feeds; si falta, cae a dirección completa. */
    const street = String(
        addr.street || ubi.calle || ubi.calleLinea || ubi.direccion || contact.direccionCompleta || '',
    ).trim();
    const city = String(addr.city || ubi.ciudad || general.city || '').trim();
    let countryCode = String(addr.countryCode || ubi.countryCode || ubi.paisCodigo || '').trim().toUpperCase();
    if (!_hasText(countryCode)) {
        countryCode = guessCountryCodeFromPais(ubi.pais || contact.pais || general.country);
    }
    if (!_hasText(street) || !_hasText(city) || !_hasText(countryCode)) {
        return null;
    }
    const province = String(
        addr.province || addr.region || addr.state || ubi.region || general.region || '',
    ).trim();
    const postalCode = String(
        addr.postalCode || addr.postal_code || ubi.codigoPostal || ubi.zip || ubi.postalCode || '',
    ).trim();
    return { street, city, countryCode, province, postalCode };
}

function hasCompleteGoogleHotelsAddress(propiedad, empresaConfig) {
    return resolveEffectiveGoogleHotelsAddress(propiedad, empresaConfig) != null;
}

module.exports = {
    resolveEffectiveGoogleHotelsAddress,
    hasCompleteGoogleHotelsAddress,
};
