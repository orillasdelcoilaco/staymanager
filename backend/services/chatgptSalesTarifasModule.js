function _num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function buildTarifasDetalladas({ precio, precioEstimado }) {
    const porEstadia = precio?.por_estadia || null;
    const lineas = Array.isArray(porEstadia?.lineas_extra_preview) ? porEstadia.lineas_extra_preview : [];

    const valorNoche = _num(porEstadia?.promedio_noche_clp) || _num(precio?.noche_referencia_clp) || 0;
    const extras = _num(porEstadia?.extras_estimados_clp) || 0;
    const total = _num(porEstadia?.total_estadia_clp) || _num(precioEstimado?.total_estadia_clp) || null;

    let aseo = 0;
    let descuentoMonto = 0;
    lineas.forEach((ln) => {
        const et = String(ln?.etiqueta || '').toLowerCase();
        const monto = Number(ln?.monto_clp || 0);
        if (/aseo|limpieza/.test(et)) aseo += monto;
        if (/descuento/.test(et) && monto < 0) descuentoMonto += Math.abs(monto);
    });

    return {
        valor_noche: Math.round(valorNoche || 0),
        aseo: Math.round(aseo),
        iva: 0,
        comision: 0,
        descuento: Math.round(descuentoMonto),
        extras_estimados: Math.round(extras),
        total_estadia: total != null ? Math.round(total) : null,
        moneda: precio?.moneda || 'CLP',
        payload_version: 'tarifas_ia_v1',
    };
}

module.exports = {
    buildTarifasDetalladas,
};

