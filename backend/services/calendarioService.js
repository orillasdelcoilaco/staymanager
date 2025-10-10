// backend/services/calendarioService.js
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
        .filter(r => r.alojamientoId && r.fechaLlegada && r.fechaSalida && r.estado === 'Confirmada')
        .map(r => {
            // --- INICIO DE LA CORRECCIÓN ---
            // Se elimina la línea que agregaba un día extra a la fecha de salida.
            // const fechaSalidaCorrecta = new Date(r.fechaSalida);
            // fechaSalidaCorrecta.setUTCDate(fechaSalidaCorrecta.getUTCDate() + 1);
            // --- FIN DE LA CORRECCIÓN ---

            return {
                resourceId: r.alojamientoId,
                title: r.nombreCliente,
                start: formatDateToISO(r.fechaLlegada),
                end: formatDateToISO(r.fechaSalida), // Se usa la fecha de salida original
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