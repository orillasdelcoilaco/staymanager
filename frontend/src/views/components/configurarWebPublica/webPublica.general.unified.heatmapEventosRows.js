/**
 * Editor por filas para websiteSettings.booking.eventosDemandaMapaCalor (mapa de calor / demanda).
 */

function _clampInt(v, min, max, fallback) {
    const n = parseInt(String(v ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function _isIsoDate(s) {
    const t = String(s || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
    const d = new Date(`${t}T12:00:00`);
    return !Number.isNaN(d.getTime());
}

function _readRow(el) {
    const nombre = String(el.querySelector('[data-hm="nombre"]')?.value || '').trim();
    const desde = String(el.querySelector('[data-hm="desde"]')?.value || '').trim().slice(0, 10);
    const hasta = String(el.querySelector('[data-hm="hasta"]')?.value || '').trim().slice(0, 10);
    const nivel = _clampInt(el.querySelector('[data-hm="nivel"]')?.value, 1, 5, 3);
    const minNochesLlegada = _clampInt(el.querySelector('[data-hm="minNoches"]')?.value, 1, 30, 2);
    return { nombre, desde, hasta, nivel, minNochesLlegada };
}

export function collectHeatmapEventosForSave() {
    const root = document.getElementById('heatmap-eventos-rows-root');
    if (!root) return { ok: true, items: [] };
    const items = [];
    const rows = root.querySelectorAll('[data-heatmap-evento-row]');
    for (const el of rows) {
        const r = _readRow(el);
        const empty = !r.nombre && !r.desde && !r.hasta;
        if (empty) continue;
        if (!r.desde || !r.hasta) {
            return {
                ok: false,
                message: 'Mapa de calendario: cada periodo con nombre o datos debe tener fecha desde y hasta.',
            };
        }
        if (!_isIsoDate(r.desde) || !_isIsoDate(r.hasta)) {
            return {
                ok: false,
                message: 'Mapa de calendario: usa fechas válidas (aaaa-mm-dd).',
            };
        }
        if (r.desde > r.hasta) {
            return {
                ok: false,
                message: 'Mapa de calendario: "hasta" no puede ser anterior a "desde".',
            };
        }
        items.push({
            nombre: r.nombre || 'Evento local',
            desde: r.desde,
            hasta: r.hasta,
            nivel: r.nivel,
            minNochesLlegada: r.minNochesLlegada,
        });
    }
    return { ok: true, items };
}

function _createRow(data = {}) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-heatmap-evento-row', '1');
    wrap.className = 'border border-gray-200 rounded-xl p-3 bg-white space-y-2';

    const row1 = document.createElement('div');
    row1.className = 'min-w-0';
    const labN = document.createElement('label');
    labN.className = 'block text-[11px] text-gray-500 mb-1';
    labN.textContent = 'Nombre o motivo';
    const inpN = document.createElement('input');
    inpN.type = 'text';
    inpN.className = 'form-input w-full';
    inpN.setAttribute('data-hm', 'nombre');
    inpN.maxLength = 120;
    inpN.placeholder = 'Ej. Fiesta costumbrista';
    inpN.value = String(data.nombre || '').trim().slice(0, 120);
    row1.appendChild(labN);
    row1.appendChild(inpN);

    const row2 = document.createElement('div');
    row2.className = 'flex flex-wrap gap-3 items-end';

    const mk = (labelText, input) => {
        const d = document.createElement('div');
        d.className = 'min-w-[140px] flex-1';
        const lab = document.createElement('label');
        lab.className = 'block text-[11px] text-gray-500 mb-1';
        lab.textContent = labelText;
        d.appendChild(lab);
        d.appendChild(input);
        return d;
    };

    const desde = String(data.desde || '').slice(0, 10);
    const hasta = String(data.hasta || '').slice(0, 10);
    const nivel = _clampInt(data.nivel, 1, 5, 3);
    const minN = _clampInt(data.minNochesLlegada, 1, 30, 2);

    const inpD = document.createElement('input');
    inpD.type = 'date';
    inpD.className = 'form-input w-full';
    inpD.setAttribute('data-hm', 'desde');
    inpD.value = desde;

    const inpH = document.createElement('input');
    inpH.type = 'date';
    inpH.className = 'form-input w-full';
    inpH.setAttribute('data-hm', 'hasta');
    inpH.value = hasta;

    const inpNv = document.createElement('input');
    inpNv.type = 'number';
    inpNv.className = 'form-input w-full';
    inpNv.setAttribute('data-hm', 'nivel');
    inpNv.min = '1';
    inpNv.max = '5';
    inpNv.step = '1';
    inpNv.value = String(nivel);

    const inpM = document.createElement('input');
    inpM.type = 'number';
    inpM.className = 'form-input w-full';
    inpM.setAttribute('data-hm', 'minNoches');
    inpM.min = '1';
    inpM.max = '30';
    inpM.step = '1';
    inpM.value = String(minN);

    row2.appendChild(mk('Desde', inpD));
    row2.appendChild(mk('Hasta', inpH));
    row2.appendChild(mk('Intensidad (1–5)', inpNv));
    row2.appendChild(mk('Noches mín. si llegas aquí', inpM));

    const btnRm = document.createElement('button');
    btnRm.type = 'button';
    btnRm.className = 'btn-ghost text-xs text-danger-600 shrink-0 mb-1';
    btnRm.setAttribute('data-heatmap-remove', '1');
    btnRm.textContent = 'Quitar';
    btnRm.addEventListener('click', () => wrap.remove());

    row2.appendChild(btnRm);

    wrap.appendChild(row1);
    wrap.appendChild(row2);

    return wrap;
}

export function initHeatmapEventosRowsEditor(booking = {}) {
    const root = document.getElementById('heatmap-eventos-rows-root');
    if (!root) return;

    const eventos = Array.isArray(booking.eventosDemandaMapaCalor)
        ? booking.eventosDemandaMapaCalor
        : [];

    root.replaceChildren();

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.id = 'heatmap-eventos-add';
    addBtn.className = 'btn-outline text-sm gap-2';
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir periodo';
    root.appendChild(addBtn);

    eventos.forEach((ev) => {
        root.insertBefore(_createRow(ev), addBtn);
    });

    addBtn.addEventListener('click', () => {
        root.insertBefore(_createRow({}), addBtn);
    });
}
