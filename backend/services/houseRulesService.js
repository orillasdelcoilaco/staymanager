/**
 * Normas / reglas del alojamiento (SPA + persistencia para uso futuro en SSR).
 * Empresa: configuracion.websiteSettings.houseRules
 * Propiedad: metadata.normasAlojamiento
 */

const TRISTATE = new Set(['si', 'no', 'bajo_consulta']);
const FUMAR = new Set(['si', 'no', 'solo_exterior']);

const ITEM_KEYS = [
    'respetoHogar',
    'juntaToallas',
    'sacaBasura',
    'cierraLlave',
    'descargoObjetosOlvidados',
    'noFiestasEventos',
    'noVisitasNoAutorizadas',
    'apagaLucesAire',
    'lavavajillasLimpio',
    'separacionBasuraReciclaje',
];

const MAX_SHORT = 120;
const MAX_NOTE = 2000;

function clip(s, max) {
    if (typeof s !== 'string') return '';
    const t = s.trim();
    return t.length > max ? t.slice(0, max) : t;
}

function asBool(v, fallback = false) {
    if (v === true || v === false) return v;
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return fallback;
}

function asTristate(v, fallback = 'bajo_consulta') {
    if (typeof v === 'string' && TRISTATE.has(v)) return v;
    return fallback;
}

function asFumar(v, fallback = 'no') {
    if (typeof v === 'string' && FUMAR.has(v)) return v;
    return fallback;
}

function emptyItems() {
    const o = {};
    ITEM_KEYS.forEach((k) => { o[k] = false; });
    return o;
}

/** Objeto canónico listo para guardar */
function emptyHouseRules() {
    return {
        admiteMascotas: 'bajo_consulta',
        permiteFumar: 'no',
        horaEntrada: '',
        horaSalida: '',
        llegadaAutonomaNota: '',
        horasSilencioInicio: '',
        horasSilencioFin: '',
        maxHuespedes: null,
        fotografiaComercialAutorizada: false,
        items: emptyItems(),
        textoAdicional: '',
    };
}

/**
 * @param {unknown} input
 * @param {object} [base] — resultado previo para merge superficial de `items`
 */
function sanitizeHouseRules(input, base = null) {
    const out = emptyHouseRules();
    const prev = base && typeof base === 'object' ? base : null;
    if (prev) {
        out.admiteMascotas = asTristate(prev.admiteMascotas, out.admiteMascotas);
        out.permiteFumar = asFumar(prev.permiteFumar, out.permiteFumar);
        out.horaEntrada = clip(prev.horaEntrada, 16);
        out.horaSalida = clip(prev.horaSalida, 16);
        out.llegadaAutonomaNota = clip(prev.llegadaAutonomaNota, MAX_SHORT);
        out.horasSilencioInicio = clip(prev.horasSilencioInicio, 16);
        out.horasSilencioFin = clip(prev.horasSilencioFin, 16);
        if (prev.maxHuespedes != null && Number.isFinite(Number(prev.maxHuespedes))) {
            const n = Math.max(1, Math.min(999, Math.floor(Number(prev.maxHuespedes))));
            out.maxHuespedes = n;
        }
        out.fotografiaComercialAutorizada = asBool(prev.fotografiaComercialAutorizada, false);
        out.textoAdicional = clip(prev.textoAdicional, MAX_NOTE);
        const pi = prev.items && typeof prev.items === 'object' ? prev.items : {};
        ITEM_KEYS.forEach((k) => { out.items[k] = asBool(pi[k], false); });
    }

    if (!input || typeof input !== 'object') return out;

    if (input.admiteMascotas !== undefined) out.admiteMascotas = asTristate(input.admiteMascotas, out.admiteMascotas);
    if (input.permiteFumar !== undefined) out.permiteFumar = asFumar(input.permiteFumar, out.permiteFumar);
    if (input.horaEntrada !== undefined) out.horaEntrada = clip(input.horaEntrada, 16);
    if (input.horaSalida !== undefined) out.horaSalida = clip(input.horaSalida, 16);
    if (input.llegadaAutonomaNota !== undefined) out.llegadaAutonomaNota = clip(input.llegadaAutonomaNota, MAX_SHORT);
    if (input.horasSilencioInicio !== undefined) out.horasSilencioInicio = clip(input.horasSilencioInicio, 16);
    if (input.horasSilencioFin !== undefined) out.horasSilencioFin = clip(input.horasSilencioFin, 16);
    if (input.maxHuespedes !== undefined) {
        if (input.maxHuespedes === null || input.maxHuespedes === '') {
            out.maxHuespedes = null;
        } else if (Number.isFinite(Number(input.maxHuespedes))) {
            const n = Math.max(1, Math.min(999, Math.floor(Number(input.maxHuespedes))));
            out.maxHuespedes = n;
        }
    }
    if (input.fotografiaComercialAutorizada !== undefined) {
        out.fotografiaComercialAutorizada = asBool(input.fotografiaComercialAutorizada, false);
    }
    if (input.textoAdicional !== undefined) out.textoAdicional = clip(input.textoAdicional, MAX_NOTE);

    if (input.items && typeof input.items === 'object') {
        ITEM_KEYS.forEach((k) => {
            if (input.items[k] !== undefined) out.items[k] = asBool(input.items[k], out.items[k]);
        });
    }

    return out;
}

/** Reglas efectivas: defectos de empresa y luego override por propiedad. */
function mergeEffectiveRules(empresaDefaults, propiedadNormas) {
    const emp = sanitizeHouseRules(empresaDefaults || {});
    return sanitizeHouseRules(propiedadNormas || {}, emp);
}

const ITEM_LABEL_PUBLIC = {
    respetoHogar: 'Trata el alojamiento con cuidado y respeto.',
    juntaToallas: 'Junta las toallas usadas.',
    sacaBasura: 'Saca la basura según indicaciones.',
    cierraLlave: 'Cierra con llave al salir.',
    descargoObjetosOlvidados: 'Revisa pertenencias; política sobre objetos olvidados.',
    noFiestasEventos: 'No fiestas ni eventos.',
    noVisitasNoAutorizadas: 'No visitas no autorizadas.',
    apagaLucesAire: 'Apaga luces y climatización al salir.',
    lavavajillasLimpio: 'Deja la cocina / lavavajillas en orden.',
    separacionBasuraReciclaje: 'Separa basura o reciclaje según indicaciones.',
};

/** "16:00" → "4:00 p.m." (es-CL estilo compacto) */
function formatHourEsAmpm(horaStr) {
    if (!horaStr || typeof horaStr !== 'string') return '';
    const m = horaStr.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return horaStr.trim();
    let h = parseInt(m[1], 10);
    const min = m[2];
    const isPm = h >= 12;
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${min} ${isPm ? 'p.m.' : 'a.m.'}`;
}

/**
 * Vista lista para SSR (ficha pública): resumen + secciones para modal.
 * @param {object} merged — resultado de mergeEffectiveRules
 * @param {number} capacidadPropiedad
 */
function buildHouseRulesPublicView(merged, capacidadPropiedad) {
    const r = sanitizeHouseRules(merged || {});
    const capBase = Number(capacidadPropiedad) > 0 ? Math.floor(Number(capacidadPropiedad)) : 0;
    const cap = r.maxHuespedes != null && r.maxHuespedes > 0 ? r.maxHuespedes : capBase;

    const sumLine1 = r.horaEntrada
        ? `Llegada a partir de las ${formatHourEsAmpm(r.horaEntrada)}`
        : 'Llegada: coordina con el anfitrión';
    const sumLine2 = r.horaSalida
        ? `Salida antes de las ${formatHourEsAmpm(r.horaSalida)}`
        : 'Salida: coordina con el anfitrión';
    const sumLine3 = cap > 0
        ? `${cap} huésped${cap !== 1 ? 'es' : ''} como máximo`
        : (capBase > 0 ? `${capBase} huésped${capBase !== 1 ? 'es' : ''} como máximo` : 'Capacidad según publicación');

    const secciones = [];

    const llegadaRows = [];
    if (r.horaEntrada) {
        llegadaRows.push({ icon: 'fa-clock', text: `Llegada a partir de las ${formatHourEsAmpm(r.horaEntrada)}` });
    }
    if (r.horaSalida) {
        llegadaRows.push({ icon: 'fa-clock', text: `Salida antes de las ${formatHourEsAmpm(r.horaSalida)}` });
    }
    if (r.llegadaAutonomaNota) {
        llegadaRows.push({ icon: 'fa-key', text: r.llegadaAutonomaNota });
    }
    if (llegadaRows.length) {
        secciones.push({ titulo: 'Llegada y salida', rows: llegadaRows });
    }

    const durante = [];
    if (cap > 0) durante.push({ icon: 'fa-users', text: `${cap} huéspedes como máximo` });
    if (r.admiteMascotas === 'si') durante.push({ icon: 'fa-paw', text: 'Se admiten mascotas' });
    else if (r.admiteMascotas === 'no') durante.push({ icon: 'fa-paw', text: 'No se admiten mascotas' });
    else durante.push({ icon: 'fa-paw', text: 'Mascotas: consultar con el anfitrión' });

    if (r.horasSilencioInicio && r.horasSilencioFin) {
        durante.push({
            icon: 'fa-moon',
            text: `Horas de silencio: ${formatHourEsAmpm(r.horasSilencioInicio)} - ${formatHourEsAmpm(r.horasSilencioFin)}`,
        });
    }

    if (r.fotografiaComercialAutorizada) {
        durante.push({ icon: 'fa-camera', text: 'Fotografía comercial autorizada' });
    } else {
        durante.push({ icon: 'fa-camera', text: 'Fotografía comercial no autorizada' });
    }

    if (r.permiteFumar === 'no') durante.push({ icon: 'fa-ban', text: 'Prohibido fumar' });
    else if (r.permiteFumar === 'solo_exterior') {
        durante.push({ icon: 'fa-smoking', text: 'Fumar solo en exterior / zonas señaladas' });
    } else {
        durante.push({ icon: 'fa-smoking', text: 'Se permite fumar' });
    }

    secciones.push({ titulo: 'Durante tu estancia', rows: durante });

    const antesRows = [];
    ITEM_KEYS.forEach((key) => {
        if (r.items && r.items[key]) {
            const text = ITEM_LABEL_PUBLIC[key];
            if (text) antesRows.push({ icon: 'fa-check', text });
        }
    });
    if (antesRows.length) {
        secciones.push({ titulo: 'Antes de que te vayas', rows: antesRows });
    }

    if (r.textoAdicional && r.textoAdicional.trim()) {
        secciones.push({ titulo: 'Solicitudes adicionales', paragraphs: r.textoAdicional.split(/\n+/).map((p) => p.trim()).filter(Boolean) });
    }

    const maxHuespedesUI = cap > 0 ? cap : (capBase > 0 ? capBase : 0);

    return {
        sumLine1,
        sumLine2,
        sumLine3,
        secciones,
        intro: 'Te hospedarás en el alojamiento de otra persona, así que trátalo con cuidado y respeto.',
        /** Para la columna «Normas de la casa» (formato 24 h como el resto de la ficha) */
        horaEntrada24: r.horaEntrada ? r.horaEntrada : null,
        horaSalida24: r.horaSalida ? r.horaSalida : null,
        maxHuespedesUI,
    };
}

module.exports = {
    emptyHouseRules,
    sanitizeHouseRules,
    mergeEffectiveRules,
    buildHouseRulesPublicView,
    ITEM_KEYS,
};
