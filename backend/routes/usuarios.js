const express = require('express');
const { crearUsuario, listarUsuariosPorEmpresa, eliminarUsuario } = require('../services/usuariosService');
const admin = require('firebase-admin');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const usuarios = await listarUsuariosPorEmpresa(db, empresaId);
            res.status(200).json(usuarios);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { email, password } = req.body;
            const nuevoUsuario = await crearUsuario(admin, db, { empresaId, email, password });
            res.status(201).json(nuevoUsuario);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    router.delete('/:uid', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { uid } = req.params;
            await eliminarUsuario(admin, db, { empresaId, uid });
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};