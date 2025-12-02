// backend/routes/empresa.js
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { uploadFile } = require('../services/storageService');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');

// Configuración de Multer para manejar la subida del logo en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

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
            // Usamos la notación de puntos para actualizar solo el campo logoUrl anidado
            const updatePayload = {
                'websiteSettings.theme.logoUrl': publicUrl
            };
        });


    // --- RUTAS EXISTENTES ---

    // Obtener los detalles de la empresa (para la vista "Gestionar Empresa")
    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const detalles = await obtenerDetallesEmpresa(db, empresaId);
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
            const datosActualizados = req.body;

            // Eliminar logoUrl si se envió accidentalmente con el formulario principal
            // (Se maneja por la ruta /upload-logo)
            if (datosActualizados.websiteSettings && datosActualizados.websiteSettings.theme) {
                delete datosActualizados.websiteSettings.theme.logoUrl;
            }

            await actualizarDetallesEmpresa(db, empresaId, datosActualizados);
            res.status(200).json({ message: 'Datos de la empresa actualizados con éxito.' });
        } catch (error) {
            console.error("Error al actualizar detalles de la empresa:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};