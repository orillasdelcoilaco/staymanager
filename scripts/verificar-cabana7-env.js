#!/usr/bin/env node
/**
 * Script para verificar Cabaña 7 cargando variables de entorno
 */

console.log('🔍 VERIFICACIÓN CABAÑA 7 - CARGANDO VARIABLES DE ENTORNO');
console.log('='.repeat(60));

// Cargar variables de entorno desde backend/.env
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../backend/.env');
console.log(`📁 Cargando variables de entorno desde: ${envPath}`);

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            // Eliminar comentarios
            const cleanValue = value.replace(/#.*$/, '').trim();
            if (key && cleanValue) {
                process.env[key] = cleanValue;
                console.log(`   ✅ ${key}=${cleanValue.substring(0, 20)}${cleanValue.length > 20 ? '...' : ''}`);
            }
        }
    });
} else {
    console.error(`❌ Archivo .env no encontrado: ${envPath}`);
    process.exit(1);
}

console.log('\n✅ Variables de entorno cargadas');

// Ahora cargar la configuración de PostgreSQL
const pool = require('../backend/db/postgres');

if (!pool) {
    console.error('❌ PostgreSQL no está configurado (pool es null)');
    console.log('💡 Aunque cargamos .env, DATABASE_URL podría no estar definida o ser inválida');
    process.exit(1);
}

console.log('✅ Conectado a PostgreSQL');

// Importar función de cálculo de capacidad
const { calcularCapacidad } = require('../backend/services/propiedadLogicService');

async function verificarCabana7() {
    console.log('\n📊 Buscando propiedades en la base de datos...');

    try {
        // Primero, contar total de propiedades
        const countResult = await pool.query('SELECT COUNT(*) as total FROM propiedades');
        console.log(`📈 Total de propiedades en la BD: ${countResult.rows[0].total}`);

        // Buscar propiedades con "7" en el nombre
        const { rows } = await pool.query(
            "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE nombre ILIKE '%7%' ORDER BY nombre"
        );

        console.log(`🔍 Encontradas ${rows.length} propiedades con "7" en el nombre`);

        if (rows.length === 0) {
            console.log('\n📋 Mostrando todas las propiedades (primeras 20):');
            const todasPropiedades = await pool.query(
                "SELECT id, empresa_id, nombre, capacidad FROM propiedades ORDER BY nombre LIMIT 20"
            );

            todasPropiedades.rows.forEach((prop, idx) => {
                console.log(`   ${idx + 1}. ${prop.nombre} (ID: ${prop.id}, Capacidad: ${prop.capacidad})`);
            });
            return;
        }

        let problemasEncontrados = false;
        let cabana7Encontrada = false;

        for (const propiedad of rows) {
            console.log('\n' + '='.repeat(50));
            console.log(`🏠 Propiedad: ${propiedad.nombre}`);
            console.log(`   ID: ${propiedad.id}`);
            console.log(`   Empresa: ${propiedad.empresa_id}`);
            console.log(`   Capacidad en BD: ${propiedad.capacidad}`);

            // Verificar si es "Cabaña 7"
            const esCabana7 = propiedad.nombre.toLowerCase().includes('cabaña') ||
                             propiedad.nombre.toLowerCase().includes('cabana') ||
                             propiedad.nombre.toLowerCase().includes('cabaña 7') ||
                             propiedad.nombre.toLowerCase().includes('cabana 7');

            if (esCabana7) {
                cabana7Encontrada = true;
                console.log(`   🎯 ¡ESTA PODRÍA SER CABAÑA 7!`);
            }

            const componentes = propiedad.metadata?.componentes || [];
            console.log(`   Componentes: ${componentes.length}`);

            // Mostrar detalles si hay componentes
            if (componentes.length > 0) {
                let totalElementos = 0;
                componentes.forEach((comp, idx) => {
                    const elementos = comp.elementos || [];
                    totalElementos += elementos.length;
                    console.log(`   📦 ${comp.nombre || `Componente ${idx + 1}`}: ${elementos.length} elementos`);

                    // Mostrar primeros 3 elementos de cada componente
                    elementos.slice(0, 3).forEach(el => {
                        console.log(`     - ${el.nombre || 'Sin nombre'}: cantidad=${el.cantidad || 1}, capacity=${el.capacity !== undefined ? el.capacity : 'undefined'}`);
                    });
                    if (elementos.length > 3) {
                        console.log(`     ... y ${elementos.length - 3} más`);
                    }
                });
                console.log(`   📊 Total elementos: ${totalElementos}`);
            }

            // Calcular capacidad
            const capacidadCalculada = calcularCapacidad(componentes);
            console.log(`\n   🧮 Capacidad calculada: ${capacidadCalculada}`);

            // Verificar discrepancia
            if (propiedad.capacidad !== capacidadCalculada) {
                console.log(`   ⚠️  DISCREPANCIA: BD=${propiedad.capacidad} vs Calculada=${capacidadCalculada}`);
                problemasEncontrados = true;

                // Caso específico de Cabaña 7
                if (esCabana7 && capacidadCalculada === 12 && propiedad.capacidad === 6) {
                    console.log(`   🔴 ¡PROBLEMA DE CABAÑA 7! Capacidad duplicada detectada`);
                } else if (esCabana7 && capacidadCalculada === 6) {
                    console.log(`   ✅ ¡CABAÑA 7 CORRECTA! Capacidad: 6 personas`);
                }
            } else {
                console.log(`   ✅ Capacidad consistente`);
                if (esCabana7 && propiedad.capacidad === 6) {
                    console.log(`   🎉 ¡CABAÑA 7 CORRECTA Y CONSISTENTE!`);
                }
            }

            // Análisis detallado si hay problemas o es Cabaña 7
            if (problemasEncontrados || esCabana7) {
                console.log(`\n   🔍 ANÁLISIS DETALLADO:`);

                let elementosProblematicos = 0;
                let duplicados = new Set();
                let clavesVistas = new Set();

                componentes.forEach(comp => {
                    if (Array.isArray(comp.elementos)) {
                        comp.elementos.forEach(el => {
                            // Verificar capacity problemático
                            if (el.capacity === 0 || el.capacity === undefined || el.capacity === null) {
                                elementosProblematicos++;
                                console.log(`     ⚠️  ${el.nombre || 'Elemento'}: capacity=${el.capacity}`);
                            }

                            // Verificar duplicados
                            const clave = `${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;
                            if (clavesVistas.has(clave)) {
                                duplicados.add(clave);
                                console.log(`     ⚠️  DUPLICADO: ${el.nombre || 'Elemento'} (clave: ${clave})`);
                            }
                            clavesVistas.add(clave);
                        });
                    }
                });

                if (elementosProblematicos > 0) {
                    console.log(`   📌 ${elementosProblematicos} elementos con capacity problemático`);
                }

                if (duplicados.size > 0) {
                    console.log(`   📌 ${duplicados.size} elementos duplicados`);
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN FINAL:');

        if (!cabana7Encontrada) {
            console.log('❌ No se encontró una propiedad claramente identificada como "Cabaña 7"');
            console.log('💡 Busca manualmente la propiedad con ID "cabana-7" o similar');
        }

        if (problemasEncontrados) {
            console.log('❌ Se encontraron problemas que necesitan reparación');
            console.log('\n💡 ACCIONES RECOMENDADAS:');
            console.log('1. Identificar la propiedad exacta de Cabaña 7');
            console.log('2. Ejecutar reparación:');
            console.log('   node scripts/reparar-capacidad-postgresql-env.js');
            console.log('3. Verificar después de reparar');
        } else if (cabana7Encontrada) {
            console.log('✅ ¡Cabaña 7 parece estar correcta!');
            console.log('💡 Si aún hay problemas, verifica en la interfaz de usuario');
        } else {
            console.log('✅ No se encontraron problemas críticos en propiedades con "7"');
        }

    } catch (error) {
        console.error('❌ Error al verificar:', error);
        console.error('Detalles:', error.message);
        console.error('Stack:', error.stack);
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