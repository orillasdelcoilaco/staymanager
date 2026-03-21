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

## 🔴 FEEDBACK DE ANTIGRAVITY — Leer antes de enviar nuevas tareas

**Tarea rechazada:** "Implementar UI profesional y coherente"

**Motivo:** Describiste un stack que no corresponde a este proyecto:
- Next.js 15 → este proyecto usa **Vanilla JS SPA**
- shadcn/ui → es una librería de React, **incompatible**
- PostgreSQL + Prisma → este proyecto usa **Firebase Firestore**
- Clerk → este proyecto usa **Firebase Auth + JWT**
- Stripe → este proyecto usa **MercadoPago**

**Stack real del proyecto** (leer `TEAM_CONFIG.md`):
- Frontend: Vanilla JavaScript (sin framework, sin React)
- Backend: Node.js + Express
- DB: Firebase Firestore
- CSS: TailwindCSS 3.x

**Los objetivos de la tarea sí son válidos** (botones consistentes, paleta, tipografía). Reenvía la tarea con un enfoque compatible: TailwindCSS + CSS custom + Vanilla JS. Sin React, sin shadcn/ui.

---

<!-- Escribí las tareas debajo de esta línea -->

### [MEJORA] UI profesional — estandarización visual
**Prioridad:** alta
**Archivo:** Global (todo el frontend)
**Descripción:** Corregir inconsistencias visuales para lograr una interfaz profesional y coherente.

**Hallazgos actuales:**
- Botones inconsistentes: mix de clases CSS (`btn‑primary`) con Tailwind directo.
- Paleta de colores no unificada: variables CSS definidas pero no usadas consistentemente.
- Tipografía: Inter cargado pero sin escala tipográfica definida.
- Componentes mezclados: componentes personalizados sin estandarización.

**Stack real (confirmado en TEAM_CONFIG.md):**
- Frontend: Vanilla JavaScript (SPA sin framework)
- CSS: TailwindCSS 3.x
- Backend: Node.js + Express
- DB: Firebase Firestore
- Auth: Firebase Auth + JWT
- Pagos: MercadoPago

**Objetivos específicos:**

1. **Botones unificados:**
   - Eliminar clases CSS personalizadas (`btn‑primary`, `btn‑secondary`).
   - Definir una familia de botones usando **únicamente clases de Tailwind**.
   - Crear variantes (primary, secondary, outline, ghost) con colores consistentes.
   - Asegurar mismos tamaños (`sm`, `md`, `lg`), bordes redondeados, estados hover/active.

2. **Paleta de colores unificada:**
   - Definir paleta completa en `tailwind.config.js` (máximo 8 colores base).
   - Usar tokens de Tailwind (`bg‑primary`, `text‑secondary‑foreground`) en todo el proyecto.
   - Eliminar colores hardcodeados (`#123456`, `rgb(...)`).
   - Aplicar la paleta a botones, fondos, textos, bordes.

3. **Sistema tipográfico:**
   - Definir escala tipográfica en `tailwind.config.js` (h1‑h6, body, caption).
   - Asegurar que todos los textos usen clases Tailwind (`text‑xl`, `text‑lg`, etc.).
   - Mantener Inter como fuente principal.

4. **Componentes reutilizables (Vanilla JS):**
   - Identificar componentes que se repiten (cards, headers, modales, forms).
   - Crear versiones estandarizadas usando **Tailwind + CSS custom** (sin React).
   - Documentar en `/components/README.md` cómo usar cada componente.

5. **Coherencia visual global:**
   - Definir tokens de diseño en `tailwind.config.js` (borderRadius, boxShadow, spacing).
   - Revisar cada página y ajustar a los tokens.
   - Asegurar que todas las esquinas redondeadas, sombras y espaciados sean consistentes.

**Criterio de éxito:**
- Todas las páginas usan **exclusivamente Tailwind** para estilos (sin CSS personalizado redundante).
- Los botones tienen apariencia idéntica en toda la aplicación.
- La paleta de colores se aplica consistentemente.
- La tipografía sigue una escala definida.
- Los componentes reutilizables están documentados y funcionan.

**Notas:**
- Mantener la funcionalidad existente intacta.
- No introducir React ni shadcn/ui.
- Priorizar botones y colores primero (impacto visual más alto).
- Seguir principios de diseño accesible (contraste, focos, etiquetas).
- Documentar cambios en `CHANGELOG.md`.

**🔔 Notificación ntfy:** `staymanager‑pablo‑tareas`  
**Repositorio:** https://github.com/orillasdelcoilaco/staymanager  
**Equipo:** Pablo (PO), Inspector (QA/Diseño), Antigravity (Claude Code, implementación)
