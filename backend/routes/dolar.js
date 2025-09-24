const express = require('express');
const multer = require('multer');
const { processDolarCsv } = require('../services/dolarService');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

module.exports = (db) => {
  router.post('/upload-csv', upload.single('dolarFile'), async (req, res) => {
    const year = req.body.year;
    const { empresaId } = req.user;

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }
    if (!year || isNaN(parseInt(year))) {
      return res.status(400).json({ error: 'El año es requerido y debe ser un número.' });
    }

    try {
      const summary = await processDolarCsv(db, empresaId, req.file.buffer, parseInt(year));
      res.status(200).json({
        message: 'Archivo CSV procesado exitosamente.',
        summary: summary,
      });
    } catch (error) {
      console.error('Error al procesar el archivo CSV del dólar:', error);
      res.status(500).json({ error: 'Falló el procesamiento del archivo CSV.' });
    }
  });

  return router;
};