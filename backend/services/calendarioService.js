const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { obtenerReservasPorEmpresa } = require('./reservasService');

const formatDateToISO = (date) => {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const obtenerDatosCalendario = async (db, empresaId) => {
    const propiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
    const recursos = propiedades.map(p => ({
        id: p.id,
        title: p.nombre
    }));

    const reservas = await obtenerReservasPorEmpresa(db, empresaId);
    const eventos = reservas
        // --- INICIO DEL CAMBIO ---
        // Se añade la condición para filtrar solo por estado "Confirmada"
        .filter(r => r.alojamientoId && r.fechaLlegada && r.fechaSalida && r.estado === 'Confirmada')
        // --- FIN DEL CAMBIO ---
        .map(r => {
            const fechaSalidaCorrecta = new Date(r.fechaSalida);
            fechaSalidaCorrecta.setUTCDate(fechaSalidaCorrecta.getUTCDate() + 1);

            return {
                resourceId: r.alojamientoId,
                title: r.nombreCliente,
                start: formatDateToISO(r.fechaLlegada),
                end: formatDateToISO(fechaSalidaCorrecta),
                extendedProps: {
                    idReserva: r.id,
                    alojamientoNombre: r.alojamientoNombre,
                    clienteNombre: r.nombreCliente,
                    telefono: r.telefono,
                    estado: r.estado,
                    canalNombre: r.canalNombre,
                    totalNoches: r.totalNoches,
                    huespedes: r.cantidadHuespedes
                }
            };
        });

    return { recursos, eventos };
};

module.exports = {
    obtenerDatosCalendario
};