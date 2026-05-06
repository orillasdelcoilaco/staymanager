# SM-recontacto-sin-disponibilidad

## Objetivo

Diseñar e implementar una función de seguimiento para mantener informados a potenciales clientes que intentaron reservar y no encontraron disponibilidad en sus fechas.

## Estado

- **Pendiente verificación en ChatGPT** hasta contratar **ChatGPT Plus** (los GPT con Actions / herramientas comerciales suelen requerir plan de pago). El API y producción ya están alineados.
- **Hecho (2026-05-05):** migración SQL en prod, deploy Render, OpenAPI **1.4.8** en `suite-manager.onrender.com`, smoke API A–C OK; fix `canalesService` (`IA_VENTA_CANAL_ORIGEN`, `resolverCanalIaVentaEnLista`).
- **Cuando tengas Plus:** en el GPT **SuiteManager Marketplace IA** → **Configure** → **Actions** → volver a importar el schema desde `https://suite-manager.onrender.com/openapi-chatgpt.yaml` → **Guardar** → abrir **una conversación nueva** con ese GPT y probar (así se cargan de nuevo las herramientas; una charla vieja puede seguir con definiciones antiguas).
- Smoke D (panel `/gestion-diaria/espera-disponibilidad`) y E (correo): verificación manual cuando corresponda.
- Detalle operativo: `plan-cierre-deploy-ops.md` sección **Post-Plus: volver a probar el GPT**.
- **IA y panel comparten** la tabla `espera_disponibilidad` y el mismo servicio (`registrarEsperaDisponibilidadDesdeIa` / `crearEsperaDisponibilidad`). Consentimiento en IA: implícito en BD + metadata; email obligatorio (ver **400** `WAITLIST_EMAIL_REQUIRED` en `createBookingIntent` si hay bloqueo sin email).

## Alcance inicial

- Capturar intentos fallidos de reserva por falta de disponibilidad.
- Definir el canal de contacto (email/WhatsApp) y reglas de consentimiento.
- Notificar cuando se habilite disponibilidad compatible o alternativa cercana.
- Medir tasa de recuperación (recontacto -> reserva creada).

## Artefactos

- `plan-accion-recontacto-sin-disponibilidad.md`
- `plan-cierre-deploy-ops.md` — cierre prod; **§ Post-Plus** para reimport + prueba en ChatGPT tras suscripción.
