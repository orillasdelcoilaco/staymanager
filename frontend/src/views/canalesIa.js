/**
 * Punto único de configuración usuario para canales IA (Google Hotel Center, feeds, etc.).
 */
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import {
    unifyIntegrationsFeedsSection,
    unifyGoogleHotelsHealthSection,
} from './components/configurarWebPublica/webPublica.general.unified.markup.js';
import { loadGoogleHotelsHealth } from './components/configurarWebPublica/webPublica.general.unified.handlers.js';
import {
    buildChecklistGoogleS0PlainText,
    renderChecklistGoogleS0Shell,
} from './components/canalesIa/canalesIa.checklistGoogleS0.js';
import {
    renderGooglePartnerOperatorSection,
    setupGooglePartnerOperatorUi,
} from './components/canalesIa/canalesIa.googlePartner.operator.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Texto §0 generado en render (copiar en afterRender). */
let checklistS0PlainSnapshot = '';

/** Marketplace público — catálogo §7.6 (host apex producción). */
const CATALOGO_GOOGLE_HOTELS_URL = 'https://suitemanagers.com/google-hotels';

function renderPropiedadesGoogleTable(propiedades) {
    if (!propiedades?.length) {
        return `<p class="text-sm text-gray-500">No hay alojamientos. Crea uno en <strong>Inventario → Alojamientos</strong>.</p>`;
    }
    const rows = propiedades.map((p) => {
        const gh = p.googleHotelData || {};
        const hid = esc(gh.hotelId || '');
        const listed = !!gh.isListed;
        return `
            <tr class="border-b border-gray-100" data-gh-prop-id="${esc(p.id)}">
                <td class="py-2 pr-3 text-sm font-medium text-gray-800">${esc(p.nombre || '(sin nombre)')}</td>
                <td class="py-2 pr-3">
                    <input type="text" class="form-input text-sm font-mono w-full max-w-xs gh-inp-hotel-id" value="${hid}" placeholder="Hotel Center ID" maxlength="128" autocomplete="off">
                </td>
                <td class="py-2 pr-3 text-center">
                    <label class="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" class="rounded text-primary-600 gh-inp-listed" ${listed ? 'checked' : ''}>
                        <span class="sr-only">Listado</span>
                    </label>
                </td>
                <td class="py-2">
                    <button type="button" class="btn-primary btn-sm gh-btn-save">Guardar</button>
                </td>
            </tr>`;
    }).join('');
    return `
        <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
                <thead>
                    <tr class="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                        <th class="pb-2 pr-3">Alojamiento</th>
                        <th class="pb-2 pr-3">ID Google Hotel Center</th>
                        <th class="pb-2 pr-3 text-center">Publicar en Web/Google</th>
                        <th class="pb-2">Acción</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function renderGoogleTab(empresa, propiedades) {
    const general = empresa.websiteSettings?.general || {};
    return `
        <div id="canales-ia-panel-google">
            ${renderChecklistGoogleS0Shell(empresa)}
            ${unifyIntegrationsFeedsSection(empresa, general)}
            <div class="flex justify-end mb-6">
                <button type="button" id="btn-save-canales-ia-integrations" class="btn-primary btn-sm gap-1">
                    <i class="fa-solid fa-floppy-disk"></i> Guardar tokens de feeds
                </button>
            </div>
            ${unifyGoogleHotelsHealthSection()}
            ${renderGooglePartnerOperatorSection()}
            <div class="bg-white rounded-2xl border border-primary-100 shadow-sm p-5 mb-6">
                <h2 class="font-semibold text-gray-800 mb-1">Catálogo público (Connectivity Partner)</h2>
                <p class="text-sm text-gray-600 mb-3">
                    En la web de la plataforma: listado de alojamientos opt-in para Google Hotels (misma elegibilidad que el Property List global).
                </p>
                <a href="${esc(CATALOGO_GOOGLE_HOTELS_URL)}" target="_blank" rel="noopener noreferrer" class="btn-outline btn-sm gap-1 inline-flex items-center">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    Abrir catálogo Google Hotels
                </a>
            </div>
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                <h2 class="font-semibold text-gray-800 mb-1">Alojamientos y Google Hotels</h2>
                <p class="text-xs text-gray-500 mb-4">Vincula cada propiedad al ID de Hotel Center y define si participa en el feed/listado.</p>
                ${renderPropiedadesGoogleTable(propiedades)}
            </div>
        </div>`;
}

function renderChatgptTab() {
    return `
        <div id="canales-ia-panel-chatgpt" class="hidden">
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                <h2 class="font-semibold text-gray-800 mb-2">ChatGPT y venta por IA</h2>
                <p class="text-sm text-gray-600 mb-3">
                    La política comercial mostrada en conversaciones (por ejemplo, mascotas) y el calendario de demanda del sitio público se configuran en
                    <strong>Sitio público → Configuración Web</strong>, junto con depósitos y reservas.
                </p>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-xs text-gray-700 space-y-2">
                    <p class="font-semibold text-gray-800">API pública</p>
                    <p id="canales-ia-public-version" class="font-mono text-gray-600">Consultando versión desplegada…</p>
                    <p class="text-gray-500">
                        Contrato OpenAPI del repo: <span class="font-mono">openapi/openapi-chatgpt.yaml</span> (ChatGPT Actions / integradores).
                        Misma lógica de negocio que el sitio público y este panel.
                    </p>
                </div>
                <button type="button" id="btn-canales-ia-ir-website" class="btn-outline btn-sm gap-1">
                    <i class="fa-solid fa-globe"></i> Ir a Configuración Web
                </button>
            </div>
        </div>`;
}

function renderGeminiTab() {
    return `
        <div id="canales-ia-panel-gemini" class="hidden">
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                <h2 class="font-semibold text-gray-800 mb-2">Gemini (Google AI Studio)</h2>
                <p class="text-sm text-gray-600 mb-3">
                    Usa el mismo backend que ChatGPT; no hay toggles obligatorios por empresa en esta pestaña.
                    Contrato YAML en repo: <span class="font-mono text-xs">openapi/openapi-gemini.yaml</span>.
                </p>
                <p class="text-xs text-gray-500 mb-4">
                    Ajustes compartidos (políticas, depósitos, mapa de calor) siguen en <strong>Sitio público → Configuración Web</strong>.
                </p>
                <button type="button" id="btn-canales-ia-gemini-ir-website" class="btn-outline btn-sm gap-1">
                    <i class="fa-solid fa-globe"></i> Ir a Configuración Web
                </button>
            </div>
        </div>`;
}

export async function render() {
    let empresa;
    let propiedades;
    let authMe = {};
    try {
        [empresa, propiedades, authMe] = await Promise.all([
            fetchAPI('/empresa'),
            fetchAPI(`/propiedades?t=${Date.now()}`),
            fetchAPI('/auth/me').catch(() => ({})),
        ]);
    } catch (e) {
        return `<div class="p-8"><p class="text-danger-600">No se pudieron cargar los datos: ${esc(e.message)}</p></div>`;
    }

    checklistS0PlainSnapshot = buildChecklistGoogleS0PlainText(empresa, authMe);

    const general = empresa.websiteSettings?.general || {};

    return `
        <div class="container mx-auto px-4 py-8 max-w-5xl">
            <div class="mb-6">
                <h1 class="text-2xl font-bold text-gray-900">Canales IA</h1>
                <p class="text-gray-500 text-sm mt-1">
                    Conectores externos (Google Travel, asistentes, OpenAPI): feeds, tokens y mapeo por alojamiento.
                    Host público:
                    <span class="font-mono text-gray-700">${esc(general.subdomain || empresa.subdominio || '…')}.suitemanagers.com</span>
                </p>
                <div class="mt-3 p-3 rounded-lg bg-primary-50 border border-primary-100 text-xs text-primary-900">
                    <strong class="font-semibold">Organización:</strong>
                    <strong>Inventario</strong> define el producto;
                    <strong>Sitio público</strong> es tu web SSR;
                    <strong>Canales IA</strong> es cómo te enlazan terceros (esta vista).
                </div>
            </div>

            <div class="flex flex-wrap gap-2 border-b border-gray-200 mb-6">
                <button type="button" class="canales-ia-tab px-4 py-2 text-sm font-medium border-b-2 border-primary-600 text-primary-800 -mb-px" data-canales-tab="google">
                    Google Hotels
                </button>
                <button type="button" class="canales-ia-tab px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 -mb-px" data-canales-tab="chatgpt">
                    ChatGPT
                </button>
                <button type="button" class="canales-ia-tab px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-800 -mb-px" data-canales-tab="gemini">
                    Gemini
                </button>
            </div>

            ${renderGoogleTab(empresa, propiedades)}
            ${renderChatgptTab()}
            ${renderGeminiTab()}
        </div>`;
}

function setupTabSwitching() {
    const tabs = document.querySelectorAll('.canales-ia-tab');
    const panels = {
        google: document.getElementById('canales-ia-panel-google'),
        chatgpt: document.getElementById('canales-ia-panel-chatgpt'),
        gemini: document.getElementById('canales-ia-panel-gemini'),
    };
    tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
            const name = btn.getAttribute('data-canales-tab');
            tabs.forEach((t) => {
                const active = t.getAttribute('data-canales-tab') === name;
                t.classList.toggle('border-primary-600', active);
                t.classList.toggle('text-primary-800', active);
                t.classList.toggle('border-transparent', !active);
                t.classList.toggle('text-gray-500', !active);
            });
            Object.entries(panels).forEach(([key, el]) => {
                if (el) el.classList.toggle('hidden', key !== name);
            });
        });
    });
}

function attach(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    const ne = el.cloneNode(true);
    el.parentNode.replaceChild(ne, el);
    ne.addEventListener('click', fn);
}

export function afterRender() {
    setupTabSwitching();

    const verEl = document.getElementById('canales-ia-public-version');
    if (verEl) {
        fetchAPI('/public/version')
            .then((r) => {
                verEl.textContent = `GET /api/public/version → versión ${esc(r.version || '—')}, ${esc(r.timestamp || '')}`;
            })
            .catch(() => {
                verEl.textContent = 'No se pudo leer GET /api/public/version (revisa que el backend esté arriba).';
            });
    }

    document.getElementById('btn-canales-ia-ir-website')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleNavigation('/website-general');
    });
    document.getElementById('btn-canales-ia-gemini-ir-website')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleNavigation('/website-general');
    });
    document.getElementById('btn-checklist-s0-ir-website')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleNavigation('/website-general');
    });

    const preS0 = document.getElementById('checklist-s0-pre');
    if (preS0) preS0.textContent = checklistS0PlainSnapshot;

    attach('btn-copy-checklist-s0', async () => {
        try {
            await navigator.clipboard.writeText(checklistS0PlainSnapshot);
            alert('Copiado al portapapeles.');
        } catch {
            alert('No se pudo copiar. Selecciona el texto del recuadro manualmente.');
        }
    });

    attach('btn-save-canales-ia-integrations', async () => {
        const btn = document.getElementById('btn-save-canales-ia-integrations');
        const orig = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
        }
        try {
            const ari = (document.getElementById('integration-ari-token')?.value || '').trim();
            const gh = (document.getElementById('integration-google-hotels-token')?.value || '').trim();
            await fetchAPI('/website/home-settings', {
                method: 'PUT',
                body: { integrations: { ariFeedToken: ari, googleHotelsContentToken: gh } },
            });
            await loadGoogleHotelsHealth({ fetchAPI });
        } catch (err) {
            alert(`Error al guardar tokens: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = orig || '<i class="fa-solid fa-floppy-disk"></i> Guardar tokens de feeds';
            }
        }
    });

    attach('btn-google-hotels-health-refresh', () => loadGoogleHotelsHealth({ fetchAPI }));

    loadGoogleHotelsHealth({ fetchAPI }).catch((e) => console.warn('[google-hotels-health]', e.message));

    setupGooglePartnerOperatorUi(fetchAPI).catch((e) => console.warn('[google-partner-operator]', e.message));

    document.getElementById('canales-ia-panel-google')?.addEventListener('click', async (e) => {
        const t = e.target;
        if (!t.classList?.contains('gh-btn-save')) return;
        const tr = t.closest('tr[data-gh-prop-id]');
        if (!tr) return;
        const id = tr.getAttribute('data-gh-prop-id');
        const hotelId = tr.querySelector('.gh-inp-hotel-id')?.value?.trim() || '';
        const isListed = !!tr.querySelector('.gh-inp-listed')?.checked;
        t.disabled = true;
        const prev = t.innerHTML;
        t.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        try {
            await fetchAPI(`/propiedades/${id}`, {
                method: 'PUT',
                body: { googleHotelData: { hotelId, isListed } },
            });
            t.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { t.innerHTML = prev; }, 1200);
        } catch (err) {
            alert(err.message || 'Error al guardar');
            t.innerHTML = prev;
        } finally {
            t.disabled = false;
        }
    });
}
