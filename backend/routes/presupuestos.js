// backend/routes/presupuestos.js
const express = require('express');
const router = express.Router();
const jsonParser = express.json();

// *** INICIO DE LA CORRECCIÓN ***
// Importar la función desde el servicio correcto (mensajeService.js)
const { generarTextoPresupuesto } = require('../services/mensajeService');
// *** FIN DE LA CORRECCIÓN ***


module.exports = (db) => {

    // Ruta para generar el texto del presupuesto
    router.post('/generar-texto', jsonParser, async (req, res) => {
        try {
            // Se obtiene el empresaId del usuario autenticado
            const { empresaId } = req.user;
            const { cliente, fechaLlegada, fechaSalida, propiedades, personas } = req.body;

            if (!cliente || !fechaLlegada || !fechaSalida || !propiedades || !personas) {
                return res.status(400).json({ error: 'Faltan datos para generar el texto del presupuesto.' });
            }

            // Llamar a la función importada (ahora desde mensajeService)
            const texto = await generarTextoPresupuesto(db, empresaId, cliente, fechaLlegada, fechaSalida, propiedades, personas);

            // Devolver el texto generado
            res.status(200).json({ texto });

        } catch (error) {
            console.error("Error al generar texto del presupuesto:", error);
            // Devolver el mensaje de error específico si existe
            res.status(500).json({ error: error.message || 'Error interno del servidor al generar el presupuesto.' });
        }
    });

    // (Otras rutas relacionadas con presupuestos podrían ir aquí si las hubiera)

    return router;
};