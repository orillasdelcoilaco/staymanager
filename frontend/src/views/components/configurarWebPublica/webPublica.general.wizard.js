// frontend/src/views/components/configurarWebPublica/webPublica.general.wizard.js
// Wizard de 3 pasos para configuración inicial del sitio web de la empresa
import { fetchAPI } from '../../../api.js';
import { openEditor } from '../../../utils/imageEditorModal.js';

// --- Módulo de estado ---
let _step = 1;
let _data = {};
let _onComplete = null;
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

// --- Re-render parcial ---
function _rerender() {
    const prog = document.getElementById('wg-progress');
    const content = document.getElementById('wg-step');
    if (prog) prog.innerHTML = _progress();
    if (content) content.innerHTML = _stepHtml();
    _bind();
}

// --- Barra de progreso ---
function _progress() {
    const steps = ['Tu Negocio', 'Estrategia', 'Configuración'];
    const items = steps.map((label, i) => {
        const n = i + 1;
        const done = n < _step;
        const active = n === _step;
        const circle = done
            ? 'bg-success-500 text-white'
            : active
            ? 'bg-primary-600 text-white ring-4 ring-primary-100'
            : 'bg-white border-2 border-gray-200 text-gray-400';
        const text = active ? 'text-primary-700 font-semibold' : done ? 'text-success-600' : 'text-gray-400';
        const icon = done ? '<i class="fa-solid fa-check text-xs"></i>' : n;
        const divider = i > 0 ? '<div class="flex-1 max-w-[48px] h-px bg-gray-200 mb-4"></div>' : '';
        return `${divider}
        <div class="flex flex-col items-center gap-1">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${circle}">${icon}</div>
            <span class="text-xs hidden sm:block ${text}">${label}</span>
        </div>`;
    }).join('');
    return `<div class="flex items-center justify-center mb-8 gap-1">${items}</div>`;
}

// --- Despacho de paso ---
function _stepHtml() {
    if (_step === 1) return _step1();
    if (_step === 2) return _step2();
    return _step3(); // Solo 3 pasos
}

// --- Paso 1: Descripción del negocio ---
function _step1() {
    return `
    <div class="max-w-2xl mx-auto">
        <div class="text-center mb-6">
            <div class="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-3">
                <i class="fa-solid fa-building text-primary-600 text-2xl"></i>
            </div>
            <h2 class="text-xl font-bold text-gray-900">Describe tu negocio</h2>
            <p class="text-sm text-gray-500 mt-1">La IA generará la estrategia completa de tu sitio web. Incluye: tipo de propiedad, ubicación, público objetivo y lo que te hace único.</p>
        </div>
        <textarea id="wg-historia" rows="7" class="form-input w-full resize-none"
            placeholder="Ej: Somos un complejo de 8 cabañas con tinaja a orillas del lago Ranco. Llevamos 10 años ofreciendo experiencias de desconexión para familias y parejas. Contamos con kayaks, fogón y desayuno incluido...">${esc(clean(_data.historia))}</textarea>
        <p id="wg-err1" class="text-xs text-danger-600 mt-1 min-h-[1rem]"></p>
        <div class="flex justify-end mt-4">
            <button id="wg-1-next" class="btn-primary px-8 gap-2">
                <i class="fa-solid fa-wand-magic-sparkles"></i> Generar Estrategia con IA
            </button>
        </div>
    </div>`;
}

// --- Paso 2: Estrategia completa + Contenido web (IA) ---
function _step2() {
    const s = _data.strategy || {};
    const enfoques = ['Familiar', 'Parejas', 'Negocios', 'Aventura', 'Relax', 'Económico', 'Lujo', 'Otro'];
    return `
    <div class="max-w-2xl mx-auto">
        <div class="flex items-center justify-between mb-5">
            <div>
                <h2 class="text-xl font-bold text-gray-900">Estrategia de Marca</h2>
                <p class="text-sm text-gray-500">Generado por IA — revisa y ajusta según necesites.</p>
            </div>
            <button id="wg-2-regen" class="btn-outline btn-sm gap-1">
                <i class="fa-solid fa-rotate-right"></i> Regenerar
            </button>
        </div>

        <!-- Estrategia de marca (editables) -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Historia Optimizada <span class="text-primary-500 ml-1">IA</span></label>
                <textarea id="wg-historia-opt" rows="3" class="form-input w-full resize-none">${esc(clean(s.historiaOptimizada || _data.historia))}</textarea>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Slogan <span class="text-primary-500 ml-1">IA</span></label>
                <input type="text" id="wg-slogan" class="form-input" value="${esc(clean(s.slogan))}">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Tipo de Alojamiento <span class="text-primary-500 ml-1">IA</span></label>
                    <input type="text" id="wg-tipo" class="form-input" value="${esc(clean(s.tipoAlojamientoPrincipal))}">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Enfoque de Marketing <span class="text-primary-500 ml-1">IA</span></label>
                    <select id="wg-enfoque" class="form-select">
                        <option value="">-- Selecciona --</option>
                        ${enfoques.map(e => `<option value="${e}" ${s.enfoqueMarketing === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Palabras Clave SEO <span class="text-primary-500 ml-1">IA</span></label>
                <input type="text" id="wg-keywords" class="form-input" value="${esc(clean(s.palabrasClaveAdicionales))}" placeholder="cabañas, lago, montaña, descanso...">
            </div>
        </div>

        <div class="flex justify-between mt-5">
            <button id="wg-2-back" class="btn-ghost">← Anterior</button>
            <button id="wg-2-next" class="btn-primary px-8">Continuar →</button>
        </div>
    </div>`;
}


// --- Paso 4: Resumen y confirmación ---
function _step3() {
    const s = _data.strategy || {};
    const settings = _ref.websiteSettings || {};
    const general = settings.general || {};
    const theme = settings.theme || {};
    const vis = _data.visual || {};
    const noLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect width='80' height='40' fill='%23f3f4f6'/%3E%3Ctext x='40' y='20' font-family='Arial' font-size='9' fill='%239ca3af' text-anchor='middle' dy='.35em'%3ESin Logo%3C/text%3E%3C/svg%3E";

    return `
    <div class="max-w-2xl mx-auto">
        <div class="mb-6">
            <h2 class="text-xl font-bold text-gray-900">Configuración Final</h2>
            <p class="text-sm text-gray-500">Personaliza los elementos visuales y de contacto de tu sitio web.</p>
        </div>

        <!-- Elementos visuales editables -->
        <div class="space-y-4">
            <!-- Logo -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 class="font-semibold text-gray-800 mb-4">Logo</h3>
                <div class="flex items-center gap-4">
                    <img id="logo-preview" src="${vis.logoUrl || theme.logoUrl || noLogo}" alt="Logo" class="h-16 w-auto max-w-[160px] object-contain bg-gray-50 rounded-xl border p-2">
                    <div class="flex-1">
                        <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" class="form-input-file">
                        <div id="logo-upload-status" class="text-xs mt-1 min-h-[1rem] text-gray-500"></div>
                    </div>
                </div>
                <input type="hidden" id="config-logo" value="${esc(clean(vis.logoUrl || theme.logoUrl))}">
            </div>


            ${_step4Contacto(vis, general, _ref)}

            <!-- Contenido web generado (solo lectura) -->
            <div class="bg-primary-50 border border-primary-100 rounded-2xl p-5">
                <h3 class="font-semibold text-primary-800 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-file-lines text-primary-500"></i> Contenido Web Generado
                </h3>
                <div class="space-y-3">
                    <div>
                        <p class="text-xs text-primary-600 mb-1">Título Principal (H1)</p>
                        <p class="text-sm text-primary-800 font-medium">${esc(clean(s.homeH1 || 'Se generará automáticamente'))}</p>
                    </div>
                    <div>
                        <p class="text-xs text-primary-600 mb-1">Párrafo Introductorio</p>
                        <p class="text-sm text-primary-800">${esc(clean(s.homeIntro || 'Se generará automáticamente'))}</p>
                    </div>
                    <div>
                        <p class="text-xs text-primary-600 mb-1">Meta Título SEO</p>
                        <p class="text-sm text-primary-800">${esc(clean(s.homeSeoTitle || 'Se generará automáticamente'))}</p>
                    </div>
                    <div>
                        <p class="text-xs text-primary-600 mb-1">Meta Descripción SEO</p>
                        <p class="text-sm text-primary-800">${esc(clean(s.homeSeoDesc || 'Se generará automáticamente'))}</p>
                    </div>
                    <div class="pt-2 border-t border-primary-200">
                        <p class="text-xs text-primary-500 italic">Este contenido se genera automáticamente basado en tu estrategia.</p>
                    </div>
                </div>
            </div>

            <!-- Resumen de configuración (solo lectura) -->
            <div class="bg-primary-50 border border-primary-100 rounded-2xl p-5">
                <h3 class="font-semibold text-primary-800 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-circle-check text-primary-500"></i> Resumen de tu Configuración
                </h3>
                <div class="space-y-2 text-sm">
                    <div class="flex">
                        <span class="text-primary-600 w-32 flex-shrink-0">Slogan:</span>
                        <span class="text-primary-800 font-medium">${esc(clean(s.slogan || 'No definido'))}</span>
                    </div>
                    <div class="flex">
                        <span class="text-primary-600 w-32 flex-shrink-0">Tipo:</span>
                        <span class="text-primary-800">${esc(clean(s.tipoAlojamientoPrincipal || 'No definido'))}</span>
                    </div>
                    <div class="flex">
                        <span class="text-primary-600 w-32 flex-shrink-0">Título Web:</span>
                        <span class="text-primary-800 font-medium">${esc(clean(s.homeH1 || 'No definido'))}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Botones de acción -->
        <div class="flex justify-between items-center pt-6 mt-6 border-t border-gray-100">
            <button id="wg-3-back" class="btn-ghost">
                <i class="fa-solid fa-arrow-left mr-2"></i> Atrás
            </button>
            <div class="flex items-center gap-3">
                <button id="wg-3-preview" class="btn-outline gap-2">
                    <i class="fa-solid fa-eye"></i> Vista Previa
                </button>
                <button id="wg-3-publish" class="btn-primary px-8 gap-2">
                    <i class="fa-solid fa-rocket"></i> Publicar Sitio
                </button>
            </div>
        </div>
    </div>`;
}

function _step4Contacto(vis, general, ref) {
    return `
    <!-- Contacto -->
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 class="font-semibold text-gray-800 mb-4">Información de Contacto</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">WhatsApp / Teléfono</label>
                <input type="text" id="config-whatsapp" class="form-input" value="${esc(clean(vis.whatsapp || general.whatsapp))}" placeholder="+56912345678">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">URL Google Maps</label>
                <input type="text" id="config-maps-url" class="form-input" value="${esc(clean(vis.googleMapsUrl || general.googleMapsUrl))}" placeholder="https://maps.google.com/...">
            </div>
            <div class="md:col-span-2">
                <label class="block text-xs font-medium text-gray-500 mb-1">Dominio Personalizado (opcional)</label>
                <input type="text" id="config-domain" class="form-input" value="${esc(clean(general.domain))}" placeholder="www.miempresa.com">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Google Analytics ID</label>
                <input type="text" id="config-ga-id" class="form-input" value="${esc(clean(general.gaTrackingId))}" placeholder="G-XXXXXXXXXX">
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Subdominio (Render)</label>
                <div class="flex items-center">
                    <input type="text" id="config-subdomain" class="form-input rounded-r-none bg-gray-50 text-gray-500 cursor-not-allowed" value="${(ref.nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '')}" readonly>
                    <span class="inline-flex items-center px-3 text-xs text-gray-400 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md h-10">.onrender.com</span>
                </div>
            </div>
        </div>
    </div>`;
}


// --- Colectar estado del formulario antes de navegar ---
function _collectStep2() {
    if (!document.getElementById('wg-slogan')) return;
    _data.strategy = {
        ..._data.strategy,
        historiaOptimizada: document.getElementById('wg-historia-opt')?.value,
        slogan: document.getElementById('wg-slogan')?.value,
        tipoAlojamientoPrincipal: document.getElementById('wg-tipo')?.value,
        enfoqueMarketing: document.getElementById('wg-enfoque')?.value,
        palabrasClaveAdicionales: document.getElementById('wg-keywords')?.value,
    };
}

// --- API ---
async function _optimize() {
    return fetchAPI('/website/optimize-profile', { method: 'POST', body: { historia: _data.historia } });
}

// --- Bind de eventos por paso ---
function _bind() {
    if (_step === 1) _bindStep1();
    else if (_step === 2) _bindStep2();
    else if (_step === 3) _bindStep3();
}

function _bindStep1() {
    attach('wg-1-next', async (e) => {
        const historia = document.getElementById('wg-historia')?.value?.trim();
        const errEl = document.getElementById('wg-err1');
        if (!historia || historia.length < 20) {
            if (errEl) errEl.textContent = 'Escribe al menos 20 caracteres para que la IA pueda generar tu estrategia.';
            return;
        }
        _data.historia = historia;
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Generando...';
        try {
            _data.strategy = await _optimize();
            _step = 2;
            _rerender();
        } catch (err) {
            if (errEl) errEl.textContent = 'Error al conectar con la IA. Intenta de nuevo.';
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-2"></i> Generar Estrategia con IA';
        }
    });
}

function _bindStep2() {
    attach('wg-2-back', () => { _collectStep2(); _step = 1; _rerender(); });
    attach('wg-2-next', () => { _collectStep2(); _step = 3; _rerender(); });
    attach('wg-2-regen', async (e) => {
        _collectStep2();
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        try {
            _data.strategy = { ..._data.strategy, ...await _optimize() };
            _rerender();
        } catch {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Regenerar';
        }
    });
}


function _bindStep3() {
    // Botón Atrás
    attach('wg-3-back', () => {
        _collectStep3(); // Guardar cambios del paso 3
        _step = 2;
        _rerender();
    });

    // Botón Vista Previa
    attach('wg-3-preview', () => {
        _collectStep3(); // Guardar cambios primero
        const subdomain = document.getElementById('config-subdomain')?.value;
        if (!subdomain) {
            alert('Primero guarda los cambios para generar la vista previa.');
            return;
        }
        const url = `https://${subdomain}.onrender.com`;
        window.open(url, '_blank');
    });

    // Botón Publicar
    attach('wg-3-publish', () => {
        _collectStep3(); // Guardar cambios primero
        _save();
    });

    // Upload de logo
    const logoInput = document.getElementById('logoFile');
    if (logoInput) {
        const ni = logoInput.cloneNode(true);
        logoInput.parentNode.replaceChild(ni, logoInput);
        ni.addEventListener('change', e => { if (e.target.files[0]) _uploadLogo(e.target.files[0]); });
    }

    // Upload de imagen hero (si existe)
    const heroBtn = document.getElementById('upload-hero-image-btn');
    if (heroBtn) {
        attach('upload-hero-image-btn', () => {
            const f = document.getElementById('upload-hero-image-input')?.files?.[0];
            if (!f) return alert('Selecciona una imagen primero.');
            openEditor(f, blob => _uploadHero(blob));
        });
    }
}

// Recolectar datos del paso 4
function _collectStep3() {
    _data.visual = {
        ..._data.visual,
        whatsapp: document.getElementById('config-whatsapp')?.value || '',
        googleMapsUrl: document.getElementById('config-maps-url')?.value || '',
    };
}

// --- Uploads ---
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

// --- Guardar y completar ---
async function _save() {
    const btn = document.getElementById('wg-3-publish');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Publicando...'; }

    const s = _data.strategy || {};
    const subdomain = (_ref.nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const websitePayload = {
        general: {
            subdomain,
            domain: document.getElementById('config-domain')?.value || '',
            wizardCompleted: true,
            whatsapp: document.getElementById('config-whatsapp')?.value || _data.visual?.whatsapp || '',
            googleMapsUrl: document.getElementById('config-maps-url')?.value || _data.visual?.googleMapsUrl || '',
            gaTrackingId: document.getElementById('config-ga-id')?.value || '',
        },
        theme: {
            logoUrl: document.getElementById('config-logo')?.value || '',
            visualStyle: s.visualStyle || 'moderno',
        },
        content: { homeH1: s.homeH1 || '', homeIntro: s.homeIntro || '' },
        seo: { homeTitle: s.homeSeoTitle || '', homeDescription: s.homeSeoDesc || '' },
    };

    const empresaPayload = {
        slogan: s.slogan || '',
        historiaEmpresa: _data.historia || '',
        historiaOptimizada: s.historiaOptimizada || '',
        tipoAlojamientoPrincipal: s.tipoAlojamientoPrincipal || '',
        enfoqueMarketing: s.enfoqueMarketing || '',
        palabrasClaveAdicionales: s.palabrasClaveAdicionales || '',
    };

    try {
        await Promise.all([
            fetchAPI('/website/home-settings', { method: 'PUT', body: websitePayload }),
            fetchAPI('/empresa', { method: 'PUT', body: empresaPayload }),
        ]);
        if (_onComplete) _onComplete();
    } catch (e) {
        alert(`Error al publicar: ${e.message}`);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rocket mr-2"></i> Publicar Sitio'; }
    }
}

// --- Exports públicos ---
export function renderWizard(empresaData) {
    _ref = empresaData;
    return `<div class="py-4"><div id="wg-progress"></div><div id="wg-step"></div></div>`;
}

export function setupWizardEvents(empresaData, onComplete) {
    _ref = empresaData;
    _onComplete = onComplete;
    // Seed desde datos existentes si el wizard no tiene datos aún
    if (!_data.historia) {
        const s = empresaData.websiteSettings || {};
        const theme = s.theme || {};
        _data.historia = clean(empresaData.historiaEmpresa);
        _data.strategy = {
            slogan: empresaData.slogan,
            tipoAlojamientoPrincipal: empresaData.tipoAlojamientoPrincipal,
            enfoqueMarketing: empresaData.enfoqueMarketing,
            palabrasClaveAdicionales: empresaData.palabrasClaveAdicionales,
            historiaOptimizada: empresaData.historiaOptimizada,
            homeH1: s.content?.homeH1,
            homeIntro: s.content?.homeIntro,
            homeSeoTitle: s.seo?.homeTitle,
            homeSeoDesc: s.seo?.homeDescription,
            visualStyle: theme.visualStyle,
        };
        _data.visual = {
            whatsapp: s.general?.whatsapp,
            googleMapsUrl: s.general?.googleMapsUrl,
        };
    }
    _rerender();
}

export function resetWizard() {
    _step = 1;
    _data = {};
}
