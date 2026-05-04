# Solo UI — Marketplace `suitemanagers.com` (capa plataforma)

**Propósito:** documento de trabajo **exclusivo para UI/UX** del sitio público de la **plataforma** (apex / `www`), no del panel SPA ni del SSR por tenant. Sirve para iterar hacia una experiencia tipo **referencia Airbnb** (patrón de conversión y jerarquía visual) sin confundir alcance con contratos de IA o feeds Google.

**Lectura previa obligatoria en sesiones que toquen esto:** `LEER-PRIMERO.md` → `SHARED_CONTEXT.md`; si el cambio puede rozar precios, OpenAPI o feeds globales: `TASKS/tema/SM-venta-ia/venta-ia.md` + `TASKS/coordinacion-cursor-claude-ia-venta.md` (§2 estado, §3 zona caliente).

---

## 1. Qué es “solo UI” aquí

| Incluye | No incluye (salvo tarea explícita aparte) |
|---------|-------------------------------------------|
| EJS marketplace: `backend/views/marketplace/*` | Lógica nueva de precios / disponibilidad / reserva |
| Estilos del marketplace: `<style>` en EJS, clases, assets bajo `/public` usados solo por marketplace | Cambios a `backend/openapi/*.yaml`, `publicAiController`, `suitemanagerApiController` |
| Copy i18n marketplace: `backend/services/marketplaceUiStrings.js` | Feeds XML partner (`/feeds/google/…`), `googleHotelsGlobalService.js` |
| Orden visual, grid, hero, búsqueda, CTAs, tipografía, espaciado | Panel SPA **Canales IA** (`frontend/src/views/canalesIa.js`) — otro documento / tarea |
| Accesibilidad básica (contraste, foco, labels) | Mezclar componentes o rutas SPA dentro del SSR marketplace |

**Regla de diseño del repo:** preferir **tokens semánticos** (`primary-*`, `danger-*`, …) en `backend/tailwind.config.js` y flujo `npm run build` para CSS compilado donde aplique; el marketplace hoy mezcla `website.css` y estilos inline en EJS — al refactorizar UI, **ir alineando** con el design system (evitar nuevos grises hex sueltos salvo transición documentada).

**Regla producto (.cursor SSR AI commerce):** “Airbnb-like” = **referencia de UX**, no clon de marca ni copy de terceros.

---

## 2. Dónde vive el código (mapa rápido)

| Pieza | Ruta |
|-------|------|
| Router marketplace | `backend/routes/marketplace.js` |
| Homepage HTML | `backend/views/marketplace/index.ejs` |
| Catálogo humano Google Hotels | `backend/views/marketplace/google-hotels-catalog.ejs` |
| Estilos + pie compartidos marketplace | `backend/views/partials/marketplace-common-styles.ejs`, `marketplace-footer.ejs` |
| Datos agregados listado | `backend/services/marketplaceService.js` |
| Strings ES/EN | `backend/services/marketplaceUiStrings.js` |
| API JSON pública listado | `GET /api/search.json` → `backend/routes/marketplaceSearchJson.handler.js` |
| Resolución host apex | `backend/middleware/tenantResolver.js` (marketplace sin tenant) |

---

## 3. Multi-tenant — qué significa en esta página

- **Operaciones y datos privados** siguen **100 % aislados por `empresa_id`** en SPA y en SSR de cada subdominio.
- **`suitemanagers.com` (marketplace) es una excepción deliberada de “solo una empresa”**: es **descubrimiento cruzado** (catálogo público). Solo expone lo que ya es público (propiedades activas, empresa con `subdominio`, etc.). **No** es mezcla de reservas, CRM ni datos sensibles entre tenants.
- El **cierre** (checkout, políticas, pago conceptual) ocurre en el **sitio del operador**: deep link a `https://<subdominio>.<PLATFORM_DOMAIN>/propiedad/...` (u dominio custom). La UI marketplace debe dejar eso **explícito** (confianza + “dónde reservas”).

---

## 4. Dónde “chocamos” con `venta-ia.md` (coordinación)

| Tema en `venta-ia.md` | Riesgo si solo UI se descontrola | Qué hacer |
|----------------------|----------------------------------|-----------|
| §1.1 / §7 Partner Google (feeds globales, precisión precio) | Tocar textos que prometan disponibilidad/precio distinto al feed o al checkout tenant | UI solo: claims alineados a “consultar en la ficha / fechas”; no fijar precios hardcode |
| §2.3 API pública / OpenAPI | Cambiar URLs o formas de enlazar que rompan Actions | No renombrar rutas públicas desde tareas “solo UI” |
| §2.6 Canales IA (tokens, `hotelId`, `isListed`) | Duplicar formularios de config en marketplace | Config solo en SPA Canales IA / sitio web; marketplace solo **muestra** catálogo |
| §1.2 DNS / dominios | Copy que asuma un solo TLD | Respetar `PLATFORM_DOMAIN` / textos parametrizados en `marketplaceUiStrings` |

Si una mejora UI **requiere** nuevo campo de API o cambio en `GET /api/search.json`, **parar** y tratarlo como tarea mixta: actualizar contrato + `venta-ia` / coordinación §3.

---

## 5. Objetivo visual (fase actual)

- **Referencia:** airbnb.com — búsqueda prominente, tarjetas limpias, fotos grandes, jerarquía clara, footer de confianza, menos ruido visual.
- **Entregables incrementales sugeridos:** (1) hero + barra de búsqueda; (2) grid de tarjetas y estados vacíos; (3) tipografía y espaciado; (4) `/google-hotels` alineado visualmente con la home; (5) revisión móvil.

---

## 6. Cierre de sesión (checklist)

- [ ] No se importó lógica SPA en EJS.
- [ ] Copy sensible multi-idioma vía `marketplaceUiStrings` (no strings sueltas sin ES/EN).
- [ ] Tras cambios de clases/CSS: `cd backend && npm run build` si aplica Tailwind al bundle website.
- [ ] `node scripts/tooling/audit-ui-monitored.js` desde la raíz del repo.
- [ ] Si se tocó contrato o JSON público: **no** es “solo UI”; documentar en `coordinacion-cursor-claude-ia-venta.md`.

---

## 7. Historial breve

| Fecha | Nota |
|-------|------|
| 2026-05-03 | Creación del documento; alcance marketplace plataforma + límites con `venta-ia.md`. |
| 2026-05-03 | Primera iteración UI home: hero ES/EN (`marketplaceUiStrings`), fondo `neutral-50`, header translúcido, tarjetas 1:1 y sombras más suaves (`index.ejs`). |
| 2026-05-03 | Paridad home ↔ `/google-hotels` (partials compartidos); búsqueda responsive; ordenación `sort`; enlaces `/legal/terms` y `/privacy`; `h1` en resultados filtrados; JSON-LD `priceRange` por tramos; catálogo GH: tarjeta clicable, `ItemList`+`BreadcrumbList`, `og:image`, grid 4 cols, vacío con CTA. |

*Este archivo es el ancla para chats o agentes que trabajen “solo UI” en la landing de ventas con IA en dominio plataforma.*
