#!/usr/bin/env node
/**
 * Script directo para verificar Cabaña 7 - sin depender de la carga automática
 */

console.log('🔍 VERIFICACIÓN CABAÑA 7 - CONEXIÓN DIRECTA');
console.log('='.repeat(60));

// Cargar .env manualmente ANTES de cualquier import
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../backend/.env');
console.log(`📁 Cargando .env desde: ${envPath}`);

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) continue;

        const key = trimmed.substring(0, equalsIndex).trim();
        let value = trimmed.substring(equalsIndex + 1).trim();

        // Eliminar comentarios al final
        const commentIndex = value.indexOf('#');
        if (commentIndex !== -1) {
            value = value.substring(0, commentIndex).trim();
        }

        // Eliminar comillas si las hay
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
        }

        if (key && value) {
            process.env[key] = value;
            if (key === 'DATABASE_URL') {
                console.log(`   ✅ ${key}=${value.substring(0, 50)}...`);
            } else {
                console.log(`   ✅ ${key}=[configurado]`);
            }
        }
    }

    console.log(`✅ Cargadas ${Object.keys(process.env).filter(k => k.startsWith('DATABASE_') || k.startsWith('AI_')).length} variables críticas`);
} else {
    console.error(`❌ No se encontró: ${envPath}`);
    process.exit(1);
}

console.log('\n🔗 Conectando a PostgreSQL...');

// Crear pool directamente
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está definida después de cargar .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: {
        rejectUnauthorized: false
    }
});

// Función de cálculo de capacidad (copiada directamente)
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

async function testConexion() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as hora, version() as version');
        console.log(`✅ Conectado a PostgreSQL`);
        console.log(`   Hora servidor: ${result.rows[0].hora}`);
        console.log(`   Versión: ${result.rows[0].version.split(' ')[1]}`);
        client.release();
        return true;
    } catch (error) {
        console.error(`❌ Error de conexión: ${error.message}`);
        return false;
    }
}

async function buscarCabana7() {
    console.log('\n📊 Buscando propiedades...');

    try {
        // Test de conexión
        if (!await testConexion()) {
            return;
        }

        // Buscar por posibles nombres de Cabaña 7
        const queries = [
            { name: '"cabana 7" exacto', sql: "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE LOWER(nombre) = 'cabana 7'" },
            { name: '"cabaña 7" exacto', sql: "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE LOWER(nombre) = 'cabaña 7'" },
            { name: 'contiene "cabana 7"', sql: "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE nombre ILIKE '%cabana%7%'" },
            { name: 'contiene "cabaña 7"', sql: "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE nombre ILIKE '%cabaña%7%'" },
            { name: 'contiene "7"', sql: "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE nombre ILIKE '%7%' ORDER BY nombre LIMIT 10" },
            { name: 'ID "cabana-7"', sql: "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE id = 'cabana-7'" }
        ];

        let propiedadesEncontradas = [];

        for (const query of queries) {
            console.log(`\n🔍 Buscando: ${query.name}`);
            try {
                const { rows } = await pool.query(query.sql);
                if (rows.length > 0) {
                    console.log(`   ✅ Encontradas: ${rows.length}`);
                    propiedadesEncontradas.push(...rows);
                } else {
                    console.log(`   ⏭️  No encontradas`);
                }
            } catch (error) {
                console.log(`   ❌ Error en query: ${error.message}`);
            }
        }

        // Eliminar duplicados
        const uniqueProps = [];
        const seenIds = new Set();

        for (const prop of propiedadesEncontradas) {
            if (!seenIds.has(prop.id)) {
                seenIds.add(prop.id);
                uniqueProps.push(prop);
            }
        }

        console.log(`\n📈 Total propiedades únicas encontradas: ${uniqueProps.length}`);

        if (uniqueProps.length === 0) {
            console.log('\n📋 Mostrando todas las propiedades (primeras 10):');
            const todas = await pool.query(
                "SELECT id, empresa_id, nombre, capacidad FROM propiedades ORDER BY nombre LIMIT 10"
            );

            todas.rows.forEach((prop, idx) => {
                console.log(`   ${idx + 1}. ${prop.nombre} (ID: ${prop.id}, Cap: ${prop.capacidad})`);
            });

            console.log('\n💡 Sugerencia: Busca manualmente la propiedad con:');
            console.log('   SELECT * FROM propiedades WHERE nombre ILIKE \'%cabana%\';');
            return;
        }

        // Analizar cada propiedad encontrada
        console.log('\n' + '='.repeat(60));
        console.log('🔍 ANALIZANDO PROPIEDADES ENCONTRADAS');
        console.log('='.repeat(60));

        for (const prop of uniqueProps) {
            console.log(`\n🏠 PROPIEDAD: ${prop.nombre}`);
            console.log(`   ID: ${prop.id}`);
            console.log(`   Empresa: ${prop.empresa_id}`);
            console.log(`   Capacidad BD: ${prop.capacidad}`);

            const componentes = prop.metadata?.componentes || [];
            console.log(`   Nº Componentes: ${componentes.length}`);

            // Calcular capacidad
            const capacidadCalculada = calcularCapacidad(componentes);
            console.log(`   🧮 Capacidad calculada: ${capacidadCalculada}`);

            // Verificar
            if (prop.capacidad !== capacidadCalculada) {
                console.log(`   ⚠️  DISCREPANCIA: ${prop.capacidad} ≠ ${capacidadCalculada}`);

                if (capacidadCalculada === 12 && prop.capacidad === 6) {
                    console.log(`   🔴 ¡PROBLEMA! Capacidad duplicada (debería ser 6, calcula 12)`);
                } else if (capacidadCalculada === 6 && prop.capacidad === 12) {
                    console.log(`   🔄 Capacidad invertida (BD: 12, Calculada: 6)`);
                }
            } else {
                console.log(`   ✅ Capacidad consistente`);
                if (prop.capacidad === 6) {
                    console.log(`   🎉 ¡CAPACIDAD CORRECTA (6 personas)!`);
                }
            }

            // Análisis detallado si hay componentes
            if (componentes.length > 0) {
                console.log(`\n   📊 ANÁLISIS DE COMPONENTES:`);

                let totalElementos = 0;
                let elementosConProblemas = 0;
                const clavesVistas = new Set();
                const duplicados = [];

                componentes.forEach((comp, compIdx) => {
                    const elementos = comp.elementos || [];
                    totalElementos += elementos.length;

                    console.log(`   📦 ${comp.nombre || `Componente ${compIdx + 1}`}: ${elementos.length} elementos`);

                    elementos.forEach((el, elIdx) => {
                        // Verificar problemas
                        const tieneProblema = el.capacity === 0 || el.capacity === undefined || el.capacity === null;
                        if (tieneProblema) {
                            elementosConProblemas++;
                        }

                        // Verificar duplicados
                        const clave = `${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;
                        if (clavesVistas.has(clave)) {
                            duplicados.push(el.nombre || 'Elemento sin nombre');
                        }
                        clavesVistas.add(clave);

                        // Mostrar si tiene problema o es de los primeros
                        if (tieneProblema || elIdx < 2) {
                            console.log(`     - ${el.nombre || 'Sin nombre'}: cant=${el.cantidad || 1}, cap=${el.capacity !== undefined ? el.capacity : 'undefined'}${tieneProblema ? ' ⚠️' : ''}`);
                        }
                    });

                    if (elementos.length > 2) {
                        console.log(`     ... y ${elementos.length - 2} más`);
                    }
                });

                console.log(`\n   📈 ESTADÍSTICAS:`);
                console.log(`     Total elementos: ${totalElementos}`);
                console.log(`     Elementos con problemas: ${elementosConProblemas}`);
                console.log(`     Duplicados detectados: ${duplicados.length}`);

                if (duplicados.length > 0) {
                    console.log(`     Nombres duplicados: ${duplicados.slice(0, 3).join(', ')}${duplicados.length > 3 ? '...' : ''}`);
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('💡 RECOMENDACIONES FINALES:');

        const tieneProblemas = uniqueProps.some(p => {
            const capacidadCalculada = calcularCapacidad(p.metadata?.componentes || []);
            return p.capacidad !== capacidadCalculada || capacidadCalculada === 12;
        });

        if (tieneProblemas) {
            console.log('1. Se detectaron problemas de capacidad');
            console.log('2. Ejecutar reparación con:');
            console.log('   node scripts/reparar-capacidad-directo.js');
            console.log('3. Luego verificar nuevamente');
        } else {
            console.log('✅ ¡No se detectaron problemas críticos!');
            console.log('💡 Si aún hay problemas en la UI, verifica:');
            console.log('   - Cache del navegador');
            console.log('   - Que la propiedad correcta esté seleccionada');
            console.log('   - Los logs del servidor en tiempo real');
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
        console.log('\n🔌 Conexión cerrada');
    }
}

// Ejecutar
buscarCabana7().then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ VERIFICACIÓN COMPLETADA');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
});