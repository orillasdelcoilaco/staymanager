// backend/services/icalService.js
const pool = require('../db/postgres');
const ical = require('node-ical');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { listarBloqueos } = require('./bloqueosService');
const { registrarCarga } = require('./historialCargasService');

const _formatDateICal = (date) => new Date(date).toISOString().split('T')[0].replace(/-/g, '');
const _dtstamp = () => new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

async function getICalForProperty(_db, empresaId, propiedadId) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setDate(1);
    const stamp = _dtstamp();

    const [reservasRes, bloqueos] = await Promise.all([
        pool.query(
            `SELECT id, nombre_cliente, fecha_llegada, fecha_salida FROM reservas
             WHERE empresa_id = $1 AND propiedad_id = $2 AND estado = 'Confirmada' AND fecha_llegada >= $3`,
            [empresaId, propiedadId, threeMonthsAgo.toISOString().split('T')[0]]
        ),
        listarBloqueos(null, empresaId),
    ]);

    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SuiteManager//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (const r of reservasRes.rows) {
        lines.push('BEGIN:VEVENT', `UID:${r.id}@suitemanager`, `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${_formatDateICal(r.fecha_llegada)}`,
            `DTEND;VALUE=DATE:${_formatDateICal(r.fecha_salida)}`,
            `SUMMARY:Reservado - ${r.nombre_cliente || 'Ocupado'}`, 'END:VEVENT');
    }
    for (const b of bloqueos) {
        if (!b.todos && !(b.alojamientoIds || []).includes(propiedadId)) continue;
        lines.push('BEGIN:VEVENT', `UID:bloqueo-${b.id}@suitemanager`, `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${b.fechaInicio.replace(/-/g, '')}`,
            `DTEND;VALUE=DATE:${b.fechaFin.replace(/-/g, '')}`,
            `SUMMARY:Bloqueado${b.motivo ? ' - ' + b.motivo : ''}`, 'TRANSP:OPAQUE', 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

async function sincronizarCalendarios(db, empresaId, usuarioEmail, filtros = {}) {
    const { canalFiltroId, fechaInicio, fechaFin } = filtros;

    const [propiedades, todosLosCanales] = await Promise.all([
        obtenerPropiedadesPorEmpresa(db, empresaId),
        obtenerCanalesPorEmpresa(db, empresaId),
    ]);

    const canalesMap = new Map(todosLosCanales.map(c => [c.id, c]));
    const canalFiltro     = canalFiltroId ? canalesMap.get(canalFiltroId) : null;
    const canalIcalDefecto = todosLosCanales.find(c => c.esCanalIcal) || null;

    const nombreArchivoCarga = `Sincronización iCal - ${canalFiltro ? canalFiltro.nombre : 'Todos los Canales'} (${new Date().toLocaleDateString('es-CL')})`;
    const idCarga = await registrarCarga(db, empresaId, canalFiltroId, nombreArchivoCarga, usuarioEmail);

    const propiedadesConIcal = propiedades.filter(p => p.sincronizacionIcal && Object.values(p.sincronizacionIcal).some(u => u));
    if (!propiedadesConIcal.length) return { propiedadesRevisadas: 0, nuevasReservasCreadas: 0, errores: [] };

    const { rows: uidRows } = await pool.query(
        `SELECT DISTINCT metadata->>'icalUid' AS uid FROM reservas WHERE empresa_id = $1 AND metadata->>'icalUid' IS NOT NULL`,
        [empresaId]
    );
    const existingIcalUIDs = new Set(uidRows.map(r => r.uid));

    const filtroStart = fechaInicio ? new Date(fechaInicio + 'T00:00:00Z') : null;
    const filtroEnd   = fechaFin   ? new Date(fechaFin   + 'T23:59:59Z') : null;

    let nuevasReservasCreadas = 0;
    const errores = [];

    for (const prop of propiedadesConIcal) {
        for (const [canalKey, url] of Object.entries(prop.sincronizacionIcal)) {
            if (!url) continue;
            const canalEncontrado = todosLosCanales.find(c => c.nombre.toLowerCase() === canalKey.toLowerCase());
            if (canalFiltroId && canalEncontrado?.id !== canalFiltroId) continue;

            try {
                const events = await ical.async.fromURL(url);
                for (const event of Object.values(events)) {
                    if (event.type !== 'VEVENT' || !event.uid || existingIcalUIDs.has(event.uid)) continue;
                    const eventStart = new Date(event.start);
                    const eventEnd   = new Date(event.end);
                    if (filtroEnd && eventStart >= filtroEnd) continue;
                    if (filtroStart && eventEnd <= filtroStart) continue;

                    const noches  = Math.max(1, Math.round((eventEnd - eventStart) / (1000 * 60 * 60 * 24)));
                    const canal   = canalEncontrado || canalIcalDefecto;

                    await pool.query(
                        `INSERT INTO reservas (empresa_id, id_reserva_canal, propiedad_id, alojamiento_nombre,
                            canal_id, canal_nombre, total_noches, cantidad_huespedes, estado, moneda, valores, id_carga,
                            fecha_llegada, fecha_salida, metadata)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,0,'Propuesta',$8,'{"valorHuesped":0}'::jsonb,$9,$10,$11,$12)`,
                        [empresaId, event.uid, prop.id, prop.nombre,
                         canal?.id || null, canal?.nombre || canalKey,
                         noches, canal?.moneda || 'CLP', idCarga,
                         eventStart.toISOString().split('T')[0], eventEnd.toISOString().split('T')[0],
                         JSON.stringify({ origen: 'ical', icalUid: event.uid, edicionesManuales: {} })]
                    );
                    existingIcalUIDs.add(event.uid);
                    nuevasReservasCreadas++;
                }
            } catch (error) {
                errores.push(`Error al procesar URL para ${prop.nombre} (${canalKey}): ${error.message}`);
            }
        }
    }
    return { propiedadesRevisadas: propiedadesConIcal.length, nuevasReservasCreadas, errores };
}

module.exports = { getICalForProperty, sincronizarCalendarios };
