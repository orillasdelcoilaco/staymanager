// backend/services/propiedadesService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { calcularCapacidad, contarDistribucion, hydrateInventory } = require('./propiedadLogicService');

const slugify = (text) => {
    return text.toString().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
};

const generarIdComponente = (nombre) => {
    const slug = slugify(nombre || 'componente');
    return `${slug}-${Date.now()}`;
};

function mapearPropiedad(row) {
    if (!row) return null;
    const meta = row.metadata || {};
    const aiContext = hydrateInventory(meta.componentes || []);
    return {
        id: row.id,
        nombre: row.nombre,
        capacidad: row.capacidad,
        numPiezas: row.num_piezas,
        descripcion: row.descripcion,
        activo: row.activo,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...meta,
        ai_context: aiContext
    };
}

// ─────────────────────────────────────────────
// CREAR PROPIEDAD
// ─────────────────────────────────────────────
const crearPropiedad = async (db, empresaId, datosPropiedad) => {
    if (!empresaId || !datosPropiedad.nombre) {
        throw new Error('El ID de la empresa y el nombre de la propiedad son requeridos.');
    }

    const componentesRaw = Array.isArray(datosPropiedad.componentes) ? datosPropiedad.componentes : [];
    const componentes = componentesRaw.map(c => ({
        ...c,
        elementos: Array.isArray(c.elementos) ? c.elementos : []
    }));

    const { numPiezas: piezasCalculadas, numBanos: banosCalculados } = contarDistribucion(componentes);
    const capacidadCalculada = calcularCapacidad(componentes);
    const capacidadFinal = datosPropiedad.capacidad || datosPropiedad.capacidadMaxima || capacidadCalculada;
    const numPiezasFinal = datosPropiedad.numDormitorios || datosPropiedad.numPiezas || piezasCalculadas;

    if (pool) {
        // Generar ID slug único
        let baseId = slugify(datosPropiedad.nombre) || `propiedad-${Date.now()}`;
        let docId = baseId;
        let counter = 1;

        while (true) {
            const { rows } = await pool.query(
                'SELECT id FROM propiedades WHERE id = $1 AND empresa_id = $2',
                [docId, empresaId]
            );
            if (rows.length === 0) break;
            docId = `${baseId}-${counter}`;
            counter++;
        }

        const metadata = {
            numBanos: datosPropiedad.numBanos || banosCalculados,
            camas: datosPropiedad.camas || {},
            equipamiento: datosPropiedad.equipamiento || {},
            sincronizacionIcal: datosPropiedad.sincronizacionIcal || {},
            componentes,
            amenidades: datosPropiedad.amenidades || [],
            googleHotelData: datosPropiedad.googleHotelData || {},
            websiteData: datosPropiedad.websiteData || { aiDescription: '', images: {}, cardImage: null }
        };

        await pool.query(`
            INSERT INTO propiedades (id, empresa_id, nombre, capacidad, num_piezas, descripcion, activo, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            docId, empresaId,
            datosPropiedad.nombre,
            capacidadFinal,
            numPiezasFinal,
            datosPropiedad.descripcion || '',
            true,
            JSON.stringify(metadata)
        ]);

        const aiContext = hydrateInventory(componentes);
        return { id: docId, nombre: datosPropiedad.nombre, capacidad: capacidadFinal, ...metadata, ai_context: aiContext };
    }

    // Firestore fallback
    let baseId = slugify(datosPropiedad.nombre) || `propiedad-${Date.now()}`;
    let docId = baseId;
    let counter = 1;
    let propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(docId);
    let doc = await propiedadRef.get();
    while (doc.exists) {
        docId = `${baseId}-${counter}`;
        propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(docId);
        doc = await propiedadRef.get();
        counter++;
    }

    const nuevaPropiedad = {
        nombre: datosPropiedad.nombre,
        capacidad: capacidadFinal,
        calculated_capacity: capacidadCalculada,
        descripcion: datosPropiedad.descripcion || '',
        numPiezas: numPiezasFinal,
        numBanos: datosPropiedad.numBanos || banosCalculados,
        camas: datosPropiedad.camas || {},
        equipamiento: datosPropiedad.equipamiento || {},
        sincronizacionIcal: datosPropiedad.sincronizacionIcal || {},
        componentes,
        amenidades: datosPropiedad.amenidades || [],
        googleHotelData: datosPropiedad.googleHotelData || {},
        websiteData: datosPropiedad.websiteData || { aiDescription: '', images: {}, cardImage: null },
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };

    await propiedadRef.set(nuevaPropiedad);
    const batch = db.batch();
    componentes.forEach(comp => batch.set(propiedadRef.collection('componentes').doc(), comp));
    (datosPropiedad.amenidades || []).forEach(am => batch.set(propiedadRef.collection('amenidades').doc(), am));
    await batch.commit();

    const aiContext = hydrateInventory(componentes);
    return { id: propiedadRef.id, ...nuevaPropiedad, ai_context: aiContext };
};

// ─────────────────────────────────────────────
// LISTAR PROPIEDADES
// ─────────────────────────────────────────────
const obtenerPropiedadesPorEmpresa = async (db, empresaId) => {
    if (!empresaId || typeof empresaId !== 'string' || empresaId.trim() === '') {
        throw new Error(`empresaId inválido: '${empresaId}'`);
    }

    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM propiedades WHERE empresa_id = $1 ORDER BY created_at DESC',
            [empresaId]
        );
        return rows.map(mapearPropiedad);
    }

    // Firestore fallback
    const snap = await db.collection('empresas').doc(empresaId).collection('propiedades')
        .orderBy('fechaCreacion', 'desc').get();
    if (snap.empty) return [];
    return snap.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, ai_context: hydrateInventory(data.componentes || []) };
    });
};

// ─────────────────────────────────────────────
// OBTENER PROPIEDAD POR ID
// ─────────────────────────────────────────────
const obtenerPropiedadPorId = async (db, empresaId, propiedadId) => {
    if (!propiedadId || typeof propiedadId !== 'string' || propiedadId.trim() === '') return null;

    if (pool) {
        const { rows } = await pool.query(
            'SELECT * FROM propiedades WHERE id = $1 AND empresa_id = $2',
            [propiedadId, empresaId]
        );
        return rows[0] ? mapearPropiedad(rows[0]) : null;
    }

    // Firestore fallback
    const doc = await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return { ...data, id: doc.id, ai_context: hydrateInventory(data.componentes || []) };
};

// ─────────────────────────────────────────────
// ACTUALIZAR PROPIEDAD
// ─────────────────────────────────────────────
const actualizarPropiedad = async (db, empresaId, propiedadId, datosActualizados) => {
    if (pool) {
        let componentesParaMeta = undefined;
        let capacidadFinal = datosActualizados.capacidad;
        let numPiezasFinal = datosActualizados.numPiezas;

        if (datosActualizados.componentes) {
            const componentesRaw = Array.isArray(datosActualizados.componentes) ? datosActualizados.componentes : [];
            componentesParaMeta = componentesRaw.map(c => ({
                ...c,
                id: c.id || generarIdComponente(c.nombre),
                elementos: Array.isArray(c.elementos) ? c.elementos : []
            }));
            const { numPiezas } = contarDistribucion(componentesParaMeta);
            const capacidadCalculada = calcularCapacidad(componentesParaMeta);
            numPiezasFinal = numPiezasFinal || numPiezas;
            capacidadFinal = capacidadFinal || capacidadCalculada;
        }

        // Construir patch de metadata — solo los campos que vienen en datosActualizados
        const { nombre, capacidad, numPiezas, descripcion, activo, ...restoMeta } = datosActualizados;
        if (componentesParaMeta) restoMeta.componentes = componentesParaMeta;

        await pool.query(`
            UPDATE propiedades SET
                nombre      = COALESCE($2, nombre),
                capacidad   = COALESCE($3, capacidad),
                num_piezas  = COALESCE($4, num_piezas),
                descripcion = COALESCE($5, descripcion),
                activo      = COALESCE($6, activo),
                metadata    = metadata || $7::jsonb,
                updated_at  = NOW()
            WHERE id = $1 AND empresa_id = $8
        `, [
            propiedadId,
            nombre || null,
            capacidadFinal || null,
            numPiezasFinal || null,
            descripcion !== undefined ? descripcion : null,
            activo !== undefined ? activo : null,
            JSON.stringify(restoMeta),
            empresaId
        ]);

        return obtenerPropiedadPorId(db, empresaId, propiedadId);
    }

    // Firestore fallback
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);

    if (datosActualizados.componentes) {
        const componentesRaw = Array.isArray(datosActualizados.componentes) ? datosActualizados.componentes : [];
        const componentes = componentesRaw.map(c => ({
            ...c,
            id: c.id || generarIdComponente(c.nombre),
            elementos: Array.isArray(c.elementos) ? c.elementos : []
        }));
        datosActualizados.componentes = componentes;
        const { numPiezas, numBanos } = contarDistribucion(componentes);
        const capacidadCalculada = calcularCapacidad(componentes);
        datosActualizados.numPiezas = numPiezas;
        datosActualizados.numBanos = numBanos;
        datosActualizados.calculated_capacity = capacidadCalculada;
        if (!datosActualizados.capacidad) datosActualizados.capacidad = capacidadCalculada;

        const batch = db.batch();
        const existingComps = await propiedadRef.collection('componentes').get();
        existingComps.forEach(doc => batch.delete(doc.ref));
        componentes.forEach(comp => batch.set(propiedadRef.collection('componentes').doc(), comp));
        await batch.commit();
    }

    if (datosActualizados.amenidades) {
        if (!Array.isArray(datosActualizados.amenidades)) datosActualizados.amenidades = [];
        const batch = db.batch();
        const existingAmens = await propiedadRef.collection('amenidades').get();
        existingAmens.forEach(doc => batch.delete(doc.ref));
        datosActualizados.amenidades.forEach(am => batch.set(propiedadRef.collection('amenidades').doc(), am));
        await batch.commit();
    }

    await propiedadRef.update({ ...datosActualizados, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() });
    const docActualizado = await propiedadRef.get();
    const data = docActualizado.data();
    return { id: propiedadId, ...data, ai_context: hydrateInventory(data.componentes || []) };
};

// ─────────────────────────────────────────────
// ELIMINAR PROPIEDAD
// ─────────────────────────────────────────────
const eliminarPropiedad = async (db, empresaId, propiedadId) => {
    if (pool) {
        const { rows: reservas } = await pool.query(
            'SELECT id FROM reservas WHERE empresa_id = $1 AND propiedad_id = $2 LIMIT 1',
            [empresaId, propiedadId]
        );
        if (reservas.length > 0) throw new Error(`No se puede eliminar: tiene reservas asociadas (Ej: ${reservas[0].id}).`);

        const { rows: tarifas } = await pool.query(
            'SELECT id FROM tarifas WHERE empresa_id = $1 AND propiedad_id = $2 LIMIT 1',
            [empresaId, propiedadId]
        );
        if (tarifas.length > 0) throw new Error(`No se puede eliminar: tiene tarifas configuradas (Ej: ${tarifas[0].id}).`);

        await pool.query('DELETE FROM propiedades WHERE id = $1 AND empresa_id = $2', [propiedadId, empresaId]);
        return;
    }

    // Firestore fallback
    const reservasSnap = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('alojamientoId', '==', propiedadId).limit(1).get();
    if (!reservasSnap.empty) throw new Error(`No se puede eliminar: tiene reservas asociadas (Ej: ${reservasSnap.docs[0].id}).`);

    const tarifasSnap = await db.collection('empresas').doc(empresaId).collection('tarifas')
        .where('alojamientoId', '==', propiedadId).limit(1).get();
    if (!tarifasSnap.empty) throw new Error(`No se puede eliminar: tiene tarifas configuradas (Ej: ${tarifasSnap.docs[0].id}).`);

    await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId).delete();
};

// ─────────────────────────────────────────────
// CLONAR PROPIEDAD
// ─────────────────────────────────────────────
const clonarPropiedad = async (db, empresaId, propiedadId, customName = null) => {
    const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
    if (!propiedad) throw new Error('La propiedad original no existe.');

    const nuevoNombre = customName || `${propiedad.nombre} (Copia)`;
    const datosClonados = {
        ...propiedad,
        nombre: nuevoNombre,
        googleHotelData: { ...propiedad.googleHotelData, isListed: false },
        icalLink: '',
        sincronizacionIcal: {}
    };
    delete datosClonados.id;
    delete datosClonados.ai_context;
    delete datosClonados.createdAt;
    delete datosClonados.updatedAt;

    return crearPropiedad(db, empresaId, datosClonados);
};

module.exports = {
    crearPropiedad,
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,
    actualizarPropiedad,
    eliminarPropiedad,
    clonarPropiedad
};
