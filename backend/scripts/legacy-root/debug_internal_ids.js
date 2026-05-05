const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkIds() {
    try {
        console.log("🕵️‍♂️ Checking for internal 'id' fields in properties...");
        const empresas = await db.collection('empresas').get();

        for (const emp of empresas.docs) {
            const props = await emp.ref.collection('propiedades').get();
            props.forEach(doc => {
                const data = doc.data();
                if (data.id) {
                    const match = data.id === doc.id ? "MATCH" : "MISMATCH ❌";
                    console.log(`[${emp.id}] Prop: ${doc.id} | Internal ID: ${data.id} -> ${match}`);
                } else {
                    // console.log(`[${emp.id}] Prop: ${doc.id} | Internal ID: N/A`);
                }
            });
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

checkIds();
