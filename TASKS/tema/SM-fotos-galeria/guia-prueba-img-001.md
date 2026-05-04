# Guía de Prueba - [IMG-001] Sync de Imágenes

## Objetivo
Verificar que las imágenes ahora se guardan persistentemente en el Paso 2 de `/website-alojamientos`.

## Cambios Implementados
1. **Restaurado modo dual** en `backend/services/galeriaService.js`
2. **Auto-sync** en 3 puntos críticos del frontend
3. **Documentación** con referencia `[IMG-001]`

## Pasos para Probar

### 1. Iniciar Servidor
```bash
cd backend
npm run dev
```

### 2. Acceder a Website-Alojamientos
1. Abrir navegador en `http://localhost:3000`
2. Iniciar sesión
3. Navegar a `/website-alojamientos`

### 3. Probar Cada Flujo

#### Flujo A: Wizard IA
1. Seleccionar un alojamiento
2. Ir al **Paso 2 (Fotos)**
3. Hacer clic en **"Asistente IA"** para algún espacio
4. Subir una foto siguiendo el wizard
5. **Cerrar** el wizard
6. **Recargar** la página (F5)
7. **Verificar:** La foto debe permanecer

#### Flujo B: Gallery Picker  
1. En el mismo alojamiento, Paso 2
2. Hacer clic en **"Galería"** para un espacio
3. Seleccionar 1-2 fotos existentes
4. Hacer clic en **"Asignar Fotos Seleccionadas"**
5. **Recargar** la página (F5)
6. **Verificar:** Las fotos seleccionadas deben permanecer

#### Flujo C: Upload Masivo
1. En el mismo alojamiento, Paso 2
2. Hacer clic en **"Subir"** para un espacio
3. Seleccionar múltiples fotos
4. Esperar a que se procesen
5. **Recargar** la página (F5)
6. **Verificar:** Todas las fotos deben permanecer

## Qué Buscar en los Logs

### Logs Esperados (Consola del Servidor)
```
[PostgreSQL] DATABASE_URL no definida — modo Firestore activo.
...otros logs normales...
```

### Logs del Navegador (F12 → Console)
Deberías ver:
```
[Galería] Auto-sync fallido: [mensaje de error si hay]
```
O nada (si el sync funciona silenciosamente).

## Si el Problema Persiste

### 1. Verificar Modo de Base de Datos
El servidor debe mostrar:
```
[PostgreSQL] DATABASE_URL no definida — modo Firestore activo.
```
Si muestra conexión PostgreSQL, el problema es diferente.

### 2. Probar Endpoint Manualmente
Con el servidor corriendo, puedes probar:
```bash
# Reemplazar :propiedadId con un ID real
curl -X POST http://localhost:3000/api/galeria/:propiedadId/sync \
  -H "Authorization: Bearer [tu-token-jwt]" \
  -H "Content-Type: application/json"
```

### 3. Verificar Firestore
1. Ir a Firebase Console
2. Navegar a la propiedad probada
3. Verificar campo `websiteData.images`
4. Debe contener las fotos sincronizadas

## Código Modificado

### Backend (`backend/services/galeriaService.js`)
- `getGaleria()` - Modo dual restaurado
- `updateFoto()` - Modo dual restaurado  
- `syncToWebsite()` - Modo dual restaurado (CRÍTICO)
- `descartarFoto()`, `confirmarFoto()`, `eliminarFoto()` - Modo dual

### Frontend (`frontend/src/views/components/configurarWebPublica/webPublica.galeria.js`)
- Líneas 46-50: Sync al cerrar wizard
- Línea 427: Sync después de picker
- Líneas 726-728: Sync después de upload masivo

## Reportar Resultados

### Si FUNCIONA:
- [ ] Flujo A (Wizard IA) ✅
- [ ] Flujo B (Gallery Picker) ✅  
- [ ] Flujo C (Upload Masivo) ✅
- [ ] Persistencia después de recargar ✅

### Si NO FUNCIONA:
- [ ] Describir qué flujo falla
- [ ] Capturar logs del servidor
- [ ] Capturar logs del navegador
- [ ] Verificar errores en Firebase Console