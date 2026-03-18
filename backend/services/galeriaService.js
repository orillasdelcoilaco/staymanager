/**
 * galeriaService.js
 *
 * Gestión de la galería de fotos por propiedad.
 * Schema Firestore: empresas/{id}/propiedades/{id}/galeria/{fotoId}
 *
 * Campos por foto:
 *   originalUrl   — URL original del sitio del cliente
 *   storagePath   — path en Firebase Storage (full 1200px WebP)
 *   storageUrl    — URL pública full
 *   thumbnailUrl  — URL pública thumbnail (400px WebP)
 *   espacio       — nombre del espacio ("Cocina", "Dormitorio", null)
 *   espacioId     — ID del componente en Firestore (null si pendiente)
 *   confianza     — 0.0-1.0 (0.85=Vision, 0.5=URL keyword, 0.2=sin match)
 *   estado        — 'auto' | 'manual' | 'pendiente' | 'descartada'
 *   rol           — 'principal' | 'adicional'
 *   altText       — texto SEO alt
 *   orden         — orden dentro del espacio
 *   fechaImport   — ISO string
 */

const { v4: uuidv4 } = require('uuid');
const { uploadFile } = require('./storageService');
const { optimizeImage } = require('./imageProcessingService');

/**
 * Retorna todas las fotos de la galería de una propiedad.
 * Filtros opcionales: estado, espacio.
 */
async function getGaleria(db, empresaId, propiedadId, filters = {}) {
    let query = db
        .collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId)
        .collection('galeria');

    if (filters.estado) query = query.where('estado', '==', filters.estado);
    if (filters.espacio) query = query.where('espacio', '==', filters.espacio);

    const snap = await query.get();
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
}

/**
 * Actualiza campos editables de una foto.
 * - Si espacio cambia a un valor → estado='manual', confianza=1.0
 * - Si espacio se borra (null) → estado='pendiente', confianza=0.2
 */
async function updateFoto(db, empresaId, propiedadId, fotoId, updates) {
    const allowed = ['espacio', 'espacioId', 'estado', 'rol', 'orden', 'altText'];
    const data = {};
    for (const key of allowed) {
        if (updates[key] !== undefined) data[key] = updates[key];
    }
    if (updates.espacio !== undefined) {
        if (updates.espacio) {
            data.estado = 'manual';
            data.confianza = 1.0;
        } else {
            data.estado = 'pendiente';
            data.confianza = 0.2;
            data.espacioId = null;
        }
    }
    if (Object.keys(data).length === 0) return;

    await db
        .collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId)
        .collection('galeria').doc(fotoId)
        .update(data);
}

/**
 * Marca una foto como descartada (soft delete).
 */
async function descartarFoto(db, empresaId, propiedadId, fotoId) {
    await db
        .collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId)
        .collection('galeria').doc(fotoId)
        .update({ estado: 'descartada' });
}

/**
 * Confirma una foto pendiente (pendiente → auto).
 */
async function confirmarFoto(db, empresaId, propiedadId, fotoId) {
    await db
        .collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId)
        .collection('galeria').doc(fotoId)
        .update({ estado: 'auto', confianza: 1.0 });
}

/**
 * Sincroniza las fotos confirmadas (auto + manual) al websiteData.images de la propiedad.
 * Solo fotos con espacioId definido y estado != 'descartada'.
 * Actualiza también websiteData.cardImage con la primera foto.
 *
 * @returns {{ total, componentes }} — resumen de la operación
 */
async function syncToWebsite(db, empresaId, propiedadId) {
    const snap = await db
        .collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId)
        .collection('galeria')
        .where('estado', 'in', ['auto', 'manual'])
        .get();

    const images = {};
    let cardImage = null;

    const fotos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(f => f.espacioId)
        .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));

    for (const foto of fotos) {
        const imageObj = {
            imageId: foto.id,
            storagePath: foto.storageUrl,
            altText: foto.altText || '',
            title: `${foto.espacio || 'Vista'} - ${foto.altText || ''}`,
            description: foto.altText || '',
            orden: foto.orden || 0
        };
        if (!images[foto.espacioId]) images[foto.espacioId] = [];
        images[foto.espacioId].push(imageObj);
        if (!cardImage) cardImage = imageObj;
    }

    await db
        .collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId)
        .update({
            'websiteData.images': images,
            'websiteData.cardImage': cardImage
        });

    return { total: fotos.length, componentes: Object.keys(images).length };
}

/**
 * Sube uno o más archivos a Storage y los agrega a la galería con estado='pendiente'.
 * Genera full (1200px) + thumbnail (400px) para cada archivo.
 *
 * @param {Array} files — array de objetos { buffer, originalname } (Multer)
 * @returns {Array} — fotos creadas con id, storageUrl, thumbnailUrl
 */
async function uploadFotoToGaleria(db, empresaId, propiedadId, files, nombreEmpresa = '') {
    const galeriaRef = db
        .collection('empresas').doc(empresaId)
        .collection('propiedades').doc(propiedadId)
        .collection('galeria');

    const results = [];

    for (const file of files) {
        const fotoId = uuidv4();
        const base = `empresas/${empresaId}/propiedades/${propiedadId}/galeria/${fotoId}`;

        const { buffer: fullBuffer } = await optimizeImage(file.buffer, { maxWidth: 1200, quality: 82 });
        const { buffer: thumbBuffer } = await optimizeImage(file.buffer, { maxWidth: 400, quality: 75 });

        const [storageUrl, thumbnailUrl] = await Promise.all([
            uploadFile(fullBuffer, `${base}.webp`, 'image/webp'),
            uploadFile(thumbBuffer, `${base}_thumb.webp`, 'image/webp')
        ]);

        const fotoData = {
            storageUrl,
            thumbnailUrl,
            storagePath: storageUrl,
            espacio: null,
            espacioId: null,
            confianza: 0.2,
            estado: 'pendiente',
            rol: 'adicional',
            altText: '',
            orden: 99,
            fechaImport: new Date().toISOString(),
            origen: 'upload_manual'
        };

        await galeriaRef.doc(fotoId).set(fotoData);
        results.push({ id: fotoId, ...fotoData });
    }

    return results;
}

module.exports = { getGaleria, updateFoto, descartarFoto, confirmarFoto, syncToWebsite, uploadFotoToGaleria };
