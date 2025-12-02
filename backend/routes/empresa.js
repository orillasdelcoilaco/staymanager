// backend/routes/empresa.js
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { uploadFile } = require('../services/storageService');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');

// Configuración de Multer para manejar la subida del logo en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
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