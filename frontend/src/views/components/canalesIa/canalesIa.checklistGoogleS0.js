/**
 * Bloque §0 del checklist Google (TASKS/checklist-onboarding-google-hotel-center.md).
 * Datos desde GET /empresa y GET /auth/me — sin entrada manual salvo corrección del host.
 */

export function buildPublicBaseUrl(empresa) {
    const g = empresa?.websiteSettings?.general || {};
    const custom = String(g.domain || empresa?.dominio || '').trim();
    const sub = String(g.subdomain || empresa?.subdominio || '').trim().toLowerCase();
    if (custom) {
        const host = custom.replace(/^https?:\/\//i, '').split('/')[0].trim();
        if (host) return `https://${host}`;
    }
    if (sub) return `https://${sub}.suitemanagers.com`;
    return '';
}

/**
 * Texto plano listo para pegar en checklist / Notion / script §9.
 * @param {object} empresa respuesta GET /empresa
 * @param {{ email?: string }} authMe respuesta GET /auth/me
 */
export function buildChecklistGoogleS0PlainText(empresa, authMe) {
    const fecha = new Date().toISOString().slice(0, 10);
    const base = buildPublicBaseUrl(empresa);
    const hostLine = base || '(configura subdominio o dominio en Sitio público → Configuración Web)';
    const ghTokenHint = String(empresa?.websiteSettings?.integrations?.googleHotelsContentToken || '').trim()
        ? '(usa el mismo valor que “Token feed contenido Google Hotels” en esta vista)'
        : '(vacío — feed público sin token; no definas GH_FEED_TOKEN)';
    return [
        '- Empresa:',
        `  ${String(empresa?.nombre || '').trim()}`,
        '- empresaId:',
        `  ${String(empresa?.id || '').trim()}`,
        '- Host tenant validado (subdominio/dominio):',
        `  ${hostLine}`,
        '- Responsable:',
        `  ${String(authMe?.email || '').trim() || '(sin email en sesión)'}`,
        '- Fecha:',
        `  ${fecha}`,
        '',
        '--- PowerShell (desde la raíz del repo) — script checklist §9 ---',
        `$env:GH_FEED_BASE_URL = "${base || 'https://TU-HOST-PUBLICO'}"`,
        `# ${ghTokenHint}`,
        `$env:GH_FEED_TOKEN = ""`,
        'node backend/scripts/verify-google-hotels-feed-checklist.js',
    ].join('\n');
}

export function renderChecklistGoogleS0Shell(empresa) {
    const base = buildPublicBaseUrl(empresa);
    const hostMissing = !base;
    const hostWarningHtml = hostMissing ? `
            <div class="mb-3 flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800" role="alert">
                <i class="fa-solid fa-triangle-exclamation text-warning-500 text-lg flex-shrink-0 mt-0.5" aria-hidden="true"></i>
                <div class="min-w-0 flex-1">
                    <p class="font-semibold text-warning-900">Sin URL pública derivada</p>
                    <p class="text-xs text-warning-800 mt-1">
                        No hay subdominio ni dominio custom en la empresa: el script §9 y Google necesitan el host HTTPS del sitio público.
                        Configura <strong>subdominio</strong> o <strong>dominio</strong> en <strong>Sitio público → Configuración Web</strong>.
                    </p>
                    <button type="button" id="btn-checklist-s0-ir-website" class="btn-outline btn-sm mt-3 gap-1">
                        <i class="fa-solid fa-globe"></i> Ir a Configuración Web
                    </button>
                </div>
            </div>` : '';

    return `
        <div class="bg-white rounded-2xl border border-primary-100 shadow-sm p-5 mb-6">
            <h2 class="font-semibold text-gray-800 mb-1">Checklist Google — §0 automático</h2>
            <p class="text-xs text-gray-500 mb-3">
                Rellena empresa, ID, host público, responsable (sesión) y fecha. Verifica el host antes del script §9.
                Si falta URL, configura subdominio o dominio en <strong>Sitio público → Configuración Web</strong>.
            </p>
            ${hostWarningHtml}
            <pre id="checklist-s0-pre" class="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono text-gray-800 min-h-[10rem]"></pre>
            <div class="flex flex-wrap gap-2 mt-3">
                <button type="button" id="btn-copy-checklist-s0" class="btn-outline btn-sm gap-1">
                    <i class="fa-regular fa-copy"></i> Copiar todo (§0 + comando script)
                </button>
            </div>
        </div>`;
}
