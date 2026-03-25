// backend/services/componentesService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { generateWithFallback } = require('./aiContentService');

const obtenerTiposPorEmpresa = async (db, empresaId) => {
    if (pool) {
        const { rows } = await pool.query(
            `SELECT id, nombre_usuario, nombre_normalizado, categoria, icono,
                    descripcion_base, seo_description, shot_list, palabras_clave, inventario_sugerido, origen
             FROM tipos_componente WHERE empresa_id = $1 ORDER BY nombre_normalizado`,
            [empresaId]
        );
        return rows.map(r => ({
            id: r.id, nombreUsuario: r.nombre_usuario, nombreNormalizado: r.nombre_normalizado,
            categoria: r.categoria, icono: r.icono, descripcionBase: r.descripcion_base,
            seoDescription: r.seo_description, shotList: r.shot_list || [],
            palabrasClave: r.palabras_clave || [], inventarioSugerido: r.inventario_sugerido || [],
            origen: r.origen,
        }));
    }
    const snapshot = await db.collection('empresas').doc(empresaId).collection('tiposComponente').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Función pura — sin DB. Se mantiene igual.
const analizarNuevoTipoConIA = async (nombreUsuario) => {
    const prompt = `
        Actúa como Arquitecto de Hospitalidad. Analiza el espacio de alojamiento: "${nombreUsuario}".

        REGLAS DE NOMBRE:
        1. Si es "Dormitorio", MANTÉN "Dormitorio". NO inventes "Principal" ni "Recámara" a menos que lo diga el input.
        2. Si dice "Suite" o "En Suite", MANTÉN "Suite" (es crítico para el conteo de baños).
        3. Mantén el nombre fiel al input del usuario, solo corrigiendo ortografía o capitalización.

        CATEGORÍAS DE ESPACIO VÁLIDAS (usar EXACTAMENTE una de estas):
        "Dormitorio" | "Baño" | "Living" | "Cocina" | "Comedor" | "Terraza" | "Exterior" | "Área Común" | "Servicio" | "Otros"

        Responde SOLO con JSON válido (sin markdown):
        {
            "nombreNormalizado": "Nombre singular correcto",
            "categoria": "Una de las categorías válidas",
            "icono": "Emoji representativo",
            "descripcionBase": "Definición breve (1 oración)",
            "seo_description": "Descripción web optimizada (1-2 oraciones)",
            "shotList": ["Foto panorámica desde la entrada"],
            "inventarioSugerido": [{ "nombre": "Nombre Elemento", "cantidad": 1, "categoria": "Categoría" }],
            "palabrasClave": ["keyword1", "keyword2"]
        }
    `;
    try {
        const result = await generateWithFallback(prompt);
        if (!result) throw new Error('No result from any AI provider');
        return result;
    } catch (error) {
        if (error.message?.includes('quota') || error.message?.includes('429')) throw error;
        console.error('[Componentes IA] Error:', error.message);
        throw error;
    }
};

const crearTipoComponente = async (db, empresaId, datos) => {
    if (pool) {
        const { rows } = await pool.query(
            `INSERT INTO tipos_componente
             (empresa_id, nombre_usuario, nombre_normalizado, categoria, icono, descripcion_base, seo_description, shot_list, palabras_clave, inventario_sugerido, origen)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
            [
                empresaId,
                datos.nombreUsuario || datos.nombreNormalizado,
                datos.nombreNormalizado,
                datos.categoria || 'Otros',
                datos.icono || '📦',
                datos.descripcionBase || '',
                datos.seoDescription || datos.seo_description || '',
                JSON.stringify(datos.shotList || []),
                JSON.stringify(datos.palabrasClave || []),
                JSON.stringify(datos.inventarioSugerido || datos.elementosDefault || []),
                datos.origen || 'personalizado',
            ]
        );
        return {
            id: rows[0].id,
            nombreUsuario: datos.nombreUsuario || datos.nombreNormalizado,
            nombreNormalizado: datos.nombreNormalizado,
            categoria: datos.categoria || 'Otros',
            icono: datos.icono || '📦',
        };
    }

    const ref = db.collection('empresas').doc(empresaId).collection('tiposComponente').doc();
    const nuevoTipo = {
        id: ref.id,
        nombreUsuario: datos.nombreUsuario || datos.nombreNormalizado,
        nombreNormalizado: datos.nombreNormalizado,
        categoria: datos.categoria || 'Otros',
        icono: datos.icono || '📦',
        descripcionBase: datos.descripcionBase || '',
        shotList: datos.shotList || [],
        palabrasClave: datos.palabrasClave || [],
        origen: datos.origen || 'personalizado',
        elementosDefault: datos.elementosDefault || [],
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(nuevoTipo);
    return nuevoTipo;
};

const eliminarTipoComponente = async (db, empresaId, tipoId) => {
    if (pool) {
        const { rows: tipoRows } = await pool.query(
            'SELECT nombre_normalizado, nombre_usuario FROM tipos_componente WHERE id=$1 AND empresa_id=$2',
            [tipoId, empresaId]
        );
        if (!tipoRows[0]) throw new Error('El tipo de componente no existe.');
        const typeName = (tipoRows[0].nombre_normalizado || '').toUpperCase().trim();
        // Verificar uso en propiedades (componentes en metadata JSONB)
        const { rows: enUso } = await pool.query(
            `SELECT nombre FROM propiedades
             WHERE empresa_id = $1
               AND EXISTS (
                   SELECT 1 FROM jsonb_array_elements(COALESCE(metadata->'componentes','[]')) AS comp
                   WHERE upper(comp->>'tipo') = $2 OR upper(comp->>'nombreTipo') = $2
               ) LIMIT 1`,
            [empresaId, typeName]
        );
        if (enUso.length) throw new Error(`No se puede eliminar: El tipo '${tipoRows[0].nombre_usuario}' está en uso en la propiedad '${enUso[0].nombre}'. Borra las referencias primero.`);
        await pool.query('DELETE FROM tipos_componente WHERE id=$1 AND empresa_id=$2', [tipoId, empresaId]);
        return;
    }

    const typeRef = db.collection('empresas').doc(empresaId).collection('tiposComponente').doc(tipoId);
    const typeDoc = await typeRef.get();
    if (!typeDoc.exists) throw new Error('El tipo de componente no existe.');
    const typeData = typeDoc.data();
    const typeName = (typeData.nombreNormalizado || '').toUpperCase().trim();
    const typeUser = (typeData.nombreUsuario || '').toUpperCase().trim();
    const propsSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').get();
    let usoEncontrado = null;
    propsSnapshot.forEach(doc => {
        if (usoEncontrado) return;
        const prop = doc.data();
        if (prop.componentes?.some(comp => {
            const ct = (comp.tipo || '').toUpperCase().trim();
            return ct === typeName || ct === typeUser;
        })) usoEncontrado = prop.nombre;
    });
    if (usoEncontrado) throw new Error(`No se puede eliminar: El tipo '${typeData.nombreUsuario}' está en uso en la propiedad '${usoEncontrado}'. Borra las referencias primero.`);
    await typeRef.delete();
};

const actualizarTipoComponente = async (db, empresaId, tipoId, datos) => {
    if (pool) {
        const sets = [], params = [];
        if (datos.nombreUsuario || datos.nombreNormalizado) {
            sets.push(`nombre_usuario=$${params.push(datos.nombreUsuario || datos.nombreNormalizado)}`);
        }
        if (datos.nombreNormalizado) sets.push(`nombre_normalizado=$${params.push(datos.nombreNormalizado)}`);
        if (datos.icono)             sets.push(`icono=$${params.push(datos.icono)}`);
        if (datos.descripcionBase)   sets.push(`descripcion_base=$${params.push(datos.descripcionBase)}`);
        if (datos.shotList)          sets.push(`shot_list=$${params.push(JSON.stringify(datos.shotList))}`);
        if (datos.inventarioSugerido) sets.push(`inventario_sugerido=$${params.push(JSON.stringify(datos.inventarioSugerido))}`);
        if (datos.origen)            sets.push(`origen=$${params.push(datos.origen)}`);
        if (!sets.length) return { id: tipoId };
        sets.push('updated_at=NOW()');
        params.push(tipoId, empresaId);
        await pool.query(
            `UPDATE tipos_componente SET ${sets.join(',')} WHERE id=$${params.length-1} AND empresa_id=$${params.length}`,
            params
        );
        return { id: tipoId, ...datos };
    }

    const ref = db.collection('empresas').doc(empresaId).collection('tiposComponente').doc(tipoId);
    const doc = await ref.get();
    if (!doc.exists) throw new Error('Tipo de componente no encontrado.');
    const updateData = {
        nombreUsuario: datos.nombreUsuario || datos.nombreNormalizado,
        nombreNormalizado: datos.nombreNormalizado,
        icono: datos.icono,
        descripcionBase: datos.descripcionBase,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (datos.shotList)          updateData.shotList = datos.shotList;
    if (datos.inventarioSugerido) updateData.inventarioSugerido = datos.inventarioSugerido;
    if (datos.elementosDefault)  updateData.elementosDefault = datos.elementosDefault;
    if (datos.origen)            updateData.origen = datos.origen;
    await ref.update(updateData);
    return { id: tipoId, ...updateData };
};

module.exports = { obtenerTiposPorEmpresa, analizarNuevoTipoConIA, crearTipoComponente, eliminarTipoComponente, actualizarTipoComponente };
