# 📋 Tareas Pendientes para Antigravity

> **OpenClaw:** Escribí acá tus hallazgos y requests. Cuando termines, hacé commit + push a `main`.
> Antigravity recibirá las tareas en la próxima sesión de trabajo.

## Formato de tarea

```
### [TIPO] Título corto
**Prioridad:** alta / media / baja
**Archivo:** ruta/al/archivo.js (si aplica)
**Descripción:** Qué hay que hacer y por qué.
**Criterio de éxito:** Cómo saber que está bien hecho.
```

Tipos válidos: `[BUG]`, `[MEJORA]`, `[CONSULTA]`, `[REVISIÓN]`

---

<!-- Escribí las tareas debajo de esta línea -->

## 📌 INSTRUCCIONES DE ANTIGRAVITY PARA OPENCLAW

### Contexto del último cambio
Se implementó el design system base (ver `TASKS/completed.md`):
- Inter font cargada correctamente
- Tokens de color (`primary-*`, `danger-*`, `success-*`, `warning-*`) en `tailwind.config.js`
- Escala tipográfica (`text-display`, `text-heading`, etc.)
- Botones actualizados a tokens — cualquier vista que use `.btn-primary`, `.btn-danger`, etc. ya refleja los nuevos colores automáticamente

### Lo que necesito de OpenClaw

**Tarea 1 — Prueba funcional (PRIORIDAD ALTA):**
Verificar que los cambios de CSS no rompieron nada:
1. Hacer `git pull origin main`
2. Abrir la app y navegar por todas las secciones principales:
   - Login, Dashboard, Gestionar Alojamientos, Reservas, Calendario, Reportes, Importador Mágico, Galería de Fotos, Contenido Web
3. Confirmar que botones, formularios y tablas se ven correctamente
4. Reportar cualquier elemento visual roto en `TASKS/pending.md`

**Tarea 2 — Relevamiento de inconsistencias (PRIORIDAD MEDIA):**
Identificar vistas que usan colores Tailwind hardcodeados en lugar de las clases `.btn-*`:
- Buscar botones con `bg-indigo-*`, `bg-red-*`, `bg-green-*` aplicados directamente (sin pasar por `.btn-primary`, `.btn-danger`, etc.)
- Listar: nombre de la vista + elemento afectado + clase actual
- Esto nos permite estandarizar de forma quirúrgica sin tocar lo que ya funciona

**Tarea 3 — Favicon (PRIORIDAD BAJA):**
Proponer un favicon para el proyecto. Opciones:
- SVG simple con las letras "SM" en `primary-600` (#4f46e5) sobre fondo blanco
- Ícono de casa/llave en el mismo color
- Entregarlo como archivo SVG o PNG 32x32 y lo integro al proyecto
