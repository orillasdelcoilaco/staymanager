// backend/routes/website.js
const express = require('express');
const { getAvailabilityData, calculatePrice } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');
const { obtenerEmpresaPorDominio, obtenerDetallesEmpresa } = require('../services/empresaService');
const { obtenerReservaPorId } = require('../services/reservasService');
const admin = require('firebase-admin');
const { format, addDays, nextFriday, nextSunday, differenceInYears, differenceInMonths } = require('date-fns');

// Función auxiliar para formatear fechas para input type="date"
const formatDateForInput = (date) => {
    if (!date || isNaN(new Date(date).getTime())) return '';
    // Asegurarse de que la fecha se interpreta como UTC para evitar problemas de zona horaria
    const d = new Date(date.toISOString().slice(0, 10) + 'T00:00:00Z');
    return format(d, 'yyyy-MM-dd', { timeZone: 'UTC' });
};

// Función para obtener el próximo fin de semana (Vie-Dom, 2 noches)
const getNextWeekend = () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Trabajar con fechas UTC
    const friday = nextFriday(today); // Encuentra el próximo viernes (puede ser hoy si es viernes)
    const sunday = nextSunday(friday); // Encuentra el domingo después de ese viernes
    return {
        llegada: friday,
        salida: sunday
    };
};

module.exports = (db) => {
    const router = express.Router();

    router.use(async (req, res, next) => { // Middleware para cargar empresa completa
        if (!req.empresa) {
            return next('router');
        }
        try {
            // Cargar detalles completos aquí para todas las rutas SSR
            req.empresaCompleta = await obtenerDetallesEmpresa(db, req.empresa.id);
            res.locals.empresa = req.empresaCompleta; // Hacerla disponible en EJS
            next();
        } catch (error) {
            console.error(`Error cargando detalles completos para ${req.empresa.id}:`, error);
            res.status(500).render('404', {
                title: 'Error Interno',
                empresa: req.empresa || { nombre: "Error" }
            });
        }
    });

    // Ruta principal (Home) - Usa empresaCompleta
    router.get('/', async (req, res) => {
        try {
            const empresaCompleta = req.empresaCompleta;
            const empresaId = empresaCompleta.id;
            const { fechaLlegada, fechaSalida, personas } = req.query;

            let propiedadesAMostrar = [];
            let isSearchResult = false;

            if (fechaLlegada && fechaSalida && personas) {
                isSearchResult = true;
                const startDate = new Date(fechaLlegada + 'T00:00:00Z');
                const endDate = new Date(fechaSalida + 'T00:00:00Z');
                const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
                propiedadesAMostrar = availableProperties
                    .filter(p => p.googleHotelData?.isListed === true && p.websiteData?.cardImage?.storagePath) // Asegurar que tenga cardImage
                    .filter(p => p.capacidad >= parseInt(personas));
            } else {
                const todasLasPropiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
                propiedadesAMostrar = todasLasPropiedades
                    .filter(p => p.googleHotelData?.isListed === true && p.websiteData?.cardImage?.storagePath); // Asegurar que tenga cardImage
            }

            res.render('home', {
                title: empresaCompleta.websiteSettings?.seo?.homeTitle || empresaCompleta.nombre,
                description: empresaCompleta.websiteSettings?.seo?.homeDescription || `Reservas en ${empresaCompleta.nombre}`,
                propiedades: propiedadesAMostrar,
                isSearchResult: isSearchResult,
                query: req.query
            });
        } catch (error) {
            console.error(`Error al renderizar el home para ${req.empresaCompleta?.id}:`, error);
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresaCompleta || { nombre: "Error Interno" }
            });
        }
    });

    // Ruta de detalle de propiedad - Usa empresaCompleta y calcula precio finde
    router.get('/propiedad/:id', async (req, res) => {
        try {
            const empresaCompleta = req.empresaCompleta;
            const empresaId = empresaCompleta.id;
            const propiedadId = req.params.id;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);

            if (!propiedad || !propiedad.googleHotelData?.isListed) {
                return res.status(404).render('404', {
                    title: 'Propiedad No Encontrada',
                });
            }

            const weekendDates = getNextWeekend();
            const defaultCheckin = weekendDates.llegada;
            const defaultCheckout = weekendDates.salida;
            let defaultPriceData = { totalPriceCLP: 0, nights: 0, formattedTotalPrice: 'No disponible' };

            const [tarifasSnapshot, canalesSnapshot] = await Promise.all([
                 db.collection('empresas').doc(empresaId).collection('tarifas').get(),
                 db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get()
            ]);
             const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 const inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
                 const termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
            });

             if (!canalesSnapshot.empty) {
                const canalPorDefectoId = canalesSnapshot.docs[0].id;
                try {
                    const pricingResult = await calculatePrice(db, empresaId, [propiedad], defaultCheckin, defaultCheckout, allTarifas, canalPorDefectoId);
                    defaultPriceData = {
                        totalPriceCLP: pricingResult.totalPriceCLP,
                        nights: pricingResult.nights,
                        formattedTotalPrice: `$${(pricingResult.totalPriceCLP || 0).toLocaleString('es-CL')} CLP`
                    };
                } catch (priceError) {
                    console.warn(`No se pudo calcular el precio del finde para ${propiedad.nombre}: ${priceError.message}`);
                }
             } else {
                 console.warn(`Empresa ${empresaId} no tiene canal por defecto para calcular precio inicial.`);
             }

            let checkinDate = req.query.checkin ? new Date(req.query.checkin + 'T00:00:00Z') : defaultCheckin;
            let checkoutDate = req.query.checkout ? new Date(req.query.checkout + 'T00:00:00Z') : defaultCheckout;
            if (req.query.nights && req.query.checkin) {
                 checkoutDate = addDays(checkinDate, parseInt(req.query.nights));
            } else if (req.query.fechaSalida && req.query.fechaLlegada) {
                 checkinDate = new Date(req.query.fechaLlegada + 'T00:00:00Z');
                 checkoutDate = new Date(req.query.fechaSalida + 'T00:00:00Z');
            }

            let personas = parseInt(req.query.adults || req.query.personas);
            if (!personas || isNaN(personas) || personas <= 0) {
                personas = propiedad.capacidad || 1;
            } else {
                personas = Math.min(personas, propiedad.capacidad);
            }

            let hostingDuration = 'Recién comenzando';
            if (empresaCompleta.fechaCreacion && empresaCompleta.fechaCreacion.toDate) {
                const createdAt = empresaCompleta.fechaCreacion.toDate();
                const now = new Date();
                const yearsHosting = differenceInYears(now, createdAt);
                const monthsHosting = differenceInMonths(now, createdAt) % 12;
                let durationParts = [];
                if (yearsHosting > 0) durationParts.push(`${yearsHosting} año${yearsHosting !== 1 ? 's' : ''}`);
                if (monthsHosting > 0) durationParts.push(`${monthsHosting} mes${monthsHosting !== 1 ? 'es' : ''}`);
                if (durationParts.length > 0) hostingDuration = durationParts.join(' y ');
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
            console.error(`Error al renderizar la propiedad ${req.params.id} para ${req.empresaCompleta?.id}:`, error);
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresaCompleta || { nombre: "Error Interno" }
            });
        }
    });

    // API interna para calcular precio (AJAX)
    router.post('/api/propiedad/:id/calcular-precio', express.json(), async (req, res) => {
         try {
            const empresaId = req.empresaCompleta.id;
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
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
            });
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

    // Ruta /reservar (GET)
    router.get('/reservar', async (req, res) => {
        try {
            const empresaCompleta = req.empresaCompleta;
            const empresaId = empresaCompleta.id;
            const { propiedadId } = req.query;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) {
                return res.status(404).render('404', {
                    title: 'Propiedad No Encontrada',
                });
            }
            res.render('reservar', {
                title: `Completar Reserva | ${empresaCompleta.nombre}`,
                propiedad,
                query: req.query,
            });
        } catch (error) {
            console.error(`Error al mostrar página de reserva para empresa ${req.empresaCompleta?.id}:`, error);
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresaCompleta || { nombre: "Error Interno" }
            });
        }
    });

    // Ruta /reservar (POST)
    router.post('/reservar', express.urlencoded({ extended: true }), async (req, res) => {
         try {
            const hostname = req.hostname;
            const empresaData = await obtenerEmpresaPorDominio(db, hostname);
            if (!empresaData) {
                throw new Error('Empresa no identificada para la reserva.');
            }

            const reserva = await crearReservaPublica(db, empresaData.id, req.body);
            res.redirect(`/confirmacion?reservaId=${reserva.idReservaCanal}`);
        } catch (error) {
            console.error(`Error al crear reserva:`, error);
            const empresaFallback = req.empresaCompleta || { nombre: "Error Interno" };
            res.status(500).render('404', {
                title: 'Error de Reserva',
                empresa: empresaFallback
            });
        }
    });

    // Ruta /confirmacion
    router.get('/confirmacion', async (req, res) => {
        try {
            const empresaCompleta = req.empresaCompleta;
            const empresaId = empresaCompleta.id;
            const reservaIdOriginal = req.query.reservaId;

            if (!reservaIdOriginal) {
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta});
            }

            const reservaSnap = await db.collection('empresas').doc(empresaId).collection('reservas')
                                      .where('idReservaCanal', '==', reservaIdOriginal)
                                      .limit(1)
                                      .get();
            if (reservaSnap.empty) {
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta});
            }
            const reservaData = reservaSnap.docs[0].data();
            const cliente = await db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get();

            res.render('confirmacion', {
                title: `Reserva Confirmada | ${empresaCompleta.nombre}`,
                reserva: reservaData,
                cliente: cliente.exists ? cliente.data() : { nombre: "Cliente" }
            });
        } catch (error) {
            console.error(`Error mostrando confirmación ${req.query.reservaId}:`, error);
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresaCompleta || { nombre: "Error Interno" }
            });
        }
    });

    // Ruta /contacto
    router.get('/contacto', async (req, res) => {
        try {
            const empresaCompleta = req.empresaCompleta;
            res.render('contacto', {
                 title: `Contacto | ${empresaCompleta.nombre}`
            });
        } catch (error) {
            console.error(`Error al renderizar contacto para ${req.empresaCompleta?.id}:`, error);
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresaCompleta || { nombre: "Error Interno" }
            });
        }
    });

    // Manejador 404
    router.use((req, res) => {
        res.status(404).render('404', {
            title: 'Página no encontrada'
        });
    });

    return router;
};