// backend/services/tiposElementoService.js
const pool = require('../db/postgres');
const { v4: uuidv4 } = require('uuid');
const Fuse = require('fuse.js');

const CACHE_TIPOS = {};
const CACHE_TTL = 1000 * 60 * 5; // 5 minutos

async function obtenerTipos(_db, empresaId) {
    const { rows } = await pool.query(
        `SELECT id, nombre, categoria, icono, permite_cantidad, countable, count_value_default,
                capacity, requires_photo, photo_quantity, photo_guidelines,
                seo_tags, sales_context, schema_type, schema_property
         FROM tipos_elemento WHERE empresa_id = $1 ORDER BY nombre`,
        [empresaId]
    );
    return rows.map(r => ({
        id: r.id, nombre: r.nombre, categoria: r.categoria, icono: r.icono,
        permiteCantidad: r.permite_cantidad, countable: r.countable,
        count_value_default: r.count_value_default, capacity: r.capacity,
        requires_photo: r.requires_photo, photo_quantity: r.photo_quantity,
        photo_guidelines: r.photo_guidelines, seo_tags: r.seo_tags || [],
        sales_context: r.sales_context, schema_type: r.schema_type, schema_property: r.schema_property,
    }));
}

async function crearTipo(_db, empresaId, datos) {
    const normalizeCategory = (cat) => {
        const t = (cat || 'Otros').trim().toLowerCase();
        return t.charAt(0).toUpperCase() + t.slice(1);
    };
    const id = uuidv4();
    await pool.query(
        `INSERT INTO tipos_elemento
         (id, empresa_id, nombre, categoria, icono, permite_cantidad, countable, count_value_default,
          capacity, requires_photo, photo_quantity, photo_guidelines, seo_tags, sales_context, schema_type, schema_property)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
            id, empresaId,
            datos.nombre ? datos.nombre.trim() : 'Sin Nombre',
            normalizeCategory(datos.categoria),
            datos.icono || '🔹',
            datos.permiteCantidad !== false,
            datos.countable || false,
            datos.count_value_default || 0,
            datos.capacity || 0,
            datos.requires_photo || false,
            datos.photo_quantity || 0,
            datos.photo_guidelines || null,
            JSON.stringify(datos.seo_tags || []),
            datos.sales_context || null,
            datos.schema_type || 'Thing',
            datos.schema_property || null,
        ]
    );
    CACHE_TIPOS[empresaId] = null;
    return { id, nombre: datos.nombre?.trim() || 'Sin Nombre', categoria: normalizeCategory(datos.categoria) };
}

async function eliminarTipo(_db, empresaId, tipoId) {
    const { rows } = await pool.query(
        'SELECT nombre FROM tipos_elemento WHERE id=$1 AND empresa_id=$2',
        [tipoId, empresaId]
    );
    if (!rows[0]) throw new Error('El elemento no existe.');
    const elementName = rows[0].nombre.toUpperCase().trim();
    const { rows: enUso } = await pool.query(
        `SELECT nombre FROM propiedades
         WHERE empresa_id=$1
           AND EXISTS (
               SELECT 1 FROM jsonb_array_elements(COALESCE(metadata->'componentes','[]')) comp,
                             jsonb_array_elements(COALESCE(comp->'elementos','[]')) elem
               WHERE upper(elem->>'nombre') = $2 OR elem->>'tipoId' = $3
           ) LIMIT 1`,
        [empresaId, elementName, tipoId]
    );
    if (enUso.length) throw new Error(`No se puede eliminar: El elemento '${rows[0].nombre}' está en uso en: ${enUso[0].nombre}. Elimínalo del inventario primero.`);
    await pool.query('DELETE FROM tipos_elemento WHERE id=$1 AND empresa_id=$2', [tipoId, empresaId]);
    CACHE_TIPOS[empresaId] = null;
}

async function actualizarTipo(_db, empresaId, tipoId, datos) {
    const normalizeCategory = (c) => { const t = (c || '').trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
    const sets = [], params = [];
    if (datos.nombre)                          sets.push(`nombre=$${params.push(datos.nombre.trim())}`);
    if (datos.categoria)                       sets.push(`categoria=$${params.push(normalizeCategory(datos.categoria))}`);
    if (datos.icono)                           sets.push(`icono=$${params.push(datos.icono)}`);
    if (datos.capacity !== undefined)          sets.push(`capacity=$${params.push(Number(datos.capacity))}`);
    if (datos.permiteCantidad !== undefined)   sets.push(`permite_cantidad=$${params.push(Boolean(datos.permiteCantidad))}`);
    if (datos.countable !== undefined)         sets.push(`countable=$${params.push(Boolean(datos.countable))}`);
    if (datos.requires_photo !== undefined)    sets.push(`requires_photo=$${params.push(Boolean(datos.requires_photo))}`);
    if (datos.photo_quantity !== undefined)    sets.push(`photo_quantity=$${params.push(Number(datos.photo_quantity))}`);
    if (datos.seo_tags)                        sets.push(`seo_tags=$${params.push(JSON.stringify(datos.seo_tags))}`);
    if (datos.sales_context)                   sets.push(`sales_context=$${params.push(datos.sales_context)}`);
    if (datos.photo_guidelines)                sets.push(`photo_guidelines=$${params.push(datos.photo_guidelines)}`);
    if (datos.schema_property !== undefined)   sets.push(`schema_property=$${params.push(datos.schema_property || null)}`);
    if (!sets.length) return { id: tipoId };
    sets.push('updated_at=NOW()');
    params.push(tipoId, empresaId);
    await pool.query(
        `UPDATE tipos_elemento SET ${sets.join(',')} WHERE id=$${params.length-1} AND empresa_id=$${params.length}`,
        params
    );
    CACHE_TIPOS[empresaId] = null;
    return { id: tipoId, ...datos };
}

async function _getCachedTipos(db, empresaId) {
    const now = Date.now();
    if (CACHE_TIPOS[empresaId]?.timestamp && (now - CACHE_TIPOS[empresaId].timestamp < CACHE_TTL)) {
        return CACHE_TIPOS[empresaId].data;
    }
    const data = await obtenerTipos(db, empresaId);
    CACHE_TIPOS[empresaId] = { data, timestamp: now };
    return data;
}

async function buscarTipoFuzzy(db, empresaId, query) {
    if (!query) return null;
    const tipos = await _getCachedTipos(db, empresaId);
    if (!tipos.length) return null;
    const fuse = new Fuse(tipos, { includeScore: true, keys: ['nombre', 'seo_tags'], threshold: 0.4 });
    const result = fuse.search(query.toLowerCase().trim());
    if (result.length > 0 && result[0].score < 0.3) return result[0].item;
    return null;
}

module.exports = { obtenerTipos, crearTipo, eliminarTipo, actualizarTipo, buscarTipoFuzzy };
