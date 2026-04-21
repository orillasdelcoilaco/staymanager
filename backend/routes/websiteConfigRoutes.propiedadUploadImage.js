/**
 * POST /propiedad/:propiedadId/upload-image/:componentId
 * (extraído de websiteConfigRoutes.js por tamaño de archivo)
 */
const { v4: uuidv4 } = require('uuid');

/**
 * Procesa un archivo subido: optimiza, IA metadata, galería + websiteData.images.
 */
async function processComponentImageUpload(file, ctx) {
    const {
        empresaId,
        nombreEmpresa,
        propiedadId,
        componentId,
        propiedad,
        componente,
        shotContext,
        pool,
        db,
        generarMetadataImagen,
        optimizeImage,
        uploadFile,
    } = ctx;

    const fotoId = uuidv4();
    const outputFormat = 'webp';

    const storagePathRelative = `empresas/${empresaId}/propiedades/${propiedadId}/images/${componente.id}/${fotoId}.${outputFormat}`;
    const { buffer: optimizedBuffer } = await optimizeImage(file.buffer, {
        maxWidth: 1200,
        quality: 80,
    });
    const publicUrl = await uploadFile(optimizedBuffer, storagePathRelative, `image/${outputFormat}`);

    let metadata = { altText: componente.nombre, title: componente.nombre };
    try {
        const descPropiedad = propiedad.websiteData?.aiDescription || propiedad.descripcion || '';
        metadata = await generarMetadataImagen(
            nombreEmpresa,
            propiedad.nombre,
            descPropiedad,
            componente.nombre,
            componente.tipo,
            optimizedBuffer,
            shotContext
        );
    } catch (aiError) {
        console.warn('Fallo IA Visión:', aiError.message);
    }

    const imageData = {
        imageId: fotoId,
        storagePath: publicUrl,
        altText: metadata.altText,
        title: metadata.title,
        shotContext,
        advertencia: metadata.advertencia || null,
    };

    try {
        const base = `empresas/${empresaId}/propiedades/${propiedadId}/galeria/${fotoId}`;
        const { buffer: thumbBuffer } = await optimizeImage(file.buffer, { maxWidth: 400, quality: 75 });
        const thumbnailUrl = await uploadFile(thumbBuffer, `${base}_thumb.webp`, 'image/webp');

        if (pool) {
            await pool.query(
                `INSERT INTO galeria (
                        id, empresa_id, propiedad_id, storage_url, thumbnail_url, storage_path,
                        espacio, espacio_id, alt_text, shot_context, confianza, estado, rol, orden, origen
                    ) VALUES ($1, $2, $3, $4, $5, $4, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [
                    fotoId, empresaId, propiedadId, publicUrl, thumbnailUrl,
                    componente.nombre, componentId,
                    metadata.altText || '',
                    shotContext || null,
                    !metadata.advertencia ? 0.95 : 0.85,
                    'manual',
                    'adicional',
                    0,
                    'upload_ia',
                ]
            );
        }
    } catch (galeriaError) {
        console.warn('[upload-image] Error guardando en galeria (continuando...):', galeriaError.message);
    }

    if (pool) {
        await pool.query(
            `UPDATE propiedades
             SET metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb),
                 ARRAY['websiteData', 'images', $3],
                 COALESCE(metadata->'websiteData'->'images'->$3, '[]'::jsonb) || $4::jsonb,
                 true
             ), updated_at = NOW()
             WHERE id = $2 AND empresa_id = $1`,
            [empresaId, propiedadId, componentId, JSON.stringify(imageData)]
        );
    } else {
        const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
        const propiedadDoc = await propiedadRef.get();
        const meta = propiedadDoc.data()?.metadata || {};
        const websiteData = meta.websiteData || {};
        const images = websiteData.images || {};

        if (!images[componentId]) images[componentId] = [];
        images[componentId].push(imageData);

        await propiedadRef.update({
            'metadata.websiteData.images': images,
            'metadata.websiteData.cardImage': images[componentId][0] || null,
        });
    }

    return imageData;
}

/**
 * @param {import('express').Router} router
 * @param {object} deps
 */
function mountPropiedadUploadImage(router, deps) {
    const {
        upload,
        pool,
        db,
        obtenerPropiedadPorId,
        generarMetadataImagen,
        optimizeImage,
        uploadFile,
    } = deps;

    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.array('images'), async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId, componentId } = req.params;
            const shotContext = req.body.shotContext || null;

            if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files.' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });
            const componente = propiedad.componentes?.find((c) => c.id === componentId);
            if (!componente) return res.status(404).json({ error: 'Componente no encontrado.' });

            const ctxBase = {
                empresaId,
                nombreEmpresa,
                propiedadId,
                componentId,
                propiedad,
                componente,
                shotContext,
                pool,
                db,
                generarMetadataImagen,
                optimizeImage,
                uploadFile,
            };

            const resultadosParaFrontend = await Promise.all(
                req.files.map((file) => processComponentImageUpload(file, ctxBase))
            );

            res.status(201).json(resultadosParaFrontend);
        } catch (error) {
            console.error('Error POST upload-image:', error);
            next(error);
        }
    });
}

module.exports = { mountPropiedadUploadImage };
