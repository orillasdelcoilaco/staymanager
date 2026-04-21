/**
 * backend/services/catalogoService.js
 *
 * Catálogo universal de activos compartido entre empresas.
 *
 * Modelo de datos:
 *  - empresa_id IS NULL → activo universal (visible para todas las empresas)
 *  - empresa_id = UUID  → activo privado (solo visible para esa empresa)
 *
 * Efecto de red: cuantas más empresas usen el catálogo, más rico se vuelve.
 * uso_count sube cada vez que una empresa adopta un activo universal.
 */

const pool = require('../db/postgres');

/**
 * Mapeo snake_case → camelCase para la tabla activos_catalogo
 */
const mapear = (row) => ({
    id: row.id,
    empresaId: row.empresa_id,
    esUniversal: row.empresa_id === null,
    nombre: row.nombre,
    nombreNormalizado: row.nombre_normalizado,
    categoria: row.categoria,
    icono: row.icono,
    capacity: row.capacity,
    countable: row.countable,
    requiresPhoto: row.requires_photo,
    photoQuantity: row.photo_quantity,
    photoGuidelines: row.photo_guidelines,
    seoTags: row.seo_tags || [],
    salesContext: row.sales_context,
    schemaType: row.schema_type,
    schemaProperty: row.schema_property,
    usoCount: row.uso_count,
});

/**
 * Normaliza un nombre para búsqueda (minúsculas, sin acentos, sin puntuación extra).
 * Se usa tanto al crear como al buscar para asegurar consistencia.
 */
const normalizarNombre = (nombre) =>
    nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

/**
 * Busca activos en el catálogo: primero universales, luego de la empresa.
 * Combina búsqueda por nombre (ILIKE) y por seo_tags (array overlap).
 * Orden: privados de la empresa primero, luego universales por uso_count desc.
 *
 * @param {string} empresaId
 * @param {string} query       — texto de búsqueda del usuario
 * @param {number} [limit=10]
 * @returns {Promise<Array>}
 */
const buscarEnCatalogo = async (empresaId, query = '', limit = 10) => {
    if (!pool) return [];

    const q = `%${normalizarNombre(query)}%`;
    const termino = normalizarNombre(query);

    const { rows } = await pool.query(
        `SELECT *
         FROM   activos_catalogo
         WHERE  (empresa_id IS NULL OR empresa_id = $1)
           AND  (
                   nombre_normalizado ILIKE $2
                   OR $3 = ANY(seo_tags)
                )
         ORDER  BY
                CASE WHEN empresa_id = $1 THEN 0 ELSE 1 END,
                uso_count DESC
         LIMIT  $4`,
        [empresaId, q, termino, limit]
    );

    return rows.map(mapear);
};

/**
 * Crea un activo en el catálogo privado de la empresa.
 * Los datos semánticos (schema_type, seo_tags, etc.) son generados por la IA
 * antes de llamar a esta función — aquí solo se persiste.
 *
 * @param {string} empresaId
 * @param {Object} datos  — { nombre, categoria, icono, capacity, countable,
 *                            requiresPhoto, photoQuantity, photoGuidelines,
 *                            seoTags, salesContext, schemaType, schemaProperty }
 * @returns {Promise<Object>} activo creado
 */
const crearEnCatalogo = async (empresaId, datos) => {
    if (!pool) throw new Error('PostgreSQL no disponible');

    const nombreNorm = normalizarNombre(datos.nombre);

    const { rows } = await pool.query(
        `INSERT INTO activos_catalogo
            (empresa_id, nombre, nombre_normalizado, categoria, icono,
             capacity, countable, requires_photo, photo_quantity, photo_guidelines,
             seo_tags, sales_context, schema_type, schema_property)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
            empresaId,
            datos.nombre,
            nombreNorm,
            datos.categoria || 'Otros',
            datos.icono || '🔹',
            datos.capacity ?? 0,
            datos.countable ?? true,
            datos.requiresPhoto ?? false,
            datos.photoQuantity ?? 0,
            datos.photoGuidelines || null,
            datos.seoTags || [],
            datos.salesContext || null,
            datos.schemaType || 'LocationFeatureSpecification',
            datos.schemaProperty ?? null,
        ]
    );

    return mapear(rows[0]);
};

/**
 * Incrementa uso_count cuando una empresa adopta un activo universal.
 * Fire-and-forget — no lanzar si falla.
 *
 * @param {string} catalogoId
 */
const registrarUso = async (catalogoId) => {
    if (!pool) return;
    await pool.query(
        `UPDATE activos_catalogo SET uso_count = uso_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [catalogoId]
    );
};

/**
 * Devuelve los activos universales más usados para una categoría dada.
 * Útil para mostrar sugerencias en el wizard de activos.
 *
 * @param {string} categoria
 * @param {number} [limit=8]
 * @returns {Promise<Array>}
 */
const obtenerSugerenciasPorCategoria = async (categoria, limit = 8) => {
    if (!pool) return [];

    const { rows } = await pool.query(
        `SELECT *
         FROM   activos_catalogo
         WHERE  empresa_id IS NULL
           AND  categoria = $1
         ORDER  BY uso_count DESC
         LIMIT  $2`,
        [categoria, limit]
    );

    return rows.map(mapear);
};

module.exports = {
    buscarEnCatalogo,
    crearEnCatalogo,
    registrarUso,
    obtenerSugerenciasPorCategoria,
};
