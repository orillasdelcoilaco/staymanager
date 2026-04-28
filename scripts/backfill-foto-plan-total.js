/**
 * scripts/backfill-foto-plan-total.js
 *
 * Calcula fotoPlanTotal para todas las propiedades que tienen componentes definidos
 * y lo guarda en propiedades.metadata.fotoPlanTotal.
 *
 * Uso: node scripts/backfill-foto-plan-total.js
 */

try { require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') }); } catch (_) {}

const pool = require('../backend/db/postgres');
const { generarPlanFotos } = require('../backend/services/propiedadLogicService');
const { obtenerTiposPorEmpresa } = require('../backend/services/componentesService');
const { obtenerTipos: obtenerTiposElemento } = require('../backend/services/tiposElementoService');

async function main() {
    if (!pool) {
        console.error('DATABASE_URL no definida — no se puede continuar.');
        process.exit(1);
    }

    // 1. Obtener todas las propiedades con componentes
    const { rows: propiedades } = await pool.query(`
        SELECT id, empresa_id, nombre,
               COALESCE(metadata->'componentes', '[]'::jsonb) AS componentes
        FROM propiedades
        WHERE metadata->'componentes' IS NOT NULL
          AND jsonb_array_length(COALESCE(metadata->'componentes','[]'::jsonb)) > 0
        ORDER BY empresa_id, nombre
    `);

    if (propiedades.length === 0) {
        console.log('No hay propiedades con componentes. Nada que hacer.');
        await pool.end();
        return;
    }

    console.log(`Procesando ${propiedades.length} propiedades...`);

    // 2. Cargar tipos por empresa (cache para evitar queries repetidas)
    const tiposCache = {};
    const tiposElementoCache = {};

    async function getTipos(empresaId) {
        if (!tiposCache[empresaId]) {
            tiposCache[empresaId] = await obtenerTiposPorEmpresa(null, empresaId);
        }
        return tiposCache[empresaId];
    }

    async function getTiposElemento(empresaId) {
        if (!tiposElementoCache[empresaId]) {
            tiposElementoCache[empresaId] = await obtenerTiposElemento(null, empresaId);
        }
        return tiposElementoCache[empresaId];
    }

    let actualizadas = 0;
    let errores = 0;

    for (const prop of propiedades) {
        try {
            const componentes = prop.componentes;
            const [tipos, tiposEl] = await Promise.all([
                getTipos(prop.empresa_id),
                getTiposElemento(prop.empresa_id),
            ]);

            const plan = generarPlanFotos(componentes, tipos, tiposEl);
            const slotsTotal = Object.values(plan).reduce((sum, shots) => sum + shots.length, 0);

            if (slotsTotal === 0) {
                console.log(`  ⚠  ${prop.nombre} — 0 slots generados, saltando`);
                continue;
            }

            await pool.query(`
                UPDATE propiedades
                SET metadata = jsonb_set(COALESCE(metadata,'{}'), '{fotoPlanTotal}', $1::jsonb)
                WHERE id = $2 AND empresa_id = $3
            `, [slotsTotal, prop.id, prop.empresa_id]);

            console.log(`  ✓  ${prop.nombre} — ${slotsTotal} slots`);
            actualizadas++;
        } catch (err) {
            console.error(`  ✗  ${prop.nombre} — Error: ${err.message}`);
            errores++;
        }
    }

    console.log(`\nListo: ${actualizadas} actualizadas, ${errores} errores.`);
    await pool.end();
}

main().catch(err => {
    console.error('Error fatal:', err.message);
    process.exit(1);
});
