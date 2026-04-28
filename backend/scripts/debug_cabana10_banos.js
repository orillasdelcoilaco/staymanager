#!/usr/bin/env node
/**
 * backend/scripts/debug_cabana10_banos.js
 *
 * Script para depurar por qué la detección de baños muestra 0
 * pero contarDistribucion calcula 2 baños.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../db/postgres');
const { contarDistribucion } = require('../services/propiedadLogicService');

async function main() {
    console.log('=== DEPURACIÓN DE BAÑOS EN CABAÑA 10 ===\n');

    // ID de empresa y propiedad para Cabaña 10
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
    const propiedadId = 'cabana10';

    try {
        // 1. Obtener datos de la propiedad
        const { rows: propRows } = await pool.query(
            `SELECT nombre, metadata FROM propiedades WHERE id = $1 AND empresa_id = $2`,
            [propiedadId, empresaId]
        );

        if (!propRows[0]) {
            console.log('❌ Propiedad no encontrada');
            return;
        }

        const propiedad = propRows[0];
        const meta = propiedad.metadata || {};
        const componentes = meta.componentes || [];

        console.log(`Propiedad: ${propiedad.nombre}`);
        console.log(`Componentes totales: ${componentes.length}\n`);

        // 2. Mostrar todos los componentes con detalles
        console.log('COMPONENTES DETALLADOS:');
        componentes.forEach((comp, index) => {
            console.log(`\n${index + 1}. ${comp.nombre} (${comp.tipo || 'Sin tipo'})`);
            console.log(`   ID: ${comp.id}`);
            console.log(`   Tipo: ${comp.tipo || 'No definido'}`);

            // Verificar si es baño según diferentes criterios
            const tipoUpper = (comp.tipo || '').toUpperCase();
            const nombreUpper = (comp.nombre || '').toUpperCase();

            const esBanoPorTipo = tipoUpper.includes('BANO') || tipoUpper.includes('TOILET') ||
                                 tipoUpper.includes('WC') || tipoUpper.includes('BATH');
            const esBanoPorNombre = nombreUpper.includes('BANO') || nombreUpper.includes('TOILET');
            const esBanoPorSuite = nombreUpper.includes('SUITE') && tipoUpper.includes('DORMITORIO');

            console.log(`   ¿Es baño por tipo? ${esBanoPorTipo ? '✅ SÍ' : '❌ NO'}`);
            console.log(`   ¿Es baño por nombre? ${esBanoPorNombre ? '✅ SÍ' : '❌ NO'}`);
            console.log(`   ¿Es baño en suite? ${esBanoPorSuite ? '✅ SÍ' : '❌ NO'}`);

            // Mostrar elementos si tiene
            if (comp.elementos && comp.elementos.length > 0) {
                console.log(`   Elementos: ${comp.elementos.length}`);
                comp.elementos.forEach((elem, elemIndex) => {
                    console.log(`     ${elemIndex + 1}. ${elem.nombre} (tipoId: ${elem.tipoId})`);
                });
            }
        });

        // 3. Ejecutar contarDistribucion y ver paso a paso
        console.log('\n\nANÁLISIS DE contarDistribucion:');

        // Simular la lógica de contarDistribucion
        let numPiezas = 0;
        let numBanos = 0;

        componentes.forEach(comp => {
            const tipo = (comp.tipo || '').toUpperCase();
            const nombre = (comp.nombre || '').toUpperCase();

            console.log(`\nAnalizando: ${comp.nombre} (${comp.tipo})`);

            // Lógica para dormitorios
            if (tipo.includes('DORMITORIO') || nombre.includes('DORMITORIO')) {
                numPiezas++;
                console.log(`  → Suma 1 dormitorio (total: ${numPiezas})`);

                // Verificar si es suite
                if (nombre.includes('SUITE') || tipo.includes('SUITE')) {
                    numBanos++;
                    console.log(`  → Suma 1 baño por suite (total baños: ${numBanos})`);
                }
            }

            // Lógica para baños
            if (tipo.includes('BANO') || tipo.includes('TOILET') || tipo.includes('WC') || tipo.includes('BATH') ||
                nombre.includes('BANO') || nombre.includes('TOILET')) {
                numBanos++;
                console.log(`  → Suma 1 baño (total baños: ${numBanos})`);
            }
        });

        // 4. Ejecutar la función real para comparar
        console.log('\n\nRESULTADO DE contarDistribucion REAL:');
        const { numPiezas: piezasReal, numBanos: banosReal } = contarDistribucion(componentes);
        console.log(`   Dormitorios: ${piezasReal}`);
        console.log(`   Baños: ${banosReal}`);

        // 5. Verificar metadata
        console.log('\n\nMETADATA ACTUAL:');
        console.log(`   metadata.numBanos: ${meta.numBanos || 'No definido'}`);
        console.log(`   metadata.numPiezas: ${meta.numPiezas || 'No definido'}`);

        // 6. Conclusión
        console.log('\n\nCONCLUSIÓN:');
        if (banosReal === 2) {
            console.log('✅ La función contarDistribucion detecta correctamente 2 baños');
            console.log('   Esto incluye:');
            console.log('   1. Baño principal (componente explícito)');
            console.log('   2. Baño en suite (del dormitorio principal en suite)');
        } else {
            console.log(`❌ Se esperaban 2 baños pero se detectaron ${banosReal}`);
        }

    } catch (error) {
        console.error('❌ Error durante la depuración:', error.message);
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

module.exports = { debugCabana10Banos: main };