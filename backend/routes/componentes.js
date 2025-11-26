// backend/routes/componentes.js
const express = require('express');
const { 
    obtenerTiposPorEmpresa, 
    analizarNuevoTipoConIA, 
    crearTipoComponente, 
    eliminarTipoComponente 
} = require('../services/componentesService');

module.exports = (db) => {
    const router = express.Router();

    // Obtener todos
    router.get('/', async (req, res) => {
        try {
            const tipos = await obtenerTiposPorEmpresa(db, req.user.empresaId);
            res.json(tipos);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Paso 1 del Wizard: Consultar a la IA (No guarda nada aún)
    router.post('/analizar-ia', async (req, res) => {
        try {
            const { nombre } = req.body;
            if (!nombre) return res.status(400).json({ error: "Falta el nombre" });
            
            const analisis = await analizarNuevoTipoConIA(nombre);
            res.json(analisis);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Paso 2 del Wizard: Guardar el tipo definitivo
    router.post('/', async (req, res) => {
        try {
            const nuevoTipo = await crearTipoComponente(db, req.user.empresaId, req.body);
            res.status(201).json(nuevoTipo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Eliminar
    router.delete('/:id', async (req, res) => {
        try {
            await eliminarTipoComponente(db, req.user.empresaId, req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Inicializar tipos por defecto (Seed)
    router.post('/init-defaults', async (req, res) => {
        try {
            const tiposExistentes = await obtenerTiposPorEmpresa(db, req.user.empresaId);
            if (tiposExistentes.length > 0) {
                return res.json({ message: "Ya existen tipos configurados." });
            }

            const defaults = [
                { nombreNormalizado: "Dormitorio", icono: "🛏️", shotList: ["Vista general desde la puerta", "Ángulo desde la ventana", "Detalle de la cama/almohadas", "Closet o zona de guardado"] },
                { nombreNormalizado: "Baño", icono: "🚿", shotList: ["Vista general", "Detalle de ducha/tina", "Lavamanos y espejo", "Amenities (jabón, toallas)"] },
                { nombreNormalizado: "Cocina", icono: "🍳", shotList: ["Vista general", "Electrodomésticos abiertos (refri, horno)", "Vajilla y utensilios", "Zona de café/té"] },
                { nombreNormalizado: "Living / Sala", icono: "🛋️", shotList: ["Vista general mostrando amplitud", "Sofá y TV", "Vista hacia el exterior", "Detalles decorativos"] },
                { nombreNormalizado: "Terraza / Exterior", icono: "🌲", shotList: ["Vista panorámica", "Mobiliario de terraza", "Parrilla (si aplica)", "Entorno natural"] }
            ];

            for (const tipo of defaults) {
                await crearTipoComponente(db, req.user.empresaId, { ...tipo, nombreUsuario: tipo.nombreNormalizado });
            }
            
            res.json({ message: "Tipos por defecto creados con éxito." });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};