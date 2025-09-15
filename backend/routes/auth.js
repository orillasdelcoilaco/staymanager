const express = require('express');
const { register } = require('../services/authService');
const { createAuthMiddleware } = require('../middleware/authMiddleware');

// Esta función recibe las instancias de admin y db para pasarlas a los servicios/middlewares
module.exports = (admin, db) => {
    const router = express.Router();
    
    // Creamos una instancia del middleware con las dependencias necesarias
    const authMiddleware = createAuthMiddleware(admin, db);

    // Ruta pública para registrar una nueva empresa y su primer usuario
    router.post('/register', async (req, res) => {
        try {
            const { nombreEmpresa, email, password } = req.body;
            if (!nombreEmpresa || !email || !password) {
                return res.status(400).json({ error: 'Nombre de empresa, email y contraseña son requeridos.' });
            }
            const result = await register(admin, db, { nombreEmpresa, email, password });
            res.status(201).json(result);
        } catch (error) {
            console.error("Error en la ruta de registro:", error);
            res.status(500).json({ error: error.message || 'Error interno del servidor.' });
        }
    });

    // Ruta protegida para obtener la información del usuario que ha iniciado sesión
    // El authMiddleware se ejecuta primero para verificar el token
    router.get('/me', authMiddleware, (req, res) => {
        // Si el middleware pasa, req.user ya contendrá la información que necesitamos
        res.status(200).json({
            uid: req.user.uid,
            email: req.user.email,
            empresaId: req.user.empresaId,
            rol: req.user.rol
        });
    });

    return router;
};

