# Plan de Acción — Rebrand Dominio + Limpieza Firebase
**Tema:** SM-rebrand-dominio  
**Fecha:** 2026-05-07  
**Estado:** Fase 2 cerrada en repo (código + docs canónicos principales); pendientes: ops DNS Fase 1, Fase 3 GitHub/carpeta, Fase 4 opc.

**Registro explícito de lo no hecho / aplazado:** [`pendientes-y-registro.md`](./pendientes-y-registro.md) (actualizar ese archivo cuando cambie el estado operativo).

---

## § Bitácora

| Fecha | Actor | Nota |
|-------|-------|------|
| 2026-05-07 | Claude Code | Análisis inicial: audit de ~150 referencias, evaluación Firebase, dominio rezerva.cl, impacto GitHub/carpeta. Plan creado. |
| 2026-05-07 | Cursor | Revisión repo + tablero: no todo era «0 refs». Ajustes: `tenantResolver.js` default `rezerva.cl`; `propiedadesMetadataPipeline.js` User-Agent alineado a `NOMINATIM_USER_AGENT` / `Rezerva/1.0`; SPA `plataforma-principal` + menú «Plataforma Rezerva». Pendientes explícitos: LEER-PRIMERO/SHARED_CONTEXT/venta-ia smokes, Fase 1 DNS, Fase 3 GitHub, scripts legacy opcionales. |
| 2026-05-07 | Cursor | Docs canónicos: `LEER-PRIMERO.md` (tabla hosts), `SHARED_CONTEXT.md` registro + cabecera connectivity; `venta-ia.md` §1.2 + inventario §6; `gemini-smoke-instrucciones.md`, `qa-y-seguimiento-prelaunch-canales.md`; `backend/.env.example`; `.agent/workflows/ssr-integrity-check.md`. |
| 2026-05-07 | Cursor | Nuevo **`pendientes-y-registro.md`**: ops Fase 0–1–3 sin ejecutar; docs secundarios en otros `TASKS/tema/*`; compatibilidad `config.routes.js`; DoD grep aclarado. |
| 2026-05-07 | Cursor | Barrido scripts (`verify_ssr_integrity`, partner/content smokes, `audit-prueba1-ssr`, legacy-root, `fix-prueba1`) + TASKS (GHC, SEO, pagespeed, blog, arquitectura SSR, solo-ui, ARCHITECTURE_v2, plan GPT); `@deprecated` en `verify-subdomain-logic.js`. |
| 2026-05-07 | Cursor | Rename **`suitemanagerApiController.js`** → **`publicAiHttpController.js`** (`routes/api.js`, `agentes.js`, `publicRoutes.js`); MCP **`rezerva-mcp-server`**; TASKS/backlog/coordinación/venta-ia referencias actualizadas. |

---

## 1. Evaluación del Dominio `rezerva.cl`

### 1.1 Por qué funciona

| Criterio | Evaluación |
|----------|-----------|
| **Disponibilidad** | ✅ Disponible |
| **Relevancia semántica** | ✅ "Reserva" = core del producto; el motor de reservas es la feature principal |
| **Sin conflicto** | ✅ No existe `rezerva.com` operativo ni marca consolidada con ese nombre |
| **Longitud** | ✅ Corto (7 caracteres), memorable |
| **TLD .cl** | ⚠️ Bueno para Chile; podría percibirse como local si se expande a otros países |
| **Ortografía con Z** | ⚠️ Diferenciador visual; puede causar errores de tipeo en usuarios nuevos |
| **Identidad SaaS** | ⚠️ No comunica "administración" o "plataforma" — solo "reserva" |

### 1.2 Recomendación

`rezerva.cl` **es viable como dominio principal** para el mercado chileno actual. Si en el futuro
el producto se expande a otros países latinoamericanos, conviene registrar también `rezerva.app`
o `rezerva.io` como respaldo internacional (ambos probablemente disponibles).

**Acción complementaria recomendada:** registrar `rezerva.app` en paralelo como respaldo
y para usar en integraciones técnicas donde `.cl` puede generar rechazo.

### 1.3 Qué NO cambia con el nuevo dominio

- Render URL: `suite-manager.onrender.com` — es independiente del dominio (solo custom domain)
- Firebase Project ID: `suite-manager-app` — inmutable (ver § 3)
- Git history

---

## 2. Mapa de Cambios de Código — Eliminación Total de Hardcode

### Principio rector
> Ninguna referencia al dominio debe existir hardcodeada. **Todo** debe ser una variable de entorno
> o derivarse de `PLATFORM_DOMAIN` / `PUBLIC_SITES_ROOT_DOMAIN`.

### 2.1 Variables de Entorno (Nivel 0 — hacer PRIMERO)

Cambiar en Render Dashboard y en `.env` local:

```bash
PLATFORM_DOMAIN=rezerva.cl
PUBLIC_SITES_ROOT_DOMAIN=rezerva.cl
VAPID_SUBJECT=mailto:support@rezerva.cl   # webPushDigestService.js
```

Archivos que YA consumen `PLATFORM_DOMAIN` correctamente (no requieren cambio de código):
- `backend/middleware/tenantResolver.js`
- `backend/services/marketplaceService.js`
- `backend/services/transactionalEmailService.js`
- `backend/services/websiteHostCanonical.js`
- `backend/services/googleHotelsPartner/partnerFeedsSelftest.js`
- `backend/services/googleHotelsPartner/publicBookingUrl.js`
- `backend/routes/googleHotelsPartner.routes.js`
- `backend/routes/seoMonitor.js`
- `backend/services/publicWebsiteService.js` (consume `PUBLIC_SITES_ROOT_DOMAIN`)

### 2.2 Código con hardcode a eliminar (Nivel 1 — cambio de código)

#### Backend — convertir a env var

| Archivo | Línea aprox. | Qué cambiar |
|---------|-------------|------------|
| `backend/services/webPushDigestService.js` | ~11 | `mailto:support@suitemanagers.com` → `process.env.VAPID_SUBJECT \|\| 'mailto:support@rezerva.cl'` |
| `backend/routes/googleHotelsPartner.routes.js` | ~20-23 | Whitelist hostnames `feeds.suitemanagers.com`, `api.suitemanagers.com`, etc. → construir desde `PLATFORM_DOMAIN` |
| `backend/routes/empresa.js` | ~17 | `.endsWith('.suitemanager.com')` → usar `PLATFORM_DOMAIN` |
| `backend/services/empresaService.js` | ~250-251 | Validación de dominio → usar `PLATFORM_DOMAIN` |
| `backend/services/websiteHostCanonical.js` | ~12-13 | Referencias `suite-manager.com` como fallback adicional |
| `backend/services/icalService.js` | ~29,36 | `UID:...@suitemanager` → usar variable o constante configurable |
| `backend/routes/geocode.js` | ~21,65 | `User-Agent: SuiteManager/1.0 (contact@suitemanager.cl)` → env var `APP_USER_AGENT` |
| `backend/agent/gpt-global-manifest.js` | ~11,17,25 | URLs de dominio en descripción del GPT |

#### Frontend — convertir a env var o constante derivada

| Archivo | Línea aprox. | Qué cambiar |
|---------|-------------|------------|
| `frontend/src/shared/ariFeedUrl.js` | ~10 | URL hardcodeada `suitemanagers.com` → leer de config del backend (`/api/config/platform`) |
| `frontend/src/views/canalesIa.js` | ~26 | `CATALOGO_GOOGLE_HOTELS_URL` hardcodeado |
| `frontend/src/views/empresa.js` | ~43 | Referencia al dominio |
| `frontend/src/menuConfig.hints.js` | ~14 | Label "SEO de suitemanagers.com" → texto genérico o "SEO de la plataforma" |
| `frontend/src/router.js` | ~116 | ID `plataforma-suitemanagers` → `plataforma-principal` o similar |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.unified.markup.js` | ~56,194,378,380 | Referencias al dominio en ejemplos de UI |
| `frontend/src/views/components/canalesIa/canalesIa.checklistGoogleS0.js` | ~14 | Referencia al dominio |

**Patrón para frontend:** agregar un endpoint `GET /api/config/platform` que exponga:
```json
{
  "platformDomain": "rezerva.cl",
  "supportEmail": "support@rezerva.cl"
}
```
El frontend lo lee una vez al cargar y usa los valores donde los necesite.

#### OpenAPI y contratos externos

| Archivo | Cambio |
|---------|--------|
| `backend/openapi/claude-tools.json` | `contact_email`, `logo_url`, `name_for_model`, `legal_info_url` |
| `backend/openapi/openapi.json` | Server URLs |
| `backend/openapi/openapi-chatgpt.yaml` | Server URL |
| `backend/openapi/openapi-gemini.yaml` | Server URL |

#### Templates EJS / Legal

| Archivo | Cambio |
|---------|--------|
| `backend/views/legal/privacy.ejs` | Texto legal con dominio |
| `backend/views/marketplace/index.ejs` | Comentario (menor) |
| `backend/views/partials/footer.ejs` | Link a `suitemanager.cl` |

#### Documentación interna (no afecta producción, actualizar en el mismo PR)

- `LEER-PRIMERO.md` — sección Referencias de entorno
- `SHARED_CONTEXT.md` — registros históricos + tabla de stack
- `.agent/workflows/ssr-integrity-check.md`
- `backend/.env.example`
- `TASKS/tema/SM-venta-ia/venta-ia.md`
- `TASKS/tema/SM-seo-ssr-buscadores/README.md`

---

## 3. Análisis Firebase — Qué Sigue en Uso y Qué Migrar

### 3.1 Inventario real de uso Firebase en producción

| Servicio Firebase | Uso actual | Migrable a Supabase |
|-------------------|-----------|---------------------|
| **Firebase Auth** | ✅ Activo — `verifyIdToken()` en CADA request autenticado; `createUser()` en registro | Sí, Supabase Auth. **Alta complejidad.** |
| **Firebase Storage** | ✅ Activo — todas las fotos/imágenes del sistema suben aquí (`storageService.js`) | Sí, Supabase Storage o Cloudflare R2. **Media complejidad.** |
| **Firestore** (colección `valoresDolar`) | ✅ Activo — `dolarService.js` + `reparacionService.js` leen/escriben aquí | Sí, tabla PG simple. **Baja complejidad.** |
| **Firestore** (otras colecciones) | ⚠️ Fallback legacy — si no hay `DATABASE_URL` activo. En producción con PG, las rutas Firestore no se ejecutan | — |

### 3.2 Análisis de migración por servicio

#### A. Firestore `valoresDolar` → PostgreSQL (Recomendado, CORTO plazo)

**Esfuerzo:** 1-2 días.  
**Tabla SQL:**
```sql
CREATE TABLE valores_dolar (
    empresa_id TEXT NOT NULL REFERENCES empresas(id),
    fecha DATE NOT NULL,
    valor NUMERIC(10,4) NOT NULL,
    PRIMARY KEY (empresa_id, fecha)
);
```
Migrar `dolarService.js` al patrón modo dual (primero PG, fallback Firestore).  
Una vez validado en producción, Firestore `valoresDolar` queda en desuso.

**Impacto en el dominio/proyecto Firebase:** ninguno. El project ID `suite-manager-app` solo importa para Auth y Storage.

#### B. Firebase Storage → Supabase Storage (MEDIANO plazo, post-rebrand)

**Esfuerzo:** 1-2 semanas.  
**Pasos:**
1. Crear bucket en Supabase Storage (políticas similares a las actuales Firebase Storage Rules)
2. Actualizar `storageService.js` para usar `@supabase/storage-js`
3. Migrar imágenes existentes: script que lee URLs de `galeria` en PG → descarga de Firebase → sube a Supabase → actualiza URL en PG
4. Período de convivencia (ambos buckets activos) hasta completar migración de URLs
5. Cuando todas las URLs apunten a Supabase, cerrar el bucket Firebase

**Ventaja:** las URLs de Supabase Storage pueden usar un dominio personalizado propio (ej: `media.rezerva.cl`), eliminando cualquier referencia visual a Firebase/Google.

#### C. Firebase Auth → Supabase Auth (LARGO plazo, decisión estratégica)

**Esfuerzo:** 3-5 semanas.  
**Impacto:** Todos los usuarios existentes necesitan ser migrados o re-autenticados.  
**Riesgo:** Alto. Firebase Auth es la única capa de autenticación; un error corta el acceso a todos los administradores.  
**Recomendación:** Diferir esta migración hasta que Storage esté completamente en Supabase. Abordarla como iniciativa separada `SM-migrar-auth`.

**Consideración clave:** Firebase Auth es gratuito hasta 50,000 MAU y no expone el project ID en ninguna URL pública visible para el usuario final. No hay urgencia técnica inmediata.

### 3.3 ¿Qué bloquea el cambio de dominio respecto a Firebase?

**Nada.** El dominio de plataforma (`rezerva.cl`) es independiente del Firebase project ID (`suite-manager-app`). Las URLs de Firebase Storage (`firebasestorage.googleapis.com/...`) son URLs de API interna, no URLs de la marca pública. El usuario final no las ve directamente.

---

## 4. Impacto — GitHub y Carpeta Local

### 4.1 Repositorio GitHub (cuenta operación Rezerva)

**Canónico (2026-05):** `https://github.com/admin-rezerva/rezerva` — usuario GitHub `admin-rezerva`. Histórico: `orillasdelcoilaco/staymanager`.

**Si solo renombrás dentro del mismo owner:** Settings → renombrar repo; GitHub suele redirigir la URL antigua un tiempo.

**Impacto inmediato al cambiar owner o URL:**
- **Render pierde el webhook de GitHub** — reconectar en Render (Settings → Build & Deploy → repo).
- Actualizar remote local: `git remote set-url origin https://github.com/admin-rezerva/rezerva.git` (o `git remote rename origin old-origin` + `git remote add origin …` si preservás el viejo como `old-origin`).

**Pasos típicos tras migración:**
1. Repo vacío creado en la cuenta nueva → `git push -u origin main`
2. En Render: conectar `admin-rezerva/rezerva` y verificar deploy automático

**No cambia:**
- URL de Render (`suite-manager.onrender.com`) — es independiente del repo
- Git history completo
- Ramas y tags

### 4.2 Renombrar carpeta local

**Acción:** Renombrar `d:\pmeza\Desarrollos Render\staymanager\` → `d:\pmeza\Desarrollos Render\rezerva\`

**Impacto:**
- Ningún impacto en producción
- VS Code / Cursor: cerrar el workspace, renombrar carpeta, reabrir desde la nueva ruta
- El git remote no cambia (solo la carpeta local)
- CLAUDE.md hace referencia al directorio en comentarios pero no en lógica de código

**Pasos:**
1. Cerrar VS Code / Cursor completamente
2. Renombrar carpeta en el explorador de Windows
3. Reabrir VS Code apuntando a la nueva ruta
4. Verificar que `git status` funciona correctamente

### 4.3 Orden recomendado

```
1. Renombrar carpeta local (sin riesgo)
2. Cambiar env vars en Render (PLATFORM_DOMAIN, PUBLIC_SITES_ROOT_DOMAIN)
3. Configurar DNS del nuevo dominio apuntando al servicio Render
4. Aplicar cambios de código (hardcode elimination) en rama feature
5. Renombrar repo GitHub + reconectar Render
6. Migrar Firestore valoresDolar → PG (independiente)
7. [Futuro] Migrar Firebase Storage → Supabase Storage
8. [Futuro] Migrar Firebase Auth → Supabase Auth
```

---

## 5. Fases de Implementación

### Fase 0 — Decisión y Registro (1 día)
- [ ] Confirmar dominio `rezerva.cl` (registrar en NIC Chile o reseller)
- [ ] Opcionalmente registrar `rezerva.app` como respaldo internacional
- [ ] Decidir si el nombre del servicio en Render también cambia

### Fase 1 — DNS y Render Custom Domain (1 día)
- [ ] Configurar custom domain `rezerva.cl` en Render
- [ ] Configurar subdominios `*.rezerva.cl` para el tenantResolver
- [ ] Actualizar `PLATFORM_DOMAIN` en Render Environment
- [ ] Verificar SSR con tenant de prueba en `orillasdelcoilaco.rezerva.cl`

### Fase 2 — Eliminación hardcode en código (2-3 días)
- [x] Backend: `webPushDigestService`, `empresa.js`, `empresaService`, `googleHotelsPartner.routes`, `icalService`, `geocode`, `websiteHostCanonical`, `agent/gpt-global-manifest`, `tenantResolver` (default dominio), `propiedadesMetadataPipeline` (User-Agent Nominatim)
- [x] Frontend: `ariFeedUrl`, `canalesIa`, `empresa.js`, `menuConfig.hints`, `router.js`, componentes `configurarWebPublica`, `canalesIa.checklistGoogleS0`
- [x] Endpoint `/api/config/platform` para exponer dominio al SPA
- [x] OpenAPI specs actualizados (servidor / ejemplos hacia rezerva.cl en artefactos versionados)
- [x] Templates EJS (legal, footer)
- [x] Documentación interna — **hecho (2026-05-07):** `LEER-PRIMERO.md`, `SHARED_CONTEXT.md`, `TASKS/tema/SM-venta-ia/venta-ia.md` §1.2 + enlaces, `gemini-smoke-instrucciones.md`, `qa-y-seguimiento-prelaunch-canales.md`, `backend/.env.example`, `.agent/workflows/ssr-integrity-check.md`. **Opcional / baja prioridad:** otros `TASKS/tema/*` históricos, scripts `backend/scripts/*` con ejemplos antiguos.
- [x] Auditoría: `node scripts/tooling/audit-ui-monitored.js` + `audit-complexity-monitored.js` (tras últimos cambios UI)

### Fase 3 — GitHub + Carpeta (1 día)
- [ ] Renombrar carpeta local
- [ ] Renombrar repo GitHub
- [ ] Actualizar git remote local
- [ ] Reconectar Render al repo renombrado
- [ ] Verificar deploy automático

### Fase 4 — Migrar Firestore `valoresDolar` → PG (1-2 días)
- [ ] Crear tabla `valores_dolar` en PostgreSQL
- [ ] Migrar `dolarService.js` al patrón modo dual
- [ ] Script de migración de datos históricos
- [ ] Validar en staging
- [ ] Deploy y verificar

### Fase 5 — Migraciones Firebase (futuro, iniciativas separadas)
- [ ] `SM-migrar-storage`: Firebase Storage → Supabase Storage
- [ ] `SM-migrar-auth`: Firebase Auth → Supabase Auth (alta complejidad, defer)

---

## 6. Criterios de Éxito (DoD)

**Nota (2026-05-07):** el DoD de grep global sigue **abierto** si se incluyen `backend/scripts/**`, tests y JSDoc — ver exclusiones en **`pendientes-y-registro.md` §2.3**. Objetivo realista: **sin** referencias productivas en rutas/servicios que sirvan tráfico con default `rezerva.cl`; scripts de mantenimiento pueden actualizarse en barrido aparte.

- [ ] `grep -r "suitemanagers.com" backend/ frontend/` retorna 0 en **código de aplicación** — *excluir* `backend/scripts/` y `backend/test/` hasta decisión de barrido (**pendiente** / listado en `pendientes-y-registro.md`)
- [ ] `grep -r "suitemanager.com" backend/ frontend/` retorna 0 en rutas críticas — misma exclusión; **`config.routes.js`** puede seguir aceptando sufijos legacy (**intencional**)
- [ ] Tenant de prueba accesible en `orillasdelcoilaco.rezerva.cl`
- [ ] Marketplace accesible en `rezerva.cl`
- [ ] Deploy automático desde GitHub funcionando en Render
- [ ] 0 errores de alta prioridad en `audit-ui-monitored.js`
- [ ] 0 nuevos críticos en `audit-complexity-monitored.js`
