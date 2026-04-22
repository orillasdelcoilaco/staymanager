/**
 * Migración: Propiedades completas de Firestore → PostgreSQL
 *
 * Copia propiedades (incluyendo componentes, websiteData e imágenes) de Firestore
 * a la tabla propiedades en PostgreSQL para empresas que aún no tienen sus
 * propiedades en PostgreSQL.
 *
 * Ejecutar: node backend/db/migrations/migrar-propiedades-firestore-postgres.js
 *
 * IMPORTANTE: Este script NO borra datos existentes en PostgreSQL.
 * Solo crea propiedades que no existen en PG (match por empresa_id + nombre).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const admin  = require('firebase-admin');
const pool   = require('../postgres');
const { v4: uuidv4 } = require('uuid');

if (!pool) {
    console.error('❌ DATABASE_URL no configurada. Este script requiere PostgreSQL.');
    process.exit(1);
}

if (!admin.apps.length) {
    const serviceAccount = require('../../serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcularCapacidad(componentes) {
    let cap = 0;
    for (const comp of (componentes || [])) {
        for (const elem of (comp.elementos || [])) {
            cap += (elem.capacity || 0) * (elem.cantidad || 1);
        }
    }
    return cap;
}

// ── Migración ─────────────────────────────────────────────────────────────────

async function migrar() {
    console.log('🚀 Iniciando migración de propiedades Firestore → PostgreSQL...\n');

    const empresasSnap = await db.collection('empresas').get();
    console.log(`📋 Empresas encontradas en Firestore: ${empresasSnap.size}\n`);

    let totalCreadas = 0;
    let totalOmitidas = 0;
    let totalErrores = 0;

    for (const empresaDoc of empresasSnap.docs) {
        const empresaId  = empresaDoc.id;
        const empresaNombre = empresaDoc.data().nombre || empresaId;

        // Obtener propiedades de Firestore
        const fsSnap = await db.collection('empresas').doc(empresaId)
            .collection('propiedades').get();

        if (fsSnap.empty) continue;

        console.log(`🏢 ${empresaNombre} (${empresaId}) — ${fsSnap.size} propiedades en Firestore`);

        // Obtener propiedades ya en PostgreSQL para esta empresa
        const { rows: pgRows } = await pool.query(
            'SELECT id, nombre FROM propiedades WHERE empresa_id = $1',
            [empresaId]
        );
        const nombresPG = new Set(pgRows.map(r => (r.nombre || '').trim().toLowerCase()));

        for (const propDoc of fsSnap.docs) {
            const data = propDoc.data();
            const nombre = (data.nombre || '').trim();

            if (!nombre) { totalOmitidas++; continue; }

            // Si ya existe en PG, omitir
            if (nombresPG.has(nombre.toLowerCase())) {
                console.log(`   ⏭️  "${nombre}" ya existe en PostgreSQL — omitida`);
                totalOmitidas++;
                continue;
            }

            try {
                const newId = uuidv4();
                const componentes = data.componentes || [];
                const capacidad = data.capacidad || data.capacidadMaxima || calcularCapacidad(componentes) || 2;
                const numPiezas = data.numPiezas || data.numDormitorios || 1;
                const descripcion = data.descripcion || '';

                const metadata = {
                    numBanos:        data.numBanos || 1,
                    camas:           data.camas || {},
                    equipamiento:    data.equipamiento || {},
                    capacidadMaxima: capacidad,
                    componentes:     componentes,
                    amenidades:      data.amenidades || [],
                    googleHotelData: data.googleHotelData || {},
                    websiteData:     data.websiteData || { aiDescription: '', images: {}, cardImage: null },
                };

                await pool.query(`
                    INSERT INTO propiedades
                        (id, empresa_id, nombre, capacidad, num_piezas, descripcion, activo, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    newId,
                    empresaId,
                    nombre,
                    capacidad,
                    numPiezas,
                    descripcion,
                    true,
                    JSON.stringify(metadata)
                ]);

                const totalImagenes = Object.values(metadata.websiteData.images || {})
                    .reduce((s, arr) => s + arr.length, 0);
                const tieneCard = !!metadata.websiteData.cardImage;

                console.log(`   ✅ "${nombre}" → id: ${newId} | cap: ${capacidad} | imgs: ${totalImagenes}${tieneCard ? ' + card' : ''}`);
                totalCreadas++;

            } catch (err) {
                console.error(`   ❌ Error migrando "${nombre}": ${err.message}`);
                totalErrores++;
            }
        }
        console.log('');
    }

    console.log('─────────────────────────────────────────');
    console.log(`✅ Migración completada`);
    console.log(`   Propiedades creadas  : ${totalCreadas}`);
    console.log(`   Omitidas (ya existían): ${totalOmitidas}`);
    console.log(`   Errores              : ${totalErrores}`);
    console.log('─────────────────────────────────────────\n');

    await pool.end();
    process.exit(0);
}

migrar().catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
});
