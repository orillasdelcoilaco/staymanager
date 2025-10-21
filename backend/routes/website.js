// backend/routes/website.js
const express = require('express');
const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/propiedadesService');
const { obtenerReservasPublicas } = require('../services/reservasService');
const { calcularPrecioDetallado } = require('../services/utils/calculoTarifaUtils');
const { obtenerTarifasParaRango } = require('../services/tarifasService');
const { crearClienteOEncontrarExistente } = require('../services/clientesService'); // Necesario
const { crearReserva } = require('../services/reservasService'); // Necesario
const { obtenerReservaPorId } = require('../services/reservasService'); // Necesario

// Esta función auxiliar determina la disponibilidad (simplificada)
async function verificarDisponibilidad(db, empresaId, propiedadId, fechaLlegada, fechaSalida) {
    const reservas = await obtenerReservasPublicas(db, empresaId, propiedadId, fechaLlegada, fechaSalida);
    // Si hay alguna reserva que se solape (excluyendo 'Anulada'), no está disponible
    return reservas.filter(r => r.estado !== 'Anulada').length === 0;
}

module.exports = (db) => {
    const router = express.Router();

    // Ruta Principal (Home)
    router.get('/', async (req, res) => {
        try {
            const { empresaId, empresa } = req;
            const { fechaLlegada, fechaSalida, personas } = req.query;

            let propiedades = await obtenerPropiedadesPorEmpresa(db, empresaId);
            let isSearchResult = false;

            if (fechaLlegada && fechaSalida) {
                isSearchResult = true;
                const disponibles = [];
                for (const prop of propiedades) {
                    const estaDisponible = await verificarDisponibilidad(db, empresaId, prop.id, fechaLlegada, fechaSalida);
                    if (estaDisponible) {
                        if (personas && parseInt(personas, 10) > prop.capacidad) {
                            continue; // Saltar si no cumple capacidad
                        }
                        disponibles.push(prop);
                    }
                }
                propiedades = disponibles;
            }

            res.render('home', {
                title: empresa.websiteSettings?.seo?.homeTitle || empresa.nombre,
                description: empresa.websiteSettings?.seo?.homeDescription || `Reservas en ${empresa.nombre}`,
                empresa: empresa,
                propiedades: propiedades,
                isSearchResult: isSearchResult,
                query: req.query
            });
        } catch (error) {
            console.error("Error en GET /:", error);
            res.status(500).render('404', { empresa: req.empresa || { nombre: "Error" } });
        }
    });

    // Ruta Página de Propiedad
    router.get('/propiedad/:id', async (req, res) => {
        try {
            const { empresaId, empresa } = req;
            const { id } = req.params;
            const propiedad = await obtenerPropiedadPorId(db, empresaId, id);

            if (!propiedad) {
                return res.status(404).render('404', { empresa });
            }

            // Prefill para el formulario
            const prefill = {
                fechaLlegada: req.query.fechaLlegada || '',
                fechaSalida: req.query.fechaSalida || '',
                personas: req.query.personas || ''
            };

            res.render('propiedad', {
                propiedad,
                empresa,
                prefill
            });
        } catch (error) {
            console.error(`Error en GET /propiedad/${req.params.id}:`, error);
            res.status(500).render('404', { empresa: req.empresa || { nombre: "Error" } });
        }
    });

    // API para Calcular Precio (usada por booking.js)
    router.post('/propiedad/:id/calcular-precio', async (req, res) => {
        try {
            const { empresaId } = req;
            const { id } = req.params;
            const { fechaLlegada, fechaSalida } = req.body;

            const noches = Math.round((new Date(fechaSalida) - new Date(fechaLlegada)) / (1000 * 60 * 60 * 24));
            if (noches <= 0) return res.status(400).json({ error: 'Rango de fechas inválido.' });

            const tarifas = await obtenerTarifasParaRango(db, empresaId, id, fechaLlegada, fechaSalida);
            const calculo = calcularPrecioDetallado(tarifas, noches, 0); // 0 comisión para web pública

            if (calculo.precioTotalCLP === 0) {
                 return res.status(404).json({ error: 'No hay tarifas disponibles para este período.' });
            }

            res.status(200).json({
                nights: noches,
                totalPriceCLP: calculo.precioTotalCLP
            });
        } catch (error) {
            console.error(`Error en POST /calcular-precio/${req.params.id}:`, error);
            res.status(500).json({ error: 'Error al calcular el precio.' });
        }
    });


    // --- NUEVA RUTA: Mostrar página de Checkout ---
    router.get('/reservar', async (req, res) => {
        try {
            const { empresaId, empresa } = req;
            const { propiedadId } = req.query;

            if (!propiedadId) {
                return res.status(400).render('404', { empresa, message: "No se especificó una propiedad." });
            }

            const propiedad = await obtenerPropiedadPorId(db, empresaId, propiedadId);
            if (!propiedad) {
                return res.status(404).render('404', { empresa, message: "Propiedad no encontrada." });
            }

            // Aquí podríamos re-verificar disponibilidad y precio si quisiéramos ser más robustos
            
            res.render('reservar', {
                empresa,
                propiedad,
                query: req.query // Pasamos todos los params (fechaLlegada, precioFinal, etc.)
            });

        } catch (error) {
            console.error("Error en GET /reservar:", error);
            res.status(500).render('404', { empresa: req.empresa || { nombre: "Error" } });
        }
    });

    // --- NUEVA RUTA: Crear la reserva (Endpoint Público) ---
    router.post('/crear-reserva-publica', async (req, res) => {
        try {
            const { empresaId } = req;
            const {
                nombre, email, telefono,
                propiedadId, fechaLlegada, fechaSalida, noches,
                personas, precioFinal, comentarios
            } = req.body;

            // 1. Validar disponibilidad (¡MUY IMPORTANTE!)
            const estaDisponible = await verificarDisponibilidad(db, empresaId, propiedadId, fechaLlegada, fechaSalida);
            if (!estaDisponible) {
                return res.status(409).json({ error: 'Lo sentimos, las fechas seleccionadas ya no están disponibles.' });
            }

            // 2. Crear o encontrar al cliente
            const clienteId = await crearClienteOEncontrarExistente(db, empresaId, {
                nombre,
                email,
                telefono
            });

            // 3. Crear la reserva
            const datosReserva = {
                propiedadId,
                clienteId,
                fechaLlegada,
                fechaSalida,
                totalHuespedes: parseInt(personas, 10),
                precioFinal: parseFloat(precioFinal),
                origen: 'website', // Marcar como reserva web
                estado: 'Pendiente', // Estado inicial para reservas web
                abono: 0,
                comentarios: comentarios || ''
            };

            const nuevaReserva = await crearReserva(db, empresaId, datosReserva);

            // 4. Responder al frontend con éxito
            res.status(201).json({ reservaId: nuevaReserva.id });

        } catch (error) {
            console.error("Error en POST /crear-reserva-publica:", error);
            res.status(500).json({ error: 'Error interno al procesar la reserva.' });
        }
    });

    // --- NUEVA RUTA: Página de Confirmación ---
    router.get('/confirmacion', async (req, res) => {
        try {
            const { empresaId, empresa } = req;
            const { reservaId } = req.query;

            // (Opcional pero recomendado) Cargar la reserva para mostrar datos
            let reserva = null;
            if (reservaId) {
                reserva = await obtenerReservaPorId(db, empresaId, reservaId);
            }
            
            res.render('confirmacion', {
                empresa,
                reserva // Puede ser null si no se encuentra, la vista debe manejarlo
            });

        } catch (error) {
             console.error("Error en GET /confirmacion:", error);
             res.status(500).render('404', { empresa: req.empresa || { nombre: "Error" } });
        }
    });


    return router;
};