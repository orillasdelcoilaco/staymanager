// backend/services/comunicacionesRetryService.js
// Reenvío manual desde bandeja (1.1): reserva, propuesta, o email fallido sin relación de reserva (plantilla / disparador).
const pool = require('../db/postgres');
const { sqlReservaPrincipalSemanticaIgual } = require('./estadosService');
const emailService = require('./emailService');
const { procesarPlantilla } = require('./plantillasService');
const { obtenerClientePorId } = require('./clientesService');
const {
    obtenerComunicacionPorId,
    marcarComunicacionReintentoExitoso,
} = require('./comunicacionesService');
const {
    enviarPorDisparador,
    construirVariablesDesdeReserva,
    obtenerBaseUrlPublica,
} = require('./transactionalEmailService');
const { generarTokenParaReserva } = require('./resenasService');

/** Evento en `comunicaciones` → disparador motor PG (misma clave que transactionalEmailService). */
const EVENTO_A_DISPARADOR = Object.freeze({
    'reserva-confirmada': 'reserva_confirmada',
    'reserva-cancelada': 'reserva_cancelada',
    'reserva-modificada': 'reserva_modificada',
    'recordatorio-pre-llegada': 'recordatorio_pre_llegada',
    'evaluacion-pendiente': 'post_estadia_evaluacion',
    'consulta-web-publica': 'consulta_contacto',
});

/** Eventos cuyo rearmado depende de una fila de reserva en PG (no aplica sin `relacion_tipo`/`id` reserva). */
const EVENTOS_REINTENTO_EXIGEN_RESERVA_PG = new Set([
    'reserva-confirmada',
    'reserva-cancelada',
    'reserva-modificada',
    'recordatorio-pre-llegada',
    'evaluacion-pendiente',
]);

async function _cargarReservaPorRelacionId(empresaId, relacionId) {
    const rid = String(relacionId || '').trim();
    if (!rid) return null;
    const { rows } = await pool.query(
        `SELECT r.id, r.id_reserva_canal, r.cliente_id, r.alojamiento_nombre, r.fecha_llegada, r.fecha_salida,
                r.total_noches, r.cantidad_huespedes, r.valores, r.propiedad_id, r.estado
         FROM reservas r
         WHERE r.empresa_id = $1
           AND (r.id::text = $2 OR COALESCE(r.id_reserva_canal::text, '') = $2)
         LIMIT 1`,
        [empresaId, rid]
    );
    return rows[0] || null;
}

async function _obtenerDatosEmpresaLight(empresaId) {
    const { rows } = await pool.query('SELECT nombre, configuracion FROM empresas WHERE id = $1', [empresaId]);
    if (!rows[0]) return {};
    return { nombre: rows[0].nombre, ...(rows[0].configuracion || {}) };
}

async function _cargarFilasPropuesta(empresaId, relacionId) {
    const rid = String(relacionId || '').trim();
    if (!rid) return [];
    const { rows } = await pool.query(
        `SELECT r.id, r.id_reserva_canal, r.cliente_id, r.alojamiento_nombre, r.fecha_llegada, r.fecha_salida,
                r.total_noches, r.cantidad_huespedes, r.valores, r.propiedad_id, r.estado, r.valor_dolar_dia, r.metadata
         FROM reservas r
         WHERE r.empresa_id = $1
           AND ${sqlReservaPrincipalSemanticaIgual('propuesta')}
           AND (r.id_reserva_canal::text = $2 OR r.id::text = $2)
         ORDER BY r.id`,
        [empresaId, rid]
    );
    return rows;
}

function _formatearFechaProp(f, localeTag = 'es-CL') {
    const en = localeTag === 'en-US';
    const optsDate = en
        ? { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }
        : { timeZone: 'UTC' };
    if (!f) return '';
    if (f instanceof Date) {
        return Number.isNaN(f.getTime()) ? '' : f.toLocaleDateString(en ? 'en-US' : 'es-CL', optsDate);
    }
    const s = String(f).slice(0, 10);
    try {
        const d = new Date(`${s}T00:00:00Z`);
        return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(en ? 'en-US' : 'es-CL', optsDate);
    } catch {
        return s;
    }
}

function _fmtMonedaCLP(v, localeTag = 'es-CL') {
    const loc = localeTag === 'en-US' ? 'en-US' : 'es-CL';
    return new Intl.NumberFormat(loc, { style: 'currency', currency: 'CLP' }).format(v || 0);
}

async function _variablesParaPropuestaRetry(empresaId, rows, cliente, propuestaId) {
    const empresaData = await _obtenerDatosEmpresaLight(empresaId);
    const idiomaPorDefecto = empresaData?.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
    const localeFecha = idiomaPorDefecto === 'en' ? 'en-US' : 'es-CL';
    const primera = rows[0];
    const propiedades = rows.map((r) => ({ nombre: r.alojamiento_nombre }));
    const nombresPropiedades = propiedades.map((p) => p.nombre).filter(Boolean).join(', ');
    const precioSuma = rows.reduce((s, r) => s + (Number(r.valores?.valorHuesped) || 0), 0);
    const dolar = Number(primera.valor_dolar_dia) || 1;
    const precioFinal = precioSuma * dolar;
    let meta = primera.metadata || {};
    if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch { meta = {}; }
    }
    const linkPago = String(meta?.linkPago || '').trim();
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
    const fvDate = idiomaPorDefecto === 'en'
        ? fechaVencimiento.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : fechaVencimiento.toLocaleDateString('es-CL');
    const fvTime = fechaVencimiento.toLocaleTimeString(idiomaPorDefecto === 'en' ? 'en-US' : 'es-CL', { hour: '2-digit', minute: '2-digit' });
    const montoAbono = precioFinal ? precioFinal * 0.5 : 0;
    const personas = rows.reduce((s, r) => s + (Number(r.cantidad_huespedes) || 0), 0) || (Number(primera.cantidad_huespedes) || 0);
    const noches = primera.total_noches;

    return {
        propuestaId,
        reservaId: propuestaId,
        clienteNombre: cliente.nombre,
        nombreCliente: cliente.nombre,
        fechaEmision: idiomaPorDefecto === 'en'
            ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : new Date().toLocaleDateString('es-CL'),
        fechaLlegada: _formatearFechaProp(primera.fecha_llegada, localeFecha),
        fechaSalida: _formatearFechaProp(primera.fecha_salida, localeFecha),
        fechasEstadiaTexto: idiomaPorDefecto === 'en'
            ? `${_formatearFechaProp(primera.fecha_llegada, localeFecha)} to ${_formatearFechaProp(primera.fecha_salida, localeFecha)}`
            : `${_formatearFechaProp(primera.fecha_llegada, localeFecha)} al ${_formatearFechaProp(primera.fecha_salida, localeFecha)}`,
        fechaVencimiento: idiomaPorDefecto === 'en'
            ? `${fvDate} at ${fvTime}`
            : `${fvDate} a las ${fvTime}`,
        noches: noches != null ? String(noches) : '',
        totalNoches: noches != null ? String(noches) : '',
        personas: String(personas),
        numeroHuespedes: String(personas),
        nombrePropiedad: nombresPropiedades,
        propiedadesNombres: nombresPropiedades,
        detallePropiedades: propiedades.map((p) => `• ${p.nombre}`).join('\n'),
        precioFinal: _fmtMonedaCLP(precioFinal, localeFecha),
        saldoPendiente: _fmtMonedaCLP(precioFinal, localeFecha),
        montoTotal: _fmtMonedaCLP(precioFinal, localeFecha),
        resumenValores: `Total: ${_fmtMonedaCLP(precioFinal, localeFecha)}`,
        porcentajeAbono: '50%',
        montoAbono: _fmtMonedaCLP(montoAbono, localeFecha),
        idiomaPorDefecto,
        localeFecha,
        htmlLang: idiomaPorDefecto === 'en' ? 'en' : 'es',
        empresaNombre: empresaData?.nombre || '',
        empresaWebsite: empresaData?.website || '',
        contactoNombre: empresaData?.contactoNombre || '',
        usuarioNombre: empresaData?.contactoNombre || '',
        contactoEmail: empresaData?.contactoEmail || '',
        usuarioEmail: empresaData?.contactoEmail || '',
        contactoTelefono: empresaData?.contactoTelefono || '',
        usuarioTelefono: empresaData?.contactoTelefono || '',
        linkPago,
    };
}

async function _variablesMinimasClienteMotor(empresaId, clienteId, clienteNombre, evento) {
    const base = await construirVariablesDesdeReserva(empresaId, {
        alojamiento_nombre: '',
        fecha_llegada: null,
        fecha_salida: null,
        total_noches: null,
        cantidad_huespedes: null,
        valores: {},
        id_reserva_canal: null,
        id: null,
        cliente_id: clienteId,
    }, { clienteNombre: clienteNombre || 'Huésped' });
    if (evento === 'consulta-web-publica') {
        const isEn = base.idiomaPorDefecto === 'en';
        const hint = isEn
            ? '(Retry) The original inquiry message is not available here; contact the guest if you need full details.'
            : '(Reintento) El texto original de la consulta no está disponible aquí; contacte al huésped si necesita el detalle.';
        const subjectRetry = isEn
            ? 'Website inquiry (retry)'
            : 'Consulta desde la web (reintento)';
        return {
            ...base,
            mensajeConsulta: hint,
            MENSAJE_CONSULTA: hint,
            asuntoConsultaUsuario: subjectRetry,
            CONSULTA_ASUNTO_USUARIO: subjectRetry,
        };
    }
    return base;
}

async function _variablesParaEvaluacionRetry(empresaId, rowSnake, clienteNombre) {
    const { rows: empRows } = await pool.query(
        'SELECT configuracion FROM empresas WHERE id = $1',
        [empresaId]
    );
    const cfg = empRows[0]?.configuracion || {};
    const ext = String(cfg.emailAutomations?.evaluacionPostEstadia?.urlResenaExterna || '').trim();
    const token = await generarTokenParaReserva(
        empresaId,
        String(rowSnake.id),
        rowSnake.propiedad_id,
        clienteNombre
    );
    const baseUrl = await obtenerBaseUrlPublica(empresaId);
    const link = (ext && /^https?:\/\//i.test(ext)) ? ext : `${baseUrl}/r/${token}?ref=email`;
    return construirVariablesDesdeReserva(empresaId, rowSnake, { clienteNombre, linkResena: link });
}

/**
 * Reintenta un email fallido. Actualiza la misma fila a `enviado` si el reenvío tiene éxito.
 * @returns {{ ok: true, messageId?: string }}
 */
async function reintentarComunicacionEmail(_db, empresaId, comunicacionId) {
    const c = await obtenerComunicacionPorId(null, empresaId, comunicacionId);
    if (!c) {
        const e = new Error('Comunicación no encontrada.');
        e.code = 'NOT_FOUND';
        throw e;
    }
    if (c.estado !== 'fallido') {
        const e = new Error('Solo se pueden reintentar envíos en estado fallido.');
        e.code = 'BAD_STATE';
        throw e;
    }
    if (c.tipo !== 'email') {
        const e = new Error('Por ahora solo se admite reintento de correos email.');
        e.code = 'BAD_TYPE';
        throw e;
    }
    if (!c.clienteId) {
        const e = new Error('La comunicación no tiene cliente asociado.');
        e.code = 'NO_CLIENTE';
        throw e;
    }
    const relTipo = String(c.relacionTipo || '').trim().toLowerCase();
    const relId = String(c.relacionId || '').trim();

    const cliente = await obtenerClientePorId(null, empresaId, c.clienteId);
    const nombreCli = (cliente?.nombre || '').trim() || 'Huésped';

    if (EVENTOS_REINTENTO_EXIGEN_RESERVA_PG.has(c.evento) && (relTipo !== 'reserva' || !relId)) {
        const e = new Error('Este envío está ligado a una reserva; no se puede reintentar sin esa relación en el registro.');
        e.code = 'NO_RESERVA_CONTEXT';
        throw e;
    }

    // --- Rama reserva (comportamiento original) ---
    if (relTipo === 'reserva' && relId) {
        const reservaRow = await _cargarReservaPorRelacionId(empresaId, relId);
        if (!reservaRow) {
            const e = new Error('No se encontró la reserva vinculada; no se puede rearmar el correo.');
            e.code = 'RESERVA_NOT_FOUND';
            throw e;
        }

        const disparador = EVENTO_A_DISPARADOR[c.evento];
        let variables;
        if (c.evento === 'evaluacion-pendiente') {
            variables = await _variablesParaEvaluacionRetry(empresaId, reservaRow, nombreCli);
        } else {
            variables = await construirVariablesDesdeReserva(empresaId, reservaRow, { clienteNombre: nombreCli });
        }

        const relacionadoCon = {
            tipo: 'reserva',
            id: String(reservaRow.id_reserva_canal || reservaRow.id),
        };

        if (disparador) {
            const r = await enviarPorDisparador(null, empresaId, disparador, {
                clienteId: c.clienteId,
                variables,
                relacionadoCon,
                eventoComunicacion: c.evento,
                skipRegistro: true,
            });
            if (!r.sent) {
                const e = new Error(r.reason === 'correos_automaticos_desactivados'
                    ? 'Los correos automáticos al huésped están desactivados en configuración de la empresa.'
                    : (r.reason === 'sin_email' ? 'El cliente no tiene email.' : (r.reason || 'No se pudo reenviar')));
                e.code = 'SEND_FAILED';
                throw e;
            }
            await marcarComunicacionReintentoExitoso(null, empresaId, comunicacionId, r.messageId || null);
            return { ok: true, messageId: r.messageId || null };
        }

        if (!c.plantillaId) {
            const e = new Error('No hay disparador reconocido para este evento ni plantilla guardada; no se puede reintentar.');
            e.code = 'NO_STRATEGY';
            throw e;
        }

        const toRes = (c.destinatario || cliente?.email || '').trim();
        if (!toRes) {
            const e = new Error('No hay destinatario de correo.');
            e.code = 'NO_DEST';
            throw e;
        }

        const { contenido, asunto } = await procesarPlantilla(null, empresaId, c.plantillaId, variables);
        const resultado = await emailService.enviarCorreo(null, {
            to: toRes,
            subject: asunto,
            html: contenido,
            empresaId,
        });
        if (!resultado.success) {
            const e = new Error(resultado.error || 'Error al reenviar');
            e.code = 'SEND_FAILED';
            throw e;
        }
        await marcarComunicacionReintentoExitoso(null, empresaId, comunicacionId, resultado.messageId || null);
        return { ok: true, messageId: resultado.messageId || null };
    }

    // --- Rama propuesta ---
    if (relTipo === 'propuesta' && relId) {
        if (!c.plantillaId) {
            const e = new Error('No hay plantilla asociada al envío de propuesta; no se puede reintentar.');
            e.code = 'NO_STRATEGY';
            throw e;
        }
        const filas = await _cargarFilasPropuesta(empresaId, relId);
        if (!filas.length) {
            const e = new Error('No se encontró la propuesta en estado borrador; no se puede rearmar el correo.');
            e.code = 'PROPUESTA_NOT_FOUND';
            throw e;
        }
        if (String(filas[0].cliente_id) !== String(c.clienteId)) {
            const e = new Error('La propuesta no corresponde al cliente de esta comunicación.');
            e.code = 'CLIENTE_MISMATCH';
            throw e;
        }
        const variables = await _variablesParaPropuestaRetry(empresaId, filas, cliente, relId);
        const toPr = (c.destinatario || cliente?.email || '').trim();
        if (!toPr) {
            const e = new Error('No hay destinatario de correo.');
            e.code = 'NO_DEST';
            throw e;
        }
        const { contenido, asunto } = await procesarPlantilla(null, empresaId, c.plantillaId, variables);
        const resultado = await emailService.enviarCorreo(null, {
            to: toPr,
            subject: asunto,
            html: contenido,
            empresaId,
        });
        if (!resultado.success) {
            const e = new Error(resultado.error || 'Error al reenviar');
            e.code = 'SEND_FAILED';
            throw e;
        }
        await marcarComunicacionReintentoExitoso(null, empresaId, comunicacionId, resultado.messageId || null);
        return { ok: true, messageId: resultado.messageId || null };
    }

    // --- Sin relación reserva / propuesta: disparador o plantilla guardada ---
    const disparadorGen = EVENTO_A_DISPARADOR[c.evento];
    if (disparadorGen && !EVENTOS_REINTENTO_EXIGEN_RESERVA_PG.has(c.evento)) {
        const variables = await _variablesMinimasClienteMotor(empresaId, c.clienteId, nombreCli, c.evento);
        const relOk = relTipo && relId ? { tipo: c.relacionTipo, id: relId } : null;
        const r = await enviarPorDisparador(null, empresaId, disparadorGen, {
            clienteId: c.clienteId,
            variables,
            relacionadoCon: relOk,
            eventoComunicacion: c.evento,
            skipRegistro: true,
        });
        if (!r.sent) {
            const e = new Error(r.reason === 'correos_automaticos_desactivados'
                ? 'Los correos automáticos al huésped están desactivados en configuración de la empresa.'
                : (r.reason === 'sin_email' ? 'El cliente no tiene email.' : (r.reason || 'No se pudo reenviar')));
            e.code = 'SEND_FAILED';
            throw e;
        }
        await marcarComunicacionReintentoExitoso(null, empresaId, comunicacionId, r.messageId || null);
        return { ok: true, messageId: r.messageId || null };
    }

    if (!c.plantillaId) {
        const e = new Error('No hay disparador reconocido para este evento ni plantilla guardada; no se puede reintentar.');
        e.code = 'NO_STRATEGY';
        throw e;
    }

    const to = (c.destinatario || cliente?.email || '').trim();
    if (!to) {
        const e = new Error('No hay destinatario de correo.');
        e.code = 'NO_DEST';
        throw e;
    }

    const variablesPl = await _variablesMinimasClienteMotor(empresaId, c.clienteId, nombreCli, c.evento);
    const { contenido, asunto } = await procesarPlantilla(null, empresaId, c.plantillaId, variablesPl);
    const resultado = await emailService.enviarCorreo(null, {
        to,
        subject: asunto,
        html: contenido,
        empresaId,
    });
    if (!resultado.success) {
        const e = new Error(resultado.error || 'Error al reenviar');
        e.code = 'SEND_FAILED';
        throw e;
    }
    await marcarComunicacionReintentoExitoso(null, empresaId, comunicacionId, resultado.messageId || null);
    return { ok: true, messageId: resultado.messageId || null };
}

const MAX_REINTENTO_LOTE = 25;

/**
 * Reintenta varias comunicaciones (mismas reglas que una a una). Errores por ítem no abortan el lote.
 * @param {string[]} idsRaw
 * @returns {{ results: { id: string, ok: boolean, error?: string, code?: string }[], okCount: number, failCount: number, total: number }}
 */
async function reintentarComunicacionesEmailLote(_db, empresaId, idsRaw) {
    const ids = [...new Set((Array.isArray(idsRaw) ? idsRaw : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean))].slice(0, MAX_REINTENTO_LOTE);
    if (!ids.length) {
        const e = new Error('Indica al menos un id de comunicación.');
        e.code = 'EMPTY';
        throw e;
    }
    const results = [];
    let okCount = 0;
    let failCount = 0;
    for (const id of ids) {
        try {
            await reintentarComunicacionEmail(_db, empresaId, id);
            results.push({ id, ok: true });
            okCount += 1;
        } catch (err) {
            results.push({
                id,
                ok: false,
                error: err.message || 'Error',
                code: err.code || null,
            });
            failCount += 1;
        }
    }
    return { results, okCount, failCount, total: ids.length };
}

module.exports = {
    reintentarComunicacionEmail,
    reintentarComunicacionesEmailLote,
    EVENTO_A_DISPARADOR,
    MAX_REINTENTO_LOTE,
};
