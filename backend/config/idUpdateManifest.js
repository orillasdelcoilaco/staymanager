// backend/config/idUpdateManifest.js

/**
 * Manifiesto de Actualización de ID de Reserva.
 * Este archivo centraliza todas las ubicaciones en la base de datos donde se utiliza
 * el 'idReservaCanal' (o un alias) como identificador de grupo.
 *
 * La función de actualización en cascada leerá este manifiesto para saber
 * qué colecciones y campos necesita actualizar cuando un ID de reserva cambia.
 *
 * Para extender la funcionalidad a futuro, simplemente añade un nuevo objeto a este array.
 */
const idUpdateManifest = [
    {
        collection: 'reservas',
        field: 'idReservaCanal',
        isGroupIdentifier: true // Marca este campo como el identificador principal del grupo.
    },
    {
        collection: 'transacciones',
        field: 'reservaIdOriginal'
    },
    {
        collection: 'gestionNotas',
        field: 'reservaIdOriginal'
    }
    // Ejemplo a futuro: Si se crea una colección de encuestas
    // {
    //   collection: 'encuestas',
    //   field: 'idDeLaReserva'
    // }
];

module.exports = idUpdateManifest;