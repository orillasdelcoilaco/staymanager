const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
// node-fetch v2 es commonjs, v3 es esm. Si falla require, usaremos import dinámico o axios si está disponible.
// Asumiremos que node-fetch está instalado o usaremos una implementación nativa si node >= 18.
// Para asegurar compatibilidad en este entorno, intentaremos usar fetch nativo si existe, o require.
const fetch = global.fetch || require("node-fetch");

router.get("/busqueda-general", async (req, res) => {
    try {
        const empresasPath = path.join(__dirname, "../ai/router/empresas.json");

        if (!fs.existsSync(empresasPath)) {
            return res.json({ success: true, resultados: [] }); // Fail safe
        }

        const empresas = JSON.parse(fs.readFileSync(empresasPath, "utf8"));

        const { destino, checkin, checkout, adultos } = req.query;

        const resultados = [];

        // Paralelizar peticiones para mejor rendimiento
        const promesas = empresas.map(async (empresa) => {
            try {
                // Construir URL. Asumimos que baseUrl apunta a /api o similar.
                // El endpoint de disponibilidad es /api/disponibilidad o similar.
                // Ajustamos según lo que definimos en api.js: /api/disponibilidad
                // Si baseUrl es "https://.../api", entonces url es "https://.../api/disponibilidad"

                const url = `${empresa.baseUrl}/disponibilidad?empresa_id=${empresa.id}&checkin=${checkin}&checkout=${checkout}&adultos=${adultos}`;

                console.log(`Consultando empresa ${empresa.id}: ${url}`);
                const response = await fetch(url);
                if (!response.ok) return;

                const data = await response.json();

                // Adaptar respuesta de disponibilidad al formato de busqueda general
                // La respuesta de disponibilidad suele ser { data: [...] } o similar según publicAiController
                // publicAiController.getProperties devuelve { meta: ..., data: [...] }

                const items = data.data || []; // Asumiendo estructura de publicAiController

                items.forEach(item => {
                    // Filtrar por destino si es necesario (aunque la API de disponibilidad ya debería haber filtrado si se le pasó ubicación)
                    // Aquí asumimos que la API de la empresa ya filtró o devolvió todo.
                    // Si el usuario pide "destino", deberíamos pasarlo a la API de la empresa como "ubicacion"

                    resultados.push({
                        empresaId: empresa.id,
                        nombre: empresa.nombre,
                        alojamientoId: item.id,
                        titulo: item.nombre || item.titulo || 'Alojamiento',
                        precio: item.precioBase || item.precio || 0,
                        imagenPrincipal: item.imagenesDestacadas?.[0]?.url || ''
                    });
                });
            } catch (e) {
                console.error(`Error consultando empresa ${empresa.id}:`, e.message);
            }
        });

        await Promise.all(promesas);

        resultados.sort((a, b) => a.precio - b.precio);

        res.json({ success: true, resultados });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error interno" });
    }
});

module.exports = router;
