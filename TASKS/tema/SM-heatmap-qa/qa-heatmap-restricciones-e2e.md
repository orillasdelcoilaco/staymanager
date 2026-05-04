# QA Checklist — Mapa de calor y restricciones (`heatmap[]`)

Objetivo: validar de punta a punta, en tenant real, que el mapa de calor (eventos locales) impacta correctamente la disponibilidad visual y las restricciones efectivas de estadía mínima por fecha de llegada.

## 1) Prerrequisitos

- Backend SSR arriba y tenant resoluble por host/subdominio.
- Empresa con al menos 2 propiedades publicadas para prueba.
- Acceso a panel para editar `websiteSettings.booking.eventosDemandaMapaCalor`.
- Fechas de prueba dentro de próximos 30-90 días (evitar fechas históricas).

## 2) Datos de prueba recomendados (por tenant)

Definir al menos 2 eventos:

- Evento A (demanda alta): rango de 3-5 días, `minNochesLlegada` mayor al mínimo base (ej. base 1, evento 3).
- Evento B (demanda media): rango distinto, `minNochesLlegada` intermedio (ej. 2).

Definir 2 propiedades:

- Propiedad 1: restricciones base permisivas (mínimo base bajo) para observar claramente el efecto del heatmap.
- Propiedad 2: restricciones base más exigentes para validar que se aplique `max(minNoches base, minNoches mapa)`.

## 3) Casos E2E — Configuración y persistencia

- [ ] Guardar eventos en panel unificado sin errores de validación.
- [ ] Reabrir configuración y verificar que las filas se mantienen saneadas (sin cambios inesperados).
- [ ] Confirmar que el orden y campos editados coinciden con lo ingresado.

## 4) Casos E2E — API calendario ocupación

- [ ] `GET /propiedad/:id/calendario-ocupacion` responde `200`.
- [ ] Respuesta incluye `heatmap[]` cuando hay eventos vigentes en rango.
- [ ] Cada entrada relevante de `heatmap[]` contiene `fecha`, `nivel`, `minNochesLlegada` y `motivos`.
- [ ] Fechas fuera de evento no muestran `minNochesLlegada` de evento.

## 5) Casos E2E — UX calendario SSR

- [ ] Calendario público muestra overlay/indicador visual en días con evento.
- [ ] Tooltip o mensaje contextual comunica temporada/demanda y mínimo asociado.
- [ ] El usuario distingue claramente días sin evento vs con evento.

## 6) Casos E2E — Restricción efectiva en checkout/precio

Para cada propiedad:

- [ ] Intentar llegada en fecha con evento y noches menores al mínimo efectivo -> debe bloquear o rechazar con mensaje claro.
- [ ] Intentar llegada en fecha con evento y noches iguales al mínimo efectivo -> debe permitir.
- [ ] Intentar llegada fuera de evento con noches según mínimo base -> comportamiento coherente.
- [ ] Verificar que el mínimo efectivo respeta `max(minNoches base, minNoches mapa)`.

## 7) Mensajería y copy (validación funcional)

- [ ] Mensaje de bloqueo por mínimo de noches es entendible para usuario final.
- [ ] Mensaje identifica que la regla depende de la fecha de llegada/temporada.
- [ ] No hay mensajes ambiguos o contradictorios entre calendario, widget y checkout.

## 8) Regresión mínima automatizada

- [ ] `node backend/scripts/test-heatmap-restricciones.js`
- [ ] `node backend/scripts/test-reserva-web-restricciones.js`
- [ ] `npm run test:ci`

## 9) Evidencia por tenant (completar al ejecutar)

- Tenant:
- Fecha ejecución:
- Responsable:
- Propiedad 1:
- Propiedad 2:
- Capturas/logs:
- Incidencias:
- Decisión:
  - [ ] Aprobado sin cambios
  - [ ] Aprobado con ajustes menores de copy/UX
  - [ ] Requiere corrección antes de cerrar §4.3 D

## Resultado esperado

Checklist en verde para 2 propiedades reales por tenant, con copy/mensajería coherente y sin regresiones en pruebas automatizadas.

## 10) Registro de ejecución (2026-04-28)

- Automatizado local:
  - `node backend/scripts/test-heatmap-restricciones.js` -> OK
  - `node backend/scripts/test-reserva-web-restricciones.js` -> OK
  - `npm run test:ci` -> OK
- Pendiente para cierre completo:
  - QA manual E2E en tenant real (2 propiedades) + evidencia en sección 9.

## 11) Plantilla express (15 min) — completar en terreno

Usar esta plantilla para una pasada rápida por tenant. Marcar y dejar una nota corta por cada punto.

### Propiedad 1

- [ ] 1. Guardado panel OK (`eventosDemandaMapaCalor`)  
  Nota:
- [ ] 2. API calendario incluye `heatmap[]` esperado  
  Nota:
- [ ] 3. Calendario SSR muestra overlay/tooltip correcto  
  Nota:
- [ ] 4. Llegada en evento con noches menores al mínimo -> bloqueo claro  
  Nota:
- [ ] 5. Llegada en evento con noches iguales al mínimo -> permite  
  Nota:
- [ ] 6. Copy/mensaje entendible para usuario final  
  Nota:

### Propiedad 2

- [ ] 1. Guardado panel OK (`eventosDemandaMapaCalor`)  
  Nota:
- [ ] 2. API calendario incluye `heatmap[]` esperado  
  Nota:
- [ ] 3. Calendario SSR muestra overlay/tooltip correcto  
  Nota:
- [ ] 4. Llegada en evento con noches menores al mínimo -> bloqueo claro  
  Nota:
- [ ] 5. Llegada en evento con noches iguales al mínimo -> permite  
  Nota:
- [ ] 6. Copy/mensaje entendible para usuario final  
  Nota:

### Cierre express

- [ ] Aprobado tenant (sin cambios)
- [ ] Aprobado tenant (con ajustes menores de copy/UX)
- [ ] No aprobado (requiere corrección antes de cerrar §4.3 D)
- Ajustes propuestos (si aplica):

