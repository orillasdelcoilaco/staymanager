// backend/services/icalService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const ical = require('node-ical');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { listarBloqueos } = require('./bloqueosService');
const { registrarCarga } = require('./historialCargasService');

const _formatDateICal = (date) => new Date(date).toISOString().split('T')[0].replace(/-/g, '');
const _dtstamp = () => new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

async function getICalForProperty(db, empresaId, propiedadId) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setDate(1);
    const stamp = _dtstamp();

    if (pool) {
        const [reservasRes, bloqueos] = await Promise.all([
            pool.query(
                `SELECT id, nombre_cliente, fecha_llegada, fecha_salida FROM reservas
                 WHERE empresa_id = $1 AND propiedad_id = $2 AND estado = 'Confirmada' AND fecha_llegada >= $3`,
                [empresaId, propiedadId, threeMonthsAgo.toISOString().split('T')[0]]
            ),
            listarBloqueos(db, empresaId),
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

    // Firestore fallback
    const startTs = admin.firestore.Timestamp.fromDate(threeMonthsAgo);
    const [reservasSnap, bloqueosSnap] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('alojamientoId', '==', propiedadId).where('estado', '==', 'Confirmada')
            .where('fechaLlegada', '>=', startTs).get(),
        db.collection('empresas').doc(empresaId).collection('bloqueos').where('fechaFin', '>=', startTs).get(),
    ]);

    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SuiteManager//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    reservasSnap.forEach(doc => {
        const r = doc.data();
        lines.push('BEGIN:VEVENT', `UID:${doc.id}@suitemanager`, `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${_formatDateICal(r.fechaLlegada.toDate())}`,
            `DTEND;VALUE=DATE:${_formatDateICal(r.fechaSalida.toDate())}`,
            `SUMMARY:Reservado - ${r.clienteNombre || 'Ocupado'}`, 'END:VEVENT');
    });
    bloqueosSnap.forEach(doc => {
        const b = doc.data();
        if (!b.todos && !(b.alojamientoIds || []).includes(propiedadId)) return;
        lines.push('BEGIN:VEVENT', `UID:bloqueo-${doc.id}@suitemanager`, `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${_formatDateICal(b.fechaInicio.toDate())}`,
            `DTEND;VALUE=DATE:${_formatDateICal(b.fechaFin.toDate())}`,
            `SUMMARY:Bloqueado${b.motivo ? ' - ' + b.motivo : ''}`, 'TRANSP:OPAQUE', 'END:VEVENT');
    });
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

    let existingIcalUIDs;
    if (pool) {
        const { rows } = await pool.query(
            `SELECT DISTINCT metadata->>'icalUid' AS uid FROM reservas WHERE empresa_id = $1 AND metadata->>'icalUid' IS NOT NULL`,
            [empresaId]
        );
        existingIcalUIDs = new Set(rows.map(r => r.uid));
    } else {
        const snap = await db.collection('empresas').doc(empresaId).collection('reservas').get();
        existingIcalUIDs = new Set(snap.docs.map(d => d.data().icalUid).filter(Boolean));
    }

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

                    if (pool) {
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
                    } else {
                        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc();
                        await ref.set({
                            id: ref.id, idUnicoReserva: `${event.uid}-${prop.id}`, idReservaCanal: event.uid,
                            icalUid: event.uid, idCarga, clienteId: null,
                            alojamientoId: prop.id, alojamientoNombre: prop.nombre,
                            canalId: canal?.id || null, canalNombre: canal?.nombre || canalKey,
                            fechaLlegada: admin.firestore.Timestamp.fromDate(eventStart),
                            fechaSalida:  admin.firestore.Timestamp.fromDate(eventEnd),
                            totalNoches: noches, cantidadHuespedes: 0,
                            estado: 'Propuesta', origen: 'ical',
                            moneda: canal?.moneda || 'CLP',
                            valores: { valorHuesped: 0 },
                            fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
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
