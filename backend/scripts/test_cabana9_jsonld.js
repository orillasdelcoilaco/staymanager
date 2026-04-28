#!/usr/bin/env node
/**
 * backend/scripts/test_cabana9_jsonld.js
 *
 * Script para probar la generación de JSON-LD para Cabaña 9
 * y verificar que los datos de baños sean correctos.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../db/postgres');
const { contarDistribucion } = require('../services/propiedadLogicService');
const buildContextService = require('../services/buildContextService');

async function main() {
    console.log('=== PRUEBA DE JSON-LD PARA CABAÑA 9 ===\n');

    // ID de empresa y propiedad para Cabaña 9
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
    const propiedadId = 'cabana9';

    try {
        // 1. Obtener datos directos de la base de datos
        console.log('1. DATOS DIRECTOS DE LA BASE DE DATOS:');
        const { rows } = await pool.query(
            `SELECT nombre, capacidad, num_piezas, metadata
             FROM propiedades WHERE id = $1 AND empresa_id = $2`,
            [propiedadId, empresaId]
        );

        if (!rows[0]) {
            console.log('❌ Propiedad no encontrada');
            return;
        }

        const propiedad = rows[0];
        const meta = propiedad.metadata || {};
        const componentes = meta.componentes || [];

        console.log(`   Nombre: ${propiedad.nombre}`);
        console.log(`   Capacidad: ${propiedad.capacidad}`);
        console.log(`   num_piezas: ${propiedad.num_piezas}`);
        console.log(`   metadata.numBanos: ${meta.numBanos || 'No definido'}`);
        console.log(`   Componentes: ${componentes.length} elementos\n`);

        // 2. Calcular baños desde componentes
        console.log('2. CÁLCULO DE BAÑOS DESDE COMPONENTES:');
        const { numPiezas, numBanos } = contarDistribucion(componentes);
        console.log(`   Dormitorios calculados: ${numPiezas}`);
        console.log(`   Baños calculados: ${numBanos}`);

        // Mostrar componentes relacionados con baños
        const componentesBanos = componentes.filter(c => {
            const tipo = (c.tipo || '').toUpperCase();
            const nombre = (c.nombre || '').toUpperCase();
            return tipo.includes('BANO') || tipo.includes('TOILET') || tipo.includes('WC') || tipo.includes('BATH') ||
                   nombre.includes('BANO') || nombre.includes('TOILET');
        });

        console.log(`   Componentes detectados como baños: ${componentesBanos.length}`);
        componentesBanos.forEach((c, i) => {
            console.log(`     ${i + 1}. ${c.nombre} (tipo: ${c.tipo || 'N/A'})`);
        });

        // Verificar dormitorios con suite
        const dormitoriosSuite = componentes.filter(c => {
            const nombre = (c.nombre || '').toUpperCase();
            const tipo = (c.tipo || '').toUpperCase();
            return (nombre.includes('DORMITORIO') || nombre.includes('HABITACION') || tipo.includes('DORMITORIO')) &&
                   (nombre.includes('SUITE') || tipo.includes('SUITE'));
        });

        console.log(`   Dormitorios con suite: ${dormitoriosSuite.length}`);
        dormitoriosSuite.forEach((c, i) => {
            console.log(`     ${i + 1}. ${c.nombre} (agrega 1 baño)`);
        });

        // 3. Obtener buildContext
        console.log('\n3. BUILDCONTEXT GENERADO:');
        const buildContext = await buildContextService.getBuildContext(null, empresaId, propiedadId);

        if (buildContext && buildContext.producto) {
            const producto = buildContext.producto;
            console.log(`   producto.numBanos: ${producto.numBanos}`);
            console.log(`   producto.numPiezas: ${producto.numPiezas}`);
            console.log(`   producto.capacidad: ${producto.capacidad}`);

            // Verificar consistencia
            const consistenteBanos = producto.numBanos === numBanos;
            const consistentePiezas = producto.numPiezas === numPiezas;

            console.log(`\n   CONSISTENCIA:`);
            console.log(`   Baños: ${consistenteBanos ? '✅' : '❌'} (buildContext: ${producto.numBanos}, cálculo: ${numBanos})`);
            console.log(`   Dormitorios: ${consistentePiezas ? '✅' : '❌'} (buildContext: ${producto.numPiezas}, cálculo: ${numPiezas})`);
        } else {
            console.log('❌ No se pudo obtener buildContext');
        }

        // 4. Verificar JSON-LD actual si existe
        console.log('\n4. JSON-LD ACTUAL (si existe):');
        const jsonldQuery = await pool.query(
            `SELECT jsonld FROM website_data
             WHERE propiedad_id = $1 AND empresa_id = $2`,
            [propiedadId, empresaId]
        );

        if (jsonldQuery.rows[0] && jsonldQuery.rows[0].jsonld) {
            const jsonld = jsonldQuery.rows[0].jsonld;
            console.log(`   JSON-LD encontrado: ${Object.keys(jsonld).length > 0 ? 'SÍ' : 'NO'}`);

            if (jsonld.numberOfBathroomsTotal !== undefined) {
                console.log(`   numberOfBathroomsTotal: ${jsonld.numberOfBathroomsTotal}`);
                console.log(`   ¿Coincide con cálculo? ${jsonld.numberOfBathroomsTotal === numBanos ? '✅' : '❌'}`);
            } else {
                console.log('   ❌ numberOfBathroomsTotal no definido en JSON-LD');
            }

            if (jsonld.containsPlace && Array.isArray(jsonld.containsPlace)) {
                const bañosEnJsonld = jsonld.containsPlace.filter(p =>
                    p['@type'] === 'Bathroom' ||
                    (p.name && p.name.toLowerCase().includes('baño')) ||
                    (p.name && p.name.toLowerCase().includes('bath'))
                );
                console.log(`   Baños en containsPlace: ${bañosEnJsonld.length}`);
            }
        } else {
            console.log('   No hay JSON-LD generado aún');
        }

        // 5. Resumen
        console.log('\n5. RESUMEN FINAL:');
        console.log('='.repeat(50));
        console.log(`CABAÑA 9 - VERIFICACIÓN DE BAÑOS`);
        console.log('='.repeat(50));
        console.log(`✅ Baños en metadata: ${meta.numBanos || 'No definido'}`);
        console.log(`✅ Baños calculados: ${numBanos}`);
        console.log(`✅ Baños en buildContext: ${buildContext?.producto?.numBanos || 'No disponible'}`);
        console.log(`✅ Baños en JSON-LD: ${jsonldQuery.rows[0]?.jsonld?.numberOfBathroomsTotal || 'No generado'}`);

        if (numBanos === 2) {
            console.log('\n🎉 ¡CABAÑA 9 TIENE 2 BAÑOS CORRECTAMENTE DEFINIDOS!');
            console.log('   - Baño principal');
            console.log('   - Baño en suite del dormitorio principal');
        } else {
            console.log(`\n⚠️  ADVERTENCIA: Se esperaban 2 baños pero se encontraron ${numBanos}`);
        }

    } catch (error) {
        console.error('❌ Error durante la prueba:', error.message);
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

module.exports = { testCabana9JsonLd: main };