/**
 * Servicio de Email
 * Maneja envío de correos y configuración automática por empresa
 */

const { Resend } = require('resend');
const nodemailer = require('nodemailer');
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
        if (this.provider === 'gmail') {
            this.client = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: Number(process.env.SMTP_PORT || 587),
                secure: String(process.env.SMTP_SECURE || 'false') === 'true',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });
        }

        return this.client;
    }

    async inicializarConfigEmail(_db, empresaId) {
        const { rows } = await pool.query(
            `SELECT
                id,
                nombre,
                email,
                configuracion
             FROM empresas
             WHERE id = $1`,
            [empresaId]
        );
        if (!rows[0]) throw new Error('Empresa no encontrada');
        const cfg = rows[0].configuracion || {};
        const contactoEmail = cfg.contactoEmail || rows[0].email || null;
        return {
            nombre: rows[0].nombre,
            emailConfig: {
                nombreRemitente: rows[0].nombre || 'SuiteManager',
                replyTo: contactoEmail
            }
        };
    }

    async enviarCorreo(db, opciones) {
        const {
            to,
            subject,
            html,
            empresaId,
            replyTo
        } = opciones;

        let empresaData;
        try {
            empresaData = await this.inicializarConfigEmail(db, empresaId);
        } catch (error) {
            // Fallback robusto: si falla lookup SQL (p. ej. columnas legacy), no bloquear envío.
            console.warn(
                `[EmailService] Fallback de configuración para empresa ${empresaId}: ${error.message}`
            );
            empresaData = {
                nombre: 'SuiteManager',
                emailConfig: {
                    nombreRemitente: 'SuiteManager',
                    replyTo: replyTo || undefined,
                },
            };
        }
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
                if (resultado?.error) {
                    return {
                        success: false,
                        error: resultado.error?.message || 'Resend rejected the email request.',
                        proveedor: 'resend',
                    };
                }

                return {
                    success: true,
                    messageId: resultado.data?.id,
                    proveedor: 'resend'
                };
            }

            if (this.provider === 'gmail') {
                const info = await client.sendMail({
                    from,
                    to,
                    subject,
                    html,
                    replyTo: replyTo || empresaData.emailConfig?.replyTo || undefined,
                });
                return {
                    success: true,
                    messageId: info.messageId,
                    proveedor: 'gmail',
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