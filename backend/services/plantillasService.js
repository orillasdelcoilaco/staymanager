// backend/services/plantillasService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

// --- Lógica para Tipos de Plantilla (sin tabla PG — Firestore-only) ---

const crearTipoPlantilla = async (db, empresaId, datosTipo) => {
    if (!empresaId || !datosTipo.nombre) throw new Error('El nombre del tipo de plantilla es requerido.');
    const tipoRef = db.collection('empresas').doc(empresaId).collection('tiposPlantilla').doc();
    const nuevoTipo = { id: tipoRef.id, nombre: datosTipo.nombre, descripcion: datosTipo.descripcion || '', fechaCreacion: admin.firestore.FieldValue.serverTimestamp() };
    await tipoRef.set(nuevoTipo);
    return nuevoTipo;
};

const obtenerTiposPlantilla = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('tiposPlantilla').orderBy('nombre').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const actualizarTipoPlantilla = async (db, empresaId, tipoId, datosActualizados) => {
    await db.collection('empresas').doc(empresaId).collection('tiposPlantilla').doc(tipoId).update({ ...datosActualizados, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() });
    return { id: tipoId, ...datosActualizados };
};

const eliminarTipoPlantilla = async (db, empresaId, tipoId) => {
    const snap = await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').where('tipoId', '==', tipoId).limit(1).get();
    if (!snap.empty) throw new Error('No se puede eliminar el tipo porque está siendo usado por al menos una plantilla.');
    await db.collection('empresas').doc(empresaId).collection('tiposPlantilla').doc(tipoId).delete();
};

// --- Lógica para Plantillas de Mensajes (PG: tabla plantillas) ---

const crearPlantilla = async (db, empresaId, datosPlantilla) => {
    if (!empresaId || !datosPlantilla.nombre || !datosPlantilla.texto) throw new Error('Nombre y texto de la plantilla son requeridos.');

    if (pool) {
        const { rows } = await pool.query(
            `INSERT INTO plantillas (empresa_id, nombre, tipo, texto, activa) VALUES ($1,$2,$3,$4,true) RETURNING id`,
            [empresaId, datosPlantilla.nombre, datosPlantilla.tipoId || null, datosPlantilla.texto]
        );
        return { id: rows[0].id, ...datosPlantilla };
    }

    if (!datosPlantilla.tipoId) throw new Error('El tipo de la plantilla es requerido.');
    const ref = db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc();
    const nueva = { id: ref.id, nombre: datosPlantilla.nombre, tipoId: datosPlantilla.tipoId, texto: datosPlantilla.texto, enviarPorEmail: datosPlantilla.enviarPorEmail || false, destinatarios: datosPlantilla.destinatarios || [], fechaCreacion: admin.firestore.FieldValue.serverTimestamp() };
    await ref.set(nueva);
    return nueva;
};

const obtenerPlantillasPorEmpresa = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query('SELECT id, nombre, tipo, texto, activa FROM plantillas WHERE empresa_id=$1 AND activa=true ORDER BY nombre', [empresaId]);
        return rows.map(r => ({ id: r.id, nombre: r.nombre, tipoId: r.tipo, texto: r.texto, enviarPorEmail: false }));
    }
    const snapshot = await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').orderBy('nombre').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const actualizarPlantilla = async (db, empresaId, plantillaId, datosActualizados) => {
    if (pool) {
        const sets = [], params = [];
        if (datosActualizados.nombre !== undefined) { sets.push(`nombre=$${params.push(datosActualizados.nombre)}`); }
        if (datosActualizados.texto  !== undefined) { sets.push(`texto=$${params.push(datosActualizados.texto)}`); }
        if (datosActualizados.tipoId !== undefined) { sets.push(`tipo=$${params.push(datosActualizados.tipoId)}`); }
        if (sets.length) {
            sets.push('updated_at=NOW()');
            params.push(plantillaId, empresaId);
            await pool.query(`UPDATE plantillas SET ${sets.join(',')} WHERE id=$${params.length - 1} AND empresa_id=$${params.length}`, params);
        }
        return { id: plantillaId, ...datosActualizados };
    }
    const ref = db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc(plantillaId);
    await ref.update({ ...datosActualizados, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() });
    return { id: plantillaId, ...datosActualizados };
};

const eliminarPlantilla = async (db, empresaId, plantillaId) => {
    if (pool) {
        await pool.query('UPDATE plantillas SET activa=false, updated_at=NOW() WHERE id=$1 AND empresa_id=$2', [plantillaId, empresaId]);
        return;
    }
    await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc(plantillaId).delete();
};

const obtenerPlantilla = async (db, empresaId, plantillaId) => {
    if (pool) {
        const { rows } = await pool.query('SELECT id, nombre, tipo, texto, activa FROM plantillas WHERE id=$1 AND empresa_id=$2', [plantillaId, empresaId]);
        if (!rows[0]) throw new Error(`Plantilla ${plantillaId} no encontrada`);
        return { id: rows[0].id, nombre: rows[0].nombre, tipoId: rows[0].tipo, texto: rows[0].texto, enviarPorEmail: false };
    }
    const doc = await db.collection('empresas').doc(empresaId).collection('plantillasMensajes').doc(plantillaId).get();
    if (!doc.exists) throw new Error(`Plantilla ${plantillaId} no encontrada`);
    return { id: doc.id, ...doc.data() };
};

// --- Funciones de procesamiento de texto (sin DB) ---

const reemplazarEtiquetas = (texto, datos) => {
    const etiquetas = {
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
    };
    let resultado = texto;
    Object.keys(etiquetas).forEach(etiqueta => {
        resultado = resultado.replace(new RegExp(etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), etiquetas[etiqueta]);
    });
    return resultado;
};

const textoAHtml = (texto) => {
    if (!texto) return '';
    let html = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/📌\s*(.+?)(?=\n|$)/g, '<h2 style="color: #1e40af; margin-top: 20px;">📌 $1</h2>');
    html = html.replace(/⚠️\s*(.+?)(?=\n|$)/g, '<h3 style="color: #d97706; margin-top: 15px;">⚠️ $1</h3>');
    html = html.replace(/✅\s*(.+?)(?=\n|$)/g, '<h3 style="color: #059669; margin-top: 15px;">✅ $1</h3>');
    html = html.replace(/\n/g, '<br>');
    return `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">${html}</div>`;
};

const procesarPlantilla = async (db, empresaId, plantillaId, datos) => {
    const plantilla = await obtenerPlantilla(db, empresaId, plantillaId);
    const textoConEtiquetas = reemplazarEtiquetas(plantilla.texto, datos);
    return { plantilla, contenido: textoAHtml(textoConEtiquetas), contenidoTexto: textoConEtiquetas, asunto: plantilla.nombre };
};

const verificarEnvioAutomatico = async (db, empresaId, plantillaId) => {
    if (pool) return false; // campo enviarPorEmail no existe en tabla PG
    const plantilla = await obtenerPlantilla(db, empresaId, plantillaId);
    return plantilla.enviarPorEmail === true;
};

module.exports = {
    crearTipoPlantilla, obtenerTiposPlantilla, actualizarTipoPlantilla, eliminarTipoPlantilla,
    crearPlantilla, obtenerPlantillasPorEmpresa, actualizarPlantilla, eliminarPlantilla,
    obtenerPlantilla, reemplazarEtiquetas, textoAHtml, procesarPlantilla, verificarEnvioAutomatico
};
