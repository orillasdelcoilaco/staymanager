#!/usr/bin/env node
/**
 * backend/scripts/actualizar_plan_fotos_cabana10.js
 *
 * Script para actualizar el plan de fotos en metadata
 * para que coincida con los componentes reales de Cabaña 10.
 *
 * Modos:
 *   --dry-run  : Mostrar cambios sin aplicar
 *   --apply    : Aplicar cambios a la base de datos
 *   --propiedad: Especificar propiedad (default: cabana10)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../db/postgres');
const { generarPlanFotos } = require('../services/propiedadLogicService');

// Parsear argumentos de línea de comandos
function parseArgs() {
    const args = process.argv.slice(2);
    const params = {
        dryRun: false,
        apply: false,
        propiedad: 'cabana10',
        empresaId: 'cv1Lb4HLBLvWvSyqYfRW'
    };

    args.forEach(arg => {
        if (arg === '--dry-run') {
            params.dryRun = true;
        } else if (arg === '--apply') {
            params.apply = true;
        } else if (arg.startsWith('--propiedad=')) {
            params.propiedad = arg.split('=')[1];
        } else if (arg.startsWith('--empresa=')) {
            params.empresaId = arg.split('=')[1];
        } else if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        }
    });

    // Validar que no estén ambos modos
    if (params.dryRun && params.apply) {
        console.error('❌ Error: No se pueden usar --dry-run y --apply juntos');
        process.exit(1);
    }

    // Por defecto, usar dry-run si no se especifica
    if (!params.dryRun && !params.apply) {
        params.dryRun = true;
        console.log('⚠️  Modo por defecto: --dry-run (use --apply para aplicar cambios)');
    }

    return params;
}

function showHelp() {
    console.log(`
📸 Actualizar Plan de Fotos - Cabaña 10

Uso:
  node backend/scripts/actualizar_plan_fotos_cabana10.js [OPCIONES]

Opciones:
  --dry-run               Mostrar cambios sin aplicar (por defecto)
  --apply                 Aplicar cambios a la base de datos
  --propiedad=ID          Especificar propiedad (default: cabana10)
  --empresa=ID            Especificar empresa (default: cv1Lb4HLBLvWvSyqYfRW)
  --help, -h              Mostrar esta ayuda

Ejemplos:
  # Mostrar cambios para Cabaña 10
  node backend/scripts/actualizar_plan_fotos_cabana10.js --dry-run

  # Aplicar cambios para Cabaña 10
  node backend/scripts/actualizar_plan_fotos_cabana10.js --apply

  # Mostrar cambios para otra propiedad
  node backend/scripts/actualizar_plan_fotos_cabana10.js --propiedad=cabana9 --dry-run
`);
}

async function main() {
    const params = parseArgs();

    console.log(`=== ACTUALIZACIÓN DE PLAN DE FOTOS ===\n`);
    console.log(`Propiedad: ${params.propiedad}`);
    console.log(`Empresa: ${params.empresaId}`);
    console.log(`Modo: ${params.dryRun ? 'DRY-RUN (solo mostrar cambios)' : 'APPLY (aplicar cambios)'}`);
    console.log(`Fecha: ${new Date().toISOString()}\n`);

    try {
        // 1. Verificar conexión a PostgreSQL
        if (!pool) {
            console.error('❌ No hay conexión a PostgreSQL (pool es null)');
            console.error('   Verifique que DATABASE_URL esté configurada en .env');
            process.exit(1);
        }

        // 2. Obtener datos actuales de la propiedad
        console.log('1. OBTENIENDO DATOS ACTUALES:');
        const { rows: propRows } = await pool.query(
            `SELECT nombre, metadata FROM propiedades
             WHERE id = $1 AND empresa_id = $2`,
            [params.propiedad, params.empresaId]
        );

        if (!propRows[0]) {
            console.error(`❌ Propiedad no encontrada: ${params.propiedad}`);
            process.exit(1);
        }

        const propiedad = propRows[0];
        const meta = propiedad.metadata || {};
        const componentes = meta.componentes || [];
        const fotoPlanIAActual = meta.fotoPlanIA || {};

        console.log(`   Nombre: ${propiedad.nombre}`);
        console.log(`   Componentes: ${componentes.length}`);
        console.log(`   Plan de fotos actual: ${Object.keys(fotoPlanIAActual).length} componentes`);
        console.log(`   Slots actuales: ${Object.values(fotoPlanIAActual).reduce((sum, shots) => sum + shots.length, 0)}\n`);

        // 3. Obtener tipos de elemento
        console.log('2. OBTENIENDO TIPOS DE ELEMENTO:');
        const { rows: tiposRows } = await pool.query(
            `SELECT id, nombre, requires_photo, photo_quantity, photo_guidelines,
                    schema_property, sales_context
             FROM tipos_elemento WHERE empresa_id = $1`,
            [params.empresaId]
        );

        console.log(`   Tipos de elemento: ${tiposRows.length}`);
        console.log(`   Tipos que requieren fotos: ${tiposRows.filter(t => t.requires_photo).length}\n`);

        // 4. Generar nuevo plan de fotos
        console.log('3. GENERANDO NUEVO PLAN DE FOTOS:');
        const nuevoPlan = generarPlanFotos(componentes, [], tiposRows);

        const totalSlotsNuevo = Object.values(nuevoPlan).reduce((sum, shots) => sum + shots.length, 0);
        console.log(`   Componentes con plan: ${Object.keys(nuevoPlan).length}`);
        console.log(`   Slots en nuevo plan: ${totalSlotsNuevo}\n`);

        // 5. Comparar planes
        console.log('4. COMPARACIÓN PLAN ACTUAL vs NUEVO:');

        const componentesActuales = Object.keys(fotoPlanIAActual);
        const componentesNuevos = Object.keys(nuevoPlan);

        // Componentes que están en nuevo pero no en actual
        const componentesFaltantes = componentesNuevos.filter(id =>
            !componentesActuales.includes(id)
        );

        // Componentes que están en actual pero no en nuevo (obsoletos)
        const componentesObsoletos = componentesActuales.filter(id =>
            !componentesNuevos.includes(id)
        );

        // Componentes que están en ambos pero con diferencias
        const componentesModificados = componentesNuevos.filter(id =>
            componentesActuales.includes(id)
        ).filter(id => {
            const planActual = JSON.stringify(fotoPlanIAActual[id] || []);
            const planNuevo = JSON.stringify(nuevoPlan[id] || []);
            return planActual !== planNuevo;
        });

        console.log(`   Componentes faltantes: ${componentesFaltantes.length}`);
        console.log(`   Componentes obsoletos: ${componentesObsoletos.length}`);
        console.log(`   Componentes modificados: ${componentesModificados.length}\n`);

        // 6. Mostrar detalles de cambios
        if (componentesFaltantes.length > 0) {
            console.log('   📋 COMPONENTES FALTANTES:');
            componentesFaltantes.forEach(id => {
                const componente = componentes.find(c => c.id === id);
                const slots = nuevoPlan[id].length;
                console.log(`     - ${componente?.nombre || id}: ${slots} foto(s)`);
            });
            console.log();
        }

        if (componentesObsoletos.length > 0) {
            console.log('   🗑️  COMPONENTES OBSOLETOS (serán eliminados):');
            componentesObsoletos.forEach(id => {
                const slots = fotoPlanIAActual[id].length;
                console.log(`     - ${id}: ${slots} foto(s) (ID no existe en componentes)`);
            });
            console.log();
        }

        if (componentesModificados.length > 0) {
            console.log('   🔄 COMPONENTES MODIFICADOS:');
            componentesModificados.forEach(id => {
                const componente = componentes.find(c => c.id === id);
                const slotsActual = fotoPlanIAActual[id].length;
                const slotsNuevo = nuevoPlan[id].length;
                console.log(`     - ${componente?.nombre || id}:`);
                console.log(`       Actual: ${slotsActual} foto(s) → Nuevo: ${slotsNuevo} foto(s)`);
            });
            console.log();
        }

        // 7. Resumen de cambios
        console.log('5. RESUMEN DE CAMBIOS:');

        const slotsActual = Object.values(fotoPlanIAActual).reduce((sum, shots) => sum + shots.length, 0);
        const slotsNuevo = totalSlotsNuevo;
        const diferenciaSlots = slotsNuevo - slotsActual;

        console.log(`   Slots actuales: ${slotsActual}`);
        console.log(`   Slots nuevos: ${slotsNuevo}`);
        console.log(`   Diferencia: ${diferenciaSlots > 0 ? '+' : ''}${diferenciaSlots}\n`);

        // 8. Aplicar cambios si estamos en modo apply
        if (params.apply) {
            console.log('6. APLICANDO CAMBIOS A LA BASE DE DATOS:');

            // Crear backup del plan actual
            const backup = {
                fecha: new Date().toISOString(),
                propiedad: params.propiedad,
                empresa: params.empresaId,
                planAnterior: fotoPlanIAActual,
                planNuevo: nuevoPlan,
                cambios: {
                    componentesFaltantes,
                    componentesObsoletos,
                    componentesModificados,
                    slotsActual,
                    slotsNuevo,
                    diferenciaSlots
                }
            };

            console.log(`   ✅ Backup creado en memoria`);

            // Actualizar metadata
            const metadataActualizada = {
                ...meta,
                fotoPlanIA: nuevoPlan
            };

            // Actualizar en PostgreSQL
            const { rowCount } = await pool.query(
                `UPDATE propiedades
                 SET metadata = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2 AND empresa_id = $3`,
                [metadataActualizada, params.propiedad, params.empresaId]
            );

            if (rowCount === 1) {
                console.log(`   ✅ Metadata actualizada correctamente`);
                console.log(`   ✅ ${componentesFaltantes.length} componentes agregados`);
                console.log(`   ✅ ${componentesObsoletos.length} componentes eliminados`);
                console.log(`   ✅ ${componentesModificados.length} componentes modificados`);
                console.log(`   ✅ Total slots: ${slotsActual} → ${slotsNuevo} (+${diferenciaSlots})`);
            } else {
                console.error(`❌ Error: No se pudo actualizar la propiedad`);
                process.exit(1);
            }

            // 9. Verificar cambios aplicados
            console.log('\n7. VERIFICANDO CAMBIOS APLICADOS:');
            const { rows: propRowsVerificacion } = await pool.query(
                `SELECT metadata FROM propiedades
                 WHERE id = $1 AND empresa_id = $2`,
                [params.propiedad, params.empresaId]
            );

            const metaVerificada = propRowsVerificacion[0].metadata || {};
            const fotoPlanIAVerificada = metaVerificada.fotoPlanIA || {};

            const slotsVerificados = Object.values(fotoPlanIAVerificada).reduce((sum, shots) => sum + shots.length, 0);
            const componentesVerificados = Object.keys(fotoPlanIAVerificada).length;

            console.log(`   Componentes en metadata: ${componentesVerificados}`);
            console.log(`   Slots en metadata: ${slotsVerificados}`);

            if (componentesVerificados === Object.keys(nuevoPlan).length &&
                slotsVerificados === slotsNuevo) {
                console.log(`   ✅ Verificación exitosa: metadata coincide con plan generado`);
            } else {
                console.error(`❌ Error en verificación: metadata no coincide`);
                console.error(`   Esperado: ${Object.keys(nuevoPlan).length} componentes, ${slotsNuevo} slots`);
                console.error(`   Obtenido: ${componentesVerificados} componentes, ${slotsVerificados} slots`);
            }

        } else {
            // Modo dry-run
            console.log('6. MODO DRY-RUN - NO SE APLICARON CAMBIOS');
            console.log('\n   Para aplicar estos cambios, ejecute:');
            console.log(`   node backend/scripts/actualizar_plan_fotos_cabana10.js --apply`);

            if (componentesFaltantes.length > 0 || componentesObsoletos.length > 0) {
                console.log('\n   📋 Resumen de cambios pendientes:');
                console.log(`   - Agregar ${componentesFaltantes.length} componentes`);
                console.log(`   - Eliminar ${componentesObsoletos.length} componentes obsoletos`);
                console.log(`   - Modificar ${componentesModificados.length} componentes`);
                console.log(`   - Total slots: ${slotsActual} → ${slotsNuevo} (+${diferenciaSlots})`);
            }
        }

        // 10. Recomendaciones finales
        console.log('\n8. RECOMENDACIONES:');

        if (slotsNuevo > slotsActual) {
            const fotosFaltantes = slotsNuevo - (await getFotosEnGaleria(params.empresaId, params.propiedad));
            if (fotosFaltantes > 0) {
                console.log(`   📸 Faltan ${fotosFaltantes} foto(s) según el nuevo plan`);
                console.log(`      Plan: ${slotsNuevo} slots, Galería: ${await getFotosEnGaleria(params.empresaId, params.propiedad)} fotos`);
            }
        }

        if (params.apply) {
            console.log(`\n🎉 ¡CORRECCIÓN APLICADA EXITOSAMENTE!`);
            console.log(`   El plan de fotos ahora tiene ${slotsNuevo} slots`);
            console.log(`   (antes tenía ${slotsActual} slots)`);

            console.log(`\n🔍 Para verificar:`);
            console.log(`   node backend/scripts/analizar_fotos_cabana10.js`);
        } else {
            console.log(`\n🔍 Para ver cambios detallados:`);
            console.log(`   node backend/scripts/analizar_fotos_cabana10.js`);
        }

    } catch (error) {
        console.error('❌ Error durante la actualización:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Función auxiliar para obtener fotos en galería
async function getFotosEnGaleria(empresaId, propiedadId) {
    try {
        const { rows } = await pool.query(
            `SELECT COUNT(*) as total FROM galeria
             WHERE empresa_id = $1 AND propiedad_id = $2`,
            [empresaId, propiedadId]
        );
        return parseInt(rows[0].total) || 0;
    } catch (error) {
        console.error('   ⚠️  No se pudo obtener fotos de galería:', error.message);
        return 0;
    }
}

// Ejecutar si es el script principal
if (require.main === module) {
    main().catch(error => {
        console.error('Error fatal:', error);
        process.exit(1);
    });
}

module.exports = { actualizarPlanFotosCabana10: main };