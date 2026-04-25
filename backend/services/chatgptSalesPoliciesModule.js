function _txt(v) {
    return String(v || '').trim();
}

function _resolveMascotasBoolean({ politicas, amenidadesEstructuradas }) {
    if (typeof politicas?.mascotas === 'boolean') return politicas.mascotas;
    const am = Array.isArray(amenidadesEstructuradas?.amenidades)
        ? amenidadesEstructuradas.amenidades
        : [];
    if (am.includes('pet_friendly')) return true;
    return null;
}

function _resolveMascotasCondicion({ politicas, meta, mascotas }) {
    const explicit =
        _txt(meta?.contextoComercial?.mascotas_condicion) ||
        _txt(meta?.politicas?.mascotas_condicion) ||
        _txt(meta?.websiteData?.mascotas_condicion);
    if (explicit) return explicit;
    if (mascotas === true) return 'Permitidas mascotas de raza pequeña; razas grandes bajo consulta.';
    if (mascotas === false) return 'No se permiten mascotas.';
    return null;
}

function buildPoliticasHorariosIa({ politicas, precioEstimado, amenidadesEstructuradas, meta }) {
    const cancelacionRaw =
        _txt(precioEstimado?.politica_cancelacion?.resumen) ||
        _txt(precioEstimado?.politica_cancelacion?.texto) ||
        _txt(precioEstimado?.politica_cancelacion) ||
        null;
    const mascotas = _resolveMascotasBoolean({ politicas, amenidadesEstructuradas });

    return {
        cancelacion: cancelacionRaw || 'Consultar política de cancelación vigente',
        checkin_desde: _txt(politicas?.hora_checkin) || null,
        checkout_hasta: _txt(politicas?.hora_checkout) || null,
        mascotas,
        mascotas_condicion: _resolveMascotasCondicion({ politicas, meta, mascotas }),
        fumadores: politicas?.fumadores ?? null,
        payload_version: 'politicas_ia_v1',
    };
}

module.exports = {
    buildPoliticasHorariosIa,
};

