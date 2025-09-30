const express = require('express');
const multer = require('multer');
const { procesarArchivoReservas, analizarCabeceras, analizarValoresUnicosColumna } = require('../services/sincronizacionService');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

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

    router.post('/analizar-columna', upload.single('archivoMuestra'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
        }
        const { indiceColumna } = req.body;
        if (indiceColumna === undefined) {
            return res.status(400).json({ error: 'Se requiere el índice de la columna.' });
        }

        try {
            const valoresUnicos = await analizarValoresUnicosColumna(req.file.buffer, req.file.originalname, parseInt(indiceColumna));
            res.status(200).json(valoresUnicos);
        } catch (error) {
            console.error("Error analizando columna:", error);
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
            const { empresaId, email } = req.user; // Obtenemos el email del usuario
            const buffer = req.file.buffer;
            
            const resultados = await procesarArchivoReservas(db, empresaId, canalId, buffer, req.file.originalname, email);
            
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