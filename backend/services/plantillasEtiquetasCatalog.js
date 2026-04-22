/**
 * Catálogo único de etiquetas [TAG] que el motor sustituye en plantillas (correo/procesamiento).
 * Debe mantenerse alineado con los datos que envían gestionPropuestas.email y similares.
 *
 * El SPA usa GET /plantillas/etiquetas-motor; si falla, muestra la copia en
 * frontend/src/shared/plantillasEtiquetasMotorFallback.js (mantener ambas listas coherentes).
 */

const ETIQUETAS_CATALOGO = [
    { tag: '[PROPUESTA_ID]', descripcion: 'ID interno de la propuesta de reserva' },
    { tag: '[RESERVA_ID]', descripcion: 'ID de reserva (interno; en propuestas puede coincidir con propuesta)' },
    { tag: '[RESERVA_ID_CANAL]', descripcion: 'ID visible de la reserva en el canal de origen' },
    { tag: '[CLIENTE_NOMBRE]', descripcion: 'Nombre del huésped / cliente' },
    { tag: '[FECHA_EMISION]', descripcion: 'Fecha en que se emite el mensaje' },
    { tag: '[FECHA_LLEGADA]', descripcion: 'Fecha de check-in' },
    { tag: '[FECHA_SALIDA]', descripcion: 'Fecha de check-out' },
    { tag: '[FECHAS_ESTADIA_TEXTO]', descripcion: 'Rango de fechas de la estadía en una línea' },
    { tag: '[FECHA_VENCIMIENTO_PROPUESTA]', descripcion: 'Vencimiento de la oferta (propuestas)' },
    { tag: '[TOTAL_NOCHES]', descripcion: 'Número total de noches' },
    { tag: '[GRUPO_SOLICITADO]', descripcion: 'Huéspedes o tamaño del grupo solicitado' },
    { tag: '[CANTIDAD_HUESPEDES]', descripcion: 'Número de huéspedes' },
    { tag: '[ALOJAMIENTO_NOMBRE]', descripcion: 'Nombre del alojamiento o lista corta' },
    { tag: '[DETALLE_PROPIEDADES_PROPUESTA]', descripcion: 'Listado de propiedades incluidas en la propuesta' },
    { tag: '[RESUMEN_VALORES_PROPUESTA]', descripcion: 'Resumen de montos, descuentos y totales (propuestas)' },
    { tag: '[SALDO_PENDIENTE]', descripcion: 'Monto pendiente de pago' },
    { tag: '[MONTO_TOTAL]', descripcion: 'Monto total de la estadía u oferta' },
    { tag: '[PORCENTAJE_ABONO]', descripcion: 'Porcentaje de abono (p. ej. 50%)' },
    { tag: '[MONTO_ABONO]', descripcion: 'Monto del abono' },
    { tag: '[EMPRESA_NOMBRE]', descripcion: 'Nombre comercial de la empresa' },
    { tag: '[EMPRESA_WEBSITE]', descripcion: 'Sitio web de la empresa' },
    { tag: '[USUARIO_NOMBRE]', descripcion: 'Nombre de contacto del equipo (configuración empresa)' },
    { tag: '[USUARIO_EMAIL]', descripcion: 'Email de contacto para respuestas' },
    { tag: '[USUARIO_TELEFONO]', descripcion: 'Teléfono de contacto' },
    { tag: '[URL_PAGO]', descripcion: 'Enlace para pago en línea' },
    { tag: '[ENLACE_PAGO]', descripcion: 'Mismo valor que URL de pago (sinónimo)' },
];

/**
 * Mapa etiqueta → valor sustituido (vacío si no hay dato).
 * @param {object} datos — Mismo shape que usa gestionPropuestas / procesarPlantilla
 */
function buildReemplazoMap(datos = {}) {
    return {
        '[PROPUESTA_ID]': datos.propuestaId || '',
        '[RESERVA_ID]': datos.reservaId || datos.propuestaId || '',
        '[RESERVA_ID_CANAL]': datos.reservaId || datos.propuestaId || '',
        '[CLIENTE_NOMBRE]': datos.clienteNombre || datos.nombreCliente || '',
        '[FECHA_EMISION]': datos.fechaEmision || new Date().toLocaleDateString('es-CL'),
        '[FECHA_LLEGADA]': datos.fechaLlegada || '',
        '[FECHA_SALIDA]': datos.fechaSalida || '',
        '[FECHAS_ESTADIA_TEXTO]': datos.fechasEstadiaTexto || `${datos.fechaLlegada || ''} al ${datos.fechaSalida || ''}`,
        '[FECHA_VENCIMIENTO_PROPUESTA]': datos.fechaVencimiento || '',
        '[TOTAL_NOCHES]': datos.totalNoches || datos.noches || '',
        '[GRUPO_SOLICITADO]': datos.personas || datos.numeroHuespedes || '',
        '[CANTIDAD_HUESPEDES]': datos.personas || datos.numeroHuespedes || '',
        '[ALOJAMIENTO_NOMBRE]': datos.nombrePropiedad || datos.propiedadesNombres || '',
        '[DETALLE_PROPIEDADES_PROPUESTA]': datos.detallePropiedades || datos.nombrePropiedad || '',
        '[RESUMEN_VALORES_PROPUESTA]': datos.resumenValores || '',
        '[SALDO_PENDIENTE]': datos.saldoPendiente || datos.precioFinal || '',
        '[MONTO_TOTAL]': datos.montoTotal || datos.precioFinal || '',
        '[PORCENTAJE_ABONO]': datos.porcentajeAbono || '50%',
        '[MONTO_ABONO]': datos.montoAbono || '',
        '[EMPRESA_NOMBRE]': datos.empresaNombre || '',
        '[EMPRESA_WEBSITE]': datos.empresaWebsite || '',
        '[USUARIO_NOMBRE]': datos.contactoNombre || datos.usuarioNombre || '',
        '[USUARIO_EMAIL]': datos.contactoEmail || datos.usuarioEmail || '',
        '[USUARIO_TELEFONO]': datos.contactoTelefono || datos.usuarioTelefono || '',
        '[URL_PAGO]': datos.linkPago || datos.urlPago || '',
        '[ENLACE_PAGO]': datos.linkPago || datos.urlPago || '',
    };
}

function reemplazarEtiquetasEnTexto(texto, datos) {
    const etiquetas = buildReemplazoMap(datos);
    let resultado = texto || '';
    Object.keys(etiquetas).forEach((etiqueta) => {
        resultado = resultado.replace(new RegExp(etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), etiquetas[etiqueta]);
    });
    return resultado;
}

/** Texto para el prompt de IA: lista de etiquetas válidas */
function bloqueEtiquetasParaPrompt() {
    return ETIQUETAS_CATALOGO.map((e) => `- ${e.tag} — ${e.descripcion}`).join('\n');
}

module.exports = {
    ETIQUETAS_CATALOGO,
    buildReemplazoMap,
    reemplazarEtiquetasEnTexto,
    bloqueEtiquetasParaPrompt,
};
