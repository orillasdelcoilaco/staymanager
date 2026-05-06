# Auditoría — causas raíz del puntaje Lighthouse / PageSpeed

## 1. Expectativa “100” vs realidad del motor

- Lighthouse calcula el **rendimiento** con una **combinación ponderada** de métricas lab (FCP, LCP, TBT, CLS, SI). Pequeños cambios en LCP o en peso de imagen mueven **decenas de puntos**.
- **Datos de campo (CrUX)** en PSI pueden decir “sin datos” hasta tener volumen; **no** son el mismo número que el lab.
- Un **100 estable en móvil lab + 4G lenta** para sitios con **hero fullscreen**, **lista de imágenes**, **CSS de componentes** y **JS del producto** es **infrecuente**; la meta viable es **≈90–100 en categorías Best Practices / SEO** y **rendimiento lo más alto posible** sin degradar UX.

## 2. Causas raíz detectadas en código (SuiteManager)

### 2.1 Imágenes en listados SSR ≠ tamaño mostrado (crítico)

- La galería genera **dos artefactos** por foto (`storage_url` ~1200px y `thumbnail_url` ~400px en WebP).
- **`syncToWebsite`** solo persistía `storagePath` en `websiteData.images[]` y `cardImage`, **sin `thumbnailUrl`**.
- La tarjeta del home (`partials/property-card.ejs`) usaba solo **`cardImage.storagePath`** → el navegador descargaba **imagen de portada/galería grande** para un thumbnail visual ~cuadrado.

**Efecto:** Lighthouse “Mejorar la entrega de imágenes” / peso transferido alto → **LCP/TBT en galería** y **Speed Index** peores de lo necesario.

**Corrección aplicada en código:** persistir `thumbnailUrl` en sync + generar miniatura en subida de portada + usar **`thumbnailUrl` preferente** en plantilla de tarjeta.

### 2.2 Font Awesome vía CDN

- **Mitigación:** en lugar de `all.min.css` (todas las familias), el SSR usa **`fontawesome.min.css` + `solid.min.css` + `brands.min.css`** (sin regular/light), misma versión **6.5.0** en todo el sitio, carga **no bloqueante**, `preconnect` a cdnjs vía `partials/ssr-preconnect-cdnjs.ejs`, enlaces centralizados en `partials/ssr-fontawesome-deferred.ejs`.
- **Pendiente opcional:** SVG inline solo donde el peso lo justifique.

### 2.3 CSS único `website.css` (Tailwind compilado)

- `tailwindcss` incluye **todas** las utilidades referenciadas en `backend/views/**/*.ejs` — volumen inevitable pero acotado por purge.
- **Efecto:** parte del audit “CSS sin usar” si Lighthouse compara contra pintado real.

**Pendiente (fase 2–3):** dividir CSS crítico vs secundario solo si medimos ganancia > coste de mantenimiento.

### 2.4 Hero / LCP

- Hero full ya se optimiza con Sharp (WebP, máx. ancho 1920).
- **Mitigación:** en **`POST /website/upload-hero-image`** se genera además **`heroImageThumbUrl`** (≈960px). Home SSR usa **`srcset`/`sizes`** + **`preload` con `imagesrcset`** cuando existen full + thumb.
- Empresas con portada **anterior** a este cambio: sin thumb hasta **volver a subir** la imagen de portada.

### 2.5 Widget Concierge (`partials/chat-widget.ejs` + `chat.js`)

- **Mitigación:** `chat.js` ya no bloquea el parse final del documento de forma síncrona: se inyecta con `<script async>` tras **primer scroll** (compromiso de usuario con la página) o **`requestIdleCallback`** (tope ~4,5 s). El init del widget funciona aunque el script llegue tarde (`chat.js` sin depender solo de `DOMContentLoaded`).

### 2.6 Marketplace (`marketplace/index.ejs`)

- **Alineado** con home: mismos partials FA + `preconnect` cdnjs; skip link al contenido principal (`partials/marketplace-skip-main.ejs`).

## 3. Qué ya estaba bien alineado con el propósito “producto optimiza fotos”

- `optimizeImage` (WebP, resize, sin upscale agresivo).
- Galería: full + thumb en subida/replace.
- Portada subida por API: ya limitaba ancho a **800px** — razonable para card mediana pero **grande para miniatura de grid**; por eso el thumb dedicado importa.

## 4. Plan por fases (resumen)

| Fase | Contenido |
|------|-----------|
| **1** | Thumbnails en datos + plantillas listado; documentación tema; tablero |
| **2** | Font Awesome: defer en todas las plantillas SSR + marketplace; evaluar subset |
| **3** | Hero responsive (`srcset`) si hay variantes; opcional CDN resize params |
| **4** | Concierge: carga diferida (scroll + idle); medir TBT en staging/prod |
| **5** | Accesibilidad: skip link + `#main-content`, labels en footer/redes; revisión H*/contraste incremental |

## 5. Bitácora

| Fecha | Nota |
|-------|------|
| 2026-05-05 | Tema creado; auditoría; fix sync + portada thumb + property-card |
| 2026-05-05 | Font Awesome no bloqueante en propiedad, contacto, reservar, términos, legal/privacy, legal/terms (oleada restante SSR) |
| 2026-05-05 | Concierge: carga diferida scroll + idle; `chat.js` init sin DOMContentLoaded exclusivo |
| 2026-05-05 | FA modular solid+brands 6.5.0 + partials; preconnect marketplace; hero thumb + srcset/preload; a11y skip/main |
| 2026-05-05 | PSI producción: srcset + URL `_thumb` si BD duplica full; Tailwind `--minify`; h2 sr-only listado; contraste footer/concierge |
