/**
 * Test del sync en modo Firestore
 *
 * Este script simula una llamada al sync para verificar que funciona en modo Firestore.
 * Ejecutar: node TASKS/test-sync-firestore.js
 */

// Simular entorno Firestore
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'serviceAccountKey.json';

const admin = require('firebase-admin');

// Inicializar Firebase si no está inicializado
try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
    console.log('✅ Firebase inicializado');
} catch (err) {
    if (!err.message.includes('already exists')) {
        console.error('❌ Error inicializando Firebase:', err.message);
        process.exit(1);
    }
}

const db = admin.firestore();

async function testSync() {
    console.log('=== TEST SYNC FIRESTORE ===\n');

    // 1. Obtener una empresa de prueba
    const empresasSnapshot = await db.collection('empresas').limit(1).get();
    if (empresasSnapshot.empty) {
        console.log('❌ No hay empresas en Firestore');
        return;
    }

    const empresaDoc = empresasSnapshot.docs[0];
    const empresaId = empresaDoc.id;
    console.log(`1. Empresa encontrada: ${empresaDoc.data().nombre || 'Sin nombre'} (ID: ${empresaId})`);

    // 2. Obtener una propiedad de esta empresa
    const propiedadesSnapshot = await db.collection('empresas').doc(empresaId)
        .collection('propiedades').limit(1).get();

    if (propiedadesSnapshot.empty) {
        console.log('❌ Esta empresa no tiene propiedades');
        return;
    }

    const propiedadDoc = propiedadesSnapshot.docs[0];
    const propiedadId = propiedadDoc.id;
    console.log(`2. Propiedad encontrada: ${propiedadDoc.data().nombre || 'Sin nombre'} (ID: ${propiedadId})`);

    // 3. Verificar galería actual
    const galeriaSnapshot = await db.collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId)
        .collection('galeria').where('estado', 'in', ['auto', 'manual'])
        .where('espacioId', '!=', null).get();

    console.log(`3. Fotos confirmadas para sync: ${galeriaSnapshot.size}`);

    if (galeriaSnapshot.size === 0) {
        console.log('⚠️  No hay fotos confirmadas para sync. Necesitas:');
        console.log('   - Fotos con estado "auto" o "manual"');
        console.log('   - Fotos con espacioId no nulo');
        return;
    }

    // Mostrar ejemplo de foto
    const ejemploFoto = galeriaSnapshot.docs[0];
    console.log(`   Ejemplo: ID=${ejemploFoto.id}, espacioId=${ejemploFoto.data().espacioId}`);

    // 4. Verificar websiteData actual
    const propiedadData = propiedadDoc.data();
    const websiteData = propiedadData.websiteData || {};
    console.log(`4. websiteData actual:`);
    console.log(`   - Existe: ${!!propiedadData.websiteData}`);
    if (websiteData.images) {
        const espacios = Object.keys(websiteData.images);
        console.log(`   - Imágenes: ${espacios.length} espacio(s)`);
        espacios.forEach(esp => {
            console.log(`     * ${esp}: ${websiteData.images[esp].length} foto(s)`);
        });
    } else {
        console.log(`   - Imágenes: NO EXISTE`);
    }

    // 5. Simular sync manual
    console.log('\n5. Simulando sync manual...');

    const images = {};
    let cardImage = null;

    galeriaSnapshot.docs.forEach(d => {
        const f = d.data();
        const imageObj = {
            imageId: d.id,
            storagePath: f.storageUrl || f.storagePath,
            altText: f.altText || '',
            title: `${f.espacio || 'Vista'} - ${f.altText || ''}`,
            description: f.altText || '',
            orden: f.orden || 0
        };

        if (!images[f.espacioId]) images[f.espacioId] = [];
        images[f.espacioId].push(imageObj);

        if (!cardImage) cardImage = imageObj;
    });

    console.log(`   - Imágenes a guardar: ${Object.keys(images).length} espacio(s)`);
    console.log(`   - Total fotos: ${galeriaSnapshot.size}`);

    // 6. Actualizar en Firestore
    try {
        await db.collection('empresas').doc(empresaId)
            .collection('propiedades').doc(propiedadId)
            .update({
                'websiteData.images': images,
                'websiteData.cardImage': cardImage
            });

        console.log('✅ Sync simulado exitoso');
        console.log(`   - Actualizado websiteData.images`);
        console.log(`   - Actualizado websiteData.cardImage`);

    } catch (err) {
        console.log(`❌ Error en sync: ${err.message}`);
    }

    // 7. Verificar después del sync
    console.log('\n6. Verificando después del sync...');
    const updatedPropiedad = await db.collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId).get();

    const updatedWebsiteData = updatedPropiedad.data().websiteData || {};
    if (updatedWebsiteData.images) {
        const espacios = Object.keys(updatedWebsiteData.images);
        console.log(`✅ websiteData.images actualizado: ${espacios.length} espacio(s)`);
    } else {
        console.log(`❌ websiteData.images NO se actualizó`);
    }
}

// Ejecutar test
testSync().catch(err => {
    console.error('Error en test:', err);
}).finally(() => {
    console.log('\n=== RECOMENDACIONES ===');
    console.log('1. Verificar que las fotos tengan estado "auto" o "manual"');
    console.log('2. Verificar que las fotos tengan espacioId asignado');
    console.log('3. Probar el endpoint real: POST /api/galeria/:propiedadId/sync');
    console.log('4. Revisar logs del servidor para errores');
});