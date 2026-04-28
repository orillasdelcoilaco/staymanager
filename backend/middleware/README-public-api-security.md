# Public API Security (IA venta)

Este módulo protege endpoints públicos de IA (`/api/public/*`) frente a abuso sin romper uso normal del agente.

Archivo principal: `backend/middleware/publicApiSecurity.js`

## Objetivo

- Mantener experiencia fluida para búsqueda/cotización legítima.
- Frenar spam/flood de reservas.
- Aislar límites por empresa (`empresa_id`) en entorno multi-tenant.

## Capas de protección

1. `validateHumanLike`
- Bloquea `User-Agent` vacío/muy corto.
- Bloquea bots maliciosos conocidos (`scrapy`, `crawler`, etc.).
- Registra (`log`) cuando detecta agentes IA legítimos.

2. `sanitizeInputs`
- Elimina claves peligrosas (`__proto__`, `constructor`, `prototype`).
- Acota strings largas a 1000 chars.

3. `bookingWorkflowLimiter` (resolve/cotizar/intent)
- Aplica a:
  - `POST /api/public/reservar/intent`
  - `POST /api/public/reservas/resolve-booking-unit`
  - `POST /api/public/reservas/cotizar`
- Clave: `IP + empresa`
- Umbral por defecto: `20` requests / `15` min

4. `createReservationLimiter` (creación real)
- Aplica a:
  - `POST /api/public/reservas`
- Clave: `IP + empresa + email huésped`
- Umbral por defecto: `5` requests / `15` min

5. `readLimiter` + `speedLimiter` (GET)
- Límite base y degradación progresiva en lectura.

## Composición de claves (importante)

### Workflow
`ipKeyGenerator(req.ip) + empresa_id`

### Reserva final
`ipKeyGenerator(req.ip) + empresa_id + huesped.email`

Notas:
- `ipKeyGenerator` es el helper oficial de `express-rate-limit` para IPv6-safe keys.
- `empresa_id` y `email` se normalizan (`trim + lowercase`).
- Si faltan valores: `sin-empresa` / `sin-email` (fallback defensivo).

## Trusted IPs

Si una IP está en `TRUSTED_IPS`, se omiten límites de `bookingWorkflowLimiter` y `createReservationLimiter`.

Ejemplo:
`TRUSTED_IPS=1.2.3.4,5.6.7.8`

Usar solo para infraestructura controlada.

## Variables de entorno

En `backend/.env.example`:

- `BOOKING_WORKFLOW_WINDOW_MS` (default `900000`)
- `BOOKING_WORKFLOW_MAX` (default `20`)
- `CREATE_RESERVATION_WINDOW_MS` (default `900000`)
- `CREATE_RESERVATION_MAX` (default `5`)
- `TRUSTED_IPS` (opcional)

## Flujo resumido

`Request` -> `validateHumanLike` -> `sanitizeInputs` -> `Limiter por ruta` -> `Controller`

## Recomendación de operación

- GPT público (Store): mantener defaults o bajar levemente `CREATE_RESERVATION_MAX`.
- QA interno: usar clave separada y/o `TRUSTED_IPS` acotado.
- Revisar logs si hay muchos `RATE_LIMIT_EXCEEDED` para recalibrar.

## Prueba rápida

Script:
`node backend/scripts/test-public-api-rate-limit-key.js`

Valida composición de clave por tenant/email.
