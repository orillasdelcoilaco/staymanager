/**
 * Términos y condiciones (OTA-style) — Configuración > ítem independiente.
 * Persistencia: websiteSettings.terminosCondiciones vía PUT /website/home-settings
 * Incluye versión EN para sitio público cuando idiomaPorDefecto es inglés.
 */
import { fetchAPI } from '../api.js';

const SECTION_ORDER = [
    'introduccion',
    'usoInformacion',
    'consentimientoDatosResenas',
    'reservasPagos',
    'seguridadNormasUso',
    'conductaAreasComunes',
    'menoresMascotasPrivacidad',
    'operadorLeyAplicable',
];

const LABELS = {
    introduccion: 'Alcance y aceptación',
    usoInformacion: 'Uso de la información personal',
    consentimientoDatosResenas: 'Consentimiento, comunicaciones y reseñas',
    reservasPagos: 'Reservas, pagos y cancelación',
    seguridadNormasUso: 'Seguridad y normas de uso',
    conductaAreasComunes: 'Conducta y áreas comunes',
    menoresMascotasPrivacidad: 'Menores, mascotas y privacidad',
    operadorLeyAplicable: 'Operador y ley aplicable',
};

const LABELS_EN = {
    introduccion: 'Scope and acceptance',
    usoInformacion: 'Use of personal information',
    consentimientoDatosResenas: 'Consent, communications and reviews',
    reservasPagos: 'Bookings, payments and cancellation',
    seguridadNormasUso: 'Safety and facility rules',
    conductaAreasComunes: 'Conduct and shared areas',
    menoresMascotasPrivacidad: 'Children, pets and privacy',
    operadorLeyAplicable: 'Operator and governing law',
};

function emptyDraft() {
    const secciones = {};
    const seccionesEn = {};
    for (const k of SECTION_ORDER) {
        secciones[k] = { titulo: LABELS[k], html: '' };
        seccionesEn[k] = { titulo: LABELS_EN[k], html: '' };
    }
    return {
        publicado: false,
        tituloPagina: 'Términos y condiciones',
        tituloPaginaEn: 'Terms and conditions',
        plantillaVersion: '',
        secciones,
        seccionesEn,
    };
}

function mergeDraftFromEmpresa(ws) {
    const raw = ws && ws.terminosCondiciones;
    const d = emptyDraft();
    if (!raw || typeof raw !== 'object') return d;
    d.publicado = !!raw.publicado;
    d.tituloPagina = raw.tituloPagina || d.tituloPagina;
    d.tituloPaginaEn = raw.tituloPaginaEn != null && String(raw.tituloPaginaEn).trim()
        ? String(raw.tituloPaginaEn).trim()
        : d.tituloPaginaEn;
    d.plantillaVersion = raw.plantillaVersion || '';
    const sec = raw.secciones && typeof raw.secciones === 'object' ? raw.secciones : {};
    for (const k of SECTION_ORDER) {
        const s = sec[k];
        if (s && typeof s === 'object') {
            d.secciones[k] = {
                titulo: (s.titulo != null && String(s.titulo).trim()) ? String(s.titulo).trim() : LABELS[k],
                html: s.html != null ? String(s.html) : '',
            };
        }
    }
    const secEn = raw.seccionesEn && typeof raw.seccionesEn === 'object' ? raw.seccionesEn : {};
    for (const k of SECTION_ORDER) {
        const s = secEn[k];
        if (s && typeof s === 'object') {
            d.seccionesEn[k] = {
                titulo: (s.titulo != null && String(s.titulo).trim()) ? String(s.titulo).trim() : LABELS_EN[k],
                html: s.html != null ? String(s.html) : '',
            };
        }
    }
    return d;
}

let state = {
    draft: emptyDraft(),
    saving: false,
    msg: '',
    err: '',
};

function escAttr(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function renderForm() {
    const d = state.draft;
    const rows = SECTION_ORDER.map((key) => {
        const sec = d.secciones[key] || { titulo: '', html: '' };
        const secEn = d.seccionesEn[key] || { titulo: '', html: '' };
        return `
        <div class="border border-gray-200 rounded-lg p-4 space-y-3 bg-white">
            <p class="text-xs font-semibold text-primary-700 uppercase tracking-wide">Español — ${LABELS[key]}</p>
            <label class="block text-sm font-medium text-gray-700">Título (página pública)</label>
            <input type="text" data-tc-titulo="${key}" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value="${escAttr(sec.titulo || '')}" />
            <label class="block text-sm font-medium text-gray-700 mt-1">Contenido HTML</label>
            <textarea data-tc-html="${key}" rows="8" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"></textarea>
            <div class="mt-4 pt-3 border-t border-gray-100 space-y-2">
                <p class="text-xs font-semibold text-primary-700 uppercase tracking-wide">English — ${LABELS_EN[key]}</p>
                <label class="block text-sm font-medium text-gray-700">Section title (public page)</label>
                <input type="text" data-tc-titulo-en="${key}" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    value="${escAttr(secEn.titulo || '')}" />
                <label class="block text-sm font-medium text-gray-700 mt-1">HTML content</label>
                <textarea data-tc-html-en="${key}" rows="8" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"></textarea>
            </div>
        </div>`;
    }).join('');

    return `
    <div class="bg-white p-8 rounded-lg shadow space-y-6 max-w-4xl mx-auto">
        <div class="border-b pb-4">
            <h2 class="text-2xl font-semibold text-gray-900">Términos y condiciones</h2>
            <p class="text-gray-500 mt-1 text-sm">
                Español e inglés para el sitio público (según idioma por defecto de la empresa). Modelo tipo OTA.
                <strong class="text-gray-700">Revisa con asesoría legal</strong> antes de publicar.
            </p>
        </div>
        ${state.err ? `<div class="rounded-md bg-danger-50 text-danger-800 px-4 py-2 text-sm">${state.err}</div>` : ''}
        ${state.msg ? `<div class="rounded-md bg-success-50 text-success-800 px-4 py-2 text-sm">${state.msg}</div>` : ''}
        <div class="flex flex-wrap gap-2">
            <button type="button" id="btn-tc-plantilla" class="btn-outline text-sm">Cargar plantilla sugerida (ES + EN)</button>
            <a id="btn-tc-preview" href="#" target="_blank" rel="noopener" class="btn-ghost text-sm inline-flex items-center">Vista previa sitio público</a>
        </div>
        <div class="space-y-4">
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="tc-publicado" class="rounded border-gray-300 text-primary-600" ${d.publicado ? 'checked' : ''} />
                <span class="text-sm font-medium text-gray-800">Publicar en el sitio (enlace en cabecera, pie y checkout)</span>
            </label>
            <div class="grid md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Título de la página (ES)</label>
                    <input type="text" id="tc-titulo-pagina" class="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        value="${escAttr(d.tituloPagina || '')}" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Page title (EN)</label>
                    <input type="text" id="tc-titulo-pagina-en" class="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        value="${escAttr(d.tituloPaginaEn || '')}" />
                </div>
            </div>
        </div>
        <div class="space-y-6">${rows}</div>
        <div class="flex gap-3 pt-4 border-t">
            <button type="button" id="btn-tc-guardar" class="btn-primary" ${state.saving ? 'disabled' : ''}>
                ${state.saving ? 'Guardando…' : 'Guardar'}
            </button>
        </div>
    </div>`;
}

function collectDraftFromDom() {
    const d = JSON.parse(JSON.stringify(state.draft));
    d.publicado = !!document.getElementById('tc-publicado')?.checked;
    d.tituloPagina = document.getElementById('tc-titulo-pagina')?.value?.trim() || 'Términos y condiciones';
    d.tituloPaginaEn = document.getElementById('tc-titulo-pagina-en')?.value?.trim() || 'Terms and conditions';
    for (const key of SECTION_ORDER) {
        const tit = document.querySelector(`[data-tc-titulo="${key}"]`)?.value ?? d.secciones[key].titulo;
        const rawTa = document.querySelector(`textarea[data-tc-html="${key}"]`);
        const html = rawTa ? rawTa.value : d.secciones[key].html;
        d.secciones[key] = { titulo: tit.trim() || LABELS[key], html };

        const titEn = document.querySelector(`[data-tc-titulo-en="${key}"]`)?.value ?? d.seccionesEn[key].titulo;
        const rawTaEn = document.querySelector(`textarea[data-tc-html-en="${key}"]`);
        const htmlEn = rawTaEn ? rawTaEn.value : d.seccionesEn[key].html;
        d.seccionesEn[key] = { titulo: titEn.trim() || LABELS_EN[key], html: htmlEn };
    }
    return d;
}

function fillTextareas(rootEl) {
    if (!rootEl) return;
    for (const key of SECTION_ORDER) {
        const ta = rootEl.querySelector(`textarea[data-tc-html="${key}"]`);
        if (ta) ta.value = state.draft.secciones[key]?.html || '';
        const taEn = rootEl.querySelector(`textarea[data-tc-html-en="${key}"]`);
        if (taEn) taEn.value = state.draft.seccionesEn[key]?.html || '';
    }
}

function wirePreview() {
    const a = document.getElementById('btn-tc-preview');
    if (!a) return;
    const sub = window.__empresaTc?.websiteSettings?.general?.subdomain
        || window.__empresaTc?.subdominio
        || '';
    const clean = String(sub || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (clean) {
        a.href = isLocal
            ? `http://localhost:3001/terminos-y-condiciones?force_host=${clean}.onrender.com`
            : `https://${clean}.onrender.com/terminos-y-condiciones`;
        a.classList.remove('pointer-events-none', 'opacity-50');
    } else {
        a.href = '#';
        a.classList.add('pointer-events-none', 'opacity-50');
    }
}

export async function render() {
    return `<div id="terminos-condiciones-root"><div class="flex justify-center p-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div></div>`;
}

export async function afterRender() {
    const root = document.getElementById('terminos-condiciones-root');
    if (!root) return;
    try {
        const empresa = await fetchAPI('/empresa');
        window.__empresaTc = empresa;
        state.draft = mergeDraftFromEmpresa(empresa.websiteSettings || {});
        state.err = '';
        state.msg = '';
        root.innerHTML = renderForm();
        fillTextareas(root);
        wirePreview();

        document.getElementById('btn-tc-plantilla')?.addEventListener('click', async () => {
            if (!confirm('¿Reemplazar todas las secciones (ES + EN) con la plantilla sugerida? Se perderá el borrador actual en pantalla.')) return;
            try {
                const { plantilla } = await fetchAPI('/website/terminos-condiciones/plantilla');
                state.draft = plantilla;
                state.msg = 'Plantilla cargada. Revisa y guarda.';
                root.innerHTML = renderForm();
                fillTextareas(root);
                wirePreview();
            } catch (e) {
                state.err = e.message || 'No se pudo cargar la plantilla';
                root.innerHTML = renderForm();
                fillTextareas(root);
                wirePreview();
            }
        });

        document.getElementById('btn-tc-guardar')?.addEventListener('click', async () => {
            const body = collectDraftFromDom();
            state.saving = true;
            state.err = '';
            state.msg = '';
            try {
                await fetchAPI('/website/home-settings', { method: 'PUT', body: { terminosCondiciones: body } });
                state.draft = body;
                state.msg = 'Guardado correctamente.';
            } catch (e) {
                state.err = e.message || 'Error al guardar';
            } finally {
                state.saving = false;
                root.innerHTML = renderForm();
                fillTextareas(root);
                wirePreview();
            }
        });
    } catch (e) {
        root.innerHTML = `<p class="text-danger-600 p-6">${e.message || 'Error de carga'}</p>`;
    }
}
