# SM-recontacto-sin-disponibilidad

## Objetivo

Diseñar e implementar una función de seguimiento para mantener informados a potenciales clientes que intentaron reservar y no encontraron disponibilidad en sus fechas.

## Estado

- **Listo** — 2026-05-05
- Migración SQL (`espera-disponibilidad.sql`) ejecutada en producción (fix UUID→TEXT incluido).
- Deploy Render completado (commits `8391b36` + `ab53160`); OpenAPI 1.4.8 activo en producción.
- Fix bonus: `canalesService.js` — agregados `IA_VENTA_CANAL_ORIGEN` y `resolverCanalIaVentaEnLista` que faltaban y rompían `/reservar/intent` y `/reservas` antes del check de lista de espera.
- Smoke A (version) ✅ · Smoke B (lista_espera.registrado:true) ✅ · Smoke C (WAITLIST_EMAIL_REQUIRED) ✅
- Smoke D (panel `/gestion-diaria/espera-disponibilidad`) y E (correo) pendientes verificación manual.
- ChatGPT GPT "SuiteManager Marketplace IA" → reimportar OpenAPI desde `https://suite-manager.onrender.com/openapi-chatgpt.yaml` (acción manual única).
- **IA y panel comparten** la tabla `espera_disponibilidad` y el mismo servicio (`registrarEsperaDisponibilidadDesdeIa` / `crearEsperaDisponibilidad`). Consentimiento en IA: implícito en BD + metadata; email obligatorio (ver **400** `WAITLIST_EMAIL_REQUIRED` en `createBookingIntent` si hay bloqueo sin email).

## Alcance inicial

- Capturar intentos fallidos de reserva por falta de disponibilidad.
- Definir el canal de contacto (email/WhatsApp) y reglas de consentimiento.
- Notificar cuando se habilite disponibilidad compatible o alternativa cercana.
- Medir tasa de recuperación (recontacto -> reserva creada).

## Artefactos

- `plan-accion-recontacto-sin-disponibilidad.md`
- `plan-cierre-deploy-ops.md` — pasos operacionales completados (salvo reimport ChatGPT + panel D/E manual).
