// backend/routes/websiteConfigRoutes.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');

const { obtenerPropiedadPorId, actualizarPropiedad } = require('../services/propiedadesService');
// Asegurar que ambos servicios de empresa estén importados
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');
const { generarDescripcionAlojamiento, generarMetadataImagen, generarSeoHomePage, generarContenidoHomePage } = require('../services/aiContentService');
const { uploadFile, deleteFileByPath } = require('../services/storageService');
const admin = require('firebase-admin');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    // *** INICIO VERIFICACIÓN/CORRECCIÓN ***
    // Ruta para OBTENER la configuración web de la empresa (para la carga inicial de la vista)
    router.get('/configuracion-web', async (req, res, next) => {
        try {
            const { empresaId } = req.user; // Obtener empresaId del usuario autenticado
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            // Devolver solo la parte de websiteSettings o un objeto vacío si no existe
            res.status(200).json(empresaData.websiteSettings || {});
        } catch (error) {
            console.error("Error GET /website-config/configuracion-web:", error);
             // Pasar el error al manejador de errores de Express
             next(error); // Es mejor que enviar HTML directamente
        }
    });
    // *** FIN VERIFICACIÓN/CORRECCIÓN ***

    // Obtener configuración web de una propiedad específica
    router.get('/propiedad/:propiedadId', async (req, res, next) => { // Añadir next
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
            next(error); // Pasar error
        }
    });

    // --- RUTAS DE PÁGINA DE INICIO (HOME) ---

    // Generar textos SEO para Home (sin guardar)
    router.post('/generate-ai-home-seo', async (req, res, next) => { // Añadir next
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            const textosSeo = await generarSeoHomePage(empresaData);
            res.status(200).json(textosSeo);
        } catch (error) {
            console.error(`Error POST /generate-ai-home-seo:`, error);
            next(error); // Pasar error
        }
    });

    // Generar textos de contenido para Home (sin guardar)
    router.post('/generate-ai-home-content', async (req, res, next) => { // Añadir next
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            const textosContent = await generarContenidoHomePage(empresaData);
            res.status(200).json(textosContent);
        } catch (error) {
            console.error(`Error POST /generate-ai-home-content:`, error);
            next(error); // Pasar error
        }
    });

    // Guardar textos SEO y de Contenido para Home
    router.put('/home-settings', async (req, res, next) => { // Añadir next
        try {
            const { empresaId } = req.user;
            const { metaTitle, metaDescription, h1, introParagraph } = req.body;

            if (metaTitle === undefined && metaDescription === undefined && h1 === undefined && introParagraph === undefined) {
                return res.status(400).json({ error: 'Se requiere al menos un campo de texto para guardar.' });
            }

            const updatePayload = {};
            if (metaTitle !== undefined) updatePayload['websiteSettings.seo.homeTitle'] = metaTitle;
            if (metaDescription !== undefined) updatePayload['websiteSettings.seo.homeDescription'] = metaDescription;
            if (h1 !== undefined) updatePayload['websiteSettings.content.homeH1'] = h1;
            if (introParagraph !== undefined) updatePayload['websiteSettings.content.homeIntro'] = introParagraph;

            await actualizarDetallesEmpresa(db, empresaId, updatePayload);
            res.status(200).json({ message: 'Configuración de la página de inicio guardada.' });

        } catch (error) {
            console.error(`Error PUT /home-settings:`, error);
            next(error); // Pasar error
        }
    });

     // Subir imagen de portada (Hero Image)
    router.post('/upload-hero-image', upload.single('heroImage'), async (req, res, next) => { // Añadir next
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
                await actualizarDetallesEmpresa(db, empresaId, updatePayload);
                console.log(`[Async Hero Upload] Metadata IA guardada para ${empresaId}`);
            }).catch(err => {
                console.error(`[Async Hero Upload] Error generando metadata IA para ${empresaId}:`, err);
                // Considerar guardar un estado de error en Firestore si falla la IA
            });
            // --- Fin Tarea Asíncrona ---

        } catch (error) {
            console.error(`Error POST /upload-hero-image:`, error);
            next(error); // Pasar error
        }
    });

    // --- RUTAS PARA PROPIEDADES ---

    // Guardar/Actualizar descripción IA de una Propiedad
    router.put('/propiedad/:propiedadId', async (req, res, next) => { // Añadir next
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
            next(error); // Pasar error
        }
    });

    // Generar texto IA para una Propiedad
    router.post('/propiedad/:propiedadId/generate-ai-text', async (req, res, next) => { // Añadir next
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
            next(error); // Pasar error
        }
    });

    // Subir imágenes para un componente (con IA asíncrona)
    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.array('images'), async (req, res, next) => { // Añadir next
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
                        const metadata = await generarMetadataImagen(
                            nombreEmpresa,
                            propiedad.nombre,
                            propiedad.websiteData?.aiDescription || propiedad.descripcion,
                            componente.nombre,
                            componente.tipo
                        );
                        
                        const doc = await propiedadRef.get();
                        if (!doc.exists) return; // Propiedad pudo ser borrada
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
                        // Opcional: Actualizar Firestore para indicar error en 'altText'/'title'
                    }
                })(propiedadId, componentId, imageId, publicUrl);
                // --- Fin Tarea Asíncrona ---
            }
            res.status(201).json(resultadosParaFrontend);

        } catch (error) {
            console.error(`Error POST /upload-image/${req.params.propiedadId}/${req.params.componentId}:`, error);
            next(error); // Pasar error
        }
    });

    // Eliminar una imagen específica
    router.delete('/propiedad/:propiedadId/delete-image/:componentId/:imageId', async (req, res, next) => { // Añadir next
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
                if (imagenAEliminar.storagePath.startsWith(`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`)) {
                    const encodedPath = imagenAEliminar.storagePath.split(`${bucketName}/o/`)[1].split('?')[0];
                    storagePathToDelete = decodeURIComponent(encodedPath);
                    await deleteFileByPath(storagePathToDelete);
                } else {
                     console.warn(`URL de Storage no reconocida: ${imagenAEliminar.storagePath}`);
                }
            } catch (storageError) {
                console.warn(`No se pudo eliminar de Storage (quizás ya estaba borrado): ${storageError.message}`);
            }

            // 2. Eliminar de Firestore
            const nuevasImagenes = imagesComponente.filter(img => img.imageId !== imageId);
            const updatePayload = {};
            updatePayload[`websiteData.images.${componentId}`] = nuevasImagenes;
            await propiedadRef.update(updatePayload);

            res.status(200).json({ message: 'Imagen eliminada con éxito.' });

        } catch (error) {
            console.error(`Error DELETE /delete-image/${req.params.propiedadId}/${req.params.componentId}/${req.params.imageId}:`, error);
            next(error); // Pasar error
        }
    });

    return router;
};