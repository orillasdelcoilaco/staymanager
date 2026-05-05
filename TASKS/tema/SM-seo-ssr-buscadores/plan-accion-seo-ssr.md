# Plan de accion SEO SSR

## 1. Problema / contexto

Se necesita mejorar posicionamiento organico en buscadores para dos superficies distintas:

- Sitio plataforma `suitemanagers.com` (marca, captacion y discovery).
- Sitios SSR por empresa (fichas y contenido publico por tenant).

Riesgo actual: mezclar estrategia o tecnicos entre plataforma y tenant puede generar canibalizacion SEO, metadatos inconsistentes o indexacion incompleta.

## 2. Objetivo

Lograr una base SEO tecnica estable y medible para ambos mundos SSR, con foco en:

- Indexacion correcta.
- Rich results (schema JSON-LD consistente).
- Mejor CTR organico por metadata y snippets.
- Cobertura de contenido por tenant sin romper aislamiento multiempresa.

## 3. Alcance y no alcance

### Alcance

- Diagnostico tecnico SEO de rutas SSR principales.
- Plan de mejoras para metadata, canonical, sitemap, robots y schema.
- Priorizacion de quick wins implementables en oleadas.

### No alcance (esta fase)

- Campanas de pago.
- Link building externo.
- Redaccion masiva de contenido comercial.

## 4. Menú SPA y roles

**Acuerdo de producto:**

| Superficie | Quién la ve en el panel | Menú |
|------------|-------------------------|------|
| `suitemanagers.com` (indexación, marketplace, métricas agregadas de la plataforma) | Solo **superadministrador** / operador plataforma | **Apartado dedicado** (nombre TBD: p. ej. «SuiteManagers — buscadores» o «Plataforma SEO») |
| Sitio SSR del tenant (subdominio/dominio de la empresa) | Cada **cliente** (admin de empresa) | Ítem o categoría en menú **del cliente** (sin datos de plataforma mezclados) |

**Cuando exista menú configurable por cliente:** el bloque de plataforma **no** se ofrece en la plantilla de menú estándar; sigue condicionado a rol superadmin en código (p. ej. filtro en `frontend/src/router.js` al armar `menuConfig`, mismo criterio futuro que otras piezas §8).

**Implementación (cuando se codifique):**

- Nueva ruta SPA solo plataforma + vista dedicada (enlaces Search Console/Bing a propiedades del dominio `suitemanagers.com`, checklist técnico de rutas marketplace).
- Menú cliente: ruta distinta para «SEO de mi sitio» con `empresa_id` en todas las APIs.
- No reutilizar un solo ítem que mezcle ambas superficies para el usuario tenant.

## 5. Superficies a cubrir

### A. Plataforma (`suitemanagers.com`)

- Home marketplace.
- Paginas de detalle publico de alojamientos (si aplica en dominio plataforma).
- Paginas de apoyo SEO (legal, contacto, etc.).

### B. Tenant SSR (por empresa)

- Home tenant.
- Ficha de propiedad.
- Flujo reserva/public pages indexables.

## 6. Checklist tecnico base (auditoria)

- [ ] Titulos y metadescripcion unicos por tipo de pagina.
- [ ] `canonical` coherente (sin duplicados plataforma/tenant).
- [ ] `robots` correcto por entorno y por pagina.
- [ ] `sitemap.xml` por superficie (plataforma y tenant).
- [ ] `hreflang` si aplica idioma por tenant.
- [ ] Open Graph y Twitter Cards minimas.
- [ ] JSON-LD validable (Organization/LodgingBusiness/ItemList/Breadcrumb/FAQ donde aplique).
- [ ] Performance web vital baseline (LCP/CLS/INP) en plantillas SSR.
- [ ] Imgs con `alt`, dimensiones y carga optimizada.

## 7. Plan por fases

### Fase 1 - Diagnostico y baseline (inmediata)

- Inventariar URLs indexables por superficie.
- Medir estado actual de metadata/canonical/schema/sitemap.
- Definir brechas criticas por impacto SEO y esfuerzo.

Entregable: `audit-seo-ssr-baseline.md`.

### Fase 2 - Quick wins tecnicos (corto plazo)

- Estandarizar metadatos SSR por plantilla.
- Corregir canonical y robots inconsistentes.
- Completar/normalizar sitemap XML.
- Ajustar JSON-LD minimo en home + property.

Entregable: checklist "hecho" con evidencia por ruta.

### Fase 3 - Escalado tenant-safe (mediano plazo)

- Plantillas SEO parametrizadas por `empresa_id`.
- Reglas para evitar duplicidad plataforma vs tenant.
- QA de indexacion en 2-3 empresas de prueba sin hardcode de negocio.

Entregable: `qa-seo-ssr-tenant-safe.md`.

### Fase 4 - Medicion y mejora continua

- Definir KPIs (impresiones, CTR, paginas indexadas, rich results validos).
- Tablero mensual de seguimiento y backlog de ajustes.

Entregable: `seguimiento-seo-ssr.md`.

## 8. Priorizacion inicial

1. Canonical + robots por impacto en indexacion.
2. Metadata SSR consistente (title/description/OG).
3. Sitemap completo y sin URLs rotas.
4. JSON-LD valido en rutas clave.
5. Performance tecnico en plantillas con mayor trafico.

## 9. Riesgos y mitigaciones

- Canibalizacion entre plataforma y tenant.
  - Mitigacion: reglas de canonical y alcance indexable por dominio.
- Contenido duplicado por plantillas similares.
  - Mitigacion: bloques parametrizados por empresa, resumenes unicos por propiedad.
- Cambios SEO que afecten conversion.
  - Mitigacion: rollout por fases y verificacion en pages criticas.

## 10. Proximo paso operativo

- **Hecho (MVP):** `audit-seo-ssr-baseline.md` creado; monitor con sondeo HTTP y paneles SPA.
- **Siguiente (fase 2 producto):** KPIs vía Search Console API u otra fuente; validación profunda de meta/JSON-LD por plantilla; selector multi-empresa en vista superadmin.

## 11. Bitacora de planificacion

- 2026-05-05 — Se crea plan inicial del tema `SM-seo-ssr-buscadores` para alinear plataforma + tenant SSR sin mezclar responsabilidades.
- 2026-05-05 — Menú SPA: bloque `suitemanagers.com` como apartado solo plataforma; con menú configurable para clientes, fuera del menú tenant y visible solo superadmin. SSR SEO permanece en menú del cliente.
- 2026-05-05 — Implementación inicial: rutas SPA `/seo-tenant` y `/seo-plataforma`; menú por rol en `router.js`; API `GET /api/seo-monitor/tenant` y `GET /api/seo-monitor/platform` (403 si no superadmin).
- 2026-05-05 — Respuesta API con `panelActions` y vistas con bloque «Corregir en el panel» + botones que navegan por SPA (`handleNavigation`) a `/website-general`, `/canales-ia`, `/website-alojamientos` según diagnóstico.
- 2026-05-05 — Cierre MVP tema: `httpChecks` (sondeo `robots`/`sitemap`), `seoMonitorProbeService.js`, `audit-seo-ssr-baseline.md`; tablero en **Listo** para este alcance.
- 2026-05-05 — Verificación repo: `audit-ui-monitored` (0 alta), `audit-complexity-monitored`, `npm run test:ci` OK; detalle en `README.md` del tema.
