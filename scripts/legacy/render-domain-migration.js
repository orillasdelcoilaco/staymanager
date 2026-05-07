/**
 * scripts/legacy/render-domain-migration.js
 * Script de migración de dominio: suitemanagers.com → rezerva.cl en Render.
 *
 * Uso:
 *   RENDER_API_KEY=rnd_xxx node scripts/legacy/render-domain-migration.js
 *
 * Qué hace:
 *   1. Lista dominios actuales en el servicio
 *   2. Elimina suitemanagers.com y variantes
 *   3. Agrega rezerva.cl y www.rezerva.cl
 *   4. Actualiza PLATFORM_DOMAIN y PUBLIC_SITES_ROOT_DOMAIN en las env vars del servicio
 *   5. Muestra las instrucciones DNS que debes aplicar en NicChile
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const RENDER_API_BASE = 'https://api.render.com/v1';
const SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-d34qlgodl3ps7384h86g';
const API_KEY = process.env.RENDER_API_KEY;

const OLD_DOMAINS = ['suitemanagers.com', 'www.suitemanagers.com', 'suitemanager.com', 'www.suitemanager.com'];
const NEW_DOMAINS = ['rezerva.cl', 'www.rezerva.cl'];
const NEW_PLATFORM_DOMAIN = 'rezerva.cl';

if (!API_KEY) {
    console.error('\n❌  RENDER_API_KEY no configurada.');
    console.error('    Obtén tu API key en: https://dashboard.render.com/u/account/api-keys');
    console.error('    Luego ejecuta: RENDER_API_KEY=rnd_xxx node scripts/legacy/render-domain-migration.js\n');
    process.exit(1);
}

function headers() {
    return {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
}

async function apiFetch(method, path, body) {
    const res = await fetch(`${RENDER_API_BASE}${path}`, {
        method,
        headers: headers(),
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, ok: res.ok, data };
}

// --- Dominios ---

async function listDomains() {
    const { ok, data } = await apiFetch('GET', `/services/${SERVICE_ID}/custom-domains?limit=100`);
    if (!ok) throw new Error(`listDomains: ${JSON.stringify(data)}`);
    const items = Array.isArray(data) ? data : (data.customDomains || data.data || []);
    return items.map(i => i.customDomain || i);
}

async function removeDomain(name) {
    const encoded = encodeURIComponent(name.trim().toLowerCase());
    const { status, data } = await apiFetch('DELETE', `/services/${SERVICE_ID}/custom-domains/${encoded}`);
    if (status === 404) { console.log(`  ⚠️  ${name} — no existía en Render`); return; }
    if (status >= 400) throw new Error(`removeDomain(${name}): ${JSON.stringify(data)}`);
    console.log(`  ✅ Eliminado: ${name}`);
}

async function addDomain(name) {
    const { status, data } = await apiFetch('POST', `/services/${SERVICE_ID}/custom-domains`, { name });
    if (status === 409) { console.log(`  ℹ️  ${name} — ya existía en Render`); return data; }
    if (status >= 400) throw new Error(`addDomain(${name}): ${JSON.stringify(data)}`);
    console.log(`  ✅ Agregado: ${name}`);
    return data;
}

// --- Env vars ---

async function getEnvVars() {
    const { ok, data } = await apiFetch('GET', `/services/${SERVICE_ID}/env-vars`);
    if (!ok) throw new Error(`getEnvVars: ${JSON.stringify(data)}`);
    const items = Array.isArray(data) ? data : (data.envVars || []);
    return items.map(i => i.envVar || i);
}

async function updateEnvVars(updates) {
    // GET all, merge, PUT all back
    const current = await getEnvVars();
    const map = {};
    for (const v of current) map[v.key] = v.value;
    for (const [k, v] of Object.entries(updates)) map[k] = v;
    const payload = Object.entries(map).map(([key, value]) => ({ key, value }));

    const { ok, data } = await apiFetch('PUT', `/services/${SERVICE_ID}/env-vars`, { envVars: payload });
    if (!ok) throw new Error(`updateEnvVars: ${JSON.stringify(data)}`);
    console.log(`  ✅ Env vars actualizadas: ${Object.keys(updates).join(', ')}`);
}

// --- Main ---

async function main() {
    console.log('\n🚀  Render Domain Migration — suitemanagers.com → rezerva.cl');
    console.log(`    Servicio: ${SERVICE_ID}\n`);

    // 1. Estado actual
    console.log('📋  Dominios actuales en Render:');
    const current = await listDomains();
    if (current.length === 0) {
        console.log('    (ninguno registrado)');
    } else {
        for (const d of current) console.log(`    - ${d.name} [${d.verificationStatus || 'unknown'}]`);
    }

    // 2. Eliminar dominios viejos
    console.log('\n🗑️   Eliminando dominios anteriores:');
    for (const d of OLD_DOMAINS) await removeDomain(d);

    // 3. Agregar dominios nuevos
    console.log('\n➕  Registrando nuevos dominios:');
    for (const d of NEW_DOMAINS) await addDomain(d);

    // 4. Actualizar env vars
    console.log('\n🔧  Actualizando variables de entorno en Render:');
    await updateEnvVars({
        PLATFORM_DOMAIN: NEW_PLATFORM_DOMAIN,
        PUBLIC_SITES_ROOT_DOMAIN: NEW_PLATFORM_DOMAIN,
    });

    // 5. Instrucciones DNS
    console.log('\n📡  INSTRUCCIONES DNS (aplicar en panel NicChile):');
    console.log('    ┌──────────────────────────────────────────────────────────────┐');
    console.log('    │  rezerva.cl (dominio raíz / apex)                           │');
    console.log('    │  Tipo:  CNAME  (o ALIAS/ANAME si NicChile lo soporta)       │');
    console.log('    │  Host:  @                                                    │');
    console.log(`    │  Valor: ${SERVICE_ID}.onrender.com                 │`);
    console.log('    ├──────────────────────────────────────────────────────────────┤');
    console.log('    │  www.rezerva.cl                                              │');
    console.log('    │  Tipo:  CNAME                                                │');
    console.log('    │  Host:  www                                                  │');
    console.log(`    │  Valor: ${SERVICE_ID}.onrender.com                 │`);
    console.log('    ├──────────────────────────────────────────────────────────────┤');
    console.log('    │  *.rezerva.cl (subdominio wildcard — tenants)                │');
    console.log('    │  Tipo:  CNAME                                                │');
    console.log('    │  Host:  *                                                    │');
    console.log(`    │  Valor: ${SERVICE_ID}.onrender.com                 │`);
    console.log('    └──────────────────────────────────────────────────────────────┘');
    console.log('\n    ⏳ Propagación DNS .cl puede tardar 24-48 horas.');
    console.log('    ✅ Render verificará automáticamente el dominio cuando el DNS propague.\n');

    // 6. Verificar estado final
    console.log('📋  Dominios registrados en Render tras migración:');
    const after = await listDomains();
    for (const d of after) console.log(`    - ${d.name} [${d.verificationStatus || 'pending'}]`);

    console.log('\n✅  Migración completada. Render disparará un redeploy automático al actualizar env vars.\n');
}

main().catch(err => {
    console.error('\n❌  Error en migración:', err.message);
    process.exit(1);
});
