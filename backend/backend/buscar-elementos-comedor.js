/**
 * Script específico para buscar elementos en categoría "comedor"
 * con capacity=0 o problemas similares
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://staymanager-8d5c7.firebaseio.com'
    });
}

const db = admin.firestore();

async function buscarElementosComedor() {
    console.log('=== BUSCANDO ELEMENTOS EN CATEGORÍA "COMEDOR" ===\n');

    try {
        // Obtener empresa específica (Orillas del Coilaco)
        const empresaId = 'SdPX7OBmThlOldlxsIq8';
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        const empresaNombre = empresaDoc.data().nombre || empresaId;

        console.log(`Empresa: ${empresaNombre}\n`);

        // Obtener propiedades
        const propiedadesSnapshot = await db.collection('empresas').doc(empresaId)
            .collection('propiedades').get();

        for (const propiedadDoc of propiedadesSnapshot.docs) {
            const propiedadId = propiedadDoc.id;
            const propiedadData = propiedadDoc.data();
            const propiedadNombre = propiedadData.nombre || propiedadId;

            console.log(`\n--- Propiedad: ${propiedadNombre} ---`);

            // Obtener componentes de tipo "comedor" o con nombre que contenga "comedor"
            const componentesSnapshot = await db.collection('empresas').doc(empresaId)
                .collection('propiedades').doc(propiedadId)
                .collection('componentes').get();

            for (const componenteDoc of componentesSnapshot.docs) {
                const componenteId = componenteDoc.id;
                const componenteData = componenteDoc.data();
                const componenteNombre = componenteData.nombre || componenteId;
                const componentTipo = componenteData.tipo || 'sin-tipo';
                const componentCategoria = componenteData.categoria || 'sin-categoria';

                // Filtrar por categoría "comedor" o nombre que contenga "comedor"
                const nombreLower = (componenteNombre || '').toLowerCase();
                const tipoLower = (componentTipo || '').toLowerCase();
                const categoriaLower = (componentCategoria || '').toLowerCase();

                const esComedor = nombreLower.includes('comedor') ||
                                 tipoLower.includes('comedor') ||
                                 categoriaLower.includes('comedor');

                if (esComedor) {
                    console.log(`\nComponente: ${componenteNombre} (Tipo: ${componentTipo}, Categoría: ${componentCategoria})`);

                    // Obtener elementos de este componente
                    const elementosSnapshot = await db.collection('empresas').doc(empresaId)
                        .collection('propiedades').doc(propiedadId)
                        .collection('componentes').doc(componenteId)
                        .collection('elementos').get();

                    console.log(`  Elementos encontrados: ${elementosSnapshot.size}`);

                    for (const elementoDoc of elementosSnapshot.docs) {
                        const elementoId = elementoDoc.id;
                        const elementoData = elementoDoc.data();
                        const elementoNombre = elementoData.nombre || elementoId;
                        const capacidad = elementoData.capacity;
                        const cantidad = elementoData.cantidad || 1;

                        console.log(`  - ${elementoNombre}: capacity=${capacidad}, cantidad=${cantidad}`);

                        // Verificar si el nombre contiene "individual" o similar
                        const nombreUpper = (elementoNombre || '').toUpperCase();
                        const esIndividual = nombreUpper.includes('INDIVIDUAL') ||
                                            nombreUpper.includes('INDIVIDUALES') ||
                                            nombreUpper.includes('MESA') ||
                                            nombreUpper.includes('SILLA') ||
                                            nombreUpper.includes('PLATO') ||
                                            nombreUpper.includes('CUBIERTO');

                        if (esIndividual) {
                            console.log(`    ⚠️  POSIBLE PROBLEMA: Elemento "individual" con capacity=${capacidad}`);
                        }
                    }
                }
            }
        }

        console.log('\n=== BÚSQUEDA COMPLETADA ===');

    } catch (error) {
        console.error('Error:', error);
    }
}

// Ejecutar búsqueda
buscarElementosComedor().then(() => {
    console.log('Script finalizado.');
    process.exit(0);
}).catch(err => {
    console.error('Error en script:', err);
    process.exit(1);
});