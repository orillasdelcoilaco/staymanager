// frontend/src/views/components/gestionarTarifas/matriz.advanced.js
// Opciones avanzadas por fila: nombre web, promo de tarifa, política de cancelación (metadata JSONB).

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _sliceDate(v) {
    if (!v) return '';
    const t = String(v).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '';
}

/**
 * Fila expandible bajo cada alojamiento con controles de metadata.tarifas.
 * @param {object} p propiedad { id, nombre }
 * @param {object|null} tarifa tarifa API o null
 */
export function renderTarifaAdvancedRow(p, tarifa) {
    const meta = tarifa?.metadata && typeof tarifa.metadata === 'object' ? tarifa.metadata : {};
    const nombre = escapeHtml(meta.nombre || '');
    const promo = meta.promo && typeof meta.promo === 'object' ? meta.promo : {};
    const pc = meta.politicaCancelacion && typeof meta.politicaCancelacion === 'object'
        ? meta.politicaCancelacion : {};

    const activa = promo.activa !== false && promo.activa !== 'false';
    const tipoDesc = String(promo.tipoDescuento || '').toLowerCase() === 'monto_fijo' ? 'monto_fijo' : 'porcentaje';
    const pct = promo.porcentajeDescuento != null ? Number(promo.porcentajeDescuento) : '';
    const monto = promo.montoFijoDescuento != null ? Number(promo.montoFijoDescuento) : '';
    const minN = promo.minNoches != null ? Number(promo.minNoches) : 1;
    const etiqueta = escapeHtml(promo.etiqueta || '');
    const ed = _sliceDate(promo.estanciaFechaDesde);
    const eh = _sliceDate(promo.estanciaFechaHasta);
    const rd = _sliceDate(promo.fechaReservaDesde);
    const rh = _sliceDate(promo.fechaReservaHasta);

    const modoPc = String(pc.modo || 'inherit').toLowerCase();
    const horas = pc.horasGratis != null ? Number(pc.horasGratis) : (pc.politicaCancelacionHorasGratis != null ? Number(pc.politicaCancelacionHorasGratis) : 48);
    const textoLargo = escapeHtml(pc.politicaCancelacionTexto || '');

    return `
<tr class="tarifa-advanced border-b bg-gray-50/80" data-advanced-for="${p.id}">
    <td colspan="5" class="px-4 py-2">
        <details class="group text-xs">
            <summary class="cursor-pointer text-primary-700 hover:underline font-medium select-none">
                Web público, ofertas y política de cancelación (esta temporada)
            </summary>
            <div class="mt-3 grid gap-3 md:grid-cols-3 border-t border-gray-200 pt-3">
                <div class="space-y-1">
                    <label class="block text-gray-600 font-medium">Nombre en web público</label>
                    <input type="text" data-field="nombre-web" maxlength="120" placeholder="Etiqueta en checkout (opcional)"
                           class="form-input w-full text-sm" value="${nombre}" />
                    <p class="text-gray-400 text-[11px]">Si queda vacío, el sitio usa el nombre del alojamiento.</p>
                </div>
                <div class="space-y-2 border border-gray-100 rounded-lg p-2 bg-white">
                    <div class="font-medium text-gray-700">Oferta en esta tarifa</div>
                    <label class="inline-flex items-center gap-2">
                        <input type="checkbox" data-field="promo-activa" class="rounded border-gray-300" ${activa ? 'checked' : ''} />
                        <span>Promoción activa</span>
                    </label>
                    <div class="flex gap-2 items-center flex-wrap">
                        <label class="text-gray-500">Tipo</label>
                        <select data-field="promo-tipo" class="form-select text-sm py-1">
                            <option value="porcentaje" ${tipoDesc === 'porcentaje' ? 'selected' : ''}>% descuento</option>
                            <option value="monto_fijo" ${tipoDesc === 'monto_fijo' ? 'selected' : ''}>Monto fijo / noche</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-gray-500 text-[11px]">% descuento</label>
                            <input type="number" min="0" max="90" step="1" data-field="promo-pct" class="form-input w-full text-sm py-1" value="${pct === '' || Number.isNaN(pct) ? '' : pct}" />
                        </div>
                        <div>
                            <label class="text-gray-500 text-[11px]">Monto CLP / noche</label>
                            <input type="number" min="0" step="1000" data-field="promo-monto" class="form-input w-full text-sm py-1" value="${monto === '' || Number.isNaN(monto) ? '' : monto}" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-gray-500 text-[11px]">Mín. noches</label>
                            <input type="number" min="1" step="1" data-field="promo-min-noches" class="form-input w-full text-sm py-1" value="${minN || 1}" />
                        </div>
                        <div>
                            <label class="text-gray-500 text-[11px]">Etiqueta</label>
                            <input type="text" maxlength="40" data-field="promo-etiqueta" class="form-input w-full text-sm py-1" value="${etiqueta}" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-1">
                        <div>
                            <span class="text-gray-500 text-[11px]">Estancia desde</span>
                            <input type="date" data-field="promo-ed" class="form-input w-full text-sm py-1" value="${ed}" />
                        </div>
                        <div>
                            <span class="text-gray-500 text-[11px]">Estancia hasta</span>
                            <input type="date" data-field="promo-eh" class="form-input w-full text-sm py-1" value="${eh}" />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-1">
                        <div>
                            <span class="text-gray-500 text-[11px]">Reserva desde</span>
                            <input type="date" data-field="promo-rd" class="form-input w-full text-sm py-1" value="${rd}" />
                        </div>
                        <div>
                            <span class="text-gray-500 text-[11px]">Reserva hasta</span>
                            <input type="date" data-field="promo-rh" class="form-input w-full text-sm py-1" value="${rh}" />
                        </div>
                    </div>
                </div>
                <div class="space-y-2 border border-gray-100 rounded-lg p-2 bg-white">
                    <div class="font-medium text-gray-700">Política de cancelación</div>
                    <select data-field="pc-modo" class="form-select text-sm py-1 w-full">
                        <option value="inherit" ${modoPc === 'inherit' || modoPc === 'empresa' || modoPc === 'default' || !modoPc ? 'selected' : ''}>Igual que configuración legal del sitio</option>
                        <option value="texto_solo" ${modoPc === 'texto_solo' ? 'selected' : ''}>Solo texto (sin plazo gratis automático)</option>
                        <option value="gratis_hasta_horas" ${modoPc === 'gratis_hasta_horas' ? 'selected' : ''}>Gratis hasta X horas antes</option>
                        <option value="gratis_ilimitada" ${modoPc === 'gratis_ilimitada' ? 'selected' : ''}>Cancelación gratuita (sin tope de horas)</option>
                    </select>
                    <div data-pc-horas-wrap class="${modoPc === 'gratis_hasta_horas' ? '' : 'hidden'}">
                        <label class="text-gray-500 text-[11px]">Horas antes del check-in</label>
                        <input type="number" min="1" max="8760" step="1" data-field="pc-horas" class="form-input w-full text-sm py-1" value="${Number.isFinite(horas) ? horas : 48}" />
                    </div>
                    <div>
                        <label class="text-gray-500 text-[11px]">Texto visible (modo texto / aclaración corta)</label>
                        <textarea data-field="pc-texto" rows="3" maxlength="2000" placeholder="Opcional. Para textos legales largos usa también el bloque legal del sitio web."
                                  class="form-input w-full text-sm">${textoLargo}</textarea>
                    </div>
                </div>
            </div>
        </details>
    </td>
</tr>`;
}

function _readPromo(wrap) {
    const activa = !!wrap.querySelector('[data-field="promo-activa"]')?.checked;
    const tipo = wrap.querySelector('[data-field="promo-tipo"]')?.value === 'monto_fijo' ? 'monto_fijo' : 'porcentaje';
    const pct = parseFloat(wrap.querySelector('[data-field="promo-pct"]')?.value);
    const monto = parseFloat(wrap.querySelector('[data-field="promo-monto"]')?.value);
    const minNoches = Math.max(1, parseInt(wrap.querySelector('[data-field="promo-min-noches"]')?.value, 10) || 1);
    const etiqueta = String(wrap.querySelector('[data-field="promo-etiqueta"]')?.value || '').trim().slice(0, 40);
    const estanciaFechaDesde = wrap.querySelector('[data-field="promo-ed"]')?.value || null;
    const estanciaFechaHasta = wrap.querySelector('[data-field="promo-eh"]')?.value || null;
    const fechaReservaDesde = wrap.querySelector('[data-field="promo-rd"]')?.value || null;
    const fechaReservaHasta = wrap.querySelector('[data-field="promo-rh"]')?.value || null;

    const promo = {
        activa,
        tipoDescuento: tipo,
        porcentajeDescuento: tipo === 'porcentaje' && Number.isFinite(pct) ? Math.min(90, Math.max(0, pct)) : 0,
        montoFijoDescuento: tipo === 'monto_fijo' && Number.isFinite(monto) ? Math.max(0, monto) : 0,
        minNoches,
        etiqueta: etiqueta || 'Oferta',
    };
    if (estanciaFechaDesde) promo.estanciaFechaDesde = estanciaFechaDesde;
    if (estanciaFechaHasta) promo.estanciaFechaHasta = estanciaFechaHasta;
    if (fechaReservaDesde) promo.fechaReservaDesde = fechaReservaDesde;
    if (fechaReservaHasta) promo.fechaReservaHasta = fechaReservaHasta;

    if (!activa || (promo.porcentajeDescuento <= 0 && promo.montoFijoDescuento <= 0)) {
        return { activa: false, porcentajeDescuento: 0, montoFijoDescuento: 0, tipoDescuento: 'porcentaje', minNoches: 1, etiqueta: 'Oferta' };
    }
    return promo;
}

function _readPolitica(wrap) {
    const modo = String(wrap.querySelector('[data-field="pc-modo"]')?.value || 'inherit').toLowerCase();
    const horas = Math.round(parseFloat(wrap.querySelector('[data-field="pc-horas"]')?.value));
    const texto = String(wrap.querySelector('[data-field="pc-texto"]')?.value || '').trim().slice(0, 2000);

    if (!modo || modo === 'inherit' || modo === 'empresa' || modo === 'default') {
        return { modo: 'inherit' };
    }
    const out = { modo };
    if (modo === 'gratis_hasta_horas' && Number.isFinite(horas) && horas >= 1 && horas <= 8760) {
        out.horasGratis = horas;
    }
    if (texto) out.politicaCancelacionTexto = texto;
    return out;
}

/**
 * @param {HTMLElement} tbody
 * @param {string} propiedadId
 * @returns {Record<string, unknown>}
 */
export function collectTarifaMetadataFromRow(tbody, propiedadId) {
    const wrap = tbody.querySelector(`tr.tarifa-advanced[data-advanced-for="${propiedadId}"]`);
    if (!wrap) return {};

    const nombre = String(wrap.querySelector('[data-field="nombre-web"]')?.value || '').trim().slice(0, 120);
    const promo = _readPromo(wrap);
    const politicaCancelacion = _readPolitica(wrap);

    const meta = {};
    if (nombre) meta.nombre = nombre;
    else meta.nombre = '';

    const promoOff = promo.activa === false && (!promo.porcentajeDescuento || promo.porcentajeDescuento <= 0)
        && (!promo.montoFijoDescuento || promo.montoFijoDescuento <= 0);
    if (!promoOff) meta.promo = promo;
    else meta.promo = { activa: false, porcentajeDescuento: 0, montoFijoDescuento: 0, tipoDescuento: 'porcentaje', minNoches: 1 };

    if (politicaCancelacion.modo && politicaCancelacion.modo !== 'inherit') {
        meta.politicaCancelacion = politicaCancelacion;
    } else {
        meta.politicaCancelacion = { modo: 'inherit' };
    }

    return meta;
}

/**
 * Muestra u oculta el bloque de horas según modo de política.
 * @param {HTMLElement} tbody
 */
export function bindPoliticaModoVisibility(tbody) {
    if (!tbody || tbody.dataset.pcModoBound === '1') return;
    tbody.dataset.pcModoBound = '1';
    tbody.addEventListener('change', (e) => {
        const sel = e.target.closest('[data-field="pc-modo"]');
        if (!sel) return;
        const tr = sel.closest('tr.tarifa-advanced');
        const wrap = tr?.querySelector('[data-pc-horas-wrap]');
        if (!wrap) return;
        wrap.classList.toggle('hidden', sel.value !== 'gratis_hasta_horas');
    });
}
