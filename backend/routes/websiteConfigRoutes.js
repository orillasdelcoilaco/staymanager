// backend/routes/websiteConfigRoutes.js
console.log('[DEBUG] websiteConfigRoutes.js cargando... pool=', require('../db/postgres') ? 'DEFINIDO' : 'NULL');
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const admin = require('firebase-admin');
const pool = require('../db/postgres');
console.log('[DEBUG] websiteConfigRoutes.js pool después de require:', pool ? 'DEFINIDO' : 'NULL');

const { obtenerPropiedadPorId, actualizarPropiedad } = require('../services/propiedadesService');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../services/empresaService');
const {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarMetadataHeroWeb,
    generarSeoHomePage,
    generarContenidoHomePage,
    generarPerfilEmpresa,
    generarNarrativaDesdeContexto,
    generarJsonLdDesdeContexto,
} = require('../services/aiContentService');
const {
    getBuildContext,
    getEmpresaContext,
    updateBuildContextSection,
    mergePublicacionForPersist,
    construirProductoDesdeComponentes,
} = require('../services/buildContextService');
const { uploadFile, deleteFileByPath } = require('../services/storageService');
const { optimizeImage } = require('../services/imageProcessingService');
const { uploadFotoToGaleria, eliminarFoto } = require('../services/galeriaService');
const { mountPropiedadUploadImage } = require('./websiteConfigRoutes.propiedadUploadImage');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = (db) => {
    const router = express.Router();

    mountPropiedadUploadImage(router, {
        upload,
        pool,
        db,
        obtenerPropiedadPorId,
        generarMetadataImagen,
        optimizeImage,
        uploadFile,
    });

    // GET Configuración
    router.get('/configuracion-web', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            res.status(200).json(empresaData.websiteSettings || {});
        } catch (error) { next(error); }
    });

    // PUT Guardar Configuración General (SEO, Content, Theme colors, etc)
    router.put('/home-settings', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const body = req.body; // Puede ser: { general, theme, content, seo } O { websiteSettings, historiaEmpresa, slogan, ... }

            console.log(`[DEBUG home-settings PUT] EmpresaId: ${empresaId}`);
            console.log(`[DEBUG home-settings PUT] Body type: ${typeof body}`);
            console.log(`[DEBUG home-settings PUT] Body keys: ${Object.keys(body || {})}`);
            console.log(`[DEBUG home-settings PUT] Body completo:`, JSON.stringify(body, null, 2));

            // Verificar si el body está vacío o mal formado
            if (!body || Object.keys(body).length === 0) {
                console.error(`[DEBUG home-settings PUT] ERROR: Body vacío o undefined`);
                return res.status(400).json({ error: 'Body vacío. No se recibieron datos para guardar.' });
            }

            // Determinar si es el formato nuevo (combinado) o viejo (solo websiteSettings)
            const tieneWebsiteSettingsComoObjeto = body.websiteSettings && typeof body.websiteSettings === 'object';

            let datosParaGuardar = {};
            let websiteSettings = {};

            if (tieneWebsiteSettingsComoObjeto) {
                // FORMATO NUEVO: Datos combinados { websiteSettings, historiaEmpresa, slogan, ... }
                console.log(`[DEBUG home-settings PUT] Formato NUEVO detectado (datos combinados)`);

                // Extraer websiteSettings del objeto
                if (body.websiteSettings.general) {
                    websiteSettings.general = body.websiteSettings.general;
                    if (body.websiteSettings.general.subdomain) websiteSettings.subdomain = body.websiteSettings.general.subdomain;
                    if (body.websiteSettings.general.domain) websiteSettings.domain = body.websiteSettings.general.domain;
                    console.log(`[DEBUG home-settings PUT] Subdomain configurado: ${body.websiteSettings.general.subdomain}`);
                }
                if (body.websiteSettings.theme) {
                    websiteSettings.theme = {
                        primaryColor: body.websiteSettings.theme.primaryColor,
                        secondaryColor: body.websiteSettings.theme.secondaryColor,
                        logoUrl: body.websiteSettings.theme.logoUrl || ''
                    };
                    if (body.websiteSettings.theme.heroImageUrl) websiteSettings.theme.heroImageUrl = body.websiteSettings.theme.heroImageUrl;
                    if (body.websiteSettings.theme.heroImageAlt) websiteSettings.theme.heroImageAlt = body.websiteSettings.theme.heroImageAlt;
                    if (body.websiteSettings.theme.heroImageTitle) websiteSettings.theme.heroImageTitle = body.websiteSettings.theme.heroImageTitle;
                }
                if (body.websiteSettings.content) websiteSettings.content = body.websiteSettings.content;
                if (body.websiteSettings.seo) websiteSettings.seo = body.websiteSettings.seo;

                // Incluir websiteSettings en datosParaGuardar
                datosParaGuardar.websiteSettings = websiteSettings;

                // Incluir otros datos de empresa si existen
                if (body.historiaEmpresa) datosParaGuardar.historiaEmpresa = body.historiaEmpresa;
                if (body.slogan) datosParaGuardar.slogan = body.slogan;
                if (body.tipoAlojamientoPrincipal) datosParaGuardar.tipoAlojamientoPrincipal = body.tipoAlojamientoPrincipal;
                if (body.enfoqueMarketing) datosParaGuardar.enfoqueMarketing = body.enfoqueMarketing;
                if (body.palabrasClaveAdicionales) datosParaGuardar.palabrasClaveAdicionales = body.palabrasClaveAdicionales;
                if (body.strategy) datosParaGuardar.strategy = body.strategy;

            } else {
                // FORMATO VIEJO: Solo { general, theme, content, seo }
                console.log(`[DEBUG home-settings PUT] Formato VIEJO detectado (solo websiteSettings)`);

                if (body.general) {
                    websiteSettings.general = body.general;
                    if (body.general.subdomain) websiteSettings.subdomain = body.general.subdomain;
                    if (body.general.domain) websiteSettings.domain = body.general.domain;
                    console.log(`[DEBUG home-settings PUT] Subdomain configurado: ${body.general.subdomain}`);
                }
                if (body.theme) {
                    websiteSettings.theme = {
                        primaryColor: body.theme.primaryColor,
                        secondaryColor: body.theme.secondaryColor,
                        logoUrl: body.theme.logoUrl || ''
                    };
                    if (body.theme.heroImageUrl) websiteSettings.theme.heroImageUrl = body.theme.heroImageUrl;
                    if (body.theme.heroImageAlt) websiteSettings.theme.heroImageAlt = body.theme.heroImageAlt;
                    if (body.theme.heroImageTitle) websiteSettings.theme.heroImageTitle = body.theme.heroImageTitle;
                }
                if (body.content) websiteSettings.content = body.content;
                if (body.seo) websiteSettings.seo = body.seo;

                datosParaGuardar.websiteSettings = websiteSettings;
            }

            console.log(`[DEBUG home-settings PUT] websiteSettings a guardar:`, JSON.stringify(websiteSettings, null, 2));
            console.log(`[DEBUG home-settings PUT] datosParaGuardar completos:`, JSON.stringify(datosParaGuardar, null, 2));

            const empresaActualizada = await actualizarDetallesEmpresa(db, empresaId, datosParaGuardar);
            console.log(`[DEBUG home-settings PUT] Configuración guardada exitosamente para empresa ${empresaId}`);

            // Devolver los datos actualizados para que el frontend pueda recargar
            res.status(200).json({
                message: 'Configuración guardada.',
                empresa: empresaActualizada,
                websiteSettings: empresaActualizada?.websiteSettings || websiteSettings
            });
        } catch (error) {
            console.error(`[DEBUG home-settings PUT] Error:`, error);
            next(error);
        }
    });

    // POST Subir Imagen Hero (Portada)
    router.post('/upload-hero-image', upload.single('heroImage'), async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { altText, titleText } = req.body;

            if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

            // 1. Procesar y subir imagen
            const imageId = uuidv4();
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/website/hero-${imageId}.${outputFormat}`;

            // 1. Procesar y subir imagen (Standardized)
            const { buffer: optimizedBuffer, info } = await optimizeImage(req.file.buffer, {
                maxWidth: 1920,
                quality: 85
            });

            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // 2. Determinar Metadata
            let finalAlt = altText;
            let finalTitle = titleText;

            if (!finalAlt || !finalTitle) {
                const empresaData = await obtenerDetallesEmpresa(db, empresaId);
                const contextoExtra = {
                    historia: empresaData.historiaOptimizada || empresaData.historiaEmpresa,
                    slogan: empresaData.slogan
                };

                let metadata;
                try {
                    const empresaCtx = await getEmpresaContext(empresaId).catch(() => null);
                    if (empresaCtx) {
                        metadata = await generarMetadataHeroWeb(empresaCtx, optimizedBuffer);
                    } else {
                        throw new Error('Sin contexto empresa');
                    }
                } catch (e) {
                    console.warn('Fallo generación metadata hero (contexto), usando generarMetadataImagen:', e.message);
                    metadata = await generarMetadataImagen(
                        nombreEmpresa,
                        'Sitio Web Corporativo',
                        contextoExtra.historia || 'Sitio web de turismo',
                        'Imagen de Portada Hero',
                        'Portada Corporativa',
                        optimizedBuffer
                    );
                }

                if (!finalAlt) finalAlt = metadata.altText;
                if (!finalTitle) finalTitle = metadata.title;
            }

            // 3. Guardar en DB
            const websiteSettings = {
                theme: {
                    heroImageUrl: publicUrl,
                    heroImageAlt: finalAlt,
                    heroImageTitle: finalTitle
                }
            };
            await actualizarDetallesEmpresa(db, empresaId, { websiteSettings });

            res.status(201).json({
                'websiteSettings.theme.heroImageUrl': publicUrl,
                'websiteSettings.theme.heroImageAlt': finalAlt,
                'websiteSettings.theme.heroImageTitle': finalTitle
            });
        } catch (error) { next(error); }
    });

    // POST Optimizar Perfil Empresa (Estrategia Completa - Texto)
    router.post('/optimize-profile', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { historia } = req.body;
            if (!historia || typeof historia !== 'string' || historia.trim().length < 20) {
                return res.status(400).json({ error: 'La descripción debe tener al menos 20 caracteres.' });
            }
            const empresaContext = await getEmpresaContext(empresaId).catch(() => null);
            const strategy = await generarPerfilEmpresa(historia.trim(), empresaContext);
            res.status(200).json(strategy);
        } catch (error) {
            if (error.message?.includes('patrones no permitidos')) {
                return res.status(400).json({ error: 'El texto contiene contenido no permitido.' });
            }
            next(error);
        }
    });

    // --- Rutas de Propiedades (Existentes) ---

    router.get('/propiedad/:propiedadId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, req.params.propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });
            res.status(200).json(propiedad.websiteData || { aiDescription: '', images: {}, cardImage: null });
        } catch (error) { next(error); }
    });

    router.put('/propiedad/:propiedadId', async (req, res, next) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file.' });

            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId } = req.params;

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });

            // Limpieza imagen anterior
            if (propiedad.websiteData?.cardImage?.storagePath) {
                await deleteFileByPath(propiedad.websiteData.cardImage.storagePath);
            }

            const imageId = `card-${uuidv4()}`;
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/propiedades/${propiedadId}/images/${imageId}.${outputFormat}`;
            const { buffer: optimizedBuffer } = await optimizeImage(req.file.buffer, {
                maxWidth: 800,
                quality: 80
            });
            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // Metadata IA
            const metadata = await generarMetadataImagen(nombreEmpresa, propiedad.nombre, propiedad.descripcion, 'Imagen Principal', 'Portada', optimizedBuffer);

            const cardImageData = { imageId, storagePath: publicUrl, altText: metadata.altText, title: metadata.title };
            await actualizarPropiedad(db, empresaId, propiedadId, { 'websiteData.cardImage': cardImageData });
            res.status(201).json(cardImageData);
        } catch (error) { next(error); }
    });

    router.delete('/propiedad/:propiedadId/delete-image/:componentId/:imageId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId, componentId, imageId } = req.params;

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });

            const images = propiedad.websiteData?.images?.[componentId] || [];
            const img = images.find(i => i.imageId === imageId);

            // ============================================================
            // ELIMINACIÓN DE AMBOS SISTEMAS (SOLUCIÓN UNIFICADA)
            // ============================================================

            // 1. Eliminar archivo del storage si existe
            if (img?.storagePath) {
                await deleteFileByPath(img.storagePath);
            }

            // 2. Eliminar de la tabla galeria (fuente de verdad centralizada)
            try {
                await eliminarFoto(db, empresaId, propiedadId, imageId);
            } catch (galeriaError) {
                console.warn('[delete-image] Error eliminando de galeria (puede que no exista):', galeriaError.message);
                // Continuamos aunque falle, la foto podría no estar en galeria
            }

            // 3. Eliminar de websiteData.images (comportamiento original)
            if (pool) {
                await pool.query(
                    `UPDATE propiedades
                     SET metadata = jsonb_set(
                         metadata,
                         ARRAY['websiteData', 'images', $3],
                         COALESCE(
                             (SELECT jsonb_agg(elem)
                              FROM jsonb_array_elements(COALESCE(metadata->'websiteData'->'images'->$3, '[]'::jsonb)) elem
                              WHERE elem->>'imageId' != $4),
                             '[]'::jsonb
                         ),
                         true
                     ), updated_at = NOW()
                     WHERE id = $2 AND empresa_id = $1`,
                    [empresaId, propiedadId, componentId, imageId]
                );
            } else {
                // Modo Firestore: eliminar de websiteData.images
                const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
                const propiedadDoc = await propiedadRef.get();
                const metadata = propiedadDoc.data()?.metadata || {};
                const websiteData = metadata.websiteData || {};
                const images = websiteData.images || {};

                if (images[componentId]) {
                    images[componentId] = images[componentId].filter(img => img.imageId !== imageId);
                    if (images[componentId].length === 0) {
                        delete images[componentId];
                    }
                }

                await propiedadRef.update({
                    'metadata.websiteData.images': images
                });
            }

            res.status(200).json({ message: 'Eliminada de ambos sistemas.' });
        } catch (error) {
            console.error("Error delete:", error);
            next(error);
        }
    });

    // POST Generar Descripción IA para Alojamiento Individual
    router.post('/propiedad/:propiedadId/generate-ai-text', async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId } = req.params;

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

            const empresaData = await obtenerDetallesEmpresa(db, empresaId);

            // Generate description using the service
            const resultado = await generarDescripcionAlojamiento(
                propiedad.descripcion || '',
                propiedad.nombre,
                nombreEmpresa,
                propiedad.googleHotelData?.address?.city || '',
                "Alojamiento",
                propiedad.websiteData?.content?.marketingStyle || "Persuasivo",
                {
                    componentes: propiedad.componentes,
                    historia: empresaData.historiaOptimizada || empresaData.historiaEmpresa,
                    slogan: empresaData.slogan,
                    palabrasClave: empresaData.palabrasClave
                }
            );

            // La IA devuelve { descripcion: "...", puntosFuertes: [...] } — extraer solo el texto
            const texto = typeof resultado === 'string'
                ? resultado
                : (resultado?.descripcion || JSON.stringify(resultado));

            res.status(200).json({ texto });
        } catch (error) {
            next(error);
        }
    });

    // ─── PropertyBuildContext endpoints ────────────────────────────────────────

    // GET  /website/propiedad/:propiedadId/build-context
    // Devuelve el PropertyBuildContext actual (empresa siempre fresco)
    router.get('/propiedad/:propiedadId/build-context', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const context = await getBuildContext(db, empresaId, req.params.propiedadId);
            res.json(context);
        } catch (error) { next(error); }
    });

    // POST /website/propiedad/:propiedadId/build-context/sync-producto
    // Re-construye el bloque "producto" desde los componentes actuales (background sync)
    router.post('/propiedad/:propiedadId/build-context/sync-producto', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const producto = await construirProductoDesdeComponentes(db, empresaId, req.params.propiedadId);
            res.json(producto || { message: 'Sin cambios.' });
        } catch (error) { next(error); }
    });

    // POST /website/propiedad/:propiedadId/build-context/generate-narrativa
    // Genera descripción + puntos fuertes con IA usando el contexto completo
    router.post('/propiedad/:propiedadId/build-context/generate-narrativa', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const context = await getBuildContext(db, empresaId, req.params.propiedadId);
            if (!context?.producto?.espacios?.length) {
                return res.status(400).json({
                    error: 'El alojamiento no tiene espacios configurados. Completa los pasos 1-3 primero.'
                });
            }
            const narrativa = await generarNarrativaDesdeContexto(context);
            if (!narrativa?.descripcionComercial) {
                return res.status(503).json({ error: 'El servicio de IA no devolvió respuesta. Intenta nuevamente en unos segundos.' });
            }
            await updateBuildContextSection(empresaId, req.params.propiedadId, 'narrativa', {
                ...narrativa,
                generadoEn: new Date().toISOString(),
            });
            // Sincronizar homeH1 y descripcionComercial a websiteData para que la SSR los use de inmediato
            if (pool && (narrativa.homeH1 || narrativa.descripcionComercial)) {
                await pool.query(
                    `UPDATE propiedades
                     SET metadata = jsonb_set(jsonb_set(metadata,
                         '{websiteData,h1}', $1::jsonb, true),
                         '{websiteData,aiDescription}', $2::jsonb, true),
                         updated_at = NOW()
                     WHERE id = $3 AND empresa_id = $4`,
                    [
                        JSON.stringify(narrativa.homeH1 || ''),
                        JSON.stringify(narrativa.descripcionComercial || ''),
                        req.params.propiedadId, empresaId
                    ]
                );
            }
            res.json(narrativa);
        } catch (error) { next(error); }
    });

    // POST /website/propiedad/:propiedadId/build-context/generate-jsonld
    // Genera JSON-LD schema.org + meta SEO con IA (requiere narrativa previa)
    router.post('/propiedad/:propiedadId/build-context/generate-jsonld', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const context = await getBuildContext(db, empresaId, propiedadId);

            // Validación pre-generación
            const { validatePreGenerationData, getGenerationRecommendations } = require('../services/ai/jsonldPreValidation');
            const preValidation = validatePreGenerationData(context);

            if (!preValidation.canGenerate) {
                return res.status(400).json({
                    error: 'Datos incompletos para generar JSON-LD',
                    details: preValidation.errors,
                    warnings: preValidation.warnings,
                    recommendations: getGenerationRecommendations(context),
                    requiredAction: preValidation.recommendedAction
                });
            }

            // Verificar narrativa (aunque no sea error crítico)
            if (!context?.narrativa?.descripcionComercial) {
                console.warn('[JSON-LD] Generando sin descripción comercial completa');
            }

            const rawResult = await generarJsonLdDesdeContexto(context);
            // La IA puede devolver { metaTitle, metaDescription, jsonLd: {...} }
            // o directamente el objeto JSON-LD. Normalizar siempre al wrapper.
            const isDirectJsonLd = rawResult && (rawResult['@type'] || rawResult['@context']);
            const result = isDirectJsonLd
                ? { metaTitle: '', metaDescription: '', jsonLd: rawResult }
                : (rawResult || {});

            // Inyectar fotos reales de galería en el JSON-LD (portada primero, máx. 8 para SEO)
            if (result.jsonLd && pool) {
                try {
                    const { rows: galeriaRows } = await pool.query(
                        `SELECT storage_url, alt_text FROM galeria
                         WHERE empresa_id=$1 AND propiedad_id=$2 AND estado IN ('auto','manual')
                         ORDER BY CASE WHEN rol='portada' THEN 0 ELSE 1 END, confianza DESC, orden ASC LIMIT 8`,
                        [empresaId, propiedadId]
                    );
                    if (galeriaRows.length > 0) {
                        // Usar "image" en lugar de "photo" para consistencia con Schema.org
                        result.jsonLd.image = galeriaRows.map(r => r.storage_url);
                    }
                } catch (photoErr) {
                    console.warn('[JSON-LD] No se pudo inyectar fotos:', photoErr.message);
                }
            }

            // Inyectar containsPlace desde los espacios del producto
            if (result.jsonLd && context?.producto?.espacios) {
                try {
                    const { spacesToContainsPlace } = require('../services/ai/schemaMappings');
                    const containsPlace = spacesToContainsPlace(context.producto.espacios);
                    if (containsPlace.length > 0) {
                        result.jsonLd.containsPlace = containsPlace;
                    }
                } catch (placeErr) {
                    console.warn('[JSON-LD] No se pudo inyectar containsPlace:', placeErr.message);
                }
            }

            // Validar JSON-LD generado
            if (result.jsonLd) {
                try {
                    const { validateJsonLd } = require('../services/ai/schemaMappings');
                    const empresaData = await obtenerDetallesEmpresa(db, empresaId);
                    const tipoNegocio = empresaData.tipoNegocio || 'complejo';
                    const validation = validateJsonLd(result.jsonLd, tipoNegocio);

                    if (!validation.isValid) {
                        console.warn('[JSON-LD] Validación falló:', validation.errors);
                        // No fallamos, solo registramos la advertencia
                    } else {
                        console.log('[JSON-LD] Validación exitosa');
                    }
                } catch (valErr) {
                    console.warn('[JSON-LD] Error en validación:', valErr.message);
                }
            }

            const publicacionMerged = mergePublicacionForPersist(context.publicacion, result);
            await updateBuildContextSection(empresaId, propiedadId, 'publicacion', publicacionMerged);
            res.json(publicacionMerged);
        } catch (error) { next(error); }
    });

    // ───────────────────────────────────────────────────────────────────────────

    router.post('/fix-storage-cors', async (req, res) => {
        try {
            const bucket = admin.storage().bucket();
            await bucket.setCorsConfiguration([
                {
                    origin: ['*'],
                    method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                    responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
                    maxAgeSeconds: 3600
                }
            ]);
            res.status(200).json({ message: 'CORS configurado correctamente.' });
        } catch (error) {
            console.error('Error configurando CORS:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};