const express = require('express');
const {
    guardarMapeosPorCanal,
    obtenerMapeosPorEmpresa
} = require('../services/mapeosService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const mapeos = await obtenerMapeosPorEmpresa(db, req.user.empresaId);
            res.status(200).json(mapeos);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/:canalId', async (req, res) => {
        try {
            const { canalId } = req.params;
            const { mapeos, formatoFecha, separadorDecimal, configuracionIva, mapeosDeEstado } = req.body; 
            await guardarMapeosPorCanal(db, req.user.empresaId, canalId, mapeos, formatoFecha, separadorDecimal, configuracionIva, mapeosDeEstado);
            res.status(200).json({ message: 'Mapeos guardados con éxito.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};