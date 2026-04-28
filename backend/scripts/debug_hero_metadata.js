/**
 * Script para depurar el problema de metadata de imágenes hero
 */

console.log('=== DEPURACIÓN DE METADATA DE IMÁGENES HERO ===\n');

console.log('1. ANALIZANDO EL PROBLEMA:');
console.log('   - Frontend muestra: "Se generará automáticamente al subir la imagen"');
console.log('   - Esto ocurre cuando theme.heroImageAlt y theme.heroImageTitle están vacíos');
console.log('   - La metadata debería generarse al subir la imagen hero');
console.log('   - La metadata generada debería guardarse en websiteSettings.theme');
console.log('   - La metadata guardada debería mostrarse en el frontend\n');

console.log('2. POSIBLES CAUSAS:');
console.log('   a) El endpoint /upload-hero-image no está generando metadata');
console.log('   b) La metadata se genera pero no se guarda en DB');
console.log('   c) La metadata se guarda pero no se retorna en la respuesta');
console.log('   d) El frontend no está actualizando la UI con la respuesta');
console.log('   e) Multer no está parseando correctamente los campos del FormData\n');

console.log('3. CAMBIOS IMPLEMENTADOS:');
console.log('   ✅ Cambiado upload.single(\'heroImage\') a upload.any()');
console.log('   ✅ Agregados logs de depuración detallados');
console.log('   ✅ Mejorado manejo de errores en actualizarDetallesEmpresa');
console.log('   ✅ Verificación de campos req.body y req.files\n');

console.log('4. PARA PROBAR:');
console.log('   a) Subir una imagen hero en el frontend');
console.log('   b) Revisar logs del backend (deberían aparecer [DEBUG upload-hero-image])');
console.log('   c) Verificar en Network tab (devtools) la respuesta del endpoint');
console.log('   d) Verificar que la respuesta contenga:');
console.log('      - websiteSettings.theme.heroImageUrl');
console.log('      - websiteSettings.theme.heroImageAlt (NO vacío)');
console.log('      - websiteSettings.theme.heroImageTitle (NO vacío)\n');

console.log('5. LOGS ESPERADOS EN BACKEND:');
console.log('   [DEBUG upload-hero-image] Recibiendo solicitud: { ... }');
console.log('   [DEBUG upload-hero-image] Archivo recibido: { ... }');
console.log('   [DEBUG upload-hero-image] Valores iniciales: { ... }');
console.log('   [DEBUG upload-hero-image] Metadata generada con contexto corporativo: { ... }');
console.log('   [DEBUG upload-hero-image] Guardando en DB: { ... }');
console.log('   [DEBUG upload-hero-image] Guardado en DB exitoso');
console.log('   [DEBUG upload-hero-image] Retornando respuesta: { ... }\n');

console.log('6. SI LOS LOGS NO APARECEN:');
console.log('   a) Verificar que el endpoint se está llamando (Network tab)');
console.log('   b) Verificar que el backend está corriendo y recibiendo requests');
console.log('   c) Verificar que no hay errores de CORS o autenticación\n');

console.log('7. SI LA METADATA NO SE GENERA:');
console.log('   a) Verificar que getEmpresaContext() retorna datos');
console.log('   b) Verificar que generarMetadataImagenConContexto() no lanza errores');
console.log('   c) Verificar que altText y titleText son undefined/empty (para que se genere metadata)');
console.log('   d) Verificar el fallback a generarMetadataImagen()\n');

console.log('8. SI LA METADATA SE GENERA PERO NO SE MUESTRA:');
console.log('   a) Verificar la respuesta en Network tab');
console.log('   b) Verificar que el frontend actualiza #content-hero-alt y #content-hero-title');
console.log('   c) Verificar que los valores no son strings vacíos\n');

console.log('=== INSTRUCCIONES DE PRUEBA ===\n');

console.log('1. Abrir el navegador y acceder a la configuración web');
console.log('2. Abrir DevTools (F12) y ir a la pestaña Network');
console.log('3. Filtrar por "upload-hero-image"');
console.log('4. Subir una imagen hero');
console.log('5. Verificar la respuesta en Network tab');
console.log('6. Revisar logs del backend');
console.log('7. Si hay errores, compartir los logs para más análisis\n');

console.log('=== ESTRUCTURA ESPERADA DE RESPUESTA ===');
console.log('{');
console.log('  "websiteSettings.theme.heroImageUrl": "https://...",');
console.log('  "websiteSettings.theme.heroImageAlt": "Texto alternativo generado por IA",');
console.log('  "websiteSettings.theme.heroImageTitle": "Título generado por IA"');
console.log('}\n');

console.log('=== NOTAS FINALES ===');
console.log('- El problema original era que multer.single() no parsea campos no-archivo');
console.log('- Cambiamos a multer.any() para parsear tanto archivos como campos');
console.log('- Los campos altText y titleText ahora deberían llegar en req.body');
console.log('- Si vienen vacíos/undefined, se generará metadata automáticamente');
console.log('- La metadata ahora incluye contexto corporativo completo (historia, misión, valores, etc.)');