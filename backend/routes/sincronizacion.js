const express = require('express');
const multer = require('multer');
const { procesarArchivoReservas, analizarCabeceras } = require('../services/sincronizacionService');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    // --- NUEVA RUTA --- para analizar las cabeceras de un archivo
    router.post('/analizar-archivo', upload.single('archivoMuestra'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
        }

        try {
            const cabeceras = await analizarCabeceras(req.file.buffer, req.file.originalname);
            res.status(200).json(cabeceras);
        } catch (error) {
            console.error("Error analizando cabeceras:", error);
            res.status(500).json({ error: `Error interno del servidor: ${error.message}` });
        }
    });

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