/**
 * webPublica.paso1.identidad.js — Paso 1: Descripción IA + Puntos Fuertes
 */
import { fetchAPI } from '../../../api.js';

/** Máximo destacados en ficha SSR (CRO + legibilidad; alinear con backend). */
const MAX_DESTACADOS_VENTA = 8;

export function renderPaso1(state) {
    const wd = state.propiedadData || {};
    const descripcion   = wd.aiDescription || '';
    const puntos        = Array.isArray(wd.puntosFuertes) ? wd.puntosFuertes : [];

    const ctx = state.buildContext;
    const espacios = ctx?.producto?.espacios || [];
    const totalActivos = espacios.reduce((sum, e) => sum + (e.activos?.length || 0), 0);
    const tieneContexto = espacios.length > 0;

    return `
    <div class="max-w-2xl mx-auto space-y-6">

        <!-- Resumen del contexto de la propiedad -->
        ${tieneContexto ? `
        <div class="p-4 bg-primary-50 border border-primary-100 rounded-xl text-sm text-primary-800 flex items-start gap-3">
            <span class="text-lg mt-0.5">🏗️</span>
            <div>
                <p class="font-semibold mb-1">Contexto listo para IA (SSR + venta)</p>
                <p><strong>${espacios.length} espacio${espacios.length !== 1 ? 's' : ''}</strong> y <strong>${totalActivos} activo${totalActivos !== 1 ? 's' : ''}</strong> inventariados. La IA redacta para la web pública: reservas, Google, redes y asistentes — sin inventar fuera de este inventario.</p>
            </div>
        </div>
        ` : `
        <div class="p-4 bg-warning-50 border border-warning-100 rounded-xl text-sm text-warning-800 flex items-start gap-3">
            <span class="text-lg mt-0.5">⚠️</span>
            <div>
                <p class="font-semibold mb-1">Sin contexto configurado</p>
                <p>Para obtener mejores descripciones, configura los <strong>Espacios</strong> del alojamiento (Pasos 1-3 en Gestión de Propiedades). Por ahora puedes generar con información básica.</p>
            </div>
        </div>
        `}

        <!-- Descripción para huéspedes -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="font-semibold text-gray-900">Descripción para huéspedes</h3>
                    <p class="text-xs text-gray-400 mt-0.5">Texto de la ficha SSR pública, indexable y orientado a conversión.</p>
                </div>
                <button id="btn-generar-ia" class="btn-outline text-sm flex items-center gap-1.5" ${tieneContexto ? '' : 'title="Sin inventario completo — resultado básico"'}>
                    <i class="fa-solid fa-bolt"></i> ${tieneContexto ? 'Generar con contexto' : 'Generar con IA'}
                </button>
            </div>
            <div id="ia-loading" class="hidden flex items-center gap-2 text-sm text-primary-600 mb-3 py-2">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Generando descripción optimizada...
            </div>
            <textarea id="input-descripcion"
                class="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                rows="6" placeholder="Escribe o genera una descripción atractiva para los huéspedes...">${esc(descripcion)}</textarea>
            <p class="text-xs text-gray-400 mt-1 text-right" id="desc-chars">${descripcion.length} caracteres</p>
        </div>

        <!-- Puntos fuertes -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h3 class="font-semibold text-gray-900">Puntos fuertes</h3>
                    <p class="text-xs text-gray-400 mt-0.5">Características destacadas del alojamiento.</p>
                </div>
                <button id="btn-generar-puntos" class="btn-outline flex items-center gap-1.5 text-xs">
                    <i class="fa-solid fa-bolt"></i> Generar con IA
                </button>
            </div>
            <div id="chips-container" class="flex flex-wrap gap-2 mb-3">
                ${renderChips(puntos)}
            </div>
            <div class="flex gap-2">
                <input type="text" id="input-nuevo-punto"
                    class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Ej: Vista al lago, Jacuzzi privado...">
                <button id="btn-add-punto"
                    class="px-4 py-2 rounded-xl text-sm font-medium btn-outline transition-all">
                    + Agregar
                </button>
            </div>
        </div>

        ${tieneContexto ? `
        <!-- Destacados ficha pública (SSR) — revisión tras narrativa IA -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div class="mb-3">
                <h3 class="font-semibold text-gray-900">Destacados en la ficha pública</h3>
                <p class="text-xs text-gray-400 mt-0.5 max-w-xl">
                    Hasta <strong>${MAX_DESTACADOS_VENTA}</strong> tarjetas en la ficha pública: <strong>espacios del alojamiento</strong> o <strong>áreas comunes vinculadas</strong>.
                    En cada fila usá <strong>Galería del espacio</strong> para abrir solo las fotos de ese espacio (miniaturas), elegir la que mejor venda el destacado, o dejar automática la primera en la web.
                </p>
                <p id="destacados-comunes-hint" class="text-xs mt-2 text-primary-800 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2"></p>
            </div>
            <div id="destacados-venta-root"></div>
        </div>
        ` : ''}

        <!-- Guardar paso -->
        <div class="flex justify-end">
            <button id="btn-guardar-paso1" class="btn-primary flex items-center gap-2">
                Guardar y continuar <i class="fa-solid fa-arrow-right"></i>
            </button>
        </div>
    </div>`;
}

export function bindPaso1(state, callbacks) {
    const tieneCtx = (state.buildContext?.producto?.espacios?.length || 0) > 0;
    if (tieneCtx) {
        mountDestacadosEditor(state);
    }

    const textarea = document.getElementById('input-descripcion');

    textarea?.addEventListener('input', () => {
        const len = textarea.value.length;
        const counter = document.getElementById('desc-chars');
        if (counter) counter.textContent = `${len} caracteres`;
    });

    document.getElementById('btn-generar-ia')?.addEventListener('click', async () => {
        const btn     = document.getElementById('btn-generar-ia');
        const loading = document.getElementById('ia-loading');
        btn.disabled = true;
        loading.classList.remove('hidden');
        try {
            const tieneContexto = (state.buildContext?.producto?.espacios?.length || 0) > 0;
            const endpoint = tieneContexto
                ? `/website/propiedad/${state.propiedadId}/build-context/generate-narrativa`
                : `/website/propiedad/${state.propiedadId}/generate-ai-text`;
            const res = await fetchAPI(endpoint, { method: 'POST' });
            if (!res) throw new Error('El servicio de IA no respondió. Intenta nuevamente.');

            // Soporte para ambos formatos: nuevo (descripcionComercial) y legacy (texto)
            const textoGenerado = res.descripcionComercial || res.texto || '';
            if (textoGenerado && textarea) {
                textarea.value = textoGenerado;
                textarea.dispatchEvent(new Event('input'));
            }
            const pts = res.puntosFuertes || res.highlights || [];
            if (Array.isArray(pts) && pts.length) {
                if (!state.propiedadData) state.propiedadData = {};
                state.propiedadData.puntosFuertes = pts;
                const chips = document.getElementById('chips-container');
                if (chips) chips.innerHTML = renderChips(pts);
                bindChips(state);
            }
            if ((state.buildContext?.producto?.espacios?.length || 0) > 0) {
                if (!state.buildContext) state.buildContext = {};
                state.buildContext.narrativa = { ...(state.buildContext.narrativa || {}), ...res };
                mountDestacadosEditor(state);
            }
        } catch (err) {
            alert('Error al generar: ' + (err.message || 'Intenta nuevamente'));
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    });

    document.getElementById('btn-generar-puntos')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-generar-puntos');
        const textareaPuntos = document.getElementById('input-descripcion');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';
        try {
            const res = await fetchAPI(`/website/propiedad/${state.propiedadId}/generate-ai-text`, { method: 'POST' });
            if (Array.isArray(res.puntosFuertes) && res.puntosFuertes.length) {
                if (!state.propiedadData) state.propiedadData = {};
                state.propiedadData.puntosFuertes = res.puntosFuertes;
                const chips = document.getElementById('chips-container');
                if (chips) chips.innerHTML = renderChips(res.puntosFuertes);
                bindChips(state);
            }
            // Misma narrativa persistida en servidor que «Generar con contexto»: sincronizar estado y UI.
            const textoNarr = res.descripcionComercial || res.texto || '';
            if (textoNarr && textareaPuntos) {
                textareaPuntos.value = textoNarr;
                textareaPuntos.dispatchEvent(new Event('input'));
            }
            if ((state.buildContext?.producto?.espacios?.length || 0) > 0 && (res.descripcionComercial || res.homeH1)) {
                if (!state.buildContext) state.buildContext = {};
                state.buildContext.narrativa = { ...(state.buildContext.narrativa || {}), ...res };
                mountDestacadosEditor(state);
            }
        } catch (err) {
            alert('Error al generar: ' + (err.message || 'Intenta nuevamente'));
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Generar con IA';
        }
    });

    document.getElementById('btn-add-punto')?.addEventListener('click', () => agregarPunto(state));
    document.getElementById('input-nuevo-punto')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') agregarPunto(state);
    });

    bindChips(state);

    document.getElementById('btn-guardar-paso1')?.addEventListener('click', () =>
        guardarPaso1(state, callbacks)
    );
}

async function guardarPaso1(state, callbacks) {
    const btn         = document.getElementById('btn-guardar-paso1');
    const textarea    = document.getElementById('input-descripcion');
    const aiDescription = textarea?.value?.trim() || '';
    const puntosFuertes = leerChips();

    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...'; btn.disabled = true;
    try {
        const root = document.getElementById('destacados-venta-root');
        if (root) {
            const venta = collectDestacadosFromDom();
            const ventaRes = await fetchAPI(`/website/propiedad/${state.propiedadId}/build-context/espacios-destacados`, {
                method: 'PUT',
                body: { espaciosDestacadosVenta: venta },
            });
            if (!state.buildContext) state.buildContext = {};
            if (!state.buildContext.narrativa) state.buildContext.narrativa = {};
            state.buildContext.narrativa.espaciosDestacadosVenta = ventaRes.espaciosDestacadosVenta || venta;
        }
        await fetchAPI(`/website/propiedad/${state.propiedadId}/identidad`, {
            method: 'PUT', body: { aiDescription, puntosFuertes }
        });
        if (!state.propiedadData) state.propiedadData = {};
        state.propiedadData.aiDescription  = aiDescription;
        state.propiedadData.puntosFuertes  = puntosFuertes;
        callbacks.onNextStep();
    } catch (err) {
        alert('Error al guardar: ' + err.message);
        btn.innerHTML = 'Guardar y continuar <i class="fa-solid fa-arrow-right"></i>'; btn.disabled = false;
    }
}

function agregarPunto(state) {
    const input = document.getElementById('input-nuevo-punto');
    const texto = input?.value?.trim();
    if (!texto) return;
    if (!state.propiedadData) state.propiedadData = {};
    const puntos = leerChips();
    if (!puntos.includes(texto)) puntos.push(texto);
    state.propiedadData.puntosFuertes = puntos;
    const chips = document.getElementById('chips-container');
    if (chips) chips.innerHTML = renderChips(puntos);
    bindChips(state);
    input.value = '';
}

function leerChips() {
    return [...document.querySelectorAll('.chip-texto')].map(el => el.textContent.trim());
}

function bindChips(state) {
    document.querySelectorAll('.chip-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const texto  = btn.dataset.texto;
            const puntos = leerChips().filter(p => p !== texto);
            if (!state.propiedadData) state.propiedadData = {};
            state.propiedadData.puntosFuertes = puntos;
            const chips = document.getElementById('chips-container');
            if (chips) chips.innerHTML = renderChips(puntos);
            bindChips(state);
        });
    });
}

function renderChips(puntos) {
    if (!puntos?.length) return `
        <div class="py-4 text-center">
            <i class="fa-solid fa-star text-2xl text-gray-200 mb-2"></i>
            <p class="text-xs text-gray-400">Sin puntos fuertes aún. Genera con IA o agrega manualmente.</p>
        </div>`;
    return puntos.map(p => `
        <span class="flex items-center gap-1.5 bg-primary-50 border border-primary-100 text-primary-700 rounded-full px-3 py-1 text-xs font-medium">
            <span class="chip-texto">${esc(p)}</span>
            <button class="chip-delete text-primary-300 hover:text-primary-600 leading-none text-sm" data-texto="${esc(p)}">×</button>
        </span>`).join('');
}

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function mountDestacadosEditor(state) {
    const root = document.getElementById('destacados-venta-root');
    if (!root) return;
    const com = state.buildContext?.compartidas || [];
    const hint = document.getElementById('destacados-comunes-hint');
    if (hint) {
        hint.textContent = com.length
            ? `${com.length} área(s) común(es) vinculada(s) a este alojamiento. En «Ámbito» elegí «Área común» y el espacio del recinto para destacarlo en la ficha.`
            : 'Este alojamiento no tiene áreas comunes vinculadas. Si el recinto tiene piscina, quincho u otros espacios compartidos, asocialos desde la gestión del alojamiento; luego podrán aparecer aquí y en la web.';
    }
    const existing = state.buildContext?.narrativa?.espaciosDestacadosVenta;
    const list = Array.isArray(existing) && existing.length ? [...existing] : [];

    // Pre-agregar áreas comunes vinculadas que aún no están en la lista
    const savedComunIds = new Set(list.filter(r => r.kind === 'comun').map(r => r.id));
    com.forEach(area => {
        if (savedComunIds.has(area.id)) return;
        const primeraFoto = area.fotos?.[0];
        list.push({
            kind: 'comun',
            id: area.id,
            titulo: area.nombre || '',
            pitch: area.descripcion || '',
            imagen: primeraFoto
                ? { storagePath: primeraFoto.storageUrl || primeraFoto.storagePath || '', imageId: primeraFoto.id || '' }
                : undefined,
        });
    });

    const rowsHtml = list.length
        ? list.map((r) => renderDestRowHtml(r)).join('')
        : '<p class="text-xs text-gray-500 py-1">Sin destacados guardados. Generá con <strong>Generar con contexto</strong> o añadí filas con el botón de abajo.</p>';
    root.innerHTML = `
        <div class="destacados-rows space-y-3">${rowsHtml}</div>
        <div class="flex flex-wrap items-center gap-2 mt-3">
            <button type="button" id="btn-add-destacado" class="btn-outline text-sm">+ Añadir fila</button>
            <button type="button" id="btn-guardar-destacados-only" class="btn-outline text-sm">Guardar solo destacados</button>
        </div>
    `;
    root.querySelectorAll('.dest-row').forEach((rowEl) => bindDestRow(rowEl, state));
    document.getElementById('btn-add-destacado')?.addEventListener('click', () => handleAddDestacadoRow(state));
    document.getElementById('btn-guardar-destacados-only')?.addEventListener('click', () => saveDestacadosOnly(state));
    syncAddDestacadoBtn();
}

function renderDestRowHtml(row) {
    const kind = row.kind === 'comun' ? 'comun' : 'privado';
    const id = row.id || '';
    const titulo = row.titulo || row.title || '';
    const pitch = row.pitch || '';
    const imgPath = row.imagen?.storagePath || '';
    const imgId = row.imagen?.imageId || '';
    return `
        <div class="dest-row border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/50">
            <div class="flex flex-wrap gap-2 items-center">
                <select class="dest-kind text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                    <option value="privado" ${kind !== 'comun' ? 'selected' : ''}>En el alojamiento</option>
                    <option value="comun" ${kind === 'comun' ? 'selected' : ''}>Área común</option>
                </select>
                <select class="dest-id flex-1 min-w-[160px] text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white" data-initial-id="${escAttr(id)}"></select>
                <button type="button" class="dest-remove text-xs text-danger-600 hover:underline">Quitar</button>
            </div>
            <div class="dest-foto-block rounded-lg border border-gray-100 bg-white p-3">
                <label class="block text-[11px] font-medium text-gray-500 mb-2">Foto en la ficha (opcional)</label>
                <div class="flex flex-wrap items-start gap-3">
                    <div class="dest-foto-preview relative shrink-0 w-[88px] h-[88px] min-w-[88px] min-h-[88px] max-w-[88px] max-h-[88px] rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
                        <img class="dest-foto-preview-img absolute inset-0 h-full w-full max-h-full max-w-full object-cover hidden" alt="" width="88" height="88" decoding="async" />
                        <span class="dest-foto-preview-placeholder absolute inset-0 flex items-center justify-center text-[10px] text-gray-400 text-center px-2 leading-tight bg-gray-50">Elegí espacio</span>
                    </div>
                    <div class="flex-1 min-w-0 flex flex-col gap-2">
                        <p class="dest-foto-label text-xs text-gray-600">Automática (primera foto del espacio en la web)</p>
                        <div class="flex flex-wrap gap-2">
                            <button type="button" class="btn-dest-foto-pick btn-outline text-xs px-3 py-1.5 inline-flex items-center gap-1.5" disabled>
                                <i class="fa-solid fa-images"></i> Galería del espacio
                            </button>
                            <button type="button" class="btn-dest-foto-clear text-xs text-gray-500 hover:text-gray-800 underline hidden">Quitar imagen</button>
                        </div>
                    </div>
                </div>
                <input type="hidden" class="dest-foto-path" value="${escAttr(imgPath)}">
                <input type="hidden" class="dest-foto-id" value="${escAttr(imgId)}">
            </div>
            <input type="text" class="dest-titulo w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Título corto (ej. Tinaja al aire libre)" value="${esc(titulo)}">
            <textarea class="dest-pitch w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows="2" placeholder="Frase de venta para el huésped">${esc(pitch)}</textarea>
        </div>`;
}

/** Alinear URL/path de Firebase Storage entre wizard, BD y allowlist SSR. */
function destNormalizeStorageRef(u) {
    const s = String(u || '').trim();
    if (!s) return '';
    if (s.includes('/o/')) {
        try {
            return decodeURIComponent(s.split('/o/')[1].split('?')[0]);
        } catch (_e) {
            return s;
        }
    }
    return s;
}

/** ¿La lista de fotos del espacio incluye esta ruta (cualquier variante)? */
function destPathMatchesFotoList(list, preferredPath) {
    const pp = String(preferredPath || '').trim();
    if (!pp || !list.length) return false;
    const pn = destNormalizeStorageRef(pp);
    return list.some((x) => {
        const vals = [x.storagePath, x.storageUrl, x.thumbnail, x.thumbnailUrl]
            .map((v) => String(v || '').trim())
            .filter(Boolean);
        return vals.some((v) => v === pp || destNormalizeStorageRef(v) === pn);
    });
}

function resolvePorEspacioMap(map, rawId) {
    const id = String(rawId || '').trim();
    if (!id || !map || typeof map !== 'object') return [];
    if (Array.isArray(map[id])) return map[id];
    const lower = id.toLowerCase();
    for (const k of Object.keys(map)) {
        if (String(k).trim() === id || String(k).trim().toLowerCase() === lower) {
            const v = map[k];
            return Array.isArray(v) ? v : [];
        }
    }
    return [];
}

function collectFotosForDestRow(kind, espacioId, state) {
    const list = [];
    const seen = new Set();
    const add = (storagePath, imageId, label) => {
        const p = String(storagePath || '').trim();
        if (!p || seen.has(p)) return;
        seen.add(p);
        list.push({
            storagePath: p,
            imageId: String(imageId || '').trim(),
            label: String(label || 'Foto').slice(0, 80),
        });
    };
    const eid = String(espacioId || '').trim();
    if (!eid) return list;
    if (kind === 'comun') {
        const area = (state.buildContext?.compartidas || []).find((a) => String(a?.id || '').trim() === eid);
        (area?.fotos || []).forEach((f, i) => {
            add(f.storageUrl || f.storagePath || f.url, f.id, `Área común · ${i + 1}`);
        });
        const flat = state.galeriaFlat || [];
        flat.forEach((f) => {
            const aid = String(f.areaComunId || f.area_comun_id || '').trim();
            if (aid && aid === eid) {
                add(f.storageUrl || f.storagePath || f.thumbnailUrl, f.id, f.espacio || f.altText || 'Galería');
            }
        });
        return list;
    }
    const gal = resolvePorEspacioMap(state.imagesPorEspacio, eid);
    gal.forEach((f) =>
        add(f.storageUrl || f.storagePath || f.thumbnailUrl || f.thumbnail, f.imageId, f.altText || f.title || 'Galería')
    );
    let wdArr = resolvePorEspacioMap(state.propiedadData?.images || {}, eid);
    if (!wdArr.length && state.propiedadData?.images?.[eid] != null) {
        const wdBag = state.propiedadData.images[eid];
        wdArr = Array.isArray(wdBag) ? wdBag : [wdBag];
    }
    wdArr.forEach((f, i) =>
        add(f.storageUrl || f.storagePath || f.url || f.thumbnailUrl, f.imageId, f.altText || `Sitio web · ${i + 1}`)
    );
    const flat = state.galeriaFlat || [];
    flat.forEach((f) => {
        const sid = String(f.espacioId || f.espacio_id || '').trim();
        if (sid && sid === eid) {
            add(f.storageUrl || f.storagePath || f.thumbnailUrl, f.id, f.espacio || f.altText || 'Galería');
        }
    });
    return list;
}

function applyDestFotoUi(rowEl, storagePath, imageId) {
    const pathIn = rowEl.querySelector('.dest-foto-path');
    const idIn = rowEl.querySelector('.dest-foto-id');
    const img = rowEl.querySelector('.dest-foto-preview-img');
    const ph = rowEl.querySelector('.dest-foto-preview-placeholder');
    const lbl = rowEl.querySelector('.dest-foto-label');
    const clr = rowEl.querySelector('.btn-dest-foto-clear');
    const p = String(storagePath || '').trim();
    const id = String(imageId || '').trim();
    if (pathIn) pathIn.value = p;
    if (idIn) idIn.value = id;
    if (p && img) {
        img.src = p;
        img.classList.remove('hidden');
        img.alt = 'Vista previa — destacado';
        ph?.classList.add('hidden');
        if (lbl) lbl.textContent = 'Foto elegida (se verá así en la ficha pública)';
        clr?.classList.remove('hidden');
    } else if (img) {
        img.removeAttribute('src');
        img.classList.add('hidden');
        ph?.classList.remove('hidden');
        if (ph) {
            const eid = rowEl.querySelector('.dest-id')?.value?.trim();
            ph.textContent = eid ? 'Sin foto elegida' : 'Elegí espacio primero';
        }
        if (lbl) lbl.textContent = 'Automática (primera foto del espacio en la web)';
        clr?.classList.add('hidden');
    }
}

function syncDestFotoFromSpace(rowEl, state, preferredPath, preferredImageId) {
    const kind = rowEl.querySelector('.dest-kind')?.value || 'privado';
    const eid = rowEl.querySelector('.dest-id')?.value?.trim() || '';
    const pick = rowEl.querySelector('.btn-dest-foto-pick');
    const ph = rowEl.querySelector('.dest-foto-preview-placeholder');
    if (!eid) {
        if (pick) pick.disabled = true;
        if (ph) ph.textContent = 'Elegí espacio primero';
        applyDestFotoUi(rowEl, '', '');
        return;
    }
    if (pick) pick.disabled = false;
    const pp = String(preferredPath || '').trim();
    const pid = String(preferredImageId || '').trim();
    const list = collectFotosForDestRow(kind, eid, state);
    const stillOk = destPathMatchesFotoList(list, pp);
    if (stillOk) {
        const hit = list.find(
            (x) =>
                [x.storagePath, x.storageUrl, x.thumbnail, x.thumbnailUrl]
                    .map((v) => String(v || '').trim())
                    .some((v) => v && (v === pp || destNormalizeStorageRef(v) === destNormalizeStorageRef(pp)))
        );
        const canonical = String(hit?.storagePath || pp).trim();
        const mid = pid || String(hit?.imageId || '').trim();
        applyDestFotoUi(rowEl, canonical, mid);
    } else {
        applyDestFotoUi(rowEl, '', '');
    }
}

function mountDestacadoFotoPickerModal({ title, fotos, currentPath, onPick }) {
    document.getElementById('dest-foto-picker-modal')?.remove();
    const cur = String(currentPath || '').trim();
    const grid = fotos.map((img, idx) => `
        <button type="button" class="dfp-foto relative rounded-xl overflow-hidden border-2 transition-all border-transparent hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200"
            data-storage-path="${escAttr(img.storagePath)}"
            data-image-id="${escAttr(img.imageId || '')}">
            <img src="${escAttr(img.storagePath)}" alt="" class="w-full h-32 sm:h-36 object-cover bg-gray-100" loading="lazy" decoding="async">
            <span class="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] leading-tight px-1.5 py-1 truncate">${esc(img.label || `Foto ${idx + 1}`)}</span>
            ${img.storagePath === cur ? '<span class="absolute top-1 right-1 text-[10px] bg-primary-600 text-white px-1.5 py-0.5 rounded font-semibold">Actual</span>' : ''}
        </button>`).join('');
    const html = `
    <div id="dest-foto-picker-modal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden border border-gray-100">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0 gap-3">
          <div class="min-w-0">
            <h3 class="font-semibold text-gray-900 text-sm truncate">${esc(title)}</h3>
            <p class="text-xs text-gray-500 mt-0.5">Tocá una imagen. Solo se listan fotos de este espacio (alojamiento o área común vinculada).</p>
          </div>
          <button type="button" class="dfp-close btn-ghost text-lg leading-none text-gray-500 shrink-0" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <div class="dfp-grid grid grid-cols-2 sm:grid-cols-3 gap-3">${grid}</div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const root = document.getElementById('dest-foto-picker-modal');
    const close = () => root?.remove();
    root.querySelector('.dfp-close')?.addEventListener('click', close);
    root.addEventListener('click', (e) => {
        if (e.target === root) close();
    });
    root.querySelector('.dfp-grid')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.dfp-foto');
        if (!btn) return;
        onPick({
            storagePath: String(btn.dataset.storagePath || '').trim(),
            imageId: String(btn.dataset.imageId || '').trim(),
        });
        close();
    });
}

async function openDestacadoFotoPicker(rowEl, state) {
    const kind = rowEl.querySelector('.dest-kind')?.value || 'privado';
    const espacioId = rowEl.querySelector('.dest-id')?.value?.trim() || '';
    if (!espacioId) {
        alert('Primero elegí el espacio o área común.');
        return;
    }
    let fotos = collectFotosForDestRow(kind, espacioId, state);
    if (!fotos.length) {
        try {
            const g = await fetchAPI(`/galeria/${state.propiedadId}`);
            if (Array.isArray(g)) {
                state.galeriaFlat = g.filter((f) => f && f.estado !== 'descartada');
            }
            fotos = collectFotosForDestRow(kind, espacioId, state);
        } catch (_e) { /* ignore */ }
    }
    if (!fotos.length) {
        alert('No hay fotos para este espacio. Clasificá imágenes en el Paso 2 (Fotos) o en la Galería asignándolas a este espacio.');
        return;
    }
    const idSel = rowEl.querySelector('.dest-id');
    const opt = idSel?.selectedOptions?.[0];
    const spaceLabel = opt?.textContent?.trim() || (kind === 'comun' ? 'Área común' : 'Espacio');
    const modalTitle = kind === 'comun' ? `Galería — área común: ${spaceLabel}` : `Galería — ${spaceLabel}`;
    mountDestacadoFotoPickerModal({
        title: modalTitle,
        fotos,
        currentPath: rowEl.querySelector('.dest-foto-path')?.value?.trim() || '',
        onPick: ({ storagePath, imageId }) => {
            applyDestFotoUi(rowEl, storagePath, imageId);
        },
    });
}

function fillDestIdSelect(selectEl, kind, state, selectedId) {
    const esp = state.buildContext?.producto?.espacios || [];
    const com = state.buildContext?.compartidas || [];
    selectEl.innerHTML = '<option value="">— Elegir espacio —</option>';
    if (kind === 'comun') {
        if (!com.length) {
            const o = document.createElement('option');
            o.value = '';
            o.textContent = '— Sin áreas comunes vinculadas a este alojamiento —';
            o.disabled = true;
            selectEl.appendChild(o);
            return;
        }
        com.forEach((a) => {
            const id = String(a?.id || '').trim();
            const nm = String(a?.nombre || '').trim() || id;
            if (!id) return;
            const o = document.createElement('option');
            o.value = id;
            o.textContent = nm;
            selectEl.appendChild(o);
        });
    } else {
        esp.forEach((e) => {
            const id = String(e?.id || '').trim();
            const nm = String(e?.nombre || '').trim() || id;
            if (!id) return;
            const o = document.createElement('option');
            o.value = id;
            o.textContent = nm;
            selectEl.appendChild(o);
        });
    }
    if (selectedId && [...selectEl.options].some((o) => o.value === selectedId)) {
        selectEl.value = selectedId;
    }
}

function bindDestRow(rowEl, state) {
    const kindSel = rowEl.querySelector('.dest-kind');
    const idSel = rowEl.querySelector('.dest-id');
    if (!kindSel || !idSel) return;
    const initialId = idSel.getAttribute('data-initial-id') || '';
    const initialFotoPath = (rowEl.querySelector('.dest-foto-path')?.value || '').trim();
    const initialFotoId = (rowEl.querySelector('.dest-foto-id')?.value || '').trim();

    fillDestIdSelect(idSel, kindSel.value, state, initialId);
    syncDestFotoFromSpace(rowEl, state, initialFotoPath, initialFotoId);

    kindSel.addEventListener('change', () => {
        fillDestIdSelect(idSel, kindSel.value, state, '');
        syncDestFotoFromSpace(rowEl, state, '', '');
    });
    idSel.addEventListener('change', () => {
        const curP = rowEl.querySelector('.dest-foto-path')?.value || '';
        const curI = rowEl.querySelector('.dest-foto-id')?.value || '';
        syncDestFotoFromSpace(rowEl, state, curP, curI);
    });
    rowEl.querySelector('.btn-dest-foto-pick')?.addEventListener('click', () => openDestacadoFotoPicker(rowEl, state));
    rowEl.querySelector('.btn-dest-foto-clear')?.addEventListener('click', () => applyDestFotoUi(rowEl, '', ''));
    rowEl.querySelector('.dest-remove')?.addEventListener('click', () => {
        rowEl.remove();
        const wrap = document.querySelector('#destacados-venta-root .destacados-rows');
        if (wrap && !wrap.querySelector('.dest-row')) {
            wrap.innerHTML = '<p class="text-xs text-gray-500 py-1">Sin filas. Añadí una o generá la narrativa con IA.</p>';
        }
        syncAddDestacadoBtn();
    });
}

function syncAddDestacadoBtn() {
    const n = document.querySelectorAll('#destacados-venta-root .dest-row').length;
    const b = document.getElementById('btn-add-destacado');
    if (b) b.disabled = n >= MAX_DESTACADOS_VENTA;
}

function handleAddDestacadoRow(state) {
    const wrap = document.querySelector('#destacados-venta-root .destacados-rows');
    if (!wrap || wrap.querySelectorAll('.dest-row').length >= MAX_DESTACADOS_VENTA) return;
    const hint = wrap.querySelector('p.text-xs');
    if (hint) hint.remove();
    wrap.insertAdjacentHTML('beforeend', renderDestRowHtml({}));
    const newRow = wrap.querySelector('.dest-row:last-of-type');
    if (newRow) bindDestRow(newRow, state);
    syncAddDestacadoBtn();
}

function collectDestacadosFromDom() {
    const rows = [...document.querySelectorAll('#destacados-venta-root .dest-row')];
    return rows
        .map((rowEl) => {
            const kind = rowEl.querySelector('.dest-kind')?.value || 'privado';
            const id = rowEl.querySelector('.dest-id')?.value?.trim() || '';
            const titulo = rowEl.querySelector('.dest-titulo')?.value?.trim() || '';
            const pitch = rowEl.querySelector('.dest-pitch')?.value?.trim() || '';
            const path = rowEl.querySelector('.dest-foto-path')?.value?.trim() || '';
            const imageId = rowEl.querySelector('.dest-foto-id')?.value?.trim() || '';
            const base = {
                alcance: kind === 'comun' ? 'comun' : 'privado',
                id,
                titulo,
                pitch,
            };
            if (path) {
                base.imagen = imageId ? { storagePath: path, imageId } : { storagePath: path };
            }
            return base;
        })
        .filter((r) => r.id && r.titulo && r.pitch)
        .slice(0, MAX_DESTACADOS_VENTA);
}

async function saveDestacadosOnly(state) {
    const btn = document.getElementById('btn-guardar-destacados-only');
    if (!btn) return;
    btn.disabled = true;
    try {
        const venta = collectDestacadosFromDom();
        const res = await fetchAPI(`/website/propiedad/${state.propiedadId}/build-context/espacios-destacados`, {
            method: 'PUT',
            body: { espaciosDestacadosVenta: venta },
        });
        if (!state.buildContext) state.buildContext = {};
        if (!state.buildContext.narrativa) state.buildContext.narrativa = {};
        state.buildContext.narrativa.espaciosDestacadosVenta = res.espaciosDestacadosVenta || venta;
        mountDestacadosEditor(state);
        alert('Destacados guardados. La ficha pública usará esta lista (el servidor valida ids).');
    } catch (err) {
        alert('Error al guardar destacados: ' + (err.message || 'Intenta nuevamente'));
    } finally {
        btn.disabled = false;
    }
}
