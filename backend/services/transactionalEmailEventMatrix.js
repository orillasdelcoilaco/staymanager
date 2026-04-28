// backend/services/transactionalEmailEventMatrix.js
// Matriz producto: evento de correo → disparador motor / origen / si aplica interruptor global.
const { obtenerPlantillaPorDisparador } = require('./transactionalEmailService');

/**
 * Filas estáticas (documentación ejecutable). `disparadorMotor` null = no usa plantillas PG por disparador.
 */
const MATRIZ_EVENTOS_CORREO = Object.freeze([
    {
        id: 'reserva_confirmada',
        nombre: 'Confirmación de reserva (huésped)',
        disparadorMotor: 'reserva_confirmada',
        eventoComunicaciones: 'reserva-confirmada',
        registraEnComunicaciones: true,
        audiencia: 'huesped',
        afectadoPorCorreosAutomaticos: true,
        origenCodigo: 'gestionPropuestas.email.js → enviarEmailReservaConfirmada',
        modoPlantilla: 'motor_con_fallback_texto',
        notas: 'Si no hay plantilla PG con disparador, se envía texto fijo y se registra comunicación. La reserva vía IA en web pública (`publicAiController`) usa Firestore: plantilla con disparador `reserva_confirmada` o primera con `enviarPorEmail`, no `enviarPorDisparador` PG.',
    },
    {
        id: 'reserva_web_checkout',
        nombre: 'Confirmación huésped — reserva desde checkout web (/reservar)',
        disparadorMotor: 'reserva_confirmada',
        eventoComunicaciones: 'reserva-confirmada',
        registraEnComunicaciones: true,
        audiencia: 'huesped',
        afectadoPorCorreosAutomaticos: true,
        origenCodigo: 'website.booking.js → gestionPropuestas.email.enviarEmailReservaConfirmada (tras crearReservaPublica)',
        modoPlantilla: 'motor_con_fallback_texto',
        notas:
            'Misma plantilla PG que otras confirmaciones (`reserva_confirmada`). Seña 10% sugerida vía `extras` del motor. '
            + 'Variables checkout post-reserva (URLs desde `websiteSettings.booking`, hora, llegada ligera, comentarios, identidad check-in, consentimiento): `[LINK_CHECKIN_ONLINE]`, `[LINK_MANUAL_HUESPED]`, `[LINK_MANUAL_HUESPED_PDF]`, `[HORA_LLEGADA_ESTIMADA]`, `[MEDIO_LLEGADA]`, `[MEDIO_LLEGADA_TEXTO]`, `[REFERENCIA_TRANSPORTE]`, `[DOC_REF_VIAJERO]`, `[NOTAS_HUESPED_CHECKOUT]`, `[DOC_*]`, `[CONSENTIMIENTO_IDENTIDAD_LINEA]` en `construirVariablesDesdeReserva`. '
            + '`[LINK_RESEÑA]` / `[LINK_RESENA]`: outbound vía `resolverLinkResenaOutbound` (misma URL externa o token `/r/…` que post-estancia; `?ref=confirmacion`). '
            + 'Si `manualHuespedPdfUrl` es HTTPS público y hay Resend, se intenta adjuntar el PDF (límite 5 MB); si falla, mismo correo con bloque HTML de enlace; si Resend no está, último recurso Gmail SMTP sin adjuntos. '
            + 'SSR `/confirmacion?reservaId=` (`confirmacion.ejs`): enlaces huésped a `manualHuespedUrl`, `manualHuespedPdfUrl` y `checkinOnlineUrl` si están configurados (misma validación http(s) que `normalizeBookingUrlForSsr`). '
            + 'El `precioFinal` en query debe coincidir con la reconciliación del servidor: el widget (`booking.js`) y el CTA de grupo en `home.ejs` llaman `POST /preview-precio-reserva-checkout` antes de navegar a `/reservar` (menores/camas 0 salvo que el flujo ya los envíe explícitamente).',
    },
    {
        id: 'reserva_cancelada',
        nombre: 'Cancelación de reserva',
        disparadorMotor: 'reserva_cancelada',
        eventoComunicaciones: 'reserva-cancelada',
        registraEnComunicaciones: true,
        audiencia: 'huesped',
        afectadoPorCorreosAutomaticos: true,
        origenCodigo: 'transactionalEmailHooks.js',
        modoPlantilla: 'motor_pg',
    },
    {
        id: 'reserva_modificada',
        nombre: 'Modificación de fechas de reserva',
        disparadorMotor: 'reserva_modificada',
        eventoComunicaciones: 'reserva-modificada',
        registraEnComunicaciones: true,
        audiencia: 'huesped',
        afectadoPorCorreosAutomaticos: true,
        origenCodigo: 'transactionalEmailHooks.js (PUT reserva)',
        modoPlantilla: 'motor_pg',
    },
    {
        id: 'recordatorio_pre_llegada',
        nombre: 'Recordatorio previo a la llegada',
        disparadorMotor: 'recordatorio_pre_llegada',
        eventoComunicaciones: 'recordatorio-pre-llegada',
        registraEnComunicaciones: true,
        audiencia: 'huesped',
        afectadoPorCorreosAutomaticos: true,
        origenCodigo: 'scheduledTransactionalEmails.js → runRecordatoriosPreLlegada',
        modoPlantilla: 'motor_pg',
        notas: '`[LINK_RESEÑA]` rellenado con `resolverLinkResenaOutbound` (`?ref=prellegada`) si hay PG y política de reseña (URL externa o token interno).',
    },
    {
        id: 'post_estadia_evaluacion',
        nombre: 'Evaluación / reseña post‑estancia (cada envío)',
        disparadorMotor: 'post_estadia_evaluacion',
        eventoComunicaciones: 'evaluacion-pendiente',
        registraEnComunicaciones: true,
        audiencia: 'huesped',
        afectadoPorCorreosAutomaticos: true,
        origenCodigo: 'scheduledTransactionalEmails.js → runPostEstadiaEvaluacion',
        modoPlantilla: 'motor_pg',
        notas: 'Pixel opcional en correo → evaluacion-correo-abierto; enlace ?ref=email → evaluacion-formulario-abierto; submit → evaluacion-completada.',
    },
    {
        id: 'consulta_web_publica',
        nombre: 'Respuesta automática consulta web (huésped)',
        disparadorMotor: 'consulta_contacto',
        eventoComunicaciones: 'consulta-web-publica',
        registraEnComunicaciones: true,
        audiencia: 'huesped',
        afectadoPorCorreosAutomaticos: true,
        origenCodigo: 'publicContactoService.js',
        modoPlantilla: 'motor_pg',
        notas:
            'Respeta `correosAutomaticosActivos` y la categoría opcional `correosAutomaticosCategorias.consultasDesdeWeb` (Configuración empresa). Si está desmarcada, no se envía el correo al huésped vía `enviarPorDisparador`; el lead y la notificación interna siguen.',
    },
    {
        id: 'consulta_web_interna',
        nombre: 'Notificación interna por consulta web',
        disparadorMotor: 'notificacion_interna',
        eventoComunicaciones: null,
        registraEnComunicaciones: false,
        audiencia: 'equipo',
        afectadoPorCorreosAutomaticos: false,
        origenCodigo: 'publicContactoService.js → enviarNotificacionInterna',
        modoPlantilla: 'motor_pg',
        notas: 'No registra fila en comunicaciones (solo envío al email de contacto).',
    },
    {
        id: 'propuesta_enviada',
        nombre: 'Envío de propuesta con correo',
        disparadorMotor: null,
        eventoComunicaciones: 'propuesta-enviada',
        registraEnComunicaciones: true,
        audiencia: 'huesped',
        afectadoPorCorreosAutomaticos: false,
        origenCodigo: 'gestionPropuestas.email.js → enviarEmailPropuesta',
        modoPlantilla: 'plantilla_firestore_por_id',
        notas: 'La plantilla se elige al guardar la propuesta (Firestore / flujo clásico), no por disparador PG.',
    },
    {
        id: 'admin_copia_reserva_confirmada',
        nombre: 'Copia al equipo (nueva reserva confirmada)',
        disparadorMotor: 'notificacion_interna',
        eventoComunicaciones: null,
        registraEnComunicaciones: false,
        audiencia: 'equipo',
        afectadoPorCorreosAutomaticos: false,
        origenCodigo: 'gestionPropuestas.email.js → enviarNotificacionInterna (fallback HTML si no hay plantilla)',
        modoPlantilla: 'motor_pg_o_fallback_html',
        notas: 'Puede compartir plantilla con otras notificaciones internas. Variables incluyen resumen en MENSAJE_CONSULTA.',
    },
    {
        id: 'digest_operacion_diario',
        nombre: 'Resumen diario de operación (llegadas, salidas, propuestas, pagos pendientes, bloqueos, fallos)',
        disparadorMotor: 'digest_operacion_diario',
        eventoComunicaciones: null,
        registraEnComunicaciones: false,
        audiencia: 'equipo',
        afectadoPorCorreosAutomaticos: false,
        origenCodigo: 'scheduledTransactionalEmails.js → runDigestOperacion',
        modoPlantilla: 'motor_con_fallback_texto',
        notas: 'Plantilla PG con disparador digest_operacion_diario (etiquetas [DIGEST_*] + iCal 7d: [DIGEST_ICAL_NUEVAS_RESERVAS_7D], [DIGEST_ICAL_SINCRONIZACIONES_CON_ERROR_7D] + alertas: [DIGEST_LLEGADAS_MANANA_SIN_HORA_ESTIMADA], [DIGEST_PAGO_PENDIENTE_VENCIDO]); si no hay plantilla, correo texto plano del job. emailAutomations.digestOperacionDiario = false desactiva. Web push opcional (VAPID + suscripción en panel empresa).',
    },
]);

/**
 * @param {string} empresaId
 * @returns {Promise<object[]>}
 */
async function obtenerMatrizEventosCorreoConEstado(empresaId) {
    const eid = String(empresaId || '').trim();
    const out = [];
    for (const row of MATRIZ_EVENTOS_CORREO) {
        let cobertura = 'no_aplica';
        let plantillaNombre = null;
        let plantillaId = null;

        if (row.modoPlantilla === 'motor_pg' || row.modoPlantilla === 'motor_con_fallback_texto') {
            const p = row.disparadorMotor ? await obtenerPlantillaPorDisparador(eid, row.disparadorMotor) : null;
            if (p) {
                cobertura = 'plantilla_pg';
                plantillaNombre = p.nombre;
                plantillaId = p.id;
            } else if (row.modoPlantilla === 'motor_con_fallback_texto') {
                cobertura = 'fallback_texto_sin_pg';
            } else {
                cobertura = 'sin_plantilla_pg';
            }
        } else if (row.modoPlantilla === 'motor_pg_o_fallback_html') {
            const p = row.disparadorMotor ? await obtenerPlantillaPorDisparador(eid, row.disparadorMotor) : null;
            if (p) {
                cobertura = 'plantilla_pg';
                plantillaNombre = p.nombre;
                plantillaId = p.id;
            } else {
                cobertura = 'fallback_html_sistema';
            }
        } else if (row.modoPlantilla === 'plantilla_firestore_por_id') {
            cobertura = 'manual_en_flujo';
        } else if (row.modoPlantilla === 'html_interno_fijo' || row.modoPlantilla === 'texto_plano_job') {
            cobertura = 'no_aplica';
        }

        out.push({
            ...row,
            cobertura,
            plantillaNombre,
            plantillaId,
        });
    }
    return out;
}

module.exports = {
    MATRIZ_EVENTOS_CORREO,
    obtenerMatrizEventosCorreoConEstado,
};
