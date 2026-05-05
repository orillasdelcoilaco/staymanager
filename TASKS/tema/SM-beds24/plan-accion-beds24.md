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
3. **Código SM:** arranque con **cliente API + smoke** en repo; el conector completo (mapeo SM → Beds24, multi-tenant, jobs) sigue priorizable en backlog.

## 4. Pasos de implementación

### Qué dice la documentación oficial (API V2)

- **Asistente “First steps” del panel:** flujo genérico para quien usa Beds24 como PMS; **no** es el único camino. Para evitar doble carga desde SuiteManager, el camino correcto es **API** ([wiki API V2](https://wiki.beds24.com/index.php/API_V2.0), [Swagger](https://beds24.com/api/v2/)).
- **Único paso obligatorio manual:** generar **invite code** / token en el panel Beds24 (`control3.php?pagetype=apiv2`); el resto puede ser programático (cita wiki: *“This step is the only one that must be done manually, all other steps can be performed and automated programmatically.”*).
- **Propiedades y habitaciones:** `POST /properties` (Beta) — crear/actualizar sin `id`; con `id` para modificar.
- **Precios por fecha / disponibilidad:** `GET`/`POST /inventory/rooms/calendar` (requiere que exista precio en propiedad; reglas nuevas de precio pueden necesitar UI — ver wiki sobre price rules).
- **Canales (incl. mapping):** `GET`/`POST /channels/settings` (Alpha); para “solo channel manager por API” Beds24 pide **contactar soporte** (wiki).
- **Límite crítico — fotos:** en FAQ de la wiki: *“Can I use API V2 to send pictures or webhooks? Currently no, however these features are coming soon.”* Hasta que exista endpoint, **imágenes** suelen cargarse en el **panel Beds24** (o repetir URLs si el producto Beds24 lo permite en campos concretos — validar en Swagger/schema). El riesgo de “mala metadata” se reduce usando **las mismas URLs públicas** que ya sirve SuiteManager para la galería, pero la **subida/gestión en Beds24** puede seguir siendo manual interina.
- **Créditos:** ~100 créditos / 5 min por cuenta; agrupar `POST` en lote cuando sea posible.

### Fase operativa (cuenta + canal Google)

- [ ] Cuenta Beds24 + plan con **API V2** y canal **Google** acorde a unidades reales.
- [ ] Invite code con scopes: `read/write:properties`, `read/write:inventory`, canales según necesidad (recrear invite si cambian scopes).
- [ ] Intercambiar invite → `GET /authentication/setup` con header `code:` → guardar **refresh token** (escritura) o long-life (solo lectura).
- [ ] Activar **Google** en Beds24 (mapeo puede combinar UI + API según soporte).
- [ ] Fotos mínimas en panel Beds24 mientras la API de imágenes no esté disponible.

### Fase técnica en SuiteManager (incremental)

- [x] Cliente HTTP + resolución de token: `backend/services/beds24/beds24Client.js`.
- [x] Smoke: `npm run smoke:beds24-api` · `backend/scripts/beds24-api-smoke.js`.
- [ ] Mapper `propiedad` / `websiteData` / galería (texto, geo, capacidad) → payload `POST /properties` (validar schema Swagger).
- [ ] Sync **calendario** / precios: `POST /inventory/rooms/calendar` alineado a tarifas SM (sin tocar `valorHuesped`).
- [ ] Reservas: import a Beds24 como bloqueos o `POST /bookings` según modelo de negocio; webhooks (contactar Beds24 para API V2 booking webhooks).
- [ ] Multi-tenant: credenciales y `beds24PropertyId` por `empresa_id` (tabla o `websiteSettings.integrations.beds24` — diseño pendiente).
- [ ] UI mínima o settings por tenant (sin secretos en claro en cliente).
- [ ] Tests de contrato y regresión multi-tenant.

### Fase producto / backlog (resumen)

- [ ] Discovery: webhooks, límites de tasa, conflicto de inventario.
- [ ] Tests automatizados además del smoke.

## 5. Bitácora de planificación (pre-código y durante)

- 2026-05-06 — Alineación con wiki API V2: asistente panel ≠ camino de automatización; límite **fotos API “coming soon”**; bootstrap repo `beds24Client.js` + `smoke:beds24-api` + `.env.example`.
- 2026-05-03 — Tema **`SM-beds24`** creado en tablero; guía `beds24-integracion-inicio.md` ubicada bajo este ID; **`SM-ghc-onboarding`** cerrado como integración Google partner directa (standby código + docs). Regla: no ampliar módulos `googleHotels*` partner sin instrucción explícita.
