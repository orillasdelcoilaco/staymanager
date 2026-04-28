/**
 * CTA para sitios externos: enlace al home o a la ficha del tenant con fechas opcionales en query.
 * Opcionalmente muestra el total estimado (CLP) vía GET widget-tarifa.json (sin iframe).
 *
 * Atributos en el <script> (todos opcionales salvo src):
 * - data-base: URL absoluta del sitio público (p. ej. https://midominio.cl). Si falta, se usa el origin del script.
 * - data-label / data-class: texto del enlace y clase CSS.
 * - data-propiedad-id: UUID de una propiedad → enlace /propiedad/{id} en lugar del home.
 * - data-fecha-llegada, data-fecha-salida: YYYY-MM-DD (se añaden a la query como en el buscador SSR).
 * - data-personas: número de huéspedes (query `personas`).
 * - data-ui-fechas: "1" o "true" — muestra inputs type=date (y huéspedes) en la página externa; requiere data-propiedad-id.
 *   Actualiza el href y, si data-mostrar-tarifa, el total al elegir fechas. data-lang="en" para etiquetas en inglés.
 * - data-mostrar-tarifa: "1" o "true" — si hay propiedad + fechas válidas, pide `/propiedad/{id}/widget-tarifa.json`
 *   y muestra el total debajo del enlace (mismo host que data-base).
 *
 * Ejemplo con rango de estancia:
 * <script src="https://TU-DOMINIO/public/js/widget-reserva-embed.js" defer
 *   data-base="https://TU-DOMINIO" data-label="Reservar" data-class="btn"
 *   data-propiedad-id="UUID" data-fecha-llegada="2026-05-01" data-fecha-salida="2026-05-05" data-personas="2"></script>
 *
 * Ejemplo con fechas editables en la página externa + total:
 * <script src="https://TU-DOMINIO/public/js/widget-reserva-embed.js" defer
 *   data-base="https://TU-DOMINIO" data-label="Reservar" data-propiedad-id="UUID"
 *   data-ui-fechas="1" data-mostrar-tarifa="1"></script>
 */
(function () {
    function _localISODate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function _addDaysISO(iso, days) {
        const [y, mo, da] = String(iso || '').split('-').map(Number);
        if (!y || !mo || !da) return '';
        const t = new Date(y, mo - 1, da + days);
        return _localISODate(t);
    }

    const sc = document.currentScript;
    if (!sc || !sc.parentNode) return;
    let base = (sc.getAttribute('data-base') || '').trim().replace(/\/$/, '');
    if (!base) {
        try {
            base = new URL(sc.src).origin;
        } catch (_) {
            return;
        }
    }
    const label = (sc.getAttribute('data-label') || 'Reservar').trim() || 'Reservar';
    const cls = (sc.getAttribute('data-class') || '').trim();
    const propId = (sc.getAttribute('data-propiedad-id') || '').trim();
    const fl = (sc.getAttribute('data-fecha-llegada') || '').trim();
    const fs = (sc.getAttribute('data-fecha-salida') || '').trim();
    const personas = (sc.getAttribute('data-personas') || '').trim();
    const mostrarTarifa = /^1|true|yes$/i.test(String(sc.getAttribute('data-mostrar-tarifa') || '').trim());
    const uiFechas = /^1|true|yes$/i.test(String(sc.getAttribute('data-ui-fechas') || '').trim());
    const langEn = String(sc.getAttribute('data-lang') || '').trim().toLowerCase() === 'en';

    let path = '/';
    const safeProp = propId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (safeProp.length >= 8 && safeProp.length <= 128) {
        path = `/propiedad/${encodeURIComponent(safeProp)}`;
    }
    function buildHref(flStr, fsStr, persStr) {
        try {
            const u = new URL(path, base.endsWith('/') ? base : `${base}/`);
            if (flStr) u.searchParams.set('fechaLlegada', flStr);
            if (fsStr) u.searchParams.set('fechaSalida', fsStr);
            if (persStr) u.searchParams.set('personas', persStr);
            return u.toString();
        } catch (_) {
            return `${base}${path}`;
        }
    }

    let href = buildHref(fl, fs, personas);

    const wrap = document.createElement('span');
    wrap.className = 'sm-widget-reserva-embed';
    wrap.style.display = 'inline-block';
    wrap.style.verticalAlign = 'middle';

    let inFl = fl;
    let inFs = fs;
    let inPers = personas;
    /** @type {HTMLInputElement|null} */
    let refFl = null;
    /** @type {HTMLInputElement|null} */
    let refFs = null;
    /** @type {HTMLInputElement|null} */
    let refPers = null;

    if (uiFechas) {
        if (!safeProp || safeProp.length < 8) {
            const err = document.createElement('div');
            err.className = 'sm-widget-reserva-aviso';
            err.style.fontSize = '0.75rem';
            err.style.color = '#b45309';
            err.textContent = langEn
                ? 'data-propiedad-id is required when data-ui-fechas is set.'
                : 'data-ui-fechas requiere data-propiedad-id (UUID de la propiedad).';
            wrap.appendChild(err);
            sc.parentNode.insertBefore(wrap, sc.nextSibling);
            return;
        }
        const box = document.createElement('div');
        box.className = 'sm-widget-reserva-fechas';
        box.style.display = 'flex';
        box.style.flexWrap = 'wrap';
        box.style.gap = '0.5rem 0.75rem';
        box.style.alignItems = 'flex-end';
        box.style.marginBottom = '0.5rem';
        box.style.fontFamily = 'system-ui, sans-serif';
        box.style.fontSize = '0.8125rem';
        box.style.color = '#334155';

        const today = _localISODate(new Date());

        function mkField(id, lab, value, min) {
            const labEl = document.createElement('label');
            labEl.style.display = 'flex';
            labEl.style.flexDirection = 'column';
            labEl.style.gap = '0.2rem';
            const span = document.createElement('span');
            span.textContent = lab;
            const inp = document.createElement('input');
            inp.type = 'date';
            inp.id = id;
            inp.min = min || today;
            if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) inp.value = value;
            inp.style.padding = '0.25rem 0.35rem';
            inp.style.border = '1px solid #cbd5e1';
            inp.style.borderRadius = '0.25rem';
            labEl.appendChild(span);
            labEl.appendChild(inp);
            return { labEl, inp };
        }

        const uid = `smw${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        const l1 = langEn ? 'Check-in' : 'Llegada';
        const l2 = langEn ? 'Check-out' : 'Salida';
        const l3 = langEn ? 'Guests' : 'Huéspedes';
        const f1 = mkField(`${uid}-fl`, l1, inFl, today);
        const minSal = inFl && /^\d{4}-\d{2}-\d{2}$/.test(inFl) ? _addDaysISO(inFl, 1) : _addDaysISO(today, 1);
        const f2 = mkField(`${uid}-fs`, l2, inFs, minSal);
        const persWrap = document.createElement('label');
        persWrap.style.display = 'flex';
        persWrap.style.flexDirection = 'column';
        persWrap.style.gap = '0.2rem';
        const persLab = document.createElement('span');
        persLab.textContent = l3;
        const persInp = document.createElement('input');
        persInp.type = 'number';
        persInp.min = '1';
        persInp.max = '50';
        persInp.step = '1';
        persInp.value = String(inPers || '2').replace(/\D/g, '') || '2';
        persInp.style.width = '3.5rem';
        persInp.style.padding = '0.25rem 0.35rem';
        persInp.style.border = '1px solid #cbd5e1';
        persInp.style.borderRadius = '0.25rem';
        persWrap.appendChild(persLab);
        persWrap.appendChild(persInp);

        box.appendChild(f1.labEl);
        box.appendChild(f2.labEl);
        box.appendChild(persWrap);
        wrap.appendChild(box);

        refFl = f1.inp;
        refFs = f2.inp;
        refPers = persInp;
        wrap.dataset.smWidgetToday = today;
    }

    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener noreferrer';
    a.textContent = label;
    if (cls) a.className = cls;
    else {
        a.style.display = 'inline-block';
        a.style.marginTop = uiFechas ? '0' : '0.5rem';
        a.style.padding = '0.5rem 1rem';
        a.style.borderRadius = '0.375rem';
        a.style.background = '#0d9488';
        a.style.color = '#fff';
        a.style.textDecoration = 'none';
        a.style.fontWeight = '600';
    }
    wrap.appendChild(a);

    sc.parentNode.insertBefore(wrap, sc.nextSibling);

    const precioEl = document.createElement('div');
    precioEl.className = 'sm-widget-reserva-tarifa';
    precioEl.style.marginTop = '0.35rem';
    precioEl.style.fontSize = '0.875rem';
    precioEl.style.color = '#334155';
    precioEl.style.display = 'none';
    wrap.appendChild(precioEl);

    let tarifaTimer;
    function runTarifa(flStr, fsStr) {
        if (!mostrarTarifa || !safeProp || !/^\d{4}-\d{2}-\d{2}$/.test(flStr) || !/^\d{4}-\d{2}-\d{2}$/.test(fsStr) || flStr >= fsStr) {
            precioEl.textContent = '';
            precioEl.style.display = 'none';
            return;
        }
        precioEl.style.display = 'block';
        precioEl.textContent = langEn ? '…' : '…';
        let tarifaUrl;
        try {
            const u = new URL(`/propiedad/${encodeURIComponent(safeProp)}/widget-tarifa.json`, base.endsWith('/') ? base : `${base}/`);
            u.searchParams.set('fechaLlegada', flStr);
            u.searchParams.set('fechaSalida', fsStr);
            tarifaUrl = u.toString();
        } catch (_) {
            precioEl.textContent = '';
            precioEl.style.display = 'none';
            return;
        }
        fetch(tarifaUrl, { credentials: 'omit' })
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => {
                if (!ok || !j || j.error) {
                    precioEl.textContent = '';
                    precioEl.style.display = 'none';
                    return;
                }
                const nocheTxt = j.numNoches
                    ? langEn
                        ? ` · ${j.numNoches} night(s)`
                        : ` · ${j.numNoches} noche(s)`
                    : '';
                const pref = langEn ? 'Estimated total: ' : 'Total estimado: ';
                precioEl.textContent = j.formattedTotalPrice ? `${pref}${j.formattedTotalPrice}${nocheTxt}` : '';
                if (!precioEl.textContent) precioEl.style.display = 'none';
            })
            .catch(() => {
                precioEl.textContent = '';
                precioEl.style.display = 'none';
            });
    }

    function syncFromInputs() {
        if (!uiFechas || !refFl || !refFs || !refPers) return;
        inFl = (refFl.value || '').trim();
        inFs = (refFs.value || '').trim();
        inPers = String(refPers.value || '2').trim() || '2';
        a.href = buildHref(inFl, inFs, inPers);
        clearTimeout(tarifaTimer);
        tarifaTimer = setTimeout(() => runTarifa(inFl, inFs), 280);
    }

    if (uiFechas && refFl && refFs && refPers) {
        const todayMark = wrap.dataset.smWidgetToday || _localISODate(new Date());
        refFl.addEventListener('change', () => {
            const v = refFl.value;
            refFs.min = v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? _addDaysISO(v, 1) : _addDaysISO(todayMark, 1);
            if (refFs.value && refFs.value <= v) refFs.value = '';
            syncFromInputs();
        });
        refFs.addEventListener('change', syncFromInputs);
        refPers.addEventListener('change', syncFromInputs);
        syncFromInputs();
    } else if (mostrarTarifa && safeProp && /^\d{4}-\d{2}-\d{2}$/.test(fl) && /^\d{4}-\d{2}-\d{2}$/.test(fs) && fl < fs) {
        runTarifa(fl, fs);
    }
})();
