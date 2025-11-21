// backend/routes/comunicaciones.js

const express = require('express');
const admin = require('firebase-admin');
const emailService = require('../services/emailService');
const plantillasService = require('../services/plantillasService');

module.exports = (db) => {
    const router = express.Router();

/**
 * POST /enviar-propuesta
 * Envía el correo de propuesta al cliente y registra en historial
 */
router.post('/enviar-propuesta', async (req, res) => {
    try {
        const { empresaId } = req;
        const {
            clienteId,
            clienteEmail,
            clienteNombre,
            propuestaId,
            plantillaId,
            textoMensaje // Texto ya generado (con etiquetas reemplazadas)
        } = req.body;

        // Validaciones
        if (!clienteEmail || clienteEmail.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: 'El cliente no tiene email registrado' 
            });
        }

        if (!textoMensaje) {
            return res.status(400).json({ 
                success: false, 
                error: 'No hay contenido para enviar' 
            });
        }

        // Obtener datos de la empresa para el asunto
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        const empresaData = empresaDoc.data();

        // Convertir texto a HTML
        const contenidoHtml = plantillasService.textoAHtml(textoMensaje);

        // Enviar correo
        const resultado = await emailService.enviarCorreo(db, {
            to: clienteEmail,
            subject: `Propuesta de Reserva - ${empresaData.nombre || 'SuiteManager'}`,
            html: contenidoHtml,
            empresaId: empresaId
        });

        if (!resultado.success) {
            throw new Error(resultado.error || 'Error al enviar correo');
        }

        // Registrar en historial del cliente
        if (clienteId) {
            const historialRef = db
                .collection('empresas').doc(empresaId)
                .collection('clientes').doc(clienteId)
                .collection('comunicaciones').doc();

            await historialRef.set({
                id: historialRef.id,
                tipo: 'propuesta-enviada',
                canal: 'email',
                asunto: `Propuesta de Reserva`,
                destinatario: clienteEmail,
                propuestaId: propuestaId || null,
                plantillaId: plantillaId || null,
                fechaEnvio: admin.firestore.FieldValue.serverTimestamp(),
                estado: 'enviado',
                messageId: resultado.messageId || null
            });
        }

        res.json({ 
            success: true, 
            message: 'Correo enviado correctamente',
            messageId: resultado.messageId
        });

    } catch (error) {
        console.error('❌ Error en /enviar-propuesta:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * POST /enviar-reserva-confirmada
 * Envía correo cuando se aprueba una propuesta (reserva confirmada)
 */
router.post('/enviar-reserva-confirmada', async (req, res) => {
    try {
        const { empresaId } = req;
        const {
            clienteId,
            clienteEmail,
            clienteNombre,
            reservaId,
            datosReserva
        } = req.body;

        if (!clienteEmail || clienteEmail.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: 'El cliente no tiene email registrado' 
            });
        }

        // Obtener datos de la empresa
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        const empresaData = empresaDoc.data();

        // Buscar plantilla de tipo "reserva confirmada" o usar texto por defecto
        let contenidoHtml;
        let plantillaId = null;

        try {
            const plantillasSnapshot = await db
                .collection('empresas').doc(empresaId)
                .collection('plantillasMensajes')
                .where('nombre', '>=', 'Reserva')
                .where('nombre', '<=', 'Reserva\uf8ff')
                .limit(1)
                .get();

            if (!plantillasSnapshot.empty) {
                const plantilla = plantillasSnapshot.docs[0].data();
                plantillaId = plantilla.id;
                
                const textoConEtiquetas = plantillasService.reemplazarEtiquetas(plantilla.texto, {
                    reservaId: reservaId,
                    clienteNombre: clienteNombre,
                    ...datosReserva,
                    empresaNombre: empresaData.nombre
                });
                
                contenidoHtml = plantillasService.textoAHtml(textoConEtiquetas);
            }
        } catch (e) {
            console.warn('No se encontró plantilla de reserva, usando texto por defecto');
        }

        // Si no hay plantilla, usar contenido por defecto
        if (!contenidoHtml) {
            contenidoHtml = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #059669;">✅ Reserva Confirmada</h2>
                    <p>Hola <strong>${clienteNombre}</strong>,</p>
                    <p>Tu reserva ha sido confirmada exitosamente.</p>
                    <p><strong>N° Reserva:</strong> ${reservaId}</p>
                    <p>Gracias por tu preferencia.</p>
                    <p>Saludos,<br>${empresaData.nombre || 'El equipo'}</p>
                </div>
            `;
        }

        // Enviar correo al cliente
        const resultadoCliente = await emailService.enviarCorreo(db, {
            to: clienteEmail,
            subject: `✅ Reserva Confirmada #${reservaId} - ${empresaData.nombre || 'SuiteManager'}`,
            html: contenidoHtml,
            empresaId: empresaId
        });

        // Enviar copia al administrador
        if (empresaData.contactoEmail) {
            await emailService.enviarCorreo(db, {
                to: empresaData.contactoEmail,
                subject: `[Admin] Nueva Reserva Confirmada #${reservaId}`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2>Nueva Reserva Confirmada</h2>
                        <p><strong>Cliente:</strong> ${clienteNombre} (${clienteEmail})</p>
                        <p><strong>N° Reserva:</strong> ${reservaId}</p>
                    </div>
                `,
                empresaId: empresaId
            });
        }

        // Registrar en historial del cliente
        if (clienteId) {
            const historialRef = db
                .collection('empresas').doc(empresaId)
                .collection('clientes').doc(clienteId)
                .collection('comunicaciones').doc();

            await historialRef.set({
                id: historialRef.id,
                tipo: 'reserva-confirmada',
                canal: 'email',
                asunto: `Reserva Confirmada #${reservaId}`,
                destinatario: clienteEmail,
                reservaId: reservaId,
                plantillaId: plantillaId,
                fechaEnvio: admin.firestore.FieldValue.serverTimestamp(),
                estado: 'enviado',
                messageId: resultadoCliente.messageId || null
            });
        }

        res.json({ 
            success: true, 
            message: 'Correos enviados correctamente'
        });

    } catch (error) {
        console.error('❌ Error en /enviar-reserva-confirmada:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

    return router;
};