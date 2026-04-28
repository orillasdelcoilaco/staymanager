#!/usr/bin/env node
/**
 * Diagnóstico detallado de Cabaña 7
 * Para entender por qué calcula 12 en lugar de 6
 */

console.log('🔍 DIAGNÓSTICO DETALLADO CABAÑA 7');
console.log('=' .repeat(60));

const admin = require('firebase-admin');
const path = require('path');
const { calcularCapacidad } = require('./services/propiedadLogicService');

// Inicializar Firebase Admin
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin inicializado');
} catch (error) {
    console.error('❌ Error inicializando Firebase:', error.message);
    process.exit(1);
}

const db = admin.firestore();

async function diagnosticarCabana7Detallado() {
    console.log('\n🔍 BUSCANDO TODAS LAS INSTANCIAS DE CABAÑA 7');
    console.log('=' .repeat(40));

    try {
        // Buscar por nombre
        const propiedadesSnapshot = await db.collectionGroup('propiedades')
            .where('nombre', '==', 'Cabaña 7')
            .get();

        if (propiedadesSnapshot.empty) {
            console.log('❌ No se encontró Cabaña 7');
            return;
        }

        console.log(`✅ Encontradas ${propiedadesSnapshot.size} instancias de Cabaña 7`);

        let instanciaNum = 1;
        for (const propiedadDoc of propiedadesSnapshot.docs) {
            const propiedadData = propiedadDoc.data();
            const empresaId = propiedadDoc.ref.parent.parent.id;
            const propiedadId = propiedadDoc.id;

            console.log(`\n📋 INSTANCIA ${instanciaNum++} - CABAÑA 7:`);
            console.log(`   ID: ${propiedadId}`);
            console.log(`   Empresa: ${empresaId}`);
            console.log(`   Capacidad en BD: ${propiedadData.capacidad || 'No definida'}`);
            console.log(`   Calculated_capacity: ${propiedadData.calculated_capacity || 'No calculada'}`);

            if (propiedadData.componentes && Array.isArray(propiedadData.componentes)) {
                const capacidadCalculada = calcularCapacidad(propiedadData.componentes);
                console.log(`   Capacidad calculada: ${capacidadCalculada}`);

                console.log(`\n   📦 COMPONENTES (${propiedadData.componentes.length}):`);
                console.log('   ' + '-'.repeat(40));

                let totalElementos = 0;
                let elementosConCapacityCero = 0;
                let elementosSinCapacity = 0;
                let elementosConCapacityPositivo = 0;

                propiedadData.componentes.forEach((comp, compIdx) => {
                    console.log(`   ${compIdx + 1}. ${comp.nombre || 'Sin nombre'} (${comp.elementos?.length || 0} elementos):`);

                    if (comp.elementos && Array.isArray(comp.elementos)) {
                        comp.elementos.forEach((elem, elemIdx) => {
                            totalElementos++;
                            const capacity = elem.capacity;
                            const cantidad = elem.cantidad || 1;

                            let status = '';
                            if (capacity === 0) {
                                status = '🔴 capacity=0';
                                elementosConCapacityCero++;
                            } else if (capacity === undefined || capacity === null) {
                                status = '🟡 SIN capacity';
                                elementosSinCapacity++;
                            } else if (capacity > 0) {
                                status = `🟢 capacity=${capacity}`;
                                elementosConCapacityPositivo++;
                            } else {
                                status = `⚫ capacity=${capacity}`;
                            }

                            console.log(`      ${elemIdx + 1}. ${elem.nombre || 'Sin nombre'} x${cantidad} → ${status}`);

                            // Mostrar detalles adicionales
                            if (elem.tipoId) console.log(`         tipoId: ${elem.tipoId}`);
                            if (elem.categoria) console.log(`         categoria: ${elem.categoria}`);
                        });
                    }
                });

                console.log(`\n   📊 ESTADÍSTICAS DE ELEMENTOS:`);
                console.log(`      Total elementos: ${totalElementos}`);
                console.log(`      Con capacity>0: ${elementosConCapacityPositivo}`);
                console.log(`      Con capacity=0: ${elementosConCapacityCero}`);
                console.log(`      Sin capacity: ${elementosSinCapacity}`);

                // Analizar posibles duplicados
                console.log(`\n   🔍 BUSCANDO DUPLICADOS:`);
                const todosElementos = [];
                propiedadData.componentes.forEach(comp => {
                    if (comp.elementos) {
                        comp.elementos.forEach(elem => {
                            todosElementos.push({
                                nombre: elem.nombre,
                                tipoId: elem.tipoId,
                                cantidad: elem.cantidad || 1,
                                capacity: elem.capacity
                            });
                        });
                    }
                });

                // Buscar duplicados
                const elementosMap = new Map();
                const duplicados = [];

                todosElementos.forEach(elem => {
                    const clave = `${elem.nombre}_${elem.tipoId}_${elem.cantidad}`;
                    if (elementosMap.has(clave)) {
                        duplicados.push({ elemento: elem, clave });
                    } else {
                        elementosMap.set(clave, elem);
                    }
                });

                if (duplicados.length > 0) {
                    console.log(`      ⚠️  ENCONTRADOS ${duplicados.length} DUPLICADOS:`);
                    duplicados.forEach((dup, idx) => {
                        console.log(`         ${idx + 1}. ${dup.elemento.nombre} (tipoId: ${dup.elemento.tipoId}, cantidad: ${dup.elemento.cantidad})`);
                    });
                } else {
                    console.log(`      ✅ No hay duplicados detectados`);
                }

                // Calcular capacidad manualmente para verificar
                console.log(`\n   🧮 CÁLCULO MANUAL DE CAPACIDAD:`);
                let capacidadManual = 0;
                propiedadData.componentes.forEach(comp => {
                    if (comp.elementos) {
                        comp.elementos.forEach(elem => {
                            const capacity = elem.capacity;
                            const cantidad = elem.cantidad || 1;

                            if (capacity > 0) {
                                capacidadManual += capacity * cantidad;
                                console.log(`      ${elem.nombre}: ${capacity} × ${cantidad} = ${capacity * cantidad}`);
                            } else if (capacity === 0) {
                                console.log(`      ${elem.nombre}: capacity=0 → 0`);
                            } else {
                                console.log(`      ${elem.nombre}: SIN capacity → 0 (fallback no aplicado)`);
                            }
                        });
                    }
                });
                console.log(`      TOTAL MANUAL: ${capacidadManual}`);

                // Verificar discrepancia
                if (capacidadCalculada !== capacidadManual) {
                    console.log(`   ⚠️  DISCREPANCIA: Función=${capacidadCalculada}, Manual=${capacidadManual}`);
                }

                // Hipótesis sobre por qué da 12
                console.log(`\n   🎯 HIPÓTESIS SOBRE CAPACIDAD 12:`);
                if (capacidadCalculada === 12) {
                    console.log(`      Para dar 12, necesitamos:`);
                    console.log(`      Opción A: 6 elementos × capacity=2`);
                    console.log(`      Opción B: 12 elementos × capacity=1`);
                    console.log(`      Opción C: Combinación (ej: 4×2 + 4×1 = 12)`);

                    // Contar elementos por capacidad
                    const elementosPorCapacity = {};
                    todosElementos.forEach(elem => {
                        const cap = elem.capacity || 0;
                        elementosPorCapacity[cap] = (elementosPorCapacity[cap] || 0) + (elem.cantidad || 1);
                    });

                    console.log(`\n      DISTRIBUCIÓN ACTUAL:`);
                    Object.entries(elementosPorCapacity).forEach(([cap, count]) => {
                        console.log(`         capacity=${cap}: ${count} elementos`);
                    });
                }

            } else {
                console.log(`   ⚠️  No tiene componentes definidos`);
            }

            console.log('\n   ' + '='.repeat(40));
        }

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error.message);
    }
}

// Ejecutar
diagnosticarCabana7Detallado().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNÓSTICO COMPLETADO');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});