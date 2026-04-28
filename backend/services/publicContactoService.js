// backend/services/publicContactoService.js
// Formulario contacto SSR → lead + correos disparadores consulta_contacto / notificacion_interna.
const pool = require('../db/postgres');
const {
    enviarPorDisparador,
    enviarNotificacionInterna,
    construirVariablesDesdeReserva,
} = require('./transactionalEmailService');
const { fallbackAsuntoConsultaWebDefecto } = require('./transactionalEmailFallbackSubjects');

function _normEmail(e) {
    return String(e || '').trim().toLowerCase();
}

async function upsertClienteConsultaWeb(empresaId, { nombre, email, telefono }) {
    const emailNorm = _normEmail(email);
    if (!emailNorm) throw new Error('Email requerido');
    const nombreOk = String(nombre || 'Consulta web').trim().slice(0, 200) || 'Consulta web';
    const tel = String(telefono || '').replace(/\D/g, '').slice(0, 20) || null;

    const { rows: found } = await pool.query(
        `SELECT id FROM clientes
         WHERE empresa_id = $1 AND LOWER(TRIM(COALESCE(email,''))) = $2 LIMIT 1`,
        [empresaId, emailNorm]
    );
    if (found[0]) {
        await pool.query(
            `UPDATE clientes SET nombre = COALESCE(NULLIF($2::text, ''), nombre),
                 telefono = COALESCE($3, telefono),
                 metadata = metadata || '{"origen":"consulta-web"}'::jsonb,
                 updated_at = NOW()
             WHERE id = $1 AND empresa_id = $4`,
            [found[0].id, nombreOk, tel, empresaId]
        );
        return found[0].id;
    }

    const meta = JSON.stringify({
        origen: 'consulta-web',
        tipoCliente: 'Lead',
        telefonoNormalizado: tel,
    });
    const { rows } = await pool.query(
        `INSERT INTO clientes
            (empresa_id, nombre, email, telefono, pais, calificacion, bloqueado, motivo_bloqueo, notas, metadata, telefono_normalizado)
         VALUES ($1,$2,$3,$4,'CL',0,false,'','', $5::jsonb, $6)
         RETURNING id`,
        [empresaId, nombreOk, emailNorm, tel || '56999999999', meta, tel]
    );
    return rows[0].id;
}

/**
 * Procesa envío desde sitio público (tenant resuelto).
 */
async function procesarConsultaWeb(empresaId, body) {
    const nombre = String(body.nombre || '').trim();
    const email = String(body.email || '').trim();
    const telefono = String(body.telefono || '').trim();
    const mensaje = String(body.mensaje || '').trim();
    const asuntoUsuario = String(body.asunto || '').trim().slice(0, 200);
    const hp = String(body.website || '').trim();

    if (hp) {
        return { ok: true, ignored: true };
    }
    if (!nombre || !email || !mensaje) {
        throw new Error('Nombre, email y mensaje son obligatorios.');
    }
    if (mensaje.length > 8000) {
        throw new Error('Mensaje demasiado largo.');
    }

    const clienteId = await upsertClienteConsultaWeb(empresaId, { nombre, email, telefono });

    const { rows: langRows } = await pool.query(
        `SELECT COALESCE(configuracion->'websiteSettings'->'email'->>'idiomaPorDefecto','es') AS idioma
         FROM empresas WHERE id = $1 LIMIT 1`,
        [empresaId]
    );
    const hl = String(langRows[0]?.idioma || '').toLowerCase() === 'en' ? 'en' : 'es';
    const asuntoDefecto = asuntoUsuario || fallbackAsuntoConsultaWebDefecto(hl);

    const vars = {
        ...await construirVariablesDesdeReserva(empresaId, {
            alojamiento_nombre: 'Consulta web',
            fecha_llegada: null,
            fecha_salida: null,
            total_noches: null,
            cantidad_huespedes: null,
            valores: {},
            id_reserva_canal: null,
            id: null,
        }, { clienteNombre: nombre, mensajeConsulta: mensaje, asuntoConsultaUsuario: asuntoDefecto }),
        clienteNombre: nombre,
        mensajeConsulta: mensaje,
        MENSAJE_CONSULTA: mensaje,
        asuntoConsultaUsuario: asuntoDefecto,
        CONSULTA_ASUNTO_USUARIO: asuntoDefecto,
    };

    const relacion = { tipo: 'consulta_web', id: String(Date.now()) };

    const huésped = await enviarPorDisparador(null, empresaId, 'consulta_contacto', {
        clienteId,
        destinatarioOverride: email,
        variables: vars,
        relacionadoCon: relacion,
        eventoComunicacion: 'consulta-web-publica',
    });

    await enviarNotificacionInterna(null, empresaId, {
        ...vars,
        mensajeConsulta: `Nueva consulta de ${nombre} (${email}):\n\n${mensaje}`,
        MENSAJE_CONSULTA: `Nueva consulta de ${nombre} (${email}):\n\n${mensaje}`,
    }, relacion).catch((e) => console.warn('[contacto] interna:', e.message));

    return { ok: true, clienteId, emailSent: huésped.sent, emailReason: huésped.reason };
}

module.exports = { procesarConsultaWeb, upsertClienteConsultaWeb };
