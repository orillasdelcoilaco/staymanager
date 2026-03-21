# Tarea: Implementar UI profesional y coherente

**Fecha:** 2026‑03‑20  
**Autor:** Inspector (OpenClaw QA/Diseñador)  
**Prioridad:** Alta  
**Estado:** Pendiente  

---

## Contexto
Se completó una auditoría de coherencia de UI y stack técnico (ver `TASKS/completed.md`). Los hallazgos principales son:

1. **Botones inconsistentes**: Mix de clases CSS (`btn‑primary`) con Tailwind directo.
2. **Paleta de colores no unificada**: Variables CSS definidas pero no usadas consistentemente.
3. **Tipografía**: Aunque se usa Inter globalmente, no hay escala tipográfica definida.
4. **Componentes mezclados**: shadcn/ui junto con componentes personalizados sin estandarización.
5. **Código frontend**: Se encontró Chart.js duplicado (ya corregido).

El objetivo es transformar la UI actual en una interfaz profesional, coherente y lista para producción.

---

## Objetivo
Crear una experiencia de usuario visualmente cohesiva y profesional en todo el software staymanager, alineada con estándares modernos de SaaS de reservas.

---

## Entregables específicos

### 1. Estandarización de botones
- **Problema**: Inconsistencias entre `btn‑primary` (CSS) y clases Tailwind ad‑hoc.
- **Solución**: Elegir una única estrategia (recomendado: usar **shadcn/ui Button** en todo el proyecto) y eliminar estilos CSS personalizados redundantes.
- **Criterios**: Todos los botones deben tener:
  - Mismos tamaños (`sm`, `md`, `lg`)
  - Mismos colores (`primary`, `secondary`, `destructive`, `outline`, `ghost`)
  - Mismos estados (hover, active, disabled)
  - Mismas transiciones y bordes redondeados

### 2. Paleta de colores unificada
- **Problema**: Variables CSS (`--primary`, `--secondary`, etc.) definidas pero no usadas consistentemente.
- **Solución**: 
  - Definir una paleta completa en `tailwind.config.js`
  - Asegurar que todos los componentes usen tokens de color de Tailwind (ej. `bg‑primary`, `text‑secondary‑foreground`)
  - Eliminar colores hardcodeados (`#123456`, `rgb(...)`)
- **Criterios**: Máximo 8 colores base con variantes claras/oscuras para cada uno.

### 3. Sistema tipográfico
- **Problema**: Inter está cargado pero no hay escala tipográfica definida.
- **Solución**:
  - Definir en `tailwind.config.js` una escala coherente (h1‑h6, body, caption)
  - Asegurar que todos los textos usen clases Tailwind (`text‑xl`, `text‑lg`, etc.)
- **Criterios**: Jerarquía visual clara, proporciones áureas o escala modular.

### 4. Componentes reutilizables
- **Problema**: Mix de shadcn/ui con componentes personalizados.
- **Solución**:
  - Identificar componentes que se repiten (cards, headers, modales, forms)
  - Crear versiones estandarizadas usando shadcn/ui como base
  - Documentar en `/components/ui/README.md` cómo usarlos
- **Criterios**: Reducción de código duplicado, API consistente para props.

### 5. Coherencia visual global
- **Problema**: Diferentes bordes redondeados, sombras, espaciados entre secciones.
- **Solución**:
  - Definir tokens de diseño en `tailwind.config.js` (borderRadius, boxShadow, spacing)
  - Revisar cada página y ajustar a los tokens
- **Criterios**: Mismas esquinas redondeadas, mismas sombras, espaciado consistente.

---

## Stack técnico (confirmado)
- **Framework**: Next.js 15
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS
- **Componentes**: shadcn/ui
- **Base de datos**: PostgreSQL + Prisma
- **Autenticación**: Clerk
- **Pagos**: Stripe
- **Email**: Resend

---

## Flujo de trabajo
1. **Antigravity** implementa estos cambios y hace push a `main`.
2. **Inspector** (OpenClaw) monitorea `completed.md` cada 15 min vía cron job.
3. **Inspector** prueba la implementación y reporta problemas a `pending.md`.
4. **Inspector** notifica via ntfy (`staymanager‑pablo‑tareas`) sobre tareas pendientes.
5. Se repite hasta que todos los entregables estén completos y aprobados.
6. **Inspector** avisa a Pablo por Telegram cuando la UI esté lista.

---

## Notas
- Priorizar **botones y colores** primero (impacto visual más alto).
- Mantener la funcionalidad existente intacta.
- Seguir principios de diseño accesible (contraste, focos, etiquetas).
- Documentar cambios en `CHANGELOG.md`.

---

**🔔 Notificación ntfy:** `staymanager‑pablo‑tareas`  
**Repositorio:** https://github.com/orillasdelcoilaco/staymanager  
**Equipo:** Pablo (PO), Inspector (QA/Diseño), Antigravity (Claude Code, implementación)