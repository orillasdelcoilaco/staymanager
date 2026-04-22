/**
 * Migración: websiteData.images de Firestore → PostgreSQL (metadata JSONB)
 *
 * Ejecutar: node backend/db/migrations/migrar-imagenes-firestore-postgres.js
 *
 * Lee cada propiedad de Firestore, toma su websiteData (images + cardImage + aiDescription)
 * y lo escribe en el campo metadata de PostgreSQL si está vacío o desactualizado.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin = require('firebase-admin');
const pool  = require('../postgres');

if (!pool) {
    console.error('❌ DATABASE_URL no configurada. Este script requiere PostgreSQL.');
    process.exit(1);
}

// Inicializar Firebase Admin solo si no está ya inicializado
if (!admin.apps.length) {
    const serviceAccount = require('../../serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function migrar() {
    console.log('🚀 Iniciando migración de imágenes Firestore → PostgreSQL...\n');

    // 1. Obtener todas las empresas
    const empresasSnap = await db.collection('empresas').get();
    console.log(`📋 Empresas encontradas: ${empresasSnap.size}`);

    let totalProps = 0;
    let actualizadas = 0;
    let sinImagenes = 0;

    for (const empresaDoc of empresasSnap.docs) {
        const empresaId = empresaDoc.id;
        const empresaNombre = empresaDoc.data().nombre || empresaId;
        console.log(`\n🏢 Empresa: ${empresaNombre} (${empresaId})`);

        // 2. Obtener propiedades de Firestore
        const propsSnap = await db.collection('empresas').doc(empresaId)
            .collection('propiedades').get();

        console.log(`   Propiedades en Firestore: ${propsSnap.size}`);

        for (const propDoc of propsSnap.docs) {
            totalProps++;
            const firestoreData = propDoc.data();
            const propNombre    = firestoreData.nombre || propDoc.id;

            const websiteDataFirestore = firestoreData.websiteData || null;
            const tieneImagenes = websiteDataFirestore?.images &&
                Object.keys(websiteDataFirestore.images).some(k => websiteDataFirestore.images[k]?.length > 0);
            const tieneCardImage = !!websiteDataFirestore?.cardImage;

            if (!tieneImagenes && !tieneCardImage && !websiteDataFirestore?.aiDescription) {
                sinImagenes++;
                continue; // Nada que migrar para esta propiedad
            }

            // 3. Buscar la propiedad en PostgreSQL por nombre (o id si coincide)
            let pgRows;
            try {
                // Intentar por ID directo primero
                const resPorId = await pool.query(
                    'SELECT id, metadata FROM propiedades WHERE empresa_id = $1 AND id = $2',
                    [empresaId, propDoc.id]
                );
                if (resPorId.rows.length > 0) {
                    pgRows = resPorId.rows;
                } else {
                    // Fallback: buscar por nombre
                    const resPorNombre = await pool.query(
                        'SELECT id, metadata FROM propiedades WHERE empresa_id = $1 AND nombre = $2',
                        [empresaId, propNombre]
                    );
                    pgRows = resPorNombre.rows;
                }
            } catch (err) {
                console.warn(`   ⚠️  Error buscando "${propNombre}" en PG: ${err.message}`);
                continue;
            }

            if (pgRows.length === 0) {
                console.log(`   ⚠️  "${propNombre}" no encontrada en PostgreSQL — omitida`);
                continue;
            }

            const pgRow = pgRows[0];
            const metadataActual = pgRow.metadata || {};
            const websiteDataActual = metadataActual.websiteData || {};

            // 4. Construir websiteData fusionado: Firestore tiene prioridad para imágenes
            const websiteDataFusionado = {
                ...websiteDataActual,
                aiDescription: websiteDataFirestore?.aiDescription || websiteDataActual.aiDescription || '',
                cardImage:     websiteDataFirestore?.cardImage     || websiteDataActual.cardImage     || null,
                images:        {}
            };

            // Fusionar imágenes por componentId
            const imagesSrc  = websiteDataFirestore?.images  || {};
            const imagesDest = websiteDataActual.images || {};
            const todosComponentIds = new Set([...Object.keys(imagesSrc), ...Object.keys(imagesDest)]);

            for (const compId of todosComponentIds) {
                const deFirestore = imagesSrc[compId]  || [];
                const dePg        = imagesDest[compId] || [];
                // Unir sin duplicados por imageId
                const mapaIds = new Map();
                [...dePg, ...deFirestore].forEach(img => mapaIds.set(img.imageId, img));
                websiteDataFusionado.images[compId] = [...mapaIds.values()];
            }

            // 5. Contar imágenes totales
            const totalImagenes = Object.values(websiteDataFusionado.images)
                .reduce((sum, arr) => sum + arr.length, 0);

            // 6. Escribir en PostgreSQL
            try {
                await pool.query(`
                    UPDATE propiedades
                    SET metadata   = metadata || $1::jsonb,
                        updated_at = NOW()
                    WHERE id = $2 AND empresa_id = $3
                `, [
                    JSON.stringify({ websiteData: websiteDataFusionado }),
                    pgRow.id,
                    empresaId
                ]);

                console.log(`   ✅ "${propNombre}" → ${totalImagenes} imagen(es) migrada(s)${tieneCardImage ? ' + card image' : ''}`);
                actualizadas++;
            } catch (err) {
                console.error(`   ❌ Error actualizando "${propNombre}": ${err.message}`);
            }
        }
    }

    console.log('\n─────────────────────────────────────────');
    console.log(`✅ Migración completada`);
    console.log(`   Propiedades procesadas : ${totalProps}`);
    console.log(`   Actualizadas con datos : ${actualizadas}`);
    console.log(`   Sin imágenes (omitidas): ${sinImagenes}`);
    console.log('─────────────────────────────────────────\n');

    await pool.end();
    process.exit(0);
}

migrar().catch(err => {
    console.error('❌ Error fatal en migración:', err);
    process.exit(1);
});
