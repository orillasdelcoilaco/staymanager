const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/publicWebsiteService');
// REMOVED: const db = require('firebase-admin').firestore();
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
        const db = require('firebase-admin').firestore();
        const { id } = req.params;
        // ... rest of function ...

        // RE-IMPLEMENTING LOGIC TO AVOID LOSING IT
        const {
            ubicacion,
            capacidad,
            fechaLlegada,
            fechaSalida,
            precioMin,
            precioMax,
            amenidades,
            ordenar = 'popularidad',
            limit = 20,
            offset = 0
        } = req.query;

        // 1. Filtrado Básico en DB (Global)
        let query = db.collectionGroup('propiedades')
            .where('googleHotelData.isListed', '==', true);

        if (precioMin) query = query.where('precioBase', '>=', parseInt(precioMin));
        if (precioMax) query = query.where('precioBase', '<=', parseInt(precioMax));

        // Ordenamiento
        if (ordenar === 'precio_asc') {
            query = query.orderBy('precioBase', 'asc');
        } else if (ordenar === 'precio_desc') {
            query = query.orderBy('precioBase', 'desc');
        } else if (ordenar === 'rating') {
            query = query.orderBy('rating', 'desc');
        }

        const snapshot = await query.get();

        // 2. Filtrado en Memoria (Lógica de Negocio Compleja)
        const propiedades = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const empresaId = doc.ref.parent.parent.id; // empresas/{id}/propiedades/{id}

            // [HOTFIX] Construir dirección completa
            const calle = data.googleHotelData?.address?.street || '';
            const ciudad = data.googleHotelData?.address?.city || '';
            const direccionCompleta = `${calle}, ${ciudad}`.replace(/^, /, '').replace(/, $/, '');

            // Filtro de Ubicación (Búsqueda parcial en calle o ciudad)
            if (ubicacion) {
                const term = ubicacion.toLowerCase();
                const matchCalle = calle.toLowerCase().includes(term);
                const matchCiudad = ciudad.toLowerCase().includes(term);
                if (!matchCalle && !matchCiudad) continue;
            }

            // Filtro de Capacidad
            if (capacidad && data.capacidad < parseInt(capacidad)) continue;

            // Filtro de Amenidades
            if (amenidades) {
                const amenidadesRequeridas = amenidades.split(',').map(a => a.trim().toLowerCase());
                const tieneAmenidades = amenidadesRequeridas.every(req =>
                    data.amenidades && data.amenidades.some(a => a.toLowerCase().includes(req))
                );
                if (!tieneAmenidades) continue;
            }

            // Verificar Plan Activo de la Empresa (Cachear esto sería ideal)
            const empresaDoc = await db.collection('empresas').doc(empresaId).get();
            if (!empresaDoc.exists || !empresaDoc.data().planActivo) continue;
            const empresaData = empresaDoc.data();

            // Verificar Disponibilidad (Si se solicitan fechas)
            let disponible = true;
            if (fechaLlegada && fechaSalida) {
                if (data.busyRanges) {
                    const start = new Date(fechaLlegada);
                    const end = new Date(fechaSalida);
                    const hasConflict = data.busyRanges.some(range => {
                        const rangeStart = range.start.toDate ? range.start.toDate() : new Date(range.start);
                        const rangeEnd = range.end.toDate ? range.end.toDate() : new Date(range.end);
                        return (start < rangeEnd && end > rangeStart);
                    });
                    if (hasConflict) disponible = false;
                }
            }

            if (fechaLlegada && fechaSalida && !disponible) continue;

            // --- Transformation ---
            const sanitized = sanitizeProperty(data);

            // Enrich images
            let enrichedImages = [];
            if (data.websiteData && data.websiteData.images) {
                enrichedImages = Object.values(data.websiteData.images).map(img => ({
                    url: img.storagePath || img.url || '',
                    description: img.description || img.alt || '',
                    tags: img.tags || [],
                    category: img.category || 'general'
                })).filter(img => img.url);
            } else if (Array.isArray(data.imagenes)) {
                enrichedImages = data.imagenes.map(url => ({
                    url: url,
                    description: '',
                    tags: [],
                    category: 'general'
                }));
            }

            propiedades.push({
                id: doc.id,
                empresa: {
                    id: empresaDoc.id,
                    nombre: empresaData.nombreFantasia || empresaData.razonSocial || 'Empresa',
                    contacto: empresaData.emailContacto || ''
                },
                ...sanitized,
                direccion: direccionCompleta, // [HOTFIX] Added direction
                imagenesDestacadas: enrichedImages.slice(0, 5), // Limit for list view
                imagenesCount: enrichedImages.length,
                disponible: (fechaLlegada && fechaSalida) ? true : undefined
            });
        }

        // Apply pagination in memory since we filtered in memory
        const paginatedProperties = propiedades.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        res.json(formatResponse({
            meta: {
                total: propiedades.length,
                limit: parseInt(limit),
                offset: parseInt(offset),
                filtros: { ubicacion, capacidad, fechas: { llegada: fechaLlegada, salida: fechaSalida }, amenidades },
                ordenado_por: ordenar
            },
            data: paginatedProperties
        }));

    } catch (error) {
        console.error('Error in getProperties:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};

const getPropertyDetail = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        const { id } = req.params;

        // Global lookup: Find property in any 'propiedades' collection
        let propertyDoc = null;
        let empresaDoc = null;

        // Try global search by field 'id'
        let querySnapshot = await db.collectionGroup('propiedades').where('id', '==', id).limit(1).get();

        if (!querySnapshot.empty) {
            propertyDoc = querySnapshot.docs[0];
            empresaDoc = await propertyDoc.ref.parent.parent.get();
        } else {
            // Fallback: Iterate companies (Not ideal but works for small SaaS)
            const companiesSnap = await db.collection('empresas').where('planActivo', '==', true).get();
            for (const company of companiesSnap.docs) {
                const propRef = company.ref.collection('propiedades').doc(id);
                const doc = await propRef.get();
                if (doc.exists) {
                    propertyDoc = doc;
                    empresaDoc = company;
                    break;
                }
            }
        }

        if (!propertyDoc || !propertyDoc.exists) {
            return res.status(404).json({ error: "Property not found" });
        }

        const rawProperty = propertyDoc.data();
        const empresaData = empresaDoc.data();

        // Hydrate inventory
        const aiContext = hydrateInventory(rawProperty.componentes || []);

        // Calculate capacity
        const calculatedCapacity = calcularCapacidad(rawProperty.componentes || []);

        // Semantic Summary
        const currency = rawProperty.moneda || 'CLP';
        const rules = Array.isArray(rawProperty.reglas) ? rawProperty.reglas.join('. ') : (rawProperty.reglas || 'No specific rules.');
        const semanticSummary = `Tarifas en ${currency}. Reglas: ${rules}. Capacidad máxima: ${calculatedCapacity} personas.`;

        aiContext.semantic_summary = semanticSummary;
        aiContext.currency = currency;
        aiContext.house_rules = rawProperty.reglas || [];

        const sanitizedProperty = sanitizeProperty(rawProperty);

        // Transform images
        let enrichedImages = [];
        if (rawProperty.websiteData && rawProperty.websiteData.images) {
            enrichedImages = Object.values(rawProperty.websiteData.images).map(img => ({
                url: img.storagePath || img.url || '',
                description: img.description || img.alt || '',
                tags: img.tags || [],
                category: img.category || 'general'
            })).filter(img => img.url);
        } else if (Array.isArray(rawProperty.imagenes)) {
            enrichedImages = rawProperty.imagenes.map(url => ({
                url: url,
                description: '',
                tags: [],
                category: 'general'
            }));
        }

        const enrichedProperty = {
            id: propertyDoc.id, // Ensure ID is returned
            empresa: {
                id: empresaDoc.id,
                nombre: empresaData.nombreFantasia || empresaData.razonSocial || 'Empresa',
                contacto: empresaData.emailContacto || '',
                whatsapp: empresaData.telefonoContacto || ''
            },
            ...sanitizedProperty,
            capacidadCalculada: calculatedCapacity,
            ai_context: aiContext,
            images: enrichedImages,
            reviews: [], // TODO: Fetch real reviews if collection exists
            politicaCancelacion: rawProperty.politicaCancelacion || "Consultar con el anfitrión.",
            instruccionesCheckin: rawProperty.instruccionesCheckin || "Check-in desde las 15:00.",
            schema_type: "VacationRental"
        };

        res.json(formatResponse(enrichedProperty));
    } catch (error) {
        console.error("Error in getPropertyDetail:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const getPropertyCalendar = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        const { id } = req.params;

        // Default to next 30 days if not specified
        const startDate = new Date();
        const endDate = addDays(startDate, 60);

        // Global lookup (same logic as getPropertyDetail)
        let propertyDoc = null;
        let empresaDoc = null;

        let querySnapshot = await db.collectionGroup('propiedades').where('id', '==', id).limit(1).get();

        if (!querySnapshot.empty) {
            propertyDoc = querySnapshot.docs[0];
            empresaDoc = await propertyDoc.ref.parent.parent.get();
        } else {
            const companiesSnap = await db.collection('empresas').where('planActivo', '==', true).get();
            for (const company of companiesSnap.docs) {
                const propRef = company.ref.collection('propiedades').doc(id);
                const doc = await propRef.get();
                if (doc.exists) {
                    propertyDoc = doc;
                    empresaDoc = company;
                    break;
                }
            }
        }

        if (!propertyDoc || !propertyDoc.exists) {
            return res.status(404).json({ error: "Property not found" });
        }

        const targetEmpresaId = empresaDoc.id;

        // Reuse getAvailabilityData but filter for specific property
        const { availabilityMap } = await getAvailabilityData(db, targetEmpresaId, startDate, endDate);

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
        const db = require('firebase-admin').firestore();
        const { propiedadId, fechaLlegada, fechaSalida, personas, huesped } = req.body;

        if (!propiedadId || !fechaLlegada || !fechaSalida || !personas || !huesped) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        // Global lookup (same logic as getPropertyDetail)
        let propertyDoc = null;
        let empresaDoc = null;

        let querySnapshot = await db.collectionGroup('propiedades').where('id', '==', propiedadId).limit(1).get();

        if (!querySnapshot.empty) {
            propertyDoc = querySnapshot.docs[0];
            empresaDoc = await propertyDoc.ref.parent.parent.get();
        } else {
            const companiesSnap = await db.collection('empresas').where('planActivo', '==', true).get();
            for (const company of companiesSnap.docs) {
                const propRef = company.ref.collection('propiedades').doc(propiedadId);
                const doc = await propRef.get();
                if (doc.exists) {
                    propertyDoc = doc;
                    empresaDoc = company;
                    break;
                }
            }
        }

        if (!propertyDoc || !propertyDoc.exists) {
            return res.status(404).json({ error: "Property not found" });
        }

        const targetEmpresaId = empresaDoc.id;
        const empresaData = empresaDoc.data();

        const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
        const endDate = parseISO(fechaSalida + 'T00:00:00Z');

        if (!isValid(startDate) || !isValid(endDate)) {
            return res.status(400).json({ error: "Invalid dates." });
        }

        // 1. Ensure 'ia-reserva' channel exists
        let canales = await obtenerCanalesPorEmpresa(db, targetEmpresaId);
        let iaChannel = canales.find(c => c.nombre === 'ia-reserva');

        if (!iaChannel) {
            console.log("[Booking Intent] Creating 'ia-reserva' channel...");
            iaChannel = await crearCanal(db, targetEmpresaId, {
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
        const tarifasSnapshot = await db.collection('empresas').doc(targetEmpresaId).collection('tarifas').get();
        const allTarifas = tarifasSnapshot.docs.map(doc => {
            const data = doc.data();
            let inicio = null, termino = null;
            try {
                inicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : (data.fechaInicio ? parseISO(data.fechaInicio + 'T00:00:00Z') : null);
                termino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : (data.fechaTermino ? parseISO(data.fechaTermino + 'T00:00:00Z') : null);
            } catch (e) { return null; }
            return { ...data, id: doc.id, fechaInicio: inicio, fechaTermino: termino };
        }).filter(Boolean);

        const valorDolarDia = await obtenerValorDolar(db, targetEmpresaId, startDate);

        // Fetch property details for name
        const rawProperty = propertyDoc.data();
        const propertyName = rawProperty ? rawProperty.nombre : 'Propiedad';
        const propertyObj = { id: propiedadId, nombre: propertyName };

        const pricing = await calculatePrice(db, targetEmpresaId, [propertyObj], startDate, endDate, allTarifas, iaChannel.id, valorDolarDia, false);

        if (pricing.totalPriceCLP === 0 && pricing.nights > 0) {
            console.warn("[Booking Intent] Price calculated as 0. Check tariffs.");
        }

        // 3. Financial Model (10/90 Rule)
        const totalEstadia = pricing.totalPriceCLP;
        const montoSeña = Math.round(totalEstadia * 0.10);
        const saldoPendiente = totalEstadia - montoSeña;

        // 4. Create Proposal (Reserva)
        // Generate ID manually to break circular dependency if needed, but service handles it.
        // We need the ID for the link.
        const reservaId = db.collection('empresas').doc(targetEmpresaId).collection('reservas').doc().id;

        // 5. Generate Payment Link (BEFORE saving proposal)
        const paymentLink = await crearPreferencia(targetEmpresaId, reservaId, `Reserva 10%: ${propertyName}`, montoSeña, 'CLP');

        // Fetch Template
        const plantillas = await obtenerPlantillasPorEmpresa(db, targetEmpresaId);
        const plantilla = plantillas.find(p => p.nombre === 'Plantilla Predeterminada' && p.enviarPorEmail) || plantillas.find(p => p.enviarPorEmail);
        const plantillaId = plantilla ? plantilla.id : null;

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
            bebes: 0,
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

        // We use a dummy user ID for the 'creadoPor' argument
        await guardarOActualizarPropuesta(db, targetEmpresaId, 'ai-agent@system', proposalData);

        res.json(formatResponse({
            reserva_id: reservaId,
            empresa: {
                id: targetEmpresaId,
                nombre: empresaData.nombreFantasia || empresaData.razonSocial || 'Empresa'
            },
            propiedad: {
                id: propiedadId,
                nombre: propertyName
            },
            estado: "Propuesta",
            desglose_financiero: {
                moneda: "CLP",
                total_estadia: totalEstadia,
                monto_a_pagar_ahora: montoSeña,
                saldo_al_checkin: saldoPendiente,
                porcentaje_seña: "10%"
            },
            link_pago: paymentLink,
            instrucciones: "El link de pago expira en 24 horas. La reserva no está confirmada hasta el pago de la seña.",
            contacto_empresa: {
                whatsapp: empresaData.telefonoContacto || '',
                email: empresaData.emailContacto || ''
            }
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
