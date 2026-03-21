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
