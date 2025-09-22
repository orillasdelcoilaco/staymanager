const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { obtenerReservasPorEmpresa } = require('./reservasService');

// --- NUEVA FUNCIÓN ---
// Para formatear fechas a YYYY-MM-DD sin problemas de zona horaria.
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
        .filter(r => r.alojamientoId && r.fechaLlegada && r.fechaSalida)
        .map(r => {
            // --- INICIO DE CAMBIOS ---
            // Corregimos la fecha de salida para que sea inclusiva
            const fechaSalidaCorrecta = new Date(r.fechaSalida);
            fechaSalidaCorrecta.setUTCDate(fechaSalidaCorrecta.getUTCDate() + 1);

            return {
                resourceId: r.alojamientoId,
                title: r.nombreCliente,
                // Formateamos las fechas para evitar desfases de zona horaria
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
            // --- FIN DE CAMBIOS ---
        });

    return { recursos, eventos };
};

module.exports = {
    obtenerDatosCalendario
};