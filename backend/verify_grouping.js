const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const { getAvailabilityData, findNormalCombination, calculatePrice } = require('./services/publicWebsiteService');
const { addDays, nextFriday, nextSunday } = require('date-fns');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function verifyGrouping() {
    try {
        const empresaId = 'cv1Lb4HLBLvWvSyqYfRW';
        const today = new Date();
        const startDate = nextFriday(today);
        const endDate = nextSunday(startDate);
        const personas = 12;

        console.log(`Testing grouping for ${personas} people from ${startDate.toISOString()} to ${endDate.toISOString()}`);

        const { availableProperties, allTarifas } = await getAvailabilityData(db, empresaId, startDate, endDate);
        console.log(`Available properties: ${availableProperties.length}`);

        const { combination, capacity } = findNormalCombination(availableProperties, personas);

        if (combination.length > 0) {
            console.log(`Group found! Combined capacity: ${capacity}`);
            combination.forEach(p => console.log(` - ${p.nombre} (Cap: ${p.capacidad})`));

            const pricing = await calculatePrice(db, empresaId, combination, startDate, endDate, allTarifas);
            console.log(`Total Price: ${pricing.totalPriceCLP}`);
        } else {
            console.log('No combination found.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

verifyGrouping();
