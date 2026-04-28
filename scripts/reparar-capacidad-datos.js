#!/usr/bin/env node
/**
 * Script para reparar datos de capacidad en elementos existentes
 *
 * Objetivo: Actualizar elementos con capacity=0 o sin capacity
 * basado en el nombre del elemento para corregir cálculos duplicados
 */

console.log('🔧 REPARADOR DE CAPACIDAD - DATOS EXISTENTES');
console.log('=' .repeat(60));

// Esta función se puede usar tanto para PostgreSQL como Firestore
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
 * Función para simular y mostrar el efecto de la reparación
 */
function simularReparacion() {
    console.log('\n🎯 SIMULACIÓN DE REPARACIÓN');
    console.log('-' .repeat(40));

    // Escenario típico de Cabaña 7
    const componentesProblema = [
        {
            nombre: "Dormitorio Principal",
            elementos: [
                { nombre: "Cama 2 plazas", cantidad: 1, capacity: 0 }, // ¡PROBLEMA! capacity=0
                { nombre: "Cama 2 plazas", cantidad: 1, capacity: 0 }  // DUPLICADO
            ]
        },
        {
            nombre: "Dormitorio Secundario",
            elementos: [
                { nombre: "Camarote", cantidad: 1 }, // SIN capacity
                { nombre: "Cama Nido", cantidad: 1 }  // SIN capacity
            ]
        },
        {
            nombre: "Sala de Estar",
            elementos: [
                { nombre: "Sofá Cama", cantidad: 1, capacity: undefined }
            ]
        }
    ];

    console.log('📋 COMPONENTES ANTES DE REPARACIÓN:');
    console.log(JSON.stringify(componentesProblema, null, 2));

    const componentesReparados = repararComponentes(componentesProblema);

    console.log('\n📋 COMPONENTES DESPUÉS DE REPARACIÓN:');
    console.log(JSON.stringify(componentesReparados, null, 2));

    // Calcular capacidad antes y después
    const { calcularCapacidad } = require('../backend/services/propiedadLogicService');

    const capacidadAntes = calcularCapacidad(componentesProblema);
    const capacidadDespues = calcularCapacidad(componentesReparados);

    console.log('\n📊 RESULTADOS:');
    console.log(`   Capacidad antes: ${capacidadAntes}`);
    console.log(`   Capacidad después: ${capacidadDespues}`);
    console.log(`   Diferencia: ${capacidadDespues - capacidadAntes}`);

    if (capacidadAntes === 12 && capacidadDespues === 6) {
        console.log('\n✅ ¡PROBLEMA DE CABAÑA 7 RESUELTO!');
        console.log('   De 12 personas (incorrecto) a 6 personas (correcto)');
    }
}

/**
 * Instrucciones para uso con PostgreSQL
 */
function instruccionesPostgreSQL() {
    console.log('\n📋 INSTRUCCIONES PARA POSTGRESQL:');
    console.log('=' .repeat(40));

    console.log('\n1. Obtener todas las propiedades con sus componentes:');
    console.log(`
   SELECT id, empresa_id, metadata->'componentes' as componentes
   FROM propiedades
   WHERE metadata->'componentes' IS NOT NULL;
    `);

    console.log('\n2. Para cada propiedad, aplicar reparación:');
    console.log(`
   const componentesOriginales = metadata.componentes;
   const componentesReparados = repararComponentes(componentesOriginales);

   // Actualizar en la base de datos
   UPDATE propiedades
   SET metadata = jsonb_set(metadata, '{componentes}', $1::jsonb)
   WHERE id = $2 AND empresa_id = $3;
    `);

    console.log('\n3. Script completo para ejecutar:');
    console.log(`
   const { Pool } = require('pg');
   const pool = new Pool({ connectionString: process.env.DATABASE_URL });

   async function repararTodasLasPropiedades() {
       const { rows } = await pool.query(
           "SELECT id, empresa_id, metadata FROM propiedades WHERE metadata->'componentes' IS NOT NULL"
       );

       for (const row of rows) {
           const componentesReparados = repararComponentes(row.metadata.componentes || []);
           const nuevoMetadata = { ...row.metadata, componentes: componentesReparados };

           await pool.query(
               'UPDATE propiedades SET metadata = $1 WHERE id = $2 AND empresa_id = $3',
               [JSON.stringify(nuevoMetadata), row.id, row.empresa_id]
           );

           console.log(\`✅ Propiedad \${row.id} reparada\`);
       }
   }
    `);
}

/**
 * Instrucciones para uso con Firestore
 */
function instruccionesFirestore() {
    console.log('\n📋 INSTRUCCIONES PARA FIRESTORE:');
    console.log('=' .repeat(40));

    console.log('\n1. Obtener todas las propiedades:');
    console.log(`
   const propiedadesSnapshot = await db.collectionGroup('propiedades').get();

   for (const propiedadDoc of propiedadesSnapshot.docs) {
       const propiedadData = propiedadDoc.data();
       const empresaId = propiedadDoc.ref.parent.parent.id;
       const propiedadId = propiedadDoc.id;

       if (propiedadData.componentes && Array.isArray(propiedadData.componentes)) {
           const componentesReparados = repararComponentes(propiedadData.componentes);

           await propiedadDoc.ref.update({
               componentes: componentesReparados,
               capacidad: calcularCapacidad(componentesReparados),
               fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
           });

           console.log(\`✅ Propiedad \${propiedadId} reparada\`);
       }
   }
    `);
}

// Ejecutar simulación
simularReparacion();

// Mostrar instrucciones
instruccionesPostgreSQL();
instruccionesFirestore();

console.log('\n💡 RECOMENDACIONES:');
console.log('=' .repeat(40));
console.log('1. Ejecutar este script en un entorno de prueba primero');
console.log('2. Hacer backup de la base de datos antes de aplicar cambios');
console.log('3. Verificar específicamente Cabaña 7 después de la reparación');
console.log('4. Monitorear cálculos de capacidad en propuestas y reservas');

console.log('\n' + '=' .repeat(60));
console.log('✅ SCRIPT DE REPARACIÓN LISTO');
console.log('Use las funciones proporcionadas para reparar datos existentes');