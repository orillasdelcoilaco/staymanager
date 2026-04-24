/**
 * Filtros y orden en memoria para inventario público IA (PG).
 */
const { parseISO, isValid } = require('date-fns');
const { getAvailabilityData } = require('./publicWebsiteService');

function normalizeUbicacion(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function filterByUbicacion(propiedades, ubicacion) {
    if (!ubicacion) return propiedades;
    const term = normalizeUbicacion(ubicacion);
    return propiedades.filter((p) => {
        const gh = p.googleHotelData || {};
        const addr = gh.address || {};
        const calle = normalizeUbicacion(addr.street || '');
        const ciudad = normalizeUbicacion(addr.city || '');
        return calle.includes(term) || ciudad.includes(term);
    });
}

function filterByCapacidad(propiedades, capacidad) {
    const cap = parseInt(capacidad, 10);
    if (Number.isNaN(cap) || cap <= 0) return propiedades;
    return propiedades.filter((p) => (p.capacidad || 0) >= cap);
}

function filterByAmenidades(propiedades, amenidades) {
    if (!amenidades) return propiedades;
    const amenidadesRequeridas = String(amenidades)
        .split(',')
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean);
    return propiedades.filter((p) => {
        const lista = Array.isArray(p.amenidades) ? p.amenidades : [];
        return amenidadesRequeridas.every((req) =>
            lista.some((a) => String(a).toLowerCase().includes(req))
        );
    });
}

async function filterByDisponibilidad(propiedades, fechaLlegada, fechaSalida) {
    if (!fechaLlegada || !fechaSalida) return propiedades;
    const start = parseISO(String(fechaLlegada).slice(0, 10) + 'T00:00:00Z');
    const end = parseISO(String(fechaSalida).slice(0, 10) + 'T00:00:00Z');
    if (!isValid(start) || !isValid(end) || start >= end) return propiedades;

    const empresasUnicas = [...new Set(propiedades.map((p) => p.empresa.id))];
    const disponibleKey = new Set();
    for (const empId of empresasUnicas) {
        const { availableProperties } = await getAvailabilityData(null, empId, start, end);
        for (const ap of availableProperties) {
            disponibleKey.add(`${empId}::${ap.id}`);
        }
    }
    const out = propiedades.filter((p) => disponibleKey.has(`${p.empresa.id}::${p.id}`));
    out.forEach((p) => {
        p.disponible = true;
    });
    return out;
}

function sortPropiedades(propiedades, ordenar) {
    const list = [...propiedades];
    if (ordenar === 'precio_asc' || ordenar === 'precio_desc') {
        list.sort((a, b) => {
            const pa = Number(a.__sortPrecio) || 0;
            const pb = Number(b.__sortPrecio) || 0;
            return ordenar === 'precio_asc' ? pa - pb : pb - pa;
        });
    } else if (ordenar === 'rating') {
        list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    }
    return list;
}

module.exports = {
    filterByUbicacion,
    filterByCapacidad,
    filterByAmenidades,
    filterByDisponibilidad,
    sortPropiedades,
};
