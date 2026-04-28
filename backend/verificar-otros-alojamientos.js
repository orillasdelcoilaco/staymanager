#!/usr/bin/env node
/**
 * Verificación rápida de otros alojamientos
 */

require('dotenv').config({ path: '.env' });

console.log('🔍 VERIFICACIÓN RÁPIDA DE OTROS ALOJAMIENTOS');
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

const { calcularCapacidad } = require('./services/propiedadLogicService');

async function verificarOtrosAlojamientos() {
    console.log('\n📊 Analizando otros alojamientos...');

    try {
        // Obtener todos los alojamientos excepto Cabaña 7
        const { rows } = await pool.query(
            "SELECT id, nombre, capacidad, metadata FROM propiedades WHERE id != 'cabana-7' ORDER BY nombre LIMIT 10"
        );

        console.log(`📈 Encontrados ${rows.length} alojamientos (excluyendo Cabaña 7)`);

        let problemas = 0;
        let correctos = 0;

        for (const propiedad of rows) {
            const componentes = propiedad.metadata?.componentes || [];
            const capacidadCalculada = calcularCapacidad(componentes);

            console.log(`\n🏠 ${propiedad.nombre}`);
            console.log(`   ID: ${propiedad.id}`);
            console.log(`   Capacidad BD: ${propiedad.capacidad}`);
            console.log(`   Capacidad calculada: ${capacidadCalculada}`);
            console.log(`   Componentes: ${componentes.length}`);

            // Verificar si tiene camas
            let tieneCamas = false;
            let camasEncontradas = [];

            componentes.forEach(comp => {
                if (Array.isArray(comp.elementos)) {
                    comp.elementos.forEach(el => {
                        if (el.nombre && (
                            el.nombre.toLowerCase().includes('cama') ||
                            el.nombre.toLowerCase().includes('bed') ||
                            el.nombre.toLowerCase().includes('litera') ||
                            el.nombre.toLowerCase().includes('camarote') ||
                            el.nombre.toLowerCase().includes('sofá cama') ||
                            el.nombre.toLowerCase().includes('sofa cama')
                        )) {
                            tieneCamas = true;
                            camasEncontradas.push(el.nombre);
                        }
                    });
                }
            });

            console.log(`   Tiene camas definidas: ${tieneCamas ? '✅ Sí' : '⚠️ No'}`);
            if (camasEncontradas.length > 0) {
                console.log(`   Camas: ${camasEncontradas.slice(0, 3).join(', ')}${camasEncontradas.length > 3 ? '...' : ''}`);
            }

            // Comparar capacidades
            if (propiedad.capacidad === capacidadCalculada) {
                console.log(`   ✅ CONSISTENTE`);
                correctos++;
            } else {
                console.log(`   ⚠️  DISCREPANCIA: ${Math.abs(propiedad.capacidad - capacidadCalculada)} personas`);
                problemas++;

                // Análisis rápido del problema
                if (capacidadCalculada === 0 && propiedad.capacidad > 0) {
                    console.log(`   🔍 Posible problema: capacidad > 0 pero cálculo da 0`);
                    console.log(`   💡 Similar a Cabaña 7 - podría necesitar camas definidas`);
                } else if (capacidadCalculada > propiedad.capacidad) {
                    console.log(`   🔍 Cálculo mayor que BD (posible duplicación)`);
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN:');
        console.log(`   Total alojamientos analizados: ${rows.length}`);
        console.log(`   Correctos/consistentes: ${correctos}`);
        console.log(`   Con problemas: ${problemas}`);

        if (problemas === 0) {
            console.log('\n🎉 ¡TODOS LOS OTROS ALOJAMIENTOS PARECEN CORRECTOS!');
            console.log('💡 Puedes continuar probando con confianza');
        } else {
            console.log(`\n⚠️  Se encontraron ${problemas} alojamientos con posibles problemas`);
            console.log('💡 Recomendación:');
            console.log('   1. Verificar manualmente los alojamientos con problemas');
            console.log('   2. Ejecutar script de reparación general si es necesario:');
            console.log('      node scripts/reparar-capacidad-postgresql.js 1');
        }

        // Mostrar ejemplos de alojamientos correctos
        console.log('\n📋 EJEMPLOS DE ALOJAMIENTOS CORRECTOS:');
        const ejemplos = rows.filter(p => {
            const componentes = p.metadata?.componentes || [];
            const capacidadCalculada = calcularCapacidad(componentes);
            return p.capacidad === capacidadCalculada && p.capacidad > 0;
        }).slice(0, 3);

        ejemplos.forEach((p, idx) => {
            console.log(`   ${idx + 1}. ${p.nombre}: ${p.capacidad} personas`);
        });

    } catch (error) {
        console.error('❌ Error durante la verificación:', error.message);
    }
}

// Ejecutar
verificarOtrosAlojamientos().then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});