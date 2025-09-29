const express = require('express');
const { prepararMensaje } = require('../services/mensajeService');
const { getReservasPendientes } = require('../services/gestionService'); 

module.exports = (db) => {
    const router = express.Router();

    router.post('/preparar', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { reservaIdOriginal, tipoMensaje } = req.body;

            // Re-utilizamos la lógica de getReservasPendientes para obtener el grupo completo
            const todosLosGrupos = await getReservasPendientes(db, empresaId);
            const grupoReserva = todosLosGrupos.find(g => g.reservaIdOriginal === reservaIdOriginal);
            
            if (!grupoReserva) {
                return res.status(404).json({ error: 'Grupo de reserva no encontrado.' });
            }

            const data = await prepararMensaje(db, empresaId, grupoReserva, tipoMensaje);
            res.status(200).json(data);
        } catch (error) {
            console.error("Error al preparar el mensaje:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};