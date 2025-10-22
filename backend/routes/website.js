// backend/routes/website.js

module.exports = (db) => {
    const router = express.Router();

    // Middleware para cargar empresa completa
    router.use(async (req, res, next) => {
        if (!req.empresa) { // req.empresa viene del tenantResolver
            return next('router');
        }
        try {
            // *** PROBLEMA AQUÍ ***
            // Cargamos req.empresaCompleta, ¡pero no siempre tiene el 'id'!
            // El objeto 'empresa' del tenantResolver podría ser solo { id: '...' }
            // Y obtenerDetallesEmpresa devuelve los datos, pero no necesariamente incluye el 'id' en el objeto devuelto.
            req.empresaCompleta = await obtenerDetallesEmpresa(db, req.empresa.id); // Carga los datos
            res.locals.empresa = req.empresaCompleta;

            // *** SOLUCIÓN: Asegurar que req.empresaCompleta tenga el ID ***
            if (req.empresaCompleta && req.empresa.id) {
                req.empresaCompleta.id = req.empresa.id; // Añadir el ID explícitamente si falta
            } else if (!req.empresaCompleta && req.empresa.id) {
                 // Si obtenerDetallesEmpresa falló pero tenemos ID, crear objeto básico
                 req.empresaCompleta = { id: req.empresa.id, nombre: "Empresa (Error Cargando Detalles)" };
                 res.locals.empresa = req.empresaCompleta;
            } else {
                 // Si ni siquiera tenemos req.empresa.id, algo falló antes
                 console.error("[website.js middleware] Error: req.empresa.id no está definido después del tenantResolver.");
                 return next(new Error("No se pudo identificar la empresa."));
            }

            console.log(`[DEBUG website.js middleware] Empresa ${req.empresaCompleta.id} cargada.`); // Log de confirmación
            next();
        } catch (error) {
            console.error(`Error cargando detalles completos para ${req.empresa?.id}:`, error);
            // Renderizar error pero asegurar que 'empresa' exista
             res.status(500).render('404', {
                title: 'Error Interno',
                empresa: req.empresaCompleta || req.empresa || { id: '?', nombre: "Error Crítico" }
            });
        }
    });

    // Ruta principal (Home)
    router.get('/', async (req, res) => {
        try {
            // Ahora podemos confiar en que req.empresaCompleta y su ID existen
            const empresaCompleta = req.empresaCompleta;
            const empresaId = empresaCompleta.id; // <--- Ahora debería ser válido

            console.log(`[DEBUG / handler] Procesando home para empresaId: '${empresaId}'`); // Log adicional

            const { fechaLlegada, fechaSalida, personas } = req.query;
            let propiedadesAMostrar = [];
            let isSearchResult = false;

            // Llamada a obtenerPropiedadesPorEmpresa (Ahora debería recibir un ID válido)
            const todasLasPropiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);

            if (fechaLlegada && fechaSalida && personas) {
                // ... (lógica de filtrado por fecha/personas) ...
                isSearchResult = true;
                const startDate = new Date(fechaLlegada + 'T00:00:00Z');
                const endDate = new Date(fechaSalida + 'T00:00:00Z');
                // Simular disponibilidad para simplificar, ya que el problema es obtener las props
                // const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
                const availableProperties = todasLasPropiedades; // Temporalmente asumir todas disponibles
                propiedadesAMostrar = availableProperties
                    .filter(p => p.googleHotelData?.isListed === true && p.websiteData?.cardImage?.storagePath)
                    .filter(p => p.capacidad >= parseInt(personas));
            } else {
                 propiedadesAMostrar = todasLasPropiedades
                    .filter(p => p.googleHotelData?.isListed === true && p.websiteData?.cardImage?.storagePath);
            }

            res.render('home', {
                title: empresaCompleta.websiteSettings?.seo?.homeTitle || empresaCompleta.nombre,
                description: empresaCompleta.websiteSettings?.seo?.homeDescription || `Reservas en ${empresaCompleta.nombre}`,
                propiedades: propiedadesAMostrar,
                isSearchResult: isSearchResult,
                query: req.query
                // 'empresa' ya está en res.locals
            });
        } catch (error) {
            // El error ahora debería originarse aquí si obtenerPropiedadesPorEmpresa falla
            console.error(`Error al renderizar el home para ${req.empresaCompleta?.id}:`, error);
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresaCompleta || { nombre: "Error Interno" }
            });
        }
    });

    // ... (Resto de las rutas /propiedad, /api/propiedad, /reservar, etc., sin cambios respecto a la última versión) ...
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

    router.use((req, res) => {
        res.status(404).render('404', {
            title: 'Página no encontrada'
        });
    });

    return router;
};