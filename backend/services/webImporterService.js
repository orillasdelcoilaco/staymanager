/**
 * webImporterService.js
 *
 * Crawlea un sitio web de alojamiento y extrae toda la información
 * necesaria para crear una empresa en SuiteManager.
 *
 * Flujo:
 *  1. Fetch homepage → detecta idioma, estructura, links internos
 *  2. Fetch páginas de alojamientos (cabañas/habitaciones)
 *  3. Selecciona imágenes representativas por alojamiento
 *  4. Gemini Vision analiza las imágenes → detecta espacios y activos
 *  5. Retorna ImportData estructurado listo para empresaImporterService
 */

const cheerio = require('cheerio');
const {
    sleep,
    fetchHTML,
    extractImages,
    detectAccommodationLinks,
    selectRepresentativeImages,
    extractFromSitemap,
    analyzeTextWithAI,
    analyzeImagesWithVision,
    buildImportData,
} = require('./webImporterService.helpers');

// ─────────────────────────────────────────────
// SUB-FUNCIONES PRIVADAS DE analyzeWebsite
// ─────────────────────────────────────────────

/**
 * Obtiene el HTML del homepage, extrae texto, imágenes y detecta links
 * a páginas de alojamientos (con fallbacks por rutas comunes y sitemap XML).
 */
async function _analizarMetadata(url, baseUrl) {
    console.log(`[WebImporter] Fetching homepage...`);
    const homeHtml = await fetchHTML(url);
    if (!homeHtml) throw new Error(`No se pudo acceder a ${url}`);

    const $home = cheerio.load(homeHtml);
    $home('script, style, noscript, head').remove();
    const homeText = $home('body').text().replace(/\s+/g, ' ').trim();
    const homeImages = extractImages($home, baseUrl);

    let accommodationLinks = detectAccommodationLinks($home, baseUrl);

    if (accommodationLinks.length === 0) {
        const commonPaths = [
            '/cabanas', '/cabañas', '/alojamientos', '/habitaciones', '/rooms',
            '/accommodations', '/cabins', '/departamentos', '/suites', '/propiedades'
        ];
        console.log(`[WebImporter] Sin links en HTML, probando rutas comunes...`);
        for (const p of commonPaths) {
            const testUrl = baseUrl + p;
            const html = await fetchHTML(testUrl, 5000);
            if (html) {
                const $test = cheerio.load(html);
                const found = detectAccommodationLinks($test, baseUrl);
                if (found.length > 0) {
                    accommodationLinks = found;
                    console.log(`[WebImporter] Links encontrados en ${testUrl}: ${found.length}`);
                    break;
                }
            }
        }
    }

    if (accommodationLinks.length === 0) {
        console.log(`[WebImporter] Intentando sitemap XML...`);
        const sitemapLinks = await extractFromSitemap(baseUrl);
        if (sitemapLinks.length > 0) {
            accommodationLinks = sitemapLinks;
            console.log(`[WebImporter] Links del sitemap: ${sitemapLinks.length}`);
        }
    }

    console.log(`[WebImporter] Links de alojamientos detectados: ${accommodationLinks.length}`);
    return { homeText, homeImages, accommodationLinks };
}

/**
 * Ejecuta el análisis de visión IA para cada alojamiento que tenga imágenes asignadas.
 */
async function _analizarImagenes(textAnalysis, imagesPerAloj, useVision) {
    const visionResults = {};
    if (!useVision) return visionResults;

    const { GeminiProvider } = (() => {
        try { return { GeminiProvider: require('./ai_providers/geminiProvider') }; } catch { return {}; }
    })();
    const aiConfig = require('../config/aiConfig');
    const gemini = GeminiProvider ? new GeminiProvider(aiConfig.gemini) : null;

    if (!gemini || !gemini.model) return visionResults;

    console.log(`[WebImporter] Analizando imágenes con Gemini Vision...`);
    for (const aloj of (textAnalysis.alojamientos || [])) {
        const images = imagesPerAloj[aloj.nombre] || [];
        if (images.length === 0) continue;
        try {
            await sleep(500);
            const contexto = [aloj.descripcion, (aloj.amenidades || []).join(', ')].filter(Boolean).join('. ');
            const vision = await analyzeImagesWithVision(images, aloj.nombre, contexto);
            if (vision) {
                const imagenesClasificadas = vision.imagenesClasificadas || [];
                delete vision.imagenesClasificadas;
                visionResults[aloj.nombre] = { vision, imagenesClasificadas };
                console.log(`[WebImporter] Vision OK: "${aloj.nombre}" → ${vision.espaciosVisibles?.length || 0} espacios, ${imagenesClasificadas.length} imgs clasificadas`);
            }
        } catch (err) {
            console.warn(`[WebImporter] Vision skip "${aloj.nombre}": ${err.message}`);
        }
    }
    return visionResults;
}

/**
 * Construye el mapa de imágenes por alojamiento usando los datos de texto y páginas scrapeadas.
 */
function _ensamblarResultado(textAnalysis, accommodationPages) {
    const imagesPerAloj = {};
    for (const aloj of (textAnalysis.alojamientos || [])) {
        const nombreSlug = aloj.nombre.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        const cabanaNum = aloj.nombre.match(/\d+/)?.[0] || '';
        const numBoundary = cabanaNum ? new RegExp(`(?:cabana|cabin|casa)-?${cabanaNum}(?!\\d)`, 'i') : null;

        const matchPage = accommodationPages.find(p => {
            const urlLower = p.url.toLowerCase();
            if (numBoundary && numBoundary.test(urlLower)) return true;
            const slugNoNum = nombreSlug.replace(/\d+$/, '');
            if (slugNoNum.length >= 4 && urlLower.includes(slugNoNum) && (!cabanaNum || numBoundary?.test(urlLower))) return true;
            return false;
        });

        if (!matchPage) {
            console.log(`[WebImporter] "${aloj.nombre}": sin página propia (slug="${nombreSlug}", num="${cabanaNum}")`);
            continue;
        }
        console.log(`[WebImporter] "${aloj.nombre}": matchPage=${matchPage.url.split('/').slice(-2)[0]}, images=${matchPage.images.length}`);

        const imgIdentifiers = [
            cabanaNum ? new RegExp(`(?:cabana|cabin|casa)-?${cabanaNum}(?!\\d)`, 'i') : null,
            new RegExp(`${nombreSlug}(?!\\d)`, 'i')
        ].filter(Boolean);

        const specificImgs = matchPage.images.filter(imgUrl =>
            imgIdentifiers.some(rx => rx.test(imgUrl.toLowerCase()))
        );
        console.log(`[WebImporter]    imgIdentifiers=${imgIdentifiers.map(r => r.source)} → specific=${specificImgs.length}`);

        const imagePool = specificImgs.length >= 2 ? specificImgs : matchPage.images;
        const imgs = selectRepresentativeImages(imagePool, 40, 8);
        if (imgs.length > 0) {
            imagesPerAloj[aloj.nombre] = imgs;
            console.log(`[WebImporter] "${aloj.nombre}": ${imgs.length} imgs (${specificImgs.length >= 2 ? 'específicas' : 'página'}) de ${matchPage.images.length} totales`);
        }
    }
    return imagesPerAloj;
}

// ─────────────────────────────────────────────
// CRAWL PRINCIPAL
// ─────────────────────────────────────────────

/**
 * Analiza un sitio web y retorna ImportData estructurado.
 * @param {string} url - URL raíz del sitio
 * @param {object} options - { maxAccommodations: 15, useVision: true }
 * @returns {Promise<ImportData>}
 */
async function analyzeWebsite(url, options = {}) {
    const { maxAccommodations = 15, useVision = true } = options;

    if (!url.startsWith('http')) url = 'https://' + url;
    const baseUrl = new URL(url).origin;

    console.log(`\n[WebImporter] Iniciando análisis de: ${url}`);

    // ── PASO 1: Homepage + detección de links ─────────────
    const { homeText, homeImages, accommodationLinks } = await _analizarMetadata(url, baseUrl);

    // ── PASO 2: Páginas de alojamientos ──────────────────
    const scoreLink = (u) => {
        const path = u.toLowerCase();
        if (/accommodat(ion)?-(category|facility|type|list)|rooms-suites|home\/|page\/\d/i.test(path)) return 0;
        if (/[-\/]\d+\/?$/.test(path)) return 3;
        if (/\/(accommodation|alojamiento|cabana|cabin|suite|room|habitaci)\/[^\/]+\/?$/i.test(path)) return 2;
        return 1;
    };
    accommodationLinks.sort((a, b) => scoreLink(b) - scoreLink(a));
    console.log(`[WebImporter] Links ordenados (top 5): ${accommodationLinks.slice(0, 5).map(u => u.split('/').slice(-2).join('/')).join(', ')}`);

    const accommodationPages = [];
    const linksToFetch = accommodationLinks.slice(0, maxAccommodations);

    for (const link of linksToFetch) {
        await sleep(300);
        console.log(`[WebImporter] Fetching: ${link}`);
        const html = await fetchHTML(link);
        if (!html) continue;

        const $ = cheerio.load(html);
        $('script, style, noscript, head').remove();
        const pageText = $('body').text().replace(/\s+/g, ' ').trim();
        const images = extractImages($, link);

        accommodationPages.push({ url: link, text: pageText, images });
        console.log(`[WebImporter]    → ${images.length} imgs, ${pageText.length} chars texto`);
    }
    console.log(`[WebImporter] Total páginas en accommodationPages: ${accommodationPages.length}`);

    // ── PASO 3: Análisis IA de texto ─────────────────────
    console.log(`[WebImporter] Analizando texto con IA...`);
    const allText = homeText + '\n\n' + accommodationPages.map(p => p.text).join('\n\n---\n\n');
    const textAnalysis = await analyzeTextWithAI(allText, url);

    if (!textAnalysis) throw new Error('La IA no pudo analizar el texto del sitio.');
    console.log(`[WebImporter] Texto analizado: ${textAnalysis.alojamientos?.length || 0} alojamientos detectados`);

    // ── PASO 4: Seleccionar imágenes representativas ──────
    const imagesPerAloj = _ensamblarResultado(textAnalysis, accommodationPages);

    // ── PASO 5: Visión IA por alojamiento (opcional) ──────
    const visionResults = await _analizarImagenes(textAnalysis, imagesPerAloj, useVision);

    // ── PASO 6: Consolidar ImportData ────────────────────
    const importData = buildImportData(textAnalysis, visionResults, imagesPerAloj, homeImages, url);

    console.log(`\n[WebImporter] Análisis completado:`);
    console.log(`  Empresa: ${importData.empresa.nombre}`);
    console.log(`  Alojamientos: ${importData.alojamientos.length}`);
    console.log(`  Tipos de espacio: ${importData.tiposEspacio.length}`);
    console.log(`  Tipos de activo: ${importData.tiposActivo.length}`);

    return importData;
}

module.exports = { analyzeWebsite };
