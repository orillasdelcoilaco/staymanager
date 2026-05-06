const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Adjusted paths for services
const { obtenerPropiedadPorId, actualizarPropiedad } = require('../../services/propiedadesService');
const { mountOnRouter: mountHouseRulesRoutes } = require('../../routes/houseRulesApi');
const { mountOnRouter: mountWebsiteBlogRoutes } = require('../../routes/websiteBlogApi');
const { obtenerDetallesEmpresa, actualizarDetallesEmpresa, normalizeSubdomain } = require('../../services/empresaService');
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
const { buildFotoPlanWithFallback } = require('../../services/fotoPlanIAHelpers');
const {
    pickFirstString,
    findEntityByIdLoose,
    unwrapSeoJsonLdResult,
    extractDescripcionComercialNarrativa,
} = require('../../services/aiResponseNormalize');
const { optimizeImage } = require('../../services/imageProcessingService');
const {
    assertOptimizedBuffers,
    assertDistinctPublicUrls,
    rollbackPublicUrls,
} = require('../../services/imageUploadGuards');
const { generateForTask } = require('../../services/aiContentService');
const { AI_TASK } = require('../../services/ai/aiEnums');
const { promptPlanFotos } = require('../../services/ai/prompts/fotoPlan');
const pool = require('../../db/postgres');
const {
    uploadFotoToGaleria,
    updateFoto,
    collectAllowedHighlightImagePaths,
    eliminarFoto,
    obtenerDatosFoto,
} = require('../../services/galeriaService');
const { syncDomain, removeCustomDomain } = require('../../services/renderDomainService');
const { ssrCache } = require('../../services/cacheService');
const { sanitizeBookingSettingsIncoming } = require('../../services/bookingSettingsSanitize');
const {
    sanitizeSeoSettingsIncoming,
    sanitizeGoogleSearchConsoleHtmlVerification,
} = require('../../services/websiteSeoSettingsSanitize');
const { sanitizeIntegrationsSettingsIncoming } = require('../../services/integrationsSettingsSanitize');
const { evaluateGoogleHotelsHealth } = require('../../services/googleHotelsHealthService');
const {
    runGooglePartnerFeedsSelftest,
    buildPartnerFeedUrlsForDisplay,
} = require('../../services/googleHotelsPartner/partnerFeedsSelftest');
const { createDefaultTerminosCondiciones, mergeTerminosCondiciones } = require('../../services/terminosCondicionesDefaults');
const { aiPanelGenerationLimiter } = require('../../middleware/aiPanelGenerationLimiter');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const gscVerificationUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10240 },
    fileFilter: (_req, file, cb) => {
        const n = String(file.originalname || '').toLowerCase();
        if (!n.endsWith('.html')) {
            return cb(new Error('Solo se permiten archivos .html'));
        }
        cb(null, true);
    },
});

function gscVerificationUploadMw(req, res, next) {
    gscVerificationUpload.single('file')(req, res, (err) => {
        if (!err) return next();
        const msg = err.code === 'LIMIT_FILE_SIZE'
            ? 'El archivo es demasiado grande (máx. 10 KB).'
            : (err.message || 'Archivo no válido.');
        return res.status(400).json({ error: msg });
    });
}

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

    /** Límite por empresa: evita spam en narrativa, JSON-LD, plan fotos, subidas con metadatos IA, etc. */
    router.use(aiPanelGenerationLimiter);

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

    // Semáforo Google Hotels / feeds (panel empresa)
    router.get('/google-hotels-health', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const report = await evaluateGoogleHotelsHealth(empresaId);
            res.status(200).json(report);
        } catch (error) {
            next(error);
        }
    });

    /**
     * Metadatos feeds partner (sin secretos). Vista operación plataforma en Canales IA;
     * post–Google Hotels: restringir a rol superadmin/operador (TASKS/tema/SM-venta-ia/venta-ia.md §8).
     */
    router.get('/google-partner-feed-operator', (_req, res, next) => {
        try {
            const token = String(process.env.GOOGLE_PARTNER_FEED_AUTH_TOKEN || '').trim();
            res.status(200).json({
                tokenConfigured: token.length >= 16,
                ...buildPartnerFeedUrlsForDisplay(),
            });
        } catch (error) {
            next(error);
        }
    });

    /**
     * Misma comprobación que smoke HTTP CLI; usa token solo desde env.
     * Provisional: cualquier admin JWT empresa; luego solo plataforma (§8).
     */
    router.post('/google-partner-feed-selftest', async (_req, res, next) => {
        try {
            const out = await runGooglePartnerFeedsSelftest();
            res.status(200).json(out);
        } catch (error) {
            next(error);
        }
    });

    // Plantilla HTML de términos y condiciones (botón en vista Términos)
    router.get('/terminos-condiciones/plantilla', async (req, res, next) => {
        try {
            res.status(200).json({ plantilla: createDefaultTerminosCondiciones() });
        } catch (error) {
            next(error);
        }
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

            // Si solo llega domain (sin subdomain), derivar subdomain para columnas empresas.* y tenantResolver.
            if (settings.general && newDomain) {
                const internalHost =
                    newDomain.endsWith('.suitemanagers.com') ||
                    newDomain.endsWith('.suitemanager.com') ||
                    newDomain.endsWith('.onrender.com');
                if (internalHost) {
                    const derived = normalizeSubdomain(newDomain.split('.')[0]);
                    if (derived && !String(settings.general.subdomain || '').trim()) {
                        settings.general.subdomain = derived;
                    }
                }
            }

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
            if (settings.seo) {
                websiteSettings.seo = sanitizeSeoSettingsIncoming(settings.seo);
            }
            if (settings.booking) {
                const bookingCheck = sanitizeBookingSettingsIncoming(settings.booking);
                if (!bookingCheck.ok) {
                    return res.status(400).json({
                        error: 'Configuración de reserva inválida.',
                        details: bookingCheck.errors,
                    });
                }
                websiteSettings.booking = bookingCheck.booking;
            }

            if (settings.integrations !== undefined) {
                const integCheck = sanitizeIntegrationsSettingsIncoming(settings.integrations);
                if (!integCheck.ok) {
                    return res.status(400).json({
                        error: 'Tokens de integración inválidos.',
                        details: integCheck.errors,
                    });
                }
                websiteSettings.integrations = integCheck.integrations;
            }

            // Vista Términos (frontend/views/terminosCondiciones.js) envía solo { terminosCondiciones }
            if (settings.terminosCondiciones !== undefined) {
                websiteSettings.terminosCondiciones = mergeTerminosCondiciones(
                    empresaActual.websiteSettings?.terminosCondiciones,
                    settings.terminosCondiciones
                );
            }

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

    // POST Subir archivo HTML de verificación Search Console (nombre y cuerpo desde el fichero)
    router.post('/google-search-console-verification-upload', gscVerificationUploadMw, async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            if (!req.file) {
                return res.status(400).json({ error: 'Selecciona el archivo .html descargado desde Google Search Console.' });
            }
            const originalName = String(req.file.originalname || '').trim();
            const htmlBody = req.file.buffer.toString('utf8');
            const sanitized = sanitizeGoogleSearchConsoleHtmlVerification({
                filename: originalName.toLowerCase(),
                htmlBody,
            });
            if (!sanitized.filename || !sanitized.htmlBody) {
                return res.status(400).json({
                    error: 'Archivo no válido. El nombre debe ser el que entrega Google (p. ej. googlec1387a55e90aa059.html) y el contenido el del archivo descargado.',
                });
            }
            const empresaActual = await obtenerDetallesEmpresa(db, empresaId);
            const existingSeo = empresaActual.websiteSettings?.seo || {};
            await actualizarDetallesEmpresa(db, empresaId, {
                websiteSettings: {
                    seo: {
                        ...existingSeo,
                        googleSearchConsoleHtmlVerification: sanitized,
                    },
                },
            });
            invalidateSsrCache(empresaId);
            return res.status(200).json({
                ok: true,
                filename: sanitized.filename,
                message: 'Archivo guardado. Abre en el navegador la URL del archivo en tu sitio público y luego pulsa Verificar en Google.',
            });
        } catch (error) {
            return next(error);
        }
    });

    router.delete('/google-search-console-verification-file', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const empresaActual = await obtenerDetallesEmpresa(db, empresaId);
            const existingSeo = empresaActual.websiteSettings?.seo || {};
            const { googleSearchConsoleHtmlVerification: _drop, ...restSeo } = existingSeo;
            await actualizarDetallesEmpresa(db, empresaId, {
                websiteSettings: {
                    seo: {
                        ...restSeo,
                        googleSearchConsoleHtmlVerification: { filename: '', htmlBody: '' },
                    },
                },
            });
            invalidateSsrCache(empresaId);
            return res.status(200).json({ ok: true, message: 'Archivo de verificación eliminado.' });
        } catch (error) {
            return next(error);
        }
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
                quality: 78
            });

            const storagePathThumb = `empresas/${empresaId}/website/hero-${imageId}-thumb.${outputFormat}`;
            const { buffer: thumbBuffer } = await optimizeImage(file.buffer, {
                maxWidth: 960,
                quality: 70
            });
            assertOptimizedBuffers([optimizedBuffer, thumbBuffer]);

            let thumbPublicUrl = '';
            let publicUrl = '';
            try {
                thumbPublicUrl = await uploadFile(thumbBuffer, storagePathThumb, `image/${outputFormat}`);
                publicUrl = await uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`);
                assertDistinctPublicUrls(publicUrl, thumbPublicUrl);
            } catch (uploadErr) {
                await rollbackPublicUrls([thumbPublicUrl, publicUrl].filter(Boolean));
                throw uploadErr;
            }

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
                'websiteSettings.theme.heroImageThumbUrl': thumbPublicUrl,
                'websiteSettings.theme.heroImageAlt': safeAlt,
                'websiteSettings.theme.heroImageTitle': safeTitle
            };

            console.log(`[DEBUG upload-hero-image] Guardando en DB:`, updatePayload);
            try {
                await actualizarDetallesEmpresa(db, empresaId, {
                    websiteSettings: {
                        theme: {
                            heroImageUrl: publicUrl,
                            heroImageThumbUrl: thumbPublicUrl,
                            heroImageAlt: safeAlt,
                            heroImageTitle: safeTitle,
                        },
                    },
                });
                invalidateSsrCache(empresaId);
                console.log(`[DEBUG upload-hero-image] Guardado en DB exitoso`);
            } catch (dbError) {
                console.error(`[DEBUG upload-hero-image] Error guardando en DB:`, dbError.message);
                await rollbackPublicUrls([publicUrl, thumbPublicUrl]);
                throw dbError;
            }

            console.log(`[DEBUG upload-hero-image] Retornando respuesta:`, updatePayload);
            res.status(201).json(updatePayload);
        } catch (error) {
            const status = Number(error.statusCode) || 500;
            return res.status(status).json({ error: error.message || 'No se pudo subir la imagen de portada.' });
        }
    });

    // POST Optimizar Perfil Empresa (Estrategia Completa - Texto)
    router.post('/optimize-profile', async (req, res) => {
        try {
            const { empresaId } = req.user;
            const { historia } = req.body;
            if (!historia || typeof historia !== 'string' || historia.trim().length < 20) {
                return res.status(400).json({ error: 'La descripción debe tener al menos 20 caracteres.' });
            }
            const empresaContext = await getEmpresaContext(empresaId).catch(() => null);
            const strategy = await generarPerfilEmpresa(historia.trim(), empresaContext);
            if (!strategy || typeof strategy !== 'object') {
                return res.status(503).json({
                    error:
                        'La IA no devolvió un perfil válido. Revisa las claves API del panel (GROQ/GEMINI u otro proveedor en .env) o inténtalo más tarde.',
                    code: 'OPTIMIZE_PROFILE_EMPTY',
                });
            }
            res.status(200).json(strategy);
        } catch (error) {
            if (error.message?.includes('patrones no permitidos')) {
                return res.status(400).json({ error: 'El texto contiene contenido no permitido.' });
            }
            if (error.code === 'AI_QUOTA_EXCEEDED') {
                return res.status(429).json({
                    error: error.message || 'Cuota de IA excedida. Intenta más tarde.',
                    code: 'AI_QUOTA_EXCEEDED',
                });
            }
            console.error('[optimize-profile]', error);
            return res.status(500).json({
                error: error.message || 'No se pudo generar la estrategia.',
                code: 'OPTIMIZE_PROFILE_FAILED',
            });
        }
    });

    // --- Normas / reglas (alias bajo /website; la ruta principal es /api/propiedades/house-rules) ---
    mountHouseRulesRoutes(router, db);
    mountWebsiteBlogRoutes(router, db);

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
                    await deleteFileByPath(propiedad.websiteData.cardImage.storagePath).catch(() => {});
                }
                if (propiedad.websiteData?.cardImage?.thumbnailUrl) {
                    await deleteFileByPath(propiedad.websiteData.cardImage.thumbnailUrl).catch(() => {});
                }

                const imageId = `card-${uuidv4()}`;
                const outputFormat = 'webp';
                const basePath = `empresas/${empresaId}/propiedades/${req.params.propiedadId}/images/${imageId}`;
                const storagePath = `${basePath}.${outputFormat}`;
                const thumbPath = `${basePath}_thumb.${outputFormat}`;
                const { buffer: optimizedBuffer } = await optimizeImage(req.file.buffer, {
                    maxWidth: 800,
                    quality: 80
                });
                const { buffer: thumbBuffer } = await optimizeImage(req.file.buffer, {
                    maxWidth: 800,
                    quality: 72
                });
                assertOptimizedBuffers([optimizedBuffer, thumbBuffer]);

                let publicUrl = '';
                let thumbPublicUrl = '';
                try {
                    [publicUrl, thumbPublicUrl] = await Promise.all([
                        uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`),
                        uploadFile(thumbBuffer, thumbPath, `image/${outputFormat}`),
                    ]);
                    assertDistinctPublicUrls(publicUrl, thumbPublicUrl);
                } catch (uploadErr) {
                    await rollbackPublicUrls([publicUrl, thumbPublicUrl].filter(Boolean));
                    throw uploadErr;
                }

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

                const cardImageData = {
                    imageId,
                    storagePath: publicUrl,
                    thumbnailUrl: thumbPublicUrl,
                    altText: metadata.altText,
                    title: metadata.title,
                };
                try {
                    await actualizarPropiedad(db, empresaId, req.params.propiedadId, { 'websiteData.cardImage': cardImageData });
                    invalidateSsrCache(empresaId);
                } catch (dbErr) {
                    await rollbackPublicUrls([publicUrl, thumbPublicUrl]);
                    throw dbErr;
                }
                return res.status(201).json(cardImageData);
            }

            // Si no es archivo, probablemente es un update normal (aunque este endpoint es PUT /propiedad/:id)
            // Se mantiene lógica anterior por si acaso, pero el return arriba corta el flujo si hubo archivo.
            next();
        } catch (error) {
            if (req.file) {
                const status = Number(error.statusCode) || 500;
                return res.status(status).json({ error: error.message || 'No se pudo subir la imagen principal.' });
            }
            next(error);
        }
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
                await deleteFileByPath(propiedad.websiteData.cardImage.storagePath).catch(() => {});
            }
            if (propiedad.websiteData?.cardImage?.thumbnailUrl) {
                await deleteFileByPath(propiedad.websiteData.cardImage.thumbnailUrl).catch(() => {});
            }

            const imageId = `card-${uuidv4()}`;
            const outputFormat = 'webp';
            const basePath = `empresas/${empresaId}/propiedades/${propiedadId}/images/${imageId}`;
            const storagePath = `${basePath}.${outputFormat}`;
            const thumbPath = `${basePath}_thumb.${outputFormat}`;

            const { buffer: optimizedBuffer } = await optimizeImage(file.buffer, {
                maxWidth: 800,
                quality: 80
            });
            const { buffer: thumbBuffer } = await optimizeImage(file.buffer, {
                maxWidth: 800,
                quality: 72
            });
            assertOptimizedBuffers([optimizedBuffer, thumbBuffer]);

            let publicUrl = '';
            let thumbPublicUrl = '';
            try {
                [publicUrl, thumbPublicUrl] = await Promise.all([
                    uploadFile(optimizedBuffer, storagePath, `image/${outputFormat}`),
                    uploadFile(thumbBuffer, thumbPath, `image/${outputFormat}`),
                ]);
                assertDistinctPublicUrls(publicUrl, thumbPublicUrl);
            } catch (uploadErr) {
                await rollbackPublicUrls([publicUrl, thumbPublicUrl].filter(Boolean));
                throw uploadErr;
            }

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

            const cardImageData = {
                imageId,
                storagePath: publicUrl,
                thumbnailUrl: thumbPublicUrl,
                altText: metadata.altText,
                title: metadata.title,
            };

            try {
                await actualizarPropiedad(db, empresaId, propiedadId, { 'websiteData.cardImage': cardImageData });
                invalidateSsrCache(empresaId);
            } catch (dbErr) {
                await rollbackPublicUrls([publicUrl, thumbPublicUrl]);
                throw dbErr;
            }

            res.status(201).json(cardImageData);
        } catch (error) {
            console.error("Error upload-card-image:", error);
            const status = Number(error.statusCode) || 500;
            return res.status(status).json({ error: error.message || 'No se pudo subir la imagen principal.' });
        }
    });

    router.post('/propiedad/:propiedadId/upload-image/:componentId', upload.any(), async (req, res) => {
        console.log(`[DEBUG] POST upload-image hit! Propiedad: ${req.params.propiedadId}, Component: ${req.params.componentId}`);
        const { empresaId, nombreEmpresa } = req.user;
        const { propiedadId, componentId } = req.params;
        const createdGaleriaIds = [];
        try {
            const shotContext = req.body.shotContext || null;

            if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files.' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });
            const componente = propiedad.componentes?.find(c => c.id === componentId);
            if (!componente) return res.status(404).json({ error: 'Componente no encontrado.' });

            const resultadosParaFrontend = [];
            const descPropiedad = propiedad.websiteData?.aiDescription || propiedad.descripcion || '';

            for (const file of req.files) {
                const galeriaResults = await uploadFotoToGaleria(db, empresaId, propiedadId, [file]);
                if (!galeriaResults?.length) {
                    const err = new Error('No se pudo registrar la imagen en galería.');
                    err.statusCode = 422;
                    throw err;
                }
                const gf = galeriaResults[0];
                createdGaleriaIds.push(gf.id);

                const { buffer: optimizedBuffer } = await optimizeImage(file.buffer, {
                    maxWidth: 1200,
                    quality: 80
                });

                let metadata = { altText: componente.nombre, title: componente.nombre };
                try {
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
                    console.warn('Fallo IA Visión:', aiError.message);
                }

                await updateFoto(db, empresaId, propiedadId, gf.id, {
                    espacio: componente.nombre,
                    espacioId: componentId,
                    altText: metadata.altText || '',
                    estado: 'manual',
                    confianza: !metadata.advertencia ? 0.95 : 0.85
                });

                resultadosParaFrontend.push({
                    imageId: gf.id,
                    storagePath: gf.storageUrl,
                    thumbnailUrl: gf.thumbnailUrl,
                    altText: metadata.altText,
                    title: metadata.title,
                    shotContext: shotContext,
                    advertencia: metadata.advertencia || null
                });
            }

            const websiteData = propiedad.websiteData || { aiDescription: '', images: {}, cardImage: null };
            const imagesActualizadas = { ...(websiteData.images || {}) };
            for (const img of resultadosParaFrontend) {
                imagesActualizadas[componentId] = [...(imagesActualizadas[componentId] || []), img];
            }
            websiteData.images = imagesActualizadas;
            await actualizarPropiedad(db, empresaId, propiedadId, { websiteData });
            invalidateSsrCache(empresaId);

            recalcularFotoStats(db, empresaId, propiedadId, propiedad.componentes, imagesActualizadas).catch(() => {});

            res.status(201).json(resultadosParaFrontend);
        } catch (error) {
            for (let i = createdGaleriaIds.length - 1; i >= 0; i--) {
                await eliminarFoto(db, empresaId, propiedadId, createdGaleriaIds[i]).catch(() => {});
            }
            console.error(`Error POST upload-image:`, error);
            const status = Number(error.statusCode) || 500;
            return res.status(status).json({ error: error.message || 'No se pudo subir la imagen.' });
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
            if (img?.thumbnailUrl) await deleteFileByPath(img.thumbnailUrl);

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
            if (!imageId) return res.status(400).json({ error: 'imageId es obligatorio (foto de galería).' });

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada.' });
            const componente = propiedad.componentes?.find(c => c.id === componentId);
            if (!componente) return res.status(404).json({ error: 'Componente no encontrado.' });

            const foto = await obtenerDatosFoto(db, empresaId, propiedadId, imageId);
            if (!foto) return res.status(404).json({ error: 'La foto no existe en la galería.' });

            const fullUrl = foto.storageUrl || foto.storagePath;
            const thumbUrl = foto.thumbnailUrl;
            if (!fullUrl || !thumbUrl || String(fullUrl).trim() === String(thumbUrl).trim()) {
                return res.status(422).json({
                    error: 'La foto no tiene miniatura válida en galería. Vuelve a subirla desde el panel.',
                });
            }

            const canonicalFull = String(fullUrl).trim();
            const canonicalThumb = String(thumbUrl).trim();
            const requested = String(imageUrl || '').trim();
            if (requested && requested !== canonicalFull && requested !== canonicalThumb) {
                return res.status(409).json({ error: 'La URL no coincide con la foto seleccionada en galería.' });
            }

            const imgResponse = await fetch(canonicalFull);
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

            const imageData = {
                imageId,
                storagePath: canonicalFull,
                thumbnailUrl: thumbUrl,
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

            // Un solo intento IA: la cadena completa (8+ proveedores × delay + latencia) puede superar el timeout
            // del proxy/navegador → "Failed to fetch". Recortar intentos; el plan por reglas rellena si la IA falla.
            const photoPlanMaxProviders = Math.max(
                1,
                Number(process.env.AI_PHOTO_PLAN_MAX_PROVIDERS || 4)
            );
            let planIA = await generateForTask(AI_TASK.PHOTO_PLAN, prompt, {
                maxProviders: photoPlanMaxProviders,
            });

            let { planValidado, aiContributed } = buildFotoPlanWithFallback(
                planIA,
                espacios,
                propiedad.componentes,
                tiposElemento
            );

            // Si la IA devolvió JSON ilegible o claves que no casaron, el plan por reglas debe llenar igualmente.
            if (Object.keys(planValidado).length === 0 && espacios.length > 0) {
                ({ planValidado, aiContributed } = buildFotoPlanWithFallback(
                    null,
                    espacios,
                    propiedad.componentes,
                    tiposElemento
                ));
            }

            if (Object.keys(planValidado).length === 0) {
                return res.status(502).json({
                    error: 'No se pudo armar un plan de fotos para esta propiedad. Verifica que cada espacio tenga id en el inventario.',
                });
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
                _aiModelContributed: aiContributed,
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

            // Con inventario en buildContext: solo narrativa anclada al inventario (SSR / canales IA). Sin fallback genérico.
            if (pool) {
                try {
                    const buildContext = await getBuildContext(db, empresaId, propiedadId);
                    if (buildContext?.producto?.espacios?.length) {
                        let narrativa;
                        try {
                            narrativa = await generarNarrativaDesdeContexto(buildContext);
                        } catch (aiErr) {
                            console.error('[generate-ai-text] IA narrativa:', aiErr?.message || aiErr);
                            return res.status(503).json({
                                error:
                                    'No se pudo generar texto desde el inventario verificado. Reintenta en unos segundos.',
                            });
                        }
                        const textoNarr = extractDescripcionComercialNarrativa(narrativa)
                            || String(narrativa?.descripcionComercial || narrativa?.descripcion || '').trim();
                        if (narrativa && textoNarr) {
                            await updateBuildContextSection(empresaId, propiedadId, 'narrativa', {
                                ...narrativa,
                                descripcionComercial: textoNarr,
                                generadoEn: new Date().toISOString(),
                            });
                            invalidateSsrCache(empresaId);
                            const puntosFuertes = Array.isArray(narrativa.puntosFuertes)
                                ? narrativa.puntosFuertes
                                : [];
                            return res.json({
                                ...narrativa,
                                descripcionComercial: textoNarr,
                                texto: textoNarr,
                                puntosFuertes,
                            });
                        }
                        return res.status(503).json({
                            error:
                                'La IA no devolvió narrativa basada en el inventario. Reintenta; si persiste, revisa claves y cuotas del proveedor de IA.',
                        });
                    }
                } catch (invErr) {
                    console.warn('[generate-ai-text] buildContext no disponible, flujo sin inventario:', invErr.message);
                }
            }

            // Sin inventario en buildContext: generador clásico (componentes + empresa). No usar como sustituto del bloque anterior.
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
            const { propiedadId } = req.params;
            const context = await getBuildContext(db, empresaId, propiedadId);
            if (!context?.producto?.espacios?.length) {
                return res.status(400).json({
                    error: 'El alojamiento no tiene espacios configurados. Completa los pasos 1-3 primero.'
                });
            }
            const narrativa = await generarNarrativaDesdeContexto(context);
            const textoNarr = extractDescripcionComercialNarrativa(narrativa)
                || pickFirstString(narrativa, ['descripcionComercial', 'descripcion', 'texto']);
            if (!narrativa || textoNarr.length < 32) {
                return res.status(503).json({
                    error:
                        'No se pudo generar narrativa. Si las cuotas de Gemini/Groq están agotadas, recarga en unos minutos o revisa facturación.',
                });
            }
            const narrativaNorm = {
                ...narrativa,
                descripcionComercial: narrativa.descripcionComercial || textoNarr,
            };
            await updateBuildContextSection(empresaId, propiedadId, 'narrativa', {
                ...narrativaNorm,
                generadoEn: new Date().toISOString(),
            });
            if (pool && (narrativaNorm.homeH1 || narrativaNorm.descripcionComercial)) {
                await pool.query(
                    `UPDATE propiedades
                     SET metadata = jsonb_set(jsonb_set(metadata,
                         '{websiteData,h1}', $1::jsonb, true),
                         '{websiteData,aiDescription}', $2::jsonb, true),
                         updated_at = NOW()
                     WHERE id = $3 AND empresa_id = $4`,
                    [
                        JSON.stringify(narrativaNorm.homeH1 || ''),
                        JSON.stringify(narrativaNorm.descripcionComercial || ''),
                        propiedadId, empresaId,
                    ]
                );
            }
            invalidateSsrCache(empresaId);
            res.json(narrativaNorm);
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
            const { validatePreGenerationData, getGenerationRecommendations } = require('../../services/ai/jsonldPreValidation');
            const { spacesToContainsPlace, validateJsonLd } = require('../../services/ai/schemaMappings');

            const [context, propiedad, productoFresco] = await Promise.all([
                getBuildContext(db, empresaId, propiedadId),
                obtenerPropiedadPorId(db, empresaId, propiedadId),
                construirProductoDesdeComponentes(db, empresaId, propiedadId),
            ]);

            const contextFresco = productoFresco
                ? { ...context, producto: productoFresco }
                : context;

            const preValidation = validatePreGenerationData(contextFresco);
            if (!preValidation.canGenerate) {
                return res.status(400).json({
                    error: 'Datos incompletos para generar JSON-LD',
                    details: preValidation.errors,
                    warnings: preValidation.warnings,
                    recommendations: getGenerationRecommendations(contextFresco),
                    requiredAction: preValidation.recommendedAction,
                });
            }

            if (!contextFresco?.narrativa?.descripcionComercial) {
                return res.status(400).json({
                    error: 'Genera el contenido web primero (paso 4 — narrativa).'
                });
            }

            let result = await generarJsonLdDesdeContexto(contextFresco);
            result = unwrapSeoJsonLdResult(result);
            if (!result?.jsonLd || typeof result.jsonLd !== 'object') {
                await new Promise((r) => setTimeout(r, 400));
                result = unwrapSeoJsonLdResult(await generarJsonLdDesdeContexto(contextFresco));
            }
            if (!result?.jsonLd || typeof result.jsonLd !== 'object') {
                return res.status(503).json({
                    error: 'La IA no devolvió JSON-LD / SEO válido. Reintenta en unos segundos.',
                });
            }

            if (result.jsonLd && contextFresco?.producto?.espacios?.length) {
                try {
                    const containsPlace = spacesToContainsPlace(contextFresco.producto.espacios);
                    if (containsPlace.length > 0) {
                        result.jsonLd.containsPlace = containsPlace;
                    }
                } catch (placeErr) {
                    console.warn('[JSON-LD] No se pudo inyectar containsPlace:', placeErr.message);
                }
            }

            let imageUrls = [];
            if (pool && result.jsonLd) {
                try {
                    const { rows: galeriaRows } = await pool.query(
                        `SELECT storage_url FROM galeria
                         WHERE empresa_id=$1 AND propiedad_id=$2 AND estado IN ('auto','manual')
                         ORDER BY CASE WHEN rol='portada' THEN 0 ELSE 1 END, confianza DESC, orden ASC LIMIT 8`,
                        [empresaId, propiedadId]
                    );
                    imageUrls = galeriaRows.map((r) => r.storage_url).filter(Boolean);
                } catch (photoErr) {
                    console.warn('[JSON-LD] No se pudo leer galería:', photoErr.message);
                }
            }
            if (imageUrls.length === 0 && propiedad && result.jsonLd) {
                const webData = propiedad.websiteData || {};
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
            }
            if (result.jsonLd && imageUrls.length > 0) {
                result.jsonLd.image = imageUrls;
            }

            if (result.jsonLd) {
                try {
                    const empresaData = await obtenerDetallesEmpresa(db, empresaId);
                    const tipoNegocio = empresaData.tipoNegocio || 'complejo';
                    const validation = validateJsonLd(result.jsonLd, tipoNegocio);
                    if (!validation.isValid) {
                        console.warn('[JSON-LD] Validación falló:', validation.errors);
                    } else {
                        console.log('[JSON-LD] Validación exitosa');
                    }
                } catch (valErr) {
                    console.warn('[JSON-LD] Error en validación:', valErr.message);
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

    // POST /website/empresa/areas-comunes/:espacioId/generate-description
    router.post('/empresa/areas-comunes/:espacioId/generate-description', async (req, res, next) => {
        try {
            const { empresaId } = req.user;
            const { espacioId } = req.params;
            const { rows } = await pool.query(
                `SELECT configuracion->'areas_comunes' AS areas FROM empresas WHERE id = $1`,
                [empresaId]
            );
            const espacios = rows[0]?.areas?.espacios || [];
            const espacio = findEntityByIdLoose(espacios, espacioId);
            if (!espacio) return res.status(404).json({ error: 'Espacio no encontrado' });

            const elementos = (espacio.elementos || [])
                .map(e => `${e.nombre}${e.capacity > 0 ? ` (cap. ${e.capacity})` : ''}`)
                .join(', ');
            const prompt = `Eres un redactor de contenido para un portal de alojamiento turístico.
Escribe una descripción atractiva y concisa (2-3 oraciones, máximo 80 palabras) para una instalación compartida del recinto llamada "${espacio.nombre}".
${elementos ? `Cuenta con los siguientes elementos: ${elementos}.` : ''}
Tono cálido y orientado a huéspedes. Solo prosa fluida, sin listas ni puntos.
Responde en JSON: { "descripcion": "texto aquí" }`;

            const rawIa = await generateForTask(AI_TASK.PROPERTY_DESCRIPTION, prompt);
            const descripcion = pickFirstString(rawIa || {}, [
                'descripcion', 'descripcionComercial', 'texto', 'text', 'content', 'cuerpo',
            ]);
            if (!descripcion) {
                return res.status(503).json({ error: 'El servicio de IA no respondió. Intenta nuevamente.' });
            }
            res.json({ descripcion });
        } catch (error) { next(error); }
    });

    // ───────────────────────────────────────────────────────────────────────────

    return router;
};
