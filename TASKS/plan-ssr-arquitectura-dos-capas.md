# Plan de Desarrollo — Arquitectura SSR Dos Capas
**Creado:** 2026-04-19  
**Autor:** Claude Code  
**Estado:** ACTIVO

---

## Visión General

SuiteManager tiene dos superficies SSR con audiencias y objetivos distintos:

| | **Capa 1** | **Capa 2** |
|---|---|---|
| **Dominio** | `suitemanagers.com` | `empresa.suitemanagers.com` o dominio propio |
| **Audiencia** | Huéspedes buscando alojamiento (todos los clientes) | Huéspedes de UNA empresa específica |
| **Analogía** | Airbnb.com | Sitio web propio de un anfitrión |
| **Estado** | ❌ No existe | ✅ Implementado (mejorar) |
| **Revenue** | Marketplace → comisiones por reserva directa | Branding → valor percibido del cliente SuiteManager |

---

## CAPA 2 — Mejoras al Sitio por Empresa (Prioridad Alta)

### Estado actual (ya implementado)
- ✅ Tenant resolver por subdominio/dominio personalizado
- ✅ Homepage con hero image, descripción, listado de propiedades
- ✅ Página de propiedad con galería, amenidades, widget de reserva
- ✅ H1 desde IA (`buildContext.narrativa.homeH1`)
- ✅ Reseñas (sección condicional — necesita datos publicados)
- ✅ Mapa con coordenadas exactas
- ✅ SEO básico con `metaTitle` / `metaDescription`

### Fase 2A — Contenido IA para cada espacio (Sprint 1)
**Objetivo:** La sección "Lo que ofrece este lugar" muestra descripciones generadas por IA por cada espacio/componente.

**Archivos a tocar:**
- `backend/views/propiedad.ejs` — nueva sección entre reseñas y mapa
- `backend/services/buildContextService.js` — incluir `componentes` con `descripcion` IA en el contexto
- `backend/routes/websiteConfigRoutes.js` — endpoint para regenerar descripción por componente

**Diseño de datos:**
```javascript
// buildContext.componentes[] ya tiene espacios
// Añadir: componente.descripcionWeb (texto IA, 2-3 oraciones)
// Guardar en: componentes.metadata->>'descripcionWeb'
```

**UI propuesta:** Cards en grid 2 columnas, ícono del tipo de espacio (dormitorio🛏, baño🚿, sala🛋), texto descriptivo breve + foto principal del espacio.

---

### Fase 2B — Calendario de Disponibilidad (Sprint 2)
**Objetivo:** Widget vanilla JS que muestra días ocupados/libres en la página de propiedad.

**Archivos nuevos:**
- `backend/routes/website.booking.js` — endpoint `GET /api/disponibilidad/:propiedadId`
- `backend/public/js/calendar-widget.js` — calendario vanilla JS
- `backend/views/partials/calendar-widget.ejs` — markup del calendario

**Endpoint propuesto:**
```
GET /:subdomain/propiedad/:id/disponibilidad?from=YYYY-MM&months=3
→ { ocupados: ['2026-04-20', '2026-04-21', ...], politica: {...} }
```

**Lógica:**
- Consulta `bloqueos` y `reservas` del rango → fechas ocupadas
- El JS del cliente renderiza una grilla de 3 meses coloreada
- Integrar con el widget de reserva: al seleccionar fechas en el calendario, se prellenan los inputs del widget

**Restricciones:**
- Sin dependencias externas (Flatpickr/FullCalendar) — vanilla JS puro
- Respetar multi-tenant: propiedad siempre filtrada por empresa_id via tenantResolver

---

### Fase 2C — Mejoras de Conversión (Sprint 3)
**Objetivo:** Reducir la brecha con Airbnb en la página de propiedad.

| Mejora | Impacto | Complejidad |
|--------|---------|-------------|
| Schema.org `LodgingBusiness` + `Review` en `<head>` | SEO rich snippets | Baja |
| Sección "Preguntas frecuentes" (desde IA) | Conversión | Media |
| Breadcrumb visual: Empresa → Ciudad → Propiedad | UX | Baja |
| Galería modal (lightbox) al hacer clic en fotos | UX | Media |
| "Compartir" links (WhatsApp, copy URL) | Difusión | Baja |
| Sección de propiedades similares de la misma empresa | Retención | Media |

---

### Fase 2D — Homepage por Empresa (Sprint 4)
**Objetivo:** La página principal del sitio empresa también usa contenido IA y convierte mejor.

| Elemento | Estado | Acción |
|----------|--------|--------|
| Hero con imagen + H1 empresa | ✅ | Refinar copy con `strategy.homeH1` |
| Historia del negocio (`historiaOptimizada`) | ⚠️ | Mostrar en SSR desde `strategy.historiaOptimizada` |
| Grid de propiedades con precio desde | ✅ | Agregar badge "Disponible este fin de semana" |
| Reseñas destacadas en homepage | ❌ | Añadir sección con top 3 reseñas cross-propiedad |
| CTA de contacto/WhatsApp flotante | ❌ | Botón flotante con número de empresa |

---

## CAPA 1 — Marketplace SuiteManagers.com (Prioridad Media)

### Concepto
`suitemanagers.com` sin subdominio de empresa = plataforma pública donde cualquier persona puede buscar alojamientos en todas las empresas registradas que hayan activado visibilidad pública.

**Modelo de negocio:** SuiteManager cobra comisión por reserva directa hecha desde la plataforma, o bien es el canal de marketing premium para los clientes.

### Arquitectura propuesta

```
tenantResolver.js
  ├── hostname = empresa.suitemanagers.com → Capa 2 (actual)
  ├── hostname = midominio.com → Capa 2 (custom domain)
  └── hostname = suitemanagers.com → Capa 1 (nuevo)
        ↓
  backend/routes/marketplace.js (nuevo)
        ↓
  backend/views/marketplace/ (nuevas vistas EJS)
```

### Rutas Capa 1
```
GET /                        → Homepage marketplace (hero + búsqueda + destinos)
GET /buscar?destino=&fechas= → Resultados de búsqueda cross-empresa
GET /destino/:ciudad         → Página de destino (ej: /destino/pucon)
GET /alojamiento/:slug       → Landing pública de una propiedad (con botón "Ir al sitio")
GET /empresa/:slug           → Perfil público de una empresa
```

### Base de datos para búsqueda
Requiere que `propiedades` y `empresas` tengan columna `visible_en_marketplace BOOLEAN DEFAULT false`.
- Solo se muestran empresas/propiedades con `visible_en_marketplace = true`
- El operador (SuiteManager) controla esto desde un panel de superadmin

### Fases de build

| Fase | Entregable | Esfuerzo |
|------|-----------|---------|
| 1.1 | `tenantResolver.js` detecta hostname raíz → `req.isMarketplace = true` | 1h |
| 1.2 | Homepage marketplace (hero estático + búsqueda básica) | 4h |
| 1.3 | Endpoint de búsqueda cross-empresa con filtros básicos | 6h |
| 1.4 | Página destino `/destino/:ciudad` generada por IA | 4h |
| 1.5 | Panel superadmin para controlar visibilidad | 8h |
| 1.6 | SEO: sitemaps, canonical, og:image por propiedad | 3h |

---

## Estado de Auditorías (2026-04-19)

### UI
- 🔴 **1 alta prioridad**: `propiedad.ejs:663` usa `text-red-600` → cambiar a `text-danger-600`
- 🟡 **1 media prioridad**: `propiedad.ejs:643` botón sin clase `.btn-*`
- ⚪ 2 baja prioridad: colores hex en `<head>` CSS (cosmético)

**Acción inmediata:** Corregir los 2 primeros antes del próximo deploy.

### Complejidad
- 🔴 `resenasService.js`: función `generarResenasAutomaticas` (143 líneas) + demasiados exports (15)
- 🔴 `website.property.page.js`: función `renderPropiedadPublica` (130 líneas)

**Acción recomendada:** Refactorizar antes de Sprint 2 (el archivo de property page será tocado para agregar el calendario).

---

## Prioridades Inmediatas (esta semana)

1. **Corregir UI alta prioridad** — `text-red-600` → `text-danger-600` en `propiedad.ejs:663`
2. **Publicar una reseña de prueba** — Para verificar que la sección de reseñas renderiza correctamente
3. **Regenerar narrativa de Cabaña 10** — Desde SPA → "Configurar Web" → "Regenerar con IA" para poblar `websiteData.h1` con el nuevo prompt mejorado
4. **Iniciar Fase 2B** — Calendario de disponibilidad (mayor impacto en conversión)

---

## Dependencias y Consideraciones

- **Cursor co-development**: Archivos refactorizados por Cursor deben ser verificados antes de tocarlos. Revisar especialmente: `website.property.page.js`, `buildContextService.ssrEmpresa.js`, `resenasService.js`
- **CSS rebuild**: Cualquier nueva clase semántica requiere `cd backend && npm run build`
- **Restart requerido**: El servidor Node NO tiene hot-reload; cada cambio de backend requiere reinicio manual
- **Multi-tenant siempre**: Capa 1 necesita `empresa_id` en cada query pero también un índice en `propiedades.ciudad` para búsqueda eficiente
