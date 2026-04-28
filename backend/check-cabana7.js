#!/usr/bin/env node
/**
 * Script final para verificar Cabaña 7 - usando dotenv
 */

// Cargar variables de entorno PRIMERO
require('dotenv').config({ path: '.env' });

console.log('🔍 VERIFICACIÓN CABAÑA 7 - CON DOTENV');
console.log('='.repeat(60));

console.log('📁 Variables de entorno cargadas desde .env');
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Definida' : '❌ No definida'}`);

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está definida');
    console.log('💡 Revisa el archivo .env en el directorio backend');
    process.exit(1);
}

// Ahora cargar el pool
const pool = require('./db/postgres');

if (!pool) {
    console.error('❌ PostgreSQL pool es null después de cargar dotenv');
    console.log('💡 El módulo db/postgres.js no creó el pool');
    process.exit(1);
}

console.log('✅ PostgreSQL configurado correctamente');

// Importar función de cálculo
const { calcularCapacidad } = require('./services/propiedadLogicService');

async function main() {
    console.log('\n📊 Iniciando análisis...');

    try {
        // Test de conexión
        const client = await pool.connect();
        const test = await client.query('SELECT NOW() as hora, current_database() as db');
        console.log(`✅ Conectado a: ${test.rows[0].db}`);
        console.log(`   Hora servidor: ${test.rows[0].hora}`);
        client.release();

        // BUSCAR CABAÑA 7
        console.log('\n🔍 Buscando Cabaña 7...');

        // Intentar varias búsquedas
        const queries = [
            { name: 'Por ID "cabana-7"', sql: "SELECT * FROM propiedades WHERE id = 'cabana-7'" },
            { name: 'Por nombre exacto', sql: "SELECT * FROM propiedades WHERE LOWER(nombre) IN ('cabaña 7', 'cabana 7', 'cabaña7', 'cabana7')" },
            { name: 'Contiene "7"', sql: "SELECT * FROM propiedades WHERE nombre ILIKE '%7%' ORDER BY nombre" },
            { name: 'Todas', sql: "SELECT * FROM propiedades ORDER BY nombre LIMIT 15" }
        ];

        let cabana7 = null;
        let todasLasPropiedades = [];

        for (const query of queries) {
            console.log(`\n   ${query.name}...`);
            try {
                const { rows } = await pool.query(query.sql);

                if (rows.length > 0) {
                    console.log(`     ✅ Encontradas: ${rows.length}`);

                    // Mostrar resultados
                    rows.forEach(row => {
                        console.log(`     - ${row.nombre} (ID: ${row.id}, Cap: ${row.capacidad})`);

                        // Identificar Cabaña 7
                        if (!cabana7 && (
                            row.id === 'cabana-7' ||
                            row.nombre.toLowerCase().includes('cabaña 7') ||
                            row.nombre.toLowerCase().includes('cabana 7')
                        )) {
                            cabana7 = row;
                            console.log(`       🎯 ¡IDENTIFICADA COMO CABAÑA 7!`);
                        }
                    });

                    // Guardar para mostrar después si no encontramos Cabaña 7
                    if (query.name === 'Todas' || query.name === 'Contiene "7"') {
                        todasLasPropiedades.push(...rows);
                    }
                } else {
                    console.log(`     ⏭️  No encontradas`);
                }
            } catch (error) {
                console.log(`     ❌ Error: ${error.message}`);
            }

            // Si ya encontramos, salir
            if (cabana7) break;
        }

        // Si no encontramos Cabaña 7 específica
        if (!cabana7) {
            console.log('\n   🔍 No se encontró Cabaña 7 específica');
            console.log('   📋 Propiedades disponibles:');

            if (todasLasPropiedades.length === 0) {
                // Obtener todas
                const { rows } = await pool.query("SELECT id, nombre, capacidad FROM propiedades ORDER BY nombre");
                todasLasPropiedades = rows;
            }

            todasLasPropiedades.slice(0, 10).forEach((row, idx) => {
                console.log(`     ${idx + 1}. ${row.nombre} (ID: ${row.id}, Cap: ${row.capacidad})`);
            });

            if (todasLasPropiedades.length > 10) {
                console.log(`     ... y ${todasLasPropiedades.length - 10} más`);
            }

            console.log('\n💡 No se pudo identificar Cabaña 7 automáticamente');
            console.log('💡 Busca manualmente con:');
            console.log('   SELECT * FROM propiedades WHERE nombre ILIKE \'%cabana%\';');
            return;
        }

        // ANÁLISIS DE CABAÑA 7
        console.log('\n' + '='.repeat(60));
        console.log(`🔍 ANALIZANDO: ${cabana7.nombre.toUpperCase()}`);
        console.log('='.repeat(60));

        console.log(`📋 DATOS:`);
        console.log(`   ID: ${cabana7.id}`);
        console.log(`   Empresa: ${cabana7.empresa_id}`);
        console.log(`   Capacidad BD: ${cabana7.capacidad}`);
        console.log(`   Activo: ${cabana7.activo}`);

        const componentes = cabana7.metadata?.componentes || [];
        console.log(`   Componentes: ${componentes.length}`);

        // Mostrar estructura
        if (componentes.length > 0) {
            console.log('\n📦 ESTRUCTURA DE COMPONENTES:');

            let totalElementos = 0;
            componentes.forEach((comp, idx) => {
                const elementos = comp.elementos || [];
                totalElementos += elementos.length;

                console.log(`\n   ${idx + 1}. ${comp.nombre || 'Componente'} (${elementos.length} elementos)`);

                // Mostrar todos los elementos (importante para debug)
                elementos.forEach(el => {
                    console.log(`     - ${el.nombre || 'Sin nombre'}: cantidad=${el.cantidad || 1}, capacity=${el.capacity !== undefined ? el.capacity : 'undefined'}`);
                });
            });

            console.log(`\n   📊 Total de elementos: ${totalElementos}`);
        }

        // CÁLCULO DE CAPACIDAD
        console.log('\n🧮 CÁLCULO:');
        const capacidadCalculada = calcularCapacidad(componentes);
        console.log(`   Función calcularCapacidad() devuelve: ${capacidadCalculada}`);
        console.log(`   Valor en base de datos: ${cabana7.capacidad}`);

        // COMPARACIÓN
        console.log('\n📊 COMPARACIÓN:');
        if (cabana7.capacidad === capacidadCalculada) {
            console.log(`   ✅ VALORES IGUALES`);

            if (cabana7.capacidad === 6) {
                console.log(`   🎉 ¡CABAÑA 7 CORRECTA! Capacidad: 6 personas`);
                console.log(`   💡 El problema original está RESUELTO`);
            } else if (cabana7.capacidad === 12) {
                console.log(`   ❌ ¡PROBLEMA! Capacidad duplicada: 12 personas`);
                console.log(`   💡 Se necesita reparación de datos`);
            } else {
                console.log(`   ⚠️  Capacidad: ${cabana7.capacidad} personas`);
            }
        } else {
            console.log(`   ⚠️  VALORES DIFERENTES`);
            console.log(`   BD: ${cabana7.capacidad} vs Cálculo: ${capacidadCalculada}`);
            console.log(`   Diferencia: ${Math.abs(cabana7.capacidad - capacidadCalculada)} personas`);

            if (capacidadCalculada === 12 && cabana7.capacidad === 6) {
                console.log(`   🔴 ¡PROBLEMA DE CABAÑA 7 DETECTADO!`);
                console.log(`   🎯 El cálculo da 12 (duplicado), la BD tiene 6 (correcto)`);
            } else if (capacidadCalculada === 6 && cabana7.capacidad === 12) {
                console.log(`   🔄 Datos invertidos`);
                console.log(`   💡 El cálculo es correcto (6), pero la BD tiene 12`);
            }
        }

        // DETECCIÓN DE PROBLEMAS ESPECÍFICOS
        console.log('\n🔍 DETECCIÓN DE PROBLEMAS:');

        let problemas = {
            capacityCero: 0,
            capacityUndefined: 0,
            duplicados: 0
        };

        const clavesVistas = new Set();

        componentes.forEach(comp => {
            if (Array.isArray(comp.elementos)) {
                comp.elementos.forEach(el => {
                    // Problemas de capacity
                    if (el.capacity === 0) {
                        problemas.capacityCero++;
                        console.log(`   ⚠️  ${el.nombre || 'Elemento'}: capacity=0`);
                    } else if (el.capacity === undefined || el.capacity === null) {
                        problemas.capacityUndefined++;
                        console.log(`   ⚠️  ${el.nombre || 'Elemento'}: capacity=undefined/null`);
                    }

                    // Duplicados
                    const clave = `${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;
                    if (clavesVistas.has(clave)) {
                        problemas.duplicados++;
                        console.log(`   ⚠️  DUPLICADO: ${el.nombre || 'Elemento'}`);
                    }
                    clavesVistas.add(clave);
                });
            }
        });

        console.log(`\n📈 RESUMEN DE PROBLEMAS:`);
        console.log(`   Elementos con capacity=0: ${problemas.capacityCero}`);
        console.log(`   Elementos sin capacity: ${problemas.capacityUndefined}`);
        console.log(`   Elementos duplicados: ${problemas.duplicados}`);

        // CONCLUSIÓN FINAL
        console.log('\n' + '='.repeat(60));
        console.log('🎯 CONCLUSIÓN FINAL:');

        const tieneProblemas = problemas.capacityCero > 0 ||
                              problemas.capacityUndefined > 0 ||
                              problemas.duplicados > 0 ||
                              capacidadCalculada === 12;

        if (tieneProblemas) {
            console.log('❌ SE DETECTARON PROBLEMAS');
            console.log('\n💡 ACCIONES NECESARIAS:');
            console.log('1. Ejecutar script de reparación:');
            console.log('   node scripts/reparar-capacidad-postgresql.js 1');
            console.log('\n2. El script está en: scripts/reparar-capacidad-postgresql.js');
            console.log('\n3. Después de reparar, verificar:');
            console.log('   node check-cabana7.js');
        } else if (cabana7.capacidad === 6 && capacidadCalculada === 6) {
            console.log('✅ ¡TODO CORRECTO!');
            console.log('💡 Cabaña 7 está calculando capacidad 6 correctamente');
            console.log('💡 El problema original está RESUELTO');
        } else {
            console.log('⚠️  ESTADO INDETERMINADO');
            console.log(`💡 Capacidad: BD=${cabana7.capacidad}, Cálculo=${capacidadCalculada}`);
            console.log('💡 Verifica manualmente en la interfaz');
        }

    } catch (error) {
        console.error('❌ Error durante el análisis:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        console.log('\n✅ Análisis completado');
        // No cerramos el pool para no afectar la app
    }
}

// Ejecutar
main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});