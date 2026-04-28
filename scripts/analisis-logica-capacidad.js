#!/usr/bin/env node
/**
 * Análisis de la lógica de cálculo de capacidades
 *
 * Compara las funciones backend y frontend para identificar
 * por qué Cabaña 7 muestra 12 en lugar de 6
 */

// Cargar función backend
const { calcularCapacidad } = require('../backend/services/propiedadLogicService');

// Función frontend (copiada de alojamientos.modals.helpers.js)
function calcularCapacidadElementosFrontend(elementos) {
    let capacidad = 0;
    if (!Array.isArray(elementos)) return capacidad;

    function normalizarStr(str) {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    elementos.forEach(elem => {
        const nombreElem = normalizarStr((elem.nombre || '').toUpperCase());
        const cantidad = parseInt(elem.cantidad) || 1;

        if (Number(elem.capacity) > 0) {
            capacidad += Number(elem.capacity) * cantidad;
            return;
        }

        const esDoble = nombreElem.includes('KING') || nombreElem.includes('QUEEN') ||
            nombreElem.includes('MATRIMONIAL') || nombreElem.includes('DOBLE') ||
            nombreElem.includes('2 PLAZAS') || nombreElem.includes('DOS PLAZAS');

        const esSimple = nombreElem.includes('1 PLAZA') || nombreElem.includes('1.5 PLAZA') ||
            nombreElem.includes('INDIVIDUAL') || nombreElem.includes('SINGLE') ||
            nombreElem.includes('NIDO') || nombreElem.includes('CATRE') || nombreElem.includes('SIMPLE');

        const esCama = nombreElem.includes('CAMA') || nombreElem.includes('BED');
        const esLitera = nombreElem.includes('LITERA') || nombreElem.includes('CAMAROTE');
        const esSofa = nombreElem.includes('SOFA CAMA') || nombreElem.includes('FUTON') || nombreElem.includes('SOFABED');
        const esColchon = nombreElem.includes('COLCHON') || nombreElem.includes('INFLABLE');

        if (esLitera) {
            capacidad += 2 * cantidad;
        } else if (esDoble) {
            capacidad += 2 * cantidad;
        } else if (esSimple) {
            capacidad += 1 * cantidad;
        } else if (esSofa || esColchon) {
            capacidad += 1 * cantidad;
        } else if (esCama) {
            capacidad += 1 * cantidad;
        }
    });

    return capacidad;
}

console.log('🔍 ANÁLISIS DE LÓGICA DE CÁLCULO DE CAPACIDADES');
console.log('=' .repeat(60));

// Escenario hipotético basado en el problema: Cabaña 7 debería tener capacidad 6
// Pero muestra 12 (el doble)

console.log('\n📋 ESCENARIO 1: Elementos CON capacity definido');
console.log('-' .repeat(40));

const escenario1 = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 2 }
        ]
    },
    {
        nombre: "Otro Dormitorio",
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

const backend1 = calcularCapacidad(escenario1);
const frontend1 = escenario1.reduce((total, comp) => {
    return total + calcularCapacidadElementosFrontend(comp.elementos || []);
}, 0);

console.log(`Backend: ${backend1} (esperado: 6)`);
console.log(`Frontend: ${frontend1} (esperado: 6)`);

if (backend1 === 12 && frontend1 === 6) {
    console.log('⚠️  PROBLEMA IDENTIFICADO: Backend calcula el DOBLE');
    console.log('   Posible causa: Lógica de fallback en backend se ejecuta INCLUSO cuando hay capacity definido');
} else if (backend1 === 6 && frontend1 === 12) {
    console.log('⚠️  PROBLEMA IDENTIFICADO: Frontend calcula el DOBLE');
} else if (backend1 !== frontend1) {
    console.log(`⚠️  DISCREPANCIA: Backend=${backend1}, Frontend=${frontend1}`);
} else {
    console.log('✅ Coincidencia en cálculo');
}

console.log('\n📋 ESCENARIO 2: Elementos SIN capacity definido (solo nombres)');
console.log('-' .repeat(40));

const escenario2 = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1 } // SIN capacity
        ]
    },
    {
        nombre: "Otro Dormitorio",
        elementos: [
            { nombre: "Camarote", cantidad: 1 }, // SIN capacity
            { nombre: "Cama Nido", cantidad: 1 } // SIN capacity
        ]
    }
];

const backend2 = calcularCapacidad(escenario2);
const frontend2 = escenario2.reduce((total, comp) => {
    return total + calcularCapacidadElementosFrontend(comp.elementos || []);
}, 0);

console.log(`Backend: ${backend2}`);
console.log(`Frontend: ${frontend2}`);

console.log('\n📋 ESCENARIO 3: Elementos con capacity=0 (problema común)');
console.log('-' .repeat(40));

const escenario3 = [
    {
        nombre: "Dormitorio Principal",
        elementos: [
            { nombre: "Cama 2 plazas", cantidad: 1, capacity: 0 } // capacity=0
        ]
    },
    {
        nombre: "Otro Dormitorio",
        elementos: [
            { nombre: "Camarote", cantidad: 1, capacity: 0 }, // capacity=0
            { nombre: "Cama Nido", cantidad: 1, capacity: 0 } // capacity=0
        ]
    }
];

const backend3 = calcularCapacidad(escenario3);
const frontend3 = escenario3.reduce((total, comp) => {
    return total + calcularCapacidadElementosFrontend(comp.elementos || []);
}, 0);

console.log(`Backend: ${backend3} (importante: ¿aplica fallback?)`);
console.log(`Frontend: ${frontend3} (importante: ¿aplica fallback?)`);

console.log('\n🔍 ANÁLISIS DETALLADO DE LÓGICA BACKEND:');
console.log('-' .repeat(40));
console.log('La función calcularCapacidad en propiedadLogicService.js:');
console.log('1. Si capacity > 0 → suma capacity * cantidad');
console.log('2. Si capacity <= 0 → aplica lógica de fallback por nombre');
console.log('3. Lógica de fallback:');
console.log('   - esLitera o esDoble → +2 por cantidad');
console.log('   - esSimple o esSofa → +1 por cantidad');
console.log('   - esCama → +1 por cantidad');

console.log('\n⚠️  PROBLEMA POTENCIAL EN BACKEND (líneas 24-37):');
console.log('El código dice: if (unitCapacity > 0) { ... } else { // Fallback ... }');
console.log('Pero ¿qué pasa si capacity = 0?');
console.log('→ unitCapacity > 0 es FALSE');
console.log('→ Entra al else (fallback)');
console.log('→ Suma capacidad POR NOMBRE además del capacity=0');

console.log('\n🔍 ANÁLISIS DETALLADO DE LÓGICA FRONTEND:');
console.log('-' .repeat(40));
console.log('La función calcularCapacidadElementos en alojamientos.modals.helpers.js:');
console.log('1. Si Number(elem.capacity) > 0 → suma y RETURN');
console.log('2. Si no → aplica lógica de fallback');
console.log('3. IMPORTANTE: Si capacity = 0, Number(0) > 0 es FALSE');
console.log('   → NO entra al if, NO hace return');
console.log('   → Continúa a lógica de fallback');
console.log('   → Podría sumar duplicado si también aplica fallback');

console.log('\n🎯 DIAGNÓSTICO DEL PROBLEMA "CABAÑA 7 = 12 vs 6":');
console.log('=' .repeat(60));

console.log('\nHIPÓTESIS 1: Elementos tienen capacity=0 o no definido');
console.log('   → Backend aplica fallback: 6 elementos × 2 = 12');
console.log('   → Frontend aplica fallback: 6 elementos × 1 = 6?');
console.log('   → Diferencia en lógica de fallback');

console.log('\nHIPÓTESIS 2: Elementos tienen capacity definido PERO...');
console.log('   → Backend: if (unitCapacity > 0) TRUE → suma capacity');
console.log('   → PERO TAMBIÉN podría estar aplicando fallback si hay bug');

console.log('\nHIPÓTESIS 3: Duplicación en backend');
console.log('   → Línea 24: if (unitCapacity > 0) { capacidadTotal += (quantity * unitCapacity); }');
console.log('   → Línea 27: else { // Fallback ... }');
console.log('   → ¿Qué pasa si unitCapacity = 2 y también aplica fallback?');
console.log('   → NO debería, pero revisar lógica');

console.log('\n🔧 VERIFICACIÓN PRÁCTICA:');
console.log('1. Revisar función backend línea por línea:');
console.log('   - const unitCapacity = Number(el.capacity || 0);');
console.log('   - if (unitCapacity > 0) { ... }');
console.log('   - else { // Fallback ... }');
console.log('2. El problema PUEDE estar en que capacity=0 hace que entre al else');
console.log('3. Pero si los elementos tienen capacity=2, NO debería entrar al else');

console.log('\n💡 SOLUCIÓN SUGERIDA:');
console.log('1. En backend, cambiar if (unitCapacity > 0) por if (unitCapacity !== undefined && unitCapacity !== null)');
console.log('2. O mejor: if (typeof el.capacity !== "undefined")');
console.log('3. Asegurar que elementos de cama tengan capacity > 0 definido');
console.log('4. Sincronizar lógica entre frontend y backend');

console.log('\n' + '=' .repeat(60));
console.log('🎯 CONCLUSIÓN: El problema muy probablemente está en que');
console.log('los elementos tienen capacity=0 o no definido, haciendo que');
console.log('el backend aplique lógica de fallback que duplica el cálculo.');
console.log('');
console.log('SOLUCIÓN: Asegurar que todos los elementos de tipo cama');
console.log('tengan capacity > 0 definido explícitamente.');