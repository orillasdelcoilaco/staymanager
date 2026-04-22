const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Adjusted paths for services
const { obtenerPropiedadPorId, actualizarPropiedad } = require('../../services/propiedadesService');
const { mountOnRouter: mountHouseRulesRoutes } = require('../../routes/houseRulesApi');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa } = require('../../services/empresaService');
const {
    generarDescripcionAlojamiento,
    generarMetadataImagen,
    generarMetadataImagenConContexto,
    generarMetadataHeroWeb,
    generarSeoHomePage,
    generarContenidoHomePage,
    generarPerfilEmpresa,
    generarNarrativaDesdeContexto,
    generarIntroDestacadosVenta,
    generarJsonLdDesdeContexto,
    analizarMetadataActivo,
    sanitizeEspaciosDestacadosVenta,
} = require('../../services/aiContentService');
const {
    getBuildContext,
    getEmpresaContext,
    updateBuildContextSection,
    mergePublicacionForPersist,
    construirProductoDesdeComponentes,
} = require('../../services/buildContextService');
const { uploadFile, deleteFileByPath } = require('../../services/storageService');
const { generarPlanFotos } = require('../../services/propiedadLogicService');
const { optimizeImage } = require('../../services/imageProcessingService');
const { generateForTask } = require('../../services/aiContentService');
const { AI_TASK } = require('../../services/ai/aiEnums');
const { promptPlanFotos } = require('../../services/ai/prompts/fotoPlan');
const pool = require('../../db/postgres');
const { uploadFotoToGaleria, updateFoto, collectAllowedHighlightImagePaths } = require('../../services/galeriaService');
const { syncDomain, removeCustomDomain } = require('../../services/renderDomainService');
const { ssrCache } = require('../../services/cacheService');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * Recalcula slotsTotal y slotsCumplidos del plan de fotos y los persiste
 * en propiedades.metadata.fotoStats. Debe llamarse tras cada mutación de
 * websiteData.images (upload, delete, audit-slot).
 *
 * @param {object} db        - instancia Firestore (legacy, puede ser null)
 * @param {string} empresaId
 * @param {string} propiedadId
 * @param {Array}  componentes  - propiedad.componentes ya cargados en memoria
 * @param {object} wizardImages - websiteData.images actualizado (en memoria)
 */
async function recalcularFotoStats(db, empresaId, propiedadId, componentes, wizardImages) {
    try {
        const { obtenerTiposPorEmpresa } = require('../../services/componentesService');
        // Solo se usan tiposComponente (vista general + shotList por tipo de espacio).
        // Los tiposElemento (activos individuales como cubiertos, platos) quedan fuera
        // del plan de fotos para el sitio web — son demasiado granulares.
        const tipos = await obtenerTiposPorEmpresa(db, empresaId);
        const plan = generarPlanFotos(componentes || [], tipos);
        const slotsTotal = Object.values(plan).reduce((s, shots) => s + shots.length, 0);
        const imgs = wizardImages || {};
        const slotsCumplidos = Object.entries(plan).reduce((s, [compId, slots]) => {
            return s + Math.min((imgs[compId] || []).length, slots.length);
        }, 0);
        if (pool && slotsTotal > 0) {
            await pool.query(
                `UPDATE propiedades
                 SET metadata = metadata || jsonb_build_object('fotoStats', $1::jsonb)
                 WHERE id = $2 AND empresa_id = $3`,
                [JSON.stringify({ slotsTotal, slotsCumplidos }), propiedadId, empresaId]
            );
        }
    } catch (err) {
        console.warn('[fotoStats] recalculo fallido:', err.message);
    }
}

module.exports = (db) => {
    const router = express.Router();

    const invalidateSsrCache = (empresaId) => {
        try {
            if (empresaId) ssrCache.invalidateEmpresaCache(empresaId);
        } catch (err) {
            console.warn(`[SSR cache] No se pudo invalidar cache para ${empresaId}: ${err.message}`);
        }
    };

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
            const settings = req.body; // { general, theme, content, seo }

            // Obtener dominio actual antes de guardar para detectar cambios
            const empresaActual = await obtenerDetallesEmpresa(db, empresaId);
            const oldDomain = (empresaActual?.dominio || empresaActual?.websiteSettings?.general?.domain || '').trim().toLowerCase();
            const newDomain = (settings.general?.domain || '').trim().toLowerCase();

            // Construir objeto websiteSettings completo
            const websiteSettings = {};
            if (settings.general) websiteSettings.general = settings.general;
            if (settings.theme) {
                websiteSettings.theme = {
                    logoUrl: settings.theme.logoUrl || '',
                    heroImageUrl: settings.theme.heroImageUrl || '',
                    heroImageAlt: settings.theme.heroImageAlt || '',
                    heroImageTitle: settings.theme.heroImageTitle || ''
                };
            }
            if (settings.content) websiteSettings.content = settings.content;
            if (settings.seo)     websiteSettings.seo     = settings.seo;

            await actualizarDetallesEmpresa(db, empresaId, { websiteSettings });
            invalidateSsrCache(empresaId);

            // Sincronizar dominio personalizado con Render si cambió
            let domainInfo = null;
            if (newDomain && newDomain !== oldDomain) {
                try {
                    domainInfo = await syncDomain(newDomain, oldDomain || null);
                    console.log(`[home-settings] Dominio ${newDomain} registrado en Render`);
                } catch (renderErr) {
                    // No falla el guardado — dominio guardado en DB, solo falla Render API
                    console.warn(`[home-settings] Advertencia Render API: ${renderErr.message}`);
                    domainInfo = { domain: newDomain, error: renderErr.message, instructions: null };
                }
            } else if (!newDomain && oldDomain) {
                // El cliente borró su dominio — eliminarlo de Render también (fire & forget)
                removeCustomDomain(oldDomain).catch(err =>
                    console.warn(`[home-settings] No se pudo eliminar ${oldDomain} de Render: ${err.message}`)
                );
            }

            res.status(200).json({ message: 'Configuración guardada.', domainInfo });
        } catch (error) { next(error); }
    });

    // POST Subir Imagen Hero (Portada)
    router.post('/upload-hero-image', upload.any(), async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { altText, titleText } = req.body;

            console.log(`[DEBUG upload-hero-image] Recibiendo solicitud:`, {
                empresaId,
                nombreEmpresa,
                altText,
                titleText,
                hasFiles: !!req.files,
                filesCount: req.files?.length || 0,
                hasFile: !!req.file,
                bodyKeys: Object.keys(req.body)
            });

            // Robust file handling: get first file regardless of field name
            const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
            if (!file) return res.status(400).json({ error: 'No file uploaded.' });

            console.log(`[DEBUG upload-hero-image] Archivo recibido:`, {
                fieldname: file.fieldname,
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size
            });

            // 1. Procesar y subir imagen (Standardized)
            const imageId = uuidv4();
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/website/hero-${imageId}.${outputFormat}`;

            const { buffer: optimizedBuffer } = await optimizeImage(file.buffer, {
                maxWidth: 1920,
                quality: 85
            });

            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // 2. Determinar Metadata con Contexto Corporativo Completo
            let finalAlt = altText;
            let finalTitle = titleText;

            console.log(`[DEBUG upload-hero-image] Valores iniciales:`, {
                finalAlt,
                finalTitle,
                shouldGenerate: !finalAlt || !finalTitle
            });

            if (!finalAlt || !finalTitle) {
                try {
                    const empresaContext = await getEmpresaContext(empresaId);
                    const metadata = await generarMetadataHeroWeb(empresaContext, optimizedBuffer);
                    if (metadata.altText) finalAlt = metadata.altText;
                    if (metadata.title) finalTitle = metadata.title;
                    console.log(`[upload-hero-image] Metadata hero generada:`, { altText: finalAlt, title: finalTitle });
                } catch (contextError) {
                    console.warn(`[upload-hero-image] Error generando metadata hero, usando fallback:`, contextError.message);
                }
            }

            // 3. Guardar en DB
            // Asegurar que no guardemos strings vacíos
            const safeAlt = finalAlt && finalAlt.trim().length > 0 ? finalAlt : `Imagen de portada de ${nombreEmpresa}`;
            const safeTitle = finalTitle && finalTitle.trim().length > 0 ? finalTitle : `Portada principal - ${nombreEmpresa}`;

            console.log(`[DEBUG upload-hero-image] Valores finales para guardar:`, {
                alt: safeAlt,
                title: safeTitle,
                url: publicUrl
            });

            const updatePayload = {
                'websiteSettings.theme.heroImageUrl': publicUrl,
                'websiteSettings.theme.heroImageAlt': safeAlt,
                'websiteSettings.theme.heroImageTitle': safeTitle
            };

            console.log(`[DEBUG upload-hero-image] Guardando en DB:`, updatePayload);
            try {
                await actualizarDetallesEmpresa(db, empresaId, updatePayload);
                invalidateSsrCache(empresaId);
                console.log(`[DEBUG upload-hero-image] Guardado en DB exitoso`);
            } catch (dbError) {
                console.error(`[DEBUG upload-hero-image] Error guardando en DB:`, dbError.message);
                // Continuar de todos modos para no romper la UX
            }

            console.log(`[DEBUG upload-hero-image] Retornando respuesta:`, updatePayload);
            res.status(201).json(updatePayload);
        } catch (error) { next(error); }
    });

    // POST Optimizar Perfil Empresa (Estrategia Completa - Texto)
    router.post('/optimize-profile', async (req, res, next) => {
        try {
            const { historia } = req.body;
            if (!historia || typeof historia !== 'string' || historia.trim().length < 20) {
                return res.status(400).json({ error: 'La descripción debe tener al menos 20 caracteres.' });
            }
            const strategy = await generarPerfilEmpresa(historia.trim());
            res.status(200).json(strategy);
        } catch (error) {
            if (error.message?.includes('patrones no permitidos')) {
                return res.status(400).json({ error: 'El texto contiene contenido no permitido.' });
            }
            next(error);
        }
    });

    // --- Normas / reglas (alias bajo /website; la ruta principal es /api/propiedades/house-rules) ---
    mountHouseRulesRoutes(router, db);

    // --- Rutas de Propiedades (Existentes) ---

    router.get('/propiedad/:propiedadId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, req.params.propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });
            res.status(200).json(propiedad.websiteData || { aiDescription: '', images: {}, cardImage: null });
        } catch (error) { next(error); }
    });

    router.put('/propiedad/:propiedadId', upload.single('cardImage'), async (req, res, next) => {
        try {
            // [FIX] Validar si hay archivo para subir
            if (req.file) {
                const { empresaId, nombreEmpresa } = req.user;
                const propiedad = await obtenerPropiedadPorId(db, empresaId, req.params.propiedadId);

                if (propiedad.websiteData?.cardImage?.storagePath) {
                    await deleteFileByPath(propiedad.websiteData.cardImage.storagePath);
                }

                const imageId = `card-${uuidv4()}`;
                const outputFormat = 'webp';
                const storagePath = `empresas/${empresaId}/propiedades/${req.params.propiedadId}/images/${imageId}.${outputFormat}`;
                const { buffer: optimizedBuffer } = await optimizeImage(req.file.buffer, {
                    maxWidth: 800,
                    quality: 80
                });
                const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

                // Intentar usar contexto corporativo completo
                let metadata;
                try {
                    const empresaContext = await getEmpresaContext(empresaId);
                    metadata = await generarMetadataImagenConContexto(
                        empresaContext,
                        propiedad.nombre,
                        propiedad.descripcion || `Alojamiento ${propiedad.nombre}`,
                        'Imagen Principal',
                        'Portada',
                        optimizedBuffer
                    );
                    console.log(`[DEBUG PUT propiedad] Metadata generada con contexto corporativo`);
                } catch (contextError) {
                    console.warn(`[PUT propiedad] Fallo contexto corporativo, usando versión básica:`, contextError.message);
                    // Fallback a la versión original
                    metadata = await generarMetadataImagen(nombreEmpresa, propiedad.nombre, propiedad.descripcion, 'Imagen Principal', 'Portada', optimizedBuffer);
                }

                const cardImageData = { imageId, storagePath: publicUrl, altText: metadata.altText, title: metadata.title };
                await actualizarPropiedad(db, empresaId, req.params.propiedadId, { 'websiteData.cardImage': cardImageData });
                invalidateSsrCache(empresaId);
                return res.status(201).json(cardImageData);
            }

            // Si no es archivo, probablemente es un update normal (aunque este endpoint es PUT /propiedad/:id)
            // Se mantiene lógica anterior por si acaso, pero el return arriba corta el flujo si hubo archivo.
            next();
        } catch (error) { next(error); }
    });

    // [NEW] Endpoint Específico para subir Card Image (Fixes 404 on frontend)
    router.post('/propiedad/:propiedadId/upload-card-image', upload.any(), async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId } = req.params;

            // Robust file handling: get first file regardless of field name
            const file = req.files && req.files.length > 0 ? req.files[0] : req.file;

            if (!file) return res.status(400).json({ error: 'No file uploaded.' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });

            // Remove old image if exists
            if (propiedad.websiteData?.cardImage?.storagePath) {
                await deleteFileByPath(propiedad.websiteData.cardImage.storagePath);
            }

            const imageId = `card-${uuidv4()}`;
            const outputFormat = 'webp';
            const storagePath = `empresas/${empresaId}/propiedades/${propiedadId}/images/${imageId}.${outputFormat}`;

            const { buffer: optimizedBuffer } = await optimizeImage(file.buffer, {
                maxWidth: 800,
                quality: 80
            });
            const publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);

            // Intentar usar contexto corporativo completo
            let metadata;
            try {
                const empresaContext = await getEmpresaContext(empresaId);
                metadata = await generarMetadataImagenConContexto(
                    empresaContext,
                    propiedad.nombre,
                    propiedad.descripcion || `Alojamiento ${propiedad.nombre}`,
                    'Imagen Principal',
                    'Portada',
                    optimizedBuffer
                );
                console.log(`[DEBUG upload-card-image] Metadata generada con contexto corporativo`);
            } catch (contextError) {
                console.warn(`[upload-card-image] Fallo contexto corporativo, usando versión básica:`, contextError.message);
                // Fallback a la versión original
                metadata = await generarMetadataImagen(nombreEmpresa, propiedad.nombre, propiedad.descripcion, 'Imagen Principal', 'Portada', optimizedBuffer);
            }

            const cardImageData = { imageId, storagePath: publicUrl, altText: metadata.altText, title: metadata.title };

            await actualizarPropiedad(db, empresaId, propiedadId, { 'websiteData.cardImage': cardImageData });
            invalidateSsrCache(empresaId);

            res.status(201).json(cardImageData);
        } catch (error) {
            console.error("Error upload-card-image:", error);
            next(error);
        }
    });

    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.any(), async (req, res, next) => {
        console.log(`[DEBUG] POST upload-image hit! Propiedad: ${req.params.propiedadId}, Component: ${req.params.componentId}`);
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId, componentId } = req.params;
            const shotContext = req.body.shotContext || null;

            if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files.' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });
            const componente = propiedad.componentes?.find(c => c.id === componentId);
            if (!componente) return res.status(404).json({ error: 'Componente no encontrado.' });

            const resultadosParaFrontend = [];

            await Promise.all(req.files.map(async (file) => {
                const imageId = uuidv4();
                const outputFormat = 'webp';
                const storagePathRelative = `empresas/${empresaId}/propiedades/${propiedadId}/images/${componente.id}/${imageId}.${outputFormat}`;
                const { buffer: optimizedBuffer } = await optimizeImage(file.buffer, {
                    maxWidth: 1200,
                    quality: 80
                });
                const publicUrl = await uploadFile(optimizedBuffer, storagePathRelative, `image/${outputFormat}`);

                let metadata = { altText: componente.nombre, title: componente.nombre };
                try {
                    const descPropiedad = propiedad.websiteData?.aiDescription || propiedad.descripcion || '';

                    // Intentar usar contexto corporativo completo
                    try {
                        const empresaContext = await getEmpresaContext(empresaId);
                        metadata = await generarMetadataImagenConContexto(
                            empresaContext,
                            propiedad.nombre,
                            descPropiedad,
                            componente.nombre,
                            componente.tipo,
                            optimizedBuffer,
                            shotContext
                        );
                        console.log(`[DEBUG upload-image] Metadata generada con contexto corporativo para ${componente.nombre}`);
                    } catch (contextError) {
                        console.warn(`[upload-image] Fallo contexto corporativo, usando versión básica:`, contextError.message);
                        // Fallback a la versión original
                        metadata = await generarMetadataImagen(
                            nombreEmpresa,
                            propiedad.nombre,
                            descPropiedad,
                            componente.nombre,
                            componente.tipo,
                            optimizedBuffer,
                            shotContext
                        );
                    }
                } catch (aiError) {
                    console.warn("Fallo IA Visión:", aiError.message);
                }

                const imageData = {
                    imageId,
                    storagePath: publicUrl,
                    altText: metadata.altText,
                    title: metadata.title,
                    shotContext: shotContext,
                    advertencia: metadata.advertencia || null
                };
                resultadosParaFrontend.push(imageData);

                // GUARDAR EN GALERIA (tabla centralizada) - SOLUCIÓN AL PROBLEMA [IMG-001]
                try {
                    console.log(`[DEBUG upload-image] Guardando en galeria: ${imageId}, componente: ${componentId}`);
                    // Crear archivo temporal para uploadFotoToGaleria
                    const fileForGaleria = {
                        buffer: optimizedBuffer,
                        originalname: file.originalname || 'uploaded_image.jpg'
                    };

                    // Subir a galeria (solo 4 parámetros: db, empresaId, propiedadId, files)
                    const galeriaResults = await uploadFotoToGaleria(db, empresaId, propiedadId, [fileForGaleria]);
                    if (galeriaResults && galeriaResults.length > 0) {
                        const galeriaFoto = galeriaResults[0];
                        console.log(`[DEBUG upload-image] Guardado en galeria exitoso. ID: ${galeriaFoto.id}`);

                        // Actualizar la foto en galeria con metadata correcta usando updateFoto
                        await updateFoto(db, empresaId, propiedadId, galeriaFoto.id, {
                            espacio: componente.nombre,
                            espacioId: componentId,
                            altText: metadata.altText || '',
                            estado: 'manual',
                            confianza: !metadata.advertencia ? 0.95 : 0.85
                        });
                        console.log(`[DEBUG upload-image] Foto ${galeriaFoto.id} actualizada con metadata`);
                    }
                } catch (galeriaError) {
                    console.warn('[upload-image] Error guardando en galeria (continuando...):', galeriaError.message);
                    // NO fallamos la operación completa si falla galeria
                    // El guardado en websiteData.images es crítico para la UX inmediata
                }
            }));

            // Actualizar websiteData en PostgreSQL (merge en memoria, luego escribir)
            const websiteData = propiedad.websiteData || { aiDescription: '', images: {}, cardImage: null };
            const imagesActualizadas = { ...(websiteData.images || {}) };
            for (const img of resultadosParaFrontend) {
                imagesActualizadas[componentId] = [...(imagesActualizadas[componentId] || []), img];
            }
            websiteData.images = imagesActualizadas;
            await actualizarPropiedad(db, empresaId, propiedadId, { websiteData });
            invalidateSsrCache(empresaId);

            // Persistir stats actualizados (fire-and-forget — no bloquea la respuesta)
            recalcularFotoStats(db, empresaId, propiedadId, propiedad.componentes, imagesActualizadas).catch(() => {});

            res.status(201).json(resultadosParaFrontend);
        } catch (error) {
            console.error(`Error POST upload-image:`, error);
            next(error);
        }
    });

    router.delete('/propiedad/:propiedadId/delete-image/:componentId/:imageId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId, componentId, imageId } = req.params;

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });

            const websiteData = propiedad.websiteData || { aiDescription: '', images: {}, cardImage: null };
            const images = websiteData.images?.[componentId] || [];
            const img = images.find(i => i.imageId === imageId);

            if (img?.storagePath) await deleteFileByPath(img.storagePath);

            const imagesActualizadasDelete = {
                ...(websiteData.images || {}),
                [componentId]: images.filter(i => i.imageId !== imageId)
            };
            websiteData.images = imagesActualizadasDelete;
            await actualizarPropiedad(db, empresaId, propiedadId, { websiteData });
            invalidateSsrCache(empresaId);

            recalcularFotoStats(db, empresaId, propiedadId, propiedad.componentes, imagesActualizadasDelete).catch(() => {});

            res.status(200).json({ message: 'Eliminada.' });
        } catch (error) { next(error); }
    });

    // Auditar foto de galería existente y asignarla a un slot si pasa
    router.post('/propiedad/:propiedadId/audit-slot', async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId } = req.params;
            const { componentId, imageUrl, imageId, shotContext } = req.body;

            if (!componentId || !imageUrl) return res.status(400).json({ error: 'componentId e imageUrl requeridos.' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });
            const componente = propiedad.componentes?.find(c => c.id === componentId);
            if (!componente) return res.status(404).json({ error: 'Componente no encontrado.' });

            // Descargar la imagen para auditarla con IA
            const imgResponse = await fetch(imageUrl);
            if (!imgResponse.ok) return res.status(400).json({ error: 'No se pudo descargar la imagen para auditoría.' });
            const imageBuffer = Buffer.from(await imgResponse.arrayBuffer());

            const descPropiedad = propiedad.websiteData?.aiDescription || propiedad.descripcion || '';
            const metadata = await generarMetadataImagen(
                nombreEmpresa, propiedad.nombre, descPropiedad,
                componente.nombre, componente.tipo, imageBuffer, shotContext || null
            );

            if (metadata.advertencia) {
                return res.status(200).json({ aprobada: false, advertencia: metadata.advertencia });
            }

            // Aprobada: registrar en websiteData (reusar imageId/storagePath de galería)
            const newImageId = imageId || uuidv4();
            const imageData = {
                imageId: newImageId,
                storagePath: imageUrl,
                altText: metadata.altText,
                title: metadata.title,
                shotContext: shotContext || null,
                advertencia: null,
                fromGaleria: true
            };

            const websiteData = propiedad.websiteData || { aiDescription: '', images: {}, cardImage: null };
            const imagesActualizadasAudit = {
                ...(websiteData.images || {}),
                [componentId]: [...(websiteData.images?.[componentId] || []), imageData]
            };
            websiteData.images = imagesActualizadasAudit;
            await actualizarPropiedad(db, empresaId, propiedadId, { websiteData });
            invalidateSsrCache(empresaId);

            recalcularFotoStats(db, empresaId, propiedadId, propiedad.componentes, imagesActualizadasAudit).catch(() => {});

            res.status(201).json({ aprobada: true, imagen: imageData });
        } catch (error) {
            console.error('Error audit-slot:', error);
            next(error);
        }
    });

    router.get('/propiedad/:propiedadId/photo-plan', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, req.params.propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });

            // Si existe plan IA por instancia, usarlo. Si no, caer al plan básico (vista general).
            const planIA = propiedad.fotoPlanIA || null;
            const plan = planIA ? planIA : generarPlanFotos(propiedad.componentes, []);

            await recalcularFotoStats(
                db, empresaId, req.params.propiedadId,
                propiedad.componentes,
                propiedad.websiteData?.images || {}
            );

            const slotsTotal = Object.values(plan).reduce((s, shots) => s + shots.length, 0);
            const wizardImages = propiedad.websiteData?.images || {};
            const slotsCumplidos = Object.entries(plan).reduce((sum, [cId, shots]) =>
                sum + Math.min((wizardImages[cId] || []).length, shots.length), 0);

            res.status(200).json({
                ...plan,
                _aiGenerated: !!planIA,
                _generatedAt: propiedad.fotoPlanIA_generatedAt || null,
                _slotsTotal: slotsTotal,
                _slotsCumplidos: slotsCumplidos,
            });
        } catch (error) { next(error); }
    });

    // Genera el plan de fotos con IA por instancia de propiedad.
    // La IA recibe los activos reales de cada espacio y decide qué fotos son necesarias
    // para maximizar conversión en OTAs y SEO. Guarda en metadata.fotoPlanIA.
    router.post('/propiedad/:propiedadId/generar-plan-fotos', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });

            const { obtenerTipos: obtenerTiposElemento } = require('../../services/tiposElementoService');
            const tiposElemento = await obtenerTiposElemento(db, empresaId);
            const activoMap = new Map(tiposElemento.map(t => [t.id, t]));

            const espacios = (propiedad.componentes || []).map(comp => ({
                id: comp.id,
                nombre: comp.nombre,
                tipo: comp.tipo || comp.nombre,
                activos: (comp.elementos || []).map(el => {
                    const tipo = activoMap.get(el.tipoId || el.id);
                    return { nombre: tipo?.nombre || el.nombre || 'elemento', cantidad: el.cantidad || 1 };
                }),
            }));

            if (espacios.length === 0) {
                return res.status(400).json({ error: 'La propiedad no tiene espacios definidos.' });
            }

            const empresaData = await obtenerDetallesEmpresa(db, empresaId);
            const ubi = empresaData?.ubicacion || {};
            const ubicacion = [ubi.ciudad, ubi.region, ubi.pais].filter(Boolean).join(', ');

            const prompt = promptPlanFotos({
                propiedadNombre: propiedad.nombre,
                propiedadTipo: propiedad.tipo || 'alojamiento turístico',
                ubicacion,
                espacios,
            });

            const planIA = await generateForTask(AI_TASK.PHOTO_PLAN, prompt);

            if (!planIA || typeof planIA !== 'object') {
                return res.status(502).json({ error: 'La IA no devolvió un plan válido. Intenta de nuevo.' });
            }

            // Validar que las claves correspondan a IDs de espacios reales
            const idsEspacios = new Set(espacios.map(e => e.id));
            const planValidado = {};
            for (const [compId, shots] of Object.entries(planIA)) {
                if (idsEspacios.has(compId) && Array.isArray(shots)) {
                    planValidado[compId] = shots;
                }
            }

            if (Object.keys(planValidado).length === 0) {
                return res.status(502).json({ error: 'El plan generado no coincide con los espacios de la propiedad.' });
            }

            const generatedAt = new Date().toISOString();
            if (!pool) {
                return res.status(503).json({ error: 'Base de datos no disponible en este entorno.' });
            }
            // COALESCE(metadata,'{}') evita que metadata NULL destruya el registro.
            // $2 se pasa como texto — jsonb_build_object lo almacena como string JSON.
            await pool.query(
                `UPDATE propiedades
                 SET metadata = COALESCE(metadata, '{}'::jsonb)
                     || jsonb_build_object('fotoPlanIA', $1::jsonb, 'fotoPlanIA_generatedAt', $2::text),
                     updated_at = NOW()
                 WHERE id = $3 AND empresa_id = $4`,
                [JSON.stringify(planValidado), generatedAt, propiedadId, empresaId]
            );
            invalidateSsrCache(empresaId);

            const slotsTotal = Object.values(planValidado).reduce((s, shots) => s + shots.length, 0);
            res.status(200).json({
                ...planValidado,
                _aiGenerated: true,
                _generatedAt: generatedAt,
                _slotsTotal: slotsTotal,
            });
        } catch (error) {
            console.error('[generar-plan-fotos]', error.message);
            res.status(500).json({ error: error.message || 'Error interno al generar el plan.' });
        }
    });

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
            res.status(500).json({ error: error.message });
        }
    });

    // [NEW] Endpoint para generar descripción de propiedad con IA
    router.post('/propiedad/:propiedadId/generate-ai-text', async (req, res, next) => {
        try {
            const { empresaId, nombreEmpresa } = req.user;
            const { propiedadId } = req.params;

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });

            // Con inventario en buildContext: misma narrativa que el wizard (Postgres), sin depender de Firestore.
            if (pool) {
                try {
                    const buildContext = await getBuildContext(db, empresaId, propiedadId);
                    if (buildContext?.producto?.espacios?.length) {
                        const narrativa = await generarNarrativaDesdeContexto(buildContext);
                        if (!narrativa) {
                            return res.status(502).json({ error: 'La IA no devolvió narrativa.' });
                        }
                        await updateBuildContextSection(empresaId, propiedadId, 'narrativa', {
                            ...narrativa,
                            generadoEn: new Date().toISOString(),
                        });
                        invalidateSsrCache(empresaId);
                        const textoLimpio = narrativa.descripcionComercial || '';
                        const puntosFuertes = Array.isArray(narrativa.puntosFuertes)
                            ? narrativa.puntosFuertes
                            : [];
                        return res.json({
                            texto: textoLimpio,
                            puntosFuertes,
                            descripcionComercial: textoLimpio,
                            ...narrativa,
                        });
                    }
                } catch (invErr) {
                    console.warn('[generate-ai-text] narrativa con inventario omitida:', invErr.message);
                }
            }

            // Legacy: copy de empresa desde PostgreSQL (configuracion / websiteSettings), no Firestore.
            let historia = '';
            let slogan = '';
            let marketing = 'General';
            let palabrasClave = '';
            try {
                const empCtx = await getEmpresaContext(empresaId);
                historia = empCtx.historia || '';
                slogan = empCtx.slogan || '';
                marketing = empCtx.enfoque || 'General';
                const kw = empCtx.seo?.keywords;
                palabrasClave = Array.isArray(kw) ? kw.join(', ') : (typeof kw === 'string' ? kw : '');
            } catch (empErr) {
                console.warn('[generate-ai-text] getEmpresaContext:', empErr.message);
            }

            const context = {
                historia,
                slogan,
                marketing,
                palabrasClave,
                componentes: propiedad.componentes || [],
            };

            const descripcionGenerada = await generarDescripcionAlojamiento(
                propiedad.descripcion || '',
                propiedad.nombre,
                nombreEmpresa,
                propiedad.direccion?.ciudad || '',
                propiedad.tipo || 'Alojamiento',
                context.marketing,
                context
            );

            // La IA devuelve { descripcion: "...", puntosFuertes: [...] } — extraer solo el texto
            const textoLimpio = typeof descripcionGenerada === 'string'
                ? descripcionGenerada
                : (descripcionGenerada?.descripcion || '');
            const puntosFuertes = Array.isArray(descripcionGenerada?.puntosFuertes)
                ? descripcionGenerada.puntosFuertes : [];

            res.json({ texto: textoLimpio, puntosFuertes });

        } catch (error) {
            next(error);
        }
    });

    // PUT Guardar cardImage desde URL existente (galería o websiteData)
    router.put('/propiedad/:propiedadId/portada', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const { cardImage } = req.body;
            if (!cardImage?.imageId || !cardImage?.storagePath) {
                return res.status(400).json({ error: 'cardImage.imageId y cardImage.storagePath son requeridos.' });
            }
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });
            const websiteData = { ...(propiedad.websiteData || {}), cardImage };
            await actualizarPropiedad(db, empresaId, propiedadId, { websiteData });
            invalidateSsrCache(empresaId);
            res.status(200).json({ cardImage });
        } catch (error) { next(error); }
    });

    // PUT Guardar identidad de propiedad (aiDescription + puntosFuertes)
    router.put('/propiedad/:propiedadId/identidad', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const { aiDescription, puntosFuertes } = req.body;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });
            const websiteData = { ...(propiedad.websiteData || {}), aiDescription, puntosFuertes: puntosFuertes || [] };
            await actualizarPropiedad(db, empresaId, propiedadId, { websiteData });
            invalidateSsrCache(empresaId);
            res.json({ ok: true });
        } catch (error) { next(error); }
    });

    // PUT Guardar SEO de propiedad (metaTitle + metaDescription)
    router.put('/propiedad/:propiedadId/seo', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const { metaTitle, metaDescription } = req.body;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'No encontrada.' });
            const websiteData = { ...(propiedad.websiteData || {}), metaTitle, metaDescription };
            await actualizarPropiedad(db, empresaId, propiedadId, { websiteData });
            invalidateSsrCache(empresaId);
            res.json({ ok: true });
        } catch (error) { next(error); }
    });

    // [NEW] Eliminar Componente (Espacio) de una Propiedad
    router.delete('/propiedad/:propiedadId/componente/:componentId', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId, componentId } = req.params;
            const propRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
            const doc = await propRef.get();

            if (!doc.exists) return res.status(404).json({ error: 'No encontrada.' });

            const data = doc.data();

            // 1. Remover del array de Componentes
            const nuevosComponentes = (data.componentes || []).filter(c => c.id !== componentId);

            // 2. Borrar imágenes asociadas (Storage)
            const images = data.websiteData?.images?.[componentId] || [];
            if (images.length > 0) {
                console.log(`[API] Eliminando ${images.length} imágenes del componente ${componentId}...`);
                await Promise.all(images.map(img =>
                    img.storagePath ? deleteFileByPath(img.storagePath).catch(e => console.warn("Ignored delete error:", e.message)) : Promise.resolve()
                ));
            }

            // 3. Update DB (Componentes array + Delete image map key)
            const updates = { componentes: nuevosComponentes };
            // FieldValue.delete() elimina la Key del mapa
            updates[`websiteData.images.${componentId}`] = admin.firestore.FieldValue.delete();

            await propRef.update(updates);
            console.log(`[API] Componente ${componentId} eliminado de Propiedad ${propiedadId}`);
            invalidateSsrCache(empresaId);

            res.status(200).json({ success: true });
        } catch (error) { next(error); }
    });

    // ─── PropertyBuildContext endpoints ────────────────────────────────────────

    // GET  /website/propiedad/:propiedadId/build-context
    router.get('/propiedad/:propiedadId/build-context', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const context = await getBuildContext(db, empresaId, req.params.propiedadId);
            res.json(context);
        } catch (error) { next(error); }
    });

    // POST /website/propiedad/:propiedadId/build-context/sync-producto
    router.post('/propiedad/:propiedadId/build-context/sync-producto', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const producto = await construirProductoDesdeComponentes(db, empresaId, req.params.propiedadId);
            res.json(producto || { message: 'Sin cambios.' });
        } catch (error) { next(error); }
    });

    // POST /website/propiedad/:propiedadId/build-context/generate-narrativa
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
            await updateBuildContextSection(empresaId, req.params.propiedadId, 'narrativa', {
                ...narrativa,
                generadoEn: new Date().toISOString(),
            });
            invalidateSsrCache(empresaId);
            res.json(narrativa);
        } catch (error) { next(error); }
    });

    // PUT /website/propiedad/:propiedadId/build-context/espacios-destacados
    // Guarda (y valida) la lista curada para la ficha SSR pública — merge en narrativa.
    router.put('/propiedad/:propiedadId/build-context/espacios-destacados', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { propiedadId } = req.params;
            const { espaciosDestacadosVenta } = req.body || {};
            const context = await getBuildContext(db, empresaId, propiedadId);
            const propiedadDoc = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            const allowedPaths = await collectAllowedHighlightImagePaths(
                empresaId,
                propiedadId,
                context,
                propiedadDoc?.websiteData || {}
            );
            const prev = context?.narrativa || {};
            const sanitized = sanitizeEspaciosDestacadosVenta(espaciosDestacadosVenta, context, allowedPaths);

            let introDestacadosVenta = String(prev.introDestacadosVenta || '').trim();
            let introDestacadosVentaGeneradoEn = prev.introDestacadosVentaGeneradoEn || null;

            if (!sanitized.length) {
                introDestacadosVenta = '';
                introDestacadosVentaGeneradoEn = null;
            } else {
                try {
                    const introNew = await generarIntroDestacadosVenta({
                        empresaNombre: context?.empresa?.nombre || req.user?.nombreEmpresa,
                        propiedadNombre: context?.producto?.nombre || propiedadDoc?.nombre,
                        ciudad:
                            context?.empresa?.ubicacion?.ciudad
                            || propiedadDoc?.direccion?.ciudad
                            || propiedadDoc?.ciudad,
                        rows: sanitized,
                    });
                    if (introNew) {
                        introDestacadosVenta = introNew;
                        introDestacadosVentaGeneradoEn = new Date().toISOString();
                    }
                } catch (e) {
                    console.warn('[espacios-destacados] intro IA:', e?.message || e);
                }
            }

            await updateBuildContextSection(empresaId, propiedadId, 'narrativa', {
                ...prev,
                espaciosDestacadosVenta: sanitized,
                introDestacadosVenta,
                introDestacadosVentaGeneradoEn,
            });
            invalidateSsrCache(empresaId);
            res.json({
                ok: true,
                espaciosDestacadosVenta: sanitized,
                introDestacadosVenta,
                introDestacadosVentaGeneradoEn,
            });
        } catch (error) { next(error); }
    });

    // POST /website/propiedad/:propiedadId/build-context/generate-jsonld
    router.post('/propiedad/:propiedadId/build-context/generate-jsonld', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const propiedadId = req.params.propiedadId;
            const [context, propiedad, productoFresco] = await Promise.all([
                getBuildContext(db, empresaId, propiedadId),
                obtenerPropiedadPorId(db, empresaId, propiedadId),
                // Reconstruir producto SIEMPRE desde tipos_elemento actuales.
                // El buildContext cacheado en BD puede tener schema_property obsoletos.
                construirProductoDesdeComponentes(db, empresaId, propiedadId),
            ]);
            if (!context?.narrativa?.descripcionComercial) {
                return res.status(400).json({
                    error: 'Genera el contenido web primero (paso 4 — narrativa).'
                });
            }
            // Reemplazar producto del contexto cacheado con la versión fresca
            const contextFresco = productoFresco
                ? { ...context, producto: productoFresco }
                : context;

            const result = await generarJsonLdDesdeContexto(contextFresco);

            // Inyectar containsPlace desde los espacios reales (no se delega a la IA).
            if (result.jsonLd) {
                const schemaTypeMap = {
                    dormitorio: 'Bedroom', bano: 'Bathroom', cocina: 'Kitchen',
                    living: 'LivingRoom', sala: 'LivingRoom', comedor: 'DiningRoom',
                    terraza: 'Terrace', exterior: 'Terrace',
                };
                const normalizeKey = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
                const espacios = (contextFresco.producto?.espacios || []);
                if (espacios.length > 0) {
                    result.jsonLd.containsPlace = espacios.map(e => {
                        const key = normalizeKey(e.categoria || e.nombre);
                        const type = Object.entries(schemaTypeMap).find(([k]) => key.includes(k))?.[1] || 'Room';
                        return { '@type': type, name: e.nombre, description: e.categoria || e.nombre };
                    });
                }
            }

            // Inyectar URLs de imágenes en el JSON-LD
            if (result.jsonLd && propiedad) {
                const webData = propiedad.websiteData || {};
                const imageUrls = [];
                if (webData.cardImage?.storagePath) {
                    imageUrls.push(webData.cardImage.storagePath);
                }
                const allImages = webData.images || {};
                for (const compImages of Object.values(allImages)) {
                    if (Array.isArray(compImages)) {
                        for (const img of compImages) {
                            if (img?.storagePath && !imageUrls.includes(img.storagePath)) {
                                imageUrls.push(img.storagePath);
                            }
                        }
                    }
                }
                if (imageUrls.length > 0) {
                    result.jsonLd.image = imageUrls;
                }
            }

            const publicacionMerged = mergePublicacionForPersist(context.publicacion, result);
            await updateBuildContextSection(empresaId, propiedadId, 'publicacion', publicacionMerged);
            invalidateSsrCache(empresaId);
            res.json(publicacionMerged);
        } catch (error) { next(error); }
    });

    // ── Reclasificación de activos (schema_property) ─────────────────────────────

    // POST /website/empresa/reclasificar-activos
    // Proceso interno: la IA analiza cada tipo de elemento de la empresa y asigna
    // el schema_property correcto (amenityFeature para amenidades reales, null para inventario).
    // Sin interacción del usuario — completamente transparente.
    router.post('/empresa/reclasificar-activos', async (req, res, next) => {
        try {
            const { empresaId } = req.user;

            const { rows: tipos } = await pool.query(
                `SELECT id, nombre, categoria FROM tipos_elemento WHERE empresa_id = $1 ORDER BY nombre`,
                [empresaId]
            );

            if (!tipos.length) return res.json({ procesados: 0, actualizados: 0 });

            // Categorías disponibles para contexto de la IA
            const categorias = [...new Set(tipos.map(t => t.categoria).filter(Boolean))];

            let procesados = 0;
            let actualizados = 0;

            for (const tipo of tipos) {
                try {
                    const aiResult = await analizarMetadataActivo(tipo.nombre, categorias);
                    const nuevoSchemaProperty = aiResult.schema_property || null;

                    await pool.query(
                        `UPDATE tipos_elemento SET schema_property = $1, updated_at = NOW()
                         WHERE id = $2 AND empresa_id = $3`,
                        [nuevoSchemaProperty, tipo.id, empresaId]
                    );

                    procesados++;
                    if (nuevoSchemaProperty !== null) actualizados++;
                } catch (err) {
                    console.warn(`[reclasificar] Error en "${tipo.nombre}":`, err.message);
                    procesados++;
                }
            }

            res.json({ procesados, actualizados, total: tipos.length });
        } catch (error) { next(error); }
    });

    // ── Áreas Comunes del Recinto (empresa-level) ────────────────────────────────

    // GET /website/empresa/areas-comunes
    router.get('/empresa/areas-comunes', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { rows } = await pool.query(
                `SELECT configuracion->'areas_comunes' AS areas FROM empresas WHERE id = $1`,
                [empresaId]
            );
            res.json(rows[0]?.areas || { activo: false, espacios: [] });
        } catch (error) { next(error); }
    });

    // PUT /website/empresa/areas-comunes
    router.put('/empresa/areas-comunes', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { activo, espacios } = req.body;
            await pool.query(
                `UPDATE empresas
                 SET configuracion = configuracion || jsonb_build_object('areas_comunes', $2::jsonb),
                     updated_at    = NOW()
                 WHERE id = $1`,
                [empresaId, JSON.stringify({ activo: !!activo, espacios: espacios || [] })]
            );
            invalidateSsrCache(empresaId);
            res.json({ ok: true });
        } catch (error) { next(error); }
    });

    // ───────────────────────────────────────────────────────────────────────────

    return router;
};
