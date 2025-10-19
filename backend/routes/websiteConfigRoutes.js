// backend/routes/websiteConfigRoutes.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp'); // Necesitarás instalar sharp: npm install sharp

const { obtenerPropiedadPorId, actualizarPropiedad } = require('../services/propiedadesService');
const { generarDescripcionAlojamiento, generarMetadataImagen } = require('../services/aiContentService');
const { uploadFile, deleteFileByPath } = require('../services/storageService');
const admin = require('firebase-admin'); // Necesario para FieldValue

// Configuración de Multer para recibir múltiples imágenes en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    // Obtener configuración web de una propiedad
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

    // Guardar/Actualizar descripción IA
    router.put('/propiedad/:propiedadId', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const { aiDescription } = req.body; // Solo esperamos la descripción aquí

            if (typeof aiDescription !== 'string') {
                return res.status(400).json({ error: 'Se requiere la descripción (aiDescription).' });
            }

            const propiedadActual = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedadActual) {
                return res.status(404).json({ error: 'Propiedad no encontrada.' });
            }

            const websiteDataActualizado = {
                ...(propiedadActual.websiteData || {}),
                aiDescription: aiDescription
            };

            await actualizarPropiedad(db, empresaId, propiedadId, { websiteData: websiteDataActualizado });
            res.status(200).json({ message: 'Descripción guardada con éxito.' });

        } catch (error) {
            console.error(`Error PUT /website-config/propiedad/${req.params.propiedadId}:`, error);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });

    // Generar texto IA (sin guardar)
    router.post('/propiedad/:propiedadId/generate-ai-text', async (req, res) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId } = req.params;
            const { descripcionActual } = req.body;

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) {
                return res.status(404).json({ error: 'Propiedad no encontrada.' });
            }

            const textoGenerado = await generarDescripcionAlojamiento(descripcionActual, propiedad.nombre, nombreEmpresa);
            res.status(200).json({ texto: textoGenerado });

        } catch (error) {
            console.error(`Error POST /generate-ai-text/${req.params.propiedadId}:`, error);
            res.status(500).json({ error: error.message || 'Error al generar texto IA.' });
        }
    });

    // Subir imágenes para un componente
    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.array('images'), async (req, res) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId, componentId } = req.params;

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No se subieron archivos.' });
            }

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) {
                return res.status(404).json({ error: 'Propiedad no encontrada.' });
            }
            const componente = propiedad.componentes?.find(c => c.id === componentId);
            if (!componente) {
                return res.status(404).json({ error: 'Componente no encontrado en esta propiedad.' });
            }

            const resultadosSubida = [];
            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);

            for (const file of req.files) {
                const imageId = uuidv4();
                const fileExt = path.extname(file.originalname).toLowerCase();
                const outputFormat = 'webp'; // Siempre convertir a WebP
                const storagePath = `empresas/${empresaId}/propiedades/${propiedadId}/images/${componentId}/${imageId}.${outputFormat}`;

                // Optimizar con Sharp
                const optimizedBuffer = await sharp(file.buffer)
                    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }) // Redimensionar si es muy grande
                    .toFormat(outputFormat, { quality: 80 }) // Convertir a WebP con calidad 80
                    .toBuffer();

                // Subir a Storage
                await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);
                const publicUrl = `https://storage.googleapis.com/${admin.storage().bucket().name}/${storagePath}`; // URL pública directa

                // Generar Metadata IA
                const { altText, title } = await generarMetadataImagen(
                    nombreEmpresa,
                    propiedad.nombre,
                    propiedad.websiteData?.aiDescription || propiedad.descripcion,
                    componente.nombre,
                    componente.tipo
                );

                const imageData = { imageId, storagePath: publicUrl, altText, title }; // Guardar URL pública
                resultadosSubida.push(imageData);

                // Añadir al array en Firestore usando FieldValue.arrayUnion
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

    // Eliminar una imagen específica
    router.delete('/propiedad/:propiedadId/delete-image/:componentId/:imageId', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId, componentId, imageId } = req.params;

            const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
            const propiedadDoc = await propiedadRef.get();

            if (!propiedadDoc.exists) {
                return res.status(404).json({ error: 'Propiedad no encontrada.' });
            }

            const imagesComponente = propiedadDoc.data().websiteData?.images?.[componentId] || [];
            const imagenAEliminar = imagesComponente.find(img => img.imageId === imageId);

            if (!imagenAEliminar) {
                return res.status(404).json({ error: 'Imagen no encontrada para este componente.' });
            }

            // Extraer la ruta de storage desde la URL pública
            const bucketName = admin.storage().bucket().name;
            let storagePathToDelete = '';
            if (imagenAEliminar.storagePath.startsWith(`https://storage.googleapis.com/${bucketName}/`)) {
                storagePathToDelete = decodeURIComponent(imagenAEliminar.storagePath.split(`${bucketName}/`)[1]);
            } else {
                 console.warn(`No se pudo extraer la ruta de storage de la URL: ${imagenAEliminar.storagePath}`);
                 // Continuar para al menos eliminarla de Firestore
            }


            // Eliminar de Firestore usando FieldValue.arrayRemove
            const updatePayload = {};
            updatePayload[`websiteData.images.${componentId}`] = admin.firestore.FieldValue.arrayRemove(imagenAEliminar);
            await propiedadRef.update(updatePayload);

             // Intentar eliminar de Storage solo si tenemos la ruta
            if (storagePathToDelete) {
                await deleteFileByPath(storagePathToDelete); // Usar la función que borra por ruta
            }


            res.status(200).json({ message: 'Imagen eliminada con éxito.' });

        } catch (error) {
            console.error(`Error DELETE /delete-image/${req.params.propiedadId}/${req.params.componentId}/${req.params.imageId}:`, error);
            // Distinguir error de 'no encontrado' en storage
             if (error.message.includes('No such object')) {
                 res.status(200).json({ message: 'Imagen eliminada de la base de datos (no encontrada en Storage).' });
             } else {
                res.status(500).json({ error: 'Error al eliminar la imagen.' });
            }
        }
    });

    return router;
};