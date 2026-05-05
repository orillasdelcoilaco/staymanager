/**
 * UI del marketplace global (suitemanagers.com): copys ES/EN.
 * Idioma: ?lang=en | ?lang=es; si no, Accept-Language (en*) → en; defecto es.
 */

function resolveMarketplaceLang(req) {
    const raw = String((req.query && req.query.lang) || '').toLowerCase().trim();
    if (raw === 'en' || raw === 'es') return raw;
    const al = String(req.get('accept-language') || '').toLowerCase();
    if (al.startsWith('en')) return 'en';
    return 'es';
}

function getMarketplaceStrings(lang) {
    const L = lang === 'en' ? 'en' : 'es';
    if (L === 'en') {
        return {
            htmlLang: 'en',
            ogLocale: 'en_US',
            pageTitle: 'SuiteManagers — Stays in Chile',
            metaDescription: 'Find cabins, homes and apartments in Chile’s best destinations. Book direct with the host.',
            ogTitle: 'SuiteManagers — Stays in Chile',
            ogDescription: 'Find unique cabins, homes and apartments. Book direct with the host.',
            twitterDescription: 'Book direct with the host. No middlemen.',
            jsonLdSiteDescription: 'Marketplace of stays in Chile. Direct booking with hosts.',
            jsonLdItemListName: 'Stays in Chile',
            jsonLdItemListDescription: 'Cabins, homes and apartments on SuiteManagers',
            labelDestino: 'Destination',
            placeholderDestino: 'Search destinations',
            labelLlegada: 'Check-in',
            labelSalida: 'Check-out',
            labelHuespedes: 'Guests',
            placeholderHuespedes: 'How many?',
            ariaBuscar: 'Search',
            sectionFavoritos: 'Guest favorites',
            badgeFavorito: 'Favorite',
            reviews: 'reviews',
            pricePerNight: '/ night',
            people: 'guests',
            person: 'guest',
            sectionResultadosConQuery: 'Results for',
            sectionAlojamientosPara: 'Stays for',
            lodgings: 'stays',
            clearFilters: 'Clear filters',
            sectionTodos: 'All stays',
            noResults: 'No stays match those filters.',
            verTodos: 'View all stays',
            footerTagline: 'Direct rental platform in Chile',
            footerTerms: 'Terms',
            footerPrivacy: 'Privacy',
            langSwitchEs: 'ES',
            langSwitchEn: 'EN',
            langSwitchTitle: 'Language',
            ghCatalogPageTitle: 'Google Hotels — Listed properties | SuiteManagers',
            ghCatalogMetaDescription: 'Properties opted in for Google Hotels connectivity. Book directly with each host on their site.',
            ghCatalogHeading: 'Google Hotels listings',
            ghCatalogLead: 'These listings are included in the platform connectivity feed. Open the host site to choose dates and see final prices.',
            ghCatalogCta: 'Open host site',
            ghCatalogEmpty: 'No properties are listed for Google Hotels yet.',
            ghCatalogUnavailable: 'This catalog needs PostgreSQL (DATABASE_URL) on the server.',
            ghCatalogBackHome: 'Back to marketplace',
            ghCatalogErrorLoad: 'Could not load this page.',
            ghFooterCatalog: 'Google Hotels catalog',
            heroTitle: 'Find your next stay in Chile',
            heroSubtitle: 'Unique cabins, homes, and apartments — book direct with trusted hosts.',
            navGoogleHotels: 'Google Hotels',
            labelSort: 'Sort by',
            sortRecommended: 'Recommended',
            sortRating: 'Top rated',
            sortPriceLow: 'Price: low to high',
            sortPriceHigh: 'Price: high to low',
            jsonLdBreadcrumbHome: 'Home',
            jsonLdBreadcrumbGoogleHotels: 'Google Hotels listings',
            ariaExternalHost: 'Opens the host booking site',
        };
    }
    return {
        htmlLang: 'es',
        ogLocale: 'es_CL',
        pageTitle: 'SuiteManagers — Alojamientos en Chile',
        metaDescription: 'Encuentra cabañas, casas y departamentos únicos en los mejores destinos de Chile. Reserva directo con el anfitrión.',
        ogTitle: 'SuiteManagers — Alojamientos en Chile',
        ogDescription: 'Encuentra cabañas, casas y departamentos únicos en los mejores destinos de Chile. Reserva directo con el anfitrión.',
        twitterDescription: 'Reserva directo con el anfitrión. Sin intermediarios.',
        jsonLdSiteDescription: 'Marketplace de alojamientos en Chile. Reserva directa con anfitriones.',
        jsonLdItemListName: 'Alojamientos en Chile',
        jsonLdItemListDescription: 'Cabañas, casas y departamentos disponibles en SuiteManagers',
        labelDestino: 'Destino',
        placeholderDestino: 'Buscar destinos',
        labelLlegada: 'Llegada',
        labelSalida: 'Salida',
        labelHuespedes: 'Huéspedes',
        placeholderHuespedes: '¿Cuántos?',
        ariaBuscar: 'Buscar',
        sectionFavoritos: 'Favoritos entre huéspedes',
        badgeFavorito: 'Favorito',
        reviews: 'reseñas',
        pricePerNight: '/ noche',
        people: 'personas',
        person: 'persona',
        sectionResultadosConQuery: 'Resultados para',
        sectionAlojamientosPara: 'Alojamientos para',
        lodgings: 'alojamientos',
        clearFilters: 'Limpiar filtros',
        sectionTodos: 'Todos los alojamientos',
        noResults: 'No encontramos alojamientos con esos filtros.',
        verTodos: 'Ver todos los alojamientos',
        footerTagline: 'Plataforma de arrendamiento directo en Chile',
        footerTerms: 'Términos',
        footerPrivacy: 'Privacidad',
        langSwitchEs: 'ES',
        langSwitchEn: 'EN',
        langSwitchTitle: 'Idioma',
        ghCatalogPageTitle: 'Google Hotels — Propiedades listadas | SuiteManagers',
        ghCatalogMetaDescription: 'Propiedades con opt-in para conectividad Google Hotels. Reserva directo en el sitio de cada anfitrión.',
        ghCatalogHeading: 'Listados Google Hotels',
        ghCatalogLead: 'Estos alojamientos entran en el feed de conectividad de la plataforma. En el sitio del anfitrión eliges fechas y ves el precio final.',
        ghCatalogCta: 'Ir al sitio del anfitrión',
        ghCatalogEmpty: 'Aún no hay propiedades listadas para Google Hotels.',
        ghCatalogUnavailable: 'Este catálogo requiere PostgreSQL (DATABASE_URL) en el servidor.',
        ghCatalogBackHome: 'Volver al marketplace',
        ghCatalogErrorLoad: 'No se pudo cargar esta página.',
        ghFooterCatalog: 'Catálogo Google Hotels',
        heroTitle: 'Encuentra tu próxima estadía en Chile',
        heroSubtitle: 'Cabañas, casas y departamentos únicos — reserva directo con anfitriones verificados.',
        navGoogleHotels: 'Google Hotels',
        labelSort: 'Ordenar por',
        sortRecommended: 'Recomendados',
        sortRating: 'Mejor valoración',
        sortPriceLow: 'Precio: menor a mayor',
        sortPriceHigh: 'Precio: mayor a menor',
        jsonLdBreadcrumbHome: 'Inicio',
        jsonLdBreadcrumbGoogleHotels: 'Listados Google Hotels',
        ariaExternalHost: 'Abre el sitio de reservas del anfitrión',
    };
}

/**
 * LodgingBusiness.priceRange en schema.org es texto tipo "$"–"$$$" (intensidad, no moneda exacta).
 */
function precioDesdeToSchemaPriceRange(precioDesde) {
    const n = Number(precioDesde);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    if (n < 80000) return '$';
    if (n < 200000) return '$$';
    return '$$$';
}

/** Query de listado sin parámetro lang (canónico ES / x-default). */
function buildMarketplaceQueryBase({ busqueda, personas, fechaIn, fechaOut, sort }) {
    const p = new URLSearchParams();
    if (busqueda) p.set('q', busqueda);
    if (personas > 0) p.set('personas', String(personas));
    if (fechaIn) p.set('fecha_in', fechaIn);
    if (fechaOut) p.set('fecha_out', fechaOut);
    if (sort) p.set('sort', String(sort));
    return p;
}

function buildMarketplaceSeoUrls(req, { busqueda, personas, fechaIn, fechaOut, sort, htmlLang }) {
    const protocol = req.protocol || 'https';
    const host = req.get('host') || '';
    const envEsHost = String(process.env.MARKETPLACE_DOMAIN_ES || '').trim();
    const envEnHost = String(process.env.MARKETPLACE_DOMAIN_EN || '').trim();

    const normalizeHost = (raw, fallbackHost) => {
        const v = String(raw || '').trim();
        if (!v) return fallbackHost;
        const withoutProtocol = v.replace(/^https?:\/\//i, '');
        const onlyHost = withoutProtocol.split('/')[0].trim().toLowerCase();
        return onlyHost || fallbackHost;
    };

    const hostEs = normalizeHost(envEsHost, host);
    const hostEn = normalizeHost(envEnHost, host);
    const baseCanonical = `${protocol}://${htmlLang === 'en' ? hostEn : hostEs}`;
    const qBase = buildMarketplaceQueryBase({ busqueda, personas, fechaIn, fechaOut, sort });
    const qEn = new URLSearchParams(qBase);
    qEn.set('lang', 'en');
    const pathEs = qBase.toString() ? `/?${qBase.toString()}` : '/';
    const pathEn = qEn.toString() ? `/?${qEn.toString()}` : '/?lang=en';
    const canonicalPath = htmlLang === 'en' ? pathEn : pathEs;
    return {
        canonicalUrl: `${baseCanonical}${canonicalPath}`,
        hreflangEsUrl: `${protocol}://${hostEs}${pathEs}`,
        hreflangEnUrl: `${protocol}://${hostEn}${pathEn}`,
    };
}

/** Etiquetas humanas para claves de `propiedades[]` en GET /api/search.json (IA / clientes). */
function getMarketplaceSearchJsonUi(lang) {
    const L = lang === 'en' ? 'en' : 'es';
    if (L === 'en') {
        return {
            locale: 'en-US',
            language: 'en',
            fieldLabels: {
                id: 'Listing ID',
                titulo: 'Title',
                empresa: 'Operator / brand name',
                capacidad: 'Maximum guests',
                precioDesde: 'Starting price',
                moneda: 'Currency code',
                rating: 'Average guest rating',
                numResenas: 'Review count',
                fotoUrl: 'Cover image URL',
                url: 'Public listing URL',
            },
            errorInternal: 'Internal error',
        };
    }
    return {
        locale: 'es-CL',
        language: 'es',
        fieldLabels: {
            id: 'ID del alojamiento',
            titulo: 'Título',
            empresa: 'Nombre del operador / marca',
            capacidad: 'Capacidad máxima de huéspedes',
            precioDesde: 'Precio desde',
            moneda: 'Código de moneda',
            rating: 'Calificación promedio',
            numResenas: 'Cantidad de reseñas',
            fotoUrl: 'URL de imagen de portada',
            url: 'URL pública del alojamiento',
        },
        errorInternal: 'Error interno',
    };
}

module.exports = {
    resolveMarketplaceLang,
    getMarketplaceStrings,
    getMarketplaceSearchJsonUi,
    buildMarketplaceQueryBase,
    buildMarketplaceSeoUrls,
    precioDesdeToSchemaPriceRange,
};
