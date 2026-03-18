const express = require('express');
const { generarEstructuraAlojamiento, generarDescripcionAlojamiento } = require('../services/aiContentService');
const { obtenerTiposPorEmpresa, crearTipoComponente, analizarNuevoTipoConIA } = require('../services/componentesService');
const { obtenerTipos: obtenerTiposElemento, crearTipo: crearTipoElemento } = require('../services/tiposElementoService');
const publicAiController = require('../controllers/publicAiController'); // Assuming this controller is needed for the new route

module.exports = (db) => {
    const router = express.Router();

    // POST /api/ai/recalculate-photos
    router.post('/recalculate-photos', publicAiController.recalculatePhotos);

    // POST /api/ai/generate-structure
    router.post('/generate-structure', async (req, res, next) => {
        try {
            const { descripcion } = req.body;
            const { empresaId } = req.user;

            if (!descripcion) {
                return res.status(400).json({ error: 'La descripción es obligatoria.' });
            }

            // 1. Obtener los tipos de espacios disponibles y elementos existentes
            const tiposDisponibles = await obtenerTiposPorEmpresa(db, empresaId);
            const elementosExistentes = await obtenerTiposElemento(db, empresaId);

            // 2. Llamar a la IA para generar la estructura
            const estructuraIA = await generarEstructuraAlojamiento(descripcion, tiposDisponibles);
            const { componentes = [], ubicacion = {} } = estructuraIA;

            // 3. Inicializar seguimiento
            const suggestedNewTypes = [];
            const terminosExistentes = new Set(elementosExistentes.map(e => e.nombre.toUpperCase()));

            // 4. Resolver IDs de elementos
            for (const comp of componentes) {
                if (comp.elementos && Array.isArray(comp.elementos)) {
                    for (const elem of comp.elementos) {
                        const nombreElem = (elem.nombre || '').trim();
                        if (!nombreElem) continue;

                        // Buscar coincidencia fuzzy o directa
                        let match = elementosExistentes.find(e => e.nombre.toUpperCase() === nombreElem.toUpperCase());

                        // Si no existe, CREAR
                        if (!match) {
                            console.log(`[AI] Creando nuevo Tipo de Elemento: ${nombreElem}`);
                            const nuevoElemento = await crearTipoElemento(db, empresaId, {
                                nombre: nombreElem,
                                categoria: elem.categoria || 'OTROS',
                                icono: elem.icono || '🔹',
                                permiteCantidad: true
                            });

                            elementosExistentes.push(nuevoElemento);
                            terminosExistentes.add(nombreElem.toUpperCase());
                            match = nuevoElemento;
                            suggestedNewTypes.push({ nombre: nombreElem, categoria: elem.categoria || 'OTROS' });
                        }

                        // Asignar ID real al elemento en la estructura
                        elem.tipoId = match.id;
                        elem.icono = match.icono;
                    }
                }
            }

            // 5. Generar Descripción de Marketing (Website) automática
            let marketingDesc = "";
            try {
                console.log('[AI] Generando descripción de marketing...');
                marketingDesc = await generarDescripcionAlojamiento(
                    descripcion,
                    "Nuevo Alojamiento", // Nombre temporal 
                    "Nuestra Propiedad", // Empresa temporal
                    ubicacion ? `${ubicacion.calle || ''}, ${ubicacion.ciudad || ''}` : '',
                    "Alojamiento",
                    "Relax",
                    { componentes: componentes }
                );
            } catch (errDesc) {
                console.error("Error generando descripción marketing:", errDesc);
                marketingDesc = "";
            }

            // Devolver estructura con IDs resueltos, ubicación y descripción de marketing, y sugerencias
            res.status(200).json({ componentes, ubicacion, marketingDesc, suggestedNewTypes });

        } catch (error) {
            console.error('Error en /generate-structure:', error);
            next(error);
        }
    });

    return router;
};
