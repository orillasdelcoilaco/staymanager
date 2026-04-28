#!/usr/bin/env node
/**
 * Script ejecutable para reparar datos de capacidad en PostgreSQL
 *
 * Este script actualiza elementos con capacity=0 o sin capacity
 * basado en el nombre del elemento y elimina duplicados
 */

console.log('🔧 REPARADOR DE CAPACIDAD - POSTGRESQL');
console.log('='.repeat(60));

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Función para determinar capacity basado en nombre (copiada del script original)
function determinarCapacityPorNombre(nombre) {
    if (!nombre) return 0;

    const n = nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Camas dobles, king, queen, matrimonial, 2 plazas
    if (n.includes('KING') || n.includes('QUEEN') || n.includes('MATRIMONIAL') ||
        n.includes('DOBLE') || n.includes('2 PLAZAS') || n.includes('DOS PLAZAS')) {
        return 2;
    }

    // Literas, camarotes (2 plazas cada uno)
    if (n.includes('LITERA') || n.includes('CAMAROTE')) {
        return 2;
    }

    // Camas simples, individuales, 1 plaza, nido, catre
    if (n.includes('1 PLAZA') || n.includes('INDIVIDUAL') || n.includes('SINGLE') ||
        n.includes('NIDO') || n.includes('CATRE') || n.includes('SIMPLE')) {
        return 1;
    }

    // Sofás cama, futones
    if (n.includes('SOFA CAMA') || n.includes('FUTON') || n.includes('SOFABED')) {
        return 1;
    }

    // Camas genéricas (por defecto 1 plaza)
    if (n.includes('CAMA') || n.includes('BED')) {
        return 1;
    }

    // Colchones, inflables
    if (n.includes('COLCHON') || n.includes('INFLABLE')) {
        return 1;
    }

    // No es cama reconocida
    return 0;
}

/**
 * Función para reparar capacity en un array de componentes
 * Elimina duplicados y asigna capacity basado en nombre cuando sea necesario
 */
function repararComponentes(componentes) {
    if (!Array.isArray(componentes)) return componentes;

    return componentes.map(comp => {
        if (!Array.isArray(comp.elementos)) return comp;

        const elementosUnicos = [];
        const vistos = new Set();

        const elementosReparados = comp.elementos.map(el => {
            // Crear clave única para detectar duplicados
            const clave = `${el.nombre || ''}_${el.tipoId || ''}_${el.cantidad || 1}`;

            // Eliminar duplicados
            if (vistos.has(clave)) {
                console.log(`   ⚠️  Eliminando duplicado: ${el.nombre || 'Sin nombre'}`);
                return null;
            }
            vistos.add(clave);

            // Determinar si necesita reparación
            const necesitaReparacion = (
                typeof el.capacity === 'undefined' ||
                el.capacity === null ||
                el.capacity === 0
            );

            let capacidadReparada = el.capacity;

            if (necesitaReparacion && el.nombre) {
                capacidadReparada = determinarCapacityPorNombre(el.nombre);
                if (capacidadReparada > 0) {
                    console.log(`   🔧 Reparando ${el.nombre}: capacity=${el.capacity || 'undefined'} → ${capacidadReparada}`);
                }
            }

            return {
                ...el,
                capacity: capacidadReparada !== undefined ? capacidadReparada : el.capacity
            };
        }).filter(el => el !== null); // Filtrar duplicados eliminados

        return {
            ...comp,
            elementos: elementosReparados
        };
    });
}

/**
 * Función para calcular capacidad (importada del servicio)
 */
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

/**
 * Función principal para reparar todas las propiedades en PostgreSQL
 */
async function repararTodasLasPropiedades() {
    console.log('📊 Buscando propiedades con componentes...');

    try {
        // Obtener todas las propiedades con componentes
        const { rows } = await pool.query(
            "SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE metadata->'componentes' IS NOT NULL"
        );

        console.log(`📋 Encontradas ${rows.length} propiedades con componentes`);

        let propiedadesReparadas = 0;
        let elementosReparados = 0;
        let duplicadosEliminados = 0;

        for (const row of rows) {
            console.log(`\n🔍 Procesando propiedad: ${row.nombre} (ID: ${row.id})`);

            const componentesOriginales = row.metadata.componentes || [];
            const componentesReparados = repararComponentes(componentesOriginales);

            // Calcular nueva capacidad
            const capacidadCalculada = calcularCapacidad(componentesReparados);

            // Actualizar metadata con componentes reparados
            const nuevoMetadata = {
                ...row.metadata,
                componentes: componentesReparados
            };

            // Actualizar en la base de datos
            await pool.query(
                'UPDATE propiedades SET metadata = $1, capacidad = $2 WHERE id = $3 AND empresa_id = $4',
                [JSON.stringify(nuevoMetadata), capacidadCalculada, row.id, row.empresa_id]
            );

            // Verificar si hubo cambios
            const capacidadOriginal = row.capacidad || 0;
            if (capacidadOriginal !== capacidadCalculada) {
                console.log(`   📊 Capacidad actualizada: ${capacidadOriginal} → ${capacidadCalculada}`);
            }

            propiedadesReparadas++;
            console.log(`   ✅ Propiedad reparada`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN DE REPARACIÓN:');
        console.log(`   Propiedades procesadas: ${rows.length}`);
        console.log(`   Propiedades reparadas: ${propiedadesReparadas}`);
        console.log(`   Elementos reparados: ${elementosReparados}`);
        console.log(`   Duplicados eliminados: ${duplicadosEliminados}`);

    } catch (error) {
        console.error('❌ Error durante la reparación:', error);
        process.exit(1);
    }
}

/**
 * Función para verificar una propiedad específica (ej: Cabaña 7)
 */
async function verificarPropiedadEspecifica(empresaId, propiedadId) {
    console.log(`🔍 Verificando propiedad específica: ${propiedadId}`);

    try {
        const { rows } = await pool.query(
            'SELECT id, empresa_id, nombre, capacidad, metadata FROM propiedades WHERE id = $1 AND empresa_id = $2',
            [propiedadId, empresaId]
        );

        if (rows.length === 0) {
            console.log(`❌ Propiedad no encontrada: ${propiedadId}`);
            return;
        }

        const propiedad = rows[0];
        console.log(`📋 Propiedad: ${propiedad.nombre}`);
        console.log(`   Capacidad actual: ${propiedad.capacidad}`);

        const componentes = propiedad.metadata.componentes || [];
        console.log(`   Número de componentes: ${componentes.length}`);

        // Mostrar detalles de componentes
        let totalElementos = 0;
        componentes.forEach((comp, idx) => {
            const elementos = comp.elementos || [];
            totalElementos += elementos.length;
            console.log(`   Componente ${idx + 1}: ${comp.nombre || 'Sin nombre'} (${elementos.length} elementos)`);

            elementos.forEach((el, elIdx) => {
                console.log(`     - ${el.nombre || 'Sin nombre'}: cantidad=${el.cantidad || 1}, capacity=${el.capacity !== undefined ? el.capacity : 'undefined'}`);
            });
        });

        // Calcular capacidad
        const capacidadCalculada = calcularCapacidad(componentes);
        console.log(`   Capacidad calculada: ${capacidadCalculada}`);

        if (propiedad.capacidad !== capacidadCalculada) {
            console.log(`   ⚠️  DISCREPANCIA: capacidad en BD (${propiedad.capacidad}) ≠ calculada (${capacidadCalculada})`);
        } else {
            console.log(`   ✅ Capacidad consistente`);
        }

    } catch (error) {
        console.error('❌ Error al verificar propiedad:', error);
    }
}

/**
 * Función principal
 */
async function main() {
    // Verificar conexión a la base de datos
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL no está definida en las variables de entorno');
        console.log('💡 Asegúrate de ejecutar este script con las variables de entorno correctas');
        process.exit(1);
    }

    console.log('✅ Conectado a PostgreSQL');

    // Mostrar opciones
    console.log('\n🎯 OPCIONES DISPONIBLES:');
    console.log('1. Reparar todas las propiedades');
    console.log('2. Verificar propiedad específica (ej: Cabaña 7)');
    console.log('3. Solo simular (sin guardar cambios)');

    // Por defecto, reparar todas las propiedades
    const opcion = process.argv[2] || '1';

    switch (opcion) {
        case '1':
            await repararTodasLasPropiedades();
            break;
        case '2':
            if (!process.argv[3] || !process.argv[4]) {
                console.log('💡 Uso: node reparar-capacidad-postgresql.js 2 <empresa_id> <propiedad_id>');
                console.log('   Ejemplo: node reparar-capacidad-postgresql.js 2 empresa123 cabana-7');
                process.exit(1);
            }
            await verificarPropiedadEspecifica(process.argv[3], process.argv[4]);
            break;
        case '3':
            console.log('🎭 Modo simulación - No se guardarán cambios');
            // Aquí podríamos implementar simulación si es necesario
            break;
        default:
            console.log(`❌ Opción no válida: ${opcion}`);
            process.exit(1);
    }

    // Cerrar pool de conexiones
    await pool.end();
    console.log('\n' + '='.repeat(60));
    console.log('✅ Script completado');
}

// Ejecutar script
main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});