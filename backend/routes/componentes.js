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

    router.get('/', async (req, res) => {
        try {
            // Log para verificar que el usuario está autenticado y tiene empresa
            console.log(`[API] GET /componentes - Usuario: ${req.user.email}, Empresa: ${req.user.empresaId}`);
            const tipos = await obtenerTiposPorEmpresa(db, req.user.empresaId);
            res.json(tipos);
        } catch (error) {
            console.error("[API Error] GET /:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/analizar-ia', async (req, res) => {
        try {
            const { nombre } = req.body;
            const analisis = await analizarNuevoTipoConIA(nombre);
            res.json(analisis);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const nuevoTipo = await crearTipoComponente(db, req.user.empresaId, req.body);
            res.status(201).json(nuevoTipo);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            await eliminarTipoComponente(db, req.user.empresaId, req.params.id);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Inicializar tipos por defecto
    router.post('/init-defaults', async (req, res) => {
        try {
            console.log(`[API] Iniciando defaults para empresa: ${req.user.empresaId}`);
            const { empresaId } = req.user;
            
            // 1. Verificar existencia
            const tiposExistentes = await obtenerTiposPorEmpresa(db, empresaId);
            if (tiposExistentes.length > 0) {
                console.log(`[API] Ya existen ${tiposExistentes.length} tipos. Abortando init.`);
                return res.json({ message: `Ya existen ${tiposExistentes.length} tipos configurados.`, created: [] });
            }

            // 2. Definir defaults
            const defaults = [
                { nombreNormalizado: "Dormitorio", icono: "🛏️", descripcionBase: "Espacio para dormir.", shotList: ["Vista general", "Cama", "Closet"] },
                { nombreNormalizado: "Baño", icono: "🚿", descripcionBase: "Cuarto de baño.", shotList: ["Vista general", "Ducha", "Lavabo"] },
                { nombreNormalizado: "Cocina", icono: "🍳", descripcionBase: "Zona de cocina.", shotList: ["General", "Equipamiento"] },
                { nombreNormalizado: "Sala de Estar", icono: "🛋️", descripcionBase: "Zona social.", shotList: ["General", "Vistas"] },
                { nombreNormalizado: "Exterior", icono: "🌲", descripcionBase: "Aire libre.", shotList: ["General", "Entorno"] }
            ];

            // 3. Crear secuencialmente para evitar race conditions y ver logs
            const creados = [];
            for (const tipo of defaults) {
                const t = await crearTipoComponente(db, empresaId, { 
                    ...tipo, 
                    nombreUsuario: tipo.nombreNormalizado,
                    origen: 'sistema'
                });
                creados.push(t);
            }
            
            console.log(`[API] Se crearon ${creados.length} tipos exitosamente.`);
            
            // Devolver lo que se creó para confirmación visual en frontend (si se inspecciona red)
            res.json({ 
                message: "Tipos por defecto creados con éxito.", 
                count: creados.length,
                created: creados 
            });

        } catch (error) {
            console.error("[API Error] Init Defaults:", error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};