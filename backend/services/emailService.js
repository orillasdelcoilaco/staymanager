/**
 * Servicio de Email
 * Maneja envío de correos y configuración automática por empresa
 */

const { Resend } = require('resend');
const pool = require('../db/postgres');

class EmailService {
    constructor() {
        this.provider = this.detectProvider();
        this.client = null;
    }

    detectProvider() {
        if (process.env.RESEND_API_KEY) return 'resend';
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) return 'gmail';
        console.warn('⚠️ No email provider configured. Using "console" provider for local development.');
        return 'console';
    }

    async getClient() {
        if (this.client) return this.client;

        if (this.provider === 'resend') {
            this.client = new Resend(process.env.RESEND_API_KEY);
        }

        return this.client;
    }

    async inicializarConfigEmail(db, empresaId) {
        if (pool) {
            const { rows } = await pool.query(
                'SELECT id, nombre, email_contacto FROM empresas WHERE id = $1',
                [empresaId]
            );
            if (!rows[0]) throw new Error('Empresa no encontrada');
            return {
                nombre: rows[0].nombre,
                emailConfig: {
                    nombreRemitente: rows[0].nombre || 'SuiteManager',
                    replyTo: rows[0].email_contacto || null
                }
            };
        }

        // Firestore fallback
        const empresaRef = db.collection('empresas').doc(empresaId);
        const doc = await empresaRef.get();
        if (!doc.exists) throw new Error('Empresa no encontrada');
        const empresa = doc.data();
        if (!empresa.emailConfig) {
            await empresaRef.update({
                emailConfig: {
                    nombreRemitente: empresa.nombre || 'SuiteManager',
                    replyTo: empresa.contactoEmail || null
                }
            });
        }
        return empresa;
    }

    async enviarCorreo(db, opciones) {
        const {
            to,
            subject,
            html,
            empresaId,
            replyTo
        } = opciones;

        const empresaData = await this.inicializarConfigEmail(db, empresaId);
        const client = await this.getClient();

        const from = empresaData.emailConfig?.nombreRemitente
            ? `${empresaData.emailConfig.nombreRemitente} <${process.env.EMAIL_FROM}>`
            : process.env.EMAIL_FROM;

        try {
            if (this.provider === 'console') {
                console.log('📧 [MOCK EMAIL] Enviando correo...');
                console.log(`   De: ${from}`);
                console.log(`   Para: ${to}`);
                console.log(`   Asunto: ${subject}`);
                return { success: true, proveedor: 'console' };
            }

            if (this.provider === 'resend') {
                const resultado = await client.emails.send({
                    from,
                    to,
                    subject,
                    html,
                    reply_to: replyTo || empresaData.emailConfig?.replyTo
                });

                return {
                    success: true,
                    messageId: resultado.data?.id,
                    proveedor: 'resend'
                };
            }

        } catch (error) {
            console.error('❌ Error enviando correo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new EmailService();