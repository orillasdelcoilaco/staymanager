const express = require('express');
const multer = require('multer');
const { procesarArchivoReservas } = require('../services/sincronizacionService');

// Configuración de Multer para manejar la subida de archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    // Endpoint para subir y procesar el archivo de reservas
    router.post('/upload', upload.single('archivoReservas'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
        }

        try {
            const { empresaId } = req.user;
            const buffer = req.file.buffer;
            
            const resultados = await procesarArchivoReservas(db, empresaId, buffer);
            
            res.status(200).json({
                message: 'Archivo procesado con éxito.',
                data: resultados
            });
        } catch (error) {
            console.error("Error en la ruta de sincronización:", error);
            res.status(500).json({ error: `Error interno del servidor: ${error.message}` });
        }
    });

    return router;
};