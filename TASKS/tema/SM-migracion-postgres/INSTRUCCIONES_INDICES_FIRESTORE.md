# 🔥 Instrucciones para Crear Índices de Firestore

**CRÍTICO**: Los nuevos endpoints de la API pública requieren índices compuestos en Firestore. Sin estos índices, las queries fallarán con error `FAILED_PRECONDITION`.

---

## Método 1: Crear Índices Manualmente

### Paso 1: Ir a Firebase Console

1. Abrir: [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Seleccionar proyecto: **suite-manager-app**
3. En el menú lateral, ir a: **Firestore Database** → **Indexes**

### Paso 2: Crear Índices Compuestos

#### Índice 1: Collection Group `propiedades`

**Para**: Búsqueda de propiedades por ID en todos los endpoints

1. Click en **"Create Index"**
2. Configurar:
  - **Collection ID**: `propiedades`
  - **Query scope**: **Collection group** ⚠️ (NO "Collection")
  - **Fields to index**:
    - Campo 1: `id` → **Ascending**
    - Campo 2: `__name__` → **Ascending**
3. Click **"Create"**
4. Esperar a que el índice se construya (~2-5 minutos)

#### Índice 2: Collection `reservas`

**Para**: Verificar disponibilidad de propiedades

1. Click en **"Create Index"**
2. Configurar:
  - **Collection ID**: `reservas`
  - **Query scope**: **Collection** (NO "Collection group")
  - **Fields to index**:
    - Campo 1: `alojamientoId` → **Ascending**
    - Campo 2: `estado` → **Ascending**
    - Campo 3: `fechaSalida` → **Ascending**
3. Click **"Create"**
4. Esperar a que el índice se construya

#### Índice 3: Collection Group `reservas` (para job de expiración)

**Para**: Job automático de expiración de propuestas

1. Click en **"Create Index"**
2. Configurar:
  - **Collection ID**: `reservas`
  - **Query scope**: **Collection group** ⚠️
  - **Fields to index**:
    - Campo 1: `metadata.origenIA` → **Ascending**
    - Campo 2: `metadata.estadoPago` → **Ascending**
    - Campo 3: `fechaCreacion` → **Ascending**
3. Click **"Create"**
4. Esperar a que el índice se construya

---

## Método 2: Crear Índices Automáticamente (Más Fácil)

### Paso 1: Intentar Usar un Endpoint

Simplemente intenta acceder a cualquier endpoint nuevo, por ejemplo:

```
https://suite-manager.onrender.com/api/public/propiedades/7lzqGKUxuQK0cttYeH0y/cotizar?fechaInicio=2025-12-20&fechaFin=2025-12-25
```

### Paso 2: Copiar Link del Error

Firestore detectará que falta un índice y el error incluirá un link directo. Busca en los logs de Render algo como:

```
The query requires an index. You can create it here: 
https://console.firebase.google.com/v1/r/project/suite-manager-app/firestore/indexes?create_composite=...
```

### Paso 3: Click en el Link

1. Copia el link completo del error
2. Pégalo en tu navegador
3. Firebase abrirá la consola con el índice pre-configurado
4. Click en **"Create Index"**
5. Esperar a que se construya

### Paso 4: Repetir para Cada Endpoint

Prueba cada endpoint y crea los índices según vayan apareciendo los errores.

---

## Verificar que los Índices Están Listos

1. Ir a: **Firestore Database** → **Indexes**
2. Verificar que los 3 índices aparezcan con estado **"Enabled"** (verde)
3. Si alguno dice **"Building"** (naranja), esperar a que termine

---

## Después de Crear los Índices

1. ✅ Avisar que los índices están listos
2. ✅ Reiniciar el servicio en Render (si es necesario)
3. ✅ Probar todos los endpoints nuevamente

Los endpoints deberían funcionar correctamente una vez que los índices estén construidos.

---

## Troubleshooting

### Error: "Index already exists"

- Significa que el índice ya fue creado anteriormente
- Verificar en la sección "Indexes" que esté en estado "Enabled"

### Error: "Building" por más de 10 minutos

- Normal si la base de datos tiene muchos documentos
- Esperar pacientemente, puede tomar hasta 30 minutos en bases grandes

### Error persiste después de crear índices

- Verificar que el **Query scope** sea correcto (Collection vs Collection group)
- Verificar que los nombres de campos sean exactos (case-sensitive)
- Reiniciar el servicio en Render

---

**Documento creado**: 2025-11-30  
**Autor**: Antigravity AI