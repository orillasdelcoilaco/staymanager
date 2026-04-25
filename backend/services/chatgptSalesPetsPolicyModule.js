function _txt(v) {
    return String(v || '').trim();
}

function _readBookingCfg(empresaConfig) {
    const ws = empresaConfig && typeof empresaConfig === 'object'
        ? (empresaConfig.websiteSettings || {})
        : {};
    const booking = ws.booking && typeof ws.booking === 'object' ? ws.booking : {};
    return {
        mode: _txt(booking.chatgptMascotasPolicyMode),
        condicion: _txt(booking.chatgptMascotasCondicion),
    };
}

function resolveMascotasPolicy({ politicas, amenidadesEstructuradas, empresaConfig, meta }) {
    const cfg = _readBookingCfg(empresaConfig);
    if (cfg.mode === 'permitidas') {
        return {
            mascotas: true,
            mascotas_condicion: cfg.condicion || 'Se permiten mascotas según política de la empresa.',
            mascotas_policy_mode: 'permitidas',
        };
    }
    if (cfg.mode === 'no_permitidas') {
        return {
            mascotas: false,
            mascotas_condicion: cfg.condicion || 'No se permiten mascotas.',
            mascotas_policy_mode: 'no_permitidas',
        };
    }
    if (cfg.mode === 'consultar_siempre') {
        return {
            mascotas: null,
            mascotas_condicion: cfg.condicion || 'Consultar siempre antes de reservar.',
            mascotas_policy_mode: 'consultar_siempre',
        };
    }

    const am = Array.isArray(amenidadesEstructuradas?.amenidades) ? amenidadesEstructuradas.amenidades : [];
    let mascotas = typeof politicas?.mascotas === 'boolean' ? politicas.mascotas : null;
    if (mascotas == null && am.includes('pet_friendly')) mascotas = true;

    const explicitCond =
        _txt(meta?.contextoComercial?.mascotas_condicion) ||
        _txt(meta?.politicas?.mascotas_condicion) ||
        _txt(meta?.websiteData?.mascotas_condicion);

    return {
        mascotas,
        mascotas_condicion: explicitCond ||
            (mascotas === true
                ? 'Permitidas mascotas de raza pequeña; razas grandes bajo consulta.'
                : mascotas === false
                    ? 'No se permiten mascotas.'
                    : null),
        mascotas_policy_mode: 'auto',
    };
}

module.exports = {
    resolveMascotasPolicy,
};

