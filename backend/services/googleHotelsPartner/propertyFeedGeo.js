/**
 * Coordenadas para feeds Google Hotels (propiedad / googleHotelData / ubicación,
 * fallback empresa si complejo u hotel).
 */
function _safeObj(v) {
    return v && typeof v === 'object' ? v : {};
}

function extractLatLng(meta, gh, empresaConfig) {
    const m = _safeObj(meta);
    const gH = _safeObj(gh);
    const ubi = m.ubicacion && typeof m.ubicacion === 'object' ? m.ubicacion : {};
    const g = gH.geo && typeof gH.geo === 'object' ? gH.geo : {};
    let latRaw = g.lat != null ? g.lat : (gH.latitude != null ? gH.latitude : ubi.lat);
    let lngRaw = g.lng != null ? g.lng : (gH.longitude != null ? gH.longitude : ubi.lng ?? ubi.lon);
    let lat = latRaw != null && Number.isFinite(Number(latRaw)) ? Number(latRaw) : null;
    let lng = lngRaw != null && Number.isFinite(Number(lngRaw)) ? Number(lngRaw) : null;

    const cfg = _safeObj(empresaConfig);
    const tipo = String(cfg.tipoNegocio || 'complejo').toLowerCase();
    if ((tipo === 'complejo' || tipo === 'hotel') && (lat == null || lng == null)) {
        const empUbi = _safeObj(cfg.ubicacion);
        const elat = empUbi.lat != null && Number.isFinite(Number(empUbi.lat)) ? Number(empUbi.lat) : null;
        const elng = empUbi.lng != null && Number.isFinite(Number(empUbi.lng))
            ? Number(empUbi.lng)
            : (empUbi.lon != null && Number.isFinite(Number(empUbi.lon)) ? Number(empUbi.lon) : null);
        if (lat == null) lat = elat;
        if (lng == null) lng = elng;
    }
    return { lat, lng };
}

module.exports = { extractLatLng };
