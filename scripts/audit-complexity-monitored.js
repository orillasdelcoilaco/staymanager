#!/usr/bin/env node
/**
 * Wrapper para auditoría de complejidad con monitoreo de créditos
 *
 * Ejecuta la auditoría de complejidad normal pero con verificación previa
 * de créditos y registro de uso.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Cargar monitor de créditos
try {
    const MonitorCreditos = require('./monitor-creditos.js');
    const monitor = new MonitorCreditos();
    global.monitor = monitor; // Hacer disponible globalmente

    console.log('🔍 INICIANDO AUDITORÍA DE COMPLEJIDAD CON MONITOREO DE CRÉDITOS');
    console.log('=' .repeat(60));

    // Verificar créditos antes de empezar
    const reporte = monitor.generarReporte();

    if (reporte.estado === 'CRÍTICO') {
        console.log('⛔ CRÉDITOS CRÍTICOS - Auditoría de complejidad cancelada');
        console.log(`Créditos estimados restantes: ${reporte.creditosEstimadosRestantes}`);
        console.log('Recomendación: Verifica tu plan de Claude Code antes de continuar');
        process.exit(1);
    }

    if (reporte.estado === 'BAJO') {
        console.log('⚠️  ADVERTENCIA: Créditos bajos');
        console.log(`Créditos estimados restantes: ${reporte.creditosEstimadosRestantes}`);
        console.log('La auditoría puede ser interrumpida si se agotan los créditos');

        // Preguntar confirmación
        console.log('\n¿Continuar con la auditoría? (s/n)');
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('> ', (respuesta) => {
            rl.close();
            if (respuesta.toLowerCase() !== 's') {
                console.log('Auditoría cancelada por el usuario');
                process.exit(0);
            }
            ejecutarAuditoria();
        });

        return;
    }

    console.log('✅ Estado de créditos: NORMAL');
    console.log(`Créditos estimados restantes: ${reporte.creditosEstimadosRestantes}`);
    ejecutarAuditoria();

} catch (error) {
    console.warn('⚠️  No se pudo cargar monitor de créditos, ejecutando auditoría normal');
    console.warn(`Error: ${error.message}`);
    ejecutarAuditoria();
}

function ejecutarAuditoria() {
    console.log('\n' + '=' .repeat(60));
    console.log('🚀 Ejecutando auditoría de complejidad...');
    console.log('=' .repeat(60) + '\n');

    const inicio = Date.now();

    try {
        // Registrar operación de auditoría (alta complejidad)
        if (global.monitor) {
            global.monitor.registrarOperacion('auditoria-complejidad', 2.5);
        }

        // Ejecutar auditoría original
        const resultado = execSync('node scripts/audit-complexity.js', {
            encoding: 'utf8',
            stdio: 'inherit',
            cwd: process.cwd()
        });

        const duracion = (Date.now() - inicio) / 1000;

        console.log('\n' + '=' .repeat(60));
        console.log(`✅ AUDITORÍA DE COMPLEJIDAD COMPLETADA EN ${duracion.toFixed(1)} SEGUNDOS`);

        // Registrar finalización
        if (global.monitor) {
            global.monitor.registrarOperacion('auditoria-complejidad-completada', 0.5);

            // Mostrar reporte actualizado
            console.log('\n📊 REPORTE DE CRÉDITOS ACTUALIZADO:');
            const reporte = global.monitor.generarReporte();
            console.log(`Créditos estimados restantes: ${reporte.creditosEstimadosRestantes}`);
            console.log(`Estado: ${reporte.estado}`);

            if (reporte.estado !== 'NORMAL') {
                console.log(`\n⚠️  RECOMENDACIÓN: ${reporte.estado === 'CRÍTICO' ?
                    'Considera verificar tu plan de Claude Code antes de más tareas.' :
                    'Monitorea el uso de créditos para evitar interrupciones.'}`);
            }
        }

        console.log('=' .repeat(60));

    } catch (error) {
        const duracion = (Date.now() - inicio) / 1000;

        console.log('\n' + '=' .repeat(60));
        console.log(`❌ AUDITORÍA DE COMPLEJIDAD FALLÓ DESPUÉS DE ${duracion.toFixed(1)} SEGUNDOS`);
        console.log(`Error: ${error.message}`);

        // Registrar error
        if (global.monitor) {
            global.monitor.registrarOperacion('auditoria-complejidad-error', 1.0);
        }

        console.log('=' .repeat(60));
        process.exit(1);
    }
}

// Exportar para uso en otros scripts
module.exports = { ejecutarAuditoria };