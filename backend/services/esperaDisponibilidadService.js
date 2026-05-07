const crypto = require('crypto');
const pool = require('../db/postgres');
const emailService = require('./emailService');
const { crearOActualizarCliente } = require('./clientesService');
const { registrarComunicacion } = require('./comunicacionesService');
const { getAvailabilityData, findNormalCombination } = require('./propuestasService');
const { calculatePrice } = require('./utils/calculoValoresService');
const { obtenerTarifasParaConsumidores } = require('./tarifasService');
const { obtenerValorDolar } = require('./dolarService');

const CODIGO_ESTADO = Object.freeze({
    ACTIVA: 'activa',
    NOTIFICADA: 'notificada',
    CONVERTIDA: 'convertida',
    EXPIRADA: 'expirada',
    CANCELADA: 'cancelada',
    NOTIFICACION_FALLIDA: 'notificacion_fallida',
});

const ESTADOS_SEMILLA = [
    { codigo: CODIGO_ESTADO.ACTIVA, nombre: 'Activa', color: 'rgb(59 130 246)', orden: 10, esFinal: false },
    { codigo: CODIGO_ESTADO.NOTIFICADA, nombre: 'Notificada', color: 'rgb(16 185 129)', orden: 20, esFinal: false },
    { codigo: CODIGO_ESTADO.CONVERTIDA, nombre: 'Convertida', color: 'rgb(34 197 94)', orden: 30, esFinal: true },
    { codigo: CODIGO_ESTADO.EXPIRADA, nombre: 'Expirada', color: 'rgb(245 158 11)', orden: 40, esFinal: true },
    { codigo: CODIGO_ESTADO.CANCELADA, nombre: 'Cancelada', color: 'rgb(107 114 128)', orden: 50, esFinal: true },
    { codigo: CODIGO_ESTADO.NOTIFICACION_FALLIDA, nombre: 'Notificación Fallida', color: 'rgb(239 68 68)', orden: 60, esFinal: true },
];

const EVENTO_COMUNICACION = 'espera_disponibilidad_match';
const TIPO_RELACION = 'espera_disponibilidad';

function _sha256(texto) {
    return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

function _buildToken() {
    return crypto.randomBytes(24).toString('hex');
}

function _toIsoYmd(v) {
    if (!v) return '';
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
}

function _buildReservaDesdeEsperaLink(baseUrl, token) {
    const root = String(baseUrl || '').trim().replace(/\/+$/, '');
    return `${root}/reservar-desde-espera?token=${encodeURIComponent(token)}`;
}

function _splitNombreApellidoCliente(cliente) {
    const raw = cliente || {};
    const n = String(raw.nombre || '').trim();
    const a = String(raw.apellido || '').trim();
    if (n || a) {
        return { nombre: n, apellido: a };
    }
    const full = String(raw.nombreCompleto || '').trim();
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { nombre: '', apellido: '' };
    if (parts.length === 1) return { nombre: parts[0], apellido: '' };
    return { nombre: parts[0], apellido: parts.slice(1).join(' ') };
}

function _buildNoAvailabilityCreatedHtml({ nombreCliente, nombreEmpresa, checkin, checkout, personas }) {
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#111827;color:#fff;padding:20px 24px">
    <h2 style="margin:0;font-size:22px">Te avisaremos si se libera disponibilidad</h2>
    <p style="margin:6px 0 0 0;font-size:14px;opacity:.9">${nombreEmpresa || 'SuiteManager'}</p>
  </td></tr>
  <tr><td style="padding:22px 24px">
    <p>Hola <strong>${nombreCliente || 'viajero/a'}</strong>, registramos tu solicitud para:</p>
    <ul>
      <li>Fechas: ${checkin} al ${checkout}</li>
      <li>Personas: ${personas}</li>
    </ul>
    <p>Si se libera disponibilidad en esas condiciones y aún faltan al menos 48 horas para el check-in, te enviaremos un único correo para continuar con la reserva.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function _buildMatchEmailHtml({ nombreCliente, nombreEmpresa, checkin, checkout, personas, linkReservar }) {
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f3f4f6">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#065f46;color:#fff;padding:20px 24px">
    <h2 style="margin:0;font-size:22px">¡Se liberó disponibilidad para tu solicitud!</h2>
    <p style="margin:6px 0 0 0;font-size:14px;opacity:.9">${nombreEmpresa || 'SuiteManager'}</p>
  </td></tr>
  <tr><td style="padding:22px 24px">
    <p>Hola <strong>${nombreCliente || 'viajero/a'}</strong>, detectamos disponibilidad para:</p>
    <ul>
      <li>Fechas: ${checkin} al ${checkout}</li>
      <li>Personas: ${personas}</li>
    </ul>
    <p>Usa este enlace para continuar con la reserva en el sitio público:</p>
    <p><a href="${linkReservar}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px">Continuar reserva</a></p>
    <p style="font-size:12px;color:#6b7280">Este enlace es de uso limitado y puede expirar.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function ensureEstadosEsperaSemilla(empresaId) {
    for (const e of ESTADOS_SEMILLA) {
        await pool.query(
            `INSERT INTO espera_disponibilidad_estados (empresa_id, codigo, nombre, color, orden, es_final)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (empresa_id, codigo)
             DO UPDATE SET
                nombre = EXCLUDED.nombre,
                color = EXCLUDED.color,
                orden = EXCLUDED.orden,
                es_final = EXCLUDED.es_final,
                updated_at = NOW()`,
            [empresaId, e.codigo, e.nombre, e.color, e.orden, e.esFinal]
        );
    }
}

async function _obtenerMapaEstados(empresaId) {
    const { rows } = await pool.query(
        `SELECT id, codigo, nombre, color, orden, es_final
         FROM espera_disponibilidad_estados
         WHERE empresa_id = $1
         ORDER BY orden ASC, created_at ASC`,
        [empresaId]
    );
    const byCode = new Map(rows.map((r) => [r.codigo, r]));
    return { rows, byCode };
}

async function obtenerEstadosEsperaPorEmpresa(empresaId) {
    await ensureEstadosEsperaSemilla(empresaId);
    const { rows } = await _obtenerMapaEstados(empresaId);
    return rows.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        color: r.color,
        orden: r.orden,
        esFinal: !!r.es_final,
    }));
}

async function crearEstadoEspera(empresaId, payload) {
    const codigo = String(payload.codigo || '').trim().toLowerCase();
    const nombre = String(payload.nombre || '').trim();
    if (!codigo || !nombre) throw new Error('codigo y nombre son obligatorios.');
    const { rows } = await pool.query(
        `INSERT INTO espera_disponibilidad_estados (empresa_id, codigo, nombre, color, orden, es_final)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, codigo, nombre, color, orden, es_final`,
        [
            empresaId,
            codigo,
            nombre,
            String(payload.color || 'rgb(107 114 128)'),
            Number(payload.orden || 0),
            Boolean(payload.esFinal),
        ]
    );
    const r = rows[0];
    return { id: r.id, codigo: r.codigo, nombre: r.nombre, color: r.color, orden: r.orden, esFinal: !!r.es_final };
}

async function actualizarEstadoEspera(empresaId, estadoId, payload) {
    const { rows } = await pool.query(
        `UPDATE espera_disponibilidad_estados
         SET codigo = COALESCE($3, codigo),
             nombre = COALESCE($4, nombre),
             color = COALESCE($5, color),
             orden = COALESCE($6, orden),
             es_final = COALESCE($7, es_final),
             updated_at = NOW()
         WHERE empresa_id = $1 AND id = $2
         RETURNING id, codigo, nombre, color, orden, es_final`,
        [
            empresaId,
            estadoId,
            payload.codigo ? String(payload.codigo).trim().toLowerCase() : null,
            payload.nombre ? String(payload.nombre).trim() : null,
            payload.color ? String(payload.color).trim() : null,
            payload.orden !== undefined ? Number(payload.orden) : null,
            payload.esFinal !== undefined ? Boolean(payload.esFinal) : null,
        ]
    );
    if (!rows[0]) throw new Error('Estado no encontrado.');
    const r = rows[0];
    return { id: r.id, codigo: r.codigo, nombre: r.nombre, color: r.color, orden: r.orden, esFinal: !!r.es_final };
}

async function eliminarEstadoEspera(empresaId, estadoId) {
    const { rows } = await pool.query(
        'SELECT codigo FROM espera_disponibilidad_estados WHERE empresa_id = $1 AND id = $2 LIMIT 1',
        [empresaId, estadoId]
    );
    if (!rows[0]) return;
    const codigo = rows[0].codigo;
    if (ESTADOS_SEMILLA.some((s) => s.codigo === codigo)) {
        throw new Error('No se pueden eliminar estados base del sistema.');
    }
    await pool.query(
        `DELETE FROM espera_disponibilidad_estados
         WHERE empresa_id = $1 AND id = $2`,
        [empresaId, estadoId]
    );
}

async function _resolveEmpresaPublicBaseUrl(empresaId) {
    const { rows } = await pool.query(
        'SELECT nombre, configuracion FROM empresas WHERE id = $1 LIMIT 1',
        [empresaId]
    );
    const empresa = rows[0] || {};
    const cfg = empresa.configuracion || {};
    const general = cfg.websiteSettings?.general || {};
    const domain = String(general.domain || '').trim();
    const subdomain = String(general.subdomain || '').trim();
    let baseUrl = '';
    if (domain) {
        baseUrl = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
    } else if (subdomain) {
        baseUrl = `https://${subdomain}.${process.env.PLATFORM_DOMAIN || 'rezerva.cl'}`;
    }
    return { nombreEmpresa: empresa.nombre || 'SuiteManager', baseUrl };
}

async function crearEsperaDisponibilidad(db, empresaId, payload) {
    await ensureEstadosEsperaSemilla(empresaId);
    const { byCode } = await _obtenerMapaEstados(empresaId);
    const estadoActiva = byCode.get(CODIGO_ESTADO.ACTIVA);
    if (!estadoActiva) throw new Error('No se pudo resolver estado activa.');

    const consentimientoImplicitoIa = Boolean(payload.consentimientoImplicitoIa);
    const checkin = String(payload.fechaLlegada || '').trim();
    const checkout = String(payload.fechaSalida || '').trim();
    const personas = Number(payload.personas || 0);
    let nombre = String(payload.nombre || '').trim();
    let apellido = String(payload.apellido || '').trim();
    const telefono = String(payload.telefono || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const consentimiento = Boolean(payload.consentimientoContacto);
    const propiedadIdPreferida = payload.propiedadIdPreferida ? String(payload.propiedadIdPreferida).trim() : null;

    if (consentimientoImplicitoIa && !nombre) {
        nombre = 'Cliente';
    }

    if (!checkin || !checkout || !personas || !nombre || !email) {
        throw new Error('Faltan datos obligatorios para registrar lista de espera.');
    }
    if (!consentimientoImplicitoIa) {
        if (!telefono) {
            throw new Error('Faltan datos obligatorios para registrar lista de espera.');
        }
        if (!consentimiento) {
            throw new Error('Debes aceptar consentimiento de contacto para lista de espera.');
        }
    }

    const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ').trim();
    const { cliente } = await crearOActualizarCliente(db, empresaId, {
        nombre: nombreCompleto,
        telefono,
        email,
        canalNombre: 'espera-disponibilidad',
        idReservaCanal: null,
    });
    if (!cliente?.id) throw new Error('No se pudo crear/actualizar cliente.');

    const { rows: dupRows } = await pool.query(
        `SELECT ed.id
         FROM espera_disponibilidad ed
         JOIN espera_disponibilidad_estados ees ON ees.id = ed.estado_id
         WHERE ed.empresa_id = $1
           AND ed.cliente_id = $2
           AND ed.fecha_llegada = $3::date
           AND ed.fecha_salida = $4::date
           AND ed.personas = $5
           AND COALESCE(ed.propiedad_id_preferida, '') = COALESCE($6, '')
           AND ees.codigo = $7
         LIMIT 1`,
        [empresaId, cliente.id, checkin, checkout, personas, propiedadIdPreferida, CODIGO_ESTADO.ACTIVA]
    );
    if (dupRows[0]) {
        return { id: dupRows[0].id, duplicado: true };
    }

    const { rows } = await pool.query(
        `INSERT INTO espera_disponibilidad
           (empresa_id, cliente_id, estado_id, propiedad_id_preferida, fecha_llegada, fecha_salida, personas,
            nombre_contacto, apellido_contacto, telefono_contacto, email_contacto, consentimiento_contacto, consentimiento_at, metadata)
         VALUES
           ($1,$2,$3,$4,$5::date,$6::date,$7,$8,$9,$10,$11,true,NOW(),$12::jsonb)
         RETURNING id, created_at`,
        [
            empresaId,
            cliente.id,
            estadoActiva.id,
            propiedadIdPreferida,
            checkin,
            checkout,
            personas,
            nombre,
            apellido,
            telefono,
            email,
            JSON.stringify({
                origen: payload.origen || 'spa-agregar-propuesta',
                consentimiento_implicito_ia: consentimientoImplicitoIa,
                ...(payload.propiedadNombreIa
                    ? { propiedad_nombre_consulta: String(payload.propiedadNombreIa).slice(0, 240) }
                    : {}),
            }),
        ]
    );

    const { nombreEmpresa } = await _resolveEmpresaPublicBaseUrl(empresaId);
    const emailResult = await emailService.enviarCorreo(db, {
        to: email,
        subject: 'Registramos tu solicitud de disponibilidad',
        html: _buildNoAvailabilityCreatedHtml({
            nombreCliente: nombreCompleto,
            nombreEmpresa,
            checkin,
            checkout,
            personas,
        }),
        empresaId,
    });
    await registrarComunicacion(db, empresaId, cliente.id, {
        tipo: 'email',
        evento: 'espera_disponibilidad_creada',
        asunto: 'Registro en lista de espera',
        destinatario: email,
        relacionadoCon: { tipo: TIPO_RELACION, id: rows[0].id },
        estado: emailResult?.success ? 'enviado' : 'fallido',
        messageId: emailResult?.messageId || null,
    });

    return { id: rows[0].id, createdAt: rows[0].created_at };
}

/**
 * Mismo flujo que el panel (tabla espera_disponibilidad + correo de confirmación + reconciliación posterior).
 * Canal IA: sin checkbox de consentimiento; se registra consentimiento implícito y metadato de origen.
 * Requiere email válido (el caller debe validar o devolver WAITLIST_EMAIL_REQUIRED al huésped).
 */
async function registrarEsperaDisponibilidadDesdeIa(db, empresaId, params) {
    if (!pool) {
        return { ok: false, code: 'NO_POSTGRES', message: 'Lista de espera requiere PostgreSQL.' };
    }
    const emailRaw = String(params.cliente?.email || '').trim().toLowerCase();
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(emailRaw)) {
        return {
            ok: false,
            code: 'WAITLIST_EMAIL_REQUIRED',
            message: 'Se requiere un email válido para la lista de espera.',
        };
    }
    const { nombre, apellido } = _splitNombreApellidoCliente(params.cliente);
    const nombreFinal = nombre || 'Cliente';
    try {
        const result = await crearEsperaDisponibilidad(db, empresaId, {
            fechaLlegada: params.checkin,
            fechaSalida: params.checkout,
            personas: Number(params.personas) || 0,
            nombre: nombreFinal,
            apellido,
            telefono: String(params.cliente?.telefono || '').trim(),
            email: emailRaw,
            consentimientoImplicitoIa: true,
            consentimientoContacto: true,
            propiedadIdPreferida: params.propiedadId ? String(params.propiedadId).trim() : null,
            propiedadNombreIa: params.propiedadNombre || null,
            origen: 'ia-publica',
        });
        return { ok: true, id: result.id, duplicado: Boolean(result.duplicado) };
    } catch (err) {
        console.warn('[espera-disponibilidad ia] registrarEsperaDisponibilidadDesdeIa:', err.message);
        return {
            ok: false,
            code: 'WAITLIST_ERROR',
            message: err.message || 'Error al registrar lista de espera.',
        };
    }
}

async function listarEsperaDisponibilidad(empresaId) {
    await ensureEstadosEsperaSemilla(empresaId);
    const { rows } = await pool.query(
        `SELECT
            ed.id,
            ed.cliente_id,
            ed.estado_id,
            ees.codigo AS estado_codigo,
            ees.nombre AS estado_nombre,
            ees.color AS estado_color,
            ed.propiedad_id_preferida,
            ed.fecha_llegada,
            ed.fecha_salida,
            ed.personas,
            ed.nombre_contacto,
            ed.apellido_contacto,
            ed.telefono_contacto,
            ed.email_contacto,
            ed.consentimiento_contacto,
            ed.notificacion_unica_enviada,
            ed.notificacion_enviada_at,
            ed.token_expira_at,
            ed.token_usado_at,
            ed.created_at,
            ed.updated_at
         FROM espera_disponibilidad ed
         JOIN espera_disponibilidad_estados ees
           ON ees.id = ed.estado_id
         WHERE ed.empresa_id = $1
         ORDER BY ed.created_at DESC`,
        [empresaId]
    );
    return rows.map((r) => ({
        id: r.id,
        clienteId: r.cliente_id,
        estadoId: r.estado_id,
        estadoCodigo: r.estado_codigo,
        estadoNombre: r.estado_nombre,
        estadoColor: r.estado_color,
        propiedadIdPreferida: r.propiedad_id_preferida || null,
        fechaLlegada: _toIsoYmd(r.fecha_llegada),
        fechaSalida: _toIsoYmd(r.fecha_salida),
        personas: Number(r.personas) || 0,
        nombre: r.nombre_contacto || '',
        apellido: r.apellido_contacto || '',
        telefono: r.telefono_contacto || '',
        email: r.email_contacto || '',
        consentimientoContacto: !!r.consentimiento_contacto,
        notificacionUnicaEnviada: !!r.notificacion_unica_enviada,
        notificacionEnviadaAt: r.notificacion_enviada_at || null,
        tokenExpiraAt: r.token_expira_at || null,
        tokenUsadoAt: r.token_usado_at || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
}

async function actualizarEstadoEsperaRegistro(empresaId, esperaId, estadoId) {
    await pool.query(
        `UPDATE espera_disponibilidad
         SET estado_id = $3, updated_at = NOW()
         WHERE empresa_id = $1 AND id = $2`,
        [empresaId, esperaId, estadoId]
    );
}

async function _buildReservaLinkFromWaitlist(db, empresaId, waitlistRow) {
    const startDate = new Date(`${_toIsoYmd(waitlistRow.fecha_llegada)}T00:00:00Z`);
    const endDate = new Date(`${_toIsoYmd(waitlistRow.fecha_salida)}T00:00:00Z`);
    const personas = Number(waitlistRow.personas) || 1;
    const availability = await getAvailabilityData(db, empresaId, startDate, endDate, false, null);
    const available = availability.availableProperties || [];
    let selected = null;

    if (waitlistRow.propiedad_id_preferida) {
        selected = available.find((p) => p.id === waitlistRow.propiedad_id_preferida && Number(p.capacidad || 0) >= personas) || null;
    }
    if (!selected) {
        const combo = findNormalCombination(available, personas);
        selected = combo?.combination?.[0] || null;
    }
    if (!selected) return null;

    const { rows: canalRows } = await pool.query(
        `SELECT id FROM canales
         WHERE empresa_id = $1
           AND COALESCE((metadata->>'esCanalPorDefecto')::boolean, false) = true
         LIMIT 1`,
        [empresaId]
    );
    if (!canalRows[0]) return null;

    const allTarifas = await obtenerTarifasParaConsumidores(empresaId);
    const valorDolar = await obtenerValorDolar(db, empresaId, startDate);
    const pricing = await calculatePrice(
        db,
        empresaId,
        [{ id: selected.id, nombre: selected.nombre }],
        startDate,
        endDate,
        allTarifas,
        canalRows[0].id,
        valorDolar,
        false
    );
    const precioFinal = Math.round(Number(pricing?.totalPriceCLP) || 0);
    const noches = Math.max(1, Number(pricing?.nights) || Math.round((endDate - startDate) / 86400000));
    if (!precioFinal) return null;

    const token = _buildToken();
    const tokenHash = _sha256(token);
    const tokenExpiraAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await pool.query(
        `UPDATE espera_disponibilidad
         SET token_hash = $3, token_expira_at = $4, updated_at = NOW()
         WHERE empresa_id = $1 AND id = $2`,
        [empresaId, waitlistRow.id, tokenHash, tokenExpiraAt.toISOString()]
    );

    const { baseUrl } = await _resolveEmpresaPublicBaseUrl(empresaId);
    if (!baseUrl) return null;
    const resumePath = _buildReservaDesdeEsperaLink(baseUrl, token);
    const query = new URLSearchParams({
        propiedadId: selected.id,
        fechaLlegada: _toIsoYmd(waitlistRow.fecha_llegada),
        fechaSalida: _toIsoYmd(waitlistRow.fecha_salida),
        noches: String(noches),
        precioFinal: String(precioFinal),
        personas: String(personas),
    }).toString();
    return `${resumePath}&${query}`;
}

async function reconciliarEsperaDisponibilidad(db, empresaId) {
    await ensureEstadosEsperaSemilla(empresaId);
    const { byCode } = await _obtenerMapaEstados(empresaId);
    const estadoActiva = byCode.get(CODIGO_ESTADO.ACTIVA);
    const estadoNotificada = byCode.get(CODIGO_ESTADO.NOTIFICADA);
    const estadoExpirada = byCode.get(CODIGO_ESTADO.EXPIRADA);
    const estadoFallida = byCode.get(CODIGO_ESTADO.NOTIFICACION_FALLIDA);
    if (!estadoActiva || !estadoNotificada || !estadoExpirada || !estadoFallida) {
        throw new Error('No se pudieron resolver estados de espera requeridos.');
    }

    const { rows } = await pool.query(
        `SELECT ed.*
         FROM espera_disponibilidad ed
         WHERE ed.empresa_id = $1
           AND ed.estado_id = $2
         ORDER BY ed.created_at ASC`,
        [empresaId, estadoActiva.id]
    );
    if (!rows.length) return { scanned: 0, notified: 0, expired: 0, failed: 0 };

    let notified = 0;
    let expired = 0;
    let failed = 0;

    for (const row of rows) {
        const fechaLlegada = new Date(`${_toIsoYmd(row.fecha_llegada)}T00:00:00Z`);
        const cutoff = new Date(fechaLlegada.getTime() - (48 * 60 * 60 * 1000));
        const now = new Date();
        if (now >= cutoff) {
            await pool.query(
                `UPDATE espera_disponibilidad
                 SET estado_id = $3, updated_at = NOW()
                 WHERE empresa_id = $1 AND id = $2`,
                [empresaId, row.id, estadoExpirada.id]
            );
            expired++;
            continue;
        }

        const link = await _buildReservaLinkFromWaitlist(db, empresaId, row);
        if (!link) continue;

        const { nombreEmpresa } = await _resolveEmpresaPublicBaseUrl(empresaId);
        const nombreCliente = [row.nombre_contacto, row.apellido_contacto].filter(Boolean).join(' ').trim();
        const sendResult = await emailService.enviarCorreo(db, {
            to: row.email_contacto,
            subject: 'Hay disponibilidad para tu solicitud',
            html: _buildMatchEmailHtml({
                nombreCliente,
                nombreEmpresa,
                checkin: _toIsoYmd(row.fecha_llegada),
                checkout: _toIsoYmd(row.fecha_salida),
                personas: row.personas,
                linkReservar: link,
            }),
            empresaId,
        });

        const targetEstadoId = sendResult?.success ? estadoNotificada.id : estadoFallida.id;
        await pool.query(
            `UPDATE espera_disponibilidad
             SET estado_id = $3,
                 notificacion_unica_enviada = true,
                 notificacion_enviada_at = NOW(),
                 notificacion_message_id = $4,
                 notificacion_error = $5,
                 ultimo_match_at = NOW(),
                 updated_at = NOW()
             WHERE empresa_id = $1 AND id = $2`,
            [empresaId, row.id, targetEstadoId, sendResult?.messageId || null, sendResult?.success ? null : (sendResult?.error || 'EMAIL_PROVIDER_REJECTED')]
        );

        await registrarComunicacion(db, empresaId, row.cliente_id, {
            tipo: 'email',
            evento: EVENTO_COMUNICACION,
            asunto: 'Disponibilidad liberada para solicitud en espera',
            destinatario: row.email_contacto,
            relacionadoCon: { tipo: TIPO_RELACION, id: row.id },
            estado: sendResult?.success ? 'enviado' : 'fallido',
            messageId: sendResult?.messageId || null,
        });

        if (sendResult?.success) notified++;
        else failed++;
    }

    return { scanned: rows.length, notified, expired, failed };
}

async function consumirTokenEsperaParaReserva(empresaId, rawToken) {
    const tokenHash = _sha256(rawToken);
    const { rows } = await pool.query(
        `SELECT ed.*
         FROM espera_disponibilidad ed
         JOIN espera_disponibilidad_estados ees
           ON ees.id = ed.estado_id
         WHERE ed.empresa_id = $1
           AND ed.token_hash = $2
           AND ed.token_expira_at IS NOT NULL
           AND ed.token_expira_at > NOW()
           AND ed.token_usado_at IS NULL
           AND ees.codigo = $3
         LIMIT 1`,
        [empresaId, tokenHash, CODIGO_ESTADO.NOTIFICADA]
    );
    if (!rows[0]) return null;
    await pool.query(
        `UPDATE espera_disponibilidad
         SET token_usado_at = NOW(),
             updated_at = NOW()
         WHERE empresa_id = $1 AND id = $2`,
        [empresaId, rows[0].id]
    );
    return rows[0];
}

module.exports = {
    CODIGO_ESTADO_ESPERA: CODIGO_ESTADO,
    ensureEstadosEsperaSemilla,
    obtenerEstadosEsperaPorEmpresa,
    crearEstadoEspera,
    actualizarEstadoEspera,
    eliminarEstadoEspera,
    crearEsperaDisponibilidad,
    registrarEsperaDisponibilidadDesdeIa,
    listarEsperaDisponibilidad,
    actualizarEstadoEsperaRegistro,
    reconciliarEsperaDisponibilidad,
    consumirTokenEsperaParaReserva,
};
