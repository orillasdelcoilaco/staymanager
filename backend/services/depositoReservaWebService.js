function _toInt(value, fallback = 0) {
    const n = parseInt(String(value ?? ''), 10);
    return Number.isFinite(n) ? n : fallback;
}

function _clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

function resolveDepositoReservaWeb(bookingSettings, totalCLP = 0) {
    const bk = bookingSettings && typeof bookingSettings === 'object' ? bookingSettings : {};
    const activo = bk.depositoActivo !== false;
    const tipo = bk.depositoTipo === 'monto_fijo' ? 'monto_fijo' : 'porcentaje';
    const porcentaje = _clamp(_toInt(bk.depositoPorcentaje ?? 10, 10), 1, 100);
    const montoFijo = Math.max(0, _toInt(bk.depositoMontoSugeridoCLP, 0));
    const horasLimite = _clamp(_toInt(bk.depositoHorasLimite ?? bk.abonoHorasLimite ?? 48, 48), 1, 168);
    const total = Math.max(0, Math.round(Number(totalCLP) || 0));

    let montoDeposito = 0;
    if (activo) {
        if (tipo === 'monto_fijo') {
            montoDeposito = Math.min(total, montoFijo);
        } else {
            montoDeposito = Math.round((total * porcentaje) / 100);
        }
    }

    const saldo = Math.max(0, total - montoDeposito);
    return {
        activo,
        tipo,
        porcentaje,
        montoFijo,
        horasLimite,
        montoDeposito,
        saldo,
    };
}

module.exports = { resolveDepositoReservaWeb };
