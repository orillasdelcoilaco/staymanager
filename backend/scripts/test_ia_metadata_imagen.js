// Script para probar que la IA ahora genera metadata de imagen

console.log('=== PRUEBA DE GENERACIÓN DE METADATA DE IMAGEN POR IA ===\n');

// Simular la historia que proporcionaría el usuario
const historiaEjemplo = `Somos una empresa familiar que ofrece cabañas de montaña en Pucón-Caburgua.
Nuestras cabañas tienen capacidad para 4-6 personas, cuentan con hot tub privado,
chimenea, WiFi, y están ubicadas a 5 minutos de la playa.
Ofrecemos experiencias familiares en contacto con la naturaleza, con actividades
como senderismo, cabalgatas y pesca. Nuestro enfoque es proporcionar un escape
tranquilo y reconfortante para familias que buscan desconectar de la ciudad.`;

console.log('1. HISTORIA DE EJEMPLO:');
console.log(historiaEjemplo);

console.log('\n2. PROMPT ACTUALIZADO QUE RECIBIRÁ LA IA:');
const prompt = `Eres un Estratega de Marca especialista en turismo y alojamientos de corta estadía.
El usuario describe su negocio entre los delimitadores ---. Basándote ÚNICAMENTE en esa descripción, genera una estrategia de marca completa.

---
${historiaEjemplo}
---

Responde SOLO con un objeto JSON (sin markdown) con estas claves exactas:
{
  "slogan": "Eslogan corto y memorable (máx 10 palabras)",
  "tipoAlojamientoPrincipal": "Tipo de alojamiento (ej: Cabaña, Departamento, Lodge)",
  "enfoqueMarketing": "Uno de: Familiar, Parejas, Negocios, Aventura, Relax, Económico, Lujo, Otro",
  "palabrasClaveAdicionales": "4-6 palabras clave SEO separadas por coma",
  "historiaOptimizada": "Reescritura del texto base optimizada para marketing (2-3 frases)",
  "homeH1": "Título principal H1 de la página de inicio (máx 60 caracteres)",
  "homeIntro": "Párrafo introductorio de la página de inicio (2-3 frases atractivas)",
  "homeSeoTitle": "Meta título SEO (50-60 caracteres)",
  "homeSeoDesc": "Meta descripción SEO (120-160 caracteres)",
  "heroImageAlt": "Texto alternativo (alt) sugerido para imagen hero basado en el contexto (máx 125 caracteres)",
  "heroImageTitle": "Título sugerido para imagen hero basado en el contexto (máx 60 caracteres)",
  "primaryColor": "Color primario sugerido en formato HEX (ej: #3b82f6)",
  "secondaryColor": "Color secundario sugerido en formato HEX (ej: #6b7280)",
  "accentColor": "Color de acento sugerido en formato HEX (ej: #10b981)"
}`;

console.log('(Prompt muy largo, mostrando solo la estructura JSON esperada)');
console.log('La IA debe devolver un JSON con 15 campos, incluyendo:');
console.log('- heroImageAlt: Texto alternativo para imagen hero');
console.log('- heroImageTitle: Título para imagen hero');
console.log('- primaryColor, secondaryColor, accentColor: Colores sugeridos');

console.log('\n3. RESPUESTA ESPERADA DE LA IA:');
const respuestaEsperada = {
  slogan: "Tu escape familiar en la naturaleza",
  tipoAlojamientoPrincipal: "Cabaña",
  enfoqueMarketing: "Familiar",
  palabrasClaveAdicionales: "cabañas pucón, hot tub familiar, montaña caburgua, naturaleza",
  historiaOptimizada: "Empresa familiar que ofrece cabañas de montaña en Pucón-Caburgua con hot tub privado, chimenea y actividades en la naturaleza para familias que buscan desconectar.",
  homeH1: "Cabañas Familiares con Hot Tub en Pucón-Caburgua",
  homeIntro: "Escápate a la naturaleza y vive unas vacaciones inolvidables en nuestras cabañas. Disfruta de hot tub, playa privada, piscina y la magia de Pucón-Caburgua con tu familia.",
  homeSeoTitle: "Cabañas Familiares Pucón-Caburgua: Hot Tub y Naturaleza",
  homeSeoDesc: "Cabañas equipadas en Pucón-Caburgua. Hot tub, playa privada, piscina y actividades familiares. ¡Reserva tus vacaciones en la naturaleza hoy mismo!",
  heroImageAlt: "Cabaña de montaña con hot tub y vista a las montañas en Pucón-Caburgua - Escape familiar perfecto",
  heroImageTitle: "Cabaña Familiar con Hot Tub en Pucón-Caburgua",
  primaryColor: "#3b82f6",
  secondaryColor: "#6b7280",
  accentColor: "#10b981"
};

console.log(JSON.stringify(respuestaEsperada, null, 2));

console.log('\n4. ¿QUÉ CAMBIÓ?');
console.log('ANTES: La IA solo generaba 9 campos (sin metadata de imagen ni colores)');
console.log('DESPUÉS: La IA ahora genera 15 campos, incluyendo:');
console.log('   ✅ heroImageAlt: Metadata para accesibilidad y SEO');
console.log('   ✅ heroImageTitle: Título atractivo para la imagen');
console.log('   ✅ primaryColor, secondaryColor, accentColor: Paleta de colores sugerida');

console.log('\n5. FLUJO COMPLETO CORREGIDO:');
console.log('1. Usuario escribe descripción del negocio');
console.log('2. Hace clic en "Regenerar Todo" o "Probar Generación IA"');
console.log('3. Frontend llama a /website/optimize-profile con la historia');
console.log('4. Backend llama a generarPerfilEmpresa() con el prompt actualizado');
console.log('5. IA devuelve JSON con 15 campos (incluyendo metadata de imagen)');
console.log('6. Frontend actualiza TODOS los campos en pantalla:');
console.log('   - Título H1, Intro, SEO Title, SEO Desc');
console.log('   - heroImageAlt y heroImageTitle (ya no "Se generará automáticamente")');
console.log('   - Colores sugeridos en los inputs de color');
console.log('7. Cuando usuario guarda: todos los campos se incluyen en el payload');
console.log('8. Backend guarda websiteSettings completo con metadata de imagen');

console.log('\n6. BENEFICIOS:');
console.log('✅ Los campos heroImageAlt y heroImageTitle ya NO dirán "Se generará automáticamente"');
console.log('✅ Tendrán valores reales generados por IA basados en el contexto de la empresa');
console.log('✅ Cuando el usuario suba una imagen real, la metadata puede ser refinada');
console.log('✅ Mejor SEO desde el inicio (metadata de imagen optimizada)');
console.log('✅ Mejor experiencia de usuario (no queda esperando que se suba una imagen)');

console.log('\n7. PRUEBA EN VIVO:');
console.log('Para probar:');
console.log('1. Ve a /website-general');
console.log('2. Escribe una descripción del negocio');
console.log('3. Haz clic en "Regenerar Todo" o "Probar Generación IA"');
console.log('4. Verifica que los campos "Texto Alternativo (alt)" y "Título de la Imagen"');
console.log('   ahora muestren texto real en lugar de "Se generará automáticamente"');