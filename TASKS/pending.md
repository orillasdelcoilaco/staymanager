# Tarea: Auditoría de diseño profesional y stack técnico de suitemanagers

**Autor:** Inspector (OpenClaw QA/Diseñador)  
**Fecha:** 2026‑03‑20  
**Estado:** Pendiente  
**Prioridad:** Alta

---

## 🎯 Objetivo
Evaluar el estado actual del proyecto **suitemanagers** (repo `staymanager`) desde dos perspectivas:
1. **Diseño/UX/UI:** Identidad visual, consistencia, profesionalismo, experiencia de usuario.
2. **Stack técnico:** Arquitectura, tecnologías, dependencias, oportunidades de optimización.

El resultado será un informe que sirva como base para las mejoras que harán que suitemanagers se vea **muy profesional y comercial**.

---

## 📋 Contexto del proyecto
- **Repositorio:** https://github.com/orillasdelcoilaco/staymanager
- **Equipo:** Pablo (product owner), Inspector (QA/diseñador), Antigravity (Claude Code, implementador).
- **Audiencia prevista:** Propietarios de propiedades/vacacionales, administradores de condominios, usuarios que buscan una solución SaaS profesional.

---

## 🔍 Áreas de investigación (Diseño/UX)
1. **Identidad visual actual:**
   - Logo, paleta de colores, tipografía.
   - Consistencia a lo largo de las vistas (si existen).
   - Percepción de profesionalismo y confianza.

2. **Experiencia de usuario:**
   - Flujos principales (onboarding, dashboards, reportes).
   - Navegación, jerarquía de información.
   - Accesibilidad (contraste, tamaño de texto, etiquetas).

3. **Diseño de interfaz:**
   - Componentes UI utilizados (bibliotecas, custom).
   - Responsive design (mobile, tablet, desktop).
   - Estados de interacción (hover, active, disabled).

4. **Contenido y mensaje:**
   - Claridad del copy (textos, instrucciones, errores).
   - Tono de voz (amigable, profesional, corporativo).
   - Puntos de fricción comunicacional.

---

## ⚙️ Áreas de investigación (Stack técnico)
1. **Arquitectura actual:**
   - Frontend (framework, bundler, estado, enrutamiento).
   - Backend (lenguaje, framework, base de datos, APIs).
   - Infraestructura (hosting, CI/CD, monitorización).

2. **Dependencias y versiones:**
   - Lista de paquetes principales (frontend/backend).
   - Versiones (actuales, desactualizadas, con vulnerabilidades).
   - Tamaño del bundle y oportunidades de optimización.

3. **Prácticas de desarrollo:**
   - Estructura de carpetas, convenciones de código.
   - Testing (unit, integration, e2e).
   - Documentación (README, comentarios, guías).

4. **Rendimiento y SEO:**
   - Métricas de performance (Lighthouse, Core Web Vitals).
   - SEO básico (meta tags, títulos, URLs amigables).
   - Tiempos de carga, optimización de assets.

---

## 📄 Entregables esperados
1. **Informe de auditoría** (en `TASKS/completed.md`) con:
   - Resumen ejecutivo (hallazgos clave, puntuación general).
   - Sección de diseño: fortalezas, debilidades, recomendaciones.
   - Sección técnica: stack evaluado, dependencias, sugerencias.
   - Priorización (qué mejorar primero para mayor impacto).

2. **Recursos visuales** (opcional, si es posible):
   - Capturas de pantalla anotadas con problemas de UI.
   - Propuesta de paleta de colores y tipografía.
   - Wireframes de mejora (descripción textual o boceto ASCII).

3. **Plan de acción**:
   - Lista de tareas concretas para Antigravity (ej: “actualizar dependencias X, Y”, “rediseñar componente Z”).
   - Estimación de esfuerzo (baja/mediana/alta).
   - Orden recomendado de implementación.

---

## ⚠️ Restricciones y consideraciones
- **Costo cero:** No gastar en herramientas de pago sin aprobación de Pablo.
- **Seguridad:** No exponer claves, tokens o datos sensibles.
- **Read‑only:** Inspector no modificará código; solo reportará.
- **Tiempo:** Entregar en las próximas 24–48 horas (dependiendo de complejidad).
- **Formato:** Usar Markdown, ser claro y específico.

---

## 🔗 Referencias
- [Repositorio staymanager](https://github.com/orillasdelcoilaco/staymanager)
- [Documentación de colaboración](REVISION_COLABORADOR.md)
- [Sistema de tareas TASKS/](TASKS/)

---

**Siguiente paso:** Antigravity revisa este archivo, realiza la auditoría y escribe los hallazgos en `TASKS/completed.md`. Inspector monitoreará cambios y proporcionará feedback.