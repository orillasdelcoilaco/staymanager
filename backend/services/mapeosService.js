// backend/services/mapeosService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

// ─────────────────────────────────────────────
// GUARDAR MAPEOS POR CANAL (UPSERT)
// ─────────────────────────────────────────────
const guardarMapeosPorCanal = async (db, empresaId, canalId, mapeos, formatoFecha, separadorDecimal, configuracionIva, mapeosDeEstado) => {
    if (!empresaId || !canalId || !mapeos) {
        throw new Error('Faltan datos requeridos para guardar los mapeos.');
    }

    if (pool) {
        const camposFiltrados = mapeos.filter(m => m.campoInterno !== undefined && m.columnaIndex !== undefined);

        await pool.query(`
            INSERT INTO mapeos (empresa_id, canal_id, campos, mapeos_de_estado, formato_fecha, separador_decimal, configuracion_iva)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (empresa_id, canal_id) DO UPDATE SET
                campos           = $3,
                mapeos_de_estado = $4,
                formato_fecha    = $5,
                separador_decimal = $6,
                configuracion_iva = $7,
                updated_at       = NOW()
        `, [
            empresaId,
            canalId,
            JSON.stringify(camposFiltrados),
            JSON.stringify(mapeosDeEstado || {}),
            formatoFecha    || 'DD/MM/YYYY',
            separadorDecimal || ',',
            configuracionIva || 'incluido'
        ]);
        return;
    }

    // Firestore fallback
    const batch = db.batch();
    const canalRef = db.collection('empresas').doc(empresaId).collection('canales').doc(canalId);
    batch.update(canalRef, { formatoFecha, separadorDecimal, configuracionIva, mapeosDeEstado: mapeosDeEstado || {} });

    const existentesSnap = await db.collection('empresas').doc(empresaId).collection('mapeosCanal')
        .where('canalId', '==', canalId).get();
    const aEliminar = new Set(existentesSnap.docs.map(doc => doc.ref));

    mapeos.forEach(mapeo => {
        const { campoInterno, columnaIndex } = mapeo;
        if (campoInterno === undefined || columnaIndex === undefined) return;
        const mapeoId = `${canalId}_${campoInterno}`;
        const mapeoRef = db.collection('empresas').doc(empresaId).collection('mapeosCanal').doc(mapeoId);
        batch.set(mapeoRef, {
            id: mapeoId, canalId, campoInterno, columnaIndex,
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        aEliminar.forEach(ref => { if (ref.id === mapeoRef.id) aEliminar.delete(ref); });
    });

    aEliminar.forEach(ref => batch.delete(ref));
    await batch.commit();
};

// ─────────────────────────────────────────────
// OBTENER MAPEOS POR EMPRESA
// Devuelve un array de objetos, uno por canal, con sus campos.
// ─────────────────────────────────────────────
const obtenerMapeosPorEmpresa = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM mapeos WHERE empresa_id = $1',
            [empresaId]
        );
        return rows.map(r => ({
            id: r.id,
            canalId: r.canal_id,
            campos: r.campos || [],
            mapeosDeEstado: r.mapeos_de_estado || {},
            formatoFecha: r.formato_fecha,
            separadorDecimal: r.separador_decimal,
            configuracionIva: r.configuracion_iva
        }));
    }

    // Firestore fallback
    const snap = await db.collection('empresas').doc(empresaId).collection('mapeosCanal').get();
    if (snap.empty) return [];
    return snap.docs.map(doc => doc.data());
};

module.exports = {
    guardarMapeosPorCanal,
    obtenerMapeosPorEmpresa
};
