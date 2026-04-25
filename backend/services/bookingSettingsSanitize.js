/**
 * Normaliza y valida `websiteSettings.booking` en PUT home-settings (panel unificado).
 * Mantiene claves desconocidas; ajusta rangos numéricos y rechaza min/max noches incoherentes.
 * Retención PII identidad check-in: `checkinIdentidadRetencionAutomaticaActivo`, `checkinIdentidadRetencionDiasTrasCheckout` (1–730, por defecto 90).
 */
const { sanitizeHeatmapEventosDemanda } = require('./heatmapRestriccionesService');

function _clampInt(n, min, max, fallback) {
    const v = parseInt(String(n ?? ''), 10);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, v));
}

function _trimUrl(s) {
    const t = String(s || '').trim();
    if (!t) return '';
    try {
        const u = new URL(t);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
        return t;
    } catch {
        return '';
    }
}

function _sanitizeHtmlLite(s) {
    const raw = String(s || '');
    return raw
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
}

/**
 * @param {object} incoming cuerpo `booking` del cliente
 * @returns {{ ok: true, booking: object } | { ok: false, errors: string[] }}
 */
function sanitizeBookingSettingsIncoming(incoming) {
    const errors = [];
    if (incoming == null || typeof incoming !== 'object') {
        return { ok: true, booking: {} };
    }
    const b = { ...incoming };

    b.minNoches = _clampInt(b.minNoches, 1, 365, 1);
    b.maxNochesEstadia = _clampInt(b.maxNochesEstadia, 0, 365, 0);
    b.minDiasAnticipacionReserva = _clampInt(b.minDiasAnticipacionReserva, 0, 365, 0);
    b.mesesReservableAdelante = _clampInt(b.mesesReservableAdelante, 0, 120, 0);
    b.menoresMax = _clampInt(b.menoresMax, 0, 20, 6);
    b.camasExtraMax = _clampInt(b.camasExtraMax, 0, 10, 4);
    b.depositoMontoSugeridoCLP = Math.max(0, _clampInt(b.depositoMontoSugeridoCLP, 0, 999999999, 0));
    b.depositoPorcentaje = _clampInt(b.depositoPorcentaje, 1, 100, 10);
    b.depositoHorasLimite = _clampInt(b.depositoHorasLimite ?? b.abonoHorasLimite, 1, 168, 48);
    b.abonoHorasLimite = b.depositoHorasLimite;
    b.recargoMenorNocheCLP = Math.max(0, _clampInt(b.recargoMenorNocheCLP, 0, 999999999, 0));
    b.recargoCamaExtraNocheCLP = Math.max(0, _clampInt(b.recargoCamaExtraNocheCLP, 0, 999999999, 0));
    b.depositoTipo = b.depositoTipo === 'monto_fijo' ? 'monto_fijo' : 'porcentaje';
    const modosGarantia = new Set(['sin_garantia', 'abono_manual', 'preautorizacion_externa']);
    b.garantiaModo = modosGarantia.has(String(b.garantiaModo || '').trim())
        ? String(b.garantiaModo).trim()
        : 'abono_manual';
    b.garantiaDetalleOperacion = String(b.garantiaDetalleOperacion || '').trim().slice(0, 280);

    if (typeof b.solicitudMenoresCamasActivo === 'boolean') {
        /* ok */
    } else if (b.solicitudMenoresCamasActivo != null) {
        b.solicitudMenoresCamasActivo = !!b.solicitudMenoresCamasActivo;
    }

    if (typeof b.depositoActivo === 'boolean') {
        /* ok */
    } else if (b.depositoActivo != null) {
        b.depositoActivo = !!b.depositoActivo;
    }

    if (typeof b.checkinIdentidadRetencionAutomaticaActivo === 'boolean') {
        /* ok */
    } else if (b.checkinIdentidadRetencionAutomaticaActivo != null) {
        b.checkinIdentidadRetencionAutomaticaActivo = !!b.checkinIdentidadRetencionAutomaticaActivo;
    }

    if (typeof b.checkinIdentidadCoHuespedesActivo === 'boolean') {
        /* ok */
    } else if (b.checkinIdentidadCoHuespedesActivo != null) {
        b.checkinIdentidadCoHuespedesActivo = !!b.checkinIdentidadCoHuespedesActivo;
    }

    if (typeof b.checkinHoraEstimadaLlegadaActivo === 'boolean') {
        /* ok */
    } else if (b.checkinHoraEstimadaLlegadaActivo != null) {
        b.checkinHoraEstimadaLlegadaActivo = !!b.checkinHoraEstimadaLlegadaActivo;
    }
    b.checkinIdentidadRetencionDiasTrasCheckout = _clampInt(
        b.checkinIdentidadRetencionDiasTrasCheckout,
        1,
        730,
        90,
    );

    // Vacía URLs inválidas (no 400): el panel puede traer borradores; SSR no enlaza si queda ''.
    b.checkinOnlineUrl = _trimUrl(b.checkinOnlineUrl);
    b.manualHuespedUrl = _trimUrl(b.manualHuespedUrl);
    b.manualHuespedPdfUrl = _trimUrl(b.manualHuespedPdfUrl);

    if (typeof b.depositoNotaHtml === 'string' && b.depositoNotaHtml.length > 20000) {
        b.depositoNotaHtml = b.depositoNotaHtml.slice(0, 20000);
    }

    // Mapa de calor / eventos de demanda (SSR público): reglas suaves por fecha.
    b.eventosDemandaMapaCalor = sanitizeHeatmapEventosDemanda(b.eventosDemandaMapaCalor);
    if (typeof b.depositoNotaHtml === 'string') {
        b.depositoNotaHtml = _sanitizeHtmlLite(b.depositoNotaHtml);
    }

    const mascotasModes = new Set(['permitidas', 'no_permitidas', 'consultar_siempre', 'auto']);
    const mascotasMode = String(b.chatgptMascotasPolicyMode || '').trim();
    b.chatgptMascotasPolicyMode = mascotasModes.has(mascotasMode) ? mascotasMode : 'auto';
    if (typeof b.chatgptMascotasCondicion === 'string') {
        b.chatgptMascotasCondicion = b.chatgptMascotasCondicion.trim().slice(0, 280);
    } else {
        b.chatgptMascotasCondicion = '';
    }

    const maxN = b.maxNochesEstadia;
    const minN = b.minNoches;
    if (maxN > 0 && maxN < minN) {
        errors.push(
            `Estadía máxima (${maxN} noche(s)) no puede ser menor que la mínima (${minN}). Ajusta los campos y vuelve a guardar.`,
        );
    }

    if (errors.length) return { ok: false, errors };
    return { ok: true, booking: b };
}

/** Misma validación que al persistir `booking`: solo http(s) para enlaces SSR/correo. */
function normalizeBookingUrlForSsr(s) {
    return _trimUrl(s);
}

module.exports = { sanitizeBookingSettingsIncoming, normalizeBookingUrlForSsr };
