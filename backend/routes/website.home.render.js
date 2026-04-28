const { loadHomeSearchBundle, loadHomeSeoAndContent } = require('./website.home.helpers');
const { normalizeBookingUrlForSsr } = require('../services/bookingSettingsSanitize');

/**
 * Renderiza GET / (home SSR).
 */
async function renderHomePage(req, res, db, deps) {
    const {
        obtenerPropiedadesPorEmpresa,
        getAvailabilityData,
        calculatePrice,
        findNormalCombination,
        obtenerResumenResenas,
        generarContenidoCorporativo,
        fetchTarifasYCanal,
        getPrecioBaseNoche
    } = deps;

    const empresaId = req.empresa.id;
    const empresaCompleta = req.empresaCompleta;

    try {
        const {
            resultadosParaMostrar,
            isSearchResult,
            priceRange,
            amenidadesSet,
            offers
        } = await loadHomeSearchBundle({
            req,
            db,
            empresaId,
            empresaCompleta,
            obtenerPropiedadesPorEmpresa,
            getAvailabilityData,
            calculatePrice,
            findNormalCombination,
            fetchTarifasYCanal,
            getPrecioBaseNoche
        });

        const { resenasResumen, schemaData, corporateContent } = await loadHomeSeoAndContent({
            req,
            empresaId,
            empresaCompleta,
            obtenerResumenResenas,
            generarContenidoCorporativo,
            priceRange,
            offers,
            amenidadesSet
        });

        res.render('home', {
            title: empresaCompleta?.websiteSettings?.seo?.homeTitle
                || empresaCompleta?.websiteSettings?.content?.homeH1
                || empresaCompleta.nombre,
            description: empresaCompleta?.websiteSettings?.seo?.homeDescription
                || empresaCompleta?.websiteSettings?.content?.homeIntro
                || `Reservas en ${empresaCompleta.nombre}`,
            resultados: resultadosParaMostrar,
            isSearchResult,
            query: req.query,
            schemaData,
            corporateContent: corporateContent?.homePage || null,
            empresaContext: req.empresaContext || null,
            baseUrl: req.baseUrl || '',
            resenasResumen: resenasResumen || null
        });
    } catch (error) {
        console.error(`Error al renderizar el home para ${empresaId}:`, error);
        res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { id: empresaId, nombre: 'Error Crítico' } });
    }
}

async function renderContactoPage(req, res) {
    const empresaCompleta = req.empresaCompleta;
    try {
        res.render('contacto', { title: `Contacto | ${empresaCompleta.nombre}` });
    } catch (error) {
        res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { nombre: 'Error Crítico' } });
    }
}

async function renderGuestGuidePage(req, res) {
    const empresaCompleta = req.empresaCompleta;
    try {
        const bk = empresaCompleta?.websiteSettings?.booking || {};
        const guestBookingLinks = {
            manualHuespedUrl: normalizeBookingUrlForSsr(bk.manualHuespedUrl),
            manualHuespedPdfUrl: normalizeBookingUrlForSsr(bk.manualHuespedPdfUrl),
            checkinOnlineUrl: normalizeBookingUrlForSsr(bk.checkinOnlineUrl),
        };
        const htmlLang = empresaCompleta?.websiteSettings?.email?.idiomaPorDefecto === 'en' ? 'en' : 'es';
        res.render('guia-huesped', {
            title: htmlLang === 'en' ? `Guest guide | ${empresaCompleta.nombre}` : `Guía del huésped | ${empresaCompleta.nombre}`,
            guestBookingLinks,
            htmlLang,
        });
    } catch (error) {
        res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { nombre: 'Error Crítico' } });
    }
}

module.exports = { renderHomePage, renderContactoPage, renderGuestGuidePage };
