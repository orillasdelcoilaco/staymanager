const { procesarPlantilla } = require('./plantillasService');
const emailService = require('./emailService');
const {
    enviarPorDisparador,
    enviarNotificacionInterna,
} = require('./transactionalEmailService');

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
    reservaId,
    plantillasDatos,
    fallbackData,
}) {
    let templateErrorReason = null;
    try {
        if (!clienteEmail) {
            return { sent: false, reason: 'MISSING_EMAIL' };
        }

        try {
            const templateResult = await enviarPorDisparador(db, empresaId, 'reserva_confirmada', {
                clienteId: null,
                destinatarioOverride: clienteEmail,
                variables: plantillasDatos,
                relacionadoCon: { tipo: 'reserva', id: reservaId || null },
                eventoComunicacion: 'reserva-confirmada',
                skipRegistro: true,
            });
            if (templateResult?.sent) {
                return { sent: true, mode: 'template_reserva_confirmada', messageId: templateResult.messageId || null };
            }
            templateErrorReason = templateResult?.reason || 'EMAIL_PROVIDER_REJECTED';
        } catch (error) {
            templateErrorReason = error?.message || 'TEMPLATE_RENDER_FAILED';
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
        const fmtCLP = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v || 0);
        const resumen = [
            `Nueva reserva confirmada por IA.`,
            `Reserva: ${reservaId}`,
            `Huésped: ${nombreCliente} (${clienteEmail})`,
            `Alojamiento: ${nombrePropiedad}`,
            `Fechas: ${checkin} al ${checkout} (${noches} noche(s))`,
            `Total: ${fmtCLP(montoTotal)} | Seña: ${fmtCLP(montoSena)}`,
        ].join('\n');

        const r = await enviarNotificacionInterna(db, empresaId, {
            reservaId,
            propuestaId: reservaId,
            clienteNombre: nombreCliente,
            nombreCliente,
            clienteEmail,
            nombrePropiedad,
            fechaLlegada: checkin,
            fechaSalida: checkout,
            fechasEstadiaTexto: `${checkin} al ${checkout}`,
            totalNoches: String(noches || ''),
            noches: String(noches || ''),
            montoTotal: fmtCLP(montoTotal),
            precioFinal: fmtCLP(montoTotal),
            montoAbono: fmtCLP(montoSena),
            porcentajeAbono: '10%',
            mensajeConsulta: resumen,
            consultaMensaje: resumen,
        }, { tipo: 'reserva', id: reservaId || null });

        if (!r?.sent) return { sent: false, reason: r?.reason || 'EMAIL_PROVIDER_REJECTED' };
        return { sent: true, mode: 'template_notificacion_interna', messageId: r.messageId || null };
    } catch (error) {
        return { sent: false, reason: error?.message || 'ADMIN_EMAIL_SEND_EXCEPTION' };
    }
}

module.exports = {
    enviarConfirmacionReservaIaEmail,
    enviarNotificacionAdminReservaIaEmail,
    buildFallbackConfirmEmail,
};

