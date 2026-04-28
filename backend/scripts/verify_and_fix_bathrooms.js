#!/usr/bin/env node
/**
 * backend/scripts/verify_and_fix_bathrooms.js
 *
 * Script para verificar y corregir inconsistencias en el número de baños
 * entre metadata.numBanos y cálculo real desde componentes.
 *
 * Uso:
 *   node verify_and_fix_bathrooms.js --empresa=all              # Todas las empresas
 *   node verify_and_fix_bathrooms.js --empresa=cv1Lb4HLBLvWvSyqYfRW  # Empresa específica
 *   node verify_and_fix_bathrooms.js --propiedad=cabana9        # Propiedad específica
 *   node verify_and_fix_bathrooms.js --dry-run                  # Solo verificar, no corregir
 *   node verify_and_fix_bathrooms.js --fix                      # Corregir inconsistencias
 */

// Cargar variables de entorno
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../db/postgres');
const { contarDistribucion } = require('../services/propiedadLogicService');

// Verificar modo de base de datos
if (!pool) {
    console.log('[PostgreSQL] DATABASE_URL no definida — modo Firestore activo.');
    console.log('Este script solo funciona en modo PostgreSQL.');
    process.exit(1);
}

// Configuración
const BATCH_SIZE = 10;
const TIMEOUT_PER_PROPERTY = 30000; // 30 segundos por propiedad

async function main() {
    const args = process.argv.slice(2);
    const options = parseArgs(args);

    console.log('=== VERIFICACIÓN Y CORRECCIÓN DE BAÑOS ===');
    console.log(`Modo: ${options.dryRun ? 'DRY RUN (solo verificación)' : 'CORRECCIÓN'}`);
    console.log(`Empresa: ${options.empresaId === 'all' ? 'Todas' : options.empresaId}`);
    console.log(`Propiedad: ${options.propiedadId || 'Todas'}`);
    console.log('='.repeat(50));

    try {
        const results = await processProperties(options);
        printReport(results, options);

        if (!options.dryRun && results.corrected > 0) {
            console.log(`\n✅ Se corrigieron ${results.corrected} propiedades exitosamente.`);
        }

    } catch (error) {
        console.error('❌ Error durante la ejecución:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

function parseArgs(args) {
    const options = {
        empresaId: 'all',
        propiedadId: null,
        dryRun: false,
        fix: false
    };

    for (const arg of args) {
        if (arg.startsWith('--empresa=')) {
            options.empresaId = arg.split('=')[1];
        } else if (arg.startsWith('--propiedad=')) {
            options.propiedadId = arg.split('=')[1];
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg === '--fix') {
            options.fix = true;
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    // Si se especifica --fix, no es dry-run
    if (options.fix) {
        options.dryRun = false;
    }

    return options;
}

function printHelp() {
    console.log(`
Verificación y corrección de inconsistencias en número de baños

Uso:
  node verify_and_fix_bathrooms.js [opciones]

Opciones:
  --empresa=<id>        ID de empresa o "all" para todas (default: all)
  --propiedad=<id>      ID de propiedad específica
  --dry-run             Solo verificar, no corregir (default)
  --fix                 Corregir inconsistencias
  --help, -h            Mostrar esta ayuda

Ejemplos:
  # Verificar todas las propiedades de todas las empresas
  node verify_and_fix_bathrooms.js --dry-run

  # Verificar solo Cabaña 9
  node verify_and_fix_bathrooms.js --propiedad=cabana9 --dry-run

  # Corregir todas las propiedades de una empresa específica
  node verify_and_fix_bathrooms.js --empresa=cv1Lb4HLBLvWvSyqYfRW --fix

  # Corregir solo Cabaña 9
  node verify_and_fix_bathrooms.js --propiedad=cabana9 --fix
`);
}

async function processProperties(options) {
    const properties = await getProperties(options);
    const results = {
        total: properties.length,
        consistent: 0,
        inconsistent: 0,
        corrected: 0,
        errors: 0,
        details: []
    };

    console.log(`Procesando ${properties.length} propiedades...`);

    for (let i = 0; i < properties.length; i += BATCH_SIZE) {
        const batch = properties.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(prop =>
            processProperty(prop, options).catch(error => ({
                property: prop,
                error: error.message
            }))
        );

        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
            if (result.error) {
                results.errors++;
                results.details.push({
                    propiedad: result.property.nombre,
                    empresa: result.property.empresa_id,
                    error: result.error,
                    status: 'ERROR'
                });
                console.error(`❌ Error en ${result.property.nombre}: ${result.error}`);
            } else {
                if (result.consistent) {
                    results.consistent++;
                } else {
                    results.inconsistent++;
                    if (result.corrected) {
                        results.corrected++;
                    }
                }
                results.details.push(result);

                // Mostrar progreso
                const status = result.consistent ? '✅' : (result.corrected ? '🔄' : '⚠️');
                console.log(`${status} ${result.property.nombre}: ${result.message}`);
            }
        }

        // Pequeña pausa entre lotes para no sobrecargar la DB
        if (i + BATCH_SIZE < properties.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
}

async function getProperties(options) {
    let query = `
        SELECT p.id, p.empresa_id, p.nombre, p.metadata, p.capacidad, p.num_piezas
        FROM propiedades p
        WHERE p.activo = true
    `;

    const params = [];

    if (options.empresaId !== 'all') {
        query += ` AND p.empresa_id = $${params.length + 1}`;
        params.push(options.empresaId);
    }

    if (options.propiedadId) {
        query += ` AND p.id = $${params.length + 1}`;
        params.push(options.propiedadId);
    }

    query += ` ORDER BY p.empresa_id, p.nombre`;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function processProperty(property, options) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout excedido')), TIMEOUT_PER_PROPERTY);
    });

    const processPromise = (async () => {
        const meta = property.metadata || {};
        const componentes = meta.componentes || [];

        // Calcular baños reales desde componentes
        const { numBanos: calculatedBanos } = contarDistribucion(componentes);
        const currentBanos = meta.numBanos || 0;

        const result = {
            property: {
                id: property.id,
                nombre: property.nombre,
                empresa_id: property.empresa_id
            },
            currentBanos,
            calculatedBanos,
            consistent: currentBanos === calculatedBanos,
            corrected: false,
            message: ''
        };

        if (result.consistent) {
            result.message = `Consistente: ${currentBanos} baños`;
            return result;
        }

        // Inconsistencia detectada
        result.message = `INCONSISTENTE: definido=${currentBanos}, calculado=${calculatedBanos}`;

        if (!options.dryRun && calculatedBanos !== undefined) {
            // Corregir la inconsistencia
            const updatedMeta = {
                ...meta,
                numBanos: calculatedBanos
            };

            await pool.query(
                `UPDATE propiedades
                 SET metadata = $1::jsonb, updated_at = NOW()
                 WHERE id = $2 AND empresa_id = $3`,
                [JSON.stringify(updatedMeta), property.id, property.empresa_id]
            );

            result.corrected = true;
            result.message += ` → CORREGIDO a ${calculatedBanos} baños`;
        }

        return result;
    })();

    return Promise.race([processPromise, timeoutPromise]);
}

function printReport(results, options) {
    console.log('\n' + '='.repeat(50));
    console.log('REPORTE FINAL');
    console.log('='.repeat(50));

    console.log(`Total propiedades: ${results.total}`);
    console.log(`✅ Consistentes: ${results.consistent}`);
    console.log(`⚠️  Inconsistentes: ${results.inconsistent}`);

    if (!options.dryRun) {
        console.log(`🔄 Corregidas: ${results.corrected}`);
    }

    console.log(`❌ Errores: ${results.errors}`);

    // Mostrar detalles de propiedades inconsistentes
    const inconsistentProps = results.details.filter(d => !d.consistent && !d.error);
    if (inconsistentProps.length > 0) {
        console.log('\n📋 DETALLES DE INCONSISTENCIAS:');
        inconsistentProps.forEach(prop => {
            const status = prop.corrected ? '[CORREGIDO]' : '[PENDIENTE]';
            console.log(`  ${status} ${prop.property.nombre}: ${prop.message}`);
        });
    }

    // Mostrar errores
    const errorProps = results.details.filter(d => d.error);
    if (errorProps.length > 0) {
        console.log('\n❌ ERRORES:');
        errorProps.forEach(prop => {
            console.log(`  ${prop.property.nombre}: ${prop.error}`);
        });
    }

    // Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    if (results.inconsistent > 0 && options.dryRun) {
        console.log('  Ejecuta con --fix para corregir las inconsistencias automáticamente');
    }

    if (results.inconsistent === 0) {
        console.log('  ✅ Todas las propiedades tienen datos consistentes de baños');
    }

    // Nota sobre regeneración de buildContext
    if (results.corrected > 0) {
        console.log('\n🔧 NOTA: Después de corregir metadata.numBanos, es recomendable:');
        console.log('  1. Regenerar buildContext para las propiedades corregidas');
        console.log('  2. Regenerar JSON-LD si es necesario');
        console.log('  3. Ejecutar auditorías de validación');
    }
}

// Ejecutar si es el script principal
if (require.main === module) {
    main().catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
}

module.exports = {
    verifyAndFixBathrooms: main
};