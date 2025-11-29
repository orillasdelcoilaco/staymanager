const admin = require('firebase-admin');

// --- Lógica para Tipos de Plantilla ---
const crearTipoPlantilla = async (db, empresaId, datosTipo) => {
    if (!empresaId || !datosTipo.nombre) {
        throw new Error('El nombre del tipo de plantilla es requerido.');
    }
    const tipoRef = db.collection('empresas').doc(empresaId).collection('tiposPlantilla').doc();
    const nuevoTipo = {
        id: tipoRef.id,
        nombre: datosTipo.nombre,
        descripcion: datosTipo.descripcion || '',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await tipoRef.set(nuevoTipo);
    return nuevoTipo;
};

const obtenerTiposPlantilla = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('tiposPlantilla').orderBy('nombre').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const actualizarTipoPlantilla = async (db, empresaId, tipoId, datosActualizados) => {
    const tipoRef = db.collection('empresas').doc(empresaId).collection('tiposPlantilla').doc(tipoId);
    await tipoRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: tipoId, ...datosActualizados };
};

const eliminarTipoPlantilla = async (db, empresaId, tipoId) => {
    const plantillasSnapshot = await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').where('tipoId', '==', tipoId).limit(1).get();
    if (!plantillasSnapshot.empty) {
        throw new Error('No se puede eliminar el tipo porque está siendo usado por al menos una plantilla.');
    }
    await db.collection('empresas').doc(empresaId).collection('tiposPlantilla').doc(tipoId).delete();
};

// --- Lógica para Plantillas de Mensajes ---
const crearPlantilla = async (db, empresaId, datosPlantilla) => {
    if (!empresaId || !datosPlantilla.nombre || !datosPlantilla.tipoId || !datosPlantilla.texto) {
        throw new Error('Nombre, tipo y texto de la plantilla son requeridos.');
    }
    const plantillaRef = db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc();
    const nuevaPlantilla = {
        id: plantillaRef.id,
        nombre: datosPlantilla.nombre,
        tipoId: datosPlantilla.tipoId,
        texto: datosPlantilla.texto,
        enviarPorEmail: datosPlantilla.enviarPorEmail || false,
        destinatarios: datosPlantilla.destinatarios || [],
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };
    await plantillaRef.set(nuevaPlantilla);
    return nuevaPlantilla;
};

const obtenerPlantillasPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').orderBy('nombre').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const actualizarPlantilla = async (db, empresaId, plantillaId, datosActualizados) => {
    const plantillaRef = db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc(plantillaId);
    await plantillaRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: plantillaId, ...datosActualizados };
};

const eliminarPlantilla = async (db, empresaId, plantillaId) => {
    await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc(plantillaId).delete();
};

// --- FUNCIONES PARA EMAIL ---

const obtenerPlantilla = async (db, empresaId, plantillaId) => {
    const doc = await db
        .collection('empresas').doc(empresaId)
        .collection('plantillasMensajes').doc(plantillaId)
        .get();

    if (!doc.exists) {
        throw new Error(`Plantilla ${plantillaId} no encontrada`);
    }

    return {
        id: doc.id,
        ...doc.data()
    };
};

/**
 * Reemplaza las etiquetas en el texto de la plantilla
 * Etiquetas soportadas basadas en las plantillas existentes
 */
const reemplazarEtiquetas = (texto, datos) => {
    let resultado = texto;

    // Mapeo de etiquetas según las plantillas existentes
    const etiquetas = {
        // Identificadores
        '[PROPUESTA_ID]': datos.propuestaId || '',
        '[RESERVA_ID]': datos.reservaId || datos.propuestaId || '',
        '[RESERVA_ID_CANAL]': datos.reservaId || datos.propuestaId || '',

        // Cliente
        '[CLIENTE_NOMBRE]': datos.clienteNombre || datos.nombreCliente || '',

        // Fechas
        '[FECHA_EMISION]': datos.fechaEmision || new Date().toLocaleDateString('es-CL'),
        '[FECHA_LLEGADA]': datos.fechaLlegada || '',
        '[FECHA_SALIDA]': datos.fechaSalida || '',
        '[FECHAS_ESTADIA_TEXTO]': datos.fechasEstadiaTexto || `${datos.fechaLlegada || ''} al ${datos.fechaSalida || ''}`,
        '[FECHA_VENCIMIENTO_PROPUESTA]': datos.fechaVencimiento || '',

        // Estadía
        '[TOTAL_NOCHES]': datos.totalNoches || datos.noches || '',
        '[GRUPO_SOLICITADO]': datos.personas || datos.numeroHuespedes || '',
        '[CANTIDAD_HUESPEDES]': datos.personas || datos.numeroHuespedes || '',

        // Propiedades
        '[ALOJAMIENTO_NOMBRE]': datos.nombrePropiedad || datos.propiedadesNombres || '',
        '[DETALLE_PROPIEDADES_PROPUESTA]': datos.detallePropiedades || datos.nombrePropiedad || '',

        // Valores
        '[RESUMEN_VALORES_PROPUESTA]': datos.resumenValores || '',
        '[SALDO_PENDIENTE]': datos.saldoPendiente || datos.precioFinal || '',
        '[MONTO_TOTAL]': datos.montoTotal || datos.precioFinal || '',
        '[PORCENTAJE_ABONO]': datos.porcentajeAbono || '50%',
        '[MONTO_ABONO]': datos.montoAbono || '',

        // Empresa y usuario
        '[EMPRESA_NOMBRE]': datos.empresaNombre || '',
        '[EMPRESA_WEBSITE]': datos.empresaWebsite || '',
        '[USUARIO_NOMBRE]': datos.contactoNombre || datos.usuarioNombre || '',
        '[USUARIO_EMAIL]': datos.contactoEmail || datos.usuarioEmail || '',
        '[USUARIO_EMAIL]': datos.contactoEmail || datos.usuarioEmail || '',
        '[USUARIO_TELEFONO]': datos.contactoTelefono || datos.usuarioTelefono || '',

        // Pagos
        '[URL_PAGO]': datos.linkPago || datos.urlPago || '',
    };

    Object.keys(etiquetas).forEach(etiqueta => {
        const regex = new RegExp(etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        resultado = resultado.replace(regex, etiquetas[etiqueta]);
    });

    return resultado;
};

/**
 * Convierte texto plano a HTML básico
 */
const textoAHtml = (texto) => {
    if (!texto) return '';

    // Escapar caracteres HTML peligrosos
    let html = texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Convertir emojis de sección a headers
    html = html.replace(/📌\s*(.+?)(?=\n|$)/g, '<h2 style="color: #1e40af; margin-top: 20px;">📌 $1</h2>');
    html = html.replace(/⚠️\s*(.+?)(?=\n|$)/g, '<h3 style="color: #d97706; margin-top: 15px;">⚠️ $1</h3>');
    html = html.replace(/✅\s*(.+?)(?=\n|$)/g, '<h3 style="color: #059669; margin-top: 15px;">✅ $1</h3>');

    // Convertir saltos de línea a <br>
    html = html.replace(/\n/g, '<br>');

    // Envolver en contenedor con estilos básicos
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${html}
        </div>
    `;
};

/**
 * Procesa una plantilla reemplazando etiquetas y convirtiendo a HTML
 */
const procesarPlantilla = async (db, empresaId, plantillaId, datos) => {
    const plantilla = await obtenerPlantilla(db, empresaId, plantillaId);

    // Reemplazar etiquetas
    const textoConEtiquetas = reemplazarEtiquetas(plantilla.texto, datos);

    // Convertir a HTML
    const contenidoHtml = textoAHtml(textoConEtiquetas);

    return {
        plantilla,
        contenido: contenidoHtml,
        contenidoTexto: textoConEtiquetas, // Texto plano por si se necesita
        asunto: plantilla.nombre
    };
};

const verificarEnvioAutomatico = async (db, empresaId, plantillaId) => {
    const plantilla = await obtenerPlantilla(db, empresaId, plantillaId);
    return plantilla.enviarPorEmail === true;
};

module.exports = {
    crearTipoPlantilla,
    obtenerTiposPlantilla,
    actualizarTipoPlantilla,
    eliminarTipoPlantilla,
    crearPlantilla,
    obtenerPlantillasPorEmpresa,
    actualizarPlantilla,
    eliminarPlantilla,
    obtenerPlantilla,
    reemplazarEtiquetas,
    textoAHtml,
    procesarPlantilla,
    verificarEnvioAutomatico
};