const pool = require('../db/postgres');
const { randomUUID } = require('crypto');
const { fetchGlobalPublicAiInventoryPostgres } = require('../services/publicAiInventoryPg');
const {
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,
    getAvailabilityData: getAvailabilityDataWeb,
} = require('../services/publicWebsiteService');
const { hydrateInventory, calcularCapacidad } = require('../services/propiedadLogicService');
const { getAvailabilityData } = require('../services/propuestasService');
const { calculatePrice } = require('../services/utils/calculoValoresService');
const { obtenerCanalesPorEmpresa, crearCanal, resolverCanalIaVentaEnLista, IA_VENTA_CANAL_ORIGEN } = require('../services/canalesService');
const { obtenerValorDolar } = require('../services/dolarService');
const { obtenerTarifasParaConsumidores } = require('../services/tarifasService');
const { guardarOActualizarPropuesta } = require('../services/gestionPropuestasService');
const { format, addDays, parseISO, isValid } = require('date-fns');
const { crearOActualizarCliente } = require('../services/clientesService');
const { getProvider } = require('../services/aiContentService.providers');
const { resolveEmpresaDbId } = require('../services/resolveEmpresaDbId');
const { resolveBookingUnitForIa } = require('../services/publicAiBookingResolverService');
const { resolvePrecioNocheReferencia } = require('../services/publicAiProductSnapshot');
const {
    obtenerEstadoGestionInicialPostConfirmacionRow,
    obtenerEstadoPrincipalRowPorSemantica,
    sqlReservaPrincipalSemanticaIgual,
    sqlReservaPrincipalSemanticaEn,
    reservasTieneColumna,
} = require('../services/estadosService');
const { getBloqueosPorPeriodo } = require('../services/bloqueosService');
const {
    enviarConfirmacionReservaIaEmail,
    enviarNotificacionAdminReservaIaEmail,
} = require('../services/chatgptSalesCoreEmailService');
const { getChatgptReservaGuardDiag } = require('../services/chatgptSalesReservationGuardModule');

const CANAL_IA_VENTA_CREAR_DATOS = {
    nombre: 'ia-reserva',
    tipo: 'Directo',
    comision: 0,
    origen: 'ia',
    moneda: 'CLP',
    color: '#8e44ad',
    origenCanal: IA_VENTA_CANAL_ORIGEN,
    esCanalIaVenta: true,
};

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

// Helper para encontrar propiedad con estrategia híbrida (Escalabilidad + Robustez)
// 1. Intenta usar collectionGroup (O(1)) para escalabilidad máxima (requiere índice).
// 2. Si falla (por falta de índice), hace fallback a iteración (O(N)) para garantizar funcionamiento.
const findPropertyById = async (db, propertyId) => {
    try {
        // ESTRATEGIA 1: Búsqueda Directa (Escalable a 1000+ empresas)
        // Requiere índice: collectionGroup 'propiedades', campo 'id'
        const snapshot = await db.collectionGroup('propiedades')
            .where('id', '==', propertyId)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            return snapshot.docs[0];
        }

    } catch (error) {
        // Si falta el índice, Firestore lanza error. Capturamos y usamos fallback.
        console.warn(`[Performance Notice] Búsqueda optimizada falló (posible falta de índice). Usando fallback iterativo. Error: ${error.message}`);
        if (error.code === 9 || error.message.includes('index')) {
            console.log(`[Action Required] Para escalabilidad óptima, crea el índice siguiendo el link en los logs de error de Firestore.`);
        }
    }

    // ESTRATEGIA 2: Fallback Iterativo (Funciona siempre, O(N))
    // Útil mientras se crean índices o para recuperación de errores.
    console.log(`[Fallback Search] Buscando propiedad ${propertyId} iterando empresas...`);
    const empresasSnapshot = await db.collection('empresas').get();

    if (empresasSnapshot.empty) return null;

    for (const empresaDoc of empresasSnapshot.docs) {
        const propDoc = await empresaDoc.ref.collection('propiedades').doc(propertyId).get();
        if (propDoc.exists) {
            return propDoc;
        }
    }

    return null;
};

const getProperties = async (req, res) => {
    try {
        const merged = { ...req.query, ...req.params };
        if (!merged.fechaLlegada && merged.checkin) merged.fechaLlegada = merged.checkin;
        if (!merged.fechaSalida && merged.checkout) merged.fechaSalida = merged.checkout;
        if (merged.capacidad == null && merged.personas != null) merged.capacidad = merged.personas;

        if (pool) {
            const inner = await fetchGlobalPublicAiInventoryPostgres(merged);
            return res.json(formatResponse(inner));
        }

        const db = require('firebase-admin').firestore();
        const {
            id,
            ubicacion,
            capacidad,
            fechaLlegada,
            fechaSalida,
            precioMin,
            precioMax,
            amenidades,
            ordenar = 'popularidad',
            limit = 20,
            offset = 0,
            empresaId // [NEW] Support for filtering by company via query param
        } = merged;

        // Determine target company ID (params takes precedence if route uses it, otherwise query)
        const targetEmpresaId = id || empresaId;

        // 1. Filtrado en DB (Global o Específico)
        let query;
        if (targetEmpresaId) {
            console.log(`🔍 [DEBUG] Buscando propiedades para empresa: ${targetEmpresaId}`);
            query = db.collection('empresas').doc(targetEmpresaId).collection('propiedades')
                .where('googleHotelData.isListed', '==', true);
        } else {
            console.log('🔍 [DEBUG] Iniciando query GLOBAL de propiedades...');
            query = db.collectionGroup('propiedades')
                .where('googleHotelData.isListed', '==', true);
        }

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

        // Nota: Esta query collectionGroup también requiere índice si se combina con filtros.
        // Si falla, deberíamos implementar fallback similar, pero para listado es más complejo.
        // Por ahora asumimos que el índice básico de isListed existe o se creará.

        let snapshot;
        try {
            snapshot = await query.get();
        } catch (e) {
            console.warn(`[Performance] Listado optimizado falló. Usando fallback iterativo.`);
            // Fallback simple para listado: traer todas las empresas y sus propiedades listed
            const empresas = await db.collection('empresas').get();
            const todasProps = [];
            for (const emp of empresas.docs) {
                const props = await emp.ref.collection('propiedades').where('isListed', '==', true).get();
                props.forEach(p => todasProps.push(p));
            }
            // Mock snapshot structure
            snapshot = { docs: todasProps, size: todasProps.length };
        }

        console.log(`✅ [DEBUG] Query exitosa: ${snapshot.size} documentos`);

        // 2. Filtrado en Memoria (Lógica de Negocio Compleja)
        const propiedades = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const empresaId = doc.ref.parent.parent.id;

            const calle = data.googleHotelData?.address?.street || '';
            const ciudad = data.googleHotelData?.address?.city || '';
            const direccionCompleta = `${calle}, ${ciudad}`.replace(/^, /, '').replace(/, $/, '');

            if (ubicacion) {
                // Normalizar para ignorar acentos (Pucón matches Pucon)
                const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                const term = normalize(ubicacion);
                const matchCalle = normalize(calle).includes(term);
                const matchCiudad = normalize(ciudad).includes(term);
                if (!matchCalle && !matchCiudad) continue;
            }

            if (capacidad && data.capacidad < parseInt(capacidad)) continue;

            if (amenidades) {
                const amenidadesRequeridas = amenidades.split(',').map(a => a.trim().toLowerCase());
                const tieneAmenidades = amenidadesRequeridas.every(req =>
                    data.amenidades && data.amenidades.some(a => a.toLowerCase().includes(req))
                );
                if (!tieneAmenidades) continue;
            }

            const empresaDoc = await db.collection('empresas').doc(empresaId).get();
            if (!empresaDoc.exists) continue;

            const empresaData = empresaDoc.data();

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

            const sanitized = sanitizeProperty(data);

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
                direccion: direccionCompleta,
                imagenesDestacadas: enrichedImages.slice(0, 5),
                imagenesCount: enrichedImages.length,
                disponible: (fechaLlegada && fechaSalida) ? true : undefined
            });
        }

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

        const propertyDoc = await findPropertyById(db, id);

        if (!propertyDoc || !propertyDoc.exists) {
            // DEBUG: Diagnóstico de fallo en búsqueda
            const empresasCount = (await db.collection('empresas').get()).size;
            return res.status(404).json({
                error: "Property not found",
                debug: {
                    searchedId: id,
                    companiesChecked: empresasCount,
                    message: "Fallback search failed to find document in any company."
                }
            });
        }

        const empresaDoc = await propertyDoc.ref.parent.parent.get();
        const rawProperty = propertyDoc.data();
        const empresaData = empresaDoc.data();

        const aiContext = hydrateInventory(rawProperty.componentes || []);
        const calculatedCapacity = calcularCapacidad(rawProperty.componentes || []);

        const currency = rawProperty.moneda || 'CLP';
        const rules = Array.isArray(rawProperty.reglas) ? rawProperty.reglas.join('. ') : (rawProperty.reglas || 'No specific rules.');
        const semanticSummary = `Tarifas en ${currency}. Reglas: ${rules}. Capacidad máxima: ${calculatedCapacity} personas.`;

        aiContext.semantic_summary = semanticSummary;
        aiContext.currency = currency;
        aiContext.house_rules = rawProperty.reglas || [];

        // Inventario estructurado para agentes de venta IA
        aiContext.sales_inventory = (rawProperty.componentes || []).map(comp => ({
            espacio: comp.nombre,
            tipo: comp.tipo || '',
            icono: comp.icono || '',
            elementos: (comp.elementos || []).map(el => ({
                nombre: el.nombre,
                cantidad: el.cantidad || 1,
                categoria: el.categoria || '',
                icono: el.icono || '',
                capacidad: el.capacity || el.capacidad || 0,
                sales_context: el.sales_context || '',
                seo_tags: el.seo_tags || []
            }))
        }));

        // Flujo de reserva para agentes IA
        aiContext.booking_workflow = {
            paso_1: `GET /api/public/propiedades/${propertyDoc.id}/disponibilidad?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD`,
            paso_resolve: `POST /api/public/reservas/resolve-booking-unit (traduce catalog_id -> booking_id para crear reserva)`,
            paso_resolve_body: {
                empresa_id: empresaDoc.id,
                catalog_id: propertyDoc.id,
                checkin: 'YYYY-MM-DD',
                checkout: 'YYYY-MM-DD',
                personas: 2,
            },
            paso_2: `GET /api/public/propiedades/${propertyDoc.id}/cotizar?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD`,
            paso_2b: `POST /api/public/reservas/cotizar (opcional; dry-run: desglose checkout + política cancelación; no persiste; mismos headers/límite que POST /api/public/reservas)`,
            paso_2b_body: {
                empresa_id: empresaDoc.id,
                alojamiento_id: propertyDoc.id,
                checkin: 'YYYY-MM-DD',
                checkout: 'YYYY-MM-DD',
                adultos: 2,
                ninos: 0,
                origen: 'chatgpt',
                huesped: {
                    nombre: 'string (opcional en cotización)',
                    apellido: 'string (opcional)',
                    email: 'string (opcional)',
                    telefono: 'string (opcional)',
                },
            },
            paso_3: `POST /api/public/reservas`,
            paso_3_body: {
                booking_id: propertyDoc.id,
                propiedadId: propertyDoc.id,
                fechaInicio: 'YYYY-MM-DD',
                fechaFin: 'YYYY-MM-DD',
                cliente: { nombre: 'string', email: 'string', telefono: 'string (opcional)' },
                numeroHuespedes: 'number',
                agenteIA: 'nombre del agente (ChatGPT | Claude | Gemini | DeepSeek | otro)'
            }
        };

        const sanitizedProperty = sanitizeProperty(rawProperty);

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
            id: propertyDoc.id,
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
            reviews: [],
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
        if (!pool) {
            return res.status(503).json({ error: 'SERVICE_UNAVAILABLE', message: 'El calendario de ocupación requiere PostgreSQL.' });
        }
        const db = require('firebase-admin').firestore();
        const { id } = req.params;

        const startDate = new Date();
        const endDate = addDays(startDate, 60);

        const propertyDoc = await findPropertyById(db, id);

        if (!propertyDoc || !propertyDoc.exists) {
            return res.status(404).json({ error: "Property not found" });
        }

        const empresaDoc = await propertyDoc.ref.parent.parent.get();
        const targetEmpresaId = empresaDoc.id;

        const { availabilityMap } = await getAvailabilityData(db, targetEmpresaId, startDate, endDate);
        const propertyAvailability = availabilityMap.get(id) || [];

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

        const propertyDoc = await findPropertyById(db, propiedadId);

        if (!propertyDoc || !propertyDoc.exists) {
            return res.status(404).json({ error: "Property not found" });
        }

        const empresaDoc = await propertyDoc.ref.parent.parent.get();
        const targetEmpresaId = empresaDoc.id;
        const empresaData = empresaDoc.data();

        if (!pool) {
            return res.status(503).json({
                error: 'SERVICE_UNAVAILABLE',
                message: 'Las reservas y propuestas se persisten solo en PostgreSQL.',
            });
        }

        const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
        const endDate = parseISO(fechaSalida + 'T00:00:00Z');

        if (!isValid(startDate) || !isValid(endDate)) {
            return res.status(400).json({ error: "Invalid dates." });
        }

        let canales = await obtenerCanalesPorEmpresa(db, targetEmpresaId);
        let iaChannel = resolverCanalIaVentaEnLista(canales);

        if (!iaChannel) {
            iaChannel = await crearCanal(db, targetEmpresaId, { ...CANAL_IA_VENTA_CREAR_DATOS });
        }

        const allTarifas = await obtenerTarifasParaConsumidores(targetEmpresaId);

        const bloqueosPg = await getBloqueosPorPeriodo(null, targetEmpresaId, startDate, endDate, propiedadId);
        const bloqueado = bloqueosPg.some((b) => {
            const bInicio = new Date(String(b.fechaInicio).split('T')[0] + 'T00:00:00Z');
            if (bInicio >= endDate) return false;
            return b.todos || (b.alojamientoIds || []).includes(propiedadId);
        });
        if (bloqueado) {
            return res.status(409).json({ error: 'La propiedad no está disponible en las fechas solicitadas.' });
        }

        const valorDolarDia = await obtenerValorDolar(db, targetEmpresaId, startDate);
        const rawProperty = propertyDoc.data();
        const propertyName = rawProperty ? rawProperty.nombre : 'Propiedad';
        const propertyObj = { id: propiedadId, nombre: propertyName };

        const pricing = await calculatePrice(db, targetEmpresaId, [propertyObj], startDate, endDate, allTarifas, iaChannel.id, valorDolarDia, false);

        const totalEstadia = pricing.totalPriceCLP;
        const montoSeña = Math.round(totalEstadia * 0.10);
        const saldoPendiente = totalEstadia - montoSeña;

        const reservaId = randomUUID();
        const plantilla = await resolverPlantillaCorreoPreferida(db, targetEmpresaId);
        const plantillaId = plantilla ? plantilla.id : null;

        const proposalData = {
            idReservaCanal: reservaId,
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
            linkPago: ''
        };

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
            link_pago: '',
            instrucciones: "No hay link de pago integrado. El pago de seña se registra manualmente (transferencia, efectivo o tarjeta presencial con POS externo).",
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

        const propDoc = await findPropertyById(db, id);

        if (!propDoc) {
            return res.status(404).json({ error: 'Propiedad no encontrada' });
        }

        const propData = propDoc.data();
        const empresaId = propDoc.ref.parent.parent.id;

        if (!pool) {
            return res.status(503).json({
                error: 'SERVICE_UNAVAILABLE',
                message: 'La cotización por disponibilidad requiere PostgreSQL.',
            });
        }

        const availabilityData = await getAvailabilityData(db, empresaId, inicio, fin, false, null);
        const isAvailable = availabilityData.availableProperties.some(p => p.id === id);

        if (!isAvailable) {
            return res.status(409).json({
                error: 'Propiedad no disponible para las fechas solicitadas',
                code: 'NOT_AVAILABLE'
            });
        }

        let canalesIA = await obtenerCanalesPorEmpresa(db, empresaId);
        let canalIA = resolverCanalIaVentaEnLista(canalesIA);

        if (!canalIA) {
            canalIA = await crearCanal(db, empresaId, {
                ...CANAL_IA_VENTA_CREAR_DATOS,
                modificadorTipo: 'porcentaje',
                modificadorValor: 0,
                configuracionIva: 'incluido',
                descripcion: 'Canal para reservas generadas por agentes IA',
            });
        }

        const valorDolar = await obtenerValorDolar(db, empresaId, inicio);

        const allTarifas = await obtenerTarifasParaConsumidores(empresaId);

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
                    descripcionSena: 'Seña para confirmar reserva (registro manual del pago recibido)',
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
                `1. Realiza la seña de $${senaPagar.toLocaleString('es-CL')} CLP por canal manual (transferencia, efectivo o POS externo)`,
                `2. Recibirás confirmación por email`,
                `3. Paga saldo de $${saldoPendiente.toLocaleString('es-CL')} CLP al check-in`
            ]
        }));

    } catch (error) {
        console.error('Error in quotePriceForDates:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
};

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

        const propDoc = await findPropertyById(db, id);

        if (!propDoc) {
            return res.status(404).json({
                error: 'Propiedad no encontrada'
            });
        }

        const empresaId = propDoc.ref.parent.parent.id;

        if (!pool) {
            return res.status(503).json({
                error: 'SERVICE_UNAVAILABLE',
                message: 'La disponibilidad por reservas se consulta solo en PostgreSQL.',
            });
        }

        const inicioStr = inicio.toISOString().split('T')[0];
        const finStr = fin.toISOString().split('T')[0];

        const bloqueosPg = await getBloqueosPorPeriodo(null, empresaId, inicio, fin, id);
        const bloqueado = bloqueosPg.some((b) => {
            const bInicio = new Date(String(b.fechaInicio).split('T')[0] + 'T00:00:00Z');
            if (bInicio >= fin) return false;
            return b.todos || (b.alojamientoIds || []).includes(id);
        });
        const { rows: resRows } = await pool.query(
            `SELECT r.id, r.fecha_llegada, r.fecha_salida, r.estado, r.metadata
             FROM reservas r
             WHERE r.empresa_id = $1 AND r.propiedad_id = $2
               AND r.fecha_llegada < $3 AND r.fecha_salida > $4
               AND ${sqlReservaPrincipalSemanticaEn(['confirmada', 'propuesta'])}`,
            [empresaId, id, finStr, inicioStr]
        );
        const conflictos = resRows.map((row) => ({
            id: row.id,
            fechaLlegada: row.fecha_llegada instanceof Date
                ? row.fecha_llegada.toISOString().split('T')[0]
                : String(row.fecha_llegada).split('T')[0],
            fechaSalida: row.fecha_salida instanceof Date
                ? row.fecha_salida.toISOString().split('T')[0]
                : String(row.fecha_salida).split('T')[0],
            estado: row.estado,
            origen: row.metadata?.origen || 'reporte',
        }));

        if (bloqueado) {
            return res.json(formatResponse({
                disponible: false,
                conflictos: [],
                totalConflictos: 0,
                mensaje: 'La propiedad está bloqueada por mantenimiento en las fechas solicitadas'
            }));
        }

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

const getPropertyImages = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        const { id } = req.params;

        const propDoc = await findPropertyById(db, id);

        if (!propDoc) {
            return res.status(404).json({
                error: 'Propiedad no encontrada'
            });
        }

        const propData = propDoc.data();

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

const createPublicReservation = async (req, res) => {
    try {
        const body = req.body || {};

        let cliente = body.cliente || body.huesped;
        if (typeof cliente === 'string') {
            try {
                cliente = JSON.parse(cliente);
            } catch {
                cliente = null;
            }
        }

        const empresaRaw = body.empresa_id_raw || body.empresa_id || body.empresaId;
        const empresaId = pool ? await resolveEmpresaDbId(empresaRaw) : empresaRaw;
        let propiedadId = body.booking_id || body.propiedadId || body.alojamiento_id || body.property_id;
        const fechaInicio = body.fechaInicio || body.checkin;
        const fechaFin = body.fechaFin || body.checkout;
        let personas = parseInt(String(body.personas ?? ''), 10);
        if (Number.isNaN(personas) || personas < 1) {
            personas = Number(body.adultos || 0) + Number(body.ninos || 0);
        }
        if (!personas || personas < 1) personas = 2;
        const agenteIA = req.agentName || body.origen || 'Desconocido';

        const nombreCliente =
            [cliente?.nombre, cliente?.apellido].filter(Boolean).join(' ').trim()
            || String(cliente?.nombreCompleto || '').trim();

        const missing = [];
        if (!empresaRaw) missing.push('empresa_id');
        if (!fechaInicio) missing.push('checkin');
        if (!fechaFin) missing.push('checkout');
        if (!nombreCliente) missing.push('huesped.nombre');
        if (!cliente?.email) missing.push('huesped.email');

        if (missing.length) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_FIELDS',
                missing,
                message: `Faltan campos obligatorios: ${missing.join(', ')}`,
            });
        }

        const emailTrim = String(cliente.email || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(emailTrim)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_EMAIL',
                message: 'El email del huésped no tiene un formato válido.',
            });
        }
        const telRaw = String(cliente.telefono || '').trim();
        if (telRaw && !/^\+?[\d\s\-]{8,}$/.test(telRaw)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_PHONE',
                message: 'El teléfono debe incluir al menos 8 dígitos (puede llevar + al inicio).',
            });
        }

        const inicio = parseISO(fechaInicio + 'T00:00:00Z');
        const fin    = parseISO(fechaFin    + 'T00:00:00Z');
        if (!isValid(inicio) || !isValid(fin) || inicio >= fin) {
            return res.status(400).json({ success: false, error: 'INVALID_DATES' });
        }

        // Sin alojamiento_id: mismo criterio que disponibilidad pública (tarifas + ocupación), devolver alternativas para que la IA elija.
        if (!propiedadId) {
            if (!pool) {
                return res.status(503).json({
                    success: false,
                    error: 'SERVICE_UNAVAILABLE',
                    message: 'Resolución de alternativas requiere PostgreSQL.',
                });
            }
            const dbFs = require('firebase-admin').firestore();
            const { availableProperties } = await getAvailabilityDataWeb(dbFs, empresaId, inicio, fin);
            const conCapacidad = (availableProperties || []).filter(
                (p) => (p.capacidad || 0) >= personas
            );
            const alternativas = conCapacidad.map((p) => ({
                alojamiento_id: p.id,
                nombre: p.nombre,
                capacidad: p.capacidad || 0,
            }));
            if (!alternativas.length) {
                return res.status(422).json({
                    success: false,
                    error: 'NO_DISPONIBLE',
                    message:
                        (availableProperties || []).length > 0
                            ? `Hay alojamientos libres en esas fechas, pero ninguno admite ${personas} huéspedes. Reduce personas o cambia fechas.`
                            : 'No hay alojamientos disponibles en esas fechas para esta empresa.',
                    personas_solicitadas: personas,
                    checkin: fechaInicio,
                    checkout: fechaFin,
                });
            }
            return res.status(422).json({
                success: false,
                error: 'ALOJAMIENTO_REQUERIDO',
                message:
                    'Indica alojamiento_id con uno de los alojamientos listados (misma petición + huésped y fechas) para confirmar la reserva.',
                alternativas,
                personas_solicitadas: personas,
                checkin: fechaInicio,
                checkout: fechaFin,
            });
        }

        // 1. Resolver catálogo -> unidad reservable (booking_id) + disponibilidad
        const unidad = await resolveBookingUnitForIa({
            pool,
            empresaRaw,
            empresaId,
            catalogId: propiedadId,
            checkin: fechaInicio,
            checkout: fechaFin,
            personas,
        });
        if (!unidad.ok && unidad.code === 'PROPERTY_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: 'PROPERTY_NOT_FOUND',
                message: 'No se encontró una unidad reservable para ese catalog_id en la empresa indicada.',
            });
        }
        if (!unidad.ok && unidad.code === 'NO_CAPACITY') {
            return res.status(422).json({
                success: false,
                error: 'NO_CAPACITY',
                message: `La unidad no admite ${personas} huéspedes.`,
                capacidad: unidad.capacidad || null,
            });
        }
        if (!unidad.ok) {
            return res.status(422).json({ success: false, error: unidad.code || 'RESOLVE_ERROR' });
        }
        if (!unidad.disponible) {
            return res.status(409).json({
                success: false,
                error: 'NOT_AVAILABLE',
                message: 'La propiedad no está disponible en esas fechas'
            });
        }
        propiedadId = unidad.booking_id;
        const propiedadNombre = unidad.nombre || '';

        // 2. Canal por defecto (el mismo que usa el sitio web)
        const { rows: canalRows } = await pool.query(
            `SELECT id, nombre FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
            [empresaId]
        );
        if (!canalRows[0]) {
            return res.status(422).json({ success: false, error: 'NO_CANAL', message: 'No hay canal por defecto configurado' });
        }
        const canalId   = canalRows[0].id;
        const canalNombre = canalRows[0].nombre;

        // 3. Precio vía tarifas PostgreSQL
        const db = require('firebase-admin').firestore();
        const valorDolar   = await obtenerValorDolar(db, empresaId, inicio);
        const allTarifas   = await obtenerTarifasParaConsumidores(empresaId);
        const precioCalc = await calculatePrice(
            db,
            empresaId,
            [{ id: propiedadId, nombre: propiedadNombre }],
            inicio,
            fin,
            allTarifas,
            canalId,
            valorDolar,
            false
        );
        const nightsFromDates = Math.max(1, Math.round((fin - inicio) / 86400000));
        let valorTotal = Math.round(Number(precioCalc?.totalPriceCLP) || 0);
        let pricingFallback = null;
        if (!valorTotal) {
            const fallback = resolvePrecioNocheReferencia(
                { id: propiedadId, empresa_id: empresaId, metadata: unidad.metadata || {} },
                allTarifas,
                new Map([[String(empresaId), { id: canalId, moneda: 'CLP' }]])
            );
            const precioNocheFallback = Math.round(Number(fallback.clp) || 0);
            if (precioNocheFallback > 0) {
                valorTotal = precioNocheFallback * nightsFromDates;
                pricingFallback = {
                    activo: true,
                    origen: fallback.origen || 'metadata.precioBase',
                    precio_noche_referencia_clp: precioNocheFallback,
                };
            } else {
                return res.status(422).json({
                    success: false,
                    error: 'NO_PRICING',
                    message: 'No hay tarifas configuradas para esta propiedad en esas fechas',
                });
            }
        }
        const senaPagar  = Math.round(valorTotal * 0.10);
        const vd             = valorDolar || 950;

        // 4. Cliente
        const { cliente: clienteCreado } = await crearOActualizarCliente(db, empresaId, {
            nombre: nombreCliente,
            email: cliente.email,
            telefono: cliente.telefono || '',
            canalNombre: canalNombre,
            idReservaCanal: null,
        });

        // 5. Insertar reserva directamente en PostgreSQL
        const { randomUUID } = require('crypto');
        const reservaId = randomUUID();
        const valores = {
            valorHuesped: valorTotal,
            valorTotal: Math.round(valorTotal / 1.19),
            iva: Math.round(valorTotal - valorTotal / 1.19),
            valorHuespedOriginal: Math.round(valorTotal / vd * 100) / 100,
            valorTotalOriginal:   Math.round(valorTotal / vd / 1.19 * 100) / 100,
            descuentoPct: 0, descuentoFijo: 0, valorFinalFijado: 0
        };

        const vencimientoPago = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
        const plazoAbonoTexto = new Date(vencimientoPago).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

        const estadoGestionInicial = await obtenerEstadoGestionInicialPostConfirmacionRow(empresaId);
        if (!estadoGestionInicial?.nombre) {
            return res.status(422).json({
                success: false,
                error: 'NO_ESTADO_GESTION',
                message:
                    'La empresa no tiene estados de gestión configurados en estados_reserva; no se puede registrar la reserva en el flujo operativo.',
            });
        }

        const estadoPrincipalConfirmadaIa = await obtenerEstadoPrincipalRowPorSemantica(empresaId, 'confirmada');
        const nombreEstadoPrincipalIa = estadoPrincipalConfirmadaIa?.nombre || 'Confirmada';

        const hasEstadoPrincipalId = await reservasTieneColumna('estado_principal_id');
        const hasEstadoGestionId = await reservasTieneColumna('estado_gestion_id');
        const reserva_guard_diag = await getChatgptReservaGuardDiag();

        const cols = [
            'empresa_id',
            'id_reserva_canal',
            'propiedad_id',
            'alojamiento_nombre',
            'canal_id',
            'canal_nombre',
            'cliente_id',
            'total_noches',
            'estado',
        ];
        const vals = [
            empresaId,
            reservaId,
            propiedadId,
            propiedadNombre,
            canalId,
            canalNombre,
            clienteCreado.id,
            precioCalc?.nights || nightsFromDates,
            nombreEstadoPrincipalIa,
        ];

        if (hasEstadoPrincipalId) {
            cols.push('estado_principal_id');
            vals.push(estadoPrincipalConfirmadaIa?.id || null);
        }

        cols.push('estado_gestion');
        vals.push(estadoGestionInicial.nombre);

        if (hasEstadoGestionId) {
            cols.push('estado_gestion_id');
            vals.push(estadoGestionInicial.id);
        }

        cols.push(
            'moneda',
            'valor_dolar_dia',
            'valores',
            'cantidad_huespedes',
            'fecha_llegada',
            'fecha_salida',
            'metadata'
        );
        vals.push(
            'CLP',
            vd,
            JSON.stringify(valores),
            personas,
            fechaInicio,
            fechaFin,
            JSON.stringify({
                origen: 'ia-reserva',
                agenteIA,
                estadoPago: 'pendiente',
                vencimientoPago,
                ...(pricingFallback ? { pricingFallback } : {}),
            })
        );

        const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
        await pool.query(
            `INSERT INTO reservas (${cols.join(',')}) VALUES (${placeholders})`,
            vals
        );

        // 6. Email de confirmación con plantilla o fallback HTML
        const { rows: empRows } = await pool.query('SELECT nombre, email, configuracion FROM empresas WHERE id = $1', [empresaId]);
        const empData = empRows[0] || {};
        const empresaNombre = empData.nombre || empresaId;
        const adminEmail    = empData.configuracion?.contactoEmail || empData.email || null;

        const dbFs = require('firebase-admin').firestore();
        const fmtCLP = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v || 0);
        const fmtFecha = (s) => new Date(s + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });

        // Construir texto de datos bancarios
        const db_ = empData.configuracion?.datosBancarios;
        const datosBancariosTexto = db_
            ? `Banco: ${db_.banco || ''} | ${db_.tipoCuenta || ''} N° ${db_.numeroCuenta || ''}\nTitular: ${db_.titular || ''} | RUT: ${db_.rut || ''}\nEmail transferencia: ${db_.email || adminEmail || ''}`
            : `Para recibir los datos de transferencia, contáctenos por WhatsApp o responda este correo.`;

        const plantillasDatos = {
            reservaId, propuestaId: reservaId, clienteNombre: nombreCliente,
            fechaLlegada: fmtFecha(fechaInicio), fechaSalida: fmtFecha(fechaFin),
            fechasEstadiaTexto: `${fmtFecha(fechaInicio)} al ${fmtFecha(fechaFin)}`,
            totalNoches: String(precioCalc?.nights || nightsFromDates), noches: String(precioCalc?.nights || nightsFromDates),
            personas: String(personas), nombrePropiedad: propiedadNombre,
            precioFinal: fmtCLP(valorTotal), montoTotal: fmtCLP(valorTotal),
            saldoPendiente: fmtCLP(valorTotal),
            porcentajeAbono: '10%', montoAbono: fmtCLP(senaPagar),
            resumenValores: `Total estadía: ${fmtCLP(valorTotal)}\nSeña 10%: ${fmtCLP(senaPagar)}`,
            empresaNombre,
            empresaWebsite: empData.configuracion?.websiteSettings?.general?.domain || '',
            contactoTelefono: empData.configuracion?.websiteSettings?.general?.whatsapp || '',
            contactoEmail: adminEmail || '',
            linkPago: '',
            datosBancarios: datosBancariosTexto,
            datosBancariosTexto,
            plazoAbono: plazoAbonoTexto,
            fechaVencimiento: plazoAbonoTexto,
        };

        const resultadoEmail = await enviarConfirmacionReservaIaEmail({
            db: dbFs,
            empresaId,
            clienteEmail: cliente.email,
            reservaId,
            plantillasDatos,
            fallbackData: {
                nombreCliente,
                nombrePropiedad: propiedadNombre,
                checkin: fechaInicio,
                checkout: fechaFin,
                noches: precioCalc?.nights || nightsFromDates,
                montoSena: senaPagar,
                datosBancariosTexto,
                plazoAbono: plazoAbonoTexto,
                empresaNombre,
            },
        });

        if (!resultadoEmail.sent) {
            console.warn(`[Reserva IA] Email NO enviado: ${resultadoEmail.reason || 'sin-detalle'}`);
        }
        const resultadoEmailAdmin = await enviarNotificacionAdminReservaIaEmail({
            db: dbFs,
            empresaId,
            reservaId,
            nombreCliente,
            clienteEmail: cliente.email,
            nombrePropiedad: propiedadNombre,
            checkin: fechaInicio,
            checkout: fechaFin,
            noches: precioCalc?.nights || nightsFromDates,
            montoSena: senaPagar,
            montoTotal: valorTotal,
        });
        if (!resultadoEmailAdmin.sent) {
            console.warn(`[Reserva IA] Email admin NO enviado: ${resultadoEmailAdmin.reason || 'sin-detalle'}`);
        }

        console.log(
            `✅ [Reserva IA] ${reservaId} — ${propiedadNombre} ${fechaInicio}→${fechaFin} | email→${cliente.email} sent=${resultadoEmail.sent} | vence: ${plazoAbonoTexto}`
        );

        return res.status(201).json({
            success: true,
            reserva: {
                id: reservaId,
                estado: 'Confirmada',
                checkin: fechaInicio,
                checkout: fechaFin,
                alojamiento: { id: propiedadId, nombre: propiedadNombre },
                huesped: { nombre: nombreCliente },
                total_noches: precioCalc.nights,
                fecha_creacion: new Date().toISOString()
            },
            email_enviado: Boolean(resultadoEmail.sent),
            email_destinatario: cliente.email,
            ...(resultadoEmail.sent ? {} : { email_error: resultadoEmail.reason || 'EMAIL_NOT_SENT' }),
            email_template_disparador: resultadoEmail.templateTrigger || 'reserva_confirmada',
            email_template_id: resultadoEmail.templateId || null,
            email_template_nombre: resultadoEmail.templateName || null,
            email_admin_enviado: Boolean(resultadoEmailAdmin.sent),
            email_admin_destinatario: adminEmail || null,
            ...(resultadoEmailAdmin.sent ? {} : { email_admin_error: resultadoEmailAdmin.reason || 'ADMIN_EMAIL_NOT_SENT' }),
            email_admin_template_disparador: resultadoEmailAdmin.templateTrigger || 'notificacion_interna',
            email_admin_template_id: resultadoEmailAdmin.templateId || null,
            email_admin_template_nombre: resultadoEmailAdmin.templateName || null,
            reserva_guard_diag,
            sugerencia_previa:
                'Opcional: antes de confirmar, POST /api/reservas/cotizar o POST /api/public/reservas/cotizar (mismos datos y cabeceras que la reserva) devuelve desglose económico y política de cancelación sin persistir.',
            mensaje: resultadoEmail.sent
                ? `Reserva confirmada. Se envió un correo a ${cliente.email} con los detalles y los datos para la transferencia. El huésped tiene 48 horas (hasta el ${plazoAbonoTexto}) para abonar el 10% de seña (${fmtCLP(senaPagar)}). Si no se recibe el pago, la reserva se anulará automáticamente.`
                : `Reserva confirmada, pero no se pudo enviar el correo a ${cliente.email}. Error: ${resultadoEmail.reason || 'EMAIL_NOT_SENT'}. El huésped tiene 48 horas (hasta el ${plazoAbonoTexto}) para abonar el 10% de seña (${fmtCLP(senaPagar)}).`,
        });

    } catch (error) {
        console.error('Error in createPublicReservation:', error.message);
        return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: error.message });
    }
};

const webhookMercadoPago = async (req, res) => {
    try {
        // TODO: Implementar lógica real de validación y confirmación de pago
        console.log('🔔 [Webhook MercadoPago] Notificación recibida:', JSON.stringify(req.body, null, 2));

        // Responder siempre 200 OK a MercadoPago para evitar reintentos
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error en webhookMercadoPago:', error);
        res.status(500).send('Error');
    }
};

const getVersion = async (req, res) => {
    try {
        const db = require('firebase-admin').firestore();
        const empresasSnap = await db.collection('empresas').get();
        const empresasIds = empresasSnap.docs.map(d => d.id);

        res.json({
            version: '1.0.3-env-check',
            commit: 'env-check',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            firebase: {
                projectId: require('firebase-admin').app().options.projectId || 'unknown',
                companiesFound: empresasSnap.size,
                companiesIds: empresasIds
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const recalculatePhotos = async (req, res) => {
    try {
        const { nombreEspacio, activos } = req.body;
        console.log(`[AI] Recalculando fotos para espacio: ${nombreEspacio} con ${activos?.length || 0} activos.`);

        const prompt = `
            Eres un fotógrafo experto en Real Estate y Airbnb.
            Tengo un espacio llamado "${nombreEspacio}" que contiene los siguientes activos/muebles:
            ${(activos || []).map(a => `- ${a.cantidad}x ${a.nombre}`).join('\n')}

            Genera una lista de "shotList" (tiros de cámara obligatorios) y "requerimientosFotos" (si aplica configuración avanzada).

            Devuelve JSON puro:
            {
                "shotList": ["Foto amplia desde la entrada", "Detalle de...", ...],
                "requerimientosFotos": [
                    { "activo": "Cama King", "obligatoria": true, "metadataSugerida": "Ángulo 45 grados, luz natural" }
                ]
            }
        `;

        try {
            const provider = getProvider();
            let json = null;

            if (provider) {
                json = await provider.generateJSON(prompt);
            }

            if (json) {
                return res.json({ meta: { ai_generated: true }, ...json });
            }

            res.json({
                meta: { ai_generated: false },
                shotList: ["Vista general", "Detalle de equipamiento"],
                requerimientosFotos: []
            });
        } catch (iaError) {
            console.error("[IA Error]", iaError);
            res.json({
                meta: { ai_generated: false },
                shotList: ["Vista general (Fallback)", "Detalle (Fallback)"],
                requerimientosFotos: []
            });
        }

    } catch (error) {
        console.error('[AI] Error recalculando fotos:', error);
        res.status(500).json({ error: error.message });
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
    webhookMercadoPago,
    getVersion,
    recalculatePhotos
};
