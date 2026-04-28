// frontend/src/views/comunicaciones.js
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

function escapeAttr(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function isUuid(s) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

function badgeEstado(estado) {
    const map = {
        enviado: 'bg-success-100 text-success-800',
        fallido: 'bg-danger-100 text-danger-800',
        pendiente: 'bg-warning-100 text-warning-800',
        recibido: 'bg-primary-100 text-primary-800',
        leido: 'bg-sky-100 text-sky-800',
    };
    return `<span class="px-2 py-0.5 text-xs font-semibold rounded-full ${map[estado] || 'bg-gray-100 text-gray-700'}">${estado || '—'}</span>`;
}

function fmtFecha(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
        return String(iso);
    }
}

function filaRelacion(c) {
    const rc = c.relacionadoCon;
    if (!rc?.tipo) return '<span class="text-gray-400">—</span>';
    const tipo = String(rc.tipo).toLowerCase();
    const id = String(rc.id || '').trim();
    const short = id.length > 14 ? `${id.slice(0, 14)}…` : id;
    const label = `${escapeHtml(tipo)} <span class="font-mono">${escapeHtml(short)}</span>`;
    if (tipo === 'reserva' && isUuid(id)) {
        return `<a href="/gestionar-reservas?reservaId=${encodeURIComponent(id)}" class="com-app-link text-primary-600 hover:underline text-xs">${label}</a>`;
    }
    if (tipo === 'reserva' && id) {
        return `<a href="/gestionar-reservas" class="com-app-link text-primary-600 hover:underline text-xs" title="Abrir reservas (búsqueda manual por ID)">${label}</a>`;
    }
    if (tipo === 'propuesta' && id) {
        const title = escapeAttr(`Abrir gestión de propuestas (grupo ${id})`);
        return `<a href="/gestionar-propuestas" class="com-app-link text-primary-600 hover:underline text-xs" title="${title}">${label}</a>`;
    }
    return `<span class="text-xs text-gray-600">${label}</span>`;
}

function iconoTipo(t) {
    if (t === 'whatsapp') return '<i class="fa-brands fa-whatsapp text-success-600" title="WhatsApp"></i>';
    if (t === 'sms') return '<i class="fa-solid fa-mobile-screen-button text-gray-500" title="SMS"></i>';
    return '<i class="fa-solid fa-envelope text-gray-500" title="Email"></i>';
}

/** Alineado con `comunicacionesRetryService`: reserva, propuesta, o fallido sin relación de reserva (plantilla / disparador). */
const EVENTOS_REINTENTO_EXIGEN_RESERVA_PG = new Set([
    'reserva-confirmada',
    'reserva-cancelada',
    'reserva-modificada',
    'recordatorio-pre-llegada',
    'evaluacion-pendiente',
]);

const EVENTO_A_DISPARADOR_REINTENTO = new Set([
    'consulta-web-publica',
]);

function esReintentable(c) {
    if (c.tipo !== 'email' || c.estado !== 'fallido' || !c.id || !c.clienteId) return false;
    const rc = c.relacionadoCon;
    const t = rc ? String(rc.tipo || '').trim().toLowerCase() : '';
    const rid = rc ? String(rc.id || '').trim() : '';
    if (t === 'reserva') return Boolean(rid);
    if (t === 'propuesta') return Boolean(rid);
    const ev = String(c.evento || '');
    if (EVENTOS_REINTENTO_EXIGEN_RESERVA_PG.has(ev)) return false;
    const sinRel = !t && !rid;
    if (sinRel) {
        return Boolean(c.plantillaId || EVENTO_A_DISPARADOR_REINTENTO.has(ev));
    }
    return Boolean(c.plantillaId || EVENTO_A_DISPARADOR_REINTENTO.has(ev));
}

function colAcciones(c) {
    if (esReintentable(c)) {
        return `<button type="button" class="com-reintentar-btn text-xs text-primary-600 hover:underline font-medium disabled:opacity-40" data-id="${escapeAttr(c.id)}">Reintentar</button>`;
    }
    return '<span class="text-gray-300">—</span>';
}

function colCheckbox(c) {
    if (!esReintentable(c)) {
        return '<span class="inline-block w-4"></span>';
    }
    return `<input type="checkbox" class="com-row-chk accent-primary-600" data-id="${escapeAttr(c.id)}" title="Incluir en reintento masivo">`;
}

function fila(c) {
    return `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
            <td class="py-2 px-2 text-center w-10">${colCheckbox(c)}</td>
            <td class="py-2 px-3 whitespace-nowrap text-gray-500">${fmtFecha(c.fechaEnvio)}</td>
            <td class="py-2 px-3 text-center text-sm">${iconoTipo(c.tipo)}</td>
            <td class="py-2 px-3">${badgeEstado(c.estado)}</td>
            <td class="py-2 px-3 font-mono text-xs text-gray-600">${c.evento || '—'}</td>
            <td class="py-2 px-3 max-w-[200px] truncate" title="${escapeAttr(c.asunto)}">${c.asunto || '—'}</td>
            <td class="py-2 px-3 text-xs">${c.destinatario || '—'}</td>
            <td class="py-2 px-3">
                ${c.clienteNombre && c.clienteId
        ? `<a href="/cliente/${c.clienteId}?tab=correos" class="com-cliente-link text-primary-600 hover:underline">${escapeAttr(c.clienteNombre)}</a>`
        : '<span class="text-gray-400">—</span>'}
            </td>
            <td class="py-2 px-3 text-xs text-gray-500 max-w-[140px] truncate" title="${escapeAttr(c.plantillaNombre)}">${c.plantillaNombre || '—'}</td>
            <td class="py-2 px-3 text-gray-500">${filaRelacion(c)}</td>
            <td class="py-2 px-3 whitespace-nowrap">${colAcciones(c)}</td>
        </tr>`;
}

function ultimoResumen(u) {
    if (!u) return '—';
    return `${fmtFecha(u.fechaEnvio)} · ${badgeEstado(u.estado)} · ${iconoTipo(u.tipo)} <span class="font-mono text-gray-600">${escapeHtml(u.evento || '—')}</span>`;
}

function filaHilo(h) {
    const rc = h.relacionadoCon;
    const relHtml = (rc && String(rc.tipo || '').trim())
        ? filaRelacion({ relacionadoCon: rc })
        : '<span class="text-gray-400 italic text-xs" title="Mensajes sin vínculo a reserva ni propuesta (p. ej. consulta web)">Sin vínculo reserva/propuesta</span>';
    const cli = h.clienteNombre && h.clienteId
        ? `<a href="/cliente/${h.clienteId}?tab=correos" class="com-cliente-link text-primary-600 hover:underline">${escapeAttr(h.clienteNombre)}</a>`
        : '<span class="text-gray-400">—</span>';
    const dataTipo = escapeAttr(rc?.tipo || '');
    const dataId = escapeAttr(String(rc?.id || '').trim());
    const sinRel = !(rc && String(rc.tipo || '').trim());
    const dataSin = sinRel ? ' data-sin-rel="1"' : '';
    return `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">
            <td class="py-2 px-3">${cli}</td>
            <td class="py-2 px-3">${relHtml}</td>
            <td class="py-2 px-3 text-center font-medium text-gray-800">${h.mensajes ?? 0}</td>
            <td class="py-2 px-3 text-xs align-top">${ultimoResumen(h.ultimo)}</td>
            <td class="py-2 px-3 max-w-[220px] truncate text-xs text-gray-700" title="${escapeAttr(h.ultimo?.asunto)}">${escapeHtml(h.ultimo?.asunto || '—')}</td>
            <td class="py-2 px-3 whitespace-nowrap">
                <button type="button" class="com-ver-hilo-btn text-xs text-primary-600 hover:underline font-medium"
                    data-cliente="${escapeAttr(h.clienteId)}"
                    data-rel-tipo="${dataTipo}"
                    data-rel-id="${dataId}"${dataSin}>Ver historial</button>
            </td>
        </tr>`;
}

export function render() {
    return `
        <div class="space-y-6" id="com-root">
            <div id="com-fetch-error" class="hidden rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" role="alert">
                <div class="text-sm text-danger-900">
                    <p class="font-semibold">No se pudo cargar el historial</p>
                    <p id="com-fetch-error-msg" class="mt-0.5 text-danger-800/90"></p>
                </div>
                <button type="button" id="com-fetch-retry" class="btn-outline text-sm shrink-0 border-danger-300 text-danger-800 hover:bg-danger-100">Reintentar carga</button>
            </div>
            <div id="com-toast" class="hidden fixed bottom-6 right-6 z-50 max-w-md rounded-lg shadow-lg border px-4 py-3 text-sm" role="status"></div>
            <div class="bg-white p-6 rounded-xl shadow-sm">
                <h2 class="text-xl font-semibold text-gray-900 mb-1">Comunicaciones</h2>
                <p class="text-sm text-gray-500 mb-4">Historial de envíos por tenant y vista <strong class="font-medium text-gray-600">Por conversación</strong> (agrupa por cliente + relación o sin vínculo).</p>
                <div class="flex flex-wrap gap-2 border-b border-gray-200 pb-3 mb-4">
                    <button type="button" id="com-tab-lista" class="com-tab px-3 py-1.5 text-sm rounded-md font-medium bg-primary-100 text-primary-800">Lista cronológica</button>
                    <button type="button" id="com-tab-hilos" class="com-tab px-3 py-1.5 text-sm rounded-md font-medium text-gray-600 hover:bg-gray-100">Por conversación</button>
                </div>
                <div class="flex flex-wrap gap-3 items-end">
                    <div class="min-w-[200px] flex-1 max-w-md">
                        <label class="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
                        <input type="search" id="com-q" class="form-input text-sm w-full" placeholder="Asunto, correo, cliente…" autocomplete="off">
                    </div>
                </div>
            </div>

            <div id="com-panel-lista" class="space-y-4">
                <div class="bg-white p-6 rounded-xl shadow-sm pt-0 -mt-2">
                    <div class="flex flex-wrap gap-3 items-end">
                        <div>
                            <label class="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                            <select id="com-estado" class="form-select text-sm min-w-[130px]">
                                <option value="">Todos</option>
                                <option value="enviado">Enviado</option>
                                <option value="fallido">Fallido</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="recibido">Recibido</option>
                                <option value="leido">Leído / abierto</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                            <select id="com-tipo" class="form-select text-sm min-w-[110px]">
                                <option value="">Todos</option>
                                <option value="email">Email</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="sms">SMS</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-500 mb-1">Evento</label>
                            <input type="text" id="com-evento" class="form-input text-sm w-40" placeholder="ej. reserva-confirmada">
                        </div>
                        <button type="button" id="com-buscar" class="btn-primary text-sm">Aplicar</button>
                    </div>
                </div>
                <div id="com-chip-drill" class="hidden flex flex-wrap items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <span id="com-chip-drill-text" class="text-amber-900"></span>
                    <button type="button" id="com-chip-drill-clear" class="text-xs text-amber-800 underline font-medium">Quitar filtro de conversación</button>
                </div>
                <div id="com-lote-wrap" class="flex flex-wrap items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <button type="button" id="com-reintentar-lote" class="btn-outline text-sm" disabled>Reintentar seleccionados</button>
                    <span id="com-lote-hint" class="text-xs text-gray-500">Marca filas reintentables (correo fallido reintentable). Máximo 25 por lote en esta página.</span>
                </div>
                <div class="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="min-w-full text-left">
                            <thead class="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                <tr>
                                    <th class="py-2 px-2 text-center w-10" title="Selección masiva">
                                        <input type="checkbox" id="com-sel-all" class="accent-primary-600" title="Seleccionar todas las reintentables en esta página">
                                    </th>
                                    <th class="py-2 px-3">Fecha</th>
                                    <th class="py-2 px-3 text-center w-10" title="Canal">Tipo</th>
                                    <th class="py-2 px-3">Estado</th>
                                    <th class="py-2 px-3">Evento</th>
                                    <th class="py-2 px-3">Asunto</th>
                                    <th class="py-2 px-3">Destino</th>
                                    <th class="py-2 px-3">Cliente</th>
                                    <th class="py-2 px-3">Plantilla</th>
                                    <th class="py-2 px-3">Relación</th>
                                    <th class="py-2 px-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="com-tbody">
                                <tr><td colspan="11" class="py-8 text-center text-gray-400 text-sm">Cargando…</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
                        <span id="com-total"></span>
                        <div class="flex gap-2">
                            <button type="button" id="com-prev" class="btn-outline text-xs py-1 px-3" disabled>Anterior</button>
                            <button type="button" id="com-next" class="btn-outline text-xs py-1 px-3" disabled>Siguiente</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="com-panel-hilos" class="hidden space-y-4">
                <p class="text-xs text-gray-500 px-1">Cada fila resume el último mensaje del hilo. <strong class="text-gray-600">Ver historial</strong> filtra la lista cronológica por esa conversación. La búsqueda superior aplica a ambas vistas.</p>
                <div class="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="min-w-full text-left">
                            <thead class="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                <tr>
                                    <th class="py-2 px-3">Cliente</th>
                                    <th class="py-2 px-3">Relación</th>
                                    <th class="py-2 px-3 text-center">Mensajes</th>
                                    <th class="py-2 px-3">Último envío</th>
                                    <th class="py-2 px-3">Asunto (último)</th>
                                    <th class="py-2 px-3"> </th>
                                </tr>
                            </thead>
                            <tbody id="com-tbody-hilos">
                                <tr><td colspan="6" class="py-8 text-center text-gray-400 text-sm">Cargando…</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
                        <span id="com-total-hilos"></span>
                        <div class="flex gap-2">
                            <button type="button" id="com-hilos-prev" class="btn-outline text-xs py-1 px-3" disabled>Anterior</button>
                            <button type="button" id="com-hilos-next" class="btn-outline text-xs py-1 px-3" disabled>Siguiente</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

let vista = 'lista';
let offset = 0;
const limit = 50;
let lastTotal = 0;

let offsetHilos = 0;
const limitHilos = 30;
let lastTotalHilos = 0;

/** @type {{ clienteId: string, relacionTipo?: string, relacionId?: string, grupoSinRelacion?: boolean } | null} */
let drillFiltro = null;

function tabActivo(esLista) {
    const tLista = document.getElementById('com-tab-lista');
    const tHilos = document.getElementById('com-tab-hilos');
    const base = 'com-tab px-3 py-1.5 text-sm rounded-md font-medium';
    if (tLista) {
        tLista.className = `${base} ${esLista ? 'bg-primary-100 text-primary-800' : 'text-gray-600 hover:bg-gray-100'}`;
    }
    if (tHilos) {
        tHilos.className = `${base} ${!esLista ? 'bg-primary-100 text-primary-800' : 'text-gray-600 hover:bg-gray-100'}`;
    }
}

function setVista(v) {
    vista = v === 'hilos' ? 'hilos' : 'lista';
    tabActivo(vista === 'lista');
    document.getElementById('com-panel-lista')?.classList.toggle('hidden', vista !== 'lista');
    document.getElementById('com-panel-hilos')?.classList.toggle('hidden', vista !== 'hilos');
}

function updateDrillChip() {
    const wrap = document.getElementById('com-chip-drill');
    const txt = document.getElementById('com-chip-drill-text');
    if (!wrap || !txt) return;
    if (!drillFiltro?.clienteId) {
        wrap.classList.add('hidden');
        return;
    }
    const cidShort = `${escapeHtml(String(drillFiltro.clienteId).slice(0, 8))}…`;
    let desc = `Conversación · cliente <span class="font-mono">${cidShort}</span>`;
    if (drillFiltro.grupoSinRelacion) {
        desc += ' · <strong>sin</strong> vínculo reserva/propuesta';
    } else if (drillFiltro.relacionTipo && drillFiltro.relacionId) {
        const rid = String(drillFiltro.relacionId);
        desc += ` · ${escapeHtml(drillFiltro.relacionTipo)} <span class="font-mono">${escapeHtml(rid.length > 18 ? `${rid.slice(0, 18)}…` : rid)}</span>`;
    } else {
        desc += ' · todos los envíos del cliente';
    }
    txt.innerHTML = desc;
    wrap.classList.remove('hidden');
}

function syncLoteBar() {
    const n = document.querySelectorAll('#com-tbody .com-row-chk:checked').length;
    const btn = document.getElementById('com-reintentar-lote');
    const hint = document.getElementById('com-lote-hint');
    if (btn) {
        btn.disabled = n === 0;
        btn.textContent = n ? `Reintentar seleccionados (${n})` : 'Reintentar seleccionados';
    }
    const nr = document.querySelectorAll('#com-tbody .com-row-chk').length;
    if (hint && nr) {
        hint.textContent = `${nr} reintentable(s) en esta página · máx. 25 por lote.`;
    } else if (hint) {
        hint.textContent = 'Marca filas reintentables (correo fallido: reserva, propuesta u otros con plantilla o disparador). Máximo 25 por lote en esta página.';
    }
    const all = document.getElementById('com-sel-all');
    if (all) {
        const boxes = [...document.querySelectorAll('#com-tbody .com-row-chk')];
        all.disabled = boxes.length === 0;
        all.checked = boxes.length > 0 && boxes.every((b) => b.checked);
        all.indeterminate = boxes.length > 0 && boxes.some((b) => b.checked) && !all.checked;
    }
}

async function cargar() {
    const q = document.getElementById('com-q')?.value?.trim() || '';
    const estado = document.getElementById('com-estado')?.value || '';
    const tipo = document.getElementById('com-tipo')?.value || '';
    const evento = document.getElementById('com-evento')?.value?.trim() || '';
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (q) params.set('q', q);
    if (estado) params.set('estado', estado);
    if (tipo) params.set('tipo', tipo);
    if (evento) params.set('evento', evento);
    if (drillFiltro?.clienteId) params.set('clienteId', drillFiltro.clienteId);
    if (drillFiltro?.relacionTipo && drillFiltro?.relacionId) {
        params.set('relacionTipo', drillFiltro.relacionTipo);
        params.set('relacionId', drillFiltro.relacionId);
    }
    if (drillFiltro?.grupoSinRelacion) params.set('grupoSinRelacion', '1');

    const tbody = document.getElementById('com-tbody');
    const totalEl = document.getElementById('com-total');
    hideComFetchError();
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-gray-400 text-sm">Cargando…</td></tr>';

    try {
        const data = await fetchAPI(`/comunicaciones?${params}`);
        lastTotal = data.total || 0;
        const items = data.items || [];
        if (totalEl) {
            totalEl.textContent = `${lastTotal} registro${lastTotal !== 1 ? 's' : ''} · mostrando ${offset + 1}–${Math.min(offset + items.length, lastTotal)}`;
        }
        if (!items.length && tbody) {
            const hint = drillFiltro?.clienteId
                ? 'Prueba ampliar filtros o quita el filtro de conversación (chip arriba).'
                : 'Prueba otra búsqueda o ajusta estado, tipo y evento.';
            tbody.innerHTML = `<tr><td colspan="11" class="py-12 px-4 text-center text-gray-500 text-sm max-w-lg mx-auto">
                <i class="fa-regular fa-folder-open text-3xl text-gray-300 mb-3 block" aria-hidden="true"></i>
                <span class="font-medium text-gray-700">Sin resultados</span><br><span class="mt-1 inline-block">${escapeHtml(hint)}</span>
            </td></tr>`;
        } else if (tbody) {
            tbody.innerHTML = items.map(fila).join('');
        }
        syncLoteBar();
        updateDrillChip();
        const prev = document.getElementById('com-prev');
        const next = document.getElementById('com-next');
        if (prev) prev.disabled = offset <= 0;
        if (next) next.disabled = offset + limit >= lastTotal;
    } catch (e) {
        const msg = (e.message || 'Error de red o servidor').replace(/</g, '');
        const wrap = document.getElementById('com-fetch-error');
        const msgEl = document.getElementById('com-fetch-error-msg');
        if (wrap && msgEl) {
            msgEl.textContent = msg;
            wrap.classList.remove('hidden');
        }
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="11" class="py-10 text-center text-gray-500 text-sm">Usa «Reintentar carga» arriba o revisa tu conexión.</td></tr>`;
        }
        if (totalEl) totalEl.textContent = '';
    }
}

async function cargarHilos() {
    const q = document.getElementById('com-q')?.value?.trim() || '';
    const params = new URLSearchParams();
    params.set('limit', String(limitHilos));
    params.set('offset', String(offsetHilos));
    if (q) params.set('q', q);

    const tbody = document.getElementById('com-tbody-hilos');
    const totalEl = document.getElementById('com-total-hilos');
    hideComFetchError();
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-gray-400 text-sm">Cargando…</td></tr>';

    try {
        const data = await fetchAPI(`/comunicaciones/hilos?${params}`);
        lastTotalHilos = data.total || 0;
        const items = data.items || [];
        if (totalEl) {
            totalEl.textContent = `${lastTotalHilos} conversación${lastTotalHilos !== 1 ? 'es' : ''} · mostrando ${offsetHilos + 1}–${Math.min(offsetHilos + items.length, lastTotalHilos)}`;
        }
        if (!items.length && tbody) {
            const qh = q ? 'Ningún hilo coincide con la búsqueda; prueba otro término.' : 'Aún no hay envíos registrados en hilos para este tenant.';
            tbody.innerHTML = `<tr><td colspan="6" class="py-12 px-4 text-center text-gray-500 text-sm max-w-lg mx-auto">
                <i class="fa-regular fa-comments text-3xl text-gray-300 mb-3 block" aria-hidden="true"></i>
                <span class="font-medium text-gray-700">Sin conversaciones</span><br><span class="mt-1 inline-block">${escapeHtml(qh)}</span>
            </td></tr>`;
        } else if (tbody) {
            tbody.innerHTML = items.map(filaHilo).join('');
        }
        const prev = document.getElementById('com-hilos-prev');
        const next = document.getElementById('com-hilos-next');
        if (prev) prev.disabled = offsetHilos <= 0;
        if (next) next.disabled = offsetHilos + limitHilos >= lastTotalHilos;
    } catch (e) {
        const msg = (e.message || 'Error de red o servidor').replace(/</g, '');
        const wrap = document.getElementById('com-fetch-error');
        const msgEl = document.getElementById('com-fetch-error-msg');
        if (wrap && msgEl) {
            msgEl.textContent = msg;
            wrap.classList.remove('hidden');
        }
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-gray-500 text-sm">Usa «Reintentar carga» arriba o revisa tu conexión.</td></tr>`;
        }
        if (totalEl) totalEl.textContent = '';
    }
}

function recargarActiva() {
    if (vista === 'hilos') return cargarHilos();
    return cargar();
}

function hideComFetchError() {
    document.getElementById('com-fetch-error')?.classList.add('hidden');
}

function showComToast(message, variant = 'success') {
    const el = document.getElementById('com-toast');
    if (!el) return;
    el.textContent = message;
    el.className = `fixed bottom-6 right-6 z-50 max-w-md rounded-lg shadow-lg border px-4 py-3 text-sm ${variant === 'danger' ? 'bg-danger-50 border-danger-200 text-danger-900' : 'bg-white border-gray-200 text-gray-800'}`;
    el.classList.remove('hidden');
    clearTimeout(showComToast._t);
    showComToast._t = setTimeout(() => { el.classList.add('hidden'); }, 4500);
}

export async function afterRender() {
    vista = 'lista';
    offset = 0;
    offsetHilos = 0;
    drillFiltro = null;

    const sp = new URLSearchParams(window.location.search.replace(/^\?/, ''));
    const cid = sp.get('clienteId');
    if (cid) {
        if (sp.get('grupoSinRelacion') === '1') {
            drillFiltro = { clienteId: cid, grupoSinRelacion: true };
        } else if (sp.get('relacionTipo') && sp.get('relacionId')) {
            drillFiltro = {
                clienteId: cid,
                relacionTipo: sp.get('relacionTipo'),
                relacionId: sp.get('relacionId'),
            };
        } else {
            drillFiltro = { clienteId: cid };
        }
    }

    if (sp.get('vista') === 'hilos') {
        vista = 'hilos';
        setVista('hilos');
        tabActivo(false);
        await cargarHilos();
    } else {
        setVista('lista');
        tabActivo(true);
        await cargar();
    }

    document.getElementById('com-tab-lista')?.addEventListener('click', async () => {
        offset = 0;
        setVista('lista');
        const u = new URL(window.location.href);
        u.searchParams.delete('vista');
        const qs = u.searchParams.toString();
        window.history.replaceState({}, '', `${u.pathname}${qs ? `?${qs}` : ''}`);
        await cargar();
    });
    document.getElementById('com-tab-hilos')?.addEventListener('click', async () => {
        offsetHilos = 0;
        setVista('hilos');
        const u = new URL(window.location.href);
        u.searchParams.set('vista', 'hilos');
        const qs2 = u.searchParams.toString();
        window.history.replaceState({}, '', `${u.pathname}${qs2 ? `?${qs2}` : ''}`);
        await cargarHilos();
    });

    document.getElementById('com-fetch-retry')?.addEventListener('click', () => {
        hideComFetchError();
        recargarActiva();
    });

    document.getElementById('com-chip-drill-clear')?.addEventListener('click', () => {
        drillFiltro = null;
        offset = 0;
        const u = new URL(window.location.href);
        u.searchParams.delete('clienteId');
        u.searchParams.delete('relacionTipo');
        u.searchParams.delete('relacionId');
        u.searchParams.delete('grupoSinRelacion');
        u.searchParams.delete('vista');
        const qs = u.searchParams.toString();
        window.history.replaceState({}, '', `${u.pathname}${qs ? `?${qs}` : ''}`);
        cargar();
    });

    document.getElementById('com-tbody')?.addEventListener('change', (e) => {
        if (e.target.classList.contains('com-row-chk')) syncLoteBar();
    });

    document.getElementById('com-sel-all')?.addEventListener('change', (e) => {
        const on = e.target.checked;
        document.querySelectorAll('#com-tbody .com-row-chk').forEach((cb) => { cb.checked = on; });
        syncLoteBar();
    });

    document.getElementById('com-reintentar-lote')?.addEventListener('click', async () => {
        const ids = [...document.querySelectorAll('#com-tbody .com-row-chk:checked')].map((cb) => cb.getAttribute('data-id')).filter(Boolean);
        if (!ids.length) return;
        const slice = ids.slice(0, 25);
        const btn = document.getElementById('com-reintentar-lote');
        btn.disabled = true;
        try {
            const out = await fetchAPI('/comunicaciones/reintentar', { method: 'POST', body: { ids: slice } });
            const { okCount = 0, failCount = 0, results = [] } = out || {};
            const errs = results.filter((r) => !r.ok).slice(0, 5).map((r) => `${(r.id || '').slice(0, 8)}…: ${r.error || 'error'}`).join(' · ');
            if (failCount > 0) {
                showComToast(`Lote: ${okCount} ok, ${failCount} error(es). ${errs || ''}`.trim(), 'danger');
            } else {
                showComToast(`Lote: ${okCount} reenvío(s) correcto(s).`, 'success');
            }
            await cargar();
        } catch (err) {
            showComToast(err.message || 'Error en el lote.', 'danger');
        } finally {
            btn.disabled = false;
            syncLoteBar();
        }
    });

    document.getElementById('com-tbody')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('.com-reintentar-btn');
        if (btn) {
            e.preventDefault();
            const id = btn.getAttribute('data-id');
            if (!id) return;
            const prevText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Reintentando…';
            try {
                await fetchAPI(`/comunicaciones/${encodeURIComponent(id)}/reintentar`, { method: 'POST' });
                showComToast('Reenvío encolado correctamente.', 'success');
                await recargarActiva();
            } catch (err) {
                showComToast(err.message || 'No se pudo reintentar el envío.', 'danger');
            } finally {
                btn.disabled = false;
                btn.textContent = prevText;
            }
            return;
        }
        const a = e.target.closest('a.com-cliente-link, a.com-app-link');
        if (!a) return;
        e.preventDefault();
        handleNavigation(a.getAttribute('href'));
    });

    document.getElementById('com-tbody-hilos')?.addEventListener('click', (e) => {
        const a = e.target.closest('a.com-app-link');
        if (a) {
            e.preventDefault();
            handleNavigation(a.getAttribute('href'));
            return;
        }
        const b = e.target.closest('.com-ver-hilo-btn');
        if (!b) return;
        e.preventDefault();
        const clienteId = b.getAttribute('data-cliente');
        if (!clienteId) return;
        const sinRel = b.hasAttribute('data-sin-rel');
        const rt = (b.getAttribute('data-rel-tipo') || '').trim();
        const rid = (b.getAttribute('data-rel-id') || '').trim();
        drillFiltro = sinRel || !rt
            ? { clienteId, grupoSinRelacion: true }
            : { clienteId, relacionTipo: rt, relacionId: rid };
        offset = 0;
        vista = 'lista';
        setVista('lista');
        tabActivo(true);
        const u = new URL(window.location.href);
        u.searchParams.set('clienteId', clienteId);
        u.searchParams.delete('vista');
        if (drillFiltro.grupoSinRelacion) {
            u.searchParams.set('grupoSinRelacion', '1');
            u.searchParams.delete('relacionTipo');
            u.searchParams.delete('relacionId');
        } else {
            u.searchParams.delete('grupoSinRelacion');
            u.searchParams.set('relacionTipo', rt);
            u.searchParams.set('relacionId', rid);
        }
        const qs2 = u.searchParams.toString();
        window.history.replaceState({}, '', `${u.pathname}${qs2 ? `?${qs2}` : ''}`);
        cargar();
    });

    document.getElementById('com-buscar')?.addEventListener('click', () => {
        offset = 0;
        offsetHilos = 0;
        recargarActiva();
    });
    let tq;
    document.getElementById('com-q')?.addEventListener('input', () => {
        clearTimeout(tq);
        tq = setTimeout(() => {
            offset = 0;
            offsetHilos = 0;
            recargarActiva();
        }, 400);
    });
    document.getElementById('com-estado')?.addEventListener('change', () => { offset = 0; cargar(); });
    document.getElementById('com-tipo')?.addEventListener('change', () => { offset = 0; cargar(); });
    document.getElementById('com-evento')?.addEventListener('change', () => { offset = 0; cargar(); });
    let tev;
    document.getElementById('com-evento')?.addEventListener('input', () => {
        clearTimeout(tev);
        tev = setTimeout(() => {
            if (vista !== 'lista') return;
            offset = 0;
            cargar();
        }, 450);
    });

    document.getElementById('com-prev')?.addEventListener('click', () => {
        offset = Math.max(0, offset - limit);
        cargar();
    });
    document.getElementById('com-next')?.addEventListener('click', () => {
        if (offset + limit < lastTotal) offset += limit;
        cargar();
    });

    document.getElementById('com-hilos-prev')?.addEventListener('click', () => {
        offsetHilos = Math.max(0, offsetHilos - limitHilos);
        cargarHilos();
    });
    document.getElementById('com-hilos-next')?.addEventListener('click', () => {
        if (offsetHilos + limitHilos < lastTotalHilos) offsetHilos += limitHilos;
        cargarHilos();
    });
}
