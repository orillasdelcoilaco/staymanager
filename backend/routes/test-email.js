const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

router.get('/send', async (req, res) => {
    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        const data = await resend.emails.send({
            from: 'notificaciones@suitemanagers.com',
            to: 'orillasdelcoilaco@gmail.com', // ← Cambia por tu email
            subject: 'Test SuiteManager',
            html: '<h1>✅ Correo enviado desde Render!</h1><p>Configuración funcionando correctamente.</p>'
        });
        
        res.json({
            success: true,
            message: 'Correo enviado',
            data: data
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;