#!/usr/bin/env node
/**
 * Script para aplicar reparación de capacidad a datos existentes
 *
 * Funciona con PostgreSQL (si DATABASE_URL está definida) o Firestore (fallback)
 * Repara elementos con capacity=0 o sin capacity y elimina duplicados
 */

console.log('🔧 APLICANDO REPARACIÓN DE CAPACIDAD A DATOS EXISTENTES');
console.log('=' .repeat(60));

// Cargar funciones necesarias
const { calcularCapacidad } = require('../backend/services/propiedadLogicService');

/**
 * Determina capacity basado en nombre del elemento
 */
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
 * Repara capacity en un array de componentes
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
 * Reparar datos en PostgreSQL
 */
async function repararPostgreSQL() {
    try {
        const { Pool } = require('pg');

        if (!process.env.DATABASE_URL) {
            console.log('❌ DATABASE_URL no definida. No se puede conectar a PostgreSQL.');
            return false;
        }

        console.log('🔗 Conectando a PostgreSQL...');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });

        // Obtener todas las propiedades con componentes
        const { rows } = await pool.query(
            "SELECT id, empresa_id, metadata FROM propiedades WHERE metadata->'componentes' IS NOT NULL"
        );

        console.log(`📊 Encontradas ${rows.length} propiedades con componentes`);

        let propiedadesReparadas = 0;
        let elementosReparados = 0;
        let duplicadosEliminados = 0;

        for (const row of rows) {
            try {
                const componentesOriginales = row.metadata.componentes || [];
                const componentesReparados = repararComponentes(componentesOriginales);

                // Contar cambios
                const cambios = contarCambios(componentesOriginales, componentesReparados);
                elementosReparados += cambios.elementosReparados;
                duplicadosEliminados += cambios.duplicadosEliminados;

                if (cambios.hayCambios) {
                    const nuevoMetadata = { ...row.metadata, componentes: componentesReparados };

                    // Calcular nueva capacidad
                    const nuevaCapacidad = calcularCapacidad(componentesReparados);

                    await pool.query(
                        `UPDATE propiedades
                         SET metadata = $1, capacidad = $2, updated_at = NOW()
                         WHERE id = $3 AND empresa_id = $4`,
                        [JSON.stringify(nuevoMetadata), nuevaCapacidad, row.id, row.empresa_id]
                    );

                    propiedadesReparadas++;
                    console.log(`✅ Propiedad ${row.id} reparada (capacidad: ${nuevaCapacidad})`);
                }
            } catch (error) {
                console.error(`❌ Error reparando propiedad ${row.id}:`, error.message);
            }
        }

        console.log('\n📈 RESUMEN DE REPARACIÓN POSTGRESQL:');
        console.log(`   Propiedades reparadas: ${propiedadesReparadas}/${rows.length}`);
        console.log(`   Elementos reparados: ${elementosReparados}`);
        console.log(`   Duplicados eliminados: ${duplicadosEliminados}`);

        await pool.end();
        return true;

    } catch (error) {
        console.error('❌ Error en reparación PostgreSQL:', error.message);
        return false;
    }
}

/**
 * Contar cambios entre componentes originales y reparados
 */
function contarCambios(originales, reparados) {
    let elementosReparados = 0;
    let duplicadosEliminados = 0;

    // Contar elementos originales vs reparados
    const totalOriginales = originales.reduce((sum, comp) => sum + (comp.elementos?.length || 0), 0);
    const totalReparados = reparados.reduce((sum, comp) => sum + (comp.elementos?.length || 0), 0);

    duplicadosEliminados = totalOriginales - totalReparados;

    // Contar elementos reparados (capacity cambiado de 0/undefined a >0)
    for (let i = 0; i < originales.length; i++) {
        const compOriginal = originales[i];
        const compReparado = reparados[i];

        if (compOriginal.elementos && compReparado.elementos) {
            for (let j = 0; j < compOriginal.elementos.length; j++) {
                const elemOriginal = compOriginal.elementos[j];
                const elemReparado = compReparado.elementos.find(e =>
                    e.nombre === elemOriginal.nombre &&
                    e.tipoId === elemOriginal.tipoId &&
                    e.cantidad === elemOriginal.cantidad
                );

                if (elemReparado) {
                    const originalCapacity = elemOriginal.capacity || 0;
                    const reparadoCapacity = elemReparado.capacity || 0;

                    if ((originalCapacity === 0 || originalCapacity === undefined) && reparadoCapacity > 0) {
                        elementosReparados++;
                    }
                }
            }
        }
    }

    return {
        hayCambios: elementosReparados > 0 || duplicadosEliminados > 0,
        elementosReparados,
        duplicadosEliminados
    };
}

/**
 * Función principal
 */
async function main() {
    console.log('🔍 Verificando configuración de base de datos...');

    // Intentar PostgreSQL primero
    if (process.env.DATABASE_URL) {
        console.log('📊 Modo PostgreSQL detectado (DATABASE_URL definida)');
        const exito = await repararPostgreSQL();

        if (exito) {
            console.log('\n✅ REPARACIÓN COMPLETADA EN POSTGRESQL');
        } else {
            console.log('\n❌ Falló la reparación en PostgreSQL');
        }
    } else {
        console.log('🔥 Modo Firestore detectado (DATABASE_URL no definida)');
        console.log('⚠️  Para reparar Firestore, ejecute el script con Firebase Admin configurado');
        console.log('📋 Use las instrucciones en scripts/reparar-capacidad-datos.js');

        // Mostrar instrucciones para Firestore
        console.log('\n📋 INSTRUCCIONES PARA FIRESTORE:');
        console.log('=' .repeat(40));
        console.log(`
1. Asegúrese de tener serviceAccountKey.json en backend/
2. Ejecute este script desde el directorio backend/
3. O use el código proporcionado en reparar-capacidad-datos.js

Ejemplo mínimo:
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Luego use la función repararComponentes en cada propiedad
`);
    }

    console.log('\n💡 RECOMENDACIONES POST-REPARACIÓN:');
    console.log('=' .repeat(40));
    console.log('1. Verificar Cabaña 7 en el panel de administración');
    console.log('2. Confirmar que muestra capacidad 6 (no 12)');
    console.log('3. Probar crear una propuesta para 6 personas');
    console.log('4. Ejecutar node scripts/verificar-cabana7.js para validar');

    console.log('\n' + '=' .repeat(60));
    console.log('🎯 REPARACIÓN CONFIGURADA Y LISTA');
}

// Ejecutar
main().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});