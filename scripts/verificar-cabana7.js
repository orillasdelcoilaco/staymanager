#!/usr/bin/env node
/**
 * Script para verificar si Cabaña 7 calcula capacidad correcta después de las correcciones
 *
 * Este script simula el cálculo de capacidad con los datos típicos de Cabaña 7
 * para verificar que ahora da 6 en lugar de 12
 */

console.log('🔍 VERIFICACIÓN DE CABAÑA 7 - CAPACIDAD CORRECTA');
console.log('=' .repeat(60));

// Cargar la función corregida
const { calcularCapacidad } = require('../backend/services/propiedadLogicService');

/**
 * Escenario típico de Cabaña 7 basado en el diagnóstico
 * Debería tener capacidad 6 personas
 */
const componentesCabana7 = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 2 }
        ]
    },
    {
        nombre: "Dormitorio Secundario",
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

/**
 * Escenario PROBLEMA: Elementos con capacity=0 (causa original del bug)
 */
const componentesProblema = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 0 } // ¡PROBLEMA!
        ]
    },
    {
        nombre: "Dormitorio Secundario",
        elementos: [
            { nombre: "Camarote", cantidad: 1, capacity: 0 }, // ¡PROBLEMA!
            { nombre: "Cama Nido", cantidad: 1, capacity: 0 }  // ¡PROBLEMA!
        ]
    },
    {
        nombre: "Sala de Estar",
        elementos: [
            { nombre: "Sofá Cama", cantidad: 1, capacity: 0 } // ¡PROBLEMA!
        ]
    }
];

/**
 * Escenario: Elementos sin capacity definido
 */
const componentesSinCapacity = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1 } // SIN capacity
        ]
    },
    {
        nombre: "Dormitorio Secundario",
        elementos: [
            { nombre: "Camarote", cantidad: 1 }, // SIN capacity
            { nombre: "Cama Nido", cantidad: 1 }  // SIN capacity
        ]
    }
];

/**
 * Escenario: Elementos duplicados
 */
const componentesDuplicados = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 2 },
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 2 } // DUPLICADO
        ]
    },
    {
        nombre: "Dormitorio Secundario",
        elementos: [
            { nombre: "Camarote", cantidad: 1, capacity: 2 },
            { nombre: "Camarote", cantidad: 1, capacity: 2 }, // DUPLICADO
            { nombre: "Cama Nido", cantidad: 1, capacity: 1 },
            { nombre: "Cama Nido", cantidad: 1, capacity: 1 }  // DUPLICADO
        ]
    }
];

console.log('\n🎯 PRUEBA 1: Cabaña 7 con datos CORRECTOS');
console.log('-' .repeat(40));
const capacidad1 = calcularCapacidad(componentesCabana7);
console.log(`Componentes: ${JSON.stringify(componentesCabana7, null, 2)}`);
console.log(`Capacidad calculada: ${capacidad1}`);
console.log(`✅ Esperado: 6 | Resultado: ${capacidad1} | ${capacidad1 === 6 ? '✓ CORRECTO' : '✗ INCORRECTO'}`);

console.log('\n🎯 PRUEBA 2: Cabaña 7 con capacity=0 (PROBLEMA ORIGINAL)');
console.log('-' .repeat(40));
const capacidad2 = calcularCapacidad(componentesProblema);
console.log(`Componentes: ${JSON.stringify(componentesProblema, null, 2)}`);
console.log(`Capacidad calculada: ${capacidad2}`);
console.log(`✅ Con corrección: Debería dar 0 (capacity=0 significa 0 capacidad)`);
console.log(`   Resultado: ${capacidad2} | ${capacidad2 === 0 ? '✓ CORRECTO' : '✗ INCORRECTO (pero mejor que 12!)'}`);

console.log('\n🎯 PRUEBA 3: Elementos sin capacity definido');
console.log('-' .repeat(40));
const capacidad3 = calcularCapacidad(componentesSinCapacity);
console.log(`Componentes: ${JSON.stringify(componentesSinCapacity, null, 2)}`);
console.log(`Capacidad calculada: ${capacidad3}`);
console.log(`✅ Sin capacity definido → aplica fallback por nombre`);
console.log(`   "Cama 2 plazas" → 2, "Camarote" → 2, "Cama Nido" → 1`);
console.log(`   Total esperado: 5 | Resultado: ${capacidad3} | ${capacidad3 === 5 ? '✓ CORRECTO' : '✗ INCORRECTO'}`);

console.log('\n🎯 PRUEBA 4: Elementos duplicados (sin función eliminarElementosDuplicados)');
console.log('-' .repeat(40));
const capacidad4 = calcularCapacidad(componentesDuplicados);
console.log(`Componentes con duplicados: ${JSON.stringify(componentesDuplicados, null, 2)}`);
console.log(`Capacidad calculada: ${capacidad4}`);
console.log(`⚠️  Con duplicados: 2× Cama 2 plazas + 2× Camarote + 2× Cama Nido`);
console.log(`   = (2×2) + (2×2) + (2×1) = 4 + 4 + 2 = 10`);
console.log(`   Resultado: ${capacidad4} | ${capacidad4 === 10 ? '✓ CORRECTO (pero duplicados!)' : '✗ INCORRECTO'}`);

console.log('\n🔍 ANÁLISIS DE LA CORRECCIÓN:');
console.log('=' .repeat(60));

console.log('\n1. FUNCIÓN calcularCapacidad CORREGIDA:');
console.log('   Antes: if (unitCapacity > 0) { ... } else { fallback }');
console.log('   Problema: capacity=0 → unitCapacity=0 → entra a else (fallback)');
console.log('   Después: if (typeof el.capacity !== "undefined" && el.capacity !== null) { ... }');
console.log('   Solución: Si capacity está definido (incluso como 0), NO aplica fallback');

console.log('\n2. FUNCIÓN eliminarElementosDuplicados (propiedadesService.js):');
console.log('   - Detecta duplicados por clave: nombre + tipoId + cantidad');
console.log('   - Elimina elementos duplicados antes de guardar');
console.log('   - Previene capacidad duplicada por datos corruptos');

console.log('\n3. SCRIPT reparar-capacidad-datos.js:');
console.log('   - Repara elementos con capacity=0 o sin capacity');
console.log('   - Asigna capacity basado en nombre del elemento');
console.log('   - Elimina duplicados en datos existentes');

console.log('\n🎯 VERIFICACIÓN FINAL DEL PROBLEMA ORIGINAL:');
console.log('=' .repeat(60));

console.log('\nPROBLEMA ORIGINAL REPORTADO:');
console.log('   "Cabaña 7 calcula 12 personas pero es para 6"');

console.log('\nCAUSA IDENTIFICADA:');
console.log('   1. Elementos con capacity=0 (o no definido)');
console.log('   2. Función original aplicaba fallback cuando capacity=0');
console.log('   3. Fallback: "Cama 2 plazas" → +2, "Camarote" → +2, etc.');
console.log('   4. Posibles duplicados en datos');

console.log('\nSOLUCIÓN IMPLEMENTADA:');
console.log('   1. ✅ Función calcularCapacidad corregida');
console.log('   2. ✅ Función eliminarElementosDuplicados agregada');
console.log('   3. ✅ Script reparar-capacidad-datos.js creado');

console.log('\nRESULTADO ESPERADO PARA CABAÑA 7:');
console.log('   - Si elementos tienen capacity definido correctamente (2,2,1,1) → capacidad = 6');
console.log('   - Si elementos tienen capacity=0 → capacidad = 0 (no 12!)');
console.log('   - Si elementos no tienen capacity → fallback por nombre → ~5-6');

console.log('\n📋 PASOS PARA VERIFICAR EN PRODUCCIÓN:');
console.log('=' .repeat(40));
console.log('1. Abrir Cabaña 7 en el panel de administración');
console.log('2. Verificar que muestra capacidad 6 (no 12)');
console.log('3. Si aún muestra 12:');
console.log('   - Ejecutar script reparar-capacidad-datos.js');
console.log('   - Verificar que elementos tengan capacity > 0 definido');
console.log('   - Eliminar elementos duplicados manualmente si es necesario');
console.log('4. Probar crear una propuesta para 6 personas con Cabaña 7');
console.log('   - Debería aceptar 6 personas sin problemas');
console.log('   - No debería mostrar advertencias de sobrecapacidad');

console.log('\n💡 RECOMENDACIONES ADICIONALES:');
console.log('1. Ejecutar auditoría de complejidad: node scripts/audit-complexity.js');
console.log('2. Ejecutar auditoría UI: node scripts/audit-ui.js');
console.log('3. Probar flujo completo: crear/editar propiedad → calcular capacidad');
console.log('4. Monitorear cálculos en propuestas y reservas');

console.log('\n' + '=' .repeat(60));
console.log('✅ VERIFICACIÓN COMPLETADA');
console.log('Las correcciones deberían resolver el problema de Cabaña 7');
console.log('Capacidad esperada: 6 personas (no 12)');