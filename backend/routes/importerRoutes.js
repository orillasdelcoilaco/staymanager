/**
 * importerRoutes.js
 *
 * Rutas para el "Importador Mágico":
 *   GET  /importer/stream/:sessionId — SSE: emite logs en tiempo real al cliente
 *   POST /api/importer/analyze       — Analiza una URL y retorna ImportData preview
 *   POST /api/importer/create        — Crea la empresa completa desde ImportData + credenciales
 */

const express = require('express');
const { AsyncLocalStorage } = require('async_hooks');
const { analyzeWebsite } = require('../services/webImporterService');
const { createEmpresaFromImport } = require('../services/empresaImporterService');

// ─── SSE Log Streaming ──────────────────────────────────────────────────────

// Almacena las respuestas SSE activas por sessionId
const sseStreams = new Map();

// AsyncLocalStorage para enrutar logs al stream correcto sin tocar los servicios
const logStorage = new AsyncLocalStorage();

// Interceptar console.log una sola vez al cargar el módulo
const _origLog = console.log;
console.log = (...args) => {
    _origLog(...args);
    const emit = logStorage.getStore();
    if (!emit) return;
    const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    // Solo emitir líneas de nuestros servicios (prefijo entre corchetes)
    if (/^\[/.test(msg.trim())) emit(msg);
};

function emitToSession(sessionId, msg, type = 'log') {
    const res = sseStreams.get(sessionId);
    if (!res) return;
    try {
        res.write(`data: ${JSON.stringify({ msg, type, t: Date.now() })}\n\n`);
    } catch { /* stream cerrado */ }
}

module.exports = (admin, db) => {
    const router = express.Router();

    /**
     * GET /api/importer/stream/:sessionId
     * Abre una conexión SSE para recibir logs en tiempo real del analyze/create.
     */
    router.get('/stream/:sessionId', (req, res) => {
        const { sessionId } = req.params;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Deshabilitar buffer en nginx/proxies
        res.flushHeaders();

        // Ping inicial para confirmar conexión
        res.write(`data: ${JSON.stringify({ msg: '🔌 Conectado al stream de progreso', type: 'info' })}\n\n`);

        sseStreams.set(sessionId, res);

        req.on('close', () => {
            sseStreams.delete(sessionId);
        });
    });

    /**
     * POST /api/importer/analyze
     * Body: { url, useVision?, maxAccommodations?, sessionId? }
     */
    router.post('/analyze', async (req, res) => {
        const { url, useVision = true, maxAccommodations = 15, sessionId } = req.body;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Se requiere una URL válida.' });
        }
        try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return res.status(400).json({ error: 'La URL debe usar protocolo HTTP o HTTPS.' });
            }
        } catch {
            return res.status(400).json({ error: 'URL inválida.' });
        }

        const emit = sessionId ? (msg) => emitToSession(sessionId, msg) : null;

        try {
            const run = async () => {
                console.log(`[ImporterRoute] 🌐 Analyze request: ${url}`);
                return await analyzeWebsite(url, { useVision, maxAccommodations });
            };

            const importData = emit
                ? await logStorage.run(emit, run)
                : await run();

            if (sessionId) emitToSession(sessionId, '✅ Análisis completado', 'done');
            res.status(200).json(importData);
        } catch (error) {
            if (sessionId) emitToSession(sessionId, `❌ Error: ${error.message}`, 'error');
            console.error('[ImporterRoute] ❌ Analyze error:', error.message);
            if (error.message.includes('No se pudo acceder'))
                return res.status(422).json({ error: error.message });
            if (error.message.includes('no pudo analizar'))
                return res.status(422).json({ error: 'La IA no pudo extraer datos del sitio. Intenta con otra URL.' });
            return res.status(500).json({ error: `Error interno: ${error.message}` });
        }
    });

    /**
     * POST /api/importer/create
     * Body: { importData, credentials, wizardAnswers, sessionId? }
     */
    router.post('/create', async (req, res) => {
        const { importData, credentials, wizardAnswers = {}, sessionId } = req.body;

        if (!importData || !importData.empresa)
            return res.status(400).json({ error: 'importData inválido o incompleto.' });
        if (!credentials?.email)
            return res.status(400).json({ error: 'Se requiere un email.' });
        if (credentials.password && credentials.password.length < 6)
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
        if (!credentials.password) credentials.password = null;

        const emit = sessionId ? (msg) => emitToSession(sessionId, msg) : null;

        try {
            const run = async () => {
                console.log(`[ImporterRoute] 🏗️ Import request: "${importData.empresa.nombre}" → ${credentials.email}`);
                return await createEmpresaFromImport(admin, db, importData, credentials, wizardAnswers);
            };

            const result = emit
                ? await logStorage.run(emit, run)
                : await run();

            if (sessionId) emitToSession(sessionId, '✅ Importación completada', 'done');

            const isUpdate = result.modo === 'actualización';
            res.status(isUpdate ? 200 : 201).json({
                message: isUpdate
                    ? `Empresa "${importData.empresa.nombre}" actualizada exitosamente.`
                    : `Empresa "${importData.empresa.nombre}" creada exitosamente.`,
                modo: result.modo,
                empresaId: result.empresaId,
                uid: result.uid,
                stats: {
                    canales: result.canales.length,
                    tiposElemento: result.tiposElemento.length,
                    tiposComponente: result.tiposComponente.length,
                    propiedades: result.propiedades.length,
                    tarifas: result.tarifas.length,
                    omitidos: result.omitidos.length,
                    errores: result.errores.length
                },
                omitidos: result.omitidos,
                errores: result.errores
            });
        } catch (error) {
            if (sessionId) emitToSession(sessionId, `❌ Error: ${error.message}`, 'error');
            console.error('[ImporterRoute] ❌ Import error:', error.message);
            return res.status(500).json({ error: `Error interno: ${error.message}` });
        }
    });

    return router;
};
