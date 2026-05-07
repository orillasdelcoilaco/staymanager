# Auditoría SEO SSR — línea base (baseline)

**Tema:** `SM-seo-ssr-buscadores`  
**Fecha:** 2026-05-05  
**Objetivo:** inventario de superficies indexables, herramientas ya cableadas en producto y huecos conocidos (sin duplicar el roadmap largo de `plan-accion-seo-ssr.md`).

---

## 1. Superficies y rutas

| Superficie | Host típico | Rutas SEO relevantes | Generación |
|------------|-------------|----------------------|------------|
| Marketplace plataforma | `rezerva.cl` (o `PLATFORM_DOMAIN` en env) | `/`, `/sitemap.xml`, `/robots.txt`, `/google-hotels`, `/api/search.json`, `/llms.txt` | `marketplace.js`, `marketplace.seo.js`, `index.js` |
| Sitio público tenant | subdominio o dominio custom | `/`, `/propiedad/:id`, `/contacto`, `/sitemap.xml`, `/robots.txt`, feeds opcionales | `website.seo.js`, `website.js`, `tenantResolver` |

**Aislamiento:** datos de diagnóstico por empresa salen solo de `empresa_id` del JWT; la vista plataforma superadmin usa agregados cross-tenant solo en endpoints explícitos (`/api/seo-monitor/platform`).

---

## 2. Qué ya hace el producto (implementado)

| Capacidad | Dónde |
|-----------|--------|
| Panel **SEO mi sitio** (tenant) | SPA `/seo-tenant`, menú Sitio público |
| Panel **Buscadores plataforma** (superadmin) | SPA `/seo-plataforma`, menú Plataforma SuiteManagers |
| API diagnóstico | `GET /api/seo-monitor/tenant`, `GET /api/seo-monitor/platform` |
| `panelActions` + navegación SPA | Respuesta JSON + botones en vistas |
| Sondeo HTTP `robots.txt` / `sitemap.xml` | `seoMonitorProbeService.js` (timeout, muestra parcial del cuerpo) |
| Enlaces Search Console / Bing | Construidos desde el host o apex |

**Rol superadmin:** el menú plataforma exige `usuarios.rol` en PostgreSQL entre: `superadmin`, `super_admin`, `platform_admin` (misma lógica en backend y filtro de menú SPA).

---

## 3. Matriz técnica rápida (criterios)

| Criterio | Tenant SSR | Plataforma | Notas |
|----------|------------|------------|--------|
| `robots.txt` | Sí (ruta tenant) | Sí (apex) | Validación HTTP en panel |
| `sitemap.xml` | Sí | Sí | Tenant: listado + reglas `isListed` + portada (ver `website.seo.js`) |
| Canonical / hreflang marketplace | Parcial (home búsqueda) | Sí en home/catálogo | Evolución en `plan-accion-seo-ssr.md` |
| JSON-LD | Fichas / marketplace | ItemList, etc. | Profundizar en fase “rich results” |
| Search Console API (KPIs in-app) | No | No | Fase 2: OAuth o cuenta de servicio acotada |

---

## 4. Top quick wins ya cubiertos por el monitor

1. Host público definido (tenant).
2. Propiedades con `isListed` y portada para sitemap tenant.
3. Respuesta HTTP 200 de `robots.txt` y `sitemap.xml`.
4. Enlaces directos a herramientas externas para seguimiento.

---

## 5. Pendiente explícito (fuera de este baseline de código)

- Integración **Google Search Console API** (u otra fuente) para impresiones, CTR, cobertura de indexación dentro del panel.
- Validación de **contenido** de sitemap (URLs esperadas vs XML) y de **meta title/description** por plantilla EJS.
- Selector multi-empresa en vista superadmin (hoy las acciones de panel usan el tenant de la sesión).

---

## 6. Referencias de código

- `backend/routes/seoMonitor.js`
- `backend/services/seoMonitorProbeService.js`
- `frontend/src/views/seoTenant.js`, `seoPlataforma.js`
- `frontend/src/router.js` (menú por rol)
- `backend/routes/website.seo.js`, `backend/services/marketplace.seo.js`
