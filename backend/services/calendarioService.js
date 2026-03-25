// backend/services/calendarioService.js
const pool = require('../db/postgres');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { obtenerReservasPorEmpresa } = require('./reservasService');
const { listarBloqueos } = require('./bloqueosService');

const formatDateToISO = (date) => {
    const d = new Date(date);
    const year  = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day   = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const obtenerDatosCalendario = async (db, empresaId) => {
    const [propiedades, reservas, bloqueos] = await Promise.all([
        obtenerPropiedadesPorEmpresa(db, empresaId),
        obtenerReservasPorEmpresa(db, empresaId),
        listarBloqueos(db, empresaId),
    ]);

    const recursos = propiedades.map(p => ({
        id:        p.id,
        title:     p.nombre,
        capacidad: p.capacidad  || 0,
        numPiezas: p.numPiezas  || 0,
    }));

    const hoy   = formatDateToISO(new Date());
    const addDay = (d) => { const n = new Date(d); n.setUTCDate(n.getUTCDate() + 1); return n; };
    const todosLosIds = recursos.map(r => r.id);

    const eventos = reservas
        .filter(r => r.alojamientoId && r.fechaLlegada && r.fechaSalida && r.estado === 'Confirmada')
        .map(r => ({
            resourceId: r.alojamientoId,
            title:      r.nombreCliente,
            start:      formatDateToISO(r.fechaLlegada),
            end:        formatDateToISO(r.fechaSalida),
            extendedProps: {
                idReserva:        r.id,
                idReservaCanal:   r.idReservaCanal,
                alojamientoNombre: r.alojamientoNombre,
                clienteNombre:    r.nombreCliente,
                telefono:         r.telefono,
                estado:           r.estado,
                estadoGestion:    r.estadoGestion || null,
                canalNombre:      r.canalNombre,
                totalNoches:      r.totalNoches,
                huespedes:        r.cantidadHuespedes,
                valorHuesped:     r.valores?.valorHuesped || null,
            },
        }));

    // Expandir bloqueos: uno por alojamiento afectado
    bloqueos.forEach(b => {
        const idsAfectados = b.todos ? todosLosIds : (b.alojamientoIds || []);
        const startISO = b.fechaInicio;
        const endISO   = formatDateToISO(addDay(b.fechaFin + 'T00:00:00Z'));
        idsAfectados.forEach(alojamientoId => {
            eventos.push({
                resourceId: alojamientoId,
                title:      b.motivo || 'Bloqueado',
                start:      startISO,
                end:        endISO,
                extendedProps: {
                    tipo:      'bloqueo',
                    idBloqueo: b.id,
                    motivo:    b.motivo || 'Bloqueado',
                },
            });
        });
    });

    const eventosReserva = eventos.filter(e => e.extendedProps?.tipo !== 'bloqueo');
    const metricas = {
        reservasActivas:  eventosReserva.length,
        checkinHoy:       eventosReserva.filter(e => e.start === hoy).length,
        checkoutHoy:      eventosReserva.filter(e => e.end   === hoy).length,
        ocupados:         new Set(eventosReserva.filter(e => e.start <= hoy && e.end > hoy).map(e => e.resourceId)).size,
        totalPropiedades: recursos.length,
    };

    return { recursos, eventos, metricas };
};

module.exports = { obtenerDatosCalendario };
