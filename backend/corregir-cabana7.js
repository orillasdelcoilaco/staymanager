#!/usr/bin/env node
/**
 * Script para corregir Cabaña 7 después de la reparación incorrecta
 * Problema: "Individuales" se interpretó como camas (debería ser manteles)
 */

require('dotenv').config({ path: '.env' });

console.log('🔧 CORRECCIÓN FINAL CABAÑA 7');
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

async function corregirCabana7() {
    console.log('\n🔍 Obteniendo Cabaña 7 actual...');

    try {
        const { rows } = await pool.query(
            "SELECT * FROM propiedades WHERE id = 'cabana-7'"
        );

        if (rows.length === 0) {
            console.error('❌ Cabaña 7 no encontrada');
            return;
        }

        const cabana7 = rows[0];
        console.log(`✅ Cabaña 7: ${cabana7.nombre}`);
        console.log(`   Capacidad actual: ${cabana7.capacidad}`);

        const componentes = cabana7.metadata?.componentes || [];
        console.log(`   Componentes: ${componentes.length}`);

        // PASO 1: Encontrar y corregir "Individuales" (son manteles, no camas)
        console.log('\n🔧 PASO 1: Corregir "Individuales" (manteles)');

        let componentesCorregidos = JSON.parse(JSON.stringify(componentes)); // Deep clone
        let individualesCorregidos = false;

        componentesCorregidos.forEach(comp => {
            if (Array.isArray(comp.elementos)) {
                comp.elementos.forEach(el => {
                    if (el.nombre === 'Individuales' && el.capacity === 1) {
                        console.log(`   🔧 "Individuales": 1 → 0 (son manteles, no camas)`);
                        el.capacity = 0;
                        individualesCorregidos = true;
                    }
                });
            }
        });

        // PASO 2: Verificar que las camas agregadas sean correctas
        console.log('\n🔍 PASO 2: Verificar camas');

        let camasEncontradas = [];
        componentesCorregidos.forEach(comp => {
            if (Array.isArray(comp.elementos)) {
                comp.elementos.forEach(el => {
                    if (el.nombre && (
                        el.nombre.includes('Cama') ||
                        el.nombre.includes('Camaro') ||
                        el.nombre.includes('Litera')
                    )) {
                        camasEncontradas.push(el);
                        console.log(`   🛏️  ${el.nombre}: ${el.cantidad || 1} × ${el.capacity} = ${(el.cantidad || 1) * el.capacity} personas`);
                    }
                });
            }
        });

        console.log(`   📊 Total camas: ${camasEncontradas.length}`);

        // PASO 3: Calcular nueva capacidad
        console.log('\n🧮 PASO 3: Calcular capacidad');
        const { calcularCapacidad } = require('./services/propiedadLogicService');
        const capacidadCalculada = calcularCapacidad(componentesCorregidos);

        console.log(`   Capacidad calculada: ${capacidadCalculada}`);
        console.log(`   Capacidad anterior: ${cabana7.capacidad}`);

        // PASO 4: Actualizar si es necesario
        if (capacidadCalculada !== cabana7.capacidad || individualesCorregidos) {
            console.log('\n💾 Actualizando base de datos...');

            const nuevoMetadata = {
                ...cabana7.metadata,
                componentes: componentesCorregidos
            };

            await pool.query(
                'UPDATE propiedades SET metadata = $1, capacidad = $2 WHERE id = $3 AND empresa_id = $4',
                [JSON.stringify(nuevoMetadata), capacidadCalculada, cabana7.id, cabana7.empresa_id]
            );

            console.log(`✅ Cabaña 7 actualizada`);
            console.log(`   Nueva capacidad: ${capacidadCalculada}`);

            if (capacidadCalculada === 6) {
                console.log(`   🎉 ¡CAPACIDAD CORRECTA! (6 personas)`);
            }
        } else {
            console.log('\n✅ No se necesitan cambios');
        }

        // PASO 5: Verificación final
        console.log('\n🔍 PASO 5: Verificación final');
        const { rows: finalRows } = await pool.query(
            "SELECT capacidad FROM propiedades WHERE id = 'cabana-7'"
        );

        if (finalRows.length > 0) {
            const capacidadFinal = finalRows[0].capacidad;
            console.log(`   Capacidad final en BD: ${capacidadFinal}`);

            if (capacidadFinal === 6) {
                console.log('\n' + '='.repeat(60));
                console.log('🎉 ¡CABAÑA 7 CORREGIDA EXITOSAMENTE!');
                console.log('   Capacidad: 6 personas ✓');
                console.log('   Camas definidas correctamente ✓');
                console.log('   "Individuales" corregidos (manteles) ✓');
            } else {
                console.log(`\n⚠️  Capacidad final: ${capacidadFinal} (esperado: 6)`);
            }
        }

    } catch (error) {
        console.error('❌ Error durante la corrección:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Ejecutar
corregirCabana7().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Corrección completada');
    console.log('\n💡 Verifica con: node check-cabana7.js');
    process.exit(0);
}).catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});