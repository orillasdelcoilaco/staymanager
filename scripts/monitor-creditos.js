#!/usr/bin/env node
/**
 * Sistema de Monitoreo de Créditos para Claude Code
 *
 * Este script monitorea el uso aproximado de créditos basado en:
 * 1. Tiempo de sesión activa
 * 2. Número de operaciones realizadas
 * 3. Alertas cuando se aproxima a límites configurados
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class MonitorCreditos {
    constructor() {
        this.configPath = path.join(os.homedir(), '.claude', 'credit-monitor.json');
        this.config = this.cargarConfig();
        this.estadisticas = this.cargarEstadisticas();
        this.iniciarSesion();
    }

    cargarConfig() {
        const configDefault = {
            alertaBajo: 20, // Porcentaje para alerta de créditos bajos
            alertaCritico: 5, // Porcentaje para alerta crítica
            estimacionPorHora: 10, // Créditos estimados por hora de uso
            maxOperacionesPorDia: 100, // Límite estimado de operaciones por día
            notificarEnArchivo: true,
            archivoNotificacion: path.join(__dirname, '..', 'TASKS', 'alertas-creditos.md')
        };

        try {
            if (fs.existsSync(this.configPath)) {
                const configFile = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                return { ...configDefault, ...configFile };
            }
        } catch (error) {
            console.warn('No se pudo cargar configuración, usando valores por defecto:', error.message);
        }

        return configDefault;
    }

    cargarEstadisticas() {
        const statsPath = path.join(os.homedir(), '.claude', 'credit-stats.json');
        const defaultStats = {
            sesiones: [],
            operacionesHoy: 0,
            tiempoTotalHoy: 0,
            ultimaActualizacion: new Date().toISOString().split('T')[0],
            creditosEstimadosRestantes: 100 // Valor inicial
        };

        try {
            if (fs.existsSync(statsPath)) {
                const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

                // Resetear contadores diarios si es un nuevo día
                const hoy = new Date().toISOString().split('T')[0];
                if (stats.ultimaActualizacion !== hoy) {
                    stats.operacionesHoy = 0;
                    stats.tiempoTotalHoy = 0;
                    stats.ultimaActualizacion = hoy;
                }

                return { ...defaultStats, ...stats };
            }
        } catch (error) {
            console.warn('No se pudo cargar estadísticas:', error.message);
        }

        return defaultStats;
    }

    guardarEstadisticas() {
        const statsPath = path.join(os.homedir(), '.claude', 'credit-stats.json');
        try {
            fs.writeFileSync(statsPath, JSON.stringify(this.estadisticas, null, 2), 'utf8');
        } catch (error) {
            console.error('Error guardando estadísticas:', error);
        }
    }

    iniciarSesion() {
        this.sesionInicio = Date.now();
        const sesion = {
            inicio: new Date().toISOString(),
            tipo: 'claude-code',
            proyecto: path.basename(process.cwd())
        };

        this.estadisticas.sesiones.push(sesion);
        if (this.estadisticas.sesiones.length > 100) {
            this.estadisticas.sesiones = this.estadisticas.sesiones.slice(-100);
        }

        console.log('🔍 Iniciando monitor de créditos...');
        console.log(`📊 Créditos estimados restantes: ${this.estadisticas.creditosEstimadosRestantes}%`);
        this.verificarAlertas();
    }

    registrarOperacion(tipo, complejidad = 1) {
        this.estadisticas.operacionesHoy += 1;

        // Estimación basada en complejidad de operación
        const creditosConsumidos = complejidad * 0.1; // 0.1 créditos por unidad de complejidad
        this.estadisticas.creditosEstimadosRestantes = Math.max(
            0,
            this.estadisticas.creditosEstimadosRestantes - creditosConsumidos
        );

        this.guardarEstadisticas();
        this.verificarAlertas();

        return this.estadisticas.creditosEstimadosRestantes;
    }

    finalizarSesion() {
        const duracionMs = Date.now() - this.sesionInicio;
        const duracionHoras = duracionMs / (1000 * 60 * 60);

        this.estadisticas.tiempoTotalHoy += duracionHoras;

        // Estimación basada en tiempo (10 créditos por hora)
        const creditosConsumidos = duracionHoras * this.config.estimacionPorHora;
        this.estadisticas.creditosEstimadosRestantes = Math.max(
            0,
            this.estadisticas.creditosEstimadosRestantes - creditosConsumidos
        );

        this.guardarEstadisticas();
        this.verificarAlertas();

        console.log(`\n📊 Resumen de sesión:`);
        console.log(`   Duración: ${(duracionHoras * 60).toFixed(1)} minutos`);
        console.log(`   Operaciones hoy: ${this.estadisticas.operacionesHoy}`);
        console.log(`   Créditos estimados restantes: ${this.estadisticas.creditosEstimadosRestantes.toFixed(1)}%`);

        return this.estadisticas.creditosEstimadosRestantes;
    }

    verificarAlertas() {
        const creditosRestantes = this.estadisticas.creditosEstimadosRestantes;

        if (creditosRestantes <= this.config.alertaCritico) {
            this.enviarAlerta('CRÍTICO', `¡Solo queda un ${creditosRestantes.toFixed(1)}% de créditos estimados!`);
        } else if (creditosRestantes <= this.config.alertaBajo) {
            this.enviarAlerta('BAJO', `Queda un ${creditosRestantes.toFixed(1)}% de créditos estimados.`);
        }

        // Verificar límite de operaciones diarias
        if (this.estadisticas.operacionesHoy >= this.config.maxOperacionesPorDia * 0.8) {
            this.enviarAlerta('ADVERTENCIA',
                `Se han realizado ${this.estadisticas.operacionesHoy} operaciones hoy ` +
                `(${Math.round((this.estadisticas.operacionesHoy / this.config.maxOperacionesPorDia) * 100)}% del límite diario estimado).`
            );
        }
    }

    enviarAlerta(nivel, mensaje) {
        const timestamp = new Date().toISOString();
        const alerta = `[${timestamp}] [${nivel}] ${mensaje}`;

        console.log(`\n⚠️  ALERTA: ${mensaje}`);

        if (this.config.notificarEnArchivo) {
            try {
                const alertaCompleta = `## ⚠️ Alerta de Créditos - ${new Date().toLocaleString()}\n\n**Nivel:** ${nivel}\n\n**Mensaje:** ${mensaje}\n\n**Créditos estimados restantes:** ${this.estadisticas.creditosEstimadosRestantes.toFixed(1)}%\n**Operaciones hoy:** ${this.estadisticas.operacionesHoy}\n**Tiempo total hoy:** ${this.estadisticas.tiempoTotalHoy.toFixed(2)} horas\n\n---\n\n`;

                fs.appendFileSync(this.config.archivoNotificacion, alertaCompleta, 'utf8');
                console.log(`📝 Alerta registrada en: ${this.config.archivoNotificacion}`);
            } catch (error) {
                console.error('Error escribiendo alerta en archivo:', error);
            }
        }
    }

    generarReporte() {
        const hoy = new Date().toISOString().split('T')[0];
        const sesionesHoy = this.estadisticas.sesiones.filter(s =>
            s.inicio.startsWith(hoy)
        ).length;

        return {
            fecha: hoy,
            creditosEstimadosRestantes: this.estadisticas.creditosEstimadosRestantes.toFixed(1) + '%',
            operacionesHoy: this.estadisticas.operacionesHoy,
            tiempoTotalHoy: this.estadisticas.tiempoTotalHoy.toFixed(2) + ' horas',
            sesionesHoy: sesionesHoy,
            totalSesiones: this.estadisticas.sesiones.length,
            estado: this.estadisticas.creditosEstimadosRestantes <= this.config.alertaCritico ? 'CRÍTICO' :
                   this.estadisticas.creditosEstimadosRestantes <= this.config.alertaBajo ? 'BAJO' : 'NORMAL'
        };
    }

    mostrarReporte() {
        const reporte = this.generarReporte();

        console.log('\n📈 REPORTE DE CRÉDITOS');
        console.log('=' .repeat(40));
        console.log(`Fecha: ${reporte.fecha}`);
        console.log(`Estado: ${reporte.estado}`);
        console.log(`Créditos estimados restantes: ${reporte.creditosEstimadosRestantes}`);
        console.log(`Operaciones hoy: ${reporte.operacionesHoy}`);
        console.log(`Tiempo total hoy: ${reporte.tiempoTotalHoy}`);
        console.log(`Sesiones hoy: ${reporte.sesionesHoy}`);
        console.log(`Total sesiones registradas: ${reporte.totalSesiones}`);
        console.log('=' .repeat(40));

        if (reporte.estado !== 'NORMAL') {
            console.log(`\n⚠️  RECOMENDACIÓN: ${reporte.estado === 'CRÍTICO' ?
                'Considera pausar tareas no críticas y verificar tu plan de Claude Code.' :
                'Monitorea el uso de créditos para evitar interrupciones.'}`);
        }
    }
}

// Manejo de comandos CLI
if (require.main === module) {
    const monitor = new MonitorCreditos();

    const comando = process.argv[2];

    switch (comando) {
        case 'reporte':
            monitor.mostrarReporte();
            break;

        case 'operacion':
            const tipo = process.argv[3] || 'general';
            const complejidad = parseFloat(process.argv[4]) || 1;
            const creditosRestantes = monitor.registrarOperacion(tipo, complejidad);
            console.log(`Operación registrada: ${tipo} (complejidad: ${complejidad})`);
            console.log(`Créditos estimados restantes: ${creditosRestantes.toFixed(1)}%`);
            break;

        case 'finalizar':
            const creditosFinal = monitor.finalizarSesion();
            console.log(`Sesión finalizada. Créditos estimados restantes: ${creditosFinal.toFixed(1)}%`);
            break;

        case 'alerta-test':
            monitor.enviarAlerta('TEST', 'Esta es una alerta de prueba del sistema de monitoreo.');
            break;

        default:
            console.log('Uso: node monitor-creditos.js [comando]');
            console.log('\nComandos disponibles:');
            console.log('  reporte          - Mostrar reporte de créditos');
            console.log('  operacion [tipo] [complejidad] - Registrar una operación');
            console.log('  finalizar        - Finalizar sesión actual');
            console.log('  alerta-test      - Probar sistema de alertas');
            console.log('\nEjemplo:');
            console.log('  node monitor-creditos.js reporte');
            console.log('  node monitor-creditos.js operacion auditoria 2.5');
            break;
    }
}

module.exports = MonitorCreditos;