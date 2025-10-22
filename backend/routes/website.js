// backend/routes/website.js
const express = require('express');
const { getAvailabilityData, calculatePrice } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');
// *** CAMBIO: Asegurarse de importar obtenerDetallesEmpresa ***
const { obtenerEmpresaPorDominio, obtenerDetallesEmpresa } = require('../services/empresaService');
const { obtenerReservaPorId } = require('../services/reservasService');
const admin = require('firebase-admin');

// Función auxiliar para formatear fechas (sin cambios)
const formatDateForInput = (date) => {
    // ... (código existente sin cambios)
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

module.exports = (db) => {
    const router = express.Router();

    // Middleware para asegurar que req.empresa existe (sin cambios)
    router.use((req, res, next) => {
        if (!req.empresa) {
            // Si el tenantResolver no encontró empresa, no continuamos en este router.
            // El flujo debería pasar al siguiente middleware/ruta (que sirve la SPA).
            return next('router');
        }
        // No adjuntamos a locals aquí, lo hacemos en la ruta específica tras cargar detalles.
        next();
    });

    // Ruta principal (Home)
    router.get('/', async (req, res) => {
        try {
            // *** CAMBIO: Obtener detalles completos de la empresa ***
            const empresaId = req.empresa.id; // Obtenido por el tenantResolver
            const empresaCompleta = await obtenerDetallesEmpresa(db, empresaId); // Carga TODO, incluyendo websiteSettings
            // *** FIN CAMBIO ***

            const { fechaLlegada, fechaSalida, personas } = req.query;

            let propiedadesAMostrar = [];
            let isSearchResult = false;

            if (fechaLlegada && fechaSalida && personas) {
                // ... (lógica de búsqueda existente sin cambios)
                isSearchResult = true;
                const startDate = new Date(fechaLlegada + 'T00:00:00Z');
                const endDate = new Date(fechaSalida + 'T00:00:00Z');
                const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
                propiedadesAMostrar = availableProperties
                    .filter(p => p.googleHotelData && p.googleHotelData.isListed === true)
                    .filter(p => p.capacidad >= parseInt(personas));
            } else {
                // ... (lógica para mostrar todas las listadas existente sin cambios)
                const todasLasPropiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
                propiedadesAMostrar = todasLasPropiedades.filter(p => p.googleHotelData && p.googleHotelData.isListed === true);
            }

            // *** CAMBIO: Pasar la empresaCompleta a la plantilla ***
            res.render('home', {
                title: empresaCompleta.websiteSettings?.seo?.homeTitle || empresaCompleta.nombre,
                description: empresaCompleta.websiteSettings?.seo?.homeDescription || `Reservas en ${empresaCompleta.nombre}`,
                empresa: empresaCompleta, // Usar el objeto completo
                propiedades: propiedadesAMostrar,
                isSearchResult: isSearchResult,
                query: req.query
            });
            // *** FIN CAMBIO ***
        } catch (error) {
            console.error(`Error al renderizar el home para ${req.empresa?.id || 'ID Desconocido'}:`, error);
            // *** CAMBIO: Usar req.empresa como fallback si empresaCompleta falla antes ***
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresa || { nombre: "Error Interno" }
            });
            // *** FIN CAMBIO ***
        }
    });

    // Ruta de detalle de propiedad (Asegurarse de cargar empresa completa también)
    router.get('/propiedad/:id', async (req, res) => {
        try {
            // *** CAMBIO: Obtener detalles completos de la empresa ***
            const empresaId = req.empresa.id;
            const empresaCompleta = await obtenerDetallesEmpresa(db, empresaId);
            // *** FIN CAMBIO ***

            const propiedadId = req.params.id;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);

            if (!propiedad || !propiedad.googleHotelData || !propiedad.googleHotelData.isListed) {
                return res.status(404).render('404', {
                    title: 'Propiedad No Encontrada',
                    // *** CAMBIO: Pasar empresaCompleta ***
                    empresa: empresaCompleta
                });
            }

            // ... (lógica de prefill existente sin cambios) ...
            let checkinDate = null;
            let checkoutDate = null;
            let numAdults = req.query.personas || '';

            if (req.query.checkin && req.query.nights) {
                 try {
                     checkinDate = new Date(req.query.checkin);
                     checkoutDate = new Date(checkinDate);
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


            // *** CAMBIO: Pasar empresaCompleta ***
            res.render('propiedad', {
                title: `${propiedad.nombre} | ${empresaCompleta.nombre}`,
                description: (propiedad.websiteData?.aiDescription || propiedad.descripcion || `Descubre ${propiedad.nombre}`).substring(0, 155),
                propiedad: propiedad,
                empresa: empresaCompleta,
                prefill: {
                    fechaLlegada: checkinDate ? formatDateForInput(checkinDate) : '',
                    fechaSalida: checkoutDate ? formatDateForInput(checkoutDate) : '',
                    personas: numAdults
                }
            });
            // *** FIN CAMBIO ***
        } catch (error) {
            console.error(`Error al renderizar la propiedad ${req.params.id} para ${req.empresa?.id || 'ID Desconocido'}:`, error);
             // *** CAMBIO: Usar req.empresa como fallback ***
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresa || { nombre: "Error Interno" }
            });
             // *** FIN CAMBIO ***
        }
    });

    // Ruta API interna para calcular precio (Sin cambios necesarios aquí)
    router.post('/propiedad/:id/calcular-precio', express.json(), async (req, res) => {
        // ... (código existente sin cambios) ...
         try {
            const empresaId = req.empresa.id;
            const propiedadId = req.params.id;
            const { fechaLlegada, fechaSalida } = req.body;

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

            const startDate = new Date(fechaLlegada + 'T00:00:00Z');
            const endDate = new Date(fechaSalida + 'T00:00:00Z');

            // Obtener tarifas
            const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
            const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 const inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
                 const termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
            });

            // Obtener canal por defecto
            const canales = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
            if (canales.empty) throw new Error(`No hay canal por defecto configurado para la empresa ${empresaId}.`);
            const canalPorDefectoId = canales.docs[0].id;

            const pricing = await calculatePrice(db, empresaId, [propiedad], startDate, endDate, allTarifas, canalPorDefectoId);

            res.json(pricing);
        } catch (error) {
            console.error(`Error calculando precio para propiedad ${req.params.id} de empresa ${req.empresa?.id}:`, error);
            res.status(500).json({ error: error.message || 'Error interno al calcular precio.' });
        }
    });

    // Ruta que muestra el formulario de checkout (Asegurarse de cargar empresa completa también)
    router.get('/reservar', async (req, res) => {
        try {
            // *** CAMBIO: Obtener detalles completos de la empresa ***
            const empresaId = req.empresa.id;
            const empresaCompleta = await obtenerDetallesEmpresa(db, empresaId);
             // *** FIN CAMBIO ***

            const { propiedadId } = req.query;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) {
                return res.status(404).render('404', {
                    title: 'Propiedad No Encontrada',
                    // *** CAMBIO: Pasar empresaCompleta ***
                    empresa: empresaCompleta
                });
            }

            // *** CAMBIO: Pasar empresaCompleta ***
            res.render('reservar', {
                title: `Completar Reserva | ${empresaCompleta.nombre}`,
                propiedad,
                query: req.query,
                empresa: empresaCompleta
            });
             // *** FIN CAMBIO ***
        } catch (error) {
            console.error(`Error al mostrar página de reserva para empresa ${req.empresa?.id}:`, error);
             // *** CAMBIO: Usar req.empresa como fallback ***
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresa || { nombre: "Error Interno" }
            });
            // *** FIN CAMBIO ***
        }
    });

    // Ruta de acción para crear la reserva (Sin cambios necesarios aquí respecto a datos de empresa)
    router.post('/reservar', express.urlencoded({ extended: true }), async (req, res) => {
        // ... (código existente sin cambios) ...
        // Ya usa obtenerEmpresaPorDominio, lo cual está bien para identificar la empresa
        // y crearReservaPublica internamente obtendrá lo que necesite.
         try {
            // Identificar empresa por hostname
            const hostname = req.hostname;
            const empresa = await obtenerEmpresaPorDominio(db, hostname);
            if (!empresa) {
                throw new Error('Empresa no identificada para la reserva.');
            }

            const reserva = await crearReservaPublica(db, empresa.id, req.body);
            // Redirigir a la página de confirmación
            // Usamos el idReservaCanal para la URL de cara al cliente
            res.redirect(`/confirmacion?reservaId=${reserva.idReservaCanal}`);
        } catch (error) {
            console.error(`Error al crear reserva:`, error);
            // Intentamos obtener req.empresa si existe para el renderizado del error
            const empresaFallback = req.empresa || await obtenerEmpresaPorDominio(db, req.hostname) || { nombre: "Error Interno" };
            res.status(500).render('404', {
                title: 'Error de Reserva',
                empresa: empresaFallback
            });
        }
    });

    // Página de confirmación (Asegurarse de cargar empresa completa también)
    router.get('/confirmacion', async (req, res) => {
        try {
            // *** CAMBIO: Obtener detalles completos de la empresa ***
            const empresaId = req.empresa.id;
            const empresaCompleta = await obtenerDetallesEmpresa(db, empresaId);
             // *** FIN CAMBIO ***

            const reservaIdOriginal = req.query.reservaId; // Este es el idReservaCanal

            if (!reservaIdOriginal) {
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta});
            }

            // ... (resto de la lógica existente sin cambios) ...
            const reservaSnap = await db.collection('empresas').doc(empresaId).collection('reservas')
                                      .where('idReservaCanal', '==', reservaIdOriginal)
                                      .limit(1)
                                      .get();

            if (reservaSnap.empty) {
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: empresaCompleta});
            }

            const reservaData = reservaSnap.docs[0].data();
            const cliente = await db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get();

             // *** CAMBIO: Pasar empresaCompleta ***
            res.render('confirmacion', {
                title: `Reserva Confirmada | ${empresaCompleta.nombre}`,
                reserva: reservaData,
                cliente: cliente.exists ? cliente.data() : { nombre: "Cliente" },
                empresa: empresaCompleta // Añadir empresa aquí
            });
             // *** FIN CAMBIO ***
        } catch (error) {
            console.error(`Error mostrando confirmación ${req.query.reservaId}:`, error);
             // *** CAMBIO: Usar req.empresa como fallback ***
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresa || { nombre: "Error Interno" }
            });
            // *** FIN CAMBIO ***
        }
    });


    // Ruta de Contacto (Asegurarse de cargar empresa completa también)
    router.get('/contacto', async (req, res) => { // Convertir a async
        try {
            // *** CAMBIO: Obtener detalles completos de la empresa ***
            const empresaId = req.empresa.id;
            const empresaCompleta = await obtenerDetallesEmpresa(db, empresaId);
             // *** FIN CAMBIO ***

            res.render('contacto', {
                 title: `Contacto | ${empresaCompleta.nombre}`,
                 // *** CAMBIO: Pasar empresaCompleta ***
                 empresa: empresaCompleta
            });
        } catch (error) {
            console.error(`Error al renderizar contacto para ${req.empresa?.id}:`, error);
            // *** CAMBIO: Usar req.empresa como fallback ***
            res.status(500).render('404', {
                title: 'Error',
                empresa: req.empresa || { nombre: "Error Interno" }
            });
             // *** FIN CAMBIO ***
        }
    });


    // Manejador de 404 (Asegurarse de cargar empresa completa también)
    router.use(async (req, res) => { // Convertir a async
        let empresaData = req.empresa;
        if (!empresaData) {
            // Intentar cargarla de nuevo si no se adjuntó por alguna razón
            try {
                empresaData = await obtenerEmpresaPorDominio(db, req.hostname);
            } catch (e) { /* Ignorar error y usar fallback */ }
        }
        res.status(404).render('404', {
            title: 'Página no encontrada',
            empresa: empresaData || { nombre: "Página no encontrada" }
        });
    });

    return router;
};