# Backlog de producto — pendientes e hitos

**Propósito:** lista viva de lo que falta por producto (no es definition-of-done por ticket). Actualizar al cerrar hitos o al priorizar sprints.

**Contexto reciente ya entregado (sesión 2026):** normas del alojamiento en SPA (`/normas-alojamiento`), API `houseRules`, reglas en ficha SSR con modal «Más información» bajo «Cosas que debes saber», misma UX en página SSR `/reservar`, JSON-LD alineado con `petsAllowed` / `smokingAllowed` desde normas mergeadas, fuentes SSR sin Google Fonts por CSP, panel admin (`frontend/index.html`) sin cargar Inter desde Google (evita choque CSP), plantillas de texto en normas.

---

## 1. Mensajería, correo transaccional y alertas

**Objetivo:** un módulo coherente de comunicaciones (huésped + operación interna), no solo piezas sueltas.

| Hito | Descripción | Base en código (punto de partida) |
|------|-------------|-----------------------------------|
| **1.1 Bandeja / historial de mensajes** | Vista SPA (o integración en CRM/cliente) para ver hilos, estado y reintentos. | `comunicacionesService.js`, tabla `comunicaciones`; API `GET /clientes/:id/comunicaciones` en `routes/clientes.js`. |
| **1.2 Correos transaccionales completos** | Confirmación de reserva, cancelación, modificación de fechas, recordatorio pre‑llegada, post‑estancia, consultas desde formulario web. La **solicitud de evaluación/reseña con reenvíos** va detallada en **1.7**. | `emailService.js` (Resend / mock); `gestionPropuestas.email.js` (`enviarEmailPropuesta`, `enviarEmailReservaConfirmada` + `registrarComunicacion`). Falta matriz de eventos y plantillas por tipo. |
| **1.3 Plantillas editables por evento** | Unificar con `plantillasService` / tipos de plantilla para cada evento (no solo propuesta/presupuesto). | `mensajeService.js`, `routes/mensajes.js` (`prepararMensaje`, generación de textos). |
| **1.4 Alertas gestión diaria** | Email o push interno: llegadas del día, salidas, limpieza, pagos pendientes, incidencias iCal, propuestas por vencer. | Hoy disperso; definir motor de reglas + cola (cron o job) y plantillas. |
| **1.5 Consultas desde web pública** | Formulario contacto → ticket + email al anfitrión + acuse al huésped. | Revisar `views/contacto.ejs` y rutas públicas; enlazar con `registrarComunicacion` o entidad “consulta”. |
| **1.6 Preferencias por empresa** | Remitente, reply‑to, desactivar categorías, idioma por defecto. | `emailService.inicializarConfigEmail` / config empresa. |
| **1.7 Evaluación y reseña post‑estancia (reenvío hasta completar)** | **Prioridad alta:** tras salida (o X horas después), enviar correo con enlace a **valoración / reseña** (Google u origen definido por empresa). Si el estado sigue **“pendiente de completar”**, **reenviar** con cadencia configurable (ej. día +3, +7, +14) hasta **completado** o **máximo de intentos** / **fin de ventana**; cada envío y apertura queda en **`comunicaciones`** con `evento` claro (`evaluacion-pendiente`, `evaluacion-completada`). No reenviar si ya existe **reseña publicada** para esa estancia/reserva o si el huésped marcó **no contactar**. Plantilla editable por evento (`plantillasService` + mapa evento→plantilla en config empresa). | `resenasService.js`, `comunicacionesService.js`, `plantillasService.js`, `emailService.js`; cola: `node-cron` en `backend/index.js` o job externo que consulte estancias cerradas sin evaluación completada. |

**Criterio de “módulo listo”:** todo evento crítico de reserva y operación tiene plantilla, envío, registro en `comunicaciones` y visibilidad en UI; **incluye** el flujo de **evaluación/reseña** con reintentos controlados hasta cierre o completado.

---

## 2. Tarifas: ofertas destacadas (SSR + marketplace)

| Hito | Descripción |
|------|-------------|
| **2.1 Modelo de oferta** | Tarifa base + “promo” (fechas, % o monto fijo, mínimo de noches, ventana de reserva). |
| **2.2 Señalización en SSR** | Badge “Oferta” / precio tachado + precio promo en `home`, ficha `propiedad`, widget reserva. |
| **2.3 Marketplace** | Misma metadata para tarjetas descubrimiento y ordenación por “mejor valor”. |
| **2.4 Reglas de conflicto** | Prioridad entre tarifas, canales y promos; no romper modo dual ni `valorHuesped`. |

---

## 3. Dominio propio por cliente (principal) + instructivo DNS

| Hito | Descripción |
|------|-------------|
| **3.1 Documentación en producto** | Wizard o panel: “En tu DNS (Nic Chile, Cloudflare, etc.) crea CNAME/ALIAS hacia …” con valores exactos devueltos por API Render. |
| **3.2 Automatización ya existente** | Registrar/verificar dominio en Render al guardar `websiteSettings` (flujo actual). | `renderDomainService.js`, `syncDomain` en `config.routes` / `home-settings`. |
| **3.3 Dominio “principal”** | Definir canonical, cookies `force_host`, redirección www↔apex, y comprobación de estado (pending / active). |
| **3.4 SSL y fallos** | UI de error claro si verificación falla; reintentar sync. |

---

## 4. Recomendaciones estilo OTA (Booking, Airbnb, Expedia, Agoda, Google Hoteles)

Módulos que suelen ser **esperados** en un PMS + web directa y que conviene valorar para el backlog:

| Módulo | Por qué importa |
|--------|------------------|
| **Políticas de cancelación** (tipos + plazos + texto legal) | Comparables en todas las OTA; hoy parcialmente “consulta al anfitrión”. |
| **Impuestos y tasas** (IVA, tasa municipal, fee limpieza) | Desglose en presupuesto y checkout; requisito en muchos mercados. |
| **Depósito de garantía / preautorización** | Integración pasarela (Stripe/Mercado Pago) vs. solo transferencia. |
| **Política de menores y camas extra** | Campos en reserva + precio por cama adicional. |
| **Feed de disponibilidad y precios** (ARI) | Export Google Hotels / channel managers; hoy hay piezas (Google Hotels service) pero no “producto cerrado”. |
| **Content API / parity de inventario** | Min/max estancia, cierre a llegada, bookable hasta X meses. |
| **Multi‑idioma** en SSR | hreflang + textos por locale (mínimo EN para marketplace). |
| **Mapa de calor / restricciones** (eventos locales → min noches) | Subidas de demanda (feriados). |
| **House manual digital** (PDF o página) | Adjunto post‑confirmación; complementa normas en web. |
| **Check‑in online** (datos huésped, documento, hora estimada) | Reduce fricción y fraude; común en Booking/Airbnb. |
| **Reviews outbound** (solicitud post‑estancia) | Ya hay flujo reseñas; enlazar con email y recordatorios. |
| **Comparador / parity con OTA** (opcional) | “Reserva directa X% más barato” si hay feed de precio externo (complejo). |

---

## 5. Orden sugerido de implementación (opinión)

1. **Correos transaccionales + comunicaciones UI** (amplía lo ya hecho en propuestas/reserva confirmada).  
2. **Dominio + guía DNS** (cierra confianza “marca blanca”).  
3. **Ofertas en tarifas + SSR/marketplace** (impacto directo en conversión).  
4. **Políticas de cancelación + checkout** (reduce disputas).  
5. **Alertas gestión diaria** (retención del operador).

---

## 6. Referencias rápidas en el repo

| Área | Archivos / rutas |
|------|------------------|
| Email | `backend/services/emailService.js` |
| Reserva / propuesta email | `backend/services/gestionPropuestas.email.js` |
| Textos con plantillas | `backend/services/mensajeService.js`, `backend/routes/mensajes.js` |
| Registro envíos | `backend/services/comunicacionesService.js` |
| Dominio Render | `backend/services/renderDomainService.js`, flujo `home-settings` en `backend/api/ssr/config.routes.js` |
| Google Hotels | `backend/services/googleHotelsService.js` (evolucionar hacia feed completo si aplica) |

---

*Última actualización: 2026-04-21.*
