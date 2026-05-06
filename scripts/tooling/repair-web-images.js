#!/usr/bin/env node
/**
 * Repara imágenes web sin re-subir todo: regenera miniaturas desde el full en Storage
 * cuando la descarga y Sharp funcionan; si no, elimina la fila de galería (o limpia card/hero).
 *
 * Requisitos: PostgreSQL, backend/.env (DATABASE_URL), Firebase (serviceAccountKey.json),
 * mismo bucket que el backend.
 *
 * Uso:
 *   node scripts/tooling/repair-web-images.js --subdomain=miempresa
 *   node scripts/tooling/repair-web-images.js --empresa-id=<UUID> [--propiedad-id=<id>] [--apply]
 *   node scripts/tooling/repair-web-images.js --subdomain=miempresa --force --apply
 *
 * --force : vuelve a generar todas las miniaturas de galería aunque ya parezcan válidas.
 *
 * Con --apply:
 * - Galería: descarga storage_url → thumb 560px WebP → sube *_thumb.webp → UPDATE thumbnail_url.
 *   Si falla descarga/proceso → eliminarFoto (Storage + fila).
 * - cardImage por propiedad: mismo criterio; actualiza metadata.websiteData.cardImage.thumbnailUrl.
 * - Hero empresa: regenera heroImageThumbUrl desde heroImageUrl si el par es inválido.
 * - syncToWebsite por propiedad + invalidación caché SSR.
 */

const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..', '..', 'backend');
const ENV_PATH = path.join(BACKEND_ROOT, '.env');

function loadBackendEnv() {
    try {
        require(path.join(BACKEND_ROOT, 'node_modules', 'dotenv')).config({ path: ENV_PATH });
        return true;
    } catch (e) {
        try {
            require('dotenv').config({ path: ENV_PATH });
            return true;
        } catch (e2) {
            console.warn('[repair-web-images] No se pudo cargar dotenv:', e2.message);
            return false;
        }
    }
}

loadBackendEnv();

// firebase-admin vive en backend/node_modules
const admin = require(path.join(BACKEND_ROOT, 'node_modules', 'firebase-admin'));

function initFirebase() {
    if (admin.apps.length) return;
    let serviceAccount;
    if (process.env.RENDER) {
        serviceAccount = require('/etc/secrets/serviceAccountKey.json');
    } else {
        serviceAccount = require(path.join(BACKEND_ROOT, 'serviceAccountKey.json'));
    }
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'suite-manager-app.firebasestorage.app',
    });
}

initFirebase();

const fetch = require(path.join(BACKEND_ROOT, 'node_modules', 'node-fetch'));
const pool = require(path.join(BACKEND_ROOT, 'db', 'postgres'));
const { IS_POSTGRES } = require(path.join(BACKEND_ROOT, 'config', 'dbConfig'));
const { optimizeImage } = require(path.join(BACKEND_ROOT, 'services', 'imageProcessingService'));
const { uploadFile, deleteFileByPath } = require(path.join(BACKEND_ROOT, 'services', 'storageService'));
const {
    assertOptimizedBuffers,
    assertDistinctPublicUrls,
} = require(path.join(BACKEND_ROOT, 'services', 'imageUploadGuards'));
const { eliminarFoto, syncToWebsite } = require(path.join(BACKEND_ROOT, 'services', 'galeriaService'));
const { ssrCache } = require(path.join(BACKEND_ROOT, 'services', 'cacheService'));

function parseArgs() {
    const out = {
        empresaId: null,
        subdomain: null,
        propiedadId: null,
        apply: false,
        force: false,
    };
    for (const a of process.argv.slice(2)) {
        if (a === '--apply') out.apply = true;
        else if (a === '--force') out.force = true;
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
        console.warn('[repair-web-images] Varias empresas con ese subdomain; usa --empresa-id.');
        return null;
    }
    return rows[0].id;
}

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

async function main() {
    const args = parseArgs();
    let { empresaId, propiedadId, apply, force } = args;
    if (!empresaId && !args.subdomain) {
        console.error('Obligatorio: --empresa-id=… o --subdomain=…');
        process.exit(1);
    }
    if (!IS_POSTGRES || !pool) {
        console.error('Solo PostgreSQL.');
        process.exit(1);
    }

    empresaId = await resolveEmpresaId(pool, { empresaId, subdomain: args.subdomain });
    if (!empresaId) {
        console.error('Empresa no resuelta.');
        process.exit(1);
    }

    const mode = apply ? 'APLICAR' : 'DRY-RUN';
    console.log(`[repair-web-images] ${mode}${force ? ' (force)' : ''} empresa_id=${empresaId}${propiedadId ? ` propiedad=${propiedadId}` : ''}`);

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
            console.log(`  [galeria ${row.id}] sin URL full → eliminar`);
            if (apply) {
                try {
                    await eliminarFoto(null, empresaId, row.propiedad_id, row.id);
                    deleted++;
                } catch (e) {
                    console.warn(`    WARN eliminar: ${e.message}`);
                }
            }
            continue;
        }

        if (fullPath.toLowerCase().includes('_thumb.webp')) {
            console.log(`  [galeria ${row.id}] storage_url parece miniatura, no full → eliminar`);
            if (apply) {
                try {
                    await eliminarFoto(null, empresaId, row.propiedad_id, row.id);
                    deleted++;
                } catch (e) {
                    console.warn(`    WARN eliminar: ${e.message}`);
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
            console.log(`  [galeria ${row.id}] no se pudo derivar ruta thumb → eliminar`);
            if (apply) {
                try {
                    await eliminarFoto(null, empresaId, row.propiedad_id, row.id);
                    deleted++;
                } catch (e) {
                    console.warn(`    WARN eliminar: ${e.message}`);
                }
            }
            continue;
        }

        console.log(`  [galeria ${row.id}] regenerar thumb ← ${fullPath.slice(0, 64)}…`);
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
            console.warn(`    FALLÓ (${e.message}) → eliminar fila`);
            try {
                await eliminarFoto(null, empresaId, row.propiedad_id, row.id);
                deleted++;
            } catch (e2) {
                console.warn(`    WARN eliminar: ${e2.message}`);
            }
        }
    }

    console.log(`  Resumen galería: reparadas=${repaired} eliminadas=${deleted} omitidas_ok=${skipped} total=${galRows.length}`);

    // ── cardImage por propiedad ──
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

        const fullPath = storagePathFromPublicUrl(fullU);
        const thumbPath = thumbPathFromFullStoragePath(fullPath);
        if (!fullPath || !thumbPath || fullPath.toLowerCase().includes('_thumb.webp')) {
            console.log(`  [card ${pr.id}] inválida → quitar cardImage`);
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

        console.log(`  [card ${pr.id}] regenerar thumb`);
        if (!apply) continue;

        try {
            if (thU) await deleteFileByPath(thU).catch(() => {});
            const newThumbUrl = await regenerateThumbToPath(fullU, thumbPath);
            const newCard = { ...card, thumbnailUrl: newThumbUrl };
            const newWd = { ...wd, cardImage: newCard };
            const newMeta = { ...meta, websiteData: newWd };
            await pool.query(
                `UPDATE propiedades SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3`,
                [JSON.stringify(newMeta), pr.id, empresaId]
            );
            cardsFixed++;
        } catch (e) {
            console.warn(`    FALLÓ card (${e.message}) → quitar cardImage`);
            const newWd = { ...wd, cardImage: null };
            const newMeta = { ...meta, websiteData: newWd };
            await pool.query(
                `UPDATE propiedades SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3`,
                [JSON.stringify(newMeta), pr.id, empresaId]
            );
            cardsNuked++;
        }
    }

    console.log(`  Resumen cardImage: thumbs_nuevos=${cardsFixed} quitadas=${cardsNuked}`);

    // ── Hero empresa ──
    const { rows: empRows } = await pool.query(
        'SELECT configuracion FROM empresas WHERE id = $1',
        [empresaId]
    );
    const cfg0 = empRows[0]?.configuracion || {};
    const ws = cfg0.websiteSettings || {};
    const theme = ws.theme || {};
    const heroFull = String(theme.heroImageUrl || '').trim();
    const heroTh = String(theme.heroImageThumbUrl || '').trim();

    let heroFixed = false;
    if (heroFull && (force || !thumbUrlLooksValid(heroFull, heroTh))) {
        const fullPath = storagePathFromPublicUrl(heroFull);
        const thumbPath = fullPath.toLowerCase().endsWith('.webp')
            ? fullPath.replace(/\.webp$/i, '-thumb.webp')
            : '';
        if (thumbPath && !fullPath.toLowerCase().includes('-thumb.webp')) {
            console.log(`  [hero] regenerar miniatura portada`);
            if (apply) {
                try {
                    if (heroTh) await deleteFileByPath(heroTh).catch(() => {});
                    const buf = await fetchImageBuffer(heroFull);
                    const { buffer: thumbBuffer } = await optimizeImage(buf, { maxWidth: 900, quality: 64 });
                    assertOptimizedBuffers([thumbBuffer]);
                    const newThumbUrl = await uploadFile(thumbBuffer, thumbPath, 'image/webp');
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
                    heroFixed = true;
                } catch (e) {
                    console.warn(`  [hero] FALLÓ (${e.message}) → vaciar URLs hero`);
                    const newCfg = JSON.parse(JSON.stringify(cfg0));
                    newCfg.websiteSettings = newCfg.websiteSettings || {};
                    newCfg.websiteSettings.theme = { ...(newCfg.websiteSettings.theme || {}), ...theme, heroImageUrl: '', heroImageThumbUrl: '' };
                    await pool.query(
                        'UPDATE empresas SET configuracion = $1::jsonb, updated_at = NOW() WHERE id = $2',
                        [JSON.stringify(newCfg), empresaId]
                    );
                }
            }
        } else {
            console.log('  [hero] no se puede derivar ruta -thumb.webp desde la URL → limpiar hero con --apply');
            if (apply) {
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
    }

    if (heroFixed) console.log('  Hero: miniatura actualizada.');

    if (apply) {
        for (const pr of props) {
            try {
                const r = await syncToWebsite(null, empresaId, pr.id);
                console.log(`  syncToWebsite ${pr.id}: total=${r.total}, componentes=${r.componentes}`);
            } catch (e) {
                console.warn(`  WARN sync ${pr.id}: ${e.message}`);
            }
        }
        try {
            ssrCache.invalidateEmpresaCache(empresaId);
            console.log('  Caché SSR invalidada.');
        } catch (e) {
            console.warn(`  WARN cache: ${e.message}`);
        }
    } else {
        console.log('\n  Añade --apply para ejecutar. Usa --force para regenerar todas las miniaturas válidas.');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
