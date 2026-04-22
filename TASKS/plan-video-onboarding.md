# Plan: Video Onboarding — Extracción IA desde Recorrido de Video
**Estado:** BACKLOG — implementar después de estabilizar wizard de Contenido Web  
**Prioridad:** Alta (diferenciador competitivo frente a OTAs)  
**Fecha de creación:** 2026-04-02

---

## 🎯 Objetivo

Permitir que el cliente suba la URL de un video (YouTube/TikTok/Vimeo) de su alojamiento y SuiteManager haga todo el trabajo: extraer frames inteligentes por espacio, analizarlos con IA, generar descripción, puntos fuertes, alt-text SEO, meta título/descripción, y llenar los slots del wizard automáticamente. El video embebido queda disponible en la SSR.

El cliente llega con un celular y un video. En 10 minutos tiene una web publicada.

---

## 🧠 Premisa Estratégica

SuiteManager no alimenta OTAs — **es el destino**. El video no necesita cumplir estándares de Airbnb/Booking. La IA "ve la película completa" en vez de analizar fotos desconectadas, produciendo:
- Descripciones más ricas y contextuales (sabe que el baño está conectado al dormitorio, la vista desde la ventana, etc.)
- Respuestas a huéspedes de mayor calidad (vio el lugar, no le contaron)
- SEO superior: embed de YouTube + schema markup + fotos WebP con alt-text preciso

---

## 📋 Fases de Implementación

### FASE 1 — Infraestructura de Extracción (Backend)

#### 1.1 Dependencias nuevas
```bash
npm install ytdl-core @distube/ytdl-core   # Descarga temporal YouTube
npm install node-fetch                       # Ya existe — confirmar versión
npm install fluent-ffmpeg                    # Wrapper ffmpeg para Node
```
**Importante:** `ffmpeg` binary debe estar disponible en Render. Agregar en `render.yaml` o `package.json`:
```json
"scripts": {
  "build": "apt-get install -y ffmpeg && npm run build:css"
}
```
Alternativa más robusta: usar **ffmpeg-static** (binario incluido en npm, sin apt-get):
```bash
npm install ffmpeg-static
```

#### 1.2 Servicio nuevo: `backend/services/videoProcessingService.js`
Responsabilidades:
- `descargarVideoTemporal(url, platform)` → descarga a `/tmp/video_[uuid].mp4` (temporal en Render)
- `extraerFrames(videoPath, totalFrames, outputDir)` → usa fluent-ffmpeg, extrae N frames distribuidos uniformemente a `/tmp/frames_[uuid]/frame_XXX.jpg`
- `seleccionarFramesInteligentes(framesDir, componentes)` → agrupa frames por tiempo y asigna al componente más probable según posición temporal
- `limpiarArchivosTemp(paths[])` → elimina video y frames del filesystem después de procesar
- `obtenerDuracionVideo(videoPath)` → retorna duración en segundos para calcular distribución de frames

**Estrategia de extracción de frames:**
- Video ≤ 3 min: 1 frame cada 8 segundos
- Video 3-10 min: 1 frame cada 15 segundos
- Video > 10 min: máximo 60 frames distribuidos uniformemente
- Nunca extraer primeros 3 segundos (intro con logo/título) ni últimos 3 (fade out)

#### 1.3 Servicio nuevo: `backend/services/videoPlatformService.js`
Responsabilidades:
- `detectarPlataforma(url)` → retorna `'youtube' | 'tiktok' | 'vimeo' | 'direct' | null`
- `descargarDesdeYouTube(url)` → usa `@distube/ytdl-core` con calidad `'lowestvideo'` (menor tamaño, suficiente para IA)
- `descargarDesdeTikTok(url)` → usar TikTok oEmbed API + descarga directa
- `descargarDesdeVimeo(url)` → usar Vimeo oEmbed para obtener URL directa
- `obtenerMetadatosVideo(url, platform)` → retorna `{ titulo, descripcion, duracion, thumbnailUrl }` — útil para pre-llenar descripción

**Límites de descarga:**
- Tamaño máximo permitido: 500MB
- Timeout de descarga: 120 segundos
- Si excede: error claro al usuario con mensaje de guía

#### 1.4 Endpoint nuevo: `POST /website/propiedad/:propiedadId/procesar-video`
```javascript
// Body: { videoUrl: string }
// Proceso:
// 1. Detectar plataforma
// 2. Descargar video temporal (stream a /tmp, no cargar en memoria completo)
// 3. Extraer frames
// 4. Subir frames a Firebase Storage como WebP optimizados (usando optimizeImage existente)
// 5. Correr generarMetadataImagen por cada frame con contexto del componente
// 6. Distribuir frames entre componentes del alojamiento por posición temporal
// 7. Guardar en websiteData.images igual que el flujo actual
// 8. Guardar videoUrl en websiteData.videoUrl + videoPlatform
// 9. Limpiar archivos temp
// 10. Retornar { framesGenerados, imagesPorComponente, videoUrl }

// Response: mismo formato que upload-image (array de imageData con advertencia/null)
```

**Manejo de timeouts en Render:**
Render tiene timeout de 30s en requests HTTP. El procesamiento de video puede tomar 2-5 minutos. Solución: **respuesta asíncrona con polling**:
```
POST /procesar-video → { jobId: "uuid", status: "processing" }
GET  /procesar-video/:jobId → { status: "processing|done|error", resultado? }
```
Implementar con una tabla simple `video_jobs` en PostgreSQL o en memoria con Map (si el server no reinicia entre requests — riesgoso en Render). **Recomendado: tabla PostgreSQL.**

```sql
CREATE TABLE video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL,
  propiedad_id TEXT NOT NULL,
  status TEXT DEFAULT 'processing', -- processing | done | error
  resultado JSONB,
  error_msg TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### FASE 2 — Integración con Wizard (Frontend)

#### 2.1 Nuevo componente: `webPublica.paso2.video.js`
Flujo UX:
1. Input de URL con detección automática de plataforma (muestra ícono YouTube/TikTok/Vimeo)
2. Preview del thumbnail del video al pegar la URL
3. Botón "Procesar con IA" → inicia job asíncrono
4. Progress indicator con polling cada 3 segundos a `/procesar-video/:jobId`
5. Al completar: muestra los frames extraídos en los slots del wizard (igual que flujo actual)
6. El usuario puede reemplazar cualquier frame con foto manual si la calidad no le satisface

**Estados del componente:**
- `idle` — input de URL vacío
- `detecting` — validando URL y obteniendo thumbnail
- `ready` — URL válida, muestra preview, botón "Procesar"
- `processing` — polling activo, barra de progreso animada
- `done` — frames en slots, mensaje de éxito
- `error` — mensaje de error con opción de reintentar

#### 2.2 Modificar `webPublica.galeria.js`
- Agregar opción "📹 Desde Video" en el header de cada componente (junto a Asistente IA / Subir / Galería)
- Al procesar video, los frames se inyectan en `currentImages[componentId]` igual que `handleSubirMasivo`
- Los frames tienen `fromVideo: true` en su metadata para distinguirlos visualmente (badge "Video")

#### 2.3 Modificar `webPublica.paso2.fotos.js`
- Si el alojamiento ya tiene `websiteData.videoUrl`, mostrar el video embebido en un banner informativo al inicio del paso 2
- Botón "Cambiar video" para reprocesar con otro video

#### 2.4 Modificar `websiteAlojamientos.js` — tarjetas selector
- Si el alojamiento tiene `videoUrl`, mostrar badge "🎬 Video" en la tarjeta
- El porcentaje de completitud suma si tiene video (nueva métrica)

---

### FASE 3 — SSR (Web Pública)

#### 3.1 Modificar `publicWebsiteService.js`
- Incluir `websiteData.videoUrl` y `websiteData.videoPlatform` en los datos que se pasan a la vista EJS

#### 3.2 Modificar vistas EJS del alojamiento
- Embed del video en la página del alojamiento (debajo de la galería de fotos)
- YouTube: `<iframe>` con `loading="lazy"` y `privacy-enhanced mode` (`youtube-nocookie.com`)
- TikTok: oEmbed HTML
- Schema markup `VideoObject` para SEO:
```json
{
  "@type": "VideoObject",
  "name": "Recorrido Cabaña 10",
  "description": "...",
  "thumbnailUrl": "...",
  "embedUrl": "https://www.youtube.com/embed/...",
  "uploadDate": "..."
}
```

---

### FASE 4 — IA Contextual Mejorada

#### 4.1 Modificar `aiContentService.js` — `generarDescripcionAlojamiento`
Si el alojamiento tiene frames de video + metadatos del video:
- Pasar todos los frames simultáneamente a Gemini (batch) en lugar de uno por uno
- El prompt incluye: "Estos frames son de un recorrido continuo del alojamiento. Analiza el conjunto completo para entender la distribución espacial, flujo de espacios, y características únicas."
- Esto produce descripciones cualitativamente superiores porque la IA tiene contexto espacial completo

#### 4.2 Nuevo endpoint: `POST /website/propiedad/:propiedadId/generar-descripcion-desde-video`
Usa los frames almacenados + metadatos del video para regenerar descripción, puntos fuertes y SEO en un solo llamado batch a Gemini. Más barato que N llamadas individuales.

---

## ⚠️ Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| YouTube cambia API/bloquea ytdl-core | Alta | Alto | Tener fallback a yt-dlp via child_process; monitorear repositorio ytdl-core |
| ffmpeg no disponible en Render | Media | Alto | Usar ffmpeg-static (npm) que incluye el binario |
| Video > 500MB causa OOM en Render | Media | Alto | Stream a disco, nunca cargar en memoria completo |
| Timeout 30s de Render | Alta | Alto | Arquitectura de jobs asíncronos con polling (tabla video_jobs) |
| Frames borrosos/oscuros en interiores | Alta | Medio | Análisis de calidad por frame (brillo, blur detection) antes de subir; marcar como "mejorar" |
| Costos IA disparan si alguien sube video de 1 hora | Baja | Alto | Límite duro de 60 frames por video; validar duración antes de procesar |
| TikTok cambia estructura de URL/embed | Alta | Medio | TikTok es optional; documentar como "experimental" |
| Términos de servicio de YouTube | Media | Alto | Usar YouTube Data API v3 oficial para descarga; revisar TOS periódicamente |

---

## 🗄️ Cambios en Base de Datos

### Tabla nueva: `video_jobs`
```sql
CREATE TABLE video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id TEXT NOT NULL,
  propiedad_id TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  resultado JSONB,
  error_msg TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_video_jobs_empresa ON video_jobs(empresa_id);
CREATE INDEX idx_video_jobs_status ON video_jobs(status, created_at);
```

### Columna nueva en `websiteData` (JSONB existente en `propiedades`):
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "videoPlatform": "youtube",
  "videoThumbnail": "https://...",
  "videoProcessedAt": "2026-04-02T...",
  "framesCount": 24
}
```
No requiere migración de esquema — es JSONB, se agrega directamente.

---

## 📊 Estimación de Costos por Alojamiento

| Componente | Costo estimado |
|-----------|---------------|
| Descarga video (bandwidth Render) | ~$0.00 (incluido en plan) |
| ffmpeg extracción frames | $0.00 (CPU local) |
| Gemini Flash análisis 30 frames | ~$0.06 |
| Firebase Storage 30 frames WebP (~3MB total) | ~$0.00009/mes |
| **Total por alojamiento** | **~$0.06** |

Comparado con análisis de 30 fotos individuales en flujo actual: ~$0.06 también. **Costo idéntico, resultado superior.**

---

## 🔗 Dependencias con Código Existente

- `backend/services/aiContentService.js` → `generarMetadataImagen` — reutilizar sin cambios
- `backend/services/imageProcessingService.js` → `optimizeImage` — reutilizar para convertir frames a WebP
- `backend/services/storageService.js` → `uploadFile` — reutilizar para subir frames
- `backend/api/ssr/config.routes.js` → estructura de `upload-image` como referencia
- `frontend/src/views/components/configurarWebPublica/webPublica.galeria.js` → `currentImages`, `renderSlotsGrid` — los frames se inyectan igual que fotos normales

---

## ✅ Checklist de Implementación

### Backend
- [ ] Instalar `ffmpeg-static`, `@distube/ytdl-core`, `fluent-ffmpeg`
- [ ] Crear tabla `video_jobs` en PostgreSQL
- [ ] Crear `videoProcessingService.js`
- [ ] Crear `videoPlatformService.js`
- [ ] Crear endpoint `POST /procesar-video` (inicia job asíncrono)
- [ ] Crear endpoint `GET /procesar-video/:jobId` (polling de estado)
- [ ] Crear endpoint `POST /generar-descripcion-desde-video`
- [ ] Tests con videos cortos de YouTube, TikTok y Vimeo
- [ ] Validar límite de duración y tamaño antes de procesar
- [ ] Limpiar archivos /tmp después de cada job

### Frontend
- [ ] Crear `webPublica.paso2.video.js` con estados y polling
- [ ] Modificar `webPublica.galeria.js` — agregar botón "Desde Video"
- [ ] Modificar `webPublica.paso2.fotos.js` — mostrar video embebido si existe
- [ ] Modificar `websiteAlojamientos.js` — badge y métrica de completitud
- [ ] UI de progreso con estimación de tiempo ("Procesando... ~2 minutos")

### SSR
- [ ] Modificar `publicWebsiteService.js` — incluir videoUrl en datos
- [ ] Modificar vista EJS del alojamiento — embed + schema VideoObject
- [ ] Probar indexación con Google Search Console

### QA
- [ ] Video con buena iluminación → verificar calidad de frames
- [ ] Video oscuro/interior → verificar detección y marcado "mejorar calidad"
- [ ] Video > 10 minutos → verificar límite de 60 frames
- [ ] Dos empresas diferentes procesando simultáneamente → verificar aislamiento Multi-Tenant
- [ ] Job que falla a mitad → verificar limpieza de archivos temp y estado de error correcto
