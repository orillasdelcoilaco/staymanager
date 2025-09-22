const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { obtenerReservasPorEmpresa } = require('./reservasService');

// La función generarColorPastel ya no es necesaria y se ha eliminado.

const obtenerDatosCalendario = async (db, empresaId) => {
    // 1. Obtener todas las propiedades para usarlas como "recursos"
    const propiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
    const recursos = propiedades.map(p => ({
        id: p.id,
        title: p.nombre
    }));

    // 2. Obtener todas las reservas para usarlas como "eventos"
    const reservas = await obtenerReservasPorEmpresa(db, empresaId);
    const eventos = reservas
        .filter(r => r.alojamientoId && r.fechaLlegada && r.fechaSalida) // Filtrar reservas válidas
        .map(r => ({
            resourceId: r.alojamientoId,
            title: r.nombreCliente,
            start: r.fechaLlegada,
            end: r.fechaSalida,
            // Las propiedades de color ahora se manejarán en el frontend
            extendedProps: {
                idReserva: r.id,
                alojamientoNombre: r.alojamientoNombre,
                clienteNombre: r.nombreCliente,
                telefono: r.telefono,
                estado: r.estado,
                canalNombre: r.canalNombre, // <-- CAMBIO CLAVE: Se añade el nombre del canal
                totalNoches: r.totalNoches,
                huespedes: r.cantidadHuespedes
            }
        }));

    return { recursos, eventos };
};

module.exports = {
    obtenerDatosCalendario
};