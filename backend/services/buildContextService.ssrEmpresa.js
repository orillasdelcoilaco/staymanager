/**
 * Contexto de empresa para SSR (EJS). Extraído de buildContextService para límites de complejidad.
 */
const { IS_POSTGRES } = require('../config/dbConfig');
const pool = require('../db/postgres');

function ssrContextFromEmpresaRecord(empresaId, emp) {
    const cfg = emp?.configuracion || {};
    const ubi = cfg.ubicacion || {};
    const websiteSettings = cfg.websiteSettings || {};
    const general = websiteSettings.general || {};
    const brand = websiteSettings.brand || {};
    const seo = websiteSettings.seo || {};
    const contact = websiteSettings.contact || {};

    return {
        id: empresaId,
        nombre: emp?.nombre || '',
        slogan: cfg.slogan || general.slogan || '',
        historia: cfg.historiaOptimizada || general.historiaEmpresa || cfg.historiaEmpresa || '',
        mision: general.mision || '',
        valores: Array.isArray(general.valores) ? general.valores : [],
        publicoObjetivo: general.publicoObjetivo || '',

        ubicacion: {
            direccion: ubi.direccion || contact.direccionCompleta || '',
            ciudad: ubi.ciudad || general.city || '',
            region: ubi.region || general.region || '',
            pais: ubi.pais || 'Chile',
            lat: ubi.lat || null,
            lng: ubi.lng || null,
            googleMapsUrl: cfg.google_maps_url || '',
        },

        brand: {
            propuestaValor: brand.propuestaValor || '',
            tonoComunicacion: brand.tonoComunicacion || 'profesional',
            estiloVisual: brand.estiloVisual || 'moderno',
        },

        contacto: {
            telefonoPrincipal: contact.telefonoPrincipal || cfg.telefono || '',
            emailContacto: contact.emailContacto || cfg.email || '',
            direccionCompleta: contact.direccionCompleta || ubi.direccion || '',
        },

        seo: {
            metaTitle: seo.metaTitle || '',
            metaDescription: seo.metaDescription || '',
            keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
        },
    };
}

function emptySsrEmpresaContext(empresaId) {
    return {
        id: empresaId,
        nombre: '',
        slogan: '',
        historia: '',
        mision: '',
        valores: [],
        publicoObjetivo: '',
        ubicacion: {
            direccion: '',
            ciudad: '',
            region: '',
            pais: 'Chile',
            lat: null,
            lng: null,
            googleMapsUrl: '',
        },
        brand: {
            propuestaValor: '',
            tonoComunicacion: 'profesional',
            estiloVisual: 'moderno',
        },
        contacto: {
            telefonoPrincipal: '',
            emailContacto: '',
            direccionCompleta: '',
        },
        seo: {
            metaTitle: '',
            metaDescription: '',
            keywords: [],
        },
    };
}

function minimalSsrEmpresaContextOnError(empresaId) {
    return {
        id: empresaId,
        nombre: '',
        slogan: '',
        ubicacion: { ciudad: '', region: '', pais: 'Chile' },
        brand: { tonoComunicacion: 'profesional', estiloVisual: 'moderno' },
        contacto: {},
        seo: {},
    };
}

/**
 * @param {Object} db - Firestore (modo dual)
 * @param {string} empresaId
 */
const getEmpresaContextForSSR = async (db, empresaId) => {
    try {
        if (IS_POSTGRES) {
            const { rows } = await pool.query(
                `SELECT nombre, configuracion FROM empresas WHERE id = $1`,
                [empresaId]
            );
            if (rows[0]) return ssrContextFromEmpresaRecord(empresaId, rows[0]);
        }

        if (db) {
            const empresaDoc = await db.collection('empresas').doc(empresaId).get();
            if (empresaDoc.exists) return ssrContextFromEmpresaRecord(empresaId, empresaDoc.data());
        }

        return emptySsrEmpresaContext(empresaId);
    } catch (error) {
        console.error(`[getEmpresaContextForSSR] Error obteniendo contexto para empresa ${empresaId}:`, error);
        return minimalSsrEmpresaContextOnError(empresaId);
    }
};

module.exports = {
    getEmpresaContextForSSR,
};
