// backend/routes/authGoogle.js
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../db/postgres');

let credentials;
try {
    credentials = process.env.RENDER
        ? require('/etc/secrets/google_credentials.json')
        : require('../google_credentials.json');
} catch (error) {
    console.error('CRITICAL: No se pudieron cargar credenciales de Google.', error.message);
}

const SCOPES = [
    'https://www.googleapis.com/auth/contacts',
    'https://www.googleapis.com/auth/business.manage'
];

module.exports = (db) => {
    const router = express.Router();
    if (!credentials) return router;

    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    router.get('/authorize', (req, res) => {
        const { empresaId } = req.user;
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent',
            state: empresaId
        });
        res.status(200).json({ url: authUrl });
    });

    router.get('/callback', async (req, res) => {
        const { code, state: empresaId } = req.query;
        if (!code || !empresaId) {
            return res.status(400).send('Faltan parámetros de autorización.');
        }
        try {
            const { tokens } = await oauth2Client.getToken(code);
            if (!tokens.refresh_token) {
                return res.status(400).send('No se recibió refresh token. Intenta de nuevo con prompt=consent.');
            }

            if (pool) {
                await pool.query(`
                    UPDATE empresas
                    SET google_refresh_token = $1, google_auth_date = NOW()
                    WHERE id = $2
                `, [tokens.refresh_token, empresaId]);
            } else {
                // Firestore fallback
                await db.collection('empresas').doc(empresaId).update({
                    googleRefreshToken: tokens.refresh_token,
                    googleAuthDate: new Date()
                });
            }

            res.send('¡Autorización completada! Puedes cerrar esta ventana.');
        } catch (err) {
            console.error('[authGoogle] Error al obtener token:', err.message);
            res.status(500).send('Error al procesar la autorización de Google.');
        }
    });

    // GET /api/authGoogle/status — verifica si la empresa tiene token activo
    router.get('/status', async (req, res) => {
        try {
            if (pool) {
                const { rows } = await pool.query(
                    'SELECT google_auth_date, google_business_account_id FROM empresas WHERE id = $1',
                    [req.empresaId]
                );
                const row = rows[0];
                res.json({
                    autorizado: !!row?.google_auth_date,
                    fechaAuth: row?.google_auth_date || null,
                    businessAccountId: row?.google_business_account_id || null
                });
            } else {
                res.json({ autorizado: false });
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
