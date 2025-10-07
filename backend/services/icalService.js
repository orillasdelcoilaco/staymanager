// backend/services/icalService.js
const admin = require('firebase-admin');
const ical = require('node-ical');
const { obtenerPropiedadesPorEmpresa } = require('./propiedadesService');

const sincronizarCalendarios = async (db, empresaId) => {
    const propiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
    const propiedadesConIcal = propiedades.filter(p => p.sincronizacionIcal && Object.values(p.sincronizacionIcal).some(url => url));

    if (propiedadesConIcal.length === 0) {
        return { message: 'No hay propiedades con URLs de iCal configuradas.' };
    }

    let nuevasReservasCreadas = 0;
    const errores = [];

    for (const prop of propiedadesConIcal) {
        for (const [canal, url] of Object.entries(prop.sincronizacionIcal)) {
            if (!url) continue;

            try {
                const webEvents = await ical.async.fromURL(url);
                for (const event of Object.values(webEvents)) {
                    if (event.type !== 'VEVENT' || !event.uid || !event.start || !event.end) {
                        continue;
                    }

                    const idReservaCanal = event.uid;
                    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
                    const q = reservasRef.where('idReservaCanal', '==', idReservaCanal);
                    const snapshot = await q.get();

                    if (snapshot.empty) {
                        const nuevaReservaRef = reservasRef.doc();
                        const datosReserva = {
                            id: nuevaReservaRef.id,
                            idReservaCanal: idReservaCanal,
                            alojamientoId: prop.id,
                            alojamientoNombre: prop.nombre,
                            canalNombre: canal.charAt(0).toUpperCase() + canal.slice(1),
                            clienteNombre: `Reserva Externa (${canal.charAt(0).toUpperCase() + canal.slice(1)})`,
                            fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(event.start)),
                            fechaSalida: admin.firestore.Timestamp.fromDate(new Date(event.end)),
                            estado: 'Propuesta',
                            estadoGestion: null,
                            origen: 'ical',
                            totalNoches: Math.round((new Date(event.end) - new Date(event.start)) / (1000 * 60 * 60 * 24)),
                            valores: { valorHuesped: 0, valorTotal: 0 },
                            fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
                        };
                        await nuevaReservaRef.set(datosReserva);
                        nuevasReservasCreadas++;
                    }
                }
            } catch (error) {
                console.error(`Error procesando iCal para ${prop.nombre} desde ${canal}:`, error.message);
                errores.push(`Falló la sincronización para ${prop.nombre} del canal ${canal}.`);
            }
        }
    }

    return {
        propiedadesRevisadas: propiedadesConIcal.length,
        nuevasReservasCreadas,
        errores
    };
};

module.exports = {
    sincronizarCalendarios
};