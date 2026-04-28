/**
 * Backfill opcional: documentos Firestore `empresas/{empresaId}/reservas` reciben
 * `estadoGestionId` y `estadoPrincipalId` según el catálogo PostgreSQL `estados_reserva`
 * (mismo `empresa_id`). No modifica nombres ni lógica de negocio.
 *
 * Requiere: DATABASE_URL, Firebase Admin (serviceAccountKey.json en backend/ o credencial estándar).
 *
 * Uso:
 *   node backend/scripts/backfill-reservas-firestore-estados-ids.js
 *   node backend/scripts/backfill-reservas-firestore-estados-ids.js <empresaId>
 *
 * No forma parte del runtime del panel ni del SSR; solo ajusta documentos legacy en Firestore.
 */
/* eslint-disable no-console */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const admin = require('firebase-admin');
const pool = require('../db/postgres');

const BATCH_MAX = 400;

async function loadMapsEstados(empresaId) {
    const { rows } = await pool.query(
        'SELECT id, nombre, es_gestion FROM estados_reserva WHERE empresa_id = $1',
        [empresaId]
    );
    const porNombreGestion = new Map();
    const porNombrePrincipal = new Map();
    for (const r of rows) {
        const nom = (r.nombre || '').trim();
        if (!nom) continue;
        if (r.es_gestion) porNombreGestion.set(nom, r.id);
        else porNombrePrincipal.set(nom, r.id);
    }
    return { porNombreGestion, porNombrePrincipal };
}

async function processEmpresa(db, empresaId) {
    const { porNombreGestion, porNombrePrincipal } = await loadMapsEstados(empresaId);
    if (!porNombreGestion.size && !porNombrePrincipal.size) {
        console.log(`[skip] ${empresaId}: sin estados_reserva en PG`);
        return { actualizados: 0, omitidos: 0 };
    }

    const snap = await db.collection('empresas').doc(empresaId).collection('reservas').get();
    if (snap.empty) {
        console.log(`[skip] ${empresaId}: 0 reservas en Firestore`);
        return { actualizados: 0, omitidos: 0 };
    }

    let batch = db.batch();
    let enBatch = 0;
    let actualizados = 0;
    let omitidos = 0;

    const flush = async () => {
        if (enBatch === 0) return;
        await batch.commit();
        batch = db.batch();
        enBatch = 0;
    };

    for (const doc of snap.docs) {
        const data = doc.data() || {};
        const upd = {};

        const egNom = data.estadoGestion != null ? String(data.estadoGestion).trim() : '';
        if (egNom && !data.estadoGestionId) {
            const gid = porNombreGestion.get(egNom);
            if (gid) upd.estadoGestionId = gid;
        }

        const epNom = data.estado != null ? String(data.estado).trim() : '';
        if (epNom && !data.estadoPrincipalId) {
            const pid = porNombrePrincipal.get(epNom);
            if (pid) upd.estadoPrincipalId = pid;
        }

        if (!Object.keys(upd).length) {
            omitidos++;
            continue;
        }

        batch.update(doc.ref, upd);
        enBatch++;
        actualizados++;
        if (enBatch >= BATCH_MAX) await flush();
    }
    await flush();
    console.log(`[ok] ${empresaId}: actualizados=${actualizados} sin_cambio_u_yatenian_ids=${omitidos}`);
    return { actualizados, omitidos };
}

async function main() {
    if (!pool) {
        console.error('PostgreSQL no activo (pool).');
        process.exit(1);
    }
    if (!admin.apps.length) {
        try {
            // eslint-disable-next-line import/no-dynamic-require, global-require
            const sa = require('../serviceAccountKey.json');
            admin.initializeApp({ credential: admin.credential.cert(sa) });
        } catch (e) {
            console.error('No se pudo inicializar Firebase Admin:', e.message);
            process.exit(1);
        }
    }
    const db = admin.firestore();
    const arg = process.argv[2];

    if (arg) {
        await processEmpresa(db, arg);
        process.exit(0);
    }

    const empSnap = await db.collection('empresas').get();
    let tot = 0;
    for (const d of empSnap.docs) {
        const r = await processEmpresa(db, d.id);
        tot += r.actualizados;
    }
    console.log(`\nListo. Total documentos actualizados (suma): ${tot}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
