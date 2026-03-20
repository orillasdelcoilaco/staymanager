# TEAM_CONFIG — Configuración del equipo SuiteManager

> Documento de referencia técnica para el equipo.
> **No incluye valores reales** — solo nombres de variables y estructura.

---

## Repositorio

| Campo | Valor |
|-------|-------|
| URL | `https://github.com/orillasdelcoilaco/staymanager` |
| Visibilidad | Privado |
| Rama principal | `main` |
| Owner | Pablo (orillasdelcoilaco) |

---

## Roles del equipo

| Rol | Herramienta | Acceso al repo | Responsabilidad |
|-----|-------------|----------------|-----------------|
| Pablo | — | Admin | Decisiones finales, aprobación de costos, iniciar sesiones de trabajo |
| Antigravity | Claude Code (VSCode) | Lectura + escritura | Implementar código, revisar tareas, hacer commits/push |
| OpenClaw | Claude Code (otro equipo) | Lectura + pull request | QA, revisión, escribir tareas en `TASKS/pending.md` |

---

## Sistema de tareas (TASKS/)

### Estructura de archivos

```
TASKS/
  pending.md     ← OpenClaw escribe acá
  completed.md   ← Antigravity escribe acá
  archive/       ← Tareas cerradas (mover manualmente cuando el ciclo cierra)
```

### Flujo completo

```
1. OpenClaw detecta bug/mejora
        ↓
2. Edita TASKS/pending.md → commit + push a main
        ↓
3. GitHub Action [notify-pending] → email a Pablo
        ↓
4. Pablo abre Claude Code y escribe "revisar tareas pendientes"
        ↓
5. Antigravity lee pending.md → implementa → actualiza completed.md → push
        ↓
6. GitHub Action [notify-completed] → email a Pablo
        ↓
7. Pablo avisa a OpenClaw (o OpenClaw hace git pull y ve completed.md)
        ↓
8. OpenClaw revisa → si hay más trabajo, vuelve al paso 1
```

---

## GitHub Actions configurados

| Workflow | Archivo | Disparador | Acción |
|----------|---------|------------|--------|
| Notificar nueva tarea | `.github/workflows/notify-tasks.yml` | Push a `TASKS/pending.md` | Email a Pablo |
| Notificar tarea completada | `.github/workflows/notify-completed.yml` | Push a `TASKS/completed.md` | Email a Pablo |

### Secrets requeridos en GitHub

Configurar en: `Settings → Secrets and variables → Actions`

| Secret | Propósito |
|--------|-----------|
| `MAIL_USERNAME` | Email de Gmail que envía las notificaciones |
| `MAIL_PASSWORD` | Contraseña de aplicación de Gmail (no la contraseña real) |

**Cómo crear la contraseña de aplicación:**
Google Account → Seguridad → Verificación en 2 pasos → Contraseñas de aplicación → Nueva → nombre: "GitHub Actions"

---

## Formato de tareas en pending.md

```markdown
### [TIPO] Título corto
**Prioridad:** alta / media / baja
**Archivo:** ruta/al/archivo.js (si aplica)
**Descripción:** Qué hay que hacer y por qué.
**Criterio de éxito:** Cómo saber que está bien hecho.
```

Tipos válidos: `[BUG]`, `[MEJORA]`, `[CONSULTA]`, `[REVISIÓN]`

---

## Formato de entradas en completed.md

Antigravity agrega entradas al principio del archivo con este formato:

```markdown
### ✅ YYYY-MM-DD — Título de la tarea
**Archivos modificados:** lista de archivos
**Qué se hizo:** descripción breve
**Commit:** hash del commit
**Para OpenClaw:** instrucciones de testing si aplica
```

---

## Cómo OpenClaw monitorea completed.md

OpenClaw puede verificar si hay cambios nuevos ejecutando:

```bash
git pull origin main
git log --oneline -5 -- TASKS/completed.md
```

O simplemente revisar la pestaña **Commits** en GitHub después de recibir notificación de Pablo.

---

## Variables de entorno del proyecto (nombres únicamente)

| Variable | Usado en | Propósito |
|----------|----------|-----------|
| `FIREBASE_SERVICE_ACCOUNT` | Backend (Render) | Credenciales Firebase Admin |
| `GEMINI_API_KEY` | Backend | Google Gemini Vision / AI |
| `PORT` | Backend | Puerto del servidor (default 3001) |
| `RENDER` | Backend | Flag para detectar entorno de producción |

Estos valores viven en:
- **Local:** `backend/.env` (ignorado por git)
- **Producción:** Variables de entorno en Render Dashboard

---

## Costos actuales

| Servicio | Plan | Costo |
|----------|------|-------|
| GitHub Actions | Free tier | $0 (2000 min/mes para repos privados) |
| Render (backend) | Free/Starter | Según plan activo |
| Firebase/Firestore | Spark/Blaze | Según uso |
| Google Gemini API | Pay-per-use | Según llamadas del importer |

> Cualquier cambio que genere costo requiere aprobación explícita de Pablo.
