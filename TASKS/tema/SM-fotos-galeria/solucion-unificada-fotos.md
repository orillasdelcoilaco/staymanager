# Solución Unificada para Guardado de Fotos

**Fecha:** 2026-04-14  
**Estado:** ✅ Implementada  
**Problema Resuelto:** Fotos "desaparecían" al recargar el Paso 2 de Configuración Web

## 📋 Problema Identificado

El sistema tenía dos almacenamientos separados para fotos:
1. **Tabla `galeria`** (PostgreSQL) - Fuente de verdad centralizada
2. **`websiteData.images`** (JSONB en `propiedades.metadata`) - Para sitio web público

Los flujos no convergían:
- **Wizard IA / Subida directa**: Solo guardaba en `websiteData.images`
- **Galería**: Solo guardaba en tabla `galeria` (requería `sync` manual)
- **Paso 2 Configuración Web**: Priorizaba `galeriaPorEspacio` (tabla `galeria`) sobre `websiteData.images`

Resultado: Fotos subidas por wizard "desaparecían" al recargar.

## 🎯 Solución Implementada

### 1. **Endpoint `upload-image` Unificado** (`websiteConfigRoutes.js`)
```javascript
// GUARDADO EN AMBOS SISTEMAS
// 1. Tabla galeria (fuente de verdad centralizada)
const galeriaResults = await uploadFotoToGaleria(db, empresaId, propiedadId, [file]);
// Actualizar con metadata completa y estado 'manual'

// 2. websiteData.images (comportamiento original)
await pool.query(`UPDATE propiedades SET metadata = jsonb_set(...)`);
```

**Cambios:**
- Importa `uploadFotoToGaleria` desde `galeriaService`
- Guarda en tabla `galeria` con estado `'manual'`, `espacio_id`, `alt_text`, etc.
- Mantiene guardado en `websiteData.images` para compatibilidad
- Usa mismo `imageId` para consistencia entre sistemas

### 2. **Endpoint `delete-image` Unificado** (`websiteConfigRoutes.js`)
```javascript
// ELIMINACIÓN DE AMBOS SISTEMAS
// 1. Eliminar archivo del storage
// 2. Eliminar de tabla galeria
await eliminarFoto(db, empresaId, propiedadId, imageId);
// 3. Eliminar de websiteData.images
```

**Nueva función en `galeriaService.js`:**
```javascript
async function eliminarFoto(_db, empresaId, propiedadId, fotoId) {
    await pool.query(
        `DELETE FROM galeria WHERE id=$1 AND empresa_id=$2 AND propiedad_id=$3`,
        [fotoId, empresaId, propiedadId]
    );
}
```

### 3. **Sistema `photos.js` Actualizado** (`backend/services/ai/photos.js`)
Prioriza tabla `galeria` sobre `websiteData.images`:
```javascript
// PRIORIDAD 1: TABLA GALERIA
const { rows: galeriaRows } = await pool.query(`
    SELECT storage_url, alt_text, espacio, espacio_id, confianza, estado
    FROM galeria WHERE empresa_id = $1 AND propiedad_id = $2
    AND estado IN ('auto', 'manual') ...
`);

// PRIORIDAD 2: FALLBACK A websiteData.images (legacy)
if (galeriaRows.length === 0) {
    // Consultar websiteData.images...
}
```

### 4. **Endpoint `PUT /propiedad/:propiedadId` Corregido**
Arregladas variables no definidas (`empresaId`, `nombreEmpresa`).

## 🔄 Flujos Convergentes Ahora

| Flujo | Antes | Ahora |
|-------|-------|-------|
| **Wizard IA** | `websiteData.images` solo | `galeria` + `websiteData.images` |
| **Subida directa** | `websiteData.images` solo | `galeria` + `websiteData.images` |
| **Desde Galería** | `galeria` → (manual `sync`) → `websiteData.images` | `galeria` → (auto/manual `sync`) → `websiteData.images` |
| **Eliminación** | `websiteData.images` solo | `galeria` + `websiteData.images` |
| **Consulta (photos.js)** | `websiteData.images` solo | `galeria` (prioridad) → `websiteData.images` (fallback) |

## 🏗️ Arquitectura Resultante

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Storage       │
│   (SPA/SSR)     │    │   (API)         │    │   (Firebase)    │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Wizard IA     │───▶│ • upload-image  │───▶│ • Archivos WebP │
│ • Subida directa│    │   (ambos)       │    │   optimizados   │
│ • Galería picker│    │ • delete-image  │    │                 │
│                 │    │   (ambos)       │    │                 │
│ • Paso 2 Config │◀───│ • get galeria   │    │                 │
│   (prioriza     │    │ • sync          │    │                 │
│    galeria)     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   (Fuente verdad)│
                       ├─────────────────┤
                       │ • tabla galeria │
                       │ • propiedades   │
                       │   (metadata)    │
                       └─────────────────┘
```

## 📊 Beneficios

1. **Consistencia garantizada**: Mismos datos en ambos sistemas
2. **No más fotos "perdidas"**: Paso 2 siempre muestra fotos reales
3. **Backward compatible**: `websiteData.images` sigue funcionando
4. **Mejor performance**: `photos.js` prioriza galería (índices SQL)
5. **Mantenible**: Un solo patrón para todos los flujos

## 🧪 Pruebas Realizadas

1. ✅ Estructura tabla `galeria` verificada
2. ✅ Funciones `uploadFotoToGaleria` y `eliminarFoto` disponibles
3. ✅ Importaciones correctas en `websiteConfigRoutes.js`
4. ✅ Lógica de prioridad en `photos.js` implementada
5. ✅ Variables corregidas en endpoint `PUT`

## 🚀 Próximos Pasos (Opcionales)

1. **Migración completa**: Eliminar `websiteData.images`, usar solo `galeria`
2. **Sincronización automática**: Trigger en PostgreSQL para auto-sync
3. **Monitoreo**: Script para detectar inconsistencias
4. **Cache**: Cachear resultados de galería para sitio web público

## 📝 Archivos Modificados

1. `backend/routes/websiteConfigRoutes.js`
   - Import `uploadFotoToGaleria`, `eliminarFoto`
   - Modificar `upload-image` endpoint (guardar en ambos)
   - Modificar `delete-image` endpoint (eliminar de ambos)
   - Corregir `PUT /propiedad/:propiedadId`

2. `backend/services/galeriaService.js`
   - Agregar función `eliminarFoto`
   - Exportar `eliminarFoto`

3. `backend/services/ai/photos.js`
   - Priorizar tabla `galeria` sobre `websiteData.images`
   - Agregar fallback a `websiteData.images`

4. `scripts/test-fotos-unificadas.js` (nuevo)
   - Test de consistencia entre sistemas

## 🔧 Comandos Útiles

```bash
# Verificar consistencia
node scripts/test-fotos-unificadas.js

# Ejecutar migración de imágenes legacy
node backend/db/migrations/migrar-imagenes-firestore-postgres.js

# Forzar sync de una propiedad
curl -X POST /api/galeria/:propiedadId/sync
```

---

**Nota:** La solución mantiene compatibilidad con el sistema existente mientras migra gradualmente a la tabla `galeria` como fuente de verdad única.