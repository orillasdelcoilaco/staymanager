/**
 * Script para verificar elementos con capacity=0 o no definida
 * que podrían estar sumando capacidad incorrectamente
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

async function verificarElementosConCapacidadCero() {
    console.log('=== VERIFICANDO ELEMENTOS CON CAPACIDAD CERO O NO DEFINIDA ===\n');

    try {
        // Obtener todas las empresas
        const empresasSnapshot = await db.collection('empresas').get();

        for (const empresaDoc of empresasSnapshot.docs) {
            const empresaId = empresaDoc.id;
            const empresaNombre = empresaDoc.data().nombre || empresaId;

            console.log(`\n--- Empresa: ${empresaNombre} (${empresaId}) ---`);

            // Obtener propiedades de esta empresa
            const propiedadesSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').get();

            for (const propiedadDoc of propiedadesSnapshot.docs) {
                const propiedadId = propiedadDoc.id;
                const propiedadNombre = propiedadDoc.data().nombre || propiedadId;

                // Obtener componentes de esta propiedad
                const componentesSnapshot = await db.collection('empresas').doc(empresaId)
                    .collection('propiedades').doc(propiedadId)
                    .collection('componentes').get();

                let elementosProblema = [];

                for (const componenteDoc of componentesSnapshot.docs) {
                    const componenteId = componenteDoc.id;
                    const componenteData = componenteDoc.data();
                    const componenteNombre = componenteData.nombre || componenteId;
                    const componentTipo = componenteData.tipo || 'sin-tipo';

                    // Obtener elementos de este componente
                    const elementosSnapshot = await db.collection('empresas').doc(empresaId)
                        .collection('propiedades').doc(propiedadId)
                        .collection('componentes').doc(componenteId)
                        .collection('elementos').get();

                    for (const elementoDoc of elementosSnapshot.docs) {
                        const elementoId = elementoDoc.id;
                        const elementoData = elementoDoc.data();
                        const elementoNombre = elementoData.nombre || elementoId;
                        const capacidad = elementoData.capacity;
                        const cantidad = elementoData.cantidad || 1;

                        // Verificar problemas
                        const problemas = [];

                        // 1. Capacity es undefined/null
                        if (capacidad === undefined || capacidad === null) {
                            problemas.push('capacity no definido (undefined/null)');
                        }

                        // 2. Capacity es string vacío
                        if (capacidad === '') {
                            problemas.push('capacity es string vacío ""');
                        }

                        // 3. Capacity es 0 pero el nombre sugiere que podría tener capacidad
                        if (capacidad === 0 || capacidad === '0') {
                            const nombreUpper = (elementoNombre || '').toUpperCase();
                            const tienePatronCama = nombreUpper.includes('CAMA') ||
                                                   nombreUpper.includes('BED') ||
                                                   nombreUpper.includes('PLAZA') ||
                                                   nombreUpper.includes('LITERA') ||
                                                   nombreUpper.includes('CAMAROTE') ||
                                                   nombreUpper.includes('SOFA') ||
                                                   nombreUpper.includes('FUTON') ||
                                                   nombreUpper.includes('NIDO') ||
                                                   nombreUpper.includes('CATRE');

                            if (tienePatronCama) {
                                problemas.push('capacity=0 pero nombre sugiere cama');
                            }
                        }

                        // 4. Capacity no es número válido
                        if (capacidad !== undefined && capacidad !== null && capacidad !== '') {
                            const numCap = Number(capacidad);
                            if (isNaN(numCap)) {
                                problemas.push(`capacity no es número válido: "${capacidad}"`);
                            }
                        }

                        if (problemas.length > 0) {
                            elementosProblema.push({
                                propiedad: propiedadNombre,
                                componente: `${componenteNombre} (${componentTipo})`,
                                elemento: elementoNombre,
                                capacidad: capacidad,
                                cantidad: cantidad,
                                problemas: problemas
                            });
                        }
                    }
                }

                if (elementosProblema.length > 0) {
                    console.log(`\nPropiedad: ${propiedadNombre} (${propiedadId})`);
                    console.log('Elementos con problemas:');

                    elementosProblema.forEach((elem, idx) => {
                        console.log(`  ${idx + 1}. ${elem.elemento}`);
                        console.log(`     Componente: ${elem.componente}`);
                        console.log(`     Capacity: ${elem.capacidad}, Cantidad: ${elem.cantidad}`);
                        console.log(`     Problemas: ${elem.problemas.join(', ')}`);
                    });
                }
            }
        }

        console.log('\n=== ANÁLISIS COMPLETADO ===');

    } catch (error) {
        console.error('Error:', error);
    }
}

// Ejecutar análisis
verificarElementosConCapacidadCero().then(() => {
    console.log('Script finalizado.');
    process.exit(0);
}).catch(err => {
    console.error('Error en script:', err);
    process.exit(1);
});