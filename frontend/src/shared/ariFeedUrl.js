/**
 * URL base del feed ARI en el host público (sin query).
 * @param {object} emp Objeto empresa con websiteSettings.general, dominio, subdominio.
 */
export function buildPublicAriFeedUrlFromEmp(emp) {
    const g = emp?.websiteSettings?.general || {};
    let host = String(g.domain || emp?.dominio || '').trim().replace(/^https?:\/\//i, '');
    if (host) return `https://${host}/feed-ari.xml`;
    const sub = String(g.subdomain || emp?.subdominio || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (sub) return `https://${sub}.suitemanagers.com/feed-ari.xml`;
    return '';
}

/** URL del feed ARI con query acotada (omite defaults: mode=website, days=180). */
export function buildAriFeedQueryUrl(base, { mode, days, token }) {
    const p = new URLSearchParams();
    if (String(mode || 'website').toLowerCase() === 'google_hotels') {
        p.set('mode', 'google_hotels');
    }
    const d = Math.min(365, Math.max(14, Math.round(Number(days)) || 180));
    if (d !== 180) p.set('days', String(d));
    const t = String(token || '').trim();
    if (t) p.set('token', t);
    const q = p.toString();
    return q ? `${base}?${q}` : base;
}
