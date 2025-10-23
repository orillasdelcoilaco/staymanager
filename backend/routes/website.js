// backend/routes/website.js
const express = require('express');
// *** NECESARIO: Importar findNormalCombination ***
const { getAvailabilityData, calculatePrice, findNormalCombination } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');
const { obtenerEmpresaPorDominio, obtenerDetallesEmpresa } = require('../services/empresaService');
const admin = require('firebase-admin');
const { format, addDays, nextFriday, nextSunday, differenceInYears, differenceInMonths } = require('date-fns');

// Función auxiliar para formatear fechas para input type="date"
const formatDateForInput = (date) => {
    if (!date || isNaN(new Date(date).getTime())) return '';
    const d = new Date(date.toISOString().slice(0, 10) + 'T00:00:00Z');
    return format(d, 'yyyy-MM-dd', { timeZone: 'UTC' });
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
        const empresaId = req.empresa.id;
        console.log(`[DEBUG / handler] Procesando home para empresaId: '${empresaId}'`);
        let empresaCompleta = req.empresaCompleta;

        try {
            const { fechaLlegada, fechaSalida, personas } = req.query;
            let resultadosParaMostrar = []; // Cambiado de propiedadesAMostrar
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
                 const inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
                 const termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
                 if (isNaN(inicio.getTime()) || isNaN(termino.getTime())) {
                     console.warn(`[WARN] Tarifa ${doc.id} tiene fechas inválidas, será ignorada.`);
                     return null;
                 }
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
            }).filter(Boolean);

            const canalPorDefectoId = !canalesSnapshot.empty ? canalesSnapshot.docs[0].id : null;

            if (fechaLlegada && fechaSalida && personas && new Date(fechaSalida) > new Date(fechaLlegada)) {
                isSearchResult = true;
                const startDate = new Date(fechaLlegada + 'T00:00:00Z');
                const endDate = new Date(fechaSalida + 'T00:00:00Z');
                const numPersonas = parseInt(personas);

                const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
                const availableIds = new Set(availableProperties.map(p => p.id));

                // Filtrar propiedades listadas que están disponibles (capacidad se chequea después)
                const propiedadesDisponiblesListadas = propiedadesListadas.filter(p => availableIds.has(p.id));

                if (propiedadesDisponiblesListadas.length > 0 && canalPorDefectoId) {
                    // *** NUEVO: Intentar encontrar combinación para grupos grandes ***
                    const { combination, capacity } = findNormalCombination(propiedadesDisponiblesListadas, numPersonas);

                    if (combination.length > 0 && capacity >= numPersonas) {
                        // Si encontramos una combinación válida (puede ser 1 o más propiedades)
                        try {
                            const pricingResult = await calculatePrice(db, empresaId, combination, startDate, endDate, allTarifas, canalPorDefectoId);
                            if (combination.length > 1) {
                                // Es un grupo, crear objeto especial
                                resultadosParaMostrar = [{
                                    isGroup: true,
                                    properties: combination, // Array de propiedades en el grupo
                                    combinedCapacity: capacity,
                                    combinedPricing: pricingResult // Precio total del grupo
                                }];
                            } else {
                                // Es una sola propiedad, añadir precio a esa propiedad
                                resultadosParaMostrar = [{ ...combination[0], pricing: pricingResult }];
                            }
                        } catch (priceError) {
                            console.warn(`No se pudo calcular el precio para la combinación encontrada: ${priceError.message}`);
                            // Si falla el precio, no mostramos nada para esta búsqueda
                            resultadosParaMostrar = [];
                        }
                    } else {
                        // No se encontró combinación que cumpla la capacidad
                        console.log(`No se encontró combinación para ${numPersonas} personas.`);
                        resultadosParaMostrar = []; // Mostrar mensaje "No encontrado" en EJS
                    }
                } else if (!canalPorDefectoId) {
                    console.warn(`[WARN] Empresa ${empresaId} no tiene canal por defecto. No se calcularán precios.`);
                    // Aún mostrar propiedades disponibles si no hay canal, pero sin precio
                    resultadosParaMostrar = propiedadesDisponiblesListadas.filter(p => p.capacidad >= numPersonas)
                                                .map(prop => ({ ...prop, pricing: null }));
                }
                // Si propiedadesDisponiblesListadas está vacío, resultadosParaMostrar se queda vacío []

            } else {
                 // Si no hay búsqueda, mostrar todas las propiedades listadas sin precio
                 resultadosParaMostrar = propiedadesListadas.map(prop => ({ ...prop, pricing: null }));
            }

            res.render('home', {
                title: empresaCompleta?.websiteSettings?.seo?.homeTitle || empresaCompleta.nombre,
                description: empresaCompleta?.websiteSettings?.seo?.homeDescription || `Reservas en ${empresaCompleta.nombre}`,
                resultados: resultadosParaMostrar, // *** Cambiado a 'resultados' ***
                isSearchResult: isSearchResult,
                query: req.query
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
                 const inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
                 const termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
                  if (isNaN(inicio.getTime()) || isNaN(termino.getTime())) return null;
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

            if (req.query.fechaLlegada && req.query.fechaSalida && new Date(req.query.fechaSalida) > new Date(req.query.fechaLlegada)) {
                 checkinDate = new Date(req.query.fechaLlegada + 'T00:00:00Z');
                 checkoutDate = new Date(req.query.fechaSalida + 'T00:00:00Z');
            } else if (req.query.checkin && req.query.nights) {
                 checkinDate = new Date(req.query.checkin + 'T00:00:00Z');
                 checkoutDate = addDays(checkinDate, parseInt(req.query.nights));
            }
             if (isNaN(checkinDate.getTime())) checkinDate = defaultCheckin;
             if (isNaN(checkoutDate.getTime())) checkoutDate = defaultCheckout;

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

            const startDate = new Date(fechaLlegada + 'T00:00:00Z');
            const endDate = new Date(fechaSalida + 'T00:00:00Z');

            const [tarifasSnapshot, canalesSnapshot] = await Promise.all([
                 db.collection('empresas').doc(empresaId).collection('tarifas').get(),
                 db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get()
            ]);
            const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 const inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
                 const termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
                 if (isNaN(inicio.getTime()) || isNaN(termino.getTime())) return null;
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

    // Ruta /reservar (GET) - Sin cambios
    router.get('/reservar', async (req, res) => {
        const empresaId = req.empresa.id;
        let empresaCompleta = req.empresaCompleta;
        try {
            const { propiedadId } = req.query;
            if (!propiedadId || !req.query.fechaLlegada || !req.query.fechaSalida || !req.query.noches || !req.query.precioFinal || !req.query.personas) {
                 console.error(`[GET /reservar] Faltan parámetros en la query para ${empresaId}:`, req.query);
                 return res.status(400).render('404', {
                    title: 'Faltan Datos para Reservar',
                    empresa: empresaCompleta
                 });
            }
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) {
                return res.status(404).render('404', {
                    title: 'Propiedad No Encontrada',
                    empresa: empresaCompleta
                });
            }
            res.render('reservar', {
                title: `Completar Reserva | ${empresaCompleta.nombre}`,
                propiedad,
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

    // Endpoint Público para Crear Reserva (POST /crear-reserva-publica) - Sin cambios
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
                                      .limit(1)
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

