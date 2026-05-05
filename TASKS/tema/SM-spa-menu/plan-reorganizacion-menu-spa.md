# Plan — Reorganización del menú SPA (pre-lanzamiento)

**Entrada canónica:** este archivo es la **única referencia** que debe citarse para taxonomía del menú lateral SPA, fases y handoff; **`LEER-PRIMERO.md`** (raíz) enlaza aquí en la tabla **Estándares de implementación**. No duplicar el plan completo en otros `TASKS/*.md` — como mucho una línea que apunte a este documento.

**Objetivo:** menú con lógica organizacional clara (inventario vs sitio público vs operación vs canales externos) **sin** mezclar responsabilidades de backend ni romper rutas. Producto aún sin usuarios finales: el coste de cambiar taxonomía **ahora** es bajo.

**Principio de tres capas (producto):**

1. **Inventario** — qué vendes (activos, espacios, alojamientos, galería, normas).  
2. **Sitio público (SSR)** — cómo se ve y se configura **tu** web (contenido por alojamiento, config global web).  
3. **Canales IA / externos** — conectores fuera del panel (Google, ChatGPT, Gemini…).  
4. **Operaciones** — día a día PMS.  
5. **Configuración** — empresa, plantillas, importadores, mapeos, etc.

**Fuera de alcance de este plan (intencional):**

- **No modificar** el bloque de menú **«Flujo de Trabajo»** (mismas entradas, orden e iconos). Archivo: `frontend/src/router.js` — `id: 'flujo-trabajo'`.
- No renombrar rutas `path` ni `id` de ítems de menú (evita roturas de `data-path`, favoritos, pruebas).
- No mover lógica de `PUT` / formularios en esta fase; solo estructura de navegación y nombres visibles.

---

## Estado del plan (actualizar al cerrar sesión)

| Fase | Descripción | Estado | Archivos |
|------|-------------|--------|----------|
| **Fase 1** | Grupo **Sitio público**; **Inventario**; rutas inmutadas | **LISTO** | `frontend/src/router.js` |
| **Fase 1b** | Orden **Operaciones** (reservas → … → bloqueos); **Canales** → **Canales de venta** | **LISTO** | `frontend/src/router.js` |
| **Fase 2** | Tooltips nativos (`title`) en categorías e ítems | **LISTO** | `frontend/src/menuConfig.hints.js`, `frontend/src/router.js` (`renderMenu`) |
| **Fase 3** | Vista **Canales IA**: copy tres capas, pestaña ChatGPT (GET `/api/public/version`), Gemini alineado, textos «Sitio público» | **LISTO** | `frontend/src/views/canalesIa.js` |

**Dónde seguir si se corta la sesión:** este archivo + tabla arriba. Código tocado: `router.js`, `menuConfig.hints.js`, `canalesIa.js`. **Flujo de Trabajo** intacto.

---

## Fase 1 — Detalle (implementado)

**Archivo:** `frontend/src/router.js`

1. Categoría **Inventario** (`id: 'gestion-propiedades'`).
2. Categoría **Sitio público** (`id: 'sitio-publico'`): Contenido Web, Configuración Web.
3. Orden: Dashboard → Flujo de Trabajo → Operaciones → Inventario → Sitio público → Configuración.

---

## Fase 1b — Operaciones (implementado)

Orden de ítems:

1. Reservas  
2. Clientes  
3. Tarifas  
4. Reseñas  
5. **Canales de venta** (antes etiqueta «Canales»; mismo `path` `/gestionar-canales`, `id` `gestionar-canales`)  
6. Canales IA  
7. Sincronizar iCal  
8. Bloqueos  

---

## Fase 2 — Tooltips (implementado)

- **`frontend/src/menuConfig.hints.js`:** `CATEGORY_HINTS` (por `id` de categoría) y `ITEM_HINTS` (por `id` de ítem).
- **`renderMenu`** en `router.js`: atributo `title` en `.category-title` y en cada `.nav-link` (escapado con `escAttr`).
- **Flujo de Trabajo:** sin entradas en `CATEGORY_HINTS` para `flujo-trabajo` → sin tooltip en ese bloque (acuerdo no tocar).

---

## Fase 3 — Canales IA (implementado)

- Cinta informativa «Inventario / Sitio público / Canales IA» en cabecera de la vista.
- Pestaña **ChatGPT:** bloque que llama `GET /api/public/version` vía `fetchAPI('/public/version')`, referencia a `backend/openapi/openapi-chatgpt.yaml`, CTA a Configuración Web.
- Pestaña **Gemini:** texto + `backend/openapi/openapi-gemini.yaml`, CTA Configuración Web.
- Mensaje vacío tabla Google: **Inventario → Alojamientos**.

*(Migración futura de más formularios a esta vista = backlog producto / `venta-ia.md`, no obligatorio para cerrar este plan.)*

---

## Mapa menú actual

```
Dashboard                          (+ tooltip)
Flujo de Trabajo                   ← sin cambios contractuales
Operaciones                        (+ tooltip categoría)
  Reservas → Clientes → Tarifas → Reseñas → Canales de venta → Canales IA → iCal → Bloqueos
Inventario                         (+ tooltip)
  Activos … Normas
Sitio público                      (+ tooltip)
  Contenido Web · Configuración Web
Configuración                      (+ tooltip)
  Empresa … Importador Histórico
```

---

## QA rápido

Checklist **completo** (menú + Canales IA + puente Config Web + opcional `curl`): **`TASKS/tema/SM-venta-ia/qa-y-seguimiento-prelaunch-canales.md`** — Parte 1.

Mínimo rápido:

- [ ] Pasar el ratón por categorías e ítems: aparece tooltip (`title`).
- [ ] **Operaciones:** orden y nombre «Canales de venta».
- [ ] **Canales IA:** pestaña ChatGPT muestra respuesta de `/api/public/version` o mensaje de error claro.
- [ ] `node scripts/tooling/audit-ui-monitored.js` tras cambios UI.

---

## Referencias

- **`TASKS/tema/SM-venta-ia/venta-ia.md`** §2.6 — modelo Canales IA y panel.
- **`TASKS/backlog-producto-pendientes.md`** §6 — rutas SPA (sin rutas nuevas en este plan).
- **`TASKS/tema/SM-seo-ssr-buscadores/plan-accion-seo-ssr.md`** §4 — extensión de menú por rol para SEO (tenant + plataforma superadmin).

---

*Última actualización: 2026-05-05 — Fases 1, 1b, 2 y 3 cerradas; extensión SEO por rol referenciada en tema `SM-seo-ssr-buscadores`.*
