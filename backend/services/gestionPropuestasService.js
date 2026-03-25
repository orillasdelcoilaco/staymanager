// backend/services/gestionPropuestasService.js
// Barrel re-export — módulos internos en gestionPropuestas.*.js

const { guardarOActualizarPropuesta, guardarPresupuesto, rechazarPropuesta, rechazarPresupuesto } = require('./gestionPropuestas.write');
const { obtenerPropuestasYPresupuestos } = require('./gestionPropuestas.read');
const { verificarDisponibilidadPropuesta, aprobarPropuesta, aprobarPresupuesto } = require('./gestionPropuestas.actions');

module.exports = {
    guardarOActualizarPropuesta,
    guardarPresupuesto,
    obtenerPropuestasYPresupuestos,
    verificarDisponibilidadPropuesta,
    aprobarPropuesta,
    rechazarPropuesta,
    aprobarPresupuesto,
    rechazarPresupuesto,
};
