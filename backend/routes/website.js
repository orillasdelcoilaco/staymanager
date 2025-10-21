// backend/routes/website.js
const express = require('express');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
// CORRECCIÓN: Importar servicios correctos para crear reserva pública
const { crearReservaPublica } = require('../services/reservasService');
const { getAvailabilityData, calculatePrice } = require('../services/propuestasService');
const admin = require('firebase-admin'); // Necesario para Timestamp si se usa

// Función auxiliar para formatear fechas
const formatDateForInput = (date) => {
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

    // Middleware para asegurar que req.empresa existe y añadirlo a locals
    router.use((req, res, next) => {
        if (!req.empresa) {
            return next('router');
        }
        res.locals.empresa = req.empresa; // Hacer 'empresa' disponible en EJS
        next();
    });

    // Ruta Principal (Home)
    router.get('/', async (req, res) => {
        try {
            // *** CORRECCIÓN 1: Obtener empresaId desde req.empresa ***
            const { empresa } = req; // Obtener el objeto empresa completo
            const empresaId = empresa.id; // Extraer el ID
            // *** FIN CORRECCIÓN 1 ***
            const { fechaLlegada, fechaSalida, personas } = req.query;

            let propiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
            let isSearchResult = false;

            // Lógica de búsqueda (sin cambios, ya usa getAvailabilityData)
            if (fechaLlegada && fechaSalida && personas) {
                 isSearchResult = true;
                 const startDate = new Date(fechaLlegada + 'T00:00:00Z');
                 const endDate = new Date(fechaSalida + 'T00:00:00Z');
                 // Usar getAvailabilityData que maneja la lógica de disponibilidad compleja
                 const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
                 propiedades = availableProperties.filter(p => p.capacidad >= parseInt(personas));
            }


            res.render('home', {
                // Usar datos SEO guardados si existen
                title: empresa.websiteSettings?.seo?.homeTitle || empresa.nombre,
                description: empresa.websiteSettings?.seo?.homeDescription || `Reservas en ${empresa.nombre}`,
                empresa: empresa, // Pasar objeto empresa completo
                propiedades: propiedades,
                isSearchResult: isSearchResult,
                query: req.query
            });
        } catch (error) {
            console.error("Error en GET /:", error);
            // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
            res.status(500).render('404', {
                title: 'Error Interno', // Añadir un título genérico
                empresa: req.empresa || { nombre: "Error" }
            });
            // *** FIN CORRECCIÓN 2 ***
        }
    });

    // Ruta Página de Propiedad
    router.get('/propiedad/:id', async (req, res) => {
        try {
            // *** CORRECCIÓN 1: Obtener empresaId desde req.empresa ***
            const { empresa } = req;
            const empresaId = empresa.id;
            // *** FIN CORRECCIÓN 1 ***
            const { id } = req.params;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, id);

            if (!propiedad) {
                // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
                return res.status(404).render('404', {
                     title: 'Propiedad No Encontrada',
                     empresa
                });
                // *** FIN CORRECCIÓN 2 ***
            }

            // Lógica de Prefill (sin cambios)
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

            res.render('propiedad', {
                // El título y descripción ya usaban la descripción IA
                title: `${propiedad.nombre} | ${empresa.nombre}`,
                description: (propiedad.websiteData?.aiDescription || propiedad.descripcion || `Descubre ${propiedad.nombre}`).substring(0, 155),
                propiedad: propiedad,
                empresa: empresa,
                prefill: {
                    fechaLlegada: checkinDate ? formatDateForInput(checkinDate) : '',
                    fechaSalida: checkoutDate ? formatDateForInput(checkoutDate) : '',
                    personas: numAdults
                }
            });
        } catch (error) {
            console.error(`Error en GET /propiedad/${req.params.id}:`, error);
            // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
            res.status(500).render('404', {
                title: 'Error Interno',
                empresa: req.empresa || { nombre: "Error" }
            });
            // *** FIN CORRECCIÓN 2 ***
        }
    });

    // API para Calcular Precio (usada por booking.js)
    router.post('/propiedad/:id/calcular-precio', async (req, res) => {
        try {
            // *** CORRECCIÓN 1: Obtener empresaId desde req.empresa ***
            const { empresa } = req;
            const empresaId = empresa.id;
            // *** FIN CORRECCIÓN 1 ***
            const { id } = req.params;
            const { fechaLlegada, fechaSalida } = req.body;

            const propiedad = await obtenerPropiedadPorId(db, empresaId, id);
            if (!propiedad) return res.status(404).json({ error: 'Propiedad no encontrada' });

            const startDate = new Date(fechaLlegada + 'T00:00:00Z');
            const endDate = new Date(fechaSalida + 'T00:00:00Z');

            // Obtener tarifas y canal por defecto
            const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
            const allTarifas = tarifasSnapshot.docs.map(doc => {
                 const data = doc.data();
                 const inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : new Date(data.fechaInicio + 'T00:00:00Z');
                 const termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : new Date(data.fechaTermino + 'T00:00:00Z');
                 return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
            });

            const canales = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
            if (canales.empty) throw new Error(`No hay canal por defecto configurado para la empresa ${empresaId}.`);
            const canalPorDefectoId = canales.docs[0].id;

            // Usar calculatePrice de propuestasService (que maneja modificadores y moneda)
            const pricing = await calculatePrice(db, empresaId, [propiedad], startDate, endDate, allTarifas, canalPorDefectoId);

            // Devolver solo lo necesario para el frontend público
            res.status(200).json({
                nights: pricing.nights,
                totalPriceCLP: pricing.totalPriceCLP // Siempre devolvemos CLP
            });
        } catch (error) {
            console.error(`Error en POST /calcular-precio/${req.params.id}:`, error);
            res.status(500).json({ error: error.message || 'Error al calcular el precio.' });
        }
    });

    // Mostrar página de Checkout
    router.get('/reservar', async (req, res) => {
        try {
             // *** CORRECCIÓN 1: Obtener empresaId desde req.empresa ***
            const { empresa } = req;
            const empresaId = empresa.id;
            // *** FIN CORRECCIÓN 1 ***
            const { propiedadId } = req.query;

            if (!propiedadId) {
                // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
                return res.status(400).render('404', { empresa, title: "Falta Propiedad" });
            }

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) {
                 // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
                return res.status(404).render('404', { empresa, title: "Propiedad No Encontrada" });
            }

            res.render('reservar', {
                empresa,
                propiedad,
                query: req.query
            });

        } catch (error) {
            console.error("Error en GET /reservar:", error);
             // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
            res.status(500).render('404', {
                title: 'Error Interno',
                empresa: req.empresa || { nombre: "Error" }
            });
        }
    });

    // Crear la reserva (Endpoint Público)
    router.post('/crear-reserva-publica', async (req, res) => {
        try {
            // *** CORRECCIÓN 1: Obtener empresaId desde req.empresa ***
            // Nota: Aquí req.empresa no está disponible porque es una ruta API sin el middleware tenantResolver aplicado directamente.
            // Necesitamos una forma de identificar la empresa. Podríamos pasarla en el body o buscarla por dominio si es necesario.
            // POR AHORA: Asumiremos que el frontend podría enviar el empresaId o lo deducimos de alguna manera.
            // Para simplificar, vamos a requerir que el frontend lo envíe o usar un ID fijo para pruebas.
             // SOLUCIÓN TEMPORAL: Usar un ID fijo o extraerlo de alguna parte.
             // MEJOR SOLUCIÓN: El frontend debería incluir el empresaId en el payload.
             // OTRA SOLUCIÓN: Volver a buscar la empresa por el dominio desde donde se hizo el POST.
             // Elegiremos la última por simplicidad ahora.
            const hostname = req.hostname;
            const empresaTemp = await obtenerEmpresaPorDominio(db, hostname);
            if (!empresaTemp) {
                 return res.status(500).json({ error: 'No se pudo identificar la empresa para esta reserva.' });
            }
            const empresaId = empresaTemp.id;
            // *** FIN CORRECCIÓN 1 ***

            // Usar la función importada crearReservaPublica
            const nuevaReserva = await crearReservaPublica(db, empresaId, req.body);

            // Responder al frontend con éxito y el ID de la reserva
            res.status(201).json({ reservaId: nuevaReserva.id }); // Usar el ID del documento

        } catch (error) {
            console.error("Error en POST /crear-reserva-publica:", error);
            // Devolver un error específico si es por disponibilidad
            if (error.message.includes('no están disponibles')) {
                return res.status(409).json({ error: error.message }); // 409 Conflict
            }
            res.status(500).json({ error: 'Error interno al procesar la reserva.' });
        }
    });

    // Página de Confirmación
    router.get('/confirmacion', async (req, res) => {
        try {
             // *** CORRECCIÓN 1: Obtener empresaId desde req.empresa ***
            const { empresa } = req;
            const empresaId = empresa.id;
            // *** FIN CORRECCIÓN 1 ***
            const { reservaId } = req.query; // Usar el ID del documento pasado por query

            if (!reservaId) {
                 // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
                 return res.status(400).render('404', { empresa, title: 'Falta ID de Reserva' });
            }

            // Cargar la reserva usando obtenerReservaPorId (que ya carga el cliente)
            const reservaCompleta = await obtenerReservaPorId(db, empresaId, reservaId);
            if (!reservaCompleta) {
                 // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
                 return res.status(404).render('404', { empresa, title: 'Reserva No Encontrada' });
            }

            res.render('confirmacion', {
                // *** CORRECCIÓN 2: Añadir 'title' ***
                title: `Reserva Confirmada | ${empresa.nombre}`,
                empresa,
                reserva: reservaCompleta, // Pasar el objeto completo con cliente anidado
                cliente: reservaCompleta.cliente // Pasar cliente también al nivel superior por si acaso
            });

        } catch (error) {
             console.error("Error en GET /confirmacion:", error);
              // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
             res.status(500).render('404', {
                title: 'Error Interno',
                empresa: req.empresa || { nombre: "Error" }
             });
        }
    });

    // Ruta de Contacto (sin cambios)
     router.get('/contacto', (req, res) => {
        res.render('contacto', {
             title: `Contacto | ${req.empresa.nombre}`,
             empresa: req.empresa // Pasar empresa explícitamente
        });
    });


    // Manejador 404 específico para este router (si ninguna ruta anterior coincide)
    router.use((req, res) => {
        // *** CORRECCIÓN 2: Añadir 'title' al renderizar 404 ***
        res.status(404).render('404', {
            title: 'Página no encontrada',
            empresa: req.empresa || { nombre: "Página no encontrada" } // Asegurar que empresa exista
        });
    });


    return router;
};