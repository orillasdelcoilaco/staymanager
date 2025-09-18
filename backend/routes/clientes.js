const express = require('express');
const {
    obtenerClientesPorEmpresa,
    actualizarCliente,
    crearOActualizarCliente, // Usaremos esta para creación manual también
    eliminarCliente
} = require('../services/clientesService');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const clientes = await obtenerClientesPorEmpresa(db, req.user.empresaId);
            res.status(200).json(clientes);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            // La función está diseñada para crear o actualizar, perfecta para la importación
            // y también para la creación manual.
            const nuevoCliente = await crearOActualizarCliente(db, req.user.empresaId, req.body);
            res.status(201).json(nuevoCliente);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const clienteActualizado = await actualizarCliente(db, req.user.empresaId, req.params.id, req.body);
            res.status(200).json(clienteActualizado);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            await eliminarCliente(db, req.user.empresaId, req.params.id);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};