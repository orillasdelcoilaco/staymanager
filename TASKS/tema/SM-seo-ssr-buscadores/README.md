# SM-seo-ssr-buscadores

## Objetivo

Mejorar el posicionamiento orgánico en buscadores para:

- `rezerva.cl` (sitio de plataforma/marketplace; ver `LEER-PRIMERO.md` § Referencias de entorno).
- Sitios SSR de cada empresa (`website.*`) en dominio/subdominio tenant.

## Estado

- Estado actual: **Listo** (MVP acordado: panel + API + sondeo HTTP + baseline doc; KPIs Search Console = fase 2)
- Última actualización: 2026-05-05

## Menú SPA — plataforma vs clientes (decisión)

- **Dominio plataforma `rezerva.cl` (marketplace / SEO de la plataforma):** va en un **apartado de menú propio**, pensado como **vista de plataforma**, no como algo “por empresa” en el día a día del tenant.
- **Menú configurable para clientes:** ese apartado **queda fuera** del menú estándar del suscriptor. **Solo visible para superadministrador** (operador de plataforma), alineado a la línea de **operación plataforma** descrita en `TASKS/tema/SM-venta-ia/venta-ia.md` §8 y al patrón provisional en `canalesIa.googlePartner.operator.js`.
- **SEO / buscadores del sitio público del tenant (SSR):** sí entra en el menú **del cliente** (p. ej. categoría o ítem bajo «Sitio público» o «Visibilidad» solo con datos de su `empresa_id`: su dominio/subdominio, checklist técnico, enlaces a Search Console/Bing de **su** propiedad).

Detalle de implementación: `plan-accion-seo-ssr.md` (sección *Menú SPA y roles*).

## Implementación (2026-05-05)

- Nuevo menú en SPA para SEO del tenant: **Sitio público -> SEO mi sitio**.
- Nuevo apartado de plataforma (solo superadmin): **Plataforma Rezerva → Buscadores plataforma** (etiqueta menú; ver `frontend/src/router.js`).
- Endpoint tenant: `GET /api/seo-monitor/tenant` (`panelActions`, `httpChecks`).
- Endpoint plataforma (rol superadmin): `GET /api/seo-monitor/platform`.
- Sondeo HTTP desde backend: `backend/services/seoMonitorProbeService.js`.
- Baseline documental: `audit-seo-ssr-baseline.md`.
- **2026-05-05 — Rutas SSR:** `robots.txt` y `sitemap.xml` del marketplace en `backend/index.js` solo aplican si el host es plataforma (`isMarketplaceSsrHost` en `tenantResolver.js`); en dominio/subdominio tenant la respuesta la genera `website.seo.js` (evita `robots.txt` 404 en dominio propio).
- **Host del monitor (tenant):** por defecto **`{subdominio}.rezerva.cl`** (según `PLATFORM_DOMAIN` / datos de empresa) si hay subdominio en datos; no se prioriza el dominio propio (`www…`) para no sondear una URL distinta a la que usa el sitio estándar del producto. Override opcional: `websiteSettings.general.seoProbeHost`. Si coexisten ambos, la API devuelve `empresa.alternatePublicHost` para contexto en la SPA.
- **Search Console (enlace del panel):** URL de entrada sin `resource_id` (evita pantalla «no puedes acceder» si la propiedad no está añadida/verificada). En la SPA se muestra el prefijo `searchConsolePropertyPrefix` para copiar al flujo «Añadir propiedad».
- **Verificación por meta (tenant):** en **Sitio público → Configurar sitio web** el campo *Verificación Search Console* guarda `websiteSettings.seo.googleSiteVerification`; el SSR incluye `<meta name="google-site-verification" content="…">` en las plantillas tenant (vía `partials/google-site-verification.ejs`). Saneo en `PUT /website/home-settings`: `websiteSeoSettingsSanitize.js`.
- **Verificación por archivo HTML:** mismo formulario: **subir** el `.html` descargado (`POST /api/website/google-search-console-verification-upload`, multipart `file`) → `websiteSettings.seo.googleSearchConsoleHtmlVerification`. Quitar: `DELETE /api/website/google-search-console-verification-file`. Ruta SSR `GET /{archivo}` en `website.seo.js` (solo nombres `google[hex].html`). `PUT /website/home-settings` no envía este bloque (se conserva lo ya subido).

**Superadmin:** asignar rol en PostgreSQL (`usuarios.rol`) a uno de: `superadmin`, `super_admin`, `platform_admin` para ver el menú de plataforma.

## Verificación (cierre MVP)

Ejecutado **2026-05-05** en raíz del repo:

- `node scripts/tooling/audit-ui-monitored.js` — **0** problemas de alta prioridad (5 media, 7 baja, preexistentes).
- `node scripts/tooling/audit-complexity-monitored.js` — sin nuevos bloqueos; el reporte sigue listando críticos **heredados** del repo (ver `TASKS/tema/SM-auditoria-calidad/complexity-report.md`).
- `npm run test:ci` — **OK** (exit code 0).

No hay script dedicado solo al módulo `seo-monitor`; la regresión queda cubierta por esta batería global.

## Alcance inicial

- Diagnóstico SEO técnico en SSR (metadatos, canonical, robots, sitemap, schema).
- Estrategia de indexación separada:
  - Dominio plataforma (`rezerva.cl`).
  - Sitios públicos por empresa (multi-tenant SSR).
- Priorización de quick wins sin mezclar mundos SPA/SSR.

## Referencias

- `TASKS/tablero.md` (fila `SM-seo-ssr-buscadores`)
- `audit-seo-ssr-baseline.md`
- `TASKS/tema/SM-ssr-sitio-publico/`
- `TASKS/tema/SM-venta-ia/venta-ia.md`
