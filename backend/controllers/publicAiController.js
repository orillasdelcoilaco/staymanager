const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/publicWebsiteService');
const { hydrateInventory, calcularCapacidad } = require('../services/propiedadLogicService');
const { getAvailabilityData } = require('../services/propuestasService');
const { obtenerCanalesPorEmpresa, crearCanal } = require('../services/canalesService');
const { calculatePrice } = require('../services/utils/calculoValoresService');
const { obtenerValorDolar } = require('../services/dolarService');
const { guardarOActualizarPropuesta } = require('../services/gestionPropuestasService');
const { crearPreferencia } = require('../services/mercadopagoService');
const { obtenerPlantillasPorEmpresa } = require('../services/plantillasService');
const { format, addDays, parseISO, isValid } = require('date-fns');

const sanitizeProperty = (property) => {
    if (!property) return null;

    // Destructure to exclude sensitive fields
    const {
        comision,
        costoLimpieza,
        costoLavanderia,
        datosBancarios,
        emailPropietario,
        telefonoPropietario,
        rutPropietario,
        contrato,
        notasInternas,
        ...safeData
    } = property;

    return safeData;
};

/**
 * Formats the response in the standard JSON structure.
 * @param {Object|Array} data - The data to return.
 * @returns {Object} - The formatted response.
 */
const formatResponse = (data) => {
    return {
        meta: {
            generated_at: new Date().toISOString(),
            api_version: "v1-public-ai",
            ai_verification_mode: true
        },
        data: data
    };
};

const getProperties = async (req, res) => {
    try {
        const targetEmpresaId = req.empresa?.id || req.params.empresaId;

        if (!targetEmpresaId) {
            return res.status(400).json({ error: "Empresa ID is required" });
        }

        const properties = await obtenerPropiedadesPorEmpresa(req.db, targetEmpresaId);

        // Filter properties based on query parameters
        const { capacidad, ubicacion } = req.query;

        let filteredProperties = properties;

        if (capacidad) {
            const minCapacidad = parseInt(capacidad, 10);
            if (!isNaN(minCapacidad)) {
                filteredProperties = filteredProperties.filter(p => (p.capacidad || 0) >= minCapacidad);
            }
        }

        if (ubicacion) {
            const ubicacionRegex = new RegExp(ubicacion, 'i'); // Case-insensitive partial match
            filteredProperties = filteredProperties.filter(p =>
                (p.ubicacionTexto && ubicacionRegex.test(p.ubicacionTexto)) ||
                (p.direccion && ubicacionRegex.test(p.direccion)) ||
                (p.nombre && ubicacionRegex.test(p.nombre)) // Also search in name for better UX
            );
        }

        const lightweightProperties = filteredProperties.map(p => ({
            id: p.id,
            nombre: p.nombre,
            fotoPrincipal: p.websiteData?.cardImage?.storagePath || p.fotoPrincipal || '',
            precioBase: p.precioBase || 0, // Note: This might need more complex pricing logic if dynamic
            capacidad: p.capacidad || 0,
            ubicacion: p.ubicacionTexto || ''
        }));

        res.json(formatResponse(lightweightProperties));
    } catch (error) {
        console.error("Error in getProperties:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const getPropertyDetail = async (req, res) => {
    try {
        const targetEmpresaId = req.empresa?.id || req.params.empresaId;
        const { id } = req.params;

        if (!targetEmpresaId) {
            return res.status(400).json({ error: "Empresa ID is required" });
        }

        const rawProperty = await obtenerPropiedadPorId(req.db, targetEmpresaId, id);

        if (!rawProperty) {
            return res.status(404).json({ error: "Property not found" });
        }

        // Hydrate inventory
        const aiContext = hydrateInventory(rawProperty.componentes || []);

        // Calculate capacity if not present or to ensure accuracy
        const calculatedCapacity = calcularCapacidad(rawProperty.componentes || []);

        // Semantic Summary Generation
        const currency = rawProperty.moneda || 'CLP';
        const rules = Array.isArray(rawProperty.reglas) ? rawProperty.reglas.join('. ') : (rawProperty.reglas || 'No specific rules.');

        const semanticSummary = `Tarifas en ${currency}. Reglas: ${rules}. Capacidad máxima: ${calculatedCapacity} personas.`;

        // Add summary to ai_context
        aiContext.semantic_summary = semanticSummary;
        aiContext.currency = currency;
        aiContext.house_rules = rawProperty.reglas || [];

        const sanitizedProperty = sanitizeProperty(rawProperty);

        // Transform images to rich objects
        let enrichedImages = [];
        if (rawProperty.websiteData && rawProperty.websiteData.images) {
            // websiteData.images is a Map-like object where keys are IDs or indices
            enrichedImages = Object.values(rawProperty.websiteData.images).map(img => ({
                url: img.storagePath || img.url || '',
                description: img.description || img.alt || '',
                tags: img.tags || [],
                category: img.category || 'general'
            })).filter(img => img.url); // Filter out invalid images
        } else if (Array.isArray(rawProperty.imagenes)) {
            // Fallback to legacy array
            enrichedImages = rawProperty.imagenes.map(url => ({
                url: url,
                description: '',
                tags: [],
                category: 'general'
            }));
        }

        const enrichedProperty = {
            ...sanitizedProperty,
            capacidadCalculada: calculatedCapacity,
            ai_context: aiContext,
            images: enrichedImages, // Override or add images field
            schema_type: "VacationRental" // Default, could be dynamic
        };

        res.json(formatResponse(enrichedProperty));
    } catch (error) {
        console.error("Error in getPropertyDetail:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const getPropertyCalendar = async (req, res) => {
    try {
        const targetEmpresaId = req.empresa?.id || req.params.empresaId;
        const { id } = req.params;

        // Default to next 30 days if not specified
        const startDate = new Date();
        const endDate = addDays(startDate, 60);

        if (!targetEmpresaId) {
            return res.status(400).json({ error: "Empresa ID is required" });
        }

        // Reuse getAvailabilityData but filter for specific property
        // Note: getAvailabilityData returns available properties. 
        // We might need to check the availabilityMap it returns.
        const { availabilityMap } = await getAvailabilityData(req.db, targetEmpresaId, startDate, endDate);

        const propertyAvailability = availabilityMap.get(id) || [];

        // Format for AI: List of busy ranges
        const busyRanges = propertyAvailability.map(range => ({
            start: format(range.start, 'yyyy-MM-dd'),
            end: format(range.end, 'yyyy-MM-dd'),
            status: "occupied"
        }));

        res.json(formatResponse({
            propertyId: id,
            queryStartDate: format(startDate, 'yyyy-MM-dd'),
            queryEndDate: format(endDate, 'yyyy-MM-dd'),
            busyRanges: busyRanges
        }));

    } catch (error) {
        console.error("Error in getPropertyCalendar:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const createBookingIntent = async (req, res) => {
    try {
        const targetEmpresaId = req.empresa?.id || req.params.empresaId;
        const { propiedadId, fechaLlegada, fechaSalida, personas, huesped } = req.body;

        if (!targetEmpresaId || !propiedadId || !fechaLlegada || !fechaSalida || !personas || !huesped) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
        const endDate = parseISO(fechaSalida + 'T00:00:00Z');

        if (!isValid(startDate) || !isValid(endDate)) {
            return res.status(400).json({ error: "Invalid dates." });
        }

        // 1. Ensure 'ia-reserva' channel exists
        let canales = await obtenerCanalesPorEmpresa(req.db, targetEmpresaId);
        let iaChannel = canales.find(c => c.nombre === 'ia-reserva');

        if (!iaChannel) {
            console.log("[Booking Intent] Creating 'ia-reserva' channel...");
            iaChannel = await crearCanal(req.db, targetEmpresaId, {
                nombre: 'ia-reserva',
                tipo: 'Directo',
                comision: 0,
                origen: 'ia',
                moneda: 'CLP', // Default to CLP
                color: '#8e44ad' // Purple for AI
            });
        }

        if (!iaChannel || !iaChannel.id) {
            throw new Error("Failed to obtain ia-reserva channel ID. Channel object is invalid.");
        }

        // 2. Calculate Price
        const tarifasSnapshot = await req.db.collection('empresas').doc(targetEmpresaId).collection('tarifas').get();
        const allTarifas = tarifasSnapshot.docs.map(doc => {
            const data = doc.data();
            let inicio = null, termino = null;
            try {
                inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : (data.fechaInicio ? parseISO(data.fechaInicio + 'T00:00:00Z') : null);
                termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : (data.fechaTermino ? parseISO(data.fechaTermino + 'T00:00:00Z') : null);
            } catch (e) { return null; }
            return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
        }).filter(Boolean);

        const valorDolarDia = await obtenerValorDolar(req.db, targetEmpresaId, startDate);

        // Fetch property details for name
        const rawProperty = await obtenerPropiedadPorId(req.db, targetEmpresaId, propiedadId);
        const propertyName = rawProperty ? rawProperty.nombre : 'Propiedad';
        const propertyObj = { id: propiedadId, nombre: propertyName };

        const pricing = await calculatePrice(req.db, targetEmpresaId, [propertyObj], startDate, endDate, allTarifas, iaChannel.id, valorDolarDia, false);

        if (pricing.totalPriceCLP === 0 && pricing.nights > 0) {
            console.warn("[Booking Intent] Price calculated as 0. Check tariffs.");
        }

        // 3. Financial Model (10/90 Rule)
        const totalEstadia = pricing.totalPriceCLP;
        const montoSeña = Math.round(totalEstadia * 0.10);
        const saldoPendiente = totalEstadia - montoSeña;

        // Generate ID manually to break circular dependency
        const reservaId = req.db.collection('empresas').doc(targetEmpresaId).collection('reservas').doc().id;

        // 5. Generate Payment Link (BEFORE saving proposal)
        const paymentLink = await crearPreferencia(targetEmpresaId, reservaId, `Reserva 10%: ${propiedadId}`, montoSeña, 'CLP');

        // Fetch Template
        const plantillas = await obtenerPlantillasPorEmpresa(req.db, targetEmpresaId);
        const plantilla = plantillas.find(p => p.nombre === 'Plantilla Predeterminada' && p.enviarPorEmail) || plantillas.find(p => p.enviarPorEmail);
        const plantillaId = plantilla ? plantilla.id : null;

        // 4. Create Proposal
        const proposalData = {
            idReservaCanal: reservaId, // Use generated ID
            fechaLlegada: fechaLlegada,
            fechaSalida: fechaSalida,
            propiedades: [propertyObj],
            canalId: iaChannel.id,
            canalNombre: iaChannel.nombre,
            cliente: {
                nombre: huesped.nombre,
                email: huesped.email,
                telefono: huesped.telefono || ''
            },
            adultos: parseInt(personas) || 0,
            ninos: 0,
            estado: 'Propuesta',
            origen: 'ia-reserva',
            moneda: 'CLP',
            valorDolarDia: valorDolarDia || null,
            valorOriginal: totalEstadia || 0,
            valores: {
                valorHuesped: totalEstadia || 0,
                valorAnticipo: montoSeña || 0,
                saldoPendiente: saldoPendiente || 0
            },
            notas: "Reserva iniciada por IA.",
            enviarEmail: true,
            plantillaId: plantillaId,
            linkPago: paymentLink
        };

        await guardarOActualizarPropuesta(req.db, targetEmpresaId, 'ai-agent@system', proposalData);

        // 6. Response
        res.json(formatResponse({
            reserva_id: reservaId,
            estado: "Propuesta",
            desglose_financiero: {
                moneda: "CLP",
                total_estadia: totalEstadia,
                monto_a_pagar_ahora: montoSeña,
                saldo_al_checkin: saldoPendiente,
                porcentaje_seña: "10%"
            },
            link_pago: paymentLink,
            instrucciones: "El link de pago expira en 24 horas. La reserva no está confirmada hasta el pago de la seña."
        }));

    } catch (error) {
        console.error("Error in createBookingIntent:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
};

module.exports = {
    getProperties,
    getPropertyDetail,
    getPropertyCalendar,
    createBookingIntent
};
