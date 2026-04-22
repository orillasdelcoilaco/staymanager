// backend/services/gestionPropuestas.email.js
const pool = require('../db/postgres');
const { obtenerClientePorId } = require('./clientesService');
const { procesarPlantilla, textoAHtml } = require('./plantillasService');
const emailService = require('./emailService');
const { registrarComunicacion } = require('./comunicacionesService');

async function _obtenerDatosEmpresa(_db, empresaId) {
    const { rows } = await pool.query('SELECT nombre, configuracion FROM empresas WHERE id = $1', [empresaId]);
    if (!rows[0]) return {};
    return { nombre: rows[0].nombre, ...(rows[0].configuracion || {}) };
}

const enviarEmailPropuesta = async (db, empresaId, datos) => {
    const { plantillaId, cliente, propiedades, fechaLlegada, fechaSalida, noches, personas, precioFinal, propuestaId, linkPago } = datos;

    if (!cliente?.email) throw new Error('El cliente no tiene email registrado');

    const empresaData = await _obtenerDatosEmpresa(db, empresaId);

    const formatearFecha = (f) => new Date(f + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' });
    const fmt = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v || 0);

    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
    const montoAbono = precioFinal ? precioFinal * 0.5 : 0;
    const nombresPropiedades = propiedades.map(p => p.nombre).join(', ');

    const { contenido, asunto } = await procesarPlantilla(db, empresaId, plantillaId, {
        propuestaId, reservaId: propuestaId,
        clienteNombre: cliente.nombre, nombreCliente: cliente.nombre,
        fechaEmision: new Date().toLocaleDateString('es-CL'),
        fechaLlegada: formatearFecha(fechaLlegada), fechaSalida: formatearFecha(fechaSalida),
        fechasEstadiaTexto: `${formatearFecha(fechaLlegada)} al ${formatearFecha(fechaSalida)}`,
        fechaVencimiento: fechaVencimiento.toLocaleDateString('es-CL') + ' a las ' + fechaVencimiento.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        noches: noches?.toString() || '', totalNoches: noches?.toString() || '',
        personas: personas?.toString() || '', numeroHuespedes: personas?.toString() || '',
        nombrePropiedad: nombresPropiedades, propiedadesNombres: nombresPropiedades,
        detallePropiedades: propiedades.map(p => `• ${p.nombre}`).join('\n'),
        precioFinal: fmt(precioFinal), saldoPendiente: fmt(precioFinal),
        montoTotal: fmt(precioFinal), resumenValores: `Total: ${fmt(precioFinal)}`,
        porcentajeAbono: '50%', montoAbono: fmt(montoAbono),
        empresaNombre: empresaData?.nombre || '', empresaWebsite: empresaData?.website || '',
        contactoNombre: empresaData?.contactoNombre || '', usuarioNombre: empresaData?.contactoNombre || '',
        contactoEmail: empresaData?.contactoEmail || '', usuarioEmail: empresaData?.contactoEmail || '',
        contactoTelefono: empresaData?.contactoTelefono || '', usuarioTelefono: empresaData?.contactoTelefono || '',
        linkPago: linkPago || ''
    });

    const resultado = await emailService.enviarCorreo(db, { to: cliente.email, subject: asunto, html: contenido, empresaId, replyTo: empresaData?.contactoEmail });
    if (!resultado.success) throw new Error(resultado.error || 'Error al enviar correo');

    if (cliente.id) {
        try {
            await registrarComunicacion(db, empresaId, cliente.id, {
                tipo: 'email', evento: 'propuesta-enviada', asunto, plantillaId,
                destinatario: cliente.email, relacionadoCon: { tipo: 'propuesta', id: propuestaId },
                estado: 'enviado', messageId: resultado.messageId || null
            });
        } catch (e) { console.warn('No se pudo registrar comunicación:', e.message); }
    }
    return resultado;
};

const enviarEmailReservaConfirmada = async (db, empresaId, datosReserva) => {
    const { clienteId, reservaId, propiedades, fechaLlegada, fechaSalida, noches, personas, precioFinal } = datosReserva;

    if (!clienteId) { console.warn('No se puede enviar email: no hay clienteId'); return; }

    const cliente = await obtenerClientePorId(db, empresaId, clienteId);
    if (!cliente) { console.warn('No se puede enviar email: cliente no encontrado'); return; }

    if (!cliente.email) { console.warn('No se puede enviar email: cliente sin email'); return; }

    const empresaData = await _obtenerDatosEmpresa(db, empresaId);

    const formatearFecha = (f) => f instanceof Date ? f.toLocaleDateString('es-CL') : new Date(f).toLocaleDateString('es-CL');
    const fmt = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v || 0);

    const fechaLlegadaStr = formatearFecha(fechaLlegada);
    const fechaSalidaStr = formatearFecha(fechaSalida);
    const nombresPropiedades = propiedades.map(p => p.nombre || p).join(', ');

    const contenidoTexto = `✅ Reserva Confirmada #${reservaId}

Hola ${cliente.nombre},

¡Tu reserva ha sido confirmada exitosamente!

📅 Detalles de tu reserva:
• Check-in: ${fechaLlegadaStr}
• Check-out: ${fechaSalidaStr}
• Noches: ${noches || 'N/A'}
• Huéspedes: ${personas || 'N/A'}
• Alojamiento: ${nombresPropiedades}
• Total: ${fmt(precioFinal)}

Gracias por tu preferencia.

Saludos,
${empresaData?.contactoNombre || empresaData?.nombre || 'El equipo'}
${empresaData?.contactoTelefono || ''}
${empresaData?.website || ''}`.trim();

    const resultado = await emailService.enviarCorreo(db, {
        to: cliente.email,
        subject: `✅ Reserva Confirmada #${reservaId} - ${empresaData?.nombre || 'SuiteManager'}`,
        html: textoAHtml(contenidoTexto), empresaId, replyTo: empresaData?.contactoEmail
    });
    if (!resultado.success) throw new Error(resultado.error || 'Error al enviar correo');

    if (empresaData?.contactoEmail) {
        try {
            await emailService.enviarCorreo(db, {
                to: empresaData.contactoEmail,
                subject: `[Admin] Reserva Confirmada #${reservaId} - ${cliente.nombre}`,
                html: `<div style="font-family:Arial,sans-serif;padding:20px"><h2>Nueva Reserva Confirmada</h2><p><strong>Cliente:</strong> ${cliente.nombre} (${cliente.email})</p><p><strong>N° Reserva:</strong> ${reservaId}</p><p><strong>Fechas:</strong> ${fechaLlegadaStr} al ${fechaSalidaStr}</p><p><strong>Alojamiento:</strong> ${nombresPropiedades}</p><p><strong>Total:</strong> ${fmt(precioFinal)}</p></div>`,
                empresaId
            });
        } catch (e) { console.warn('No se pudo enviar copia al admin:', e.message); }
    }

    try {
        await registrarComunicacion(db, empresaId, clienteId, {
            tipo: 'email', evento: 'reserva-confirmada',
            asunto: `Reserva Confirmada #${reservaId}`, destinatario: cliente.email,
            relacionadoCon: { tipo: 'reserva', id: reservaId },
            estado: 'enviado', messageId: resultado.messageId || null
        });
    } catch (e) { console.warn('No se pudo registrar comunicación:', e.message); }

    return resultado;
};

module.exports = { enviarEmailPropuesta, enviarEmailReservaConfirmada };
