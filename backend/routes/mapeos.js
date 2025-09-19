const express = require('express');
const {
    guardarMapeosPorCanal,
    obtenerMapeosPorEmpresa
} = require('../services/mapeosService');

module.exports = (db) => {
    const router = express.Router();

    // Obtiene todos los mapeos de la empresa
    router.get('/', async (req, res) => {
        try {
            const mapeos = await obtenerMapeosPorEmpresa(db, req.user.empresaId);
            res.status(200).json(mapeos);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Guarda o actualiza todas las reglas de mapeo para un canal específico
    router.post('/:canalId', async (req, res) => {
        try {
            const { canalId } = req.params;
            const { mapeos } = req.body; // Espera un array de objetos de mapeo
            await guardarMapeosPorCanal(db, req.user.empresaId, canalId, mapeos);
            res.status(200).json({ message: 'Mapeos guardados con éxito.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};