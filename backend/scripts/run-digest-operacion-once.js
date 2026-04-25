/**
 * Vista previa (solo lectura) o una pasada real del digest operación diario.
 *
 * Cargar env antes de cualquier require que abra el pool:
 *   backend/.env o .env en la raíz del repo.
 *
 * Vista previa (no envía correos):
 *   node backend/scripts/run-digest-operacion-once.js --empresa-id=<UUID>
 *
 * Enviar como el job (todas las empresas elegibles, hasta 200):
 *   node backend/scripts/run-digest-operacion-once.js --send
 *
 * Enviar solo una empresa (debe existir en empresas; misma lógica de umbral y destinatario):
 *   node backend/scripts/run-digest-operacion-once.js --send --empresa-id=<UUID>
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = require('../db/postgres');
const {
    runDigestOperacion,
    queryMetricasDigestOperacion,
} = require('../jobs/scheduledTransactionalEmails');

function parseArgs() {
    const out = { send: false, empresaId: '' };
    for (const a of process.argv.slice(2)) {
        if (a === '--send') out.send = true;
        else if (a.startsWith('--empresa-id=')) {
            out.empresaId = a.slice('--empresa-id='.length).trim();
        }
    }
    return out;
}

function sumaMetricas(s) {
    const nLleg = s.n_lleg || 0;
    const nSal = s.n_sal || 0;
    const nProp = s.n_prop || 0;
    const nPagoPend = s.n_pago_pend || 0;
    const nBloq = s.n_bloq_activos || 0;
    const nFail = s.n_email_fallido_24h || 0;
    const nPropsOut = s.n_props_checkout_hoy || 0;
    const nIcalNuevas7d = s.n_ical_nuevas_7d || 0;
    const nIcalErr7d = s.n_ical_sync_con_error_7d || 0;
    return nLleg + nSal + nProp + nPagoPend + nBloq + nFail + nPropsOut + nIcalNuevas7d + nIcalErr7d;
}

async function preview(empresaId) {
    const { rows } = await pool.query(
        'SELECT id, nombre, configuracion, email FROM empresas WHERE id = $1::uuid',
        [empresaId]
    );
    if (!rows.length) {
        console.error('[digest-once] Empresa no encontrada.');
        process.exit(1);
    }
    const e = rows[0];
    const cfg = (e.configuracion && e.configuracion.emailAutomations) || {};
    const to = (cfg.contactoEmail || cfg.contacto_email || e.email || '').trim();
    const s = await queryMetricasDigestOperacion(e.id);
    const total = sumaMetricas(s);
    const digestOn = cfg.digestOperacionDiario !== false;
    const enviaria = total > 0 && digestOn && Boolean(to);
    console.log(JSON.stringify({
        empresaId: e.id,
        nombre: e.nombre,
        digestOperacionDiario: digestOn,
        destinatario: to || null,
        metricas: {
            llegadasHoy: s.n_lleg || 0,
            salidasHoy: s.n_sal || 0,
            propuestasAbiertas: s.n_prop || 0,
            pagoPendienteMetadata: s.n_pago_pend || 0,
            bloqueosActivosHoy: s.n_bloq_activos || 0,
            correosFallidos24h: s.n_email_fallido_24h || 0,
            propiedadesCheckoutHoy: s.n_props_checkout_hoy || 0,
            icalNuevasFilas7d: s.n_ical_nuevas_7d || 0,
            icalSyncConError7d: s.n_ical_sync_con_error_7d || 0,
        },
        sumaActividad: total,
        enviariaDigestHoy: enviaria,
        motivoSiNoEnvia: !digestOn
            ? 'digestOperacionDiario desactivado'
            : !to
                ? 'sin contactoEmail ni email'
                : total === 0
                    ? 'suma de métricas en cero'
                    : null,
    }, null, 2));
}

async function main() {
    const { send, empresaId } = parseArgs();
    if (!pool) {
        console.error('[digest-once] Requiere DATABASE_URL (PostgreSQL).');
        process.exit(1);
    }
    if (send) {
        await runDigestOperacion(empresaId ? { empresaId } : {});
        console.log('[digest-once] runDigestOperacion finalizado.');
        return;
    }
    if (!empresaId) {
        console.error('Vista previa: node backend/scripts/run-digest-operacion-once.js --empresa-id=<UUID>');
        console.error('Enviar:     node backend/scripts/run-digest-operacion-once.js --send [--empresa-id=<UUID>]');
        process.exit(1);
    }
    await preview(empresaId);
}

main().catch((err) => {
    console.error('[digest-once]', err.message);
    process.exit(1);
});
