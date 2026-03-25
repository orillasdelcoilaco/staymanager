// backend/services/canalesService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

function mapearCanal(row) {
    if (!row) return null;
    return {
        id: row.id,
        nombre: row.nombre,
        tipo: row.tipo,
        comision: parseFloat(row.comision || 0),
        activo: row.activo,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(row.metadata || {})
    };
}

const crearCanal = async (db, empresaId, datosCanal) => {
    if (!empresaId || !datosCanal.nombre) {
        throw new Error('El ID de la empresa y el nombre del canal son requeridos.');
    }

    if (pool) {
        if (datosCanal.esCanalPorDefecto) {
            await pool.query(
                `UPDATE canales SET metadata = metadata || '{"esCanalPorDefecto": false}'::jsonb
                 WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true`,
                [empresaId]
            );
        }

        const { nombre, tipo, comision, ...resto } = datosCanal;
        const { rows } = await pool.query(`
            INSERT INTO canales (empresa_id, nombre, tipo, comision, activo, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            empresaId,
            nombre,
            tipo || null,
            comision || 0,
            true,
            JSON.stringify(resto)
        ]);
        return mapearCanal(rows[0]);
    }

    // Firestore fallback
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    return db.runTransaction(async (transaction) => {
        if (datosCanal.esCanalPorDefecto) {
            const snap = await transaction.get(canalesRef.where('esCanalPorDefecto', '==', true));
            snap.forEach(doc => transaction.update(doc.ref, { esCanalPorDefecto: false }));
        }
        const canalRef = canalesRef.doc();
        const nuevoCanal = {
            nombre: datosCanal.nombre,
            clienteIdCanal: datosCanal.clienteIdCanal || '',
            descripcion: datosCanal.descripcion || '',
            moneda: datosCanal.moneda || 'CLP',
            separadorDecimal: datosCanal.separadorDecimal || ',',
            esCanalPorDefecto: datosCanal.esCanalPorDefecto || false,
            esCanalIcal: datosCanal.esCanalIcal || false,
            modificadorTipo: datosCanal.modificadorTipo || null,
            modificadorValor: datosCanal.modificadorValor || 0,
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };
        transaction.set(canalRef, nuevoCanal);
        return { id: canalRef.id, ...nuevoCanal };
    });
};

const obtenerCanalesPorEmpresa = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM canales WHERE empresa_id = $1 ORDER BY nombre ASC',
            [empresaId]
        );
        return rows.map(mapearCanal);
    }

    // Firestore fallback
    const snap = await db.collection('empresas').doc(empresaId).collection('canales').orderBy('nombre').get();
    if (snap.empty) return [];
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const actualizarCanal = async (db, empresaId, canalId, datosActualizados) => {
    if (pool) {
        if (datosActualizados.esCanalPorDefecto) {
            await pool.query(
                `UPDATE canales SET metadata = metadata || '{"esCanalPorDefecto": false}'::jsonb
                 WHERE empresa_id = $1 AND id != $2 AND (metadata->>'esCanalPorDefecto')::boolean = true`,
                [empresaId, canalId]
            );
        }

        const { nombre, tipo, comision, activo, ...resto } = datosActualizados;
        await pool.query(`
            UPDATE canales SET
                nombre     = COALESCE($2, nombre),
                tipo       = COALESCE($3, tipo),
                comision   = COALESCE($4, comision),
                activo     = COALESCE($5, activo),
                metadata   = metadata || $6::jsonb,
                updated_at = NOW()
            WHERE id = $1 AND empresa_id = $7
        `, [
            canalId,
            nombre || null,
            tipo   || null,
            comision !== undefined ? comision : null,
            activo   !== undefined ? activo   : null,
            JSON.stringify(resto),
            empresaId
        ]);

        return { id: canalId, ...datosActualizados };
    }

    // Firestore fallback
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    return db.runTransaction(async (transaction) => {
        if (datosActualizados.esCanalPorDefecto) {
            const snap = await transaction.get(canalesRef.where('esCanalPorDefecto', '==', true));
            snap.forEach(doc => {
                if (doc.id !== canalId) transaction.update(doc.ref, { esCanalPorDefecto: false });
            });
        }
        transaction.update(canalesRef.doc(canalId), {
            ...datosActualizados,
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        });
        return { id: canalId, ...datosActualizados };
    });
};

const eliminarCanal = async (db, empresaId, canalId) => {
    if (pool) {
        await pool.query('DELETE FROM canales WHERE id = $1 AND empresa_id = $2', [canalId, empresaId]);
        return;
    }
    await db.collection('empresas').doc(empresaId).collection('canales').doc(canalId).delete();
};

module.exports = {
    crearCanal,
    obtenerCanalesPorEmpresa,
    actualizarCanal,
    eliminarCanal
};
