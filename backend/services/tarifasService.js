// backend/services/tarifasService.js
const pool = require('../db/postgres');
const { obtenerValorDolar } = require('./dolarService');

// ─── Cálculo de precios por canal ────────────────────────────────────────────

async function calcularPreciosPorCanal(empresaId, precioBase, fechaInicioStr) {
    const { obtenerCanalesPorEmpresa } = require('./canalesService');
    const canales = await obtenerCanalesPorEmpresa(null, empresaId);
    const canalPD = canales.find(c => c.esCanalPorDefecto || c.metadata?.esCanalPorDefecto);
    if (!canalPD) throw new Error('No se ha configurado un canal por defecto.');

    const fechaDate = new Date(fechaInicioStr + 'T00:00:00Z');
    const valorDolarDia = await obtenerValorDolar(null, empresaId, fechaDate);
    const base = parseFloat(precioBase);
    if (isNaN(base)) throw new Error('El precio base no es válido.');

    const preciosCanales = {};
    for (const canal of canales) {
        let val = base;
        const mc = canal.moneda || canal.metadata?.moneda || 'CLP';
        const md = canalPD.moneda || canalPD.metadata?.moneda || 'CLP';
        if (mc === 'USD' && md === 'CLP' && valorDolarDia > 0) val = base / valorDolarDia;
        else if (mc === 'CLP' && md === 'USD' && valorDolarDia > 0) val = base * valorDolarDia;

        const modTipo  = canal.modificadorTipo  || canal.metadata?.modificadorTipo;
        const modValor = canal.modificadorValor || canal.metadata?.modificadorValor || 0;
        if (canal.id !== canalPD.id && modValor) {
            if (modTipo === 'porcentaje') val *= (1 + modValor / 100);
            else if (modTipo === 'fijo')  val += modValor;
        }
        preciosCanales[canal.id] = mc === 'USD'
            ? { valorUSD: val, valorCLP: val * valorDolarDia, moneda: 'USD' }
            : { valorCLP: val, moneda: 'CLP' };
    }
    return { preciosCanales, canalPorDefectoId: canalPD.id, valorDolarDia };
}

// ─── Mapeo interno ────────────────────────────────────────────────────────────

function mapearTarifa(row) {
    const fi = row.fecha_inicio instanceof Date
        ? row.fecha_inicio.toISOString().split('T')[0]
        : String(row.fecha_inicio);
    const ft = row.fecha_termino instanceof Date
        ? row.fecha_termino.toISOString().split('T')[0]
        : String(row.fecha_termino);
    return {
        id:               row.id,
        temporadaId:      row.temporada_id,
        temporadaNombre:  row.temporada_nombre || null,
        alojamientoId:    row.propiedad_id,
        alojamientoNombre: row.alojamiento_nombre || null,
        precioBase:       parseFloat(row.precio_base),
        valorDolarDia:    row.valor_dolar_dia ? parseFloat(row.valor_dolar_dia) : null,
        precios:          row.precios_canales || {},
        fechaInicio:      fi,
        fechaTermino:     ft,
    };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const obtenerTarifasPorTemporada = async (empresaId, temporadaId) => {
    const { rows } = await pool.query(
        `SELECT ta.*, te.nombre AS temporada_nombre,
                te.fecha_inicio, te.fecha_termino,
                p.nombre AS alojamiento_nombre
         FROM tarifas ta
         JOIN temporadas te ON te.id = ta.temporada_id
         JOIN propiedades p  ON p.id  = ta.propiedad_id
         WHERE ta.empresa_id = $1 AND ta.temporada_id = $2
         ORDER BY p.nombre`,
        [empresaId, temporadaId]
    );
    return rows.map(mapearTarifa);
};

const guardarTarifasBulk = async (empresaId, temporadaId, precios) => {
    // precios = [{ propiedadId, precioBase }]
    if (!precios?.length) return [];

    // Obtener fecha_inicio de la temporada para el tipo de cambio
    const { rows: temp } = await pool.query(
        'SELECT fecha_inicio FROM temporadas WHERE id = $1 AND empresa_id = $2',
        [temporadaId, empresaId]
    );
    if (!temp[0]) throw new Error('Temporada no encontrada.');
    const fechaInicioStr = temp[0].fecha_inicio instanceof Date
        ? temp[0].fecha_inicio.toISOString().split('T')[0]
        : String(temp[0].fecha_inicio);

    const resultados = [];
    for (const item of precios) {
        if (!item.propiedadId || item.precioBase === undefined || item.precioBase === null) continue;
        const base = parseFloat(item.precioBase);
        if (isNaN(base) || base < 0) continue;

        const { preciosCanales, valorDolarDia } = await calcularPreciosPorCanal(
            empresaId, base, fechaInicioStr
        );

        const { rows } = await pool.query(
            `INSERT INTO tarifas (empresa_id, temporada_id, propiedad_id, precio_base, valor_dolar_dia, precios_canales)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (temporada_id, propiedad_id) DO UPDATE
             SET precio_base    = EXCLUDED.precio_base,
                 valor_dolar_dia = EXCLUDED.valor_dolar_dia,
                 precios_canales = EXCLUDED.precios_canales,
                 updated_at     = NOW()
             RETURNING id`,
            [empresaId, temporadaId, item.propiedadId, base, valorDolarDia, JSON.stringify(preciosCanales)]
        );
        resultados.push(rows[0].id);
    }
    return resultados;
};

const actualizarTarifa = async (empresaId, tarifaId, precioBase) => {
    const { rows: ex } = await pool.query(
        `SELECT ta.temporada_id, te.fecha_inicio
         FROM tarifas ta JOIN temporadas te ON te.id = ta.temporada_id
         WHERE ta.id = $1 AND ta.empresa_id = $2`,
        [tarifaId, empresaId]
    );
    if (!ex[0]) throw new Error('Tarifa no encontrada.');

    const fechaInicioStr = ex[0].fecha_inicio instanceof Date
        ? ex[0].fecha_inicio.toISOString().split('T')[0]
        : String(ex[0].fecha_inicio);

    const base = parseFloat(precioBase);
    if (isNaN(base)) throw new Error('Precio base inválido.');
    const { preciosCanales, valorDolarDia } = await calcularPreciosPorCanal(
        empresaId, base, fechaInicioStr
    );

    const { rows } = await pool.query(
        `UPDATE tarifas
         SET precio_base = $2, valor_dolar_dia = $3, precios_canales = $4, updated_at = NOW()
         WHERE id = $1 AND empresa_id = $5 RETURNING *`,
        [tarifaId, base, valorDolarDia, JSON.stringify(preciosCanales), empresaId]
    );
    return mapearTarifa(rows[0]);
};

const eliminarTarifa = async (empresaId, tarifaId) => {
    await pool.query('DELETE FROM tarifas WHERE id = $1 AND empresa_id = $2', [tarifaId, empresaId]);
};

const eliminarTarifasPorTemporada = async (empresaId, temporadaId) => {
    await pool.query(
        'DELETE FROM tarifas WHERE temporada_id = $1 AND empresa_id = $2',
        [temporadaId, empresaId]
    );
};

// ─── Para consumidores internos (KPI, propuestas, sincronización) ─────────────
// Devuelve el formato que esperan los servicios existentes.

const obtenerTarifasParaConsumidores = async (empresaId) => {
    const { rows } = await pool.query(
        `SELECT ta.id, ta.propiedad_id, ta.precio_base, ta.precios_canales,
                ta.valor_dolar_dia,
                te.fecha_inicio, te.fecha_termino
         FROM tarifas ta
         JOIN temporadas te ON te.id = ta.temporada_id
         WHERE ta.empresa_id = $1`,
        [empresaId]
    );
    return rows.map(row => ({
        id:           row.id,
        alojamientoId: row.propiedad_id,
        fechaInicio:  row.fecha_inicio instanceof Date
            ? new Date(row.fecha_inicio.toISOString().split('T')[0] + 'T00:00:00Z')
            : new Date(String(row.fecha_inicio).split('T')[0] + 'T00:00:00Z'),
        fechaTermino: row.fecha_termino instanceof Date
            ? new Date(row.fecha_termino.toISOString().split('T')[0] + 'T00:00:00Z')
            : new Date(String(row.fecha_termino).split('T')[0] + 'T00:00:00Z'),
        precioBase:   parseFloat(row.precio_base),
        precios:      row.precios_canales || {},
        valorDolarDia: row.valor_dolar_dia ? parseFloat(row.valor_dolar_dia) : null,
    }));
};

// ─── Upsert para el importador mágico ────────────────────────────────────────

const upsertTarifaImportador = async (empresaId, alojamientoId, precioBase, result) => {
    try {
        const año = new Date().getFullYear();
        const fechaInicio  = `${año}-01-01`;
        const fechaTermino = `${año}-12-31`;

        // Buscar o crear temporada "General {año}"
        const nombreTemporada = `General ${año}`;
        let temporadaId;
        const { rows: tempEx } = await pool.query(
            'SELECT id FROM temporadas WHERE empresa_id = $1 AND nombre = $2 LIMIT 1',
            [empresaId, nombreTemporada]
        );
        if (tempEx[0]) {
            temporadaId = tempEx[0].id;
        } else {
            const { rows: tempNew } = await pool.query(
                'INSERT INTO temporadas (empresa_id, nombre, fecha_inicio, fecha_termino) VALUES ($1,$2,$3,$4) RETURNING id',
                [empresaId, nombreTemporada, fechaInicio, fechaTermino]
            );
            temporadaId = tempNew[0].id;
        }

        const base = parseFloat(precioBase);
        if (isNaN(base) || base <= 0) return;

        const { preciosCanales, valorDolarDia } = await calcularPreciosPorCanal(
            empresaId, base, fechaInicio
        );

        await pool.query(
            `INSERT INTO tarifas (empresa_id, temporada_id, propiedad_id, precio_base, valor_dolar_dia, precios_canales)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (temporada_id, propiedad_id) DO UPDATE
             SET precio_base = EXCLUDED.precio_base,
                 valor_dolar_dia = EXCLUDED.valor_dolar_dia,
                 precios_canales = EXCLUDED.precios_canales,
                 updated_at = NOW()`,
            [empresaId, temporadaId, alojamientoId, base, valorDolarDia, JSON.stringify(preciosCanales)]
        );
        result.tarifas.push({ alojamientoId });
    } catch (err) {
        result.errores.push(`Tarifa "${alojamientoId}": ${err.message}`);
    }
};

module.exports = {
    calcularPreciosPorCanal,
    obtenerTarifasPorTemporada,
    guardarTarifasBulk,
    actualizarTarifa,
    eliminarTarifa,
    eliminarTarifasPorTemporada,
    obtenerTarifasParaConsumidores,
    upsertTarifaImportador,
};
