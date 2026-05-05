import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function statusBadge(status) {
    if (status === 'ok') {
        return '<span class="inline-flex items-center rounded-full bg-success-100 text-success-700 px-2 py-0.5 text-xs font-semibold">OK</span>';
    }
    return '<span class="inline-flex items-center rounded-full bg-warning-100 text-warning-700 px-2 py-0.5 text-xs font-semibold">Revisar</span>';
}

function renderHttpChecks(http) {
    if (!http) return '';
    if (http.skipped) {
        return `
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-6">
                <h2 class="font-semibold text-gray-900 mb-2">Comprobación HTTP (robots / sitemap)</h2>
                <p class="text-sm text-gray-600">${esc(http.reason || 'Omitido')}</p>
            </div>`;
    }
    const row = (label, p) => {
        const ok = p && p.ok && p.status === 200;
        const detail = p?.error
            ? `Error: ${p.error}`
            : `HTTP ${p?.status ?? '—'} · ${p?.durationMs ?? '—'} ms · ${esc(p?.contentType || '—')}`;
        return `
            <div class="flex flex-col gap-1 py-3 border-b border-gray-100 last:border-b-0">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium text-gray-800">${esc(label)}</span>
                    ${statusBadge(ok ? 'ok' : 'warn')}
                </div>
                <p class="text-xs text-gray-500 break-all">${esc(detail)}</p>
                <p class="text-xs text-gray-400 font-mono break-all">${esc(p?.url || '')}</p>
            </div>`;
    };
    return `
        <div class="rounded-xl border border-gray-200 bg-white p-4 mb-6 shadow-sm">
            <h2 class="font-semibold text-gray-900 mb-1">Comprobación HTTP en vivo (plataforma)</h2>
            <p class="text-xs text-gray-500 mb-3">Lectura parcial desde el backend; fallos aquí suelen ser DNS, SSL o despliegue del apex.</p>
            ${row('robots.txt', http.robots)}
            ${row('sitemap.xml', http.sitemap)}
        </div>`;
}

function linkButton(url, label) {
    if (!url) return '';
    return `
        <a href="${esc(url)}" target="_blank" rel="noopener noreferrer"
           class="btn-outline btn-sm inline-flex items-center gap-2">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>${esc(label)}
        </a>
    `;
}

function renderSearchConsoleHint(prefix) {
    if (!prefix) return '';
    return `
        <p class="text-xs text-gray-600 mt-3 max-w-2xl leading-relaxed">
            El botón abre la entrada de Search Console sin fijar propiedad. Para el marketplace, al añadir propiedad usa <strong>Prefijo de URL</strong> con
            <code class="text-gray-800 bg-white/80 px-1 py-0.5 rounded text-[11px] break-all">${esc(prefix)}</code>
            y verifica con una cuenta que gestione el dominio de la plataforma.
        </p>`;
}

function renderPanelActions(actions = []) {
    if (!actions.length) {
        return `
            <div class="rounded-xl border border-success-200 bg-success-50 p-4 mb-6">
                <p class="text-sm text-success-800 font-medium">No hay acciones de panel sugeridas para este estado del marketplace.</p>
            </div>`;
    }
    return `
        <div class="rounded-xl border border-warning-200 bg-warning-50 p-4 mb-6">
            <h2 class="font-semibold text-warning-900 mb-3">Corregir desde el panel (tenant actual)</h2>
            <p class="text-xs text-warning-800 mb-3">Las métricas son globales; los botones abren el flujo habitual de la empresa con la que iniciaste sesión.</p>
            <ul class="space-y-3 list-none p-0 m-0">
                ${actions.map((a) => `
                    <li class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-warning-100 bg-white/80 px-3 py-2">
                        <span class="text-sm text-gray-800">${esc(a.label || '')}</span>
                        ${a.path ? `
                            <button type="button" class="btn-primary btn-sm seo-action-nav shrink-0" data-path="${esc(a.path)}">
                                <i class="fa-solid fa-wrench"></i> Ir a corregir
                            </button>` : ''}
                    </li>
                `).join('')}
            </ul>
        </div>`;
}

function renderChecks(checks = []) {
    if (!checks.length) return '<p class="text-sm text-gray-500">Sin checks disponibles.</p>';
    return `
        <div class="space-y-3">
            ${checks.map((c) => `
                <div class="rounded-xl border border-gray-200 p-4">
                    <div class="flex items-center justify-between gap-3 mb-1">
                        <h3 class="font-medium text-gray-800">${esc(c.label)}</h3>
                        ${statusBadge(c.status)}
                    </div>
                    <p class="text-sm text-gray-600">${esc(c.detail || '')}</p>
                    ${c.hint ? `<p class="text-xs text-gray-500 mt-2">Sugerencia: ${esc(c.hint)}</p>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

export async function render() {
    let data;
    try {
        data = await fetchAPI('/seo-monitor/platform');
    } catch (error) {
        const forbidden = error?.status === 403;
        return `
            <div class="container mx-auto px-4 py-8 max-w-5xl">
                <div class="rounded-xl border ${forbidden ? 'border-warning-200 bg-warning-50' : 'border-danger-200 bg-danger-50'} p-4">
                    <h2 class="${forbidden ? 'text-warning-800' : 'text-danger-700'} font-semibold mb-1">
                        ${forbidden ? 'Acceso restringido' : 'No se pudo cargar el módulo'}
                    </h2>
                    <p class="text-sm ${forbidden ? 'text-warning-800' : 'text-danger-700'}">${esc(error.message)}</p>
                </div>
            </div>
        `;
    }

    const platform = data.platform || {};
    const metrics = data.metrics || {};
    const links = data.links || {};

    return `
        <div class="container mx-auto px-4 py-8 max-w-5xl">
            <div class="mb-6">
                <h1 class="text-2xl font-bold text-gray-900">SuiteManagers — Buscadores (plataforma)</h1>
                <p class="text-sm text-gray-500 mt-1">
                    Vista operativa exclusiva de superadministración para ${esc(platform.domain || 'suitemanagers.com')}.
                </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="rounded-xl border border-gray-200 bg-white p-4">
                    <p class="text-xs text-gray-500">Propiedades activas marketplace</p>
                    <p class="text-2xl font-semibold text-gray-900">${Number(metrics.marketplaceActiveProperties || 0)}</p>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-4">
                    <p class="text-xs text-gray-500">Propiedades listadas (`isListed=true`)</p>
                    <p class="text-2xl font-semibold text-gray-900">${Number(metrics.marketplaceListedProperties || 0)}</p>
                </div>
            </div>

            ${renderHttpChecks(data.httpChecks)}

            ${renderPanelActions(data.panelActions || [])}

            <div class="rounded-xl border border-primary-200 bg-primary-50 p-4 mb-6">
                <h2 class="font-semibold text-primary-900 mb-2">Accesos plataforma</h2>
                <div class="flex flex-wrap gap-2">
                    ${linkButton(links.home, 'Abrir Home marketplace')}
                    ${linkButton(links.marketplaceGoogleHotels, 'Abrir catálogo Google Hotels')}
                    ${linkButton(links.sitemap, 'Abrir sitemap.xml')}
                    ${linkButton(links.robots, 'Abrir robots.txt')}
                    ${linkButton(links.searchConsole, 'Google Search Console')}
                    ${linkButton(links.bingWebmaster, 'Bing Webmaster')}
                </div>
                ${renderSearchConsoleHint(links.searchConsolePropertyPrefix)}
            </div>

            <div>
                <h2 class="font-semibold text-gray-900 mb-3">Checklist plataforma</h2>
                ${renderChecks(data.checks || [])}
            </div>
        </div>
    `;
}

export function afterRender() {
    document.querySelectorAll('.seo-action-nav').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const path = btn.getAttribute('data-path');
            if (path) handleNavigation(path);
        });
    });
}
