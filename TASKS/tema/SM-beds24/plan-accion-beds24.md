# Plan de acción — Integración Beds24 (CM + API + eventual conector SM)

## 1. Problema / contexto

- Google **cerró** la vía de connectivity partner **directo** para SuiteManager (política de volumen). Los feeds y el panel partner en repo siguen como **base técnica en standby**; **no** es el carril comercial activo.
- Objetivo de producto: **presencia en Google** vía un CM ya integrado con Google (**Beds24** como referencia operativa) y, cuando el backlog lo priorice, **sincronización controlada** SuiteManager ↔ Beds24 sin violar multi-tenant ni la fuente financiera inmutable (`valorHuesped`).

**Referencias:** `TASKS/tema/SM-gh-strategy-cm/google-hotels-estrategia-post-partner-google.md` · `TASKS/tema/SM-venta-ia/venta-ia.md` §7.0 · `beds24-integracion-inicio.md`.

## 2. Opciones consideradas

| Opción | Pros | Contras | ¿Descartada? |
|--------|------|---------|----------------|
| **Solo operación en Beds24** (sin código SM) | Rápido; Google vía CM; sin riesgo de doble escritura en código | Dos fuentes de verdad hasta acordar proceso | **No** — fase inmediata recomendada |
| **Conector SM → Beds24** (API V2) | Un solo maestro interno posible; automatización | Coste desarrollo, límites API, conflictos inventario/reservas | **No** — fase D, backlog |
| **Retomar partner directo Google** | Control total en SM | Bloqueado comercialmente hoy | **Pausada** hasta cambio de política Google |

## 3. Enfoque elegido

1. **Ahora (operación):** seguir **`beds24-integracion-inicio.md`** — cuenta/plan con API + canal Google, ficha completa en Beds24, **Channel Manager → Google**, pruebas **API V2** fuera del repo (secretos solo en env).
2. **Decisión explícita de “fuente de verdad”** hasta existir conector (A: inventario/tarifas en Beds24; B: maestro SM y sync futuro) — documentar en bitácora cuando el operador elija.
3. **Código SM:** ningún desarrollo obligatorio en esta fase; al priorizar backlog, diseñar **`backend/services/beds24/`** (lectura primero, escritura acotada, jobs/webhooks según doc Beds24).

## 4. Pasos de implementación

### Fase operativa (sin código en repo)

- [ ] Cuenta Beds24 + plan con **API V2** y canal **Google** acorde a unidades reales.
- [ ] Propiedad(es) completas en Beds24 (dirección, teléfono, geo, fotos mínimas según wiki).
- [ ] Activar **Google** desde Beds24 y completar mapeo / sync según asistente.
- [ ] Habilitar API V2, guardar tokens en gestor de secretos (nunca en git).
- [ ] Prueba manual API (GET propiedades / reservas) desde Postman o script local.

### Fase producto / código (backlog)

- [ ] Discovery: webhooks o push de reservas Beds24; límites de tasa; modelo de `empresa_id` ↔ cuenta/propiedad Beds24.
- [ ] Diseño `backend/services/beds24/` (read-only MVP → sync inventario/tarifas si aplica).
- [ ] UI mínima o settings por tenant (credenciales referenciadas por env o vault, no texto plano en Firestore si se puede evitar).
- [ ] Tests de contrato y regresión multi-tenant.

## 5. Bitácora de planificación (pre-código y durante)

- 2026-05-03 — Tema **`SM-beds24`** creado en tablero; guía `beds24-integracion-inicio.md` ubicada bajo este ID; **`SM-ghc-onboarding`** cerrado como integración Google partner directa (standby código + docs). Regla: no ampliar módulos `googleHotels*` partner sin instrucción explícita.
