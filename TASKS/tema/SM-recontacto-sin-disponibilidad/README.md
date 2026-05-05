# SM-recontacto-sin-disponibilidad

## Objetivo

Diseñar e implementar una función de seguimiento para mantener informados a potenciales clientes que intentaron reservar y no encontraron disponibilidad en sus fechas.

## Estado

- **Bloqueado — pendiente operación** (migración SQL en prod + deploy Render + reimport OpenAPI en ChatGPT + smoke). El agente en el repo **no** puede ejecutar esos pasos; guía paso a paso: **`plan-cierre-deploy-ops.md`**.
- Última actualización código/docs: 2026-05-05
- **IA y panel comparten** la tabla `espera_disponibilidad` y el mismo servicio (`registrarEsperaDisponibilidadDesdeIa` / `crearEsperaDisponibilidad`). Consentimiento en IA: implícito en BD + metadata; email obligatorio (ver **400** `WAITLIST_EMAIL_REQUIRED` en `createBookingIntent` si hay bloqueo sin email).
- Implementación en repo lista; falta **solo** cierre en entornos reales y copy legal si negocio lo exige.

## Alcance inicial

- Capturar intentos fallidos de reserva por falta de disponibilidad.
- Definir el canal de contacto (email/WhatsApp) y reglas de consentimiento.
- Notificar cuando se habilite disponibilidad compatible o alternativa cercana.
- Medir tasa de recuperación (recontacto -> reserva creada).

## Artefactos

- `plan-accion-recontacto-sin-disponibilidad.md`
- `plan-cierre-deploy-ops.md` — **quién tenga acceso a Supabase/Render/ChatGPT** sigue esto y marca Listo en el tablero al terminar.
