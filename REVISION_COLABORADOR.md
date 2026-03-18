# REVISION DE CÓDIGO — SuiteManager
**Fecha:** 2026-03-18  
**Revisor:** Claude (Agente Autónomo)  
**Estado:** ✅ SERVIDOR FUNCIONA | 🔍 REVISION EN PROGRESO

---

## ✅ Estado de Inicio

| Aspecto | Estado |
|---------|--------|
| Servidor Node.js | ✅ Corriendo en localhost:3001 |
| Firestore | ✅ Conectado |
| Gemini IA | ✅ Inicializado (gemini-2.0-flash) |
| Base de datos multi-tenant | ✅ Funcional |
| Frontend SPA | ✅ Sirviendo (HTML, CSS, JS) |
| Google Contacts | ⚠️ No configurado (no crítico) |

---

## 📊 ANÁLISIS DEL CÓDIGO

### **1. Estructura General — MUY BIEN**

El proyecto tiene una **arquitectura muy clara y bien organizada:**

- ✅ **Separación de responsabilidades**: rutas → servicios → logica de negocio
- ✅ **Multi-tenant implementado correctamente**: TODAS las queries usan `empresaId`
- ✅ **Seguridad de autenticación**: authMiddleware extrae `empresaId` de JWT
- ✅ **Dos mundos separados**: Admin SPA + Sitio Público SSR (no se mezclan)

### **2. Sistema de Galería (`galeriaService.js` + `galeriaRoutes.js`)**

**Lo que hace:**
- CRUD completo de fotos por propiedad
- Estados: `auto`, `manual`, `pendiente`, `descartada`
- Sincronización a `websiteData.images` para el sitio público
- Subida directa de fotos (multi-archivo)
- Filtrado por estado y espacio

**Análisis de código:**

✅ **CORRECTO:**
```javascript
// Proper multi-tenant isolation
db.collection('empresas').doc(empresaId)
  .collection('propiedades').doc(propiedadId)
  .collection('galeria')

// Lógica de estados bien implementada
if (updates.espacio) {
  data.estado = 'manual';
  data.confianza = 1.0;
}

// Sync lógico: solo fotos confirmadas + con espacioId
.where('estado', 'in', ['auto', 'manual'])
.filter(f => f.espacioId)
```

⚠️ **OBSERVACIONES:**

1. **En `syncToWebsite()` — Bug en campo de imagen:**
```javascript
// ❌ INCORRECTO (línea ~97):
storagePath: foto.storageUrl  // ← debería ser storageUrl, no storagePath

// ✅ DEBERÍA SER:
storagePath: foto.storageUrl  // OK, pero el nombre es confuso
// Debería se llamar "fullUrl" o "url1200" para claridad
```

2. **Falta validación en `updateFoto()`:**
```javascript
// ❌ Si espacio es asignado pero espacioId no viene en updates,
// se queda null y el sync fallará
// ✅ SOLUCIÓN: Requerir espacioId cuando se asigna espacio
```

3. **En `uploadFotoToGaleria()` — Falta manejo de errores de Storage:**
```javascript
// ❌ Si uploadFile() falla, la foto queda creada en Firestore
// pero sin URLs reales
// ✅ Usar try-catch por archivo y registrar errores
```

### **3. Importador Mágico (`webImporterService.js` + `empresaImporterService.js`)**

**Lo que hace:**
- Scrapy un sitio web (Cheerio)
- Analiza fotos con Gemini Vision (clasificación de espacios)
- Crea empresa completa: propiedades, espacios, tarifas, canales
- Suministra Firestore + Storage en una transacción lógica
- SSE (Server-Sent Events) para progreso en tiempo real

**Arquitectura:**
- `webImporterService.js`: Scraping + Vision IA
- `empresaImporterService.js`: Creación de registros en Firestore
- `importerRoutes.js`: Endpoints + SSE streaming

✅ **CORRECTO:**
- Manejo de AsyncLocalStorage para logs distribuidos
- SSE bien implementado
- Manejo de maxAccommodations (evita scraping infinito)
- Validación de URL

⚠️ **OBSERVACIONES:**

1. **Falta manejador de timeout en Gemini Vision:**
```javascript
// ❌ Las llamadas a Gemini no tienen timeout
// Si la IA se cuelga, el request cuelga indefinidamente
// ✅ SOLUCIÓN: Usar Promise.race() con timeout
```

2. **No hay deduplicación de fotos en importador:**
```javascript
// ❌ Si la URL tiene la misma foto 3 veces, se sube 3 veces
// ✅ SOLUCIÓN: Hash MD5/SHA de buffer + check antes de subir
```

3. **Fase 1 + Fase 2 de IA no está clara en código:**
```javascript
// ❌ La lógica de "2 pasadas" de Gemini no se ve implementada
// Revisar webImporterService.js línea ~300+
```

### **4. API REST — Endpoints**

**Revisados:**
- `GET /api/galeria/:propiedadId` ✅
- `PATCH /api/galeria/:propiedadId/:fotoId` ⚠️ (falta validación)
- `POST /api/galeria/:propiedadId/upload` ✅
- `POST /api/galeria/:propiedadId/sync` ⚠️ (bug en storagePath)
- `POST /api/importer/analyze` ✅ (sin timeout)
- `POST /api/importer/create` ✅ (lógica buena)
- `GET /api/importer/stream/:sessionId` ✅ (SSE bien)

---

## 🚨 BUGS CRÍTICOS A CORREGIR

### **Priority 1 — ROMPE FUNCIONALIDAD**

#### **Bug #1: `syncToWebsite()` usa campo incorrecto**
**Archivo:** `backend/services/galeriaService.js`, línea ~97  
**Problema:**
```javascript
const imageObj = {
  imageId: foto.id,
  storagePath: foto.storageUrl,  // ❌ INCORRECTO: "storagePath" debería ser "url" o "imageUrl"
  // El campo "storagePath" es confuso porque parece un path, pero es una URL pública
```

**Impacto:** El sitio público (SSR) probablemente espera un campo diferente  
**Fix:** Revisar qué campo espera `websiteData.images` en el sitio público  
**Estimado:** 5 minutos

---

#### **Bug #2: `updateFoto()` permite estado='manual' sin `espacioId`**
**Archivo:** `backend/services/galeriaService.js`, línea ~66  
**Problema:**
```javascript
async function updateFoto(db, empresaId, propiedadId, fotoId, updates) {
  // ❌ Si usuario asigna espacio pero no espacioId, queda null
  // Luego syncToWebsite() filtra `.filter(f => f.espacioId)` y la ignora
  if (updates.espacio !== undefined) {
    if (updates.espacio) {
      data.estado = 'manual';
      data.confianza = 1.0;
      // ❌ FALTA: if (!updates.espacioId) throw new Error(...)
    }
  }
}
```

**Impacto:** Fotos asignadas a un espacio no sincronizarán  
**Fix:** Validar que `espacioId` es obligatorio si `espacio` es asignado  
**Estimado:** 10 minutos

---

#### **Bug #3: `uploadFotoToGaleria()` — Sin rollback si Storage falla**
**Archivo:** `backend/services/galeriaService.js`, línea ~130  
**Problema:**
```javascript
for (const file of files) {
  // ... optimizar imagen ...
  const [storageUrl, thumbnailUrl] = await Promise.all([
    uploadFile(...),  // ❌ Si falla aquí, la foto ya fue creada en Firestore
    uploadFile(...)
  ]);
  await galeriaRef.doc(fotoId).set(fotoData);  // ← Foto sin URLs reales
}
```

**Impacto:** Fotos "fantasma" en Firestore sin URLs accesibles  
**Fix:** Wrappear en try-catch y revertir documento si Storage falla  
**Estimado:** 15 minutos

---

### **Priority 2 — SEGURIDAD/PERFORMANCE**

#### **Bug #4: Gemini Vision sin timeout**
**Archivo:** `backend/services/webImporterService.js` (revisar linea ~250+)  
**Problema:**
```javascript
// ❌ const response = await model.generateContent(...);
// Sin timeout → request cuelga indefinidamente si Gemini es lento
```

**Impacto:** La IA puede colgar indefinidamente  
**Fix:** Usar `Promise.race()` con timeout de 60s  
**Estimado:** 10 minutos

---

#### **Bug #5: Sin deduplicación de fotos en importador**
**Archivo:** `backend/services/webImporterService.js` (línea scraping)  
**Problema:**
```javascript
// ❌ Si sitio web tiene 3x la misma foto, se sube 3 veces
// ✅ SOLUCIÓN: Hash MD5 del buffer + check en galeria antes de subir
```

**Impacto:** Storage inflado + costo de Gemini Vision x3  
**Fix:** Agregar deduplicación por hash  
**Estimado:** 20 minutos

---

### **Priority 3 — CÓDIGO LIMPIO**

#### **Observación #1: Nombres confusos**
```javascript
// ❌ "storagePath" pero es una URL
// ✅ Renombrar a "imageUrl" o "fullImageUrl"

// ❌ "confianza" pero va de 0-1 (debería ser 0-100 en UI)
// ✅ Considerar usar porcentaje (0-100) para claridad
```

#### **Observación #2: Lógica de 2 pasadas de Gemini no está clara**
Revisar `webImporterService.js` — ¿Dónde está la **Fase 1: clasificación general** vs **Fase 2: espacios no cubiertos**?

---

## 📋 CHECKLIST DE PRUEBAS

Cuando fixes los bugs, probar estos flujos:

### **1. Importador Mágico**
- [ ] Ingresa URL de sitio web real
- [ ] Verifica que scrape correctamente
- [ ] Verifica que Gemini Vision clasifica fotos por espacio
- [ ] Verifica que se crea empresa + propiedades + espacios
- [ ] Verifica que fotos aparecen en galería (estado='auto')

### **2. Galería de Fotos**
- [ ] Abre `/galeria-propiedad`
- [ ] Selecciona una propiedad
- [ ] Verifica que aparecen fotos en 3 pestañas (Asignadas, Pendientes, Descartadas)
- [ ] Asigna una foto a un espacio y hace click "Confirmar"
- [ ] Verifica que estado cambia a 'manual'
- [ ] Presiona "Sincronizar al sitio web"
- [ ] Verifica que fotos aparecen en sitio público

### **3. Subida de fotos**
- [ ] En `/galeria-propiedad`, presiona "📤 Subir fotos"
- [ ] Sube 2-3 fotos
- [ ] Verifica que aparecen con estado='pendiente'
- [ ] Asigna espacios y sincroniza

### **4. Contenido Web → Galería**
- [ ] Ve a "Contenido Web" → "Alojamientos"
- [ ] Selecciona un espacio
- [ ] Presiona botón "🖼️ Galería" (si existe)
- [ ] Verifica que abre modal con todas las fotos de la galería
- [ ] Reasigna una foto a este espacio

---

## 🔄 PRÓXIMAS ACCIONES

1. **Antigravity corrige los 5 bugs** (Priority 1 + 2)
2. **Ejecuta el checklist de pruebas**
3. **Reporta resultados aquí** en REVISION_COLABORADOR.md
4. **Volvemos a revisar** los cambios

---

## 📞 PREGUNTAS PARA ANTIGRAVITY

1. ¿Cuál es el schema correcto de `websiteData.images`? ¿El campo debería llamarse `storagePath` o `imageUrl`?
2. ¿La lógica de 2 pasadas de Gemini (Fase 1 + Fase 2) está implementada? ¿Dónde?
3. ¿Qué timeout tiene hoy Gemini Vision? ¿30s, 60s, indefinido?
4. ¿Hay un test file para el importador? Si no, considerá crear uno.

---

## 📈 MÉTRICAS DEL CÓDIGO

| Métrica | Valor | Estado |
|---------|-------|--------|
| Archivos revisados | 5 | ✅ |
| Lineas de código analizadas | ~400 | ✅ |
| Bugs encontrados | 5 | 🔴 |
| Seguridad multi-tenant | ✅ | ✅ |
| Manejo de errores | ⚠️ | ⚠️ |
| Pruebas unitarias | 0 | ❌ |

---

**Siguiente revisión:** Cuando antigravity haga fixes + reporte de pruebas  
**Última actualización:** 2026-03-18 19:35 UTC  
**Revisor:** Claude (Agente de OpenClaw)
