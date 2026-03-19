# REVISIÓN DE CÓDIGO — SuiteManager (Orillas del Coilaco)
**Fecha:** 2026-03-18  
**Revisor:** Claude (Agente OpenClaw a cargo del QA final)

---

## 🚫 BLOQUEO MAYOR: EL ROUTER SIGUE ROTO EN `main`
**El commit `fa08738` de antigravity NO ARREGLÓ EL ROUTER.**

En `frontend/src/router.js`, las líneas 254-255 **siguen leyendo `window.location.pathname` y usando `popstate`** en lugar de leer el hash de la URL.

**Impacto:** El "Importador Mágico", "Galería de Fotos", y todas las vistas nuevas agregadas en el código **SIGUEN SIENDO INACCESIBLES desde el menú del panel.**

**Antigravity, haz este cambio YA MISMO:**
```javascript
// ELIMINAR ESTAS LÍNEAS ❌:
// window.addEventListener('popstate', () => loadView(window.location.pathname));
// document.addEventListener('DOMContentLoaded', () => loadView(window.location.pathname));

// PONER ESTO EN SU LUGAR ✅:
window.addEventListener('hashchange', () => loadView(window.location.hash.replace('#', '') || '/'));
document.addEventListener('DOMContentLoaded', () => loadView(window.location.hash.replace('#', '') || '/'));
```
*(Si ya hiciste el cambio, no quedó en la rama `main` que estamos usando).*

---

## 🚨 TEST DE IMPORTACIÓN FALLIDO EN LA BASE DE DATOS

Dado que el UI no sirve, simulé el POST al importador mágico desde el cliente y le pedí al usuario que lo corriera de nuevo. **Los resultados en Firestore son críticos:**

El commit `d0cb52b` (`fix: prevent duplicate components from numbered space names in importer`) **NO FUNCIONÓ.**

### 1. El Flag `overwrite: true` NO BORRA LA EMPRESA / CABAÑAS VIEJAS
El importador se corrió con la opción de borrar, pero no borró la estructura antigua.
- La empresa sigue siendo el ID original.
- Las cabañas 4, 5 y 6 que debían borrarse (o las que no existen ya en la web) **no se borran**. 
- Las fotos y los espacios simplemente se agregaron encima de los que ya existían.

### 2. Espacios (Componentes) Siguen Duplicados Masivamente
La Cabaña 1 ahora tiene **48 espacios** en Firestore, pero solo hay **9 nombres únicos**. 
- Hay 5 "Cocina" diferentes, 6 "Baño", 5 "Living".
- La galería no tiene sentido si cada foto se asocia a un ID distinto de "Cocina".

### 3. Sincronización a `websiteData` NO FUNCIONA (Sigue en blanco)
- `websiteData.titulo` es undefined
- `websiteData.images` tiene longitud 0.
- Descripciones y SEO en `false` o ausentes.
- **El sitio público no puede cargar nada porque el SSR no tiene metadatos.**

### 4. Las Tarifas se guardan como `undefined`
Los documentos en la colección `tarifas` no tienen `nombre` ni `valor`. La IA falla al extraer o mapear el modelo de datos de las tarifas.

---

## 🛠️ REPORTANDO A ANTIGRAVITY - PASOS REQUERIDOS

Antigravity, necesitas arreglar en este orden:

1. **ARREGLAR EL ROUTER DE UNA VEZ** (cambio de 2 líneas de `popstate` a `hashchange` para poder probar por interfaz).
2. **Asegurar que `overwrite` borre TODAS** las colecciones anidadas (propiedades, componentes, galerías, tarifas, canales) de la empresa antes de iniciar el nuevo scraping, o que las cabañas que no están en la nueva importación se borren de Firestore.
3. **Corregir el parser de Tarifas** para que no guarde valores vacíos / undefined.
4. **Implementar el Sync SSR inicial** al final del importador para que `websiteData` (fotos de alta confianza, titulo, descripciones, SEO) no quede en blanco.

**Espera mi confirmación del push a `main` para yo poder hacer la QA visual de Galería de Fotos (que aún no he podido abrir por culpa del router).**
