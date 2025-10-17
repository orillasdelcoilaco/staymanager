// backend/services/empresaService.js
const admin = require('firebase-admin');

const obtenerDetallesEmpresa = async (db, empresaId) => {
    // ... (código sin cambios)
    if (!empresaId) {
        throw new Error('El ID de la empresa es requerido.');
    }

    const empresaRef = db.collection('empresas').doc(empresaId);
    const doc = await empresaRef.get();

    if (!doc.exists) {
        throw new Error('La empresa no fue encontrada.');
    }

    return doc.data();
};

const actualizarDetallesEmpresa = async (db, empresaId, datos) => {
    // ... (código sin cambios)
     if (!empresaId) {
        throw new Error('El ID de la empresa es requerido.');
    }
    const empresaRef = db.collection('empresas').doc(empresaId);
    await empresaRef.update({
        ...datos,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
};

const obtenerProximoIdNumericoCarga = async (db, empresaId) => {
    // ... (código sin cambios)
    const empresaRef = db.collection('empresas').doc(empresaId);

    return db.runTransaction(async (transaction) => {
        const empresaDoc = await transaction.get(empresaRef);
        if (!empresaDoc.exists) {
            throw new Error("La empresa no existe.");
        }
        const proximoId = (empresaDoc.data().proximoIdCargaNumerico || 0) + 1;

        transaction.update(empresaRef, { proximoIdCargaNumerico: proximoId });

        return proximoId;
    });
};

const obtenerEmpresaPorDominio = async (db, hostname) => {
    const empresasRef = db.collection('empresas');

    // **MODIFICACIÓN CLAVE**: Añadir lógica para subdominios .onrender.com
    if (hostname.endsWith('.onrender.com')) {
        const subdomain = hostname.split('.')[0];
        console.log(`[TenantResolver] Buscando empresa por subdominio Render: ${subdomain}`);
        const qSubdomain = empresasRef.where('websiteSettings.subdomain', '==', subdomain).limit(1);
        const subdomainSnapshot = await qSubdomain.get();
        if (!subdomainSnapshot.empty) {
            const doc = subdomainSnapshot.docs[0];
            console.log(`[TenantResolver] Empresa encontrada por subdominio: ${doc.id}`);
            return { id: doc.id, ...doc.data() };
        }
        console.log(`[TenantResolver] No se encontró empresa para el subdominio Render: ${subdomain}`);
    }

    // Buscar por dominio principal (como antes)
    console.log(`[TenantResolver] Buscando empresa por dominio principal: ${hostname}`);
    const qDomain = empresasRef.where('websiteSettings.domain', '==', hostname).limit(1);
    const domainSnapshot = await qDomain.get();

    if (!domainSnapshot.empty) {
        const doc = domainSnapshot.docs[0];
         console.log(`[TenantResolver] Empresa encontrada por dominio principal: ${doc.id}`);
        return { id: doc.id, ...doc.data() };
    }

    console.log(`[TenantResolver] No se encontró empresa para el hostname: ${hostname}`);
    return null; // Si no se encuentra por ninguno de los métodos
};


module.exports = {
    obtenerDetallesEmpresa,
    actualizarDetallesEmpresa,
    obtenerProximoIdNumericoCarga,
    obtenerEmpresaPorDominio
};