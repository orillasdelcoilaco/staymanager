/**
 * backend/services/buildContextService.js
 *
 * Maneja el PropertyBuildContext — la "memoria" del wizard de propiedades.
 * Se persiste en propiedades.metadata.buildContext (JSONB, sin cambio de schema).
 *
 * Diseño no-destructivo: cada sección se actualiza de forma independiente
 * usando jsonb_set con || (merge), no sobreescribiendo todo el metadata.
 */

const { IS_POSTGRES } = require('../config/dbConfig');
const pool = require('../db/postgres');
const { contarDistribucion } = require('./propiedadLogicService');
const { getEmpresaContextForSSR } = require('./buildContextService.ssrEmpresa');

/**
 * Esqueleto vacío del buildContext — garantiza que siempre se retorna
 * una estructura consistente aunque no existan datos aún.
 * EXTENDIDO para soportar configuración SSR corporativa completa.
 */
const _esqueleto = () => ({
    empresa: {
        // Identidad básica
        nombre: '',
        tipo: '',
        enfoque: '',

        // Ubicación
        ubicacion: {
            direccion: '',
            ciudad: '',
            region: '',
            pais: 'Chile',
            lat: null,
            lng: null,
            googleMapsUrl: '',
        },

        // Identidad corporativa
        slogan: '',
        historia: '',
        mision: '',
        valores: [],
        publicoObjetivo: '',

        // Estrategia de marca
        brand: {
            propuestaValor: '',
            tonoComunicacion: 'profesional',
            posicionamiento: '',
            experienciaCliente: '',
        },

        // Identidad visual
        visual: {
            paletaColores: {},
            logos: {},
            tipografia: {},
            estiloVisual: 'moderno',
        },

        // SEO corporativo
        seo: {
            metaTitle: '',
            metaDescription: '',
            keywords: [],
            googleBusinessId: '',
            structuredData: {},
        },

        // Contacto
        contacto: {
            telefonoPrincipal: '',
            emailContacto: '',
            direccionCompleta: '',
            redesSociales: {},
            horarioAtencion: '',
            whatsapp: '',
        },

        // Información adicional
        tipoAlojamientoPrincipal: '',
        aniosExperiencia: 0,
        certificaciones: [],
        premios: [],
    },
    producto: {
        nombre: '',
        tipo: '',
        capacidad: 0,
        numPiezas: 0,
        numBanos: 0,
        descripcionLibre: '',
        espacios: [],
    },
    compartidas: [],
    narrativa: null,
    fotos: {
        planGenerado: false,
        resumenFotos: { total: 0, confirmadas: 0, pendientes: 0 },
    },
    publicacion: {
        metaTitle: '',
        metaDescription: '',
        /** Palabras clave opcionales (IA / wizard) para meta keywords en SSR */
        keywords: [],
        jsonLd: null,
        publicadoEn: null,
    },
});

/**
 * Lee el buildContext actual de una propiedad.
 * Enriquece SIEMPRE el bloque "empresa" con datos frescos de la tabla empresas
 * (no confiar en lo que esté guardado en el contexto para empresa).
 *
 * @param {*}      db          — ignorado (legacy compat), usa pool directo
 * @param {string} empresaId
 * @param {string} propiedadId
 * @returns {Promise<Object>} buildContext completo
 */
const getBuildContext = async (_db, empresaId, propiedadId) => {
    if (!pool) throw new Error('PostgreSQL no disponible');

    const [propRow, empRow] = await Promise.all([
        pool.query(
            `SELECT metadata, nombre, capacidad, num_piezas, descripcion
             FROM   propiedades
             WHERE  id = $1 AND empresa_id = $2`,
            [propiedadId, empresaId]
        ),
        pool.query(
            `SELECT nombre, configuracion
             FROM   empresas
             WHERE  id = $1`,
            [empresaId]
        ),
    ]);

    if (!propRow.rows[0]) throw new Error('Propiedad no encontrada');

    const meta = propRow.rows[0].metadata || {};
    const base = Object.assign(_esqueleto(), meta.buildContext || {});

    // Bloque empresa siempre fresco desde la tabla - EXTENDIDO PARA SSR CORPORATIVO
    const emp = empRow.rows[0];
    const cfg = emp?.configuracion || {};
    const ubi = cfg.ubicacion || {};
    const websiteSettings = cfg.websiteSettings || {};
    const general = websiteSettings.general || {};
    const brand = websiteSettings.brand || {};
    const seo = websiteSettings.seo || {};
    const contact = websiteSettings.contact || {};

    base.empresa = {
        // Identidad básica
        nombre: emp?.nombre || '',
        tipo: cfg.tipoAlojamientoPrincipal || general.businessType || '',
        enfoque: cfg.enfoqueMarketing || general.enfoqueMarketing || '',

        // Ubicación
        ubicacion: {
            direccion: ubi.direccion || contact.direccionCompleta || '',
            ciudad:    ubi.ciudad    || general.city    || '',
            region:    ubi.region    || general.region  || '',
            pais:      ubi.pais      || 'Chile',
            lat:       ubi.lat       || null,
            lng:       ubi.lng       || null,
            googleMapsUrl: cfg.google_maps_url || '',
        },

        // Identidad corporativa (para IA y SSR)
        slogan: cfg.slogan || general.slogan || '',
        historia: cfg.historiaOptimizada || general.historiaEmpresa || cfg.historiaEmpresa || '',
        mision: general.mision || '',
        valores: Array.isArray(general.valores) ? general.valores : [],
        publicoObjetivo: general.publicoObjetivo || '',

        // Estrategia de marca
        brand: {
            propuestaValor: brand.propuestaValor || '',
            tonoComunicacion: brand.tonoComunicacion || 'profesional',
            posicionamiento: brand.posicionamiento || '',
            experienciaCliente: brand.experienciaCliente || '',
        },

        // Identidad visual
        visual: {
            paletaColores: brand.paletaColores || {},
            logos: brand.logos || {},
            tipografia: brand.tipografia || {},
            estiloVisual: brand.estiloVisual || 'moderno',
        },

        // SEO corporativo
        seo: {
            metaTitle: seo.metaTitle || '',
            metaDescription: seo.metaDescription || '',
            keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
            googleBusinessId: seo.googleBusinessId || '',
            structuredData: seo.structuredData || {},
        },

        // Contacto y presencia online
        contacto: {
            telefonoPrincipal: contact.telefonoPrincipal || cfg.telefono || '',
            emailContacto: contact.emailContacto || cfg.email || '',
            direccionCompleta: contact.direccionCompleta || ubi.direccion || '',
            redesSociales: contact.redesSociales || {},
            horarioAtencion: contact.horarioAtencion || '',
            whatsapp: contact.whatsapp || '',
        },

        // Información adicional para IA
        tipoAlojamientoPrincipal: general.tipoAlojamientoPrincipal || cfg.tipoAlojamientoPrincipal || '',
        aniosExperiencia: general.aniosExperiencia || 0,
        certificaciones: Array.isArray(general.certificaciones) ? general.certificaciones : [],
        premios: Array.isArray(general.premios) ? general.premios : [],
    };

    // Asegurar datos básicos del producto desde las columnas reales
    const prop = propRow.rows[0];
    base.producto.nombre = base.producto.nombre || prop.nombre || '';
    base.producto.capacidad = base.producto.capacidad || prop.capacidad || 0;
    base.producto.numPiezas = base.producto.numPiezas || prop.num_piezas || 0;
    base.producto.numBanos = base.producto.numBanos || meta.numBanos || 0;
    base.producto.descripcionLibre = base.producto.descripcionLibre || prop.descripcion || '';

    // Áreas comunes del recinto vinculadas a ESTA unidad (metadata.areas_comunes_ids)
    const areasConf = cfg.areas_comunes || {};
    const rawIds = meta.areas_comunes_ids || meta.areasComunesIds || [];
    const selectedSet = new Set(
        (Array.isArray(rawIds) ? rawIds : []).map((id) => String(id).trim()).filter(Boolean)
    );
    if (areasConf.activo && Array.isArray(areasConf.espacios) && areasConf.espacios.length && selectedSet.size) {
        base.compartidas = areasConf.espacios.filter((a) => a && selectedSet.has(String(a.id ?? '').trim()));
    } else {
        base.compartidas = [];
    }

    return base;
};

/**
 * Obtiene solo el contexto de empresa (sin datos de propiedad específica).
 * Para uso en generación de contenido corporativo (home, about, contacto, etc.)
 *
 * @param {string} empresaId
 * @returns {Promise<Object>} contexto de empresa completo
 */
const getEmpresaContext = async (empresaId) => {
    if (!pool) throw new Error('PostgreSQL no disponible');

    const { rows } = await pool.query(
        `SELECT nombre, configuracion FROM empresas WHERE id = $1`,
        [empresaId]
    );

    if (!rows[0]) throw new Error('Empresa no encontrada');

    const emp = rows[0];
    const cfg = emp?.configuracion || {};
    const ubi = cfg.ubicacion || {};
    const websiteSettings = cfg.websiteSettings || {};
    const general = websiteSettings.general || {};
    const brand = websiteSettings.brand || {};
    const seo = websiteSettings.seo || {};
    const contact = websiteSettings.contact || {};

    return {
        // Identidad básica
        nombre: emp?.nombre || '',
        tipo: cfg.tipoAlojamientoPrincipal || general.businessType || '',
        enfoque: cfg.enfoqueMarketing || general.enfoqueMarketing || '',

        // Ubicación
        ubicacion: {
            direccion: ubi.direccion || contact.direccionCompleta || '',
            ciudad:    ubi.ciudad    || general.city    || '',
            region:    ubi.region    || general.region  || '',
            pais:      ubi.pais      || 'Chile',
            lat:       ubi.lat       || null,
            lng:       ubi.lng       || null,
            googleMapsUrl: cfg.google_maps_url || '',
        },

        // Identidad corporativa
        slogan: cfg.slogan || general.slogan || '',
        historia: cfg.historiaOptimizada || general.historiaEmpresa || cfg.historiaEmpresa || '',
        mision: general.mision || '',
        valores: Array.isArray(general.valores) ? general.valores : [],
        publicoObjetivo: general.publicoObjetivo || '',

        // Estrategia de marca
        brand: {
            propuestaValor: brand.propuestaValor || '',
            tonoComunicacion: brand.tonoComunicacion || 'profesional',
            posicionamiento: brand.posicionamiento || '',
            experienciaCliente: brand.experienciaCliente || '',
        },

        // Identidad visual
        visual: {
            paletaColores: brand.paletaColores || {},
            logos: brand.logos || {},
            tipografia: brand.tipografia || {},
            estiloVisual: brand.estiloVisual || 'moderno',
        },

        // SEO corporativo
        seo: {
            metaTitle: seo.metaTitle || '',
            metaDescription: seo.metaDescription || '',
            keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
            googleBusinessId: seo.googleBusinessId || '',
            structuredData: seo.structuredData || {},
        },

        // Contacto y presencia online
        contacto: {
            telefonoPrincipal: contact.telefonoPrincipal || cfg.telefono || '',
            emailContacto: contact.emailContacto || cfg.email || '',
            direccionCompleta: contact.direccionCompleta || ubi.direccion || '',
            redesSociales: contact.redesSociales || {},
            horarioAtencion: contact.horarioAtencion || '',
            whatsapp: contact.whatsapp || '',
        },

        // Información adicional
        tipoAlojamientoPrincipal: general.tipoAlojamientoPrincipal || cfg.tipoAlojamientoPrincipal || '',
        aniosExperiencia: general.aniosExperiencia || 0,
        certificaciones: Array.isArray(general.certificaciones) ? general.certificaciones : [],
        premios: Array.isArray(general.premios) ? general.premios : [],
    };
};

/**
 * Escribe una sección del buildContext (merge parcial).
 * No sobreescribe secciones que no se están actualizando.
 *
 * @param {string} empresaId
 * @param {string} propiedadId
 * @param {'producto'|'narrativa'|'fotos'|'publicacion'} seccion
 * @param {Object} datos
 */
const updateBuildContextSection = async (empresaId, propiedadId, seccion, datos) => {
    if (!pool) throw new Error('PostgreSQL no disponible');

    await pool.query(
        `UPDATE propiedades
         SET    metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{buildContext}',
                    COALESCE(metadata->'buildContext', '{}'::jsonb)
                    || jsonb_build_object($3::text, $4::jsonb)
                ),
                updated_at = NOW()
         WHERE  id = $1 AND empresa_id = $2`,
        [propiedadId, empresaId, seccion, JSON.stringify(datos)]
    );
};

/** Normaliza keywords SEO y fusiona publicacion anterior con el resultado de la IA (sin borrar publicadoEn, etc.). */
function coerceKeywordList(kw) {
    if (kw == null) return [];
    if (Array.isArray(kw)) return kw;
    if (typeof kw === 'string') return kw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    return [];
}

function normalizePublicacionKeywords(kw) {
    return [...new Set(coerceKeywordList(kw).map((x) => String(x).trim()).filter(Boolean))].slice(0, 30);
}

function mergePublicacionForPersist(prev = {}, incoming = {}) {
    const merged = { ...prev, ...incoming };
    const fromAi = normalizePublicacionKeywords(incoming.keywords);
    merged.keywords = fromAi.length ? fromAi : normalizePublicacionKeywords(prev.keywords);
    return merged;
}

// ── Helpers de construirProductoDesdeComponentes ─────────────────────────────

const _normNombre = (n) =>
    (n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const _schemaTypeComp = (nombre, categoria) => {
    const n = _normNombre(nombre || '');
    if (/hot.?tub|tinaja|jacuzzi|hidromasaje/.test(n)) return 'HotTub';
    const catMap = {
        dormitorio: 'Bedroom', bano: 'Bathroom', living: 'LivingRoom',
        cocina: 'Kitchen', comedor: 'DiningRoom', terraza: 'Terrace',
    };
    return catMap[_normNombre(categoria || '')] || 'LocationFeatureSpecification';
};

const _buildCompActivo = (comp, tipoComp) => ({
    nombre: comp.nombre || comp.tipo || '',
    schema_type: _schemaTypeComp(comp.nombre || comp.tipo, tipoComp.categoria),
    schema_property: null,
    capacity: 0, cantidad: 1,
    seo_tags: tipoComp.palabras_clave || [],
    sales_context: tipoComp.seo_description || comp.nombre || comp.tipo || '',
    requires_photo: false, photo_guidelines: null,
});

const _buildElemActivo = (elem, tiposIdx) => {
    const tipo = tiposIdx[_normNombre(elem.nombre || elem.tipo || '')] || {};
    return {
        nombre: elem.nombre || elem.tipo || '',
        schema_type: tipo.schema_type || 'LocationFeatureSpecification',
        schema_property: tipo.schema_property ?? null,
        capacity: tipo.capacity ?? elem.capacity ?? 0,
        cantidad: elem.cantidad || 1,
        seo_tags: tipo.seo_tags || [],
        sales_context: tipo.sales_context || elem.nombre || '',
        requires_photo: tipo.requires_photo ?? false,
        photo_guidelines: tipo.photo_guidelines || null,
    };
};

/**
 * Construye el bloque "producto" desde los componentes actuales de la propiedad.
 * Enriquece cada activo con datos semánticos (schema_type, seo_tags, etc.)
 *
 * @param {string} empresaId
 * @param {string} propiedadId
 * @returns {Promise<Object>} bloque producto actualizado
 */
const construirProductoDesdeComponentes = async (_db, empresaId, propiedadId) => {
    if (!pool) return null;

    const { rows: propRows } = await pool.query(
        `SELECT nombre, capacidad, num_piezas, descripcion, metadata
         FROM   propiedades WHERE id = $1 AND empresa_id = $2`,
        [propiedadId, empresaId]
    );
    if (!propRows[0]) return null;

    const prop = propRows[0];
    const meta = prop.metadata || {};
    const componentes = meta.componentes || [];

    const [{ rows: tiposRows }, { rows: tiposCompRows }] = await Promise.all([
        pool.query(
            `SELECT nombre, capacity, countable, requires_photo, photo_quantity,
                    photo_guidelines, seo_tags, sales_context, schema_type,
                    schema_property, icono, categoria
             FROM   tipos_elemento WHERE empresa_id = $1`, [empresaId]
        ),
        pool.query(
            `SELECT nombre_normalizado, nombre_usuario, categoria,
                    seo_description, palabras_clave
             FROM   tipos_componente WHERE empresa_id = $1`, [empresaId]
        ),
    ]);

    const tiposIdx = {};
    tiposRows.forEach(t => { tiposIdx[_normNombre(t.nombre)] = t; });

    const tiposCompIdx = {};
    tiposCompRows.forEach(t => {
        if (t.nombre_normalizado) tiposCompIdx[_normNombre(t.nombre_normalizado)] = t;
        if (t.nombre_usuario)     tiposCompIdx[_normNombre(t.nombre_usuario)]     = t;
    });

    const espacios = componentes.map(comp => {
        const tipoComp = tiposCompIdx[_normNombre(comp.nombre || comp.tipo || '')] || {};
        return {
            id:       comp.id || '',
            nombre:   comp.nombre || '',
            categoria: tipoComp.categoria || comp.tipo || comp.categoria || '',
            activos: [
                _buildCompActivo(comp, tipoComp),
                ...(comp.elementos || []).map(e => _buildElemActivo(e, tiposIdx)),
            ],
        };
    });

    // Contar distribución correctamente usando la función dedicada
    const { numPiezas: piezasCalculadas, numBanos } = contarDistribucion(componentes);

    const producto = {
        nombre: prop.nombre || '',
        tipo: meta.tipo || '',
        capacidad: prop.capacidad || 0,
        numPiezas: piezasCalculadas || prop.num_piezas || 0,
        numBanos,
        descripcionLibre: prop.descripcion || '',
        espacios,
    };

    await updateBuildContextSection(empresaId, propiedadId, 'producto', producto);
    return producto;
};

/**
 * Obtiene todos los datos necesarios para SSR en una sola query optimizada.
 * Incluye: datos básicos de empresa, identidad visual, y contexto completo.
 *
 * @param {string} empresaId - ID de la empresa
 * @returns {Promise<Object>} Datos completos optimizados para SSR
 */
const getSSROptimizedData = async (empresaId) => {
    if (!pool) throw new Error('PostgreSQL no disponible');

    try {
        // Query única que obtiene todos los datos necesarios
        const { rows } = await pool.query(
            `SELECT
                e.nombre,
                e.configuracion,
                e.configuracion->'ubicacion' as ubicacion,
                e.configuracion->'websiteSettings'->'general' as general,
                e.configuracion->'websiteSettings'->'brand' as brand,
                e.configuracion->'websiteSettings'->'seo' as seo,
                e.configuracion->'websiteSettings'->'contact' as contact
             FROM empresas e
             WHERE e.id = $1`,
            [empresaId]
        );

        if (!rows[0]) {
            throw new Error('Empresa no encontrada');
        }

        const row = rows[0];
        const cfg = row.configuracion || {};
        const ubi = row.ubicacion || cfg.ubicacion || {};
        const general = row.general || cfg.websiteSettings?.general || {};
        const brand = row.brand || cfg.websiteSettings?.brand || {};
        const seo = row.seo || cfg.websiteSettings?.seo || {};
        const contact = row.contact || cfg.websiteSettings?.contact || {};

        // Construir respuesta optimizada para SSR
        return {
            // Datos básicos
            id: empresaId,
            nombre: row.nombre || '',

            // Identidad corporativa
            slogan: cfg.slogan || general.slogan || '',
            historia: cfg.historiaOptimizada || general.historiaEmpresa || cfg.historiaEmpresa || '',
            mision: general.mision || '',
            valores: Array.isArray(general.valores) ? general.valores : [],
            publicoObjetivo: general.publicoObjetivo || '',

            // Ubicación
            ubicacion: {
                direccion: ubi.direccion || contact.direccionCompleta || '',
                ciudad: ubi.ciudad || general.city || '',
                region: ubi.region || general.region || '',
                pais: ubi.pais || 'Chile',
                lat: ubi.lat || null,
                lng: ubi.lng || null,
                googleMapsUrl: cfg.google_maps_url || '',
            },

            // Identidad visual y marca
            brand: {
                propuestaValor: brand.propuestaValor || '',
                tonoComunicacion: brand.tonoComunicacion || 'profesional',
                estiloVisual: brand.estiloVisual || 'moderno',
                paletaColores: brand.paletaColores || {},
                logos: brand.logos || {},
                tipografia: brand.tipografia || {},
            },

            // Contacto
            contacto: {
                telefonoPrincipal: contact.telefonoPrincipal || cfg.telefono || '',
                emailContacto: contact.emailContacto || cfg.email || '',
                direccionCompleta: contact.direccionCompleta || ubi.direccion || '',
                redesSociales: contact.redesSociales || {},
                horarioAtencion: contact.horarioAtencion || '',
                whatsapp: contact.whatsapp || '',
            },

            // SEO
            seo: {
                metaTitle: seo.metaTitle || '',
                metaDescription: seo.metaDescription || '',
                keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
                googleBusinessId: seo.googleBusinessId || '',
            },

            // Información adicional
            tipoAlojamientoPrincipal: general.tipoAlojamientoPrincipal || cfg.tipoAlojamientoPrincipal || '',
            aniosExperiencia: general.aniosExperiencia || 0,
            certificaciones: Array.isArray(general.certificaciones) ? general.certificaciones : [],
            premios: Array.isArray(general.premios) ? general.premios : [],

            // Metadata para cache
            _cacheKey: `ssr_optimized_${empresaId}`,
            _timestamp: Date.now()
        };

    } catch (error) {
        console.error(`[getSSROptimizedData] Error obteniendo datos optimizados para empresa ${empresaId}:`, error);
        throw error;
    }
};

module.exports = {
    getBuildContext,
    getEmpresaContext,
    getEmpresaContextForSSR,
    getSSROptimizedData,
    updateBuildContextSection,
    mergePublicacionForPersist,
    construirProductoDesdeComponentes,
};
