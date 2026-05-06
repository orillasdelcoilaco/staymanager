/**
 * Regenera miniaturas WebP (galería, card, hero) desde URLs full en Storage.
 * Usado por el script `scripts/tooling/repair-web-images.js` y por el panel (API).
 */
const fetch = require('node-fetch');
const pool = require('../db/postgres');
const { IS_POSTGRES } = require('../config/dbConfig');
const { optimizeImage } = require('./imageProcessingService');
const { uploadFile, deleteFileByPath } = require('./storageService');
const { assertOptimizedBuffers, assertDistinctPublicUrls } = require('./imageUploadGuards');
const { eliminarFoto, syncToWebsite } = require('./galeriaService');
const { ssrCache } = require('./cacheService');

function storagePathFromPublicUrl(url) {
    const s = String(url || '').trim();
    if (!s || !s.includes('/o/')) return '';
    const pathPart = s.split('/o/')[1].split('?')[0];
    try {
        return decodeURIComponent(pathPart);
    } catch {
        return '';
    }
}

function thumbPathFromFullStoragePath(fullPath) {
    const p = String(fullPath || '').trim();
    if (!p.toLowerCase().endsWith('.webp')) return '';
    if (p.toLowerCase().includes('_thumb.webp')) return '';
    return p.replace(/\.webp$/i, '_thumb.webp');
}

function thumbUrlLooksValid(fullUrl, thumbUrl) {
    const f = String(fullUrl || '').trim();
    const t = String(thumbUrl || '').trim();
    return Boolean(f && t && f !== t);
}

async function fetchImageBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error('vacío');
    return buf;
}

async function regenerateThumbToPath(fullUrl, thumbDestinationPath) {
    const buf = await fetchImageBuffer(fullUrl);
    const { buffer: thumbBuffer } = await optimizeImage(buf, { maxWidth: 560, quality: 66 });
    assertOptimizedBuffers([thumbBuffer]);
    const newThumbUrl = await uploadFile(thumbBuffer, thumbDestinationPath, 'image/webp');
    assertDistinctPublicUrls(fullUrl, newThumbUrl);
    return newThumbUrl;
}

/**
 * @param {object} opts
 * @param {string} opts.empresaId
 * @param {boolean} opts.apply
 * @param {boolean} opts.force
 * @param {string} [opts.propiedadId]
 * @param {(s: string) => void} [opts.log]
 * @returns {Promise<object>}
 */
async function runWebImagesRepair(opts) {
    const { empresaId, apply, force, propiedadId: propiedadIdOpt } = opts;
    const log = typeof opts.log === 'function' ? opts.log : () => {};

    if (!IS_POSTGRES || !pool) {
        const e = new Error('Esta operación requiere PostgreSQL.');
        e.code = 'PG_REQUIRED';
        throw e;
    }
    if (!empresaId || typeof empresaId !== 'string') {
        const e = new Error('empresaId inválido.');
        e.code = 'BAD_INPUT';
        throw e;
    }

    const propiedadId = propiedadIdOpt ? String(propiedadIdOpt).trim() : '';

    let galSql = `
        SELECT id, propiedad_id, storage_url, thumbnail_url, estado
        FROM galeria
        WHERE empresa_id = $1 AND COALESCE(estado,'') <> 'descartada'`;
    const galParams = [empresaId];
    if (propiedadId) {
        galSql += ' AND propiedad_id = $2';
        galParams.push(propiedadId);
    }
    galSql += ' ORDER BY propiedad_id, orden';
    const { rows: galRows } = await pool.query(galSql, galParams);

    let repaired = 0;
    let deleted = 0;
    let skipped = 0;

    for (const row of galRows) {
        const fullUrl = String(row.storage_url || '').trim();
        const thumbUrl = String(row.thumbnail_url || '').trim();
        const fullPath = storagePathFromPublicUrl(fullUrl);

        if (!fullUrl || !fullPath) {
            log(`  [galeria ${row.id}] sin URL full → eliminar`);
            if (apply) {
                try {
                    await eliminarFoto(null, empresaId, row.propiedad_id, row.id);
                    deleted++;
                } catch (e) {
                    log(`    WARN eliminar: ${e.message}`);
                }
            }
            continue;
        }

        if (fullPath.toLowerCase().includes('_thumb.webp')) {
            log(`  [galeria ${row.id}] storage_url parece miniatura, no full → eliminar`);
            if (apply) {
                try {
                    await eliminarFoto(null, empresaId, row.propiedad_id, row.id);
                    deleted++;
                } catch (e) {
                    log(`    WARN eliminar: ${e.message}`);
                }
            }
            continue;
        }

        if (!force && thumbUrlLooksValid(fullUrl, thumbUrl)) {
            skipped++;
            continue;
        }

        const thumbPath = thumbPathFromFullStoragePath(fullPath);
        if (!thumbPath) {
            log(`  [galeria ${row.id}] no se pudo derivar ruta thumb → eliminar`);
            if (apply) {
                try {
                    await eliminarFoto(null, empresaId, row.propiedad_id, row.id);
                    deleted++;
                } catch (e) {
                    log(`    WARN eliminar: ${e.message}`);
                }
            }
            continue;
        }

        log(`  [galeria ${row.id}] regenerar thumb ← ${fullPath.slice(0, 64)}…`);
        if (!apply) continue;

        try {
            if (thumbUrl) await deleteFileByPath(thumbUrl).catch(() => {});
            const newThumbUrl = await regenerateThumbToPath(fullUrl, thumbPath);
            await pool.query(
                `UPDATE galeria SET thumbnail_url = $1, updated_at = NOW()
                 WHERE id = $2 AND empresa_id = $3 AND propiedad_id = $4`,
                [newThumbUrl, row.id, empresaId, row.propiedad_id]
            );
            repaired++;
        } catch (e) {
            log(`    FALLÓ (${e.message}) → eliminar fila`);
            try {
                await eliminarFoto(null, empresaId, row.propiedad_id, row.id);
                deleted++;
            } catch (e2) {
                log(`    WARN eliminar: ${e2.message}`);
            }
        }
    }

    log(`  Resumen galería: reparadas=${repaired} eliminadas=${deleted} omitidas_ok=${skipped} total=${galRows.length}`);

    let propSql = 'SELECT id, metadata FROM propiedades WHERE empresa_id = $1';
    const propParams = [empresaId];
    if (propiedadId) {
        propSql += ' AND id = $2';
        propParams.push(propiedadId);
    }
    const { rows: props } = await pool.query(propSql, propParams);
    let cardsFixed = 0;
    let cardsNuked = 0;

    for (const pr of props) {
        const meta = pr.metadata && typeof pr.metadata === 'object' ? pr.metadata : {};
        const wd = meta.websiteData || {};
        const card = wd.cardImage;
        if (!card || typeof card !== 'object') continue;

        const fullU = String(card.storagePath || '').trim();
        if (!fullU) continue;

        const thU = String(card.thumbnailUrl || '').trim();
        if (!force && thumbUrlLooksValid(fullU, thU)) continue;

        const fullPathCard = storagePathFromPublicUrl(fullU);
        const thumbPathCard = thumbPathFromFullStoragePath(fullPathCard);
        if (!fullPathCard || !thumbPathCard || fullPathCard.toLowerCase().includes('_thumb.webp')) {
            log(`  [card ${pr.id}] inválida → quitar cardImage`);
            if (apply) {
                const newWd = { ...wd, cardImage: null };
                const newMeta = { ...meta, websiteData: newWd };
                await pool.query(
                    `UPDATE propiedades SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3`,
                    [JSON.stringify(newMeta), pr.id, empresaId]
                );
                cardsNuked++;
            }
            continue;
        }

        log(`  [card ${pr.id}] regenerar thumb`);
        if (!apply) continue;

        try {
            if (thU) await deleteFileByPath(thU).catch(() => {});
            const newThumbUrl = await regenerateThumbToPath(fullU, thumbPathCard);
            const newCard = { ...card, thumbnailUrl: newThumbUrl };
            const newWd = { ...wd, cardImage: newCard };
            const newMeta = { ...meta, websiteData: newWd };
            await pool.query(
                `UPDATE propiedades SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3`,
                [JSON.stringify(newMeta), pr.id, empresaId]
            );
            cardsFixed++;
        } catch (e) {
            log(`    FALLÓ card (${e.message}) → quitar cardImage`);
            const newWd = { ...wd, cardImage: null };
            const newMeta = { ...meta, websiteData: newWd };
            await pool.query(
                `UPDATE propiedades SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3`,
                [JSON.stringify(newMeta), pr.id, empresaId]
            );
            cardsNuked++;
        }
    }

    log(`  Resumen cardImage: thumbs_nuevos=${cardsFixed} quitadas=${cardsNuked}`);

    const { rows: empRows } = await pool.query(
        'SELECT configuracion FROM empresas WHERE id = $1',
        [empresaId]
    );
    const cfg0 = empRows[0]?.configuracion || {};
    const ws = cfg0.websiteSettings || {};
    const theme = ws.theme || {};
    const heroFull = String(theme.heroImageUrl || '').trim();
    const heroTh = String(theme.heroImageThumbUrl || '').trim();

    let heroUpdated = false;
    if (heroFull && (force || !thumbUrlLooksValid(heroFull, heroTh))) {
        const fullPathHero = storagePathFromPublicUrl(heroFull);
        const thumbPathHero = fullPathHero.toLowerCase().endsWith('.webp')
            ? fullPathHero.replace(/\.webp$/i, '-thumb.webp')
            : '';
        if (thumbPathHero && !fullPathHero.toLowerCase().includes('-thumb.webp')) {
            log('  [hero] regenerar miniatura portada');
            if (apply) {
                try {
                    if (heroTh) await deleteFileByPath(heroTh).catch(() => {});
                    const buf = await fetchImageBuffer(heroFull);
                    const { buffer: thumbBuffer } = await optimizeImage(buf, { maxWidth: 900, quality: 64 });
                    assertOptimizedBuffers([thumbBuffer]);
                    const newThumbUrl = await uploadFile(thumbBuffer, thumbPathHero, 'image/webp');
                    assertDistinctPublicUrls(heroFull, newThumbUrl);
                    const newCfg = JSON.parse(JSON.stringify(cfg0));
                    newCfg.websiteSettings = newCfg.websiteSettings || {};
                    newCfg.websiteSettings.theme = {
                        ...(newCfg.websiteSettings.theme || {}),
                        ...theme,
                        heroImageThumbUrl: newThumbUrl,
                    };
                    await pool.query(
                        'UPDATE empresas SET configuracion = $1::jsonb, updated_at = NOW() WHERE id = $2',
                        [JSON.stringify(newCfg), empresaId]
                    );
                    heroUpdated = true;
                    log('  Hero: miniatura actualizada.');
                } catch (e) {
                    log(`  [hero] FALLÓ (${e.message}) → vaciar URLs hero`);
                    const newCfg = JSON.parse(JSON.stringify(cfg0));
                    newCfg.websiteSettings = newCfg.websiteSettings || {};
                    newCfg.websiteSettings.theme = {
                        ...(newCfg.websiteSettings.theme || {}),
                        ...theme,
                        heroImageUrl: '',
                        heroImageThumbUrl: '',
                    };
                    await pool.query(
                        'UPDATE empresas SET configuracion = $1::jsonb, updated_at = NOW() WHERE id = $2',
                        [JSON.stringify(newCfg), empresaId]
                    );
                }
            }
        } else if (apply) {
            log('  [hero] no se puede derivar ruta -thumb.webp desde la URL → limpiar hero');
            const newCfg = JSON.parse(JSON.stringify(cfg0));
            newCfg.websiteSettings = newCfg.websiteSettings || {};
            newCfg.websiteSettings.theme = {
                ...(newCfg.websiteSettings.theme || {}),
                ...theme,
                heroImageUrl: '',
                heroImageThumbUrl: '',
            };
            await pool.query(
                'UPDATE empresas SET configuracion = $1::jsonb, updated_at = NOW() WHERE id = $2',
                [JSON.stringify(newCfg), empresaId]
            );
        }
    }

    if (apply) {
        for (const pr of props) {
            try {
                await syncToWebsite(null, empresaId, pr.id);
            } catch (e) {
                log(`  WARN sync ${pr.id}: ${e.message}`);
            }
        }
        try {
            ssrCache.invalidateEmpresaCache(empresaId);
            log('  Caché SSR invalidada.');
        } catch (e) {
            log(`  WARN cache: ${e.message}`);
        }
    }

    return {
        gallery: {
            repaired,
            deleted,
            skipped,
            total: galRows.length,
        },
        cardImage: {
            thumbsNew: cardsFixed,
            removed: cardsNuked,
        },
        hero: { updated: heroUpdated },
        apply,
        force: Boolean(force),
    };
}

module.exports = {
    runWebImagesRepair,
    storagePathFromPublicUrl,
    thumbPathFromFullStoragePath,
    thumbUrlLooksValid,
};
