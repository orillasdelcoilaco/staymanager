const express = require('express');
const multer = require('multer');
const { processDolarCsv, getValoresPorMes, guardarValorDolar, eliminarValorDolar, obtenerValorDolarHoy } = require('../services/dolarService');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

module.exports = (db) => {
  router.post('/upload-csv', upload.single('dolarFile'), async (req, res) => {
    const year = req.body.year;
    const { empresaId } = req.user;
    if (!req.file || !year) return res.status(400).json({ error: 'Archivo y año son requeridos.' });
    try {
      const summary = await processDolarCsv(db, empresaId, req.file.buffer, parseInt(year));
      res.status(200).json({ message: 'Archivo procesado.', summary });
    } catch (error) {
      res.status(500).json({ error: `Falló el procesamiento: ${error.message}` });
    }
  });

  router.get('/hoy', async (req, res) => {
    try {
        const { empresaId } = req.user;
        const valorDolar = await obtenerValorDolarHoy(db, empresaId);
        res.status(200).json(valorDolar);
    } catch (error) {
        res.status(500).json({ error: `No se pudo obtener el valor del dólar: ${error.message}` });
    }
  });

  router.get('/valores/:year/:month', async (req, res) => {
    try {
        const { year, month } = req.params;
        const valores = await getValoresPorMes(db, req.user.empresaId, parseInt(year), parseInt(month));
        res.status(200).json(valores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
  });

  router.post('/valores', async (req, res) => {
    try {
        const resultado = await guardarValorDolar(db, req.user.empresaId, req.body);
        res.status(201).json(resultado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
  });

  router.delete('/valores/:fecha', async (req, res) => {
    try {
        await eliminarValorDolar(db, req.user.empresaId, req.params.fecha);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
  });

  return router;
};