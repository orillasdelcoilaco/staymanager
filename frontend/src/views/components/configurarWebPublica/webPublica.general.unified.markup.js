// HTML del formulario unificado (extraído para límites de complejidad).

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = (v) => (v === undefined || v === null || v === 'undefined') ? '' : v;

const ENFOQUES = ['Familiar', 'Parejas', 'Negocios', 'Aventura', 'Relax', 'Económico', 'Lujo', 'Otro'];
const NO_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect width='80' height='40' fill='%23f3f4f6'/%3E%3Ctext x='40' y='20' font-family='Arial' font-size='9' fill='%239ca3af' text-anchor='middle' dy='.35em'%3ESin Logo%3C/text%3E%3C/svg%3E";
const NO_HERO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='160'%3E%3Crect width='240' height='160' fill='%23f3f4f6'/%3E%3Ctext x='120' y='80' font-family='Arial' font-size='12' fill='%239ca3af' text-anchor='middle' dy='.35em'%3ESin Imagen Hero%3C/text%3E%3C/svg%3E";

function unifyHeaderBlock() {
    return `
        <div class="mb-8">
            <h1 class="text-2xl font-bold text-gray-900">Configurar Sitio Web Público</h1>
            <p class="text-sm text-gray-500 mt-1">Completa la información básica y la IA generará el resto automáticamente.</p>
        </div>`;
}

function unifyBasicSection(empresa, general, booking) {
    const depActivo = booking?.depositoActivo !== false;
    const depTipo = booking?.depositoTipo === 'monto_fijo' ? 'monto_fijo' : 'porcentaje';
    const depPct = Number.parseInt(String(booking?.depositoPorcentaje ?? 10), 10) || 10;
    const depMonto = Number.parseInt(String(booking?.depositoMontoSugeridoCLP ?? 0), 10) || 0;
    const depHoras = Number.parseInt(String(booking?.depositoHorasLimite ?? booking?.abonoHorasLimite ?? 48), 10) || 48;
    const depNota = clean(booking?.depositoNotaHtml || '');
    const garantiaModo = clean(booking?.garantiaModo || 'abono_manual');
    const garantiaDetalleOperacion = clean(booking?.garantiaDetalleOperacion || '');
    const mascotasPolicyMode = clean(booking?.chatgptMascotasPolicyMode || 'auto');
    const mascotasCondicion = clean(booking?.chatgptMascotasCondicion || '');
    return `
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h2 class="font-semibold text-gray-800 mb-4">Información Básica del Negocio</h2>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Historia / Descripción del Negocio</label>
                    <textarea id="historia" rows="4" class="form-input w-full resize-none" placeholder="Describe tu negocio, tipo de alojamientos, ubicación, experiencia que ofreces...">${esc(clean(empresa.historiaEmpresa))}</textarea>
                    <p class="text-xs text-gray-400 mt-1">La IA usará esta descripción para generar todo el contenido.</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">WhatsApp / Teléfono</label>
                        <input type="text" id="whatsapp" class="form-input" value="${esc(clean(general.whatsapp))}" placeholder="+56912345678">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">URL Google Maps</label>
                        <input type="text" id="maps-url" class="form-input" value="${esc(clean(general.googleMapsUrl))}" placeholder="https://maps.google.com/...">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Subdominio</label>
                        <input type="text" id="subdomain" class="form-input" value="${esc(clean(general.subdomain || empresa.subdominio || ''))}" placeholder="nombre-empresa">
                        <p class="text-xs text-gray-400 mt-1">Ej: orillas-coilaco → orillas-coilaco.suitemanagers.com</p>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Dominio Personalizado (opcional)</label>
                        <input type="text" id="domain" class="form-input" value="${esc(clean(general.domain))}" placeholder="www.miempresa.com">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Google Analytics ID</label>
                        <input type="text" id="ga-id" class="form-input" value="${esc(clean(general.gaTrackingId))}" placeholder="G-XXXXXXXXXX">
                    </div>
                </div>
                <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <p class="text-xs font-semibold text-gray-700 mb-2">Depósito / abono para reserva web</p>
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <label class="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" id="deposito-activo" ${depActivo ? 'checked' : ''}>
                            Requiere abono
                        </label>
                        <div>
                            <label class="block text-[11px] text-gray-500 mb-1">Tipo</label>
                            <select id="deposito-tipo" class="form-input">
                                <option value="porcentaje" ${depTipo === 'porcentaje' ? 'selected' : ''}>Porcentaje</option>
                                <option value="monto_fijo" ${depTipo === 'monto_fijo' ? 'selected' : ''}>Monto fijo CLP</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] text-gray-500 mb-1">% abono</label>
                            <input type="number" id="deposito-porcentaje" class="form-input" min="1" max="100" value="${esc(depPct)}">
                        </div>
                        <div>
                            <label class="block text-[11px] text-gray-500 mb-1">Monto fijo CLP</label>
                            <input type="number" id="deposito-monto" class="form-input" min="0" step="1000" value="${esc(depMonto)}">
                        </div>
                        <div>
                            <label class="block text-[11px] text-gray-500 mb-1">Horas límite pago</label>
                            <input type="number" id="deposito-horas" class="form-input" min="1" max="168" value="${esc(depHoras)}">
                        </div>
                    </div>
                    <div class="mt-3">
                        <label class="block text-[11px] text-gray-500 mb-1">Texto legal/explicativo del abono (opcional)</label>
                        <textarea id="deposito-nota-html" rows="3" class="form-input w-full resize-none" placeholder="Ej: La reserva se confirma al recibir el abono dentro del plazo indicado.">${esc(depNota)}</textarea>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div>
                            <label class="block text-[11px] text-gray-500 mb-1">Política operativa de garantía</label>
                            <select id="garantia-modo" class="form-input">
                                <option value="abono_manual" ${garantiaModo === 'abono_manual' ? 'selected' : ''}>Abono manual (actual)</option>
                                <option value="sin_garantia" ${garantiaModo === 'sin_garantia' ? 'selected' : ''}>Sin garantía previa</option>
                                <option value="preautorizacion_externa" ${garantiaModo === 'preautorizacion_externa' ? 'selected' : ''}>Preautorización externa (sin integración)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] text-gray-500 mb-1">Nota interna operativa (opcional)</label>
                            <input type="text" id="garantia-detalle-operacion" class="form-input" maxlength="280" value="${esc(garantiaDetalleOperacion)}" placeholder="Ej: Validar voucher antes de marcar Confirmada.">
                        </div>
                    </div>
                </div>
                <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <p class="text-xs font-semibold text-gray-700 mb-2">Política de mascotas para ventas IA (ChatGPT)</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-[11px] text-gray-500 mb-1">Modo</label>
                            <select id="chatgpt-mascotas-policy-mode" class="form-input">
                                <option value="auto" ${mascotasPolicyMode === 'auto' ? 'selected' : ''}>Auto (según configuración actual)</option>
                                <option value="permitidas" ${mascotasPolicyMode === 'permitidas' ? 'selected' : ''}>Permitidas</option>
                                <option value="no_permitidas" ${mascotasPolicyMode === 'no_permitidas' ? 'selected' : ''}>No permitidas</option>
                                <option value="consultar_siempre" ${mascotasPolicyMode === 'consultar_siempre' ? 'selected' : ''}>Consultar siempre</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] text-gray-500 mb-1">Condición comercial (opcional)</label>
                            <input type="text" id="chatgpt-mascotas-condicion" class="form-input" maxlength="280" value="${esc(mascotasCondicion)}" placeholder="Ej: Permitidas razas pequeñas; razas grandes bajo consulta.">
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

function unifyVisualSection(theme) {
    return `
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <h2 class="font-semibold text-gray-800 mb-4">Elementos Visuales</h2>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Logo</label>
                    <div class="flex items-center gap-4">
                        <img id="logo-preview" src="${theme.logoUrl || NO_LOGO}" alt="Logo" class="h-16 w-auto max-w-[160px] object-contain bg-gray-50 rounded-xl border p-2">
                        <div class="flex-1">
                            <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" class="form-input-file">
                            <div id="logo-upload-status" class="text-xs mt-1 min-h-[1rem] text-gray-500"></div>
                        </div>
                    </div>
                    <input type="hidden" id="logo-url" value="${esc(clean(theme.logoUrl))}">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Imagen de Portada (Hero)</label>
                    <div class="flex items-center gap-4">
                        <img id="hero-preview" src="${theme.heroImageUrl || NO_HERO}" alt="Portada" class="h-32 w-auto max-w-[240px] object-cover bg-gray-50 rounded-xl border p-2">
                        <div class="flex-1">
                            <input type="file" id="heroFile" accept="image/png,image/jpeg,image/webp" class="form-input-file">
                            <div id="hero-upload-status" class="text-xs mt-1 min-h-[1rem] text-gray-500"></div>
                        </div>
                    </div>
                    <input type="hidden" id="hero-url" value="${esc(clean(theme.heroImageUrl))}">
                </div>
            </div>
        </div>`;
}

function unifyStrategySection(empresa, strategy) {
    return `
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <div class="flex items-center justify-between mb-4">
                <h2 class="font-semibold text-gray-800">Estrategia Generada por IA</h2>
                <button id="btn-regen" class="btn-outline btn-sm gap-1">
                    <i class="fa-solid fa-wand-magic-sparkles text-primary-500"></i> Regenerar Todo
                </button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Slogan</label>
                    <input type="text" id="slogan" class="form-input" value="${esc(clean(strategy.slogan || empresa.slogan))}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Tipo de Alojamiento</label>
                        <input type="text" id="tipo" class="form-input" value="${esc(clean(strategy.tipoAlojamientoPrincipal || empresa.tipoAlojamientoPrincipal))}">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-500 mb-1">Enfoque de Marketing</label>
                        <select id="enfoque" class="form-select">
                            <option value="">-- Selecciona --</option>
                            ${ENFOQUES.map((e) => `<option value="${e}" ${strategy.enfoqueMarketing === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 mb-1">Palabras Clave SEO</label>
                    <input type="text" id="keywords" class="form-input" value="${esc(clean(strategy.palabrasClaveAdicionales))}" placeholder="cabañas, lago, montaña, descanso...">
                </div>
            </div>
        </div>`;
}

function unifyReadonlyContentSection(strategy, theme) {
    return `
        <div class="bg-primary-50 border border-primary-100 rounded-2xl p-5 mb-6">
            <h2 class="font-semibold text-primary-800 mb-4 flex items-center gap-2">
                <i class="fa-solid fa-file-lines text-primary-500"></i> Contenido Web Generado
            </h2>
            <div class="space-y-4">
                <div class="bg-white border border-primary-200 rounded-xl p-4">
                    <p class="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
                        <i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Historia del Negocio (reescrita por IA)
                    </p>
                    <p id="content-historia-opt" class="text-sm text-gray-700 leading-relaxed">${esc(clean(strategy.historiaOptimizada || 'Haz clic en "Regenerar con IA" para obtener una versión optimizada de tu historia.'))}</p>
                </div>
                <div>
                    <p class="text-xs text-primary-600 mb-1">Título Principal (H1)</p>
                    <p id="content-h1" class="text-sm text-primary-800 font-medium">${esc(clean(strategy.homeH1 || 'Se generará automáticamente'))}</p>
                </div>
                <div>
                    <p class="text-xs text-primary-600 mb-1">Párrafo Introductorio</p>
                    <p id="content-intro" class="text-sm text-primary-800">${esc(clean(strategy.homeIntro || 'Se generará automáticamente'))}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-xs text-primary-600 mb-1">Meta Título SEO</p>
                        <p id="content-seo-title" class="text-sm text-primary-800">${esc(clean(strategy.homeSeoTitle || 'Se generará automáticamente'))}</p>
                    </div>
                    <div>
                        <p class="text-xs text-primary-600 mb-1">Meta Descripción SEO</p>
                        <p id="content-seo-desc" class="text-sm text-primary-800">${esc(clean(strategy.homeSeoDesc || 'Se generará automáticamente'))}</p>
                    </div>
                </div>
                <div class="pt-3 border-t border-primary-200">
                    <p class="text-xs font-medium text-primary-600 mb-2">Metadata de Imagen Hero (Generada por IA)</p>
                    <div class="space-y-2">
                        <div>
                            <p class="text-xs text-primary-600 mb-1">Texto Alternativo (alt)</p>
                            <p id="content-hero-alt" class="text-sm text-primary-800">${esc(clean(theme.heroImageAlt || 'Se generará automáticamente al subir la imagen'))}</p>
                            <input type="hidden" id="hero-alt" value="${esc(clean(theme.heroImageAlt || ''))}">
                        </div>
                        <div>
                            <p class="text-xs text-primary-600 mb-1">Título de la Imagen</p>
                            <p id="content-hero-title" class="text-sm text-primary-800">${esc(clean(theme.heroImageTitle || 'Se generará automáticamente al subir la imagen'))}</p>
                            <input type="hidden" id="hero-title" value="${esc(clean(theme.heroImageTitle || ''))}">
                        </div>
                    </div>
                    <p class="text-xs text-primary-500 italic mt-3">Esta metadata se genera automáticamente analizando la imagen hero y el contexto de tu empresa.</p>
                </div>
            </div>
        </div>`;
}

function unifyActionRow() {
    return `
        <div class="flex justify-between items-center pt-6 border-t border-gray-200">
            <div>
                <button id="btn-preview" class="btn-outline gap-2">
                    <i class="fa-solid fa-eye"></i> Vista Previa
                </button>
            </div>
            <div class="flex items-center gap-3">
                <button id="btn-test-ia" class="btn-ghost gap-2">
                    <i class="fa-solid fa-bolt"></i> Probar Generación IA
                </button>
                <button id="btn-save" class="btn-primary px-8 gap-2">
                    <i class="fa-solid fa-save"></i> Guardar Todo
                </button>
            </div>
        </div>`;
}

function unifyDomainPanel(empresa) {
    const subDisplay = empresa.websiteSettings?.general?.subdomain || empresa.subdominio
        || (empresa.nombre || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const subDisplayText = subDisplay ? `${subDisplay}.suitemanagers.com` : 'Ingresa un subdominio arriba';
    const subForLink = empresa.websiteSettings?.general?.subdomain || empresa.subdominio || '';
    const hrefSub = subForLink ? `https://${subForLink}.suitemanagers.com` : '#';
    const hasSub = !!(empresa.websiteSettings?.general?.subdomain || empresa.subdominio);
    const customDomain = empresa.websiteSettings?.general?.domain || empresa.dominio || '';
    const hasCustom = !!(empresa.websiteSettings?.general?.domain || empresa.dominio);

    return `
        <div id="domain-status-panel" class="mt-4 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <i class="fa-solid fa-globe text-primary-500"></i>
                <span class="font-semibold text-gray-800 text-sm">Tu Web Pública</span>
            </div>
            <div class="p-4 space-y-3">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-xs text-gray-500 mb-0.5">Subdominio SuiteManager (incluido)</p>
                        <p class="text-sm font-medium text-gray-800">
                            <i class="fa-solid fa-check-circle text-success-500 mr-1"></i>
                            <span id="subdomain-display">${esc(subDisplayText)}</span>
                        </p>
                    </div>
                    <a id="subdomain-link" href="${esc(hrefSub)}" target="_blank" class="btn-outline btn-sm text-xs ${!hasSub ? 'opacity-40 pointer-events-none' : ''}">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver
                    </a>
                </div>
                <div id="custom-domain-status" class="${!hasCustom ? 'hidden' : ''}">
                    <div class="border-t border-gray-200 pt-3">
                        <p class="text-xs text-gray-500 mb-0.5">Dominio personalizado</p>
                        <p class="text-sm font-medium text-gray-800">
                            <i class="fa-solid fa-globe text-primary-500 mr-1"></i>
                            <span id="custom-domain-display">${esc(customDomain)}</span>
                        </p>
                    </div>
                </div>
                <div id="dns-instructions" class="hidden bg-warning-50 border border-warning-200 rounded-lg p-3 text-xs">
                    <p class="font-semibold text-warning-800 mb-2">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i>
                        Acción requerida — Configura tu DNS
                    </p>
                    <p class="text-warning-700 mb-2">Agrega este registro en el panel DNS de tu dominio:</p>
                    <div class="bg-white border border-warning-200 rounded p-2 font-mono text-xs space-y-1">
                        <div class="grid grid-cols-3 gap-2 text-gray-500 font-semibold">
                            <span>Tipo</span><span>Host</span><span>Valor (apunta a)</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-gray-900">
                            <span id="dns-type">CNAME</span>
                            <span id="dns-host">www</span>
                            <span id="dns-value" class="truncate">-</span>
                        </div>
                    </div>
                    <p id="dns-note" class="text-warning-600 mt-2 italic"></p>
                    <p class="text-warning-600 mt-1">Los cambios DNS pueden tardar hasta 24 horas en propagarse.</p>
                </div>
            </div>
        </div>`;
}

export function buildUnifiedMarkup(empresaData) {
    const empresa = empresaData || {};
    const settings = empresa.websiteSettings || {};
    const general = settings.general || {};
    const booking = settings.booking || {};
    const theme = settings.theme || {};
    const strategy = empresa.strategy || {};

    return `
    <div class="max-w-4xl mx-auto">
        ${unifyHeaderBlock()}
        ${unifyBasicSection(empresa, general, booking)}
        ${unifyVisualSection(theme)}
        ${unifyStrategySection(empresa, strategy)}
        ${unifyReadonlyContentSection(strategy, theme)}
        ${unifyActionRow()}
        ${unifyDomainPanel(empresa)}
    </div>`;
}
