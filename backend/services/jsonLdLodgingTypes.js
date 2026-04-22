/**
 * Tipos JSON-LD (schema.org) que el patch de normas (petsAllowed / smokingAllowed) considera «alojamiento».
 *
 * Fuente de verdad: mantener alineado con getMainSchemaType (schemaMappings) y el prompt jsonld.js.
 * El script test-house-rules-jsonld-patch.js + assertSyncWithSchemaMappings() fallan en CI si se desincronizan.
 */

const { getMainSchemaType } = require('./ai/schemaMappings');

/** @type reconocidos explícitamente (match exacto, case-insensitive). */
const LODGING_JSONLD_STRICT_TYPES = new Set([
    'HotelRoom',
    'Hotel',
    'LodgingBusiness',
    'Motel',
    'Resort',
    'Inn',
    'Hostel',
    'VacationRental',
    'Accommodation',
    'Apartment',
    'House',
    'BedAndBreakfast',
    'CampingPitch',
    'Campground',
    'RVPark',
    'GuestHouse',
    'SingleFamilyResidence',
    'Lodging',
    'Suite',
    'Cottage',
    'Dormitory',
    'SkiResort',
]);

/** Último segmento de URL https://schema.org/… considerado alojamiento (Product + additionalType). */
const ADDITIONAL_TYPE_LODGING_SEGMENTS = new Set([
    'VacationRental',
    'LodgingBusiness',
    'Hotel',
    'HotelRoom',
    'Accommodation',
    'Apartment',
    'Campground',
    'Hostel',
    'Resort',
    'Motel',
    'Inn',
]);

function isStrictLodgingType(typeStr) {
    return LODGING_JSONLD_STRICT_TYPES.has(String(typeStr).trim());
}

function additionalTypeSuggestsLodging(node) {
    const raw = node && node.additionalType;
    if (raw == null) return false;
    const parts = Array.isArray(raw) ? raw : [raw];
    return parts.some((p) => {
        const s = String(p);
        const m = s.match(/schema\.org\/([^/?#]+)/i);
        if (!m) return false;
        return ADDITIONAL_TYPE_LODGING_SEGMENTS.has(m[1]);
    });
}

/**
 * ¿Este nodo de un @graph (o raíz) debe recibir petsAllowed/smokingAllowed desde normas?
 */
function isLikelyLodgingJsonLdNode(node) {
    if (!node || typeof node !== 'object') return false;
    const t = node['@type'];
    const types = t == null ? [] : (Array.isArray(t) ? t : [t]).map((x) => String(x).trim()).filter(Boolean);
    if (!types.length) return additionalTypeSuggestsLodging(node);
    if (types.some((x) => isStrictLodgingType(x))) return true;
    const hasAccommodation = types.some((x) => /^Accommodation$/i.test(x));
    const hasProduct = types.some((x) => /^Product$/i.test(x));
    if (hasAccommodation && hasProduct) return true;
    if (types.length === 1 && /^Product$/i.test(types[0]) && additionalTypeSuggestsLodging(node)) return true;
    return false;
}

/**
 * Falla con mensaje claro si getMainSchemaType() introduce @type o additionalType que el patch no cubre.
 * Llamar desde tests de CI (no hace falta en runtime de producción).
 */
function assertSyncWithSchemaMappings() {
    const modes = ['complejo', 'hotel', 'cartera'];
    for (const mode of modes) {
        const { type, additionalType } = getMainSchemaType(mode);
        const types = Array.isArray(type) ? type : [type];
        const hasAccommodation = types.some((x) => String(x) === 'Accommodation');
        for (const t of types) {
            if (String(t) === 'Product' && hasAccommodation) continue;
            if (!isStrictLodgingType(t)) {
                throw new Error(
                    `[jsonLdLodgingTypes] getMainSchemaType("${mode}") usa @type "${t}" que no está en `
                    + 'LODGING_JSONLD_STRICT_TYPES. Añádelo ahí y revisa backend/scripts/test-house-rules-jsonld-patch.js.'
                );
            }
        }
        if (additionalType) {
            const m = String(additionalType).match(/schema\.org\/([^/?#]+)/i);
            const seg = m ? m[1] : '';
            if (!ADDITIONAL_TYPE_LODGING_SEGMENTS.has(seg)) {
                throw new Error(
                    `[jsonLdLodgingTypes] getMainSchemaType("${mode}") usa additionalType "${additionalType}" `
                    + 'cuyo segmento no está en ADDITIONAL_TYPE_LODGING_SEGMENTS.'
                );
            }
        }
    }
}

module.exports = {
    LODGING_JSONLD_STRICT_TYPES,
    ADDITIONAL_TYPE_LODGING_SEGMENTS,
    isStrictLodgingType,
    additionalTypeSuggestsLodging,
    isLikelyLodgingJsonLdNode,
    assertSyncWithSchemaMappings,
};
