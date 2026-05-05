/**
 * Sanitiza campos SEO persistidos en websiteSettings.seo (panel / home-settings).
 */

function sanitizeGoogleSiteVerificationToken(raw) {
    if (raw == null) return '';
    if (typeof raw !== 'string') return '';
    const t = raw.trim().slice(0, 128);
    if (!t) return '';
    // Tokens habituales de Google Search Console (meta content)
    if (!/^[A-Za-z0-9_-]+$/.test(t)) return '';
    return t;
}

/**
 * @param {object|null|undefined} incoming
 * @returns {object}
 */
/**
 * Archivo HTML de verificación GSC en la raíz del sitio (nombre fijado por Google al descargar).
 * @returns {{ filename: string, htmlBody: string }|null} null = no persistir objeto inválido
 */
function sanitizeGoogleSearchConsoleHtmlVerification(raw) {
    if (raw == null) return { filename: '', htmlBody: '' };
    if (typeof raw !== 'object') return { filename: '', htmlBody: '' };
    const filename = String(raw.filename || '').trim().toLowerCase();
    const htmlBody = String(raw.htmlBody || '').trim().slice(0, 1024);
    if (!filename && !htmlBody) return { filename: '', htmlBody: '' };
    if (!/^google[0-9a-f]+\.html$/.test(filename)) return { filename: '', htmlBody: '' };
    if (!htmlBody) return { filename: '', htmlBody: '' };
    if (/<\s*script/i.test(htmlBody) || /<\s*iframe/i.test(htmlBody)) return { filename: '', htmlBody: '' };
    const safe = htmlBody.replace(/[^\r\n\x20-\x7E]/g, '');
    return { filename, htmlBody: safe };
}

function sanitizeSeoSettingsIncoming(incoming) {
    if (!incoming || typeof incoming !== 'object') return {};
    const out = { ...incoming };
    if (Object.prototype.hasOwnProperty.call(out, 'googleSiteVerification')) {
        out.googleSiteVerification = sanitizeGoogleSiteVerificationToken(out.googleSiteVerification);
    }
    if (Object.prototype.hasOwnProperty.call(out, 'googleSearchConsoleHtmlVerification')) {
        out.googleSearchConsoleHtmlVerification = sanitizeGoogleSearchConsoleHtmlVerification(
            out.googleSearchConsoleHtmlVerification
        );
    }
    return out;
}

module.exports = {
    sanitizeGoogleSiteVerificationToken,
    sanitizeGoogleSearchConsoleHtmlVerification,
    sanitizeSeoSettingsIncoming,
};
