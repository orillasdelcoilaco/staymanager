const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const EMPRESA_ID = 'cv1Lb4HLBLvWvSyqYfRW';

const CANONICAL_MAP = {
    'BANO': 'Baño',
    'BAÑO': 'Baño',
    'BAÑOS': 'Baño',
    'BANOS': 'Baño',
    'BATHROOM': 'Baño',

    'COCINA': 'Cocina',
    'KITCHEN': 'Cocina',

    'DORMITORIO': 'Dormitorio',
    'BEDROOM': 'Dormitorio',
    'HABITACION': 'Dormitorio',

    'ESTAR': 'Estar',
    'LIVING': 'Estar',
    'LIVING ROOM': 'Estar',
    'SALA': 'Estar',

    'COMEDOR': 'Comedor',
    'DINING': 'Comedor',

    'EXTERIOR': 'Exterior',
    'TERRAZA': 'Exterior',
    'PATIO': 'Exterior',
    'JARDIN': 'Exterior',
    'QUINCHO': 'Exterior',

    'TECNOLOGIA': 'Tecnología',
    'TECNOLOGÍA': 'Tecnología',

    'SEGURIDAD': 'Seguridad',

    'SERVICIOS': 'Servicios',
    'LAUNDRY': 'Servicios',
    'LOGGIA': 'Servicios',
    'LIMPIEZA': 'Servicios'
};

const normalizeKey = (str) => {
    return str.toString().trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents for key lookup (BANO)
};

async function standardizeCategories() {
    console.log(`🧹 Standardizing Categories for: ${EMPRESA_ID}`);

    const collectionRef = db.collection('empresas').doc(EMPRESA_ID).collection('tiposElemento');
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
        console.log("❌ No types found.");
        return;
    }

    const batch = db.batch();
    let updates = 0;

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const currentCat = data.categoria || 'OTROS';

        // 1. Try Direct Lookup (Trimmed + Upper)
        let key = currentCat.trim().toUpperCase();

        // 2. Try Normalized Lookup (No Accents)
        if (!CANONICAL_MAP[key] && !Object.values(CANONICAL_MAP).includes(currentCat)) {
            key = normalizeKey(currentCat);
        }

        const canonical = CANONICAL_MAP[key];

        // If we found a canonical version AND it looks different from current, update it.
        // Or if current has weird whitespace we want to trim.
        if (canonical && canonical !== currentCat) {
            console.log(`✅ Mapping '${data.nombre}': "${currentCat}" -> "${canonical}"`);
            batch.update(doc.ref, { categoria: canonical });
            updates++;
        } else if (!canonical) {
            // No mapping found, but maybe just needs trimming?
            const trimmed = currentCat.trim();
            if (trimmed !== currentCat) {
                console.log(`✨ Trimming '${data.nombre}': "${currentCat}" -> "${trimmed}"`);
                batch.update(doc.ref, { categoria: trimmed });
                updates++;
            }
        }
    });

    if (updates > 0) {
        await batch.commit();
        console.log(`🔥 Standardized ${updates} categories.`);
    } else {
        console.log("✨ All categories are clean.");
    }
}

standardizeCategories().then(() => process.exit(0));
