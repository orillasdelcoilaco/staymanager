/**
 * backend/db/migrations/build-context-catalogo.js
 *
 * Migración: Rediseño Gestión de Propiedades — PropertyBuildContext
 *
 * Cambios:
 *  1. Crea tabla activos_catalogo (catálogo universal + privado por empresa)
 *  2. Agrega columnas shot_context, advertencia, title a tabla galeria
 *
 * Ejecutar: node backend/db/migrations/build-context-catalogo.js
 * Idempotente: usa IF NOT EXISTS en todos los cambios
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../postgres');

async function run() {
    if (!pool) {
        console.error('[MIGRACIÓN] DATABASE_URL no definida. Saliendo.');
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ─────────────────────────────────────────────────────────────────
        // 1. Tabla activos_catalogo
        // ─────────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS activos_catalogo (
                id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                empresa_id          TEXT        REFERENCES empresas(id) ON DELETE CASCADE,
                -- empresa_id IS NULL = universal (compartido por todas las empresas)
                -- empresa_id = UUID  = privado de esa empresa

                nombre              TEXT        NOT NULL,
                nombre_normalizado  TEXT        NOT NULL,
                categoria           TEXT        NOT NULL DEFAULT 'Otros',
                icono               TEXT        DEFAULT '🔹',

                -- Datos semánticos (igual que tipos_elemento)
                capacity            INTEGER     DEFAULT 0,
                countable           BOOLEAN     DEFAULT true,
                requires_photo      BOOLEAN     DEFAULT false,
                photo_quantity      INTEGER     DEFAULT 0,
                photo_guidelines    TEXT,
                seo_tags            TEXT[]      DEFAULT '{}',
                sales_context       TEXT,
                schema_type         TEXT        DEFAULT 'LocationFeatureSpecification',
                schema_property     TEXT        DEFAULT 'amenityFeature',

                -- Efecto de red: cuántas empresas distintas lo usan
                uso_count           INTEGER     DEFAULT 0,

                created_at          TIMESTAMPTZ DEFAULT NOW(),
                updated_at          TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('[OK] Tabla activos_catalogo creada (o ya existía).');

        // Índice para catálogo universal (empresa_id IS NULL)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_catalogo_universal
                ON activos_catalogo(nombre_normalizado)
                WHERE empresa_id IS NULL
        `);
        console.log('[OK] Índice idx_catalogo_universal creado (o ya existía).');

        // Índice para catálogo privado por empresa
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_catalogo_empresa
                ON activos_catalogo(empresa_id, nombre_normalizado)
                WHERE empresa_id IS NOT NULL
        `);
        console.log('[OK] Índice idx_catalogo_empresa creado (o ya existía).');

        // Índice GIN para búsqueda por seo_tags (array overlap)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_catalogo_seo_tags
                ON activos_catalogo USING GIN (seo_tags)
        `);
        console.log('[OK] Índice idx_catalogo_seo_tags (GIN) creado (o ya existía).');

        // ─────────────────────────────────────────────────────────────────
        // 2. Columnas adicionales en tabla galeria
        // ─────────────────────────────────────────────────────────────────
        await client.query(`
            ALTER TABLE galeria ADD COLUMN IF NOT EXISTS shot_context TEXT
        `);
        console.log('[OK] Columna galeria.shot_context agregada (o ya existía).');

        await client.query(`
            ALTER TABLE galeria ADD COLUMN IF NOT EXISTS advertencia TEXT
        `);
        console.log('[OK] Columna galeria.advertencia agregada (o ya existía).');

        await client.query(`
            ALTER TABLE galeria ADD COLUMN IF NOT EXISTS title TEXT DEFAULT ''
        `);
        console.log('[OK] Columna galeria.title agregada (o ya existía).');

        await client.query('COMMIT');
        console.log('\n✅ Migración completada exitosamente.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error en migración — se hizo ROLLBACK:', err.message);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

run();
