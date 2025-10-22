// backend/routes/websiteConfigRoutes.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');

const { obtenerPropiedadPorId, actualizarPropiedad } = require('../services/propiedadesService');
// Importar servicios de empresa
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');
// Importar TODAS las funciones de IA
const { generarDescripcionAlojamiento, generarMetadataImagen, generarSeoHomePage, generarContenidoHomePage } = require('../services/aiContentService');
const { uploadFile, deleteFileByPath } = require('../services/storageService');
const admin = require('firebase-admin');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    // --- RUTA PARA CARGAR DATOS INICIALES ---
    router.get('/configuracion-web', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            res.status(200).json(empresaData.websiteSettings || {});
        } catch (error) {
            console.error("Error GET /website-config/configuracion-web:", error);
             next(error);
        }
    });

    // --- RUTAS PARA PÁGINA DE INICIO (HOME) ---

    // Generar textos SEO para Home (sin guardar)
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

    // Generar textos de contenido para Home (sin guardar)
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

    // Guardar textos SEO y de Contenido para Home, y config general
    router.put('/home-settings', async (req, res) => {
        try {
            const { empresaId } = req.user;
            // Recibir todos los campos del Home
            const { theme, content, seo, general } = req.body;

            // Usar notación de puntos para actualizar solo los campos enviados
            const updatePayload = {};

            // CORRECCIÓN: Usar la clave correcta sin 'general'
            if (general?.subdomain !== undefined) updatePayload['websiteSettings.subdomain'] = general.subdomain;
            if (general?.domain !== undefined) updatePayload['websiteSettings.domain'] = general.domain;

            // Mantener el resto como estaba
            if (theme?.logoUrl !== undefined) updatePayload['websiteSettings.theme.logoUrl'] = theme.logoUrl;
            if (theme?.primaryColor !== undefined) updatePayload['websiteSettings.theme.primaryColor'] = theme.primaryColor;
            if (theme?.secondaryColor !== undefined) updatePayload['websiteSettings.theme.secondaryColor'] = theme.secondaryColor;
            // No guardar heroImageUrl aquí, se guarda en su propia ruta

            if (content?.homeH1 !== undefined) updatePayload['websiteSettings.content.homeH1'] = content.homeH1;
            if (content?.homeIntro !== undefined) updatePayload['websiteSettings.content.homeIntro'] = content.homeIntro;

            if (seo?.homeTitle !== undefined) updatePayload['websiteSettings.seo.homeTitle'] = seo.homeTitle;
            if (seo?.homeDescription !== undefined) updatePayload['websiteSettings.seo.homeDescription'] = seo.homeDescription;

            if (Object.keys(updatePayload).length === 0) {
                 return res.status(200).json({ message: 'No hay cambios que guardar.' });
            }

            // Añadir logs para depuración
            console.log(`[DEBUG] Guardando home-settings para ${empresaId}. Payload:`, JSON.stringify(updatePayload, null, 2));

            await actualizarDetallesEmpresa(db, empresaId, updatePayload);

            console.log(`[DEBUG] home-settings guardado exitosamente para ${empresaId}.`);
            res.status(200).json({ message: 'Configuración de la página de inicio guardada.' });

        } catch (error) {
            console.error(`Error PUT /home-settings:`, error);
            res.status(500).json({ error: 'Error al guardar la configuración de inicio.' });
        }
    });

     // Subir imagen de portada (Hero Image)
    router.post('/upload-hero-image', upload.single('heroImage'), async (req, res) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { altText, titleText } = req.body; // Recibir alt y title manuales

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

            // Usar notación de puntos para guardar
            const updatePayload = {
                'websiteSettings.theme.heroImageUrl': publicUrl,
                'websiteSettings.theme.heroImageAlt': altText || `Portada de ${nombreEmpresa}`,
                'websiteSettings.theme.heroImageTitle': titleText || nombreEmpresa
            };
            await actualizarDetallesEmpresa(db, empresaId, updatePayload);

            res.status(201).json({
                imageUrl: publicUrl,
                altText: updatePayload['websiteSettings.theme.heroImageAlt'],
                titleText: updatePayload['websiteSettings.theme.heroImageTitle']
            });

        } catch (error) {
            console.error(`Error POST /upload-hero-image:`, error);
            res.status(500).json({ error: 'Error al subir o procesar imagen de portada.' });
        }
    });

    // --- RUTAS PARA PROPIEDADES (Sin cambios) ---

    // Obtener configuración web de una propiedad
    router.get('/propiedad/:propiedadId', async (req, res, next) => {
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
            next(error);
        }
    });

    // Guardar/Actualizar descripción IA de una Propiedad
    router.put('/propiedad/:propiedadId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const { aiDescription } = req.body;

            if (typeof aiDescription !== 'string') {
                return res.status(400).json({ error: 'Se requiere la descripción (aiDescription).' });
            }

            const updatePayload = {
                'websiteData.aiDescription': aiDescription
            };

            await actualizarPropiedad(db, empresaId, propiedadId, updatePayload);
            res.status(200).json({ message: 'Descripción guardada con éxito.' });

        } catch (error) {
            console.error(`Error PUT /website-config/propiedad/${req.params.propiedadId}:`, error);
            next(error);
        }
    });

    // Generar texto IA para una Propiedad
    router.post('/propiedad/:propiedadId/generate-ai-text', async (req, res, next) => {
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

            // Pasamos la ubicación de la empresa a la IA
            const ubicacionEmpresa = empresaData.ubicacionTexto || '';
            const tipoAlojamiento = empresaData.tipoAlojamientoPrincipal || '';
            const enfoqueMarketing = empresaData.enfoqueMarketing || '';


            const textoGenerado = await generarDescripcionAlojamiento(
                propiedad.descripcion, // Descripción manual base
                propiedad.nombre,      // Nombre de la propiedad específica
                nombreEmpresa,         // Nombre de la empresa
                ubicacionEmpresa,      // Ubicación general del negocio
                tipoAlojamiento,       // Tipo principal de alojamiento
                enfoqueMarketing       // Enfoque general de marketing
             );
            res.status(200).json({ texto: textoGenerado });

        } catch (error) {
            console.error(`Error POST /generate-ai-text/${req.params.propiedadId}:`, error);
            next(error);
        }
    });


    // Subir imágenes para un componente (con IA asíncrona)
    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.array('images'), async (req, res, next) => {
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
                    altText: "Generando...",
                    title: "Generando..."
                };

                const updatePayload = {};
                updatePayload[`websiteData.images.${componentId}`] = admin.firestore.FieldValue.arrayUnion(imageData);
                await propiedadRef.update(updatePayload);

                resultadosParaFrontend.push(imageData);

                // --- Tarea Asíncrona ---
                (async (pid, cid, imgId, url) => {
                    try {
                        // Recargar la propiedad para obtener la descripción más reciente
                        const propActualizada = await obtenerPropiedadPorId(db, empresaId, pid);
                        const descPropiedad = propActualizada?.websiteData?.aiDescription || propActualizada?.descripcion || '';

                        const metadata = await generarMetadataImagen(
                            nombreEmpresa,
                            propActualizada?.nombre || 'Propiedad',
                            descPropiedad,
                            componente.nombre,
                            componente.tipo
                        );

                        const doc = await propiedadRef.get();
                        if (!doc.exists) return;
                        const currentData = doc.data();
                        const images = currentData.websiteData?.images?.[cid] || [];
                        const imageIndex = images.findIndex(img => img.imageId === imgId);

                        if (imageIndex > -1) {
                            images[imageIndex].altText = metadata.altText;
                            images[imageIndex].title = metadata.title;

                            const updateMetaPayload = {};
                            updateMetaPayload[`websiteData.images.${cid}`] = images;
                            await propiedadRef.update(updateMetaPayload);
                        }
                    } catch (err) {
                        console.error(`[Async Upload] Error generando metadata IA para ${imgId}:`, err);
                    }
                })(propiedadId, componentId, imageId, publicUrl);
                // --- Fin Tarea Asíncrona ---
            }
            res.status(201).json(resultadosParaFrontend);

        } catch (error) {
            console.error(`Error POST /upload-image/${req.params.propiedadId}/${req.params.componentId}:`, error);
            next(error);
        }
    });


    // Eliminar una imagen específica
    router.delete('/propiedad/:propiedadId/delete-image/:componentId/:imageId', async (req, res, next) => {
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

            const bucketName = admin.storage().bucket().name;
            let storagePathToDelete = '';
            try {
                // CORRECCIÓN: Usar firebasestorage.googleapis.com
                if (imagenAEliminar.storagePath && imagenAEliminar.storagePath.startsWith(`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`)) {
                    const encodedPath = imagenAEliminar.storagePath.split(`${bucketName}/o/`)[1].split('?')[0];
                    storagePathToDelete = decodeURIComponent(encodedPath);
                    await deleteFileByPath(storagePathToDelete);
                } else {
                     console.warn(`URL de Storage no reconocida o vacía para ${imageId}: ${imagenAEliminar.storagePath}`);
                }
            } catch (storageError) {
                console.warn(`No se pudo eliminar de Storage (quizás ya estaba borrado): ${storageError.message}`);
            }

            const nuevasImagenes = imagesComponente.filter(img => img.imageId !== imageId);

            const updatePayload = {};
            // Si no quedan imágenes para el componente, eliminar la clave del componente
            if (nuevasImagenes.length > 0) {
                 updatePayload[`websiteData.images.${componentId}`] = nuevasImagenes;
            } else {
                 updatePayload[`websiteData.images.${componentId}`] = admin.firestore.FieldValue.delete();
            }
            await propiedadRef.update(updatePayload);

            res.status(200).json({ message: 'Imagen eliminada con éxito.' });

        } catch (error) {
            console.error(`Error DELETE /delete-image/${req.params.propiedadId}/${req.params.componentId}/${req.params.imageId}:`, error);
            next(error);
        }
    });

    return router;
};