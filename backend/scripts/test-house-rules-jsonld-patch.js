/**
 * Pruebas de patchJsonLdWithHouseRules frente a formas reales de JSON-LD en StayManager.
 * Ejecutar: npm run test:house-rules-jsonld
 */

const assert = require('assert');
const { assertSyncWithSchemaMappings } = require('../services/jsonLdLodgingTypes');
const { patchJsonLdWithHouseRules, mergeEffectiveRules } = require('../services/houseRulesService');

assertSyncWithSchemaMappings();

function run(name, fn) {
    try {
        fn();
        console.log(`OK  ${name}`);
    } catch (e) {
        console.error(`FAIL ${name}`, e.message);
        process.exitCode = 1;
    }
}

const rulesPetsSiFumarNo = mergeEffectiveRules(
    { admiteMascotas: 'si', permiteFumar: 'no' },
    {}
);
const rulesPetsConsulta = mergeEffectiveRules(
    { admiteMascotas: 'bajo_consulta', permiteFumar: 'solo_exterior' },
    {}
);

// Mismo shape que backend/scripts/test-jsonld-validation.js (complejo / cartera / hotel)
const jsonLdComplejo = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: 'Complejo Las Araucarias',
    petsAllowed: false,
    smokingAllowed: true,
};

const jsonLdCartera = {
    '@context': 'https://schema.org',
    '@type': ['Accommodation', 'Product'],
    additionalType: 'https://schema.org/VacationRental',
    name: 'Departamento Centro',
};

const jsonLdHotel = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: 'Hotel Pucón',
};

const jsonLdHotelRoom = {
    '@context': 'https://schema.org',
    '@type': 'HotelRoom',
    name: 'Habitación 201',
};

const jsonLdProductSoloConAdditional = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    additionalType: 'https://schema.org/VacationRental',
    name: 'Cabaña (solo Product + additionalType)',
};

const graphMixto = {
    '@context': 'https://schema.org',
    '@graph': [
        { '@type': 'WebPage', name: 'Ficha' },
        { '@type': 'LodgingBusiness', name: 'Unidad', petsAllowed: true },
    ],
};

run('LodgingBusiness: fuerza pets/smoking desde normas', () => {
    const out = patchJsonLdWithHouseRules(jsonLdComplejo, rulesPetsSiFumarNo);
    assert.strictEqual(out.petsAllowed, true);
    assert.strictEqual(out.smokingAllowed, false);
});

run('Cartera Accommodation+Product: parchea', () => {
    const out = patchJsonLdWithHouseRules(jsonLdCartera, rulesPetsSiFumarNo);
    assert.strictEqual(out.petsAllowed, true);
    assert.strictEqual(out.smokingAllowed, false);
});

run('Hotel: parchea', () => {
    const out = patchJsonLdWithHouseRules(jsonLdHotel, rulesPetsSiFumarNo);
    assert.strictEqual(out.petsAllowed, true);
});

run('HotelRoom: parchea', () => {
    const out = patchJsonLdWithHouseRules(jsonLdHotelRoom, rulesPetsSiFumarNo);
    assert.strictEqual(out.petsAllowed, true);
});

run('Product + additionalType VacationRental: parchea', () => {
    const out = patchJsonLdWithHouseRules(jsonLdProductSoloConAdditional, rulesPetsSiFumarNo);
    assert.strictEqual(out.petsAllowed, true);
});

run('@graph: solo nodos lodging', () => {
    const out = patchJsonLdWithHouseRules(graphMixto, rulesPetsSiFumarNo);
    const page = out['@graph'][0];
    const lod = out['@graph'][1];
    assert.strictEqual(page.petsAllowed, undefined, 'WebPage no recibe patch de normas');
    assert.strictEqual(lod.petsAllowed, true);
    assert.strictEqual(lod.smokingAllowed, false);
});

run('bajo_consulta: elimina petsAllowed en nodo lodging', () => {
    const withPets = { ...jsonLdComplejo, petsAllowed: true };
    const out = patchJsonLdWithHouseRules(withPets, rulesPetsConsulta);
    assert.strictEqual(out.petsAllowed, undefined);
    assert.strictEqual(out.smokingAllowed, false);
});

if (!process.exitCode) {
    console.log('\nTodas las pruebas de patch JSON-LD / house rules pasaron.');
}
