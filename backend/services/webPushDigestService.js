/**
 * Web Push opcional para el digest de operación (§1.4).
 * Requiere VAPID en entorno: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, opcional VAPID_SUBJECT (mailto:…).
 */
const webpush = require('web-push');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('./empresaService');

function getVapidConfig() {
    const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
    const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
    const subject = (process.env.VAPID_SUBJECT || 'mailto:support@suitemanagers.com').trim();
    if (!publicKey || !privateKey) return null;
    return { publicKey, privateKey, subject };
}

function getWebPushPublicConfig() {
    const v = getVapidConfig();
    return { enabled: Boolean(v), publicKey: v ? v.publicKey : null };
}

function _ensureVapid() {
    const v = getVapidConfig();
    if (!v) return false;
    try {
        webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
        return true;
    } catch (e) {
        console.warn('[webPushDigest] setVapidDetails:', e.message);
        return false;
    }
}

/**
 * @param {import('firebase-admin').firestore.Firestore|null} db
 * @param {string} empresaId
 * @param {{ title: string, body: string, url?: string }} payload
 */
async function sendDigestPushToEmpresa(db, empresaId, payload) {
    if (!_ensureVapid()) return { sent: 0, reason: 'vapid_no_configurado' };
    const empresa = await obtenerDetallesEmpresa(db, empresaId);
    const cfg = empresa?.emailAutomations || {};
    if (cfg.digestWebPushActivo === false) return { sent: 0, reason: 'push_desactivado_empresa' };

    const subs = Array.isArray(empresa?.webPushDigestSubscriptions)
        ? empresa.webPushDigestSubscriptions
        : [];
    if (!subs.length) return { sent: 0, reason: 'sin_suscripciones' };

    const data = {
        title: String(payload.title || 'SuiteManager').slice(0, 80),
        body: String(payload.body || '').slice(0, 240),
        url: String(payload.url || '/').slice(0, 500),
    };
    const bodyStr = JSON.stringify(data);
    let sent = 0;
    const deadEndpoints = [];
    for (const sub of subs) {
        if (!sub || !sub.endpoint) continue;
        try {
            await webpush.sendNotification(sub, bodyStr, { TTL: 86400 });
            sent += 1;
        } catch (err) {
            const code = err.statusCode;
            if (code === 404 || code === 410) deadEndpoints.push(sub.endpoint);
        }
    }
    if (deadEndpoints.length) {
        const next = subs.filter((s) => s && !deadEndpoints.includes(s.endpoint));
        try {
            await actualizarDetallesEmpresa(db, empresaId, { webPushDigestSubscriptions: next });
        } catch (e) {
            console.warn('[webPushDigest] limpiar subs:', e.message);
        }
    }
    return { sent };
}

module.exports = {
    getWebPushPublicConfig,
    sendDigestPushToEmpresa,
};
