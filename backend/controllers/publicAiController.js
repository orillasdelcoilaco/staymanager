const {
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,
    getAvailabilityData
} = require('../services/publicWebsiteService');
const { hydrateInventory, calcularCapacidad } = require('../services/propiedadLogicService');
const { format, addDays, isValid, parseISO } = require('date-fns');

/**
 * Sanitizes the property object to remove sensitive data.
 * @param {Object} property - The raw property object.
 * @returns {Object} - The sanitized property object.
 */
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

        const enrichedProperty = {
            ...sanitizedProperty,
            capacidadCalculada: calculatedCapacity,
            ai_context: aiContext,
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

module.exports = {
    getProperties,
    getPropertyDetail,
    getPropertyCalendar
};
