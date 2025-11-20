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

// --- NUEVAS FUNCIONES PARA EMAIL ---

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

const reemplazarEtiquetas = (texto, datos) => {
    let resultado = texto;
    
    const etiquetas = {
        '[CLIENTE_NOMBRE]': datos.nombreCliente || '',
        '[RESERVA_ID_CANAL]': datos.reservaId || '',
        '[FECHA_LLEGADA]': datos.fechaLlegada || '',
        '[FECHA_SALIDA]': datos.fechaSalida || '',
        '[ALOJAMIENTO_NOMBRE]': datos.nombrePropiedad || '',
        '[TOTAL_NOCHES]': datos.totalNoches || '',
        '[CANTIDAD_HUESPEDES]': datos.numeroHuespedes || '',
        '[SALDO_PENDIENTE]': datos.saldoPendiente || '',
        '[PROPUESTA_ID]': datos.propuestaId || '',
        '[EMPRESA_NOMBRE]': datos.empresaNombre || '',
        '[USUARIO_NOMBRE]': datos.contactoNombre || '',
        '[USUARIO_EMAIL]': datos.contactoEmail || '',
        '[USUARIO_TELEFONO]': datos.contactoTelefono || '',
    };
    
    Object.keys(etiquetas).forEach(etiqueta => {
        const regex = new RegExp(etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        resultado = resultado.replace(regex, etiquetas[etiqueta]);
    });
    
    return resultado;
};

const procesarPlantilla = async (db, empresaId, plantillaId, datos) => {
    const plantilla = await obtenerPlantilla(db, empresaId, plantillaId);
    const textoFinal = reemplazarEtiquetas(plantilla.texto, datos);
    
    return {
        plantilla,
        contenido: textoFinal,
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
    procesarPlantilla,
    verificarEnvioAutomatico
};