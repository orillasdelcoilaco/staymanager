const admin = require('firebase-admin');
const { findOrCreateClient } = require('./clientesService');

/**
 * Crea una o más reservas en Firestore a partir de una solicitud manual (propuesta).
 * La estructura de datos creada es idéntica a la de una reserva importada.
 * @param {admin.firestore.Firestore} db - Instancia de Firestore.
 * @param {object} data - Los datos de la reserva del frontend.
 * @returns {Promise<string>} El ID de la propuesta creada.
 */
async function createManualReservation(db, empresaId, data) {
    const { cliente, fechaLlegada, fechaSalida, propiedades, precioFinal, noches, personas } = data;

    if (!cliente || !fechaLlegada || !fechaSalida || !propiedades || !precioFinal) {
        throw new Error('Faltan datos clave para crear la propuesta de reserva.');
    }

    // 1. Obtener o crear el cliente.
    const resultadoCliente = await crearOActualizarCliente(db, empresaId, cliente);
    const clienteId = resultadoCliente.cliente.id;

    // 2. Generar un ID único para toda la propuesta.
    const idPropuesta = `APP-${Date.now()}`;
    const batch = db.batch();
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');

    // 3. Iterar sobre las propiedades seleccionadas para crear una reserva individual por cada una.
    for (const prop of propiedades) {
        const reservaRef = reservasRef.doc();
        const idUnicoReserva = `${idPropuesta}-${prop.id}`;

        const valorHuespedIndividual = Math.round(precioFinal / propiedades.length);

        const dataToSave = {
            id: reservaRef.id,
            idUnicoReserva,
            idPropuesta,
            idCarga: 'MANUAL',
            idReservaCanal: idPropuesta, // Para consistencia, el ID del canal es el mismo que el de la propuesta.
            canalId: 'APP',
            canalNombre: 'App',
            clienteId,
            alojamientoId: prop.id,
            alojamientoNombre: prop.nombre,
            
            estado: 'Propuesta', // Estado inicial para todas las propuestas.
            estadoGestion: null, // Se define al aprobar.
            
            fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(fechaLlegada + 'T00:00:00Z')),
            fechaSalida: admin.firestore.Timestamp.fromDate(new Date(fechaSalida + 'T00:00:00Z')),
            fechaReserva: admin.firestore.FieldValue.serverTimestamp(),
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
            
            totalNoches: noches,
            cantidadHuespedes: personas,

            moneda: 'CLP',
            valorDolarDia: null,
            requiereActualizacionDolar: false,

            valores: {
                valorOriginal: valorHuespedIndividual, // En venta directa, el original es el mismo que el del huésped.
                valorTotal: valorHuespedIndividual,     // Payout para el anfitrión.
                valorHuesped: valorHuespedIndividual,   // Total pagado por el cliente.
                comision: 0,
                costoCanal: 0,
                iva: 0,
            },

            edicionesManuales: {
                'valores.valorHuesped': true // Se marca como manual ya que fue ingresado o calculado en la app.
            }
        };

        batch.set(reservaRef, dataToSave);
    }

    await batch.commit();
    return idPropuesta;
}

module.exports = {
    createManualReservation
};