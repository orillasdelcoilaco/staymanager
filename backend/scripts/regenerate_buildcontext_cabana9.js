#!/usr/bin/env node
/**
 * backend/scripts/regenerate_buildcontext_cabana9.js
 *
 * Script para regenerar el buildContext de Cabaña 9
 * y verificar que los datos de baños sean correctos.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../db/postgres');
const buildContextService = require('../services/buildContextService');

async function main() {
    console.log('=== REGENERACIÓN DE BUILDCONTEXT PARA CABAÑA 9 ===\n');

    // ID de empresa y propiedad para Cabaña 9
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
    const propiedadId = 'cabana9';

    try {
        // 1. Obtener buildContext actual
        console.log('1. BUILDCONTEXT ACTUAL:');
        const buildContextActual = await buildContextService.getBuildContext(null, empresaId, propiedadId);

        if (buildContextActual && buildContextActual.producto) {
            console.log(`   producto.numBanos: ${buildContextActual.producto.numBanos}`);
            console.log(`   producto.numPiezas: ${buildContextActual.producto.numPiezas}`);
        } else {
            console.log('   No hay buildContext actual');
        }

        // 2. Forzar regeneración del producto desde componentes
        console.log('\n2. REGENERANDO PRODUCTO DESDE COMPONENTES...');
        const productoRegenerado = await buildContextService.construirProductoDesdeComponentes(null, empresaId, propiedadId);

        if (productoRegenerado) {
            console.log(`   producto.numBanos regenerado: ${productoRegenerado.numBanos}`);
            console.log(`   producto.numPiezas regenerado: ${productoRegenerado.numPiezas}`);

            // 3. Verificar si hay diferencia
            if (buildContextActual && buildContextActual.producto) {
                const banosCambiaron = buildContextActual.producto.numBanos !== productoRegenerado.numBanos;
                const piezasCambiaron = buildContextActual.producto.numPiezas !== productoRegenerado.numPiezas;

                console.log('\n3. COMPARACIÓN:');
                console.log(`   Baños cambiaron: ${banosCambiaron ? '✅ SÍ' : '❌ NO'}`);
                console.log(`     Antes: ${buildContextActual.producto.numBanos}, Después: ${productoRegenerado.numBanos}`);
                console.log(`   Dormitorios cambiaron: ${piezasCambiaron ? '✅ SÍ' : '❌ NO'}`);
                console.log(`     Antes: ${buildContextActual.producto.numPiezas}, Después: ${productoRegenerado.numPiezas}`);

                if (banosCambiaron) {
                    console.log('\n🎉 ¡CORRECCIÓN APLICADA!');
                    console.log(`   El buildContext ahora tiene ${productoRegenerado.numBanos} baños (antes tenía ${buildContextActual.producto.numBanos})`);
                }
            }

            // 4. Obtener buildContext actualizado
            console.log('\n4. BUILDCONTEXT ACTUALIZADO:');
            const buildContextActualizado = await buildContextService.getBuildContext(null, empresaId, propiedadId);

            if (buildContextActualizado && buildContextActualizado.producto) {
                console.log(`   producto.numBanos: ${buildContextActualizado.producto.numBanos}`);
                console.log(`   producto.numPiezas: ${buildContextActualizado.producto.numPiezas}`);

                // 5. Verificar datos en la base de datos
                console.log('\n5. VERIFICACIÓN EN BASE DE DATOS:');
                const { rows } = await pool.query(
                    `SELECT metadata FROM propiedades WHERE id = $1 AND empresa_id = $2`,
                    [propiedadId, empresaId]
                );

                const meta = rows[0].metadata || {};
                console.log(`   metadata.numBanos: ${meta.numBanos || 'No definido'}`);

                // Verificar consistencia
                const consistente = buildContextActualizado.producto.numBanos === meta.numBanos;
                console.log(`   ¿Consistente con metadata? ${consistente ? '✅ SÍ' : '❌ NO'}`);

                if (!consistente) {
                    console.log('\n⚠️  ADVERTENCIA: Inconsistencia detectada');
                    console.log(`   buildContext: ${buildContextActualizado.producto.numBanos} baños`);
                    console.log(`   metadata: ${meta.numBanos} baños`);
                }
            }
        } else {
            console.log('❌ No se pudo regenerar el producto');
        }

    } catch (error) {
        console.error('❌ Error durante la regeneración:', error.message);
        console.error(error.stack);
    }
}

// Ejecutar si es el script principal
if (require.main === module) {
    main().catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
}

module.exports = { regenerateBuildContextCabana9: main };