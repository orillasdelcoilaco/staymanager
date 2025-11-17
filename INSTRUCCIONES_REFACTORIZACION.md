# 📋 Instrucciones para Refactorización de Código

## 🎯 Objetivo General

Mejorar la mantenibilidad del código aplicando refactorización **incremental** que respete la arquitectura existente del proyecto, sin introducir cambios radicales que puedan romper la funcionalidad actual.

---

## 🏗️ Arquitectura Actual (Que DEBE Respetarse)

El proyecto tiene una arquitectura modular establecida:

```
frontend/src/
├── api.js                    ← Cliente HTTP centralizado (NO modificar)
├── router.js                 ← Navegación SPA (NO modificar)
└── views/
    ├── [vista].js            ← Orquestador principal (ej: gestionDiaria.js)
    └── components/
        └── [vista]/          ← Componentes específicos de esa vista
            ├── [vista].cards.js    ← Renderizado de elementos
            ├── [vista].modals.js   ← Lógica de modales
            └── [vista].utils.js    ← Utilidades y helpers
```

**Ejemplo real que YA funciona:**

```
views/
├── gestionDiaria.js                      ← 500 líneas
└── components/
    └── gestionDiaria/
        ├── gestionDiaria.cards.js        ← Renderizado de tarjetas
        ├── gestionDiaria.modals.js       ← Modales (Ver, Editar, etc)
        └── gestionDiaria.utils.js        ← Formatters, helpers
```

---

## ✅ Principios de Refactorización (OBLIGATORIOS)

### 1. **Respetar la Arquitectura Existente**
- ❌ NO crear carpetas nuevas como `state/`, `services/api/`, `templates/`
- ❌ NO introducir gestores de estado (el proyecto NO usa React/Vue)
- ❌ NO crear clases base (`BaseComponent.js`) cuando usamos funciones puras
- ✅ SÍ seguir el patrón `views/components/[vista]/`

### 2. **Cambios Incrementales**
- ❌ NO entregar 14 archivos nuevos de una vez
- ✅ SÍ hacer refactorización paso por paso:
  1. Primero: Extraer utilidades (formatters)
  2. Segundo: Extraer renderizado de componentes
  3. Tercero: Extraer lógica de modales (si es necesario)

### 3. **Archivos Completos Siempre**
- ✅ Entregar SIEMPRE archivos completos, nunca fragmentos
- ✅ Incluir TODOS los archivos afectados por el cambio
- ✅ Mantener compatibilidad con el resto del sistema

### 4. **No Romper Funcionalidad Existente**
- ✅ La refactorización NO debe cambiar el comportamiento
- ✅ La UI debe verse y funcionar EXACTAMENTE igual
- ✅ Los imports deben funcionar sin cambios en otros archivos (excepto el refactorizado)

---

## 📐 Patrón de Refactorización a Seguir

### **Paso 1: Identificar el Archivo a Refactorizar**

Ejemplo: `gestionarReservas.js` (963 líneas)

### **Paso 2: Analizar Responsabilidades**

Identificar qué hace el archivo:
- ✅ Funciones de formateo (formatDate, formatCurrency, etc.) → **Extraer**
- ✅ Renderizado de componentes (tablas, cards) → **Extraer**
- ✅ Lógica de modales (Ver, Editar) → **Extraer** (opcional)
- ❌ Lógica de orquestación (afterRender, event listeners) → **Mantener en el archivo principal**

### **Paso 3: Crear Estructura de Componentes**

```bash
# Si NO existe la carpeta, crearla:
views/components/[nombreVista]/

# Ejemplo:
views/components/gestionarReservas/
```

### **Paso 4: Extraer Utilidades**

**Archivo:** `views/components/[vista]/[vista].utils.js`

**Contenido:** Funciones puras de formateo, validación, helpers

**Ejemplo:**
```javascript
// views/components/gestionarReservas/reservas.utils.js

export const formatDate = (dateString) => {
    // ... implementación
};

export const formatCurrency = (value) => {
    // ... implementación
};
```

**Modificar archivo principal:**
```javascript
// views/gestionarReservas.js

import { formatDate, formatCurrency } from './components/gestionarReservas/reservas.utils.js';

// ELIMINAR las funciones originales que ahora están en utils
```

### **Paso 5: Extraer Renderizado (Opcional)**

**Archivo:** `views/components/[vista]/[vista].cards.js` o `[vista].table.js`

**Contenido:** Funciones que retornan HTML (strings o elementos DOM)

**Ejemplo:**
```javascript
// views/components/gestionarReservas/reservas.table.js

import { formatDate, formatCurrency } from './reservas.utils.js';

export const renderTabla = (reservas, historialCargas) => {
    // Retornar HTML de la tabla
};
```

### **Paso 6: Extraer Modales (Solo si es Muy Grande)**

**Archivo:** `views/components/[vista]/[vista].modals.js`

**Contenido:** Funciones que gestionan modales (abrir, cerrar, validar)

---

## 🚫 NO Hacer (Anti-Patrones)

### ❌ NO Cambiar Paradigmas
```javascript
// ❌ INCORRECTO: Introducir clases cuando usamos funciones
class BaseComponent {
    constructor() { ... }
}

// ✅ CORRECTO: Mantener funciones puras
export const renderTabla = (data) => { ... };
```

### ❌ NO Duplicar Funcionalidad Existente
```javascript
// ❌ INCORRECTO: Crear un nuevo cliente API
// services/api/reservasApi.js
export const fetchReservas = async () => {
    return fetch('/api/reservas');
};

// ✅ CORRECTO: Usar el api.js existente
import { fetchAPI } from '../../api.js';
```

### ❌ NO Sobre-Ingeniería
```javascript
// ❌ INCORRECTO: Crear gestor de estado complejo
class ReservasState {
    constructor() {
        this.store = {};
        this.subscribers = [];
    }
}

// ✅ CORRECTO: Variables locales o parámetros
let reservas = [];
const renderTabla = (reservas) => { ... };
```

---

## ✅ Formato de Entrega Esperado

### **Entrega por Pasos (NO Todo de Una Vez)**

**PASO 1: Utilidades**
```
Archivos a entregar:
1. views/components/[vista]/[vista].utils.js (NUEVO - completo)
2. views/[vista].js (MODIFICADO - completo)

Cambios:
- Extraídas funciones de formateo a utils.js
- Agregado import en archivo principal
- Eliminadas funciones duplicadas

Reducción: ~70 líneas en archivo principal
```

**PASO 2: Renderizado**
```
Archivos a entregar:
1. views/components/[vista]/[vista].table.js (NUEVO - completo)
2. views/[vista].js (MODIFICADO - completo)

Cambios:
- Extraída lógica de renderizado a table.js
- Modificada función render para usar nuevo componente

Reducción: ~100 líneas en archivo principal
```

**PASO 3: Modales (OPCIONAL)**
```
Archivos a entregar:
1. views/components/[vista]/[vista].modals.js (NUEVO - completo)
2. views/[vista].js (MODIFICADO - completo)

Cambios:
- Extraída lógica de modales a modals.js
- Mantenida orquestación en archivo principal

Reducción: ~200-300 líneas en archivo principal
```

---

## 📊 Resultado Esperado

### ANTES
```
views/
└── gestionarReservas.js    (963 líneas)
```

### DESPUÉS
```
views/
├── gestionarReservas.js                 (~400 líneas)  ← Orquestador
└── components/
    └── gestionarReservas/
        ├── reservas.utils.js            (~70 líneas)   ← Utilidades
        ├── reservas.table.js            (~100 líneas)  ← Renderizado
        └── reservas.modals.js           (~300 líneas)  ← Modales (opcional)
```

**Funcionalidad:** EXACTAMENTE la misma
**Arquitectura:** Consistente con el resto del proyecto
**Mantenibilidad:** Mejorada significativamente

---

## 🎯 Criterios de Éxito

Una refactorización es exitosa si:

✅ **Funcionalidad Intacta**: El usuario NO nota ningún cambio
✅ **Arquitectura Consistente**: Sigue el patrón de `views/components/[vista]/`
✅ **Código Más Limpio**: Archivo principal reducido a ~50% de líneas
✅ **Fácil de Mantener**: Responsabilidades claramente separadas
✅ **Sin Regresiones**: Todas las funciones siguen funcionando
✅ **Imports Claros**: Rutas relativas correctas y sin errores

---

## 🚀 Proceso de Trabajo

### Al Solicitar Refactorización:

1. **Análisis Previo:**
```
Analiza el archivo [X.js] e identifica:
- Funciones de utilidad que se pueden extraer
- Lógica de renderizado que se puede modularizar
- Responsabilidades que están mezcladas

NO generes código todavía, solo el análisis.
```

2. **Plan de Refactorización:**
```
Propón un plan de refactorización en 2-3 pasos que:
- Respete la arquitectura actual (views/components/[vista]/)
- Sea incremental (paso por paso)
- No rompa funcionalidad existente

Espera mi aprobación antes de generar código.
```

3. **Implementación Paso a Paso:**
```
Implementa el Paso 1: Extraer utilidades

Dame COMPLETOS:
- El nuevo archivo utils.js
- El archivo principal modificado

Incluye instrucciones de cómo probar que funciona.
```

4. **Validación:**
```
Probado el Paso 1 exitosamente.
Continúa con el Paso 2: [siguiente paso]
```

---

## 💡 Ejemplos de Buenas vs Malas Refactorizaciones

### ❌ Mala Refactorización (Cambio Radical)

```
Propuesta: Crear 14 archivos nuevos con:
- state/reservasState.js
- services/api/reservasApi.js
- components/shared/BaseComponent.js
- templates/reservas/viewTemplate.js
...

Problemas:
- Cambia la arquitectura del proyecto
- Introduce conceptos nuevos innecesarios
- Requiere reescribir imports en múltiples archivos
- Alto riesgo de romper cosas
```

### ✅ Buena Refactorización (Incremental)

```
Paso 1: Extraer utilidades
- Crear: views/components/gestionarReservas/reservas.utils.js
- Modificar: views/gestionarReservas.js (agregar import)
- Reducción: 70 líneas

Beneficios:
- Sigue el patrón existente
- Cambio pequeño y verificable
- Fácil de revertir si hay problemas
- Bajo riesgo
```

---

## 📝 Template de Solicitud

Copia y pega esto cuando pidas una refactorización:

```
Necesito refactorizar el archivo: [NOMBRE_ARCHIVO.js]

CONTEXTO:
- Este archivo tiene [X] líneas y [Y] responsabilidades mezcladas
- Quiero seguir el patrón views/components/[vista]/ que ya existe en el proyecto

RESTRICCIONES:
1. NO cambiar la arquitectura del proyecto
2. NO introducir nuevas carpetas fuera de views/components/
3. NO usar clases, mantener funciones puras
4. NO romper funcionalidad existente
5. Entregar archivos COMPLETOS siempre

PROCESO:
1. Analiza el archivo e identifica qué extraer
2. Propón un plan de 2-3 pasos (espera mi aprobación)
3. Implementa paso por paso cuando yo lo solicite
4. Dame instrucciones de cómo probar cada paso

RESULTADO ESPERADO:
- Archivo principal: ~50% de líneas originales
- Nuevos archivos en: views/components/[vista]/
- Funcionalidad: EXACTAMENTE igual que antes
```

---

## 🎓 Filosofía del Proyecto

> **"Refactorización no significa reescribir. Significa mejorar lo existente sin romper lo que funciona."**

Principios:
- ✅ Evolución gradual sobre revolución radical
- ✅ Consistencia sobre novedad
- ✅ Simplicidad sobre sofisticación
- ✅ Funcionalidad sobre arquitectura perfecta

---

## ✋ Cuándo Decir "NO" a una Refactorización

Rechaza si propone:
- ❌ Crear más de 5 archivos nuevos de una vez
- ❌ Introducir librerías o frameworks nuevos
- ❌ Cambiar de paradigma (funcional → OOP, vanilla → framework)
- ❌ Modificar archivos core (api.js, router.js) sin razón
- ❌ "Reescribir desde cero"

En su lugar, pide:
- ✅ Plan incremental de 2-3 pasos
- ✅ Primero análisis, luego código
- ✅ Un paso a la vez
- ✅ Archivos completos por paso

---

**Última actualización:** Noviembre 2025  
**Versión:** 1.0  
**Mantenedor:** [Tu nombre/equipo]