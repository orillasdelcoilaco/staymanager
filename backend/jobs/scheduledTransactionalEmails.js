// backend/jobs/scheduledTransactionalEmails.js
// Recordatorios pre-llegada, evaluación post-estancia y digest operación (correo interno).
const { differenceInCalendarDays, startOfDay } = require('date-fns');
const pool = require('../db/postgres');
const emailService = require('../services/emailService');
const {
    enviarPorDisparador,
    construirVariablesDesdeReserva,
    obtenerBaseUrlPublica,
    resolverLinkResenaOutbound,
} = require('../services/transactionalEmailService');
const { sendDigestPushToEmpresa } = require('../services/webPushDigestService');
const { generarTokenParaReserva } = require('../services/resenasService');
const {
    sqlReservaPrincipalSemanticaIgual,
    sqlReservaPrincipalSemanticaEn,
} = require('../services/estadosService');
const { extrasCheckoutWebDesdeReservaMetadata } = require('../services/transactionalEmailHooks');

const INTERVAL_MS = parseInt(process.env.SCHEDULED_EMAIL_INTERVAL_MS || '', 10) || 6 * 60 * 60 * 1000;

function _evalCfg(configuracion) {
    const em = (configuracion && configuracion.emailAutomations) || {};
    const ev = em.evaluacionPostEstadia || {};
    const rawTpl = Array.isArray(ev.plantillasPorIntento) ? ev.plantillasPorIntento : [];
    return {
        diasTrasCheckout: Array.isArray(ev.diasTrasCheckout) && ev.diasTrasCheckout.length
            ? ev.diasTrasCheckout.map((n) => parseInt(n, 10)).filter((x) => x > 0)
            : [1, 3, 7, 14],
        maxIntentos: Math.min(8, Math.max(1, parseInt(ev.maxIntentos, 10) || 4)),
        ventanaDias: Math.min(60, Math.max(7, parseInt(ev.ventanaDias, 10) || 30)),
        urlResenaExterna: String(ev.urlResenaExterna || '').trim(),
        plantillasPorIntento: rawTpl.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8),
        pixelAperturaActivo: ev.pixelAperturaActivo !== false,
    };
}

async function _countComunicaciones(empresaId, clienteId, evento, relacionId) {
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM comunicaciones
         WHERE empresa_id = $1 AND cliente_id = $2 AND evento = $3
           AND relacion_tipo = 'reserva' AND relacion_id = $4`,
        [empresaId, clienteId, evento, relacionId]
    );
    return rows[0]?.n || 0;
}

async function _yaEnviadoHoy(empresaId, clienteId, evento, relacionId) {
    const { rows } = await pool.query(
        `SELECT 1 FROM comunicaciones
         WHERE empresa_id = $1 AND cliente_id = $2 AND evento = $3
           AND relacion_tipo = 'reserva' AND relacion_id = $4
           AND created_at::date = CURRENT_DATE
         LIMIT 1`,
        [empresaId, clienteId, evento, relacionId]
    );
    return Boolean(rows[0]);
}

async function runRecordatoriosPreLlegada() {
    if (!pool) return;
    const { rows } = await pool.query(
        `SELECT r.id, r.empresa_id, r.cliente_id, r.id_reserva_canal, r.alojamiento_nombre, r.propiedad_id,
                r.fecha_llegada, r.fecha_salida, r.total_noches, r.cantidad_huespedes, r.valores, r.metadata
         FROM reservas r
         WHERE ${sqlReservaPrincipalSemanticaIgual('confirmada')}
           AND r.cliente_id IS NOT NULL
           AND r.fecha_llegada::date = (CURRENT_DATE + INTERVAL '1 day')::date
         LIMIT 300`
    );
    for (const row of rows) {
        const relId = String(row.id_reserva_canal || row.id);
        if (await _yaEnviadoHoy(row.empresa_id, row.cliente_id, 'recordatorio-pre-llegada', relId)) continue;
        const linkRv = await resolverLinkResenaOutbound(row.empresa_id, {
            reservaRef: row.id,
            nombreHuesped: '',
            refQuery: 'prellegada',
            propiedadIdFallback: row.propiedad_id,
        });
        const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const vars = await construirVariablesDesdeReserva(row.empresa_id, row, {
            ...(linkRv ? { linkResena: linkRv } : {}),
            ...extrasCheckoutWebDesdeReservaMetadata(meta),
        });
        await enviarPorDisparador(null, row.empresa_id, 'recordatorio_pre_llegada', {
            clienteId: row.cliente_id,
            variables: vars,
            relacionadoCon: { tipo: 'reserva', id: relId },
        }).catch((e) => console.warn('[job pre-llegada]', e.message));
    }
}

async function runPostEstadiaEvaluacion() {
    if (!pool) return;
    const { rows } = await pool.query(
        `SELECT r.id, r.empresa_id, r.cliente_id, r.propiedad_id, r.alojamiento_nombre,
                r.fecha_llegada, r.fecha_salida, r.total_noches, r.cantidad_huespedes, r.valores, r.id_reserva_canal
         FROM reservas r
         JOIN clientes c ON c.id = r.cliente_id AND c.empresa_id = r.empresa_id
         WHERE ${sqlReservaPrincipalSemanticaIgual('confirmada')}
           AND r.cliente_id IS NOT NULL
           AND COALESCE(c.bloqueado, false) = false
           AND COALESCE(c.metadata->>'noContactarEvaluacion', '') <> 'true'
           AND r.fecha_salida::date < CURRENT_DATE
           AND NOT EXISTS (
               SELECT 1 FROM resenas rv
               WHERE rv.empresa_id = r.empresa_id
                 AND rv.reserva_id = r.id::text
                 AND rv.punt_general IS NOT NULL
           )
         LIMIT 400`
    );

    for (const row of rows) {
        try {
            const { rows: empRows } = await pool.query(
                'SELECT configuracion FROM empresas WHERE id = $1',
                [row.empresa_id]
            );
            const cfg = _evalCfg(empRows[0]?.configuracion || {});
            const salida = startOfDay(row.fecha_salida instanceof Date ? row.fecha_salida : new Date(row.fecha_salida));
            const hoy = startOfDay(new Date());
            const diasDesde = differenceInCalendarDays(hoy, salida);
            if (diasDesde < 1 || diasDesde > cfg.ventanaDias) continue;

            const relId = String(row.id);
            const enviados = await _countComunicaciones(row.empresa_id, row.cliente_id, 'evaluacion-pendiente', relId);
            if (enviados >= cfg.maxIntentos) continue;
            const siguienteDia = cfg.diasTrasCheckout[enviados];
            if (!siguienteDia || diasDesde < siguienteDia) continue;
            if (await _yaEnviadoHoy(row.empresa_id, row.cliente_id, 'evaluacion-pendiente', relId)) continue;

            const nombreCli = (await pool.query('SELECT nombre FROM clientes WHERE id = $1 AND empresa_id = $2', [row.cliente_id, row.empresa_id])).rows[0]?.nombre || '';
            const token = await generarTokenParaReserva(
                row.empresa_id,
                String(row.id),
                row.propiedad_id,
                nombreCli
            );
            const baseUrl = await obtenerBaseUrlPublica(row.empresa_id);
            const ext = cfg.urlResenaExterna;
            const link = (ext && /^https?:\/\//i.test(ext))
                ? ext
                : `${baseUrl}/r/${token}?ref=email`;
            const vars = await construirVariablesDesdeReserva(row.empresa_id, row, {
                clienteNombre: nombreCli,
                linkResena: link,
            });
            const tplIdx = cfg.plantillasPorIntento[enviados] || '';
            const openUrl = cfg.pixelAperturaActivo
                ? `${baseUrl}/r/${encodeURIComponent(token)}/open.gif`
                : null;
            await enviarPorDisparador(null, row.empresa_id, 'post_estadia_evaluacion', {
                clienteId: row.cliente_id,
                variables: vars,
                relacionadoCon: { tipo: 'reserva', id: relId },
                eventoComunicacion: 'evaluacion-pendiente',
                plantillaIdOverride: tplIdx || undefined,
                openPixelUrl: openUrl || undefined,
            }).catch((e) => console.warn('[job eval]', e.message));
        } catch (e) {
            console.warn('[job eval] fila:', e.message);
        }
    }
}

/** Métricas del digest operación diario para una empresa (multi-tenant: solo $1). */
async function queryMetricasDigestOperacion(empresaId) {
    if (!pool) return null;
    const { rows: st } = await pool.query(
        `SELECT
            (SELECT COUNT(*)::int FROM reservas r
             WHERE r.empresa_id = $1 AND ${sqlReservaPrincipalSemanticaIgual('confirmada')} AND r.fecha_llegada::date = CURRENT_DATE) AS n_lleg,
            (SELECT COUNT(*)::int FROM reservas r
             WHERE r.empresa_id = $1 AND ${sqlReservaPrincipalSemanticaIgual('confirmada')} AND r.fecha_salida::date = CURRENT_DATE) AS n_sal,
            (SELECT COUNT(*)::int FROM reservas r
             WHERE r.empresa_id = $1 AND ${sqlReservaPrincipalSemanticaIgual('propuesta')}) AS n_prop,
            (SELECT COUNT(*)::int FROM reservas r
             WHERE r.empresa_id = $1 AND ${sqlReservaPrincipalSemanticaIgual('confirmada')}
               AND COALESCE(r.metadata->>'estadoPago', '') = 'pendiente') AS n_pago_pend,
            (SELECT COUNT(*)::int FROM bloqueos b
             WHERE b.empresa_id = $1
               AND b.fecha_inicio::date <= CURRENT_DATE
               AND b.fecha_fin::date >= CURRENT_DATE) AS n_bloq_activos,
            (SELECT COUNT(*)::int FROM comunicaciones c
             WHERE c.empresa_id = $1 AND c.estado = 'fallido'
               AND c.created_at >= NOW() - INTERVAL '24 hours') AS n_email_fallido_24h,
            (SELECT COUNT(DISTINCT r.propiedad_id)::int FROM reservas r
             WHERE r.empresa_id = $1 AND ${sqlReservaPrincipalSemanticaIgual('confirmada')} AND r.fecha_salida::date = CURRENT_DATE) AS n_props_checkout_hoy,
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
               AND COALESCE(NULLIF(trim(r.metadata->'reservaWebCheckout'->>'horaLlegadaEstimada'), ''), '') = '') AS n_lleg_manana_sin_hora_7d,
            (SELECT COUNT(*)::int FROM reservas r
             WHERE r.empresa_id = $1 AND ${sqlReservaPrincipalSemanticaIgual('confirmada')}
               AND COALESCE(r.metadata->>'estadoPago', '') = 'pendiente'
               AND NULLIF(trim(COALESCE(r.metadata->>'vencimientoPago', '')), '')::timestamptz < NOW()) AS n_pago_pend_vencido`,
        [empresaId]
    );
    return st[0] || {};
}

async function runDigestOperacion(opts = {}) {
    if (!pool) return;
    const empresaIdFiltro = opts.empresaId ? String(opts.empresaId).trim() : '';

    const { rows: empresas } = empresaIdFiltro
        ? await pool.query(
            `SELECT e.id, e.nombre, e.configuracion, e.email
             FROM empresas e WHERE e.id = $1::uuid`,
            [empresaIdFiltro]
        )
        : await pool.query(
            `SELECT DISTINCT e.id, e.nombre, e.configuracion, e.email
             FROM empresas e
             WHERE EXISTS (
                     SELECT 1 FROM reservas r
                     WHERE r.empresa_id = e.id AND ${sqlReservaPrincipalSemanticaEn(['confirmada', 'propuesta'])}
                     LIMIT 1
                 )
                 OR EXISTS (
                     SELECT 1 FROM comunicaciones c
                     WHERE c.empresa_id = e.id
                       AND c.estado = 'fallido'
                       AND c.created_at >= NOW() - INTERVAL '24 hours'
                     LIMIT 1
                 )
             LIMIT 200`
        );

    if (empresaIdFiltro && (!empresas || empresas.length === 0)) {
        console.warn('[digest operación] Empresa no encontrada:', empresaIdFiltro);
        return;
    }

    for (const e of empresas) {
        const cfg = (e.configuracion && e.configuracion.emailAutomations) || {};
        if (cfg.digestOperacionDiario === false) continue;
        const to = (cfg.contactoEmail || cfg.contacto_email || e.email || '').trim();
        if (!to) continue;

        const s = await queryMetricasDigestOperacion(e.id);
        const nLleg = s.n_lleg || 0;
        const nSal = s.n_sal || 0;
        const nProp = s.n_prop || 0;
        const nPagoPend = s.n_pago_pend || 0;
        const nBloq = s.n_bloq_activos || 0;
        const nFail = s.n_email_fallido_24h || 0;
        const nPropsOut = s.n_props_checkout_hoy || 0;
        const nIcalNuevas7d = s.n_ical_nuevas_7d || 0;
        const nIcalErr7d = s.n_ical_sync_con_error_7d || 0;
        const nLlegMananaSinHora = s.n_lleg_manana_sin_hora_7d || 0;
        const nPagoPendVencido = s.n_pago_pend_vencido || 0;

        if (nLleg + nSal + nProp + nPagoPend + nBloq + nFail + nPropsOut + nIcalNuevas7d + nIcalErr7d + nLlegMananaSinHora + nPagoPendVencido === 0) continue;

        const digestFecha = new Date().toLocaleDateString('es-CL');
        const lineaIcal = (nIcalNuevas7d > 0 || nIcalErr7d > 0)
            ? `· iCal (7 días): nuevas filas importadas ${nIcalNuevas7d}; sincronizaciones con error ${nIcalErr7d}\n`
            : '';
        const lineaLlegada = nLlegMananaSinHora > 0
            ? `· Llegadas mañana sin hora estimada informada: ${nLlegMananaSinHora}\n`
            : '';
        const lineaPagoVencido = nPagoPendVencido > 0
            ? `· Reservas confirmadas con pago pendiente vencido: ${nPagoPendVencido}\n`
            : '';
        const cuerpo = `Resumen operación (${digestFecha}) — ${e.nombre || 'Empresa'}\n\n`
            + `· Llegadas confirmadas hoy: ${nLleg}\n`
            + `· Salidas confirmadas hoy: ${nSal}\n`
            + `· Alojamientos distintos con check-out hoy: ${nPropsOut}\n`
            + `· Propuestas / tentativas abiertas: ${nProp}\n`
            + `· Reservas confirmadas con pago / seña pendiente (metadata): ${nPagoPend}\n`
            + lineaPagoVencido
            + lineaLlegada
            + `· Bloqueos de calendario activos hoy: ${nBloq}\n`
            + `· Correos fallidos (últimas 24 h, bandeja): ${nFail}\n`
            + lineaIcal;

        const variablesDigest = {
            empresaNombre: e.nombre || '',
            digestFecha,
            digestLlegadasHoy: nLleg,
            digestSalidasHoy: nSal,
            digestCheckoutPropiedadesHoy: nPropsOut,
            digestPropuestasAbiertas: nProp,
            digestPagoPendiente: nPagoPend,
            digestBloqueosActivos: nBloq,
            digestCorreosFallidos24h: nFail,
            digestIcalNuevasReservas7d: nIcalNuevas7d,
            digestIcalSincronizacionesConError7d: nIcalErr7d,
            digestLlegadasMananaSinHoraEstimada: nLlegMananaSinHora,
            digestPagoPendienteVencido: nPagoPendVencido,
            digestResumenLineas: cuerpo,
            mensajeConsulta: cuerpo,
            MENSAJE_CONSULTA: cuerpo,
        };

        let motor = { sent: false };
        try {
            motor = await enviarPorDisparador(null, e.id, 'digest_operacion_diario', {
                destinatarioOverride: to,
                variables: variablesDigest,
                skipRegistro: true,
                eventoComunicacion: 'digest-operacion-diario',
            });
        } catch (err) {
            console.warn('[job digest motor]', err.message);
            motor = { sent: false };
        }

        if (!motor.sent) {
            const html = `<div style="font-family:Arial,sans-serif;padding:16px;line-height:1.5"><pre style="white-space:pre-wrap;font-family:inherit">${cuerpo.replace(/</g, '&lt;')}</pre></div>`;
            await emailService.enviarCorreo(null, {
                to,
                subject: `[SuiteManager] Resumen diario — ${e.nombre || 'Operación'}`,
                html,
                empresaId: e.id,
            }).catch((err) => console.warn('[job digest]', err.message));
        }

        const pushBody = `Llegadas ${nLleg}, salidas ${nSal}, propuestas ${nProp}, fallos correo ${nFail}`
            + (nPagoPendVencido > 0 ? `, pago vencido ${nPagoPendVencido}` : '')
            + (nLlegMananaSinHora > 0 ? `, llegadas mañana sin hora ${nLlegMananaSinHora}` : '')
            + (nIcalErr7d > 0 ? `, iCal err 7d ${nIcalErr7d}` : '');
        await sendDigestPushToEmpresa(null, e.id, {
            title: `Resumen operación — ${e.nombre || 'SuiteManager'}`,
            body: pushBody,
            url: '/',
        }).catch((err) => console.warn('[job digest push]', err.message));
    }
}

async function ejecutarTodos() {
    if (!pool) {
        console.log('[ScheduledComms] Sin pool PostgreSQL, jobs omitidos.');
        return;
    }
    await runRecordatoriosPreLlegada();
    await runPostEstadiaEvaluacion();
    await runDigestOperacion();
}

function iniciar() {
    console.log(`[ScheduledComms] Iniciado (cada ${Math.round(INTERVAL_MS / 3600000)}h).`);
    setInterval(() => {
        ejecutarTodos().catch((e) => console.error('[ScheduledComms]', e));
    }, INTERVAL_MS);
    ejecutarTodos().catch((e) => console.error('[ScheduledComms] inicial:', e));
}

module.exports = {
    iniciar,
    ejecutarTodos,
    runRecordatoriosPreLlegada,
    runPostEstadiaEvaluacion,
    runDigestOperacion,
    queryMetricasDigestOperacion,
};
