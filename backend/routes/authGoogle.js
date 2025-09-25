const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const admin = require('firebase-admin');

let credentials;
try {
    credentials = process.env.RENDER
        ? require('/etc/secrets/google_credentials.json')
        : require('../google_credentials.json');
} catch (error) {
    console.error("CRITICAL: No se pudieron cargar las credenciales de Google. La autenticación de Google no funcionará.", error);
}

module.exports = (db) => {
    const router = express.Router();
    if (!credentials) return router;

    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    router.get('/authorize', (req, res) => {
        const { empresaId } = req.user;
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/contacts'],
            prompt: 'consent',
            state: empresaId
        });
        res.status(200).json({ url: authUrl });
    });

    router.get('/callback', async (req, res) => {
        const { code, state: empresaId } = req.query;
        if (!code || !empresaId) {
            return res.status(400).send('No se recibió el código de autorización o el ID de la empresa.');
        }
        try {
            const { tokens } = await oauth2Client.getToken(code);
            const refreshToken = tokens.refresh_token;

            if (!refreshToken) {
                return res.status(400).send('No se recibió el refresh token. Asegúrate de dar tu consentimiento en la pantalla de Google.');
            }

            const empresaRef = db.collection('empresas').doc(empresaId);
            await empresaRef.update({
                googleRefreshToken: refreshToken,
                googleAuthDate: admin.firestore.FieldValue.serverTimestamp()
            });

            res.send('¡Autorización completada con éxito! Ya puedes cerrar esta ventana y volver a la aplicación.');

        } catch (err) {
            console.error('Error al obtener el token de Google:', err);
            res.status(500).send('Error al procesar la autorización de Google.');
        }
    });

    return router;
};