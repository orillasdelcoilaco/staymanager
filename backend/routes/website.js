// backend/routes/website.js
const express = require('express');
const { getAvailabilityData, calculatePrice } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');

// Función auxiliar para formatear fechas
const formatDateForInput = (date) => {
    if (!date) return '';
    // Asegurarse de que date sea un objeto Date
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return ''; // Devolver vacío si la fecha no es válida

    // Usar UTC para evitar problemas de zona horaria al formatear
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

module.exports = (db) => {
    const router = express.Router();

    // Middleware para asegurar que req.empresa existe y añadirlo a locals
    router.use((req, res, next) => {
        if (!req.empresa) {
            // Si no hay empresa identificada por el tenantResolver,
            // salimos de este router específico del sitio público.
            // La lógica en index.js se encargará de servir la SPA.
            return next('router');
        }
        // Hacemos que 'empresa' esté disponible en todas las plantillas EJS
        res.locals.empresa = req.empresa;
        next();
    });

    // Ruta principal (Home) - Modificada para asegurar datos completos
    router.get('/', async (req, res) => {
        try {
            const { fechaLlegada, fechaSalida, personas } = req.query;
            let propiedadesAMostrar = [];
            let isSearchResult = false;
            const empresaId = req.empresa.id; // Usar el ID de la empresa del middleware

            if (fechaLlegada && fechaSalida && personas) {
                isSearchResult = true;
                const startDate = new Date(fechaLlegada + 'T00:00:00Z');
                const endDate = new Date(fechaSalida + 'T00:00:00Z');
                const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
                // availableProperties ya debería contener los datos completos, incl. websiteData
                propiedadesAMostrar = availableProperties.filter(p => p.capacidad >= parseInt(personas));

            } else {
                // obtenerPropiedadesPorEmpresa ya devuelve los datos completos
                propiedadesAMostrar = await obtenerPropiedadesPorEmpresa(db, empresaId);
            }

            res.render('home', {
                title: req.empresa.nombre,
                description: req.empresa.slogan || `Las mejores propiedades en ${req.empresa.nombre}`,
                propiedades: propiedadesAMostrar, // Pasar las propiedades con websiteData y componentes
                isSearchResult: isSearchResult,
                query: req.query
            });
        } catch (error) {
            console.error(`Error al renderizar el home para ${req.empresa.id}:`, error);
            // Renderizar una página de error genérica usando 404.ejs como base si ocurre un error
            res.status(500).render('404', { title: 'Error', message: 'Error al cargar la página de inicio.' }); // Pasamos message a 404.ejs
        }
    });

    // Ruta de detalle de propiedad - Modificada para asegurar datos completos
    router.get('/propiedad/:id', async (req, res) => {
        try {
            const empresaId = req.empresa.id;
            const propiedadId = req.params.id;
            // obtenerPropiedadPorId ahora devuelve el objeto completo
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);

            if (!propiedad) {
                // Usar la plantilla 404 si la propiedad no existe
                return res.status(404).render('404', { title: 'Propiedad No Encontrada' }); //
            }

            // Lógica de prefill de fechas (sin cambios)
            let checkinDate = null;
            let checkoutDate = null;
            let numAdults = req.query.personas || '';

            if (req.query.checkin && req.query.nights) {
                 try {
                     checkinDate = new Date(req.query.checkin);
                     checkoutDate = new Date(checkinDate);
                     // Corregir cálculo de fecha de salida sumando días UTC
                     checkoutDate.setUTCDate(checkoutDate.getUTCDate() + parseInt(req.query.nights));
                     numAdults = req.query.adults || numAdults;
                 } catch (e) {
                    console.warn("Error parseando fechas de Google Hotels:", e.message);
                    checkinDate = null;
                    checkoutDate = null;
                 }
            } else if (req.query.fechaLlegada && req.query.fechaSalida) {
                checkinDate = new Date(req.query.fechaLlegada + 'T00:00:00Z');
                checkoutDate = new Date(req.query.fechaSalida + 'T00:00:00Z');
            }

            res.render('propiedad', {
                // El título y descripción ahora pueden usar la descripción IA si existe
                title: `${propiedad.nombre} | ${req.empresa.nombre}`, //
                description: (propiedad.websiteData?.aiDescription || propiedad.descripcion || `Descubre ${propiedad.nombre}`).substring(0, 155), //
                propiedad: propiedad, // Pasar el objeto propiedad completo con websiteData y componentes
                prefill: { //
                    fechaLlegada: checkinDate ? formatDateForInput(checkinDate) : '',
                    fechaSalida: checkoutDate ? formatDateForInput(checkoutDate) : '',
                    personas: numAdults
                }
            });
        } catch (error) {
            console.error(`Error al renderizar la propiedad ${req.params.id} para ${req.empresa.id}:`, error);
            res.status(500).render('404', { title: 'Error', message: 'Error al cargar la página de la propiedad.' }); //
        }
    });

    // Ruta API interna para calcular precio (sin cambios funcionales relevantes aquí)
    router.post('/propiedad/:id/calcular-precio', express.json(), async (req, res) => {
         try {
            const empresaId = req.empresa.id; // Obtener empresaId del middleware
            const propiedadId = req.params.id;
            const { fechaLlegada, fechaSalida } = req.body; //

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

            const startDate = new Date(fechaLlegada + 'T00:00:00Z');
            const endDate = new Date(fechaSalida + 'T00:00:00Z');

            const { allTarifas } = await getAvailabilityData(db, empresaId, startDate, endDate);

            // Obtener canal por defecto específico de la empresa
            const canales = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
            if (canales.empty) throw new Error(`No hay canal por defecto configurado para la empresa ${empresaId}.`);
            const canalPorDefectoId = canales.docs[0].id;

            const pricing = await calculatePrice(db, empresaId, [propiedad], startDate, endDate, allTarifas, canalPorDefectoId); //

            res.json(pricing); //
        } catch (error) { //
            console.error(`Error calculando precio para propiedad ${req.params.id} de empresa ${req.empresa?.id}:`, error); //
            res.status(500).json({ error: error.message || 'Error interno al calcular precio.' }); //
        }
    });

    // Ruta que muestra el formulario de checkout (sin cambios)
    router.get('/reservar', async (req, res) => { //
        try {
            const { propiedadId } = req.query; //
            const propiedad = await obtenerPropiedadPorId(db, req.empresa.id, propiedadId); //
            if (!propiedad) {
                return res.status(404).render('404', { title: 'Propiedad No Encontrada' });
            }

            res.render('reservar', { //
                title: `Completar Reserva | ${req.empresa.nombre}`, //
                propiedad, //
                query: req.query //
            });
        } catch (error) {
            console.error(`Error al mostrar página de reserva para empresa ${req.empresa.id}:`, error);
            res.status(500).render('404', { title: 'Error', message: 'Error al cargar la página de reserva.' });
        }
    });

    // Ruta de acción para crear la reserva (sin cambios)
    router.post('/reservar', express.urlencoded({ extended: true }), async (req, res) => { //
         try {
            const reserva = await crearReservaPublica(db, req.empresa.id, req.body); //
            // Redirigir a la página de confirmación con el ID de la reserva creada
            res.redirect(`/confirmacion/${reserva.idReservaCanal}`); // Usar idReservaCanal
        } catch (error) {
            console.error(`Error al crear reserva para empresa ${req.empresa.id}:`, error);
            res.status(500).render('404', { title: 'Error', message: 'Hubo un error al procesar tu reserva.' });
        }
    });

    // Página de confirmación (modificada para buscar reserva y cliente)
    router.get('/confirmacion/:reservaId', async (req, res) => { //
        try {
            const empresaId = req.empresa.id;
            const reservaId = req.params.reservaId; // ID del documento de reserva

            // Buscar la reserva por su ID de documento
            const reservaSnap = await db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId).get(); //

            if (!reservaSnap || !reservaSnap.exists) {
                 return res.status(404).render('404', { title: 'Reserva No Encontrada'});
            }

            const reservaData = reservaSnap.data(); //
            // Buscar al cliente usando el clienteId almacenado en la reserva
            const clienteSnap = await db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get(); //
            const cliente = clienteSnap.exists ? clienteSnap.data() : {}; //

            res.render('confirmacion', { //
                title: `Reserva Confirmada | ${req.empresa.nombre}`, //
                reserva: { id: reservaSnap.id, ...reservaData }, // Pasar datos completos de la reserva encontrada
                cliente: cliente // Pasar datos del cliente
            }); //
        } catch (error) {
            console.error(`Error mostrando confirmación ${req.params.reservaId} para empresa ${req.empresa.id}:`, error);
            res.status(500).render('404', { title: 'Error', message: 'Error al cargar la confirmación.' });
        }
    });


    // Ruta de Contacto (Ejemplo simple, asume una plantilla contacto.ejs)
    router.get('/contacto', (req, res) => {
        // La plantilla 'contacto.ejs' necesitará usar `empresa` (disponible vía res.locals)
        res.render('contacto', {
             title: `Contacto | ${req.empresa.nombre}`
             // No es necesario pasar 'empresa' explícitamente si está en res.locals
        });
    });


    // Manejador de 404 específico para este router (si ninguna ruta anterior coincide)
    router.use((req, res) => {
        res.status(404).render('404', { //
            title: 'Página no encontrada' //
            // 'empresa' ya está disponible en res.locals
        }); //
    });

    return router;
};