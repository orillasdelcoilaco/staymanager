#!/usr/bin/env node
/**
 * Hooks para integración del monitor de créditos con tareas comunes
 *
 * Este script proporciona funciones para integrar el monitor de créditos
 * con auditorías, builds y otras tareas del proyecto.
 */

const { execSync } = require('child_process');
const path = require('path');
const MonitorCreditos = require('./monitor-creditos.js');

class CreditosHooks {
    constructor() {
        this.monitor = new MonitorCreditos();
        this.tareasCriticas = [
            'audit-ui.js',
            'audit-complexity.js',
            'migrate-colors.js',
            'build',
            'test',
            'deploy'
        ];
    }

    /**
     * Ejecutar una tarea con monitoreo de créditos
     */
    ejecutarConMonitoreo(tarea, args = []) {
        console.log(`🚀 Iniciando tarea con monitoreo: ${tarea}`);

        // Registrar inicio de tarea crítica
        const esCritica = this.tareasCriticas.some(t => tarea.includes(t));
        const complejidad = esCritica ? 2.0 : 1.0;

        this.monitor.registrarOperacion(`tarea-${tarea}`, complejidad);

        try {
            // Ejecutar la tarea
            const comando = `node ${tarea} ${args.join(' ')}`;
            console.log(`📝 Ejecutando: ${comando}`);

            const inicio = Date.now();
            const resultado = execSync(comando, {
                encoding: 'utf8',
                stdio: 'inherit',
                cwd: process.cwd()
            });
            const duracion = (Date.now() - inicio) / 1000;

            console.log(`✅ Tarea completada en ${duracion.toFixed(1)} segundos`);

            // Registrar finalización con tiempo
            this.monitor.registrarOperacion(`tarea-${tarea}-completada`, 0.5);

            return { exito: true, duracion, resultado };

        } catch (error) {
            console.error(`❌ Error en tarea ${tarea}:`, error.message);

            // Registrar error (consumió créditos igualmente)
            this.monitor.registrarOperacion(`tarea-${tarea}-error`, 0.3);

            return { exito: false, error: error.message };
        }
    }

    /**
     * Hook para ejecutar antes de auditorías
     */
    preAuditoria(tipoAuditoria) {
        console.log(`\n🔍 PRE-AUDITORÍA ${tipoAuditoria.toUpperCase()}`);
        console.log('=' .repeat(50));

        const reporte = this.monitor.generarReporte();

        if (reporte.estado === 'CRÍTICO') {
            console.log('⛔ CRÉDITOS CRÍTICOS - Considera posponer esta auditoría');
            console.log('Créditos estimados restantes:', reporte.creditosEstimadosRestantes);
            return false;
        }

        if (reporte.estado === 'BAJO') {
            console.log('⚠️  CRÉDITOS BAJOS - Auditoría puede ser interrumpida');
            console.log('Créditos estimados restantes:', reporte.creditosEstimadosRestantes);
        } else {
            console.log('✅ Estado de créditos: NORMAL');
            console.log('Créditos estimados restantes:', reporte.creditosEstimadosRestantes);
        }

        console.log('=' .repeat(50));
        return true;
    }

    /**
     * Hook para ejecutar después de auditorías
     */
    postAuditoria(tipoAuditoria, exito, duracionSegundos) {
        console.log(`\n📊 POST-AUDITORÍA ${tipoAuditoria.toUpperCase()}`);
        console.log('=' .repeat(50));

        const creditosUsados = (duracionSegundos / 3600) * this.monitor.config.estimacionPorHora;
        console.log(`Duración: ${duracionSegundos.toFixed(1)} segundos`);
        console.log(`Créditos estimados usados: ~${creditosUsados.toFixed(2)}`);
        console.log(`Resultado: ${exito ? '✅ ÉXITO' : '❌ FALLÓ'}`);

        this.monitor.mostrarReporte();
        console.log('=' .repeat(50));
    }

    /**
     * Verificar créditos antes de tarea larga
     */
    verificarAntesDeTareaLarga(nombreTarea, estimacionHoras = 1) {
        const reporte = this.monitor.generarReporte();
        const creditosNecesarios = estimacionHoras * this.monitor.config.estimacionPorHora;
        const creditosDisponibles = parseFloat(reporte.creditosEstimadosRestantes);

        console.log(`\n🔍 VERIFICACIÓN PARA: ${nombreTarea}`);
        console.log('=' .repeat(50));
        console.log(`Estimación: ${estimacionHoras} hora(s)`);
        console.log(`Créditos necesarios estimados: ~${creditosNecesarios.toFixed(1)}`);
        console.log(`Créditos disponibles estimados: ~${creditosDisponibles.toFixed(1)}`);

        if (creditosDisponibles < creditosNecesarios * 2) {
            console.log(`⚠️  ADVERTENCIA: Créditos insuficientes para margen de seguridad`);
            console.log(`   (Se recomienda tener al menos el doble de créditos necesarios)`);
            return false;
        }

        if (creditosDisponibles < creditosNecesarios) {
            console.log(`⛔ BLOQUEADO: Créditos insuficientes`);
            return false;
        }

        console.log(`✅ APROBADO: Suficientes créditos disponibles`);
        console.log('=' .repeat(50));
        return true;
    }

    /**
     * Integración con scripts existentes del proyecto
     */
    integrarConScripts() {
        const scripts = {
            'audit-ui': () => {
                if (this.preAuditoria('UI')) {
                    const inicio = Date.now();
                    const resultado = this.ejecutarConMonitoreo('scripts/audit-ui.js');
                    const duracion = (Date.now() - inicio) / 1000;
                    this.postAuditoria('UI', resultado.exito, duracion);
                }
            },

            'audit-complexity': () => {
                if (this.preAuditoria('COMPLEJIDAD')) {
                    const inicio = Date.now();
                    const resultado = this.ejecutarConMonitoreo('scripts/audit-complexity.js');
                    const duracion = (Date.now() - inicio) / 1000;
                    this.postAuditoria('COMPLEJIDAD', resultado.exito, duracion);
                }
            },

            'migrate-colors': () => {
                console.log('🎨 Ejecutando migración de colores con monitoreo...');
                if (this.verificarAntesDeTareaLarga('Migración de Colores', 0.5)) {
                    this.ejecutarConMonitoreo('scripts/migrate-colors.js');
                }
            },

            'build-css': () => {
                console.log('🛠️  Ejecutando build CSS con monitoreo...');
                this.ejecutarConMonitoreo('backend/package.json', ['run', 'build']);
            },

            'reporte-creditos': () => {
                this.monitor.mostrarReporte();
            }
        };

        return scripts;
    }
}

// CLI para hooks
if (require.main === module) {
    const hooks = new CreditosHooks();
    const scripts = hooks.integrarConScripts();

    const comando = process.argv[2];

    if (scripts[comando]) {
        scripts[comando]();
    } else {
        console.log('Uso: node hooks-creditos.js [comando]');
        console.log('\nComandos disponibles:');
        console.log('  audit-ui          - Ejecutar auditoría UI con monitoreo');
        console.log('  audit-complexity  - Ejecutar auditoría de complejidad con monitoreo');
        console.log('  migrate-colors    - Ejecutar migración de colores con monitoreo');
        console.log('  build-css         - Ejecutar build CSS con monitoreo');
        console.log('  reporte-creditos  - Mostrar reporte de créditos');
        console.log('\nEjemplo:');
        console.log('  node hooks-creditos.js audit-ui');
    }
}

module.exports = CreditosHooks;