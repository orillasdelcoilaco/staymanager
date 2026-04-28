#!/usr/bin/env node
/**
 * Script para reparar el problema de capacidad de Cabaña 7
 *
 * Posibles problemas:
 * 1. Elementos con capacity = 0 (entra a fallback)
 * 2. Elementos duplicados en la base de datos
 * 3. Inconsistencia entre capacity en elemento y tipoElemento
 */

console.log('🔧 REPARADOR DE CAPACIDAD - CABAÑA 7');
console.log('=' .repeat(60));

// Primero, vamos a crear una función mejorada de cálculo
const { calcularCapacidad } = require('../backend/services/propiedadLogicService');

function calcularCapacidadMejorada(componentes) {
    if (!Array.isArray(componentes)) return 0;

    let capacidadTotal = 0;
    const elementosProcesados = new Set(); // Para detectar duplicados

    componentes.forEach(comp => {
        if (Array.isArray(comp.elementos)) {
            comp.elementos.forEach(el => {
                // Crear clave única para detectar duplicados
                const clave = `${comp.nombre || ''}_${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;

                if (elementosProcesados.has(clave)) {
                    console.log(`⚠️  DUPLICADO DETECTADO: ${el.nombre} en ${comp.nombre}`);
                    return; // Saltar duplicado
                }
                elementosProcesados.add(clave);

                const unitCapacity = Number(el.capacity || 0);
                const quantity = Number(el.cantidad || 1);

                // DEBUG: Mostrar información del elemento
                console.log(`🔸 ${el.nombre || 'Sin nombre'}:`);
                console.log(`   capacity=${el.capacity}, unitCapacity=${unitCapacity}, quantity=${quantity}`);

                if (unitCapacity > 0) {
                    capacidadTotal += (quantity * unitCapacity);
                    console.log(`   → Suma: ${quantity} × ${unitCapacity} = ${quantity * unitCapacity}`);
                } else {
                    console.log(`   ⚠️  capacity <= 0, aplicando fallback por nombre`);
                    // Lógica de fallback (igual que original)
                    const n = (el.nombre || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const esDoble = n.includes('KING') || n.includes('QUEEN') || n.includes('MATRIMONIAL') || n.includes('DOBLE') || n.includes('2 PLAZAS') || n.includes('DOS PLAZAS');
                    const esLitera = n.includes('LITERA') || n.includes('CAMAROTE');
                    const esCama = n.includes('CAMA') || n.includes('BED');
                    const esSimple = n.includes('1 PLAZA') || n.includes('INDIVIDUAL') || n.includes('SINGLE') || n.includes('NIDO') || n.includes('CATRE');
                    const esSofa = n.includes('SOFA CAMA') || n.includes('FUTON') || n.includes('SOFABED');

                    let capacidadFallback = 0;
                    if (esLitera || esDoble) {
                        capacidadFallback = 2 * quantity;
                        console.log(`   → Fallback: ${esLitera ? 'Litera' : 'Doble'} × ${quantity} = ${capacidadFallback}`);
                    } else if (esSimple || esSofa) {
                        capacidadFallback = 1 * quantity;
                        console.log(`   → Fallback: ${esSimple ? 'Simple' : 'Sofá'} × ${quantity} = ${capacidadFallback}`);
                    } else if (esCama) {
                        capacidadFallback = 1 * quantity;
                        console.log(`   → Fallback: Cama genérica × ${quantity} = ${capacidadFallback}`);
                    } else {
                        console.log(`   → No es cama reconocida, capacidad: 0`);
                    }

                    capacidadTotal += capacidadFallback;
                }
            });
        }
    });

    return capacidadTotal;
}

// Simulación del problema
console.log('\n🎯 SIMULACIÓN DEL PROBLEMA DE CABAÑA 7');
console.log('-' .repeat(40));

// Escenario: 3 camas con capacity=2 cada una = 6 total
// Pero si hay duplicados o capacity=0, podría dar 12

console.log('\n📋 ESCENARIO A: Elementos CORRECTOS (capacity=2)');
const escenarioA = [
    {
        nombre: "Dormitorio 1",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 2 }
        ]
    },
    {
        nombre: "Dormitorio 2",
        elementos: [
            { nombre: "Camarote", cantidad: 1, capacity: 2 },
            { nombre: "Cama Nido", cantidad: 1, capacity: 1 }
        ]
    },
    {
        nombre: "Sala de Estar",
        elementos: [
            { nombre: "Sofá Cama", cantidad: 1, capacity: 1 }
        ]
    }
];

console.log('Cálculo original:', calcularCapacidad(escenarioA));
console.log('Cálculo mejorado:', calcularCapacidadMejorada(escenarioA));

console.log('\n📋 ESCENARIO B: Elementos con capacity=0 (PROBLEMA!)');
const escenarioB = [
    {
        nombre: "Dormitorio 1",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 0 } // ¡CERO!
        ]
    },
    {
        nombre: "Dormitorio 2",
        elementos: [
            { nombre: "Camarote", cantidad: 1, capacity: 0 }, // ¡CERO!
            { nombre: "Cama Nido", cantidad: 1, capacity: 0 } // ¡CERO!
        ]
    }
];

console.log('Cálculo original:', calcularCapacidad(escenarioB));
console.log('Cálculo mejorado:', calcularCapacidadMejorada(escenarioB));

console.log('\n📋 ESCENARIO C: Elementos DUPLICADOS (PROBLEMA!)');
const escenarioC = [
    {
        nombre: "Dormitorio 1",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 2 },
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 2 } // DUPLICADO
        ]
    },
    {
        nombre: "Dormitorio 2",
        elementos: [
            { nombre: "Camarote", cantidad: 1, capacity: 2 },
            { nombre: "Camarote", cantidad: 1, capacity: 2 }, // DUPLICADO
            { nombre: "Cama Nido", cantidad: 1, capacity: 1 },
            { nombre: "Cama Nido", cantidad: 1, capacity: 1 } // DUPLICADO
        ]
    }
];

console.log('Cálculo original:', calcularCapacidad(escenarioC));
console.log('Cálculo mejorado:', calcularCapacidadMejorada(escenarioC));

console.log('\n🔧 SOLUCIONES PROPUESTAS:');
console.log('=' .repeat(40));

console.log('\n1. CORREGIR FUNCIÓN BACKEND:');
console.log('   En propiedadLogicService.js, línea 24:');
console.log('   CAMBIAR: if (unitCapacity > 0) {');
console.log('   POR: if (typeof el.capacity !== "undefined" && el.capacity !== null) {');
console.log('   O: if (unitCapacity !== null && unitCapacity !== undefined && !isNaN(unitCapacity)) {');

console.log('\n2. VERIFICAR Y CORREGIR DATOS:');
console.log('   - Asegurar que todos los elementos de cama tengan capacity > 0');
console.log('   - Eliminar elementos duplicados en componentes');
console.log('   - Sincronizar capacity entre elementos y tiposElemento');

console.log('\n3. MEJORAR LÓGICA DE GUARDADO:');
console.log('   - En propiedadesService.js, verificar que no queden duplicados');
console.log('   - Agregar validación antes de guardar');

console.log('\n4. ACTUALIZAR ELEMENTOS EXISTENTES:');
console.log('   Script para actualizar capacity de elementos:');
console.log('   ```javascript');
console.log('   // Para cada elemento de tipo cama sin capacity definido');
console.log('   if (esCama && !elemento.capacity) {');
console.log('     elemento.capacity = determinarCapacidadPorNombre(elemento.nombre);');
console.log('     // 2 plazas → 2, 1 plaza → 1, etc.');
console.log('   }');
console.log('   ```');

console.log('\n💡 CÓDIGO DE REPARACIÓN RÁPIDA:');

const codigoReparacion = `
// Función reparadora para actualizar capacity de elementos
function repararCapacityElementos(componentes) {
    if (!Array.isArray(componentes)) return componentes;

    return componentes.map(comp => {
        if (!Array.isArray(comp.elementos)) return comp;

        const elementosUnicos = [];
        const vistos = new Set();

        const elementosReparados = comp.elementos.map(el => {
            // Crear clave única para detectar duplicados
            const clave = \`\${el.nombre}_\${el.tipoId}_\${el.cantidad}\`;

            // Eliminar duplicados
            if (vistos.has(clave)) {
                console.log(\`Eliminando duplicado: \${el.nombre}\`);
                return null;
            }
            vistos.add(clave);

            // Reparar capacity si es necesario
            const nombreNorm = (el.nombre || '').toUpperCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

            let capacidadReparada = el.capacity;

            // Si no tiene capacity o es 0, calcularlo por nombre
            if (!el.capacity || el.capacity === 0) {
                if (nombreNorm.includes('2 PLAZAS') || nombreNorm.includes('DOBLE') || nombreNorm.includes('MATRIMONIAL')) {
                    capacidadReparada = 2;
                } else if (nombreNorm.includes('1 PLAZA') || nombreNorm.includes('INDIVIDUAL') || nombreNorm.includes('NIDO')) {
                    capacidadReparada = 1;
                } else if (nombreNorm.includes('CAMAROTE') || nombreNorm.includes('LITERA')) {
                    capacidadReparada = 2;
                } else if (nombreNorm.includes('SOFA CAMA')) {
                    capacidadReparada = 1;
                } else if (nombreNorm.includes('CAMA')) {
                    capacidadReparada = 1; // Por defecto para camas no especificadas
                }
            }

            return {
                ...el,
                capacity: capacidadReparada || 0
            };
        }).filter(el => el !== null); // Filtrar duplicados eliminados

        return {
            ...comp,
            elementos: elementosReparados
        };
    });
}
`;

console.log(codigoReparacion);

console.log('\n🎯 PASOS PARA REPARAR MANUALMENTE:');
console.log('1. Abrir la Cabaña 7 en el sistema');
console.log('2. Verificar cada elemento en cada componente:');
console.log('   - ¿Tiene "capacity" definido?');
console.log('   - ¿El valor es > 0?');
console.log('   - ¿Hay elementos duplicados?');
console.log('3. Si capacity = 0 o no definido:');
console.log('   - Para "Cama 2 plazas" → establecer capacity: 2');
console.log('   - Para "Camarote" → establecer capacity: 2');
console.log('   - Para "Cama Nido" → establecer capacity: 1');
console.log('4. Guardar la propiedad');
console.log('5. Verificar que la capacidad ahora sea 6');

console.log('\n' + '=' .repeat(60));
console.log('✅ DIAGNÓSTICO COMPLETADO');
console.log('El problema de Cabaña 7 (12 vs 6) es muy probablemente:');
console.log('1. Elementos con capacity = 0 o no definido');
console.log('2. Posibles duplicados en la base de datos');
console.log('3. La función backend aplica fallback cuando capacity <= 0');