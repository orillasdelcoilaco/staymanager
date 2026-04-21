// frontend/src/views/components/configurarWebPublica/webPublica.general.view.js
// Vista de edición normal del sitio web (post-wizard)
import { fetchAPI } from '../../../api.js';
import { openEditor } from '../../../utils/imageEditorModal.js';

let _onResetWizard = null;
let _ref = {};

// --- Helpers ---
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = v => (v === undefined || v === null || v === 'undefined') ? '' : v;
const setStatus = (el, text, type = 'primary') => {
    if (!el) return;
    el.textContent = text;
    el.className = `text-xs mt-1 text-${type}-600`;
};
const attach = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ne = el.cloneNode(true);
    el.parentNode.replaceChild(ne, el);
    ne.addEventListener('click', fn);
};

function _cardPerfil(empresaData) {
    const enfoques = ['Familiar', 'Parejas', 'Negocios', 'Aventura', 'Relax', 'Económico', 'Lujo', 'Otro'];
    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-800">Perfil e Identidad</h3>
            <button id="v-btn-regen" class="btn-outline btn-sm gap-1">
                <i class="fa-solid fa-wand-magic-sparkles text-primary-500"></i> Regenerar con IA
            </button>
        </div>
        <div class="space-y-3">
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Historia / Descripción del Negocio</label>
                <textarea id="v-historia" rows="4" class="form-input w-full resize-none">${esc(clean(empresaData.historiaEmpresa))}</textarea>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Slogan</label>
                <input type="text" id="v-slogan" class="form-input" value="${esc(clean(empresaData.slogan))}">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Tipo de Alojamiento</label>
                    <input type="text" id="v-tipo" class="form-input" value="${esc(clean(empresaData.tipoAlojamientoPrincipal))}">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Enfoque de Marketing</label>
                    <select id="v-enfoque" class="form-select">
                        <option value="">-- Selecciona --</option>
                        ${enfoques.map(e => `<option value="${e}" ${empresaData.enfoqueMarketing === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Palabras Clave SEO</label>
                <input type="text" id="v-keywords" class="form-input" value="${esc(clean(empresaData.palabrasClaveAdicionales))}">
            </div>
        </div>
    </div>`;
}

function _cardContenido(content, seo) {
    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-semibold text-gray-800 mb-4">Contenido Web (Página de Inicio)</h3>
        <div class="space-y-3">
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Título Principal (H1)</label>
                <input type="text" id="v-h1" class="form-input" value="${esc(clean(content.homeH1))}">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Párrafo Introductorio</label>
                <textarea id="v-intro" rows="3" class="form-input w-full resize-none">${esc(clean(content.homeIntro))}</textarea>
            </div>
            <div class="pt-3 border-t border-gray-100">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Meta Tags SEO</p>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Meta Título</label>
                        <input type="text" id="v-seo-title" class="form-input" value="${esc(clean(seo.homeTitle))}">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Meta Descripción</label>
                        <textarea id="v-seo-desc" rows="2" class="form-input w-full resize-none">${esc(clean(seo.homeDescription))}</textarea>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function _cardVisual(theme) {
    const noLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect width='80' height='40' fill='%23f3f4f6'/%3E%3Ctext x='40' y='20' font-family='Arial' font-size='9' fill='%239ca3af' text-anchor='middle' dy='.35em'%3ESin Logo%3C/text%3E%3C/svg%3E";
    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-semibold text-gray-800 mb-4">Identidad Visual</h3>
        <div class="space-y-4">
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-2">Logo</label>
                <div class="flex items-center gap-4">
                    <img id="logo-preview" src="${theme.logoUrl || noLogo}" alt="Logo" class="h-12 w-auto max-w-[140px] object-contain bg-gray-50 rounded border p-1">
                    <div class="flex-1">
                        <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" class="form-input-file text-sm">
                        <div id="logo-upload-status" class="text-xs mt-1 min-h-[1rem] text-gray-500"></div>
                    </div>
                </div>
                <input type="hidden" id="config-logo" value="${esc(clean(theme.logoUrl))}">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-2">Imagen de Portada (Hero)</label>
                <div class="grid grid-cols-2 gap-3 items-start">
                    <div>
                        <input type="file" id="upload-hero-image-input" accept="image/*" class="form-input-file text-sm">
                        <button type="button" id="upload-hero-image-btn" class="btn-outline btn-sm mt-2 gap-1">
                            <i class="fa-solid fa-cloud-arrow-up"></i> Subir
                        </button>
                        <div id="upload-hero-status" class="text-xs mt-1 min-h-[1rem] text-gray-500"></div>
                    </div>
                    <div id="hero-preview-container">
                        ${theme.heroImageUrl
                            ? `<img src="${theme.heroImageUrl}" alt="" class="w-full h-24 object-cover rounded-xl border">`
                            : '<div class="w-full h-24 flex items-center justify-center bg-gray-50 text-gray-400 text-xs rounded-xl border">Sin imagen</div>'
                        }
                    </div>
                </div>
            </div>
            <div class="pt-3 border-t border-gray-100">
                <label class="block text-xs font-medium text-gray-500 mb-1">Estilo Visual</label>
                <select id="config-visual-style" class="form-select">
                    <option value="moderno" ${theme.visualStyle === 'moderno' ? 'selected' : ''}>Moderno</option>
                    <option value="tradicional" ${theme.visualStyle === 'tradicional' ? 'selected' : ''}>Tradicional</option>
                    <option value="rustico" ${theme.visualStyle === 'rustico' ? 'selected' : ''}>Rústico</option>
                    <option value="minimalista" ${theme.visualStyle === 'minimalista' ? 'selected' : ''}>Minimalista</option>
                    <option value="elegante" ${theme.visualStyle === 'elegante' ? 'selected' : ''}>Elegante</option>
                </select>
            </div>
        </div>
    </div>`;
}

function _cardTecnico(general) {
    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-semibold text-gray-800 mb-4">Técnico y Contacto</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Dominio Personalizado</label>
                <input type="text" id="config-domain" class="form-input" value="${esc(clean(general.domain))}" placeholder="www.miempresa.com">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">WhatsApp / Teléfono</label>
                <input type="text" id="config-whatsapp" class="form-input" value="${esc(clean(general.whatsapp))}" placeholder="+56912345678">
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-medium text-gray-500 mb-1">URL Google Maps (embed)</label>
                <input type="text" id="config-maps-url" class="form-input" value="${esc(clean(general.googleMapsUrl))}" placeholder="https://maps.google.com/...">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Google Analytics / GTM ID</label>
                <input type="text" id="config-ga-id" class="form-input" value="${esc(clean(general.gaTrackingId))}" placeholder="G-XXXXXXXXXX">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Subdominio (Render)</label>
                <div class="flex items-center">
                    <input type="text" id="config-subdomain" class="form-input rounded-r-none bg-gray-50 text-gray-500 cursor-not-allowed" value="${esc(clean(general.subdomain))}" readonly>
                    <span class="inline-flex items-center px-3 text-xs text-gray-400 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md h-10">.onrender.com</span>
                </div>
            </div>
        </div>
    </div>`;
}

export function renderView(empresaData) {
    _ref = empresaData;
    const settings = empresaData.websiteSettings || {};
    const general = settings.general || {};
    const theme = settings.theme || {};
    return `
    <div class="space-y-4">
        <div class="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-2xl px-5 py-3">
            <div class="flex items-center gap-2 text-sm text-primary-700">
                <i class="fa-solid fa-circle-check text-primary-500"></i>
                <span class="font-medium">Sitio web configurado</span>
            </div>
            <button id="v-btn-rewizard" class="btn-outline btn-sm gap-1 text-primary-600 border-primary-300">
                <i class="fa-solid fa-wand-magic-sparkles"></i> Reconfigurar con Asistente IA
            </button>
        </div>
        ${_cardPerfil(empresaData)}
        ${_cardContenido(settings.content || {}, settings.seo || {})}
        ${_cardVisual(theme)}
        ${_cardTecnico(general)}
        <div class="flex justify-between items-center pt-4 border-t border-gray-100">
            <button id="v-btn-preview" class="btn-outline gap-2">
                <i class="fa-solid fa-eye"></i> Vista Previa
            </button>
            <button id="v-btn-save" class="btn-primary px-8">Guardar Cambios</button>
        </div>
    </div>`;
}

export function setupViewEvents(empresaData, onResetWizard) {
    _ref = empresaData;
    _onResetWizard = onResetWizard;

    attach('v-btn-rewizard', () => {
        if (confirm('¿Deseas reconfigurar el sitio con el Asistente IA?')) {
            if (_onResetWizard) _onResetWizard();
        }
    });

    attach('v-btn-regen', async (e) => {
        const historia = document.getElementById('v-historia')?.value?.trim();
        if (!historia || historia.length < 10) return alert('Escribe una descripción primero.');
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Generando...';
        try {
            const r = await fetchAPI('/website/optimize-profile', { method: 'POST', body: { historia } });
            const campos = {
                'v-slogan': r.slogan, 'v-tipo': r.tipoAlojamientoPrincipal,
                'v-enfoque': r.enfoqueMarketing, 'v-keywords': r.palabrasClaveAdicionales,
                'v-h1': r.homeH1, 'v-intro': r.homeIntro,
                'v-seo-title': r.homeSeoTitle, 'v-seo-desc': r.homeSeoDesc,
            };
            Object.entries(campos).forEach(([id, val]) => {
                if (val) { const el = document.getElementById(id); if (el) el.value = val; }
            });
        } catch (e2) { alert(`Error: ${e2.message}`); }
        finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles text-primary-500 mr-1"></i> Regenerar con IA';
        }
    });

    attach('v-btn-save', _save);
    attach('v-btn-preview', _openPreview);

    attach('upload-hero-image-btn', () => {
        const f = document.getElementById('upload-hero-image-input')?.files?.[0];
        if (!f) return alert('Selecciona una imagen primero.');
        openEditor(f, blob => _uploadHero(blob));
    });

    const logoInput = document.getElementById('logoFile');
    if (logoInput) {
        const ni = logoInput.cloneNode(true);
        logoInput.parentNode.replaceChild(ni, logoInput);
        ni.addEventListener('change', e => { if (e.target.files[0]) _uploadLogo(e.target.files[0]); });
    }
}

async function _uploadLogo(file) {
    const statusEl = document.getElementById('logo-upload-status');
    setStatus(statusEl, 'Subiendo...', 'primary');
    const fd = new FormData();
    fd.append('logoFile', file);
    try {
        const r = await fetchAPI('/empresa/upload-logo', { method: 'POST', body: fd });
        const preview = document.getElementById('logo-preview');
        const hidden = document.getElementById('config-logo');
        if (preview) preview.src = r.logoUrl;
        if (hidden) hidden.value = r.logoUrl;
        setStatus(statusEl, '¡Logo actualizado!', 'success');
    } catch (e) { setStatus(statusEl, `Error: ${e.message}`, 'danger'); }
}

async function _uploadHero(blob) {
    const statusEl = document.getElementById('upload-hero-status');
    setStatus(statusEl, 'Subiendo...', 'primary');
    const fd = new FormData();
    fd.append('heroImage', blob, 'hero.jpg');
    try {
        const r = await fetchAPI('/website/upload-hero-image', { method: 'POST', body: fd });
        const url = r['websiteSettings.theme.heroImageUrl'];
        const container = document.getElementById('hero-preview-container');
        if (container && url) container.innerHTML = `<img src="${url}" alt="" class="w-full h-24 object-cover rounded-xl border">`;
        setStatus(statusEl, 'Imagen subida con éxito.', 'success');
    } catch (e) { setStatus(statusEl, `Error: ${e.message}`, 'danger'); }
}

function _openPreview() {
    const subdomain = document.getElementById('config-subdomain')?.value || _ref.websiteSettings?.general?.subdomain;
    if (!subdomain) {
        alert('Primero guarda los cambios para generar la vista previa.');
        return;
    }
    const url = `https://${subdomain}.onrender.com`;
    window.open(url, '_blank');
}

async function _save() {
    const btn = document.getElementById('v-btn-save');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    const settings = _ref.websiteSettings || {};
    const general = settings.general || {};

    const websitePayload = {
        general: {
            subdomain: document.getElementById('config-subdomain')?.value || clean(general.subdomain),
            domain: document.getElementById('config-domain')?.value || '',
            wizardCompleted: true,
            whatsapp: document.getElementById('config-whatsapp')?.value || '',
            googleMapsUrl: document.getElementById('config-maps-url')?.value || '',
            gaTrackingId: document.getElementById('config-ga-id')?.value || '',
        },
        theme: {
            logoUrl: document.getElementById('config-logo')?.value || '',
            visualStyle: document.getElementById('config-visual-style')?.value || 'moderno',
            heroImageUrl: _ref.websiteSettings?.theme?.heroImageUrl || '',
        },
        content: {
            homeH1: document.getElementById('v-h1')?.value || '',
            homeIntro: document.getElementById('v-intro')?.value || '',
        },
        seo: {
            homeTitle: document.getElementById('v-seo-title')?.value || '',
            homeDescription: document.getElementById('v-seo-desc')?.value || '',
        },
    };

    const empresaPayload = {
        slogan: document.getElementById('v-slogan')?.value || '',
        historiaEmpresa: document.getElementById('v-historia')?.value || '',
        tipoAlojamientoPrincipal: document.getElementById('v-tipo')?.value || '',
        enfoqueMarketing: document.getElementById('v-enfoque')?.value || '',
        palabrasClaveAdicionales: document.getElementById('v-keywords')?.value || '',
    };

    try {
        await Promise.all([
            fetchAPI('/website/home-settings', { method: 'PUT', body: websitePayload }),
            fetchAPI('/empresa', { method: 'PUT', body: empresaPayload }),
        ]);
        if (btn) { btn.textContent = '¡Guardado!'; }
        setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = 'Guardar Cambios'; } }, 2000);
    } catch (e) {
        alert(`Error al guardar: ${e.message}`);
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
    }
}
