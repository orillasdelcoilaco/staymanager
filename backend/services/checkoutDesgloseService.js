/**
 * Desglose de precio en checkout público (§4 — impuestos / tasas configurables).
 * Config: websiteSettings.legal.desglosePrecioCheckout
 *
 * Aviso cancelación (resumen): websiteSettings.legal.politicaCancelacionModo,
 * politicaCancelacionHorasGratis
 */

const { TIPOS_LINEA_EXTRA, sanitizeLineaExtraDef } = require('./lineasExtraValidation');

const DEFAULT_DESGLOSE = Object.freeze({
    mostrar: true,
    modelo: 'cl_iva_incluido',
    tasaIvaPct: 19,
    notaDebajo: '',
    notaPie: '',
    lineasExtra: [],
});

function _etiquetaIdioma(def, en) {
    const a = def.etiquetaEn && String(def.etiquetaEn).trim();
    const b = def.etiqueta && String(def.etiqueta).trim();
    if (en && a) return a;
    return b || a || 'Cargo';
}

/**
 * @param {object} def — definición sanitizada
 * @param {number} T
 * @param {number} netoCLP
 * @param {number} noches
 * @param {number} [huespedes] — huéspedes para `por_persona_noche` (mín. 1)
 * @returns {number}
 */
function calcularMontoLineaExtra(def, T, netoCLP, noches, huespedes = 1) {
    const n = Math.max(0, Math.round(Number(noches) || 0));
    const h = Math.max(1, Math.round(Number(huespedes) || 1));
    if (def.tipo === 'porcentaje_total') {
        return Math.round(T * (def.porcentaje / 100));
    }
    if (def.tipo === 'porcentaje_neto') {
        return Math.round(Math.max(0, netoCLP) * (def.porcentaje / 100));
    }
    if (def.tipo === 'monto_fijo') {
        return def.montoCLP;
    }
    if (def.tipo === 'por_noche') {
        return def.montoPorNocheCLP * n;
    }
    if (def.tipo === 'por_persona_noche') {
        return def.montoPorPersonaNocheCLP * h * n;
    }
    return 0;
}

/**
 * @param {Array<object>} defs
 * @param {number} T
 * @param {number} netoCLP
 * @param {number} noches
 * @param {string} htmlLang
 * @param {number} [huespedes]
 * @returns {{ etiqueta: string, montoCLP: number, tipo: string }[]}
 */
function buildLineasExtraResueltas(defs, T, netoCLP, noches, htmlLang, huespedes = 1) {
    if (!Array.isArray(defs) || !defs.length) return [];
    const en = String(htmlLang || '').toLowerCase().startsWith('en');
    const out = [];
    for (const def of defs) {
        const monto = calcularMontoLineaExtra(def, T, netoCLP, noches, huespedes);
        if (monto <= 0) continue;
        out.push({
            key: `extra_${def.tipo}_${out.length}`,
            etiqueta: _etiquetaIdioma(def, en),
            montoCLP: monto,
            esExtra: true,
        });
    }
    return out;
}

/**
 * @param {object|null|undefined} legal — websiteSettings.legal
 */
function normalizeDesglosePrecioCheckoutConfig(legal) {
    const raw = legal && typeof legal === 'object' ? legal.desglosePrecioCheckout : null;
    const o = raw && typeof raw === 'object' ? raw : {};
    const mostrar = o.mostrar !== false;
    const modelo = o.modelo === 'sin_desglose' ? 'sin_desglose' : 'cl_iva_incluido';
    const tasaIvaPct = Math.min(50, Math.max(0, Number(o.tasaIvaPct) || 19));
    const notaDebajo = o.notaDebajo != null ? String(o.notaDebajo).trim() : '';
    const notaPie = o.notaPie != null ? String(o.notaPie).trim() : '';
    const rawExtras = Array.isArray(o.lineasExtra) ? o.lineasExtra : [];
    const lineasExtra = rawExtras.map(sanitizeLineaExtraDef).filter(Boolean);
    return { ...DEFAULT_DESGLOSE, mostrar, modelo, tasaIvaPct, notaDebajo, notaPie, lineasExtra };
}

/**
 * @param {number|string} totalCLP
 * @param {object|null|undefined} legal
 * @param {string} [htmlLang]
 * @param {{ noches?: number }} [opts]
 */
function buildDesglosePrecioCheckout(totalCLP, legal, htmlLang = 'es', opts = {}) {
    const cfg = normalizeDesglosePrecioCheckoutConfig(legal || {});
    const T = Math.round(Number(totalCLP) || 0);
    const noches = Math.max(0, Math.round(Number(opts.noches) || 0));
    const huespedes = Math.max(1, Math.round(Number(opts.huespedes) || 1));
    const en = String(htmlLang || '').toLowerCase().startsWith('en');

    if (!cfg.mostrar || T <= 0) {
        return { mostrar: false, totalCLP: T, config: cfg };
    }

    const tieneIva = cfg.modelo === 'cl_iva_incluido';
    const tieneExtras = cfg.lineasExtra && cfg.lineasExtra.length > 0;

    if (!tieneIva && !tieneExtras) {
        return { mostrar: false, totalCLP: T, config: cfg };
    }

    let netoCLP = 0;
    let ivaCLP = 0;
    let lineas = [];
    let notaIvaTexto = '';

    if (tieneIva) {
        const pct = cfg.tasaIvaPct || 19;
        const factor = 1 + pct / 100;
        netoCLP = Math.round(T / factor);
        ivaCLP = T - netoCLP;
        const labels = en
            ? {
                neto: 'Accommodation (excl. VAT)',
                iva: `VAT (${pct}%)`,
                notaIva: 'Total includes VAT where applicable.',
            }
            : {
                neto: 'Alojamiento (neto)',
                iva: `IVA (${pct}%)`,
                notaIva: 'El total incluye IVA según corresponda.',
            };
        notaIvaTexto = labels.notaIva;
        lineas = [
            { key: 'neto', etiqueta: labels.neto, montoCLP: netoCLP },
            { key: 'iva', etiqueta: labels.iva, montoCLP: ivaCLP },
        ];
    }

    const baseNetoParaExtra = tieneIva ? netoCLP : T;
    const extrasRes = buildLineasExtraResueltas(cfg.lineasExtra, T, baseNetoParaExtra, noches, htmlLang, huespedes);
    lineas = [...lineas, ...extrasRes];

    let notaPie = cfg.notaPie;
    if (!notaPie && extrasRes.length) {
        notaPie = en
            ? 'Optional lines are calculated from the total shown (or from net amount for "% on net"); use them as a reference unless your pricing already itemizes them.'
            : 'Las líneas opcionales se calculan sobre el total mostrado (o sobre el neto en "% sobre neto"); son referenciales salvo que tu tarifador las desglose explícitamente.';
    }

    return {
        mostrar: true,
        modelo: cfg.modelo,
        tasaIvaPct: cfg.tasaIvaPct,
        totalCLP: T,
        netoCLP: tieneIva ? netoCLP : null,
        ivaCLP: tieneIva ? ivaCLP : null,
        tituloBloque: en ? 'Price breakdown' : 'Desglose de precio',
        notaDebajo: cfg.notaDebajo,
        notaIva: notaIvaTexto,
        notaPie,
        lineas,
        lineasExtraResueltas: extrasRes,
        config: cfg,
    };
}

/**
 * Resumen corto para checkout (no sustituye texto legal HTML).
 * politicaCancelacionModo: texto_solo | gratis_hasta_horas | gratis_ilimitada
 */
function buildAvisoPoliticaCancelacion(legal, htmlLang = 'es') {
    if (!legal || typeof legal !== 'object') return { mostrar: false };
    const modo = String(legal.politicaCancelacionModo || 'texto_solo').trim();
    if (modo === 'texto_solo' || modo === '') return { mostrar: false };
    const en = String(htmlLang || '').toLowerCase().startsWith('en');
    const horas = Math.max(0, Math.round(Number(legal.politicaCancelacionHorasGratis) || 0));
    if (modo === 'gratis_ilimitada') {
        return {
            mostrar: true,
            variant: 'success',
            texto: en
                ? 'Free cancellation according to the host policy (see details below).'
                : 'Cancelación gratuita según la política del anfitrión (ver detalle abajo).',
        };
    }
    if (modo === 'gratis_hasta_horas' && horas > 0) {
        return {
            mostrar: true,
            variant: 'info',
            texto: en
                ? `Free cancellation up to ${horas} hour(s) before check-in (see full policy below).`
                : `Cancelación gratuita hasta ${horas} hora(s) antes del check-in (política completa abajo).`,
        };
    }
    return { mostrar: false };
}

/**
 * Validación al persistir `websiteSettings.legal` (panel / API).
 * Alineado con `buildAvisoPoliticaCancelacion`: en `gratis_hasta_horas` hace falta ≥1 h o el SSR no muestra aviso.
 * @returns {{ ok: true, legalPatch?: object } | { ok: false, errors: string[] }}
 */
function validateLegalPoliticaCancelacion(legal) {
    if (!legal || typeof legal !== 'object') return { ok: true };
    const modo = String(legal.politicaCancelacionModo || 'texto_solo').trim();
    if (modo !== 'gratis_hasta_horas') return { ok: true };
    const horas = Math.round(Number(legal.politicaCancelacionHorasGratis) || 0);
    if (!Number.isFinite(horas) || horas < 1 || horas > 8760) {
        return {
            ok: false,
            errors: [
                'En modo «Cancelación gratis hasta X h antes del check-in», indica entre 1 y 8760 horas. Con 0 horas la web pública no muestra ese aviso en /reservar ni en confirmación.',
            ],
        };
    }
    return { ok: true, legalPatch: { politicaCancelacionHorasGratis: horas } };
}

/** Escenario fijo para comprobar líneas referenciales vs total (mismas fórmulas que checkout/widget). */
const COH_T_REF = 1_000_000;
const COH_N_REF = 7;
const COH_H_REF = 4;
const COH_CLP_EPS = 1;
const COH_PCT_EPS = 1e-6;

/**
 * Coherencia del desglose opcional (§4): evita configuraciones donde las líneas extra
 * contradicen el total mostrado (p. ej. % sobre total que suman >100% o cargos que superan un total de referencia).
 * Solo aplica si existe `legal.desglosePrecioCheckout` como objeto.
 * @param {object} legal — `websiteSettings.legal`
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
function validateDesglosePrecioCheckoutCoherencia(legal) {
    if (!legal || typeof legal !== 'object') return { ok: true };
    if (!legal.desglosePrecioCheckout || typeof legal.desglosePrecioCheckout !== 'object') {
        return { ok: true };
    }
    const cfg = normalizeDesglosePrecioCheckoutConfig(legal);
    if (!cfg.mostrar) return { ok: true };

    const defs = cfg.lineasExtra || [];
    let sumPctTotal = 0;
    let sumPctNeto = 0;
    for (const def of defs) {
        if (def.tipo === 'porcentaje_total') sumPctTotal += def.porcentaje;
        if (def.tipo === 'porcentaje_neto') sumPctNeto += def.porcentaje;
    }
    const errors = [];
    if (sumPctTotal > 100 + COH_PCT_EPS) {
        errors.push(
            'Las filas «% sobre total» suman más del 100%: el desglose sería incoherente con un único total de alojamiento.',
        );
    }
    if (sumPctNeto > 100 + COH_PCT_EPS) {
        errors.push(
            'Las filas «% sobre neto» suman más del 100%: revisa los porcentajes respecto al neto (sin IVA).',
        );
    }

    const T = COH_T_REF;
    const tieneIva = cfg.modelo === 'cl_iva_incluido';
    let netoCLP = T;
    if (tieneIva) {
        const pct = cfg.tasaIvaPct || 19;
        const factor = 1 + pct / 100;
        netoCLP = Math.round(T / factor);
    }
    const baseNetoParaExtra = tieneIva ? netoCLP : T;

    let sumExtras = 0;
    for (const def of defs) {
        sumExtras += calcularMontoLineaExtra(def, T, baseNetoParaExtra, COH_N_REF, COH_H_REF);
    }
    if (sumExtras > T + COH_CLP_EPS) {
        errors.push(
            `Con un total de ejemplo de ${T.toLocaleString('es-CL')} CLP, ${COH_N_REF} noches y ${COH_H_REF} huéspedes, la suma de las líneas referenciales (${sumExtras.toLocaleString('es-CL')} CLP) supera ese total. Reduce porcentajes o montos fijos por noche/persona.`,
        );
    }

    const built = buildDesglosePrecioCheckout(T, legal, 'es', { noches: COH_N_REF, huespedes: COH_H_REF });
    if (built.mostrar && tieneIva && built.netoCLP != null && built.ivaCLP != null) {
        if (Math.abs(built.netoCLP + built.ivaCLP - T) > COH_CLP_EPS) {
            errors.push('Inconsistencia interna neto + IVA respecto al total (aritmética de desglose).');
        }
    }

    if (errors.length) return { ok: false, errors };
    return { ok: true };
}

module.exports = {
    DEFAULT_DESGLOSE,
    TIPOS_LINEA_EXTRA,
    normalizeDesglosePrecioCheckoutConfig,
    buildDesglosePrecioCheckout,
    calcularMontoLineaExtra,
    buildLineasExtraResueltas,
    buildAvisoPoliticaCancelacion,
    validateLegalPoliticaCancelacion,
    validateDesglosePrecioCheckoutCoherencia,
};
