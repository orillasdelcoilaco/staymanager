// backend/routes/empresa.js
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { uploadFile } = require('../services/storageService');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa, normalizeSubdomain } = require('../services/empresaService');
const { syncDomain } = require('../services/renderDomainService');

// Configuración de Multer para manejar la subida del logo en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();
    const _isManagedInternalDomain = (domainValue) => {
        const d = String(domainValue || '').trim().toLowerCase();
        return d.endsWith('.onrender.com') || d.endsWith('.suitemanagers.com') || d.endsWith('.suitemanager.com');
    };

    // --- RUTA NUEVA PARA SUBIR EL LOGO ---
    // (Note que la ruta será POST /api/empresa/upload-logo)
    router.post('/upload-logo', upload.single('logoFile'), async (req, res) => {
        try {
            const { empresaId } = req.user;

            if (!req.file) {
                return res.status(400).json({ error: 'No se subió ningún archivo.' });
            }

            // Nombre de archivo estático para sobrescribir el logo anterior y no generar basura
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/website/logo.${outputFormat}`;

            // Optimizar con Sharp: ajustar tamaño y convertir a WebP
            const optimizedBuffer = await sharp(req.file.buffer)
                .resize({ width: 200, fit: 'inside' }) // Ajustar a un ancho máximo de 200px
                .toFormat(outputFormat, { quality: 80 })
                .toBuffer();

            // Subir a Storage
            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // Guardar la URL en Firestore usando el servicio existente
            const updatePayload = {
                'websiteSettings.theme.logoUrl': publicUrl
            };

            await actualizarDetallesEmpresa(db, empresaId, updatePayload);

            // [NEW] Generar/Actualizar App Premium automáticamente al tener logo
            // Esto se ejecuta en background y no bloquea la respuesta
            try {
                const { handlePremiumApp } = require('../../ai/openai/premium/handlePremiumApp');
                // Necesitamos el nombre comercial actualizado
                const empresa = await obtenerDetallesEmpresa(db, empresaId);

                // Ejecutar en background sin esperar
                handlePremiumApp(empresaId, empresa.nombre || "Empresa", publicUrl)
                    .then(() => {
                        console.log("🌟 App Premium lista para revisión/publicación en ChatGPT.");
                    })
                    .catch(err => {
                        console.error("❌ Error preparando App Premium:", err);
                        // No fallar la subida del logo por esto
                    });
            } catch (err) {
                console.error("⚠️ No se pudo inicializar App Premium (continuando con subida de logo):", err.message);
                // No fallar la subida del logo si hay error con App Premium
            }

            // Devolver la nueva URL al frontend
            res.status(200).json({ logoUrl: publicUrl });

        } catch (error) {
            console.error("Error al subir el logo:", error);
            res.status(500).json({ error: error.message || 'Error al procesar la subida del logo.' });
        }
    });


    // --- RUTAS EXISTENTES ---

    // Obtener los detalles de la empresa (para la vista "Gestionar Empresa")
    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            console.log(`[DEBUG empresa GET] Obteniendo detalles para empresaId: ${empresaId}`);
            const detalles = await obtenerDetallesEmpresa(db, empresaId);

            // Log para depuración
            console.log(`[DEBUG empresa GET] Datos obtenidos:`, {
                id: detalles?.id,
                nombre: detalles?.nombre,
                hasWebsiteSettings: !!detalles?.websiteSettings,
                websiteSettingsKeys: detalles?.websiteSettings ? Object.keys(detalles.websiteSettings) : [],
                configuracion: detalles?.configuracion ? 'PRESENTE' : 'AUSENTE'
            });

            if (detalles?.websiteSettings?.theme) {
                console.log(`[DEBUG empresa GET] Theme data:`, {
                    hasHeroImageUrl: !!detalles.websiteSettings.theme.heroImageUrl,
                    hasHeroImageAlt: !!detalles.websiteSettings.theme.heroImageAlt,
                    hasHeroImageTitle: !!detalles.websiteSettings.theme.heroImageTitle
                });
            }

            res.status(200).json(detalles);
        } catch (error) {
            console.error("Error al obtener detalles de la empresa:", error);
            res.status(500).json({ error: error.message });
        }
    });

    // Actualizar los detalles de la empresa (Datos del formulario, NO el logo)
    router.put('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const datosActualizados = { ...(req.body || {}) };
            const empresaAntes = await obtenerDetallesEmpresa(db, empresaId);
            const oldDomain = String(
                empresaAntes?.dominio
                || empresaAntes?.websiteSettings?.general?.domain
                || empresaAntes?.websiteSettings?.domain
                || ''
            ).trim().toLowerCase();
            const oldSubdomain = String(
                empresaAntes?.subdominio
                || empresaAntes?.websiteSettings?.general?.subdomain
                || empresaAntes?.websiteSettings?.subdomain
                || ''
            ).trim().toLowerCase();

            // Eliminar logoUrl si se envió accidentalmente con el formulario principal
            // (Se maneja por la ruta /upload-logo)
            if (datosActualizados.websiteSettings && datosActualizados.websiteSettings.theme) {
                delete datosActualizados.websiteSettings.theme.logoUrl;
            }

            // Si se cambia el nombre comercial desde esta vista y no hay dominio personalizado externo,
            // auto-derivar subdominio/dominio y sincronizar Render para mantener el host público operativo.
            const nombreNuevo = String(datosActualizados.nombre || '').trim();
            const nombreCambio = nombreNuevo && nombreNuevo !== String(empresaAntes?.nombre || '').trim();
            const wsGeneralInput = datosActualizados?.websiteSettings?.general || {};
            const wsSubInput = String(wsGeneralInput.subdomain || '').trim();
            const wsDomainInput = String(wsGeneralInput.domain || '').trim();
            const hasCustomDomain = oldDomain && !_isManagedInternalDomain(oldDomain);

            let expectedDomainForRender = oldDomain || '';
            if (nombreCambio && !hasCustomDomain && !wsSubInput && !wsDomainInput) {
                const subDerivado = normalizeSubdomain(nombreNuevo);
                if (subDerivado) {
                    const useOnRenderDomain = oldDomain.endsWith('.onrender.com');
                    const domainDerivado = useOnRenderDomain
                        ? `${subDerivado}.onrender.com`
                        : `${subDerivado}.suitemanagers.com`;

                    datosActualizados.subdominio = subDerivado;
                    datosActualizados.dominio = domainDerivado;
                    datosActualizados.websiteSettings = datosActualizados.websiteSettings || {};
                    datosActualizados.websiteSettings.general = {
                        ...(datosActualizados.websiteSettings.general || {}),
                        subdomain: subDerivado,
                        domain: domainDerivado,
                    };

                    expectedDomainForRender = domainDerivado;
                }
            }

            const empresaActualizada = await actualizarDetallesEmpresa(db, empresaId, datosActualizados);
            let domainInfo = null;
            if (expectedDomainForRender && _isManagedInternalDomain(expectedDomainForRender) && expectedDomainForRender !== oldDomain) {
                try {
                    domainInfo = await syncDomain(expectedDomainForRender, oldDomain || null);
                } catch (renderErr) {
                    domainInfo = { domain: expectedDomainForRender, error: renderErr.message, instructions: null };
                    console.warn(`[empresa.put] Advertencia Render API: ${renderErr.message}`);
                }
            }
            res.status(200).json({
                message: 'Datos de la empresa actualizados con éxito.',
                empresa: empresaActualizada,
                domainInfo,
            });
        } catch (error) {
            console.error("Error al actualizar detalles de la empresa:", error);
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    });

    return router;
};