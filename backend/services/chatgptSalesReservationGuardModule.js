const {
    sqlReservaPrincipalSemanticaIgual,
    reservasTieneColumna,
} = require('./estadosService');

async function getChatgptReservaGuardDiag() {
    const hasEstadoPrincipalId = await reservasTieneColumna('estado_principal_id');
    const hasEstadoGestionId = await reservasTieneColumna('estado_gestion_id');
    return {
        sql_semantica_helper_ok: typeof sqlReservaPrincipalSemanticaIgual === 'function',
        columnas_reservas: {
            estado_principal_id: !!hasEstadoPrincipalId,
            estado_gestion_id: !!hasEstadoGestionId,
        },
        payload_version: 'reserva_guard_ia_v1',
    };
}

module.exports = {
    getChatgptReservaGuardDiag,
};

