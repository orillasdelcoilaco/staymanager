// backend/routes/website.js
const express = require('express');
const { getAvailabilityData, calculatePrice } = require('../services/propuestasService');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { crearReservaPublica } = require('../services/reservasService');
const { obtenerEmpresaPorDominio, obtenerDetallesEmpresa } = require('../services/empresaService'); // Importar
const { obtenerReservaPorId } = require('../services/reservasService'); // Importar
const admin = require('firebase-admin');

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
        res.locals.empresa = req.empresa;
        next();
    });

    // Ruta principal (Home)
    router.get('/', async (req, res) => {
        try {
            const { empresa } = req;
            const empresaId = empresa.id;
            const { fechaLlegada, fechaSalida, personas } = req.query;

            let propiedadesAMostrar = [];
            let isSearchResult = false;

            if (fechaLlegada && fechaSalida && personas) {
                isSearchResult = true;
                const startDate = new Date(fechaLlegada + 'T00:00:00Z');
                const endDate = new Date(fechaSalida + 'T00:00:00Z');
                
                // getAvailabilityData ya filtra por propiedades con tarifa
                const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
                
                // *** INICIO CORRECCIÓN P3 ***
                // Filtrar solo las que están listadas Y cumplen capacidad
                propiedadesAMostrar = availableProperties
                    .filter(p => p.googleHotelData && p.googleHotelData.isListed === true)
                    .filter(p => p.capacidad >= parseInt(personas));
                // *** FIN CORRECCIÓN P3 ***

            } else {
                // Obtener todas las propiedades
                const todasLasPropiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
                
                // *** INICIO CORRECCIÓN P3 ***
                // Filtrar solo las que están marcadas para listarse
                propiedadesAMostrar = todasLasPropiedades.filter(p => p.googleHotelData && p.googleHotelData.isListed === true);
                // *** FIN CORRECCIÓN P3 ***
            }

            res.render('home', {
                title: empresa.websiteSettings?.seo?.homeTitle || empresa.nombre,
                description: empresa.websiteSettings?.seo?.homeDescription || `Reservas en ${empresa.nombre}`,
                empresa: empresa,
                propiedades: propiedadesAMostrar,
                isSearchResult: isSearchResult,
                query: req.query
            });
        } catch (error) {
            console.error(`Error al renderizar el home para ${req.empresa.id}:`, error);
            res.status(500).render('404', { 
                title: 'Error', 
                empresa: req.empresa || { nombre: "Error" } 
            });
        }
    });

    // Ruta de detalle de propiedad
    router.get('/propiedad/:id', async (req, res) => {
        try {
            const { empresa } = req;
            const empresaId = empresa.id;
            const propiedadId = req.params.id;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);

            if (!propiedad) {
                return res.status(404).render('404', { 
                    title: 'Propiedad No Encontrada', 
                    empresa 
                });
            }

            // *** INICIO CORRECCIÓN P3 ***
            // Opcional: Redirigir si la propiedad no está listada
            if (!propiedad.googleHotelData || !propiedad.googleHotelData.isListed) {
                 return res.status(404).render('404', { 
                    title: 'Propiedad No Disponible', 
                    empresa 
                });
            }
            // *** FIN CORRECCIÓN P3 ***

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
            console.error(`Error al renderizar la propiedad ${req.params.id} para ${req.empresa.id}:`, error);
            res.status(500).render('404', { 
                title: 'Error', 
                empresa: req.empresa || { nombre: "Error" } 
            });
        }
    });

    // Ruta API interna para calcular precio
    router.post('/propiedad/:id/calcular-precio', express.json(), async (req, res) => {
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

    // Ruta que muestra el formulario de checkout
    router.get('/reservar', async (req, res) => {
        try {
            const empresaId = req.empresa.id;
            const { propiedadId } = req.query;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) {
                return res.status(404).render('404', { 
                    title: 'Propiedad No Encontrada',
                    empresa: req.empresa
                });
            }

            res.render('reservar', {
                title: `Completar Reserva | ${req.empresa.nombre}`,
                propiedad,
                query: req.query,
                empresa: req.empresa
            });
        } catch (error) {
            console.error(`Error al mostrar página de reserva para empresa ${req.empresa.id}:`, error);
            res.status(500).render('404', { 
                title: 'Error', 
                empresa: req.empresa || { nombre: "Error" } 
            });
        }
    });

    // Ruta de acción para crear la reserva
    router.post('/reservar', express.urlencoded({ extended: true }), async (req, res) => {
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
            res.status(500).render('404', { 
                title: 'Error de Reserva', 
                empresa: req.empresa || { nombre: "Error" } 
            });
        }
    });

    // Página de confirmación
    router.get('/confirmacion', async (req, res) => {
        try {
            const empresaId = req.empresa.id;
            const reservaIdOriginal = req.query.reservaId; // Este es el idReservaCanal

            if (!reservaIdOriginal) {
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: req.empresa});
            }
            
            // Buscar la reserva usando el idReservaCanal
            const reservaSnap = await db.collection('empresas').doc(empresaId).collection('reservas')
                                      .where('idReservaCanal', '==', reservaIdOriginal)
                                      .limit(1)
                                      .get();
            
            if (reservaSnap.empty) {
                 return res.status(404).render('404', { title: 'Reserva No Encontrada', empresa: req.empresa});
            }
            
            const reservaData = reservaSnap.docs[0].data();
            
            // Cargar cliente (usando el servicio que ya existe)
            const cliente = await db.collection('empresas').doc(empresaId).collection('clientes').doc(reservaData.clienteId).get();

            res.render('confirmacion', {
                title: `Reserva Confirmada | ${req.empresa.nombre}`,
                reserva: reservaData,
                cliente: cliente.exists ? cliente.data() : { nombre: "Cliente" }
            });
        } catch (error) {
            console.error(`Error mostrando confirmación ${req.query.reservaId}:`, error);
            res.status(500).render('404', { 
                title: 'Error', 
                empresa: req.empresa || { nombre: "Error" } 
            });
        }
    });


    // Ruta de Contacto (Ejemplo simple, asume una plantilla contacto.ejs)
    router.get('/contacto', (req, res) => {
        res.render('contacto', {
             title: `Contacto | ${req.empresa.nombre}`
        });
    });


    // Manejador de 404 específico para este router (si ninguna ruta anterior coincide)
    router.use((req, res) => {
        res.status(404).render('404', {
            title: 'Página no encontrada'
        });
    });

    return router;
};