# Plan: Rediseño "Contenido Web" → Wizard por Alojamiento

**Estado:** Pendiente de implementación
**Prioridad:** Alta (define la SSR pública)
**Referencia visual:** Seguir el mismo estilo de `/galeria-propiedad` (tarjetas, overlay centrado, tokens `primary-*`, `success-*`, etc.)

---

## 1. Problema actual

La página `/website-alojamientos` usa un `<select>` dropdown para elegir propiedad y muestra todo en bloques verticales sin guía. No es intuitivo, mezcla secciones de empresa con secciones de alojamiento, y no aprovecha el flujo de IA de forma guiada.

---

## 2. Visión objetivo

**Pantalla 1 — Selector de alojamientos (como galería)**
- Cards por propiedad con: thumbnail (cardImage), nombre, capacidad, badge de completitud (% de wizard completado)
- Indicadores de estado: "Descripción IA ✓", "Fotos ✓ (3/5 espacios)", "SEO ✓"
- Botón separado "⚙️ Configuración General del Sitio Web" (abre modal o sección colapsable)

**Pantalla 2 — Wizard por propiedad (3 pasos)**
```
← Volver   [Cabaña 3]   Paso 1 de 3: Identidad  ●○○
────────────────────────────────────────────────────
```
- Paso 1: Identidad (descripción IA, puntos fuertes)
- Paso 2: Fotos por espacio (foto plan + wizard de subida)
- Paso 3: SEO y card image (meta title, descripción, imagen de tarjeta)
- Navegación: Anterior / Siguiente / Guardar todo
- Cada paso con estado: ✓ completo, ⚡ en progreso, ○ pendiente

---

## 3. Archivos a modificar / crear

### Frontend

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `frontend/src/views/websiteAlojamientos.js` | **Reescribir** | Pantalla 1: selector de cards + modal Config General |
| `frontend/src/views/components/configurarWebPublica/webPublica.wizard.js` | **Crear nuevo** | Orquestador del wizard (state, pasos, navegación) |
| `frontend/src/views/components/configurarWebPublica/webPublica.paso1.identidad.js` | **Crear nuevo** | Paso 1: descripción IA + puntos fuertes |
| `frontend/src/views/components/configurarWebPublica/webPublica.paso2.fotos.js` | **Crear nuevo** | Paso 2: foto plan + wizard de subida (refactor de webPublica.galeria.js) |
| `frontend/src/views/components/configurarWebPublica/webPublica.paso3.seo.js` | **Crear nuevo** | Paso 3: SEO + card image |
| `frontend/src/views/components/configurarWebPublica/webPublica.general.js` | **Adaptar** | Mover a modal "Configuración General" — ya existe, solo cambiar cómo se invoca |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` | **Deprecar** | Su lógica migra a webPublica.paso2.fotos.js |
| `frontend/src/views/components/configurarWebPublica/webPublica.galeria.helpers.js` | **Mantener** | Helpers reutilizables por paso2 |

### Backend (sin cambios necesarios)
Todos los endpoints ya existen. Ver sección 5.

---

## 4. Diseño detallado por pantalla

### Pantalla 1 — Selector

```
[📝 Contenido por Alojamiento]
[Personaliza cómo se ven tus cabañas en el sitio web]

[Barra de progreso global: 2 de 5 alojamientos completos]

⚙️ Configuración General del Sitio Web   ← botón outline

Cards grid (igual que galería):
┌────────────────────────────────┐
│  [thumbnail / placeholder]     │
│  🏠 Cabaña 1                   │
│  Cap. 6 · 3 espacios           │
│  ✓ Descripción  ✓ Fotos  ✗ SEO │
│  Progreso: ██████░░ 66%        │
│  [Editar contenido →]          │
└────────────────────────────────┘
```

**Completitud de una propiedad (para badge y progreso):**
- Descripción IA: `websiteData.aiDescription` tiene > 50 chars → ✓
- Fotos: al menos 1 espacio con imagen en `websiteData.images` → ✓
- SEO: `websiteData.metaTitle` o `websiteData.metaDescription` definido → ✓

### Pantalla 2 — Wizard

```
← Cabaña 1    [Paso 1] [Paso 2] [Paso 3]    Guardar
──────────────────────────────────────────────────

PASO 1 — IDENTIDAD
  ┌─ Descripción para huéspedes ──────────────────┐
  │ [Textarea con texto actual]                   │
  │ [⚡ Generar con IA]  [Regenerar]              │
  └───────────────────────────────────────────────┘
  ┌─ Puntos fuertes ──────────────────────────────┐
  │ • Vista al lago · • Cocina equipada           │
  │ (editables como chips/tags)                   │
  └───────────────────────────────────────────────┘
                             [Siguiente paso →]

PASO 2 — FOTOS POR ESPACIO
  [Plan de fotos requeridas: Dormitorio 1, Baño, Sala]
  Por cada espacio:
  ┌─ Dormitorio Principal ───────────────────────┐
  │ [img] [img] [img]  [+ Subir fotos]          │
  │ 3 fotos sugeridas: cama, detalle, ventana    │
  └──────────────────────────────────────────────┘
  [← Anterior]                  [Siguiente paso →]

PASO 3 — SEO Y PORTADA
  ┌─ Imagen de portada (card image) ─────────────┐
  │ [thumbnail actual]  [Cambiar imagen]         │
  └──────────────────────────────────────────────┘
  ┌─ SEO ─────────────────────────────────────────┐
  │ Meta title: [________________]  [IA]         │
  │ Meta desc:  [________________]  [IA]         │
  └───────────────────────────────────────────────┘
  [← Anterior]                    [✓ Guardar todo]
```

---

## 5. Endpoints backend disponibles (sin tocar)

| Endpoint | Usado en paso |
|----------|---------------|
| `GET /propiedades` | Pantalla 1 (cards) |
| `GET /empresa` | Pantalla 1 (config general) |
| `GET /website/propiedad/:id` | Al entrar al wizard (carga datos actuales) |
| `PUT /website/propiedad/:id` | Paso 3 (guardar card image) |
| `POST /website/propiedad/:id/generate-ai-text` | Paso 1 (generar descripción IA) |
| `GET /website/propiedad/:id/photo-plan` | Paso 2 (obtener plan de fotos) |
| `POST /website/propiedad/:id/upload-image/:componentId` | Paso 2 (subir foto) |
| `DELETE /website/propiedad/:id/delete-image/:componentId/:imageId` | Paso 2 |
| `PUT /website/home-settings` | Config General |
| `POST /website/optimize-profile` | Config General (IA) |
| `POST /empresa/upload-logo` | Config General |
| `PUT /empresa` | Config General |

**Endpoints que podrían ser útiles agregar:**
- `PUT /website/propiedad/:id/seo` — guardar metaTitle, metaDescription en `websiteData`
  (Actualmente solo existe `PUT /website/propiedad/:id` para cardImage)

---

## 6. Estado de `websiteData` por propiedad

Estructura en `metadata.websiteData` de PostgreSQL:
```json
{
  "aiDescription": "string",       ← Paso 1
  "puntosFuertes": ["string"],     ← Paso 1 (puede no existir aún)
  "images": {                      ← Paso 2
    "[componentId]": [{ imageId, storagePath, altText, title }]
  },
  "cardImage": { imageId, storagePath, altText },  ← Paso 3
  "metaTitle": "string",           ← Paso 3 (puede no existir aún)
  "metaDescription": "string"      ← Paso 3 (puede no existir aún)
}
```

**Backend: endpoint a crear para SEO:**
```
PUT /website/propiedad/:propiedadId/seo
Body: { metaTitle, metaDescription }
→ actualizarPropiedad(db, empresaId, propiedadId, { websiteData: { metaTitle, metaDescription } })
```
Archivo: `backend/api/ssr/config.routes.js`

---

## 7. Orden de implementación

1. **Backend** — Agregar `PUT /website/propiedad/:id/seo` en `backend/api/ssr/config.routes.js`
2. **`websiteAlojamientos.js`** — Reescribir como pantalla de cards (sin wizard todavía)
3. **`webPublica.wizard.js`** — Crear orquestador: state del wizard, renderStep, navegación
4. **`webPublica.paso1.identidad.js`** — Descripción IA + puntos fuertes editables
5. **`webPublica.paso2.fotos.js`** — Foto plan + upload (refactorizar lógica de webPublica.galeria.js)
6. **`webPublica.paso3.seo.js`** — Card image selector + SEO fields
7. **Integrar** en `websiteAlojamientos.js` (llamar al wizard al clickar una card)
8. **Adaptar** `webPublica.general.js` → Modal de Config General en pantalla 1
9. **Auditorías** UI + complejidad → fix críticos → build CSS

---

## 8. Detalles de implementación críticos

### Cálculo de completitud (para badge en cards)
```javascript
function calcularCompletitud(websiteData) {
    const checks = [
        (websiteData?.aiDescription || '').length > 50,  // descripción
        Object.values(websiteData?.images || {}).some(arr => arr.length > 0),  // fotos
        !!(websiteData?.metaTitle || websiteData?.metaDescription),  // seo
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
}
```

### Wizard state
```javascript
const wizardState = {
    propiedadId: null,
    propiedadNombre: '',
    paso: 1,  // 1, 2, 3
    datos: null,  // resultado de GET /website/propiedad/:id
    dirty: false,  // cambios sin guardar
};
```

### Puntos fuertes (puntosFuertes)
El endpoint `generate-ai-text` devuelve `{ descripcion, puntosFuertes }`.
Los `puntosFuertes` deben mostrarse como chips editables (añadir/quitar tags).
Al guardar paso 1: `PUT /website/propiedad/:id` con `{ websiteData: { aiDescription, puntosFuertes } }`.

### Upload progress en paso 2
Usar el mismo overlay centrado implementado en `galeriaPropiedad.js`:
- `showUploadOverlay()` / `updateUploadOverlay()` / `hideUploadOverlay()`
- Patrón: DOM appended a `document.body`, no inline en el render.

### Modularidad (reglas CLAUDE.md)
- Máx 400 líneas por archivo → wizard.js, paso1.js, paso2.js, paso3.js separados
- Máx 60 líneas por función → funciones de render separadas de bind/handlers
- Ejecutar `audit-complexity-monitored.js` después de cada archivo

---

## 9. Archivos NO tocar
- `webPublica.galeria.helpers.js` — mantener, reutilizar en paso2

---

## 10. Checklist de entrega

- [x] Backend: PUT /website/propiedad/:id/seo en config.routes.js
- [x] Backend: PUT /website/propiedad/:id/identidad en config.routes.js
- [x] Backend: generate-ai-text ahora devuelve { texto, puntosFuertes }
- [x] websiteAlojamientos.js: Cards con completitud + botón Config General
- [x] webPublica.wizard.js: Orquestador con 3 pasos + navegación
- [x] webPublica.paso1.identidad.js: Descripción IA + puntosFuertes como chips
- [x] webPublica.paso2.fotos.js: Photo plan + upload overlay centrado
- [x] webPublica.paso3.seo.js: Card image + metaTitle + metaDescription
- [x] Config General como modal (webPublica.general.js sin cambios internos)
- [x] 0 problemas alta prioridad en audit-ui
- [x] 0 nuevos críticos en audit-complexity
- [x] npm run build (build CSS Tailwind)
