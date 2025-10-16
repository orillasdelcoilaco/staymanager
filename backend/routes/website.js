// backend/routes/website.js
const express = require('express');
const { getAvailabilityData, calculatePrice } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');

module.exports = (db) => {
    const router = express.Router();

    // Middleware para todas las rutas de este router
    router.use((req, res, next) => {
        if (!req.empresa) {
            return next('router'); 
        }
        res.locals.empresa = req.empresa; // Hacer que la empresa esté disponible en todas las plantillas
        next();
    });

    // Ruta principal (Home)
    router.get('/', async (req, res) => {
        try {
            const { fechaLlegada, fechaSalida, personas } = req.query;
            let propiedadesAMostrar = [];
            let isSearchResult = false;

            if (fechaLlegada && fechaSalida && personas) {
                isSearchResult = true;
                const startDate = new Date(fechaLlegada + 'T00:00:00Z');
                const endDate = new Date(fechaSalida + 'T00:00:00Z');
                const { availableProperties } = await getAvailabilityData(db, req.empresa.id, startDate, endDate);
                
                propiedadesAMostrar = availableProperties.filter(p => p.capacidad >= parseInt(personas));

            } else {
                propiedadesAMostrar = await obtenerPropiedadesPorEmpresa(db, req.empresa.id);
            }

            res.render('home', {
                title: req.empresa.nombre,
                description: req.empresa.slogan || `Las mejores propiedades en ${req.empresa.nombre}`,
                propiedades: propiedadesAMostrar,
                isSearchResult: isSearchResult,
                query: req.query
            });
        } catch (error) {
            console.error(`Error al renderizar el home para ${req.empresa.id}:`, error);
            res.status(500).send("Error al cargar la página.");
        }
    });

    // Ruta de detalle de propiedad
    router.get('/propiedad/:id', async (req, res) => {
        try {
            const propiedad = await obtenerPropiedadPorId(db, req.empresa.id, req.params.id);
            if (!propiedad) {
                return res.status(404).send('Propiedad no encontrada');
            }
            res.render('propiedad', {
                title: `${propiedad.nombre} | ${req.empresa.nombre}`,
                description: propiedad.descripcion ? propiedad.descripcion.substring(0, 155) : `Descubre ${propiedad.nombre}, una increíble propiedad.`,
                propiedad: propiedad,
                query: req.query // Pasar los parámetros de búsqueda a la vista
            });
        } catch (error) {
            console.error(`Error al renderizar la propiedad ${req.params.id}:`, error);
            res.status(500).send("Error al cargar la página de la propiedad.");
        }
    });
    
    // Ruta que muestra el formulario de checkout
    router.get('/reservar', async (req, res) => {
        try {
            const { propiedadId, fechaLlegada, fechaSalida, personas, noches, precioFinal } = req.query;
            const propiedad = await obtenerPropiedadPorId(db, req.empresa.id, propiedadId);
            if (!propiedad) {
                return res.status(404).send('Propiedad no encontrada');
            }

            res.render('reservar', {
                title: `Completar Reserva | ${req.empresa.nombre}`,
                propiedad,
                query: req.query
            });
        } catch (error) {
            console.error('Error al mostrar la página de reserva:', error);
            res.status(500).send("Error al cargar la página de reserva.");
        }
    });


    // --- RUTAS DE API PARA EL FLUJO DE RESERVA ---

    router.post('/propiedad/:id/calcular-precio', express.json(), async (req, res) => {
        try {
            const { fechaLlegada, fechaSalida } = req.body;
            const propiedad = await obtenerPropiedadPorId(db, req.empresa.id, req.params.id);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

            const startDate = new Date(fechaLlegada + 'T00:00:00Z');
            const endDate = new Date(fechaSalida + 'T00:00:00Z');

            const { allTarifas } = await getAvailabilityData(db, req.empresa.id, startDate, endDate);
            
            const canales = await db.collection('empresas').doc(req.empresa.id).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
            if (canales.empty) throw new Error('No hay canal por defecto configurado.');
            const canalPorDefectoId = canales.docs[0].id;
            
            const pricing = await calculatePrice(db, req.empresa.id, [propiedad], startDate, endDate, allTarifas, canalPorDefectoId);
            
            res.json(pricing);
        } catch (error) {
            console.error('Error calculando precio:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/reservar', express.urlencoded({ extended: true }), async (req, res) => {
        try {
            const reserva = await crearReservaPublica(db, req.empresa.id, req.body);
            res.redirect(`/confirmacion/${reserva.id}`);
        } catch (error) {
            console.error('Error al crear la reserva:', error);
            res.status(500).send('Hubo un error al procesar tu reserva.');
        }
    });

    router.get('/confirmacion/:reservaId', async (req, res) => {
        try {
            const reservaSnap = await db.collection('empresas').doc(req.empresa.id).collection('reservas').doc(req.params.reservaId).get();
            if (!reservaSnap.exists) return res.status(404).send('Reserva no encontrada.');

            const clienteSnap = await db.collection('empresas').doc(req.empresa.id).collection('clientes').doc(reservaSnap.data().clienteId).get();
            const cliente = clienteSnap.exists ? clienteSnap.data() : {};

            res.render('confirmacion', {
                title: `Reserva Confirmada | ${req.empresa.nombre}`,
                reserva: { id: reservaSnap.id, ...reservaSnap.data() },
                cliente: cliente
            });
        } catch (error) {
            console.error('Error mostrando confirmación:', error);
            res.status(500).send('Error al cargar la confirmación.');
        }
    });

    return router;
};