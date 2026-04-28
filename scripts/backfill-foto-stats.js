/**
 * scripts/backfill-foto-stats.js
 *
 * Calcula fotoStats (slotsTotal + slotsCumplidos) para todas las propiedades
 * que tienen componentes definidos y lo guarda en propiedades.metadata.fotoStats.
 *
 * Uso: node scripts/backfill-foto-stats.js
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

    const { rows: propiedades } = await pool.query(`
        SELECT id, empresa_id, nombre,
               COALESCE(metadata->'componentes', '[]'::jsonb)  AS componentes,
               COALESCE(metadata->'websiteData'->'images', '{}'::jsonb) AS wizard_images
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

    const tiposCache = {};
    const tiposElCache = {};

    async function getTipos(empresaId) {
        if (!tiposCache[empresaId]) tiposCache[empresaId] = await obtenerTiposPorEmpresa(null, empresaId);
        return tiposCache[empresaId];
    }
    async function getTiposEl(empresaId) {
        if (!tiposElCache[empresaId]) tiposElCache[empresaId] = await obtenerTiposElemento(null, empresaId);
        return tiposElCache[empresaId];
    }

    let actualizadas = 0;
    let errores = 0;

    for (const prop of propiedades) {
        try {
            const [tipos, tiposEl] = await Promise.all([getTipos(prop.empresa_id), getTiposEl(prop.empresa_id)]);
            const plan = generarPlanFotos(prop.componentes, tipos, tiposEl);
            const slotsTotal = Object.values(plan).reduce((s, shots) => s + shots.length, 0);

            if (slotsTotal === 0) {
                console.log(`  ⚠  ${prop.nombre} — 0 slots, saltando`);
                continue;
            }

            const imgs = prop.wizard_images || {};
            const slotsCumplidos = Object.entries(plan).reduce((s, [compId, slots]) => {
                return s + Math.min((imgs[compId] || []).length, slots.length);
            }, 0);

            await pool.query(
                `UPDATE propiedades
                 SET metadata = metadata || jsonb_build_object('fotoStats', $1::jsonb)
                 WHERE id = $2 AND empresa_id = $3`,
                [JSON.stringify({ slotsTotal, slotsCumplidos }), prop.id, prop.empresa_id]
            );

            console.log(`  ✓  ${prop.nombre} — ${slotsCumplidos}/${slotsTotal}`);
            actualizadas++;
        } catch (err) {
            console.error(`  ✗  ${prop.nombre} — ${err.message}`);
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
