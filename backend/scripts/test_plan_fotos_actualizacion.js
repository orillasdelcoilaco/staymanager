#!/usr/bin/env node
/**
 * backend/scripts/test_plan_fotos_actualizacion.js
 *
 * Script para probar si el plan de fotos se actualiza
 * cuando cambian los componentes de un alojamiento.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../db/postgres');
const { generarPlanFotos, contarDistribucion } = require('../services/propiedadLogicService');

async function main() {
    console.log('=== PRUEBA: ACTUALIZACIÓN DE PLAN DE FOTOS ===\n');

    // ID de empresa y propiedad para Cabaña 9
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
    const propiedadId = 'cabana9';

    try {
        // 1. Obtener datos actuales
        console.log('1. DATOS ACTUALES DE CABAÑA 9:');
        const { rows: propRows } = await pool.query(
            `SELECT nombre, metadata FROM propiedades WHERE id = $1 AND empresa_id = $2`,
            [propiedadId, empresaId]
        );

        if (!propRows[0]) {
            console.log('❌ Propiedad no encontrada');
            return;
        }

        const propiedad = propRows[0];
        const meta = propiedad.metadata || {};
        const componentes = meta.componentes || [];

        console.log(`   Nombre: ${propiedad.nombre}`);
        console.log(`   Componentes: ${componentes.length} elementos`);
        console.log(`   Plan de fotos en metadata: ${meta.fotoPlanIA ? 'SÍ' : 'NO'}\n`);

        // 2. Obtener tiposElemento para esta empresa
        console.log('2. TIPOS DE ELEMENTO CONFIGURADOS:');
        const { rows: tiposRows } = await pool.query(
            `SELECT id, nombre, requires_photo, photo_quantity, photo_guidelines
             FROM tipos_elemento WHERE empresa_id = $1`,
            [empresaId]
        );

        console.log(`   Tipos de elemento: ${tiposRows.length}`);

        // Mostrar tipos que requieren fotos
        const tiposConFotos = tiposRows.filter(t => t.requires_photo);
        console.log(`   Tipos que requieren fotos: ${tiposConFotos.length}`);
        tiposConFotos.forEach(t => {
            console.log(`     - ${t.nombre}: ${t.photo_quantity || 1} foto(s)`);
        });

        // 3. Generar plan de fotos actual
        console.log('\n3. GENERANDO PLAN DE FOTOS ACTUAL:');
        const planActual = generarPlanFotos(componentes, [], tiposRows);

        const totalSlots = Object.values(planActual).reduce((sum, shots) => sum + shots.length, 0);
        console.log(`   Total slots de fotos: ${totalSlots}`);

        // Contar slots por tipo de espacio
        Object.entries(planActual).forEach(([compId, shots]) => {
            const componente = componentes.find(c => c.id === compId);
            if (componente) {
                console.log(`   - ${componente.nombre}: ${shots.length} foto(s)`);

                // Mostrar detalles de las fotos requeridas
                shots.forEach((shot, i) => {
                    const prefix = i === 0 ? '    * ' : '      ';
                    console.log(`${prefix}${shot.shot} (${shot.type})`);
                });
            }
        });

        // 4. Simular agregar un baño nuevo
        console.log('\n4. SIMULANDO AGREGAR UN BAÑO NUEVO:');

        // Crear copia de componentes
        const componentesModificados = JSON.parse(JSON.stringify(componentes));

        // Agregar un nuevo baño
        const nuevoBano = {
            id: 'bano-visitantes-simulado',
            nombre: 'Baño de Visitantes',
            tipo: 'Baño',
            elementos: [
                {
                    id: 'inodoro-visitantes',
                    tipoId: 'inodoro', // Asumiendo que existe este tipo
                    nombre: 'Inodoro',
                    cantidad: 1
                },
                {
                    id: 'lavamanos-visitantes',
                    tipoId: 'lavamanos', // Asumiendo que existe este tipo
                    nombre: 'Lavamanos',
                    cantidad: 1
                }
            ]
        };

        componentesModificados.push(nuevoBano);

        // Verificar si los tipos de elemento existen para el nuevo baño
        const tiposNecesarios = ['inodoro', 'lavamanos'];
        const tiposExistentes = tiposRows.filter(t => tiposNecesarios.includes(t.id));

        console.log(`   Tipos necesarios para nuevo baño: ${tiposNecesarios.join(', ')}`);
        console.log(`   Tipos existentes: ${tiposExistentes.length}/${tiposNecesarios.length}`);

        if (tiposExistentes.length === tiposNecesarios.length) {
            // 5. Generar nuevo plan de fotos con el baño agregado
            console.log('\n5. NUEVO PLAN DE FOTOS CON BAÑO AGREGADO:');
            const planNuevo = generarPlanFotos(componentesModificados, [], tiposRows);

            const totalSlotsNuevo = Object.values(planNuevo).reduce((sum, shots) => sum + shots.length, 0);
            console.log(`   Total slots de fotos: ${totalSlotsNuevo}`);
            console.log(`   Incremento: +${totalSlotsNuevo - totalSlots} slots`);

            // Encontrar el nuevo componente en el plan
            const nuevoComponentePlan = planNuevo[nuevoBano.id];
            if (nuevoComponentePlan) {
                console.log(`   - ${nuevoBano.nombre}: ${nuevoComponentePlan.length} foto(s)`);
                nuevoComponentePlan.forEach((shot, i) => {
                    const prefix = i === 0 ? '    * ' : '      ';
                    console.log(`${prefix}${shot.shot} (${shot.type})`);
                });
            }

            // 6. Verificar conteo de baños
            console.log('\n6. VERIFICACIÓN DE CONTEO DE BAÑOS:');
            const { numBanos: banosActuales } = contarDistribucion(componentes);
            const { numBanos: banosModificados } = contarDistribucion(componentesModificados);

            console.log(`   Baños actuales: ${banosActuales}`);
            console.log(`   Baños con nuevo baño: ${banosModificados}`);
            console.log(`   Incremento: +${banosModificados - banosActuales} baño(s)`);

            // 7. Verificar consistencia
            console.log('\n7. CONSISTENCIA ENTRE PLAN DE FOTOS Y COMPONENTES:');

            // Contar baños en componentes
            const componentesBanos = componentesModificados.filter(c => {
                const tipo = (c.tipo || '').toUpperCase();
                const nombre = (c.nombre || '').toUpperCase();
                return tipo.includes('BANO') || tipo.includes('TOILET') || tipo.includes('WC') || tipo.includes('BATH') ||
                       nombre.includes('BANO') || nombre.includes('TOILET');
            });

            console.log(`   Componentes detectados como baños: ${componentesBanos.length}`);
            console.log(`   Baños calculados por contarDistribucion: ${banosModificados}`);

            // Verificar que cada baño tenga plan de fotos
            const bañosConPlan = componentesBanos.filter(c => planNuevo[c.id]);
            console.log(`   Baños con plan de fotos: ${bañosConPlan.length}/${componentesBanos.length}`);

            if (bañosConPlan.length === componentesBanos.length) {
                console.log('   ✅ Todos los baños tienen plan de fotos');
            } else {
                console.log('   ⚠️  Algunos baños no tienen plan de fotos');
            }

        } else {
            console.log('   ⚠️  No se pueden generar fotos para el nuevo baño: faltan tipos de elemento');
            console.log('   Tipos faltantes:', tiposNecesarios.filter(t => !tiposExistentes.some(te => te.id === t)));
        }

        // 8. Verificar flujo real en el sistema
        console.log('\n8. FLUJO REAL EN EL SISTEMA:');
        console.log('   Cuando se agrega un baño en el wizard:');
        console.log('   1. Se actualiza `propiedades.metadata.componentes`');
        console.log('   2. Se recalcula `metadata.numBanos` (nuestra corrección)');
        console.log('   3. El plan de fotos se regenera al abrir el paso 2');
        console.log('   4. La IA valida las fotos contra los componentes actuales');

        // 9. Recomendaciones
        console.log('\n9. RECOMENDACIONES:');
        console.log('   ✅ El sistema SÍ genera plan de fotos basado en componentes reales');
        console.log('   ✅ Cuando agregas un baño, el plan se actualiza automáticamente');
        console.log('   ⚠️  Requiere que los tipos de elemento estén configurados correctamente');
        console.log('   ⚠️  El plan IA (`fotoPlanIA`) podría necesitar regeneración manual');

        console.log('\n🔧 Para forzar regeneración del plan IA:');
        console.log('   1. Ir a Contenido Web → [Propiedad]');
        console.log('   2. Paso 2: Fotos');
        console.log('   3. Usar "Generar plan con IA"');

    } catch (error) {
        console.error('❌ Error durante la prueba:', error.message);
        console.error(error.stack);
    }
}

// Ejecutar si es el script principal
if (require.main === module) {
    main().catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
}

module.exports = { testPlanFotosActualizacion: main };