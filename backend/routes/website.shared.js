const pool = require('../db/postgres');
const { format, nextFriday, nextSunday, isValid, parseISO, addDays } = require('date-fns');

async function fetchTarifasYCanal(empresaId) {
    const [tarifaRes, canalRes] = await Promise.all([
        pool.query(`
            SELECT t.id, t.propiedad_id, t.precios_canales, t.metadata,
                   temp.fecha_inicio, temp.fecha_termino
            FROM tarifas t
            JOIN temporadas temp ON t.temporada_id = temp.id
            WHERE t.empresa_id = $1
        `, [empresaId]),
        pool.query(
            `SELECT id, COALESCE(metadata->>'moneda', 'CLP') AS moneda
             FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
            [empresaId]
        ),
    ]);

    const allTarifas = tarifaRes.rows.map((row) => {
        try {
            const fi = row.fecha_inicio instanceof Date ? row.fecha_inicio : new Date(row.fecha_inicio);
            const ft = row.fecha_termino instanceof Date ? row.fecha_termino : new Date(row.fecha_termino);
            if (!isValid(fi) || !isValid(ft)) return null;
            const precios = {};
            if (row.precios_canales && typeof row.precios_canales === 'object') {
                Object.entries(row.precios_canales).forEach(([canalId, data]) => {
                    precios[canalId] = typeof data === 'number' ? data : (data?.valorCLP || 0);
                });
            }
            const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
            return {
                id: row.id,
                precios,
                alojamientoId: row.propiedad_id,
                fechaInicio: fi,
                fechaTermino: ft,
                metadata: { ...meta },
            };
        } catch {
            return null;
        }
    }).filter(Boolean);

    const row0 = canalRes.rows[0];
    const canalPorDefectoId = row0?.id || null;
    const canalMoneda = row0?.moneda || 'CLP';
    return { allTarifas, canalPorDefectoId, canalMoneda };
}

/** Tarifas + canal por defecto para varias empresas (descubrimiento cross-tenant en SSR). */
async function fetchTarifasForEmpresas(empresaIds) {
    const ids = [...new Set((empresaIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (!ids.length) return { allTarifas: [], defaultCanalByEmpresa: new Map() };

    const idTxt = ids.map(String);
    const [tarifaRes, canalRes] = await Promise.all([
        pool.query(
            `SELECT t.id, t.empresa_id, t.propiedad_id, t.precios_canales, t.metadata,
                    temp.fecha_inicio, temp.fecha_termino
             FROM tarifas t
             JOIN temporadas temp ON t.temporada_id = temp.id
             WHERE t.empresa_id::text = ANY($1::text[])`,
            [idTxt]
        ),
        pool.query(
            `SELECT empresa_id, id, COALESCE(metadata->>'moneda', 'CLP') AS moneda
             FROM canales
             WHERE empresa_id::text = ANY($1::text[])
               AND (metadata->>'esCanalPorDefecto')::boolean = true`,
            [idTxt]
        ),
    ]);

    const allTarifas = tarifaRes.rows
        .map((row) => {
            try {
                const fi = row.fecha_inicio instanceof Date ? row.fecha_inicio : new Date(row.fecha_inicio);
                const ft = row.fecha_termino instanceof Date ? row.fecha_termino : new Date(row.fecha_termino);
                if (!isValid(fi) || !isValid(ft)) return null;
                const precios = {};
                if (row.precios_canales && typeof row.precios_canales === 'object') {
                    Object.entries(row.precios_canales).forEach(([canalId, data]) => {
                        precios[canalId] = typeof data === 'number' ? data : (data?.valorCLP || 0);
                    });
                }
                const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
                return {
                    id: row.id,
                    empresaId: row.empresa_id,
                    precios,
                    alojamientoId: row.propiedad_id,
                    fechaInicio: fi,
                    fechaTermino: ft,
                    metadata: { ...meta },
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean);

    const defaultCanalByEmpresa = new Map();
    canalRes.rows.forEach((r) => {
        defaultCanalByEmpresa.set(String(r.empresa_id), { id: r.id, moneda: r.moneda || 'CLP' });
    });
    return { allTarifas, defaultCanalByEmpresa };
}

/** Precio por noche (moneda del canal) para cada día en [fromIso, toIso] inclusive. */
function computeNightlyPricesForRange(propiedadId, fromIso, toIso, allTarifas, canalId) {
    if (!canalId || !propiedadId || !fromIso || !toIso || !allTarifas?.length) return [];
    const from = String(fromIso).slice(0, 10);
    const to = String(toIso).slice(0, 10);
    if (from.length !== 10 || to.length !== 10 || from > to) return [];
    let d = parseISO(`${from}T12:00:00`);
    const endLimit = parseISO(`${to}T12:00:00`);
    if (!isValid(d) || !isValid(endLimit)) return [];
    const out = [];
    while (d <= endLimit) {
        const currentDate = new Date(d);
        const tarifasDelDia = allTarifas.filter(
            (t) => t.alojamientoId === propiedadId && t.fechaInicio <= currentDate && t.fechaTermino >= currentDate
        );
        let amount = 0;
        if (tarifasDelDia.length > 0) {
            const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
            const precioBaseObj = tarifa.precios?.[canalId];
            amount = typeof precioBaseObj === 'number' ? precioBaseObj : 0;
        }
        out.push({ date: format(currentDate, 'yyyy-MM-dd'), amount });
        d = addDays(d, 1);
    }
    return out;
}

function getPrecioBaseNoche(propId, allTarifas, canalId) {
    if (!canalId || !allTarifas.length) return 0;
    const precios = allTarifas
        .filter((t) => t.alojamientoId === propId)
        .map((t) => t.precios?.[canalId] || 0)
        .filter((p) => p > 0);
    return precios.length ? Math.min(...precios) : 0;
}

function formatDateForInput(date) {
    if (!date || !isValid(date)) return '';
    return format(date, 'yyyy-MM-dd');
}

function getNextWeekend() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const friday = nextFriday(today);
    const sunday = nextSunday(friday);
    return { llegada: friday, salida: sunday };
}

module.exports = {
    fetchTarifasYCanal,
    fetchTarifasForEmpresas,
    getPrecioBaseNoche,
    formatDateForInput,
    getNextWeekend,
    computeNightlyPricesForRange,
};
