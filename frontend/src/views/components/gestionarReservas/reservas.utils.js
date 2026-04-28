// frontend/src/views/components/gestionarReservas/reservas.utils.js

export const formatDate = (dateString) => {
    if (!dateString) return '-';
    const datePart = dateString.split('T')[0];
    return new Date(datePart + 'T00:00:00Z').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

export const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-CL');
};

export const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

export const formatStars = (rating) => '⭐'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0));

export const formatForeign = (value, currency) => {
    if (!currency || currency === 'CLP') return formatCurrency(value);
    return `${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

export const formatPercent = (value) => {
    if (!value || value === 0) return '0%';
    return `${value.toFixed(1)}%`;
};

/** Texto legible para `metadata.garantiaOperacion.modo` (reserva web). */
export const labelGarantiaOperacionModo = (modo) => {
    const m = String(modo || 'abono_manual').trim();
    if (m === 'sin_garantia') return 'Sin garantía previa';
    if (m === 'preautorizacion_externa') return 'Preautorización externa (sin pasarela integrada)';
    return 'Abono manual';
};

/** Texto legible para `metadata.garantiaOperacion.estadoOperacion` (operación interna). */
export const labelGarantiaOperacionEstado = (estado) => {
    const s = String(estado || 'pendiente_garantia').trim();
    if (s === 'garantia_validada') return 'Garantía validada';
    if (s === 'garantia_rechazada') return 'Garantía rechazada';
    return 'Pendiente de garantía';
};

function _escAttr(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

/**
 * Bloque HTML de solo lectura para política de garantía al confirmar reserva web.
 * @param {object|null|undefined} go metadata.garantiaOperacion
 * @returns {string} cadena vacía si no hay datos útiles
 */
export function buildGarantiaOperacionReadonlyHtml(go) {
    if (!go || typeof go !== 'object') return '';
    const modo = String(go.modo || 'abono_manual').trim();
    const detalle = String(go.detalle || '').trim();
    const registrada = go.registradaEnCheckoutAt ? formatDateTime(go.registradaEnCheckoutAt) : '';
    const estadoOperacion = String(go.estadoOperacion || 'pendiente_garantia').trim();
    const estadoOperacionTxt = labelGarantiaOperacionEstado(estadoOperacion);
    const estadoOperacionAt = go.estadoOperacionUpdatedAt ? formatDateTime(go.estadoOperacionUpdatedAt) : '';
    const estadoOperacionNota = String(go.estadoOperacionNota || '').trim();
    const titulo = 'Política de garantía (web)';
    const modoTxt = labelGarantiaOperacionModo(modo);
    return `
        <div class="text-xs text-gray-700 border border-gray-200 rounded-md p-3 bg-gray-50">
            <p class="font-semibold text-gray-800 mb-1">${_escAttr(titulo)}</p>
            <p class="text-gray-800">${_escAttr(modoTxt)}</p>
            <p class="text-gray-800 mt-1"><span class="font-semibold">Estado operativo:</span> ${_escAttr(estadoOperacionTxt)}</p>
            ${detalle ? `<p class="text-gray-600 mt-1 whitespace-pre-wrap">${_escAttr(detalle)}</p>` : ''}
            ${registrada ? `<p class="text-gray-500 mt-2">${_escAttr(`Registrada en checkout: ${registrada}`)}</p>` : ''}
            ${estadoOperacionAt ? `<p class="text-gray-500 mt-1">${_escAttr(`Estado actualizado: ${estadoOperacionAt}`)}</p>` : ''}
            ${estadoOperacionNota ? `<p class="text-gray-600 mt-1 whitespace-pre-wrap">${_escAttr(`Nota operación: ${estadoOperacionNota}`)}</p>` : ''}
        </div>`.trim();
}