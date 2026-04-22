/**
 * Copia de respaldo del catálogo de etiquetas del motor (texto plano en plantillas).
 * Debe mantenerse alineado con: backend/services/plantillasEtiquetasCatalog.js → ETIQUETAS_CATALOGO
 * Se usa si GET /api/plantillas/etiquetas-motor falla (servidor antiguo, red, etc.).
 */
export const ETIQUETAS_MOTOR_FALLBACK = [
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
