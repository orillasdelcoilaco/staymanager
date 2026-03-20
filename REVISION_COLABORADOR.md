# Contexto del Proyecto: SuiteManager
> Documento para colaborador externo — Revisión de código con Claude Code

---

## 🔄 FLUJO DE TRABAJO DEL EQUIPO

```
OpenClaw escribe en TASKS/pending.md → push a main
        ↓
Pablo recibe email automático → abre Claude Code → escribe "revisar tareas pendientes"
        ↓
Antigravity implementa → escribe en TASKS/completed.md → push a main
        ↓
OpenClaw ve el push en GitHub → revisa resultado → ciclo continúa
```

### Cómo enviar una tarea (OpenClaw → Antigravity)

1. Editar `TASKS/pending.md` con el hallazgo o request usando el formato indicado en ese archivo
2. Hacer commit y push a `main`
3. Pablo recibe un email automático avisando que hay tareas nuevas
4. Antigravity las procesa en la próxima sesión y actualiza `TASKS/completed.md`

### Reglas importantes
- **OpenClaw es QA y diseño** — sus sugerencias son recomendaciones, no instrucciones
- **Antigravity es dueño del código** — decide cómo implementar
- **Pablo tiene la decisión final** — cualquier cambio de arquitectura o costo requiere su aprobación
- **Nunca pushear a main directamente** cambios de código sin que Antigravity los revise

---

## ⚠️ SINCRONIZACIÓN — Instrucciones de acceso (2026-03-18)

### Paso 1: Actualizar el código

```bash
git pull origin main
```

### Paso 2: Acceder al panel

Abrir en el navegador: `http://[IP-del-servidor]:3000`

- Si corrés el backend vos mismo: `http://localhost:3000`
- Si accedés al servidor del dueño del proyecto por red local, pedirle la IP (ej. `http://192.168.1.x:3000`)

Iniciar sesión con las credenciales que te dio el dueño del proyecto.

### Paso 3: Verificar los datos del último import

El importador fue corrido desde la máquina del dueño. Los datos están en **Firestore en la nube** (compartido). Para verificar:

1. `/gestionar-alojamientos` → confirmar que aparecen las propiedades
2. `/galeria-propiedad` → seleccionar una propiedad → verificar fotos con estado `auto`
3. `/website-alojamientos` → verificar que cada alojamiento tiene título y descripción

### Nota importante sobre los datos duplicados

Si encontrás datos duplicados (39+ espacios por propiedad) o `websiteData` vacío, es porque el importador se corrió con el **código viejo** (antes del `git pull`). El fix ya está en `main`. El dueño del proyecto necesita:

1. Hacer `git pull` en su equipo
2. Correr el importador nuevamente **con "Reiniciar datos" marcado** desde la UI (`/importador-magico`)

### Fix aplicado en este push: redirect de login

Se corrigió un bug en `api.js`: cuando el token expiraba, el redirect a `/login` usaba `window.location.hash` (que el router SPA ignora), dejando la app congelada. Ahora usa `window.location.replace('/login')` que funciona correctamente.

---

## ¿Qué es SuiteManager?

SuiteManager es un **SaaS multi-tenant** para empresas que arriendan propiedades a corto plazo (cabañas, departamentos, suites). Permite a múltiples empresas — de forma completamente aislada entre sí — gestionar:

- Propiedades y sus alojamientos (cabañas, departamentos)
- Reservas (Airbnb, Booking, venta directa)
- Clientes, tarifas, canales de venta
- Campañas CRM, presupuestos, reportes
- Su propio **sitio web público** con motor de reservas
- Importación mágica: ingresa la URL del sitio web de la empresa → el sistema crea todo automáticamente con IA (fotos, espacios, descripciones)

**URL de producción:** https://suite-manager.onrender.com
**Repositorio:** https://github.com/orillasdelcoilaco/staymanager
**Deploy:** push a `main` → auto-deploy en Render

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Node.js + Express |
| Frontend | Vanilla JavaScript SPA (sin framework) |
| Base de datos | Cloud Firestore (Firebase) |
| Storage | Firebase Storage (fotos WebP) |
| CSS | TailwindCSS |
| SSR (sitio público) | Express + EJS templates |
| IA | Google Gemini (Vision + generación) |
| Deploy | Render (backend sirve también el frontend estático) |

---

## Arquitectura: Los Dos Mundos

El sistema tiene una separación **crítica** que no debe romperse:

```
┌─────────────────────────────────────────────────────────────┐
│  MUNDO 1: Panel de Administración (SPA)                     │
│  - frontend/src/         → Vanilla JS, vistas por módulo    │
│  - backend/routes/api/   → APIs REST protegidas con JWT     │
│  - backend/services/     → Lógica de negocio                │
│  Acceden: dueños/admins de cada empresa                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MUNDO 2: Sitio Web Público (SSR)                           │
│  - backend/views/        → Templates EJS                    │
│  - backend/routes/website.js → Rutas públicas              │
│  - backend/services/publicWebsiteService.js                 │
│  Acceden: clientes finales (turistas que quieren reservar)  │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tenant (Regla de Oro)

**Toda consulta a Firestore** debe estar aislada por empresa:
```js
// CORRECTO
db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId)

// INCORRECTO — consulta global, rompe el aislamiento
db.collection('propiedades')
```

---

## Estructura de Directorios Clave

```
staymanager/
├── backend/
│   ├── index.js                     ← Punto de entrada, monta todos los routers
│   ├── middleware/
│   │   └── authMiddleware.js        ← Verifica JWT, extrae empresaId al req.user
│   ├── routes/
│   │   ├── website.js               ← Rutas del sitio público (SSR)
│   │   ├── websiteConfigRoutes.js   ← Config web, upload de fotos (panel admin)
│   │   ├── galeriaRoutes.js         ← [NUEVO] API galería de fotos por propiedad
│   │   ├── propiedades.js           ← CRUD propiedades
│   │   └── ...
│   ├── services/
│   │   ├── galeriaService.js        ← [NUEVO] CRUD + sync galería Firestore
│   │   ├── empresaImporterService.js ← [NUEVO] Motor de importación IA
│   │   ├── webImporterService.js    ← [NUEVO] Scraping + análisis Vision IA
│   │   ├── propiedadesService.js
│   │   ├── storageService.js        ← Sube archivos a Firebase Storage
│   │   ├── imageProcessingService.js ← Optimiza imágenes con Sharp (WebP)
│   │   └── ai_providers/
│   │       └── geminiProvider.js    ← Llama a Gemini (texto + visión)
│   └── views/                       ← Templates EJS para el sitio público
│
├── frontend/
│   ├── index.html                   ← Shell SPA único
│   └── src/
│       ├── app.js                   ← Layout principal, autenticación
│       ├── router.js                ← Rutas SPA → vistas
│       ├── api.js                   ← fetchAPI() — wrapper para llamadas al backend
│       └── views/
│           ├── importadorMagico.js  ← [NUEVO] Wizard de importación con IA
│           ├── galeriaPropiedad.js  ← [NUEVO] Galería manual de fotos
│           └── components/
│               └── configurarWebPublica/
│                   └── webPublica.galeria.js ← Gestión de fotos por espacio (Contenido Web)
│
└── CLAUDE.md                        ← Instrucciones del proyecto para Claude Code
```

---

## Módulo en Desarrollo: Sistema de Galería + Importador Mágico

### ¿Qué hace el Importador Mágico?

El usuario ingresa la URL del sitio web de una empresa de cabañas. El sistema:

1. **Scrapea** el sitio (Cheerio)
2. **Selecciona 40 imágenes representativas** por cada alojamiento
3. **Analiza con Gemini Vision** cuál foto corresponde a qué espacio (Cocina, Dormitorio 1, Baño, etc.) — en 2 pasadas (Fase 1: clasificación general, Fase 2: espacios no cubiertos)
4. **Crea en Firestore** la empresa, propiedades, componentes (espacios), y tipos de elementos
5. **Sube todas las fotos a Firebase Storage** en formato WebP optimizado (full 1200px + thumbnail 400px)
6. **Crea documentos en la subcolección `galeria`** de cada propiedad con metadatos de clasificación (confianza, espacio asignado, estado)
7. **Sincroniza las fotos de alta confianza** al `websiteData.images` de la propiedad para el sitio público SSR

El proceso se muestra **en tiempo real** al usuario mediante Server-Sent Events (SSE).

### Firestore — Colección `galeria`

```
empresas/{empresaId}/propiedades/{propiedadId}/galeria/{fotoId}

Campos:
  storageUrl    — URL pública full (1200px WebP)
  thumbnailUrl  — URL pública thumb (400px WebP)
  espacio       — nombre del espacio ("Cocina", "Dormitorio 1", null)
  espacioId     — ID del componente en Firestore (null si sin asignar)
  confianza     — 0.0 a 1.0 (0.85=Vision IA, 0.5=keyword URL, 0.2=sin match)
  estado        — 'auto' | 'manual' | 'pendiente' | 'descartada'
  rol           — 'principal' | 'adicional'
  altText       — texto SEO
  orden         — orden dentro del espacio
```

**Ciclo de vida del estado:**
- `auto` → clasificada por IA con confianza ≥ 0.5 (aparece en sitio web)
- `pendiente` → confianza < 0.5 o subida manual sin espacio asignado
- `manual` → el usuario asignó manualmente el espacio
- `descartada` → eliminación suave (soft delete)

### API de Galería (`/api/galeria/`)

```
GET    /api/galeria/:propiedadId            → listar fotos (filtros: ?estado=&espacio=)
PATCH  /api/galeria/:propiedadId/:fotoId    → asignar espacio/estado
POST   /api/galeria/:propiedadId/:fotoId/confirmar → pendiente → auto
DELETE /api/galeria/:propiedadId/:fotoId    → descartar (soft delete)
POST   /api/galeria/:propiedadId/sync       → sincronizar al websiteData.images
POST   /api/galeria/:propiedadId/upload     → subir foto directamente (→ pendiente)
```

### Vista: Galería de Fotos (`/galeria-propiedad`)

- Permite seleccionar una propiedad y revisar todas sus fotos
- 3 pestañas: **Asignadas** (auto + manual) | **Pendientes** | **Descartadas**
- Por foto: miniatura, badge de confianza %, dropdown de espacio (componentes reales de Firestore), botones confirmar/descartar/restaurar
- Botón **"Sincronizar al sitio web"** → escribe las fotos clasificadas a `websiteData.images`
- Botón **"Subir fotos"** → sube archivos nuevos a la galería como `pendiente`

### Vista: Contenido Web → Galería por Espacio (`/website-alojamientos`)

- Muestra cada espacio (Dormitorio 1, Cocina, Baño...) con sus fotos
- Botón **"📸 Asistente IA"** → wizard guiado para tomar fotos con validación IA
- Botón **"📤 Subir"** → subida directa de archivos
- Botón **"🖼️ Galería"** → [NUEVO] abre modal con todas las fotos de la galería de esa propiedad para reasignarlas a ese espacio

---

## Cómo Funciona el Flujo Completo de Fotos

```
Importador Mágico
      │
      ▼
Vision IA clasifica fotos → buildClasificacionMap()
      │
      ▼
importarGaleriaPropiedad() → sube TODAS las fotos a Storage
      │                       crea docs en galeria/{fotoId}
      ▼
fotos confianza ≥ 0.5 → websiteData.images (para SSR)
fotos confianza < 0.5 → galeria con estado='pendiente'
      │
      ▼
Usuario revisa en /galeria-propiedad
  → asigna espacios manualmente (estado='manual')
  → presiona "Sincronizar" → syncToWebsite()
      │
      ▼
websiteData.images se actualiza → sitio público muestra fotos correctas
```

---

## Estado Actual — Última Actualización: 2026-03-18

### Fixes aplicados en este push (commit `6c4978e`):

1. **Reset limpia galerías correctamente** — `resetEmpresaData` ahora borra los documentos de `galeria/{fotoId}` dentro de cada propiedad antes de eliminar la propiedad. Firestore no elimina subcollecciones automáticamente; antes quedaban fotos y datos viejos acumulados tras cada reimportación.

2. **websiteData con defaults al importar** — El importador ahora guarda `titulo` y `descripcion` al crear cada propiedad. Antes el sitio público quedaba vacío porque estos campos no se escribían durante la importación.

3. **Componentes sin duplicados** — `buildComponentes` ahora normaliza nombres recibidos de Gemini Vision (ej. "Dormitorio 1", "Dormitorio 2" → se tratan como un solo tipo "Dormitorio" con 2 copias). Antes esto generaba 39-47 espacios por propiedad en vez de 5-8.

### Cómo probar el Importador Mágico correctamente:

> **IMPORTANTE**: Para un test limpio, usar el wizard desde la UI con el **checkbox "Reiniciar datos"** marcado. NO simular el POST directamente con `overwrite: true` — ese flag no activa el reset de galería.

1. Ir a `/importador-magico` en el panel admin
2. Ingresar la URL de una empresa de cabañas
3. En el wizard, marcar **"Reiniciar datos"** si la empresa ya existía
4. Completar el wizard hasta el final
5. Verificar:
   - Componentes por propiedad: debería haber **5-8** (no 39-47)
   - En `/galeria-propiedad`: fotos con estado `auto` deben existir
   - En `/website-alojamientos` (Contenido Web): los espacios deben mostrar fotos
   - El sitio público SSR debe mostrar título y descripción de cada alojamiento

### Flujo principal a validar:

1. **Importador Mágico** — ingresar URL de empresa con "Reiniciar datos" marcado, confirmar que crea todo correctamente (5-8 espacios, fotos clasificadas, sync inicial)
2. **Galería de Fotos** (`/galeria-propiedad`) — reasignar fotos entre espacios, verificar que el sync actualiza el sitio público
3. **Contenido Web** → botón **"🖼️ Galería"** — seleccionar fotos de la galería y asignarlas a un espacio sin necesidad de subir archivo nuevo
4. **Subida directa en galería** — botón "📤 Subir fotos" en `/galeria-propiedad` agrega fotos nuevas como pendientes

### Puntos de atención:

- Las fotos en **Contenido Web** solo se actualizan al hacer **"Sincronizar al sitio web"** en la galería — no es automático
- El dropdown de espacios en la galería muestra los **componentes reales de esa propiedad** (Dormitorio 1, Dormitorio 2, Cocina, etc.) — si no aparece un espacio es porque no fue creado durante la importación
- El valor guardado en `espacioId` debe ser el **ID real de Firestore del componente**, no un string genérico — esto es crítico para que el sync funcione

### Sobre el router SPA — aclaración importante:

El router usa **HTML5 pushState** (`window.history.pushState` + evento `popstate`). **No usa hash (`#`)** ni el evento `hashchange`. Cualquier sugerencia de cambiar a hashchange o `window.location.hash` es incorrecta y rompería toda la navegación. Si una vista no carga, el error ahora se muestra en pantalla (en rojo) gracias al try/catch agregado en `loadView` — revisar ahí primero antes de cambiar el router.

### Si encuentras bugs o algo raro:

- Anotar: ruta afectada, pasos para reproducir, mensaje de error exacto (consola del navegador + logs del servidor)
- Crear rama `revision/nombre-descriptivo` y abrir PR — **nunca push directo a `main`** (auto-deploy a producción)

---

## Flujo de Colaboración con Ramas

El flujo de trabajo es el siguiente:

1. **Crear una rama de prueba** antes de hacer cualquier cambio:
   ```bash
   git checkout -b revision/nombre-del-tema
   # Ejemplo: revision/galeria-picker
   ```

2. **Explorar, probar, y anotar observaciones** — sin hacer cambios directamente en `main`

3. **Si encuentras un bug o mejora**, hacer el fix en la rama y abrir un PR describiendo:
   - Qué problema resuelve
   - Qué archivos modifica
   - Por qué no rompe el aislamiento multi-tenant

4. **No fusionar sin revisión** — el dueño del repo valida cada PR antes de hacer merge

5. **Nunca hacer push directo a `main`** — esa rama auto-despliega a producción en Render

---

## Cómo Correr el Proyecto Localmente

> Necesitas acceso al `.env` del proyecto (solicítalo al dueño del repo)

```bash
# En el directorio backend/
npm install
node index.js       # o con nodemon para recarga automática

# Para compilar CSS (solo si modificas estilos)
npm run build:css           # CSS del panel admin
npm run build:website-css   # CSS del sitio público
```

El backend sirve el frontend estático automáticamente. Acceder en: `http://localhost:3000`

---

## Seguridad — Reglas que NO se deben romper

1. **Nunca hardcodear secrets** — solo `process.env.NOMBRE_VARIABLE`
2. **Nunca queries globales** — siempre con `empresaId`
3. **Nunca modificar valores financieros** (`valorHuesped`) con cálculos — son inmutables una vez registrados
4. **Nunca duplicar reservas** — usar `idReservaCanal` como key de deduplicación
5. **`.env` y credenciales** no van al repositorio (ya están en `.gitignore`)

---

*Generado el 2026-03-18 — Última actualización: 2026-03-18 (commit 6c4978e)*
