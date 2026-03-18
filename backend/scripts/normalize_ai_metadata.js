/**
 * normalize_ai_metadata.js
 *
 * Normaliza con IA todos los activos (tiposElemento) y espacios (tiposComponente)
 * que tengan campos de metadata incompletos en Firestore.
 *
 * Solo actualiza los registros que realmente faltan datos — no sobreescribe campos ya completos.
 *
 * USO:
 *   node scripts/normalize_ai_metadata.js            → modo real
 *   node scripts/normalize_ai_metadata.js --dry-run  → solo muestra qué actualizaría
 *   node scripts/normalize_ai_metadata.js --empresa=<id>  → solo una empresa
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase igual que index.js
if (!admin.apps.length) {
    const serviceAccount = process.env.RENDER
        ? require('/etc/secrets/serviceAccountKey.json')
        : require('../serviceAccountKey.json');

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'suite-manager-app.firebasestorage.app'
    });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Importar servicios IA (después de inicializar Firebase para evitar circular deps)
const { analizarMetadataActivo, generateWithFallback } = require('../services/aiContentService');

// --- Config desde args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE_ICONS = args.includes('--force-icons'); // Re-evalúa ícono de TODOS los activos, no solo genéricos
const EMPRESA_FILTER = (args.find(a => a.startsWith('--empresa=')) || '').replace('--empresa=', '') || null;
const DELAY_MS = 600; // ms entre llamadas IA para evitar rate limit

// Campos que indican que el activo ya fue enriquecido correctamente
const CAMPOS_ACTIVO_REQUERIDOS = ['seo_tags', 'sales_context', 'schema_type', 'photo_guidelines'];
const CAMPOS_ESPACIO_REQUERIDOS = ['seo_description', 'palabrasClave'];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- Stats globales ---
const stats = {
    empresas: 0,
    activos: { total: 0, yaCompletos: 0, actualizados: 0, errores: 0 },
    espacios: { total: 0, yaCompletos: 0, actualizados: 0, errores: 0 }
};

// -------------------------------------------------------------------
// VERIFICACIÓN: ¿Necesita el activo ser enriquecido?
// -------------------------------------------------------------------
function activoNecesitaEnriquecimiento(activo) {
    const faltaSeoTags = !activo.seo_tags || activo.seo_tags.length === 0;
    const faltaSalesContext = !activo.sales_context;
    const faltaSchema = !activo.schema_type || activo.schema_type === 'Thing';
    const faltaPhotoGuide = !activo.photo_guidelines;
    const iconoGenerico = activo.icono === '🔹' || activo.icono === '🆕' || activo.icono === '❓';
    return faltaSeoTags || faltaSalesContext || faltaSchema || faltaPhotoGuide || iconoGenerico || FORCE_ICONS;
}

function espacioNecesitaEnriquecimiento(espacio) {
    const faltaSeoDesc = !espacio.seo_description;
    const faltaKeywords = !espacio.palabrasClave || espacio.palabrasClave.length === 0;
    return faltaSeoDesc || faltaKeywords;
}

// -------------------------------------------------------------------
// NORMALIZAR ACTIVOS (tiposElemento) de una empresa
// -------------------------------------------------------------------
async function normalizarActivos(empresaId) {
    const colRef = db.collection('empresas').doc(empresaId).collection('tiposElemento');
    const snapshot = await colRef.get();

    if (snapshot.empty) {
        console.log(`  [Activos] Sin registros.`);
        return;
    }

    const activos = snapshot.docs.map(d => ({ _ref: d.ref, id: d.id, ...d.data() }));
    stats.activos.total += activos.length;

    const pendientes = activos.filter(activoNecesitaEnriquecimiento);
    stats.activos.yaCompletos += activos.length - pendientes.length;

    console.log(`  [Activos] ${activos.length} total, ${pendientes.length} necesitan enriquecimiento`);

    for (const activo of pendientes) {
        if (DRY_RUN) {
            const faltantes = [];
            if (!activo.seo_tags || activo.seo_tags.length === 0) faltantes.push('seo_tags');
            if (!activo.sales_context) faltantes.push('sales_context');
            if (!activo.schema_type || activo.schema_type === 'Thing') faltantes.push('schema_type');
            if (!activo.photo_guidelines) faltantes.push('photo_guidelines');
            if (activo.icono === '🔹' || activo.icono === '🆕' || activo.icono === '❓') faltantes.push('icono');
            console.log(`    [DRY] "${activo.nombre}" → falta: [${faltantes.join(', ')}]`);
            stats.activos.actualizados++;
            continue;
        }

        try {
            console.log(`    → Enriqueciendo: "${activo.nombre}" (${activo.categoria || 'sin categoría'})`);

            const categoriasBase = ['Dormitorio', 'Baño', 'Cocina', 'Estar', 'Comedor', 'Exterior', 'Tecnología', 'Seguridad', 'Servicios', 'Básicos'];
            const aiResult = await analizarMetadataActivo(activo.nombre, categoriasBase);

            if (!aiResult) {
                console.warn(`    ⚠️  Sin resultado IA para "${activo.nombre}". Saltando.`);
                stats.activos.errores++;
                continue;
            }

            // Solo actualizar los campos que faltan — no sobreescribir los que ya tienen valor
            const update = {};

            if (!activo.seo_tags || activo.seo_tags.length === 0) update.seo_tags = aiResult.seo_tags || [];
            if (!activo.sales_context) update.sales_context = aiResult.sales_context || '';
            if (!activo.schema_type || activo.schema_type === 'Thing') update.schema_type = aiResult.schema_type || 'LocationFeatureSpecification';
            if (!activo.schema_property || activo.schema_property === 'amenityFeature') {
                // Solo actualizar si el AI sugiere algo más específico
                if (aiResult.schema_property && aiResult.schema_property !== 'amenityFeature') {
                    update.schema_property = aiResult.schema_property;
                }
            }
            if (!activo.photo_guidelines) update.photo_guidelines = aiResult.photo_guidelines || '';
            if (!activo.requires_photo) update.requires_photo = aiResult.requires_photo || false;
            if (!activo.photo_quantity) update.photo_quantity = aiResult.photo_quantity || 0;

            // Corregir ícono: siempre si --force-icons, solo si es genérico en modo normal
            const iconoGenerico = activo.icono === '🔹' || activo.icono === '🆕' || activo.icono === '❓';
            if (FORCE_ICONS || iconoGenerico) {
                const nuevoIcono = aiResult.icon || activo.icono;
                if (nuevoIcono !== activo.icono) {
                    update.icono = nuevoIcono;
                    if (FORCE_ICONS) console.log(`    🎨 Icono: "${activo.icono}" → "${nuevoIcono}"`);
                }
            }

            // Corregir categoría si es genérica
            if (!activo.categoria || activo.categoria === 'OTROS' || activo.categoria === 'EQUIPAMIENTO') {
                if (aiResult.category && aiResult.category !== 'OTROS') {
                    update.categoria = aiResult.category;
                }
            }

            // Corregir nombre si tiene capitalización incorrecta
            if (aiResult.normalized_name && aiResult.normalized_name !== activo.nombre) {
                update.nombre = aiResult.normalized_name;
            }

            update.ai_normalized = true;
            update.fechaNormalizacion = admin.firestore.FieldValue.serverTimestamp();

            console.log(`    ✅ Update: ${JSON.stringify(Object.keys(update))}`);

            if (!DRY_RUN) {
                await activo._ref.update(update);
            }

            stats.activos.actualizados++;

        } catch (error) {
            if (error.code === 'AI_QUOTA_EXCEEDED') {
                console.error(`    🚫 Cuota excedida. Esperando 30s antes de continuar...`);
                await sleep(30000);
                // No contar como error, reintentar en siguiente ciclo (no hacemos retry en el script)
            } else {
                console.error(`    ❌ Error en "${activo.nombre}": ${error.message}`);
            }
            stats.activos.errores++;
        }

        await sleep(DELAY_MS); // delay entre llamadas
    }
}

// -------------------------------------------------------------------
// NORMALIZAR ESPACIOS (tiposComponente) de una empresa
// -------------------------------------------------------------------
async function normalizarEspacios(empresaId) {
    const colRef = db.collection('empresas').doc(empresaId).collection('tiposComponente');
    const snapshot = await colRef.get();

    if (snapshot.empty) {
        console.log(`  [Espacios] Sin registros.`);
        return;
    }

    const espacios = snapshot.docs.map(d => ({ _ref: d.ref, id: d.id, ...d.data() }));
    stats.espacios.total += espacios.length;

    const pendientes = espacios.filter(espacioNecesitaEnriquecimiento);
    stats.espacios.yaCompletos += espacios.length - pendientes.length;

    console.log(`  [Espacios] ${espacios.length} total, ${pendientes.length} necesitan enriquecimiento`);

    for (const espacio of pendientes) {
        const nombre = espacio.nombreNormalizado || espacio.nombreUsuario || espacio.id;

        if (DRY_RUN) {
            const faltantes = [];
            if (!espacio.seo_description) faltantes.push('seo_description');
            if (!espacio.palabrasClave || espacio.palabrasClave.length === 0) faltantes.push('palabrasClave');
            console.log(`    [DRY] "${nombre}" → falta: [${faltantes.join(', ')}]`);
            stats.espacios.actualizados++;
            continue;
        }

        try {
            console.log(`    → Enriqueciendo espacio: "${nombre}"`);

            const prompt = `
                Actúa como Arquitecto de Hospitalidad. Para el espacio de alojamiento: "${nombre}".
                Genera:
                1. "seo_description": descripción web en 1-2 oraciones persuasivas para huéspedes (en español).
                2. "palabrasClave": 4-6 términos de búsqueda en español que usan los huéspedes.

                Responde SOLO con JSON válido:
                {
                    "seo_description": "Descripción optimizada del espacio...",
                    "palabrasClave": ["keyword1", "keyword2", "keyword3"]
                }
            `;

            const aiResult = await generateWithFallback(prompt);

            if (!aiResult) {
                console.warn(`    ⚠️  Sin resultado IA para espacio "${nombre}". Saltando.`);
                stats.espacios.errores++;
                continue;
            }

            const update = {};
            if (!espacio.seo_description) update.seo_description = aiResult.seo_description || '';
            if (!espacio.palabrasClave || espacio.palabrasClave.length === 0) {
                update.palabrasClave = aiResult.palabrasClave || [];
            }
            update.ai_normalized = true;
            update.fechaNormalizacion = admin.firestore.FieldValue.serverTimestamp();

            console.log(`    ✅ Update: ${JSON.stringify(Object.keys(update))}`);

            if (!DRY_RUN) {
                await espacio._ref.update(update);
            }

            stats.espacios.actualizados++;

        } catch (error) {
            if (error.code === 'AI_QUOTA_EXCEEDED') {
                console.error(`    🚫 Cuota excedida. Esperando 30s...`);
                await sleep(30000);
            } else {
                console.error(`    ❌ Error en espacio "${nombre}": ${error.message}`);
            }
            stats.espacios.errores++;
        }

        await sleep(DELAY_MS);
    }
}

// -------------------------------------------------------------------
// MAIN
// -------------------------------------------------------------------
async function main() {
    console.log('='.repeat(60));
    console.log('  SuiteManager — Normalización de Metadata IA');
    console.log(`  Modo: ${DRY_RUN ? '⚠️  DRY RUN (no escribe en DB)' : '🔴 REAL (escribe en DB)'}`);
    if (FORCE_ICONS) console.log(`  🎨 --force-icons: re-evaluando íconos de todos los activos`);
    if (EMPRESA_FILTER) console.log(`  Filtrando empresa: ${EMPRESA_FILTER}`);
    console.log('='.repeat(60));

    let empresasSnapshot;
    if (EMPRESA_FILTER) {
        const doc = await db.collection('empresas').doc(EMPRESA_FILTER).get();
        if (!doc.exists) {
            console.error(`Empresa "${EMPRESA_FILTER}" no encontrada.`);
            process.exit(1);
        }
        empresasSnapshot = { docs: [doc] };
    } else {
        empresasSnapshot = await db.collection('empresas').get();
    }

    if (empresasSnapshot.docs.length === 0) {
        console.log('No se encontraron empresas.');
        process.exit(0);
    }

    console.log(`\nEmpresas a procesar: ${empresasSnapshot.docs.length}\n`);

    for (const empresaDoc of empresasSnapshot.docs) {
        const empresaId = empresaDoc.id;
        const empresaData = empresaDoc.data();
        const nombre = empresaData.nombreFantasia || empresaData.razonSocial || empresaId;

        console.log(`\n${'─'.repeat(50)}`);
        console.log(`Empresa: ${nombre} (${empresaId})`);
        console.log('─'.repeat(50));

        stats.empresas++;

        await normalizarActivos(empresaId);
        await normalizarEspacios(empresaId);
    }

    // --- Reporte final ---
    console.log('\n' + '='.repeat(60));
    console.log('  REPORTE FINAL');
    console.log('='.repeat(60));
    console.log(`Empresas procesadas:    ${stats.empresas}`);
    console.log('');
    console.log('ACTIVOS (tiposElemento):');
    console.log(`  Total encontrados:    ${stats.activos.total}`);
    console.log(`  Ya completos:         ${stats.activos.yaCompletos}`);
    console.log(`  Actualizados:         ${DRY_RUN ? stats.activos.actualizados + ' (simulado)' : stats.activos.actualizados}`);
    console.log(`  Errores:              ${stats.activos.errores}`);
    console.log('');
    console.log('ESPACIOS (tiposComponente):');
    console.log(`  Total encontrados:    ${stats.espacios.total}`);
    console.log(`  Ya completos:         ${stats.espacios.yaCompletos}`);
    console.log(`  Actualizados:         ${DRY_RUN ? stats.espacios.actualizados + ' (simulado)' : stats.espacios.actualizados}`);
    console.log(`  Errores:              ${stats.espacios.errores}`);
    console.log('');
    if (DRY_RUN) {
        console.log('⚠️  DRY RUN completado. Ejecuta sin --dry-run para aplicar los cambios.');
    } else {
        console.log('✅ Normalización completada.');
    }
    console.log('='.repeat(60));

    process.exit(0);
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
