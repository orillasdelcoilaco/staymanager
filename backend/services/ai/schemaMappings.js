/**
 * backend/services/ai/schemaMappings.js
 *
 * Mapeos de tipos de espacios y activos a Schema.org
 */

const SPACE_TO_SCHEMA = {
    // Dormitorios
    'dormitorio': 'Bedroom',
    'dormitorio principal': 'Bedroom',
    'dormitorio matrimonial': 'Bedroom',
    'dormitorio suite': 'Bedroom',
    'dormitorio camas individuales': 'Bedroom',
    'dormitorio camas plaza y media': 'Bedroom',

    // Baños
    'baño': 'Bathroom',
    'baño principal': 'Bathroom',
    'baño en suite': 'Bathroom',
    'baño de visitas': 'Bathroom',
    'baño compartido': 'Bathroom',

    // Cocina y comedor
    'cocina': 'Kitchen',
    'cocina equipada': 'Kitchen',
    'cocina americana': 'Kitchen',
    'comedor': 'DiningRoom',
    'comedor diario': 'DiningRoom',

    // Living y áreas sociales
    'living': 'LivingRoom',
    'sala de estar': 'LivingRoom',
    'sala de tv': 'LivingRoom',
    'estar': 'LivingRoom',

    // Exteriores
    'terraza': 'Terrace',
    'terraza cubierta': 'Terrace',
    'galería': 'Terrace',
    'balcón': 'Balcony',
    'patio': 'OutdoorArea',
    'jardín': 'OutdoorArea',

    // Estacionamiento
    'estacionamiento': 'ParkingFacility',
    'garaje': 'ParkingFacility',
    'cochera': 'ParkingFacility',

    // Áreas especiales
    'tinaja': 'HotTub',
    'jacuzzi': 'HotTub',
    'sauna': 'Sauna',
    'gimnasio': 'ExerciseRoom',
    'lavandería': 'LaundryRoom',
    'oficina': 'Workspace',

    // Default
    'default': 'Room'
};

const AMENITY_SCHEMA_TYPES = {
    // Tipos específicos para amenidades
    'tv smart': 'LocationFeatureSpecification',
    'wifi': 'LocationFeatureSpecification',
    'hidromasaje': 'Thing',
    'parrilla': 'Thing',
    'piscina': 'Thing',
    'quincho': 'Thing',
    'vista': 'LocationFeatureSpecification',
    'aire acondicionado': 'LocationFeatureSpecification',
    'calefacción': 'LocationFeatureSpecification',
    'caja fuerte': 'LocationFeatureSpecification'
};

/**
 * Convierte un espacio a objeto Schema.org containsPlace
 */
function spaceToContainsPlace(space) {
    const schemaType = SPACE_TO_SCHEMA[space.categoria?.toLowerCase()] ||
                      SPACE_TO_SCHEMA[space.nombre?.toLowerCase()] ||
                      SPACE_TO_SCHEMA.default;

    const result = {
        '@type': schemaType,
        'name': space.nombre
    };

    // Agregar descripción si existe
    if (space.descripcion && space.descripcion !== 'Otros') {
        result.description = space.descripcion;
    }

    // Para dormitorios, agregar detalles de camas si existen
    if (schemaType === 'Bedroom' && space.activos) {
        const camas = space.activos.filter(a =>
            a.nombre.toLowerCase().includes('cama') ||
            a.tipo?.toLowerCase().includes('cama')
        );

        if (camas.length > 0) {
            result.bed = {
                '@type': 'BedDetails',
                'numberOfBeds': camas.length,
                'type': camas[0].nombre.includes('Queen') ? 'QueenBed' :
                       camas[0].nombre.includes('King') ? 'KingBed' :
                       'SingleBed'
            };
        }
    }

    return result;
}

/**
 * Convierte una lista de espacios a containsPlace
 */
function spacesToContainsPlace(spaces = []) {
    return spaces.map(spaceToContainsPlace);
}

/**
 * Determina el schema type principal según tipo de negocio.
 * Si cambias `type` o `additionalType`, amplía `backend/services/jsonLdLodgingTypes.js` (falla CI: `npm run test:house-rules-jsonld`).
 */
function getMainSchemaType(tipoNegocio) {
    switch (tipoNegocio) {
        case 'hotel':
            return { type: 'Hotel', additionalType: null };
        case 'cartera':
            return { type: ['Accommodation', 'Product'], additionalType: 'https://schema.org/VacationRental' };
        case 'complejo':
        default:
            return { type: 'LodgingBusiness', additionalType: null };
    }
}

/**
 * Valida si un JSON-LD tiene la estructura correcta
 */
function validateJsonLd(jsonLd, tipoNegocio) {
    const errors = [];

    if (!jsonLd['@context'] || jsonLd['@context'] !== 'https://schema.org') {
        errors.push('Falta @context o no es https://schema.org');
    }

    const expectedType = getMainSchemaType(tipoNegocio);
    const actualType = jsonLd['@type'];

    if (Array.isArray(expectedType.type)) {
        if (!Array.isArray(actualType) || !expectedType.type.every(t => actualType.includes(t))) {
            errors.push(`@type debería ser ${JSON.stringify(expectedType.type)} pero es ${JSON.stringify(actualType)}`);
        }
    } else if (actualType !== expectedType.type) {
        errors.push(`@type debería ser "${expectedType.type}" pero es "${actualType}"`);
    }

    if (!jsonLd.name) errors.push('Falta campo "name"');
    if (!jsonLd.description) errors.push('Falta campo "description"');
    if (!jsonLd.address) errors.push('Falta campo "address"');
    if (!jsonLd.occupancy) errors.push('Falta campo "occupancy"');

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    SPACE_TO_SCHEMA,
    AMENITY_SCHEMA_TYPES,
    spaceToContainsPlace,
    spacesToContainsPlace,
    getMainSchemaType,
    validateJsonLd
};