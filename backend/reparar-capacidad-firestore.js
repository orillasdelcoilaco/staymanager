#!/usr/bin/env node
/**
 * Script para reparar capacidad en Firestore
 * Ejecutar desde el directorio backend/
 */

console.log('🔥 REPARANDO CAPACIDAD EN FIRESTORE');
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
    console.log('⚠️  Asegúrese de tener serviceAccountKey.json en backend/');
    process.exit(1);
}

const db = admin.firestore();

/**
 * Determina capacity basado en nombre del elemento
 */
function determinarCapacityPorNombre(nombre) {
    if (!nombre) return 0;

    const n = nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Camas dobles, king, queen, matrimonial, 2 plazas
    if (n.includes('KING') || n.includes('QUEEN') || n.includes('MATRIMONIAL') ||
        n.includes('DOBLE') || n.includes('2 PLAZAS') || n.includes('DOS PLAZAS')) {
        return 2;
    }

    // Literas, camarotes (2 plazas cada uno)
    if (n.includes('LITERA') || n.includes('CAMAROTE')) {
        return 2;
    }

    // Camas simples, individuales, 1 plaza, nido, catre
    if (n.includes('1 PLAZA') || n.includes('INDIVIDUAL') || n.includes('SINGLE') ||
        n.includes('NIDO') || n.includes('CATRE') || n.includes('SIMPLE')) {
        return 1;
    }

    // Sofás cama, futones
    if (n.includes('SOFA CAMA') || n.includes('FUTON') || n.includes('SOFABED')) {
        return 1;
    }

    // Camas genéricas (por defecto 1 plaza)
    if (n.includes('CAMA') || n.includes('BED')) {
        return 1;
    }

    // Colchones, inflables
    if (n.includes('COLCHON') || n.includes('INFLABLE')) {
        return 1;
    }

    // No es cama reconocida
    return 0;
}

/**
 * Repara capacity en un array de componentes
 * Elimina duplicados y asigna capacity basado en nombre cuando sea necesario
 */
function repararComponentes(componentes) {
    if (!Array.isArray(componentes)) return componentes;

    return componentes.map(comp => {
        if (!Array.isArray(comp.elementos)) return comp;

        const elementosUnicos = [];
        const vistos = new Set();

        const elementosReparados = comp.elementos.map(el => {
            // Crear clave única para detectar duplicados
            const clave = `${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;

            // Eliminar duplicados
            if (vistos.has(clave)) {
                console.log(`   ⚠️  Eliminando duplicado: ${el.nombre || 'Sin nombre'}`);
                return null;
            }
            vistos.add(clave);

            // Determinar si necesita reparación
            const necesitaReparacion = (
                typeof el.capacity === 'undefined' ||
                el.capacity === null ||
                el.capacity === 0
            );

            let capacidadReparada = el.capacity;

            if (necesitaReparacion && el.nombre) {
                capacidadReparada = determinarCapacityPorNombre(el.nombre);
                if (capacidadReparada > 0) {
                    console.log(`   🔧 Reparando ${el.nombre}: capacity=${el.capacity || 'undefined'} → ${capacidadReparada}`);
                }
            }

            return {
                ...el,
                capacity: capacidadReparada !== undefined ? capacidadReparada : el.capacity
            };
        }).filter(el => el !== null); // Filtrar duplicados eliminados

        return {
            ...comp,
            elementos: elementosReparados
        };
    });
}

/**
 * Reparar todas las propiedades en Firestore
 */
async function repararTodasLasPropiedades() {
    console.log('🔍 Buscando propiedades en Firestore...');

    try {
        // Obtener todas las propiedades
        const propiedadesSnapshot = await db.collectionGroup('propiedades').get();

        console.log(`📊 Encontradas ${propiedadesSnapshot.size} propiedades`);

        let propiedadesReparadas = 0;
        let propiedadesConProblemas = 0;
        let elementosReparados = 0;
        let duplicadosEliminados = 0;

        for (const propiedadDoc of propiedadesSnapshot.docs) {
            try {
                const propiedadData = propiedadDoc.data();
                const empresaId = propiedadDoc.ref.parent.parent.id;
                const propiedadId = propiedadDoc.id;

                if (propiedadData.componentes && Array.isArray(propiedadData.componentes)) {
                    const componentesOriginales = propiedadData.componentes;
                    const componentesReparados = repararComponentes(componentesOriginales);

                    // Contar cambios
                    const cambios = contarCambios(componentesOriginales, componentesReparados);
                    elementosReparados += cambios.elementosReparados;
                    duplicadosEliminados += cambios.duplicadosEliminados;

                    if (cambios.hayCambios) {
                        // Calcular nueva capacidad
                        const nuevaCapacidad = calcularCapacidad(componentesReparados);

                        await propiedadDoc.ref.update({
                            componentes: componentesReparados,
                            capacidad: nuevaCapacidad,
                            calculated_capacity: nuevaCapacidad,
                            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
                        });

                        propiedadesReparadas++;
                        console.log(`✅ Propiedad ${propiedadData.nombre || propiedadId} reparada (capacidad: ${nuevaCapacidad})`);

                        // Información específica para Cabaña 7
                        if (propiedadData.nombre === 'Cabaña 7') {
                            console.log(`   🎯 ¡CABAÑA 7 REPARADA! Capacidad anterior: ${propiedadData.capacidad || 'desconocida'}, Nueva: ${nuevaCapacidad}`);
                        }
                    } else {
                        console.log(`➡️  Propiedad ${propiedadData.nombre || propiedadId} ya está correcta`);
                    }
                } else {
                    console.log(`➡️  Propiedad ${propiedadData.nombre || propiedadId} no tiene componentes`);
                }
            } catch (error) {
                propiedadesConProblemas++;
                console.error(`❌ Error reparando propiedad ${propiedadDoc.id}:`, error.message);
            }
        }

        console.log('\n📈 RESUMEN DE REPARACIÓN FIRESTORE:');
        console.log(`   Propiedades totales: ${propiedadesSnapshot.size}`);
        console.log(`   Propiedades reparadas: ${propiedadesReparadas}`);
        console.log(`   Propiedades con problemas: ${propiedadesConProblemas}`);
        console.log(`   Elementos reparados: ${elementosReparados}`);
        console.log(`   Duplicados eliminados: ${duplicadosEliminados}`);

    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

/**
 * Contar cambios entre componentes originales y reparados
 */
function contarCambios(originales, reparados) {
    let elementosReparados = 0;
    let duplicadosEliminados = 0;

    // Contar elementos originales vs reparados
    const totalOriginales = originales.reduce((sum, comp) => sum + (comp.elementos?.length || 0), 0);
    const totalReparados = reparados.reduce((sum, comp) => sum + (comp.elementos?.length || 0), 0);

    duplicadosEliminados = totalOriginales - totalReparados;

    // Contar elementos reparados (capacity cambiado de 0/undefined a >0)
    for (let i = 0; i < originales.length; i++) {
        const compOriginal = originales[i];
        const compReparado = reparados[i];

        if (compOriginal.elementos && compReparado.elementos) {
            for (let j = 0; j < compOriginal.elementos.length; j++) {
                const elemOriginal = compOriginal.elementos[j];
                const elemReparado = compReparado.elementos.find(e =>
                    e.nombre === elemOriginal.nombre &&
                    e.tipoId === elemOriginal.tipoId &&
                    e.cantidad === elemOriginal.cantidad
                );

                if (elemReparado) {
                    const originalCapacity = elemOriginal.capacity || 0;
                    const reparadoCapacity = elemReparado.capacity || 0;

                    if ((originalCapacity === 0 || originalCapacity === undefined) && reparadoCapacity > 0) {
                        elementosReparados++;
                    }
                }
            }
        }
    }

    return {
        hayCambios: elementosReparados > 0 || duplicadosEliminados > 0,
        elementosReparados,
        duplicadosEliminados
    };
}

/**
 * Buscar específicamente Cabaña 7 para diagnóstico
 */
async function diagnosticarCabana7() {
    console.log('\n🔍 BUSCANDO ESPECÍFICAMENTE CABAÑA 7');
    console.log('=' .repeat(40));

    try {
        const propiedadesSnapshot = await db.collectionGroup('propiedades')
            .where('nombre', '==', 'Cabaña 7')
            .get();

        if (propiedadesSnapshot.empty) {
            console.log('❌ No se encontró Cabaña 7');
            return;
        }

        console.log(`✅ Encontrada Cabaña 7 (${propiedadesSnapshot.size} instancias)`);

        for (const propiedadDoc of propiedadesSnapshot.docs) {
            const propiedadData = propiedadDoc.data();
            const empresaId = propiedadDoc.ref.parent.parent.id;
            const propiedadId = propiedadDoc.id;

            console.log(`\n📋 CABAÑA 7 - ${propiedadId}:`);
            console.log(`   Empresa: ${empresaId}`);
            console.log(`   Capacidad actual: ${propiedadData.capacidad || 'No definida'}`);
            console.log(`   Calculated_capacity: ${propiedadData.calculated_capacity || 'No calculada'}`);

            if (propiedadData.componentes && Array.isArray(propiedadData.componentes)) {
                const capacidadCalculada = calcularCapacidad(propiedadData.componentes);
                console.log(`   Capacidad calculada ahora: ${capacidadCalculada}`);

                // Mostrar componentes
                console.log(`   Componentes: ${propiedadData.componentes.length}`);
                propiedadData.componentes.forEach((comp, idx) => {
                    console.log(`   ${idx + 1}. ${comp.nombre || 'Sin nombre'} (${comp.elementos?.length || 0} elementos)`);
                });

                // Reparar y mostrar diferencia
                const componentesReparados = repararComponentes(propiedadData.componentes);
                const capacidadReparada = calcularCapacidad(componentesReparados);

                console.log(`   Capacidad después de reparación: ${capacidadReparada}`);
                console.log(`   Diferencia: ${capacidadReparada - (propiedadData.capacidad || 0)}`);

                if (capacidadReparada === 6) {
                    console.log('   ✅ ¡CAPACIDAD CORRECTA (6)!');
                } else if (propiedadData.capacidad === 12 && capacidadReparada === 6) {
                    console.log('   ✅ ¡PROBLEMA RESUELTO! De 12 a 6');
                }
            }
        }
    } catch (error) {
        console.error('❌ Error diagnosticando Cabaña 7:', error.message);
    }
}

/**
 * Función principal
 */
async function main() {
    console.log('🎯 OPCIONES:');
    console.log('1. Reparar TODAS las propiedades');
    console.log('2. Solo diagnosticar Cabaña 7');
    console.log('3. Salir');

    // En un script real necesitaríamos entrada del usuario
    // Por ahora, ejecutamos ambas
    console.log('\n🔧 EJECUTANDO DIAGNÓSTICO DE CABAÑA 7...');
    await diagnosticarCabana7();

    console.log('\n🔧 EJECUTANDO REPARACIÓN COMPLETA...');
    await repararTodasLasPropiedades();

    console.log('\n💡 RECOMENDACIONES POST-REPARACIÓN:');
    console.log('=' .repeat(40));
    console.log('1. Verificar Cabaña 7 en el panel de administración');
    console.log('2. Confirmar que muestra capacidad 6 (no 12)');
    console.log('3. Probar crear una propuesta para 6 personas');
    console.log('4. Ejecutar node ../scripts/verificar-cabana7.js para validar');

    console.log('\n' + '=' .repeat(60));
    console.log('✅ PROCESO COMPLETADO');
    process.exit(0);
}

// Ejecutar
main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});