const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const admin = require('firebase-admin'); // Se importa admin para usar el timestamp

// La lógica para cargar credenciales ahora es más robusta y similar a como se carga la serviceAccountKey
let credentials;
try {
    credentials = process.env.RENDER
        ? require('/etc/secrets/google_credentials.json') // Ruta para Secret Files en Render
        : require('../google_credentials.json'); // Ruta para desarrollo local
} catch (error) {
    console.error("CRITICAL: No se pudieron cargar las credenciales de Google. La autenticación de Google no funcionará.", error);
}

module.exports = (db) => {
    const router = express.Router();
    if (!credentials) return router; // No registrar rutas si las credenciales fallan

    const { client_secret, client_id, redirect_uris } = credentials.web;
    const oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    router.get('/authorize', (req, res) => {
        const { empresaId } = req.user; // Obtenido del authMiddleware
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/contacts'],
            prompt: 'consent',
            state: empresaId // Pasamos el ID de la empresa para saber dónde guardar el token
        });
        res.redirect(authUrl);
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