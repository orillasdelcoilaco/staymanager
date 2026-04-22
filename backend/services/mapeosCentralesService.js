// backend/services/mapeosCentralesService.js
// Colección global del sistema — no pertenece a una empresa específica.
const pool = require('../db/postgres');

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

const obtenerTodosMapeosCentrales = async (_db) => {
    const { rows } = await pool.query('SELECT * FROM mapeos_centrales ORDER BY canal_nombre ASC');
    return rows.map(mapearCentral);
};

const obtenerMapeoCentral = async (_db, otaKey) => {
    const { rows } = await pool.query('SELECT * FROM mapeos_centrales WHERE id = $1', [otaKey]);
    return rows[0] ? mapearCentral(rows[0]) : null;
};

const obtenerMapeoCentralPorNombre = async (_db, nombre) => {
    const key = normalizeKey(nombre);
    const { rows } = await pool.query(
        `SELECT * FROM mapeos_centrales WHERE LOWER(TRIM(canal_nombre)) = $1 LIMIT 1`,
        [key]
    );
    return rows[0] ? mapearCentral(rows[0]) : null;
};

const guardarMapeoCentral = async (_db, otaKey, datos) => {
    const camposJson = {
        configuracionIva: datos.configuracionIva || 'incluido',
        mapeos: (datos.mapeos || []).filter(m => m.campoInterno && m.columnaIndex !== undefined)
    };
    await pool.query(`
        INSERT INTO mapeos_centrales (id, canal_nombre, campos, mapeos_de_estado, formato_fecha, separador_decimal)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (canal_nombre) DO UPDATE SET
            campos            = $3,
            mapeos_de_estado  = $4,
            formato_fecha     = $5,
            separador_decimal = $6,
            updated_at        = NOW()
    `, [
        otaKey,
        datos.nombre,
        JSON.stringify(camposJson),
        JSON.stringify(datos.mapeosDeEstado || {}),
        datos.formatoFecha    || 'DD/MM/YYYY',
        datos.separadorDecimal || ','
    ]);
    return { id: otaKey, ...datos, nombreNormalizado: normalizeKey(datos.nombre) };
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
};

const exportarMapeosDeEmpresa = async (db, empresaId, canalId) => {
    const { obtenerCanalesPorEmpresa } = require('./canalesService');
    const { obtenerMapeosPorEmpresa } = require('./mapeosService');
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
