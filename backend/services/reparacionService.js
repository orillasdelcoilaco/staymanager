const admin = require('firebase-admin');

const repararFechasSODC = async (db, empresaId) => {
    // ... (código existente sin cambios)
    console.log(`[Reparación] Iniciando proceso de reparación de fechas para la empresa: ${empresaId}`);
    
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const snapshot = await reservasRef.where('canalNombre', '==', 'SODC').get();

    if (snapshot.empty) {
        console.log('[Reparación] No se encontraron reservas del canal SODC para verificar.');
        return { totalRevisadas: 0, totalCorregidas: 0, errores: 0 };
    }

    let totalRevisadas = snapshot.size;
    let totalCorregidas = 0;
    let errores = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
        try {
            const reserva = doc.data();
            const fechaLlegadaActual = reserva.fechaLlegada.toDate();
            const fechaSalidaActual = reserva.fechaSalida.toDate();

            let llegadaCorregida = null;
            let salidaCorregida = null;

            if (fechaLlegadaActual.getUTCDate() <= 12 && fechaLlegadaActual.getUTCMonth() + 1 > fechaLlegadaActual.getUTCDate()) {
                llegadaCorregida = new Date(Date.UTC(
                    fechaLlegadaActual.getUTCFullYear(),
                    fechaLlegadaActual.getUTCDate() - 1,
                    fechaLlegadaActual.getUTCMonth() + 1
                ));
            }

            if (fechaSalidaActual.getUTCDate() <= 12 && fechaSalidaActual.getUTCMonth() + 1 > fechaSalidaActual.getUTCDate()) {
                salidaCorregida = new Date(Date.UTC(
                    fechaSalidaActual.getUTCFullYear(),
                    fechaSalidaActual.getUTCDate() - 1,
                    fechaSalidaActual.getUTCMonth() + 1
                ));
            }

            if (llegadaCorregida || salidaCorregida) {
                const updates = {};
                if (llegadaCorregida) updates.fechaLlegada = admin.firestore.Timestamp.fromDate(llegadaCorregida);
                if (salidaCorregida) updates.fechaSalida = admin.firestore.Timestamp.fromDate(salidaCorregida);
                
                batch.update(doc.ref, updates);
                totalCorregidas++;
            }
        } catch (error) {
            console.error(`[Reparación] Error procesando reserva ${doc.id}:`, error);
            errores++;
        }
    }

    if (totalCorregidas > 0) {
        await batch.commit();
    }

    console.log(`[Reparación] Proceso finalizado. Revisadas: ${totalRevisadas}, Corregidas: ${totalCorregidas}, Errores: ${errores}`);
    return { totalRevisadas, totalCorregidas, errores };
};

const repararHistorialDolar = async (db, empresaId) => {
    const collectionRef = db.collection('empresas').doc(empresaId).collection('valoresDolar');
    
    // 1. Encontrar la fecha mínima y máxima
    const firstDoc = await collectionRef.orderBy('fecha', 'asc').limit(1).get();
    const lastDoc = await collectionRef.orderBy('fecha', 'desc').limit(1).get();

    if (firstDoc.empty || lastDoc.empty) {
        throw new Error("No hay suficientes datos históricos para realizar la reparación.");
    }

    const minDate = firstDoc.docs[0].data().fecha.toDate();
    const maxDate = lastDoc.docs[0].data().fecha.toDate();

    // 2. Obtener todos los documentos existentes para evitar múltiples lecturas
    const allDocsSnapshot = await collectionRef.get();
    const existingValues = new Map();
    allDocsSnapshot.forEach(doc => {
        existingValues.set(doc.id, doc.data().valor);
    });

    const batch = db.batch();
    let gapsFilled = 0;
    
    // 3. Iterar día por día desde la fecha mínima hasta la máxima
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const currentDateStr = new Date(d).toISOString().split('T')[0];

        if (!existingValues.has(currentDateStr)) {
            // 4. Si falta el día, buscar el valor anterior y siguiente
            const prevQuery = await collectionRef.where('fecha', '<', admin.firestore.Timestamp.fromDate(d)).orderBy('fecha', 'desc').limit(1).get();
            const nextQuery = await collectionRef.where('fecha', '>', admin.firestore.Timestamp.fromDate(d)).orderBy('fecha', 'asc').limit(1).get();

            const prevValue = !prevQuery.empty ? prevQuery.docs[0].data().valor : null;
            const nextValue = !nextQuery.empty ? nextQuery.docs[0].data().valor : null;

            if (prevValue !== null || nextValue !== null) {
                // 5. Usar el mayor valor, o el que exista si uno es nulo
                const fillValue = Math.max(prevValue || -Infinity, nextValue || -Infinity);
                
                const newDocRef = collectionRef.doc(currentDateStr);
                batch.set(newDocRef, {
                    valor: fillValue,
                    fecha: admin.firestore.Timestamp.fromDate(new Date(currentDateStr + 'T00:00:00Z')),
                    modificadoManualmente: true
                });
                gapsFilled++;
            }
        }
    }

    if (gapsFilled > 0) {
        await batch.commit();
    }
    
    return {
        rangoAnalizado: `${minDate.toISOString().split('T')[0]} a ${maxDate.toISOString().split('T')[0]}`,
        diasRellenados: gapsFilled
    };
};


module.exports = {
    repararFechasSODC,
    repararHistorialDolar
};