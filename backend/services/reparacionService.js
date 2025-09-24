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
    
    // 1. Obtener todos los documentos existentes UNA SOLA VEZ y ordenarlos
    const allDocsSnapshot = await collectionRef.orderBy('fecha', 'asc').get();
    if (allDocsSnapshot.empty) {
        throw new Error("No hay datos históricos para realizar la reparación.");
    }
    
    const existingValues = allDocsSnapshot.docs.map(doc => ({
        fecha: doc.data().fecha.toDate(),
        valor: doc.data().valor
    }));

    const minDate = existingValues[0].fecha;
    const maxDate = existingValues[existingValues.length - 1].fecha;
    
    const batch = db.batch();
    let gapsFilled = 0;
    let existingIndex = 0;

    // 2. Iterar día por día desde la fecha mínima hasta la máxima
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        
        // Avanzar el puntero si la fecha actual ya existe
        if (existingIndex < existingValues.length && existingValues[existingIndex].fecha.getTime() === currentDate.getTime()) {
            existingIndex++;
            continue;
        }

        // 3. Si el día falta, encontrar el valor anterior y siguiente en memoria
        const prevValueData = existingValues[existingIndex - 1];
        const nextValueData = existingValues[existingIndex];

        const prevValue = prevValueData ? prevValueData.valor : null;
        const nextValue = nextValueData ? nextValueData.valor : null;

        if (prevValue !== null || nextValue !== null) {
            const fillValue = Math.max(prevValue || -Infinity, nextValue || -Infinity);
            
            const currentDateStr = currentDate.toISOString().split('T')[0];
            const newDocRef = collectionRef.doc(currentDateStr);
            batch.set(newDocRef, {
                valor: fillValue,
                fecha: admin.firestore.Timestamp.fromDate(currentDate),
                modificadoManualmente: true
            });
            gapsFilled++;
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