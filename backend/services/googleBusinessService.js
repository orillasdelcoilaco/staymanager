// backend/services/googleBusinessService.js
// Polling de reseñas de Google Business Profile por empresa
const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch');
const pool = require('../db/postgres');
const { guardarResena } = require('./resenasService');

let credentials;
try {
    credentials = process.env.RENDER
        ? require('/etc/secrets/google_credentials.json')
        : require('../google_credentials.json');
} catch {
    credentials = null;
}

function crearAuthClient(refreshToken) {
    const { client_id, client_secret, redirect_uris } = credentials.web;
    const client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);
    client.setCredentials({ refresh_token: refreshToken });
    return client;
}

async function obtenerAccessToken(refreshToken) {
    const client = crearAuthClient(refreshToken);
    const { token } = await client.getAccessToken();
    return token;
}

async function obtenerEmpresasConGoogle() {
    if (!pool) return [];
    const { rows } = await pool.query(`
        SELECT id, nombre, google_refresh_token, google_business_account_id
        FROM empresas
        WHERE google_refresh_token IS NOT NULL
    `);
    return rows;
}

async function listarCuentasBusiness(accessToken) {
    const res = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return data.accounts || [];
}

async function listarLocaciones(accountName, accessToken) {
    const res = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return data.locations || [];
}

async function obtenerResenasLocacion(accountName, locationName, accessToken) {
    // La API v4 de reviews sigue siendo la vigente
    const locId = locationName.split('/').pop();
    const accId = accountName.split('/').pop();
    const url = `https://mybusiness.googleapis.com/v4/accounts/${accId}/locations/${locId}/reviews?pageSize=50`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    return data.reviews || [];
}

async function resolverPropiedadPorLocationId(empresaId, locationId) {
    if (!pool || !locationId) return null;
    const { rows } = await pool.query(
        'SELECT id FROM propiedades WHERE empresa_id = $1 AND google_location_id = $2 LIMIT 1',
        [empresaId, locationId]
    );
    return rows[0]?.id || null;
}

async function guardarAccountId(empresaId, accountId) {
    if (!pool) return;
    await pool.query(
        'UPDATE empresas SET google_business_account_id = $1 WHERE id = $2',
        [accountId, empresaId]
    );
}

async function procesarEmpresa(empresa) {
    let nuevas = 0;
    try {
        const accessToken = await obtenerAccessToken(empresa.google_refresh_token);

        // Obtener cuenta Business (usar la guardada o buscar la primera)
        let accountName = empresa.google_business_account_id
            ? `accounts/${empresa.google_business_account_id}`
            : null;

        if (!accountName) {
            const cuentas = await listarCuentasBusiness(accessToken);
            if (!cuentas.length) {
                console.log(`[googleBusiness] ${empresa.nombre}: sin cuentas Business`);
                return 0;
            }
            accountName = cuentas[0].name;
            await guardarAccountId(empresa.id, accountName.split('/').pop());
        }

        const locaciones = await listarLocaciones(accountName, accessToken);
        console.log(`[googleBusiness] ${empresa.nombre}: ${locaciones.length} locación(es)`);

        for (const loc of locaciones) {
            const locationId = loc.name.split('/').pop();
            const propiedadId = await resolverPropiedadPorLocationId(empresa.id, locationId);

            const resenas = await obtenerResenasLocacion(accountName, loc.name, accessToken);
            for (const r of resenas) {
                const rating = r.starRating
                    ? { ONE: 2, TWO: 4, THREE: 6, FOUR: 8, FIVE: 10 }[r.starRating] || null
                    : null;

                const { nueva } = await guardarResena(empresa.id, {
                    propiedadId,
                    canal: 'google',
                    idExterno: r.reviewId,
                    reviewerNombre: r.reviewer?.displayName || null,
                    texto: r.comment || null,
                    rating,
                    fechaReview: r.createTime || null,
                    rawEmail: { locationId, locationTitle: loc.title }
                });

                if (nueva) nuevas++;
            }
        }
    } catch (err) {
        console.error(`[googleBusiness] Error ${empresa.nombre}:`, err.message);
    }
    return nuevas;
}

async function ejecutarPollGoogleReviews() {
    console.log('[googleBusiness] Iniciando poll de reseñas Google...');

    if (!credentials) {
        console.log('[googleBusiness] Sin credenciales Google — omitiendo.');
        return;
    }

    const empresas = await obtenerEmpresasConGoogle();
    if (!empresas.length) {
        console.log('[googleBusiness] No hay empresas con Google autorizado.');
        return;
    }

    let total = 0;
    for (const empresa of empresas) {
        const nuevas = await procesarEmpresa(empresa);
        total += nuevas;
        console.log(`[googleBusiness] ${empresa.nombre}: ${nuevas} reseña(s) nueva(s)`);
    }
    console.log(`[googleBusiness] Poll completado. Total nuevas: ${total}`);
}

module.exports = { ejecutarPollGoogleReviews };
