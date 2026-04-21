/**
 * webPublica.paso3.seo.js — Paso 3: Card Image + SEO
 */
import { fetchAPI } from '../../../api.js';

export function renderPaso3(state) {
    const wd        = state.propiedadData || {};
    const publicacion = state.buildContext?.publicacion || {};
    const narrativa   = state.buildContext?.narrativa   || {};
    return `
    <div class="max-w-2xl mx-auto space-y-6">
        ${_renderResumenChecklist(state)}
        ${_renderPortadaCard(wd)}
        ${_renderJsonLdCard(publicacion, narrativa)}
        ${_renderSeoCard(wd, publicacion)}
        <div class="flex justify-between pt-2">
            <button id="btn-paso3-back" class="btn-ghost flex items-center gap-2">
                <i class="fa-solid fa-arrow-left"></i> Anterior
            </button>
            <button id="btn-guardar-paso3" class="btn-primary flex items-center gap-2">
                <i class="fa-solid fa-floppy-disk"></i> Guardar todo
            </button>
        </div>
    </div>`;
}

function _renderResumenChecklist(state) {
    const wd          = state.propiedadData || {};
    const buildCtx    = state.buildContext   || {};
    const narrativa   = buildCtx.narrativa   || {};
    const publicacion = buildCtx.publicacion || {};

    // fotoStats desde la lista de propiedades (actualizada tras cada mutación)
    const prop          = (state.propiedades || []).find(p => p.id === state.propiedadId);
    const fotoStats     = prop?.fotoStats || prop?.galeriaStats || {};
    const slotsTotal    = fotoStats.slotsTotal    || 0;
    const slotsCumplidos = fotoStats.slotsCumplidos || 0;
    const fotosOk   = slotsTotal > 0 && slotsCumplidos >= slotsTotal;
    const fotosWarn = slotsTotal > 0 && slotsCumplidos > 0 && slotsCumplidos < slotsTotal;

    const metaTitleOk = !!(wd.metaTitle || publicacion.metaTitle);

    const items = [
        {
            label:  'Descripción con IA',
            ok:     !!narrativa.descripcionComercial,
            warn:   false,
            detail: narrativa.descripcionComercial ? 'Generada' : 'Pendiente — genera en Paso 1',
        },
        {
            label:  'Fotos del wizard',
            ok:     fotosOk,
            warn:   fotosWarn,
            detail: slotsTotal > 0
                ? `${slotsCumplidos} / ${slotsTotal} slots`
                : 'Sin plan de fotos — completa Paso 2',
        },
        {
            label:  'Imagen de portada',
            ok:     !!wd.cardImage?.storagePath,
            warn:   false,
            detail: wd.cardImage?.storagePath ? 'Asignada' : 'Pendiente',
        },
        {
            label:  'Schema.org JSON-LD',
            ok:     !!publicacion.jsonLd,
            warn:   false,
            detail: publicacion.jsonLd ? 'Generado' : 'Pendiente',
        },
        {
            label:  'Meta SEO',
            ok:     metaTitleOk,
            warn:   false,
            detail: metaTitleOk ? 'Configurado' : 'Pendiente',
        },
    ];

    const allOk  = items.every(i => i.ok);
    const anyWarn = items.some(i => i.warn);

    const badgeCls = allOk
        ? 'bg-success-50 text-success-700 border-success-200'
        : anyWarn
            ? 'bg-warning-50 text-warning-700 border-warning-200'
            : 'bg-gray-100 text-gray-500 border-gray-200';
    const badgeLabel = allOk ? 'Todo listo' : anyWarn ? 'En progreso' : 'Pendientes';

    const dotCls  = (item) => item.ok ? 'bg-success-100 text-success-600' : item.warn ? 'bg-warning-100 text-warning-600' : 'bg-gray-100 text-gray-400';
    const iconName = (item) => item.ok ? 'fa-check' : item.warn ? 'fa-minus' : 'fa-clock';
    const textCls  = (item) => item.ok ? 'text-success-600' : item.warn ? 'text-warning-600' : 'text-gray-400';

    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-900">Estado del alojamiento</h3>
            <span class="text-[10px] border px-2 py-0.5 rounded-full font-medium ${badgeCls}">${badgeLabel}</span>
        </div>
        <div class="space-y-0.5">
            ${items.map(item => `
            <div class="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div class="flex items-center gap-2.5">
                    <div class="w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 ${dotCls(item)}">
                        <i class="fa-solid ${iconName(item)} text-[10px]"></i>
                    </div>
                    <span class="text-sm text-gray-700">${item.label}</span>
                </div>
                <span class="text-xs ${textCls(item)}">${item.detail}</span>
            </div>`).join('')}
        </div>
    </div>`;
}

function _renderPortadaCard(wd) {
    const cardImage = wd.cardImage;
    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="font-semibold text-gray-900">Imagen de portada</h3>
                <p class="text-xs text-gray-400 mt-0.5">Se muestra en la tarjeta del alojamiento en el sitio web.</p>
            </div>
            <button id="btn-cambiar-portada-p3" class="btn-outline flex items-center gap-1.5 text-xs">
                <i class="fa-solid fa-camera"></i> Cambiar
            </button>
        </div>
        <div class="flex items-center gap-4">
            ${cardImage?.storagePath
                ? `<img src="${esc(cardImage.storagePath)}" alt="${esc(cardImage.altText || '')}"
                       class="h-28 w-44 object-cover rounded-xl border border-gray-100 shadow-sm flex-shrink-0"
                       onerror="this.style.display='none'">`
                : `<div class="h-28 w-44 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300 flex-shrink-0">
                       <i class="fa-solid fa-image text-2xl mb-1"></i>
                       <span class="text-xs">Sin portada</span>
                   </div>`}
            <div class="text-sm text-gray-500">
                ${cardImage?.storagePath
                    ? `<p class="font-medium text-gray-700 mb-1">Portada asignada</p>
                       <p class="text-xs text-gray-400">${esc(cardImage.altText || 'Sin descripción')}</p>`
                    : `<p class="font-medium text-gray-700 mb-1">Sin imagen de portada</p>
                       <p class="text-xs text-gray-400">Haz clic en "Cambiar" para seleccionar una foto.</p>`}
            </div>
        </div>
    </div>`;
}

function _renderJsonLdCard(publicacion, narrativa) {
    const tieneNarrativa = !!narrativa.descripcionComercial;
    const tieneJsonLd    = !!publicacion.jsonLd;
    const jsonLdStr      = tieneJsonLd ? JSON.stringify(publicacion.jsonLd, null, 2) : '';
    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="font-semibold text-gray-900 flex items-center gap-2">
                    Schema.org JSON-LD
                    ${tieneJsonLd
                        ? `<span class="text-[10px] bg-success-50 text-success-700 border border-success-200 px-2 py-0.5 rounded-full font-medium">Generado</span>`
                        : `<span class="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full font-medium">Pendiente</span>`}
                </h3>
                <p class="text-xs text-gray-400 mt-0.5">Ficha LodgingBusiness para Google SGE, ChatGPT y Perplexity.</p>
            </div>
            <button id="btn-generar-jsonld" class="btn-outline text-sm flex items-center gap-1.5"
                ${!tieneNarrativa ? 'disabled title="Genera el contenido web primero (Paso 1)"' : ''}>
                <i class="fa-solid fa-bolt"></i> ${tieneJsonLd ? 'Regenerar' : 'Generar JSON-LD'}
            </button>
        </div>
        ${!tieneNarrativa ? `<div class="p-3 bg-warning-50 border border-warning-100 rounded-lg text-xs text-warning-700">
            Completa el <strong>Paso 1 — Identidad</strong> generando la descripción con IA antes de generar el JSON-LD.
        </div>` : ''}
        <div id="jsonld-loading" class="hidden flex items-center gap-2 text-sm text-primary-600 py-3">
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Generando ficha schema.org...
        </div>
        <div id="jsonld-preview" class="${tieneJsonLd ? '' : 'hidden'}">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-gray-600">Vista previa del JSON-LD</span>
                <button id="btn-copiar-jsonld" class="btn-ghost text-xs flex items-center gap-1">
                    <i class="fa-regular fa-copy"></i> Copiar
                </button>
            </div>
            <pre id="jsonld-code" class="bg-gray-900 text-success-300 text-[11px] p-4 rounded-xl overflow-auto max-h-56 leading-relaxed">${esc(jsonLdStr)}</pre>
        </div>
    </div>`;
}

/**
 * Título SEO de respaldo (botón ⚡): frase completa, corte en límite de palabra — evita cortes como "en la ".
 * Objetivo ~55–72 caracteres totales (nombre + separador + gancho), alineado con buenas prácticas SERP.
 */
function buildHeuristicMetaTitle(nombre, descripcion) {
    const base = (nombre || 'Alojamiento').trim();
    const prefix = `${base} — `;
    const maxTotal = 72;
    const maxSuffix = Math.max(24, maxTotal - prefix.length);
    let body = String(descripcion || '').replace(/\s+/g, ' ').trim();
    if (!body) return prefix.trim().slice(0, maxTotal);

    const endM = body.match(/[.!?]/);
    if (endM && endM.index > 20) body = body.slice(0, endM.index).trim();

    if (body.length <= maxSuffix) return (prefix + body).slice(0, maxTotal);

    let chunk = body.slice(0, maxSuffix + 1);
    const lastSp = chunk.lastIndexOf(' ');
    if (lastSp >= Math.floor(maxSuffix * 0.55)) chunk = chunk.slice(0, lastSp);
    else chunk = body.slice(0, maxSuffix);
    chunk = chunk.replace(/[,;:—\-–]\s*$/, '').trim();
    return (prefix + chunk).slice(0, maxTotal);
}

function _renderSeoCard(wd, publicacion = {}) {
    const titleVal = (wd.metaTitle || publicacion.metaTitle || '').trim();
    const descVal = (wd.metaDescription || publicacion.metaDescription || '').trim();
    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div class="mb-4">
            <h3 class="font-semibold text-gray-900">SEO del alojamiento</h3>
            <p class="text-xs text-gray-400 mt-0.5">Meta, keywords y JSON-LD de esta unidad para buscadores, redes y asistentes.</p>
        </div>
        <div class="rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2.5 text-[11px] text-primary-900 mb-4 leading-relaxed">
            <strong>Sitio público:</strong> el backend publica <code class="text-[10px] bg-white/80 px-1 rounded">robots.txt</code> y
            <code class="text-[10px] bg-white/80 px-1 rounded">sitemap.xml</code> por empresa; aquí defines lo que va en cada URL de alojamiento (title, description, schema.org).
        </div>
        <div class="space-y-4">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1.5">Meta título</label>
                <div class="flex gap-2">
                    <input type="text" id="input-meta-title" maxlength="120"
                        class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                        placeholder="Cabaña con vista al lago — Pucón, tinaja y 6 huéspedes"
                        value="${esc(titleVal)}">
                    <button id="btn-ia-title" class="btn-outline flex-shrink-0 text-xs px-3" title="Sugerir título desde la descripción (editable)"><i class="fa-solid fa-bolt"></i></button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1">
                    Google suele truncar el título visible a ~50–60 caracteres; usa una frase completa (hasta ~72) en el title HTML para no cortar la idea a medias.
                    Actual: <span id="title-chars">${titleVal.length}</span>
                    <span id="title-seo-hint" class="ml-1"></span>
                </p>
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1.5">Meta descripción</label>
                <div class="flex gap-2 items-start">
                    <textarea id="input-meta-desc"
                        class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                        rows="3" placeholder="Disfruta de una estadía única con vistas panorámicas...">${esc(descVal)}</textarea>
                    <button id="btn-ia-desc" class="btn-outline flex-shrink-0 text-xs px-3" title="Generar con IA"><i class="fa-solid fa-bolt"></i></button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1">Recomendado: 150-160 caracteres. Actual: <span id="desc-seo-chars">${descVal.length}</span></p>
            </div>
        </div>
    </div>`;
}

export function bindPaso3(state, callbacks) {
    document.getElementById('btn-paso3-back')?.addEventListener('click', callbacks.onPrevStep);

    const titleInput = document.getElementById('input-meta-title');
    const descInput  = document.getElementById('input-meta-desc');

    titleInput?.addEventListener('input', () => {
        const c = document.getElementById('title-chars');
        const hint = document.getElementById('title-seo-hint');
        const n = titleInput.value.length;
        if (c) c.textContent = String(n);
        if (hint) {
            if (n > 72) hint.textContent = '(largo: Google puede truncar el snippet)';
            else if (n < 35) hint.textContent = '(corto: añade ciudad o diferenciador)';
            else hint.textContent = '';
        }
    });
    descInput?.addEventListener('input', () => {
        const c = document.getElementById('desc-seo-chars');
        if (c) c.textContent = descInput.value.length;
    });

    document.getElementById('btn-cambiar-portada-p3')?.addEventListener('click', () => {
        if (callbacks.onCambiarPortada) callbacks.onCambiarPortada();
    });

    document.getElementById('btn-ia-title')?.addEventListener('click', () =>
        generarSEO(state, 'title')
    );
    document.getElementById('btn-ia-desc')?.addEventListener('click', () =>
        generarSEO(state, 'desc')
    );

    document.getElementById('btn-generar-jsonld')?.addEventListener('click', () =>
        generarJsonLd(state)
    );

    document.getElementById('btn-copiar-jsonld')?.addEventListener('click', () => {
        const code = document.getElementById('jsonld-code')?.textContent || '';
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('btn-copiar-jsonld');
            if (btn) { btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado'; setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar'; }, 2000); }
        });
    });

    document.getElementById('btn-guardar-paso3')?.addEventListener('click', () =>
        guardarPaso3(state, callbacks)
    );

    titleInput?.dispatchEvent(new Event('input'));
}

async function generarJsonLd(state) {
    const btn     = document.getElementById('btn-generar-jsonld');
    const loading = document.getElementById('jsonld-loading');
    const preview = document.getElementById('jsonld-preview');
    const code    = document.getElementById('jsonld-code');

    if (btn) { btn.disabled = true; }
    loading?.classList.remove('hidden');
    preview?.classList.add('hidden');

    try {
        const res = await fetchAPI(
            `/website/propiedad/${state.propiedadId}/build-context/generate-jsonld`,
            { method: 'POST' }
        );

        // Actualizar buildContext en state
        if (!state.buildContext) state.buildContext = {};
        if (!state.buildContext.publicacion) state.buildContext.publicacion = {};
        state.buildContext.publicacion = { ...state.buildContext.publicacion, ...res };

        // Mostrar preview
        if (code) code.textContent = JSON.stringify(res.jsonLd || res, null, 2);
        preview?.classList.remove('hidden');

        // Prefill meta SEO desde JSON-LD si los campos están vacíos
        const titleInput = document.getElementById('input-meta-title');
        const descInput  = document.getElementById('input-meta-desc');
        if (res.metaTitle && titleInput) {
            if (!titleInput.value.trim()) {
                titleInput.value = res.metaTitle;
                titleInput.dispatchEvent(new Event('input'));
            }
        }
        if (res.metaDescription && descInput && !descInput.value.trim()) {
            descInput.value = res.metaDescription;
            descInput.dispatchEvent(new Event('input'));
        }
    } catch (err) {
        alert('Error al generar JSON-LD: ' + (err.message || 'Intenta nuevamente'));
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Regenerar'; }
        loading?.classList.add('hidden');
    }
}

async function generarSEO(state, campo) {
    const btn = document.getElementById(campo === 'title' ? 'btn-ia-title' : 'btn-ia-desc');
    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
        const wd     = state.propiedadData || {};
        const nombre = state.propiedadNombre || '';
        const desc   = wd.aiDescription || '';
        if (campo === 'title') {
            const input = document.getElementById('input-meta-title');
            if (input) {
                input.value = buildHeuristicMetaTitle(nombre, desc);
                input.dispatchEvent(new Event('input'));
            }
        } else {
            const input = document.getElementById('input-meta-desc');
            if (input) {
                input.value = desc.slice(0, 155).trim();
                input.dispatchEvent(new Event('input'));
            }
        }
    } finally {
        if (btn) { btn.textContent = '⚡'; btn.disabled = false; }
    }
}

async function guardarPaso3(state, callbacks) {
    const btn         = document.getElementById('btn-guardar-paso3');
    const metaTitle   = document.getElementById('input-meta-title')?.value?.trim() || '';
    const metaDesc    = document.getElementById('input-meta-desc')?.value?.trim()  || '';

    btn.innerHTML = '<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Guardando...';
    btn.disabled = true;
    try {
        await fetchAPI(`/website/propiedad/${state.propiedadId}/seo`, {
            method: 'PUT', body: { metaTitle, metaDescription: metaDesc }
        });
        if (!state.propiedadData) state.propiedadData = {};
        state.propiedadData.metaTitle       = metaTitle;
        state.propiedadData.metaDescription = metaDesc;
        callbacks.onFinish();
    } catch (err) {
        alert('Error al guardar: ' + err.message);
        btn.innerHTML = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Guardar todo';
        btn.disabled = false;
    }
}


function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
