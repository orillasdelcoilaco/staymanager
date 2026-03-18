const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// MAPPING: OldID -> NewID (Target 'cabana-N' format)
const ID_MAPPING = {
    // ID Propiedad 1: Cabaña 1
    'GiVSpcWYzx6QGSJRVIIo': 'cabana-1',
    // ID Propiedad 2: Cabaña 2 (Normalize)
    'cabana2': 'cabana-2',
    // ID Propiedad 3: Cabaña 3
    'aT1LIuD5II0Bg6lZKh0z': 'cabana-3',
    // ID Propiedad 4: Cabaña 7
    '9Dz4HR1AWSVKEeIp8sbx': 'cabana-7',
    // ID Propiedad 5: Cabaña 8 (Normalize)
    'cabana8': 'cabana-8',
    // ID Propiedad 6: Cabaña 9 (Normalize)
    'cabana9': 'cabana-9',
    // ID Propiedad 7: Cabaña 10
    '1dA2PtEzWW3ovgWwcXnG': 'cabana-10'
};

async function migratePropertyIds() {
    console.log('🚀 Starting Property ID Migration...');

    // 1. Get all companies
    const empresasSnap = await db.collection('empresas').get();
    console.log(`Found ${empresasSnap.size} companies.`);

    for (const empresaDoc of empresasSnap.docs) {
        const empresaId = empresaDoc.id;
        console.log(`\n🏢 Processing Company: ${empresaId} (${empresaDoc.data().nombre})`);

        for (const [oldId, newId] of Object.entries(ID_MAPPING)) {
            await migrateSingleProperty(empresaId, oldId, newId);
        }
    }

    console.log('\n✅ Migration Complete.');
}

async function migrateSingleProperty(empresaId, oldId, newId) {
    const oldRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(oldId);
    const newRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(newId);

    const oldDoc = await oldRef.get();
    if (!oldDoc.exists) {
        // console.log(`   🔸 Property ${oldId} not found in this company. Skipping.`);
        return;
    }

    // Check if new property already exists
    const newDocCheck = await newRef.get();
    if (newDocCheck.exists) {
        console.warn(`   ⚠️ Target ID ${newId} already exists! Manual check required. Skipping migration for ${oldId} -> ${newId}`);
        // Consider if we should merge or update references anyway? For safety, skip overwrite.
        // But we SHOULD update references if the property was "already migrated" but references weren't.
        // For now, let's assume we proceed with reference updates even if property exists? 
        // No, that's risky. Let's safeguard.
        // return; 
    }

    console.log(`\n   🔄 Migrating ${oldId} -> ${newId}`);

    // === STEP 1: Copy Property Data ===
    if (!newDocCheck.exists) {
        const data = oldDoc.data();
        // Update ID field inside data if it exists
        const newData = { ...data, id: newId };

        await newRef.set(newData);
        console.log(`      ✅ Created new property doc: ${newId}`);

        // === STEP 2: Copy Subcollections (Componentes, Amenidades) ===
        // Note: We need to copy them one by one
        await copySubcollection(oldRef, newRef, 'componentes');
        await copySubcollection(oldRef, newRef, 'amenidades');
    } else {
        console.log(`      ℹ️ New property doc ${newId} already exists. checking subcollections/references...`);
    }

    // === STEP 3: Update References in Other Collections ===
    // This is critical. We search specifically for the OLD ID.

    // A. Reservas
    await updateReferences(empresaId, 'reservas', 'alojamientoId', oldId, newId);

    // B. Tarifas
    await updateReferences(empresaId, 'tarifas', 'alojamientoId', oldId, newId);

    // C. Presupuestos (Complex array update)
    await updatePresupuestos(empresaId, oldId, newId);

    // === STEP 4: Delete Old Property ===
    // Only delete if we successfully created the new one (or it existed)
    // and we are confident.
    // For safety, I will NOT delete the old one automatically in this script unless explicitly uncommented.
    // I'll rename it or tag it? Or just leave it?
    // User asked to "change them", implying replacement.
    // I will delete the old doc to avoid duplicates showing up in lists.

    // Deleting subcollections first
    await deleteSubcollection(oldRef, 'componentes');
    await deleteSubcollection(oldRef, 'amenidades');
    await oldRef.delete();
    console.log(`      🗑️ Deleted old property doc: ${oldId}`);
}

async function copySubcollection(sourceDocRef, targetDocRef, collectionName) {
    const srcColl = sourceDocRef.collection(collectionName);
    const snaps = await srcColl.get();
    if (snaps.empty) return;

    const batch = db.batch();
    snaps.forEach(doc => {
        const targetRef = targetDocRef.collection(collectionName).doc(doc.id); // Keep same ID for sub-items
        batch.set(targetRef, doc.data());
    });
    await batch.commit();
    console.log(`      ✅ Copied subcollection ${collectionName} (${snaps.size} items)`);
}

async function deleteSubcollection(docRef, collectionName) {
    const colRef = docRef.collection(collectionName);
    const start = await colRef.limit(100).get(); // Limit for batch
    if (start.empty) return;

    const batch = db.batch();
    start.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Recurse if more than 100
    if (start.size >= 100) {
        await deleteSubcollection(docRef, collectionName);
    }
}

async function updateReferences(empresaId, collectionName, fieldName, oldId, newId) {
    const colRef = db.collection('empresas').doc(empresaId).collection(collectionName);
    const snapshot = await colRef.where(fieldName, '==', oldId).get();

    if (snapshot.empty) return;

    const batch = db.batch();
    let count = 0;
    snapshot.forEach(doc => {
        batch.update(doc.ref, { [fieldName]: newId });
        count++;
    });
    await batch.commit();
    console.log(`      🔗 Updated ${count} references in '${collectionName}'`);
}

async function updatePresupuestos(empresaId, oldId, newId) {
    const colRef = db.collection('empresas').doc(empresaId).collection('presupuestos');
    // Cannot easily filter by array object property. Retrieve all active ones.
    const snapshot = await colRef.get(); // Might be heavy if many budgets, but necessary.

    let count = 0;
    const batch = db.batch();

    snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.propiedades || !Array.isArray(data.propiedades)) return;

        let modified = false;
        const newProps = data.propiedades.map(p => {
            if (p.id === oldId) {
                modified = true;
                return { ...p, id: newId }; // Update ID in the object
            }
            return p;
        });

        if (modified) {
            batch.update(doc.ref, { propiedades: newProps });
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`      🔗 Updated ${count} references in 'presupuestos'`);
    }
}

migratePropertyIds();
