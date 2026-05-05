const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
require('dotenv').config();

// Configuración de Firebase
const serviceAccount = require('../../serviceAccountKey.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

/**
 * Script para sembrar "Dormitorio en Suite" en TODAS las empresas.
 * No borra nada, solo agrega si falta.
 */
async function seedSuite() {
    try {
        console.log("🛌 Sembrando 'Dormitorio en Suite' en todas las empresas...");

        // 1. Obtener todas las empresas
        const snapshot = await db.collection('empresas').get();
        if (snapshot.empty) {
            console.log("No hay empresas.");
            return;
        }

        const SUITE_TEMPLATE = {
            nombreNormalizado: "Dormitorio en Suite",
            nombreUsuario: "Dormitorio en Suite",
            icono: "🛌",
            descripcionBase: "Dormitorio principal con baño privado integrado.",
            shotList: ["Vista general", "Cama King/Queen", "Baño Privado", "Detalles de confort"],
            origen: "sistema_update",
            // Elementos por defecto sugeridos (IDs ficticios, el usuario los linkeará o la IA los matchea)
            // En este nivel (Tipos de Componente / Plantillas), no siempre guardamos los items por defecto IDs.
            // Pero podemos agregar una propiedad de sugerencia si el modelo lo soporta.
            elementosDefault: []
        };

        for (const doc of snapshot.docs) {
            const empresaId = doc.id;
            const empresaNombre = doc.data().nombreFantasia || empresaId;
            console.log(` > Procesando: ${empresaNombre}`);

            const coll = db.collection('empresas').doc(empresaId).collection('tiposComponente');

            // Verificar si ya existe
            const q = await coll.where('nombreNormalizado', '==', 'Dormitorio en Suite').get();

            if (q.empty) {
                await coll.add(SUITE_TEMPLATE);
                process.stdout.write('   [+] Creado\n');
            } else {
                process.stdout.write('   [.] Ya existe\n');
            }
        }
        console.log("\n✅ Listo. 'Dormitorio en Suite' disponible globalmente.");
    } catch (error) {
        console.error("Error:", error);
    }
}

seedSuite();
