const admin = require('firebase-admin');

/**
 * Job cron para expirar propuestas pendientes de pago después de 48 horas
 * Se ejecuta cada 1 hora
 */
const expirarPropuestasPendientes = async () => {
    try {
        const db = admin.firestore();
        console.log('[CRON] 🔍 Buscando propuestas pendientes de pago...');

        const hace48Horas = new Date();
        hace48Horas.setHours(hace48Horas.getHours() - 48);

        // Buscar propuestas de IA que están pendientes de pago hace más de 48h
        const reservasSnapshot = await db.collectionGroup('reservas')
            .where('metadata.origenIA', '==', true)
            .where('metadata.estadoPago', '==', 'pendiente')
            .where('fechaCreacion', '<', admin.firestore.Timestamp.fromDate(hace48Horas))
            .get();

        console.log(`[CRON] 📊 Encontradas ${reservasSnapshot.size} propuestas a expirar`);

        if (reservasSnapshot.empty) {
            console.log('[CRON] ✅ No hay propuestas para expirar');
            return;
        }

        // Agrupar por idReservaCanal para expirar todas las reservas del grupo
        const gruposAExpirar = new Map();

        reservasSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const idGrupo = data.idReservaCanal;

            if (!gruposAExpirar.has(idGrupo)) {
                gruposAExpirar.set(idGrupo, {
                    empresaId: doc.ref.parent.parent.id,
                    reservas: []
                });
            }

            gruposAExpirar.get(idGrupo).reservas.push(doc.ref);
        });

        console.log(`[CRON] 📦 Grupos a expirar: ${gruposAExpirar.size}`);

        // Expirar cada grupo en una transacción
        for (const [idGrupo, grupo] of gruposAExpirar.entries()) {
            try {
                await db.runTransaction(async (transaction) => {
                    // Actualizar todas las reservas del grupo
                    grupo.reservas.forEach(reservaRef => {
                        transaction.update(reservaRef, {
                            estado: 'Expirada',
                            'metadata.estadoPago': 'expirado',
                            fechaExpiracion: admin.firestore.FieldValue.serverTimestamp()
                        });
                    });
                });

                console.log(`[CRON] ⏰ Expirada propuesta ${idGrupo} (${grupo.reservas.length} reservas)`);
            } catch (error) {
                console.error(`[CRON] ❌ Error expirando propuesta ${idGrupo}:`, error.message);
            }
        }

        console.log('[CRON] ✅ Proceso de expiración completado');

    } catch (error) {
        console.error('[CRON] ❌ Error en expirarPropuestasPendientes:', error);
    }
};

// Ejecutar cada 1 hora
const INTERVALO_EJECUCION = 60 * 60 * 1000; // 1 hora en milisegundos

console.log('[CRON] 🚀 Job de expiración automática iniciado');
console.log(`[CRON] ⏱️  Se ejecutará cada ${INTERVALO_EJECUCION / 1000 / 60} minutos`);

// Ejecutar inmediatamente al iniciar (solo en producción)
if (process.env.NODE_ENV === 'production') {
    expirarPropuestasPendientes();
}

// Programar ejecución periódica
setInterval(expirarPropuestasPendientes, INTERVALO_EJECUCION);

module.exports = { expirarPropuestasPendientes };
