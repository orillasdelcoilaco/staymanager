// backend/routes/geocode.js
// Proxy a Nominatim (OpenStreetMap) para geocodificación de direcciones.
const express = require('express');
const fetch = require('node-fetch');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        const { q } = req.query;
        if (!q || !q.trim()) {
            return res.status(400).json({ error: 'Parámetro q requerido' });
        }

        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.trim())}&format=json&limit=5&addressdetails=1`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'SuiteManager/1.0 (contact@suitemanager.cl)',
                    'Accept-Language': 'es,en',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`[Geocode] Nominatim respondió ${response.status}`);
                return res.status(502).json({ error: `Nominatim devolvió ${response.status}` });
            }

            const results = await response.json();
            console.log(`[Geocode] "${q}" → ${results.length} resultados`);

            const mapped = results.map(r => ({
                display_name: r.display_name,
                lat: parseFloat(r.lat),
                lng: parseFloat(r.lon),
                ciudad: r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || r.address?.county || '',
                region: r.address?.state || '',
                pais: r.address?.country || '',
                codigoPais: r.address?.country_code?.toUpperCase() || ''
            }));

            res.json(mapped);
        } catch (err) {
            console.error('[Geocode] Error:', err.message);
            res.status(500).json({ error: `Error de conexión con Nominatim: ${err.message}` });
        }
    });

    return router;
};
