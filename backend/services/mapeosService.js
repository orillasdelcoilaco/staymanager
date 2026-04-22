// backend/services/mapeosService.js
const pool = require('../db/postgres');

const guardarMapeosPorCanal = async (_db, empresaId, canalId, mapeos, formatoFecha, separadorDecimal, configuracionIva, mapeosDeEstado) => {
    if (!empresaId || !canalId || !mapeos) {
        throw new Error('Faltan datos requeridos para guardar los mapeos.');
    }
    const camposFiltrados = mapeos.filter(m => m.campoInterno !== undefined && m.columnaIndex !== undefined);
    await pool.query(`
        INSERT INTO mapeos (empresa_id, canal_id, campos, mapeos_de_estado, formato_fecha, separador_decimal, configuracion_iva)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (empresa_id, canal_id) DO UPDATE SET
            campos            = $3,
            mapeos_de_estado  = $4,
            formato_fecha     = $5,
            separador_decimal = $6,
            configuracion_iva = $7,
            updated_at        = NOW()
    `, [
        empresaId,
        canalId,
        JSON.stringify(camposFiltrados),
        JSON.stringify(mapeosDeEstado || {}),
        formatoFecha     || 'DD/MM/YYYY',
        separadorDecimal || ',',
        configuracionIva || 'incluido'
    ]);
};

const obtenerMapeosPorEmpresa = async (_db, empresaId) => {
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
};

module.exports = { guardarMapeosPorCanal, obtenerMapeosPorEmpresa };
