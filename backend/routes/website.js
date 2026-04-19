const express = require('express');
const {
    obtenerDetallesEmpresa,
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,
    getAvailabilityData,
    calculatePrice,
    findNormalCombination,
    crearReservaPublica,
    obtenerOcupacionCalendarioPropiedad,
} = require('../services/publicWebsiteService');
const { generarContenidoCorporativo } = require('../services/ai/corporateContent');
const {
    obtenerResumen: obtenerResumenResenas,
    obtenerResenas,
    obtenerResumenPorPropiedad,
} = require('../services/resenasService');
const { getGaleria } = require('../services/galeriaService');
const { hydrateInventory } = require('../services/propiedadLogicService');
const { createWebsiteContextMiddleware } = require('./website.context');
const { createWebsiteCacheMiddleware } = require('./website.cache');
const { registerHomeRoutes } = require('./website.home');
const { registerPropertyRoutes } = require('./website.property');
const { registerBookingRoutes } = require('./website.booking');
const { registerSeoRoutes } = require('./website.seo');
const {
    fetchTarifasYCanal,
    getPrecioBaseNoche,
    formatDateForInput,
    getNextWeekend,
    computeNightlyPricesForRange,
} = require('./website.shared');

module.exports = (db) => {
    const router = express.Router();

    router.use(createWebsiteContextMiddleware({ db, obtenerDetallesEmpresa }));

    const cacheStaticRoutes = createWebsiteCacheMiddleware();
    const sharedDeps = {
        obtenerPropiedadesPorEmpresa,
        obtenerPropiedadPorId,
        getAvailabilityData,
        calculatePrice,
        findNormalCombination,
        crearReservaPublica,
        obtenerResumenResenas,
        obtenerResumenPorPropiedad,
        obtenerResenas,
        getGaleria,
        generarContenidoCorporativo,
        hydrateInventory,
        fetchTarifasYCanal,
        getPrecioBaseNoche,
        formatDateForInput,
        getNextWeekend,
        obtenerOcupacionCalendarioPropiedad,
        computeNightlyPricesForRange,
    };

    registerHomeRoutes({ router, db, cacheStaticRoutes, deps: sharedDeps });
    registerPropertyRoutes({ router, db, deps: sharedDeps });
    registerBookingRoutes({ router, db, deps: sharedDeps });
    registerSeoRoutes({ router, db, deps: sharedDeps });

    // Manejador 404
    router.use(async (req, res) => {
        const empresaData = res.locals.empresa || req.empresa || { nombre: "Página no encontrada" };
        res.status(404).render('404', {
            title: 'Página no encontrada',
            empresa: empresaData
        });
    });

    return router;
};