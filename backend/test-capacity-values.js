#!/usr/bin/env node
/**
 * Test para verificar valores reales de capacity en activos de comedor
 */

require('dotenv').config({ path: '.env' });

console.log('🔍 TEST: VALORES REALES DE CAPACITY EN ACTIVOS');
console.log('='.repeat(60));

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no definida');
    process.exit(1);
}

const pool = require('./db/postgres');

if (!pool) {
    console.error('❌ PostgreSQL no configurado');
    process.exit(1);
}

console.log('✅ Conectado a PostgreSQL');

async function analizarValoresCapacity() {
    console.log('\n📊 Analizando valores de capacity en la base de datos...');

    try {
        // 1. Obtener todas las propiedades
        const { rows } = await pool.query(
            "SELECT id, nombre, capacidad, metadata FROM propiedades ORDER BY nombre"
        );

        console.log(`📈 Total propiedades: ${rows.length}`);

        for (const propiedad of rows) {
            const componentes = propiedad.metadata?.componentes || [];

            if (componentes.length === 0) continue;

            console.log(`\n🏠 ${propiedad.nombre} (ID: ${propiedad.id})`);
            console.log(`   Capacidad BD: ${propiedad.capacidad}`);

            // Buscar componente "Comedor"
            const comedores = componentes.filter(c =>
                c.nombre && c.nombre.toLowerCase().includes('comedor')
            );

            if (comedores.length > 0) {
                console.log(`   🔍 Componentes de comedor encontrados: ${comedores.length}`);

                comedores.forEach((comedor, idx) => {
                    console.log(`\n   📦 Comedor ${idx + 1}: ${comedor.nombre}`);
                    console.log(`      Elementos: ${comedor.elementos?.length || 0}`);

                    if (Array.isArray(comedor.elementos)) {
                        comedor.elementos.forEach(el => {
                            const capacityValue = el.capacity;
                            const tipo =
                                capacityValue === undefined ? 'undefined' :
                                capacityValue === null ? 'null' :
                                typeof capacityValue === 'number' ? `number (${capacityValue})` :
                                typeof capacityValue;

                            console.log(`      - ${el.nombre}: cantidad=${el.cantidad || 1}, capacity=${capacityValue} [${tipo}]`);
                        });
                    }
                });
            }

            // También buscar elementos problemáticos en toda la propiedad
            let elementosUndefinedNull = [];
            let elementosConCero = [];

            componentes.forEach(comp => {
                if (Array.isArray(comp.elementos)) {
                    comp.elementos.forEach(el => {
                        if (el.capacity === undefined || el.capacity === null) {
                            elementosUndefinedNull.push({
                                componente: comp.nombre,
                                elemento: el.nombre,
                                cantidad: el.cantidad,
                                capacity: el.capacity
                            });
                        } else if (el.capacity === 0) {
                            elementosConCero.push({
                                componente: comp.nombre,
                                elemento: el.nombre,
                                cantidad: el.cantidad,
                                capacity: el.capacity
                            });
                        }
                    });
                }
            });

            if (elementosUndefinedNull.length > 0) {
                console.log(`\n   ⚠️  Elementos con capacity undefined/null: ${elementosUndefinedNull.length}`);
                elementosUndefinedNull.slice(0, 3).forEach(el => {
                    console.log(`      - ${el.componente} > ${el.elemento}: capacity=${el.capacity}`);
                });
                if (elementosUndefinedNull.length > 3) {
                    console.log(`      ... y ${elementosUndefinedNull.length - 3} más`);
                }
            }

            if (elementosConCero.length > 0) {
                console.log(`\n   ✅ Elementos con capacity=0: ${elementosConCero.length}`);
            }
        }

        // 2. Análisis específico de Cabaña 7
        console.log('\n' + '='.repeat(60));
        console.log('🔍 ANÁLISIS ESPECÍFICO: CABAÑA 7');
        console.log('='.repeat(60));

        const { rows: cabana7Rows } = await pool.query(
            "SELECT metadata->'componentes' as componentes FROM propiedades WHERE id = 'cabana-7'"
        );

        if (cabana7Rows.length > 0) {
            const componentes = cabana7Rows[0].componentes || [];

            // Función de cálculo para verificar
            const { calcularCapacidad } = require('./services/propiedadLogicService');
            const capacidadCalculada = calcularCapacidad(componentes);

            console.log(`🧮 Capacidad calculada: ${capacidadCalculada}`);

            // Analizar cada elemento
            console.log('\n📋 ANÁLISIS DETALLADO POR ELEMENTO:');

            let capacidadSumada = 0;
            componentes.forEach(comp => {
                if (Array.isArray(comp.elementos)) {
                    comp.elementos.forEach(el => {
                        const quantity = Number(el.cantidad || 1);
                        const capacity = el.capacity;

                        let sumaEsteElemento = 0;
                        let razon = '';

                        if (typeof capacity !== 'undefined' && capacity !== null) {
                            const numericCapacity = Number(capacity);
                            if (!isNaN(numericCapacity)) {
                                sumaEsteElemento = quantity * numericCapacity;
                                razon = `capacity=${capacity} → ${quantity} × ${capacity} = ${sumaEsteElemento}`;
                            }
                        } else {
                            // Fallback
                            const n = (el.nombre || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                            const esDoble = n.includes('KING') || n.includes('QUEEN') || n.includes('MATRIMONIAL') || n.includes('DOBLE') || n.includes('2 PLAZAS') || n.includes('DOS PLAZAS');
                            const esLitera = n.includes('LITERA') || n.includes('CAMAROTE');
                            const esCama = n.includes('CAMA') || n.includes('BED');
                            const esSimple = n.includes('1 PLAZA') || n.includes('INDIVIDUAL') || n.includes('SINGLE') || n.includes('NIDO') || n.includes('CATRE');
                            const esSofa = n.includes('SOFA CAMA') || n.includes('FUTON') || n.includes('SOFABED');

                            if (esLitera || esDoble) {
                                sumaEsteElemento = 2 * quantity;
                                razon = `fallback (esDoble/esLitera) → ${quantity} × 2 = ${sumaEsteElemento}`;
                            }
                            else if (esSimple || esSofa) {
                                sumaEsteElemento = 1 * quantity;
                                razon = `fallback (esSimple/esSofa) → ${quantity} × 1 = ${sumaEsteElemento}`;
                            }
                            else if (esCama) {
                                sumaEsteElemento = 1 * quantity;
                                razon = `fallback (esCama) → ${quantity} × 1 = ${sumaEsteElemento}`;
                            } else {
                                razon = `fallback NO aplica (capacity=${capacity})`;
                            }
                        }

                        if (sumaEsteElemento > 0) {
                            console.log(`   ➕ ${comp.nombre} > ${el.nombre}: ${razon}`);
                            capacidadSumada += sumaEsteElemento;
                        }
                    });
                }
            });

            console.log(`\n📊 Total capacidad sumada: ${capacidadSumada}`);
        }

    } catch (error) {
        console.error('❌ Error durante el análisis:', error.message);
    }
}

// Ejecutar
analizarValoresCapacity().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Análisis completado');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});