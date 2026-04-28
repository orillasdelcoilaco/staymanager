#!/usr/bin/env node
/**
 * Test específico para elementos de comedor que suman capacidad incorrectamente
 */

console.log('🔍 TEST: ELEMENTOS DE COMEDOR SUMANDO CAPACIDAD');
console.log('='.repeat(60));

// Copiar la función calcularCapacidad para analizarla
function testCalcularCapacidad(componentes) {
    if (!Array.isArray(componentes)) return 0;

    let capacidadTotal = 0;

    componentes.forEach(comp => {
        if (Array.isArray(comp.elementos)) {
            comp.elementos.forEach(el => {
                const quantity = Number(el.cantidad || 1);

                // Verificar si capacity está definido (incluso si es 0)
                if (typeof el.capacity !== 'undefined' && el.capacity !== null) {
                    const numericCapacity = Number(el.capacity);
                    if (!isNaN(numericCapacity)) {
                        capacidadTotal += (quantity * numericCapacity);
                    }
                    // NO aplicamos fallback si capacity está definido (incluso si es 0)
                } else {
                    // Fallback: detectar camas por nombre cuando capacity NO está configurado
                    const n = (el.nombre || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                    console.log(`   🔍 Analizando: "${el.nombre}" → Normalizado: "${n}"`);

                    const esDoble = n.includes('KING') || n.includes('QUEEN') || n.includes('MATRIMONIAL') || n.includes('DOBLE') || n.includes('2 PLAZAS') || n.includes('DOS PLAZAS');
                    const esLitera = n.includes('LITERA') || n.includes('CAMAROTE');
                    const esCama = n.includes('CAMA') || n.includes('BED');
                    const esSimple = n.includes('1 PLAZA') || n.includes('INDIVIDUAL') || n.includes('SINGLE') || n.includes('NIDO') || n.includes('CATRE');
                    const esSofa = n.includes('SOFA CAMA') || n.includes('FUTON') || n.includes('SOFABED');

                    console.log(`     esDoble: ${esDoble}, esLitera: ${esLitera}, esCama: ${esCama}, esSimple: ${esSimple}, esSofa: ${esSofa}`);

                    if (esLitera || esDoble) {
                        capacidadTotal += 2 * quantity;
                        console.log(`     ➕ Sumando 2 × ${quantity} = ${2 * quantity} (esDoble o esLitera)`);
                    }
                    else if (esSimple || esSofa) {
                        capacidadTotal += 1 * quantity;
                        console.log(`     ➕ Sumando 1 × ${quantity} = ${1 * quantity} (esSimple o esSofa)`);
                    }
                    else if (esCama) {
                        capacidadTotal += 1 * quantity;
                        console.log(`     ➕ Sumando 1 × ${quantity} = ${1 * quantity} (esCama)`);
                    }
                }
            });
        }
    });

    return capacidadTotal;
}

// Test 1: Elementos de comedor problemáticos
console.log('\n🧪 TEST 1: Elementos de comedor comunes');
console.log('-'.repeat(40));

const elementosComedor = [
    { nombre: 'Individual', cantidad: 6, capacity: undefined },
    { nombre: 'Individuales', cantidad: 6, capacity: undefined },
    { nombre: 'Silla', cantidad: 6, capacity: undefined },
    { nombre: 'Silla de Comedor', cantidad: 6, capacity: undefined },
    { nombre: 'Comedor', cantidad: 1, capacity: undefined },
    { nombre: 'Mesa de Comedor', cantidad: 1, capacity: undefined },
    { nombre: 'Mesa', cantidad: 1, capacity: undefined },
    { nombre: 'Sillón', cantidad: 1, capacity: undefined },
    { nombre: 'Sofá', cantidad: 1, capacity: undefined },
    { nombre: 'Banqueta', cantidad: 4, capacity: undefined }
];

const componentesTest = [
    {
        nombre: 'Comedor',
        elementos: elementosComedor
    }
];

console.log('📋 Elementos a testear:');
elementosComedor.forEach(el => {
    console.log(`   - ${el.nombre} (cantidad: ${el.cantidad}, capacity: ${el.capacity})`);
});

const capacidadCalculada = testCalcularCapacidad(componentesTest);
console.log(`\n🧮 Capacidad total calculada: ${capacidadCalculada}`);

// Test 2: Ver qué palabras están causando problemas
console.log('\n🔍 TEST 2: Análisis de palabras clave');
console.log('-'.repeat(40));

const palabrasTest = [
    'INDIVIDUAL', 'INDIVIDUALES', 'SILLA', 'SILLÓN', 'SOFÁ', 'MESA', 'COMEDOR',
    'SILLA DE COMEDOR', 'MESA DE COMEDOR', 'BANQUETA', 'TABURETE'
];

console.log('📋 Análisis de normalización:');
palabrasTest.forEach(palabra => {
    const n = palabra.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const esDoble = n.includes('KING') || n.includes('QUEEN') || n.includes('MATRIMONIAL') || n.includes('DOBLE') || n.includes('2 PLAZAS') || n.includes('DOS PLAZAS');
    const esLitera = n.includes('LITERA') || n.includes('CAMAROTE');
    const esCama = n.includes('CAMA') || n.includes('BED');
    const esSimple = n.includes('1 PLAZA') || n.includes('INDIVIDUAL') || n.includes('SINGLE') || n.includes('NIDO') || n.includes('CATRE');
    const esSofa = n.includes('SOFA CAMA') || n.includes('FUTON') || n.includes('SOFABED');

    console.log(`   "${palabra}" → "${n}"`);
    console.log(`     esSimple: ${esSimple} (contiene "INDIVIDUAL": ${n.includes('INDIVIDUAL')})`);
    console.log(`     esCama: ${esCama} (contiene "CAMA": ${n.includes('CAMA')})`);
    console.log(`     esSofa: ${esSofa} (contiene "SOFA": ${n.includes('SOFA')})`);
    console.log('');
});

// Test 3: Solución propuesta
console.log('\n💡 TEST 3: Identificación del problema');
console.log('-'.repeat(40));

console.log('🔴 PROBLEMA IDENTIFICADO:');
console.log('   1. "Individual" contiene "INDIVIDUAL" → esSimple = TRUE');
console.log('   2. "Silla" NO contiene "CAMA", pero hay que verificar normalización');
console.log('   3. "Sofá" normalizado es "SOFA" → podría activar esSofa si no se especifica "SOFA CAMA"');

console.log('\n🎯 CAUSA DEL PROBLEMA:');
console.log('   La función tiene un fallback que suma capacidad cuando:');
console.log('   - capacity es undefined/null');
console.log('   - Y el nombre contiene palabras clave de camas');

console.log('\n💡 SOLUCIÓN POSIBLE:');
console.log('   1. Mejorar la detección de palabras clave');
console.log('   2. Agregar excepciones para muebles de comedor');
console.log('   3. O requerir que TODOS los elementos tengan capacity definido');

// Test 4: Verificar con datos reales de Cabaña 7
console.log('\n📊 TEST 4: Verificar Cabaña 7 actual');
console.log('-'.repeat(40));

require('dotenv').config({ path: '.env' });
const pool = require('./db/postgres');

async function verificarCabana7Comedor() {
    if (!pool) return;

    try {
        const { rows } = await pool.query(
            "SELECT metadata->'componentes' as componentes FROM propiedades WHERE id = 'cabana-7'"
        );

        if (rows.length > 0) {
            const componentes = rows[0].componentes || [];

            // Buscar componente "Comedor"
            const comedor = componentes.find(c =>
                c.nombre && c.nombre.toLowerCase().includes('comedor')
            );

            if (comedor && Array.isArray(comedor.elementos)) {
                console.log('📋 Elementos en Comedor de Cabaña 7:');
                comedor.elementos.forEach(el => {
                    console.log(`   - ${el.nombre}: cantidad=${el.cantidad}, capacity=${el.capacity}`);
                });

                // Calcular solo el comedor
                const capacidadComedor = testCalcularCapacidad([comedor]);
                console.log(`\n🧮 Capacidad sumada por el comedor: ${capacidadComedor}`);

                if (capacidadComedor > 0) {
                    console.log(`🔴 ¡PROBLEMA CONFIRMADO! El comedor suma ${capacidadComedor} personas`);
                }
            }
        }
    } catch (error) {
        console.log('❌ Error al verificar Cabaña 7:', error.message);
    }
}

verificarCabana7Comedor().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completado');
    process.exit(0);
});