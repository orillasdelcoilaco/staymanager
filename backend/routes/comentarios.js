// backend/routes/comentarios.js
const express = require('express');
const multer = require('multer');
const { 
    crearComentario, 
    obtenerComentarios, 
    eliminarComentario,
    buscarReservaParaComentario 
} = require('../services/comentariosService');

// Configuración de Multer para manejar las fotos en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB por foto
});

module.exports = (db) => {
    const router = express.Router();

    // GET /api/comentarios
    // Obtener todos los comentarios guardados
    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const comentarios = await obtenerComentarios(db, empresaId);
            res.status(200).json(comentarios);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // GET /api/comentarios/buscar-reserva
    // Buscar reservas para asociar un comentario
    router.get('/buscar-reserva', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { canalId, termino } = req.query;
            if (!canalId || !termino) {
                return res.status(400).json({ error: 'Se requieren el canalId y un término de búsqueda.' });
            }
            const reservas = await buscarReservaParaComentario(db, empresaId, canalId, termino);
            res.status(200).json(reservas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST /api/comentarios
    // Crear un nuevo comentario (con fotos)
    router.post('/', 
        // Middleware de Multer para 'foto1' y 'foto2'
        upload.fields([{ name: 'foto1', maxCount: 1 }, { name: 'foto2', maxCount: 1 }]), 
        async (req, res) => {
            try {
                const { empresaId } = req.user;
                const comentarioData = req.body;
                const files = req.files || {}; // Objeto con { foto1: [file], foto2: [file] }
                
                const nuevoComentario = await crearComentario(db, empresaId, comentarioData, files);
                res.status(201).json(nuevoComentario);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        }
    );

    // DELETE /api/comentarios/:id
    // Eliminar un comentario
    router.delete('/:id', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { id } = req.params;
            await eliminarComentario(db, empresaId, id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};