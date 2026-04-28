/**
 * Coherencia del desglose de precio (§4) al guardar desde el panel.
 * Mantener alineado con `validateDesglosePrecioCheckoutCoherencia` en `backend/services/checkoutDesgloseService.js`.
 */

import { sanitizeLineaExtraDef } from './lineasExtraValidation.js';

const DEFAULT_DESGLOSE = Object.freeze({
    mostrar: true,
    modelo: 'cl_iva_incluido',
    tasaIvaPct: 19,
    notaDebajo: '',
    notaPie: '',
    lineasExtra: [],
});

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

const COH_T_REF = 1_000_000;
const COH_N_REF = 7;
const COH_H_REF = 4;
const COH_CLP_EPS = 1;
const COH_PCT_EPS = 1e-6;

/**
 * @param {object} legal — `websiteSettings.legal`
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function validateDesglosePrecioCheckoutCoherencia(legal) {
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

    if (tieneIva) {
        const pct = cfg.tasaIvaPct || 19;
        const factor = 1 + pct / 100;
        const n2 = Math.round(T / factor);
        const i2 = T - n2;
        if (Math.abs(n2 + i2 - T) > COH_CLP_EPS) {
            errors.push('Inconsistencia interna neto + IVA respecto al total (aritmética de desglose).');
        }
    }

    if (errors.length) return { ok: false, errors };
    return { ok: true };
}
