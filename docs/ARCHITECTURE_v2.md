# SuiteManager IA - Arquitectura v2 (SSR + Concierge)

## 1. Análisis del Estado Actual (Auditoría)

### SSR (Legacy)
El módulo SSR actual (`websiteConfigRoutes.js`, `contentFactoryRoutes.js`) funciona pero presenta deuda técnica:
- **Dispersión:** La configuración global y la gestión de contenido están en archivos separados sin una jerarquía clara.
- **Acoplamiento:** El servicio de IA (`aiContentService`) mezclaba generación de texto con lógica de negocio.
- **Modelos:** La estructura en Firestore ha crecido orgánicamente. `websiteSettings` es un objeto gigante dentro del documento de empresa, lo que dificulta la lectura parcial.

### IA Concierge (Necesidad)
Actualmente inexistente como módulo estructurado.
- **Desafío:** Usar GPT-4 para todo dispararía los costos.
- **Solución:** Se requiere una arquitectura de "Router" que derive a lógica determinista (código) o modelos baratos (GPT-4o-mini) antes de usar modelos costosos.

---

## 2. Nueva Estructura de Proyecto

Separación estricta de dominios:

```text
backend/
├── api/
│   ├── ssr/                  # [ADMIN] Gestión de contenidos y configuración
│   │   ├── config.js         # Rutas de configuración global
│   │   ├── content.js        # Gestión de fotos y textos (Content Factory)
│   │   └── builder.js        # Lógica de construcción (si aplica)
│   └── concierge/            # [PUBLIC] API para el chat
│       ├── chat.js           # Endpoint principal de conversación
│       └── gallery.js        # Endpoint para entregar fotos al chat
├── services/
│   ├── ai/
│   │   ├── router.js         # "Cerebro" de costos (Intention -> Model)
│   │   ├── intention.js      # Clasificador Regex/NLP ligero
│   │   ├── filters.js        # Query Builder para Firestore
│   │   └── photos.js         # Selección de fotos para el chat
│   └── ssr/
│       └── imageProcessor.js # (Legacy imageProcessingService) Optimización física
├── firestore/
│   └── models.js             # Definiciones de esquemas y helpers
```

---

## 3. Modelo de Datos Firestore (Normalizado)

El objetivo es permitir que el **Concierge** lea datos preparados por el **SSR**.

### Colección: `empresas/{empresaId}`

#### Documento Raíz (`empresas/{empresaId}`)
Configuración de alto nivel y datos administrativos.
```json
{
  "nombre": "Cabañas El Bosque",
  "plan": "premium",
  "siteConfig": {
    "domain": "elbosque.suitemanagers.com",
    "primaryColor": "#4F46E5",
    "secondaryColor": "#10B981"
  },
  "seoConfig": {
    "globalKeywords": ["cabañas", "sur de chile"],
    "homeTitle": "Descanso en el Sur"
  }
}
```

#### Subcolección: `propiedades/{propiedadId}`
Datos específicos de cada alojamiento.
```json
{
  "infoBase": {
    "nombre": "Cabaña Arrayán",
    "capacidad": 6,
    "paxMax": 6,
    "tipo": "Cabaña"
  },
  "tarifas": {
    "base": 120000,
    "moneda": "CLP"
  },
  "ubicacion": {
    "lat": -39.0,
    "lng": -72.0,
    "direccion": "Camino al Volcán km 5"
  },
  "websiteData": {
    "slug": "cabana-arrayan",
    "aiDescription": "Hermosa cabaña...",
    "features": ["Tinaja", "Vista al Volcán"]
  },
  "componentes": [
    {
      "id": "comp_123",
      "tipo": "Dormitorio Principal",
      "descripcion": "Cama King con vista",
      "cantidadFotos": 3
    }
  ]
}
```

#### Subcolección: `photos/{fotoId}` (NUEVO)
Centralizamos las fotos para indexarlas mejor. Alternativamente, usar array en propiedad si son pocas (<50), pero una subcolección permite consultas avanzadas ("dame todas las fotos de 'cocinas'").
*Decisión:* Mantener array en `propiedades` para rapidez de lectura SSR, pero etiquetado robusto.

```json
// En propiedad.websiteData.images (Map o Array mejorado)
[
  {
    "id": "img_xyz",
    "urlOriginal": "...",
    "urlOptimized": "...", // WebP 1200px
    "urlThumb": "...",     // WebP 400px (Preview chat)
    "tags": ["interior", "cama", "vista_volcan"],
    "categoria": "dormitorio",
    "componenteId": "comp_123",
    "altText": "Dormitorio principal con ventanal",
    "aiScore": 0.95,
    "visibleEnSSR": true,
    "useInConcierge": true
  }
]
```

---

## 4. Lógica de Costos (AI Router)

El Router decidirá el camino antes de gastar tokens:

1.  **Direct Hit (Costo 0):**
    *   Input: "Precio para 2 personas este fin de semana"
    *   Intention: `BOOKING_QUERY`
    *   Action: Calcular precio interno -> Respuesta Template.
2.  **Low Cost (GPT-4o-mini):**
    *   Input: "¿Aceptan mascotas?"
    *   Intention: `FAQ`
    *   Action: RAG simple (Búsqueda en vector/texto) -> Respuesta sintética.
3.  **High Value (GPT-4o):**
    *   Input: "Estoy buscando algo romántico para mi aniversario, no sé cuál elegir"
    *   Intention: `SALES_ADVISORY`
    *   Action: Cargar perfil completo + fotos seleccionadas -> Respuesta persuasiva.
