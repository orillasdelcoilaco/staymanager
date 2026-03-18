// backend/routes/componentes.js
const express = require('express');
const {
    obtenerTiposPorEmpresa,
    analizarNuevoTipoConIA,
    crearTipoComponente,
    eliminarTipoComponente
} = require('../services/componentesService');

const {
    obtenerTipos: obtenerTiposElemento,
    crearTipo: crearTipoElemento,
    buscarTipoFuzzy
} = require('../services/tiposElementoService');

const aiContentService = require('../services/aiContentService');

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
            if (error.code === 'AI_QUOTA_EXCEEDED') {
                return res.status(422).json({
                    message: error.message,
                    action_required: 'retry_later',
                    fallback: {
                        nombreNormalizado: req.body.nombre,
                        icono: '🏠',
                        descripcionBase: 'Espacio del alojamiento.',
                        shotList: ['Vista general', 'Detalle equipamiento'],
                        inventarioSugerido: [],
                        palabrasClave: [req.body.nombre]
                    }
                });
            }
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            console.log(`[API] POST /componentes - Payload received:`, JSON.stringify(req.body.inventarioSugerido));

            // 1. Procesar Inventario Sugerido (IA) - PREVIO a crear el componente
            // Esto asegura que los activos existan y puedan vincularse como 'elementosDefault'
            const elementosVinculados = [];

            if (req.body.inventarioSugerido && Array.isArray(req.body.inventarioSugerido)) {
                console.log(`[API] Procesando inventario sugerido para Auto-Creation...`);
                // const tiposExistentes = await obtenerTiposElemento(db, req.user.empresaId); // Ya no se usa para evitar scan completo

                for (const item of req.body.inventarioSugerido) {
                    const nombreItem = (item.nombre || '').trim();
                    if (!nombreItem) continue;

                    // ZERO-SHOT: Buscar si ya existe usando Fuzzy Match (Fuse.js)
                    let tipoElemento = await buscarTipoFuzzy(db, req.user.empresaId, nombreItem);

                    if (!tipoElemento) {
                        console.log(`[API] Creando nuevo tipo de elemento sugerido: ${nombreItem}`);

                        // Enriquecer con IA antes de persistir
                        let datos = {
                            nombre: nombreItem,
                            categoria: item.categoria || 'EQUIPAMIENTO',
                            icono: '🔹',
                            permiteCantidad: true
                        };

                        try {
                            const categoriasBase = ['Dormitorio', 'Baño', 'Cocina', 'Estar', 'Comedor', 'Exterior', 'Tecnología'];
                            const aiResult = await aiContentService.analizarMetadataActivo(nombreItem, categoriasBase);
                            if (aiResult) {
                                datos = {
                                    nombre: aiResult.normalized_name || nombreItem,
                                    categoria: aiResult.category || item.categoria || 'EQUIPAMIENTO',
                                    icono: aiResult.icon || '🔹',
                                    permiteCantidad: true,
                                    capacity: aiResult.capacity || 0,
                                    countable: aiResult.countable !== undefined ? aiResult.countable : true,
                                    requires_photo: aiResult.requires_photo || false,
                                    photo_quantity: aiResult.photo_quantity || 0,
                                    seo_tags: aiResult.seo_tags || [],
                                    sales_context: aiResult.sales_context || '',
                                    photo_guidelines: aiResult.photo_guidelines || '',
                                    schema_type: aiResult.schema_type || 'LocationFeatureSpecification',
                                    schema_property: aiResult.schema_property || 'amenityFeature',
                                    ai_autofilled: true
                                };
                            }
                        } catch (aiError) {
                            console.warn(`[API] IA no disponible para "${nombreItem}": ${aiError.message}. Usando datos básicos.`);
                        }

                        const nuevo = await crearTipoElemento(db, req.user.empresaId, datos);
                        tipoElemento = nuevo;
                    }

                    // Preparamos para vincular
                    if (tipoElemento && tipoElemento.id) {
                        elementosVinculados.push({
                            tipoId: tipoElemento.id,
                            nombre: tipoElemento.nombre,
                            icono: tipoElemento.icono,
                            cantidad: item.cantidad || 1
                        });
                    }
                }
            }

            // 2. Fusionar con lo que el usuario seleccionó manualmente en el Wizard
            // (Si el usuario ya seleccióno algo, lo respetamos. Si la IA sugirió algo nuevo, lo agregamos).
            const defaultsUsuario = Array.isArray(req.body.elementosDefault) ? req.body.elementosDefault : [];

            // Unificar listas (evitar duplicados por ID)
            const mapDefaults = new Map();
            defaultsUsuario.forEach(d => mapDefaults.set(d.tipoId, d));
            elementosVinculados.forEach(d => {
                if (!mapDefaults.has(d.tipoId)) {
                    mapDefaults.set(d.tipoId, d);
                }
            });

            const payloadFinal = {
                ...req.body,
                elementosDefault: Array.from(mapDefaults.values())
            };

            // 3. Crear el Tipo de Componente con todos los elementos vinculados
            const nuevoTipo = await crearTipoComponente(db, req.user.empresaId, payloadFinal);

            res.status(201).json(nuevoTipo);
        } catch (error) {
            console.error("[API Error] POST /componentes:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            console.log(`[API] PUT /componentes/${req.params.id} - Updating...`);

            // Reutilizamos la lógica de vinculación de POST si es necesaria,
            // pero por simplicidad asumimos que la data ya viene procesada por el Wizard frontend
            // (inventory mapping is handled in frontend wizard before submit)

            const { actualizarTipoComponente } = require('../services/componentesService');
            const actualizado = await actualizarTipoComponente(db, req.user.empresaId, req.params.id, req.body);

            res.json(actualizado);
        } catch (error) {
            console.error("[API Error] PUT /componentes/:id", error);
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
                { nombreNormalizado: "Dormitorio en Suite", icono: "🛌", descripcionBase: "Dormitorio con baño privado.", shotList: ["Vista general", "Cama", "Baño en suite", "Closet"] },
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