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
            El botón abre la entrada de Search Console (sin fijar una propiedad), así no verás «no puedes acceder» hasta que exista una propiedad verificada en tu cuenta.
            Para <strong>añadir</strong> este sitio: <strong>Añadir propiedad</strong> → <strong>Prefijo de URL</strong> →
            <code class="text-gray-800 bg-white/80 px-1 py-0.5 rounded text-[11px] break-all">${esc(prefix)}</code>
            y completa la verificación con la misma cuenta de Google.
        </p>`;
}

function renderSearchConsoleVerificationTroubleshooting(prefix) {
    const urlLine = prefix
        ? `<p class="text-xs text-gray-700 mb-2">Usa exactamente este prefijo (copiar/pegar): <code class="break-all font-mono bg-white px-1 py-0.5 rounded border border-gray-200">${esc(prefix)}</code></p>`
        : '';
    return `
        <div class="rounded-xl border border-warning-200 bg-warning-50 p-4 mb-6">
            <h2 class="font-semibold text-warning-900 mb-2">Si Search Console no verifica el sitio</h2>
            <p class="text-xs text-warning-800 mb-2 max-w-3xl">En «Añadir propiedad» Google solo ofrece <strong>dos tipos de propiedad</strong> (Dominio vs Prefijo de URL). Eso no son todavía los métodos de verificación: <strong>etiqueta HTML, archivo, Analytics…</strong> aparecen en el <strong>siguiente paso</strong>, solo si eliges <strong>Prefijo de URL</strong>.</p>
            <ul class="text-xs text-warning-900 space-y-2 list-disc pl-5 m-0 max-w-3xl">
                <li><strong>Tipo de propiedad:</strong> elige <strong>Prefijo de URL</strong> (pega <code class="font-mono">https://…/</code>), no «Dominio». Si eliges Dominio, Google solo ofrece DNS TXT y fallará en <code class="font-mono">*.rezerva.cl</code> salvo que controles el DNS de la plataforma.</li>
                <li><strong>Ortografía:</strong> el dominio es <code class="font-mono">rezerva.cl</code>. Si creaste la propiedad con el dominio incorrecto, bórrala y créala de nuevo.</li>
                <li><strong>Método «Archivo HTML» (recomendado por Google):</strong> descarga el <code class="font-mono">google….html</code>. En el panel: <strong>Sitio público → Configurar sitio web</strong> → bloque «archivo HTML en la raíz»: <strong>Subir archivo</strong> (no hace falta copiar/pegar). Luego abre en el navegador <code class="font-mono">https://tu-host/google….html</code> y comprueba el texto antes de Verificar.</li>
                <li><strong>Método «Etiqueta HTML»:</strong> en Search Console elige esa opción. En el mismo formulario del panel, campo «Verificación Search Console» (solo el token de <code class="font-mono">content</code>), guarda y revisa el código fuente de la home por <code class="font-mono">meta name="google-site-verification"</code>.</li>
                <li><strong>Despliegue:</strong> tras guardar, espera unos minutos y recarga la home; luego pulsa «Verificar» en Google.</li>
            </ul>
            ${urlLine}
        </div>`;
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
            <h2 class="font-semibold text-gray-900 mb-1">Comprobación HTTP en vivo</h2>
            <p class="text-xs text-gray-500 mb-3">Lectura parcial del recurso desde el servidor del panel; no sustituye Search Console ni Bing Webmaster.</p>
            ${row('robots.txt', http.robots)}
            ${row('sitemap.xml', http.sitemap)}
        </div>`;
}

function renderPanelActions(actions = []) {
    if (!actions.length) {
        return `
            <div class="rounded-xl border border-success-200 bg-success-50 p-4 mb-6">
                <p class="text-sm text-success-800 font-medium">No hay acciones obligatorias en el panel según este diagnóstico.</p>
            </div>`;
    }
    return `
        <div class="rounded-xl border border-warning-200 bg-warning-50 p-4 mb-6">
            <h2 class="font-semibold text-warning-900 mb-3">Corregir en el panel</h2>
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

export async function render() {
    let data;
    try {
        data = await fetchAPI('/seo-monitor/tenant');
    } catch (error) {
        return `
            <div class="container mx-auto px-4 py-8 max-w-5xl">
                <div class="rounded-xl border border-danger-200 bg-danger-50 p-4">
                    <h2 class="text-danger-700 font-semibold mb-1">No se pudo cargar el diagnóstico SEO</h2>
                    <p class="text-sm text-danger-700">${esc(error.message)}</p>
                </div>
            </div>
        `;
    }

    const checks = data.checks || [];
    const links = data.links || {};
    const m = data.metrics || {};
    const empresa = data.empresa || {};

    return `
        <div class="container mx-auto px-4 py-8 max-w-5xl">
            <div class="mb-6">
                <h1 class="text-2xl font-bold text-gray-900">SEO de mi sitio público</h1>
                <p class="text-sm text-gray-500 mt-1">
                    Diagnóstico técnico SSR por empresa (${esc(empresa.host || 'host no configurado')}).
                </p>
                ${empresa.alternatePublicHost ? `
                <p class="text-xs text-gray-500 mt-2">
                    También tienes configurado el host <span class="font-mono text-gray-700">${esc(empresa.alternatePublicHost)}</span>.
                    Las comprobaciones HTTP usan el host principal de SuiteManagers; en Search Console puede que la propiedad sea el otro dominio.
                </p>` : ''}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="rounded-xl border border-gray-200 bg-white p-4">
                    <p class="text-xs text-gray-500">Propiedades totales</p>
                    <p class="text-2xl font-semibold text-gray-900">${Number(m.totalProperties || 0)}</p>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-4">
                    <p class="text-xs text-gray-500">Listadas/indexables</p>
                    <p class="text-2xl font-semibold text-gray-900">${Number(m.listedProperties || 0)}</p>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-4">
                    <p class="text-xs text-gray-500">Con portada</p>
                    <p class="text-2xl font-semibold text-gray-900">${Number(m.propertiesWithCardImage || 0)}</p>
                </div>
            </div>

            ${renderSearchConsoleVerificationTroubleshooting(links.searchConsolePropertyPrefix)}

            ${renderHttpChecks(data.httpChecks)}

            ${renderPanelActions(data.panelActions || [])}

            <div class="rounded-xl border border-primary-200 bg-primary-50 p-4 mb-6">
                <h2 class="font-semibold text-primary-900 mb-2">Accesos útiles</h2>
                <div class="flex flex-wrap gap-2">
                    ${linkButton(links.home, 'Abrir Home SSR')}
                    ${linkButton(links.sitemap, 'Abrir sitemap.xml')}
                    ${linkButton(links.robots, 'Abrir robots.txt')}
                    ${linkButton(links.searchConsole, 'Google Search Console')}
                    ${linkButton(links.bingWebmaster, 'Bing Webmaster')}
                </div>
                ${renderSearchConsoleHint(links.searchConsolePropertyPrefix)}
            </div>

            <div class="mb-6">
                <h2 class="font-semibold text-gray-900 mb-3">Checklist técnico</h2>
                ${renderChecks(checks)}
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
