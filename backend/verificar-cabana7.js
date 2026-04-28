#!/usr/bin/env node
/**
 * Script para verificar Cabaña 7 - ejecutar desde directorio backend
 */

console.log('🔍 VERIFICACIÓN CABAÑA 7 - DESDE BACKEND');
console.log('='.repeat(60));

// Cargar configuración local
const pool = require('./db/postgres');

if (!pool) {
    console.error('❌ PostgreSQL no está configurado');
    console.log('💡 Verifica que DATABASE_URL esté definida en .env');
    console.log('   DATABASE_URL actual:', process.env.DATABASE_URL || 'no definida');
    process.exit(1);
}

console.log('✅ PostgreSQL configurado');

// Importar función de cálculo
const { calcularCapacidad } = require('./services/propiedadLogicService');

async function verificarCabana7() {
    console.log('\n📊 Iniciando verificación...');

    try {
        // Test de conexión
        const client = await pool.connect();
        const test = await client.query('SELECT NOW() as hora');
        console.log(`✅ Conectado a PostgreSQL (hora servidor: ${test.rows[0].hora})`);
        client.release();

        // Buscar Cabaña 7 de varias formas
        console.log('\n🔍 Buscando Cabaña 7...');

        const busquedas = [
            { desc: 'ID exacto "cabana-7"', sql: "SELECT * FROM propiedades WHERE id = 'cabana-7'" },
            { desc: 'Nombre "Cabaña 7"', sql: "SELECT * FROM propiedades WHERE nombre ILIKE 'cabaña 7'" },
            { desc: 'Nombre "Cabana 7"', sql: "SELECT * FROM propiedades WHERE nombre ILIKE 'cabana 7'" },
            { desc: 'Contiene "7"', sql: "SELECT * FROM propiedades WHERE nombre ILIKE '%7%' ORDER BY nombre LIMIT 5" },
            { desc: 'Todas las propiedades', sql: "SELECT * FROM propiedades ORDER BY nombre LIMIT 10" }
        ];

        let propiedadEncontrada = null;

        for (const busqueda of busquedas) {
            console.log(`\n   🔎 ${busqueda.desc}...`);
            const { rows } = await pool.query(busqueda.sql);

            if (rows.length > 0) {
                console.log(`     ✅ Encontradas: ${rows.length}`);

                // Mostrar resultados
                rows.forEach((row, idx) => {
                    console.log(`     ${idx + 1}. ${row.nombre} (ID: ${row.id}, Cap: ${row.capacidad})`);

                    // Si parece Cabaña 7, guardarla
                    if (!propiedadEncontrada && (
                        row.id === 'cabana-7' ||
                        row.nombre.toLowerCase().includes('cabaña 7') ||
                        row.nombre.toLowerCase().includes('cabana 7')
                    )) {
                        propiedadEncontrada = row;
                        console.log(`        🎯 ¡POSIBLE CABAÑA 7!`);
                    }
                });
            } else {
                console.log(`     ⏭️  No encontradas`);
            }

            // Si ya encontramos Cabaña 7, detener búsqueda
            if (propiedadEncontrada) break;
        }

        // Si no encontramos Cabaña 7 específica, usar la primera con "7"
        if (!propiedadEncontrada) {
            console.log('\n   🔍 No se encontró Cabaña 7 específica, usando primera con "7"...');
            const { rows } = await pool.query("SELECT * FROM propiedades WHERE nombre ILIKE '%7%' LIMIT 1");
            if (rows.length > 0) {
                propiedadEncontrada = rows[0];
                console.log(`     ✅ Usando: ${propiedadEncontrada.nombre}`);
            }
        }

        // Si aún no hay nada, mostrar todas
        if (!propiedadEncontrada) {
            console.log('\n   📋 Mostrando todas las propiedades:');
            const { rows } = await pool.query("SELECT id, nombre, capacidad FROM propiedades ORDER BY nombre");
            rows.forEach((row, idx) => {
                console.log(`     ${idx + 1}. ${row.nombre} (ID: ${row.id}, Cap: ${row.capacidad})`);
            });
            console.log('\n💡 No se pudo identificar Cabaña 7 automáticamente');
            return;
        }

        // ANALIZAR LA PROPIEDAD ENCONTRADA
        console.log('\n' + '='.repeat(60));
        console.log(`🔍 ANALIZANDO: ${propiedadEncontrada.nombre}`);
        console.log('='.repeat(60));

        console.log(`📋 INFORMACIÓN:`);
        console.log(`   ID: ${propiedadEncontrada.id}`);
        console.log(`   Empresa: ${propiedadEncontrada.empresa_id}`);
        console.log(`   Capacidad en BD: ${propiedadEncontrada.capacidad}`);
        console.log(`   Activo: ${propiedadEncontrada.activo}`);

        const componentes = propiedadEncontrada.metadata?.componentes || [];
        console.log(`   Nº Componentes: ${componentes.length}`);

        // Mostrar componentes
        if (componentes.length > 0) {
            console.log('\n📦 COMPONENTES:');
            componentes.forEach((comp, idx) => {
                const elementos = comp.elementos || [];
                console.log(`   ${idx + 1}. ${comp.nombre || 'Sin nombre'} (${elementos.length} elementos)`);

                elementos.forEach((el, elIdx) => {
                    if (elIdx < 3) { // Mostrar solo primeros 3
                        console.log(`     - ${el.nombre || 'Sin nombre'}: cant=${el.cantidad || 1}, cap=${el.capacity !== undefined ? el.capacity : 'undefined'}`);
                    }
                });
                if (elementos.length > 3) {
                    console.log(`     ... y ${elementos.length - 3} más`);
                }
            });
        }

        // CALCULAR CAPACIDAD
        console.log('\n🧮 CÁLCULO DE CAPACIDAD:');
        const capacidadCalculada = calcularCapacidad(componentes);
        console.log(`   Capacidad calculada: ${capacidadCalculada}`);
        console.log(`   Capacidad en BD: ${propiedadEncontrada.capacidad}`);

        if (propiedadEncontrada.capacidad !== capacidadCalculada) {
            console.log(`   ⚠️  DISCREPANCIA: ${Math.abs(propiedadEncontrada.capacidad - capacidadCalculada)} personas de diferencia`);

            if (capacidadCalculada === 12 && propiedadEncontrada.capacidad === 6) {
                console.log(`   🔴 ¡PROBLEMA DETECTADO! Capacidad duplicada (calcula 12, debería ser 6)`);
                console.log(`   🎯 Este es el problema original de Cabaña 7`);
            } else if (capacidadCalculada === 6 && propiedadEncontrada.capacidad === 12) {
                console.log(`   🔄 Datos invertidos (BD tiene 12, cálculo da 6)`);
            }
        } else {
            console.log(`   ✅ Capacidad consistente`);
            if (propiedadEncontrada.capacidad === 6) {
                console.log(`   🎉 ¡CAPACIDAD CORRECTA! (6 personas)`);
            }
        }

        // ANÁLISIS DETALLADO DE PROBLEMAS
        console.log('\n🔍 ANÁLISIS DETALLADO:');

        let totalElementos = 0;
        let elementosConProblemas = 0;
        let duplicados = 0;
        const clavesVistas = new Set();

        componentes.forEach(comp => {
            if (Array.isArray(comp.elementos)) {
                comp.elementos.forEach(el => {
                    totalElementos++;

                    // Verificar problemas de capacity
                    if (el.capacity === 0 || el.capacity === undefined || el.capacity === null) {
                        elementosConProblemas++;
                        console.log(`   ⚠️  ${el.nombre || 'Elemento'}: capacity=${el.capacity}`);
                    }

                    // Verificar duplicados
                    const clave = `${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;
                    if (clavesVistas.has(clave)) {
                        duplicados++;
                        console.log(`   ⚠️  DUPLICADO: ${el.nombre || 'Elemento'}`);
                    }
                    clavesVistas.add(clave);
                });
            }
        });

        console.log(`\n📊 ESTADÍSTICAS:`);
        console.log(`   Total elementos: ${totalElementos}`);
        console.log(`   Elementos con problemas: ${elementosConProblemas}`);
        console.log(`   Duplicados: ${duplicados}`);

        // CONCLUSIÓN
        console.log('\n' + '='.repeat(60));
        console.log('🎯 CONCLUSIÓN:');

        const esCabana7 = propiedadEncontrada.nombre.toLowerCase().includes('cabaña') ||
                         propiedadEncontrada.nombre.toLowerCase().includes('cabana') ||
                         propiedadEncontrada.id === 'cabana-7';

        if (esCabana7) {
            if (capacidadCalculada === 6 && propiedadEncontrada.capacidad === 6) {
                console.log('✅ ¡CABAÑA 7 ESTÁ CORRECTA! Capacidad: 6 personas');
                console.log('💡 El problema original está resuelto en la base de datos');
            } else if (capacidadCalculada === 12) {
                console.log('❌ ¡CABAÑA 7 TIENE EL PROBLEMA! Capacidad duplicada: 12 personas');
                console.log('💡 Se necesita reparación de datos');
            } else {
                console.log(`⚠️  CABAÑA 7 tiene capacidad ${propiedadEncontrada.capacidad} (calculada: ${capacidadCalculada})`);
            }
        } else {
            console.log(`📝 Propiedad analizada: ${propiedadEncontrada.nombre}`);
            console.log(`💡 No es claramente Cabaña 7, pero muestra capacidad ${propiedadEncontrada.capacidad}`);
        }

        // RECOMENDACIONES
        console.log('\n💡 RECOMENDACIONES:');

        if (elementosConProblemas > 0 || duplicados > 0 || capacidadCalculada === 12) {
            console.log('1. Ejecutar reparación de datos:');
            console.log('   node reparar-capacidad.js');
            console.log('\n2. Script de reparación disponible en:');
            console.log('   scripts/reparar-capacidad-postgresql.js');
            console.log('\n3. Después de reparar, verificar nuevamente:');
            console.log('   node verificar-cabana7.js');
        } else if (esCabana7 && capacidadCalculada === 6) {
            console.log('✅ ¡Todo parece correcto!');
            console.log('💡 Si aún hay problemas en la UI, verifica:');
            console.log('   - Cache del navegador');
            console.log('   - Que se esté mostrando la propiedad correcta');
            console.log('   - Logs del servidor en tiempo real');
        } else {
            console.log('🔍 Estado indeterminado');
            console.log('💡 Verifica manualmente la propiedad en la UI');
        }

    } catch (error) {
        console.error('❌ Error durante la verificación:', error.message);
        console.error('Detalles:', error);
    } finally {
        // No cerrar el pool para no afectar otras conexiones
        console.log('\n✅ Verificación completada');
    }
}

// Ejecutar
verificarCabana7().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});