// backend/services/propiedadesService.js
const pool = require('../db/postgres');
const { calcularCapacidad, contarDistribucion, hydrateInventory } = require('./propiedadLogicService');
const { finalizePropertyMetadataForSave } = require('./propiedadesMetadataPipeline');

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

/**
 * Elimina elementos duplicados dentro de los componentes
 * Previene problemas de capacidad duplicada como en Cabaña 7
 */
const eliminarElementosDuplicados = (componentes) => {
    if (!Array.isArray(componentes)) return componentes;

    return componentes.map(comp => {
        if (!Array.isArray(comp.elementos)) return comp;

        const elementosUnicos = [];
        const vistos = new Set();

        comp.elementos.forEach(el => {
            // Crear clave única para detectar duplicados
            const clave = `${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;
            if (!vistos.has(clave)) {
                vistos.add(clave);
                elementosUnicos.push(el);
            } else {
                console.log(`⚠️  Eliminando elemento duplicado: ${el.nombre || 'Sin nombre'} en ${comp.nombre || 'componente'}`);
            }
        });

        return {
            ...comp,
            elementos: elementosUnicos
        };
    });
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
const crearPropiedad = async (_db, empresaId, datosPropiedad) => {
    if (!empresaId || !datosPropiedad.nombre) {
        throw new Error('El ID de la empresa y el nombre de la propiedad son requeridos.');
    }

    const componentesRaw = Array.isArray(datosPropiedad.componentes) ? datosPropiedad.componentes : [];
    const componentes = eliminarElementosDuplicados(
        componentesRaw.map(c => ({
            ...c,
            elementos: Array.isArray(c.elementos) ? c.elementos : []
        }))
    );

    const { numPiezas: piezasCalculadas, numBanos: banosCalculados } = contarDistribucion(componentes);
    const capacidadCalculada = calcularCapacidad(componentes);
    const capacidadFinal = datosPropiedad.capacidad || datosPropiedad.capacidadMaxima || capacidadCalculada;
    const numPiezasFinal = datosPropiedad.numDormitorios || datosPropiedad.numPiezas || piezasCalculadas;

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

    const metadataPatch = {
        numBanos: datosPropiedad.numBanos || banosCalculados,
        camas: datosPropiedad.camas || {},
        equipamiento: datosPropiedad.equipamiento || {},
        sincronizacionIcal: datosPropiedad.sincronizacionIcal || {},
        componentes,
        amenidades: datosPropiedad.amenidades || [],
        googleHotelData: datosPropiedad.googleHotelData || {},
        websiteData: datosPropiedad.websiteData || { aiDescription: '', images: {}, cardImage: null },
    };
    if (datosPropiedad.ubicacion && typeof datosPropiedad.ubicacion === 'object') {
        metadataPatch.ubicacion = datosPropiedad.ubicacion;
    }
    if (Object.prototype.hasOwnProperty.call(datosPropiedad, 'contextoComercial')) {
        metadataPatch.contextoComercial = datosPropiedad.contextoComercial;
    }

    const metadata = await finalizePropertyMetadataForSave({}, metadataPatch);

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
};

// ─────────────────────────────────────────────
// LISTAR PROPIEDADES
// ─────────────────────────────────────────────
const obtenerPropiedadesPorEmpresa = async (_db, empresaId) => {
    if (!empresaId || typeof empresaId !== 'string' || empresaId.trim() === '') {
        throw new Error(`empresaId inválido: '${empresaId}'`);
    }
    const { rows } = await pool.query(
        'SELECT * FROM propiedades WHERE empresa_id = $1 ORDER BY created_at DESC',
        [empresaId]
    );
    return rows.map(mapearPropiedad);
};

// ─────────────────────────────────────────────
// OBTENER PROPIEDAD POR ID
// ─────────────────────────────────────────────
const obtenerPropiedadPorId = async (_db, empresaId, propiedadId) => {
    if (!propiedadId || typeof propiedadId !== 'string' || propiedadId.trim() === '') return null;
    const { rows } = await pool.query(
        'SELECT * FROM propiedades WHERE id = $1 AND empresa_id = $2',
        [propiedadId, empresaId]
    );
    return rows[0] ? mapearPropiedad(rows[0]) : null;
};

// ─────────────────────────────────────────────
// ACTUALIZAR PROPIEDAD
// ─────────────────────────────────────────────
const actualizarPropiedad = async (_db, empresaId, propiedadId, datosActualizados) => {
    let componentesParaMeta = undefined;
    let capacidadFinal = datosActualizados.capacidad;
    let numPiezasFinal = datosActualizados.numPiezas;
    let numBanos = undefined;

    if (datosActualizados.componentes) {
        const componentesRaw = Array.isArray(datosActualizados.componentes) ? datosActualizados.componentes : [];
        componentesParaMeta = eliminarElementosDuplicados(
            componentesRaw.map(c => ({
                ...c,
                id: c.id || generarIdComponente(c.nombre),
                elementos: Array.isArray(c.elementos) ? c.elementos : []
            }))
        );
        const { numPiezas, numBanos } = contarDistribucion(componentesParaMeta);
        const capacidadCalculada = calcularCapacidad(componentesParaMeta);
        numPiezasFinal = numPiezasFinal || numPiezas;
        capacidadFinal = capacidadFinal || capacidadCalculada;
    }

    const { nombre, capacidad, numPiezas, descripcion, activo, ...restoMeta } = datosActualizados;
    if (componentesParaMeta) {
        restoMeta.componentes = componentesParaMeta;
        // Si calculamos numBanos anteriormente, actualizarlo en restoMeta
        if (numBanos !== undefined && !restoMeta.numBanos) {
            restoMeta.numBanos = numBanos;
        }
    }

    const { rows: metaRows } = await pool.query(
        'SELECT metadata FROM propiedades WHERE id = $1 AND empresa_id = $2',
        [propiedadId, empresaId]
    );
    const prevRaw = metaRows[0]?.metadata;
    const prevMeta = prevRaw && typeof prevRaw === 'object' ? prevRaw : {};
    const mergedMetadata = await finalizePropertyMetadataForSave(prevMeta, restoMeta);

    await pool.query(`
        UPDATE propiedades SET
            nombre      = COALESCE($2, nombre),
            capacidad   = COALESCE($3, capacidad),
            num_piezas  = COALESCE($4, num_piezas),
            descripcion = COALESCE($5, descripcion),
            activo      = COALESCE($6, activo),
            metadata    = $7::jsonb,
            updated_at  = NOW()
        WHERE id = $1 AND empresa_id = $8
    `, [
        propiedadId,
        nombre || null,
        capacidadFinal || null,
        numPiezasFinal || null,
        descripcion !== undefined ? descripcion : null,
        activo !== undefined ? activo : null,
        JSON.stringify(mergedMetadata),
        empresaId
    ]);

    return obtenerPropiedadPorId(null, empresaId, propiedadId);
};

// ─────────────────────────────────────────────
// ELIMINAR PROPIEDAD
// ─────────────────────────────────────────────
const eliminarPropiedad = async (_db, empresaId, propiedadId) => {
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
};

// ─────────────────────────────────────────────
// CLONAR PROPIEDAD
// ─────────────────────────────────────────────
const clonarPropiedad = async (_db, empresaId, propiedadId, customName = null) => {
    const propiedad = await obtenerPropiedadPorId(null, empresaId, propiedadId);
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

    return crearPropiedad(null, empresaId, datosClonados);
};

/**
 * Elimina una propiedad junto con todas sus tarifas.
 * Bloquea si existe cualquier reserva (histórica, activa o futura).
 */
const eliminarPropiedadConTarifas = async (_db, empresaId, propiedadId) => {
    const { rows: reservas } = await pool.query(
        'SELECT id FROM reservas WHERE empresa_id = $1 AND propiedad_id = $2 LIMIT 1',
        [empresaId, propiedadId]
    );
    if (reservas.length > 0) {
        throw new Error('No se puede eliminar: el alojamiento tiene reservas asociadas (históricas, activas o futuras).');
    }
    await pool.query('DELETE FROM tarifas WHERE empresa_id = $1 AND propiedad_id = $2', [empresaId, propiedadId]);
    await pool.query('DELETE FROM propiedades WHERE id = $1 AND empresa_id = $2', [propiedadId, empresaId]);
};

module.exports = {
    crearPropiedad,
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,
    actualizarPropiedad,
    eliminarPropiedad,
    eliminarPropiedadConTarifas,
    clonarPropiedad
};
