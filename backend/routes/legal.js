const express = require('express');
const router = express.Router();

// Mock de empresa para el header global
const globalCompanyMock = {
    nombre: "SuiteManager",
    websiteSettings: {
        theme: {
            // Usar un logo genérico o texto si no hay logo
            logoUrl: null
        }
    },
    // Sin contacto para ocultar botón de WhatsApp
    contactoTelefono: null,
    contactoNombre: null
};

// GET /legal/privacy
router.get('/privacy', (req, res) => {
    res.render('legal/privacy', {
        empresa: globalCompanyMock,
        locals: {} // Para evitar errores si partials usan locals
    });
});

// GET /legal/terms
router.get('/terms', (req, res) => {
    res.render('legal/terms', {
        empresa: globalCompanyMock,
        locals: {}
    });
});

module.exports = router;
