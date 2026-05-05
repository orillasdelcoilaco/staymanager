'use strict';

/**
 * Cliente mínimo Beds24 API V2 (sin credenciales en código).
 * Documentación: https://wiki.beds24.com/index.php/API_V2.0 · Swagger https://beds24.com/api/v2/
 */
const fetch = require('node-fetch');

const DEFAULT_BASE = 'https://beds24.com/api/v2';

function getBeds24ApiBase() {
    const b = process.env.BEDS24_API_BASE || DEFAULT_BASE;
    return String(b).replace(/\/$/, '');
}

/**
 * Resuelve token de acceso: variable de entorno directa, long-life (solo lectura) o refresh.
 * @returns {Promise<string>}
 */
async function resolveBeds24AccessToken() {
    const direct = process.env.BEDS24_ACCESS_TOKEN;
    if (direct && String(direct).trim()) {
        return String(direct).trim();
    }
    const longLife = process.env.BEDS24_LONG_LIFE_TOKEN;
    if (longLife && String(longLife).trim()) {
        return String(longLife).trim();
    }
    const refresh = process.env.BEDS24_REFRESH_TOKEN;
    if (!refresh || !String(refresh).trim()) {
        throw new Error(
            'Beds24: defina BEDS24_REFRESH_TOKEN (escritura), BEDS24_LONG_LIFE_TOKEN (solo lectura) o BEDS24_ACCESS_TOKEN. Ver backend/.env.example'
        );
    }
    const base = getBeds24ApiBase();
    const res = await fetch(`${base}/authentication/token`, {
        method: 'GET',
        headers: {
            accept: 'application/json',
            refreshToken: String(refresh).trim(),
        },
    });
    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Beds24 token refresh: respuesta no JSON (${res.status}): ${text.slice(0, 240)}`);
    }
    if (!res.ok) {
        throw new Error(`Beds24 token refresh HTTP ${res.status}: ${text.slice(0, 240)}`);
    }
    if (!data.token) {
        throw new Error('Beds24 token refresh: falta "token" en JSON');
    }
    return String(data.token).trim();
}

/**
 * @param {string} method
 * @param {string} pathSuffix ej. "/properties"
 * @param {{ query?: Record<string, string>, body?: object }} [opts]
 * @returns {Promise<{ status: number, ok: boolean, json: object }>}
 */
async function beds24Request(method, pathSuffix, opts = {}) {
    const base = getBeds24ApiBase();
    const p = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
    const q =
        opts.query && Object.keys(opts.query).length
            ? `?${new URLSearchParams(opts.query).toString()}`
            : '';
    const url = `${base}${p}${q}`;
    const token = await resolveBeds24AccessToken();
    /** @type {Record<string, string>} */
    const headers = {
        accept: 'application/json',
        token,
    };
    /** @type {import('node-fetch').RequestInit} */
    const init = { method, headers };
    if (opts.body !== undefined && opts.body !== null) {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, init);
    const bodyText = await res.text();
    let json;
    try {
        json = bodyText ? JSON.parse(bodyText) : {};
    } catch {
        json = { _parseError: true, _raw: bodyText.slice(0, 500) };
    }
    return { status: res.status, ok: res.ok, json };
}

module.exports = {
    getBeds24ApiBase,
    resolveBeds24AccessToken,
    beds24Request,
};
