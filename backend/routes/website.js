// backend/routes/website.js
const express = require('express');
const { getAvailabilityData, calculatePrice, findNormalCombination } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');
const { obtenerEmpresaPorDominio, obtenerDetallesEmpresa } = require('../services/empresaService');
const admin = require('firebase-admin');
const { format, addDays, nextFriday, nextSunday, differenceInYears, differenceInMonths, parseISO, isValid } = require('date-fns');

// --- (Funciones auxiliares formatDateForInput y getNextWeekend sin cambios) ---
const formatDateForInput = (date) => {
    if (!date || !isValid(date)) return '';
    return format(date, 'yyyy-MM-dd');
};

const getNextWeekend = () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const friday = nextFriday(today);
    const sunday = nextSunday(friday);
    return {
        llegada: friday,
        salida: sunday
    };
};


module.exports = (db) => {
    const router = express.Router();

    // --- (Middleware de carga de empresa - sin cambios, ya define req.baseUrl) ---
    router.use(async (req, res, next) => {
        if (!req.empresa || !req.empresa.id || typeof req.empresa.id !== 'string' || req.empresa.id.trim() === '') {
            console.error("[website.js middleware] Error: req.empresa.id inválido o no definido después del tenantResolver.");
            return next('router');
        }
        console.log(`[DEBUG website.js middleware] Empresa ID ${req.empresa.id} identificada.`);
        try {
            req.empresaCompleta = await obtenerDetallesEmpresa(db, req.empresa.id);
            if (req.empresaCompleta) {
                req.empresaCompleta.id = req.empresa.id;
                const protocol = req.protocol;
                const host = req.get('host');
                req.baseUrl = `${protocol}://${host}`;
                console.log(`[DEBUG middleware] Base URL determinada: ${req.baseUrl}`);
            } else {
                 req.empresaCompleta = { id: req.empresa.id, nombre: req.empresa.nombre || "Empresa (Detalles no cargados)" };
                 req.baseUrl = '';
            }
            res.locals.empresa = req.empresaCompleta;
            next();
        } catch (error) {
            console.error(`Error cargando detalles completos para ${req.empresa.id}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno',
                empresa: req.empresa || { nombre: "Error" }
            });
        }
    });

    // Ruta principal (Home)
    router.get('/', async (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const empresaId = req.empresa.id;
        let empresaCompleta = req.empresaCompleta;

        try {
            const { fechaLlegada, fechaSalida, personas } = req.query;
            let resultadosParaMostrar = [];
            let isSearchResult = false;
            let grupoMostradoIds = new Set();

            // --- (Obtención de propiedades, tarifas, canal - sin cambios) ---
            const [todasLasPropiedades, tarifasSnapshot, canalesSnapshot] = await Promise.all([
                obtenerPropiedadesPorEmpresa(db, empresaId),
                db.collection('empresas').doc(empresaId).collection('tarifas').get(),
                db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get()
            ]);
            const propiedadesListadas = todasLasPropiedades.filter(p => p.googleHotelData?.isListed === true && p.websiteData?.cardImage?.storagePath);
            const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 let inicio=null, termino=null; try { inicio=data.fechaInicio?.toDate ? data.fechaInicio.toDate() : (data.fechaInicio ? parseISO(data.fechaInicio + 'T00:00:00Z'):null); termino=data.fechaTermino?.toDate ? data.fechaTermino.toDate():(data.fechaTermino ? parseISO(data.fechaTermino+'T00:00:00Z'):null); if(!isValid(inicio)||!isValid(termino)) throw new Error(''); } catch(e){return null;} return {...data, id:doc.id, fechaInicio:inicio, fechaTermino:termino}; }).filter(Boolean);
            const canalPorDefectoId = !canalesSnapshot.empty ? canalesSnapshot.docs[0].id : null;

            // --- (Lógica de búsqueda y cálculo de precios - sin cambios) ---
            const llegadaDate = fechaLlegada ? parseISO(fechaLlegada + 'T00:00:00Z') : null;
            const salidaDate = fechaSalida ? parseISO(fechaSalida + 'T00:00:00Z') : null;
            const numPersonas = personas ? parseInt(personas) : 0;
            if (llegadaDate && salidaDate && isValid(llegadaDate) && isValid(salidaDate) && salidaDate > llegadaDate && numPersonas > 0) {
                isSearchResult = true;
                const startDate = llegadaDate;
                const endDate = salidaDate;
                const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
                const availableIds = new Set(availableProperties.map(p => p.id));
                const propiedadesDisponiblesListadas = propiedadesListadas.filter(p => availableIds.has(p.id));
                if (propiedadesDisponiblesListadas.length > 0 && canalPorDefectoId) {
                    try {
                        const { combination, capacity } = findNormalCombination(propiedadesDisponiblesListadas, numPersonas);
                        if (combination && combination.length > 1) {
                            const pricingResult = await calculatePrice(db, empresaId, combination, startDate, endDate, allTarifas, canalPorDefectoId);
                            resultadosParaMostrar.push({ isGroup: true, properties: combination, combinedCapacity: capacity, combinedPricing: pricingResult });
                            combination.forEach(p => grupoMostradoIds.add(p.id));
                        }
                    } catch (groupError) { console.error("Error al buscar/preciar grupo:", groupError); }
                    const propiedadesFiltradasPorCapacidad = propiedadesDisponiblesListadas.filter(p => p.capacidad >= numPersonas);
                    if (propiedadesFiltradasPorCapacidad.length > 0) {
                        const pricePromises = propiedadesFiltradasPorCapacidad.map(async (prop) => {
                            if (grupoMostradoIds.has(prop.id)) return null;
                            try {
                                const pricingResult = await calculatePrice(db, empresaId, [prop], startDate, endDate, allTarifas, canalPorDefectoId);
                                return { ...prop, pricing: pricingResult };
                            } catch (priceError) { return { ...prop, pricing: null }; }
                        });
                        resultadosParaMostrar.push(...(await Promise.all(pricePromises)).filter(Boolean));
                    }
                } else if (!canalPorDefectoId) { console.warn(`Empresa ${empresaId} sin canal por defecto.`); }
            } else {
                 resultadosParaMostrar = propiedadesListadas.map(prop => ({ ...prop, pricing: null }));
                 isSearchResult = false;
            }

            // --- INICIO: Preparar datos para JSON-LD (Home) ---

            const offers = resultadosParaMostrar.filter(item => !item.isGroup);
            
            // --- INICIO CÁLCULO priceRange (CORREGIDO) ---
            // Usar los precios base de 'allTarifas' en lugar de los precios de búsqueda
            let priceRange = "";
            if (canalPorDefectoId && allTarifas.length > 0) {
                // Obtener todos los precios base definidos para el canal por defecto
                const basePrices = allTarifas
                    .map(tarifa => tarifa.precios?.[canalPorDefectoId])
                    .filter(precio => typeof precio === 'number' && precio > 0); // Filtrar nulos, 0, o undefined

                if (basePrices.length > 0) {
                    const minPrice = Math.min(...basePrices);
                    const maxPrice = Math.max(...basePrices);
                    
                    if (minPrice === maxPrice) {
                        // Si todos los precios base son iguales
                        priceRange = `${minPrice.toFixed(0)} CLP`;
                    } else {
                        // Crear el rango
                        priceRange = `${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)} CLP`;
                    }
                }
            }
            // --- FIN CÁLCULO priceRange ---

            const schemaData = {
                "@context": "https://schema.org",
                "@type": "LodgingBusiness",
                "name": empresaCompleta.nombre || "Alojamiento Turístico",
                "description": empresaCompleta.websiteSettings?.seo?.homeDescription || empresaCompleta.slogan || `Reserva directa en ${empresaCompleta.nombre}`,
                "url": req.baseUrl || '#',
                "logo": empresaCompleta.websiteSettings?.theme?.logoUrl || '',
                "image": empresaCompleta.websiteSettings?.theme?.heroImageUrl || '',
                "telephone": empresaCompleta.contactoTelefono || '',
                
                // (CORREGIDO) Añadir el priceRange si se calculó
                ...(priceRange && { "priceRange": priceRange }),
                
                ...(empresaCompleta.ubicacionTexto && {
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": empresaCompleta.ubicacionTexto,
                        "addressCountry": "CL"
                    }
                }),
                
                ...(offers.length > 0 && {
                    "makesOffer": offers.map(prop => ({
                         "@type": "Offer",
                         "itemOffered": {
                             "@type": "HotelRoom",
                             "name": prop.nombre,
                             "url": `${req.baseUrl}/propiedad/${prop.id}`
                         },
                         // Esto está bien, los precios de búsqueda solo aparecen si se buscó
                         ...(prop.pricing && prop.pricing.totalPriceCLP > 0 && {
                              "priceSpecification": {
                                   "@type": "PriceSpecification",
                                   "price": prop.pricing.totalPriceCLP.toFixed(2),
                                   "priceCurrency": "CLP"
                              }
                         })
                    }))
                })
            };
            // --- FIN: Preparar datos para JSON-LD (Home) ---

            res.render('home', {
                title: empresaCompleta?.websiteSettings?.seo?.homeTitle || empresaCompleta.nombre,
                description: empresaCompleta?.websiteSettings?.seo?.homeDescription || `Reservas en ${empresaCompleta.nombre}`,
                resultados: resultadosParaMostrar,
                isSearchResult: isSearchResult,
                query: req.query,
                schemaData: schemaData
            });

        } catch (error) {
            console.error(`Error al renderizar el home para ${empresaId}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno del Servidor',
                empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" }
            });
        }
    });

    // Ruta de detalle de propiedad
    router.get('/propiedad/:id', async (req, res) => {
        const empresaCompleta = req.empresaCompleta;
        const empresaId = empresaCompleta.id;
        const propiedadId = req.params.id;

        try {
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad || !propiedad.googleHotelData?.isListed) {
                return res.status(404).render('404', { title: 'Propiedad No Encontrada', empresa: empresaCompleta });
            }

            // --- (Lógica de precio default y prefill sin cambios) ---
            const weekendDates = getNextWeekend();
            const defaultCheckin = weekendDates.llegada;
            const defaultCheckout = weekendDates.salida;
            let defaultPriceData = { totalPriceCLP: 0, nights: 0, formattedTotalPrice: 'Consulta fechas' };
            const [tarifasSnapshot, canalesSnapshot] = await Promise.all([
                 db.collection('empresas').doc(empresaId).collection('tarifas').get(),
                 db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get()
            ]);
            const allTarifas = tarifasSnapshot.docs.map(doc => { const data=doc.data(); let i=null,t=null; try{i=data.fechaInicio?.toDate?data.fechaInicio.toDate():(data.fechaInicio?parseISO(data.fechaInicio+'T00:00:00Z'):null);t=data.fechaTermino?.toDate?data.fechaTermino.toDate():(data.fechaTermino?parseISO(data.fechaTermino+'T00:00:00Z'):null);if(!isValid(i)||!isValid(t))throw new Error('');}catch(e){return null;} return {...data,id:doc.id,fechaInicio:i,fechaTermino:t}; }).filter(Boolean);
            if(!canalesSnapshot.empty){ const canalPorDefectoId=canalesSnapshot.docs[0].id; try { const p=await calculatePrice(db,empresaId,[propiedad],defaultCheckin,defaultCheckout,allTarifas,canalPorDefectoId); if(p&&p.totalPriceCLP>0){defaultPriceData={totalPriceCLP:p.totalPriceCLP,nights:p.nights,formattedTotalPrice:`$${(p.totalPriceCLP||0).toLocaleString('es-CL')} CLP`};} else {defaultPriceData.formattedTotalPrice='No disponible';}}catch(e){defaultPriceData.formattedTotalPrice='Error';}}
            let checkinDate=defaultCheckin; let checkoutDate=defaultCheckout; const qL=req.query.fechaLlegada?parseISO(req.query.fechaLlegada+'T00:00:00Z'):null; const qS=req.query.fechaSalida?parseISO(req.query.fechaSalida+'T00:00:00Z'):null; const qC=req.query.checkin?parseISO(req.query.checkin+'T00:00:00Z'):null; if(qL&&qS&&isValid(qL)&&isValid(qS)&&qS>qL){checkinDate=qL;checkoutDate=qS;}else if(qC&&isValid(qC)&&req.query.nights){checkinDate=qC;const n=parseInt(req.query.nights);if(!isNaN(n)&&n>0)checkoutDate=addDays(checkinDate,n);} if(!isValid(checkinDate))checkinDate=defaultCheckin; if(!isValid(checkoutDate)||checkoutDate<=checkinDate)checkoutDate=addDays(checkinDate,1);
            let personas=parseInt(req.query.personas||req.query.adults); if(!personas||isNaN(personas)||personas<=0)personas=Math.min(2,propiedad.capacidad||1); else personas=Math.min(personas,propiedad.capacidad);
            let hostingDuration='Anfitrión'; if(empresaCompleta.fechaCreacion&&empresaCompleta.fechaCreacion.toDate){ const c=empresaCompleta.fechaCreacion.toDate();const n=new Date();const y=differenceInYears(n,c);const m=differenceInMonths(n,c)%12;let d=[];if(y>0)d.push(`${y} año${y!==1?'s':''}`);if(m>0)d.push(`${m} mes${m!==1?'es':''}`);if(d.length>0)hostingDuration=`${d.join(' y ')} como anfitrión`;else hostingDuration='Recién comenzando';}

            // --- INICIO: Preparar datos para JSON-LD (Propiedad) ---
            
            // (NUEVO) Calcular priceRange para la propiedad individual
            let propertyPriceRange = "";
            if (canalPorDefectoId && allTarifas.length > 0) {
                 const basePrices = allTarifas
                    .filter(t => t.alojamientoId === propiedad.id) // Solo tarifas de esta propiedad
                    .map(tarifa => tarifa.precios?.[canalPorDefectoId])
                    .filter(precio => typeof precio === 'number' && precio > 0);
                if (basePrices.length > 0) {
                     const minPrice = Math.min(...basePrices);
                     const maxPrice = Math.max(...basePrices);
                     if (minPrice === maxPrice) {
                         propertyPriceRange = `${minPrice.toFixed(0)} CLP`;
                     } else {
                         propertyPriceRange = `${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)} CLP`;
                     }
                }
            }
            
            const propertySchemaData = {
                "@context": "https://schema.org",
                "@type": "LodgingBusiness",
                "name": empresaCompleta.nombre || "Alojamiento",
                "url": req.baseUrl || '#',
                "image": empresaCompleta.websiteSettings?.theme?.heroImageUrl || (propiedad.websiteData?.cardImage?.storagePath || ''),
                "telephone": empresaCompleta.contactoTelefono || '',
                
                // (CORREGIDO) Usar el priceRange de la propiedad si se calculó
                ...(propertyPriceRange && { "priceRange": propertyPriceRange }),
                
                ...(empresaCompleta.ubicacionTexto && {
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": empresaCompleta.ubicacionTexto,
                        "addressCountry": "CL"
                    }
                }),

                "makesOffer": {
                    "@type": "Offer",
                    "itemOffered": {
                         "@type": "HotelRoom",
                         "name": propiedad.nombre,
                         "description": propiedad.websiteData?.aiDescription || propiedad.descripcion || '',
                         "image": propiedad.websiteData?.cardImage?.storagePath || '',
                         "occupancy": {
                             "@type": "QuantitativeValue",
                             "maxValue": propiedad.capacidad || 1
                         },
                         "url": `${req.baseUrl}/propiedad/${propiedad.id}`
                    },
                     // Usar el precio del finde (si se buscó) como precio específico
                     ...(defaultPriceData.totalPriceCLP > 0 && {
                         "priceSpecification": {
                              "@type": "PriceSpecification",
                              "price": defaultPriceData.totalPriceCLP.toFixed(2),
                              "priceCurrency": "CLP"
                         }
                    })
                }
            };
            // --- FIN: Preparar datos para JSON-LD (Propiedad) ---

            res.render('propiedad', {
                title: `${propiedad.nombre} | ${empresaCompleta.nombre}`,
                description: (propiedad.websiteData?.aiDescription || propiedad.descripcion || `Descubre ${propiedad.nombre}`).substring(0, 155),
                propiedad: propiedad,
                prefill: {
                    fechaLlegada: formatDateForInput(checkinDate),
                    fechaSalida: formatDateForInput(checkoutDate),
                    personas: personas
                },
                defaultPriceData: defaultPriceData,
                hostingDuration: hostingDuration,
                schemaData: propertySchemaData
            });
        } catch (error) {
            console.error(`Error al renderizar la propiedad ${propiedadId} para ${empresaId}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno del Servidor',
                 empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" }
            });
        }
    });

    // --- (Ruta /propiedad/:id/calcular-precio sin cambios) ---
    router.post('/propiedad/:id/calcular-precio', express.json(), async (req, res) => {
         try {
             const empresaId = req.empresa.id;
             if (!empresaId) throw new Error("ID de empresa no encontrado en la solicitud.");
            const propiedadId = req.params.id;
            const { fechaLlegada, fechaSalida } = req.body;
            if (!fechaLlegada || !fechaSalida || new Date(fechaSalida) <= new Date(fechaLlegada)) { return res.status(400).json({ error: 'Fechas inválidas.' }); }
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });
            const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
            const endDate = parseISO(fechaSalida + 'T00:00:00Z');
             if(!isValid(startDate) || !isValid(endDate)) return res.status(400).json({ error: 'Fechas inválidas.' });
            const [tarifasSnapshot, canalesSnapshot] = await Promise.all([
                 db.collection('empresas').doc(empresaId).collection('tarifas').get(),
                 db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get()
            ]);
            const allTarifas = tarifasSnapshot.docs.map(doc => { const d=doc.data();let i=null,t=null;try{i=d.fechaInicio?.toDate?d.fechaInicio.toDate():(d.fechaInicio?parseISO(d.fechaInicio+'T00:00:00Z'):null);t=d.fechaTermino?.toDate?d.fechaTermino.toDate():(d.fechaTermino?parseISO(d.fechaTermino+'T00:00:00Z'):null);if(!isValid(i)||!isValid(t))throw new Error('');}catch(e){return null;} return {...d,id:doc.id,fechaInicio:i,fechaTermino:t}; }).filter(Boolean);
            if (canalesSnapshot.empty) throw new Error(`No hay canal por defecto configurado.`);
            const canalPorDefectoId = canalesSnapshot.docs[0].id;
            const pricing = await calculatePrice(db, empresaId, [propiedad], startDate, endDate, allTarifas, canalPorDefectoId);
            res.json({ totalPrice: pricing.totalPriceCLP, numNoches: pricing.nights, formattedTotalPrice: `$${(pricing.totalPriceCLP || 0).toLocaleString('es-CL')} CLP` });
        } catch (error) {
            console.error(`Error calculando precio AJAX para propiedad ${req.params.id}:`, error);
            res.status(500).json({ error: error.message || 'Error interno al calcular precio.' });
        }
    });

    // --- (Ruta /reservar sin cambios) ---
    router.get('/reservar', async (req, res) => {
        const empresaId = req.empresa.id;
        let empresaCompleta = req.empresaCompleta;
        try {
            const propiedadIdsQuery = req.query.propiedadId || '';
            const propiedadIds = propiedadIdsQuery.split(',').map(id => id.trim()).filter(Boolean);
            if (propiedadIds.length === 0 || !req.query.fechaLlegada || !req.query.fechaSalida || !req.query.noches || !req.query.precioFinal || !req.query.personas) {
                 return res.status(400).render('404', { title: 'Faltan Datos para Reservar', empresa: empresaCompleta });
            }
            const propiedadesPromises = propiedadIds.map(id => obtenerPropiedadPorId(db, empresaId, id));
            const propiedadesResult = await Promise.all(propiedadesPromises);
            const propiedades = propiedadesResult.filter(Boolean);
            if (propiedades.length !== propiedadIds.length) {
                 return res.status(404).render('404', { title: 'Una o más propiedades no encontradas', empresa: empresaCompleta });
            }
            const isGroupReservation = propiedades.length > 1;
            const dataToRender = isGroupReservation ? propiedades : propiedades[0];
            res.render('reservar', { title: `Completar Reserva | ${empresaCompleta.nombre}`, propiedad: dataToRender, isGroup: isGroupReservation, query: req.query });
        } catch (error) {
            res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" } });
        }
    });

    // --- (Ruta /crear-reserva-publica sin cambios) ---
    router.post('/crear-reserva-publica', express.json(), async (req, res) => {
         try {
            const empresaId = req.empresa.id;
            if (!empresaId) { throw new Error('No se pudo identificar la empresa para la reserva.'); }
            const reserva = await crearReservaPublica(db, empresaId, req.body);
            res.status(201).json({ reservaId: reserva.idReservaCanal });
        } catch (error) {
            res.status(500).json({ error: error.message || 'Error interno al procesar la reserva.' });
        }
    });

    // --- (Ruta /confirmacion sin cambios) ---
    router.get('/confirmacion', async (req, res) => {
        const empresaId = req.empresa.id;
        let empresaCompleta = req.empresaCompleta;
        try {
            const reservaIdOriginal = req.query.reservaId;
            if (!reservaIdOriginal) { return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta}); }
            const reservaSnap = await db.collection('empresas').doc(empresaId).collection('reservas').where('idReservaCanal', '==', reservaIdOriginal).get();
            if (reservaSnap.empty) { return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta}); }
            const reservaData = reservaSnap.docs[0].data();
            const reservaParaVista = { ...reservaData, id: reservaIdOriginal, fechaLlegada: reservaData.fechaLlegada.toDate().toISOString().split('T')[0], fechaSalida: reservaData.fechaSalida.toDate().toISOString().split('T')[0], precioFinal: reservaData.valores?.valorHuesped || 0 };
            const cliente = reservaData.clienteId ? await db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get() : null;
            res.render('confirmacion', { title: `Reserva Recibida | ${empresaCompleta.nombre}`, reserva: reservaParaVista, cliente: cliente && cliente.exists ? cliente.data() : { nombre: reservaData.nombreCliente || "Cliente" } });
        } catch (error) {
            res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" } });
        }
    });

    // --- (Ruta /contacto sin cambios) ---
    router.get('/contacto', async (req, res) => {
        const empresaCompleta = req.empresaCompleta;
        try { res.render('contacto', { title: `Contacto | ${empresaCompleta.nombre}` }); } catch (error) { res.status(500).render('404', { title: 'Error Interno del Servidor', empresa: empresaCompleta || { nombre: "Error Crítico" } }); }
    });

    // --- (Manejador 404 sin cambios) ---
    router.use(async (req, res) => {
        const empresaData = res.locals.empresa || req.empresa || { nombre: "Página no encontrada" };
        res.status(404).render('404', { title: 'Página no encontrada', empresa: empresaData });
    });

    return router;
};