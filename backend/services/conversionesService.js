// backend/services/conversionesService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

function mapearConversion(row) {
    if (!row) return null;
    return {
        id: row.id,
        alojamientoId: row.propiedad_id,
        canalId: row.canal_id,
        nombreExterno: row.nombre_externo,
        // Campos legacy de Firestore almacenados en el nombre si aplica
        alojamientoNombre: row.nombre_externo
    };
}

const crearConversion = async (db, empresaId, datos) => {
    if (!empresaId || !datos.canalId || !datos.nombreExterno) {
        throw new Error('Faltan datos requeridos para crear la conversión.');
    }

    if (pool) {
        const { rows } = await pool.query(`
            INSERT INTO conversiones (empresa_id, canal_id, nombre_externo, propiedad_id)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (empresa_id, canal_id, nombre_externo) DO UPDATE SET
                propiedad_id = $4
            RETURNING *
        `, [
            empresaId,
            datos.canalId,
            datos.nombreExterno,
            datos.alojamientoId || null
        ]);
        return mapearConversion(rows[0]);
    }

    // Firestore fallback
    const conversionRef = db.collection('empresas').doc(empresaId).collection('conversionesAlojamiento').doc();
    const nuevaConversion = { ...datos, fechaCreacion: admin.firestore.FieldValue.serverTimestamp() };
    await conversionRef.set(nuevaConversion);
    return { id: conversionRef.id, ...nuevaConversion };
};

const obtenerConversionesPorEmpresa = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query(
            `SELECT c.*, p.nombre AS alojamiento_nombre, ch.nombre AS canal_nombre
             FROM conversiones c
             LEFT JOIN propiedades p  ON p.id  = c.propiedad_id AND p.empresa_id  = c.empresa_id
             LEFT JOIN canales     ch ON ch.id = c.canal_id     AND ch.empresa_id = c.empresa_id
             WHERE c.empresa_id = $1
             ORDER BY c.nombre_externo ASC`,
            [empresaId]
        );
        return rows.map(r => ({
            id: r.id,
            alojamientoId: r.propiedad_id,
            canalId: r.canal_id,
            canalNombre: r.canal_nombre || null,
            nombreExterno: r.nombre_externo,
            alojamientoNombre: r.alojamiento_nombre || r.nombre_externo
        }));
    }

    // Firestore fallback
    const snap = await db.collection('empresas').doc(empresaId).collection('conversionesAlojamiento')
        .orderBy('alojamientoNombre').get();
    if (snap.empty) return [];
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const actualizarConversion = async (db, empresaId, conversionId, datosActualizados) => {
    if (pool) {
        await pool.query(`
            UPDATE conversiones SET
                canal_id     = COALESCE($2, canal_id),
                nombre_externo = COALESCE($3, nombre_externo),
                propiedad_id = COALESCE($4, propiedad_id)
            WHERE id = $1 AND empresa_id = $5
        `, [
            conversionId,
            datosActualizados.canalId       || null,
            datosActualizados.nombreExterno  || null,
            datosActualizados.alojamientoId  || null,
            empresaId
        ]);
        return { id: conversionId, ...datosActualizados };
    }

    // Firestore fallback
    await db.collection('empresas').doc(empresaId).collection('conversionesAlojamiento').doc(conversionId).update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: conversionId, ...datosActualizados };
};

const eliminarConversion = async (db, empresaId, conversionId) => {
    if (pool) {
        await pool.query(
            'DELETE FROM conversiones WHERE id = $1 AND empresa_id = $2',
            [conversionId, empresaId]
        );
        return;
    }
    await db.collection('empresas').doc(empresaId).collection('conversionesAlojamiento').doc(conversionId).delete();
};

module.exports = {
    crearConversion,
    obtenerConversionesPorEmpresa,
    actualizarConversion,
    eliminarConversion
};
