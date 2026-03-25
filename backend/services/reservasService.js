// backend/services/reservasService.js
// Barrel re-export — logic is split into sub-modules for modularity.
const { obtenerReservasPorEmpresa, obtenerReservaPorId, mapearReservaPG } = require('./reservas.read');
const { crearOActualizarReserva, actualizarReservaManualmente }           = require('./reservas.write');
const { decidirYEliminarReserva, eliminarGrupoReservasCascada }           = require('./reservas.delete');

module.exports = {
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    mapearReservaPG,
    crearOActualizarReserva,
    actualizarReservaManualmente,
    decidirYEliminarReserva,
    eliminarGrupoReservasCascada,
};
