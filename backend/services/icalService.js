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

async function sincronizarCalendarios(db, empresaId, usuarioEmail) {
    console.log("[DEBUG] Iniciando sincronización de calendarios iCal...");

    const [propiedades, todosLosCanales] = await Promise.all([
        obtenerPropiedadesPorEmpresa(db, empresaId),
        obtenerCanalesPorEmpresa(db, empresaId)
    ]);

    const canalIcal = todosLosCanales.find(c => c.esCanalIcal === true);
    if (!canalIcal) {
        throw new Error("No se ha configurado un canal para la sincronización iCal. Por favor, marque uno en 'Gestionar Canales'.");
    }

    const nombreCarga = `Sincronización iCal - ${new Date().toLocaleString('es-CL')}`;
    const idCarga = await registrarCarga(db, empresaId, canalIcal.id, nombreCarga, usuarioEmail);
    
    const canalesMap = new Map(todosLosCanales.map(c => [c.nombre.toLowerCase(), c]));
    console.log("[DEBUG] Canales mapeados:", Array.from(canalesMap.keys()));

    const propiedadesConIcal = propiedades.filter(p => p.sincronizacionIcal && Object.values(p.sincronizacionIcal).some(url => url));

    if (propiedadesConIcal.length === 0) {
        console.log("[DEBUG] No se encontraron propiedades con URLs de iCal configuradas.");
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

                    const canalEncontrado = canalesMap.get(canalKey.toLowerCase()) || canalIcal;

                    const startDate = new Date(event.start);
                    const endDate = new Date(event.end);
                    const noches = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
                    
                    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
                    const nuevaReservaRef = reservasRef.doc();
                    
                    // --- INICIO DE LA CORRECCIÓN ---
                    // Se usa el UID del evento para asegurar un ID de grupo único.
                    const idGrupo = `iCal-${event.uid.substring(0, 20)}`;
                    // --- FIN DE LA CORRECCIÓN ---

                    const datosReserva = {
                        id: nuevaReservaRef.id,
                        idCarga: idCarga,
                        idUnicoReserva: `${idGrupo}-${prop.id}`,
                        idReservaCanal: idGrupo,
                        icalUid: event.uid,
                        clienteId: null,
                        alojamientoId: prop.id,
                        alojamientoNombre: prop.nombre,
                        canalId: canalEncontrado.id,
                        canalNombre: canalEncontrado.nombre,
                        fechaLlegada: admin.firestore.Timestamp.fromDate(startDate),
                        fechaSalida: admin.firestore.Timestamp.fromDate(endDate),
                        totalNoches: noches,
                        cantidadHuespedes: 0,
                        estado: 'Propuesta',
                        origen: 'ical',
                        moneda: canalEncontrado.moneda,
                        valores: { valorHuesped: 0 },
                        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
                    };
                    
                    await nuevaReservaRef.set(datosReserva);
                    existingIcalUIDs.add(event.uid);
                    nuevasReservasCreadas++;
                }
            } catch (error) {
                errores.push(`Error al procesar URL para ${prop.nombre} (${canalKey}): ${error.message}`);
                console.error(`[DEBUG - ERROR en icalService]`, error);
            }
        }
    }

    console.log("[DEBUG] Sincronización de iCal finalizada.");
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