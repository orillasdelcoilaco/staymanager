const express = require('express');
const router = express.Router();
const jsonParser = express.json();

// Se usan los nombres de archivo en plural, confirmados con la lista de tu proyecto.
const { generarTextoPresupuesto } = require('../services/presupuestosService');

module.exports = (db) => {

    // Esta es la ruta que tu frontend está llamando y que causaba el error 500.
    // Ahora está implementada correctamente para la arquitectura multi-empresa.
    router.post('/generar-texto', jsonParser, async (req, res) => {
        try {
            // Se obtiene el empresaId del usuario autenticado (esto era lo que faltaba).
            const { empresaId } = req.user;
            const { cliente, fechaLlegada, fechaSalida, propiedades, personas } = req.body;

            if (!cliente || !fechaLlegada || !fechaSalida || !propiedades || !personas) {
                return res.status(400).json({ error: 'Faltan datos para generar el texto del presupuesto.' });
            }
            
            // Se llama a la función del servicio con todos los parámetros necesarios, incluyendo el empresaId.
            const texto = await generarTextoPresupuesto(db, empresaId, cliente, fechaLlegada, fechaSalida, propiedades, personas);

            // Se devuelve el texto generado al frontend.
            res.status(200).json({ texto });

        } catch (error) {
            console.error("Error al generar texto del presupuesto:", error);
            res.status(500).json({ error: 'Error interno del servidor al generar el presupuesto.' });
        }
    });

    return router;
};