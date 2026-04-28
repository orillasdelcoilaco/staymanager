const { differenceInDays, addDays, format } = require('date-fns');
const { precioNocheConPromoTarifa } = require('./promocionesDisplayService');

function calcularComparadorOtaTotales({
    allTarifas,
    propiedadId,
    startDate,
    endDate,
    canalDirectoId,
    canalComparadoId,
}) {
    const nights = differenceInDays(endDate, startDate);
    if (!Number.isFinite(nights) || nights <= 0) {
        return { ok: false, error: 'Rango de fechas inválido.' };
    }

    const llegStr = format(startDate, 'yyyy-MM-dd');
    const salStr = format(endDate, 'yyyy-MM-dd');
    let totalDirecto = 0;
    let totalComparado = 0;
    let nochesSinTarifaComparada = 0;

    for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
        const currentDate = new Date(d);
        const tarifasDelDia = (allTarifas || []).filter(
            (t) => t.alojamientoId === propiedadId && t.fechaInicio <= currentDate && t.fechaTermino >= currentDate,
        );
        if (!tarifasDelDia.length) {
            return { ok: false, error: 'No hay tarifa publicada que cubra toda la estadía.' };
        }
        const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
        const pDirecto = Number(tarifa.precios?.[canalDirectoId] || 0);
        const pComp = Number(tarifa.precios?.[canalComparadoId] || 0);
        if (pDirecto <= 0) {
            return { ok: false, error: 'El canal directo no tiene tarifa válida para toda la estadía.' };
        }

        totalDirecto += precioNocheConPromoTarifa(pDirecto, tarifa.metadata?.promo, llegStr, salStr);
        if (pComp > 0) {
            totalComparado += precioNocheConPromoTarifa(pComp, tarifa.metadata?.promo, llegStr, salStr);
        } else {
            nochesSinTarifaComparada += 1;
        }
    }

    const ahorroCLP = Math.round(totalComparado - totalDirecto);
    const pctSobreComparado = totalComparado > 0 ? Math.round((ahorroCLP / totalComparado) * 10000) / 100 : null;
    return {
        ok: true,
        nights,
        totalDirectoCLP: Math.round(totalDirecto),
        totalComparadoCLP: Math.round(totalComparado),
        ahorroCLP,
        pctSobreComparado,
        nochesSinTarifaComparada,
    };
}

module.exports = {
    calcularComparadorOtaTotales,
};
