# Plan de release **1.0.0** — flujo «cerrar lo básico → luego lo complejo»

**Objetivo:** una **1.0.0 probada de punta a punta** (sin medias tintas en lo que declaramos incluido). Nada de «parcial» dentro del perímetro de 1.0.0: si no está listo para QA manual mínima + `npm run test:ci` verde, **no entra** en el tag.

**Principio de trabajo:** terminar un ítem antes de abrir el siguiente. **Varios agentes:** leer primero **`TASKS/leer-primero.md`** (reparto y lecturas). El **tag 1.0.0** cierra el **núcleo §1** de esta tabla + smoke §2; el código ya incluye entregas posteriores al plan original (§4.3 B/C en repo); lo que **no** esté probado en smoke §2 o fuera de la tabla §1 sigue siendo **post-tag** salvo decisión explícita de ampliar el perímetro.

**Estado automatizado (Agente A — 2026-04-25):** `npm run test:ci` ampliado en `package.json` raíz: incluye además de JSON-LD/marketplace/ARI/Google Hotels/comparador/heatmap/digest/subdominio/restricciones/sanitize alojamiento los scripts alineados al smoke §2 (booking sanitize, líneas extra, legal política cancelación, coherencia desglose, política por tarifa, presupuesto desglose, reconciliación precio web, contrato metadata creación reserva, parse valores confirmación, evento `reserva-confirmada` ↔ comunicaciones, sanitize `integrations`). Ejecutar en la rama que se etiquete; GitHub Actions (`.github/workflows/ci-smoke.yml`) corre `npm run test:ci` en PR/push a `main`/`master`. Opcional: `npm run test:ssr` con SSR en marcha (`localhost:3001`) si se tocaron vistas públicas.

---

## 1. Qué **sí** entra en 1.0.0 (núcleo «direct booking» + operación mínima)

Criterio: el anfitrión puede **configurar**, el huésped puede **reservar en web pública** (SSR y/o widget según lo que usen), y el equipo ve **reserva + correos + desglose** coherentes.

| Bloque | Incluido en 1.0.0 | Verificación |
|--------|-------------------|----------------|
| **Legal / checkout** | Política cancelación (modos + por tarifa + multi-tarifa restrictiva o mayoría de noches + bloques largo), líneas extra (incl. `por_persona_noche`), coherencia %, términos si `publicado`, IVA/desglose según `modelo` | Panel unificado guarda sin 400; SSR `/reservar` + `/confirmacion` muestran lo mismo que API |
| **Precio web** | `calculatePrice`, preview checkout, reconciliación (1 propiedad y grupo), cupón % y `monto_fijo`, menores/camas si configurados | `test-reconciliacion-precio-reserva-web.js` + flujo manual con cupón |
| **Restricciones estadía (fase A)** | Min/max noches, anticipación, ventana meses; calendario + `crearReservaPublica` + `calcular-precio` | `test-reserva-web-restricciones.js` + elegir fechas fuera de rango → mensaje claro |
| **Correo transaccional** | Confirmación reserva web, matriz documentada, preferencias categorías/idioma donde ya está cableado | Bandeja `/comunicaciones` muestra envío; idioma EN si `idiomaPorDefecto` |
| **Dominio / SSL** | Canónico, sync Render, panel estado + DNS hint | Dominio de prueba: `domain-status` coherente |
| **House rules / normas** | SPA + SSR + JSON-LD alineado | Ficha y `/normas-alojamiento` |
| **Presupuesto** | Desglose en texto + JSON cuando aplica | Plantilla / generación con placeholders |

**Fuera del núcleo §1 para el tag** (sigue en `backlog-producto-pendientes.md`): depósito pasarela (**§4.3 D**), Content API Google completa, mapa calor, comparador OTA, métricas iCal en PG (**§1.4**), wizard DNS legacy (**§3.1**), marketplace i18n global completo. ~~Widget fechas embebidas~~ **Hecho (2026-04-24):** `widget-reserva-embed.js` `data-ui-fechas` + ayuda JSON (sigue fuera del smoke §1 salvo que lo añadan al checklist).

**Nota 2026-04-24:** §4.3 **B** (cancelación multi-tarifa / copy) y **C** (identidad check-in web, retención, multi-huésped, reseña outbound, etc.) están **en código**; no sustituyen el smoke §2: lo incluido en 1.0.0 sigue siendo **lo verificado** en la tabla §1 + checklist §2.

Si el negocio **recorta** y mete algo de esa lista en 1.0.0, debe añadirse aquí **y** cerrarse con criterio de prueba explícito (no dejar «parcial»).

---

## 2. Definición de «listo para tag 1.0.0»

1. **`npm run test:ci`** en verde en la rama que se etiqueta. **Hecho (2026-04-25):** cadena completa verde en `main` candidata local; ver lista exacta en `package.json` → `scripts.test:ci`.
2. **`npm run test:ssr`** con el **servidor SSR en marcha** (`localhost:3001`). El script `backend/scripts/verify_ssr_integrity.js` lee **`SSR_VERIFY_BASE_URL`**, **`SSR_VERIFY_FORCE_HOST`** y **`SSR_VERIFY_PROPERTY_ID`** desde `backend/.env` (ver `backend/.env.example`): deben coincidir con un **tenant real** y un **UUID de propiedad** de esa empresa; si no, la respuesta es el shell del panel y el check falla con mensaje explícito. *(Opcional para el tag; no sustituye el smoke manual §2.3.)*
3. **Smoke manual mínimo** (una empresa de staging, una propiedad, una tarifa con promo opcional):

   **Núcleo ya alineado en código (2026-04-24):** la ficha SSR usa `mergeRestriccionesBookingEmpresaUnaPropiedad` (misma regla que `crearReservaPublica` / `calcular-precio`); calendario público y `booking.js` leen esos mismos límites (`data-*` + `data-booking-config` + `initialBookingData` con max/anticipación/ventana). Preview checkout: `checkout.js` → `POST /preview-precio-reserva-checkout`. Creación: `POST /crear-reserva-publica` (respuesta **201**) con restricciones + reconciliación + `metadata` (política, precio verificado, menores/camas si aplica). Confirmación: `GET /confirmacion` con desglose desde `legal` + noches/huéspedes de la fila y aviso de política desde snapshot en `metadata` cuando existe.

   - [ ] Configurar legal + líneas extra + restricciones `booking` en panel unificado → guardar OK. *(Cobertura en CI: `bookingSettingsSanitize` + `test-booking-settings-sanitize.js`; el panel evita guardar si la estadía máxima (noches) es menor que la mínima; el servidor devuelve 400 si llega incoherente; `empresaService` hace merge profundo de `legal.desglosePrecioCheckout` al persistir.)*
   - [ ] Ficha SSR: calendario respeta min/max y anticipación; total alineado a checkout. *(CI: `test-reserva-web-restricciones.js` incluye asserts de `mergeRestriccionesBookingEmpresaUnaPropiedad`.)*
   - [ ] `/reservar` → completar datos → confirmar precio con preview si usan cupón/recargos. *(Con menores/camas activos en empresa, `checkout.js` llama a `POST /preview-precio-reserva-checkout` al cargar y al cambiar menores/camas/email/cupón; antes el preview solo se activaba si además había recargo CLP mayor que cero.)*
   - [ ] `POST` crear reserva pública → **201**, reserva en PG, `metadata` de checkout/política coherentes. *(CI: `test-reconciliacion-precio-reserva-web.js` + `test-crear-reserva-web-metadata-contract.js`; `checkout.js` usa `response.ok` (incluye 201). Inserción PG: `nombre_cliente` desde el formulario, `valores.valorHuesped`, `metadata` con `origen`, política, `precioCheckoutVerificado` y bloques opcionales menores/camas/grupo.)*
   - [ ] Correo de confirmación recibido (o registro `comunicaciones`). *(Motor `reserva_confirmada`: `enviarPorDisparador` registra `comunicaciones` con evento `reserva-confirmada` (ver `EVENTO_POR_DISPARADOR` + `test-confirmacion-reserva-comunicaciones.js`). Plantilla legada: si SMTP falla, ahora también se registra fila `fallido` antes del error. Proveedor real sigue siendo prueba manual en staging.)*
   - [ ] `/confirmacion` muestra desglose y política acordes a la reserva. *(`GET /confirmacion`: total desde `valores` parseado si PG devuelve string JSON, respaldo `metadata.precioCheckoutVerificado`; política desde snapshot `metadata.politicaCancelacionCheckout` + aviso; fechas formateadas con `htmlLang`; CI: `test-confirmacion-valores-parse.js` + `reservaRowValores.js`.)*

4. **Sin tareas abiertas** etiquetadas «bloquea 1.0.0» en el tablero interno (si usan uno).

### 2.1 Cobertura CI ↔ checklist §2.3 (automatizado vs manual)

| Punto §2.3 | CI (`npm run test:ci`) | Manual staging |
|------------|-------------------------|------------------|
| Config legal + líneas extra + booking (min/max…) | `test-booking-settings-sanitize.js`, `test-lineas-extra-validation.js`, `test-legal-politica-cancelacion.js`, `test-desglose-coherencia.js`, `test-propiedad-booking-sanitize.js` | Flujo panel → guardar sin 400 con datos reales |
| Ficha calendario / restricciones | `test-reserva-web-restricciones.js`, `test-heatmap-restricciones.js` | Elegir fechas fuera de rango en UI |
| Preview checkout / cupón / recargos | `test-reconciliacion-precio-reserva-web.js` (tolerancia + fórmulas) | `/reservar` + preview en navegador |
| POST crear reserva + metadata | `test-crear-reserva-web-metadata-contract.js` | **201** real + fila PG |
| Correo / comunicaciones | `test-confirmacion-reserva-comunicaciones.js` (evento) | SMTP o fila en `/comunicaciones` |
| `/confirmacion` valores | `test-confirmacion-valores-parse.js` | Vista SSR con reserva real |

Los checkboxes de la lista §2.3 siguen siendo la **fuente de verdad operativa**; la columna CI reduce regresiones antes del tag.

---

## 3. Orden de ejecución recomendado (hasta el tag)

1. Congelar alcance: esta sección + tabla §1; cualquier extra = nueva minor o post-1.0.
2. Cerrar huecos **solo** si impiden un checkbox de §2 (prioridad: reserva web + panel + correo).
3. Correr CI + smoke §2.
4. Tag `v1.0.0` + notas de release (qué probamos, qué queda explícitamente fuera). **Notas mínimas (2026-04-25):** perímetro = tabla §1 + verificación §2; explícitamente **fuera** del tag lo listado en §1 «Fuera del núcleo §1» (§4.3 D dura, métricas iCal PG, i18n marketplace completo, etc.). **Tag local:** ya existe **anotado** `v1.0.0` en el commit de puerta técnica CI (`chore(release): gate 1.0.0 — test:ci ampliado…`). Si el smoke §2.3 en staging detecta fallos, borrar y recrear el tag en el commit corregido (`git tag -d v1.0.0` luego `git tag -a …`). **No** hacer `git push origin v1.0.0` hasta completar smoke manual y acuerdo de integración (`TASKS/leer-primero.md` §5.1).

---

## 4. Después del tag (orden sugerido, sin mezclar con cierre 1.0)

| Orden | Tema | Referencia |
|-------|------|--------------|
| ~~1~~ | ~~§4.3 **B**~~ | **Hecho en código (2026-04-24)** — ver backlog §4.3 fase B. |
| ~~2~~ | ~~§4.3 **C**~~ | **Hecho en código (2026-04-24)** — ver backlog §4.3 fase C. |
| 1 | §4.3 **D** — parity dura (depósito, Google, mapa calor, comparador) | `backlog-producto-pendientes.md` §4.3 |
| 2 | **§5 backlog** — preferencias/copy motor (**§1.6**); luego §3, §2.3, §1.4 según prioridad | Mismo §5 |
| 3 | Cierre operación: iCal métricas PG, widget fechas, DNS legacy, i18n marketplace | §132 backlog |

---

## 5. Mantenimiento de este documento

Al cerrar un hito que mueva el perímetro de 1.0.0, actualizar **§1** y la fecha al pie del `backlog-producto-pendientes.md`. §4.3 **D** y el resto del backlog **no** redefinen 1.0.0 salvo release mayor acordada.

*Última actualización: 2026-04-25 — `test:ci` ampliado al perímetro smoke §2 (scripts en `package.json`); tabla §2.1 CI vs manual; recordatorio push tag vía sesión integradora.*
