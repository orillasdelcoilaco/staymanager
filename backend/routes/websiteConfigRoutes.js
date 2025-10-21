// backend/routes/websiteConfigRoutes.js
const express = require('express');
const { actualizarDetallesEmpresa, obtenerDetallesEmpresa } = require('../services/empresaService');
const { upload } = require('../utils/storage'); // Asumiendo que tienes un middleware de upload

module.exports = (db) => {
    const router = express.Router();

    // Ruta para obtener la configuración web de la empresa
    router.get('/configuracion-web', async (req, res, next) => {
        try {
            const empresaId = req.empresa.id;
            const empresa = await obtenerDetallesEmpresa(db, empresaId);
            res.status(200).json(empresa.websiteSettings || {});
        } catch (error) {
            next(error);
        }
    });

    // Ruta para actualizar la configuración web de la empresa
    router.put('/configuracion-web', async (req, res, next) => {
        try {
            const empresaId = req.empresa.id;
            const { theme, content, seo, general } = req.body;
            
            // *** INICIO DE LA CORRECCIÓN ***
            // Aplanar el payload para que los campos anidados se actualicen correctamente
            const updateData = {};

            if (theme) {
                if (theme.logoUrl !== undefined) updateData['websiteSettings.theme.logoUrl'] = theme.logoUrl;
                if (theme.primaryColor !== undefined) updateData['websiteSettings.theme.primaryColor'] = theme.primaryColor;
                if (theme.secondaryColor !== undefined) updateData['websiteSettings.theme.secondaryColor'] = theme.secondaryColor;
                if (theme.heroImageUrl !== undefined) updateData['websiteSettings.theme.heroImageUrl'] = theme.heroImageUrl;
                if (theme.heroImageAlt !== undefined) updateData['websiteSettings.theme.heroImageAlt'] = theme.heroImageAlt;
                if (theme.heroImageTitle !== undefined) updateData['websiteSettings.theme.heroImageTitle'] = theme.heroImageTitle;
            }
            if (content) {
                if (content.homeH1 !== undefined) updateData['websiteSettings.content.homeH1'] = content.homeH1;
                if (content.homeIntro !== undefined) updateData['websiteSettings.content.homeIntro'] = content.homeIntro;
            }
            if (seo) {
                if (seo.homeTitle !== undefined) updateData['websiteSettings.seo.homeTitle'] = seo.homeTitle;
                if (seo.homeDescription !== undefined) updateData['websiteSettings.seo.homeDescription'] = seo.homeDescription;
            }
            if (general) { // Por ejemplo, si tienes una configuración general directa
                if (general.subdomain !== undefined) updateData['websiteSettings.subdomain'] = general.subdomain;
                if (general.domain !== undefined) updateData['websiteSettings.domain'] = general.domain;
            }

            // Si no hay datos para actualizar, no hacer nada
            if (Object.keys(updateData).length === 0) {
                 return res.status(200).json({ message: 'No hay cambios para guardar.' });
            }
            
            await actualizarDetallesEmpresa(db, empresaId, updateData);
            // *** FIN DE LA CORRECCIÓN ***

            res.status(200).json({ message: 'Configuración web actualizada con éxito.' });
        } catch (error) {
            next(error);
        }
    });

    // Ruta para subir la imagen del Hero
    router.post('/upload-hero-image', upload.single('heroImage'), async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No se subió ninguna imagen.' });
            }

            const empresaId = req.empresa.id;
            const imageUrl = req.file.path; // URL completa del archivo en Cloud Storage

            // Guardar la URL en la configuración de la empresa
            await actualizarDetallesEmpresa(db, empresaId, { 'websiteSettings.theme.heroImageUrl': imageUrl });

            res.status(200).json({ imageUrl: imageUrl, message: 'Imagen de hero subida y guardada con éxito.' });
        } catch (error) {
            console.error('Error al subir la imagen del hero:', error);
            next(error);
        }
    });


    return router;
};