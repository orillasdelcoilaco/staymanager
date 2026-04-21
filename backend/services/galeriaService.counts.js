// backend/services/galeriaService.counts.js — conteos de galería por propiedad (PG / Firestore)
const { IS_POSTGRES } = require('../config/dbConfig');
const pool = require('../db/postgres');

async function getCountsPostgres(empresaId) {
    const [galeriaResult, propiedadesResult] = await Promise.all([
        pool.query(`
                SELECT propiedad_id,
                       SUM(CASE WHEN estado IN ('auto','manual') THEN 1 ELSE 0 END) AS asignadas,
                       SUM(CASE WHEN estado = 'pendiente'        THEN 1 ELSE 0 END) AS pendientes,
                       0 AS descartadas,
                       MAX(CASE WHEN rol = 'portada' THEN thumbnail_url END)             AS portada_url,
                       MAX(CASE WHEN estado IN ('auto','manual') THEN thumbnail_url END) AS primera_url,
                       COUNT(DISTINCT CASE
                           WHEN estado IN ('auto','manual')
                            AND shot_context IS NOT NULL
                            AND shot_context != '[object Object]'
                            AND shot_context != ''
                           THEN shot_context END) AS slots_cumplidos
                FROM galeria WHERE empresa_id = $1
                GROUP BY propiedad_id
            `, [empresaId]),
        pool.query(`
                SELECT id, (metadata->>'fotoPlanTotal')::int AS foto_plan_total
                FROM propiedades
                WHERE empresa_id = $1 AND metadata ? 'fotoPlanTotal'
            `, [empresaId]),
    ]);

    const totalesMap = {};
    for (const r of propiedadesResult.rows) {
        totalesMap[r.id] = r.foto_plan_total || 0;
    }

    const result = {};
    for (const r of galeriaResult.rows) {
        result[r.propiedad_id] = {
            asignadas: parseInt(r.asignadas || 0, 10),
            pendientes: parseInt(r.pendientes || 0, 10),
            descartadas: parseInt(r.descartadas || 0, 10),
            portadaUrl: r.portada_url || r.primera_url || null,
            slotsCumplidos: parseInt(r.slots_cumplidos || 0, 10),
            slotsTotal: totalesMap[r.propiedad_id] || 0,
        };
    }

    for (const [propId, total] of Object.entries(totalesMap)) {
        if (!result[propId]) {
            result[propId] = {
                asignadas: 0, pendientes: 0, descartadas: 0,
                portadaUrl: null, slotsCumplidos: 0, slotsTotal: total,
            };
        }
    }

    return result;
}

async function getCountsFirestore(db, empresaId) {
    const [galeriaSnap, propiedadesSnap] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
    ]);

    const result = {};
    const totalesMap = {};
    propiedadesSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.metadata?.fotoPlanTotal) {
            totalesMap[doc.id] = data.metadata.fotoPlanTotal;
        }
    });

    for (const propDoc of galeriaSnap.docs) {
        const propiedadId = propDoc.id;
        const gSnap = await db.collection('empresas').doc(empresaId)
            .collection('propiedades').doc(propiedadId).collection('galeria').get();

        let asignadas = 0;
        let pendientes = 0;
        let portadaUrl = null;
        let primeraUrl = null;
        const slotsCumplidosSet = new Set();

        gSnap.docs.forEach((fotoDoc) => {
            const foto = fotoDoc.data();
            if (foto.estado === 'auto' || foto.estado === 'manual') {
                asignadas += 1;
                if (foto.rol === 'portada') portadaUrl = foto.thumbnailUrl || foto.storageUrl;
                if (!primeraUrl) primeraUrl = foto.thumbnailUrl || foto.storageUrl;
                if (foto.shot_context && foto.shot_context !== '[object Object]' && foto.shot_context !== '') {
                    slotsCumplidosSet.add(foto.shot_context);
                }
            } else if (foto.estado === 'pendiente') {
                pendientes += 1;
            }
        });

        result[propiedadId] = {
            asignadas,
            pendientes,
            descartadas: 0,
            portadaUrl: portadaUrl || primeraUrl || null,
            slotsCumplidos: slotsCumplidosSet.size,
            slotsTotal: totalesMap[propiedadId] || 0,
        };
    }

    for (const [propId, total] of Object.entries(totalesMap)) {
        if (!result[propId]) {
            result[propId] = {
                asignadas: 0, pendientes: 0, descartadas: 0,
                portadaUrl: null, slotsCumplidos: 0, slotsTotal: total,
            };
        }
    }

    return result;
}

async function getCounts(db, empresaId) {
    if (IS_POSTGRES) return getCountsPostgres(empresaId);
    return getCountsFirestore(db, empresaId);
}

module.exports = { getCounts };
