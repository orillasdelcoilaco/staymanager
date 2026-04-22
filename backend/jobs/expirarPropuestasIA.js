// backend/jobs/expirarPropuestasIA.js
// Cancela automáticamente reservas IA que no recibieron pago en 24h.
const pool = require('../db/postgres');

const cancelarPropuestasIAVencidas = async () => {
    try {
        console.log('[CRON-IA] Buscando propuestas IA vencidas...');

        const { rows } = await pool.query(
            `SELECT id, empresa_id, id_reserva_canal, alojamiento_nombre, cliente_id,
                    fecha_llegada, fecha_salida, metadata
             FROM reservas
             WHERE estado = 'Propuesta'
               AND metadata->>'origen' = 'ia-reserva'
               AND metadata->>'estadoPago' = 'pendiente'
               AND (metadata->>'vencimientoPago')::timestamptz < NOW()`
        );

        if (!rows.length) {
            console.log('[CRON-IA] Sin propuestas vencidas.');
            return;
        }

        console.log(`[CRON-IA] Anulando ${rows.length} propuesta(s) vencida(s)...`);

        for (const row of rows) {
            try {
                await pool.query(
                    `UPDATE reservas
                     SET estado = 'Anulada',
                         metadata = metadata || '{"estadoPago":"expirado","anulacionAutomatica":true}'::jsonb
                     WHERE id = $1`,
                    [row.id]
                );

                await pool.query(
                    `INSERT INTO bitacora (empresa_id, id_reserva_canal, texto, autor)
                     VALUES ($1, $2, $3, 'sistema')`,
                    [
                        row.empresa_id,
                        row.id_reserva_canal,
                        `Reserva anulada automáticamente por no recibir pago de seña dentro de las 24 horas (vencimiento: ${row.metadata?.vencimientoPago || 'N/D'}).`
                    ]
                );

                console.log(`[CRON-IA] Anulada: ${row.id} (${row.alojamiento_nombre})`);
            } catch (err) {
                console.error(`[CRON-IA] Error anulando ${row.id}:`, err.message);
            }
        }

        console.log('[CRON-IA] Proceso completado.');
    } catch (err) {
        console.error('[CRON-IA] Error general:', err.message);
    }
};

const INTERVALO = 60 * 60 * 1000; // 1 hora

const iniciar = () => {
    console.log('[CRON-IA] Job de expiración de propuestas IA iniciado (cada 1h).');
    if (process.env.NODE_ENV === 'production') {
        cancelarPropuestasIAVencidas();
    }
    setInterval(cancelarPropuestasIAVencidas, INTERVALO);
};

module.exports = { iniciar, cancelarPropuestasIAVencidas };
