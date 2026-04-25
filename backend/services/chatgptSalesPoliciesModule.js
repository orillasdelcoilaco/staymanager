function _txt(v) {
    return String(v || '').trim();
}

function buildPoliticasHorariosIa({ politicas, precioEstimado }) {
    const cancelacionRaw =
        _txt(precioEstimado?.politica_cancelacion?.resumen) ||
        _txt(precioEstimado?.politica_cancelacion?.texto) ||
        _txt(precioEstimado?.politica_cancelacion) ||
        null;

    return {
        cancelacion: cancelacionRaw || 'Consultar política de cancelación vigente',
        checkin_desde: _txt(politicas?.hora_checkin) || null,
        checkout_hasta: _txt(politicas?.hora_checkout) || null,
        mascotas: politicas?.mascotas ?? null,
        fumadores: politicas?.fumadores ?? null,
        payload_version: 'politicas_ia_v1',
    };
}

module.exports = {
    buildPoliticasHorariosIa,
};

