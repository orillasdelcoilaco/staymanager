/**
 * @deprecated 2026-05: `obtenerEmpresaPorDominio` en `empresaService.js` resuelve contra **PostgreSQL**
 * (`DATABASE_URL`); escribe en **Firestore** pero el resolver no lee esta colección en modo PG.
 * Para validar `*.rezerva.cl`, insertar fila de prueba en `empresas` (PG) o reescribir el test hacia SQL.
 * Hosts `*.suitemanager.com` / `*.suitemanagers.com` dejaron de ser el sufijo canónico (`PLATFORM_DOMAIN`).
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');
const { actualizarDetallesEmpresa, obtenerDetallesEmpresa, obtenerEmpresaPorDominio } = require('../services/empresaService');

// Inicializar Firebase si no está inicializado
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function testSubdomainLogic() {
    console.log('🧪 Iniciando prueba de lógica de subdominio y resolución...');

    // 1. Crear una empresa de prueba
    const testId = 'test-plural-' + Date.now();
    const empresaRef = db.collection('empresas').doc(testId);

    await empresaRef.set({
        nombre: 'Empresa Plural Test',
        websiteSettings: {
            subdomain: 'pluraltest',
            general: {
                subdomain: 'pluraltest'
            }
        }
    });
    console.log(`✅ Empresa de prueba creada: ${testId} (subdomain: pluraltest)`);

    try {
        // 2. Probar resolución con dominio SINGULAR
        console.log('\n🔍 Probando resolución SINGULAR (pluraltest.suitemanager.com)...');
        const resSingular = await obtenerEmpresaPorDominio(db, 'pluraltest.suitemanager.com');
        if (resSingular && resSingular.id === testId) {
            console.log('✅ ÉXITO: Resuelto correctamente (Singular).');
        } else {
            console.error('❌ FALLO: No se resolvió el dominio singular.');
        }

        // 3. Probar resolución con dominio PLURAL
        console.log('\n🔍 Probando resolución PLURAL (pluraltest.suitemanagers.com)...');
        const resPlural = await obtenerEmpresaPorDominio(db, 'pluraltest.suitemanagers.com');
        if (resPlural && resPlural.id === testId) {
            console.log('✅ ÉXITO: Resuelto correctamente (Plural).');
        } else {
            console.error('❌ FALLO: No se resolvió el dominio plural.');
        }

    } catch (error) {
        console.error('❌ Error durante la prueba:', error);
    } finally {
        // Limpieza
        await empresaRef.delete();
        console.log('\n🧹 Empresa de prueba eliminada.');
    }
}

testSubdomainLogic().catch(console.error);
