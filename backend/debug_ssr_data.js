const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const { obtenerPropiedadesPorEmpresa } = require('./services/publicWebsiteService');
const { obtenerEmpresaPorDominio } = require('./services/empresaService');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function debugSSR() {
    try {
        const hostname = 'prueba1.suitemanagers.com';
        console.log(`Resolving tenant for: ${hostname}`);

        const empresa = await obtenerEmpresaPorDominio(db, hostname);
        if (!empresa) {
            console.error('Empresa not found for hostname');
            return;
        }
        console.log(`Empresa found: ${empresa.id} (${empresa.nombre})`);

        const propiedades = await obtenerPropiedadesPorEmpresa(db, empresa.id);
        console.log(`Properties found: ${propiedades.length}`);
        propiedades.forEach(p => console.log(` - ${p.id}: ${p.nombre}`));

    } catch (error) {
        console.error('Error:', error);
    }
}

debugSSR();
