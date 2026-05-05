/**
 * Test para verificar la corrección de capacidad
 */

// Simular la función calcularCapacidad corregida
function calcularCapacidad(componentes) {
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
                    // PERO con cuidado: "INDIVIDUAL" podría referirse a "individuales de mesa", no a camas
                    const n = (el.nombre || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                    // Detección más específica para evitar falsos positivos
                    const esDoble = n.includes('KING') || n.includes('QUEEN') || n.includes('MATRIMONIAL') || n.includes('DOBLE') || n.includes('2 PLAZAS') || n.includes('DOS PLAZAS');
                    const esLitera = n.includes('LITERA') || n.includes('CAMAROTE');

                    // Para "CAMA" e "INDIVIDUAL", necesitamos contexto más específico
                    // "CAMA INDIVIDUAL" sí es una cama, pero "INDIVIDUAL" solo podría ser mantel
                    const esCamaExplicita = n.includes('CAMA ') || n.startsWith('CAMA') || n.includes(' BED') || n.startsWith('BED');
                    const esSimpleExplicita = n.includes('CAMA 1 PLAZA') || n.includes('CAMA INDIVIDUAL') || n.includes('CAMA SINGLE') ||
                                             n.includes('1 PLAZA') || n.includes('SINGLE') || n.includes('NIDO') || n.includes('CATRE');
                    const esSofa = n.includes('SOFA CAMA') || n.includes('FUTON') || n.includes('SOFABED');

                    // Si el nombre contiene solo "INDIVIDUAL" sin "CAMA" antes, probablemente no es una cama
                    const esSoloIndividual = n.includes('INDIVIDUAL') && !n.includes('CAMA');

                    if (esLitera || esDoble) {
                        capacidadTotal += 2 * quantity;
                    } else if (esSimpleExplicita || esSofa) {
                        capacidadTotal += 1 * quantity;
                    } else if (esCamaExplicita && !esSoloIndividual) {
                        capacidadTotal += 1 * quantity;
                    }
                    // Si es solo "INDIVIDUAL" sin "CAMA", no sumamos capacidad
                }
            });
        }
    });

    return capacidadTotal;
}

// Test cases
console.log('=== TEST DE CORRECCIÓN DE CAPACIDAD ===\n');

// Test 1: Elementos de comedor con capacity undefined
const test1 = {
    componentes: [{
        elementos: [
            { nombre: 'Individual', cantidad: 6, capacity: undefined },
            { nombre: 'Individuales', cantidad: 6, capacity: undefined },
            { nombre: 'Silla', cantidad: 6, capacity: undefined },
            { nombre: 'Mesa', cantidad: 1, capacity: undefined }
        ]
    }]
};

const resultado1 = calcularCapacidad(test1.componentes);
console.log('Test 1 - Elementos de comedor (capacity undefined):');
console.log('  Esperado: 0 (no deberían sumar capacidad)');
console.log('  Obtenido:', resultado1);
console.log('  ✓' + (resultado1 === 0 ? ' PASS' : ' FAIL'));

// Test 2: Elementos de comedor con capacity=0 explícito
const test2 = {
    componentes: [{
        elementos: [
            { nombre: 'Individuales', cantidad: 6, capacity: 0 },
            { nombre: 'Mesa de Comedor', cantidad: 1, capacity: 0 },
            { nombre: 'Silla', cantidad: 6, capacity: 0 }
        ]
    }]
};

const resultado2 = calcularCapacidad(test2.componentes);
console.log('\nTest 2 - Elementos de comedor (capacity=0):');
console.log('  Esperado: 0');
console.log('  Obtenido:', resultado2);
console.log('  ✓' + (resultado2 === 0 ? ' PASS' : ' FAIL'));

// Test 3: Camas reales con capacity undefined
const test3 = {
    componentes: [{
        elementos: [
            { nombre: 'Cama Matrimonial', cantidad: 1, capacity: undefined },
            { nombre: 'Cama Individual', cantidad: 2, capacity: undefined },
            { nombre: 'Litera', cantidad: 1, capacity: undefined }
        ]
    }]
};

const resultado3 = calcularCapacidad(test3.componentes);
console.log('\nTest 3 - Camas reales (capacity undefined):');
console.log('  Esperado: 6 (2 + 1*2 + 2)');
console.log('  Obtenido:', resultado3);
console.log('  ✓' + (resultado3 === 6 ? ' PASS' : ' FAIL'));

// Test 4: Mezcla de elementos
const test4 = {
    componentes: [{
        elementos: [
            { nombre: 'Cama 2 plazas', cantidad: 1, capacity: undefined },
            { nombre: 'Individuales', cantidad: 6, capacity: undefined },
            { nombre: 'Sofá cama', cantidad: 1, capacity: undefined },
            { nombre: 'Silla', cantidad: 4, capacity: undefined }
        ]
    }]
};

const resultado4 = calcularCapacidad(test4.componentes);
console.log('\nTest 4 - Mezcla de elementos:');
console.log('  Esperado: 3 (2 + 1)');
console.log('  Obtenido:', resultado4);
console.log('  ✓' + (resultado4 === 3 ? ' PASS' : ' FAIL'));

// Test 5: Elementos con capacity definida
const test5 = {
    componentes: [{
        elementos: [
            { nombre: 'Cama', cantidad: 2, capacity: 2 },
            { nombre: 'Individuales', cantidad: 6, capacity: 0 },
            { nombre: 'Sofá', cantidad: 1, capacity: 1 }
        ]
    }]
};

const resultado5 = calcularCapacidad(test5.componentes);
console.log('\nTest 5 - Elementos con capacity definida:');
console.log('  Esperado: 5 (2*2 + 0*6 + 1*1)');
console.log('  Obtenido:', resultado5);
console.log('  ✓' + (resultado5 === 5 ? ' PASS' : ' FAIL'));

// Test 6: Caso borde - "Cama" vs "Camarote"
const test6 = {
    componentes: [{
        elementos: [
            { nombre: 'Cama', cantidad: 1, capacity: undefined },
            { nombre: 'Camarote', cantidad: 1, capacity: undefined },
            { nombre: 'Cama Individual', cantidad: 2, capacity: undefined }
        ]
    }]
};

const resultado6 = calcularCapacidad(test6.componentes);
console.log('\nTest 6 - Casos borde:');
console.log('  Esperado: 5 (1 + 2 + 2)');
console.log('  Obtenido:', resultado6);
console.log('  ✓' + (resultado6 === 5 ? ' PASS' : ' FAIL'));

console.log('\n=== RESUMEN ===');
const tests = [resultado1, resultado2, resultado3, resultado4, resultado5, resultado6];
const expected = [0, 0, 6, 3, 5, 5];
let passed = 0;

tests.forEach((result, i) => {
    if (result === expected[i]) passed++;
});

console.log(`  Tests pasados: ${passed}/${tests.length}`);
console.log(`  Tests fallados: ${tests.length - passed}/${tests.length}`);

if (passed === tests.length) {
    console.log('\n✅ TODOS LOS TESTS PASARON - Corrección válida');
} else {
    console.log('\n❌ ALGUNOS TESTS FALLARON - Revisar corrección');
}