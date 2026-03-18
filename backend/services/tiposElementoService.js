const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { analizarCapacidadDeActivo } = require('./aiContentService'); // AI Integration

const COLLECTION_NAME = 'tiposElemento';

/**
 * Obtiene todos los tipos de elemento de una empresa.
 * @param {Object} db
 * @param {string} empresaId 
 * @returns {Promise<Array>}
 */
async function obtenerTipos(db, empresaId) {
    try {
        const snapshot = await db.collection('empresas')
            .doc(empresaId)
            .collection(COLLECTION_NAME)
            .get();

        if (snapshot.empty) return [];

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error al obtener tipos de elemento:", error);
        throw new Error("Error al obtener tipos de elemento.");
    }
}

/**
 * Crea un nuevo tipo de elemento.
 * @param {Object} db
 * @param {string} empresaId 
 * @param {Object} datos - { nombre, categoria, icono, permiteCantidad }
 * @returns {Promise<Object>}
 */
async function crearTipo(db, empresaId, datos) {
    try {
        const id = uuidv4();

        // Normalización de Texto (Title Case para Categorías)
        const normalizeCategory = (cat) => {
            const trimmed = (cat || 'OTROS').trim().toLowerCase();
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        };

        const nuevoTipo = {
            nombre: datos.nombre ? datos.nombre.trim() : 'Sin Nombre',
            categoria: normalizeCategory(datos.categoria),
            icono: datos.icono || '🔹',
            permiteCantidad: datos.permiteCantidad !== false,
            countable: datos.countable || false,
            count_value_default: datos.count_value_default || 0,
            capacity: datos.capacity || 0,
            photo_requirements_default: Array.isArray(datos.photo_requirements_default) ? datos.photo_requirements_default : [],

            // New AI Metadata
            requires_photo: datos.requires_photo || false,
            photo_quantity: datos.photo_quantity || 0,
            seo_tags: datos.seo_tags || [],
            sales_context: datos.sales_context || null,
            photo_guidelines: datos.photo_guidelines || null,

            // SEO Semántico (Schema.org)
            schema_type: datos.schema_type || 'Thing', // ej: 'BedDetails', 'LocationFeatureSpecification'
            schema_property: datos.schema_property || 'amenityFeature', // ej: 'bed', 'amenityFeature'

            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('empresas')
            .doc(empresaId)
            .collection(COLLECTION_NAME)
            .doc(id)
            .set(nuevoTipo);

        return { id, ...nuevoTipo };
    } catch (error) {
        console.error("Error al crear tipo de elemento:", error);
        throw new Error("Error al crear tipo de elemento.");
    }
}

/**
 * Elimina un tipo de elemento.
 * @param {Object} db
 * @param {string} empresaId 
 * @param {string} tipoId 
 */
async function eliminarTipo(db, empresaId, tipoId) {
    // 1. Obtener datos del elemento para buscar por nombre/ID
    const elementRef = db.collection('empresas').doc(empresaId).collection(COLLECTION_NAME).doc(tipoId);
    const elementDoc = await elementRef.get();

    if (!elementDoc.exists) {
        throw new Error("El elemento no existe.");
    }

    const elementData = elementDoc.data();
    const elementName = (elementData.nombre || '').toUpperCase().trim();

    // 2. Verificar uso en Propiedades (Inventario Activo)
    const propsSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').get();

    let usoEncontrado = null;

    propsSnapshot.forEach(doc => {
        if (usoEncontrado) return;

        const prop = doc.data();
        if (prop.componentes && Array.isArray(prop.componentes)) {
            prop.componentes.forEach(comp => {
                if (usoEncontrado) return;

                if (comp.elementos && Array.isArray(comp.elementos)) {
                    const match = comp.elementos.find(el => {
                        const elNombre = (el.nombre || '').toUpperCase().trim();
                        // Comparar por nombre (lo más común) o ID si existiera referencia
                        return elNombre === elementName;
                    });

                    if (match) {
                        usoEncontrado = `${prop.nombre} (en ${comp.nombre || comp.tipo})`;
                    }
                }
            });
        }
    });

    if (usoEncontrado) {
        throw new Error(`No se puede eliminar: El elemento '${elementData.nombre}' está en uso en: ${usoEncontrado}. Elimínalo del inventario primero.`);
    }

    // 3. (Opcional) Verificar uso en Plantillas/Tipos de Componente si existiera esa estructura
    // Por ahora validamos contra lo que está vivo en propiedades.

    await elementRef.delete();
}

/**
 * Actualiza un tipo de elemento existente.
 */
async function actualizarTipo(db, empresaId, tipoId, datos) {
    const elementRef = db.collection('empresas').doc(empresaId).collection(COLLECTION_NAME).doc(tipoId);

    // Limpieza de datos (mismos campos que al crear, pero opcionales)
    const datosActualizados = {};
    if (datos.nombre) datosActualizados.nombre = datos.nombre.trim();
    if (datos.categoria) {
        const trimmed = datos.categoria.trim().toLowerCase();
        datosActualizados.categoria = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
    if (datos.icono) datosActualizados.icono = datos.icono;
    if (datos.capacity !== undefined) datosActualizados.capacity = Number(datos.capacity);
    if (datos.permiteCantidad !== undefined) datosActualizados.permiteCantidad = Boolean(datos.permiteCantidad);
    if (datos.countable !== undefined) datosActualizados.countable = Boolean(datos.countable);

    // New Metadata (SEO & Photos) - Only update if provided
    if (datos.requires_photo !== undefined) datosActualizados.requires_photo = Boolean(datos.requires_photo);
    if (datos.photo_quantity !== undefined) datosActualizados.photo_quantity = Number(datos.photo_quantity);
    if (datos.seo_tags) datosActualizados.seo_tags = datos.seo_tags;
    if (datos.sales_context) datosActualizados.sales_context = datos.sales_context;
    if (datos.photo_guidelines) datosActualizados.photo_guidelines = datos.photo_guidelines;

    // Timestamp update
    datosActualizados.fechaActualizacion = admin.firestore.FieldValue.serverTimestamp();

    await elementRef.update(datosActualizados);

    // Retornar datos completos
    const doc = await elementRef.get();
    return { id: tipoId, ...doc.data() };
}

module.exports = {
    obtenerTipos,
    crearTipo,
    eliminarTipo,
    actualizarTipo,
    buscarTipoFuzzy
};

// --- CACHE & ZERO-SHOT LOGIC ---
const Fuse = require('fuse.js');
const CACHE_TIPOS = {}; // { empresaId: { data: [], timestamp: number } }
const CACHE_TTL = 1000 * 60 * 5; // 5 minutos de cache

async function getCachedTipos(db, empresaId) {
    const now = Date.now();
    if (CACHE_TIPOS[empresaId] && (now - CACHE_TIPOS[empresaId].timestamp < CACHE_TTL)) {
        return CACHE_TIPOS[empresaId].data;
    }
    const data = await obtenerTipos(db, empresaId);
    CACHE_TIPOS[empresaId] = { data, timestamp: now };
    return data;
}

/**
 * Busca un tipo de elemento existente usando Fuzzy Matching (Fuse.js).
 * Evita llamar a la IA para duplicados o typos.
 * @returns {Promise<Object|null>} El match encontrado o null.
 */
async function buscarTipoFuzzy(db, empresaId, query) {
    if (!query) return null;
    const cleanQuery = query.toLowerCase().trim();

    // 1. Cargar datos (Cache First)
    const tipos = await getCachedTipos(db, empresaId);
    if (tipos.length === 0) return null;

    // 2. Configurar Fuse
    const options = {
        includeScore: true,
        keys: ['nombre', 'seo_tags'], // Buscar en nombre y tags
        threshold: 0.4, // 0.0 = match perfecto, 1.0 = match cualquiera. 0.4 es balanceado para "cama king" vs "king cama"
    };

    const fuse = new Fuse(tipos, options);
    const result = fuse.search(cleanQuery);

    if (result.length > 0) {
        const bestMatch = result[0];
        // Si el score es muy bueno (< 0.3), retornamos confianza alta
        if (bestMatch.score < 0.3) {
            console.log(`[FuzzyMatch] Encontrado: '${query}' -> '${bestMatch.item.nombre}' (Score: ${bestMatch.score})`);
            return bestMatch.item;
        }
    }
    return null;
}
