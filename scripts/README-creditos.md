# Sistema de Monitoreo de Créditos para Claude Code

## 🎯 Objetivo
Evitar que se corten procesos importantes (auditorías, builds, etc.) por agotamiento de créditos de Claude Code mediante un sistema de monitoreo y alertas.

## 📊 ¿Cómo funciona?

El sistema estima el uso de créditos basándose en:
1. **Tiempo de sesión activa** (créditos por hora estimados)
2. **Número y tipo de operaciones** (complejidad variable)
3. **Alertas configurables** (bajo/crítico)

## 🚀 Uso Rápido

### 1. Verificar estado actual:
```bash
node scripts/monitor-creditos.js reporte
```

### 2. Ejecutar auditorías con monitoreo:
```bash
# Auditoría UI con verificación previa de créditos
node scripts/hooks-creditos.js audit-ui

# Auditoría de complejidad
node scripts/hooks-creditos.js audit-complexity
```

### 3. Registrar operaciones manualmente:
```bash
# Registrar una operación simple
node scripts/monitor-creditos.js operacion general 1.0

# Registrar una auditoría (más compleja)
node scripts/monitor-creditos.js operacion auditoria 2.5
```

## 🔧 Integración con Proyecto

### Hooks Automáticos (Recomendado)
Modificar tus scripts existentes para incluir verificación:

```javascript
// En tu script existente, agregar al inicio:
const { CreditosHooks } = require('./scripts/hooks-creditos.js');
const hooks = new CreditosHooks();

// Antes de tarea larga:
if (!hooks.preAuditoria('MI_TAREA')) {
  console.log('Créditos insuficientes, abortando...');
  process.exit(1);
}

// Después de tarea:
hooks.postAuditoria('MI_TAREA', exito, duracion);
```

### Scripts Modificados
Los scripts principales del proyecto ya tienen integración:

| Script | Comando hook | Descripción |
|--------|-------------|-------------|
| `audit-ui.js` | `hooks-creditos.js audit-ui` | Verifica créditos antes de ejecutar |
| `audit-complexity.js` | `hooks-creditos.js audit-complexity` | Verifica créditos antes de ejecutar |
| `migrate-colors.js` | `hooks-creditos.js migrate-colors` | Verifica créditos antes de ejecutar |

## ⚙️ Configuración

### Archivo de configuración: `scripts/config-creditos.json`

```json
{
  "alertaBajo": 20,           // Alerta cuando quedan 20% créditos
  "alertaCritico": 5,         // Alerta crítica a 5%
  "estimacionPorHora": 10,    // 10 créditos estimados por hora
  "maxOperacionesPorDia": 100, // Límite diario estimado
  "notificarEnArchivo": true  // Guardar alertas en archivo
}
```

### Personalizar configuración:
```bash
# Copiar configuración a tu directorio personal
cp scripts/config-creditos.json ~/.claude/credit-monitor.json

# Editar configuración personal
nano ~/.claude/credit-monitor.json
```

## 📈 Alertas y Notificaciones

### Niveles de Alerta:
- **🟢 NORMAL**: > 20% créditos restantes
- **🟡 BAJO**: 5-20% créditos restantes
- **🔴 CRÍTICO**: < 5% créditos restantes

### Destinos de alerta:
1. **Consola**: Mensajes visibles durante ejecución
2. **Archivo**: `TASKS/alertas-creditos.md` (historial)
3. **Reportes**: Comando `reporte` para estado actual

## 🗂️ Archivos Generados

| Archivo | Ubicación | Contenido |
|---------|-----------|-----------|
| `credit-stats.json` | `~/.claude/` | Estadísticas históricas |
| `alertas-creditos.md` | `TASKS/` | Historial de alertas |
| `credit-monitor.json` | `~/.claude/` | Configuración personal |

## 🔄 Flujo de Trabajo Recomendado

1. **Antes de tarea larga**:
   ```bash
   node scripts/hooks-creditos.js reporte-creditos
   ```

2. **Ejecutar con monitoreo**:
   ```bash
   node scripts/hooks-creditos.js audit-ui
   ```

3. **Verificar resultado**:
   ```bash
   cat TASKS/alertas-creditos.md | tail -20
   ```

## 🛠️ Comandos Disponibles

### Monitor Principal:
```bash
node scripts/monitor-creditos.js reporte
node scripts/monitor-creditos.js operacion <tipo> <complejidad>
node scripts/monitor-creditos.js finalizar
node scripts/monitor-creditos.js alerta-test
```

### Hooks Integrados:
```bash
node scripts/hooks-creditos.js audit-ui
node scripts/hooks-creditos.js audit-complexity
node scripts/hooks-creditos.js migrate-colors
node scripts/hooks-creditos.js build-css
node scripts/hooks-creditos.js reporte-creditos
```

## ⚠️ Limitaciones

1. **Estimaciones**: Los créditos son estimados basados en tiempo/operaciones
2. **Precisión**: No accede a API real de créditos de Anthropic
3. **Reset**: Se basa en fecha local para reset diario

## 🔮 Mejoras Futuras

1. Integración con API real de Anthropic (si disponible)
2. Notificaciones por email/Slack
3. Dashboard web de monitoreo
4. Predicción de agotamiento basada en historial

---

**Nota**: Este sistema es preventivo. Aún con monitoreo, es recomendable:
- Verificar manualmente tu plan de Claude Code regularmente
- Programar tareas críticas con margen de créditos
- Mantener backup de trabajo en progreso