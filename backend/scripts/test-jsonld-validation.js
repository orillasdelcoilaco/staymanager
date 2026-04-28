/**
 * backend/scripts/test-jsonld-validation.js
 *
 * Script para probar la validación de JSON-LD según tipo de negocio
 */

const { getMainSchemaType, validateJsonLd, spacesToContainsPlace } = require('../services/ai/schemaMappings');

console.log('=== PRUEBA DE VALIDACIÓN JSON-LD ===\n');

// Ejemplo 1: Complejo Turístico
console.log('1. COMPLEJO TURÍSTICO (tipoNegocio: "complejo"):');
const jsonLdComplejo = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "name": "Complejo Las Araucarias",
    "description": "Complejo turístico en Pucón con cabañas de lujo",
    "address": {
        "@type": "PostalAddress",
        "addressLocality": "Pucón",
        "addressRegion": "Región de la Araucanía",
        "addressCountry": "Chile"
    },
    "occupancy": {
        "@type": "QuantitativeValue",
        "value": 6
    }
};

const validationComplejo = validateJsonLd(jsonLdComplejo, 'complejo');
console.log('JSON:', JSON.stringify(jsonLdComplejo, null, 2));
console.log('Validación:', validationComplejo.isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO');
if (!validationComplejo.isValid) console.log('Errores:', validationComplejo.errors);
console.log('Schema Type esperado:', getMainSchemaType('complejo'));
console.log('---\n');

// Ejemplo 2: Cartera de Departamentos
console.log('2. CARTERA DE DEPARTAMENTOS (tipoNegocio: "cartera"):');
const jsonLdCartera = {
    "@context": "https://schema.org",
    "@type": ["Accommodation", "Product"],
    "additionalType": "https://schema.org/VacationRental",
    "name": "Departamento Centro Pucón",
    "description": "Departamento completamente equipado en el centro de Pucón",
    "address": {
        "@type": "PostalAddress",
        "addressLocality": "Pucón",
        "addressRegion": "Región de la Araucanía",
        "addressCountry": "Chile"
    },
    "occupancy": {
        "@type": "QuantitativeValue",
        "value": 4
    },
    "numberOfBedrooms": 2,
    "numberOfBathroomsTotal": 1
};

const validationCartera = validateJsonLd(jsonLdCartera, 'cartera');
console.log('JSON:', JSON.stringify(jsonLdCartera, null, 2));
console.log('Validación:', validationCartera.isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO');
if (!validationCartera.isValid) console.log('Errores:', validationCartera.errors);
console.log('Schema Type esperado:', getMainSchemaType('cartera'));
console.log('---\n');

// Ejemplo 3: Hotel
console.log('3. HOTEL (tipoNegocio: "hotel"):');
const jsonLdHotel = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    "name": "Hotel Pucón",
    "description": "Hotel 4 estrellas en el centro de Pucón",
    "address": {
        "@type": "PostalAddress",
        "addressLocality": "Pucón",
        "addressRegion": "Región de la Araucanía",
        "addressCountry": "Chile"
    },
    "occupancy": {
        "@type": "QuantitativeValue",
        "value": 2
    }
};

const validationHotel = validateJsonLd(jsonLdHotel, 'hotel');
console.log('JSON:', JSON.stringify(jsonLdHotel, null, 2));
console.log('Validación:', validationHotel.isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO');
if (!validationHotel.isValid) console.log('Errores:', validationHotel.errors);
console.log('Schema Type esperado:', getMainSchemaType('hotel'));
console.log('---\n');

// Ejemplo 4: containsPlace
console.log('4. PRUEBA DE CONTAINS PLACE:');
const espaciosEjemplo = [
    { nombre: "Dormitorio Principal", categoria: "dormitorio", descripcion: "Suite con baño privado" },
    { nombre: "Dormitorio Matrimonial", categoria: "dormitorio", descripcion: "Dormitorio" },
    { nombre: "Baño", categoria: "baño", descripcion: "Baño completo" },
    { nombre: "Cocina", categoria: "cocina", descripcion: "Cocina equipada" },
    { nombre: "Living", categoria: "living", descripcion: "Sala de estar" },
    { nombre: "Terraza", categoria: "terraza", descripcion: "Terraza con vista" }
];

const containsPlace = spacesToContainsPlace(espaciosEjemplo);
console.log('Espacios:', JSON.stringify(espaciosEjemplo, null, 2));
console.log('ContainsPlace generado:', JSON.stringify(containsPlace, null, 2));
console.log('---\n');

// Ejemplo 5: JSON actual de Cabaña 7 (para comparar)
console.log('5. ANÁLISIS DEL JSON ACTUAL DE "CABAÑA 7":');
const jsonActualCabaña7 = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "name": "Cabaña 7",
    "description": "Disfruta de una experiencia inolvidable en nuestra cabaña en Pucón...",
    "image": ["https://.../foto1.webp", "https://.../foto2.webp"],
    "address": {
        "addressRegion": "Región de la Araucanía",
        "addressCountry": "Chile",
        "addressLocality": "Pucón"
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
    "containsPlace": [
        { "name": "Dormitorio Principal en Suite", "@type": "Bedroom", "description": "Dormitorio en Suite" },
        { "name": "Baño", "@type": "Room", "description": "Otros" },
        { "name": "Cocina", "@type": "Room", "description": "Otros" }
    ],
    "numberOfRooms": 3,
    "amenityFeature": [
        { "name": "TV Smart", "@type": "LocationFeatureSpecification", "value": true, "description": "TV Smart con acceso a aplicaciones de streaming..." }
    ]
};

console.log('Problemas identificados en el JSON actual:');
console.log('1. "@type": "LodgingBusiness" → ¿Es correcto? Depende del tipoNegocio');
console.log('2. "numberOfRooms": 3 → Debería ser "numberOfBedrooms": 3');
console.log('3. "containsPlace" con "@type": "Room" → Deberían ser tipos específicos (Bathroom, Kitchen, etc.)');
console.log('4. Faltan campos: "numberOfBathroomsTotal", "priceRange", "telephone", etc.');

// Validar según diferentes tipos de negocio
console.log('\nValidación según diferentes tipos de negocio:');
console.log('a) Si tipoNegocio = "complejo":', validateJsonLd(jsonActualCabaña7, 'complejo').isValid ? '✅' : '❌');
console.log('b) Si tipoNegocio = "cartera":', validateJsonLd(jsonActualCabaña7, 'cartera').isValid ? '✅' : '❌');
console.log('c) Si tipoNegocio = "hotel":', validateJsonLd(jsonActualCabaña7, 'hotel').isValid ? '✅' : '❌');

console.log('\n=== FIN DE LA PRUEBA ===');