// backend/services/icalService.js
const admin = require('firebase-admin');
const ical = require('node-ical');
const { guardarOActualizarPropuesta } = require('./gestionPropuestasService');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');

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
            icalContent.push(`SUMMARY:Reservado - ${reserva.nombreCliente || 'Ocupado'}`);
            icalContent.push('END:VEVENT');
        });
    }

    icalContent.push('END:VCALENDAR');
    return icalContent.join('\r\n');
}

async function sincronizarCalendarios(db, empresaId) {
    const propiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
    const propiedadesConIcal = propiedades.filter(p => p.sincronizacionIcal && Object.values(p.sincronizacionIcal).some(url => url));

    if (propiedadesConIcal.length === 0) {
        return { propiedadesRevisadas: 0, nuevasReservasCreadas: 0, errores: [] };
    }

    const reservasExistentesSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas').get();
    const existingIcalUIDs = new Set(reservasExistentesSnapshot.docs.map(doc => doc.data().icalUid).filter(Boolean));

    let nuevasReservasCreadas = 0;
    const errores = [];

    for (const prop of propiedadesConIcal) {
        for (const [canalKey, url] of Object.entries(prop.sincronizacionIcal)) {
            if (!url) continue;

            try {
                const events = await ical.async.fromURL(url);
                for (const event of Object.values(events)) {
                    if (event.type !== 'VEVENT' || !event.uid || existingIcalUIDs.has(event.uid)) {
                        continue;
                    }

                    const startDate = new Date(event.start);
                    const endDate = new Date(event.end);
                    const noches = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

                    const datosPropuesta = {
                        cliente: { nombre: 'Cliente iCal' },
                        fechaLlegada: startDate.toISOString().split('T')[0],
                        fechaSalida: endDate.toISOString().split('T')[0],
                        propiedades: [prop],
                        precioFinal: 0,
                        noches,
                        canalNombre: canalKey.charAt(0).toUpperCase() + canalKey.slice(1),
                        moneda: 'CLP',
                        valorDolarDia: null,
                        valorOriginal: 0,
                        idReservaCanal: event.summary || `iCal Event ${event.uid.substring(0, 8)}`,
                        origen: 'ical',
                        icalUid: event.uid
                    };
                    
                    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
                    const nuevaReservaRef = reservasRef.doc();
                    const idGrupo = nuevaReservaRef.id;

                    const datosReserva = {
                        id: nuevaReservaRef.id,
                        idUnicoReserva: `${idGrupo}-${prop.id}`,
                        idReservaCanal: datosPropuesta.idReservaCanal,
                        icalUid: datosPropuesta.icalUid,
                        clienteId: null,
                        alojamientoId: prop.id,
                        alojamientoNombre: prop.nombre,
                        canalNombre: datosPropuesta.canalNombre,
                        fechaLlegada: admin.firestore.Timestamp.fromDate(startDate),
                        fechaSalida: admin.firestore.Timestamp.fromDate(endDate),
                        totalNoches: noches,
                        cantidadHuespedes: 0,
                        estado: 'Propuesta',
                        origen: 'ical',
                        moneda: 'CLP',
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