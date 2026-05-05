# Plan de accion - recontacto sin disponibilidad

## 1. Problema / contexto

Hoy un cliente puede intentar reservar y abandonar cuando no hay disponibilidad en sus fechas. Ese lead se pierde, aun cuando luego aparece cupo por cancelaciones o ajustes de inventario.

## 2. Opciones consideradas

| Opcion | Pros | Contras | Descartada |
|--------|------|---------|------------|
| Lista de espera por propiedad y rango de fechas | Flujo claro para el cliente y recuperacion directa | Requiere consentimiento y matching de disponibilidad | No |
| Notificacion manual desde CRM | Bajo riesgo tecnico inicial | Operacion pesada, poca escala, depende de disciplina operativa | No |
| Recontacto automatico multicanal (email + WhatsApp) | Mayor conversion potencial y velocidad | Mayor complejidad de reglas y trazabilidad legal | No |

## 3. Enfoque elegido (iteracion inicial)

Implementar una primera version con lista de espera y notificacion por email para intentos fallidos por no disponibilidad, dejando WhatsApp como extension posterior.

### 3.1 Reglas de negocio acordadas (2026-05-05)

- **Un solo envio:** como maximo **un correo** por registro de espera. Tras enviar, el registro pasa a estado `notificada` y **no** se reintenta aunque vuelva a haber movimiento en reservas.
- **Condicion de match:** hay que poder confirmar que existe disponibilidad para el **mismo rango de fechas**, **misma cantidad de personas** y **misma unidad** que el usuario solicito (si la espera estaba ligada a una propiedad concreta).
- **Ventana temporal para notificar:** solo se envia si, en el momento del match, aun faltan **al menos 48 horas** hasta la **fecha de llegada** solicitada. Si el match ocurre cuando ya quedan menos de 48 h hasta el check-in, **no** se notifica; el registro puede marcarse `expirada` u otra transicion acordada (sin email).
- **Expiracion:** si no hubo match enviable antes del umbral (p. ej. llega la fecha de check-in sin haber notificado, o paso el plazo definido para esa espera), el registro queda **`expirada`** y no se procesa mas.
- **IDs obligatorios (no nombres):** toda logica de negocio, matching, transiciones y APIs debe operar por identificadores estables (`id`, FK, semantica estable) y **no** por nombres editables. Los nombres quedan solo para UI.

*Nota de implementacion:* definir zona horaria de referencia para el calculo “48 h antes del check-in” (UTC del servidor vs zona de la empresa) antes de codificar el job de matching.

## 4. Pasos de implementacion

- [x] Definir modelo de datos dedicado para lista de espera con estados por **ID** (`backend/db/migrations/espera-disponibilidad.sql`).
- [x] Registrar solicitud desde SPA `Agregar propuesta` cuando no hay disponibilidad (modal + consentimiento + email obligatorio).
- [x] Crear proceso de matching/reconciliacion sobre movimientos de reserva con reglas 3.1 (un solo envio, ventana >=48h, expiracion).
- [x] Enviar notificacion transaccional con trazabilidad en `comunicaciones` y link SSR para continuar reserva.
- [x] Exponer vista en menú de Flujo de Trabajo: `Lista de Espera` (`/gestion-diaria/espera-disponibilidad`).
- [x] Hacer visibles estados de espera (con ID) en UI de gestión de estados.
- [ ] Ajustar copy final legal/comercial del correo y del consentimiento con texto aprobado por negocio.
- [ ] Ejecutar validación funcional E2E en entorno con datos reales.

## 5. Bitacora de planificacion

- 2026-05-05 - Tema creado en tablero y carpeta del tema. Se define fase 1 centrada en email con registro y matching basico.
- 2026-05-05 - ~~Implementado `noAvailabilityFollowupService` (provisional).~~ **Sustituido:** IA usa el mismo pipeline que el panel (`registrarEsperaDisponibilidadDesdeIa` en `esperaDisponibilidadService.js`). Consentimiento por chat no replicable: se registra **consentimiento implícito** en BD + metadata `consentimiento_implicito_ia`; **email obligatorio** (en `createBookingIntent` con bloqueo → **400** `WAITLIST_EMAIL_REQUIRED` si falta).
- 2026-05-05 - Acuerdo de producto: **un solo correo** por espera; notificar solo si el match cumple periodo + personas y **falta >= 48 h** hasta la fecha de llegada; sin envio antes de eso el registro pasa a **`expirada`**.
- 2026-05-05 - Implementado flujo principal del tema: migración `espera-disponibilidad.sql`, servicio `esperaDisponibilidadService`, rutas `/api/espera-disponibilidad/*`, integración en `Agregar propuesta`, reconciliación gatillada por movimientos de reservas/propuestas, ruta SSR `/reservar-desde-espera` y vista SPA de seguimiento.
