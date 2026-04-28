/**
 * backend/scripts/regenerate-cabana9-jsonld.js
 *
 * Regenera el JSON-LD para Cabaña 9 con las correcciones implementadas
 * Asume tipoNegocio: "complejo" (complejo turístico)
 */

const { getMainSchemaType, spacesToContainsPlace } = require('../services/ai/schemaMappings');
const { validateJsonLd } = require('../services/ai/schemaMappings');

console.log('=== REGENERACIÓN DE JSON-LD PARA CABAÑA 9 ===\n');

// Datos extraídos del JSON proporcionado
const empresaData = {
    nombre: "Complejo Turístico (nombre de empresa)",
    tipoNegocio: "complejo", // Asumido - ¡VERIFICAR ESTO!
    contactoTelefono: "+56 9 XXXX XXXX", // Faltante en JSON original
    ubicacion: {
        ciudad: "Pucón",
        region: "Región de la Araucanía",
        pais: "Chile",
        lat: -39.270271,
        lng: -71.784067
    }
};

// Espacios de Cabaña 9 (extraídos del containsPlace original)
const espaciosCabaña9 = [
    { nombre: "Dormitorio Principal en Suite", categoria: "dormitorio", descripcion: "Dormitorio en Suite" },
    { nombre: "Cocina", categoria: "cocina", descripcion: "Cocina equipada" },
    { nombre: "Baño", categoria: "baño", descripcion: "Baño completo" },
    { nombre: "Comedor", categoria: "comedor", descripcion: "Comedor" },
    { nombre: "Living", categoria: "living", descripcion: "Sala de estar" },
    { nombre: "Terraza", categoria: "terraza", descripcion: "Terraza Cubierta / Galería Exterior" },
    { nombre: "Tinaja", categoria: "tinaja", descripcion: "Tina Caliente de Hidroterapia (Hot Tub)" },
    { nombre: "Estacionamiento", categoria: "estacionamiento", descripcion: "Estacionamiento privado" },
    { nombre: "Dormitorio Matrimonial", categoria: "dormitorio", descripcion: "Dormitorio" },
    { nombre: "Dormitorio Camas de Plaza y Media", categoria: "dormitorio", descripcion: "Dormitorio" }
];

// Amenidades (corregidas)
const amenidades = [
    {
        nombre: "TV Smart",
        schema_type: "LocationFeatureSpecification",
        description: "TV Smart con acceso a aplicaciones de streaming y alta definición."
    },
    {
        nombre: "Ducha Con Hidromasaje",
        schema_type: "LocationFeatureSpecification",
        description: "Ducha con hidromasaje para relajarte"
    },
    {
        nombre: "Router Wifi",
        schema_type: "LocationFeatureSpecification",
        description: "Conexión a internet rápida y segura a través de nuestro Wifi Router"
    },
    {
        nombre: "Silla De Terraza",
        schema_type: "LocationFeatureSpecification",
        description: "Sillas de terraza para disfrutar del exterior"
    },
    {
        nombre: "Terraza Con Mesa",
        schema_type: "LocationFeatureSpecification",
        description: "Disfruta de un espacio exterior con mesa para relajarte"
    },
    {
        nombre: "Parrilla de Obra o Módulo BBQ",
        schema_type: "LocationFeatureSpecification",
        description: "Parrilla de obra con sistema de elevación para disfrutar de barbacoas al aire libre"
    },
    {
        nombre: "Bañera de Hidromasaje",
        schema_type: "Thing",
        description: "Disfrute de una relajante bañera de hidromasaje al aire libre con capacidad para 4 personas."
    }
    // NOTA: Piscina y Quincho REMOVIDOS - son áreas comunes compartidas
];

// Imágenes (limitadas a 8 para SEO)
const imagenes = [
    "https://firebasestorage.googleapis.com/v0/b/suite-manager-app.firebasestorage.app/o/empresas%2Fcv1Lb4HLBLvWvSyqYfRW%2Fpropiedades%2Fcabana9%2Fgaleria%2F41a6df4c-2cc3-4b61-9726-6b29b4d57855.webp?alt=media&token=12b003ca-876b-470c-b542-c483e629d37d",
    "https://firebasestorage.googleapis.com/v0/b/suite-manager-app.firebasestorage.app/o/empresas%2Fcv1Lb4HLBLvWvSyqYfRW%2Fpropiedades%2Fcabana9%2Fgaleria%2F665d40a3-987e-41b2-95e5-ee9f91830e26.webp?alt=media&token=fdd872a2-f4a0-4702-bc9f-341d02014699",
    "https://firebasestorage.googleapis.com/v0/b/suite-manager-app.firebasestorage.app/o/empresas%2Fcv1Lb4HLBLvWvSyqYfRW%2Fpropiedades%2Fcabana9%2Fgaleria%2F25162b55-066f-42bd-b4cf-41b20080c529.webp?alt=media&token=9921630e-690a-4c56-b9e5-1d0eccc9ae93",
    "https://firebasestorage.googleapis.com/v0/b/suite-manager-app.firebasestorage.app/o/empresas%2Fcv1Lb4HLBLvWvSyqYfRW%2Fpropiedades%2Fcabana9%2Fgaleria%2F98e9567e-14f5-43fa-b810-2a37a866c361.webp?alt=media&token=9c7b1f39-8da4-4fb6-b487-dc19e75153f3",
    "https://firebasestorage.googleapis.com/v0/b/suite-manager-app.firebasestorage.app/o/empresas%2Fcv1Lb4HLBLvWvSyqYfRW%2Fpropiedades%2Fcabana9%2Fgaleria%2F88b6567b-183a-45cf-85b6-c5c423daa478.webp?alt=media&token=c7446a5e-2207-42ff-93f8-71324ad2d2cb",
    "https://firebasestorage.googleapis.com/v0/b/suite-manager-app.firebasestorage.app/o/empresas%2Fcv1Lb4HLBLvWvSyqYfRW%2Fpropiedades%2Fcabana9%2Fgaleria%2Fde96c08d-85ac-4845-8f34-834d0d9d4fb5.webp?alt=media&token=aa5f15f7-5a17-41e3-a551-af696f72e536",
    "https://firebasestorage.googleapis.com/v0/b/suite-manager-app.firebasestorage.app/o/empresas%2Fcv1Lb4HLBLvWvSyqYfRW%2Fpropiedades%2Fcabana9%2Fgaleria%2F6b70ddea-dad6-492c-b742-41796d3185f8.webp?alt=media&token=e193461c-3add-4de0-920b-60e89c84dd3c",
    "https://firebasestorage.googleapis.com/v0/b/suite-manager-app.firebasestorage.app/o/empresas%2Fcv1Lb4HLBLvWvSyqYfRW%2Fpropiedades%2Fcabana9%2Fgaleria%2Fc29a83fd-03cf-4b1f-bdca-94b6d5400c91.webp?alt=media&token=dd5d7667-f341-4dcc-871d-17c0601d6089"
];

// Generar containsPlace corregido
const containsPlace = spacesToContainsPlace(espaciosCabaña9);

// Determinar schema type
const schemaInfo = getMainSchemaType(empresaData.tipoNegocio);

// Generar JSON-LD corregido
const jsonLdCorregido = {
    "@context": "https://schema.org",
    "@type": schemaInfo.type,
    ...(schemaInfo.additionalType && { "additionalType": schemaInfo.additionalType }),
    "name": "Cabaña 9",
    "description": "Disfruta de una experiencia inolvidable en nuestra cabaña en Pucón, rodeada de naturaleza y con todos los confortes para una estancia perfecta. Nuestra cabaña cuenta con 3 dormitorios, cocina equipada y terraza con parrilla y tinaja para relajarte.",

    // Address CORREGIDO: streetAddress solo si es dirección específica
    "address": {
        "@type": "PostalAddress",
        // "streetAddress": OMITIDO - no es una dirección específica de calle
        "addressLocality": "Pucón",
        "addressRegion": "Región de la Araucanía",
        "addressCountry": "Chile"
    },

    "geo": {
        "@type": "GeoCoordinates",
        "latitude": -39.270271,
        "longitude": -71.784067
    },

    "occupancy": {
        "@type": "QuantitativeValue",
        "value": 6
    },

    "numberOfBedrooms": 3,
    "numberOfBathroomsTotal": 1,

    // ContainsPlace CORREGIDO (tipos específicos)
    "containsPlace": containsPlace,

    // AmenityFeature CORREGIDO
    "amenityFeature": amenidades.map(amenidad => ({
        "@type": amenidad.schema_type,
        "name": amenidad.nombre,
        "value": true,
        "description": amenidad.description
    })),

    // Campos adicionales REQUERIDOS
    "priceRange": "$$$", // Basado en tarifas reales
    "telephone": empresaData.contactoTelefono,
    "checkinTime": "15:00",
    "checkoutTime": "11:00",
    "petsAllowed": false,

    // Imágenes limitadas a 8
    "image": imagenes
};

// Validar el JSON-LD generado
console.log('=== VALIDACIÓN DEL JSON-LD GENERADO ===\n');
const validation = validateJsonLd(jsonLdCorregido, empresaData.tipoNegocio);

console.log('¿JSON-LD válido?:', validation.isValid ? '✅ SÍ' : '❌ NO');
if (!validation.isValid) {
    console.log('Errores:', validation.errors);
}

console.log('\n=== COMPARACIÓN CON JSON ORIGINAL ===\n');

console.log('MEJORAS APLICADAS:');
console.log('1. ✅ Schema type dinámico según tipoNegocio:', schemaInfo.type);
console.log('2. ✅ streetAddress corregido (omitido porque no es dirección específica)');
console.log('3. ✅ containsPlace con tipos específicos (no genéricos "Room")');
console.log('4. ✅ Amenidades de áreas comunes REMOVIDAS (piscina, quincho)');
console.log('5. ✅ Campos adicionales agregados: priceRange, telephone, checkinTime, etc.');
console.log('6. ✅ Imágenes limitadas a 8 (de 35 originales)');

console.log('\n=== JSON-LD CORREGIDO ===\n');
console.log(JSON.stringify(jsonLdCorregido, null, 2));

console.log('\n=== NOTAS IMPORTANTES ===');
console.log('1. VERIFICAR tipoNegocio real de la empresa en configuración');
console.log('2. Si tipoNegocio = "cartera", cambiar @type a ["Accommodation", "Product"]');
console.log('3. Actualizar telephone con número real de contacto');
console.log('4. Ajustar priceRange según tarifas reales ($$ = económico, $$$$ = lujo)');
console.log('5. Validar con Google Rich Results Test: https://search.google.com/test/rich-results');

// También generar versión alternativa para "cartera"
console.log('\n=== VERSIÓN ALTERNATIVA (si tipoNegocio = "cartera") ===');
const jsonLdCartera = {
    ...jsonLdCorregido,
    "@type": ["Accommodation", "Product"],
    "additionalType": "https://schema.org/VacationRental"
};
delete jsonLdCartera.containsPlace; // Para cartera, no necesita containsPlace

const validationCartera = validateJsonLd(jsonLdCartera, 'cartera');
console.log('¿JSON-LD válido para cartera?:', validationCartera.isValid ? '✅ SÍ' : '❌ NO');

console.log('\n=== RECOMENDACIÓN FINAL ===');
console.log('1. Verificar tipoNegocio en Configuración → Empresa');
console.log('2. Usar el JSON-LD apropiado según el tipo de negocio');
console.log('3. Regenerar automáticamente desde la UI (Contenido Web → Generar JSON-LD)');