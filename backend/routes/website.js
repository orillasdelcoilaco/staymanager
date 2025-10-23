// backend/routes/website.js
const express = require('express');
const { getAvailabilityData, calculatePrice } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');
const { obtenerEmpresaPorDominio, obtenerDetallesEmpresa } = require('../services/empresaService');
// No necesitamos obtenerReservaPorId aquí
// const { obtenerReservaPorId } = require('../services/reservasService');
const admin = require('firebase-admin');
const { format, addDays, nextFriday, nextSunday, differenceInYears, differenceInMonths } = require('date-fns');

// Función auxiliar para formatear fechas para input type="date"
const formatDateForInput = (date) => {
    if (!date || isNaN(new Date(date).getTime())) return '';
    // Asegurarse de que la fecha se interprete como UTC para evitar problemas de zona horaria
    const d = new Date(date.toISOString().slice(0, 10) + 'T00:00:00Z');
    return format(d, 'yyyy-MM-dd', { timeZone: 'UTC' });
};

// Función para obtener el próximo fin de semana (Vie-Dom, 2 noches)
const getNextWeekend = () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const friday = nextFriday(today);
    const sunday = nextSunday(friday); // Sunday after the next Friday
    return {
        llegada: friday,
        salida: sunday
    };
};

module.exports = (db) => {
    const router = express.Router();

    // Middleware para cargar datos completos de la empresa
    router.use(async (req, res, next) => {
        // Asegurar que req.empresa exista y tenga un ID válido
        if (!req.empresa || !req.empresa.id || typeof req.empresa.id !== 'string' || req.empresa.id.trim() === '') {
            console.error("[website.js middleware] Error: req.empresa.id inválido o no definido después del tenantResolver.");
            // next('router') saltaría el resto de las rutas de este router, lo cual es correcto si no hay empresa
            return next('router');
        }
        console.log(`[DEBUG website.js middleware] Empresa ID ${req.empresa.id} identificada.`);
        try {
            // Cargar detalles completos, incluyendo websiteSettings
            req.empresaCompleta = await obtenerDetallesEmpresa(db, req.empresa.id);
            if (req.empresaCompleta) {
                req.empresaCompleta.id = req.empresa.id; // Asegurar ID
            } else {
                 // Fallback si no se encuentran detalles completos (poco probable si tenantResolver funcionó)
                 req.empresaCompleta = { id: req.empresa.id, nombre: req.empresa.nombre || "Empresa (Detalles no cargados)" };
            }
            // Pasar la empresa completa a las plantillas EJS
            res.locals.empresa = req.empresaCompleta;
            next();
        } catch (error) {
            console.error(`Error cargando detalles completos para ${req.empresa.id}:`, error);
            // Renderizar página de error si falla la carga de detalles
            res.status(500).render('404', {
                title: 'Error Interno',
                // Asegurarse de pasar un objeto empresa, incluso en error
                empresa: req.empresa || { nombre: "Error" }
            });
        }
    });

    // Ruta principal (Home)
    router.get('/', async (req, res) => {
        const empresaId = req.empresa.id;
        console.log(`[DEBUG / handler] Procesando home para empresaId: '${empresaId}'`);
        let empresaCompleta = req.empresaCompleta; // Ya cargada por el middleware

        try {
            const { fechaLlegada, fechaSalida, personas } = req.query;
            let propiedadesAMostrar = [];
            let isSearchResult = false;

            // Obtener todas las propiedades y tarifas una sola vez
            const [todasLasPropiedades, tarifasSnapshot, canalesSnapshot] = await Promise.all([
                obtenerPropiedadesPorEmpresa(db, empresaId),
                db.collection('empresas').doc(empresaId).collection('tarifas').get(),
                db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get()
            ]);

            // Filtrar propiedades que deben mostrarse en la web
            const propiedadesListadas = todasLasPropiedades
                .filter(p => p.googleHotelData?.isListed === true && p.websiteData?.cardImage?.storagePath);

            // Obtener tarifas y canal por defecto (necesario para calcular precios)
            const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 const inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
                 const termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
                 // Validar fechas antes de devolver
                 if (isNaN(inicio.getTime()) || isNaN(termino.getTime())) {
                     console.warn(`[WARN] Tarifa ${doc.id} tiene fechas inválidas, será ignorada.`);
                     return null; // Ignorar tarifa con fechas inválidas
                 }
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
            }).filter(Boolean); // Filtrar los nulls

            const canalPorDefectoId = !canalesSnapshot.empty ? canalesSnapshot.docs[0].id : null;

            if (fechaLlegada && fechaSalida && personas && new Date(fechaSalida) > new Date(fechaLlegada)) {
                isSearchResult = true;
                const startDate = new Date(fechaLlegada + 'T00:00:00Z');
                const endDate = new Date(fechaSalida + 'T00:00:00Z');
                const numPersonas = parseInt(personas);

                // Obtener disponibilidad para el rango
                const { availableProperties, availabilityMap } = await getAvailabilityData(db, empresaId, startDate, endDate);
                const availableIds = new Set(availableProperties.map(p => p.id));

                // Filtrar propiedades listadas que están disponibles y tienen capacidad
                const propiedadesDisponiblesFiltradas = propiedadesListadas.filter(p =>
                    availableIds.has(p.id) && p.capacidad >= numPersonas
                );

                // Calcular precio para cada propiedad disponible si hay un canal por defecto
                if (canalPorDefectoId) {
                    propiedadesAMostrar = await Promise.all(propiedadesDisponiblesFiltradas.map(async (prop) => {
                        try {
                            const pricingResult = await calculatePrice(db, empresaId, [prop], startDate, endDate, allTarifas, canalPorDefectoId);
                            // Adjuntar el resultado del precio a la propiedad
                            return { ...prop, pricing: pricingResult };
                        } catch (priceError) {
                            console.warn(`No se pudo calcular el precio para ${prop.nombre} (${prop.id}): ${priceError.message}`);
                            return { ...prop, pricing: null }; // Adjuntar null si hay error de precio
                        }
                    }));
                } else {
                    console.warn(`[WARN] Empresa ${empresaId} no tiene canal por defecto. No se calcularán precios.`);
                    propiedadesAMostrar = propiedadesDisponiblesFiltradas.map(prop => ({ ...prop, pricing: null })); // Pasar sin precios
                }

            } else {
                 // Si no hay búsqueda, mostrar todas las propiedades listadas sin precio
                 propiedadesAMostrar = propiedadesListadas.map(prop => ({ ...prop, pricing: null }));
            }

            res.render('home', {
                title: empresaCompleta?.websiteSettings?.seo?.homeTitle || empresaCompleta.nombre,
                description: empresaCompleta?.websiteSettings?.seo?.homeDescription || `Reservas en ${empresaCompleta.nombre}`,
                propiedades: propiedadesAMostrar, // Pasar la lista (con o sin precios)
                isSearchResult: isSearchResult,
                query: req.query // Pasar los parámetros de búsqueda para pre-rellenar el form
            });

        } catch (error) {
            console.error(`Error al renderizar el home para ${empresaId}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno del Servidor',
                empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" }
            });
        }
    });

    // Ruta de detalle de propiedad (sin cambios significativos necesarios aquí para la funcionalidad de home)
    router.get('/propiedad/:id', async (req, res) => {
        const empresaCompleta = req.empresaCompleta;
        const empresaId = empresaCompleta.id;
        const propiedadId = req.params.id;

        try {
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);

            if (!propiedad || !propiedad.googleHotelData?.isListed) {
                return res.status(404).render('404', {
                    title: 'Propiedad No Encontrada',
                    // Asegúrate de pasar la empresa incluso en 404
                    empresa: empresaCompleta
                });
            }

            // --- Cálculo de precio default para finde y prefill ---
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
                    // Calcular precio para el finde por defecto
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
             // --- Fin Cálculo precio default ---

            // --- Lógica de prefill basada en query params o finde default ---
            let checkinDate = defaultCheckin;
            let checkoutDate = defaultCheckout;

            if (req.query.fechaLlegada && req.query.fechaSalida && new Date(req.query.fechaSalida) > new Date(req.query.fechaLlegada)) {
                 checkinDate = new Date(req.query.fechaLlegada + 'T00:00:00Z');
                 checkoutDate = new Date(req.query.fechaSalida + 'T00:00:00Z');
            } else if (req.query.checkin && req.query.nights) { // Compatibilidad con Google Hotels
                 checkinDate = new Date(req.query.checkin + 'T00:00:00Z');
                 checkoutDate = addDays(checkinDate, parseInt(req.query.nights));
            }
            // Asegurarse que las fechas no sean NaN
             if (isNaN(checkinDate.getTime())) checkinDate = defaultCheckin;
             if (isNaN(checkoutDate.getTime())) checkoutDate = defaultCheckout;

            let personas = parseInt(req.query.personas || req.query.adults);
            if (!personas || isNaN(personas) || personas <= 0) {
                personas = Math.min(2, propiedad.capacidad || 1); // Default a 2 o capacidad si es menor
            } else {
                personas = Math.min(personas, propiedad.capacidad); // Limitar a capacidad máxima
            }
            // --- Fin lógica prefill ---

            // --- Cálculo duración anfitrión ---
            let hostingDuration = 'Anfitrión'; // Default más genérico
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
             // --- Fin cálculo duración ---

            res.render('propiedad', {
                title: `${propiedad.nombre} | ${empresaCompleta.nombre}`,
                description: (propiedad.websiteData?.aiDescription || propiedad.descripcion || `Descubre ${propiedad.nombre}`).substring(0, 155),
                propiedad: propiedad,
                // Pasar datos prefill formateados para input date
                prefill: {
                    fechaLlegada: formatDateForInput(checkinDate),
                    fechaSalida: formatDateForInput(checkoutDate),
                    personas: personas
                },
                defaultPriceData: defaultPriceData, // Precio del finde
                hostingDuration: hostingDuration // Duración como anfitrión
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

    // Ruta /reservar (GET) - Sin cambios necesarios
    router.get('/reservar', async (req, res) => {
        const empresaId = req.empresa.id;
        let empresaCompleta = req.empresaCompleta;
        try {
            const { propiedadId } = req.query;
            // Validar que los datos necesarios estén en la query
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
                query: req.query, // Pasar todos los query params a la vista
            });
        } catch (error) {
            console.error(`Error al mostrar página de reserva para empresa ${empresaId}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno del Servidor',
                 empresa: empresaCompleta || { id: empresaId, nombre: "Error Crítico" }
            });
        }
    });

    // --- NUEVO Endpoint Público para Crear Reserva (POST /crear-reserva-publica) ---
    // Se usa json() para parsear el cuerpo enviado desde checkout.js
    router.post('/crear-reserva-publica', express.json(), async (req, res) => {
         try {
            const empresaId = req.empresa.id; // Obtenido del middleware tenantResolver
            if (!empresaId) {
                // Esto no debería ocurrir si tenantResolver funciona, pero es una salvaguarda
                console.error("[POST /crear-reserva-publica] Error: No se pudo identificar la empresaId.");
                throw new Error('No se pudo identificar la empresa para la reserva.');
            }

            console.log(`[POST /crear-reserva-publica] Recibido para empresa ${empresaId}:`, req.body);

            // Llamar al servicio que crea la reserva PÚBLICA
            const reserva = await crearReservaPublica(db, empresaId, req.body);

            // Devolver solo el ID de la reserva creada para la redirección
            res.status(201).json({ reservaId: reserva.idReservaCanal });

        } catch (error) {
            console.error(`[POST /crear-reserva-publica] Error al crear reserva:`, error);
            // Devolver un error JSON que el frontend pueda mostrar
            res.status(500).json({ error: error.message || 'Error interno al procesar la reserva.' });
        }
    });


    // Ruta /confirmacion (GET) - Sin cambios necesarios
    router.get('/confirmacion', async (req, res) => {
        const empresaId = req.empresa.id;
        let empresaCompleta = req.empresaCompleta;
        try {
            const reservaIdOriginal = req.query.reservaId;
            if (!reservaIdOriginal) {
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta});
            }

            // Buscar la reserva por idReservaCanal (que es lo que se pasa en la query)
            const reservaSnap = await db.collection('empresas').doc(empresaId).collection('reservas')
                                      .where('idReservaCanal', '==', reservaIdOriginal)
                                      .limit(1) // Solo debería haber una reserva principal con ese ID
                                      .get();
            if (reservaSnap.empty) {
                 console.warn(`[GET /confirmacion] No se encontró reserva con idReservaCanal=${reservaIdOriginal} para empresa ${empresaId}`);
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta});
            }

            const reservaData = reservaSnap.docs[0].data();
            // Asegurarse de formatear las fechas correctamente para la vista
            const reservaParaVista = {
                ...reservaData,
                id: reservaIdOriginal, // Usar el ID original como identificador principal en la vista
                fechaLlegada: reservaData.fechaLlegada.toDate().toISOString().split('T')[0],
                fechaSalida: reservaData.fechaSalida.toDate().toISOString().split('T')[0],
                precioFinal: reservaData.valores?.valorHuesped || 0 // Usar valorHuesped como precio final
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

    // Ruta /contacto - Sin cambios necesarios
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

    // Manejador 404 para este router - Sin cambios necesarios
    router.use(async (req, res) => {
        // Asegurarse de que res.locals.empresa exista incluso para 404
        const empresaData = res.locals.empresa || req.empresa || { nombre: "Página no encontrada" };
        res.status(404).render('404', {
            title: 'Página no encontrada',
            empresa: empresaData // Pasar la empresa a la plantilla 404
        });
    });

    return router;
};
