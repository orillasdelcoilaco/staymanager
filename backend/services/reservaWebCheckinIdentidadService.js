/**
 * Normaliza datos de identidad del huésped principal y opcionalmente co-huéspedes (checkout web).
 * Principal: `metadata.reservaWebCheckout.checkInIdentidad`.
 * Co-huéspedes (si `booking.checkinIdentidadCoHuespedesActivo` y `personas` > 1):
 * `metadata.reservaWebCheckout.checkInIdentidadAcompanantes` (array del mismo shape, sin PII en titular duplicado obligatorio).
 * Consentimiento único `checkInIdentidadAceptacion` cubre principal + acompañantes.
 * Tras borrado desde panel: `checkInIdentidadEliminacion` (auditoría).
 *
 * **Datos sensibles adicionales del checkout web** (misma retención/borrado que identidad vía
 * `tienePiiCheckInIdentidadEnMetadata` / `metadataTrasEliminarPiiCheckinIdentidad`): hora estimada de llegada,
 * medio de llegada, referencia de transporte, ref. viajero y comentarios del huésped (`reservaWebCheckout.*`).
 */

const TIPOS_DOC = new Set(['rut', 'pasaporte', 'dni_otro']);

/** Texto libre / contexto de llegada en checkout web; se borran con el mismo flujo que identidad. */
const CAMPOS_LLEGADA_CHECKOUT_WEB_SENSIBLES = [
    'horaLlegadaEstimada',
    'medioLlegada',
    'referenciaTransporte',
    'documentoRefViajero',
    'comentariosHuesped',
];


/** Versión de la política / copy de consentimiento (auditoría en metadata). */
const CHECKIN_IDENTIDAD_POLITICA_VERSION = 'checkin-identidad-v1';

/** Igual que términos: checkbox enviado vía FormData / JSON. */
function aceptaCheckboxIdentidad(raw) {
    const v = raw;
    return v === true || v === 'true' || v === '1' || v === 'on' || v === 1;
}

/**
 * Lanza Error con `statusCode` 400 si hay identidad persistible y falta consentimiento explícito.
 * @param {object|null} checkInIdentidad resultado de `normalizarCheckInIdentidadCheckoutWeb`
 * @param {unknown} rawAceptacion valor de `datosFormulario.aceptoDatosIdentidadCheckin`
 * @param {'es'|'en'} hl idioma del sitio (mensaje de error)
 * @param {object[]|null} [checkInIdentidadAcompanantes] filas normalizadas de co-huéspedes
 */
function assertConsentIdentidadCheckinWeb(checkInIdentidad, rawAceptacion, hl, checkInIdentidadAcompanantes = null) {
    const acc = Array.isArray(checkInIdentidadAcompanantes) ? checkInIdentidadAcompanantes : [];
    if (!checkInIdentidad && !acc.length) return;
    if (aceptaCheckboxIdentidad(rawAceptacion)) return;
    const err = new Error(hl === 'en'
        ? 'You must consent to the processing of identity data for check-in to complete your booking.'
        : 'Debes aceptar el tratamiento de los datos de identidad para check-in para completar la reserva.');
    err.statusCode = 400;
    throw err;
}

/** Registro para `metadata.reservaWebCheckout.checkInIdentidadAceptacion`. */
function snapshotCheckInIdentidadAceptacion(at = new Date()) {
    return {
        aceptadoAt: at.toISOString(),
        politicaVersion: CHECKIN_IDENTIDAD_POLITICA_VERSION,
    };
}

function _trimMax(s, max) {
    return String(s ?? '').trim().slice(0, max);
}

function _sanitizeDocumentoNumero(tipo, raw) {
    const t = String(tipo || '').toLowerCase();
    let s = _trimMax(raw, 40);
    if (t === 'rut') {
        s = s.replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
        if (s.length > 20) s = s.slice(0, 20);
        return s;
    }
    if (t === 'pasaporte' || t === 'dni_otro') {
        s = s.replace(/\s+/g, ' ').trim();
        if (s.length > 40) s = s.slice(0, 40);
        return s;
    }
    return '';
}

function _nacionalidad(raw) {
    const u = _trimMax(raw, 50).toUpperCase();
    if (!u) return '';
    if (/^[A-Z]{2,3}$/.test(u)) return u;
    return _trimMax(raw, 50);
}

function _fechaNacimiento(raw) {
    const s = _trimMax(raw, 12);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
    const d = new Date(`${s}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d > now) return '';
    const min = new Date();
    min.setUTCFullYear(min.getUTCFullYear() - 120);
    if (d < min) return '';
    return s;
}

/**
 * @param {object} form datosFormulario de `crearReservaPublica`
 * @returns {object|null} objeto compacto o null si no hay datos útiles
 */
function normalizarCheckInIdentidadCheckoutWeb(form) {
    if (!form || typeof form !== 'object') return null;
    const rutLegacy = _trimMax(form.rut, 20).replace(/\./g, '').toUpperCase();
    let tipo = String(form.documentoTipo || '').trim().toLowerCase();
    let numero = _sanitizeDocumentoNumero(tipo || 'pasaporte', form.documentoNumero);

    if (!tipo) {
        if (rutLegacy) {
            tipo = 'rut';
            numero = _sanitizeDocumentoNumero('rut', rutLegacy);
        } else if (numero) {
            tipo = 'pasaporte';
        }
    } else if (tipo === 'rut' && !numero && rutLegacy) {
        numero = _sanitizeDocumentoNumero('rut', rutLegacy);
    }

    if (!TIPOS_DOC.has(tipo)) return null;
    if (!numero) return null;

    const nacionalidad = _nacionalidad(form.nacionalidadHuesped);
    const fechaNacimiento = _fechaNacimiento(form.fechaNacimientoHuesped);
    return {
        documentoTipo: tipo,
        documentoNumero: numero,
        ...(nacionalidad ? { nacionalidad } : {}),
        ...(fechaNacimiento ? { fechaNacimiento } : {}),
    };
}

/**
 * Co-huéspedes: solo si `bkWeb.checkinIdentidadCoHuespedesActivo` y cupos según `personas`.
 * Acepta `form.checkInIdentidadAcompanantes` como array de objetos o JSON en string.
 * @param {object} form
 * @param {object} bkWeb `websiteSettings.booking`
 * @param {number} personasInt huéspedes totales de la reserva
 * @param {'es'|'en'} hl
 * @returns {object[]}
 */
function normalizarCheckInIdentidadAcompanantes(form, bkWeb, personasInt, hl) {
    if (!bkWeb || !bkWeb.checkinIdentidadCoHuespedesActivo) return [];
    const maxSlots = Math.min(15, Math.max(0, personasInt - 1));
    if (maxSlots <= 0) return [];

    let rawList = form && typeof form === 'object' ? form.checkInIdentidadAcompanantes : null;
    if (typeof rawList === 'string') {
        try {
            rawList = JSON.parse(rawList);
        } catch {
            rawList = [];
        }
    }
    if (!Array.isArray(rawList)) rawList = [];

    if (rawList.length > maxSlots) {
        const err = new Error(hl === 'en'
            ? `At most ${maxSlots} additional guest identity entries are allowed for this booking.`
            : `Se permiten como máximo ${maxSlots} identidades de acompañantes para esta reserva.`);
        err.statusCode = 400;
        throw err;
    }

    const out = [];
    for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        if (!item || typeof item !== 'object') continue;
        const normalized = normalizarCheckInIdentidadCheckoutWeb({
            documentoTipo: item.documentoTipo,
            documentoNumero: item.documentoNumero,
            rut: item.rut,
            nacionalidadHuesped: item.nacionalidadHuesped,
            fechaNacimientoHuesped: item.fechaNacimientoHuesped,
        });
        if (!normalized) {
            const hasAny = ['documentoTipo', 'documentoNumero', 'rut', 'nacionalidadHuesped', 'fechaNacimientoHuesped']
                .some((k) => String(item[k] ?? '').trim());
            if (hasAny) {
                const err = new Error(hl === 'en'
                    ? `Additional guest #${i + 1}: enter a valid ID type and number, or clear all fields for that guest.`
                    : `Acompañante #${i + 1}: indica tipo y número de documento válidos, o deja todos los campos vacíos para ese huésped.`);
                err.statusCode = 400;
                throw err;
            }
            continue;
        }
        out.push(normalized);
    }
    return out;
}

/** Para UI pública: enmascara número de documento. */
function enmascararDocumentoParaUiPublica(numero) {
    const n = String(numero || '').trim();
    if (!n) return '';
    if (n.length <= 4) return '••••';
    return `••••${n.slice(-4)}`;
}

function _filaIdentidadTieneDoc(ci) {
    return !!(ci && typeof ci === 'object' && ci.documentoTipo && ci.documentoNumero);
}

function _tieneTextoLlegadaCheckoutWebSensibles(rwc) {
    if (!rwc || typeof rwc !== 'object') return false;
    return CAMPOS_LLEGADA_CHECKOUT_WEB_SENSIBLES.some((k) => String(rwc[k] ?? '').trim() !== '');
}

/**
 * Identidad check-in web **o** campos de llegada/comentarios del checkout considerados sensibles
 * (retención automática y borrado panel usan la misma condición).
 */
function tienePiiCheckInIdentidadEnMetadata(metadata) {
    const rwc = metadata && typeof metadata === 'object' ? metadata.reservaWebCheckout : null;
    if (!rwc || typeof rwc !== 'object') return false;
    if (_filaIdentidadTieneDoc(rwc.checkInIdentidad)) return true;
    const arr = rwc.checkInIdentidadAcompanantes;
    if (Array.isArray(arr) && arr.some(_filaIdentidadTieneDoc)) return true;
    return _tieneTextoLlegadaCheckoutWebSensibles(rwc);
}

/**
 * Elimina PII de identidad web y conserva auditoría en `reservaWebCheckout.checkInIdentidadEliminacion`.
 * @param {object} metadata metadata actual de la reserva (se clona; no mutar el original del caller).
 * @param {string} [eliminadoPorEmail] usuario que ejecuta la acción (panel) o marca sistema
 * @param {{ motivo?: string, diasPoliticaRetencion?: number }} [opciones] ej. retención automática
 * @returns {{ changed: boolean, metadata: object }}
 */
function metadataTrasEliminarPiiCheckinIdentidad(metadata, eliminadoPorEmail, opciones = {}) {
    const meta = metadata && typeof metadata === 'object' ? JSON.parse(JSON.stringify(metadata)) : {};
    if (!tienePiiCheckInIdentidadEnMetadata(meta)) {
        return { changed: false, metadata: meta };
    }
    const rwcIn = meta.reservaWebCheckout && typeof meta.reservaWebCheckout === 'object'
        ? meta.reservaWebCheckout
        : {};
    const rwc = { ...rwcIn };
    delete rwc.checkInIdentidad;
    delete rwc.checkInIdentidadAcompanantes;
    delete rwc.checkInIdentidadAceptacion;
    for (const k of CAMPOS_LLEGADA_CHECKOUT_WEB_SENSIBLES) {
        if (Object.prototype.hasOwnProperty.call(rwc, k)) delete rwc[k];
    }
    const email = _trimMax(eliminadoPorEmail, 200);
    const motivo = opciones.motivo != null ? _trimMax(opciones.motivo, 80) : '';
    const diasPol = parseInt(String(opciones.diasPoliticaRetencion ?? ''), 10);
    const diasPoliticaOk = Number.isFinite(diasPol) && diasPol > 0 ? Math.min(730, diasPol) : null;
    rwc.checkInIdentidadEliminacion = {
        eliminadoAt: new Date().toISOString(),
        ...(email ? { eliminadoPorEmail: email } : {}),
        ...(motivo ? { eliminadoMotivo: motivo } : {}),
        ...(diasPoliticaOk != null ? { diasPoliticaRetencion: diasPoliticaOk } : {}),
    };
    const ediciones = { ...(meta.edicionesManuales || {}) };
    ediciones['reservaWebCheckout.checkInIdentidad'] = true;
    ediciones['reservaWebCheckout.checkInIdentidadAcompanantes'] = true;
    ediciones['reservaWebCheckout.checkInIdentidadAceptacion'] = true;
    for (const k of CAMPOS_LLEGADA_CHECKOUT_WEB_SENSIBLES) {
        ediciones[`reservaWebCheckout.${k}`] = true;
    }
    meta.reservaWebCheckout = rwc;
    meta.edicionesManuales = ediciones;
    return { changed: true, metadata: meta };
}

/**
 * Sustituye `checkInIdentidad` desde el panel (misma normalización que checkout web).
 * Quita `checkInIdentidadEliminacion` si el huésped vuelve a tener datos tras un borrado.
 * Añade `checkInIdentidadUltimaEdicionPanel` (auditoría; no sustituye consentimiento web del huésped).
 * @param {object} datosFormulario mismo shape que `crearReservaPublica` (documentoTipo, rut, documentoNumero, …)
 */
function metadataTrasActualizarCheckinIdentidadPanel(metadata, datosFormulario, editadoPorEmail) {
    const meta = metadata && typeof metadata === 'object' ? JSON.parse(JSON.stringify(metadata)) : {};
    const checkIn = normalizarCheckInIdentidadCheckoutWeb(datosFormulario);
    if (!checkIn) {
        const err = new Error('Indica tipo y número de documento válidos (o RUT con formato correcto).');
        err.statusCode = 400;
        throw err;
    }
    const rwcIn = meta.reservaWebCheckout && typeof meta.reservaWebCheckout === 'object'
        ? meta.reservaWebCheckout
        : {};
    const rwc = { ...rwcIn };
    delete rwc.checkInIdentidadEliminacion;
    rwc.checkInIdentidad = checkIn;
    const email = _trimMax(editadoPorEmail, 200);
    rwc.checkInIdentidadUltimaEdicionPanel = {
        editadoAt: new Date().toISOString(),
        ...(email ? { editadoPorEmail: email } : {}),
    };
    const ediciones = { ...(meta.edicionesManuales || {}) };
    ediciones['reservaWebCheckout.checkInIdentidad'] = true;
    meta.reservaWebCheckout = rwc;
    meta.edicionesManuales = ediciones;
    return { metadata: meta };
}

module.exports = {
    normalizarCheckInIdentidadCheckoutWeb,
    normalizarCheckInIdentidadAcompanantes,
    enmascararDocumentoParaUiPublica,
    aceptaCheckboxIdentidad,
    assertConsentIdentidadCheckinWeb,
    snapshotCheckInIdentidadAceptacion,
    CHECKIN_IDENTIDAD_POLITICA_VERSION,
    tienePiiCheckInIdentidadEnMetadata,
    metadataTrasEliminarPiiCheckinIdentidad,
    metadataTrasActualizarCheckinIdentidadPanel,
    TIPOS_DOC,
    CAMPOS_LLEGADA_CHECKOUT_WEB_SENSIBLES,
};
