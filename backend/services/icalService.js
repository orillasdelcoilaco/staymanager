// backend/services/icalService.js
const admin = require('firebase-admin');
const ical = require('node-ical');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');
const { obtenerCanalesPorEmpresa } = require('./canalesService');
const { registrarCarga } = require('./historialCargasService');

async function getICalForProperty(db, empresaId, propiedadId) {
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const startDate = admin.firestore.Timestamp.fromDate(threeMonthsAgo);

    const q = db.collection('empresas').doc(empresaId).collection('reservas')
        .where('alojamientoId', '==', propiedadId)
        .where('estado', '==', 'Confirmada')
        .where('fechaLlegada', '>=', startDate);
    
    const snapshot = await q.get();

    let icalContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SuiteManager//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
    ];

    if (!snapshot.empty) {
        snapshot.forEach(doc => {
            const reserva = doc.data();
            const dtstart = reserva.fechaLlegada.toDate();
            const dtend = reserva.fechaSalida.toDate();
            
            const formatDateICal = (date) => date.toISOString().split('T')[0].replace(/-/g, '');

            icalContent.push('BEGIN:VEVENT');
            icalContent.push(`UID:${doc.id}@suitemanager`);
            icalContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
            icalContent.push(`DTSTART;VALUE=DATE:${formatDateICal(dtstart)}`);
            icalContent.push(`DTEND;VALUE=DATE:${formatDateICal(dtend)}`);
            icalContent.push(`SUMMARY:Reservado - ${reserva.clienteNombre || 'Ocupado'}`);
            icalContent.push('END:VEVENT');
        });
    }

    icalContent.push('END:VCALENDAR');
    return icalContent.join('\r\n');
}

async function sincronizarCalendarios(db, empresaId, usuarioEmail, filtros = {}) {
    const { canalFiltroId, fechaInicio, fechaFin } = filtros;
    
    const [propiedades, todosLosCanales] = await Promise.all([
        obtenerPropiedadesPorEmpresa(db, empresaId),
        obtenerCanalesPorEmpresa(db, empresaId)
    ]);
    
    const canalesMap = new Map(todosLosCanales.map(c => [c.id, c]));
    const canalFiltro = canalFiltroId ? canalesMap.get(canalFiltroId) : null;

    const nombreArchivoCarga = `Sincronización iCal - ${canalFiltro ? canalFiltro.nombre : 'Todos los Canales'} (${new Date().toLocaleDateString('es-CL')})`;
    const idCarga = await registrarCarga(db, empresaId, canalFiltroId, nombreArchivoCarga, usuarioEmail);

    const propiedadesConIcal = propiedades.filter(p => p.sincronizacionIcal && Object.values(p.sincronizacionIcal).some(url => url));

    if (propiedadesConIcal.length === 0) {
        return { propiedadesRevisadas: 0, nuevasReservasCreadas: 0, errores: [] };
    }

    const reservasExistentesSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas').get();
    const existingIcalUIDs = new Set(reservasExistentesSnapshot.docs.map(doc => doc.data().icalUid).filter(Boolean));

    let nuevasReservasCreadas = 0;
    const errores = [];

    const filtroStartDate = fechaInicio ? new Date(fechaInicio + 'T00:00:00Z') : null;
    const filtroEndDate = fechaFin ? new Date(fechaFin + 'T23:59:59Z') : null;

    for (const prop of propiedadesConIcal) {
        for (const [canalKey, url] of Object.entries(prop.sincronizacionIcal)) {
            if (!url) continue;
            
            const canalEncontrado = todosLosCanales.find(c => c.nombre.toLowerCase() === canalKey.toLowerCase());
            if (canalFiltroId && canalEncontrado?.id !== canalFiltroId) {
                continue;
            }

            try {
                const events = await ical.async.fromURL(url);
                for (const event of Object.values(events)) {
                    if (event.type !== 'VEVENT' || !event.uid || existingIcalUIDs.has(event.uid)) {
                        continue;
                    }

                    const startDate = new Date(event.start);
                    if (filtroStartDate && startDate < filtroStartDate) continue;
                    if (filtroEndDate && startDate > filtroEndDate) continue;
                    
                    const endDate = new Date(event.end);
                    const noches = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));

                    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
                    const nuevaReservaRef = reservasRef.doc();
                    const idGrupo = event.summary || `iCal Event ${event.uid.substring(0, 8)}`;

                    const datosReserva = {
                        id: nuevaReservaRef.id,
                        idUnicoReserva: `${idGrupo}-${prop.id}`,
                        idReservaCanal: idGrupo,
                        icalUid: event.uid,
                        idCarga: idCarga,
                        clienteId: null,
                        alojamientoId: prop.id,
                        alojamientoNombre: prop.nombre,
                        canalId: canalEncontrado ? canalEncontrado.id : null,
                        canalNombre: canalEncontrado ? canalEncontrado.nombre : canalKey,
                        fechaLlegada: admin.firestore.Timestamp.fromDate(startDate),
                        fechaSalida: admin.firestore.Timestamp.fromDate(endDate),
                        totalNoches: noches,
                        cantidadHuespedes: 0,
                        estado: 'Propuesta',
                        origen: 'ical',
                        moneda: canalEncontrado ? canalEncontrado.moneda : 'CLP',
                        valores: { valorHuesped: 0 },
                        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
                    };
                    
                    await nuevaReservaRef.set(datosReserva);
                    existingIcalUIDs.add(event.uid);
                    nuevasReservasCreadas++;
                }
            } catch (error) {
                errores.push(`Error al procesar URL para ${prop.nombre} (${canalKey}): ${error.message}`);
            }
        }
    }

    return {
        propiedadesRevisadas: propiedadesConIcal.length,
        nuevasReservasCreadas,
        errores
    };
}

module.exports = {
    getICalForProperty,
    sincronizarCalendarios
};