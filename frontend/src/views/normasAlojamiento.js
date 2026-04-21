/**
 * Normas y reglas del alojamiento — /normas-alojamiento
 * Defectos globales (empresa) o reglas por alojamiento (antes de Contenido Web).
 */
import { fetchAPI } from '../api.js';

const ITEM_META = [
    { key: 'respetoHogar', label: 'Tratar el alojamiento con cuidado y respeto', hint: 'Como en la casa de otra persona.' },
    { key: 'juntaToallas', label: 'Juntar las toallas usadas antes de irse', hint: '' },
    { key: 'sacaBasura', label: 'Sacar la basura', hint: 'Según indicaciones del anfitrión.' },
    { key: 'cierraLlave', label: 'Cerrar con llave al salir', hint: '' },
    { key: 'descargoObjetosOlvidados', label: 'Aviso de objetos olvidados', hint: 'Ej.: revisar pertenencias; política sobre olvidos.' },
    { key: 'noFiestasEventos', label: 'No fiestas ni eventos', hint: '' },
    { key: 'noVisitasNoAutorizadas', label: 'No visitas no autorizadas', hint: '' },
    { key: 'apagaLucesAire', label: 'Apagar luces y climatización al salir', hint: '' },
    { key: 'lavavajillasLimpio', label: 'Dejar cocina / lavavajillas en orden', hint: '' },
    { key: 'separacionBasuraReciclaje', label: 'Separar basura o reciclaje', hint: 'Según indicaciones locales.' },
];

/** Textos tipo plantilla (solo informativos; revisar con asesoría legal si aplica). */
const TEXT_PLANTILLAS = [
    {
        id: 'olvidos',
        label: 'Objetos olvidados',
        texto: 'Antes de partir, revisa armarios, cajones, baños, nevera y enchufes. No nos hacemos responsables de objetos personales olvidados en el alojamiento.',
    },
    {
        id: 'revision_salida',
        label: 'Revisión al salir',
        texto: 'Asegúrate de cerrar ventanas, apagar luces y climatización, y dejar la llave (o el acceso) según las instrucciones recibidas.',
    },
    {
        id: 'danos',
        label: 'Daños y cuidado',
        texto: 'El huésped es responsable del buen uso de la vivienda y mobiliario. Los daños o pérdidas imputables podrán reclamarse conforme a la reserva y la ley aplicable.',
    },
    {
        id: 'vecinos',
        label: 'Convivencia',
        texto: 'Respeta el descanso de vecinos y las normas de la comunidad de propietarios. Evita ruidos molestos en escaleras y zonas comunes.',
    },
    {
        id: 'instalaciones',
        label: 'Piscina / zonas comunes',
        texto: 'El uso de piscina, jacuzzi, sauna, gimnasio u otras zonas comunes es bajo tu propia responsabilidad, salvo normativa específica indicada en el alojamiento.',
    },
];

const MAX_TEXTO_ADICIONAL = 2000;

function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function emptyRules() {
    return {
        admiteMascotas: 'bajo_consulta',
        permiteFumar: 'no',
        horaEntrada: '',
        horaSalida: '',
        llegadaAutonomaNota: '',
        horasSilencioInicio: '',
        horasSilencioFin: '',
        maxHuespedes: null,
        fotografiaComercialAutorizada: false,
        items: Object.fromEntries(ITEM_META.map(({ key }) => [key, false])),
        textoAdicional: '',
    };
}

function mergeClient(empresaDefaults, normasProp) {
    const base = { ...emptyRules(), ...(empresaDefaults && typeof empresaDefaults === 'object' ? empresaDefaults : {}) };
    const itemsBase = { ...emptyRules().items, ...(base.items || {}) };
    base.items = itemsBase;
    const over = normasProp && typeof normasProp === 'object' ? normasProp : {};
    const out = { ...base, ...over, items: { ...itemsBase, ...(over.items || {}) } };
    return out;
}

let state = {
    loading: true,
    error: null,
    empresaDefaults: null,
    propiedades: [],
    modo: 'empresa',
    propiedadId: '',
    draft: emptyRules(),
    saving: false,
    savedMsg: '',
};

function setDraftFromMode() {
    const def = state.empresaDefaults;
    if (state.modo === 'empresa') {
        state.draft = mergeClient(def, {});
        return;
    }
    const p = state.propiedades.find((x) => x.id === state.propiedadId);
    state.draft = mergeClient(def, p?.normasAlojamiento || {});
}

async function cargar(options = {}) {
    const silent = !!options.silent;
    if (!silent) state.loading = true;
    state.error = null;
    try {
        const data = await fetchAPI('/propiedades/house-rules');
        state.empresaDefaults = data.empresaDefaults;
        state.propiedades = Array.isArray(data.propiedades) ? data.propiedades : [];
        if (state.modo === 'propiedad' && state.propiedadId) {
            const ok = state.propiedades.some((p) => p.id === state.propiedadId);
            if (!ok) state.propiedadId = state.propiedades[0]?.id || '';
        }
        setDraftFromMode();
    } catch (e) {
        state.error = e.message || 'Error al cargar';
    } finally {
        if (!silent) state.loading = false;
    }
}

function collectDraftFromDom() {
    const g = (id) => document.getElementById(id);
    const items = {};
    ITEM_META.forEach(({ key }) => {
        const el = g(`nr-item-${key}`);
        items[key] = !!(el && el.checked);
    });
    const maxRaw = (g('nr-max-huespedes')?.value || '').trim();
    let maxHuespedes = null;
    if (maxRaw !== '') {
        const n = parseInt(maxRaw, 10);
        if (Number.isFinite(n) && n > 0) maxHuespedes = n;
    }
    return {
        admiteMascotas: g('nr-mascotas')?.value || 'bajo_consulta',
        permiteFumar: g('nr-fumar')?.value || 'no',
        horaEntrada: (g('nr-hora-entrada')?.value || '').trim(),
        horaSalida: (g('nr-hora-salida')?.value || '').trim(),
        llegadaAutonomaNota: (g('nr-llegada-auto')?.value || '').trim(),
        horasSilencioInicio: (g('nr-silencio-ini')?.value || '').trim(),
        horasSilencioFin: (g('nr-silencio-fin')?.value || '').trim(),
        maxHuespedes,
        fotografiaComercialAutorizada: !!(g('nr-foto-comercial')?.checked),
        items,
        textoAdicional: (g('nr-texto-adicional')?.value || '').trim(),
    };
}

function renderForm() {
    const d = state.draft;
    const itemsHtml = ITEM_META.map(({ key, label, hint }) => `
        <label class="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" id="nr-item-${key}" class="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                ${d.items?.[key] ? 'checked' : ''}>
            <span>
                <span class="font-medium text-gray-800">${esc(label)}</span>
                ${hint ? `<span class="block text-xs text-gray-500 mt-0.5">${esc(hint)}</span>` : ''}
            </span>
        </label>
    `).join('');

    return `
        <div class="max-w-3xl mx-auto space-y-8">
            ${state.error ? `<div class="rounded-xl border border-danger-200 bg-danger-50 text-danger-800 text-sm px-4 py-3">${esc(state.error)}</div>` : ''}
            <div>
                <h2 class="text-2xl font-bold text-gray-900">Normas y reglas del alojamiento</h2>
                <p class="text-sm text-gray-500 mt-1">
                    Define políticas tipo plataformas (mascotas, fumar, horarios, silencio, llegada/salida y recordatorios para huéspedes).
                    Puedes establecer <strong>defectos para todos</strong> los alojamientos o ajustar <strong>uno en particular</strong>.
                </p>
            </div>

            <div class="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
                <button type="button" id="nr-modo-empresa" class="nr-modo px-4 py-2 rounded-xl text-sm font-medium transition-colors
                    ${state.modo === 'empresa' ? 'bg-white shadow text-primary-700' : 'text-gray-600 hover:text-gray-900'}">
                    <i class="fa-solid fa-building mr-1.5"></i> Todos los alojamientos
                </button>
                <button type="button" id="nr-modo-propiedad" class="nr-modo px-4 py-2 rounded-xl text-sm font-medium transition-colors
                    ${state.modo === 'propiedad' ? 'bg-white shadow text-primary-700' : 'text-gray-600 hover:text-gray-900'}">
                    <i class="fa-solid fa-house-chimney mr-1.5"></i> Un alojamiento
                </button>
            </div>

            ${state.modo === 'propiedad' ? `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Alojamiento</label>
                    <select id="nr-select-prop" class="w-full max-w-md rounded-xl border-gray-200 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                        ${state.propiedades.length === 0
        ? '<option value="">No hay alojamientos</option>'
        : state.propiedades.map((p) =>
            `<option value="${esc(p.id)}" ${p.id === state.propiedadId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}
                    </select>
                    <p class="text-xs text-gray-500 mt-1">Se guardan las reglas de este alojamiento. Si cambias los defectos globales, revisa aquí si quieres alinearlas.</p>
                </div>
            ` : `
                <p class="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    Estos valores sirven de base. En cada alojamiento puedes definir un juego distinto (pantalla “Un alojamiento”).
                </p>
            `}

            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                <h3 class="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Políticas principales</h3>
                <div class="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Mascotas</label>
                        <select id="nr-mascotas" class="w-full rounded-xl border-gray-200 shadow-sm">
                            <option value="si" ${d.admiteMascotas === 'si' ? 'selected' : ''}>Se admiten mascotas</option>
                            <option value="no" ${d.admiteMascotas === 'no' ? 'selected' : ''}>No se admiten mascotas</option>
                            <option value="bajo_consulta" ${d.admiteMascotas === 'bajo_consulta' ? 'selected' : ''}>Solo bajo consulta</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Fumar</label>
                        <select id="nr-fumar" class="w-full rounded-xl border-gray-200 shadow-sm">
                            <option value="no" ${d.permiteFumar === 'no' ? 'selected' : ''}>Prohibido fumar</option>
                            <option value="solo_exterior" ${d.permiteFumar === 'solo_exterior' ? 'selected' : ''}>Solo en exterior / zonas señaladas</option>
                            <option value="si" ${d.permiteFumar === 'si' ? 'selected' : ''}>Permitido</option>
                        </select>
                    </div>
                </div>

                <div class="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Llegada desde</label>
                        <input id="nr-hora-entrada" type="text" placeholder="ej. 16:00" value="${esc(d.horaEntrada)}"
                            class="w-full rounded-xl border-gray-200 shadow-sm" maxlength="16">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Salida antes de</label>
                        <input id="nr-hora-salida" type="text" placeholder="ej. 10:00" value="${esc(d.horaSalida)}"
                            class="w-full rounded-xl border-gray-200 shadow-sm" maxlength="16">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Llegada autónoma / acceso</label>
                    <input id="nr-llegada-auto" type="text" placeholder="ej. Candado inteligente, caja de llaves…" value="${esc(d.llegadaAutonomaNota)}"
                        class="w-full rounded-xl border-gray-200 shadow-sm" maxlength="120">
                </div>

                <div class="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Silencio desde</label>
                        <input id="nr-silencio-ini" type="text" placeholder="ej. 22:00" value="${esc(d.horasSilencioInicio)}"
                            class="w-full rounded-xl border-gray-200 shadow-sm" maxlength="16">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Silencio hasta</label>
                        <input id="nr-silencio-fin" type="text" placeholder="ej. 08:00" value="${esc(d.horasSilencioFin)}"
                            class="w-full rounded-xl border-gray-200 shadow-sm" maxlength="16">
                    </div>
                </div>

                <div class="grid sm:grid-cols-2 gap-4 items-end">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Huéspedes máx. (opcional)</label>
                        <input id="nr-max-huespedes" type="number" min="1" max="999" placeholder="Vacío = según capacidad del alojamiento"
                            value="${d.maxHuespedes != null ? esc(String(d.maxHuespedes)) : ''}"
                            class="w-full rounded-xl border-gray-200 shadow-sm">
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer pb-1">
                        <input type="checkbox" id="nr-foto-comercial" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            ${d.fotografiaComercialAutorizada ? 'checked' : ''}>
                        <span class="text-sm text-gray-800">Fotografía / video comercial autorizado</span>
                    </label>
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h3 class="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Reglas de la casa (checklist)</h3>
                <p class="text-sm text-gray-500">Inspirado en lo que suelen mostrar Airbnb y similares; activa las que apliquen.</p>
                <div class="grid gap-2">${itemsHtml}</div>
            </div>

            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
                <h3 class="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-2">Solicitudes adicionales</h3>
                <p class="text-xs text-gray-500">Texto libre para huéspedes. Puedes insertar <strong>plantillas</strong> al final y luego editarlas; no sustituyen asesoría legal.</p>
                <div class="flex flex-wrap gap-2">
                    ${TEXT_PLANTILLAS.map((p) => `
                        <button type="button" class="nr-plantilla inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                            border border-gray-200 bg-gray-50 text-gray-700 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-800 transition-colors"
                            data-plantilla="${esc(p.id)}" title="Añade este párrafo al final del texto">
                            <i class="fa-solid fa-file-lines text-primary-500"></i>${esc(p.label)}
                        </button>
                    `).join('')}
                </div>
                <textarea id="nr-texto-adicional" rows="5" maxlength="${MAX_TEXTO_ADICIONAL}" placeholder="Ej.: revisar cajones y armarios; no somos responsables de objetos olvidados…"
                    class="w-full rounded-xl border-gray-200 shadow-sm text-sm">${esc(d.textoAdicional)}</textarea>
            </div>

            ${state.savedMsg ? `<p class="text-sm text-success-700 font-medium">${esc(state.savedMsg)}</p>` : ''}
            ${state.error ? `<p class="text-sm text-danger-600">${esc(state.error)}</p>` : ''}

            <div class="flex flex-wrap gap-3 pb-8">
                <button type="button" id="nr-guardar" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
                    ${state.saving ? 'disabled' : ''}>
                    ${state.saving ? '<i class="fa-solid fa-spinner fa-spin"></i> Guardando…' : '<i class="fa-solid fa-floppy-disk"></i> Guardar'}
                </button>
            </div>
        </div>
    `;
}

function renderRoot() {
    const root = document.getElementById('na-root');
    if (!root) return;
    if (state.loading) {
        root.innerHTML = `<div class="flex justify-center py-24"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div></div>`;
        return;
    }
    root.innerHTML = `<div class="min-h-screen bg-gray-50 py-8 px-4">${renderForm()}</div>`;
    bind();
}

function bind() {
    document.querySelectorAll('.nr-modo').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (btn.id === 'nr-modo-empresa') state.modo = 'empresa';
            if (btn.id === 'nr-modo-propiedad') {
                state.modo = 'propiedad';
                if (!state.propiedadId && state.propiedades[0]) state.propiedadId = state.propiedades[0].id;
            }
            setDraftFromMode();
            state.savedMsg = '';
            renderRoot();
        });
    });
    const sel = document.getElementById('nr-select-prop');
    if (sel) {
        sel.addEventListener('change', () => {
            state.propiedadId = sel.value;
            setDraftFromMode();
            state.savedMsg = '';
            renderRoot();
        });
    }
    document.querySelectorAll('.nr-plantilla').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-plantilla');
            const plant = TEXT_PLANTILLAS.find((p) => p.id === id);
            const ta = document.getElementById('nr-texto-adicional');
            if (!plant || !ta) return;
            const cur = ta.value || '';
            const sep = cur.trim() ? '\n\n' : '';
            let next = cur + sep + plant.texto;
            if (next.length > MAX_TEXTO_ADICIONAL) {
                next = next.slice(0, MAX_TEXTO_ADICIONAL);
                state.savedMsg = 'Plantilla añadida; el texto se cortó al límite de 2000 caracteres. Revisa el final.';
            } else {
                state.savedMsg = 'Plantilla añadida al texto. Revísala y adáptala a tu alojamiento.';
            }
            ta.value = next;
            state.draft = collectDraftFromDom();
            state.error = null;
            renderRoot();
            const ta2 = document.getElementById('nr-texto-adicional');
            if (ta2) {
                ta2.focus();
                ta2.setSelectionRange(ta2.value.length, ta2.value.length);
            }
        });
    });

    const save = document.getElementById('nr-guardar');
    if (save) {
        save.addEventListener('click', async () => {
            state.draft = collectDraftFromDom();
            state.saving = true;
            state.savedMsg = '';
            renderRoot();
            try {
                state.error = null;
                const body = collectDraftFromDom();
                if (state.modo === 'empresa') {
                    await fetchAPI('/propiedades/house-rules/defaults', { method: 'PUT', body });
                } else {
                    if (!state.propiedadId) throw new Error('Selecciona un alojamiento.');
                    await fetchAPI(`/propiedades/house-rules/propiedad/${state.propiedadId}`, { method: 'PUT', body });
                }
                await cargar({ silent: true });
                state.savedMsg = state.modo === 'empresa' ? 'Defectos globales guardados.' : 'Reglas del alojamiento guardadas.';
            } catch (e) {
                state.error = e.message || 'Error al guardar';
            } finally {
                state.saving = false;
                renderRoot();
            }
        });
    }
}

export async function render() {
    return `<div id="na-root" class="min-h-screen bg-gray-50"></div>`;
}

export async function afterRender() {
    state = {
        loading: true,
        error: null,
        empresaDefaults: null,
        propiedades: [],
        modo: 'empresa',
        propiedadId: '',
        draft: emptyRules(),
        saving: false,
        savedMsg: '',
    };
    renderRoot();
    await cargar();
    renderRoot();
}
