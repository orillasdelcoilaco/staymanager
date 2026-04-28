/**
 * Retención automática de PII de identidad check-in web según `websiteSettings.booking`.
 * Ejecutar vía cron: `npm run job:retencion-checkin-identidad-pii` (PostgreSQL).
 */

const { metadataTrasEliminarPiiCheckinIdentidad } = require('./reservaWebCheckinIdentidadService');

/**
 * @param {import('pg').Pool} pool
 * @param {{ dryRun?: boolean, limiteReservasPorEmpresa?: number }} [opts]
 * @returns {Promise<{ empresasProcesadas: number, reservasEvaluadas: number, reservasActualizadas: number, detalle: object[] }>}
 */
async function ejecutarRetencionCheckinIdentidadPii(pool, opts = {}) {
    const dryRun = !!opts.dryRun;
    const lim = Math.min(5000, Math.max(1, parseInt(String(opts.limiteReservasPorEmpresa ?? '500'), 10) || 500));
    const { rows: empresas } = await pool.query(
        `SELECT id, configuracion FROM empresas
         WHERE (configuracion->'websiteSettings'->'booking'->'checkinIdentidadRetencionAutomaticaActivo') = 'true'::jsonb`,
    );

    let reservasEvaluadas = 0;
    let reservasActualizadas = 0;
    const detalle = [];

    for (const emp of empresas) {
        const bk = emp.configuracion?.websiteSettings?.booking || {};
        const dias = Math.min(730, Math.max(1, parseInt(String(bk.checkinIdentidadRetencionDiasTrasCheckout ?? '90'), 10) || 90));
        const { rows } = await pool.query(
            `SELECT id, metadata FROM reservas
             WHERE empresa_id = $1
               AND fecha_salida::date < (CURRENT_DATE - $2::int)
               AND (
                 (
                   metadata->'reservaWebCheckout'->'checkInIdentidad' IS NOT NULL
                   AND jsonb_typeof(metadata->'reservaWebCheckout'->'checkInIdentidad') = 'object'
                   AND COALESCE(NULLIF(trim(metadata->'reservaWebCheckout'->'checkInIdentidad'->>'documentoNumero'), ''), '') <> ''
                 )
                 OR EXISTS (
                   SELECT 1
                   FROM jsonb_array_elements(
                     COALESCE(metadata->'reservaWebCheckout'->'checkInIdentidadAcompanantes', '[]'::jsonb)
                   ) el
                   WHERE jsonb_typeof(el) = 'object'
                     AND COALESCE(NULLIF(trim(el->>'documentoNumero'), ''), '') <> ''
                 )
                 OR COALESCE(NULLIF(trim(metadata->'reservaWebCheckout'->>'horaLlegadaEstimada'), ''), '') <> ''
                 OR COALESCE(NULLIF(trim(metadata->'reservaWebCheckout'->>'medioLlegada'), ''), '') <> ''
                 OR COALESCE(NULLIF(trim(metadata->'reservaWebCheckout'->>'referenciaTransporte'), ''), '') <> ''
                 OR COALESCE(NULLIF(trim(metadata->'reservaWebCheckout'->>'documentoRefViajero'), ''), '') <> ''
                 OR COALESCE(NULLIF(trim(metadata->'reservaWebCheckout'->>'comentariosHuesped'), ''), '') <> ''
               )
             LIMIT $3`,
            [emp.id, dias, lim],
        );
        for (const row of rows) {
            reservasEvaluadas++;
            const { changed, metadata } = metadataTrasEliminarPiiCheckinIdentidad(
                row.metadata,
                'retencion-politica-empresa',
                {
                    motivo: 'retencion_automatica_post_checkout',
                    diasPoliticaRetencion: dias,
                },
            );
            if (!changed) continue;
            if (!dryRun) {
                await pool.query(
                    'UPDATE reservas SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3',
                    [JSON.stringify(metadata), row.id, emp.id],
                );
            }
            reservasActualizadas++;
        }
        if (rows.length) {
            detalle.push({ empresaId: emp.id, candidatas: rows.length, dias });
        }
    }

    return {
        empresasProcesadas: empresas.length,
        reservasEvaluadas,
        reservasActualizadas,
        dryRun,
        detalle,
    };
}

module.exports = { ejecutarRetencionCheckinIdentidadPii };
