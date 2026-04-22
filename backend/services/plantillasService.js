// backend/services/plantillasService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { generateForTask } = require('./aiContentService');
const { AI_TASK } = require('./ai/aiEnums');
const { sanitizeInput } = require('./ai/prompts/sanitizer');
const { promptGenerarPlantillaMensaje } = require('./ai/prompts/plantillasIa');
const { reemplazarEtiquetasEnTexto } = require('./plantillasEtiquetasCatalog');

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

/** Claves de disparadores automáticos (futuro motor de correos). La propuesta sigue usando checkbox + plantilla en UI. */
const DISPARADOR_KEYS = [
    'reserva_confirmada',
    'reserva_cancelada',
    'reserva_modificada',
    'recordatorio_pre_llegada',
    'post_estadia_evaluacion',
    'consulta_contacto',
    'notificacion_interna',
];

function normalizeEmailConfig(input) {
    const disparadores = Object.fromEntries(DISPARADOR_KEYS.map((k) => [k, false]));
    if (input && typeof input === 'object' && input.disparadores && typeof input.disparadores === 'object') {
        DISPARADOR_KEYS.forEach((k) => {
            if (input.disparadores[k] !== undefined) disparadores[k] = Boolean(input.disparadores[k]);
        });
    }
    return {
        permitirEnvioCorreo: input && input.permitirEnvioCorreo === false ? false : true,
        disparadores,
    };
}

function mapPlantillaRow(r) {
    const emailConfig = normalizeEmailConfig(r.email_config);
    return {
        id: r.id,
        nombre: r.nombre,
        tipoId: r.tipo,
        texto: r.texto,
        asunto: r.asunto != null ? String(r.asunto) : '',
        emailConfig,
        enviarPorEmail: emailConfig.permitirEnvioCorreo,
    };
}

// --- Lógica para Plantillas de Mensajes (PG: tabla plantillas) ---

const crearPlantilla = async (_db, empresaId, datosPlantilla) => {
    if (!empresaId || !datosPlantilla.nombre || !datosPlantilla.texto) throw new Error('Nombre y texto de la plantilla son requeridos.');
    const asunto = datosPlantilla.asunto != null ? String(datosPlantilla.asunto).trim() : '';
    const emailConfig = normalizeEmailConfig(datosPlantilla.emailConfig || datosPlantilla.email_config);
    const { rows } = await pool.query(
        `INSERT INTO plantillas (empresa_id, nombre, tipo, texto, activa, asunto, email_config)
         VALUES ($1,$2,$3,$4,true,$5,$6::jsonb) RETURNING id, nombre, tipo, texto, activa, asunto, email_config`,
        [empresaId, datosPlantilla.nombre, datosPlantilla.tipoId || null, datosPlantilla.texto, asunto, JSON.stringify(emailConfig)]
    );
    return mapPlantillaRow(rows[0]);
};

const obtenerPlantillasPorEmpresa = async (_db, empresaId) => {
    const { rows } = await pool.query(
        `SELECT id, nombre, tipo, texto, activa, COALESCE(asunto,'') AS asunto, COALESCE(email_config,'{}'::jsonb) AS email_config
         FROM plantillas WHERE empresa_id=$1 AND activa=true ORDER BY nombre`,
        [empresaId]
    );
    return rows.map(mapPlantillaRow);
};

const actualizarPlantilla = async (_db, empresaId, plantillaId, datosActualizados) => {
    const sets = [];
    const params = [];
    if (datosActualizados.nombre !== undefined) { sets.push(`nombre=$${params.push(datosActualizados.nombre)}`); }
    if (datosActualizados.texto !== undefined) { sets.push(`texto=$${params.push(datosActualizados.texto)}`); }
    if (datosActualizados.tipoId !== undefined) { sets.push(`tipo=$${params.push(datosActualizados.tipoId)}`); }
    if (datosActualizados.asunto !== undefined) { sets.push(`asunto=$${params.push(String(datosActualizados.asunto || '').trim())}`); }
    if (datosActualizados.emailConfig !== undefined || datosActualizados.email_config !== undefined) {
        const ec = normalizeEmailConfig(datosActualizados.emailConfig || datosActualizados.email_config);
        sets.push(`email_config=$${params.push(JSON.stringify(ec))}::jsonb`);
    }
    if (sets.length) {
        sets.push('updated_at=NOW()');
        params.push(plantillaId, empresaId);
        await pool.query(`UPDATE plantillas SET ${sets.join(',')} WHERE id=$${params.length - 1} AND empresa_id=$${params.length}`, params);
    }
    const { rows } = await pool.query(
        `SELECT id, nombre, tipo, texto, activa, COALESCE(asunto,'') AS asunto, COALESCE(email_config,'{}'::jsonb) AS email_config
         FROM plantillas WHERE id=$1 AND empresa_id=$2`,
        [plantillaId, empresaId]
    );
    if (!rows[0]) return { id: plantillaId, ...datosActualizados };
    return mapPlantillaRow(rows[0]);
};

const eliminarPlantilla = async (_db, empresaId, plantillaId) => {
    await pool.query('UPDATE plantillas SET activa=false, updated_at=NOW() WHERE id=$1 AND empresa_id=$2', [plantillaId, empresaId]);
};

const obtenerPlantilla = async (_db, empresaId, plantillaId) => {
    const { rows } = await pool.query(
        `SELECT id, nombre, tipo, texto, activa, COALESCE(asunto,'') AS asunto, COALESCE(email_config,'{}'::jsonb) AS email_config
         FROM plantillas WHERE id=$1 AND empresa_id=$2`,
        [plantillaId, empresaId]
    );
    if (!rows[0]) throw new Error(`Plantilla ${plantillaId} no encontrada`);
    return mapPlantillaRow(rows[0]);
};

// --- Funciones de procesamiento de texto (sin DB) ---

const reemplazarEtiquetas = (texto, datos) => reemplazarEtiquetasEnTexto(texto, datos);

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
    const asuntoBase = (plantilla.asunto && String(plantilla.asunto).trim()) ? plantilla.asunto : plantilla.nombre;
    const asuntoFinal = reemplazarEtiquetas(asuntoBase, datos);
    return { plantilla, contenido: textoAHtml(textoConEtiquetas), contenidoTexto: textoConEtiquetas, asunto: asuntoFinal };
};

const verificarEnvioAutomatico = async (_db, _empresaId, _plantillaId) => {
    return false; // reservado; la lógica vive en email_config.disparadores cuando exista el motor de envíos
};

async function _obtenerNombreEmpresaPg(empresaId) {
    const { rows } = await pool.query('SELECT nombre FROM empresas WHERE id = $1', [empresaId]);
    return rows[0]?.nombre || 'Tu empresa';
}

/**
 * Genera borrador de plantilla (nombre, asunto, texto) con IA según el tipo de plantilla y etiquetas del motor.
 * @param {FirebaseFirestore.Firestore|object} db
 * @param {string} empresaId
 * @param {{ tipoId: string, tipoNombre?: string, nombreBorrador?: string, instrucciones?: string }} body
 */
const generarPlantillaConIa = async (db, empresaId, body = {}) => {
    const tipoId = String(body.tipoId || '').trim();
    if (!tipoId) throw new Error('Debe indicar el tipo de plantilla (tipoId).');

    let tipoNombre = String(body.tipoNombre || '').trim();
    if (!tipoNombre) {
        const tipos = await obtenerTiposPlantilla(db, empresaId);
        const t = tipos.find((x) => String(x.id) === tipoId);
        tipoNombre = t?.nombre || 'General';
    }

    const nombreEmpresa = await _obtenerNombreEmpresaPg(empresaId);
    const nombreBorrador = sanitizeInput(body.nombreBorrador || '', AI_TASK.TEMPLATE_GENERATION, { empresaId, campo: 'nombrePlantillaIA' });
    const instrucciones = sanitizeInput(body.instrucciones || body.instruccionesExtra || '', AI_TASK.TEMPLATE_GENERATION, { empresaId, campo: 'instruccionesPlantillaIA' });

    const prompt = promptGenerarPlantillaMensaje({
        nombreEmpresa,
        tipoNombre,
        nombreBorrador,
        instrucciones,
    });

    const raw = await generateForTask(AI_TASK.TEMPLATE_GENERATION, prompt, { empresaId });
    if (!raw || typeof raw !== 'object') throw new Error('La IA no devolvió un resultado válido. Intenta de nuevo.');

    let nombre = String(raw.nombre ?? '').trim().slice(0, 120);
    const asunto = String(raw.asunto ?? '').trim().slice(0, 220);
    const texto = String(raw.texto ?? raw.cuerpo ?? '').trim().slice(0, 12000);

    if (!texto) throw new Error('La IA devolvió el cuerpo vacío.');

    if (!nombre) nombre = (nombreBorrador || `Plantilla ${tipoNombre}`).slice(0, 120);

    return { nombre, asunto, texto, tipoNombreUsado: tipoNombre };
};

module.exports = {
    crearTipoPlantilla, obtenerTiposPlantilla, actualizarTipoPlantilla, eliminarTipoPlantilla,
    crearPlantilla, obtenerPlantillasPorEmpresa, actualizarPlantilla, eliminarPlantilla,
    obtenerPlantilla, reemplazarEtiquetas, textoAHtml, procesarPlantilla, verificarEnvioAutomatico,
    generarPlantillaConIa,
    DISPARADOR_KEYS, normalizeEmailConfig,
};
