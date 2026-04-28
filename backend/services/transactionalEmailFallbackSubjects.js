/**
 * Asuntos mínimos cuando la plantilla PG deja `asunto` vacío (i18n según idiomaPorDefecto del tenant).
 */

const BY_DISPARADOR = {
    reserva_confirmada: {
        es: 'Reserva confirmada',
        en: 'Reservation confirmed',
    },
    reserva_cancelada: {
        es: 'Reserva cancelada',
        en: 'Reservation cancelled',
    },
    recordatorio_pre_llegada: {
        es: 'Recordatorio: tu llegada se acerca',
        en: 'Reminder: your stay is coming up',
    },
    post_estadia_evaluacion: {
        es: '¿Cómo fue tu estadía?',
        en: 'How was your stay?',
    },
    consulta_contacto: {
        es: 'Consulta recibida',
        en: 'We received your message',
    },
    reserva_modificada: {
        es: 'Tu reserva fue actualizada',
        en: 'Your reservation was updated',
    },
    notificacion_interna: {
        es: 'Notificación interna',
        en: 'Internal notification',
    },
    digest_operacion_diario: {
        es: 'Resumen operación diario',
        en: 'Daily operations summary',
    },
};

/**
 * @param {string} disparadorKey
 * @param {'es'|'en'} lang
 */
function fallbackSubjectForDisparador(disparadorKey, lang) {
    const k = String(disparadorKey || '').trim();
    const row = BY_DISPARADOR[k] || { es: 'Mensaje de StayManager', en: 'Message from StayManager' };
    return lang === 'en' ? (row.en || row.es) : (row.es || row.en);
}

/** Fallback envío legado (sin plantilla PG) — huésped. */
function fallbackSubjectConfirmacionReservaHuesped(reservaId, empresaNombre, lang) {
    const en = lang === 'en';
    const name = empresaNombre || (en ? 'StayManager' : 'SuiteManager');
    return en
        ? `Reservation confirmed #${reservaId} — ${name}`
        : `✅ Reserva confirmada #${reservaId} — ${name}`;
}

/** Fallback copia admin (emailService directo). */
function fallbackSubjectConfirmacionReservaAdmin(reservaId, clienteNombre, lang) {
    return lang === 'en'
        ? `[Admin] Reservation confirmed #${reservaId} — ${clienteNombre}`
        : `[Admin] Reserva Confirmada #${reservaId} — ${clienteNombre}`;
}

/** Asunto al registrar comunicación tras fallback huésped. */
function fallbackSubjectRegistroComunicacionReserva(reservaId, lang) {
    return lang === 'en'
        ? `Reservation confirmed #${reservaId}`
        : `Reserva confirmada #${reservaId}`;
}

/** Asunto por defecto si el huésped no escribe asunto (formulario contacto SSR). */
function fallbackAsuntoConsultaWebDefecto(lang) {
    return lang === 'en' ? 'Message from your website' : 'Consulta desde la web';
}

module.exports = {
    fallbackSubjectForDisparador,
    fallbackSubjectConfirmacionReservaHuesped,
    fallbackSubjectConfirmacionReservaAdmin,
    fallbackSubjectRegistroComunicacionReserva,
    fallbackAsuntoConsultaWebDefecto,
    BY_DISPARADOR,
};
