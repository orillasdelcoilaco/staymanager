// backend/services/crmService.js
const pool = require('../db/postgres');

const PUNTOS = {
    recencia:   [{ dias: 30, puntos: 5 }, { dias: 90, puntos: 4 }, { dias: 180, puntos: 3 }, { dias: 365, puntos: 2 }, { dias: Infinity, puntos: 1 }],
    frecuencia: [{ compras: 5, puntos: 5 }, { compras: 4, puntos: 4 }, { compras: 3, puntos: 3 }, { compras: 2, puntos: 2 }, { compras: Infinity, puntos: 1 }],
    monetario:  [{ valor: 2000000, puntos: 5 }, { valor: 1000000, puntos: 4 }, { valor: 500000, puntos: 3 }, { valor: 250000, puntos: 2 }, { valor: Infinity, puntos: 1 }]
};

const getPuntos = (valor, tipo) => {
    const umbrales = PUNTOS[tipo];
    for (const umbral of umbrales) {
        if (valor <= umbral[Object.keys(umbral)[0]]) return umbral.puntos;
    }
    return 1;
};

const segmentarClienteRFM = (historialReservas, totalGastado) => {
    if (!historialReservas || historialReservas.length === 0) return 'Sin Reservas';

    const ahora = new Date();
    const toDate = (v) => v instanceof Date ? v : new Date(v);
    const fechaField = (r) => r.fechaSalida || r.fecha_salida;
    const ultimaReserva = historialReservas.sort((a, b) => toDate(fechaField(b)) - toDate(fechaField(a)))[0];
    const diasDesdeUltimaCompra = Math.round((ahora - toDate(fechaField(ultimaReserva))) / (1000 * 60 * 60 * 24));

    const puntajeTotal = getPuntos(diasDesdeUltimaCompra, 'recencia')
        + getPuntos(historialReservas.length, 'frecuencia')
        + getPuntos(totalGastado, 'monetario');

    if (puntajeTotal >= 13) return '🏆 Campeones';
    if (puntajeTotal >= 10) return '❤️ Leales';
    if (puntajeTotal >= 7)  return '🤝 Potenciales';
    if (puntajeTotal >= 4)  return '😟 En Riesgo';
    return '🥶 Hibernando';
};

const obtenerClientesPorSegmento = async (db, empresaId, segmento) => {
    const params = [empresaId];
    let query = `SELECT id, nombre, email, telefono, metadata FROM clientes WHERE empresa_id=$1`;
    if (segmento && segmento !== 'Todos') {
        query += ` AND metadata->>'rfmSegmento' = $2`;
        params.push(segmento);
    }
    query += ' ORDER BY nombre';
    const { rows } = await pool.query(query, params);
    return rows.map(r => ({ id: r.id, nombre: r.nombre, email: r.email, telefono: r.telefono, ...(r.metadata || {}) }));
};

const obtenerDashboardCRM = async (db, empresaId) => {
    const [segRes, kpiRes, campRes] = await Promise.all([
        pool.query(
            `SELECT COALESCE(metadata->>'rfmSegmento', 'Sin Reservas') AS segmento,
                    COUNT(*)::int AS count,
                    COALESCE(SUM((metadata->>'totalGastado')::numeric), 0) AS total_gastado
             FROM clientes WHERE empresa_id = $1
             GROUP BY metadata->>'rfmSegmento'
             ORDER BY total_gastado DESC`,
            [empresaId]
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS nuevos_mes
             FROM clientes WHERE empresa_id = $1`,
            [empresaId]
        ),
        pool.query(
            `SELECT id, nombre, segmento, total_enviados, cnt_reservo, created_at
             FROM campanas WHERE empresa_id = $1
             ORDER BY created_at DESC LIMIT 5`,
            [empresaId]
        ),
    ]);

    const segmentos = {};
    for (const r of segRes.rows) {
        segmentos[r.segmento] = { count: r.count, totalGastado: parseFloat(r.total_gastado) || 0 };
    }

    const kpi = kpiRes.rows[0] || { total: 0, nuevos_mes: 0 };
    const totalConReservas = segRes.rows
        .filter(r => r.segmento !== 'Sin Reservas')
        .reduce((s, r) => s + r.count, 0);
    const totalGastadoGlobal = segRes.rows.reduce((s, r) => s + (parseFloat(r.total_gastado) || 0), 0);

    return {
        segmentos,
        kpis: {
            totalClientes: kpi.total,
            nuevosMes: kpi.nuevos_mes,
            retencionRate: kpi.total > 0 ? Math.round((totalConReservas / kpi.total) * 100) / 100 : 0,
            lifetimeValuePromedio: totalConReservas > 0 ? Math.round(totalGastadoGlobal / totalConReservas) : 0,
        },
        campanasRecientes: campRes.rows.map(c => ({
            id: c.id, nombre: c.nombre, segmento: c.segmento,
            totalEnviados: c.total_enviados, conversiones: c.cnt_reservo,
            fecha: c.created_at,
        })),
    };
};

module.exports = { segmentarClienteRFM, obtenerClientesPorSegmento, obtenerDashboardCRM };
