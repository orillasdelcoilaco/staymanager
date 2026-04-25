function _txt(v) {
    return String(v || '').trim();
}

const { resolveMascotasPolicy } = require('./chatgptSalesPetsPolicyModule');

function buildPoliticasHorariosIa({
    politicas,
    precioEstimado,
    amenidadesEstructuradas,
    meta,
    empresaConfig,
}) {
    const cancelacionRaw =
        _txt(precioEstimado?.politica_cancelacion?.resumen) ||
        _txt(precioEstimado?.politica_cancelacion?.texto) ||
        _txt(precioEstimado?.politica_cancelacion) ||
        null;
    const mascotasInfo = resolveMascotasPolicy({
        politicas,
        amenidadesEstructuradas,
        empresaConfig,
        meta,
    });

    return {
        cancelacion: cancelacionRaw || 'Consultar política de cancelación vigente',
        checkin_desde: _txt(politicas?.hora_checkin) || null,
        checkout_hasta: _txt(politicas?.hora_checkout) || null,
        mascotas: mascotasInfo.mascotas,
        mascotas_condicion: mascotasInfo.mascotas_condicion,
        mascotas_policy_mode: mascotasInfo.mascotas_policy_mode,
        fumadores: politicas?.fumadores ?? null,
        payload_version: 'politicas_ia_v1',
    };
}

module.exports = {
    buildPoliticasHorariosIa,
};

