#!/usr/bin/env node
/**
 * Script para verificar el estado de Cabaña 7 en PostgreSQL
 */

console.log('🔍 VERIFICACIÓN CABAÑA 7 - POSTGRESQL');
console.log('='.repeat(60));

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Función para calcular capacidad (copiada del servicio)
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
                    const n = (el.nombre || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const esDoble = n.includes('KING') || n.includes('QUEEN') || n.includes('MATRIMONIAL') || n.includes('DOBLE') || n.includes('2 PLAZAS') || n.includes('DOS PLAZAS');
                    const esLitera = n.includes('LITERA') || n.includes('CAMAROTE');
                    const esCama = n.includes('CAMA') || n.includes('BED');
                    const esSimple = n.includes('1 PLAZA') || n.includes('INDIVIDUAL') || n.includes('SINGLE') || n.includes('NIDO') || n.includes('CATRE');
                    const esSofa = n.includes('SOFA CAMA') || n.includes('FUTON') || n.includes('SOFABED');
                    if (esLitera || esDoble) capacidadTotal += 2 * quantity;
                    else if (esSimple || esSofa) capacidadTotal += 1 * quantity;
                    else if (esCama) capacidadTotal += 1 * quantity;
                }
            });
        }
    });

    return capacidadTotal;
}

async function verificarCabana7() {
    console.log('📊 Buscando Cabaña 7 en la base de datos...');

    try {
        // Primero, buscar todas las propiedades que puedan ser "Cabaña 7"
        const { rows } = await pool.query(
            "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE nombre ILIKE '%cabaña%7%' OR nombre ILIKE '%cabana%7%'"
        );

        if (rows.length === 0) {
            console.log('❌ No se encontró Cabaña 7 en la base de datos');

            // Mostrar todas las propiedades para referencia
            const todasPropiedades = await pool.query(
                "SELECT id, empresa_id, nombre, capacidad FROM propiedades LIMIT 10"
            );

            console.log('\n📋 Primeras 10 propiedades en la base de datos:');
            todasPropiedades.rows.forEach(prop => {
                console.log(`   - ${prop.nombre} (ID: ${prop.id}, Capacidad: ${prop.capacidad})`);
            });

            return;
        }

        console.log(`✅ Encontradas ${rows.length} propiedades que podrían ser Cabaña 7`);

        for (const propiedad of rows) {
            console.log('\n' + '='.repeat(40));
            console.log(`🔍 Analizando propiedad: ${propiedad.nombre}`);
            console.log(`   ID: ${propiedad.id}`);
            console.log(`   Empresa ID: ${propiedad.empresa_id}`);
            console.log(`   Capacidad en BD: ${propiedad.capacidad}`);

            const componentes = propiedad.metadata?.componentes || [];
            console.log(`   Número de componentes: ${componentes.length}`);

            // Mostrar detalles de componentes
            let totalElementos = 0;
            componentes.forEach((comp, idx) => {
                const elementos = comp.elementos || [];
                totalElementos += elementos.length;
                console.log(`\n   📦 Componente ${idx + 1}: ${comp.nombre || 'Sin nombre'}`);
                console.log(`      Tipo: ${comp.tipo || 'No especificado'}`);
                console.log(`      Elementos: ${elementos.length}`);

                elementos.forEach((el, elIdx) => {
                    console.log(`      - ${el.nombre || 'Sin nombre'}: cantidad=${el.cantidad || 1}, capacity=${el.capacity !== undefined ? el.capacity : 'undefined'}`);
                });
            });

            console.log(`\n   📊 Total de elementos: ${totalElementos}`);

            // Calcular capacidad
            const capacidadCalculada = calcularCapacidad(componentes);
            console.log(`   🧮 Capacidad calculada: ${capacidadCalculada}`);

            // Verificar si hay duplicados
            const elementosUnicos = new Set();
            let duplicados = 0;

            componentes.forEach(comp => {
                if (Array.isArray(comp.elementos)) {
                    comp.elementos.forEach(el => {
                        const clave = `${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;
                        if (elementosUnicos.has(clave)) {
                            duplicados++;
                            console.log(`   ⚠️  DUPLICADO DETECTADO: ${el.nombre || 'Sin nombre'}`);
                        } else {
                            elementosUnicos.add(clave);
                        }
                    });
                }
            });

            if (duplicados > 0) {
                console.log(`   ❗ Se encontraron ${duplicados} elementos duplicados`);
            }

            // Verificar discrepancia
            if (propiedad.capacidad !== capacidadCalculada) {
                console.log(`   ⚠️  DISCREPANCIA: capacidad en BD (${propiedad.capacidad}) ≠ calculada (${capacidadCalculada})`);

                if (capacidadCalculada === 12 && propiedad.capacidad === 6) {
                    console.log(`   ✅ ¡ES EL PROBLEMA ORIGINAL! Cabaña 7 muestra 12 pero debería ser 6`);
                } else if (capacidadCalculada === 6 && propiedad.capacidad === 12) {
                    console.log(`   ✅ ¡PROBLEMA CORREGIDO! Cabaña 7 ahora muestra 6 (correcto)`);
                }
            } else {
                console.log(`   ✅ Capacidad consistente`);

                if (propiedad.capacidad === 6) {
                    console.log(`   🎉 ¡CABAÑA 7 CORRECTA! Capacidad: 6 personas`);
                } else if (propiedad.capacidad === 12) {
                    console.log(`   ❗ CABAÑA 7 INCORRECTA: Capacidad duplicada (12 personas)`);
                }
            }

            // Verificar elementos con capacity=0 o undefined
            let elementosConProblemas = 0;
            componentes.forEach(comp => {
                if (Array.isArray(comp.elementos)) {
                    comp.elementos.forEach(el => {
                        if (el.capacity === 0 || el.capacity === undefined || el.capacity === null) {
                            elementosConProblemas++;
                            console.log(`   ⚠️  Elemento con problema: ${el.nombre || 'Sin nombre'} (capacity=${el.capacity})`);
                        }
                    });
                }
            });

            if (elementosConProblemas > 0) {
                console.log(`   ❗ ${elementosConProblemas} elementos necesitan reparación (capacity=0/undefined)`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('💡 RECOMENDACIONES:');

        const tieneProblemas = rows.some(p => {
            const capacidadCalculada = calcularCapacidad(p.metadata?.componentes || []);
            return p.capacidad !== capacidadCalculada || capacidadCalculada === 12;
        });

        if (tieneProblemas) {
            console.log('1. Ejecutar script de reparación:');
            console.log('   node scripts/reparar-capacidad-postgresql.js 1');
            console.log('\n2. Verificar después de la reparación:');
            console.log('   node scripts/verificar-cabana7-postgresql.js');
        } else {
            console.log('✅ ¡Todo parece correcto! Cabaña 7 está calculando capacidad 6 correctamente.');
        }

    } catch (error) {
        console.error('❌ Error al verificar Cabaña 7:', error);
    } finally {
        await pool.end();
    }
}

// Verificar conexión
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está definida en las variables de entorno');
    console.log('💡 Asegúrate de ejecutar este script con las variables de entorno correctas');
    console.log('   Ejemplo: DATABASE_URL=postgresql://... node scripts/verificar-cabana7-postgresql.js');
    process.exit(1);
}

// Ejecutar verificación
verificarCabana7().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});