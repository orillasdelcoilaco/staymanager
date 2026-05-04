# Venta por IA — línea de trabajo unificada

**Propósito:** una sola referencia para **roadmap, pendientes y análisis** de la venta asistida por IA y los canales externos (ChatGPT / OpenAPI, Google Hotels & Travel, MCP, middleware tipo SelfBook, presencia en motores de respuesta y, más adelante, redes / mensajería comercial).  

**Posicionamiento — venta vs operación**

- **Venta / distribución:** SuiteManager es el **canal de venta principal** del operador (web propia + API pública + IAs, etc.). **No** se planea usar **OTAs de terceros** (p. ej. agregadores tipo Booking/Expedia) como **canal de venta** del operador ni como intermediario que cobre la reserva en nombre del operador.  
- **Excepción explícita — Google Hotel Center como plataforma:** para cumplir el rol de **Connectivity Partner** ante Google hace falta una **superficie técnica agregada** (feed único + URLs de descubrimiento bajo el dominio de la **plataforma**), sin que eso convierta a SuiteManager en “OTA”: el **cierre de la reserva** sigue siendo el **checkout / motor del tenant** (deep link a `tenant`/dominio custom). Es **descubrimiento y cumplimiento de políticas Google** (Price Accuracy, Entity Matching), no reventa vía tercero. Detalle y backlog: **§1.1** y **§7**.  
- **Operación / unificación (fuera del alcance “venta por OTA”):** lo que **sí** sigue en el producto y **no** cuestiona este archivo: **sincronizar e importar reservas** que vienen de otras fuentes (iCal, reportes/canales ya definidos, calendario, etc.) para que el PMS tenga **una sola vista operativa**. Eso es **ingesta y calendario**, no “vender a través de Booking/Expedia”.  

**Enfoque:** **evolucionar y ajustar** lo ya construido (API pública, SSR, JSON-LD, feeds, panel), **no** arrancar de cero. El **cambio de estrategia Google** (partner único + módulo separado) se implementa **sin desmontar** el SSR por tenant ni los feeds por tenant durante la transición.

**Automatización (producto):** objetivo **máxima automatización** para cada tenant en canales IA, feeds y flujos públicos: URLs generadas, tokens en panel, ayudas (`widget-reserva-ayuda.json`), verificación reproducible. La **intervención manual del cliente** debe **acotarse** a lo que un tercero exija por contrato o cuenta (p. ej. pasos en Google Hotel Center): ahí el producto debe ofrecer **checklist corto**, textos copiables y estado claro — no procesos largos sin guía.

**Relación con otros documentos**

| Documento | Rol |
|-----------|-----|
| `TASKS/backlog-producto-pendientes.md` | Roadmap general del producto; la sección **§5.3** remite aquí para el detalle de canales IA. |
| `TASKS/coordinacion-cursor-claude-ia-venta.md` | Locks, zona caliente (precios, `publicAiController`, OpenAPI), handoffs y bitácora cuando el cambio afecta al agente o a contratos públicos. |
| `TASKS/checklist-onboarding-google-hotel-center.md` | Onboarding operativo Google Hotel Center por tenant (incl. §9 verificación HTTP/XML). |
| **Panel SPA «Canales IA»** | **Operaciones → Canales IA** (`/canales-ia`): tokens ARI / Google Hotels content, semáforo operativo, tabla por alojamiento (`hotelId`, listado), bloque provisional **feeds globales partner** (selftest HTTP, §8); **`TASKS/checklist-onboarding-google-hotel-center.md`** enlaza aquí para dónde configurar en producto. |
| `TASKS/qa-feed-ari-checklist.md` | QA del feed ARI. |
| `TASKS/qa-heatmap-restricciones-e2e.md` | QA E2E mapa de calor (afecta conversión web / coherencia con API pública). |
| `chatgpt_integration_summary.md` | Resumen histórico ChatGPT + MCP; contrastar rutas con el código actual (`openapi/`, `ai/openai/mcp-server/`). |
| `TASKS/plan-gestion-propiedades.md` | Contexto JSON-LD / SEO en el flujo de alojamientos (complementario, no sustituye este archivo). |
| **`TASKS/plan-reorganizacion-menu-spa.md`** | **Única referencia** menú SPA (taxonomía, fases, handoff). Entrada de lectura: **`LEER-PRIMERO.md`** → tabla estándares → fila **Menú SPA**. **No** modifica «Flujo de Trabajo». |
| **`TASKS/qa-y-seguimiento-prelaunch-canales.md`** | QA panel tras cambios menú/Canales IA (**Parte 1**) y orden de trabajo **Google + OpenAPI** (**Parte 2**); enlaza con §4 de este archivo. Tras el enfoque partner (§7), Parte 2 distingue URL **tenant** vs **plataforma**. |

**Responsable del carril (acuerdo 2026-04-29):** implementación y contratos **solo Cursor** — chat Agent dedicado opcional; regla `.cursor/rules/45-canales-venta-solo-cursor.mdc` si aplica.

---

## 1. Meta de producto (panorama técnico)

SuiteManagers ya tiene **base sólida**. La jugada coordinada es:

1. **API estable (+ OpenAPI 3.1)** → ChatGPT Actions / Gemini / cualquier cliente que consuma el mismo backend.  
2. **JSON-LD + feeds (ARI, content Google Hotels)** → Google AI Mode / Hotel Center / indexación utilizable por IAs.  
3. **SSR** → visibilidad orgánica y contenido citab por motores e IAs.  
4. **Servidor MCP propio** (evolución sobre API existente) → presencia en el ecosistema MCP (Claude Desktop, IDEs, herramientas compatibles) **sin** depender de un solo intermediario cerrado.

**1.1 Google Hotels — dirección acordada (2026-05-02)**

| Principio | Qué significa |
|-----------|----------------|
| **Partner único ante Google** | Un conjunto de URLs **bajo el dominio de la plataforma** (no una URL por tenant) para los feeds que Google espera del connectivity partner. |
| **Módulo separado** | Nuevo código en rutas/servicios **acotados** (p. ej. router dedicado `backend/routes/googleHotelsPartner.*` o carpeta `backend/services/googleHotelsPartner/` — nombre final al implementar). **Prohibido** mezclar la agregación global con el middleware SSR por tenant (`tenantResolver` en sitio del operador). |
| **SSR por tenant intacto** | Cada empresa sigue con su sitio público, fichas y `feed-ari.xml` / `feed-google-hotels-content.xml` en su host **mientras** exista transición o política de doble publicación; no se “destruye” esa superficie. |
| **Página / catálogo central** | Una **landing de descubrimiento** (estilo marketplace) en dominio plataforma que liste propiedades **opt-in** (`isListed`, datos completos) de **todos los clientes**, enlazando con **DeepLink** al checkout/fechas del tenant (`subdominio.plataforma.tld` o dominio custom + query estable). Complementa el marketplace existente (`GET /api/search.json`, vistas marketplace); puede reutilizar datos pero **UI y rutas** del módulo partner deben quedar claras en implementación. |
| **Cumplimiento Google** | Price Accuracy (coherencia XML ↔ checkout), Entity Matching (Place ID, lat/lng, dirección), inventario real, moneda ISO 4217 — backlog técnico en **§7**. |
| **Hub de distribución** | Rol explícito validado por asesoría externa (2026-05): misma lógica que channel managers grandes — **una fuente maestro** para Google + deep links al motor del tenant (**§7.8**). |

**1.2 Contexto operación SuiteManagers — acuerdo equipo (2026-05-03)**

Documentación **para humanos y agentes**: usar estos datos en ejemplos y checklists (evitar placeholders genéricos tipo “tu-dominio.com” o “algo.onrender.com” cuando el contexto sea esta plataforma).

| Tema | Valor acordado |
|------|----------------|
| **Sitio / marca web plataforma** | `https://www.suitemanagers.com` y **`https://suitemanagers.com`** (apex) — referencia para marketing y **marketplace SSR** (misma app Render). Catálogo Google Hotels partner: **`/google-hotels`** en esos hosts (`backend/routes/marketplace.js`). |
| **DNS dominio `suitemanagers.com`** | **GoDaddy** — panel DNS del registrador (`www`, **`feeds`**, apex `@`). **No** es Google Hotel Center: en Google solo se **indican las URLs finales** de los feeds; los registros DNS se configuran en GoDaddy. **Hecho (2026-05, operación):** el **`A` en `@`** que apuntaba a *Website Builder* de GoDaddy se sustituyó por la **IP de Render** indicada en Custom Domains (**`216.24.57.1`** en el despliegue actual). El **`CNAME` `www`** apunta a **`suite-manager.onrender.com`** (según pantalla Render “Add DNS records”). Con eso el apex deja de servir la plantilla GoDaddy y el tráfico llega al backend (marketplace + resto). **Nota:** en Render `www` puede figurar **Pending** un tiempo aunque el navegador ya devuelva 200; revalidar en el panel hasta **Verified**. |
| **Infra despliegue** | **Render** — el backend que sirve SPA, API y feeds debe quedar alineado con el código en GitHub. |
| **Patrón URL por empresa (sitio del operador)** | `https://<subdominio>.suite-manager.com` — cada tenant vive en su subdominio. **Nota código:** en el repo el default de `PLATFORM_DOMAIN` es `suitemanagers.com` (sin guión). Si en producción el host real de tenants es `suite-manager.com`, definir **`PLATFORM_DOMAIN=suite-manager.com`** en Render para que URLs generadas, marketplace y ejemplos coincidan con DNS. |
| **Tenant de referencia (multicanal / pruebas)** | `https://orillasdelcoilaco.suitemanagers.com` (y variante `suite-manager.com` si DNS lo usan) — caso completo: web, Canales IA, tokens ARI + contenido Google Hotels, smoke `verify-google-hotels-feed-checklist.js`. |
| **Feeds partner (Google Connectivity)** | Rutas técnicas: `/feeds/google/properties.xml` y `/feeds/google/ari.xml` bajo el **hostname** que permita el backend (por defecto en código: `feeds.suitemanagers.com` o `api.suitemanagers.com`; ver **§7.9** y `GOOGLE_PARTNER_EXTRA_HOSTS` si el tráfico entra por el hostname del servicio Render hasta tener CNAME `feeds.`). Para el botón **Probar feeds HTTP** en panel: `GOOGLE_PARTNER_FEED_SELFTEST_BASE_URL` = URL base **pública real** que llega a ese mismo backend (ej. la que use Render una vez configurada). |
| **Flujo código → producción** | **Norma operación:** al cerrar un bloque útil de trabajo en **Cursor**, el agente hace **commit y push a GitHub** (`main` o la rama acordada del repo) para que **Render** pueda desplegar; **no** dejar el código solo en local salvo pausa explícita del usuario. Mantener Render al día con ese remoto para pruebas cercanas a producción (feeds, panel, API). |
| **Dónde probar** | Proyecto en **desarrollo**: probar en local o en Render es equivalente a nivel producto; **prioridad operativa**: tener Render actualizado para validaciones finales. |

**Para agentes (Cursor, etc.):** (1) Al explicar despliegue o variables, citar URLs de **§1.2**, no placeholders anónimos. (2) Tras cambios de código relevantes, **subir a GitHub** (commit + push) como parte del cierre de la tarea, salvo que el usuario pida explícitamente no hacer push en esa sesión.

**Canales concretos a priorizar (negocio + técnica)**

| Prioridad | Canal | Objetivo |
|-----------|--------|----------|
| 1 | **Google Travel / Hotel Center (connectivity partner)** | Pasar de feeds **solo por tenant** a **feed agregado global** + landing plataforma + refuerzo de calidad (impuestos, inventario, Place ID, bypass verificador). Proceso externo Google (aprobación partner) en paralelo. Los feeds por host tenant pueden mantenerse en transición — ver **§7**. |
| 2 | **ChatGPT Actions / OpenAI** | Mantener **`openapi/openapi-chatgpt.yaml`** alineado a rutas reales; pruebas del agente; políticas de uso. |
| 3 | **Perplexity + middleware (ej. SelfBook)** | Contacto comercial y, cuando exista acuerdo, adaptador (webhooks, OAuth, catálogo) según especificación del partner. |
| 4 | **MCP (Model Context Protocol)** | Unificar/evolucionar servidor MCP sobre la misma lógica que la API (hoy código en **`ai/openai/mcp-server/`**; decisión abierta en coordinación **§8** sobre `backend/mcp/` + SDK si producto aprueba). |
| 5 | **Redes y mensajería** (Meta/WhatsApp/IG según `coordinacion` §9 tier 2–3) | Reutilizar `publicAiController` y reglas tenant; no duplicar lógica de precios/reserva. |

---

## 2. Lo ya construido (inventario — 2026-05)

### 2.1 Superficie pública y datos estructurados

- **SSR** multi-tenant con SEO, copy EN/ES ampliado en vistas clave, `hreflang` / `og:locale` donde corresponde.  
- **JSON-LD** en ficha y flujos relacionados; normas (`petsAllowed` / `smokingAllowed`) alineadas con SSR y datos públicos.  
- **Marketplace** global con API `GET /api/search.json`, ordenamiento, i18n UI parcial.  
- **Widget / embed** (`widget-reserva-embed.js`, ayuda JSON, tarifa opcional).

### 2.2 Feeds y Google Hotels (lado servidor)

- **ARI:** `GET /feed-ari.xml` con modos (`website` \| `google_hotels`), ventana `days`, token opcional por empresa.  
- **Google Hotels content:** `GET /feed-google-hotels-content.xml` (Property List), token opcional.  
- **Ayuda integradores:** `GET /widget-reserva-ayuda.json` con ejemplos.  
- **Script de verificación:** `backend/scripts/verify-google-hotels-feed-checklist.js` + checklist en `TASKS/checklist-onboarding-google-hotel-center.md` §9.  
- **Integraciones en panel:** URLs/tokens documentados en backlog §6 (referencias código); **punto único usuario en SPA:** **§2.6**.

### 2.3 API pública para agentes (IA venta)

- **Disponibilidad IA v1:** `GET /api/disponibilidad` → restricciones con códigos, fotos PG, precios por estadía, motivos de no disponibilidad, demo heurística, `vibe` en búsqueda general.  
- **Detalle alojamiento:** enriquecimiento comercial, `booking_workflow`, cotización en contexto, `requiere_confirmacion_final`.  
- **Cotización dry-run:** `POST /api/reservas/cotizar` y `POST /api/public/reservas/cotizar` alineadas a checkout y política (sin cupones; no persisten).  
- **Reserva pública:** validaciones alineadas a web; reconciliación de precio; metadata política / verificación; emails vía motor transaccional PostgreSQL.  
- **OpenAPI:** versiones documentadas en **`openapi/openapi-chatgpt.yaml`** y gemini; endpoints `endpoints.cotizar_reserva_dry_run`, `requiere_confirmacion_reserva`, etc.

### 2.4 ChatGPT / MCP (estado repo)

- **OpenAPI** servido para integraciones tipo ChatGPT/Gemini.  
- **Servidor MCP** existente bajo **`ai/openai/mcp-server/`** (p. ej. herramienta `buscar_empresa`); proxy / well-known según despliegue — validar contra `chatgpt_integration_summary.md` y código actual.  
- **Agentes por empresa** (`ai/agentes/empresa/…`), plantillas, flujos de registro documentados en el resumen de integración.

### 2.5 Paridad con el mercado y conversión web

- Checkout desglose, políticas de cancelación por tarifa, cupones web v1, comparador referencial, mapa de calor de demanda con validación en backend, restricciones de estadía avanzadas, identidad check-in multi-huésped, etc. (detalle en **`TASKS/backlog-producto-pendientes.md`** §4 / §4.3).

### 2.6 Panel SPA — punto único de configuración usuario (Google Hotels / feeds)

**Menú:** **Operaciones → Canales IA** → ruta SPA `/canales-ia` (`frontend/src/views/canalesIa.js`, registro en `frontend/src/router.js`).

**Qué concentró (2026-05):**

- **Tokens** `websiteSettings.integrations` (feed ARI y feed contenido Google Hotels) + botón guardar (`PUT /website/home-settings` con solo `integrations`).
- **Semáforo** Google Hotels (misma lógica que antes en Configurar sitio web: `GET /website/google-hotels-health`).
- **Por alojamiento:** `googleHotelData.hotelId` y `isListed` en tabla con guardado por fila (`PUT /propiedades/:id` con `googleHotelData`).
- **Configurar sitio web** (`/website-general`) muestra una **tarjeta puente** (`renderCanalesIaBridgeSection` en `webPublica.general.unified.markup.js`) con enlace a Canales IA y estado sí/no de tokens; el guardado del formulario unificado **no borra** tokens si los inputs no están en el DOM (lee valores persistidos de `empresa.websiteSettings.integrations`).
- **Gestionar alojamientos:** el modal ya **no** edita Google Hotels inline; hay texto + botón hacia Canales IA (`alojamientos.modals.render.js`, `alojamientos.modals.js`).
- **Checklist Google §0 (operación):** en pestaña **Google Hotels**, bloque **§0 automático** — texto generado desde `GET /empresa` + `GET /auth/me` (nombre empresa, `empresaId`, URL base pública derivada, email sesión, fecha, líneas PowerShell para `verify-google-hotels-feed-checklist.js`); botón **Copiar**. Si no hay subdominio ni dominio custom, banner **advertencia** + **Ir a Configuración Web**. Implementación: `frontend/src/views/components/canalesIa/canalesIa.checklistGoogleS0.js` + `canalesIa.js`. No expone secretos (token feed no se vuelca al portapapeles).
- **Feeds globales partner (operación plataforma, provisional):** mismo apartado Google Hotels — bloque *Feeds globales Google (vista operación plataforma)*: URLs de referencia (sin token), botón **Probar feeds HTTP** (`GET /website/google-partner-feed-operator`, `POST /website/google-partner-feed-selftest`). Hoy accesible a cualquier admin JWT hasta existir rol plataforma (**§8**). Código: `canalesIa.googlePartner.operator.js`, `partnerFeedsSelftest.js`.
- **ChatGPT (panel):** pestaña informativa + enlace a **Configuración Web** para política de mascotas / ajustes que siguen en el formulario unificado (`chatgpt-mascotas-*`, mapa de calor, etc.). **Gemini:** pestaña placeholder hasta que existan ajustes dedicados.

---

## 3. Lo que falta o está parcial (gap analysis)

### 3.1 Contratos y agentes

| Gap | Acción sugerida |
|-----|------------------|
| OpenAPI vs rutas reales | Revisiones periódicas de **`openapi/openapi-chatgpt.yaml`** frente a `publicRoutes` / controladores; versionado SemVer del spec en changelog interno. |
| MCP: dos visiones (`ai/openai/mcp-server` vs `backend/mcp` propuesto) | Decisión explícita en **`TASKS/coordinacion-cursor-claude-ia-venta.md` §8**: consolidar transporte, herramientas (`consultar_disponibilidad`, `crear_reserva`, …) y dependencia `@modelcontextprotocol/sdk`. |
| Hallazgos Claude §9 JSON-LD **BookAction** / **AggregateOffer** | Mejorar schemas en SSR para Google AI Overview — solo backend vistas públicas; coordinar §3 si toca mismas props que precios IA. |

### 3.2 Google / Travel

| Gap | Acción sugerida |
|-----|------------------|
| **Partner único + feed global** | Implementar **§7** (feeds agregados, landing plataforma, sin romper SSR tenant). Trámite **externo** Google (connectivity). |
| Onboarding **por empresa** en Hotel Center | Durante transición: checklist **`TASKS/checklist-onboarding-google-hotel-center.md`** por host tenant; en estado objetivo: URLs **plataforma** registradas en Hotel Center + evidencia. |
| **Things to Do / Travel API** | Sigue siendo trámite externo; el paquete técnico pasa a incluir **feed único** + precisión de precio + Place ID. |
| QA feeds | **`TASKS/qa-feed-ari-checklist.md`** + CI; ampliar con casos **globales** y verificador Google (UA bypass). |

### 3.3 Descubrimiento para LLMs y buscadores IA

| Gap | Acción sugerida |
|-----|------------------|
| `llms.txt` por tenant (mencionado en coordinación §9.1B) | Ruta SSR que liste propósito del sitio, endpoints públicos de booking, contacto — sin secretos. |
| Sitemap / índice | Ya hay bases SEO; alinear con nueva ruta si se añade `llms.txt`. |

### 3.4 Middleware y buscadores IA

| Gap | Acción sugerida |
|-----|------------------|
| SelfBook / Perplexity | **Contacto comercial** primero; luego especificación técnica (siempre apuntando reservas al **propio** checkout/API SuiteManager). |

### 3.5 Redes sociales y mensajería

| Gap | Acción sugerida |
|-----|------------------|
| WhatsApp / Meta (tier 2–3 en §9) | Webhook dedicado reutilizando `publicAiController`; credenciales por empresa en configuración — **no** en este documento; diseño en spike tras priorización producto. |

---

## 4. Checklist operativo unificado (pendientes accionables)

Derivado de **`TASKS/backlog-producto-pendientes.md`** §5.x y §5.3, checklist Google, y **`TASKS/coordinacion-cursor-claude-ia-venta.md`** §9.

**Secuencia operativa B (multi-agente):** deploy prod + DNS `api.`/`feeds.` + env partner → smoke → onboarding Hotel Center **por tenant** → checklist **§9** (`verify-google-hotels-feed-checklist.js` / `npm run smoke:google-hotels-tenant`). Tabla detallada y estado: **`TASKS/google-hotels-partner-deploy-checklist.md`** (*Secuencia B*).

### A) Google Hotel Center y feeds

- [x] **Roadmap partner (código):** **§7.9–§7.11** — agregador `backend/services/googleHotelsGlobalService.js`, Partner Key, all-inclusive `Baserate`, inventario real; **§7.10** XSD opcional (`xmllint`); **§7.11** paridad precio SSR/XML documentada. **UI operación (provisional):** Canales IA → pestaña Google → bloque «Feeds globales…» + `GET /website/google-partner-feed-operator` + `POST /website/google-partner-feed-selftest` (servicio `partnerFeedsSelftest.js`); mismo criterio que smoke CLI, sin exponer token. **Post–Google:** restringir UI/API a rol plataforma (**§8**).  
- [x] **Operación DNS + marketplace (2026-05):** `feeds.suitemanagers.com` → Render (ya operativo); apex **`suitemanagers.com`** y **`www`** → Render (Custom Domain; ver **§1.2**); catálogo **`/google-hotels`** comprobado en navegador. Smoke: `npm run smoke:partner-feeds` + opcional `GH_PARTNER_FEED_STRICT=1`; tenant: `npm run smoke:google-hotels-tenant` con `GH_FEED_BASE_URL` / `GH_FEED_TOKEN` según token contenido.  
- [x] **Canales IA (tenant referencia):** tokens **ARI** y **contenido Google Hotels**, `hotelId` / listado por alojamiento alineados a pruebas smoke (ver **§2.6**).  
- [ ] **Checklist onboarding por tenant** §4–§8 a mano / Hotel Center cuando Google habilite consola y mapeo: `TASKS/checklist-onboarding-google-hotel-center.md` (§9 HTTP ya cubierto por script).  
- [x] **Validación técnica reproducible:** URLs plataforma `feeds.` + `?auth=`; **§7.4** (logs partner, bypass opcional UA feed contenido).  
- [x] **Script tenant:** `verify-google-hotels-feed-checklist.js` vía `npm run smoke:google-hotels-tenant` contra host público del tenant.  
- [ ] **Programa connectivity Google:** formulario de interés **“Hotel ads & free booking links — connectivity partners”** enviado (2026-05); **sin** correo de confirmación automático es normal — pendiente **contacto equipo Google** y registro de las **dos URLs** globales (`properties.xml` + `ari.xml` con `?auth=`) en Hotel Center cuando indiquen. Anotar fecha y captura del *Thank you*. Si rechazan o piden cambios: actualizar esta tabla y `TASKS/google-hotels-partner-deploy-checklist.md`.

### B) OpenAPI / ChatGPT

- [x] Contrato **1.4.7** con **GET `/api/public/version`** documentado (ChatGPT + Gemini YAML); copia en `backend/openapi/openapi-chatgpt.yaml` alineada a raíz.  
- [ ] Revisión contrato vs implementación tras cada cambio en rutas públicas IA.  
- [ ] Prueba manual del flujo: búsqueda → disponibilidad → cotizar → reserva (staging).  
- [ ] Documentar versión OpenAPI entregada al conector OpenAI (registrar **1.4.7** al publicar).

### C) MCP

- [ ] Cerrar decisión §8 (ubicación final + SDK).  
- [ ] Lista de herramientas MCP = paridad mínima con flujo ChatGPT (buscar, disponibilidad, cotizar, reservar donde aplique política).  
- [ ] Documento de configuración usuario (`mcp-config` o equivalente) actualizado.

### D) Indexación y LLMs

- [ ] Implementar / iterar `llms.txt` (o equivalente) por tenant si producto confirma prioridad.  
- [ ] JSON-LD: valorar **BookAction** / ofertas enriquecidas según handoff en coordinación §9.

### E) Calidad cruzada web ↔ IA

- [ ] QA E2E mapa de calor: `TASKS/qa-heatmap-restricciones-e2e.md`.  
- [x] §4.3 D comparador: **DoD MVP** en **§5.2** de este documento (y backlog §5.x **C**); pendiente solo QA en tenant real si producto lo exige.

### F) Canales externos (meta §1)

- [x] **Google Travel / connectivity (interés):** formulario oficial de connectivity partners **enviado**; siguiente paso = **respuesta Google** + acciones en Hotel Center (fuera del repo).  
- [ ] Contacto **middleware** (ej. SelfBook) para Perplexity u otros — reservas deben **cerrar** en el flujo propio (API/web), no como listado en OTA tercera.

---

## 5. Próximos focos sugeridos (orden lógico, no bloqueante)

1. **Google connectivity partner (bloque principal):** implementar **§7** — feed agregado, landing central en módulo separado, precisión precio / inventario / Place ID / bypass bots; operativizar con Google en dominio plataforma.  
2. **Transición:** mantener feeds por tenant **operativos** hasta migración de URLs en Hotel Center; documentar deprecación cuando solo quede feed global.  
3. **Sincronizar OpenAPI** y pruebas ChatGPT tras cambios en IA pública.  
4. **Decidir MCP** y acercar herramientas al contrato ya probado en GPT.  
5. **`llms.txt` + JSON-LD enriquecido** para descubrimiento en Perplexity / Google AI (alineado con datos del feed global — ver **§7.3**).  
6. **Redes / WhatsApp** cuando el pipeline anterior esté estable y producto asigne prioridad.

---

## 5.1 Cierre prioritario — lo más avanzado en código (orden para terminar)

Lo siguiente está **implementado en código**; falta sobre todo **DoD documental**, QA operativo o decisión explícita:

| Orden | Ítem | Estado técnico | Para dar por cerrado |
|-------|------|----------------|----------------------|
| 1 | **OpenAPI ChatGPT/Gemini** | Contrato **1.4.7** (`openapi/openapi-chatgpt.yaml`, `openapi/openapi-gemini.yaml`): incluye **GET `/api/public/version`**, changelog en `info.description`; copia sincronizada `backend/openapi/openapi-chatgpt.yaml`. | Tras cada cambio en rutas públicas IA: revisar que el YAML siga al código; registrar versión entregada al conector OpenAI/Gemini. |
| 2 | **Comparador “reserva directa” (§4.3 D)** | JSON `GET /propiedad/:id/comparador-ota.json`, UI en ficha cuando `comparableComplete`, `legalCopy`, logs `[comparador-ota]` — ver **`TASKS/backlog-producto-pendientes.md`** §4.3 D. | **DoD MVP (LISTO):** mostrar bloque solo con fechas válidas y `comparableComplete=true`; totales referenciales CLP desde tarifas internas (canal directo vs canal comparado configurado); texto legal vía `legalCopy`; sin obligación de cotizar precios de OTAs reales externas. **Fuera de alcance MVP:** integración con precios de terceros en vivo. |
| 3 | **Google Hotel Center + feeds** | **Código §7** operativo en prod: feeds globales `feeds.` + `auth`, smoke estricto, feed contenido tenant con token, catálogo `/google-hotels` en apex/www tras DNS GoDaddy→Render (**§1.2**). **Pendiente negocio/Google:** respuesta post–*interest form*, alta de URLs en Hotel Center, checklist §4–§8 onboarding, XSD opcional §7.10 si Google lo exige. | Tras contacto Google: URLs registradas + primera validación sin errores bloqueantes; §7.10 si aplica; §8 cuando cierren partner. |
| 4 | **Mapa de calor QA E2E** | Funcional en código + tests. | Checklist `TASKS/qa-heatmap-restricciones-e2e.md` en propiedades reales. |

---

## 5.2 Definition of Done — comparador (§4.3 D)

**Alcance cerrado (MVP producto):**

- El huésped ve el comparador en la ficha SSR **solo** cuando hay rango de fechas válido y el backend indica **`comparableComplete`** (si faltan noches con tarifa en el canal comparado, no se promete comparación completa).
- Los importes son **referenciales** respecto a tarifas y canales **ya configurados en SuiteManager** (`comparadorOtaService` + tarifas por noche); **no** se garantiza paridad con ninguna plataforma externa.
- Copy y advertencias legales vienen de **`legalCopy`** / UI acordada; logs estructurados para soporte.
- **No** forma parte del MVP: scraping ni APIs de precios de agregadores externos.

Con esto el ítem deja de estar “parcial” salvo **QA puntual** en tenant de prueba.

---

## 6. Referencias rápidas de código (ancla para PRs)

| Área | Rutas / archivos típicos |
|------|---------------------------|
| OpenAPI ChatGPT | `openapi/openapi-chatgpt.yaml` |
| IA pública | `backend/controllers/publicAiController.js`, `suitemanagerApiController.js`, `publicAiDisponibilidadService.js`, `publicAiReservaCotizacionService.js`, `publicAiProductSnapshot.js` |
| Rutas públicas | `backend/routes/publicRoutes.js`, `routes/api.js` (`GET /api/public/version` sin clave de agente) |
| Feeds Google (tenant) | `backend/services/googleHotelsService.js`, `backend/routes/website.seo.js` |
| **Connectivity Partner (implementación v1)** | **Agregador global:** `backend/services/googleHotelsGlobalService.js` (Property List + ARI global, IDs `propiedades.id`, filtros geo/Place ID, `auditPartnerListingGapsForEmpresa`). **Re-export:** `backend/services/googleHotelsPartner/googleHotelsPartnerFeeds.js` → mismo módulo. **Rutas:** `googleHotelsPartner.routes.js` (`createPartnerFeedsSubrouter`); **`backend/index.js`** monta `app.use('/feeds/google', …)` **antes** de `/api` y del catch-all SPA para que `feeds.suitemanagers.com/feeds/google/*.xml` no sirva `index.html` (evita redirect cliente a `/login`). Host permitido incluye `feeds.suitemanagers.com` / `api.*` y variantes `suite-manager.com` si aplica. **Validación XML:** `feedXmlWellformed.js`. **Selftest panel:** `partnerFeedsSelftest.js`; `config.routes.js` → `google-partner-feed-operator` / `selftest`. **ARI tenant/global:** `googleHotelsService.js` (`generateAriFeed`, …). **Health:** `googleHotelsHealthService.js` (`partnerGlobalFeed`). Catálogo **§7.6:** `GET /google-hotels`. Paridad **§7.11:** `propiedad.ejs` / `booking-widget.ejs`; `canalesIa.js` + `canalesIa.googlePartner.operator.js`. |
| Panel Canales IA (SPA) | `frontend/src/views/canalesIa.js`, `frontend/src/router.js` (`/canales-ia`, menú Operaciones); `webPublica.general.unified.{js,markup.js,handlers.js}` (puente + preservación tokens); `alojamientos.modals.{js,render.js}` (CTA desde modal) |
| MCP | `ai/openai/mcp-server/index.js` |
| SSR / JSON-LD | `backend/routes/website.property.page.js`, `website.home.js`, vistas EJS |

---

## 7. Plan técnico — Connectivity Partner (backlog de implementación)

Origen: alineación con políticas Google (**Price Accuracy**, **Entity Matching**) y rol **Connectivity Partner** (una superficie agregada). El código existente (`googleHotelsService.js`, `website.seo.js`, …) es base; las tareas siguientes **no** sustituyen al modo dual ni al aislamiento por `empresa_id`: la agregación **lee** datos por tenant y emite XML bajo rutas **plataforma**. **Contexto asesoría inicial:** **§7.8**. **Diseño cerrado para implementación (gate XSD + operación certificación):** **§7.9–§7.11**.

**Operación / deploy (lista de verificación):** **`TASKS/google-hotels-partner-deploy-checklist.md`** (DNS, env Render, smoke URLs, trámite Google). Incluye **“Cómo seguir (orden recomendado — producto / operación)”**: congelar URLs + verificar `ari.xml`, Hotel Center, pulido datos, §8/backlog, aviso a equipo.

### 7.1 Feed de contenido (Hotel List) — agregador global

| Tarea | Detalle |
|-------|---------|
| **Generación global** | Nuevo flujo (servicio o `generatePropertyListFeedGlobal`) que recorra **todos los tenants** con al menos una propiedad `googleHotelData.isListed === true` y datos mínimos completos. |
| **Address / geo** | Tags desglosados: calle, ciudad, país, código postal (según XSD Google / validación interna). Si `tipoNegocio` es **`complejo`** o **`hotel`**, dirección y **lat/lng** pueden tomarse de **`configuracion.ubicacion`** (y contacto web para dirección) cuando falten en cada propiedad (`googleHotelsEmpresaAddress.js` + fallback geo en `googleHotelsGlobalService.js` — feed global). **`cartera`:** dirección y geo por alojamiento. |
| **Geo obligatoria** | `<Latitude>` y `<Longitude>` desde metadata / geocodificación de la propiedad; **sin** coords → exclusión del feed global + semáforo (ver **§7.5**). |
| **DeepLink** | URL absoluta al flujo de reserva del tenant: `https://<subdominio>.<PLATFORM_DOMAIN>/reservar?...` o `https://<dominio-custom>/reservar?...` + identificadores estables (`hotelId` / `propiedadId` según contrato ya usado en checkout). |
| **Property.id / hotelId** | IDs **permanentes** alineados con `googleHotelData.hotelId`; ver **§7.8** — no rotar por cambio de dominio/plan. |

### 7.2 Feed ARI — disponibilidad, tarifas e inventario

| Tarea | Detalle |
|-------|---------|
| **Price Accuracy (MVP)** | **Estrategia B — all-inclusive:** precio final con IVA en `<Baserate>` (paridad 1:1 con checkout Latam). Declarar en XML según XSD oficial atributos de **precio con impuestos incluidos** (p. ej. `all_inclusive="true"` o equivalente de la versión del esquema). Reserva futura: estrategia A (neto + tax desglosado). Ver **§7.9**. |
| **RatePlan (MVP)** | **Solo la tarifa más barata** por propiedad/plan acordado; un `RatePlanID` estable para MVP. Fase 2: varios planes (NR vs flexible) cuando el motor lo soporte (**§7.9**). |
| **Inventario real** | **Obligatorio** no usar solo 0/1 cuando haya varias unidades del mismo tipo: `<Inventory>` = conteo real disponible. |
| **Estructura XML** | `<Transaction timestamp="...">` obligatorio y coherente; `<Result>` por actualización; segmentación donde aplique. Salida sometida a **§7.10** (XSD). |
| **Menores (MVP)** | Documentar precio **por adulto**; nodos de ocupación infantil → **Fase 2** (**§7.9**). |
| **Scope** | Endpoint global en host dedicado (**§7.9**), p. ej. `https://api.<plataforma>/feeds/google/ari.xml?auth=<PARTNER_KEY>` — sin mezclar con `website.seo.js` tenant. |

### 7.3 Coherencia datos — JSON-LD, XML y moneda

| Tarea | Detalle |
|-------|---------|
| **Paridad JSON-LD ↔ XML** | Nombre, dirección, geo y **precio/total** coherentes con ficha SSR / JSON-LD para esa propiedad (tests o auditoría cruzada). Refuerzo **§7.11**: primera vista de precio en SSR alineada al modelo all-inclusive del feed. |
| **ISO 4217** | Atributo `currency` consistente; **CLP** (y similares sin decimales) sin fracciones en XML; redondeo explícito en código. |

### 7.4 Seguridad — acceso feeds y verificador Google

| Tarea | Detalle |
|-------|---------|
| **Partner Key (V1)** | Token estático largo en query (p. ej. `?auth=<UUID>`) compartido solo con Google — estándar connectivity partners medianos; sin reverse DNS por request (latencia / certificación). Reverse DNS + WAF → fase posterior (**§7.9**). |
| **Rutas plataforma** | Solo en subdominio infra (**§7.9**); sin rate-limit agresivo a crawlers; **401/403** en `/feeds/google/*` registran `[PartnerFeed]` con host, path, IP y prefijo de User-Agent (sin token). |
| **Feed contenido tenant + verificador** | Con token en panel, `?token=` sigue siendo la vía principal. Opcional: `GOOGLE_HOTELS_CONTENT_FEED_VERIFIER_UA_SUBSTR` (subcadenas de User-Agent, coma) permite **200 sin query** solo si el token está configurado, **no** se envía `token` y el UA coincide — ver `googleHotelsContentFeedRequest.js` y `backend/.env.example`. Un `token` incorrecto sigue en **401**. |

### 7.5 Health check — Place ID y exclusión

| Tarea | Detalle |
|-------|---------|
| **Google Place ID** | Campo persistido en `googleHotelData` (o metadata acordada). **Sin Place ID** → semáforo **rojo** en health y **exclusión** del feed global (evitar “Unmatched Properties”). |
| **`evaluateGoogleHotelsHealth`** | Extender `googleHotelsHealthService.js` con reglas estrictas Place ID + paridad inventario/precio donde sea calculable server-side. |

### 7.6 Landing / catálogo central (módulo UI separado)

| Tarea | Detalle |
|-------|---------|
| **Página dedicada** | Vista SSR (o ruta marketplace extendida) en **dominio plataforma**: lista todas las propiedades opt-in de todos los clientes, enlaces a reserva del tenant. **No** reemplaza la home SSR del operador. |
| **Implementación** | Rutas y vistas en archivos **nuevos** (p. ej. `routes/marketplaceGooglePartner.*`, vista `views/marketplace/partner-*.ejs`) — nombre definitivo al PR; prohibido acoplar al resolver del sitio del tenant. |

### 7.7 Entornos y transición

| Fase | Acción |
|------|--------|
| **Fase A** | Implementar feeds globales (host **§7.9**, agregador tolerante a fallos + XSD **§7.10–§7.11**), observabilidad, landing + health; feeds tenant activos en paralelo. |
| **Fase B** | Registrar en Google **solo** las dos URLs plataforma; checklist partner. **Estado 2026-05:** formulario de **interés connectivity partners** enviado a Google; pendiente **contacto del equipo** y luego registro efectivo de URLs + validación en Hotel Center. |
| **Fase C** | Deprecar feeds por tenant en documentación si negocio confirma una sola fuente. |

### 7.8 Validación externa — OK al plan (contexto 2026-05)

Revisión tipo **channel manager**: OK a **plataforma + SSR tenant + deep link**, fuente maestro, dos URLs en Hotel Center. Filas históricas que **§7.9** cierra o matiza: precio (→ estrategia B MVP), multi-rate (→ Fase 2), niños (→ Fase 2), bypass (→ Partner Key V1).

| Tema | Acuerdo / requisito |
|------|---------------------|
| **URLs objetivo (partner)** | **Dos rutas estables** en host **dedicado desde día 1** (`api.` o `feeds.` — **§7.9**); no mezclar tráfico tenant con tráfico feeds. Ejemplo: `https://api.<plataforma>/…/properties.xml` y `…/ari.xml` (path final alineado a rutas de implementación, p. ej. `/feeds/google/`). |
| **Política de IDs** | `hotelId` (**Property.id**) **inmutable**; cambiar host de feeds es costoso (re-auditoría Google) — por eso hostname estable desde el inicio. |
| **`<Transaction>`** | **`timestamp`** obligatorio; mensajes más viejos que el último procesado pueden ignorarse — usar UTC de generación coherente. |
| **Observabilidad** | Logs/métricas ante **404**, XML inválido o fallo de generación (antes de suspensión silenciosa en Google). |

### 7.9 Diseño cerrado — decisión final (Go al PR)

Alineación **Gemini / producto** antes del primer merge de código partner:

| Punto | Decisión final | Justificación breve |
|-------|----------------|---------------------|
| **Precio** | **Estrategia B (all-inclusive) MVP** | En Chile/Latam el usuario espera total con IVA; poner **precio final en `<Baserate>`** maximiza **Price Accuracy** frente al checkout. Declarar según XSD que el importe **ya incluye impuestos** (atributos del esquema, p. ej. `all_inclusive="true"` o equivalente **según versión** `hotel_inventory.xsd`). **Reserva:** estrategia A (neto + tax) para evolución. |
| **Hostname** | **Subdominio dedicado desde día 1** (`api.` o `feeds.` / `distribution.`) | Aísla infra vs tenants; evita re-certificación por cambiar URL base que Google auditó. CNAME en DNS (Render u otro). |
| **Seguridad** | **Partner Key estático en URL** (`?auth=<UUID largo>`) V1 | Balance seguridad/performance; sin reverse DNS por request en Node (latencia). Reverse DNS cuando haya WAF delante. |
| **RatePlan (MVP)** | **Solo tarifa más barata** | MVP honesto; Google posiciona por precio; ampliar en Fase 2. |
| **Niños** | **MVP = adultos**; precio documentado **por adulto** | Fase 2: nodos ocupación infantil cuando el motor sea más robusto. |
| **Inventario** | **Conteo real** (no binario) donde aplique multi-unidad | Obligatorio para no marcar “agotado” con stock disponible. |

### 7.10 Gate obligatorio — XSD y feed agregado “limpio”

**Antes de exponer** respuesta XML a Google (y en CI donde aplique):

1. Validación contra el **esquema oficial Google** de la versión en uso (**referencia:** `hotel_inventory.xsd` / documentación vigente del programa).
2. **`GlobalFeedService` (o equivalente):** **aislar errores por hotel/propiedad**. Si el ítem *n* falla validación parcial, carece Place ID, geo mínima u otro requisito → **no incluir** ese `<Property>` / `<Result>` en el documento final; **log estructurado** (`empresaId`, `propiedadId`, causa) para **health check**; **continuar** con el siguiente. El fallo del hotel 45 de 500 **no** debe tumbar el feed entero.
3. **Validación del XML completo** generado (solo con ítems incluidos): si el documento agregado **aún** incumple XSD → respuesta **error controlado** (503/500 + log + alerta). Objetivo: lo que Google reciba sea siempre **XML válido** o un fallo explícito del endpoint, nunca basura.
4. Separación respecto a §7.9: la robustez es **por ítem** en generación + **global** al cerrar el payload.

### 7.11 Observaciones finales de operación (certificación / despliegue)

Incorporadas como contrato de codificación (**Gemini — cierre de ciclo**):

| # | Tema | Requisito |
|---|------|-----------|
| **1** | **Paridad precio XML ↔ SSR tenant (“catch-22” all-inclusive)** | Aunque el XML lleve `all_inclusive` / precio final en `<Baserate>`, el **primer precio visible** en la landing SSR del tenant al llegar por Deep Link debe ser **coherente** con ese total (evitar “$84 + IVA” en UI si el XML declara $100 final). Los bots de reconciliación pueden marcar discrepancia si la vista no refleja el mismo modelo fiscal que el feed. **Paridad visual = paridad técnica.** |
| **2** | **Errores en agregador (refuerzo §7.10)** | Ya cubierto en §7.10 p.2: try/catch por hotel, skip + log, feed limpio. Mantener health actualizado para soporte. |
| **3** | **DNS del subdominio `api.` / `feeds.`** | Durante certificación y cambios de servidor, usar **TTL bajo** en registros A/CNAME para no esperar ~24 h de propagación mientras Google valida el feed. Subir TTL cuando la infra sea estable. |

**Veredicto externo:** **PROCEDER** con PR — `TASKS/venta-ia.md` como fuente de verdad de ingeniería para el carril partner.

**Implementación §7.11 (paridad primer precio visible, 2026-05-02):** en SSR `propiedad.ejs`, si la propiedad tiene `googleHotelData.isListed`, la barra de precio móvil usa la **tarifa publicada por noche** (lista sin descuento de promo en tarifa), coherente con el `<Baserate>` del feed partner; mensaje si hay promo activa que reduce el total en checkout. **Enlaces catálogo §7.6:** footer marketplace (`/google-hotels`) + tarjeta en SPA **Canales IA → Google**. **DeepLink en Property List global:** hoy `https://<tenant>/propiedad/<id>` sin query; la ficha **sí** entiende `?fechaLlegada=&fechaSalida=` (`website.property.helpers.js`). Si Google exige fechas en el enlace del XML en certificación, planificar extensión en `googleHotelsGlobalService.js` (ver **`TASKS/gemini-smoke-instrucciones.md` §7**).

---

## 8. Plataforma: superadministrador y operadores (plan — **después** de cerrar Google Hotels)

**Objetivo de negocio:** un **superadministrador** y un **conjunto de operadores de plataforma** gestionan configuraciones delicadas o globales (feeds partner, DNS, flags de menú, impersonación por empresa), sin mezclar ese poder con el administrador típico de cada empresa.

**Orden de implementación sugerido (fases):**

| Fase | Entregable | Notas |
|------|------------|--------|
| **1 — Identidad** | Tabla o colección `platform_users` (email, hash, rol `superadmin` \| `operator`), o **custom claims** Firebase + claims en JWT backend. | MFA obligatorio para superadmin; sesiones acotadas. |
| **2 — Login y sesión** | Flujo explícito post-login: si credenciales = plataforma → JWT o sesión con `platformRole` y **sin** `empresaId` hasta elegir contexto. | Valorar subdominio `admin.<plataforma>` para separar cookies y CSP. |
| **3 — Selector de empresa** | Lista de empresas (solo lectura paginada), al elegir una → `actingEmpresaId` en sesión o token de impersonación **firmado y de corta duración**. | Cada request mutadora: log de auditoría (`quién`, `empresa`, `acción`, `timestamp`). |
| **4 — Autorización backend** | Middleware `requirePlatformRole('operator')` / `requireSuperadmin` en rutas `/website/google-partner-*`, futuras rutas globales, etc. | **Prohibido** confiar solo en ocultar ítems de menú. |
| **5 — Visibilidad de menú (SPA)** | Persistencia por empresa: `menuVisibility` o feature flags (`canalesIa`, …) editables **solo** por superadmin para “qué ven los admins de esa empresa”. | El menú SPA lee flags; las rutas API repiten el chequeo. |
| **6 — Cierre provisional** | Quitar acceso amplio a `GET/POST /website/google-partner-feed-*` para admins de empresa; dejar solo operadores/superadmin + auditoría. | Incluye mover copy “provisional” del bloque **Canales IA → Google Hotels**. |

**Estado actual (2026-05-03):** la UI y los endpoints de selftest partner en Canales IA actúan como **vista previa** de la consola de plataforma: cualquier admin empresa autenticado puede llamarlos hasta existir la fase 4–6.

**Documentación relacionada:** este §8; `TASKS/backlog-producto-pendientes.md` (resumen §5.3); al implementar: handoff en `TASKS/coordinacion-cursor-claude-ia-venta.md` si toca auth o rutas `/api` compartidas.

---

*Última actualización: 2026-05-03 — **§4** enlace **Secuencia B** (`google-hotels-partner-deploy-checklist.md`: deploy + DNS `api.`/`feeds.` + env → smoke → tenant Hotel Center → checklist §9). **§1.2** DNS apex + `www`; **§8** superadmin; **§7**; OpenAPI **1.4.7**.*
