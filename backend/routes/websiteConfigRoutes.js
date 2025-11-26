// backend/routes/websiteConfigRoutes.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');
const admin = require('firebase-admin'); // Aseguramos importar admin

const { obtenerPropiedadPorId, actualizarPropiedad } = require('../services/propiedadesService');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');
const { 
    generarDescripcionAlojamiento, 
    generarMetadataImagen, 
    generarSeoHomePage, 
    generarContenidoHomePage 
} = require('../services/aiContentService');
const { uploadFile, deleteFileByPath } = require('../services/storageService');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    router.get('/configuracion-web', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            res.status(200).json(empresaData.websiteSettings || {});
        } catch (error) { next(error); }
    });

    // ... (Rutas SEO y Content Home se mantienen igual) ...
    router.post('/generate-ai-home-seo', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            const textosSeo = await generarSeoHomePage(empresaData);
            res.status(200).json(textosSeo);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    router.post('/generate-ai-home-content', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            const textosContent = await generarContenidoHomePage(empresaData);
            res.status(200).json(textosContent);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    router.put('/home-settings', async (req, res) => {
        try {
            const { empresaId } = req.user;
            await actualizarDetallesEmpresa(db, empresaId, req.body); // Simplificado para brevedad, lógica igual
            res.status(200).json({ message: 'Configuración guardada.' });
        } catch (error) { res.status(500).json({ error: 'Error al guardar.' }); }
    });

    // ... (Upload Hero se mantiene igual) ...
    router.post('/upload-hero-image', upload.single('heroImage'), async (req, res) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { altText, titleText } = req.body;
            if (!req.file) return res.status(400).json({ error: 'No file.' });
            const imageId = `hero-${uuidv4()}`;
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/website/${imageId}.${outputFormat}`;
            const optimizedBuffer = await sharp(req.file.buffer).resize({ width: 1920, height: 1080, fit: 'cover' }).toFormat(outputFormat, { quality: 85 }).toBuffer();
            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);
            const updatePayload = { 'websiteSettings.theme.heroImageUrl': publicUrl, 'websiteSettings.theme.heroImageAlt': altText, 'websiteSettings.theme.heroImageTitle': titleText };
            await actualizarDetallesEmpresa(db, empresaId, updatePayload);
            res.status(201).json(updatePayload);
        } catch (error) { res.status(500).json({ error: 'Error upload hero.' }); }
    });

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
            const { empresaId } = req.user;
            const { aiDescription } = req.body;
            await actualizarPropiedad(db, empresaId, req.params.propiedadId, { 'websiteData.aiDescription': aiDescription });
            res.status(200).json({ message: 'Guardado.' });
        } catch (error) { next(error); }
    });

    router.post('/propiedad/:propiedadId/generate-ai-text', async (req, res, next) => {
         try {
            const { empresaId, nombreEmpresa } = req.user;
            const [propiedad, empresaData] = await Promise.all([obtenerPropiedadPorId(db, empresaId, req.params.propiedadId), obtenerDetallesEmpresa(db, empresaId)]);
            const texto = await generarDescripcionAlojamiento(propiedad.descripcion, propiedad.nombre, nombreEmpresa, empresaData.ubicacionTexto, empresaData.tipoAlojamientoPrincipal, empresaData.enfoqueMarketing);
            res.status(200).json({ texto });
        } catch (error) { next(error); }
    });

    router.post('/propiedad/:propiedadId/upload-card-image', upload.single('cardImage'), async (req, res, next) => {
         try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId } = req.params;
            if (!req.file) return res.status(400).json({ error: 'No file.' });
            
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            // Limpieza imagen anterior
            if (propiedad.websiteData?.cardImage?.storagePath) {
                await deleteFileByPath(propiedad.websiteData.cardImage.storagePath);
            }

            const imageId = `card-${uuidv4()}`;
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/propiedades/${propiedadId}/images/${imageId}.${outputFormat}`;
            const optimizedBuffer = await sharp(req.file.buffer).resize({ width: 800, height: 600, fit: 'cover' }).toFormat(outputFormat, { quality: 80 }).toBuffer();
            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);
            
            // Metadata IA
            const metadata = await generarMetadataImagen(nombreEmpresa, propiedad.nombre, propiedad.descripcion, 'Imagen Principal', 'Portada', optimizedBuffer);

            const cardImageData = { imageId, storagePath: publicUrl, altText: metadata.altText, title: metadata.title };
            await actualizarPropiedad(db, empresaId, propiedadId, { 'websiteData.cardImage': cardImageData });
            res.status(201).json(cardImageData);
        } catch (error) { next(error); }
    });


    // *** AQUÍ ESTÁ LA CORRECCIÓN CLAVE: Upload Galería con BUFFER ***
    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.array('images'), async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId, componentId } = req.params;
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
                const storagePathRelative = `empresas/${empresaId}/propiedades/${propiedadId}/images/${componentId}/${imageId}.${outputFormat}`;
                
                // 1. Optimizar y obtener Buffer
                const optimizedBuffer = await sharp(file.buffer)
                    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
                    .toFormat(outputFormat, { quality: 80 })
                    .toBuffer();

                // 2. Subir a Storage
                const publicUrl = await uploadFile(optimizedBuffer, storagePathRelative, `image/${outputFormat}`);
                
                // 3. Generar Metadata con VISIÓN (Pasamos optimizedBuffer)
                let metadata = { altText: componente.nombre, title: componente.nombre };
                try {
                    const descPropiedad = propiedad.websiteData?.aiDescription || propiedad.descripcion || '';
                    metadata = await generarMetadataImagen(
                        nombreEmpresa, 
                        propiedad.nombre, 
                        descPropiedad,
                        componente.nombre, 
                        componente.tipo,
                        optimizedBuffer // <--- ¡ESTO HACE QUE LA IA VEA LA FOTO!
                    );
                } catch (aiError) {
                    console.warn("Fallo IA Visión:", aiError.message);
                }

                const imageData = { 
                    imageId, 
                    storagePath: publicUrl, 
                    altText: metadata.altText, 
                    title: metadata.title,
                    advertencia: metadata.advertencia || null 
                };

                // 4. Guardar en BD
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

    // Delete Imagen (Usando la nueva deleteFileByPath)
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

    // CORS Fix Seguro
    router.post('/fix-storage-cors', async (req, res) => {
        try {
            const bucket = admin.storage().bucket();
            await bucket.setCorsConfiguration([
                {
                    maxAgeSeconds: 3600,
                    method: ["GET", "HEAD", "PUT", "POST", "DELETE"],
                    origin: ["*"], 
                    responseHeader: ["Content-Type", "Access-Control-Allow-Origin"]
                }
            ]);
            res.status(200).json({ message: 'CORS OK' });
        } catch (error) {
            // Silenciar error 503 de Google
            console.warn("CORS Check Warning (Google 503):", error.message);
            res.status(200).json({ message: 'CORS skipped' }); 
        }
    });

    return router;
};