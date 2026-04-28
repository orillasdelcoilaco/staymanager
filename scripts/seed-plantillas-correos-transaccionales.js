/**
 * Idempotente: crea plantillas de correo transaccional por empresa solo si aún no existe
 * ninguna plantilla activa con el mismo disparador encendido.
 *
 * Uso (desde la raíz del repo, con DATABASE_URL en backend/.env):
 *   node scripts/seed-plantillas-correos-transaccionales.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const pool = require('../backend/db/postgres');
const { DISPARADOR_KEYS } = require('../backend/services/plantillasService');

function cfgSolo(disparadorActivo) {
    const disparadores = Object.fromEntries(DISPARADOR_KEYS.map((k) => [k, k === disparadorActivo]));
    return JSON.stringify({ permitirEnvioCorreo: true, disparadores });
}

const PLANTILLAS = [
    {
        disparador: 'reserva_confirmada',
        nombre: 'Correo — Reserva confirmada',
        asunto: '✅ Reserva confirmada — [ALOJAMIENTO_NOMBRE]',
        texto: `Hola [CLIENTE_NOMBRE],

Confirmamos tu reserva [RESERVA_ID_CANAL].

📌 Detalles
• Llegada: [FECHA_LLEGADA]
• Salida: [FECHA_SALIDA]
• Noches: [TOTAL_NOCHES]
• Alojamiento: [ALOJAMIENTO_NOMBRE]
• Total: [MONTO_TOTAL]

Gracias por preferir [EMPRESA_NOMBRE].

[EMPRESA_WEBSITE]
[USUARIO_EMAIL] · [USUARIO_TELEFONO]`,
    },
    {
        disparador: 'reserva_cancelada',
        nombre: 'Correo — Reserva cancelada',
        asunto: 'Reserva cancelada — [ALOJAMIENTO_NOMBRE]',
        texto: `Hola [CLIENTE_NOMBRE],

Te informamos que la reserva [RESERVA_ID_CANAL] para [ALOJAMIENTO_NOMBRE] quedó cancelada.

Fechas previstas: [FECHAS_ESTADIA_TEXTO].

Si tienes dudas, responde a este correo o escribe a [USUARIO_EMAIL].

[EMPRESA_NOMBRE]`,
    },
    {
        disparador: 'reserva_modificada',
        nombre: 'Correo — Reserva modificada',
        asunto: 'Cambio de fechas en tu reserva — [ALOJAMIENTO_NOMBRE]',
        texto: `Hola [CLIENTE_NOMBRE],

Actualizamos los datos de tu reserva [RESERVA_ID_CANAL].

📌 Nuevas fechas
• Llegada: [FECHA_LLEGADA]
• Salida: [FECHA_SALIDA]
• Alojamiento: [ALOJAMIENTO_NOMBRE]

Cualquier consulta: [USUARIO_EMAIL]

[EMPRESA_NOMBRE]`,
    },
    {
        disparador: 'recordatorio_pre_llegada',
        nombre: 'Correo — Recordatorio pre-llegada',
        asunto: 'Te esperamos mañana — [ALOJAMIENTO_NOMBRE]',
        texto: `Hola [CLIENTE_NOMBRE],

Te recordamos que mañana es tu llegada a [ALOJAMIENTO_NOMBRE].

Check-in: [FECHA_LLEGADA] · Salida prevista: [FECHA_SALIDA]

Si necesitas coordinación de horario, responde a [USUARIO_EMAIL].

¡Buen viaje!
[EMPRESA_NOMBRE]`,
    },
    {
        disparador: 'post_estadia_evaluacion',
        nombre: 'Correo — Evaluación post-estancia',
        asunto: '¿Cómo estuvo tu estadía? — [EMPRESA_NOMBRE]',
        texto: `Hola [CLIENTE_NOMBRE],

Gracias por hospedarte en [ALOJAMIENTO_NOMBRE].

Nos encantaría conocer tu opinión (solo te tomará un minuto):

[LINK_RESEÑA]

Tu feedback ayuda a futuros huéspedes.

[EMPRESA_NOMBRE]
[USUARIO_EMAIL]`,
    },
    {
        disparador: 'consulta_contacto',
        nombre: 'Correo — Acuse consulta web',
        asunto: 'Recibimos tu mensaje — [EMPRESA_NOMBRE]',
        texto: `Hola [CLIENTE_NOMBRE],

Recibimos tu consulta con asunto: «[CONSULTA_ASUNTO_USUARIO]».

Te responderemos pronto a este correo.

Tu mensaje:
[MENSAJE_CONSULTA]

[EMPRESA_NOMBRE]
[USUARIO_EMAIL]`,
    },
    {
        disparador: 'notificacion_interna',
        nombre: 'Correo — Notificación interna (equipo)',
        asunto: '[EMPRESA_NOMBRE] — Notificación interna',
        texto: `Equipo de [EMPRESA_NOMBRE],

[MENSAJE_CONSULTA]

—
Enviado automáticamente por SuiteManager.`,
    },
    {
        disparador: 'digest_operacion_diario',
        nombre: 'Correo — Resumen diario de operación (equipo)',
        asunto: '[EMPRESA_NOMBRE] — Resumen operación [DIGEST_FECHA]',
        texto: `Hola,

Resumen de operación para [DIGEST_FECHA] — [EMPRESA_NOMBRE]

· Llegadas confirmadas hoy: [DIGEST_LLEGADAS_HOY]
· Salidas confirmadas hoy: [DIGEST_SALIDAS_HOY]
· Alojamientos distintos con check-out hoy: [DIGEST_CHECKOUT_PROPIEDADES_HOY]
· Propuestas / tentativas abiertas: [DIGEST_PROPUESTAS_ABIERTAS]
· Reservas con pago/seña pendiente (metadata): [DIGEST_PAGO_PENDIENTE]
· Reservas con pago pendiente vencido: [DIGEST_PAGO_PENDIENTE_VENCIDO]
· Llegadas mañana sin hora estimada: [DIGEST_LLEGADAS_MANANA_SIN_HORA_ESTIMADA]
· Bloqueos de calendario activos hoy: [DIGEST_BLOQUEOS_ACTIVOS]
· Correos fallidos (24 h): [DIGEST_CORREOS_FALLIDOS_24H]
· iCal (7 días) — nuevas filas importadas: [DIGEST_ICAL_NUEVAS_RESERVAS_7D]
· iCal (7 días) — sync con error: [DIGEST_ICAL_SINCRONIZACIONES_CON_ERROR_7D]

Detalle:
[DIGEST_RESUMEN_LINEAS]

— SuiteManager (job digest)`,
    },
];

async function yaExisteDisparador(client, empresaId, disparador) {
    const probe = JSON.stringify({ disparadores: { [disparador]: true } });
    const { rows } = await client.query(
        `SELECT 1 FROM plantillas
         WHERE empresa_id = $1 AND activa = true AND email_config @> $2::jsonb
         LIMIT 1`,
        [empresaId, probe]
    );
    return Boolean(rows[0]);
}

async function run() {
    if (!pool) {
        console.error('No hay pool PostgreSQL (DATABASE_URL). Abortando.');
        process.exit(1);
    }
    const client = await pool.connect();
    let insertadas = 0;
    let omitidas = 0;
    try {
        const { rows: empresas } = await client.query('SELECT id FROM empresas ORDER BY id');
        console.log(`Empresas: ${empresas.length}`);

        for (const e of empresas) {
            const empresaId = String(e.id);
            for (const p of PLANTILLAS) {
                if (await yaExisteDisparador(client, empresaId, p.disparador)) {
                    omitidas += 1;
                    continue;
                }
                await client.query(
                    `INSERT INTO plantillas (empresa_id, nombre, tipo, texto, activa, asunto, email_config)
                     VALUES ($1, $2, NULL, $3, true, $4, $5::jsonb)`,
                    [empresaId, p.nombre, p.texto, p.asunto, cfgSolo(p.disparador)]
                );
                insertadas += 1;
            }
        }
        console.log(`Listo. Insertadas: ${insertadas}, omitidas (ya había disparador): ${omitidas}`);
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
