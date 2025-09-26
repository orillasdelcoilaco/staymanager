const admin = require('firebase-admin');
const { obtenerTarifaParaFecha } = require('./tarifasService');
const { obtenerValorDolar } = require('./dolarService');

// ... (getReservasPendientes y otras funciones no cambian)

// --- INICIO DE LA NUEVA FUNCIÓN ---
const getAnalisisFinanciero = async (db, empresaId, grupoReserva) => {
    // Tomamos la primera reserva individual como representativa del grupo
    const reservaPrincipal = grupoReserva.reservasIndividuales[0];
    if (!reservaPrincipal) throw new Error("El grupo no contiene reservas individuales.");

    const { valorHuesped, valorPayout } = reservaPrincipal;
    const { canalId, alojamientoId, fechaLlegada } = (await db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaPrincipal.id).get()).data();
    
    // 1. Obtener la tarifa de lista desde "Gestionar Tarifas"
    const tarifaBase = await obtenerTarifaParaFecha(db, empresaId, alojamientoId, canalId, fechaLlegada.toDate());
    const valorLista = tarifaBase ? tarifaBase.valor : 0;
    const moneda = tarifaBase ? tarifaBase.moneda : 'CLP';

    // 2. Calcular descuentos y costos
    const descuentos = valorLista > 0 ? valorLista - (valorHuesped / grupoReserva.reservasIndividuales.length) : 0;
    const costoCanal = valorHuesped - valorPayout;

    // 3. Obtener valor del dólar si aplica
    let valorDolarDia = null;
    if (moneda === 'USD') {
        valorDolarDia = await obtenerValorDolar(db, empresaId, fechaLlegada.toDate());
    }

    return {
        valorLista,
        descuentos: descuentos > 0 ? descuentos : 0,
        costoCanal,
        payout: valorPayout,
        moneda,
        valorDolarDia,
    };
};
// --- FIN DE LA NUEVA FUNCIÓN ---

module.exports = {
    getReservasPendientes,
    actualizarEstadoGrupo,
    getNotas,
    addNota,
    getTransacciones,
    getAnalisisFinanciero // <-- Exportar nueva función
};