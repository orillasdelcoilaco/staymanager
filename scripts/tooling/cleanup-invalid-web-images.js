#!/usr/bin/env node
/**
 * Limpia datos de imágenes del sitio público que no cumplen full + miniatura distinta
 * (criterio alineado con imageUploadGuards / syncToWebsite).
 *
 * Requisitos: PostgreSQL (DATABASE_URL), variables como en el backend.
 *
 * Uso:
 *   node scripts/tooling/cleanup-invalid-web-images.js --empresa-id=<UUID> [--propiedad-id=<id>]
 *   node scripts/tooling/cleanup-invalid-web-images.js --subdomain=<slug> [--propiedad-id=<id>]
 * Por defecto solo lista cambios (dry-run). Para aplicar:
 *   node scripts/tooling/cleanup-invalid-web-images.js --subdomain=miempresa --apply
 *
 * Qué hace con --apply:
 * - Quita de metadata.websiteData.images las entradas sin thumbnailUrl válido o con thumb === full.
 * - Pone cardImage en null si es inválido.
 * - Elimina filas inválidas en galeria (y archivos en Storage vía eliminarFoto).
 * - Vacía heroImageUrl / heroImageThumbUrl en websiteSettings.theme si el par es inválido.
 * - Invalida caché SSR de la empresa.
 * - Tras escribir, ejecuta syncToWebsite por propiedad para rellenar images/cardImage desde galería (PG).
 */

const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..', '..', 'backend');
const ENV_PATH = path.join(BACKEND_ROOT, '.env');

// dotenv solo está en backend/node_modules; desde scripts/tooling/ un require('dotenv') falla y el .env no se carga.
function loadBackendEnv() {
    try {
        require(path.join(BACKEND_ROOT, 'node_modules', 'dotenv')).config({ path: ENV_PATH });
        return true;
    } catch (e) {
        try {
            require('dotenv').config({ path: ENV_PATH });
            return true;
        } catch (e2) {
            console.warn('[cleanup-invalid-web-images] No se pudo cargar dotenv:', e2.message);
            return false;
        }
    }
}

loadBackendEnv();

const pool = require(path.join(BACKEND_ROOT, 'db', 'postgres'));
const { IS_POSTGRES } = require(path.join(BACKEND_ROOT, 'config', 'dbConfig'));
const { eliminarFoto, syncToWebsite } = require(path.join(BACKEND_ROOT, 'services', 'galeriaService'));
const { ssrCache } = require(path.join(BACKEND_ROOT, 'services', 'cacheService'));

function parseArgs() {
    const out = { empresaId: null, subdomain: null, propiedadId: null, apply: false };
    for (const a of process.argv.slice(2)) {
        if (a === '--apply') out.apply = true;
        else if (a.startsWith('--empresa-id=')) out.empresaId = a.slice('--empresa-id='.length).trim();
        else if (a.startsWith('--subdomain=')) out.subdomain = a.slice('--subdomain='.length).trim().toLowerCase();
        else if (a.startsWith('--propiedad-id=')) out.propiedadId = a.slice('--propiedad-id='.length).trim();
    }
    return out;
}

async function resolveEmpresaId(poolClient, { empresaId, subdomain }) {
    if (empresaId) return empresaId;
    if (!subdomain) return null;
    const sub = subdomain.trim().toLowerCase();
    const { rows } = await poolClient.query(
        `SELECT id FROM empresas
         WHERE LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->>'subdomain', ''))) = $1
            OR LOWER(TRIM(COALESCE(configuracion->'websiteSettings'->'general'->>'subdomain', ''))) = $1
         LIMIT 2`,
        [sub]
    );
    if (rows.length === 0) return null;
    if (rows.length > 1) {
        console.warn('[cleanup] Más de una empresa con ese subdomain; usa --empresa-id explícito.');
        return null;
    }
    return rows[0].id;
}

function isValidWebImage(obj) {
    if (!obj || typeof obj !== 'object') return false;
    const full = String(obj.storagePath || obj.storage_url || obj.url || '').trim();
    const th = String(obj.thumbnailUrl || obj.thumbnail_url || '').trim();
    if (!full || !th || full === th) return false;
    return true;
}

function cleanWebsiteDataImages(websiteData) {
    const wd = websiteData && typeof websiteData === 'object' ? { ...websiteData } : {};
    const imagesIn = wd.images && typeof wd.images === 'object' ? { ...wd.images } : {};
    const imagesOut = {};
    let removed = 0;
    for (const [compId, list] of Object.entries(imagesIn)) {
        if (!Array.isArray(list)) continue;
        const kept = list.filter((img) => {
            const ok = isValidWebImage(img);
            if (!ok) removed++;
            return ok;
        });
        if (kept.length) imagesOut[compId] = kept;
    }
    let cardImage = wd.cardImage;
    let cardCleared = false;
    if (cardImage && !isValidWebImage(cardImage)) {
        cardImage = null;
        cardCleared = true;
    }
    const nextWd = { ...wd, images: imagesOut, cardImage };
    const changed =
        removed > 0 ||
        cardCleared ||
        JSON.stringify(imagesIn) !== JSON.stringify(imagesOut) ||
        (wd.cardImage || null) !== (cardImage || null);
    return { nextWd, changed, removed, cardCleared };
}

function heroThemeInvalid(theme) {
    if (!theme || typeof theme !== 'object') return false;
    const full = String(theme.heroImageUrl || '').trim();
    const th = String(theme.heroImageThumbUrl || '').trim();
    if (!full) return false;
    return !th || full === th;
}

function clearHeroInConfig(configuracion) {
    const cfg = configuracion && typeof configuracion === 'object'
        ? JSON.parse(JSON.stringify(configuracion))
        : {};
    const ws = cfg.websiteSettings = cfg.websiteSettings || {};
    const theme = ws.theme = ws.theme || {};
    if (!heroThemeInvalid(theme)) return { changed: false, configuracion: cfg };
    theme.heroImageUrl = '';
    theme.heroImageThumbUrl = '';
    return { changed: true, configuracion: cfg };
}

async function main() {
    const args = parseArgs();
    let { empresaId, propiedadId, apply } = args;
    if (!empresaId && !args.subdomain) {
        console.error('Obligatorio: --empresa-id=<UUID> o --subdomain=<slug>');
        process.exit(1);
    }
    if (!IS_POSTGRES || !pool) {
        console.error('Este script solo opera con PostgreSQL (DATABASE_URL + DB_MODE).');
        process.exit(1);
    }

    empresaId = await resolveEmpresaId(pool, { empresaId, subdomain: args.subdomain });
    if (!empresaId) {
        console.error('No se pudo resolver empresa (id inválido o subdomain no encontrado).');
        process.exit(1);
    }

    const mode = apply ? 'APLICAR' : 'DRY-RUN (sin --apply no se escribe nada)';
    console.log(`[cleanup-invalid-web-images] ${mode}`);
    console.log(`  empresa_id=${empresaId}${propiedadId ? ` propiedad_id=${propiedadId}` : ''}`);

    const { rows: empRows } = await pool.query('SELECT id FROM empresas WHERE id = $1', [empresaId]);
    if (!empRows.length) {
        console.error('Empresa no encontrada.');
        process.exit(1);
    }

    let propQuery = 'SELECT id, metadata FROM propiedades WHERE empresa_id = $1';
    const propParams = [empresaId];
    if (propiedadId) {
        propQuery += ' AND id = $2';
        propParams.push(propiedadId);
    }
    const { rows: props } = await pool.query(propQuery, propParams);
    if (propiedadId && !props.length) {
        console.error('Propiedad no encontrada para esa empresa.');
        process.exit(1);
    }

    for (const row of props) {
        const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const wd = meta.websiteData || {};
        const { nextWd, changed, removed, cardCleared } = cleanWebsiteDataImages(wd);
        if (changed) {
            console.log(`  propiedad ${row.id}: quitar ${removed} imagen(es) de slots; cardImage limpiado=${cardCleared}`);
            if (apply) {
                const newMeta = { ...meta, websiteData: nextWd };
                await pool.query(
                    `UPDATE propiedades SET metadata = $1::jsonb, updated_at = NOW()
                     WHERE id = $2 AND empresa_id = $3`,
                    [JSON.stringify(newMeta), row.id, empresaId]
                );
            }
        } else {
            console.log(`  propiedad ${row.id}: websiteData imágenes OK`);
        }
    }

    let galQuery = `
        SELECT id, propiedad_id, storage_url, thumbnail_url
        FROM galeria
        WHERE empresa_id = $1
          AND (
            thumbnail_url IS NULL
            OR TRIM(COALESCE(thumbnail_url, '')) = ''
            OR TRIM(COALESCE(storage_url, '')) = ''
            OR thumbnail_url = storage_url
          )`;
    const galParams = [empresaId];
    if (propiedadId) {
        galQuery += ' AND propiedad_id = $2';
        galParams.push(propiedadId);
    }
    const { rows: badGaleria } = await pool.query(galQuery, galParams);
    console.log(`  galería filas inválidas: ${badGaleria.length}`);
    for (const g of badGaleria) {
        console.log(`    eliminar galeria id=${g.id} propiedad=${g.propiedad_id} full=${String(g.storage_url || '').slice(0, 60)}…`);
        if (apply) {
            try {
                await eliminarFoto(null, empresaId, g.propiedad_id, g.id);
            } catch (e) {
                console.warn(`    WARN no se pudo eliminar ${g.id}: ${e.message}`);
            }
        }
    }

    const { rows: cfgRows } = await pool.query(
        'SELECT configuracion FROM empresas WHERE id = $1',
        [empresaId]
    );
    const cfg0 = cfgRows[0]?.configuracion || {};
    const { changed: heroChanged, configuracion: newCfg } = clearHeroInConfig(cfg0);
    if (heroChanged) {
        console.log('  hero corporativo: par full/thumb inválido → se vacían URLs (resubir desde el panel).');
        if (apply) {
            await pool.query(
                'UPDATE empresas SET configuracion = $1::jsonb, updated_at = NOW() WHERE id = $2',
                [JSON.stringify(newCfg), empresaId]
            );
        }
    } else {
        console.log('  hero corporativo: OK o sin imagen');
    }

    if (apply) {
        for (const row of props) {
            try {
                const r = await syncToWebsite(null, empresaId, row.id);
                console.log(`  syncToWebsite ${row.id}: total=${r.total}, componentes=${r.componentes}`);
            } catch (e) {
                console.warn(`  WARN syncToWebsite ${row.id}: ${e.message}`);
            }
        }
        try {
            ssrCache.invalidateEmpresaCache(empresaId);
            console.log('  Caché SSR invalidada para la empresa.');
        } catch (e) {
            console.warn(`  WARN cache: ${e.message}`);
        }
    } else {
        console.log('\n  Para ejecutar cambios, añade --apply');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
