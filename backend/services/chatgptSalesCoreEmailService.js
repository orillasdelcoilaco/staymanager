const { procesarPlantilla } = require('./plantillasService');
const emailService = require('./emailService');

function buildFallbackConfirmEmail({
    nombreCliente,
    nombrePropiedad,
    checkin,
    checkout,
    noches,
    montoSena,
    datosBancariosTexto,
    plazoAbono,
    empresaNombre,
}) {
    const fmtCLP = (v) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v || 0);
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#111827;color:#fff;padding:20px 24px">
    <h2 style="margin:0;font-size:22px">Reserva confirmada</h2>
    <p style="margin:6px 0 0 0;font-size:14px;opacity:.9">${empresaNombre || 'Reserva'}</p>
  </td></tr>
  <tr><td style="padding:22px 24px">
    <p>Hola <strong>${nombreCliente}</strong>,</p>
    <p>Tu reserva en <strong>${nombrePropiedad}</strong> quedó confirmada.</p>
    <ul>
      <li>Check-in: ${checkin}</li>
      <li>Check-out: ${checkout}</li>
      <li>Noches: ${noches}</li>
      <li>Seña (10%): ${fmtCLP(montoSena)}</li>
      <li>Plazo de pago: ${plazoAbono}</li>
    </ul>
    <p><strong>Datos para transferencia</strong><br><pre style="white-space:pre-wrap">${datosBancariosTexto}</pre></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function enviarConfirmacionReservaIaEmail({
    db,
    empresaId,
    clienteEmail,
    plantillaId,
    plantillasDatos,
    fallbackData,
}) {
    let templateErrorReason = null;
    try {
        if (!clienteEmail) {
            return { sent: false, reason: 'MISSING_EMAIL' };
        }

        if (plantillaId) {
            try {
                const { contenido, asunto } = await procesarPlantilla(db, empresaId, plantillaId, plantillasDatos);
                const r = await emailService.enviarCorreo(db, {
                    to: clienteEmail,
                    subject: asunto,
                    html: contenido,
                    empresaId,
                });
                if (r?.success) return { sent: true, mode: 'template', messageId: r.messageId || null };
                templateErrorReason = r?.error || 'EMAIL_PROVIDER_REJECTED';
            } catch (error) {
                templateErrorReason = error?.message || 'TEMPLATE_RENDER_FAILED';
            }
        }

        const r = await emailService.enviarCorreo(db, {
            to: clienteEmail,
            subject: `Tu reserva en ${fallbackData.nombrePropiedad} está confirmada`,
            html: buildFallbackConfirmEmail(fallbackData),
            empresaId,
        });
        if (!r?.success) {
            const base = r?.error || 'EMAIL_PROVIDER_REJECTED';
            return {
                sent: false,
                reason: templateErrorReason ? `template=${templateErrorReason}; fallback=${base}` : base,
            };
        }
        return { sent: true, mode: 'fallback_html', messageId: r.messageId || null };
    } catch (error) {
        const reason = error.message || 'EMAIL_SEND_EXCEPTION';
        return {
            sent: false,
            reason: templateErrorReason ? `template=${templateErrorReason}; fallback=${reason}` : reason,
        };
    }
}

async function enviarNotificacionAdminReservaIaEmail({
    db,
    empresaId,
    adminEmail,
    reservaId,
    nombreCliente,
    clienteEmail,
    nombrePropiedad,
    checkin,
    checkout,
    noches,
    montoSena,
    montoTotal,
}) {
    try {
        if (!adminEmail) return { sent: false, reason: 'MISSING_ADMIN_EMAIL' };
        const fmtCLP = (v) =>
            new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v || 0);
        const html = `<!doctype html><html><body style="font-family:Arial,sans-serif">
<h2>Nueva reserva creada por IA</h2>
<p><strong>Reserva:</strong> ${reservaId}</p>
<p><strong>Huésped:</strong> ${nombreCliente} (${clienteEmail})</p>
<p><strong>Alojamiento:</strong> ${nombrePropiedad}</p>
<p><strong>Fechas:</strong> ${checkin} al ${checkout} (${noches} noche(s))</p>
<p><strong>Total:</strong> ${fmtCLP(montoTotal)} · <strong>Seña:</strong> ${fmtCLP(montoSena)}</p>
</body></html>`;
        const r = await emailService.enviarCorreo(db, {
            to: adminEmail,
            subject: `[Admin] Nueva reserva IA ${reservaId}`,
            html,
            empresaId,
        });
        if (!r?.success) return { sent: false, reason: r?.error || 'EMAIL_PROVIDER_REJECTED' };
        return { sent: true, mode: 'admin_notification', messageId: r.messageId || null };
    } catch (error) {
        return { sent: false, reason: error?.message || 'ADMIN_EMAIL_SEND_EXCEPTION' };
    }
}

module.exports = {
    enviarConfirmacionReservaIaEmail,
    enviarNotificacionAdminReservaIaEmail,
    buildFallbackConfirmEmail,
};

