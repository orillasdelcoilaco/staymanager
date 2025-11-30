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
        console.log('🔍 [DEBUG] Iniciando query de propiedades...');
        console.log('🔍 [DEBUG] Campo de filtro:', 'isListed');

        let query = db.collectionGroup('propiedades')
            .where('isListed', '==', true);

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
        console.log(`✅ [DEBUG] Query exitosa: ${snapshot.size} documentos`);

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

            // Verificar que la Empresa exista
            const empresaDoc = await db.collection('empresas').doc(empresaId).get();
            if (!empresaDoc.exists) continue;

            // TODO: Restaurar validación de planActivo cuando se implemente el módulo de administración de SuiteManager
            // El campo planActivo será parte del sistema de gestión global de empresas (super-admin)
            // Por ahora, todas las empresas operan sin restricciones hasta que se desarrolle ese módulo
            // if (!empresaDoc.data().planActivo) continue;

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
        console.error('❌ [DEBUG] Error completo:', {
            code: error.code,
            message: error.message,
            details: error.details
        });
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

/**
 * GET /api/public/propiedades/:id/cotizar
 * Cotizar precio para fechas específicas
 */
const quotePriceForDates = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        const { id } = req.params;
        const { fechaInicio, fechaFin } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: 'Parámetros requeridos: fechaInicio (YYYY-MM-DD), fechaFin (YYYY-MM-DD)'
            });
        }

        const inicio = parseISO(fechaInicio + 'T00:00:00Z');
        const fin = parseISO(fechaFin + 'T00:00:00Z');

        if (!isValid(inicio) || !isValid(fin) || inicio >= fin) {
            return res.status(400).json({ error: 'Fechas inválidas' });
        }

        // Buscar propiedad
        const propSnapshot = await db.collectionGroup('propiedades')
            .where('id', '==', id)
            .limit(1)
            .get();

        if (propSnapshot.empty) {
            return res.status(404).json({ error: 'Propiedad no encontrada' });
        }

        const propDoc = propSnapshot.docs[0];
        const propData = propDoc.data();
        const empresaId = propDoc.ref.parent.parent.id;

        // Verificar disponibilidad
        const availabilityData = await getAvailabilityData(
            db,
            empresaId,
            inicio,
            fin,
            false,
            null
        );

        const isAvailable = availabilityData.availableProperties.some(p => p.id === id);

        if (!isAvailable) {
            return res.status(409).json({
                error: 'Propiedad no disponible para las fechas solicitadas',
                code: 'NOT_AVAILABLE'
            });
        }

        // Obtener/crear canal IA
        let canalesIA = await obtenerCanalesPorEmpresa(db, empresaId);
        let canalIA = canalesIA.find(c => c.nombre === 'IA Reserva');

        if (!canalIA) {
            const nuevoCanalIA = await crearCanal(db, empresaId, {
                nombre: 'IA Reserva',
                moneda: 'CLP',
                modificadorTipo: 'porcentaje',
                modificadorValor: 0,
                configuracionIva: 'incluido',
                descripcion: 'Canal para reservas generadas por agentes IA'
            });
            canalIA = { id: nuevoCanalIA.id, ...nuevoCanalIA };
        }

        // Calcular precio
        const valorDolar = await obtenerValorDolar(db, empresaId, inicio);

        // Obtener tarifas
        const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
        const allTarifas = tarifasSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                fechaInicio: data.fechaInicio?.toDate ? data.fechaInicio.toDate() : parseISO(data.fechaInicio + 'T00:00:00Z'),
                fechaTermino: data.fechaTermino?.toDate ? data.fechaTermino.toDate() : parseISO(data.fechaTermino + 'T00:00:00Z'),
                alojamientoId: data.alojamientoId
            };
        }).filter(Boolean);

        const precioCalculado = await calculatePrice(
            db,
            empresaId,
            [{ id: id, nombre: propData.nombre }],
            inicio,
            fin,
            allTarifas,
            canalIA.id,
            valorDolar,
            false
        );

        if (!precioCalculado || precioCalculado.totalPriceCLP === 0) {
            return res.status(404).json({
                error: 'No se pudo calcular el precio. Verifica que la propiedad tenga tarifas configuradas.',
                code: 'NO_PRICING'
            });
        }

        const valorTotal = precioCalculado.totalPriceCLP;
        const senaPagar = Math.round(valorTotal * 0.10);
        const saldoPendiente = valorTotal - senaPagar;

        res.json(formatResponse({
            disponible: true,
            propiedad: {
                id: id,
                nombre: propData.nombre,
                capacidad: propData.capacidad
            },
            cotizacion: {
                moneda: 'CLP',
                valorTotal: valorTotal,
                desglose: {
                    senaPagar: senaPagar,
                    porcentajeSena: '10%',
                    descripcionSena: 'Seña para confirmar reserva (pago con MercadoPago)',
                    saldoPendiente: saldoPendiente,
                    porcentajeSaldo: '90%',
                    descripcionSaldo: 'Saldo a pagar al momento del check-in'
                },
                detalleCalculo: {
                    precioPorNoche: Math.round(valorTotal / precioCalculado.nights),
                    numeroNoches: precioCalculado.nights
                }
            },
            instrucciones: [
                `1. Paga seña de $${senaPagar.toLocaleString('es-CL')} CLP`,
                `2. Recibirás confirmación por email`,
                `3. Paga saldo de $${saldoPendiente.toLocaleString('es-CL')} CLP al check-in`
            ]
        }));

    } catch (error) {
        console.error('Error in quotePriceForDates:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * GET /api/public/propiedades/:id/disponibilidad
 * Verificar disponibilidad para fechas específicas
 */
const checkAvailability = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        const { id } = req.params;
        const { fechaInicio, fechaFin } = req.query;

        if (!fechaInicio || !fechaFin) {
            return res.status(400).json({
                error: 'Parámetros requeridos: fechaInicio, fechaFin',
                example: '/api/public/propiedades/123/disponibilidad?fechaInicio=2025-12-01&fechaFin=2025-12-05'
            });
        }

        const inicio = parseISO(fechaInicio + 'T00:00:00Z');
        const fin = parseISO(fechaFin + 'T00:00:00Z');

        if (!isValid(inicio) || !isValid(fin)) {
            return res.status(400).json({
                error: 'Formato de fecha inválido. Use YYYY-MM-DD'
            });
        }

        if (inicio >= fin) {
            return res.status(400).json({
                error: 'fechaInicio debe ser anterior a fechaFin'
            });
        }

        const propSnapshot = await db.collectionGroup('propiedades')
            .where('id', '==', id)
            .limit(1)
            .get();

        if (propSnapshot.empty) {
            return res.status(404).json({
                error: 'Propiedad no encontrada'
            });
        }

        const propDoc = propSnapshot.docs[0];
        const empresaId = propDoc.ref.parent.parent.id;

        const reservasSnapshot = await db.collection('empresas')
            .doc(empresaId)
            .collection('reservas')
            .where('alojamientoId', '==', id)
            .where('estado', '==', 'Confirmada')
            .where('fechaSalida', '>', require('firebase-admin').firestore.Timestamp.fromDate(inicio))
            .get();

        const conflictos = reservasSnapshot.docs
            .filter(doc => doc.data().fechaLlegada.toDate() < fin)
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    fechaLlegada: data.fechaLlegada.toDate().toISOString().split('T')[0],
                    fechaSalida: data.fechaSalida.toDate().toISOString().split('T')[0],
                    estado: data.estado,
                    origen: data.origen
                };
            });

        const disponible = conflictos.length === 0;

        res.json(formatResponse({
            disponible: disponible,
            conflictos: conflictos,
            totalConflictos: conflictos.length,
            mensaje: disponible
                ? 'La propiedad está disponible para las fechas solicitadas'
                : `Hay ${conflictos.length} reserva(s) que se solapan con las fechas solicitadas`
        }));

    } catch (error) {
        console.error('Error in checkAvailability:', error);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
};

/**
 * GET /api/public/propiedades/:id/imagenes
 * Obtener imágenes de una propiedad
 */
const getPropertyImages = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        const { id } = req.params;

        const propSnapshot = await db.collectionGroup('propiedades')
            .where('id', '==', id)
            .limit(1)
            .get();

        if (propSnapshot.empty) {
            return res.status(404).json({
                error: 'Propiedad no encontrada'
            });
        }

        const propData = propSnapshot.docs[0].data();

        const imagenesOrganizadas = {
            destacada: propData.websiteData?.cardImage || null,
            porComponente: propData.websiteData?.images || {},
            total: 0
        };

        Object.values(imagenesOrganizadas.porComponente).forEach(componente => {
            if (Array.isArray(componente)) {
                imagenesOrganizadas.total += componente.length;
            }
        });

        res.json(formatResponse(imagenesOrganizadas));

    } catch (error) {
        console.error('Error in getPropertyImages:', error);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
};

/**
 * POST /api/public/reservas
 * Crear una reserva pública (propuesta con pago)
 */
const createPublicReservation = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        const admin = require('firebase-admin');
        const {
            propiedadId,
            fechaInicio,
            fechaFin,
            cliente,
            numeroHuespedes,
            notas,
            agenteIA
        } = req.body;

        // Validaciones
        if (!propiedadId || !fechaInicio || !fechaFin || !cliente?.email || !cliente?.nombre) {
            return res.status(400).json({
                error: 'Campos requeridos: propiedadId, fechaInicio, fechaFin, cliente.nombre, cliente.email'
            });
        }

        const inicio = parseISO(fechaInicio + 'T00:00:00Z');
        const fin = parseISO(fechaFin + 'T00:00:00Z');

        if (!isValid(inicio) || !isValid(fin) || inicio >= fin) {
            return res.status(400).json({ error: 'Fechas inválidas' });
        }

        // Buscar propiedad
        const propSnapshot = await db.collectionGroup('propiedades')
            .where('id', '==', propiedadId)
            .limit(1)
            .get();

        if (propSnapshot.empty) {
            return res.status(404).json({ error: 'Propiedad no encontrada' });
        }

        const propDoc = propSnapshot.docs[0];
        const propData = propDoc.data();
        const empresaId = propDoc.ref.parent.parent.id;

        // Verificar disponibilidad
        const availabilityData = await getAvailabilityData(db, empresaId, inicio, fin, false, null);
        const isAvailable = availabilityData.availableProperties.some(p => p.id === propiedadId);

        if (!isAvailable) {
            return res.status(409).json({
                error: 'Propiedad no disponible',
                code: 'NOT_AVAILABLE'
            });
        }

        // Obtener/crear canal IA
        let canalesIA = await obtenerCanalesPorEmpresa(db, empresaId);
        let canalIA = canalesIA.find(c => c.nombre === 'IA Reserva');

        if (!canalIA) {
            const nuevoCanalIA = await crearCanal(db, empresaId, {
                nombre: 'IA Reserva',
                moneda: 'CLP',
                modificadorTipo: 'porcentaje',
                modificadorValor: 0,
                configuracionIva: 'incluido',
                descripcion: 'Reservas de agentes IA'
            });
            canalIA = { id: nuevoCanalIA.id, ...nuevoCanalIA };
        }

        // Calcular precio
        const valorDolar = await obtenerValorDolar(db, empresaId, inicio);

        const tarifasSnapshot = await db.collection('empresas').doc(empresaId).collection('tarifas').get();
        const allTarifas = tarifasSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                fechaInicio: data.fechaInicio?.toDate ? data.fechaInicio.toDate() : parseISO(data.fechaInicio + 'T00:00:00Z'),
                fechaTermino: data.fechaTermino?.toDate ? data.fechaTermino.toDate() : parseISO(data.fechaTermino + 'T00:00:00Z'),
                alojamientoId: data.alojamientoId
            };
        }).filter(Boolean);

        const precioCalculado = await calculatePrice(
            db,
            empresaId,
            [{ id: propiedadId, nombre: propData.nombre }],
            inicio,
            fin,
            allTarifas,
            canalIA.id,
            valorDolar,
            false
        );

        if (!precioCalculado || precioCalculado.totalPriceCLP === 0) {
            return res.status(404).json({
                error: 'No se pudo calcular precio',
                code: 'NO_PRICING'
            });
        }

        const valorTotal = precioCalculado.totalPriceCLP;
        const senaPagar = Math.round(valorTotal * 0.10);
        const saldoPendiente = valorTotal - senaPagar;

        // Crear/actualizar cliente
        const { crearOActualizarCliente } = require('../services/clientesService');
        const resultadoCliente = await crearOActualizarCliente(db, empresaId, {
            nombre: cliente.nombre,
            email: cliente.email,
            telefono: cliente.telefono || '',
            canalNombre: 'IA Reserva',
            idReservaCanal: null
        });

        const clienteId = resultadoCliente.cliente.id;

        // Crear propuesta
        const datosPropuesta = {
            cliente: { id: clienteId, nombre: cliente.nombre, email: cliente.email, telefono: cliente.telefono },
            fechaLlegada: fechaInicio,
            fechaSalida: fechaFin,
            propiedades: [{ id: propiedadId, nombre: propData.nombre }],
            precioFinal: valorTotal,
            noches: precioCalculado.nights,
            canalId: canalIA.id,
            canalNombre: 'IA Reserva',
            moneda: 'CLP',
            valorDolarDia: valorDolar,
            valorOriginal: valorTotal,
            origen: 'ia-reserva',
            personas: numeroHuespedes || 2,
            descuentoPct: 0,
            descuentoFijo: 0,
            valorFinalFijado: 0,
            enviarEmail: false,
            linkPago: null
        };

        const propuestaCreada = await guardarOActualizarPropuesta(
            db,
            empresaId,
            'ai-agent@system',
            datosPropuesta,
            null
        );

        // Generar link de pago
        const linkPago = await crearPreferencia(
            empresaId,
            propuestaCreada.id,
            `Seña reserva ${propData.nombre} - ${precioCalculado.nights} noches`,
            senaPagar,
            'CLP'
        );

        // Actualizar propuesta con link de pago y metadata
        const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
        const reservasSnapshot = await reservasRef.where('idReservaCanal', '==', propuestaCreada.id).get();

        const batch = db.batch();
        reservasSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                linkPago: linkPago,
                metadata: {
                    origenIA: true,
                    agenteIA: agenteIA || 'Desconocido',
                    estadoPago: 'pendiente'
                },
                notas: `${notas || ''}\n\nCreado por: ${agenteIA || 'Agente IA'}`
            });
        });
        await batch.commit();

        console.log(`✅ [Reserva IA] Propuesta creada: ${propuestaCreada.id}`);
        console.log(`📧 [Reserva IA] Email a enviar a: ${cliente.email}`);
        console.log(`💳 [Reserva IA] Link de pago: ${linkPago}`);

        res.status(201).json(formatResponse({
            propuestaId: propuestaCreada.id,
            estado: 'Propuesta',
            estadoPago: 'Pendiente',
            propiedad: {
                id: propiedadId,
                nombre: propData.nombre
            },
            fechas: {
                llegada: fechaInicio,
                salida: fechaFin,
                noches: precioCalculado.nights
            },
            precios: {
                moneda: 'CLP',
                valorTotal: valorTotal,
                senaPagar: senaPagar,
                saldoPendiente: saldoPendiente
            },
            pago: {
                linkPago: linkPago,
                monto: senaPagar,
                instrucciones: [
                    'Completa el pago de la seña para confirmar tu reserva',
                    'Recibirás confirmación por email',
                    `Pagarás $${saldoPendiente.toLocaleString('es-CL')} CLP al check-in`
                ],
                expiraEn: '48 horas'
            }
        }));

    } catch (error) {
        console.error('Error in createPublicReservation:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

/**
 * POST /api/public/webhooks/mercadopago
 * Webhook para notificaciones de MercadoPago
 */
const webhookMercadoPago = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        const { type, data } = req.body;

        console.log('[Webhook MP] Recibido:', { type, data });

        if (type !== 'payment' || !data?.id) {
            return res.status(200).json({ received: true });
        }

        // Por ahora, solo loguear (implementar verificación real con MP después)
        console.log(`[Webhook MP] Pago recibido: ${data.id}`);

        // TODO: Implementar verificación real con MercadoPago API
        // const mercadopagoService = require('../services/mercadopagoService');
        // const paymentInfo = await mercadopagoService.verificarPago(data.id);

        res.status(200).json({ received: true, message: 'Webhook procesado (modo simulado)' });

    } catch (error) {
        console.error('Error in webhookMercadoPago:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = {
    getProperties,
    getPropertyDetail,
    getPropertyCalendar,
    createBookingIntent,
    quotePriceForDates,
    checkAvailability,
    getPropertyImages,
    createPublicReservation,
    webhookMercadoPago
};

