// backend/routes/website.js
const express = require('express');
const { getAvailabilityData, calculatePrice } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');

module.exports = (db) => {
    const router = express.Router();

    // Middleware para asegurar que la empresa está disponible en las plantillas
    router.use((req, res, next) => {
        res.locals.empresa = req.empresa;
        next();
    });

    // ... (rutas GET '/', GET '/propiedad/:id', GET '/reservar', etc. se mantienen igual)
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

    router.get('/propiedad/:id', async (req, res) => {
        try {
            const propiedad = await obtenerPropiedadPorId(db, req.empresa.id, req.params.id);
            if (!propiedad) {
                return res.status(404).render('404', { title: 'No Encontrado' });
            }
            res.render('propiedad', {
                title: `${propiedad.nombre} | ${req.empresa.nombre}`,
                description: propiedad.descripcion ? propiedad.descripcion.substring(0, 155) : `Descubre ${propiedad.nombre}, una increíble propiedad.`,
                propiedad: propiedad,
                query: req.query
            });
        } catch (error) {
            console.error(`Error al renderizar la propiedad ${req.params.id}:`, error);
            res.status(500).send("Error al cargar la página de la propiedad.");
        }
    });
    
    router.get('/reservar', async (req, res) => {
        try {
            const { propiedadId } = req.query;
            const propiedad = await obtenerPropiedadPorId(db, req.empresa.id, propiedadId);
            if (!propiedad) {
                return res.status(404).render('404', { title: 'No Encontrado' });
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

    router.post('/propiedad/:id/calcular-precio', express.json(), async (req, res) => {
        // ... (código sin cambios)
    });

    router.post('/reservar', express.urlencoded({ extended: true }), async (req, res) => {
        // ... (código sin cambios)
    });

    router.get('/confirmacion/:reservaId', async (req, res) => {
        // ... (código sin cambios)
    });

    // **NUEVO: Manejador de 404 para el sitio público**
    router.use((req, res) => {
        res.status(404).render('404', {
            title: 'Página no encontrada'
        });
    });

    return router;
};