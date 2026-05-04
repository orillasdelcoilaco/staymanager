# Google Hotels — estrategia tras respuesta comercial (partner directo)

**Última actualización:** 2026-05-04  
**Relacionado:** `TASKS/venta-ia.md` §7, §7.0 · `TASKS/google-hotels-partner-deploy-checklist.md` · `TASKS/gemini-smoke-instrucciones.md`

---

## 1. Qué respondió Google (2026-05)

Correo de **gTech Customer Experience** (firma Varsha), en respuesta al interés en integración **directa** como connectivity partner:

- Por **volumen de solicitudes**, **no** pueden integrar **directamente** con SuiteManager / solicitudes nuevas similares.
- Recomiendan enviar **tarifas y disponibilidad** a través de un **integration partner** (channel manager u otro proveedor ya conectado a Google).
- Enlace a listado de partners ya integrados con Google (portal oficial).
- **Ticket de referencia:** `7-9095000040551` (para soporte interno; no exponer datos sensibles en commits públicos).

Esto **no** invalida la calidad técnica del trabajo en feeds, DNS ni panel; cambia la **vía comercial** para aparecer en Google Travel como **inquilino** de un ecosistema ya aprobado por Google.

---

## 2. Decisión de producto (acordada)

| Decisión | Detalle |
|----------|---------|
| **Pausar** | El objetivo comercial **“Connectivity Partner directo ante Google”** queda **en espera** hasta que el volumen de negocio / prioridad lo justifique de nuevo. |
| **Preservar** | **No** eliminar el código del **módulo partner en plataforma** (`/feeds/google/*`, agregador, catálogo `/google-hotels`, panel Canales IA, smokes, health). Sigue siendo **activo en código** y útil como: demostración técnica, **fuente maestro** si más adelante Google reabre la puerta, o base para **paridad de datos** con un CM. |
| **Nueva vía prioritaria** | Integración con un **proveedor ya listado por Google** (channel manager). Referencia operativa mencionada para **Orillas del Coilaco:** **Beds24**, con **orden de magnitud** de costo **~10–20 USD/mes** — **no** es presupuesto oficial; hay que **validar** plan y precio en Beds24 (u otro CM) en el momento del proyecto. |
| **Futuro módulo** | Un **módulo nuevo** (adaptador) que sincronice SuiteManager ↔ CM elegido (API/webhooks del proveedor), sin sustituir el motor de reservas ni el checkout SSR del tenant. Alcance y diseño **cuando** se priorice el hito. |

---

## 3. Inventario técnico (qué queda “congelado” pero mantenido)

| Área | Ubicación / notas |
|------|-------------------|
| Agregador global Property List + ARI | `backend/services/googleHotelsGlobalService.js`, `googleHotelsPartnerFeeds.js` |
| Rutas partner | `backend/routes/googleHotelsPartner.routes.js`; montaje en `backend/index.js` **antes** del catch-all SPA |
| Feeds por tenant | `backend/services/googleHotelsService.js`, `backend/routes/website.seo.js` |
| Helpers XML / imagen / geo | `backend/services/googleHotelsPartner/feedPropertyListBlock.js`, `feedImageUrl.js`, `propertyFeedGeo.js`, `publicBookingUrl.js` |
| Health + catálogo | `googleHotelsHealthService.js`, `marketplace` `/google-hotels` |
| Panel | `frontend/src/views/canalesIa.js`, operador partner / selftest |
| Smokes | `npm run smoke:partner-feeds`, `backend/scripts/smoke-google-partner-feeds-http.js`, `test-google-partner-feeds-smoke.js` |
| Variables entorno | `GOOGLE_PARTNER_FEED_AUTH_TOKEN`, hosts `feeds.*`, etc. — ver `.env.example` y `venta-ia.md` §7.9 |

**Principio:** mantener **tests verdes** y **sin regresiones** en checkout / multi-tenant al tocar otros módulos.

---

## 4. Alternativas estratégicas (sin orden impuesto)

1. **Channel manager** (ej. Beds24, Cloudbeds, Otros en la lista Google): SuiteManager empuja inventario/tarifas al CM; el CM habla con Google. Coste recurrente por propiedad/canal según proveedor.
2. **Solo presencia orgánica** (SEO, JSON-LD, sin paid Google Travel) mientras crece la base de clientes — el código partner sigue disponible sin activar trámite Google.
3. **Reintentar partner directo** años después si Google cambia política y hay volumen/caso de negocio fuerte — el repo ya tiene la base técnica.

---

## 5. Próximo módulo (cuando se priorice): integración CM

Checklist de alto nivel para un futuro PR / discovery:

1. Elegir proveedor (API estable, precio, cobertura Chile/LATAM si aplica).
2. Mapear **propiedad**, **tarifas**, **inventario**, **restricciones** ↔ modelo SuiteManager (sin tocar `valorHuesped` ni fuentes financieras inmutables).
3. Definir **dirección de sincronización** (SuiteManager → CM es lo habitual para “master” interno).
4. Seguridad: credenciales solo `process.env`, aislamiento `empresa_id`.
5. Documentar en `TASKS/venta-ia.md` y backlog §5.3.

---

## 6. Qué comunicar al equipo / clientes

- La **plataforma sigue teniendo** feeds y catálogo para demos y calidad de datos.
- **Publicación en Google Travel** pasará por un **tercero homologado** hasta nueva política de Google o decisión de reintentar partner directo.
- **Costos** del CM son **del operador** (ej. alojamiento), no “ocultos” en SuiteManager — transparencia en onboarding.

---

*Documento de contexto comercial y técnico; no sustituye a acuerdos legales con Google ni con proveedores terceros.*
