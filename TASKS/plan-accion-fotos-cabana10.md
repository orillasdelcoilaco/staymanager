# Plan de Acción: Corrección de Plan de Fotos - Cabaña 10

## Fecha: 2026-04-15
## Propiedad: Cabaña 10 (ID: `cabana10`)
## Empresa: `cv1Lb4HLBLvWvSyqYfRW`
## Problema: Plan de fotos en metadata no coincide con componentes reales

## 📋 ESTADO ACTUAL: **FASE 1 COMPLETADA** ✅

### ✅ **Fase 1: Documentación y Planificación - COMPLETADA**
- [x] **Paso 1.1**: Documentar problema en `plan-accion-fotos-cabana10.md`
- [x] **Paso 1.2**: Analizar componentes reales vs plan actual
- [x] **Paso 1.3**: Definir solución técnica

### ✅ **Fase 2: Desarrollo del Script de Corrección - COMPLETADA**
- [x] **Paso 2.1**: Crear script `actualizar_plan_fotos_cabana10.js`
- [x] **Paso 2.2**: Implementar lógica de generación de plan
- [x] **Paso 2.3**: Implementar actualización de metadata
- [x] **Paso 2.4**: Agregar validaciones y logging

### ✅ **Fase 3: Ejecución y Verificación - COMPLETADA**
- [x] **Paso 3.1**: Ejecutar script en modo dry-run ✅
- [x] **Paso 3.2**: Revisar cambios propuestos ✅
- [x] **Paso 3.3**: Ejecutar script en modo apply ✅
- [x] **Paso 3.4**: Verificar metadata actualizada ✅

### ✅ **Fase 4: Validación y Auditoría - COMPLETADA**
- [x] **Paso 4.1**: Ejecutar script de análisis post-corrección ✅
- [x] **Paso 4.2**: Verificar consistencia de datos ✅
- [x] **Paso 4.3**: Ejecutar auditorías UI y complejidad ✅
- [x] **Paso 4.4**: Documentar resultados ✅

---

## 📊 PROBLEMA DETECTADO

### Situación Actual:
1. **Componentes reales**: 11 componentes con 76 elementos
2. **Plan generado desde componentes**: 69 slots de fotos
3. **Plan en metadata (`fotoPlanIA`)**: 17 slots (solo 25% del total)
4. **Fotos en galería**: 35 fotos
5. **Faltan**: 34 fotos según plan + 8 componentes sin plan

### Inconsistencias Específicas:

#### ❌ Componentes FALTANTES en plan (8):
- Comedor (3 fotos)
- Living (6 fotos)  
- Terraza (4 fotos)
- Tinaja (4 fotos)
- Estacionamiento (1 foto)
- Exterior (1 foto)
- Dormitorio Matrimonial (7 fotos)
- Dormitorio Camarotes (8 fotos)

#### ❌ Componentes OBSOLETOS en plan (3):
- `tinaja-mj52h75d` (3 fotos) - ID diferente al actual
- `dormitorio-mne0du1z` (3 fotos) - ID obsoleto
- `dormitorio-mne0ep6s` (2 fotos) - ID obsoleto

---

## 🎯 OBJETIVO

Actualizar `metadata.fotoPlanIA` para que coincida exactamente con el plan generado desde los componentes reales (69 slots).

**Métricas de éxito post-corrección:**
- ✅ `metadata.fotoPlanIA` tiene 69 slots (no 17)
- ✅ 11 componentes con plan (no 6)
- ✅ 0 componentes obsoletos en plan
- ✅ Consistencia 100% entre plan generado y metadata

---

## 🛠️ SCRIPT DE CORRECCIÓN

### Archivo: `backend/scripts/actualizar_plan_fotos_cabana10.js`

#### Funcionalidades:
1. **Modo dry-run**: Mostrar cambios sin aplicar
2. **Modo apply**: Aplicar cambios a la base de datos
3. **Backup automático**: Guardar `fotoPlanIA` anterior
4. **Validación**: Verificar que plan generado = plan aplicado
5. **Logging detallado**: Registrar cada cambio

#### Parámetros:
```bash
# Modo dry-run (solo mostrar cambios)
node backend/scripts/actualizar_plan_fotos_cabana10.js --dry-run

# Modo apply (aplicar cambios)
node backend/scripts/actualizar_plan_fotos_cabana10.js --apply

# Especificar propiedad diferente
node backend/scripts/actualizar_plan_fotos_cabana10.js --propiedad=cabana9 --dry-run
```

---

## ⚠️ PUNTOS DE CONTINUACIÓN (si se acaban créditos)

### Punto A: Después de crear script (Fase 2 completa)
**Verificación:**
```bash
# Verificar que el script existe
ls -la backend/scripts/actualizar_plan_fotos_cabana10.js

# Verificar créditos
node scripts/monitor-creditos.js reporte
```

### Punto B: Después de dry-run (Paso 3.2 completo)
**Verificación:**
```bash
# Ejecutar dry-run para ver cambios
node backend/scripts/actualizar_plan_fotos_cabana10.js --dry-run

# Analizar estado actual
node backend/scripts/analizar_fotos_cabana10.js
```

### Punto C: Después de apply (Paso 3.4 completo)
**Verificación:**
```bash
# Aplicar cambios
node backend/scripts/actualizar_plan_fotos_cabana10.js --apply

# Verificar metadata actualizada
node backend/scripts/analizar_fotos_cabana10.js
```

### Punto D: Después de validación (Fase 4 completa)
**Verificación:**
```bash
# Ejecutar auditorías
node scripts/audit-ui-monitored.js
node scripts/audit-complexity-monitored.js

# Verificar créditos finales
node scripts/monitor-creditos.js reporte
```

---

## 📝 NOTAS TÉCNICAS

### Estructura de `fotoPlanIA`:
```javascript
{
  "componente-id-1": [
    {
      "shot": "vista_general_espacio",
      "type": "espacio_general",
      "guidelines": "Mostrar el espacio completo..."
    },
    {
      "shot": "tv_smart_angulo_principal",
      "type": "activo", 
      "guidelines": "Enfocar en la TV Smart..."
    }
  ]
}
```

### Campos importantes:
- `shot`: Identificador único del tipo de foto
- `type`: `espacio_general` o `activo`
- `guidelines`: Instrucciones para la foto

### Relación con `tipos_elemento`:
- `requires_photo`: Si el tipo requiere foto
- `photo_quantity`: Cantidad de fotos requeridas
- `photo_guidelines`: Guías específicas
- `schema_property`: `amenityFeature` para amenidades destacadas

---

## 🔧 IMPLEMENTACIÓN ACTUAL

**Estado:** Script creado, listo para ejecutar dry-run (Paso 3.1)

**Próximo paso:** Ejecutar script en modo dry-run para revisar cambios

**Archivos involucrados:**
1. `backend/scripts/actualizar_plan_fotos_cabana10.js` ✅ CREADO
2. `backend/services/propiedadLogicService.js` (función `generarPlanFotos`)
3. `backend/db/postgres.js` (conexión a PostgreSQL)
4. `backend/scripts/analizar_fotos_cabana10.js` (para validación)

---

## 📞 INFORMACIÓN DE CONTACTO

- **Responsable**: Claude Code (Arquitecto de Software)
- **Propiedad**: Cabaña 10 (ID: `cabana10`)
- **Empresa**: `cv1Lb4HLBLvWvSyqYfRW`
- **Fecha inicio**: 2026-04-15
- **Última actualización**: 2026-04-15 - Fase 1 completada

---

## 🎉 RESULTADOS FINALES - CORRECCIÓN COMPLETADA

### ✅ **Corrección Exitosa:**
1. **Plan de fotos actualizado**: 17 → 69 slots (+52)
2. **Componentes con plan**: 6 → 11 componentes
3. **Componentes obsoletos eliminados**: 3 IDs obsoletos
4. **Consistencia 100%**: Plan generado = Plan en metadata

### 📊 **Estado Actual de Cabaña 10:**
- **JSON-LD**: ✅ Correcto (3 dormitorios, 2 baños, 6 personas)
- **Plan de fotos**: ✅ Actualizado (69 slots, 11 componentes)
- **Fotos en galería**: 35 fotos (faltan 34 según plan)
- **Auditorías**: ✅ Sin nuevos problemas introducidos

### 🔧 **Scripts Creados:**
1. `analizar_fotos_cabana10.js` - Análisis detallado
2. `actualizar_plan_fotos_cabana10.js` - Corrección automática

### 📈 **Impacto en el Sistema:**
- La IA ahora tiene plan completo para generar/validar fotos
- Todos los componentes tienen plan de fotos
- Metadata sincronizada con componentes reales
- Sistema preparado para generación de contenido visual

### 🚀 **Próximos Pasos Opcionales:**
1. **Generar fotos faltantes**: 34 fotos según plan
2. **Extender script a otras propiedades**: Usar `--propiedad=ID`
3. **Automatizar sincronización**: Trigger al modificar componentes

---

## 📞 INFORMACIÓN DE CONTACTO

- **Responsable**: Claude Code (Arquitecto de Software)
- **Propiedad**: Cabaña 10 (ID: `cabana10`)
- **Empresa**: `cv1Lb4HLBLvWvSyqYfRW`
- **Fecha inicio**: 2026-04-15
- **Fecha finalización**: 2026-04-15
- **Estado**: **CORRECCIÓN COMPLETADA EXITOSAMENTE** 🎉

---

*Documento actualizado automáticamente al completar cada fase*