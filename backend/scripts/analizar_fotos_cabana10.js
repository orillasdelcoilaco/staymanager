#!/usr/bin/env node
/**
 * backend/scripts/analizar_fotos_cabana10.js
 *
 * Script para analizar el plan de fotos de Cabaña 10
 * y verificar que esté actualizado según los componentes.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../db/postgres');
const { generarPlanFotos, contarDistribucion } = require('../services/propiedadLogicService');

async function main() {
    console.log('=== ANÁLISIS DE PLAN DE FOTOS - CABAÑA 10 ===\n');

    // ID de empresa y propiedad para Cabaña 10
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
    const propiedadId = 'cabana10';

    try {
        // 1. Obtener datos de la propiedad
        console.log('1. DATOS DE LA PROPIEDAD:');
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
        const fotoPlanIA = meta.fotoPlanIA || {};

        console.log(`   Nombre: ${propiedad.nombre}`);
        console.log(`   Componentes: ${componentes.length}`);
        console.log(`   Plan de fotos en metadata: ${fotoPlanIA ? 'SÍ' : 'NO'}`);
        console.log(`   metadata.numBanos: ${meta.numBanos || 'No definido'}`);
        console.log(`   metadata.numPiezas: ${meta.numPiezas || 'No definido'}\n`);

        // 2. Obtener tipos de elemento
        console.log('2. TIPOS DE ELEMENTO CONFIGURADOS:');
        const { rows: tiposRows } = await pool.query(
            `SELECT id, nombre, requires_photo, photo_quantity, photo_guidelines,
                    schema_property, sales_context
             FROM tipos_elemento WHERE empresa_id = $1`,
            [empresaId]
        );

        console.log(`   Tipos de elemento totales: ${tiposRows.length}`);

        // Tipos que requieren fotos
        const tiposConFotos = tiposRows.filter(t => t.requires_photo);
        console.log(`   Tipos que requieren fotos: ${tiposConFotos.length}`);

        // Amenity features que requieren fotos
        const amenityConFotos = tiposConFotos.filter(t => t.schema_property === 'amenityFeature');
        console.log(`   Amenity features con fotos: ${amenityConFotos.length}`);

        // Mostrar algunos ejemplos
        if (tiposConFotos.length > 0) {
            console.log(`   Ejemplos de tipos con fotos requeridas:`);
            tiposConFotos.slice(0, 5).forEach(t => {
                console.log(`     - ${t.nombre}: ${t.photo_quantity || 1} foto(s)`);
                if (t.schema_property === 'amenityFeature') {
                    console.log(`       🟢 Amenity feature`);
                }
            });
            if (tiposConFotos.length > 5) {
                console.log(`     ... y ${tiposConFotos.length - 5} más`);
            }
        }
        console.log();

        // 3. Analizar componentes y sus elementos
        console.log('3. ANÁLISIS DE COMPONENTES Y ELEMENTOS:');

        let totalElementos = 0;
        let elementosConFotosRequeridas = 0;
        const elementosPorComponente = [];

        componentes.forEach((comp, compIndex) => {
            const elementos = comp.elementos || [];
            totalElementos += elementos.length;

            // Contar elementos que requieren fotos
            let fotosRequeridasEnComponente = 0;
            const elementosConFotos = [];

            elementos.forEach(elem => {
                const tipoElemento = tiposRows.find(t => t.id === elem.tipoId);
                if (tipoElemento?.requires_photo) {
                    elementosConFotosRequeridas++;
                    fotosRequeridasEnComponente += tipoElemento.photo_quantity || 1;

                    elementosConFotos.push({
                        nombre: elem.nombre,
                        tipoElemento: tipoElemento.nombre,
                        cantidadFotos: tipoElemento.photo_quantity || 1,
                        esAmenity: tipoElemento.schema_property === 'amenityFeature'
                    });
                }
            });

            elementosPorComponente.push({
                componente: comp.nombre,
                tipo: comp.tipo,
                totalElementos: elementos.length,
                fotosRequeridas: fotosRequeridasEnComponente,
                elementosConFotos: elementosConFotos
            });
        });

        console.log(`   Total elementos en propiedad: ${totalElementos}`);
        console.log(`   Elementos que requieren fotos: ${elementosConFotosRequeridas}`);
        console.log(`   Proporción: ${Math.round((elementosConFotosRequeridas / totalElementos) * 100)}%\n`);

        // Mostrar componentes con más fotos requeridas
        console.log(`   Componentes con fotos requeridas:`);
        elementosPorComponente
            .filter(comp => comp.fotosRequeridas > 0)
            .forEach(comp => {
                console.log(`   - ${comp.componente} (${comp.tipo}):`);
                console.log(`     ${comp.fotosRequeridas} foto(s) requerida(s)`);
                if (comp.elementosConFotos.length > 0) {
                    comp.elementosConFotos.forEach(elem => {
                        const icono = elem.esAmenity ? '🟢' : '⚪';
                        console.log(`     ${icono} ${elem.nombre}: ${elem.cantidadFotos} foto(s)`);
                    });
                }
            });
        console.log();

        // 4. Generar plan de fotos actual
        console.log('4. PLAN DE FOTOS GENERADO DESDE COMPONENTES:');
        const planGenerado = generarPlanFotos(componentes, [], tiposRows);

        const totalSlotsGenerados = Object.values(planGenerado).reduce((sum, shots) => sum + shots.length, 0);
        console.log(`   Total slots de fotos generados: ${totalSlotsGenerados}`);

        // Mostrar distribución por componente
        console.log(`   Distribución por componente:`);
        Object.entries(planGenerado).forEach(([compId, shots]) => {
            const componente = componentes.find(c => c.id === compId);
            if (componente) {
                console.log(`   - ${componente.nombre}: ${shots.length} foto(s)`);

                // Agrupar por tipo de shot
                const shotsPorTipo = {};
                shots.forEach(shot => {
                    shotsPorTipo[shot.type] = (shotsPorTipo[shot.type] || 0) + 1;
                });

                Object.entries(shotsPorTipo).forEach(([tipo, count]) => {
                    console.log(`     ${tipo}: ${count}`);
                });
            }
        });
        console.log();

        // 5. Verificar plan de fotos existente en metadata
        console.log('5. PLAN DE FOTOS EXISTENTE EN METADATA:');

        if (fotoPlanIA && Object.keys(fotoPlanIA).length > 0) {
            const totalSlotsExistentes = Object.values(fotoPlanIA).reduce((sum, shots) => sum + shots.length, 0);
            console.log(`   Total slots en metadata: ${totalSlotsExistentes}`);
            console.log(`   Componentes con plan: ${Object.keys(fotoPlanIA).length}`);

            // Comparar con plan generado
            console.log(`\n   COMPARACIÓN PLAN GENERADO vs EXISTENTE:`);
            console.log(`   Slots generados: ${totalSlotsGenerados}`);
            console.log(`   Slots existentes: ${totalSlotsExistentes}`);
            console.log(`   Diferencia: ${totalSlotsGenerados - totalSlotsExistentes}`);

            // Verificar componentes faltantes
            const componentesConPlanGenerado = Object.keys(planGenerado);
            const componentesConPlanExistente = Object.keys(fotoPlanIA);

            const componentesFaltantes = componentesConPlanGenerado.filter(id =>
                !componentesConPlanExistente.includes(id)
            );
            const componentesExtras = componentesConPlanExistente.filter(id =>
                !componentesConPlanGenerado.includes(id)
            );

            if (componentesFaltantes.length > 0) {
                console.log(`\n   ⚠️  Componentes en plan generado pero no en metadata:`);
                componentesFaltantes.forEach(id => {
                    const comp = componentes.find(c => c.id === id);
                    if (comp) {
                        console.log(`     - ${comp.nombre} (${planGenerado[id].length} foto(s))`);
                    }
                });
            }

            if (componentesExtras.length > 0) {
                console.log(`\n   ⚠️  Componentes en metadata pero no en plan generado:`);
                componentesExtras.forEach(id => {
                    console.log(`     - Componente ID: ${id} (${fotoPlanIA[id].length} foto(s))`);
                });
            }

            if (componentesFaltantes.length === 0 && componentesExtras.length === 0) {
                console.log(`\n   ✅ Todos los componentes coinciden`);
            }

        } else {
            console.log(`   ❌ No hay plan de fotos en metadata`);
            console.log(`   🔧 Se recomienda generar plan de fotos con IA`);
        }
        console.log();

        // 6. Verificar fotos reales en galería
        console.log('6. FOTOS REALES EN GALERÍA:');
        const { rows: fotosRows } = await pool.query(
            `SELECT COUNT(*) as total,
                    SUM(CASE WHEN estado = 'manual' THEN 1 ELSE 0 END) as manuales,
                    SUM(CASE WHEN estado = 'ia' THEN 1 ELSE 0 END) as ia,
                    SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes
             FROM galeria WHERE empresa_id = $1 AND propiedad_id = $2`,
            [empresaId, propiedadId]
        );

        const stats = fotosRows[0];
        console.log(`   Total fotos en galería: ${stats.total || 0}`);
        console.log(`   Fotos manuales: ${stats.manuales || 0}`);
        console.log(`   Fotos IA: ${stats.ia || 0}`);
        console.log(`   Fotos pendientes: ${stats.pendientes || 0}`);

        // Obtener distribución por espacio
        const { rows: fotosPorEspacio } = await pool.query(
            `SELECT espacio, COUNT(*) as cantidad
             FROM galeria WHERE empresa_id = $1 AND propiedad_id = $2
             GROUP BY espacio ORDER BY cantidad DESC`,
            [empresaId, propiedadId]
        );

        if (fotosPorEspacio.length > 0) {
            console.log(`\n   Distribución por espacio:`);
            fotosPorEspacio.slice(0, 10).forEach(row => {
                console.log(`   - ${row.espacio || 'Sin espacio'}: ${row.cantidad} foto(s)`);
            });
            if (fotosPorEspacio.length > 10) {
                console.log(`   ... y ${fotosPorEspacio.length - 10} espacios más`);
            }
        }
        console.log();

        // 7. Verificar consistencia
        console.log('7. VERIFICACIÓN DE CONSISTENCIA:');

        // Calcular baños y dormitorios
        const { numPiezas, numBanos } = contarDistribucion(componentes);

        console.log(`   Dormitorios calculados: ${numPiezas}`);
        console.log(`   Baños calculados: ${numBanos}`);

        // Verificar que cada baño tenga plan de fotos
        const banosComponentes = componentes.filter(c => {
            const tipo = (c.tipo || '').toUpperCase();
            const nombre = (c.nombre || '').toUpperCase();
            return tipo.includes('BANO') || tipo.includes('TOILET') || tipo.includes('WC') || tipo.includes('BATH') ||
                   nombre.includes('BANO') || nombre.includes('TOILET');
        });

        console.log(`   Componentes detectados como baños: ${banosComponentes.length}`);

        // Verificar plan de fotos para baños
        const banosConPlan = banosComponentes.filter(c => planGenerado[c.id]);
        console.log(`   Baños con plan de fotos: ${banosConPlan.length}/${banosComponentes.length}`);

        if (banosConPlan.length === banosComponentes.length) {
            console.log(`   ✅ Todos los baños tienen plan de fotos`);
        } else {
            console.log(`   ⚠️  Algunos baños no tienen plan de fotos`);
            banosComponentes.forEach(bano => {
                if (!planGenerado[bano.id]) {
                    console.log(`     - ${bano.nombre} NO tiene plan de fotos`);
                }
            });
        }
        console.log();

        // 8. Recomendaciones
        console.log('8. RECOMENDACIONES:');

        if (!fotoPlanIA || Object.keys(fotoPlanIA).length === 0) {
            console.log('   🔧 Generar plan de fotos con IA:');
            console.log('      1. Ir a Contenido Web → Cabaña 10');
            console.log('      2. Paso 2: Fotos');
            console.log('      3. Usar "Generar plan con IA"');
        }

        if (totalSlotsGenerados > (stats.total || 0)) {
            const faltantes = totalSlotsGenerados - (stats.total || 0);
            console.log(`   📸 Faltan ${faltantes} foto(s) según el plan generado`);
            console.log(`      Plan: ${totalSlotsGenerados} slots, Galería: ${stats.total || 0} fotos`);
        }

        // Verificar si hay componentes faltantes (definir la variable primero)
        let componentesFaltantes = [];
        let componentesExtras = [];

        if (fotoPlanIA && Object.keys(fotoPlanIA).length > 0) {
            const componentesConPlanGenerado = Object.keys(planGenerado);
            const componentesConPlanExistente = Object.keys(fotoPlanIA);

            componentesFaltantes = componentesConPlanGenerado.filter(id =>
                !componentesConPlanExistente.includes(id)
            );
            componentesExtras = componentesConPlanExistente.filter(id =>
                !componentesConPlanGenerado.includes(id)
            );

            if (componentesFaltantes.length > 0) {
                console.log(`   🔄 Actualizar metadata.fotoPlanIA con ${componentesFaltantes.length} componentes faltantes`);
            }
        }

        console.log(`\n   📊 RESUMEN FINAL:`);
        console.log(`   - Componentes: ${componentes.length}`);
        console.log(`   - Elementos totales: ${totalElementos}`);
        console.log(`   - Elementos que requieren fotos: ${elementosConFotosRequeridas}`);
        console.log(`   - Slots de fotos generados: ${totalSlotsGenerados}`);
        console.log(`   - Fotos en galería: ${stats.total || 0}`);
        console.log(`   - Plan en metadata: ${fotoPlanIA ? 'SÍ' : 'NO'}`);
        console.log(`   - Consistencia baños: ${banosConPlan.length === banosComponentes.length ? '✅' : '⚠️'}`);

    } catch (error) {
        console.error('❌ Error durante el análisis:', error.message);
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

module.exports = { analizarFotosCabana10: main };