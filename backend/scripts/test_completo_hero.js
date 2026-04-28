/**
 * Script de prueba completo para el flujo de metadata de imágenes hero
 */

console.log('=== PRUEBA COMPLETA DE METADATA DE IMÁGENES HERO ===\n');

console.log('1. PROBLEMA IDENTIFICADO:');
console.log('   Frontend muestra: "Se generará automáticamente al subir la imagen"');
console.log('   Esto significa que theme.heroImageAlt y theme.heroImageTitle están vacíos\n');

console.log('2. CAUSAS POSIBLES:');
console.log('   a) El endpoint /upload-hero-image no genera metadata');
console.log('   b) La metadata generada está vacía');
console.log('   c) La metadata no se guarda en DB');
console.log('   d) La metadata se guarda pero no se retorna');
console.log('   e) Frontend no actualiza la UI\n');

console.log('3. CAMBIOS IMPLEMENTADOS:');
console.log('   ✅ Multer: upload.single() → upload.any() (para parsear campos)');
console.log('   ✅ Logs detallados en backend y frontend');
console.log('   ✅ Validación de metadata no vacía');
console.log('   ✅ Valores por defecto si metadata está vacía');
console.log('   ✅ Manejo de errores mejorado\n');

console.log('4. FLUJO CORREGIDO:');
console.log('   a) Frontend sube imagen (sin enviar altText/titleText vacíos)');
console.log('   b) Backend recibe archivo y campos (altText/titleText = undefined)');
console.log('   c) Backend detecta !finalAlt || !finalTitle → true');
console.log('   d) Backend obtiene contexto corporativo con getEmpresaContext()');
console.log('   e) Backend genera metadata con generarMetadataImagenConContexto()');
console.log('   f) Backend valida que metadata no esté vacía');
console.log('   g) Backend usa valores por defecto si metadata está vacía');
console.log('   h) Backend guarda en DB con actualizarDetallesEmpresa()');
console.log('   i) Backend retorna respuesta con metadata');
console.log('   j) Frontend actualiza #content-hero-alt y #content-hero-title\n');

console.log('5. PARA PROBAR:');
console.log('   a) Abrir DevTools (F12) → Console tab');
console.log('   b) Ir a configuración web → Subir imagen hero');
console.log('   c) Verificar logs en Console (deberían empezar con [FRONTEND DEBUG])');
console.log('   d) Verificar Network tab → filtrar por "upload-hero-image"');
console.log('   e) Verificar respuesta del endpoint');
console.log('   f) Verificar que la metadata se muestra en la página\n');

console.log('6. LOGS ESPERADOS EN CONSOLE (Frontend):');
console.log('   [FRONTEND DEBUG] renderUnified llamado con empresaData: ...');
console.log('   [FRONTEND DEBUG] Datos para render:');
console.log('     - theme.heroImageAlt: (vacío inicialmente)');
console.log('     - theme.heroImageTitle: (vacío inicialmente)');
console.log('   [FRONTEND DEBUG] Enviando imagen hero...');
console.log('   [FRONTEND DEBUG] Respuesta recibida: { ... }');
console.log('   [FRONTEND DEBUG] Actualizando metadata hero:');
console.log('     - heroImageAlt en respuesta: "Texto generado por IA"');
console.log('     - heroImageTitle en respuesta: "Título generado por IA"');
console.log('     - Actualizando altElement: true');
console.log('     - Actualizando titleElement: true\n');

console.log('7. LOGS ESPERADOS EN BACKEND:');
console.log('   [DEBUG upload-hero-image] Recibiendo solicitud: { ... }');
console.log('   [DEBUG upload-hero-image] Archivo recibido: { ... }');
console.log('   [DEBUG upload-hero-image] Valores iniciales: { finalAlt: undefined, finalTitle: undefined, shouldGenerate: true }');
console.log('   [DEBUG upload-hero-image] Metadata retornada por IA: { altText: "...", title: "...", advertencia: null }');
console.log('   [DEBUG upload-hero-image] AltText asignado: "..." (X caracteres)');
console.log('   [DEBUG upload-hero-image] Title asignado: "..." (X caracteres)');
console.log('   [DEBUG upload-hero-image] Valores finales para guardar: { alt: "...", title: "...", url: "..." }');
console.log('   [DEBUG upload-hero-image] Guardando en DB: { ... }');
console.log('   [DEBUG upload-hero-image] Guardado en DB exitoso');
console.log('   [DEBUG upload-hero-image] Retornando respuesta: { ... }\n');

console.log('8. RESPUESTA ESPERADA DEL ENDPOINT:');
console.log('   {');
console.log('     "websiteSettings.theme.heroImageUrl": "https://storage.googleapis.com/...",');
console.log('     "websiteSettings.theme.heroImageAlt": "Texto alternativo generado",');
console.log('     "websiteSettings.theme.heroImageTitle": "Título generado"');
console.log('   }\n');

console.log('9. SI LOS LOGS NO APARECEN:');
console.log('   a) Verificar que el backend está corriendo');
console.log('   b) Verificar que los cambios se han guardado (git status)');
console.log('   c) Verificar que no hay errores de JavaScript en Console');
console.log('   d) Verificar Network tab para ver si el request se está enviando\n');

console.log('10. SI LA METADATA SIGUE VACÍA:');
console.log('   a) Revisar logs [DEBUG upload-hero-image] Metadata retornada por IA');
console.log('   b) Verificar si altText y title están vacíos en la metadata');
console.log('   c) Verificar si getEmpresaContext() retorna datos');
console.log('   d) Verificar si generarMetadataImagenConContexto() está fallando');
console.log('   e) Verificar el fallback a generarMetadataImagen()\n');

console.log('=== INSTRUCCIONES DE DEPURACIÓN ===\n');

console.log('Paso 1: Abrir Console en DevTools');
console.log('Paso 2: Subir imagen hero');
console.log('Paso 3: Compartir los logs que aparecen (especialmente si hay errores)');
console.log('Paso 4: Compartir screenshot de Network tab (response del endpoint)');
console.log('Paso 5: Compartir logs del backend si es posible\n');

console.log('=== NOTAS FINALES ===');
console.log('- Los cambios están en:');
console.log('  • backend/api/ssr/config.routes.js (endpoint /upload-hero-image)');
console.log('  • frontend/src/views/components/configurarWebPublica/webPublica.general.unified.js');
console.log('- Se agregaron logs detallados en ambos lados');
console.log('- Se agregó validación para metadata no vacía');
console.log('- Se agregaron valores por defecto como fallback');
console.log('- El problema debería estar resuelto ahora');