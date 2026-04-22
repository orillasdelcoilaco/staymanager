// backend/routes/crm.js
const express = require('express');
const { obtenerClientesPorSegmento, obtenerDashboardCRM } = require('../services/crmService');
const { generateForTask } = require('../services/aiContentService');
const { AI_TASK } = require('../services/ai/aiEnums');
const { sanitizeInput } = require('../services/ai/prompts/sanitizer');
const { promptCampanaMensaje } = require('../services/ai/prompts/crm');
const { recalcularEstadisticasClientes } = require('../services/clientesService');
const { crearCampanaYRegistrarInteracciones, actualizarEstadoInteraccion, obtenerCampanas, obtenerInteraccionesCampana } = require('../services/campanasService');
const { generarCuponParaCliente, validarCupon, obtenerCuponesCliente, obtenerTodosCupones, obtenerUsoCupon, editarCupon, eliminarCupon } = require('../services/cuponesService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/dashboard', async (req, res) => {
        try {
            const dashboard = await obtenerDashboardCRM(db, req.user.empresaId);
            res.status(200).json(dashboard);
        } catch (error) {
            console.error('Error al obtener dashboard CRM:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/recalcular-segmentos', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const stats = await recalcularEstadisticasClientes(db, empresaId);
            res.status(200).json({
                message: 'Segmentación actualizada según reservas confirmadas y reglas RFM.',
                actualizados: stats.actualizados,
                total: stats.total,
            });
        } catch (error) {
            console.error("Error al recalcular segmentos:", error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/segmento/:segmento', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { segmento } = req.params;
            const clientes = await obtenerClientesPorSegmento(db, empresaId, segmento);
            res.status(200).json(clientes);
        } catch (error) {
            console.error(`Error al obtener clientes del segmento ${req.params.segmento}:`, error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/campanas', async (req, res) => {
        try {
            const { empresaId, email } = req.user;
            const datosCampana = { ...req.body, autor: email };
            const nuevaCampana = await crearCampanaYRegistrarInteracciones(db, empresaId, datosCampana);
            res.status(201).json(nuevaCampana);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/campanas', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const campanas = await obtenerCampanas(db, empresaId);
            res.status(200).json(campanas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/campanas/:campanaId/interacciones', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { campanaId } = req.params;
            const interacciones = await obtenerInteraccionesCampana(db, empresaId, campanaId);
            res.status(200).json(interacciones);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/interacciones/:interaccionId', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { interaccionId } = req.params;
            const { estado } = req.body;
            await actualizarEstadoInteraccion(db, empresaId, interaccionId, estado);
            res.status(200).json({ message: 'Estado actualizado.' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/cupones', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { clienteId, porcentajeDescuento, usosMaximos, vigenciaDesde, vigenciaHasta } = req.body;
            const nuevoCupon = await generarCuponParaCliente(db, empresaId, clienteId, {
                porcentajeDescuento, usosMaximos, vigenciaDesde, vigenciaHasta
            });
            res.status(201).json(nuevoCupon);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Cupones de un cliente (auto-detección en Agregar Propuesta)
    router.get('/cupones/cliente/:clienteId', async (req, res) => {
        try {
            const cupones = await obtenerCuponesCliente(db, req.user.empresaId, req.params.clienteId);
            res.status(200).json(cupones);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Todos los cupones (tab CRM)
    router.get('/cupones/todos', async (req, res) => {
        try {
            const cupones = await obtenerTodosCupones(db, req.user.empresaId);
            res.status(200).json(cupones);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Detalle de uso de un cupón
    router.get('/cupones/:codigo/uso', async (req, res) => {
        try {
            const uso = await obtenerUsoCupon(db, req.user.empresaId, req.params.codigo);
            res.status(200).json(uso);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/cupones/validar/:codigo', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { codigo } = req.params;
            const cupon = await validarCupon(db, empresaId, codigo);
            res.status(200).json(cupon);
        } catch (error) {
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    // Editar cupón
    router.put('/cupones/:id', async (req, res) => {
        try {
            const cupon = await editarCupon(db, req.user.empresaId, req.params.id, req.body);
            res.status(200).json(cupon);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Eliminar cupón (solo si no fue usado)
    router.delete('/cupones/:id', async (req, res) => {
        try {
            const result = await eliminarCupon(db, req.user.empresaId, req.params.id);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    router.post('/redactar-promocion', async (req, res) => {
        try {
            const { idea, segmento } = req.body;
            if (!idea) return res.status(400).json({ error: 'Se requiere una idea para la promoción.' });

            const empresaId = req.user.empresaId;
            const safeIdea = sanitizeInput(idea, AI_TASK.CRM_DRAFTING, { empresaId, campo: 'idea' });
            const prompt = promptCampanaMensaje({
                nombreEmpresa: req.user.empresa || '',
                objetivo: safeIdea,
                canal: 'whatsapp',
                tono: 'cercano y profesional',
                detallesExtra: segmento ? `Segmento: ${segmento}. Incluir [NOMBRE_CLIENTE] al inicio. Mencionar [CUPON_DESCUENTO] si hay descuento.` : 'Incluir [NOMBRE_CLIENTE] al inicio.'
            });

            const resultado = await generateForTask(AI_TASK.CRM_DRAFTING, prompt, { empresaId });
            if (!resultado) return res.status(500).json({ error: 'No se pudo generar el mensaje. Intente nuevamente.' });

            res.status(200).json({ mensaje: resultado.cuerpo || resultado.mensaje || '' });
        } catch (error) {
            if (error.code === 'AI_INJECTION_DETECTED') {
                return res.status(400).json({ error: 'El texto contiene instrucciones no permitidas.' });
            }
            console.error('Error al redactar promoción:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};