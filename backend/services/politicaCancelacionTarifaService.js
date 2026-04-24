/**
 * Política de cancelación resumida por tarifa (metadata.politicaCancelacion en tarifas).
 * Una tarifa: override ≠ inherit → fusiona sobre `legal`.
 * Varias tarifas en la estadía:
 *   - **Ponderación (mayoría de noches):** si una tarifa con override aplica a **más de la mitad**
 *     de las noches de la estadía (índice en `tarifaIdsPorNoche`, incl. noches sin tarifa),
 *     se usa su política como si fuera una sola tarifa (modo/horas + texto largo propio).
 *   - Si no hay mayoría clara: fusión **más restrictiva para el huésped** (`texto_solo` gana;
 *     si no, `gratis_hasta_horas` con el **mínimo** de horas; si solo `gratis_ilimitada`, ese modo).
 *
 * Texto/HTML largo (`metadata.politicaCancelacion.politicaCancelacionHtml` o `.politicaCancelacionTexto`):
 *   una sola tarifa aplicable o mayoría → sustituye el bloque del sitio si viene informado;
 *   varias tarifas con override sin mayoría → solo si el contenido largo es **idéntico** (normalizado);
 *   si difiere, se conserva el legal del sitio en el objeto fusionado y
 *   `listarBloquesPoliticaCancelacionLargoDistintosAlPrincipal` expone los textos distintos al principal
 *   para apilarlos en SSR (checkout, confirmación, ficha).
 */

const { parseISO, isValid, addDays } = require('date-fns');

/**
 * @param {string} alojamientoId
 * @param {string} fechaLlegadaStr YYYY-MM-DD
 * @param {string} fechaSalidaStr YYYY-MM-DD (checkout exclusivo)
 * @param {Array<{ id?: string, alojamientoId: string, fechaInicio: Date, fechaTermino: Date }>} allTarifas
 * @returns {string[]} id de tarifa por noche (índice = noche) o null si no hay tarifa
 */
function listTarifaIdsPorNocheEstadia(alojamientoId, fechaLlegadaStr, fechaSalidaStr, allTarifas) {
    const lleg = parseISO(String(fechaLlegadaStr || '').slice(0, 10) + 'T12:00:00');
    const sal = parseISO(String(fechaSalidaStr || '').slice(0, 10) + 'T12:00:00');
    if (!isValid(lleg) || !isValid(sal) || sal <= lleg) return [];
    const aid = String(alojamientoId || '');
    const list = Array.isArray(allTarifas) ? allTarifas : [];
    const ids = [];
    for (let d = new Date(lleg); d < sal; d = addDays(d, 1)) {
        const tarifasDelDia = list.filter(
            (t) => String(t.alojamientoId) === aid && t.fechaInicio <= d && t.fechaTermino >= d
        );
        if (tarifasDelDia.length > 0) {
            const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
            ids.push(tarifa.id ? String(tarifa.id) : null);
        } else {
            ids.push(null);
        }
    }
    return ids;
}

/**
 * Todas las tarifas que aplican en alguna noche de algún alojamiento del grupo (misma estadía).
 * Sirve para fusionar política de cancelación entre propiedades.
 * @param {string[]} propiedadIds
 * @param {string} fechaLlegadaStr
 * @param {string} fechaSalidaStr
 * @param {Array} allTarifas
 * @returns {string[]}
 */
function listTarifaIdsUnionGrupoEstadia(propiedadIds, fechaLlegadaStr, fechaSalidaStr, allTarifas) {
    const pids = Array.isArray(propiedadIds) ? propiedadIds.map((p) => String(p).trim()).filter(Boolean) : [];
    const flat = [];
    for (const pid of pids) {
        const perNight = listTarifaIdsPorNocheEstadia(pid, fechaLlegadaStr, fechaSalidaStr, allTarifas);
        for (const id of perNight) {
            if (id) flat.push(id);
        }
    }
    return flat;
}

/**
 * @param {Array} allTarifas
 * @param {string} tarifaId
 * @returns {{ modo: string, horas: number | null } | null}
 */
function politicaCancelacionOverrideDeTarifa(allTarifas, tarifaId) {
    const tarifa = (allTarifas || []).find((t) => t.id && String(t.id) === String(tarifaId));
    const pc = tarifa?.metadata?.politicaCancelacion;
    if (!pc || typeof pc !== 'object') return null;
    const modo = String(pc.modo || '').trim().toLowerCase();
    if (!modo || modo === 'inherit' || modo === 'empresa' || modo === 'default') return null;
    if (modo !== 'texto_solo' && modo !== 'gratis_hasta_horas' && modo !== 'gratis_ilimitada') return null;
    if (modo === 'gratis_hasta_horas') {
        const h = Math.round(Number(pc.horasGratis ?? pc.politicaCancelacionHorasGratis));
        if (!Number.isFinite(h) || h < 1 || h > 8760) return null;
        return { modo, horas: h };
    }
    return { modo, horas: null };
}

const MAX_POLITICA_CANCELACION_LARGO = 20000;

function _normalizeLargoPolitica(s) {
    const t = String(s || '').trim();
    if (!t) return '';
    return t.length > MAX_POLITICA_CANCELACION_LARGO ? t.slice(0, MAX_POLITICA_CANCELACION_LARGO) : t;
}

/** @returns {{ html: string, texto: string }} */
function _leerLargoDesdePoliticaTarifa(pc) {
    if (!pc || typeof pc !== 'object') return { html: '', texto: '' };
    return {
        html: _normalizeLargoPolitica(pc.politicaCancelacionHtml),
        texto: _normalizeLargoPolitica(pc.politicaCancelacionTexto),
    };
}

function _normParaCompararLargo(html, texto) {
    return String(html || texto || '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Etiqueta humana opcional para UI (SHARED_CONTEXT: ids en negocio; nombres editables solo para mostrar).
 * Sin `metadata.nombre` / `metadata.etiqueta` → null (el SSR usa copy genérico, no fragmentos de UUID).
 * @param {Array} allTarifas
 * @param {string} tarifaId
 * @returns {string | null}
 */
function _etiquetaTarifaUi(allTarifas, tarifaId) {
    const t = (allTarifas || []).find((x) => x.id && String(x.id) === String(tarifaId));
    const m = t?.metadata && typeof t.metadata === 'object' ? t.metadata : {};
    const n = String(m.nombre || m.etiqueta || '').trim();
    return n || null;
}

/**
 * Si una tarifa con override cubre > 50 % de las noches del arreglo, devuelve su id; si no, null.
 * Empates en el máximo → null (se aplica fusión restrictiva).
 * @param {Array} allTarifas
 * @param {(string|null|undefined)[]} tarifaIdsPorNoche
 * @returns {string|null}
 */
function _tarifaDominantePorNoches(allTarifas, tarifaIdsPorNoche) {
    const nights = tarifaIdsPorNoche || [];
    const total = nights.length;
    if (total === 0) return null;
    const counts = new Map();
    for (const rawId of nights) {
        if (!rawId) continue;
        const id = String(rawId);
        if (!politicaCancelacionOverrideDeTarifa(allTarifas, id)) continue;
        counts.set(id, (counts.get(id) || 0) + 1);
    }
    if (counts.size === 0) return null;
    let bestC = -1;
    const atBest = [];
    for (const [id, c] of counts) {
        if (c > bestC) {
            bestC = c;
            atBest.length = 0;
            atBest.push(id);
        } else if (c === bestC) {
            atBest.push(id);
        }
    }
    if (atBest.length !== 1 || bestC * 2 <= total) return null;
    return atBest[0];
}

/** Si la tarifa trae texto/HTML propio, sustituye el bloque legal largo del sitio. */
function _aplicarTextoLargoUnaTarifa(out, allTarifas, tarifaId) {
    const tarifa = (allTarifas || []).find((t) => t.id && String(t.id) === String(tarifaId));
    const { html, texto } = _leerLargoDesdePoliticaTarifa(tarifa?.metadata?.politicaCancelacion);
    if (html) {
        out.politicaCancelacionHtml = html;
        delete out.politicaCancelacionTexto;
        return;
    }
    if (texto) {
        out.politicaCancelacionTexto = texto;
        delete out.politicaCancelacionHtml;
    }
}

/**
 * Si varias tarifas con override tienen el mismo largo (mismo contenido normalizado), aplica ese bloque.
 * Si hay varios textos distintos, no toca `politicaCancelacionHtml` / `politicaCancelacionTexto` heredados de `out`.
 */
function _aplicarTextoLargoVariasTarifas(out, allTarifas, uniqIds) {
    const blobs = [];
    for (const id of uniqIds || []) {
        if (!politicaCancelacionOverrideDeTarifa(allTarifas, id)) continue;
        const tarifa = (allTarifas || []).find((t) => t.id && String(t.id) === String(id));
        const { html, texto } = _leerLargoDesdePoliticaTarifa(tarifa?.metadata?.politicaCancelacion);
        const n = _normParaCompararLargo(html, texto);
        if (n) blobs.push({ n, html, texto });
    }
    if (blobs.length === 0) return;
    const distinct = [...new Set(blobs.map((b) => b.n))];
    if (distinct.length !== 1) return;
    const pick = blobs.find((b) => b.n === distinct[0]);
    if (pick.html) {
        out.politicaCancelacionHtml = pick.html;
        delete out.politicaCancelacionTexto;
    } else {
        out.politicaCancelacionTexto = pick.texto;
        delete out.politicaCancelacionHtml;
    }
}

/**
 * Aplica override de una sola tarifa sobre `legal` (misma lógica histórica).
 */
function _mergeUnaTarifa(base, allTarifas, tarifaId) {
    const pol = politicaCancelacionOverrideDeTarifa(allTarifas, tarifaId);
    if (!pol) return base;
    const out = { ...base, politicaCancelacionModo: pol.modo };
    if (pol.modo === 'gratis_hasta_horas' && pol.horas != null) {
        out.politicaCancelacionHorasGratis = pol.horas;
    }
    _aplicarTextoLargoUnaTarifa(out, allTarifas, tarifaId);
    return out;
}

/**
 * Mezcla de varias tarifas: política más restrictiva para el huésped.
 */
function _mergeVariasTarifas(base, allTarifas, uniqIds) {
    const policies = (uniqIds || [])
        .map((id) => politicaCancelacionOverrideDeTarifa(allTarifas, id))
        .filter(Boolean);
    if (policies.length === 0) return base;
    let out;
    if (policies.some((p) => p.modo === 'texto_solo')) {
        out = { ...base, politicaCancelacionModo: 'texto_solo' };
    } else {
        const conHoras = policies.filter((p) => p.modo === 'gratis_hasta_horas' && p.horas != null);
        if (conHoras.length > 0) {
            const hMin = Math.min(...conHoras.map((p) => p.horas));
            out = {
                ...base,
                politicaCancelacionModo: 'gratis_hasta_horas',
                politicaCancelacionHorasGratis: hMin,
            };
        } else if (policies.length > 0 && policies.every((p) => p.modo === 'gratis_ilimitada')) {
            out = { ...base, politicaCancelacionModo: 'gratis_ilimitada' };
        } else {
            out = { ...base };
        }
    }
    _aplicarTextoLargoVariasTarifas(out, allTarifas, uniqIds);
    return out;
}

/**
 * Si hay override(s) en tarifa(s) de la estadía, fusiona sobre `legal` (copia superficial).
 * Una tarifa distinta por noche: se aplica la regla de fusión multi-tarifa.
 * @param {object} legal — websiteSettings.legal
 * @param {Array} allTarifas — mismo formato que fetchTarifasYCanal (con id y metadata)
 * @param {string[]} tarifaIdsPorNoche
 * @returns {object}
 */
function mergeLegalConPoliticaTarifaUnica(legal, allTarifas, tarifaIdsPorNoche) {
    const base = legal && typeof legal === 'object' ? { ...legal } : {};
    const defined = (tarifaIdsPorNoche || []).filter(Boolean);
    if (defined.length === 0) return base;
    const uniq = [...new Set(defined)];
    if (uniq.length === 1) {
        return _mergeUnaTarifa(base, allTarifas, uniq[0]);
    }
    const domId = _tarifaDominantePorNoches(allTarifas, tarifaIdsPorNoche);
    if (domId) {
        return _mergeUnaTarifa(base, allTarifas, domId);
    }
    return _mergeVariasTarifas(base, allTarifas, uniq);
}

/**
 * Bloques de texto largo por tarifa cuyo contenido normalizado difiere del ya fusionado en `legalEfectivo`
 * (p. ej. política de la tarifa minoritaria cuando la mayoría impuso otra).
 * @param {Array} allTarifas
 * @param {(string|null|undefined)[]} tarifaIdsPorNoche
 * @param {object} legalEfectivo — salida de `mergeLegalConPoliticaTarifaUnica` (o equivalente)
 * @returns {{ etiqueta: string, tarifaIds: string[], html?: string, texto?: string, noches: number, totalNoches: number }[]}
 */
function listarBloquesPoliticaCancelacionLargoDistintosAlPrincipal(allTarifas, tarifaIdsPorNoche, legalEfectivo) {
    const nights = tarifaIdsPorNoche || [];
    const totalNoches = nights.length;
    if (totalNoches === 0) return [];

    const counts = new Map();
    for (const rawId of nights) {
        if (!rawId) continue;
        const id = String(rawId);
        if (!politicaCancelacionOverrideDeTarifa(allTarifas, id)) continue;
        counts.set(id, (counts.get(id) || 0) + 1);
    }

    /** @type {Map<string, { html: string, texto: string, noches: number, etiquetas: string[], ids: Set<string> }>} */
    const byNorm = new Map();
    for (const [tid, ncnt] of counts) {
        const tarifa = (allTarifas || []).find((t) => t.id && String(t.id) === tid);
        const { html, texto } = _leerLargoDesdePoliticaTarifa(tarifa?.metadata?.politicaCancelacion);
        const norm = _normParaCompararLargo(html, texto);
        if (!norm) continue;
        const prev = byNorm.get(norm);
        const etiqueta = _etiquetaTarifaUi(allTarifas, tid);
        if (!prev) {
            byNorm.set(norm, {
                html,
                texto,
                noches: ncnt,
                etiquetas: etiqueta ? [etiqueta] : [],
                ids: new Set([tid]),
            });
        } else {
            prev.noches += ncnt;
            prev.ids.add(tid);
            if (etiqueta && !prev.etiquetas.includes(etiqueta)) prev.etiquetas.push(etiqueta);
        }
    }

    if (byNorm.size <= 1) return [];

    const mainNorm = _normParaCompararLargo(
        legalEfectivo?.politicaCancelacionHtml,
        legalEfectivo?.politicaCancelacionTexto
    );

    const blocks = [];
    for (const [, data] of byNorm) {
        const norm = _normParaCompararLargo(data.html, data.texto);
        if (!norm || norm === mainNorm) continue;
        const row = {
            etiqueta: data.etiquetas.join(' · '),
            tarifaIds: [...data.ids].sort(),
            noches: data.noches,
            totalNoches,
        };
        if (data.html) row.html = data.html;
        else if (data.texto) row.texto = data.texto;
        blocks.push(row);
    }
    blocks.sort((a, b) => b.noches - a.noches);
    return blocks;
}

/**
 * Objeto mínimo para guardar en reserva.metadata (confirmación SSR).
 */
function snapshotPoliticaCancelacionParaMetadata(legalEfectivo) {
    const o = legalEfectivo && typeof legalEfectivo === 'object' ? legalEfectivo : {};
    const snap = {
        politicaCancelacionModo: String(o.politicaCancelacionModo || 'texto_solo').trim() || 'texto_solo',
        politicaCancelacionHorasGratis: Math.round(Number(o.politicaCancelacionHorasGratis) || 0),
    };
    const html = _normalizeLargoPolitica(o.politicaCancelacionHtml);
    const texto = _normalizeLargoPolitica(o.politicaCancelacionTexto);
    if (html) snap.politicaCancelacionHtml = html;
    if (texto) snap.politicaCancelacionTexto = texto;
    return snap;
}

module.exports = {
    listTarifaIdsPorNocheEstadia,
    listTarifaIdsUnionGrupoEstadia,
    mergeLegalConPoliticaTarifaUnica,
    listarBloquesPoliticaCancelacionLargoDistintosAlPrincipal,
    snapshotPoliticaCancelacionParaMetadata,
};
