/**
 * Hero empresa en Storage: miniatura o recomprimir full + thumb (repair masivo).
 */
const { optimizeImage } = require('./imageProcessingService');
const { uploadFile, deleteFileByPath } = require('./storageService');
const { assertOptimizedBuffers, assertDistinctPublicUrls } = require('./imageUploadGuards');
const { storagePathFromPublicUrl, thumbUrlLooksValid, fetchImageBuffer } = require('./webImagesRepairHelpers');

const REPAIR_HERO_FULL_MAX = 1920;
const REPAIR_HERO_FULL_QUALITY = 72;
const REPAIR_HERO_THUMB_MAX = 900;
const REPAIR_HERO_THUMB_QUALITY = 54;

/**
 * @returns {Promise<{ heroUpdated: boolean, heroFullRecompressed: boolean }>}
 */
async function repairHeroTheme({
    pool,
    cfg0,
    theme,
    empresaId,
    heroFull,
    heroTh,
    apply,
    force,
    recompressHeroFull,
    log,
}) {
    let heroUpdated = false;
    let heroFullRecompressed = false;

    const fullPathHero = heroFull ? storagePathFromPublicUrl(heroFull) : '';
    const thumbPathHero =
        fullPathHero &&
        fullPathHero.toLowerCase().endsWith('.webp') &&
        !fullPathHero.toLowerCase().includes('-thumb.webp')
            ? fullPathHero.replace(/\.webp$/i, '-thumb.webp')
            : '';
    const canHeroPaths = Boolean(thumbPathHero && fullPathHero);

    if (heroFull && apply && recompressHeroFull && force && canHeroPaths) {
        log('  [hero] recompress FULL + thumb (mismo path Storage, nuevas URLs token)');
        try {
            const buf = await fetchImageBuffer(heroFull);
            const { buffer: fullBuf } = await optimizeImage(buf, {
                maxWidth: REPAIR_HERO_FULL_MAX,
                quality: REPAIR_HERO_FULL_QUALITY,
            });
            const { buffer: thumbBuf } = await optimizeImage(fullBuf, {
                maxWidth: REPAIR_HERO_THUMB_MAX,
                quality: REPAIR_HERO_THUMB_QUALITY,
            });
            assertOptimizedBuffers([fullBuf, thumbBuf]);
            await deleteFileByPath(heroFull).catch(() => {});
            if (heroTh) await deleteFileByPath(heroTh).catch(() => {});
            const newFullUrl = await uploadFile(fullBuf, fullPathHero, 'image/webp');
            const newThumbUrl = await uploadFile(thumbBuf, thumbPathHero, 'image/webp');
            assertDistinctPublicUrls(newFullUrl, newThumbUrl);
            const newCfg = JSON.parse(JSON.stringify(cfg0));
            newCfg.websiteSettings = newCfg.websiteSettings || {};
            newCfg.websiteSettings.theme = {
                ...(newCfg.websiteSettings.theme || {}),
                ...theme,
                heroImageUrl: newFullUrl,
                heroImageThumbUrl: newThumbUrl,
            };
            await pool.query(
                'UPDATE empresas SET configuracion = $1::jsonb, updated_at = NOW() WHERE id = $2',
                [JSON.stringify(newCfg), empresaId]
            );
            heroUpdated = true;
            heroFullRecompressed = true;
            log('  Hero: full + thumb actualizados.');
        } catch (e) {
            log(`  [hero] recompress FULL FALLÓ (${e.message})`);
        }
    }

    if (!heroUpdated && heroFull && (force || !thumbUrlLooksValid(heroFull, heroTh))) {
        if (thumbPathHero && !fullPathHero.toLowerCase().includes('-thumb.webp')) {
            log('  [hero] regenerar miniatura portada');
            if (apply) {
                try {
                    if (heroTh) await deleteFileByPath(heroTh).catch(() => {});
                    const buf = await fetchImageBuffer(heroFull);
                    const { buffer: thumbBuffer } = await optimizeImage(buf, {
                        maxWidth: REPAIR_HERO_THUMB_MAX,
                        quality: REPAIR_HERO_THUMB_QUALITY,
                    });
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

    return { heroUpdated, heroFullRecompressed };
}

module.exports = {
    repairHeroTheme,
};
