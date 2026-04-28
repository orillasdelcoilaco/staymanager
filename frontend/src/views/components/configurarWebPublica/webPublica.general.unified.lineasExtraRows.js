/**
 * Editor por filas para websiteSettings.legal.desglosePrecioCheckout.lineasExtra (§4.1).
 * Sincroniza con #desglose-lineas-extra-json para reutilizar validateLineasExtraArray en collectLegalFromForm.
 */

const TIPO_OPTIONS = [
    { value: 'porcentaje_total', label: '% sobre total (IVA incl.)' },
    { value: 'porcentaje_neto', label: '% sobre neto' },
    { value: 'monto_fijo', label: 'Monto fijo (CLP)' },
    { value: 'por_noche', label: 'Monto por noche (CLP)' },
    { value: 'por_persona_noche', label: 'Monto por persona y noche (CLP)' },
];

let _syncTimer = null;

function _debouncedSync() {
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
        _syncTimer = null;
        syncLineasExtraRowsToHiddenJson();
    }, 120);
}

function _toggleAmountFields(rowEl, tipo) {
    const pct = rowEl.querySelector('[data-extra-fields="porcentaje"]');
    const monto = rowEl.querySelector('[data-extra-fields="montoCLP"]');
    const noche = rowEl.querySelector('[data-extra-fields="montoPorNocheCLP"]');
    const ppNoche = rowEl.querySelector('[data-extra-fields="montoPorPersonaNocheCLP"]');
    if (pct) pct.classList.toggle('hidden', tipo !== 'porcentaje_total' && tipo !== 'porcentaje_neto');
    if (monto) monto.classList.toggle('hidden', tipo !== 'monto_fijo');
    if (noche) noche.classList.toggle('hidden', tipo !== 'por_noche');
    if (ppNoche) ppNoche.classList.toggle('hidden', tipo !== 'por_persona_noche');
}

function _readRow(rowEl) {
    const tipo = String(rowEl.querySelector('[data-field="tipo"]')?.value || '').trim();
    const etiqueta = String(rowEl.querySelector('[data-field="etiqueta"]')?.value || '').trim();
    const etiquetaEn = String(rowEl.querySelector('[data-field="etiquetaEn"]')?.value || '').trim();
    const o = { tipo, etiqueta, etiquetaEn };
    if (tipo === 'porcentaje_total' || tipo === 'porcentaje_neto') {
        o.porcentaje = parseFloat(String(rowEl.querySelector('[data-field="porcentaje"]')?.value || '').replace(',', '.'));
    }
    if (tipo === 'monto_fijo') {
        o.montoCLP = parseInt(String(rowEl.querySelector('[data-field="montoCLP"]')?.value || ''), 10);
    }
    if (tipo === 'por_noche') {
        o.montoPorNocheCLP = parseInt(String(rowEl.querySelector('[data-field="montoPorNocheCLP"]')?.value || ''), 10);
    }
    if (tipo === 'por_persona_noche') {
        o.montoPorPersonaNocheCLP = parseInt(String(rowEl.querySelector('[data-field="montoPorPersonaNocheCLP"]')?.value || ''), 10);
    }
    return o;
}

/**
 * Serializa filas del DOM al textarea oculto (JSON) antes de validar/guardar.
 */
export function syncLineasExtraRowsToHiddenJson() {
    const root = document.getElementById('desglose-lineas-extra-rows-root');
    const ta = document.getElementById('desglose-lineas-extra-json');
    if (!root || !ta) return;
    const items = [];
    root.querySelectorAll('[data-linea-extra-row]').forEach((rowEl) => {
        items.push(_readRow(rowEl));
    });
    try {
        ta.value = JSON.stringify(items, null, 2);
    } catch {
        ta.value = '[]';
    }
}

function _createRowElement(data) {
    const tipo = String(data?.tipo || 'porcentaje_total').trim() || 'porcentaje_total';
    const wrap = document.createElement('div');
    wrap.setAttribute('data-linea-extra-row', '1');
    wrap.className = 'border border-gray-200 rounded-xl p-3 bg-white space-y-2';

    const row1 = document.createElement('div');
    row1.className = 'flex flex-wrap gap-2 items-end';

    const tipoWrap = document.createElement('div');
    tipoWrap.className = 'min-w-[200px] flex-1';
    const labTipo = document.createElement('label');
    labTipo.className = 'block text-xs font-medium text-gray-500 mb-1';
    labTipo.textContent = 'Tipo';
    const sel = document.createElement('select');
    sel.className = 'form-select w-full';
    sel.setAttribute('data-field', 'tipo');
    TIPO_OPTIONS.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === tipo) o.selected = true;
        sel.appendChild(o);
    });
    tipoWrap.appendChild(labTipo);
    tipoWrap.appendChild(sel);
    row1.appendChild(tipoWrap);

    const mkNumWrap = (field, label, hidden) => {
        const d = document.createElement('div');
        d.className = `w-28 sm:w-32 ${hidden ? 'hidden' : ''}`;
        const extraKey = field === 'porcentaje' ? 'porcentaje' : field;
        d.setAttribute('data-extra-fields', extraKey);
        const lab = document.createElement('label');
        lab.className = 'block text-xs font-medium text-gray-500 mb-1';
        lab.textContent = label;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'form-input w-full';
        inp.setAttribute('data-field', field);
        if (field === 'porcentaje') {
            inp.min = '0.01';
            inp.max = '100';
            inp.step = '0.1';
            const p = data?.porcentaje;
            inp.value = Number.isFinite(Number(p)) ? String(p) : '1';
        } else {
            inp.min = '1';
            inp.step = '1';
            const v = field === 'montoCLP'
                ? data?.montoCLP
                : (field === 'montoPorNocheCLP' ? data?.montoPorNocheCLP : data?.montoPorPersonaNocheCLP);
            inp.value = Number.isFinite(Number(v)) && Number(v) > 0 ? String(Math.round(Number(v))) : '';
        }
        d.appendChild(lab);
        d.appendChild(inp);
        return d;
    };

    const pctHidden = tipo !== 'porcentaje_total' && tipo !== 'porcentaje_neto';
    const montoHidden = tipo !== 'monto_fijo';
    const nocheHidden = tipo !== 'por_noche';
    const ppNocheHidden = tipo !== 'por_persona_noche';

    row1.appendChild(mkNumWrap('porcentaje', '%', pctHidden));
    row1.appendChild(mkNumWrap('montoCLP', 'CLP', montoHidden));
    row1.appendChild(mkNumWrap('montoPorNocheCLP', 'CLP/noche', nocheHidden));
    row1.appendChild(mkNumWrap('montoPorPersonaNocheCLP', 'CLP/pers/noche', ppNocheHidden));

    const btnRm = document.createElement('button');
    btnRm.type = 'button';
    btnRm.className = 'btn-ghost text-xs text-danger-600 shrink-0';
    btnRm.setAttribute('data-remove-linea', '1');
    btnRm.textContent = 'Quitar';
    row1.appendChild(btnRm);

    wrap.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2';

    const colEs = document.createElement('div');
    colEs.className = 'space-y-1';
    const labE = document.createElement('span');
    labE.className = 'block text-xs font-medium text-gray-500';
    labE.textContent = 'Etiqueta (ES)';
    const inE = document.createElement('input');
    inE.type = 'text';
    inE.className = 'form-input w-full';
    inE.setAttribute('data-field', 'etiqueta');
    inE.placeholder = 'Ej. Tasa municipal';
    inE.value = String(data?.etiqueta || '');
    colEs.appendChild(labE);
    colEs.appendChild(inE);

    const colEn = document.createElement('div');
    colEn.className = 'space-y-1';
    const labEn = document.createElement('span');
    labEn.className = 'block text-xs font-medium text-gray-500';
    labEn.textContent = 'Etiqueta (EN) opcional';
    const inEn = document.createElement('input');
    inEn.type = 'text';
    inEn.className = 'form-input w-full';
    inEn.setAttribute('data-field', 'etiquetaEn');
    inEn.placeholder = 'Optional English label';
    inEn.value = String(data?.etiquetaEn || '');
    colEn.appendChild(labEn);
    colEn.appendChild(inEn);

    row2.appendChild(colEs);
    row2.appendChild(colEn);
    wrap.appendChild(row2);

    sel.addEventListener('change', () => {
        _toggleAmountFields(wrap, sel.value);
        _debouncedSync();
    });
    wrap.querySelectorAll('input').forEach((inp) => {
        inp.addEventListener('input', _debouncedSync);
    });
    btnRm.addEventListener('click', () => {
        wrap.remove();
        syncLineasExtraRowsToHiddenJson();
    });

    return wrap;
}

export function initLineasExtraRowsEditor() {
    const root = document.getElementById('desglose-lineas-extra-rows-root');
    const ta = document.getElementById('desglose-lineas-extra-json');
    if (!root || !ta) return;

    let lineas = [];
    try {
        const parsed = JSON.parse(String(ta.value || '').trim() || '[]');
        lineas = Array.isArray(parsed) ? parsed : [];
    } catch {
        lineas = [];
    }

    root.replaceChildren();

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.id = 'desglose-lineas-extra-add';
    addBtn.className = 'btn-outline text-sm gap-2';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir línea';
    root.appendChild(addBtn);

    lineas.forEach((row) => {
        root.insertBefore(_createRowElement(row), addBtn);
    });

    addBtn.addEventListener('click', () => {
        root.insertBefore(_createRowElement({
            tipo: 'porcentaje_total',
            porcentaje: 1,
            etiqueta: '',
            etiquetaEn: '',
        }), addBtn);
        syncLineasExtraRowsToHiddenJson();
    });

    root.querySelectorAll('[data-linea-extra-row]').forEach((rowEl) => {
        const t = rowEl.querySelector('[data-field="tipo"]')?.value;
        _toggleAmountFields(rowEl, t);
    });

    syncLineasExtraRowsToHiddenJson();
}
