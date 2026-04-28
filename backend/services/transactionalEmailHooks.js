// backend/services/transactionalEmailHooks.js
// Ganchos de negocio → motor de correos (sin bloquear respuesta HTTP).
const pool = require('../db/postgres');
const {
    enviarPorDisparador,
    construirVariablesDesdeReserva,
    esEstadoCancelacion,
} = require('./transactionalEmailService');
const { obtenerSemanticaEstadoPrincipalPorNombre } = require('./estadosService');

function extrasCheckoutWebDesdeReservaMetadata(metadata) {
    const rwc = metadata && typeof metadata === 'object' ? metadata.reservaWebCheckout : null;
    if (!rwc || typeof rwc !== 'object') return {};
    const o = {};
    const h = rwc.horaLlegadaEstimada != null ? String(rwc.horaLlegadaEstimada).trim().slice(0, 120) : '';
    if (h) o.horaLlegadaEstimada = h;
    const m = rwc.medioLlegada != null ? String(rwc.medioLlegada).trim().toLowerCase().replace(/\s+/g, '') : '';
    if (m) o.medioLlegada = m;
    const rt = rwc.referenciaTransporte != null ? String(rwc.referenciaTransporte).trim().slice(0, 100) : '';
    if (rt) o.referenciaTransporte = rt;
    const dr = rwc.documentoRefViajero != null ? String(rwc.documentoRefViajero).replace(/[^A-Za-z0-9]/g, '').slice(0, 10) : '';
    if (dr) o.documentoRefViajero = dr;
    const ch = rwc.comentariosHuesped != null ? String(rwc.comentariosHuesped).trim().slice(0, 2000) : '';
    if (ch) o.comentariosHuesped = ch;
    if (rwc.checkInIdentidad && typeof rwc.checkInIdentidad === 'object') {
        o.checkInIdentidad = rwc.checkInIdentidad;
    }
    if (Array.isArray(rwc.checkInIdentidadAcompanantes) && rwc.checkInIdentidadAcompanantes.length) {
        o.checkInIdentidadAcompanantes = rwc.checkInIdentidadAcompanantes;
    }
    if (rwc.checkInIdentidadAceptacion && typeof rwc.checkInIdentidadAceptacion === 'object') {
        o.checkInIdentidadAceptacion = rwc.checkInIdentidadAceptacion;
    }
    return o;
}

async function _filaReservaPorId(empresaId, reservaId) {
    const { rows } = await pool.query(
        `SELECT id, id_reserva_canal, cliente_id, alojamiento_nombre, fecha_llegada, fecha_salida,
                total_noches, cantidad_huespedes, valores, estado, metadata
         FROM reservas WHERE id = $1 AND empresa_id = $2`,
        [reservaId, empresaId]
    );
    return rows[0] || null;
}

async function _filasReservaPorIdCanal(empresaId, idReservaCanal) {
    const { rows } = await pool.query(
        `SELECT id, id_reserva_canal, cliente_id, alojamiento_nombre, fecha_llegada, fecha_salida,
                total_noches, cantidad_huespedes, valores, estado, metadata
         FROM reservas WHERE empresa_id = $1 AND id_reserva_canal = $2
         ORDER BY fecha_llegada ASC`,
        [empresaId, idReservaCanal]
    );
    return rows;
}

/**
 * Tras cambiar estado de reserva por id_reserva_canal (gestión).
 */
async function onEstadoReservaGrupoActualizado(_db, empresaId, idReservaCanal, nuevoEstado) {
    if (!idReservaCanal || !pool) return;
    const semNuevo = await obtenerSemanticaEstadoPrincipalPorNombre(empresaId, nuevoEstado);
    if (!esEstadoCancelacion(nuevoEstado, semNuevo)) return;
    const rows = await _filasReservaPorIdCanal(empresaId, idReservaCanal);
    const row = rows[0];
    if (!row?.cliente_id) return;
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const vars = await construirVariablesDesdeReserva(empresaId, row, extrasCheckoutWebDesdeReservaMetadata(meta));
    await enviarPorDisparador(null, empresaId, 'reserva_cancelada', {
        clienteId: row.cliente_id,
        variables: vars,
        relacionadoCon: { tipo: 'reserva', id: String(row.id_reserva_canal || row.id) },
    }).catch((e) => console.warn('[hooks] reserva_cancelada:', e.message));
}

function _pgDateIso(d) {
    if (!d) return '';
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}

/**
 * Tras PUT /reservas/:id — compara snapshot vs body.
 * @param {object} antes — fila PG mínima antes del UPDATE (snake_case).
 */
async function onReservaActualizadaManual(_db, empresaId, antes, datosNuevos) {
    if (!antes?.id) return;
    const row = await _filaReservaPorId(empresaId, antes.id);
    if (!row?.cliente_id) return;

    const estadoAnt = String(antes.estado || '');
    const estadoNuevo = datosNuevos.estado !== undefined ? String(datosNuevos.estado) : estadoAnt;
    const [semNuevo, semAnt] = await Promise.all([
        obtenerSemanticaEstadoPrincipalPorNombre(empresaId, estadoNuevo),
        obtenerSemanticaEstadoPrincipalPorNombre(empresaId, estadoAnt),
    ]);
    if (esEstadoCancelacion(estadoNuevo, semNuevo) && !esEstadoCancelacion(estadoAnt, semAnt)) {
        const meta0 = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const vars = await construirVariablesDesdeReserva(empresaId, row, extrasCheckoutWebDesdeReservaMetadata(meta0));
        await enviarPorDisparador(null, empresaId, 'reserva_cancelada', {
            clienteId: row.cliente_id,
            variables: vars,
            relacionadoCon: { tipo: 'reserva', id: String(row.id_reserva_canal || row.id) },
        }).catch((e) => console.warn('[hooks] reserva_cancelada manual:', e.message));
    }

    const fl = datosNuevos.fechaLlegada ? String(datosNuevos.fechaLlegada).slice(0, 10) : null;
    const fs = datosNuevos.fechaSalida ? String(datosNuevos.fechaSalida).slice(0, 10) : null;
    const fl0 = _pgDateIso(antes.fecha_llegada);
    const fs0 = _pgDateIso(antes.fecha_salida);
    if ((fl && fl !== fl0) || (fs && fs !== fs0)) {
        const meta1 = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const vars = await construirVariablesDesdeReserva(empresaId, row, extrasCheckoutWebDesdeReservaMetadata(meta1));
        await enviarPorDisparador(null, empresaId, 'reserva_modificada', {
            clienteId: row.cliente_id,
            variables: vars,
            relacionadoCon: { tipo: 'reserva', id: String(row.id_reserva_canal || row.id) },
        }).catch((e) => console.warn('[hooks] reserva_modificada:', e.message));
    }
}

module.exports = {
    onEstadoReservaGrupoActualizado,
    onReservaActualizadaManual,
    extrasCheckoutWebDesdeReservaMetadata,
};
