// backend/services/empresaService.js
const admin = require('firebase-admin');

const obtenerDetallesEmpresa = async (db, empresaId) => {
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
    if (!empresaId) {
        throw new Error('El ID de la empresa es requerido.');
    }
    const empresaRef = db.collection('empresas').doc(empresaId);

    // [LOGICA DOMINIO AUTOMATICO]
    // Si viene websiteSettings.general.subdomain, aseguramos que exista un dominio asociado
    let datosFinales = { ...datos };

    if (datos.websiteSettings && datos.websiteSettings.general && datos.websiteSettings.general.subdomain) {
        const sub = datos.websiteSettings.general.subdomain;
        // Si no trae dominio personalizado o está vacío, forzamos el de suitemanager
        if (!datos.websiteSettings.general.domain) {
            datosFinales.websiteSettings.general.domain = `${sub}.suitemanagers.com`;
        }
        // También actualizamos los campos raíz de websiteSettings para compatibilidad con el resolver
        datosFinales['websiteSettings.subdomain'] = sub;
        datosFinales['websiteSettings.domain'] = datosFinales.websiteSettings.general.domain;
    }

    // .update() maneja correctamente la fusión de campos anidados 
    await empresaRef.update({
        ...datosFinales,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
};

const obtenerProximoIdNumericoCarga = async (db, empresaId) => {
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

    // [FIX] Soportar tanto singular (suitemanager.com) como plural (suitemanagers.com)
    if (hostname.endsWith('.onrender.com') || hostname.endsWith('.suitemanager.com') || hostname.endsWith('.suitemanagers.com')) {
        const subdomain = hostname.split('.')[0];
        console.log(`[TenantResolver] Buscando empresa por subdominio Render/App: ${subdomain}`);
        const qSubdomain = empresasRef.where('websiteSettings.subdomain', '==', subdomain).limit(1);
        const subdomainSnapshot = await qSubdomain.get();
        if (!subdomainSnapshot.empty) {
            const doc = subdomainSnapshot.docs[0];
            console.log(`[TenantResolver] Empresa encontrada por subdominio: ${doc.id}`);
            return { id: doc.id, ...doc.data() };
        }
        console.log(`[TenantResolver] No se encontró empresa para el subdominio: ${subdomain}`);
    }

    console.log(`[TenantResolver] Buscando empresa por dominio principal: ${hostname}`);
    const qDomain = empresasRef.where('websiteSettings.domain', '==', hostname).limit(1);
    const domainSnapshot = await qDomain.get();

    if (!domainSnapshot.empty) {
        const doc = domainSnapshot.docs[0];
        console.log(`[TenantResolver] Empresa encontrada por dominio principal: ${doc.id}`);
        return { id: doc.id, ...doc.data() };
    }

    console.log(`[TenantResolver] No se encontró empresa para el hostname: ${hostname}`);
    return null;
};

module.exports = {
    obtenerDetallesEmpresa,
    actualizarDetallesEmpresa,
    obtenerProximoIdNumericoCarga,
    obtenerEmpresaPorDominio
};