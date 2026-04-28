/**
 * Smoke: valida contra PostgreSQL que las subconsultas del digest operación
 * (incl. métricas iCal 7d en historial_cargas) ejecutan sin error SQL.
 * Sin DATABASE_URL → exit 0 (omitido).
 */
const pool = require('../db/postgres');
const { sqlReservaPrincipalSemanticaIgual } = require('../services/estadosService');

const DUMMY_EMPRESA = '00000000-0000-0000-0000-000000000001';

async function main() {
    if (!pool) {
        console.log('[smoke-digest-ical] Sin PostgreSQL (DATABASE_URL) — omitido.');
        process.exit(0);
    }
    const { rows } = await pool.query(
        `SELECT
            (SELECT COUNT(*)::int FROM reservas r
             WHERE r.empresa_id = $1 AND ${sqlReservaPrincipalSemanticaIgual('confirmada')} AND r.fecha_llegada::date = CURRENT_DATE) AS n_lleg,
            (SELECT COALESCE(SUM(h.total_creadas), 0)::int FROM historial_cargas h
             WHERE h.empresa_id = $1 AND h.fecha_carga >= NOW() - INTERVAL '7 days'
               AND h.nombre_archivo ILIKE 'Sincronización iCal%') AS n_ical_nuevas_7d,
            (SELECT COUNT(*)::int FROM historial_cargas h
             WHERE h.empresa_id = $1 AND h.fecha_carga >= NOW() - INTERVAL '7 days'
               AND h.nombre_archivo ILIKE 'Sincronización iCal%'
               AND jsonb_array_length(COALESCE(h.errores, '[]'::jsonb)) > 0) AS n_ical_sync_con_error_7d,
            (SELECT COUNT(*)::int FROM reservas r
             WHERE r.empresa_id = $1 AND ${sqlReservaPrincipalSemanticaIgual('confirmada')}
               AND r.fecha_llegada::date = (CURRENT_DATE + INTERVAL '1 day')::date
               AND COALESCE(NULLIF(trim(r.metadata->'reservaWebCheckout'->>'horaLlegadaEstimada'), ''), '') = '') AS n_lleg_manana_sin_hora,
            (SELECT COUNT(*)::int FROM reservas r
             WHERE r.empresa_id = $1 AND ${sqlReservaPrincipalSemanticaIgual('confirmada')}
               AND COALESCE(r.metadata->>'estadoPago', '') = 'pendiente'
               AND NULLIF(trim(COALESCE(r.metadata->>'vencimientoPago', '')), '')::timestamptz < NOW()) AS n_pago_pend_vencido`,
        [DUMMY_EMPRESA]
    );
    const r = rows[0] || {};
    console.log('[smoke-digest-ical] OK', {
        n_lleg: r.n_lleg,
        n_ical_nuevas_7d: r.n_ical_nuevas_7d,
        n_ical_sync_con_error_7d: r.n_ical_sync_con_error_7d,
        n_lleg_manana_sin_hora: r.n_lleg_manana_sin_hora,
        n_pago_pend_vencido: r.n_pago_pend_vencido
    });
    process.exit(0);
}

main().catch((err) => {
    console.error('[smoke-digest-ical] FAIL', err.message);
    process.exit(1);
});
