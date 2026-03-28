// backend/services/empresaService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

// Mapea una fila PostgreSQL al formato que espera el resto del sistema
function mapearEmpresa(row) {
    if (!row) return null;
    return {
        id: row.id,
        nombre: row.nombre,
        email: row.email,
        plan: row.plan,
        dominio: row.dominio,
        subdominio: row.subdominio,
        google_maps_url: row.google_maps_url || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(row.configuracion || {})
    };
}

// ─────────────────────────────────────────────
// OBTENER EMPRESA POR ID
// ─────────────────────────────────────────────
const obtenerDetallesEmpresa = async (db, empresaId) => {
    if (!empresaId) throw new Error('El ID de la empresa es requerido.');

    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM empresas WHERE id = $1',
            [empresaId]
        );
        if (!rows[0]) throw new Error('La empresa no fue encontrada.');
        return mapearEmpresa(rows[0]);
    }

    // Firestore fallback
    const doc = await db.collection('empresas').doc(empresaId).get();
    if (!doc.exists) throw new Error('La empresa no fue encontrada.');
    return doc.data();
};

// ─────────────────────────────────────────────
// ACTUALIZAR EMPRESA
// ─────────────────────────────────────────────
const actualizarDetallesEmpresa = async (db, empresaId, datos) => {
    if (!empresaId) throw new Error('El ID de la empresa es requerido.');

    if (pool) {
        // Extraer campos estructurados; el resto va a configuracion JSONB
        const { nombre, email, plan, dominio, subdominio, google_maps_url, ...resto } = datos;

        // Lógica de subdominio automático (igual que antes)
        let dominioFinal = dominio;
        let subdominioFinal = subdominio;

        if (resto.websiteSettings?.general?.subdomain) {
            const sub = resto.websiteSettings.general.subdomain;
            subdominioFinal = subdominioFinal || sub;
            if (!resto.websiteSettings.general.domain) {
                resto.websiteSettings.general.domain = `${sub}.suitemanagers.com`;
            }
            dominioFinal = dominioFinal || resto.websiteSettings.general.domain;
            resto.websiteSettings.subdomain = sub;
            resto.websiteSettings.domain = dominioFinal;
        }

        // Merge de configuracion existente con los nuevos datos
        await pool.query(`
            UPDATE empresas SET
                nombre          = COALESCE($2, nombre),
                email           = COALESCE($3, email),
                plan            = COALESCE($4, plan),
                dominio         = COALESCE($5, dominio),
                subdominio      = COALESCE($6, subdominio),
                configuracion   = configuracion || $7::jsonb,
                google_maps_url = COALESCE($8, google_maps_url),
                updated_at      = NOW()
            WHERE id = $1
        `, [
            empresaId,
            nombre  || null,
            email   || null,
            plan    || null,
            dominioFinal    || null,
            subdominioFinal || null,
            JSON.stringify(resto),
            google_maps_url || null
        ]);
        return;
    }

    // Firestore fallback
    let datosFinales = { ...datos };
    if (datos.websiteSettings?.general?.subdomain) {
        const sub = datos.websiteSettings.general.subdomain;
        if (!datos.websiteSettings.general.domain) {
            datosFinales.websiteSettings.general.domain = `${sub}.suitemanagers.com`;
        }
        datosFinales['websiteSettings.subdomain'] = sub;
        datosFinales['websiteSettings.domain'] = datosFinales.websiteSettings.general.domain;
    }
    await db.collection('empresas').doc(empresaId).update({
        ...datosFinales,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
};

// ─────────────────────────────────────────────
// PRÓXIMO ID NUMÉRICO DE CARGA
// En PostgreSQL lo maneja el SERIAL de historial_cargas.
// Se mantiene por compatibilidad; devuelve el próximo valor de la secuencia.
// ─────────────────────────────────────────────
const obtenerProximoIdNumericoCarga = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query(
            `SELECT COALESCE(MAX(id_numerico), 0) + 1 AS proximo
             FROM historial_cargas WHERE empresa_id = $1`,
            [empresaId]
        );
        return rows[0].proximo;
    }

    // Firestore fallback
    const empresaRef = db.collection('empresas').doc(empresaId);
    return db.runTransaction(async (transaction) => {
        const empresaDoc = await transaction.get(empresaRef);
        if (!empresaDoc.exists) throw new Error('La empresa no existe.');
        const proximoId = (empresaDoc.data().proximoIdCargaNumerico || 0) + 1;
        transaction.update(empresaRef, { proximoIdCargaNumerico: proximoId });
        return proximoId;
    });
};

// ─────────────────────────────────────────────
// BUSCAR EMPRESA POR DOMINIO (SSR — tenantResolver)
// ─────────────────────────────────────────────
const obtenerEmpresaPorDominio = async (db, hostname) => {
    if (pool) {
        if (
            hostname.endsWith('.onrender.com') ||
            hostname.endsWith('.suitemanager.com') ||
            hostname.endsWith('.suitemanagers.com')
        ) {
            const subdomain = hostname.split('.')[0];
            const { rows } = await pool.query(
                'SELECT * FROM empresas WHERE subdominio = $1 LIMIT 1',
                [subdomain]
            );
            if (rows[0]) return mapearEmpresa(rows[0]);

            // Buscar también dentro de configuracion JSONB (compatibilidad migración)
            const { rows: rows2 } = await pool.query(
                `SELECT * FROM empresas
                 WHERE configuracion->>'websiteSettings' IS NOT NULL
                   AND configuracion->'websiteSettings'->>'subdomain' = $1
                 LIMIT 1`,
                [subdomain]
            );
            if (rows2[0]) return mapearEmpresa(rows2[0]);
        }

        const { rows } = await pool.query(
            'SELECT * FROM empresas WHERE dominio = $1 LIMIT 1',
            [hostname]
        );
        if (rows[0]) return mapearEmpresa(rows[0]);

        // Buscar en configuracion JSONB
        const { rows: rows2 } = await pool.query(
            `SELECT * FROM empresas
             WHERE configuracion->'websiteSettings'->>'domain' = $1
             LIMIT 1`,
            [hostname]
        );
        return rows2[0] ? mapearEmpresa(rows2[0]) : null;
    }

    // Firestore fallback
    const empresasRef = db.collection('empresas');
    if (
        hostname.endsWith('.onrender.com') ||
        hostname.endsWith('.suitemanager.com') ||
        hostname.endsWith('.suitemanagers.com')
    ) {
        const subdomain = hostname.split('.')[0];
        const snap = await empresasRef.where('websiteSettings.subdomain', '==', subdomain).limit(1).get();
        if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
    const snap = await empresasRef.where('websiteSettings.domain', '==', hostname).limit(1).get();
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
    return null;
};

module.exports = {
    obtenerDetallesEmpresa,
    actualizarDetallesEmpresa,
    obtenerProximoIdNumericoCarga,
    obtenerEmpresaPorDominio
};
