// backend/services/transactionalEmailService.js
// Motor de envío por disparadores definidos en plantillas (email_config.disparadores).
const pool = require('../db/postgres');
const {
    procesarPlantilla,
    normalizeEmailConfig,
    DISPARADOR_KEYS,
} = require('./plantillasService');
const emailService = require('./emailService');
const { registrarComunicacion } = require('./comunicacionesService');
const { obtenerClientePorId } = require('./clientesService');
const { fallbackSubjectForDisparador } = require('./transactionalEmailFallbackSubjects');
const { enmascararDocumentoParaUiPublica } = require('./reservaWebCheckinIdentidadService');
const { esEstadoPrincipalCancelacionSync } = require('./estadosService');
const { generarTokenParaReserva } = require('./resenasService');
const { resolveDepositoReservaWeb } = require('./depositoReservaWebService');

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN || 'suitemanagers.com';

/** Mapa disparador plantilla → evento en tabla comunicaciones */
/** Disparadores transaccionales típicos; `consulta_contacto` usa interruptor maestro + categoría opcional `consultasDesdeWeb`; se excluye `notificacion_interna`. */
const DISPARADORES_AFECTADOS_POR_SWITCH_AUTO = new Set([
    'reserva_confirmada',
    'reserva_cancelada',
    'reserva_modificada',
    'recordatorio_pre_llegada',
    'post_estadia_evaluacion',
]);

function _correosAutomaticosHuespedActivos(ctx) {
    const v = ctx.configuracion?.websiteSettings?.email?.correosAutomaticosActivos;
    return v !== false;
}

/** Interruptor maestro + granularidad opcional por categoría (`correosAutomaticosCategorias`). */
function _permiteCorreoAutomaticoHuesped(ctx, disparadorKey) {
    if (disparadorKey === 'digest_operacion_diario') {
        const off = ctx.configuracion?.emailAutomations?.digestOperacionDiario === false;
        return !off;
    }
    if (!_correosAutomaticosHuespedActivos(ctx)) return false;
    if (disparadorKey === 'consulta_contacto') {
        const cats0 = ctx.configuracion?.websiteSettings?.email?.correosAutomaticosCategorias;
        if (!cats0 || typeof cats0 !== 'object') return true;
        return cats0.consultasDesdeWeb !== false;
    }
    if (!DISPARADORES_AFECTADOS_POR_SWITCH_AUTO.has(disparadorKey)) return true;
    const cats = ctx.configuracion?.websiteSettings?.email?.correosAutomaticosCategorias;
    if (!cats || typeof cats !== 'object') return true;
    if (disparadorKey === 'reserva_confirmada' || disparadorKey === 'reserva_cancelada' || disparadorKey === 'reserva_modificada') {
        return cats.reservasTransaccionales !== false;
    }
    if (disparadorKey === 'recordatorio_pre_llegada') {
        return cats.recordatorioPreLlegada !== false;
    }
    if (disparadorKey === 'post_estadia_evaluacion') {
        return cats.evaluacionPostEstadia !== false;
    }
    return true;
}

async function obtenerPlantillaActivaPorId(empresaId, plantillaId) {
    const pid = String(plantillaId || '').trim();
    if (!pid) return null;
    const { rows } = await pool.query(
        `SELECT id, nombre, tipo, texto, COALESCE(asunto,'') AS asunto, email_config
         FROM plantillas
         WHERE id = $1 AND empresa_id = $2 AND activa = true
         LIMIT 1`,
        [pid, empresaId]
    );
    const r = rows[0];
    if (!r) return null;
    return {
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        texto: r.texto,
        asunto: r.asunto != null ? String(r.asunto) : '',
    };
}

const EVENTO_POR_DISPARADOR = {
    reserva_confirmada: 'reserva-confirmada',
    reserva_cancelada: 'reserva-cancelada',
    reserva_modificada: 'reserva-modificada',
    recordatorio_pre_llegada: 'recordatorio-pre-llegada',
    post_estadia_evaluacion: 'evaluacion-pendiente',
    consulta_contacto: 'consulta-web-publica',
    notificacion_interna: 'notificacion-interna',
    digest_operacion_diario: 'digest-operacion-diario',
};

async function _obtenerEmpresaEmailContext(empresaId) {
    const { rows } = await pool.query(
        `SELECT nombre, email, configuracion
         FROM empresas WHERE id = $1`,
        [empresaId]
    );
    const r = rows[0];
    if (!r) return { nombre: '', contactoEmail: null, contactoNombre: '', contactoTelefono: '', website: '', configuracion: {} };
    const cfg = r.configuracion || {};
    return {
        nombre: r.nombre || '',
        contactoEmail: cfg.contactoEmail || r.email || null,
        contactoNombre: cfg.contactoNombre || '',
        contactoTelefono: cfg.contactoTelefono || '',
        website: cfg.website || '',
        configuracion: cfg,
    };
}

/**
 * URL pública del sitio SSR de la empresa (reseñas, home).
 */
async function obtenerBaseUrlPublica(empresaId) {
    const ctx = await _obtenerEmpresaEmailContext(empresaId);
    const ws = ctx.configuracion.websiteSettings || {};
    const sub = ws.general?.subdomain || '';
    const domain = (ws.general?.domain || '').trim().toLowerCase();
    const hostBase = PLATFORM_DOMAIN || 'suitemanagers.com';
    if (domain && domain.length > 3 && !domain.endsWith('.local')) {
        return `https://${domain}`;
    }
    if (sub) return `https://${sub}.${hostBase}`;
    return `https://${hostBase}`;
}

/**
 * Enlace de reseña para huésped (outbound): misma fuente que post-estancia — `urlResenaExterna` (https)
 * o formulario interno `/r/:token` (reutiliza fila `resenas` si ya existe).
 * Devuelve cadena vacía sin PostgreSQL, reserva no encontrada o cliente bloqueado.
 *
 * @param {string} empresaId
 * @param {{ reservaRef: string|number, nombreHuesped?: string, refQuery?: string, propiedadIdFallback?: string|null }} opts
 */
async function resolverLinkResenaOutbound(empresaId, {
    reservaRef,
    nombreHuesped = '',
    refQuery = 'email',
    propiedadIdFallback = null,
}) {
    if (!pool) return '';
    const ref = reservaRef != null ? String(reservaRef).trim() : '';
    if (!ref) return '';
    const ctx = await _obtenerEmpresaEmailContext(empresaId);
    const ext = String(ctx.configuracion?.emailAutomations?.evaluacionPostEstadia?.urlResenaExterna || '').trim();
    if (ext && /^https?:\/\//i.test(ext)) {
        return ext;
    }
    try {
        const { rows } = await pool.query(
            `SELECT id, propiedad_id FROM reservas
             WHERE empresa_id = $1 AND (id::text = $2 OR id_reserva_canal = $2)
             LIMIT 1`,
            [empresaId, ref]
        );
        const row = rows[0];
        if (!row) return '';
        const pid = row.propiedad_id != null && String(row.propiedad_id).trim() !== ''
            ? row.propiedad_id
            : propiedadIdFallback;
        const token = await generarTokenParaReserva(
            empresaId,
            String(row.id),
            pid || null,
            nombreHuesped || ''
        );
        const baseUrl = await obtenerBaseUrlPublica(empresaId);
        const q = refQuery ? `?ref=${encodeURIComponent(String(refQuery))}` : '';
        return `${baseUrl}/r/${encodeURIComponent(token)}${q}`;
    } catch (e) {
        console.warn('[resolverLinkResenaOutbound]', e.message);
        return '';
    }
}

/**
 * Busca la primera plantilla activa con disparador encendido y envío por correo permitido.
 */
async function obtenerPlantillaPorDisparador(empresaId, disparadorKey) {
    if (!DISPARADOR_KEYS.includes(disparadorKey)) return null;
    const { rows } = await pool.query(
        `SELECT id, nombre, tipo, texto, asunto, email_config
         FROM plantillas
         WHERE empresa_id = $1 AND activa = true
         ORDER BY id DESC`,
        [empresaId]
    );
    for (const r of rows) {
        const ec = normalizeEmailConfig(r.email_config);
        if (!ec.permitirEnvioCorreo) continue;
        if (ec.disparadores && ec.disparadores[disparadorKey]) {
            return {
                id: r.id,
                nombre: r.nombre,
                tipo: r.tipo,
                texto: r.texto,
                asunto: r.asunto != null ? String(r.asunto) : '',
            };
        }
    }
    return null;
}

/**
 * @returns {{ sent: boolean, reason?: string, messageId?: string, plantillaId?: string }}
 */
async function enviarPorDisparador(_db, empresaId, disparadorKey, {
    clienteId = null,
    destinatarioOverride = null,
    variables = {},
    relacionadoCon = null,
    eventoComunicacion = null,
    skipRegistro = false,
    plantillaIdOverride = null,
    openPixelUrl = null,
    /** @type {{ filename: string, content: Buffer }[]|undefined} adjuntos binarios (p. ej. PDF manual reserva web) */
    attachments = undefined,
    /** HTML extra si no hay adjunto PDF o tras fallo con adjunto (enlace público al PDF). */
    appendHtmlWhenNoPdf = '',
}) {
    const ctx = await _obtenerEmpresaEmailContext(empresaId);
    if (!_permiteCorreoAutomaticoHuesped(ctx, disparadorKey)) {
        return { sent: false, reason: 'correos_automaticos_desactivados' };
    }

    let plantilla = null;
    if (plantillaIdOverride) {
        plantilla = await obtenerPlantillaActivaPorId(empresaId, plantillaIdOverride);
    } else {
        plantilla = await obtenerPlantillaPorDisparador(empresaId, disparadorKey);
    }
    if (!plantilla) {
        return { sent: false, reason: 'no_plantilla' };
    }
    let to = (destinatarioOverride || '').trim();
    let cid = clienteId;
    if (!to && cid) {
        try {
            const c = await obtenerClientePorId(_db, empresaId, cid);
            to = (c?.email || '').trim();
        } catch (_) {
            to = '';
        }
    }
    if (!to) {
        return { sent: false, reason: 'sin_email', plantillaId: plantilla.id };
    }

    const datos = {
        ...variables,
        empresaNombre: variables.empresaNombre || ctx.nombre,
        empresaWebsite: variables.empresaWebsite || ctx.website,
        contactoNombre: variables.contactoNombre || ctx.contactoNombre,
        contactoEmail: variables.contactoEmail || ctx.contactoEmail || '',
        contactoTelefono: variables.contactoTelefono || ctx.contactoTelefono,
        usuarioNombre: variables.usuarioNombre || ctx.contactoNombre,
        usuarioEmail: variables.usuarioEmail || ctx.contactoEmail || '',
        usuarioTelefono: variables.usuarioTelefono || ctx.contactoTelefono,
    };

    const { contenido, asunto } = await procesarPlantilla(_db, empresaId, plantilla.id, datos);
    const em = ctx.configuracion?.websiteSettings?.email || {};
    const htmlLangMotor = em.idiomaPorDefecto === 'en' ? 'en' : 'es';
    let subjectLine = String(asunto || '').trim();
    if (!subjectLine) {
        subjectLine = fallbackSubjectForDisparador(disparadorKey, htmlLangMotor);
    }
    const replyPreferido = (em.replyToOverride && String(em.replyToOverride).trim())
        || (ctx.contactoEmail && String(ctx.contactoEmail).trim())
        || undefined;

    let htmlCuerpo = contenido;
    const px = openPixelUrl && !skipRegistro ? String(openPixelUrl).replace(/[\s"<>]/g, '') : '';
    if (px) {
        htmlCuerpo += `<img src="${px}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px" />`;
    }

    const resultado = await emailService.enviarCorreo(_db, {
        to,
        subject: subjectLine,
        html: htmlCuerpo,
        empresaId,
        replyTo: replyPreferido,
        attachments: Array.isArray(attachments) && attachments.length ? attachments : undefined,
        appendHtmlWhenNoPdf: String(appendHtmlWhenNoPdf || '').trim(),
    });

    const evento = eventoComunicacion || EVENTO_POR_DISPARADOR[disparadorKey] || disparadorKey;

    if (!resultado.success) {
        if (!skipRegistro && cid) {
            try {
                await registrarComunicacion(_db, empresaId, cid, {
                    tipo: 'email',
                    evento,
                    asunto: subjectLine,
                    plantillaId: plantilla.id,
                    destinatario: to,
                    relacionadoCon: relacionadoCon || null,
                    estado: 'fallido',
                    messageId: null,
                });
            } catch (e) {
                console.warn('[transactionalEmail] registro fallido (envío error):', e.message);
            }
        }
        return { sent: false, reason: resultado.error || 'envio_fallido', plantillaId: plantilla.id };
    }

    let comunicacionId = null;
    if (!skipRegistro && cid) {
        try {
            const reg = await registrarComunicacion(_db, empresaId, cid, {
                tipo: 'email',
                evento,
                asunto: subjectLine,
                plantillaId: plantilla.id,
                destinatario: to,
                relacionadoCon: relacionadoCon || null,
                estado: 'enviado',
                messageId: resultado.messageId || null,
            });
            comunicacionId = reg?.id || null;
        } catch (e) {
            console.warn('[transactionalEmail] registrarComunicacion:', e.message);
        }
    }

    return { sent: true, messageId: resultado.messageId, plantillaId: plantilla.id, comunicacionId };
}

/**
 * Notificación interna (misma plantilla/disparador; destinatario = equipo).
 */
async function enviarNotificacionInterna(_db, empresaId, variables, relacionadoCon) {
    const ctx = await _obtenerEmpresaEmailContext(empresaId);
    const adminTo = (ctx.contactoEmail || '').trim();
    if (!adminTo) return { sent: false, reason: 'sin_email_admin' };
    return enviarPorDisparador(_db, empresaId, 'notificacion_interna', {
        clienteId: null,
        destinatarioOverride: adminTo,
        variables,
        relacionadoCon,
        eventoComunicacion: 'notificacion-interna',
        skipRegistro: true,
    });
}

function _fmtMonedaCLP(v, localeTag = 'es-CL') {
    const loc = localeTag === 'en-US' ? 'en-US' : 'es-CL';
    return new Intl.NumberFormat(loc, { style: 'currency', currency: 'CLP' }).format(v || 0);
}

function _formatearFechaReserva(f, localeTag = 'es-CL') {
    if (!f) return '';
    const en = localeTag === 'en-US';
    const fmt = (dt) => (en
        ? dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : dt.toLocaleDateString('es-CL'));
    if (f instanceof Date) return Number.isNaN(f.getTime()) ? '' : fmt(f);
    const d = new Date(f);
    return Number.isNaN(d.getTime()) ? String(f).slice(0, 10) : fmt(d);
}

function _medioLlegadaEtiqueta(codigo, idiomaPorDefecto) {
    const c = String(codigo || '').trim().toLowerCase();
    if (!c) return '';
    const en = idiomaPorDefecto === 'en';
    const map = en
        ? { auto: 'Car', avion: 'Flight', bus: 'Bus', otro: 'Other' }
        : { auto: 'Automóvil', avion: 'Avión', bus: 'Bus', otro: 'Otro' };
    return map[c] || '';
}

function _docTipoIdentidadEtiqueta(codigo, idiomaPorDefecto) {
    const c = String(codigo || '').trim().toLowerCase();
    if (!c) return '';
    const en = idiomaPorDefecto === 'en';
    const map = en
        ? { rut: 'Chile tax ID (RUT)', pasaporte: 'Passport', dni_otro: 'Other ID' }
        : { rut: 'RUT', pasaporte: 'Pasaporte', dni_otro: 'Otro documento' };
    return map[c] || c;
}

function _armarDatosTransferenciaTexto(datosBancarios) {
    const db = datosBancarios && typeof datosBancarios === 'object' ? datosBancarios : {};
    const lines = [
        db.titular ? `Titular: ${db.titular}` : '',
        db.rut ? `RUT: ${db.rut}` : '',
        db.banco ? `Banco: ${db.banco}` : '',
        db.tipoCuenta ? `Tipo de cuenta: ${db.tipoCuenta}` : '',
        db.numeroCuenta ? `N° cuenta: ${db.numeroCuenta}` : '',
        db.email ? `Email: ${db.email}` : '',
    ].filter(Boolean);
    return lines.join('\n');
}

function _htmlToTextLite(html) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
}

/**
 * Construye variables de plantilla a partir de una fila mínima de reserva + cliente.
 */
async function construirVariablesDesdeReserva(empresaId, row, extras = {}) {
    const ctx = await _obtenerEmpresaEmailContext(empresaId);
    const ws = ctx.configuracion?.websiteSettings || {};
    const bk = ws.booking || {};
    const linkCheckinOnline = String(bk.checkinOnlineUrl || '').trim();
    const linkManualHuesped = String(bk.manualHuespedUrl || '').trim();
    const linkManualHuespedPdf = String(bk.manualHuespedPdfUrl || '').trim();
    const idiomaPorDefecto = ctx.configuracion?.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
    const localeFecha = idiomaPorDefecto === 'en' ? 'en-US' : 'es-CL';
    let clienteNombre = extras.clienteNombre || '';
    if (!clienteNombre && row.cliente_id) {
        try {
            const c = await obtenerClientePorId(null, empresaId, row.cliente_id);
            clienteNombre = c?.nombre || '';
        } catch (_) { /* ignore */ }
    }
    const fechaLlegada = _formatearFechaReserva(row.fecha_llegada, localeFecha);
    const fechaSalida = _formatearFechaReserva(row.fecha_salida, localeFecha);
    const noches = row.total_noches != null ? String(row.total_noches) : '';
    const totalNum = Number(row.valores?.valorHuesped || 0);
    const precio = totalNum > 0 ? _fmtMonedaCLP(totalNum, localeFecha) : '';
    const baseUrl = await obtenerBaseUrlPublica(empresaId);
    const linkResena = extras.linkResena || (extras.tokenResena ? `${baseUrl}/r/${extras.tokenResena}` : '');
    const depositoCfg = resolveDepositoReservaWeb(ctx.configuracion?.websiteSettings?.booking, totalNum);
    const porcentajeAbonoNum = (depositoCfg.tipo === 'monto_fijo' && totalNum > 0)
        ? Math.round((depositoCfg.montoDeposito / totalNum) * 100)
        : depositoCfg.porcentaje;
    const montoAbonoNum = depositoCfg.montoDeposito;
    const montoAbono = montoAbonoNum > 0 ? _fmtMonedaCLP(montoAbonoNum, localeFecha) : '';
    const saldoPendienteNum = totalNum > 0 ? Math.max(0, totalNum - montoAbonoNum) : 0;
    const saldoPendiente = saldoPendienteNum > 0 ? _fmtMonedaCLP(saldoPendienteNum, localeFecha) : '';
    const horasPlazo = depositoCfg.horasLimite;
    const plazo = new Date();
    plazo.setHours(plazo.getHours() + horasPlazo);
    const plazoAbono = idiomaPorDefecto === 'en'
        ? plazo.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : plazo.toLocaleString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const datosTransferencia = _armarDatosTransferenciaTexto(ctx.configuracion?.datosBancarios);
    const depositoNota = _htmlToTextLite(ctx.configuracion?.websiteSettings?.booking?.depositoNotaHtml);
    const linkPago = '';
    const horaLlegadaEstimada = extras.horaLlegadaEstimada != null
        ? String(extras.horaLlegadaEstimada).trim().slice(0, 120)
        : '';
    const rawMedio = extras.medioLlegada != null
        ? String(extras.medioLlegada).trim().toLowerCase().replace(/\s+/g, '')
        : '';
    const medioLlegada = ['auto', 'avion', 'bus', 'otro'].includes(rawMedio) ? rawMedio : '';
    const referenciaTransporte = extras.referenciaTransporte != null
        ? String(extras.referenciaTransporte).trim().slice(0, 100)
        : '';
    const documentoRefViajero = extras.documentoRefViajero != null
        ? String(extras.documentoRefViajero).replace(/[^A-Za-z0-9]/g, '').slice(0, 10)
        : '';
    const medioLlegadaTexto = _medioLlegadaEtiqueta(medioLlegada, idiomaPorDefecto);
    const comentariosHuesped = extras.comentariosHuesped != null
        ? String(extras.comentariosHuesped).trim().slice(0, 2000)
        : '';

    const ci = extras.checkInIdentidad && typeof extras.checkInIdentidad === 'object'
        ? extras.checkInIdentidad
        : null;
    const documentoTipoCodigo = ci ? String(ci.documentoTipo || '').trim().toLowerCase() : '';
    const documentoNumeroCompleto = ci ? String(ci.documentoNumero || '').trim() : '';
    const documentoNumeroEnmascarado = documentoNumeroCompleto
        ? enmascararDocumentoParaUiPublica(documentoNumeroCompleto)
        : '';
    const documentoTipoEtiqueta = documentoTipoCodigo
        ? _docTipoIdentidadEtiqueta(documentoTipoCodigo, idiomaPorDefecto)
        : '';
    const nacionalidadHuespedCheckin = ci && ci.nacionalidad != null
        ? String(ci.nacionalidad).trim().slice(0, 50)
        : '';
    const fechaNacimientoHuespedCheckin = ci && ci.fechaNacimiento != null
        ? String(ci.fechaNacimiento).trim().slice(0, 12)
        : '';

    const cia = extras.checkInIdentidadAceptacion && typeof extras.checkInIdentidadAceptacion === 'object'
        ? extras.checkInIdentidadAceptacion
        : null;
    const checkinIdentidadAceptadoAt = cia && cia.aceptadoAt != null
        ? String(cia.aceptadoAt).trim().slice(0, 32)
        : '';
    const checkinIdentidadPoliticaVersion = cia && cia.politicaVersion != null
        ? String(cia.politicaVersion).trim().slice(0, 80)
        : '';
    const consentimientoIdentidadLinea = checkinIdentidadAceptadoAt
        ? (idiomaPorDefecto === 'en'
            ? `Consent for identity data (check-in): ${checkinIdentidadAceptadoAt.slice(0, 19).replace('T', ' ')}${checkinIdentidadPoliticaVersion ? ` · ${checkinIdentidadPoliticaVersion}` : ''}`
            : `Consentimiento datos identidad (check-in): ${checkinIdentidadAceptadoAt.slice(0, 19).replace('T', ' ')}${checkinIdentidadPoliticaVersion ? ` · ${checkinIdentidadPoliticaVersion}` : ''}`)
        : '';

    let listaIdentidadAcompanantes = '';
    const accRaw = extras.checkInIdentidadAcompanantes;
    if (Array.isArray(accRaw) && accRaw.length) {
        const lines = accRaw.map((a, idx) => {
            const t = String(a.documentoTipo || '').trim().toLowerCase();
            const num = String(a.documentoNumero || '').trim();
            if (!t || !num) return '';
            const mask = enmascararDocumentoParaUiPublica(num);
            const tl = _docTipoIdentidadEtiqueta(t, idiomaPorDefecto);
            return idiomaPorDefecto === 'en'
                ? `Guest ${idx + 2}: ${tl} ${mask}`
                : `Huésped ${idx + 2}: ${tl} ${mask}`;
        }).filter(Boolean);
        listaIdentidadAcompanantes = lines.join('\n');
    }
    const resumenTotalPrefix = idiomaPorDefecto === 'en' ? 'Total amount' : 'Total';

    return {
        reservaId: String(row.id_reserva_canal || row.id || ''),
        propuestaId: String(row.id_reserva_canal || row.id || ''),
        clienteNombre,
        nombreCliente: clienteNombre,
        fechaLlegada,
        fechaSalida,
        fechasEstadiaTexto: idiomaPorDefecto === 'en' ? `${fechaLlegada} to ${fechaSalida}` : `${fechaLlegada} al ${fechaSalida}`,
        totalNoches: noches,
        noches,
        personas: String(row.cantidad_huespedes || ''),
        numeroHuespedes: String(row.cantidad_huespedes || ''),
        nombrePropiedad: row.alojamiento_nombre || '',
        propiedadesNombres: row.alojamiento_nombre || '',
        detallePropiedades: row.alojamiento_nombre ? `• ${row.alojamiento_nombre}` : '',
        precioFinal: precio,
        montoTotal: precio,
        saldoPendiente: saldoPendiente || precio,
        resumenValores: precio ? `${resumenTotalPrefix}: ${precio}` : '',
        porcentajeAbono: depositoCfg.activo ? `${porcentajeAbonoNum}%` : '0%',
        montoAbono,
        plazoAbono,
        datosBancarios: datosTransferencia,
        datosBancariosTexto: datosTransferencia,
        depositoNota,
        notaDeposito: depositoNota,
        linkPago,
        urlPago: linkPago,
        empresaGoogleMapsLink: ctx.configuracion?.google_maps_url || '',
        empresaNombre: ctx.nombre,
        empresaWebsite: ctx.website,
        contactoNombre: ctx.contactoNombre,
        contactoEmail: ctx.contactoEmail,
        contactoTelefono: ctx.contactoTelefono,
        usuarioNombre: ctx.contactoNombre,
        usuarioEmail: ctx.contactoEmail,
        usuarioTelefono: ctx.contactoTelefono,
        fechaEmision: idiomaPorDefecto === 'en'
            ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : new Date().toLocaleDateString('es-CL'),
        idiomaPorDefecto,
        localeFecha,
        htmlLang: idiomaPorDefecto === 'en' ? 'en' : 'es',
        linkResena,
        LINK_RESEÑA: linkResena,
        linkCheckinOnline,
        linkManualHuesped,
        linkManualHuespedPdf,
        LINK_CHECKIN_ONLINE: linkCheckinOnline,
        LINK_MANUAL_HUESPED: linkManualHuesped,
        LINK_MANUAL_HUESPED_PDF: linkManualHuespedPdf,
        horaLlegadaEstimada,
        HORA_LLEGADA_ESTIMADA: horaLlegadaEstimada,
        medioLlegada,
        medioLlegadaTexto,
        MEDIO_LLEGADA: medioLlegada,
        MEDIO_LLEGADA_TEXTO: medioLlegadaTexto,
        referenciaTransporte,
        REFERENCIA_TRANSPORTE: referenciaTransporte,
        documentoRefViajero,
        DOC_REF_VIAJERO: documentoRefViajero,
        comentariosHuesped,
        NOTAS_HUESPED_CHECKOUT: comentariosHuesped,
        checkInIdentidad: ci || null,
        documentoTipoCodigo,
        documentoTipoEtiqueta,
        DOC_TIPO_CODIGO: documentoTipoCodigo,
        DOC_TIPO_ETIQUETA: documentoTipoEtiqueta,
        documentoNumeroCompleto,
        documentoNumeroEnmascarado,
        DOC_NUMERO_COMPLETO: documentoNumeroCompleto,
        DOC_NUMERO_ENMASCARADO: documentoNumeroEnmascarado,
        nacionalidadHuespedCheckin,
        NACIONALIDAD_HUESPED_CHECKIN: nacionalidadHuespedCheckin,
        fechaNacimientoHuespedCheckin,
        FECHA_NACIMIENTO_HUESPED_CHECKIN: fechaNacimientoHuespedCheckin,
        checkInIdentidadAceptacion: cia,
        checkinIdentidadAceptadoAt,
        CHECKIN_IDENTIDAD_ACEPTADO_AT: checkinIdentidadAceptadoAt,
        checkinIdentidadPoliticaVersion,
        CHECKIN_IDENTIDAD_POLITICA_VERSION: checkinIdentidadPoliticaVersion,
        consentimientoIdentidadLinea,
        CONSENTIMIENTO_IDENTIDAD_LINEA: consentimientoIdentidadLinea,
        listaIdentidadAcompanantes,
        LISTA_IDENTIDAD_ACOMPANANTES: listaIdentidadAcompanantes,
        mensajeConsulta: extras.mensajeConsulta || '',
        MENSAJE_CONSULTA: extras.mensajeConsulta || '',
        asuntoConsultaUsuario: extras.asuntoConsultaUsuario || '',
        CONSULTA_ASUNTO_USUARIO: extras.asuntoConsultaUsuario || '',
    };
}

/** @param {string} nombreEstado @param {string|null} [semanticaPrincipal] — desde `estados_reserva` si se resolvió */
function esEstadoCancelacion(nombreEstado, semanticaPrincipal) {
    return esEstadoPrincipalCancelacionSync(nombreEstado, semanticaPrincipal);
}

module.exports = {
    /** @deprecated usar DISPARADOR_KEYS desde plantillasService */
    DISPARADOR_DB_KEYS: DISPARADOR_KEYS,
    DISPARADOR_KEYS,
    EVENTO_POR_DISPARADOR,
    obtenerPlantillaPorDisparador,
    obtenerPlantillaActivaPorId,
    enviarPorDisparador,
    enviarNotificacionInterna,
    obtenerBaseUrlPublica,
    resolverLinkResenaOutbound,
    construirVariablesDesdeReserva,
    esEstadoCancelacion,
};
