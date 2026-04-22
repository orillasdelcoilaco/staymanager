# Plan de Implementación: Rediseño Gestión de Propiedades
**Proyecto:** SuiteManager  
**Sprint:** Rediseño completo + Orquestador IA  
**Fecha creación:** 2026-04-12  
**Autor:** Claude Code (Arquitecto)  
**Estado:** EN PROGRESO — leer este archivo al inicio de cada sesión

---

## CONTEXTO Y OBJETIVO

El módulo de "Gestión de Propiedades" tiene 6 pasos que forman el corazón del sistema:
activos → espacios → alojamientos → contenido web → galería → configuración web.

**El problema central:** cada paso funciona de forma aislada. La IA de cada paso no conoce
lo que ocurrió en los pasos anteriores. El dato más valioso del sistema (los activos con
`schema_type`, `seo_tags`, `sales_context`) se genera en el paso 1 y no llega a ningún
otro prompt posterior.

**El objetivo:** implementar un `PropertyBuildContext` — un objeto JSON que se acumula
en cada paso y permite que la IA del paso 6 tenga el mapa completo de lo que el alojamiento
tiene, cómo se vende, y cómo se muestra. El output final es un JSON-LD (schema.org) que
hace que los alojamientos sean encontrables por Google SGE, ChatGPT con browsing y
Perplexity antes que cualquier OTA.

**Ventaja competitiva a preservar:** Los activos custom (ej: "Tinaja") con clasificación
semántica (`schema_type: "HotTub"`) son superiores a los checkboxes de Airbnb/Booking.
El rediseño los potencia, no los elimina.

---

## ESTRUCTURA DEL PropertyBuildContext

Este objeto es la "memoria" del wizard. Se persiste en `propiedades.metadata.buildContext`
(JSONB, sin cambio de schema). Se construye paso a paso:

```json
{
  "empresa": {
    "nombre": "Orillas del Coilaco",
    "tipo": "Complejo de cabañas",
    "enfoque": "Familiar",
    "ubicacion": { "ciudad": "Lago Ranco", "region": "Los Ríos" },
    "slogan": "Donde la naturaleza te abraza",
    "historia": "..."
  },
  "producto": {
    "nombre": "Cabaña Ranco Grande",
    "tipo": "Cabaña",
    "capacidad": 8,
    "numPiezas": 3,
    "numBanos": 2,
    "descripcionLibre": "Cabaña con 3 dormitorios, 2 baños, tinaja y vista al lago",
    "espacios": [
      {
        "id": "uuid-espacio",
        "nombre": "Dormitorio Principal",
        "categoria": "Dormitorio",
        "activos": [
          {
            "nombre": "Cama King",
            "schema_type": "BedDetails",
            "schema_property": "bed",
            "capacity": 2,
            "cantidad": 1,
            "seo_tags": ["cama king", "king size", "dormitorio doble"],
            "sales_context": "Cama King para 2 personas",
            "requires_photo": true,
            "photo_guidelines": "Foto de la cama tendida con luz natural"
          }
        ]
      },
      {
        "id": "uuid-exterior",
        "nombre": "Área Exterior",
        "categoria": "Exterior",
        "activos": [
          {
            "nombre": "Tinaja",
            "schema_type": "HotTub",
            "capacity": 6,
            "cantidad": 1,
            "seo_tags": ["tinaja", "hot tub", "spa privado", "agua caliente"],
            "sales_context": "Tinaja privada con capacidad para 6 personas",
            "requires_photo": true
          }
        ]
      }
    ]
  },
  "narrativa": {
    "descripcionComercial": "...",
    "puntosFuertes": ["Tinaja privada con vista al lago", "3 dormitorios"],
    "uniqueSellingPoints": ["tinaja privada", "acceso directo al agua"],
    "homeH1": "...",
    "homeIntro": "...",
    "generadoEn": "2026-04-12T10:00:00Z"
  },
  "fotos": {
    "planGenerado": true,
    "resumenFotos": {
      "total": 12,
      "confirmadas": 10,
      "pendientes": 2
    }
  },
  "publicacion": {
    "metaTitle": "...",
    "metaDescription": "...",
    "jsonLd": {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      "name": "Cabaña Ranco Grande",
      "description": "...",
      "occupancy": { "@type": "QuantitativeValue", "value": 8 },
      "numberOfRooms": 3,
      "amenityFeature": [
        {
          "@type": "LocationFeatureSpecification",
          "name": "Tinaja",
          "value": true,
          "description": "Tinaja privada capacidad 6 personas"
        },
        {
          "@type": "LocationFeatureSpecification",
          "name": "Cama King",
          "value": true
        }
      ],
      "photo": []
    },
    "publicadoEn": null
  }
}
```

---

## RESUMEN DE CAMBIOS POR CAPA

| Capa | Nuevos archivos | Archivos modificados |
|------|----------------|---------------------|
| DB | 1 script migración | — |
| Backend Services | 2 nuevos | 3 modificados |
| Backend Prompts | 1 nuevo | 2 modificados |
| Backend Routes | 1 nuevo endpoint group | 2 modificados |
| Frontend Views | 1 nuevo orchestrator | 6 modificados |
| Frontend Components | 4 nuevos | 8 modificados |

---

## FASE 1 — BASE DE DATOS
**Prioridad: PRIMERA — nada del backend puede ejecutarse sin esto**

### TAREA B-01: Script de migración activos_catalogo + columnas galería
**Archivo a crear:** `backend/db/migrations/build-context-catalogo.js`  
**Ejecutar con:** `node backend/db/migrations/build-context-catalogo.js`

#### Cambios en DB:

**1. Nueva tabla `activos_catalogo`** (catálogo universal compartido entre empresas)
```sql
CREATE TABLE IF NOT EXISTS activos_catalogo (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID    REFERENCES empresas(id) ON DELETE CASCADE,
    -- empresa_id = NULL significa "universal" (compartido por todas las empresas)
    -- empresa_id = UUID significa "privado" de esa empresa

    nombre          TEXT    NOT NULL,
    nombre_normalizado TEXT NOT NULL,
    categoria       TEXT    NOT NULL DEFAULT 'Otros',
    icono           TEXT    DEFAULT '🔹',

    -- Datos IA (igual que tipos_elemento)
    capacity        INTEGER DEFAULT 0,
    countable       BOOLEAN DEFAULT true,
    requires_photo  BOOLEAN DEFAULT false,
    photo_quantity  INTEGER DEFAULT 0,
    photo_guidelines TEXT,
    seo_tags        TEXT[]  DEFAULT '{}',
    sales_context   TEXT,
    schema_type     TEXT    DEFAULT 'LocationFeatureSpecification',
    schema_property TEXT    DEFAULT 'amenityFeature',

    -- Red effect: cuántas empresas lo usan
    uso_count       INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_universal
    ON activos_catalogo(nombre_normalizado)
    WHERE empresa_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_catalogo_empresa
    ON activos_catalogo(empresa_id, nombre_normalizado)
    WHERE empresa_id IS NOT NULL;

-- Índice para búsqueda fuzzy por texto
CREATE INDEX IF NOT EXISTS idx_catalogo_seo_tags
    ON activos_catalogo USING GIN (seo_tags);
```

**2. Agregar columna `shot_context` y `advertencia` a tabla `galeria`**
```sql
ALTER TABLE galeria ADD COLUMN IF NOT EXISTS shot_context TEXT;
ALTER TABLE galeria ADD COLUMN IF NOT EXISTS advertencia  TEXT;
```
Estas columnas existen conceptualmente en el código pero nunca se persistieron en la tabla.

**3. Agregar columna `title` a tabla `galeria`** (el altText ya existe, falta el title)
```sql
ALTER TABLE galeria ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
```

**NOTAS DE IMPLEMENTACIÓN:**
- El script debe usar el pool de PostgreSQL de `backend/db/postgres.js`
- Debe imprimr confirmación por cada ALTER/CREATE
- Usar `IF NOT EXISTS` / `IF NOT EXISTS column` para ser idempotente
- La tabla `tipos_elemento` ya existe con los campos IA — la nueva tabla `activos_catalogo`
  es un espejo universal (no reemplaza tipos_elemento, convive con ella)

---

## FASE 2 — BACKEND SERVICES

### TAREA B-02: Nuevo servicio catalogoService.js
**Archivo a crear:** `backend/services/catalogoService.js`  
**Responsabilidad:** CRUD del catálogo universal de activos  
**Máximo:** 200 líneas

#### Funciones a implementar:

```javascript
// Busca activos en el catálogo: primero universales, luego de la empresa
// Implementa búsqueda por nombre (ILIKE) + por seo_tags (array overlap)
const buscarEnCatalogo = async (empresaId, query, limit = 10) => { ... }
// SQL: SELECT * FROM activos_catalogo WHERE (empresa_id IS NULL OR empresa_id = $1)
//      AND (nombre_normalizado ILIKE $2 OR $3 = ANY(seo_tags))
//      ORDER BY empresa_id NULLS LAST, uso_count DESC LIMIT $4

// Crea un activo en el catálogo para una empresa (privado)
// Si otro servicio detecta que es "universal" (uso_count > 5), se puede elevar
const crearEnCatalogo = async (empresaId, datos) => { ... }

// Incrementa uso_count cuando una empresa usa un activo del catálogo universal
const registrarUso = async (catalogoId) => { ... }
// SQL: UPDATE activos_catalogo SET uso_count = uso_count + 1 WHERE id = $1

// Devuelve top activos universales por categoría (para sugerencias en el wizard)
const obtenerSugerenciasPorCategoria = async (categoria, limit = 8) => { ... }
```

**Patrón de mapeo:**
```javascript
const mapear = (row) => ({
  id: row.id,
  empresaId: row.empresa_id,
  esUniversal: row.empresa_id === null,
  nombre: row.nombre,
  nombreNormalizado: row.nombre_normalizado,
  categoria: row.categoria,
  icono: row.icono,
  capacity: row.capacity,
  countable: row.countable,
  requiresPhoto: row.requires_photo,
  photoQuantity: row.photo_quantity,
  photoGuidelines: row.photo_guidelines,
  seoTags: row.seo_tags || [],
  salesContext: row.sales_context,
  schemaType: row.schema_type,
  schemaProperty: row.schema_property,
  usoCount: row.uso_count,
})
```

---

### TAREA B-03: Nuevo servicio buildContextService.js
**Archivo a crear:** `backend/services/buildContextService.js`  
**Responsabilidad:** Leer y escribir el PropertyBuildContext desde/hacia la DB  
**Máximo:** 150 líneas

#### Funciones a implementar:

```javascript
// Lee el buildContext actual de una propiedad
// Carga también datos frescos de empresa para el bloque "empresa" del contexto
const getBuildContext = async (db, empresaId, propiedadId) => {
    // 1. Lee propiedades.metadata->>'buildContext' de PostgreSQL
    // 2. Si no existe, retorna un contexto vacío (esqueleto)
    // 3. Enriquece siempre el bloque "empresa" con datos frescos de la tabla empresas
    //    (no confiar en lo que esté guardado en el contexto para empresa)
}

// Escribe una sección del buildContext (merge parcial, no sobreescribe todo)
// seccion: 'producto' | 'narrativa' | 'fotos' | 'publicacion'
const updateBuildContextSection = async (empresaId, propiedadId, seccion, datos) => {
    // SQL: UPDATE propiedades
    //      SET metadata = jsonb_set(metadata, '{buildContext,<seccion>}', $3::jsonb)
    //      WHERE id = $1 AND empresa_id = $2
}

// Construye el bloque "producto" desde los componentes actuales de la propiedad
// Se llama después de guardar/actualizar componentes en paso 2 o 3
const construirProductoDesdeComponentes = async (db, empresaId, propiedadId) => {
    // Lee propiedades.componentes (JSONB array)
    // Lee tipos_elemento para enriquecer cada activo con schema_type, seo_tags, etc.
    // Construye el bloque "producto.espacios" con activos enriquecidos
    // Llama updateBuildContextSection(... 'producto' ...)
}
```

**NOTA CRÍTICA:** `updateBuildContextSection` debe usar `jsonb_set` con merge (`||`)
para no sobreescribir secciones que no se están actualizando. Patrón:
```sql
UPDATE propiedades
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{buildContext}',
    COALESCE(metadata->'buildContext', '{}'::jsonb) || $3::jsonb
)
WHERE id = $1 AND empresa_id = $2
```

---

### TAREA B-04: Nuevo prompt prompts/jsonld.js
**Archivo a crear:** `backend/services/ai/prompts/jsonld.js`  
**Responsabilidad:** Prompt para generar JSON-LD schema.org desde buildContext  
**Máximo:** 80 líneas

#### Función a implementar:

```javascript
// Genera el prompt para schema.org/LodgingBusiness + meta SEO
// Recibe el buildContext completo serializado
function promptJsonLdYSeo({ buildContext }) {
    const { empresa, producto, narrativa } = buildContext;
    
    // Construir lista de amenidades desde los activos con sus schema_type
    const amenidades = [];
    (producto.espacios || []).forEach(espacio => {
        (espacio.activos || []).forEach(activo => {
            amenidades.push({
                nombre: activo.nombre,
                schema_type: activo.schema_type,
                schema_property: activo.schema_property,
                capacity: activo.capacity,
                sales_context: activo.sales_context
            });
        });
    });

    return `Eres un Experto en SEO Técnico y Datos Estructurados para hospitalidad y turismo.

Tienes el perfil completo de un alojamiento turístico. Genera:
1. El objeto JSON-LD schema.org completo para esta propiedad
2. El metaTitle SEO (máx 60 caracteres)
3. La metaDescription SEO (máx 155 caracteres)

PERFIL DEL ALOJAMIENTO:
- Empresa: "${empresa.nombre}" (${empresa.tipo}, enfoque: ${empresa.enfoque})
- Ubicación: ${empresa.ubicacion?.ciudad}, ${empresa.ubicacion?.region}
- Alojamiento: "${producto.nombre}" (${producto.tipo}, ${producto.capacidad} personas)
- Habitaciones: ${producto.numPiezas} dormitorios, ${producto.numBanos} baños
- Descripción generada: "${narrativa?.descripcionComercial || ''}"
- Puntos únicos de venta: ${JSON.stringify(narrativa?.uniqueSellingPoints || [])}

AMENIDADES ESTRUCTURADAS (usa estos datos exactos para amenityFeature):
${JSON.stringify(amenidades, null, 2)}

REGLAS JSON-LD:
1. "@type": "LodgingBusiness" como contenedor principal
2. Dentro de "containsPlace" agrega los espacios como "@type": "Room"  
3. "amenityFeature": array con TODAS las amenidades, usando los schema_type proporcionados
4. "occupancy": QuantitativeValue con la capacidad exacta
5. "numberOfRooms": número de dormitorios
6. NO inventes amenidades que no estén en la lista

Responde SOLO con JSON (sin markdown):
{
  "metaTitle": "...",
  "metaDescription": "...",
  "jsonLd": { ... objeto schema.org completo ... }
}`;
}

module.exports = { promptJsonLdYSeo };
```

---

### TAREA B-05: Actualizar aiContentService.js — agregar funciones con contexto
**Archivo a modificar:** `backend/services/aiContentService.js`  
**Agregar al final** (antes del module.exports) las siguientes funciones:

#### Función 1: generarNarrativaDesdeContexto(buildContext)
```javascript
// Reemplaza generarDescripcionAlojamiento pero recibe el contexto completo
const generarNarrativaDesdeContexto = async (buildContext) => {
    const { empresa, producto } = buildContext;
    
    // Construir el resumen de activos para el prompt
    const resumenActivos = (producto.espacios || []).map(esp => {
        const activosStr = (esp.activos || [])
            .map(a => `${a.nombre} (${a.sales_context || a.nombre})`)
            .join(', ');
        return `${esp.nombre}: ${activosStr}`;
    }).join('\n');
    
    const prompt = `Actúa como Copywriter especializado en alojamientos turísticos y CRO.

Tienes el inventario COMPLETO y verificado de este alojamiento. Genera el contenido de venta.

EMPRESA: "${empresa.nombre}"
- Tipo: ${empresa.tipo}
- Enfoque: ${empresa.enfoque}  
- Slogan: "${empresa.slogan || ''}"
- Ubicación: ${empresa.ubicacion?.ciudad}, ${empresa.ubicacion?.region}

ALOJAMIENTO: "${producto.nombre}"
- Tipo: ${producto.tipo}
- Capacidad: ${producto.capacidad} personas
- ${producto.numPiezas} dormitorios, ${producto.numBanos} baños

INVENTARIO VERIFICADO POR ESPACIO:
${resumenActivos}

REGLAS:
1. "descripcionComercial": texto persuasivo máx 200 palabras, orientado a conversión
2. "puntosFuertes": 3-5 bullets cortos en español, basados SOLO en lo que existe en el inventario
3. "uniqueSellingPoints": array de 3-5 frases cortas para schema.org
4. "homeH1": título principal máx 8 palabras, orientado a la experiencia del huésped
5. "homeIntro": 2-3 oraciones que transmitan emoción y propuesta de valor única
6. NO inventar amenidades que no estén en el inventario

Responde SOLO JSON (sin markdown):
{
  "descripcionComercial": "...",
  "puntosFuertes": ["...", "..."],
  "uniqueSellingPoints": ["...", "..."],
  "homeH1": "...",
  "homeIntro": "..."
}`;

    return generateForTask(AI_TASK.PROPERTY_DESCRIPTION, prompt);
};
```

#### Función 2: generarJsonLdDesdeContexto(buildContext)
```javascript
const generarJsonLdDesdeContexto = async (buildContext) => {
    const { promptJsonLdYSeo } = require('./ai/prompts/jsonld');
    const prompt = promptJsonLdYSeo({ buildContext });
    return generateForTask(AI_TASK.SEO_GENERATION, prompt);
};
```

**Agregar ambas al module.exports.**

---

### TAREA B-06: Actualizar prompts/property.js — promptDescripcionAlojamiento con contexto
**Archivo a modificar:** `backend/services/ai/prompts/property.js`  
**Cambio:** La función existente `promptDescripcionAlojamiento` recibe opcionalmente
`espaciosConActivos` (array del buildContext). Si se proporciona, lo incluye en el prompt.
Si no (llamada legacy), funciona igual que hoy.

```javascript
function promptDescripcionAlojamiento({ nombre, tipo, ubicacion, servicios, estilo = 'Comercial y atractivo', espaciosConActivos = null }) {
    const inventarioSection = espaciosConActivos ? `
INVENTARIO VERIFICADO:
${espaciosConActivos.map(e => 
    `${e.nombre}: ${(e.activos || []).map(a => a.sales_context || a.nombre).join(', ')}`
).join('\n')}
` : `- Servicios clave: ${servicios}`;

    return `Actúa como Copywriter Inmobiliario especializado en alojamientos turísticos.
...
${inventarioSection}
...`;
}
```

---

## FASE 3 — BACKEND ROUTES

### TAREA B-07: Nuevo endpoint group en websiteConfigRoutes.js
**Archivo a modificar:** `backend/routes/websiteConfigRoutes.js`  
**Agregar** los siguientes endpoints dentro del router existente:

```javascript
// GET /website/propiedad/:propiedadId/build-context
// Devuelve el PropertyBuildContext actual de la propiedad
router.get('/propiedad/:propiedadId/build-context', async (req, res, next) => {
    try {
        const { empresaId } = req.user;
        const { propiedadId } = req.params;
        const context = await getBuildContext(db, empresaId, propiedadId);
        res.json(context);
    } catch (error) { next(error); }
});

// POST /website/propiedad/:propiedadId/build-context/sync-producto
// Re-construye el bloque "producto" del contexto desde los componentes actuales
// Se llama automáticamente después de guardar en pasos 1, 2 o 3
router.post('/propiedad/:propiedadId/build-context/sync-producto', async (req, res, next) => {
    try {
        const { empresaId } = req.user;
        const context = await construirProductoDesdeComponentes(db, empresaId, req.params.propiedadId);
        res.json(context);
    } catch (error) { next(error); }
});

// POST /website/propiedad/:propiedadId/build-context/generate-narrativa
// Llama a la IA con el contexto completo para generar descripción + puntos fuertes
router.post('/propiedad/:propiedadId/build-context/generate-narrativa', async (req, res, next) => {
    try {
        const { empresaId } = req.user;
        const context = await getBuildContext(db, empresaId, req.params.propiedadId);
        if (!context?.producto?.espacios?.length) {
            return res.status(400).json({ error: 'El alojamiento no tiene espacios configurados. Completa los pasos 1-3 primero.' });
        }
        const narrativa = await generarNarrativaDesdeContexto(context);
        await updateBuildContextSection(empresaId, req.params.propiedadId, 'narrativa', { ...narrativa, generadoEn: new Date().toISOString() });
        res.json(narrativa);
    } catch (error) { next(error); }
});

// POST /website/propiedad/:propiedadId/build-context/generate-jsonld
// Llama a la IA con el contexto completo para generar JSON-LD + SEO final
router.post('/propiedad/:propiedadId/build-context/generate-jsonld', async (req, res, next) => {
    try {
        const { empresaId } = req.user;
        const context = await getBuildContext(db, empresaId, req.params.propiedadId);
        if (!context?.narrativa?.descripcionComercial) {
            return res.status(400).json({ error: 'Genera el contenido web primero (paso 4).' });
        }
        const result = await generarJsonLdDesdeContexto(context);
        await updateBuildContextSection(empresaId, req.params.propiedadId, 'publicacion', result);
        res.json(result);
    } catch (error) { next(error); }
});
```

**Imports a agregar** al inicio del archivo:
```javascript
const { getBuildContext, updateBuildContextSection, construirProductoDesdeComponentes } = require('../services/buildContextService');
const { generarNarrativaDesdeContexto, generarJsonLdDesdeContexto } = require('../services/aiContentService');
```

---

### TAREA B-08: Nueva ruta catálogo
**Archivo a modificar:** `backend/routes/componentes.js` (agregar al final)  
**O crear:** `backend/routes/catalogoRoutes.js` (preferible para no superar límite de líneas)

```javascript
// GET /catalogo/activos?q=tinaja&categoria=Exterior
// Busca en el catálogo universal + privado de la empresa
router.get('/catalogo/activos', async (req, res, next) => {
    try {
        const { empresaId } = req.user;
        const { q = '', categoria } = req.query;
        const resultados = await buscarEnCatalogo(empresaId, q, 10);
        res.json(resultados);
    } catch (error) { next(error); }
});

// POST /catalogo/activos
// Crea un activo en el catálogo privado de la empresa
// La IA lo clasifica automáticamente (llama a promptMetadataActivo)
router.post('/catalogo/activos', async (req, res, next) => {
    try {
        const { empresaId } = req.user;
        const { nombre } = req.body;
        if (!nombre?.trim()) return res.status(400).json({ error: 'Falta el nombre del activo.' });
        // 1. Clasificar con IA
        // 2. Crear en catálogo con empresa_id = empresaId (privado)
        // 3. Retornar el activo creado con toda la metadata IA
        const activo = await crearActivoConIA(empresaId, nombre.trim());
        res.status(201).json(activo);
    } catch (error) { next(error); }
});
```

**Registrar en app.js/router:**
```javascript
// En backend/api/ssr/config.routes.js (o donde se registran las rutas SPA)
router.use('/catalogo', require('../routes/catalogoRoutes'));
```

---

### TAREA B-09: Actualizar propiedades.js — sync automático del buildContext
**Archivo a modificar:** `backend/routes/propiedades.js`  
**Cambio mínimo:** Después de cada `PUT /propiedades/:id` exitoso, disparar en background:
```javascript
// Después del res.json(resultado) en el PUT de propiedades
construirProductoDesdeComponentes(db, empresaId, id)
    .catch(err => console.error('[BuildContext] Error sync background:', err.message));
```
Esto es fire-and-forget para no bloquear la respuesta al usuario.

---

## FASE 4 — FRONTEND (PASOS 1-3: CONSTRUCCIÓN)

### TAREA F-01: Actualizar framing de pasos 1, 2 y 3

Los pasos 1 (activos), 2 (espacios) y 3 (alojamientos) mantienen su lógica actual
pero se actualizan los textos de bienvenida/instrucción que ve el usuario.

**Archivos a modificar:**
- `frontend/src/views/gestionarTiposElemento.js` — Paso 1
- `frontend/src/views/gestionarTiposComponente.js` — Paso 2  
- `frontend/src/views/gestionarAlojamientos.js` — Paso 3

**Para cada uno, agregar un banner informativo** al inicio de la vista:

Paso 1 banner:
```html
<div class="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-6">
  <div class="flex items-start gap-3">
    <i class="fa-solid fa-box-open text-primary-500 text-xl mt-0.5"></i>
    <div>
      <h3 class="font-semibold text-primary-800 mb-1">Inventario de Activos</h3>
      <p class="text-sm text-primary-700">
        Define qué <strong>objetos y equipamiento</strong> existen dentro de tus alojamientos.
        Por ejemplo: "Cama King", "Tinaja", "Kayak", "Cafetera". La IA clasificará cada uno
        automáticamente y generará los datos que necesitan Google y otros buscadores para
        encontrar tu propiedad. Estos activos son la base de todo lo demás.
      </p>
    </div>
  </div>
</div>
```

Paso 2 banner:
```html
<!-- Texto: "Organiza los activos en los espacios físicos de tus alojamientos.
Un 'Dormitorio Principal' puede tener: Cama King, Velador, Clóset.
Los espacios determinan el plan de fotos y la descripción técnica del alojamiento." -->
```

Paso 3 banner:
```html
<!-- Texto: "El alojamiento es el producto que venden tus canales: OTAs, sitio web propio,
y agentes de IA. Cada alojamiento combina espacios y activos para formar el inventario
completo. La capacidad se calcula automáticamente." -->
```

---

### TAREA F-02: Agregar buscador del catálogo universal en el wizard de activos
**Archivo a modificar:** `frontend/src/views/components/gestionarTiposComponente/tipos.wizard.js`  
(Este wizard maneja la creación de nuevos tipos de elemento/activo con IA)

**Cambio:** Antes de mostrar el campo "nombre del activo", mostrar un buscador:
1. Input de búsqueda → llama `GET /catalogo/activos?q=texto` con debounce 300ms
2. Si hay resultados: mostrar chips/cards con los activos del catálogo (con icono, nombre, categoría)
3. Si el usuario selecciona uno del catálogo: se usa directamente (ya tiene schema_type, seo_tags, etc.), solo confirmar
4. Si no hay resultados o el usuario quiere crear uno nuevo: botón "Crear nuevo activo" → flujo actual con IA

**Estado del componente a agregar:**
```javascript
let _catalogoResults = [];
let _searchTimer = null;
const _buscarCatalogo = async (q) => {
    if (q.length < 2) { _catalogoResults = []; _rerenderCatalogo(); return; }
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(async () => {
        _catalogoResults = await fetchAPI(`/catalogo/activos?q=${encodeURIComponent(q)}`);
        _rerenderCatalogo();
    }, 300);
};
```

---

### TAREA F-03: Disparar sync del buildContext después de guardar en pasos 1-3
**Archivos a modificar:**
- `frontend/src/views/components/gestionarAlojamientos/alojamientos.modals.js`

**Cambio:** Después de cada guardado exitoso de un alojamiento (PUT/POST), llamar:
```javascript
// Fire-and-forget — no esperar respuesta
fetchAPI(`/website/propiedad/${propiedadId}/build-context/sync-producto`, { method: 'POST' })
    .catch(() => {}); // silencioso si falla
```

---

## FASE 5 — FRONTEND (PASO 4: CONTENIDO WEB / NARRATIVA)

### TAREA F-04: Reescribir webPublica.paso1.identidad.js
**Archivo a modificar:** `frontend/src/views/components/configurarWebPublica/webPublica.paso1.identidad.js`

**Cambio principal:** Este paso ya no pide descripción libre al usuario para generar.
En cambio, muestra un resumen del buildContext y genera con un clic.

**Nuevo flujo:**
1. Al cargar: llamar `GET /website/propiedad/:id/build-context`
2. Mostrar "resumen de contexto" — qué sabe la IA sobre el alojamiento:
   ```
   ✅ 3 espacios configurados (Dormitorio x2, Área Exterior)
   ✅ 8 activos mapeados (Cama King, Tinaja, Kayaks...)
   ✅ Capacidad: 8 personas | 2 dormitorios | 1 baño
   ```
3. Botón: "Generar Descripción con IA" → POST `/build-context/generate-narrativa`
4. Mostrar resultado editable (descripcionComercial, puntosFuertes, homeH1, homeIntro)
5. Usuario edita si necesita → botón "Guardar y Continuar"

**Si buildContext.producto.espacios está vacío:** mostrar warning:
```
⚠️ La IA necesita más información. Completa los pasos 1-3 (Activos, Espacios, Alojamiento)
antes de generar el contenido.
```

---

## FASE 6 — FRONTEND (PASO 5: GALERÍA UNIFICADA)

### TAREA F-05: Unificar galería — eliminar el step de "sync"
**Problema actual:** Existen dos flujos de fotos paralelos:
- `galeriaPropiedad.js` — galería interna
- `webPublica.paso2.fotos.js` — fotos del wizard web con `syncToWebsite`

**Solución:** Unificar en un único flujo. Las fotos subidas en cualquier lado van
directamente a la tabla `galeria` con su `espacio_id`. El "sync" ya no es manual.

**Archivos a modificar:**
- `backend/services/galeriaService.js` — eliminar `syncToWebsite`, hacerlo automático
  en cada `confirmarFoto`
- `frontend/src/views/components/configurarWebPublica/webPublica.paso2.fotos.js` —
  refactorizar para leer desde `galeria` table directamente via API en lugar de `websiteData.images`
- `frontend/src/views/galeriaPropiedad.js` — agregar indicador de "publicada en web" vs "solo en galería"

**Cambio en galeriaService.js:**
```javascript
// Cuando una foto pasa a estado 'auto' o 'manual', también actualizar websiteData.images
// en el JSONB de propiedades.metadata (llamada automática, no manual)
const confirmarFoto = async (db, empresaId, propiedadId, fotoId) => {
    // ... lógica actual ...
    // + al final, llamar _syncFotoToWebsite(empresaId, propiedadId, fotoActualizada)
};

const _syncFotoToWebsite = async (empresaId, propiedadId, foto) => {
    // Agrega la foto al array propiedades.metadata->'websiteData'->'images'->'[espacioId]'
    // usando jsonb_set + append
};
```

---

## FASE 7 — FRONTEND (PASO 6: PUBLICAR)

### TAREA F-06: Reescribir webPublica.paso3.seo.js — Publicar con JSON-LD
**Archivo a modificar:** `frontend/src/views/components/configurarWebPublica/webPublica.paso3.seo.js`

**Nuevo flujo:**
1. Al cargar: `GET /website/propiedad/:id/build-context` — mostrar estado actual
2. Si no tiene narrativa: bloquear con mensaje "Completa el paso 4 primero"
3. Botón "Generar SEO y Datos Estructurados" → POST `/build-context/generate-jsonld`
4. Mostrar resultado en 3 secciones:
   - **Meta tags**: metaTitle (editable, contador de chars), metaDescription (editable)
   - **JSON-LD preview**: collapsiable, código formateado (solo lectura, generado automáticamente)
   - **Imagen de portada**: picker desde fotos confirmadas
5. Botón "Publicar Alojamiento" → guarda SEO + activa propiedad en SSR

**La sección JSON-LD debe mostrarse como:**
```html
<div class="bg-gray-50 rounded-xl p-4">
  <div class="flex items-center justify-between mb-2">
    <span class="text-xs font-semibold text-gray-500 uppercase">
      Datos Estructurados (Schema.org) — Generado automáticamente
    </span>
    <span class="text-xs text-success-600">
      <i class="fa-solid fa-circle-check"></i> Listo para indexación
    </span>
  </div>
  <pre class="text-xs text-gray-600 overflow-auto max-h-48">${jsonLdFormatted}</pre>
</div>
```

---

## FASE 8 — INTEGRACIÓN FINAL

### TAREA F-07: Actualizar webPublica.propiedad.js — orquestador principal
**Archivo a modificar:** `frontend/src/views/components/configurarWebPublica/webPublica.propiedad.js`

**Cambio:** Agregar un panel de estado del BuildContext al inicio de cada subpaso:
```
[1. Inventario ✅] [2. Estructura ✅] [3. Alojamiento ✅] [4. Historia 🔄] [5. Fotos ✅] [6. Publicar ⬜]
```

Cada indicador de estado se calcula desde el buildContext:
- Inventario ✅ si `tipos_elemento count > 0`
- Estructura ✅ si `tipos_componente count > 0`
- Alojamiento ✅ si `propiedades count > 0`
- Historia ✅ si `buildContext.narrativa.descripcionComercial` existe
- Fotos ✅ si `galeria count confirmadas > 0`
- Publicar ✅ si `buildContext.publicacion.jsonLd` existe + propiedad activa

### TAREA F-08: Agregar JSON-LD al SSR (sitio público)
**Archivo a modificar:** `backend/views/propiedad.ejs` (o el template de detalle de propiedad)

**Agregar en el `<head>`:**
```html
<% if (propiedad.websiteData?.jsonLd) { %>
<script type="application/ld+json">
  <%- JSON.stringify(propiedad.websiteData.jsonLd) %>
</script>
<% } %>
```

**Modificar en:** `backend/services/publicWebsiteService.js` — al obtener los datos de
una propiedad para el SSR, incluir `metadata.buildContext.publicacion.jsonLd` en el
objeto que se pasa a la vista EJS.

---

## ORDEN DE IMPLEMENTACIÓN (SECUENCIAL)

```
B-01 → B-02 → B-03 → B-04 → B-05 → B-06 → B-07 → B-08 → B-09
  ↓
F-01 → F-02 → F-03
  ↓
F-04
  ↓
F-05
  ↓
F-06
  ↓
F-07 → F-08
```

Las fases de Backend deben estar todas completadas antes de empezar Frontend.

---

## CHECKLIST DE PROGRESO

### Backend
- [ ] B-01: Script migración activos_catalogo + columnas galería
- [ ] B-02: catalogoService.js creado y testeado
- [ ] B-03: buildContextService.js creado y testeado
- [ ] B-04: prompts/jsonld.js creado
- [ ] B-05: aiContentService.js — generarNarrativaDesdeContexto + generarJsonLdDesdeContexto
- [ ] B-06: property.js — promptDescripcionAlojamiento actualizado
- [ ] B-07: websiteConfigRoutes.js — 4 nuevos endpoints build-context
- [ ] B-08: catalogoRoutes.js creado y registrado
- [ ] B-09: propiedades.js — sync automático buildContext
- [ ] Auditoría complejidad: 0 críticos nuevos
- [ ] Auditoría UI: 0 problemas alta prioridad nuevos

### Frontend
- [ ] F-01: Banners informativos en pasos 1, 2, 3
- [ ] F-02: Buscador catálogo en wizard de activos
- [ ] F-03: Sync buildContext en modals de alojamientos
- [ ] F-04: webPublica.paso1.identidad.js — nuevo flujo con contexto
- [ ] F-05: Galería unificada — eliminar sync manual
- [ ] F-06: webPublica.paso3.seo.js — JSON-LD + publicar
- [ ] F-07: webPublica.propiedad.js — indicadores de estado
- [ ] F-08: SSR — JSON-LD en head de página de propiedad
- [ ] Rebuild CSS: `cd backend && npm run build`
- [ ] Auditoría complejidad: 0 críticos nuevos
- [ ] Auditoría UI: 0 problemas alta prioridad nuevos

---

## REGLAS DE ESTE SPRINT

1. **Prompt injection**: Todo campo de texto que el usuario ingrese y sea enviado a IA
   debe pasar por `_sanitizarHistoria()` o `sanitizeInput()`. Ver feedback memory.

2. **Multi-tenant**: Todo query PostgreSQL tiene `WHERE empresa_id = $1`.
   La tabla `activos_catalogo` usa `WHERE (empresa_id IS NULL OR empresa_id = $1)`.

3. **Sin romper alojamientos existentes**: Los cambios al JSONB `metadata` de propiedades
   son ADITIVOS (jsonb_set con merge). Nunca sobreescribir `metadata` completo.

4. **Fire-and-forget para el buildContext**: Los syncs del contexto se hacen en background.
   Nunca bloquear la respuesta al usuario esperando que el contexto se actualice.

5. **Complejidad**: Max 400 líneas/archivo, max 120 líneas/función, max 8 exports.

---

## CONTEXTO TÉCNICO PARA RETOMAR

### Archivos clave existentes (no tocar su lógica interna salvo lo indicado):
| Archivo | Responsabilidad actual |
|---------|----------------------|
| `backend/services/propiedadLogicService.js` | calcularCapacidad, contarDistribucion |
| `backend/services/galeriaService.js` | CRUD galería, syncToWebsite (a modificar) |
| `backend/services/componentesService.js` | CRUD tipos_componente, analizarNuevoTipoConIA |
| `backend/services/propiedadesService.js` | CRUD propiedades |
| `backend/services/aiContentService.js` | Factory de IA + funciones de generación |
| `backend/services/ai/prompts/property.js` | promptDescripcionAlojamiento, promptEstructuraAlojamiento, promptMetadataActivo |
| `backend/services/ai/prompts/seo.js` | promptSeoHomePage, promptContenidoHomePage, promptPerfilEmpresa |
| `backend/services/ai/filters.js` | checkAvailability (para el agente de chat) |
| `backend/services/ai/photos.js` | getMorePhotos (para el agente de chat) |

### Schema de tablas relevantes:
- `propiedades`: tiene columna `metadata JSONB` donde vive `buildContext` y `websiteData`
- `tipos_elemento`: activos por empresa con schema_type, seo_tags, etc. (tabla ya existe)
- `tipos_componente`: espacios por empresa (tabla ya existe)
- `galeria`: fotos por propiedad (tabla ya existe; agregar shot_context, advertencia, title)
- `activos_catalogo`: a crear en B-01

### Endpoints ya existentes (no duplicar):
- `GET /propiedades` — lista alojamientos de la empresa
- `PUT /propiedades/:id` — actualiza alojamiento (dispara sync buildContext en B-09)
- `GET /galeria/:propiedadId` — lista fotos
- `POST /website/optimize-profile` — perfil empresa (no confundir con narrativa de propiedad)
- `PUT /website/home-settings` — config web empresa (no confundir con config propiedad)
- `GET /website/propiedad/:id/photo-plan` — plan de fotos (ya existe, usar en F-05)

### Proveedor IA por tarea (aiEnums.js):
- `AI_TASK.PROPERTY_DESCRIPTION` → Groq (texto)
- `AI_TASK.SEO_GENERATION` → Groq (texto)
- `AI_TASK.IMAGE_METADATA` → Gemini (visión)
- Fallback chain: configurado en `backend/config/aiConfig.js`
