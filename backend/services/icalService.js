// backend/services/icalService.js
const admin = require('firebase-admin');

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
            icalContent.push(`SUMMARY:Reservado`);
            icalContent.push('END:VEVENT');
        });
    }

    icalContent.push('END:VCALENDAR');
    return icalContent.join('\r\n');
}

module.exports = {
    getICalForProperty
};