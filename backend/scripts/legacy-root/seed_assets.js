const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');
const { crearTipo } = require('../../services/tiposElementoService');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function seedAssets() {
    try {
        console.log("🌱 Sembrando Catálogo Estándar en TODAS las empresas...");

        // 1. Obtener TODAS las empresas
        const snapshot = await db.collection('empresas').get();
        if (snapshot.empty) {
            console.error("❌ No se encontraron empresas en la BD.");
            return;
        }

        console.log(`🎯 Se encontraron ${snapshot.size} empresas.`);

        // 2. Definir Catálogo
        const CATALOGO_BASICO = [
            { nombre: 'Cama King', categoria: 'DORMITORIO', icono: '🛏️', capacidad: 2, contabilizable: true },
            { nombre: 'Cama 2 Plazas', categoria: 'DORMITORIO', icono: '🛏️', capacidad: 2, contabilizable: true },
            { nombre: 'Cama 1 Plaza', categoria: 'DORMITORIO', icono: '🛏️', capacidad: 1, contabilizable: true },
            { nombre: 'Velador', categoria: 'DORMITORIO', icono: '🪑', capacidad: 0, contabilizable: true },
            { nombre: 'Closet', categoria: 'DORMITORIO', icono: '🚪', capacidad: 0, contabilizable: true },
            { nombre: 'Sofá', categoria: 'LIVING', icono: '🛋️', capacidad: 0, contabilizable: true },
            { nombre: 'Mesa de Centro', categoria: 'LIVING', icono: '🪵', capacidad: 0, contabilizable: true },
            { nombre: 'TV Smart', categoria: 'TECNOLOGIA', icono: '📺', capacidad: 0, contabilizable: true },
            { nombre: 'Wifi Router', categoria: 'TECNOLOGIA', icono: '📶', capacidad: 0, contabilizable: true },
            { nombre: 'Comedor (Mesa)', categoria: 'COMEDOR', icono: '🍽️', capacidad: 0, contabilizable: true },
            { nombre: 'Silla', categoria: 'COMEDOR', icono: '🪑', capacidad: 0, contabilizable: true },
            { nombre: 'Refrigerador', categoria: 'COCINA', icono: '🧊', capacidad: 0, contabilizable: true },
            { nombre: 'Cocina (Encimera)', categoria: 'COCINA', icono: '🍳', capacidad: 0, contabilizable: true },
            { nombre: 'Hervidor', categoria: 'COCINA', icono: '☕', capacidad: 0, contabilizable: true },
            { nombre: 'Parrilla', categoria: 'EXTERIOR', icono: '🍖', capacidad: 0, contabilizable: true },
            { nombre: 'Terraza (Mesa)', categoria: 'EXTERIOR', icono: '☀️', capacidad: 0, contabilizable: true }
        ];

        // 3. Iterar Empresas y Sembrar
        for (const doc of snapshot.docs) {
            const empresaId = doc.id;
            const empresaNombre = doc.data().nombreFantasia || empresaId;
            console.log(`\n🏢 Sembrando en: ${empresaNombre} (${empresaId})`);

            for (const item of CATALOGO_BASICO) {
                const query = await db.collection('empresas').doc(empresaId).collection('tiposElemento')
                    .where('nombre', '==', item.nombre).limit(1).get();

                const payload = {
                    ...item,
                    permiteCantidad: true, // Internal name for "contabilizable" logic
                    requires_photo: false,
                    seo_tags: ['estándar']
                };

                if (query.empty) {
                    await crearTipo(db, empresaId, payload);
                    process.stdout.write('+'); // Added
                } else {
                    // Update existing to fix missing fields
                    await query.docs[0].ref.update(payload);
                    process.stdout.write('~'); // Updated
                }
            }
        }
        console.log("\n🎉 Catálogo sembrado exitosamente en todas las empresas.");
    } catch (error) {
        console.error("Error:", error);
    }
}

seedAssets();
