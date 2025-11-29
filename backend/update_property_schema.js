const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const empresaId = '8IhAYnOOoDTKtuC1UC9r'; // Test Company
const propiedadId = '90qbyAodIhKPeVXdRt8T'; // Test Property

async function updatePropertySchema() {
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);

    try {
        await propiedadRef.update({
            moneda: 'CLP', // Default currency
            reglas: [
                "No fumar en el interior",
                "No se permiten mascotas",
                "Respetar el horario de silencio (22:00 - 08:00)",
                "Cuidar el mobiliario"
            ]
        });
        console.log(`Successfully updated property ${propiedadId} with 'moneda' and 'reglas'.`);
    } catch (error) {
        console.error("Error updating property:", error);
    }
}

updatePropertySchema();
