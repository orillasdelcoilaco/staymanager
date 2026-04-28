/**
 * Buscar elementos con nombre que contenga "individual" o similar
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

async function buscarElementosIndividuales() {
    console.log('=== BUSCANDO ELEMENTOS CON "INDIVIDUAL" EN NOMBRE ===\n');

    try {
        const empresaId = 'SdPX7OBmThlOldlxsIq8';
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();
        const empresaNombre = empresaDoc.data().nombre || empresaId;

        console.log(`Empresa: ${empresaNombre}\n`);

        let totalElementos = 0;
        let elementosIndividuales = [];

        // Obtener todas las propiedades
        const propiedadesSnapshot = await db.collection('empresas').doc(empresaId)
            .collection('propiedades').get();

        for (const propiedadDoc of propiedadesSnapshot.docs) {
            const propiedadId = propiedadDoc.id;
            const propiedadData = propiedadDoc.data();
            const propiedadNombre = propiedadData.nombre || propiedadId;

            // Obtener todos los componentes
            const componentesSnapshot = await db.collection('empresas').doc(empresaId)
                .collection('propiedades').doc(propiedadId)
                .collection('componentes').get();

            for (const componenteDoc of componentesSnapshot.docs) {
                const componenteId = componenteDoc.id;
                const componenteData = componenteDoc.data();
                const componenteNombre = componenteData.nombre || componenteId;

                // Obtener todos los elementos
                const elementosSnapshot = await db.collection('empresas').doc(empresaId)
                    .collection('propiedades').doc(propiedadId)
                    .collection('componentes').doc(componenteId)
                    .collection('elementos').get();

                totalElementos += elementosSnapshot.size;

                for (const elementoDoc of elementosSnapshot.docs) {
                    const elementoId = elementoDoc.id;
                    const elementoData = elementoDoc.data();
                    const elementoNombre = elementoData.nombre || elementoId;
                    const capacidad = elementoData.capacity;
                    const cantidad = elementoData.cantidad || 1;

                    // Buscar "individual" en el nombre
                    const nombreLower = (elementoNombre || '').toLowerCase();
                    if (nombreLower.includes('individual') ||
                        nombreLower.includes('individuales') ||
                        nombreLower.includes('individuale')) {

                        elementosIndividuales.push({
                            propiedad: propiedadNombre,
                            componente: componenteNombre,
                            elemento: elementoNombre,
                            capacidad: capacidad,
                            cantidad: cantidad,
                            elementoId: elementoId,
                            componenteId: componenteId,
                            propiedadId: propiedadId
                        });
                    }
                }
            }
        }

        console.log(`Total elementos en sistema: ${totalElementos}`);
        console.log(`Elementos con "individual" en nombre: ${elementosIndividuales.length}\n`);

        if (elementosIndividuales.length > 0) {
            console.log('=== DETALLE DE ELEMENTOS "INDIVIDUAL" ===\n');

            elementosIndividuales.forEach((elem, idx) => {
                console.log(`${idx + 1}. ${elem.elemento}`);
                console.log(`   Propiedad: ${elem.propiedad}`);
                console.log(`   Componente: ${elem.componente}`);
                console.log(`   Capacity: ${elem.capacidad} (tipo: ${typeof elem.capacidad})`);
                console.log(`   Cantidad: ${elem.cantidad}`);
                console.log(`   ID: ${elem.elementoId}`);
                console.log('');
            });

            // Analizar tipos de capacity
            const tiposCapacity = {};
            elementosIndividuales.forEach(elem => {
                const tipo = typeof elem.capacidad;
                tiposCapacity[tipo] = (tiposCapacity[tipo] || 0) + 1;
            });

            console.log('\n=== ANÁLISIS DE TIPOS DE CAPACITY ===');
            Object.entries(tiposCapacity).forEach(([tipo, count]) => {
                console.log(`  ${tipo}: ${count} elementos`);
            });
        }

        console.log('\n=== BÚSQUEDA COMPLETADA ===');

    } catch (error) {
        console.error('Error:', error);
    }
}

// Ejecutar búsqueda
buscarElementosIndividuales().then(() => {
    console.log('Script finalizado.');
    process.exit(0);
}).catch(err => {
    console.error('Error en script:', err);
    process.exit(1);
});