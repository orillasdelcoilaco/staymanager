const express = require('express');
const fs = require('fs');

module.exports = (db) => {
    const router = express.Router();

    router.get('/check-secrets', (req, res) => {
        console.log('[Debug] Ejecutando verificación de archivos secretos...');
        const googlePath = '/etc/secrets/google_credentials.json';
        const firebasePath = '/etc/secrets/serviceAccountKey.json';

        const results = {
            isRenderEnvironment: !!process.env.RENDER,
            googleCreds: {
                path: googlePath,
                exists: false,
                canRequire: false,
                error: null
            },
            firebaseCreds: {
                path: firebasePath,
                exists: false,
                canRequire: false,
                error: null
            }
        };

        // Check Google Credentials
        try {
            results.googleCreds.exists = fs.existsSync(googlePath);
            if (results.googleCreds.exists) {
                require(googlePath);
                results.googleCreds.canRequire = true;
            }
        } catch (e) {
            results.googleCreds.error = e.message;
        }

        // Check Firebase Credentials
        try {
            results.firebaseCreds.exists = fs.existsSync(firebasePath);
            if (results.firebaseCreds.exists) {
                require(firebasePath);
                results.firebaseCreds.canRequire = true;
            }
        } catch (e) {
            results.firebaseCreds.error = e.message;
        }

        console.log('[Debug] Resultados de la verificación:', JSON.stringify(results, null, 2));
        res.status(200).json(results);
    });

    return router;
};