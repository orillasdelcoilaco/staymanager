const admin = require('firebase-admin');
const { findContactByName } = require('./googleContactsService');
const { normalizarTelefono } = require('./clientesService');

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

    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        
        if (existingIndex < existingValues.length && existingValues[existingIndex].fecha.getTime() === currentDate.getTime()) {
            existingIndex++;
            continue;
        }

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

const verificarSincronizacionContactos = async (db, empresaId) => {
    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');
    const clientesSnapshot = await clientesRef.get();
    if (clientesSnapshot.empty) {
        return { clientesRevisados: 0, contactosYaSincronizados: 0, contactosNuevosSincronizados: 0, telefonosCorregidos: 0, clientesNoSincronizables: 0 };
    }

    const batch = db.batch();
    let summary = {
        clientesRevisados: clientesSnapshot.size,
        contactosYaSincronizados: 0,
        contactosNuevosSincronizados: 0,
        telefonosCorregidos: 0,
        clientesNoSincronizables: 0
    };
    
    const authClient = await require('./googleContactsService').getAuthenticatedClient(db, empresaId);

    for (const doc of clientesSnapshot.docs) {
        const cliente = doc.data();
        let necesitaUpdate = false;
        const updates = {};

        // 1. Normalizar teléfono
        const telefonoNormal = normalizarTelefono(cliente.telefono);
        if (telefonoNormal !== cliente.telefonoNormalizado) {
            updates.telefonoNormalizado = telefonoNormal;
            necesitaUpdate = true;
            summary.telefonosCorregidos++;
        }

        // 2. Verificar sincronización
        if (cliente.googleContactSynced) {
            summary.contactosYaSincronizados++;
        } else {
            const reservaSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
                .where('clienteId', '==', doc.id)
                .orderBy('fechaReserva', 'desc')
                .limit(1)
                .get();
            
            if (!reservaSnapshot.empty) {
                const reserva = reservaSnapshot.docs[0].data();
                const contactName = `${cliente.nombre} ${reserva.canalNombre} ${reserva.idReservaCanal}`;
                const existeEnGoogle = await findContactByName(authClient, contactName);
                if (existeEnGoogle) {
                    updates.googleContactSynced = true;
                    necesitaUpdate = true;
                    summary.contactosNuevosSincronizados++;
                }
            } else {
                summary.clientesNoSincronizables++;
            }
        }
        
        if (necesitaUpdate) {
            batch.update(doc.ref, updates);
        }
    }

    if (summary.contactosNuevosSincronizados > 0 || summary.telefonosCorregidos > 0) {
        await batch.commit();
    }
    
    return summary;
};


module.exports = {
    repararFechasSODC,
    repararHistorialDolar,
    verificarSincronizacionContactos
};