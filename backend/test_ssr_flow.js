const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const { obtenerEmpresaPorDominio } = require('./services/empresaService');
const { getAvailabilityData } = require('./services/publicWebsiteService');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function testSSR() {
    console.log('--- INICIO TEST SSR ---');

    // 1. Verificar configuración de la empresa "Prueba 1"
    const empresaId = 'cv1Lb4HLBLvWvSyqYfRW'; // ID conocido de Prueba 1
    console.log(`\n1. Buscando configuración de empresa ID: ${empresaId}`);
    const doc = await db.collection('empresas').doc(empresaId).get();

    if (!doc.exists) {
        console.error('❌ Empresa no encontrada por ID.');
        return;
    }

    const data = doc.data();
    console.log('✅ Empresa encontrada:', data.nombre || data.razonSocial);
    console.log('   websiteSettings:', JSON.stringify(data.websiteSettings, null, 2));

    const subdomain = data.websiteSettings?.subdomain || data.websiteSettings?.general?.subdomain;
    if (!subdomain) {
        console.error('❌ La empresa no tiene subdominio configurado en websiteSettings.');
    } else {
        console.log(`✅ Subdominio detectado: ${subdomain}`);

        // 2. Probar resolución de dominio
        const mockHostname = `${subdomain}.suitemanager.com`;
        console.log(`\n2. Probando obtenerEmpresaPorDominio con hostname: ${mockHostname}`);
        const empresaResuelta = await obtenerEmpresaPorDominio(db, mockHostname);

        if (empresaResuelta && empresaResuelta.id === empresaId) {
            console.log('✅ Resolución de dominio EXITOSA.');
        } else {
            console.error('❌ Falló la resolución de dominio.');
            console.log('   Resultado:', empresaResuelta ? empresaResuelta.id : 'null');
        }
    }

    // 3. Probar Disponibilidad (Home Page Logic)
    console.log('\n3. Probando getAvailabilityData (Lógica Home)');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
        const availability = await getAvailabilityData(db, empresaId, today, tomorrow);
        console.log(`✅ Disponibilidad calculada con éxito.`);
        console.log(`   Propiedades disponibles: ${availability.availableProperties.length}`);
        console.log(`   Total propiedades: ${availability.allProperties.length}`);
    } catch (error) {
        console.error('❌ Error en getAvailabilityData:', error);
    }

    console.log('\n--- FIN TEST SSR ---');
}

testSSR().catch(console.error);
