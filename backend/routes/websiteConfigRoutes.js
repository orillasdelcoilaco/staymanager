// backend/routes/websiteConfigRoutes.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp'); // Necesitarás instalar sharp: npm install sharp

const { obtenerPropiedadPorId, actualizarPropiedad } = require('../services/propiedadesService');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService'); // Necesario para guardar en empresa
const { generarDescripcionAlojamiento, generarMetadataImagen, generarSeoHomePage, generarContenidoHomePage } = require('../services/aiContentService'); // Importar nuevas funciones
const { uploadFile, deleteFileByPath } = require('../services/storageService');
const admin = require('firebase-admin'); // Necesario para FieldValue

// Configuración de Multer para recibir múltiples imágenes en memoria
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

    // --- NUEVAS RUTAS PARA LA PÁGINA DE INICIO ---

    // Generar textos SEO para Home (sin guardar)
    router.post('/generate-ai-home-seo', async (req, res) => {
        try {
            const { empresaId } = req.user;
            // Necesitamos los datos de la empresa para el prompt
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
            // Necesitamos los datos de la empresa para el prompt
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            const textosContent = await generarContenidoHomePage(empresaData);
            res.status(200).json(textosContent);
        } catch (error) {
            console.error(`Error POST /generate-ai-home-content:`, error);
            res.status(500).json({ error: error.message || 'Error al generar contenido para Home.' });
        }
    });

    // Guardar textos SEO y de Contenido para Home
    router.put('/home-settings', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { metaTitle, metaDescription, h1, introParagraph } = req.body;

            // Validar que al menos uno de los textos viene
            if (metaTitle === undefined && metaDescription === undefined && h1 === undefined && introParagraph === undefined) {
                return res.status(400).json({ error: 'Se requiere al menos un campo de texto para guardar.' });
            }

            const updatePayload = {};
            if (metaTitle !== undefined || metaDescription !== undefined) {
                updatePayload['websiteSettings.seo'] = {
                    ...(metaTitle !== undefined && { homeTitle: metaTitle }),
                    ...(metaDescription !== undefined && { homeDescription: metaDescription }),
                };
            }
            if (h1 !== undefined || introParagraph !== undefined) {
                 updatePayload['websiteSettings.content'] = {
                    ...(h1 !== undefined && { homeH1: h1 }),
                    ...(introParagraph !== undefined && { homeIntro: introParagraph }),
                 };
            }

            // Usamos actualizarDetallesEmpresa que maneja el merge anidado
            await actualizarDetallesEmpresa(db, empresaId, updatePayload);
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

            if (!req.file) {
                return res.status(400).json({ error: 'No se subió archivo para imagen de portada.' });
            }

            const imageId = `hero-${uuidv4()}`;
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/website/${imageId}.${outputFormat}`;

            // Optimizar con Sharp
            const optimizedBuffer = await sharp(req.file.buffer)
                .resize({ width: 1920, height: 1080, fit: 'cover' }) // Ajustar tamaño para portada
                .toFormat(outputFormat, { quality: 85 }) // Calidad un poco más alta para hero
                .toBuffer();

            // Subir a Storage
            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // Generar Metadata IA básica (podría ser más específica si tuviéramos más contexto)
            const { altText, title } = await generarMetadataImagen(
                nombreEmpresa,
                `Portada Principal`,
                `Imagen principal del sitio web de ${nombreEmpresa}`,
                'Portada',
                'General'
            );

            // Guardar URL y metadata en el documento de la empresa
            const updatePayload = {
                websiteSettings: {
                    theme: {
                        heroImageUrl: publicUrl,
                        heroImageAlt: altText,
                        heroImageTitle: title
                    }
                }
            };
            await actualizarDetallesEmpresa(db, empresaId, updatePayload);

            res.status(201).json({ url: publicUrl, alt: altText, title: title });

        } catch (error) {
            console.error(`Error POST /upload-hero-image:`, error);
            res.status(500).json({ error: 'Error al subir o procesar imagen de portada.' });
        }
    });

    // --- RUTAS EXISTENTES PARA PROPIEDADES (con ajustes menores) ---

    // Guardar/Actualizar descripción IA de una Propiedad
    router.put('/propiedad/:propiedadId', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const { aiDescription } = req.body;

            if (typeof aiDescription !== 'string') {
                return res.status(400).json({ error: 'Se requiere la descripción (aiDescription).' });
            }

            // Usamos un update directo con notación de puntos para anidar
            const updatePayload = {
                'websiteData.aiDescription': aiDescription
            };

            await actualizarPropiedad(db, empresaId, propiedadId, updatePayload);
            res.status(200).json({ message: 'Descripción guardada con éxito.' });

        } catch (error) {
            console.error(`Error PUT /website-config/propiedad/${req.params.propiedadId}:`, error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    // Generar texto IA para una Propiedad (sin guardar)
    router.post('/propiedad/:propiedadId/generate-ai-text', async (req, res) => {
        try {
            const { empresaId, nombreEmpresa } = req.user; // Necesitamos datos de la empresa ahora
            const { propiedadId } = req.params;
            // No necesitamos 'descripcionActual' del body, la leemos de Firestore

            const [propiedad, empresaData] = await Promise.all([
                 obtenerPropiedadPorId(db, empresaId, propiedadId),
                 obtenerDetallesEmpresa(db, empresaId) // Cargar datos de la empresa
            ]);

            if (!propiedad) {
                return res.status(404).json({ error: 'Propiedad no encontrada.' });
            }

            // Pasar más contexto a la función de IA
            const textoGenerado = await generarDescripcionAlojamiento(
                propiedad.descripcion, // Descripción manual como base
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

    // Subir imágenes para un componente (sin cambios funcionales mayores)
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

            const resultadosSubida = [];
            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);

            for (const file of req.files) {
                const imageId = uuidv4();
                const outputFormat = 'webp';
                const storagePathRelative = `empresas/${empresaId}/propiedades/${propiedadId}/images/${componentId}/${imageId}.${outputFormat}`;

                const optimizedBuffer = await sharp(file.buffer)
                    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
                    .toFormat(outputFormat, { quality: 80 })
                    .toBuffer();

                const publicUrl = await uploadFile(optimizedBuffer, storagePathRelative, `image/${outputFormat}`);

                const { altText, title } = await generarMetadataImagen(
                    nombreEmpresa,
                    propiedad.nombre,
                    propiedad.websiteData?.aiDescription || propiedad.descripcion,
                    componente.nombre,
                    componente.tipo
                );

                const imageData = { imageId, storagePath: publicUrl, altText, title };
                resultadosSubida.push(imageData);

                const updatePayload = {};
                updatePayload[`websiteData.images.${componentId}`] = admin.firestore.FieldValue.arrayUnion(imageData);
                await propiedadRef.update(updatePayload);
            }

            res.status(201).json(resultadosSubida);

        } catch (error) {
            console.error(`Error POST /upload-image/${req.params.propiedadId}/${req.params.componentId}:`, error);
            res.status(500).json({ error: 'Error al subir o procesar imágenes.' });
        }
    });

    // Eliminar una imagen específica (sin cambios funcionales mayores)
    router.delete('/propiedad/:propiedadId/delete-image/:componentId/:imageId', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId, componentId, imageId } = req.params;

            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
            const propiedadDoc = await propiedadRef.get();

            if (!propiedadDoc.exists) return res.status(404).json({ error: 'Propiedad no encontrada.' });

            const imagesComponente = propiedadDoc.data().websiteData?.images?.[componentId] || [];
            const imagenAEliminar = imagesComponente.find(img => img.imageId === imageId);

            if (!imagenAEliminar) return res.status(404).json({ error: 'Imagen no encontrada.' });

            const bucketName = admin.storage().bucket().name;
            let storagePathToDelete = '';
            if (imagenAEliminar.storagePath.startsWith(`https://storage.googleapis.com/${bucketName}/`)) {
                 // Extraer la ruta correctamente decodificando la URL
                 const encodedPath = imagenAEliminar.storagePath.split(`${bucketName}/`)[1].split('?')[0]; // Quitar query params si existen
                 storagePathToDelete = decodeURIComponent(encodedPath);
            } else if (imagenAEliminar.storagePath.startsWith(`empresas/`)) {
                 // Si por alguna razón se guardó la ruta relativa (menos probable con el código actual)
                 storagePathToDelete = imagenAEliminar.storagePath;
            } else {
                 console.warn(`No se pudo extraer la ruta de storage de la URL: ${imagenAEliminar.storagePath}`);
            }

            const updatePayload = {};
            updatePayload[`websiteData.images.${componentId}`] = admin.firestore.FieldValue.arrayRemove(imagenAEliminar);
            await propiedadRef.update(updatePayload);

            if (storagePathToDelete) {
                // await deleteFileByPath(storagePathToDelete); // Asumiendo que deleteFileByPath existe y funciona con la ruta
                 // Usando deleteFileByUrl como fallback si deleteFileByPath no existe
                 await deleteFileByUrl(imagenAEliminar.storagePath);

            }

            res.status(200).json({ message: 'Imagen eliminada con éxito.' });

        } catch (error) {
            console.error(`Error DELETE /delete-image/${req.params.propiedadId}/${req.params.componentId}/${req.params.imageId}:`, error);
             if (error.code === 404 || error.message.includes('No such object')) { // Manejar error de Storage no encontrado
                 res.status(200).json({ message: 'Imagen eliminada de la base de datos (no encontrada en Storage).' });
             } else {
                res.status(500).json({ error: 'Error al eliminar la imagen.' });
            }
        }
    });

    return router;
};