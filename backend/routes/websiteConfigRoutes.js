// backend/routes/websiteConfigRoutes.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');
const admin = require('firebase-admin');

const { obtenerPropiedadPorId, actualizarPropiedad } = require('../services/propiedadesService');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');
const {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarSeoHomePage,
    generarContenidoHomePage,
    generarPerfilEmpresa
} = require('../services/aiContentService');
const { uploadFile, deleteFileByPath } = require('../services/storageService');
const { generarPlanFotos } = require('../services/propiedadLogicService');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    // GET Configuración
    router.get('/configuracion-web', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            res.status(200).json(empresaData.websiteSettings || {});
        } catch (error) { next(error); }
    });

    // PUT Guardar Configuración General (SEO, Content, Theme colors, etc)
    router.put('/home-settings', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const settings = req.body; // { general, theme, content, seo }

            // Estructuramos para guardar en 'websiteSettings'
            const updatePayload = {};
            if (settings.general) updatePayload['websiteSettings.general'] = settings.general;
            if (settings.theme) {
                updatePayload['websiteSettings.theme.primaryColor'] = settings.theme.primaryColor;
                updatePayload['websiteSettings.theme.secondaryColor'] = settings.theme.secondaryColor;
                updatePayload['websiteSettings.theme.logoUrl'] = settings.theme.logoUrl;
                // Hero image fields are handled by upload-hero-image but we might want to allow manual edits if sent
                if (settings.theme.heroImageAlt) updatePayload['websiteSettings.theme.heroImageAlt'] = settings.theme.heroImageAlt;
                if (settings.theme.heroImageTitle) updatePayload['websiteSettings.theme.heroImageTitle'] = settings.theme.heroImageTitle;
            }
            if (settings.content) updatePayload['websiteSettings.content'] = settings.content;
            if (settings.seo) updatePayload['websiteSettings.seo'] = settings.seo;

            await actualizarDetallesEmpresa(db, empresaId, updatePayload);
            res.status(200).json({ message: 'Configuración guardada.' });
        } catch (error) { next(error); }
    });

    // POST Subir Imagen Hero (Portada)
    router.post('/upload-hero-image', upload.single('heroImage'), async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { altText, titleText } = req.body;

            if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

            // 1. Procesar y subir imagen
            const imageId = uuidv4();
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/website/hero-${imageId}.${outputFormat}`;

            const optimizedBuffer = await sharp(req.file.buffer)
                .resize({ width: 1920, height: 1080, fit: 'cover' })
                .toFormat(outputFormat, { quality: 85 })
                .toBuffer();

            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // 2. Determinar Metadata
            let finalAlt = altText;
            let finalTitle = titleText;

            if (!finalAlt || !finalTitle) {
                const empresaData = await obtenerDetallesEmpresa(db, empresaId);
                const contextoExtra = {
                    historia: empresaData.historiaOptimizada || empresaData.historiaEmpresa,
                    slogan: empresaData.slogan
                };

                const metadata = await generarMetadataImagen(
                    nombreEmpresa,
                    "Página Principal",
                    contextoExtra.historia || "Sitio web de turismo",
                    "Imagen de Portada (Hero)",
                    "Portada Web",
                    optimizedBuffer
                );

                if (!finalAlt) finalAlt = metadata.altText;
                if (!finalTitle) finalTitle = metadata.title;
            }

            // 3. Guardar en DB
            const updatePayload = {
                'websiteSettings.theme.heroImageUrl': publicUrl,
                'websiteSettings.theme.heroImageAlt': finalAlt,
                'websiteSettings.theme.heroImageTitle': finalTitle
            };
            await actualizarDetallesEmpresa(db, empresaId, updatePayload);

            res.status(201).json(updatePayload);
        } catch (error) { next(error); }
    });

    // POST Optimizar Perfil Empresa (Estrategia Completa - Texto)
    router.post('/optimize-profile', async (req, res, next) => {
        try {
            const { historia } = req.body;
            if (!historia) return res.status(400).json({ error: 'Falta la historia.' });

            // Llamamos al servicio de IA para generar la estrategia completa
            const strategy = await generarPerfilEmpresa(historia);

            // Devolvemos la estrategia al frontend
            res.status(200).json(strategy);

        } catch (error) { next(error); }
    });

    // --- Rutas de Propiedades (Existentes) ---

    router.get('/propiedad/:propiedadId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, req.params.propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });
            res.status(200).json(propiedad.websiteData || { aiDescription: '', images: {}, cardImage: null });
        } catch (error) { next(error); }
    });

    router.put('/propiedad/:propiedadId', async (req, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file.' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, req.params.propiedadId); // Fix: req.params.propiedadId
            // Limpieza imagen anterior
            if (propiedad.websiteData?.cardImage?.storagePath) {
                await deleteFileByPath(propiedad.websiteData.cardImage.storagePath);
            }

            const imageId = `card-${uuidv4()}`;
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/propiedades/${req.params.propiedadId}/images/${imageId}.${outputFormat}`;
            const optimizedBuffer = await sharp(req.file.buffer).resize({ width: 800, height: 600, fit: 'cover' }).toFormat(outputFormat, { quality: 80 }).toBuffer();
            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // Metadata IA
            const { nombreEmpresa } = req.user; // Fix: Extract nombreEmpresa
            const metadata = await generarMetadataImagen(nombreEmpresa, propiedad.nombre, propiedad.descripcion, 'Imagen Principal', 'Portada', optimizedBuffer);

            const cardImageData = { imageId, storagePath: publicUrl, altText: metadata.altText, title: metadata.title };
            await actualizarPropiedad(db, empresaId, req.params.propiedadId, { 'websiteData.cardImage': cardImageData });
            res.status(201).json(cardImageData);
        } catch (error) { next(error); }
    });

    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.array('images'), async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId, componentId } = req.params;
            const shotContext = req.body.shotContext || null;

            if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files.' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });
            const componente = propiedad.componentes?.find(c => c.id === componentId);
            if (!componente) return res.status(404).json({ error: 'Componente no encontrado.' });

            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
            const resultadosParaFrontend = [];

            await Promise.all(req.files.map(async (file) => {
                const imageId = uuidv4();
                const outputFormat = 'webp';
                const storagePathRelative = `empresas/${empresaId}/propiedades/${propiedadId}/images/${componente.id}/${imageId}.${outputFormat}`;
                const optimizedBuffer = await sharp(file.buffer)
                    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
                    .toFormat(outputFormat, { quality: 80 })
                    .toBuffer();
                const publicUrl = await uploadFile(optimizedBuffer, storagePathRelative, `image/${outputFormat}`);

                let metadata = { altText: componente.nombre, title: componente.nombre };
                try {
                    const descPropiedad = propiedad.websiteData?.aiDescription || propiedad.descripcion || '';
                    metadata = await generarMetadataImagen(
                        nombreEmpresa,
                        propiedad.nombre,
                        descPropiedad,
                        componente.nombre,
                        componente.tipo,
                        optimizedBuffer,
                        shotContext
                    );
                } catch (aiError) {
                    console.warn("Fallo IA Visión:", aiError.message);
                }

                const imageData = {
                    imageId,
                    storagePath: publicUrl,
                    altText: metadata.altText,
                    title: metadata.title,
                    shotContext: shotContext, // [NEW] Guardar contexto para mapeo en UI
                    advertencia: metadata.advertencia || null
                };
                await propiedadRef.update({
                    [`websiteData.images.${componentId}`]: admin.firestore.FieldValue.arrayUnion(imageData)
                });
                resultadosParaFrontend.push(imageData);
            }));

            res.status(201).json(resultadosParaFrontend);
        } catch (error) {
            console.error(`Error POST upload-image:`, error);
            next(error);
        }
    });

    router.delete('/propiedad/:propiedadId/delete-image/:componentId/:imageId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId, componentId, imageId } = req.params;
            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
            const doc = await propiedadRef.get();

            if (!doc.exists) return res.status(404).json({ error: 'No encontrada.' });

            const images = doc.data().websiteData?.images?.[componentId] || [];
            const img = images.find(i => i.imageId === imageId);

            if (img && img.storagePath) {
                await deleteFileByPath(img.storagePath);
            }

            const nuevasImagenes = images.filter(i => i.imageId !== imageId);
            if (settings.seo) updatePayload['websiteSettings.seo'] = settings.seo;

            await actualizarDetallesEmpresa(db, empresaId, updatePayload);
            res.status(200).json({ message: 'Configuración guardada.' });
        } catch (error) { next(error); }
    });

    // POST Subir Imagen Hero (Portada)
    router.post('/upload-hero-image', upload.single('heroImage'), async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { altText, titleText } = req.body;

            if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

            // 1. Procesar y subir imagen
            const imageId = uuidv4();
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/website/hero-${imageId}.${outputFormat}`;

            const optimizedBuffer = await sharp(req.file.buffer)
                .resize({ width: 1920, height: 1080, fit: 'cover' })
                .toFormat(outputFormat, { quality: 85 })
                .toBuffer();

            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // 2. Determinar Metadata
            let finalAlt = altText;
            let finalTitle = titleText;

            if (!finalAlt || !finalTitle) {
                const empresaData = await obtenerDetallesEmpresa(db, empresaId);
                const contextoExtra = {
                    historia: empresaData.historiaOptimizada || empresaData.historiaEmpresa,
                    slogan: empresaData.slogan
                };

                const metadata = await generarMetadataImagen(
                    nombreEmpresa,
                    "Página Principal",
                    contextoExtra.historia || "Sitio web de turismo",
                    "Imagen de Portada (Hero)",
                    "Portada Web",
                    optimizedBuffer
                );

                if (!finalAlt) finalAlt = metadata.altText;
                if (!finalTitle) finalTitle = metadata.title;
            }

            // 3. Guardar en DB
            const updatePayload = {
                'websiteSettings.theme.heroImageUrl': publicUrl,
                'websiteSettings.theme.heroImageAlt': finalAlt,
                'websiteSettings.theme.heroImageTitle': finalTitle
            };
            await actualizarDetallesEmpresa(db, empresaId, updatePayload);

            res.status(201).json(updatePayload);
        } catch (error) { next(error); }
    });

    // POST Optimizar Perfil Empresa (Estrategia Completa - Texto)
    router.post('/optimize-profile', async (req, res, next) => {
        try {
            const { historia } = req.body;
            if (!historia) return res.status(400).json({ error: 'Falta la historia.' });

            // Llamamos al servicio de IA para generar la estrategia completa
            const strategy = await generarPerfilEmpresa(historia);

            // Devolvemos la estrategia al frontend
            res.status(200).json(strategy);

        } catch (error) { next(error); }
    });

    // --- Rutas de Propiedades (Existentes) ---

    router.get('/propiedad/:propiedadId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, req.params.propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });
            res.status(200).json(propiedad.websiteData || { aiDescription: '', images: {}, cardImage: null });
        } catch (error) { next(error); }
    });

    router.put('/propiedad/:propiedadId', async (req, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file.' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, req.params.propiedadId); // Fix: req.params.propiedadId
            // Limpieza imagen anterior
            if (propiedad.websiteData?.cardImage?.storagePath) {
                await deleteFileByPath(propiedad.websiteData.cardImage.storagePath);
            }

            const imageId = `card-${uuidv4()}`;
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/propiedades/${req.params.propiedadId}/images/${imageId}.${outputFormat}`;
            const optimizedBuffer = await sharp(req.file.buffer).resize({ width: 800, height: 600, fit: 'cover' }).toFormat(outputFormat, { quality: 80 }).toBuffer();
            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // Metadata IA
            const { nombreEmpresa } = req.user; // Fix: Extract nombreEmpresa
            const metadata = await generarMetadataImagen(nombreEmpresa, propiedad.nombre, propiedad.descripcion, 'Imagen Principal', 'Portada', optimizedBuffer);

            const cardImageData = { imageId, storagePath: publicUrl, altText: metadata.altText, title: metadata.title };
            await actualizarPropiedad(db, empresaId, req.params.propiedadId, { 'websiteData.cardImage': cardImageData });
            res.status(201).json(cardImageData);
        } catch (error) { next(error); }
    });

    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.array('images'), async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId, componentId } = req.params;
            const shotContext = req.body.shotContext || null;

            if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files.' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });
            const componente = propiedad.componentes?.find(c => c.id === componentId);
            if (!componente) return res.status(404).json({ error: 'Componente no encontrado.' });

            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
            const resultadosParaFrontend = [];

            await Promise.all(req.files.map(async (file) => {
                const imageId = uuidv4();
                const outputFormat = 'webp';
                const storagePathRelative = `empresas/${empresaId}/propiedades/${propiedadId}/images/${componente.id}/${imageId}.${outputFormat}`;
                const optimizedBuffer = await sharp(file.buffer)
                    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
                    .toFormat(outputFormat, { quality: 80 })
                    .toBuffer();
                const publicUrl = await uploadFile(optimizedBuffer, storagePathRelative, `image/${outputFormat}`);

                let metadata = { altText: componente.nombre, title: componente.nombre };
                try {
                    const descPropiedad = propiedad.websiteData?.aiDescription || propiedad.descripcion || '';
                    metadata = await generarMetadataImagen(
                        nombreEmpresa,
                        propiedad.nombre,
                        descPropiedad,
                        componente.nombre,
                        componente.tipo,
                        optimizedBuffer,
                        shotContext
                    );
                } catch (aiError) {
                    console.warn("Fallo IA Visión:", aiError.message);
                }

                const imageData = {
                    imageId,
                    storagePath: publicUrl,
                    altText: metadata.altText,
                    title: metadata.title,
                    shotContext: shotContext, // [NEW] Guardar contexto para mapeo en UI
                    advertencia: metadata.advertencia || null
                };
                await propiedadRef.update({
                    [`websiteData.images.${componentId}`]: admin.firestore.FieldValue.arrayUnion(imageData)
                });
                resultadosParaFrontend.push(imageData);
            }));

            res.status(201).json(resultadosParaFrontend);
        } catch (error) {
            console.error(`Error POST upload-image:`, error);
            next(error);
        }
    });

    router.delete('/propiedad/:propiedadId/delete-image/:componentId/:imageId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId, componentId, imageId } = req.params;
            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
            const doc = await propiedadRef.get();

            if (!doc.exists) return res.status(404).json({ error: 'No encontrada.' });

            const images = doc.data().websiteData?.images?.[componentId] || [];
            const img = images.find(i => i.imageId === imageId);

            if (img && img.storagePath) {
                await deleteFileByPath(img.storagePath);
            }

            const nuevasImagenes = images.filter(i => i.imageId !== imageId);
            await propiedadRef.update({
                [`websiteData.images.${componentId}`]: nuevasImagenes
            });

            res.status(200).json({ message: 'Eliminada.' });
        } catch (error) {
            console.error("Error delete:", error);
            next(error);
        }
    });

    router.get('/propiedad/:propiedadId/photo-plan', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, req.params.propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });

            // [NEW] Obtener configuración de tipos para saber cuántas fotos pide el usuario
            const { obtenerTiposPorEmpresa } = require('../services/componentesService');
            const tipos = await obtenerTiposPorEmpresa(db, empresaId);

            const plan = generarPlanFotos(propiedad.componentes, tipos);
            res.status(200).json(plan);
        } catch (error) { next(error); }
    });

    router.post('/fix-storage-cors', async (req, res) => {
        try {
            const bucket = admin.storage().bucket();
            await bucket.setCorsConfiguration([
                {
                    origin: ['*'],
                    method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                    responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
                    maxAgeSeconds: 3600
                }
            ]);
            res.status(200).json({ message: 'CORS configurado correctamente.' });
        } catch (error) {
            console.error('Error configurando CORS:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};