#!/usr/bin/env node
/**
 * Repara imágenes web sin re-subir todo: delega en `webImagesRepairService`.
 *
 * Una empresa:
 *   node scripts/tooling/repair-web-images.js --subdomain=orillasdelcoilaco --apply --force
 *
 * Todas las empresas (PostgreSQL):
 *   node scripts/tooling/repair-web-images.js --all-empresas --apply --force
 *
 * Incluir recomprimir hero FULL en Storage (mejor LCP; requiere --apply --force):
 *   node scripts/tooling/repair-web-images.js --empresa-id=UUID --apply --force --recompress-hero-full
 *
 * @see backend/services/webImagesRepairService.js
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

const pool = require(path.join(BACKEND_ROOT, 'db', 'postgres'));
const { IS_POSTGRES } = require(path.join(BACKEND_ROOT, 'config', 'dbConfig'));
const { runWebImagesRepair } = require(path.join(BACKEND_ROOT, 'services', 'webImagesRepairService'));

function parseArgs() {
    const out = {
        empresaId: null,
        subdomain: null,
        propiedadId: null,
        apply: false,
        force: false,
        allEmpresas: false,
        recompressHeroFull: false,
    };
    for (const a of process.argv.slice(2)) {
        if (a === '--apply') out.apply = true;
        else if (a === '--force') out.force = true;
        else if (a === '--all-empresas') out.allEmpresas = true;
        else if (a === '--recompress-hero-full') out.recompressHeroFull = true;
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

async function main() {
    const args = parseArgs();
    let { empresaId, propiedadId, apply, force, allEmpresas, recompressHeroFull } = args;

    if (allEmpresas && !apply) {
        console.error('[repair-web-images] --all-empresas requiere --apply (evita dry-run accidental masivo).');
        process.exit(1);
    }
    if (recompressHeroFull && (!apply || !force)) {
        console.error('[repair-web-images] --recompress-hero-full requiere --apply y --force.');
        process.exit(1);
    }
    if (!allEmpresas && !empresaId && !args.subdomain) {
        console.error('Obligatorio: --empresa-id=… o --subdomain=… o --all-empresas');
        process.exit(1);
    }
    if (!IS_POSTGRES || !pool) {
        console.error('Solo PostgreSQL.');
        process.exit(1);
    }

    const runOne = async (eid) => {
        const mode = apply ? 'APLICAR' : 'DRY-RUN';
        console.log(
            `[repair-web-images] ${mode}${force ? ' (force)' : ''}${recompressHeroFull ? ' (+recompress hero full)' : ''} empresa_id=${eid}${propiedadId ? ` propiedad=${propiedadId}` : ''}`
        );
        await runWebImagesRepair({
            empresaId: eid,
            apply,
            force,
            recompressHeroFull,
            propiedadId: propiedadId || undefined,
            log: console.log,
        });
    };

    if (allEmpresas) {
        const { rows } = await pool.query('SELECT id FROM empresas ORDER BY id');
        console.log(`[repair-web-images] ${rows.length} empresa(s) — inicio`);
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            console.log(`\n========== ${i + 1}/${rows.length} empresa ${row.id} ==========`);
            try {
                await runOne(row.id);
            } catch (e) {
                console.error(`[repair-web-images] ERROR empresa ${row.id}:`, e.message);
            }
        }
        console.log('\n[repair-web-images] fin.');
        return;
    }

    empresaId = await resolveEmpresaId(pool, { empresaId, subdomain: args.subdomain });
    if (!empresaId) {
        console.error('Empresa no resuelta.');
        process.exit(1);
    }

    try {
        await runOne(empresaId);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }

    if (!apply) {
        console.log('\n  Añade --apply para ejecutar. Usa --force para regenerar todas las miniaturas válidas.');
        console.log('  --all-empresas --apply --force recorre todas las empresas.');
        console.log('  --recompress-hero-full solo con --apply --force (vuelve a comprimir hero completo en Storage).');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
