const { parseISO, isValid } = require('date-fns');

/**
 * Carga listados, búsqueda por fechas y rango de precios para el home SSR.
 */
async function loadHomeSearchBundle({
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
}) {
    const { fechaLlegada, fechaSalida, personas } = req.query;
    let resultadosParaMostrar = [];
    let isSearchResult = false;
    const grupoMostradoIds = new Set();

    const [todasLasPropiedades, { allTarifas, canalPorDefectoId }] = await Promise.all([
        obtenerPropiedadesPorEmpresa(db, empresaId),
        fetchTarifasYCanal(empresaId)
    ]);

    const propiedadesListadas = todasLasPropiedades.filter((p) => p.googleHotelData?.isListed === true && p.websiteData?.cardImage?.storagePath);
    const llegadaDate = fechaLlegada ? parseISO(fechaLlegada + 'T00:00:00Z') : null;
    const salidaDate = fechaSalida ? parseISO(fechaSalida + 'T00:00:00Z') : null;
    const numPersonas = personas ? parseInt(personas, 10) : 0;

    if (llegadaDate && salidaDate && isValid(llegadaDate) && isValid(salidaDate) && salidaDate > llegadaDate && numPersonas > 0) {
        isSearchResult = true;
        const { availableProperties } = await getAvailabilityData(db, empresaId, llegadaDate, salidaDate);
        const availableIds = new Set(availableProperties.map((p) => p.id));
        const propiedadesDisponiblesListadas = propiedadesListadas.filter((p) => availableIds.has(p.id));

        if (propiedadesDisponiblesListadas.length > 0 && canalPorDefectoId) {
            try {
                const { combination, capacity } = findNormalCombination(propiedadesDisponiblesListadas, numPersonas);
                if (combination && combination.length > 1) {
                    const combinedPricing = await calculatePrice(db, empresaId, combination, llegadaDate, salidaDate, allTarifas);
                    resultadosParaMostrar.push({ isGroup: true, properties: combination, combinedCapacity: capacity, combinedPricing });
                    combination.forEach((p) => grupoMostradoIds.add(p.id));
                }
            } catch (groupError) {
                console.error('Error al buscar/preciar grupo:', groupError);
            }

            const propiedadesFiltradasPorCapacidad = propiedadesDisponiblesListadas.filter((p) => p.capacidad >= numPersonas);
            const priced = await Promise.all(propiedadesFiltradasPorCapacidad.map(async (prop) => {
                if (grupoMostradoIds.has(prop.id)) return null;
                const precioBaseNoche = getPrecioBaseNoche(prop.id, allTarifas, canalPorDefectoId);
                try {
                    const pricing = await calculatePrice(db, empresaId, [prop], llegadaDate, salidaDate, allTarifas);
                    return { ...prop, pricing, precioBaseNoche };
                } catch {
                    return { ...prop, pricing: null, precioBaseNoche };
                }
            }));
            resultadosParaMostrar.push(...priced.filter(Boolean));
        }
    } else {
        resultadosParaMostrar = propiedadesListadas.map((prop) => ({
            ...prop,
            pricing: null,
            precioBaseNoche: getPrecioBaseNoche(prop.id, allTarifas, canalPorDefectoId)
        }));
    }

    const offers = resultadosParaMostrar.filter((item) => !item.isGroup);
    let priceRange = '';
    if (canalPorDefectoId && allTarifas.length > 0) {
        const basePrices = allTarifas.map((t) => t.precios?.[canalPorDefectoId]).filter((p) => typeof p === 'number' && p > 0);
        if (basePrices.length > 0) {
            const minPrice = Math.min(...basePrices);
            const maxPrice = Math.max(...basePrices);
            priceRange = minPrice === maxPrice ? `${minPrice.toFixed(0)} CLP` : `${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)} CLP`;
        }
    }

    const amenidadesSet = new Set();
    propiedadesListadas.forEach((p) => {
        const amenArr = Array.isArray(p.amenidades) ? p.amenidades : (p.amenidades && typeof p.amenidades === 'object' ? Object.values(p.amenidades) : []);
        amenArr.forEach((a) => {
            const nombre = typeof a === 'string' ? a : (a?.nombre || a?.name || '');
            if (nombre) amenidadesSet.add(nombre);
        });
    });

    return {
        resultadosParaMostrar,
        isSearchResult,
        propiedadesListadas,
        allTarifas,
        canalPorDefectoId,
        priceRange,
        amenidadesSet,
        offers
    };
}

/**
 * Reseñas resumen, JSON-LD schema y contenido corporativo IA.
 */
async function loadHomeSeoAndContent({
    req,
    empresaId,
    empresaCompleta,
    obtenerResumenResenas,
    generarContenidoCorporativo,
    priceRange,
    offers,
    amenidadesSet
}) {
    let resenasResumen = null;
    try { resenasResumen = await obtenerResumenResenas(empresaId); } catch (_) {}

    let schemaData;
    try {
        const ctx = req.empresaContext;
        const amenityFeatures = [...amenidadesSet].slice(0, 20).map((nombre) => ({ '@type': 'LocationFeatureSpecification', name: nombre, value: true }));
        const address = {
            '@type': 'PostalAddress',
            addressCountry: 'CL',
            ...(ctx?.ubicacion?.direccion && { streetAddress: ctx.ubicacion.direccion }),
            ...(ctx?.ubicacion?.ciudad && { addressLocality: ctx.ubicacion.ciudad }),
            ...(ctx?.ubicacion?.region && { addressRegion: ctx.ubicacion.region })
        };
        if (!address.addressLocality && empresaCompleta.ubicacionTexto) address.addressLocality = empresaCompleta.ubicacionTexto;
        const telefono = ctx?.contacto?.telefonoPrincipal || empresaCompleta.contactoTelefono || '';
        const email = ctx?.contacto?.emailContacto || '';

        schemaData = {
            '@context': 'https://schema.org',
            '@type': 'LodgingBusiness',
            name: empresaCompleta.nombre || 'Alojamiento Turístico',
            description: empresaCompleta.websiteSettings?.seo?.homeDescription || empresaCompleta.slogan || `Reserva directa en ${empresaCompleta.nombre}`,
            url: req.baseUrl || '#',
            ...(priceRange && { priceRange }),
            ...(telefono && { telephone: telefono }),
            ...(amenityFeatures.length > 0 && { amenityFeature: amenityFeatures }),
            ...(offers.length > 0 && {
                makesOffer: offers.map((prop) => ({
                    '@type': 'Offer',
                    itemOffered: { '@type': 'HotelRoom', name: prop.nombre, url: `${req.baseUrl}/propiedad/${prop.id}` },
                    ...(prop.pricing?.totalPriceCLP > 0 && { priceSpecification: { '@type': 'PriceSpecification', price: String(prop.pricing.totalPriceCLP.toFixed(2)), priceCurrency: 'CLP' } })
                }))
            }),
            ...((address.addressLocality || address.addressRegion) && { address }),
            ...(email && { contactPoint: { '@type': 'ContactPoint', contactType: 'reservations', email, ...(telefono && { telephone: telefono }), availableLanguage: 'Spanish' } })
        };
    } catch {
        schemaData = { '@context': 'https://schema.org', '@type': 'LodgingBusiness', name: empresaCompleta.nombre || 'Alojamiento', url: req.baseUrl || '#' };
    }

    let corporateContent = null;
    if (req.empresaContext) {
        try {
            corporateContent = await generarContenidoCorporativo({
                ...req.empresaContext,
                amenidades: [...amenidadesSet],
                baseUrl: req.baseUrl || ''
            });
        } catch (_) {}
    }

    return { resenasResumen, schemaData, corporateContent };
}

module.exports = { loadHomeSearchBundle, loadHomeSeoAndContent };
