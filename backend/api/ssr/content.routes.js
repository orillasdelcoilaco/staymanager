const express = require('express');
const multer = require('multer');
const { optimizarPerfilAlojamiento, analizarRequisitosFotos, auditarFoto } = require('../../services/contentFactoryService');
const { optimizeImage } = require('../../services/imageProcessingService');
const { obtenerPropiedadPorId } = require('../../services/propiedadesService');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    // POST /api/content-factory/alojamientos/:id/optimize
    // Dispara la generación de textos y SEO para un alojamiento
    router.post('/alojamientos/:id/optimize', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;

            console.log(`[ContentFactory] Optimizando alojamiento ${id}...`);
            const resultado = await optimizarPerfilAlojamiento(db, empresaId, id);

            // También actualizamos requisitos de fotos como parte del proceso
            await analizarRequisitosFotos(db, empresaId, id);

            res.status(200).json(resultado);
        } catch (error) {
            console.error("Error optimizando alojamiento:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // POST /api/content-factory/photos/audit
    // Audita una foto subida, optimizándola primero para asegurar calidad Web
    router.post('/photos/audit', upload.single('photo'), async (req, res) => {
        try {
            const { empresaId } = req.user;
            // Manejo de campos nulos con valores por defecto
            const alojamientoId = req.body.alojamientoId || "default";
            const componenteId = req.body.componenteId || "default";
            const tipoComponente = req.body.tipoComponente || "General";
            const nombreComponente = req.body.nombreComponente || "Elemento";

            if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen.' });

            // 1. Optimizar Imagen (Físico)
            console.log(`[ContentFactory] Optimizando imagen para ${nombreComponente}...`);
            const { buffer: optimizedBuffer, info } = await optimizeImage(req.file.buffer, {
                maxWidth: 1920, // Full HD max
                quality: 80
            });

            // Obtener nombre alojamiento para contexto
            let nombreAlojamiento = "Alojamiento";
            if (alojamientoId !== "default") {
                // Si falla la búsqueda, no bloqueamos la auditoría
                try {
                    const alojamiento = await obtenerPropiedadPorId(db, empresaId, alojamientoId);
                    if (alojamiento) nombreAlojamiento = alojamiento.nombre;
                } catch (e) { console.warn("No se pudo obtener nombre alojamiento:", e.message); }
            }

            const contexto = {
                tipoComponente,
                nombreComponente,
                nombreAlojamiento
            };

            // 2. Auditar Imagen Optimizada (IA)
            console.log(`[ContentFactory] Auditando foto optimizada (${(info.size / 1024).toFixed(1)}KB)...`);
            const resultadoIA = await auditarFoto(optimizedBuffer, contexto);

            res.status(200).json({
                ...resultadoIA,
                technicalMetadata: {
                    originalSize: req.file.size,
                    optimizedSize: info.size,
                    format: info.format,
                    width: info.width,
                    height: info.height
                }
            });

        } catch (error) {
            console.error("Error auditando foto:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
