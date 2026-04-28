/**
 * Audita (y opcionalmente regenera) datos SSR para la tenant con subdominio "prueba1".
 *
 * Requisitos: PostgreSQL activo (DATABASE_URL), mismas variables de IA que el backend.
 *
 * Uso (desde backend/):
 *   node scripts/audit-prueba1-ssr.js
 *   node scripts/audit-prueba1-ssr.js --regenerate
 *   node scripts/audit-prueba1-ssr.js --regenerate --propiedad=<uuid>
 *   node scripts/audit-prueba1-ssr.js --http
 *
 * --http usa SSR_TEST_BASE_URL (default http://localhost:3001) y ?force_host=<dominio empresa>
 */

const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = require('../db/postgres');

const SUBDOMAIN = 'prueba1';

function parseArgs() {
    const a = process.argv.slice(2);
    return {
        regenerate: a.includes('--regenerate'),
        http: a.includes('--http'),
        propiedad: (a.find((x) => x.startsWith('--propiedad=')) || '').split('=')[1] || null,
    };
}

async function findEmpresasPrueba1() {
    const { rows } = await pool.query(
        `SELECT id, nombre, subdominio, configuracion,
                configuracion->'websiteSettings'->>'subdomain' AS ws_subdomain,
                configuracion->'websiteSettings'->>'domain' AS ws_domain
         FROM empresas
         WHERE LOWER(COALESCE(subdominio, '')) = $1
            OR LOWER(COALESCE(configuracion->'websiteSettings'->>'subdomain', '')) = $1`,
        [SUBDOMAIN.toLowerCase()]
    );
    return rows;
}

function auditBuildContext(ctx) {
    const issues = [];
    const ok = [];
    const nEsp = ctx?.producto?.espacios?.length || 0;
    if (!nEsp) issues.push('producto.espacios vacío (sin componentes / no sincronizado)');
    else ok.push(`producto: ${nEsp} espacio(s)`);

    if (!ctx?.narrativa?.descripcionComercial) issues.push('narrativa.descripcionComercial ausente');
    else ok.push('narrativa presente');

    const pub = ctx?.publicacion || {};
    if (!pub.metaTitle && !pub.jsonLd) {
        issues.push('publicacion sin metaTitle ni jsonLd');
    } else {
        if (pub.metaTitle) ok.push('publicacion.metaTitle');
        if (pub.metaDescription) ok.push('publicacion.metaDescription');
        if (pub.jsonLd && (pub.jsonLd['@context'] || pub.jsonLd['@type'])) ok.push('publicacion.jsonLd');
        else if (pub.jsonLd) issues.push('publicacion.jsonLd sin @context/@type reconocible');
    }

    return { issues, ok };
}

function warnTenantAlignment(emp) {
    const col = (emp.subdominio || '').toLowerCase();
    const ws = (emp.ws_subdomain || '').toLowerCase();
    if (col && col !== SUBDOMAIN) {
        console.warn(`  [aviso] columna subdominio="${emp.subdominio}" ≠ "${SUBDOMAIN}" (resolución SSR usa subdominio primero)`);
    }
    if (ws && ws !== SUBDOMAIN) {
        console.warn(`  [aviso] websiteSettings.subdomain="${emp.ws_subdomain}" ≠ "${SUBDOMAIN}"`);
    }
    if (!col && ws === SUBDOMAIN) {
        console.warn('  [aviso] subdominio en columna vacío: conviene rellenar empresas.subdominio para consistencia con tenantResolver');
    }
    const dom = (emp.ws_domain || '').trim();
    if (dom && !dom.includes('.')) {
        console.warn(
            `  [aviso] websiteSettings.domain="${dom}" no parece FQDN (falta sufijo .suitemanager.com / .onrender.com). ` +
                'Puede afectar resolución por dominio completo; el subdominio en columna sigue funcionando para *.suitemanager.com.'
        );
    }
}

/**
 * @param {string|null} forceHost — hostname para force_host (ej. prueba1.suitemanagers.com)
 */
function httpGet(url) {
    return new Promise((resolve, reject) => {
        http
            .get(url, (res) => {
                let data = '';
                res.on('data', (c) => {
                    data += c;
                });
                res.on('end', () => resolve({ status: res.statusCode, data }));
            })
            .on('error', reject);
    });
}

async function runHttpSmoke(empresaRow) {
    const base = (process.env.SSR_TEST_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
    const cfg = empresaRow.configuracion || {};
    const forceHost =
        empresaRow.ws_domain
        || cfg.websiteSettings?.domain
        || cfg.websiteSettings?.general?.domain
        || `${SUBDOMAIN}.suitemanagers.com`;

    console.log(`\n[HTTP] GET ${base}/?force_host=${forceHost}`);
    try {
        const home = await httpGet(`${base}/?force_host=${encodeURIComponent(forceHost)}`);
        if (home.status !== 200) {
            console.error(`  [HTTP] home status ${home.status}`);
            return;
        }
        if (home.data.includes('Error al cargar (B01)') || home.data.includes('ReferenceError')) {
            console.error('  [HTTP] HTML contiene error B01 o ReferenceError');
            return;
        }
        console.log('  [HTTP] home OK (200, sin B01/ReferenceError)');

        const { rows: firstProp } = await pool.query(
            `SELECT id FROM propiedades WHERE empresa_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
            [empresaRow.id]
        );
        if (firstProp[0]) {
            const url = `${base}/propiedad/${firstProp[0].id}?force_host=${encodeURIComponent(forceHost)}`;
            console.log(`[HTTP] GET propiedad (muestra) ${url}`);
            const pr = await httpGet(url);
            if (pr.status !== 200) console.error(`  [HTTP] propiedad status ${pr.status}`);
            else {
                const hasLd =
                    pr.data.includes('application/ld+json')
                    || pr.data.includes('"@type"')
                    || pr.data.includes('schema.org');
                console.log(hasLd ? '  [HTTP] propiedad OK (200, posible JSON-LD en HTML)' : '  [HTTP] propiedad 200 (no se detectó JSON-LD en string — revisar vista)');
            }
        } else {
            console.log('  [HTTP] sin propiedades para probar /propiedad/...');
        }
    } catch (e) {
        console.error('  [HTTP]', e.message);
    }
}

async function regenerateOne(empresaId, propiedadId) {
    const {
        getBuildContext,
        updateBuildContextSection,
        mergePublicacionForPersist,
        construirProductoDesdeComponentes,
    } = require('../services/buildContextService');
    const { generarNarrativaDesdeContexto, generarJsonLdDesdeContexto } = require('../services/aiContentService');
    const { validatePreGenerationData } = require('../services/ai/jsonldPreValidation');

    console.log('  [regenerate] sync producto desde componentes…');
    await construirProductoDesdeComponentes(null, empresaId, propiedadId);

    let context = await getBuildContext(null, empresaId, propiedadId);
    if (!context?.producto?.espacios?.length) {
        console.warn('  [regenerate] SKIP: sin espacios en producto tras sync');
        return false;
    }

    console.log('  [regenerate] IA narrativa (objetivo SSR en prompt)…');
    const narrativa = await generarNarrativaDesdeContexto(context);
    if (!narrativa?.descripcionComercial) {
        console.warn('  [regenerate] SKIP: IA no devolvió narrativa');
        return false;
    }

    await updateBuildContextSection(empresaId, propiedadId, 'narrativa', {
        ...narrativa,
        generadoEn: new Date().toISOString(),
    });

    await pool.query(
        `UPDATE propiedades
         SET metadata = jsonb_set(
                 jsonb_set(
                     COALESCE(metadata, '{}'::jsonb),
                     '{websiteData,h1}', $1::jsonb, true
                 ),
                 '{websiteData,aiDescription}', $2::jsonb, true
             ),
             updated_at = NOW()
         WHERE id = $3 AND empresa_id = $4`,
        [
            JSON.stringify(narrativa.homeH1 || ''),
            JSON.stringify(narrativa.descripcionComercial || ''),
            propiedadId,
            empresaId,
        ]
    );

    context = await getBuildContext(null, empresaId, propiedadId);
    const pre = validatePreGenerationData(context);
    if (!pre.canGenerate) {
        console.warn('  [regenerate] SKIP JSON-LD:', pre.errors?.join?.('; ') || pre);
        return true;
    }

    console.log('  [regenerate] IA JSON-LD + publicacion…');
    const rawResult = await generarJsonLdDesdeContexto(context);
    const isDirectJsonLd = rawResult && (rawResult['@type'] || rawResult['@context']);
    const result = isDirectJsonLd
        ? { metaTitle: '', metaDescription: '', jsonLd: rawResult }
        : (rawResult || {});

    if (result.jsonLd) {
        try {
            const { rows: galeriaRows } = await pool.query(
                `SELECT storage_url FROM galeria
                 WHERE empresa_id = $1 AND propiedad_id = $2 AND estado IN ('auto','manual')
                 ORDER BY CASE WHEN rol = 'portada' THEN 0 ELSE 1 END, confianza DESC NULLS LAST, orden ASC
                 LIMIT 8`,
                [empresaId, propiedadId]
            );
            if (galeriaRows.length > 0) {
                result.jsonLd.image = galeriaRows.map((r) => r.storage_url);
            }
        } catch (e) {
            console.warn('  [regenerate] inyección galería:', e.message);
        }
        try {
            const { spacesToContainsPlace } = require('../services/ai/schemaMappings');
            if (context?.producto?.espacios) {
                const cp = spacesToContainsPlace(context.producto.espacios);
                if (cp.length) result.jsonLd.containsPlace = cp;
            }
        } catch (e) {
            console.warn('  [regenerate] containsPlace:', e.message);
        }
    }

    const publicacionMerged = mergePublicacionForPersist(context.publicacion, result);
    await updateBuildContextSection(empresaId, propiedadId, 'publicacion', publicacionMerged);
    console.log('  [regenerate] publicacion guardada');
    return true;
}

async function main() {
    const args = parseArgs();

    if (!pool) {
        console.error('[audit-prueba1-ssr] PostgreSQL no disponible. Define DATABASE_URL (y DB_MODE=postgres si aplica).');
        process.exit(1);
    }

    const empresas = await findEmpresasPrueba1();
    if (!empresas.length) {
        console.error(
            `[audit-prueba1-ssr] No hay empresa con subdominio "${SUBDOMAIN}" en empresas.subdominio ni configuracion.websiteSettings.subdomain.`
        );
        process.exit(1);
    }

    const { getBuildContext } = require('../services/buildContextService');
    let exitCode = 0;

    for (const emp of empresas) {
        console.log(`\n========== Empresa ${emp.id} (${emp.nombre || 'sin nombre'}) ==========`);
        console.log('subdominio (columna):', emp.subdominio || '(vacío)');
        console.log('websiteSettings.subdomain:', emp.ws_subdomain || '(vacío)');
        console.log('websiteSettings.domain:', emp.ws_domain || '(vacío)');
        warnTenantAlignment(emp);

        const { rows: props } = await pool.query(
            `SELECT id, nombre FROM propiedades WHERE empresa_id = $1 ORDER BY nombre NULLS LAST`,
            [emp.id]
        );

        if (!props.length) {
            console.warn('Sin propiedades para esta empresa.');
            exitCode = 1;
            continue;
        }

        for (const p of props) {
            if (args.propiedad && p.id !== args.propiedad) continue;

            console.log(`\n--- Propiedad ${p.id} — ${p.nombre || '(sin nombre)'} ---`);
            let ctx;
            try {
                ctx = await getBuildContext(null, emp.id, p.id);
            } catch (e) {
                console.error('  getBuildContext:', e.message);
                exitCode = 1;
                continue;
            }

            const before = auditBuildContext(ctx);
            before.ok.forEach((x) => console.log('  ✓', x));
            before.issues.forEach((x) => {
                console.log('  ✗', x);
                exitCode = 1;
            });

            if (args.regenerate) {
                try {
                    await regenerateOne(emp.id, p.id);
                    const ctx2 = await getBuildContext(null, emp.id, p.id);
                    const after = auditBuildContext(ctx2);
                    console.log('  --- Tras regenerar ---');
                    after.ok.forEach((x) => console.log('  ✓', x));
                    after.issues.forEach((x) => {
                        console.log('  ✗', x);
                        exitCode = 1;
                    });
                } catch (e) {
                    console.error('  [regenerate] error:', e.message);
                    exitCode = 1;
                }
            }
        }

        if (args.http) {
            await runHttpSmoke(emp);
        }
    }

    process.exit(exitCode);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
