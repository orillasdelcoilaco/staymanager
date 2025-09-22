const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { obtenerReservasPorEmpresa } = require('./reservasService');

// Función para generar un color único basado en el ID del alojamiento
const generarColorPastel = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

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
            backgroundColor: generarColorPastel(r.alojamientoId),
            borderColor: generarColorPastel(r.alojamientoId),
            extendedProps: {
                idReserva: r.id,
                alojamientoNombre: r.alojamientoNombre,
                clienteNombre: r.nombreCliente,
                telefono: r.telefono,
                estado: r.estado,
                totalNoches: r.totalNoches,
                huespedes: r.cantidadHuespedes
            }
        }));

    return { recursos, eventos };
};

module.exports = {
    obtenerDatosCalendario
};