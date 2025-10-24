// backend/routes/website.js
const express = require('express');
const { getAvailabilityData, calculatePrice, findNormalCombination } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');
const { obtenerEmpresaPorDominio, obtenerDetallesEmpresa } = require('../services/empresaService');
const admin = require('firebase-admin');
const { format, addDays, nextFriday, nextSunday, differenceInYears, differenceInMonths, parseISO, isValid } = require('date-fns'); // Añadir parseISO y isValid

// Función auxiliar para formatear fechas para input type="date"
const formatDateForInput = (date) => {
    if (!date || !isValid(date)) return ''; // Usar isValid de date-fns
    // Formatear directamente a yyyy-MM-dd
    return format(date, 'yyyy-MM-dd');
};

// Función para obtener el próximo fin de semana (Vie-Dom, 2 noches)
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

    // Middleware para cargar datos completos de la empresa (sin cambios)
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
            } else {
                 req.empresaCompleta = { id: req.empresa.id, nombre: req.empresa.nombre || "Empresa (Detalles no cargados)" };
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
        // **NUEVO: Añadir cabeceras para intentar evitar caché del navegador**
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
        res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
        res.setHeader('Expires', '0'); // Proxies.

        const empresaId = req.empresa.id;
        console.log(`[DEBUG / handler] Procesando home para empresaId: '${empresaId}'`);
        let empresaCompleta = req.empresaCompleta;

        try {
            const { fechaLlegada, fechaSalida, personas } = req.query;
            let resultadosParaMostrar = []; // <--- MODIFICADO: Inicializar array
            let isSearchResult = false;

            const [todasLasPropiedades, tarifasSnapshot, canalesSnapshot] = await Promise.all([
                obtenerPropiedadesPorEmpresa(db, empresaId),
                db.collection('empresas').doc(empresaId).collection('tarifas').get(),
                db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get()
            ]);

            const propiedadesListadas = todasLasPropiedades
                .filter(p => p.googleHotelData?.isListed === true && p.websiteData?.cardImage?.storagePath);

            const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 // Corrección robusta de fechas
                 let inicio = null;
                 let termino = null;
                 try {
                    inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : (data.fechaInicio ? parseISO(data.fechaInicio + 'T00:00:00Z') : null);
                    termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : (data.fechaTermino ? parseISO(data.fechaTermino + 'T00:00:00Z') : null);
                    if (!isValid(inicio) || !isValid(termino)) throw new Error('Fecha inválida');
                 } catch(e) {
                      console.warn(`[WARN] Tarifa ${doc.id} tiene fechas inválidas, será ignorada.`, data.fechaInicio, data.fechaTermino);
                      return null;
                 }
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
            }).filter(Boolean);

            const canalPorDefectoId = !canalesSnapshot.empty ? canalesSnapshot.docs[0].id : null;

            // **MODIFICADO: Ejecutar búsqueda solo si los parámetros son válidos**
            const llegadaDate = fechaLlegada ? parseISO(fechaLlegada + 'T00:00:00Z') : null;
            const salidaDate = fechaSalida ? parseISO(fechaSalida + 'T00:00:00Z') : null;
            const numPersonas = personas ? parseInt(personas) : 0;

            if (llegadaDate && salidaDate && isValid(llegadaDate) && isValid(salidaDate) && salidaDate > llegadaDate && numPersonas > 0) {
                isSearchResult = true; // Marcar que SÍ se hizo una búsqueda válida
                const startDate = llegadaDate;
                const endDate = salidaDate;

                // Obtener disponibilidad para el rango
                const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
                const availableIds = new Set(availableProperties.map(p => p.id));

                // Filtrar propiedades listadas que están disponibles
                const propiedadesDisponiblesListadas = propiedadesListadas.filter(p => availableIds.has(p.id));

                if (propiedadesDisponiblesListadas.length > 0 && canalPorDefectoId) {
                    
                    // --- INICIO LÓGICA DE GRUPO (REACTIVADA) ---
                    try {
                        const combinacionGrupo = await findNormalCombination(
                            db, 
                            empresaId, 
                            propiedadesDisponiblesListadas, // Usar solo las disponibles y listadas
                            numPersonas, 
                            startDate, 
                            endDate, 
                            allTarifas, 
                            canalPorDefectoId
                        );
                        
                        if (combinacionGrupo) {
                            resultadosParaMostrar.push(combinacionGrupo); // Añadir el grupo primero
                        }
                    } catch (groupError) {
                        console.error("Error al buscar combinación de grupo:", groupError);
                    }
                    // --- FIN LÓGICA DE GRUPO ---

                    // --- INICIO LÓGICA INDIVIDUAL (MANTENIDA) ---
                    const propiedadesFiltradasPorCapacidad = propiedadesDisponiblesListadas.filter(p => p.capacidad >= numPersonas);

                    if (propiedadesFiltradasPorCapacidad.length > 0) {
                        // Calcular precio para cada propiedad individualmente
                        const pricePromises = propiedadesFiltradasPorCapacidad.map(async (prop) => {
                            try {
                                const pricingResult = await calculatePrice(db, empresaId, [prop], startDate, endDate, allTarifas, canalPorDefectoId);
                                // No añadir si es parte del grupo ya mostrado (opcional, pero buena idea)
                                if (resultadosParaMostrar.length > 0 && resultadosParaMostrar[0].isGroup && resultadosParaMostrar[0].properties.some(pGroup => pGroup.id === prop.id)) {
                                    return null; // Ya está en el grupo
                                }
                                return { ...prop, pricing: pricingResult };
                            } catch (priceError) {
                                console.warn(`No se pudo calcular el precio para la propiedad ${prop.id}: ${priceError.message}`);
                                return { ...prop, pricing: null }; 
                            }
                        });
                        const resultadosIndividuales = (await Promise.all(pricePromises)).filter(Boolean); // filter(Boolean) elimina los null
                        resultadosParaMostrar.push(...resultadosIndividuales); // Añadir individuales después del grupo
                    }
                    // --- FIN LÓGICA INDIVIDUAL ---

                } else if (!canalPorDefectoId) {
                    console.warn(`[WARN] Empresa ${empresaId} no tiene canal por defecto. No se calcularán precios.`);
                }
                // Si no hay propiedades disponibles listadas, resultadosParaMostrar queda []

            } else {
                 // Si NO hay búsqueda válida (o parámetros incompletos), mostrar todas las listadas sin precio
                 resultadosParaMostrar = propiedadesListadas.map(prop => ({ ...prop, pricing: null }));
                 isSearchResult = false; // Asegurar que no se muestre como resultado de búsqueda
            }

            res.render('home', {
                title: empresaCompleta?.websiteSettings?.seo?.homeTitle || empresaCompleta.nombre,
                description: empresaCompleta?.websiteSettings?.seo?.homeDescription || `Reservas en ${empresaCompleta.nombre}`,
                resultados: resultadosParaMostrar,
                isSearchResult: isSearchResult, // Indicar si los resultados son de una búsqueda
                query: req.query // Pasar query para pre-rellenar formulario
            });

        } catch (error) {
            console.error(`Error al renderizar el home para ${empresaId}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno del Servidor',
                empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" }
            });
        }
    });

    // Ruta de detalle de propiedad (sin cambios)
    router.get('/propiedad/:id', async (req, res) => {
        const empresaCompleta = req.empresaCompleta;
        const empresaId = empresaCompleta.id;
        const propiedadId = req.params.id;

        try {
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);

            if (!propiedad || !propiedad.googleHotelData?.isListed) {
                return res.status(404).render('404', {
                    title: 'Propiedad No Encontrada',
                    empresa: empresaCompleta
                });
            }

            const weekendDates = getNextWeekend();
            const defaultCheckin = weekendDates.llegada;
            const defaultCheckout = weekendDates.salida;
            let defaultPriceData = { totalPriceCLP: 0, nights: 0, formattedTotalPrice: 'Consulta fechas' };

            const [tarifasSnapshot, canalesSnapshot] = await Promise.all([
                 db.collection('empresas').doc(empresaId).collection('tarifas').get(),
                 db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get()
            ]);
            const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 let inicio = null, termino = null;
                 try {
                     inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : (data.fechaInicio ? parseISO(data.fechaInicio + 'T00:00:00Z') : null);
                     termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : (data.fechaTermino ? parseISO(data.fechaTermino + 'T00:00:00Z') : null);
                     if (!isValid(inicio) || !isValid(termino)) throw new Error('Fecha inválida');
                 } catch(e){ return null; }
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
            }).filter(Boolean);

             if (!canalesSnapshot.empty) {
                const canalPorDefectoId = canalesSnapshot.docs[0].id;
                try {
                    const pricingResult = await calculatePrice(db, empresaId, [propiedad], defaultCheckin, defaultCheckout, allTarifas, canalPorDefectoId);
                    if (pricingResult && pricingResult.totalPriceCLP > 0) {
                         defaultPriceData = {
                            totalPriceCLP: pricingResult.totalPriceCLP,
                            nights: pricingResult.nights,
                            formattedTotalPrice: `$${(pricingResult.totalPriceCLP || 0).toLocaleString('es-CL')} CLP`
                         };
                    } else {
                         defaultPriceData.formattedTotalPrice = 'No disponible para finde';
                    }
                } catch (priceError) {
                    console.warn(`No se pudo calcular el precio del finde para ${propiedad.nombre}: ${priceError.message}`);
                    defaultPriceData.formattedTotalPrice = 'Error al calcular';
                }
             } else {
                 console.warn(`Empresa ${empresaId} no tiene canal por defecto para calcular precio inicial.`);
                 defaultPriceData.formattedTotalPrice = 'Config. pendiente';
             }

            let checkinDate = defaultCheckin;
            let checkoutDate = defaultCheckout;
             const queryLlegada = req.query.fechaLlegada ? parseISO(req.query.fechaLlegada + 'T00:00:00Z') : null;
             const querySalida = req.query.fechaSalida ? parseISO(req.query.fechaSalida + 'T00:00:00Z') : null;
             const queryCheckin = req.query.checkin ? parseISO(req.query.checkin + 'T00:00:00Z') : null;

            if (queryLlegada && querySalida && isValid(queryLlegada) && isValid(querySalida) && querySalida > queryLlegada) {
                 checkinDate = queryLlegada;
                 checkoutDate = querySalida;
            } else if (queryCheckin && isValid(queryCheckin) && req.query.nights) {
                 checkinDate = queryCheckin;
                 const nightsNum = parseInt(req.query.nights);
                 if (!isNaN(nightsNum) && nightsNum > 0) {
                    checkoutDate = addDays(checkinDate, nightsNum);
                 }
            }
             if (!isValid(checkinDate)) checkinDate = defaultCheckin;
             if (!isValid(checkoutDate) || checkoutDate <= checkinDate) checkoutDate = addDays(checkinDate, 1);


            let personas = parseInt(req.query.personas || req.query.adults);
            if (!personas || isNaN(personas) || personas <= 0) {
                personas = Math.min(2, propiedad.capacidad || 1);
            } else {
                personas = Math.min(personas, propiedad.capacidad);
            }

            let hostingDuration = 'Anfitrión';
            if (empresaCompleta.fechaCreacion && empresaCompleta.fechaCreacion.toDate) {
                const createdAt = empresaCompleta.fechaCreacion.toDate();
                const now = new Date();
                const yearsHosting = differenceInYears(now, createdAt);
                const monthsHosting = differenceInMonths(now, createdAt) % 12;
                let durationParts = [];
                if (yearsHosting > 0) durationParts.push(`${yearsHosting} año${yearsHosting !== 1 ? 's' : ''}`);
                if (monthsHosting > 0) durationParts.push(`${monthsHosting} mes${monthsHosting !== 1 ? 'es' : ''}`);
                if (durationParts.length > 0) {
                     hostingDuration = `${durationParts.join(' y ')} como anfitrión`;
                } else {
                    hostingDuration = 'Recién comenzando como anfitrión';
                }
            }

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
                hostingDuration: hostingDuration
            });
        } catch (error) {
            console.error(`Error al renderizar la propiedad ${propiedadId} para ${empresaId}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno del Servidor',
                 empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" }
            });
        }
    });

    // Ruta de API pública para calcular precio en página de propiedad (sin cambios)
    router.post('/propiedad/:id/calcular-precio', express.json(), async (req, res) => {
         try {
             const empresaId = req.empresa.id;
             if (!empresaId) throw new Error("ID de empresa no encontrado en la solicitud.");
            const propiedadId = req.params.id;
            const { fechaLlegada, fechaSalida } = req.body;

            if (!fechaLlegada || !fechaSalida || new Date(fechaSalida) <= new Date(fechaLlegada)) {
                 return res.status(400).json({ error: 'Fechas inválidas.' });
            }

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

            const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
            const endDate = parseISO(fechaSalida + 'T00:00:00Z');
             if(!isValid(startDate) || !isValid(endDate)) return res.status(400).json({ error: 'Fechas inválidas.' });


            const [tarifasSnapshot, canalesSnapshot] = await Promise.all([
                 db.collection('empresas').doc(empresaId).collection('tarifas').get(),
                 db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get()
            ]);
            const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 let inicio = null, termino = null;
                 try {
                     inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : (data.fechaInicio ? parseISO(data.fechaInicio + 'T00:00:00Z') : null);
                     termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : (data.fechaTermino ? parseISO(data.fechaTermino + 'T00:00:00Z') : null);
                     if (!isValid(inicio) || !isValid(termino)) throw new Error('Fecha inválida');
                 } catch(e){ return null; }
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
            }).filter(Boolean);
            if (canalesSnapshot.empty) throw new Error(`No hay canal por defecto configurado.`);

            const canalPorDefectoId = canalesSnapshot.docs[0].id;
            const pricing = await calculatePrice(db, empresaId, [propiedad], startDate, endDate, allTarifas, canalPorDefectoId);

            res.json({
                totalPrice: pricing.totalPriceCLP,
                numNoches: pricing.nights,
                formattedTotalPrice: `$${(pricing.totalPriceCLP || 0).toLocaleString('es-CL')} CLP`
            });

        } catch (error) {
            console.error(`Error calculando precio AJAX para propiedad ${req.params.id}:`, error);
            res.status(500).json({ error: error.message || 'Error interno al calcular precio.' });
        }
    });

    // Ruta /reservar (GET) - (sin cambios)
    // NOTA: Esta ruta ya está preparada para manejar grupos (isGroup) y pasa
    // todos los 'query' params a la vista, lo cual es necesario para 'reservar.ejs'
    router.get('/reservar', async (req, res) => {
        const empresaId = req.empresa.id;
        let empresaCompleta = req.empresaCompleta;
        try {
            const propiedadIdsQuery = req.query.propiedadId || '';
            const propiedadIds = propiedadIdsQuery.split(',').map(id => id.trim()).filter(Boolean);

            if (propiedadIds.length === 0 || !req.query.fechaLlegada || !req.query.fechaSalida || !req.query.noches || !req.query.precioFinal || !req.query.personas) {
                 console.error(`[GET /reservar] Faltan parámetros para ${empresaId}:`, req.query);
                 return res.status(400).render('404', {
                    title: 'Faltan Datos para Reservar',
                    empresa: empresaCompleta
                 });
            }

            const propiedadesPromises = propiedadIds.map(id => obtenerPropiedadPorId(db, empresaId, id));
            const propiedadesResult = await Promise.all(propiedadesPromises);
            const propiedades = propiedadesResult.filter(Boolean);

            if (propiedades.length !== propiedadIds.length) {
                console.warn(`[GET /reservar] No se encontraron todas las propiedades solicitadas: ${propiedadIds.join(',')}`);
                 return res.status(404).render('404', {
                    title: 'Una o más propiedades no encontradas',
                    empresa: empresaCompleta
                });
            }

            const isGroupReservation = propiedades.length > 1;
            const dataToRender = isGroupReservation ? propiedades : propiedades[0];

            res.render('reservar', {
                title: `Completar Reserva | ${empresaCompleta.nombre}`,
                propiedad: dataToRender,
                isGroup: isGroupReservation,
                query: req.query,
            });
        } catch (error) {
            console.error(`Error al mostrar página de reserva para empresa ${empresaId}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno del Servidor',
                 empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" }
            });
        }
    });

    // Endpoint Público para Crear Reserva (POST /crear-reserva-publica) - (sin cambios)
    router.post('/crear-reserva-publica', express.json(), async (req, res) => {
         try {
            const empresaId = req.empresa.id;
            if (!empresaId) {
                console.error("[POST /crear-reserva-publica] Error: No se pudo identificar la empresaId.");
                throw new Error('No se pudo identificar la empresa para la reserva.');
            }
            console.log(`[POST /crear-reserva-publica] Recibido para empresa ${empresaId}:`, req.body);

            const reserva = await crearReservaPublica(db, empresaId, req.body);

            res.status(201).json({ reservaId: reserva.idReservaCanal });

        } catch (error) {
            console.error(`[POST /crear-reserva-publica] Error al crear reserva:`, error);
            res.status(500).json({ error: error.message || 'Error interno al procesar la reserva.' });
        }
    });


    // Ruta /confirmacion (GET) - Sin cambios
    router.get('/confirmacion', async (req, res) => {
        const empresaId = req.empresa.id;
        let empresaCompleta = req.empresaCompleta;
        try {
            const reservaIdOriginal = req.query.reservaId;
            if (!reservaIdOriginal) {
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta});
            }
            const reservaSnap = await db.collection('empresas').doc(empresaId).collection('reservas')
                                      .where('idReservaCanal', '==', reservaIdOriginal)
                                      .get();
            if (reservaSnap.empty) {
                 console.warn(`[GET /confirmacion] No se encontró reserva con idReservaCanal=${reservaIdOriginal} para empresa ${empresaId}`);
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta});
            }
            const reservaData = reservaSnap.docs[0].data();
            const reservaParaVista = {
                ...reservaData,
                id: reservaIdOriginal,
                fechaLlegada: reservaData.fechaLlegada.toDate().toISOString().split('T')[0],
                fechaSalida: reservaData.fechaSalida.toDate().toISOString().split('T')[0],
                precioFinal: reservaData.valores?.valorHuesped || 0
            };
            const cliente = reservaData.clienteId
                 ? await db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get()
                 : null;
            res.render('confirmacion', {
                title: `Reserva Recibida | ${empresaCompleta.nombre}`,
                reserva: reservaParaVista,
                cliente: cliente && cliente.exists ? cliente.data() : { nombre: reservaData.nombreCliente || "Cliente" }
            });
        } catch (error) {
            console.error(`Error mostrando confirmación para ${req.query.reservaId} en empresa ${empresaId}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno del Servidor',
                 empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" }
            });
        }
    });

    // Ruta /contacto - Sin cambios
    router.get('/contacto', async (req, res) => {
        const empresaCompleta = req.empresaCompleta;
        try {
            res.render('contacto', {
                 title: `Contacto | ${empresaCompleta.nombre}`
            });
        } catch (error) {
            console.error(`Error al renderizar contacto para ${empresaCompleta?.id}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno del Servidor',
                 empresa: empresaCompleta || { nombre: "Error Crítico" }
            });
        }
    });

    // Manejador 404 - Sin cambios
    router.use(async (req, res) => {
        const empresaData = res.locals.empresa || req.empresa || { nombre: "Página no encontrada" };
        res.status(404).render('404', {
            title: 'Página no encontrada',
            empresa: empresaData
        });
    });

    return router;
};