// backend/jobs/expirarPropuestasIA.js
// Cancela reservas IA sin pago en 48h y notifica a cliente y administrador.
const pool = require('../db/postgres');
const emailService = require('../services/emailService');

function _buildCancelClienteEmail({ nombreCliente, nombrePropiedad, checkin, checkout, empresaNombre, adminEmail }) {
    const fmtFecha = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
    return `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px">
  <tr><td style="background:#991b1b;padding:24px 32px;text-align:center">
    <h2 style="color:#fff;margin:0;font-size:20px">${empresaNombre}</h2>
    <p style="color:#fca5a5;margin:4px 0 0;font-size:13px">Reserva Anulada</p>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <p style="color:#374151">Hola <strong>${nombreCliente}</strong>,</p>
    <p style="color:#374151">Lamentablemente tu reserva para <strong>${nombrePropiedad}</strong> (${fmtFecha(checkin)} → ${fmtFecha(checkout)}) ha sido <strong>anulada automáticamente</strong> por no recibirse el abono de seña dentro del plazo de 48 horas.</p>
    <p style="color:#374151">Si deseas reactivar la reserva o tienes alguna consulta, contáctanos:</p>
    ${adminEmail ? `<p style="color:#1e3a5f;font-weight:bold">${adminEmail}</p>` : ''}
    <p style="color:#6b7280;font-size:13px">Gracias por considerar ${empresaNombre}.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:12px 32px;text-align:center">
    <p style="margin:0;color:#9ca3af;font-size:12px">${empresaNombre} · Notificación automática</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

function _buildCancelAdminEmail({ nombreCliente, emailCliente, nombrePropiedad, checkin, checkout, reservaId }) {
    const fmtFecha = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
    return `<!DOCTYPE html><html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:16px;background:#f4f6f8;font-family:Arial,sans-serif">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border-left:4px solid #d97706">
  <h3 style="margin:0 0 12px;color:#92400e">⚠ Reserva anulada por no pago de seña</h3>
  <table style="font-size:14px;color:#374151;border-collapse:collapse;width:100%">
    <tr><td style="padding:4px 0;color:#6b7280">Reserva ID</td><td style="padding:4px 0">${reservaId}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Huésped</td><td style="padding:4px 0">${nombreCliente} (${emailCliente})</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Alojamiento</td><td style="padding:4px 0">${nombrePropiedad}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Check-in</td><td style="padding:4px 0">${fmtFecha(checkin)}</td></tr>
    <tr><td style="padding:4px 0;color:#6b7280">Check-out</td><td style="padding:4px 0">${fmtFecha(checkout)}</td></tr>
  </table>
  <p style="margin:16px 0 0;font-size:13px;color:#6b7280">La reserva fue anulada automáticamente por el sistema. Las fechas quedan disponibles nuevamente.</p>
</div>
</body></html>`;
}

const cancelarPropuestasIAVencidas = async () => {
    try {
        console.log('[CRON-IA] Buscando reservas IA sin pago vencidas...');

        const { rows } = await pool.query(
            `SELECT r.id, r.empresa_id, r.id_reserva_canal, r.alojamiento_nombre,
                    r.cliente_id, r.fecha_llegada, r.fecha_salida, r.metadata,
                    e.nombre AS empresa_nombre, e.email AS admin_email,
                    c.nombre AS cliente_nombre, c.email AS cliente_email
             FROM reservas r
             LEFT JOIN empresas e ON e.id = r.empresa_id
             LEFT JOIN clientes c ON c.id = r.cliente_id
             WHERE r.estado = 'Confirmada'
               AND r.metadata->>'origen' = 'ia-reserva'
               AND r.metadata->>'estadoPago' = 'pendiente'
               AND (r.metadata->>'vencimientoPago')::timestamptz < NOW()`
        );

        if (!rows.length) {
            console.log('[CRON-IA] Sin reservas vencidas.');
            return;
        }

        console.log(`[CRON-IA] Anulando ${rows.length} reserva(s)...`);
        const dbFs = require('firebase-admin').firestore();

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
                    [row.empresa_id, row.id_reserva_canal,
                     `Reserva anulada automáticamente: no se recibió el abono de seña en 48 horas (vencimiento: ${row.metadata?.vencimientoPago || 'N/D'}).`]
                );

                const fechaLlegada = row.fecha_llegada instanceof Date ? row.fecha_llegada.toISOString().split('T')[0] : String(row.fecha_llegada).split('T')[0];
                const fechaSalida  = row.fecha_salida  instanceof Date ? row.fecha_salida.toISOString().split('T')[0]  : String(row.fecha_salida).split('T')[0];

                // Notificar al cliente
                if (row.cliente_email) {
                    emailService.enviarCorreo(dbFs, {
                        to: row.cliente_email,
                        subject: `Tu reserva en ${row.alojamiento_nombre} fue anulada`,
                        html: _buildCancelClienteEmail({
                            nombreCliente: row.cliente_nombre || 'Huésped',
                            nombrePropiedad: row.alojamiento_nombre,
                            checkin: fechaLlegada, checkout: fechaSalida,
                            empresaNombre: row.empresa_nombre || row.empresa_id,
                            adminEmail: row.admin_email
                        }),
                        empresaId: row.empresa_id
                    }).catch(err => console.warn(`[CRON-IA] Email cliente fallido (${row.id}): ${err.message}`));
                }

                // Notificar al administrador
                if (row.admin_email) {
                    emailService.enviarCorreo(dbFs, {
                        to: row.admin_email,
                        subject: `[SuiteManager] Reserva anulada por no pago — ${row.alojamiento_nombre}`,
                        html: _buildCancelAdminEmail({
                            nombreCliente: row.cliente_nombre || 'Huésped desconocido',
                            emailCliente: row.cliente_email || 'sin email',
                            nombrePropiedad: row.alojamiento_nombre,
                            checkin: fechaLlegada, checkout: fechaSalida,
                            reservaId: row.id
                        }),
                        empresaId: row.empresa_id
                    }).catch(err => console.warn(`[CRON-IA] Email admin fallido (${row.id}): ${err.message}`));
                }

                console.log(`[CRON-IA] Anulada: ${row.id} (${row.alojamiento_nombre}) | cliente: ${row.cliente_email || '-'} | admin: ${row.admin_email || '-'}`);
            } catch (err) {
                console.error(`[CRON-IA] Error anulando ${row.id}:`, err.message);
            }
        }

        console.log('[CRON-IA] Proceso completado.');
    } catch (err) {
        console.error('[CRON-IA] Error general:', err.message);
    }
};

const iniciar = () => {
    console.log('[CRON-IA] Job de expiración de reservas IA iniciado (cada 1h).');
    if (process.env.NODE_ENV === 'production') {
        cancelarPropuestasIAVencidas();
    }
    setInterval(cancelarPropuestasIAVencidas, 60 * 60 * 1000);
};

module.exports = { iniciar, cancelarPropuestasIAVencidas };
