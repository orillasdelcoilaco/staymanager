const express = require('express');
const multer = require('multer');
const { procesarArchivoReservas } = require('../services/sincronizacionService');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    // La ruta ahora incluye el canalId como parámetro
    router.post('/upload/:canalId', upload.single('archivoReservas'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
        }
        
        const { canalId } = req.params;
        if (!canalId) {
            return res.status(400).json({ error: 'No se ha especificado un canal.' });
        }

        try {
            const { empresaId } = req.user;
            const buffer = req.file.buffer;
            
            // Pasamos el nombre original del archivo al servicio para la detección
            const resultados = await procesarArchivoReservas(db, empresaId, canalId, buffer, req.file.originalname);
            
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