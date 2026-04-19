// backend/routes/resenas.js
const express = require('express');
const multer = require('multer');
const {
    generarTokenParaReserva,
    buscarReservaParaResena,
    crearResenaManual,
    obtenerResenas,
    obtenerResumen,
    responderResena,
    cambiarEstado,
    listarClientesCandidatosResenaAutomatica,
    generarResenasAutomaticas,
} = require('../services/resenasService');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = (db) => {
    const router = express.Router();

    // POST /api/resenas/generar-token
    router.post('/generar-token', async (req, res) => {
        const { reservaId, propiedadId, nombreHuesped } = req.body;
        if (!reservaId) return res.status(400).json({ error: 'reservaId requerido' });
        try {
            const token = await generarTokenParaReserva(
                req.user.empresaId, reservaId, propiedadId, nombreHuesped
            );
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            res.json({ token, url: `${baseUrl}/r/${token}` });
        } catch (err) {
            console.error('[resenas] generar-token:', err.message);
            if (err.code === 'CLIENTE_BLOQUEADO') {
                return res.status(403).json({ error: err.message });
            }
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/resenas/buscar-reserva?canalId=&termino=
    router.get('/buscar-reserva', async (req, res) => {
        const { canalId, termino } = req.query;
        if (!canalId || !termino) {
            return res.status(400).json({ error: 'canalId y termino son requeridos' });
        }
        try {
            const reservas = await buscarReservaParaResena(req.user.empresaId, canalId, termino);
            res.json(reservas);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/resenas/manual — carga manual por admin (con fotos opcionales)
    router.post('/manual',
        upload.fields([{ name: 'foto1', maxCount: 1 }, { name: 'foto2', maxCount: 1 }]),
        async (req, res) => {
            try {
                const result = await crearResenaManual(
                    req.user.empresaId, req.body, req.files || {}
                );
                res.status(201).json(result);
            } catch (err) {
                console.error('[resenas] manual:', err.message);
                if (err.code === 'CLIENTE_BLOQUEADO') {
                    return res.status(403).json({ error: err.message });
                }
                res.status(err.message.includes('requeridos') ? 400 : 500).json({ error: err.message });
            }
        }
    );

    // GET /api/resenas/candidatos-auto — clientes con reserva finalizada sin reseña (misma empresa)
    router.get('/candidatos-auto', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit, 10) || 80;
            const rows = await listarClientesCandidatosResenaAutomatica(req.user.empresaId, limit);
            res.json(rows);
        } catch (err) {
            console.error('[resenas] candidatos-auto:', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/resenas/generar-automaticas { clienteIds: string[] } — máx. 10, una reseña por cliente/reserva
    router.post('/generar-automaticas', express.json(), async (req, res) => {
        const { clienteIds } = req.body || {};
        if (!Array.isArray(clienteIds)) {
            return res.status(400).json({ error: 'clienteIds debe ser un arreglo.' });
        }
        try {
            const result = await generarResenasAutomaticas(req.user.empresaId, clienteIds);
            res.status(201).json(result);
        } catch (err) {
            console.error('[resenas] generar-automaticas:', err.message);
            res.status(err.message.includes('Selecciona') || err.message.includes('Máximo') || err.message.includes('No hay')
                ? 400
                : 500).json({ error: err.message });
        }
    });

    // GET /api/resenas
    router.get('/', async (req, res) => {
        try {
            const resenas = await obtenerResenas(req.user.empresaId, {
                estado: req.query.estado || null,
                propiedadId: req.query.propiedadId || null,
            });
            res.json(resenas);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/resenas/resumen
    router.get('/resumen', async (req, res) => {
        try {
            const resumen = await obtenerResumen(req.user.empresaId);
            res.json(resumen);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT /api/resenas/:id/responder
    router.put('/:id/responder', async (req, res) => {
        const { texto } = req.body;
        if (!texto?.trim()) return res.status(400).json({ error: 'texto requerido' });
        try {
            const result = await responderResena(
                req.params.id, req.user.empresaId, texto.trim(), req.user.email
            );
            if (!result) return res.status(404).json({ error: 'Reseña no encontrada' });
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // PUT /api/resenas/:id/estado
    router.put('/:id/estado', async (req, res) => {
        const { estado } = req.body;
        if (!['pendiente', 'publicada', 'oculta'].includes(estado)) {
            return res.status(400).json({ error: 'estado inválido' });
        }
        try {
            const result = await cambiarEstado(req.params.id, req.user.empresaId, estado);
            if (!result) return res.status(404).json({ error: 'Reseña no encontrada' });
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
