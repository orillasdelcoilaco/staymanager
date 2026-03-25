// backend/services/mapeosCentralesService.js
// Colección global del sistema — no pertenece a una empresa específica.
const pool = require('../db/postgres');
const admin = require('firebase-admin');

const COLLECTION = 'mapeosCentrales';

function normalizeKey(str) {
    return (str || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/\s+/g, ' ');
}

function mapearCentral(row) {
    if (!row) return null;
    return {
        id: row.id,
        nombre: row.canal_nombre,
        nombreNormalizado: normalizeKey(row.canal_nombre),
        formatoFecha: row.formato_fecha || 'DD/MM/YYYY',
        separadorDecimal: row.separador_decimal || ',',
        configuracionIva: (row.campos || {}).configuracionIva || 'incluido',
        mapeosDeEstado: row.mapeos_de_estado || {},
        mapeos: row.campos?.mapeos || []
    };
}

const obtenerTodosMapeosCentrales = async (db) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM mapeos_centrales ORDER BY canal_nombre ASC'
        );
        return rows.map(mapearCentral);
    }
    const snap = await db.collection(COLLECTION).orderBy('nombre').get();
    return snap.docs.map(doc => doc.data());
};

const obtenerMapeoCentral = async (db, otaKey) => {
    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM mapeos_centrales WHERE id = $1',
            [otaKey]
        );
        return rows[0] ? mapearCentral(rows[0]) : null;
    }
    const doc = await db.collection(COLLECTION).doc(otaKey).get();
    return doc.exists ? doc.data() : null;
};

const obtenerMapeoCentralPorNombre = async (db, nombre) => {
    if (pool) {
        const key = normalizeKey(nombre);
        const { rows } = await pool.query(
            `SELECT * FROM mapeos_centrales
             WHERE LOWER(TRIM(canal_nombre)) = $1
             LIMIT 1`,
            [key]
        );
        return rows[0] ? mapearCentral(rows[0]) : null;
    }
    const key = normalizeKey(nombre);
    const snap = await db.collection(COLLECTION).where('nombreNormalizado', '==', key).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
};

const guardarMapeoCentral = async (db, otaKey, datos) => {
    if (pool) {
        const camposJson = {
            configuracionIva: datos.configuracionIva || 'incluido',
            mapeos: (datos.mapeos || []).filter(m => m.campoInterno && m.columnaIndex !== undefined)
        };

        await pool.query(`
            INSERT INTO mapeos_centrales (id, canal_nombre, campos, mapeos_de_estado, formato_fecha, separador_decimal)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (canal_nombre) DO UPDATE SET
                campos           = $3,
                mapeos_de_estado = $4,
                formato_fecha    = $5,
                separador_decimal = $6,
                updated_at       = NOW()
        `, [
            otaKey,
            datos.nombre,
            JSON.stringify(camposJson),
            JSON.stringify(datos.mapeosDeEstado || {}),
            datos.formatoFecha    || 'DD/MM/YYYY',
            datos.separadorDecimal || ','
        ]);

        return { id: otaKey, ...datos, nombreNormalizado: normalizeKey(datos.nombre) };
    }

    // Firestore fallback
    const ref = db.collection(COLLECTION).doc(otaKey);
    const dataToSave = {
        id: otaKey,
        nombre: datos.nombre,
        nombreNormalizado: normalizeKey(datos.nombre),
        formatoFecha: datos.formatoFecha || 'DD/MM/YYYY',
        separadorDecimal: datos.separadorDecimal || ',',
        configuracionIva: datos.configuracionIva || 'incluido',
        mapeosDeEstado: datos.mapeosDeEstado || {},
        mapeos: (datos.mapeos || []).filter(m => m.campoInterno && m.columnaIndex !== undefined),
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(dataToSave, { merge: true });
    return dataToSave;
};

const aplicarMapeoCentralAEmpresa = async (db, empresaId, canalId, datos) => {
    const { guardarMapeosPorCanal } = require('./mapeosService');
    await guardarMapeosPorCanal(
        db, empresaId, canalId,
        datos.mapeos || [],
        datos.formatoFecha,
        datos.separadorDecimal,
        datos.configuracionIva,
        datos.mapeosDeEstado
    );
};

const sincronizarMapeosEnTodasEmpresas = async (db, otaKey) => {
    const datos = await obtenerMapeoCentral(db, otaKey);
    if (!datos) throw new Error(`No existe mapeo central para "${otaKey}"`);

    const { obtenerCanalesPorEmpresa } = require('./canalesService');
    const results = { actualizadas: 0, errores: [], empresas: [] };

    if (pool) {
        const { rows: empresas } = await pool.query('SELECT id, nombre FROM empresas');
        for (const empresa of empresas) {
            try {
                const canales = await obtenerCanalesPorEmpresa(db, empresa.id);
                for (const canal of canales) {
                    if (normalizeKey(canal.nombre) === datos.nombreNormalizado) {
                        await aplicarMapeoCentralAEmpresa(db, empresa.id, canal.id, datos);
                        results.actualizadas++;
                        results.empresas.push(empresa.nombre || empresa.id);
                    }
                }
            } catch (err) {
                results.errores.push(`${empresa.nombre || empresa.id}: ${err.message}`);
            }
        }
        return results;
    }

    // Firestore fallback
    const empresasSnap = await db.collection('empresas').get();
    for (const empresaDoc of empresasSnap.docs) {
        try {
            const canalesSnap = await empresaDoc.ref.collection('canales').get();
            for (const canalDoc of canalesSnap.docs) {
                if (normalizeKey(canalDoc.data().nombre) === datos.nombreNormalizado) {
                    await aplicarMapeoCentralAEmpresa(db, empresaDoc.id, canalDoc.id, datos);
                    results.actualizadas++;
                    results.empresas.push(empresaDoc.data().nombre || empresaDoc.id);
                }
            }
        } catch (err) {
            results.errores.push(`${empresaDoc.data().nombre || empresaDoc.id}: ${err.message}`);
        }
    }
    return results;
};

const exportarMapeosDeEmpresa = async (db, empresaId, canalId) => {
    const { obtenerCanalesPorEmpresa } = require('./canalesService');
    const { obtenerMapeosPorEmpresa } = require('./mapeosService');

    if (pool) {
        const canales = await obtenerCanalesPorEmpresa(db, empresaId);
        const canal = canales.find(c => c.id === canalId);
        if (!canal) throw new Error('Canal no encontrado.');

        const mapeos = await obtenerMapeosPorEmpresa(db, empresaId);
        const mapeoCanal = mapeos.find(m => m.canalId === canalId) || {};

        return {
            nombre: canal.nombre,
            formatoFecha: mapeoCanal.formatoFecha || 'DD/MM/YYYY',
            separadorDecimal: mapeoCanal.separadorDecimal || ',',
            configuracionIva: mapeoCanal.configuracionIva || 'incluido',
            mapeosDeEstado: mapeoCanal.mapeosDeEstado || {},
            mapeos: mapeoCanal.campos || []
        };
    }

    // Firestore fallback
    const canalDoc = await db.collection('empresas').doc(empresaId).collection('canales').doc(canalId).get();
    if (!canalDoc.exists) throw new Error('Canal no encontrado.');
    const canal = canalDoc.data();
    const mapeosSnap = await db.collection('empresas').doc(empresaId).collection('mapeosCanal')
        .where('canalId', '==', canalId).get();
    const mapeosArr = mapeosSnap.docs
        .map(doc => ({ campoInterno: doc.data().campoInterno, columnaIndex: doc.data().columnaIndex }))
        .filter(m => m.columnaIndex !== undefined && m.columnaIndex !== null);

    return {
        nombre: canal.nombre,
        formatoFecha: canal.formatoFecha || 'DD/MM/YYYY',
        separadorDecimal: canal.separadorDecimal || ',',
        configuracionIva: canal.configuracionIva || 'incluido',
        mapeosDeEstado: canal.mapeosDeEstado || {},
        mapeos: mapeosArr
    };
};

module.exports = {
    obtenerTodosMapeosCentrales,
    obtenerMapeoCentral,
    obtenerMapeoCentralPorNombre,
    guardarMapeoCentral,
    aplicarMapeoCentralAEmpresa,
    sincronizarMapeosEnTodasEmpresas,
    exportarMapeosDeEmpresa
};
