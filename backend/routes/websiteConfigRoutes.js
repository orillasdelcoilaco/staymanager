// backend/routes/websiteConfigRoutes.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');
const { obtenerPropiedadPorId, actualizarPropiedad } = require('../services/propiedadesService');
const { obtenerDetallesEmpresa } = require('../services/empresaService');
const { generarDescripcionAlojamiento, generarMetadataImagen, generarSeoHomePage, generarContenidoHomePage } = require('../services/aiContentService');
const { uploadFile, deleteFileByPath } = require('../services/storageService');
const admin = require('firebase-admin');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    // Obtener configuración web de una propiedad (sin cambios)
    router.get('/propiedad/:propiedadId', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) {
                return res.status(404).json({ error: 'Propiedad no encontrada.' });
            }
            res.status(200).json(propiedad.websiteData || { aiDescription: '', images: {} });
        } catch (error) {
            console.error(`Error GET /website-config/propiedad/${req.params.propiedadId}:`, error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    // --- RUTAS DE PÁGINA DE INICIO (HOME) ---

    // Generar textos SEO para Home (sin cambios)
    router.post('/generate-ai-home-seo', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            const textosSeo = await generarSeoHomePage(empresaData);
            res.status(200).json(textosSeo);
        } catch (error) {
            console.error(`Error POST /generate-ai-home-seo:`, error);
            res.status(500).json({ error: error.message || 'Error al generar textos SEO para Home.' });
        }
    });

    // Generar textos de contenido para Home (sin cambios)
    router.post('/generate-ai-home-content', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            const textosContent = await generarContenidoHomePage(empresaData);
            res.status(200).json(textosContent);
        } catch (error) {
            console.error(`Error POST /generate-ai-home-content:`, error);
            res.status(500).json({ error: error.message || 'Error al generar contenido para Home.' });
        }
    });

    // *** CORRECCIÓN P1 (Guardar Textos Home) ***
    // Guardar textos SEO y de Contenido para Home
    router.put('/home-settings', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { metaTitle, metaDescription, h1, introParagraph } = req.body;

            const updatePayload = {};
            // Usamos notación de puntos para actualizar solo los campos necesarios sin borrar otros
            if (metaTitle !== undefined) updatePayload['websiteSettings.seo.homeTitle'] = metaTitle;
            if (metaDescription !== undefined) updatePayload['websiteSettings.seo.homeDescription'] = metaDescription;
            if (h1 !== undefined) updatePayload['websiteSettings.content.homeH1'] = h1;
            if (introParagraph !== undefined) updatePayload['websiteSettings.content.homeIntro'] = introParagraph;

            // Usamos update con notación de puntos, que es seguro
            const empresaRef = db.collection('empresas').doc(empresaId);
            await empresaRef.update(updatePayload);

            res.status(200).json({ message: 'Configuración de la página de inicio guardada.' });

        } catch (error) {
            console.error(`Error PUT /home-settings:`, error);
            res.status(500).json({ error: 'Error al guardar la configuración de inicio.' });
        }
    });

    // *** CORRECCIÓN P1 (Guardar Imagen Portada) ***
    // (Asegurarnos que la subida también use 'update' o 'set/merge')
    router.post('/upload-hero-image', upload.single('heroImage'), async (req, res) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;

            if (!req.file) {
                return res.status(400).json({ error: 'No se subió archivo para imagen de portada.' });
            }

            const imageId = `hero-${uuidv4()}`;
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/website/${imageId}.${outputFormat}`;

            const optimizedBuffer = await sharp(req.file.buffer)
                .resize({ width: 1920, height: 1080, fit: 'cover' })
                .toFormat(outputFormat, { quality: 85 })
                .toBuffer();

            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // Responder rápido (la IA de metadata puede tardar)
            res.status(201).json({ url: publicUrl, alt: "Generando...", title: "Generando..." });

            // --- Tarea Asíncrona (después de responder) ---
            generarMetadataImagen(
                nombreEmpresa,
                `Portada Principal`,
                `Imagen principal del sitio web de ${nombreEmpresa}`,
                'Portada',
                'General'
            ).then(async (metadata) => {
                const updatePayload = {
                    'websiteSettings.theme.heroImageUrl': publicUrl,
                    'websiteSettings.theme.heroImageAlt': metadata.altText,
                    'websiteSettings.theme.heroImageTitle': metadata.title
                };
                const empresaRef = db.collection('empresas').doc(empresaId);
                await empresaRef.update(updatePayload);
                console.log(`[Async Hero Upload] Metadata IA guardada para ${empresaId}`);
            }).catch(err => {
                console.error(`[Async Hero Upload] Error generando metadata IA para ${empresaId}:`, err);
            });
            // --- Fin Tarea Asíncrona ---

        } catch (error) {
            console.error(`Error POST /upload-hero-image:`, error);
            res.status(500).json({ error: 'Error al subir o procesar imagen de portada.' });
        }
    });

    // --- RUTAS DE PROPIEDADES ---

    // *** CORRECCIÓN P1 (Guardar Descripción Propiedad) ***
    // Guardar/Actualizar descripción IA de una Propiedad
    router.put('/propiedad/:propiedadId', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const { aiDescription } = req.body;

            if (typeof aiDescription !== 'string') {
                return res.status(400).json({ error: 'Se requiere la descripción (aiDescription).' });
            }

            // Usamos notación de puntos para actualizar solo este campo
            // sin sobrescribir 'websiteData.images'
            const updatePayload = {
                'websiteData.aiDescription': aiDescription
            };

            // actualizarPropiedad (de propiedadesService) debe usar 'set' con 'merge: true'
            // o 'update' para que esto funcione.
            await actualizarPropiedad(db, empresaId, propiedadId, updatePayload);
            res.status(200).json({ message: 'Descripción guardada con éxito.' });

        } catch (error) {
            console.error(`Error PUT /website-config/propiedad/${req.params.propiedadId}:`, error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    // Generar texto IA para una Propiedad (sin cambios)
    router.post('/propiedad/:propiedadId/generate-ai-text', async (req, res) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId } = req.params;

            const [propiedad, empresaData] = await Promise.all([
                 obtenerPropiedadPorId(db, empresaId, propiedadId),
                 obtenerDetallesEmpresa(db, empresaId)
            ]);

            if (!propiedad) {
                return res.status(404).json({ error: 'Propiedad no encontrada.' });
            }

            const textoGenerado = await generarDescripcionAlojamiento(
                propiedad.descripcion,
                propiedad.nombre,
                nombreEmpresa,
                empresaData.ubicacionTexto,
                empresaData.tipoAlojamientoPrincipal,
                empresaData.enfoqueMarketing
             );
            res.status(200).json({ texto: textoGenerado });

        } catch (error) {
            console.error(`Error POST /generate-ai-text/${req.params.propiedadId}:`, error);
            res.status(500).json({ error: error.message || 'Error al generar texto IA para propiedad.' });
        }
    });

    // *** CORRECCIÓN P2/P3 (Subida de Imagen Rápida/Asíncrona) ***
    // Subir imágenes para un componente
    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.array('images'), async (req, res) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId, componentId } = req.params;

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No se subieron archivos.' });
            }

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });
            const componente = propiedad.componentes?.find(c => c.id === componentId);
            if (!componente) return res.status(404).json({ error: 'Componente no encontrado.' });

            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
            const resultadosParaFrontend = [];

            for (const file of req.files) {
                const imageId = uuidv4();
                const outputFormat = 'webp';
                const storagePathRelative = `empresas/${empresaId}/propiedades/${propiedadId}/images/${componentId}/${imageId}.${outputFormat}`;

                const optimizedBuffer = await sharp(file.buffer)
                    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
                    .toFormat(outputFormat, { quality: 80 })
                    .toBuffer();

                const publicUrl = await uploadFile(optimizedBuffer, storagePathRelative, `image/${outputFormat}`);

                const imageData = {
                    imageId,
                    storagePath: publicUrl,
                    altText: "Generando...", // Placeholder
                    title: "Generando..."   // Placeholder
                };

                // Guardar datos iniciales (rápidos) en Firestore
                const updatePayload = {};
                updatePayload[`websiteData.images.${componentId}`] = admin.firestore.FieldValue.arrayUnion(imageData);
                await propiedadRef.update(updatePayload);

                resultadosParaFrontend.push(imageData); // Enviar datos placeholder al frontend

                // --- Tarea Asíncrona (después de guardar) ---
                // (Usamos IIFE para capturar las variables 'imageId' y 'publicUrl' en el scope)
                (async (pid, cid, imgId, url) => {
                    try {
                        const metadata = await generarMetadataImagen(
                            nombreEmpresa,
                            propiedad.nombre,
                            propiedad.websiteData?.aiDescription || propiedad.descripcion,
                            componente.nombre,
                            componente.tipo
                        );
                        
                        // Leer el documento, modificar el array y re-escribir (forma más segura de actualizar un array)
                        const doc = await propiedadRef.get();
                        const currentData = doc.data();
                        const images = currentData.websiteData?.images?.[cid] || [];
                        const imageIndex = images.findIndex(img => img.imageId === imgId);

                        if (imageIndex > -1) {
                            images[imageIndex].altText = metadata.altText;
                            images[imageIndex].title = metadata.title;
                            
                            const updateMetaPayload = {};
                            updateMetaPayload[`websiteData.images.${cid}`] = images;
                            await propiedadRef.update(updateMetaPayload);
                            console.log(`[Async Upload] Metadata IA guardada para ${imgId} en ${cid}`);
                        }
                    } catch (err) {
                        console.error(`[Async Upload] Error generando metadata IA para ${imgId}:`, err);
                    }
                })(propiedadId, componentId, imageId, publicUrl);
                // --- Fin Tarea Asíncrona ---
            }

            // Responder al frontend INMEDIATAMENTE
            res.status(201).json(resultadosParaFrontend);

        } catch (error) {
            console.error(`Error POST /upload-image/${req.params.propiedadId}/${req.params.componentId}:`, error);
            res.status(500).json({ error: 'Error al subir o procesar imágenes.' });
        }
    });


    // *** CORRECCIÓN P4 (Borrado Robusto) ***
    // Eliminar una imagen específica
    router.delete('/propiedad/:propiedadId/delete-image/:componentId/:imageId', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId, componentId, imageId } = req.params;

            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
            const propiedadDoc = await propiedadRef.get();

            if (!propiedadDoc.exists) return res.status(404).json({ error: 'Propiedad no encontrada.' });

            const currentWebsiteData = propiedadDoc.data().websiteData || { images: {} };
            const imagesComponente = currentWebsiteData.images?.[componentId] || [];
            const imagenAEliminar = imagesComponente.find(img => img.imageId === imageId);

            if (!imagenAEliminar) return res.status(404).json({ error: 'Imagen no encontrada.' });

            // 1. Eliminar de Storage
            const bucketName = admin.storage().bucket().name;
            let storagePathToDelete = '';
            try {
                if (imagenAEliminar.storagePath.startsWith(`https://storage.googleapis.com/${bucketName}/`)) {
                    const encodedPath = imagenAEliminar.storagePath.split(`${bucketName}/`)[1].split('?')[0];
                    storagePathToDelete = decodeURIComponent(encodedPath);
                    await deleteFileByPath(storagePathToDelete);
                }
            } catch (storageError) {
                console.warn(`No se pudo eliminar de Storage (quizás ya estaba borrado): ${storageError.message}`);
                // No detenemos la ejecución, continuamos para borrar de Firestore
            }

            // 2. Eliminar de Firestore (Método robusto: filter y re-write)
            const nuevasImagenes = imagesComponente.filter(img => img.imageId !== imageId);
            
            const updatePayload = {};
            updatePayload[`websiteData.images.${componentId}`] = nuevasImagenes;
            await propiedadRef.update(updatePayload);

            res.status(200).json({ message: 'Imagen eliminada con éxito.' });

        } catch (error) {
            console.error(`Error DELETE /delete-image/${req.params.propiedadId}/${req.params.componentId}/${req.params.imageId}:`, error);
            res.status(500).json({ error: 'Error al eliminar la imagen.' });
        }
    });

    return router;
};