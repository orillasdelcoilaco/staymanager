#!/usr/bin/env node
/**
 * Script simple para verificar Cabaña 7 usando la configuración existente
 */

console.log('🔍 VERIFICACIÓN CABAÑA 7 - USANDO CONFIGURACIÓN EXISTENTE');
console.log('='.repeat(60));

// Usar la configuración existente del backend
const path = require('path');
const pool = require('../backend/db/postgres');

if (!pool) {
    console.error('❌ PostgreSQL no está configurado (pool es null)');
    console.log('💡 Verifica que DATABASE_URL esté definida en backend/.env');
    process.exit(1);
}

console.log('✅ Conectado a PostgreSQL usando configuración existente');

// Importar función de cálculo de capacidad
const { calcularCapacidad } = require('../backend/services/propiedadLogicService');

async function verificarCabana7() {
    console.log('📊 Buscando Cabaña 7 en la base de datos...');

    try {
        // Buscar propiedades que podrían ser "Cabaña 7"
        const { rows } = await pool.query(
            "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE nombre ILIKE '%cabaña%7%' OR nombre ILIKE '%cabana%7%' OR nombre ILIKE '%7%'"
        );

        if (rows.length === 0) {
            console.log('❌ No se encontró Cabaña 7 en la base de datos');

            // Mostrar todas las propiedades para referencia
            const todasPropiedades = await pool.query(
                "SELECT id, empresa_id, nombre, capacidad FROM propiedades ORDER BY nombre LIMIT 15"
            );

            console.log('\n📋 Primeras 15 propiedades en la base de datos:');
            todasPropiedades.rows.forEach(prop => {
                console.log(`   - ${prop.nombre} (ID: ${prop.id}, Capacidad: ${prop.capacidad})`);
            });

            return;
        }

        console.log(`✅ Encontradas ${rows.length} propiedades`);

        let problemasEncontrados = false;

        for (const propiedad of rows) {
            console.log('\n' + '='.repeat(50));
            console.log(`🔍 Propiedad: ${propiedad.nombre}`);
            console.log(`   ID: ${propiedad.id}, Empresa: ${propiedad.empresa_id}`);
            console.log(`   Capacidad en BD: ${propiedad.capacidad}`);

            const componentes = propiedad.metadata?.componentes || [];
            console.log(`   Componentes: ${componentes.length}`);

            // Mostrar estructura de componentes
            componentes.forEach((comp, idx) => {
                const elementos = comp.elementos || [];
                console.log(`   📦 ${comp.nombre || 'Componente'}: ${elementos.length} elementos`);

                elementos.forEach(el => {
                    console.log(`     - ${el.nombre || 'Sin nombre'}: cantidad=${el.cantidad || 1}, capacity=${el.capacity !== undefined ? el.capacity : 'undefined'}`);
                });
            });

            // Calcular capacidad
            const capacidadCalculada = calcularCapacidad(componentes);
            console.log(`\n   🧮 Capacidad calculada: ${capacidadCalculada}`);

            // Verificar discrepancia
            if (propiedad.capacidad !== capacidadCalculada) {
                console.log(`   ⚠️  DISCREPANCIA: BD=${propiedad.capacidad} vs Calculada=${capacidadCalculada}`);
                problemasEncontrados = true;

                if (capacidadCalculada === 12 && (propiedad.capacidad === 6 || propiedad.nombre.toLowerCase().includes('cabaña') || propiedad.nombre.toLowerCase().includes('cabana'))) {
                    console.log(`   🔴 ¡PROBLEMA DETECTADO! Posible Cabaña 7 con capacidad duplicada`);
                }
            } else {
                console.log(`   ✅ Capacidad consistente`);
            }

            // Verificar elementos problemáticos
            let elementosProblematicos = 0;
            let duplicados = new Set();
            let clavesVistas = new Set();

            componentes.forEach(comp => {
                if (Array.isArray(comp.elementos)) {
                    comp.elementos.forEach(el => {
                        // Verificar capacity problemático
                        if (el.capacity === 0 || el.capacity === undefined || el.capacity === null) {
                            elementosProblematicos++;
                        }

                        // Verificar duplicados
                        const clave = `${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;
                        if (clavesVistas.has(clave)) {
                            duplicados.add(clave);
                        }
                        clavesVistas.add(clave);
                    });
                }
            });

            if (elementosProblematicos > 0) {
                console.log(`   ⚠️  ${elementosProblematicos} elementos con capacity=0/undefined`);
                problemasEncontrados = true;
            }

            if (duplicados.size > 0) {
                console.log(`   ⚠️  ${duplicados.size} elementos duplicados`);
                problemasEncontrados = true;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN:');

        if (problemasEncontrados) {
            console.log('❌ Se encontraron problemas que necesitan reparación');
            console.log('\n💡 RECOMENDACIONES:');
            console.log('1. Ejecutar script de reparación:');
            console.log('   cd backend && node ../scripts/reparar-capacidad-postgresql.js 1');
            console.log('\n2. Verificar después de reparar:');
            console.log('   cd backend && node ../scripts/verificar-cabana7-simple.js');
        } else {
            console.log('✅ ¡No se encontraron problemas críticos!');
            console.log('💡 Si aún hay problemas con Cabaña 7, verifica:');
            console.log('   - Que la propiedad correcta esté identificada');
            console.log('   - Que los datos en la BD sean correctos');
        }

    } catch (error) {
        console.error('❌ Error al verificar:', error);
        console.error('Detalles:', error.message);
    }
}

// Ejecutar
verificarCabana7().then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});