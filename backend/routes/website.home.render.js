const { loadHomeSearchBundle, loadHomeSeoAndContent } = require('./website.home.helpers');

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
            title: empresaCompleta?.websiteSettings?.seo?.homeTitle || empresaCompleta.nombre,
            description: empresaCompleta?.websiteSettings?.seo?.homeDescription || `Reservas en ${empresaCompleta.nombre}`,
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

module.exports = { renderHomePage, renderContactoPage };
