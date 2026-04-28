#!/usr/bin/env node
/**
 * Diagnóstico simple de Cabaña 7 - sin usar collectionGroup
 */

console.log('🔍 DIAGNÓSTICO SIMPLE CABAÑA 7');
console.log('=' .repeat(60));

const admin = require('firebase-admin');
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

async function buscarCabana7EnTodasLasEmpresas() {
    console.log('\n🔍 BUSCANDO CABAÑA 7 EN TODAS LAS EMPRESAS');
    console.log('=' .repeat(40));

    try {
        // Obtener todas las empresas
        const empresasSnapshot = await db.collection('empresas').get();

        console.log(`📊 Encontradas ${empresasSnapshot.size} empresas`);

        let cabanas7Encontradas = 0;

        for (const empresaDoc of empresasSnapshot.docs) {
            const empresaId = empresaDoc.id;

            try {
                // Buscar propiedades en esta empresa
                const propiedadesSnapshot = await db.collection('empresas')
                    .doc(empresaId)
                    .collection('propiedades')
                    .where('nombre', '==', 'Cabaña 7')
                    .get();

                if (!propiedadesSnapshot.empty) {
                    cabanas7Encontradas += propiedadesSnapshot.size;

                    for (const propiedadDoc of propiedadesSnapshot.docs) {
                        await analizarCabana7(empresaId, propiedadDoc);
                    }
                }
            } catch (error) {
                console.log(`   ⚠️  Error buscando en empresa ${empresaId}: ${error.message}`);
            }
        }

        if (cabanas7Encontradas === 0) {
            console.log('\n❌ No se encontró Cabaña 7 en ninguna empresa');
        } else {
            console.log(`\n✅ Encontradas ${cabanas7Encontradas} instancias de Cabaña 7`);
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

async function analizarCabana7(empresaId, propiedadDoc) {
    const propiedadData = propiedadDoc.data();
    const propiedadId = propiedadDoc.id;

    console.log(`\n📋 CABAÑA 7 ENCONTRADA:`);
    console.log(`   Empresa: ${empresaId}`);
    console.log(`   Propiedad ID: ${propiedadId}`);
    console.log(`   Capacidad en BD: ${propiedadData.capacidad || 'No definida'}`);
    console.log(`   Calculated_capacity: ${propiedadData.calculated_capacity || 'No calculada'}`);

    if (propiedadData.componentes && Array.isArray(propiedadData.componentes)) {
        const capacidadCalculada = calcularCapacidad(propiedadData.componentes);
        console.log(`   Capacidad calculada (nueva función): ${capacidadCalculada}`);

        // Mostrar resumen de componentes
        console.log(`\n   📦 RESUMEN DE COMPONENTES:`);
        let totalElementos = 0;
        let sumaCapacity = 0;

        propiedadData.componentes.forEach((comp, idx) => {
            const numElementos = comp.elementos?.length || 0;
            totalElementos += numElementos;

            // Calcular capacidad de este componente
            let capacidadComp = 0;
            if (comp.elementos) {
                comp.elementos.forEach(elem => {
                    const capacity = elem.capacity || 0;
                    const cantidad = elem.cantidad || 1;
                    capacidadComp += capacity * cantidad;
                });
            }

            sumaCapacity += capacidadComp;

            console.log(`   ${idx + 1}. ${comp.nombre || 'Componente ' + (idx + 1)}:`);
            console.log(`      Elementos: ${numElementos}`);
            console.log(`      Capacidad componente: ${capacidadComp}`);
        });

        console.log(`\n   📊 TOTALES:`);
        console.log(`      Elementos totales: ${totalElementos}`);
        console.log(`      Suma capacity: ${sumaCapacity}`);
        console.log(`      Capacidad calculada: ${capacidadCalculada}`);

        // Análisis detallado de elementos problemáticos
        console.log(`\n   🔍 ELEMENTOS CON PROBLEMAS:`);
        let problemas = 0;

        propiedadData.componentes.forEach((comp, compIdx) => {
            if (comp.elementos) {
                comp.elementos.forEach((elem, elemIdx) => {
                    const capacity = elem.capacity;
                    const cantidad = elem.cantidad || 1;

                    if (capacity === 0 || capacity === undefined || capacity === null) {
                        problemas++;
                        console.log(`      ${compIdx + 1}.${elemIdx + 1} ${elem.nombre || 'Sin nombre'}:`);
                        console.log(`         capacity=${capacity === undefined ? 'undefined' : capacity}`);
                        console.log(`         cantidad=${cantidad}`);

                        // Sugerir valor basado en nombre
                        if (elem.nombre) {
                            const nombreUpper = elem.nombre.toUpperCase();
                            let sugerencia = 0;

                            if (nombreUpper.includes('2 PLAZAS') || nombreUpper.includes('DOBLE') ||
                                nombreUpper.includes('KING') || nombreUpper.includes('QUEEN') ||
                                nombreUpper.includes('MATRIMONIAL')) {
                                sugerencia = 2;
                            } else if (nombreUpper.includes('1 PLAZA') || nombreUpper.includes('INDIVIDUAL') ||
                                nombreUpper.includes('SIMPLE') || nombreUpper.includes('NIDO')) {
                                sugerencia = 1;
                            } else if (nombreUpper.includes('CAMAROTE') || nombreUpper.includes('LITERA')) {
                                sugerencia = 2;
                            } else if (nombreUpper.includes('SOFA CAMA') || nombreUpper.includes('FUTON')) {
                                sugerencia = 1;
                            } else if (nombreUpper.includes('CAMA')) {
                                sugerencia = 1; // Por defecto
                            }

                            if (sugerencia > 0) {
                                console.log(`         🔧 Sugerencia: capacity=${sugerencia} (basado en nombre)`);
                            }
                        }
                    }
                });
            }
        });

        if (problemas === 0) {
            console.log(`      ✅ No hay elementos con capacity=0 o undefined`);
        }

        // Si la capacidad es 12, analizar por qué
        if (capacidadCalculada === 12) {
            console.log(`\n   🎯 ANÁLISIS DE CAPACIDAD 12:`);

            // Listar todos los elementos con sus capacidades
            const elementosDetallados = [];
            propiedadData.componentes.forEach(comp => {
                if (comp.elementos) {
                    comp.elementos.forEach(elem => {
                        elementosDetallados.push({
                            nombre: elem.nombre,
                            capacity: elem.capacity || 0,
                            cantidad: elem.cantidad || 1,
                            contribucion: (elem.capacity || 0) * (elem.cantidad || 1)
                        });
                    });
                }
            });

            console.log(`      Contribución de cada elemento:`);
            elementosDetallados.forEach((elem, idx) => {
                console.log(`      ${idx + 1}. ${elem.nombre}: ${elem.capacity} × ${elem.cantidad} = ${elem.contribucion}`);
            });

            const totalContribucion = elementosDetallados.reduce((sum, elem) => sum + elem.contribucion, 0);
            console.log(`      Total contribución: ${totalContribucion}`);
        }

    } else {
        console.log(`   ⚠️  No tiene componentes definidos`);
    }

    console.log('\n   ' + '='.repeat(40));
}

// Ejecutar
buscarCabana7EnTodasLasEmpresas().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ DIAGNÓSTICO COMPLETADO');
    console.log('\n💡 RECOMENDACIONES:');
    console.log('1. Si Cabaña 7 muestra capacidad 12, verificar elementos con capacity=2');
    console.log('2. Asegurar que elementos de cama individual tengan capacity=1');
    console.log('3. Eliminar elementos duplicados si existen');
    console.log('4. Usar script reparar-capacidad-firestore.js para corregir');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});