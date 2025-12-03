const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyStructure() {
    const empresaId = '90qbyAodIhKPeVXdRt8T';
    const propiedadId = 'DfJH8dbK';
    let output = `Checking path: empresas/${empresaId}/propiedades/${propiedadId}\n`;

    try {
        const doc = await db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId).get();

        if (doc.exists) {
            const data = doc.data();
            output += '✅ Document exists!\n';
            output += `Nombre: ${data.nombre}\n`;
            output += `isListed: ${data.isListed}\n`;
            output += `Empresa Parent ID: ${doc.ref.parent.parent.id}\n`;
        } else {
            output += '❌ Document does NOT exist at this path.\n';

            try {
                // Try to find where it is
                output += 'Searching via collectionGroup...\n';
                const snapshot = await db.collectionGroup('propiedades').where('id', '==', propiedadId).get();
                if (snapshot.empty) {
                    output += '❌ Not found via collectionGroup either.\n';
                } else {
                    output += '✅ Found via collectionGroup!\n';
                    snapshot.docs.forEach(d => {
                        output += `Found at path: ${d.ref.path}\n`;
                    });
                }
            } catch (cgError) {
                output += `⚠️ CollectionGroup query failed: ${cgError.message}\n`;
            }
        }
        fs.writeFileSync('firestore_check_result.txt', output);
        console.log('Done writing to file.');
    } catch (error) {
        console.error('Error:', error);
    }
}

verifyStructure();
