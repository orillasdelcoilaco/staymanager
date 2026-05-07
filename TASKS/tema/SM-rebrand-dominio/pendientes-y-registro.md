# Pendientes y registro — SM-rebrand-dominio

**Última revisión:** 2026-05-07 (sesión: rename `publicAiHttpController` + MCP + nota canónica integradores MCP en docs raíz y venta-IA)

**Propósito:** dejar explícito **qué no se hizo**, **qué quedó aplazado** y **qué es intencional** (compatibilidad), para que ninguna sesión asuma que el rebrand está “cerrado” sin revisar esto.

---

## 1. Operación / infra (no ejecutable solo desde el repo)

Estas tareas requieren **acceso a DNS, Render, GitHub u operador humano**. **Siguen pendientes** hasta que alguien las ejecute y marque aquí o en bitácora del plan.

| ID | Qué | Estado | Notas |
|----|-----|--------|--------|
| **Fase 0** | Confirmar registro `rezerva.cl`, opcional `rezerva.app`, decisión nombre servicio Render | Pendiente | Ver `plan-accion-rebrand.md` § Fase 0 |
| **Fase 1** | Custom domain `rezerva.cl` + wildcard `*.rezerva.cl` en Render; env `PLATFORM_DOMAIN`, `PUBLIC_SITES_ROOT_DOMAIN`, `VAPID_SUBJECT`, etc.; smoke SSR tenant referencia | Pendiente | Script referencia: `scripts/legacy/render-domain-migration.js` (revisar antes de ejecutar) |
| **Fase 3** | Renombrar carpeta local; renombrar repo GitHub; `git remote set-url`; reconectar webhook Render | Pendiente | Tras renombre GitHub, Render puede perder deploy automático hasta reconectar |
| **Post-deploy** | Reimport OpenAPI en ChatGPT Actions si cambia host público del contrato; probar en chat nuevo | Pendiente manual | `LEER-PRIMERO.md` § GPT |

---

## 2. Código — pendiente o intencional

### 2.1 Compatibilidad multi-dominio (sí debe quedar)

| Ubicación | Motivo |
|-----------|--------|
| `backend/api/ssr/config.routes.js` | Acepta `.suitemanagers.com` y `.suitemanager.com` además del dominio actual para empresas con dominio guardado en BD durante la transición. |

### 2.2 Deuda técnica / naming

| Qué | Estado |
|-----|--------|
| `backend/services/publicAiHttpController.js` (antes `suitemanagerApiController.js`) | **Hecho 2026-05-07** — `git mv`; rutas `api.js`, `agentes.js`, `publicRoutes.js`; comentario cabecera |
| `backend/ai/openai/mcp-server/package.json` → **`rezerva-mcp-server`** | **Hecho 2026-05-07** — **Nota importante (integradores):** quien use MCP local debe revisar config (`suitemanager-mcp-server` → `rezerva-mcp-server`). Docs canónicos: **`LEER-PRIMERO.md`** tabla *Referencias de entorno* + callout bajo la tabla; **`backend/ai/openai/mcp-server/README.md`**; **`TASKS/tema/SM-venta-ia/chatgpt_integration_summary.md`**. |
| `backend/test/verify-subdomain-logic.js` | **Obsoleto en modo PG** — cabecera `@deprecated`; falta reescribir contra PostgreSQL o eliminar |

**Hecho en sesiones previas (scripts / ejemplos):** `verify_ssr_integrity.js`, smokes, `audit-prueba1-ssr`, legacy-root, `fix-prueba1`, `firestore/models.js` JSDoc.

### 2.3 Criterio DoD `grep` (estado real)

- Puede quedar texto legacy en **tests** (`verify-subdomain-logic.js` cuerpo) y comentarios.
- **Exclusión acordada** para “verde total”: no es obligatorio limpiar todos los `backend/scripts/**`; objetivo **prod** con `PLATFORM_DOMAIN=rezerva.cl`.

---

## 3. Documentación en otros temas

Inventarios **`publicAiHttpController`** actualizados en: `venta-ia.md` §6, `solo-ui.md`, `backlog-producto-pendientes.md`, `coordinacion-cursor-claude-ia-venta.md` (tabla §2–§3).

**Puede quedar texto viejo** fuera del repo o en historiales no sincronizados.

---

## 4. Migraciones Firebase / datos (fuera del corte DNS)

| Iniciativa | Contenido | Estado |
|------------|-----------|--------|
| **Fase 4** | `valoresDolar` Firestore → PostgreSQL | Pendiente — ver `plan-accion-rebrand.md` § Fase 4 |
| **Fase 5** | Storage Supabase; Auth Supabase | Futuro / iniciativas separadas |

---

## 5. Bitácora corta (solo este archivo)

| Fecha | Nota |
|-------|------|
| 2026-05-07 | Creado registro consolidado: ops Fase 0–1–3 sin ejecutar; docs secundarios listados; compat `config.routes.js`; deuda scripts/MCP/controller. |
| 2026-05-07 | Scripts + TASKS masivos; deprecación `verify-subdomain-logic.js`. **No hecho:** Fase 1/3 ops, Fase 4 PG. |
| 2026-05-07 | Rename **`publicAiHttpController.js`** + MCP **`rezerva-mcp-server`**; pendientes ops/Fase 4 sin cambio. |
| 2026-05-07 | **MCP:** nota integradores reforzada en **`LEER-PRIMERO.md`**, **`mcp-server/README.md`**, **`chatgpt_integration_summary.md`**, bitácora **`coordinacion-cursor-claude-ia-venta.md`** §6. |
| 2026-05-07 | **GitHub:** repo operación **`https://github.com/admin-rezerva/rezerva`** documentado; remote local `origin` → misma URL; **push** y **Render** reconectar → manual (credenciales / dashboard). |

---

*Para el plan maestro y fases numeradas, seguir `plan-accion-rebrand.md`. Para estado en tablero: `TASKS/tablero.md` fila `SM-rebrand-dominio`.*
