const { obtenerPropiedadesPorEmpresa, obtenerPropiedadPorId } = require('../services/publicWebsiteService');
const { hydrateInventory, calcularCapacidad } = require('../services/propiedadLogicService');
const { getAvailabilityData } = require('../services/propuestasService');
const { calculatePrice } = require('../services/utils/calculoValoresService');
const { obtenerCanalesPorEmpresa, crearCanal } = require('../services/canalesService');
const { obtenerValorDolar } = require('../services/dolarService');
const { guardarOActualizarPropuesta } = require('../services/gestionPropuestasService');
const { crearPreferencia } = require('../services/mercadopagoService');
const { obtenerPlantillasPorEmpresa } = require('../services/plantillasService');
const { format, addDays, parseISO, isValid } = require('date-fns');
const { crearOActualizarCliente } = require('../services/clientesService');
const { getProvider } = require('../services/aiContentService.providers');

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
        const db = require('firebase-admin').firestore();
        const { id } = req.params;
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
            offset = 0,
            empresaId // [NEW] Support for filtering by company via query param
        } = req.query;

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
            paso_2: `GET /api/public/propiedades/${propertyDoc.id}/cotizar?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD`,
            paso_3: `POST /api/public/reservas`,
            paso_3_body: {
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

        const startDate = parseISO(fechaLlegada + 'T00:00:00Z');
        const endDate = parseISO(fechaSalida + 'T00:00:00Z');

        if (!isValid(startDate) || !isValid(endDate)) {
            return res.status(400).json({ error: "Invalid dates." });
        }

        let canales = await obtenerCanalesPorEmpresa(db, targetEmpresaId);
        let iaChannel = canales.find(c => c.nombre === 'ia-reserva');

        if (!iaChannel) {
            iaChannel = await crearCanal(db, targetEmpresaId, {
                nombre: 'ia-reserva',
                tipo: 'Directo',
                comision: 0,
                origen: 'ia',
                moneda: 'CLP',
                color: '#8e44ad'
            });
        }

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

        // Verificar bloqueos antes de crear la reserva
        const bloqueosSnap = await db.collection('empresas').doc(targetEmpresaId).collection('bloqueos')
            .where('fechaFin', '>=', require('firebase-admin').firestore.Timestamp.fromDate(startDate))
            .get();
        const bloqueado = bloqueosSnap.docs.some(doc => {
            const b = doc.data();
            if (b.fechaInicio.toDate() >= endDate) return false;
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

        const reservaId = db.collection('empresas').doc(targetEmpresaId).collection('reservas').doc().id;
        const paymentLink = await crearPreferencia(targetEmpresaId, reservaId, `Reserva 10%: ${propertyName}`, montoSeña, 'CLP');

        const plantillas = await obtenerPlantillasPorEmpresa(db, targetEmpresaId);
        const plantilla = plantillas.find(p => p.nombre === 'Plantilla Predeterminada' && p.enviarPorEmail) || plantillas.find(p => p.enviarPorEmail);
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
            linkPago: paymentLink
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

        const availabilityData = await getAvailabilityData(db, empresaId, inicio, fin, false, null);
        const isAvailable = availabilityData.availableProperties.some(p => p.id === id);

        if (!isAvailable) {
            return res.status(409).json({
                error: 'Propiedad no disponible para las fechas solicitadas',
                code: 'NOT_AVAILABLE'
            });
        }

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

        const [reservasSnapshot, bloqueosSnapshot] = await Promise.all([
            db.collection('empresas').doc(empresaId).collection('reservas')
                .where('alojamientoId', '==', id)
                .where('estado', '==', 'Confirmada')
                .get(),
            db.collection('empresas').doc(empresaId).collection('bloqueos')
                .where('fechaFin', '>=', require('firebase-admin').firestore.Timestamp.fromDate(inicio))
                .get()
        ]);

        const bloqueado = bloqueosSnapshot.docs.some(doc => {
            const b = doc.data();
            const bInicio = b.fechaInicio.toDate();
            if (bInicio >= fin) return false;
            return b.todos || (b.alojamientoIds || []).includes(id);
        });

        if (bloqueado) {
            return res.json(formatResponse({
                disponible: false,
                conflictos: [],
                totalConflictos: 0,
                mensaje: 'La propiedad está bloqueada por mantenimiento en las fechas solicitadas'
            }));
        }

        const conflictos = reservasSnapshot.docs
            .filter(doc => {
                const data = doc.data();
                const rLlegada = data.fechaLlegada.toDate();
                const rSalida = data.fechaSalida.toDate();
                return rLlegada < fin && rSalida > inicio;
            })
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
        const db = require('firebase-admin').firestore();
        const body = req.body;

        // Acepta formato nuevo (propiedadId/fechaInicio) y formato ChatGPT (alojamiento_id/checkin/huesped)
        const propiedadId   = body.propiedadId   || body.alojamiento_id;
        const fechaInicio   = body.fechaInicio   || body.fechaInicio  || body.checkin;
        const fechaFin      = body.fechaFin      || body.checkout;
        const cliente       = body.cliente       || body.huesped;
        const numeroHuespedes = body.numeroHuespedes
            ?? (body.adultos != null ? (Number(body.adultos) + Number(body.ninos || 0)) : undefined);
        const notas         = body.notas         || body.comentarios  || '';
        const agenteIA      = req.agentName      || body.agenteIA     || body.origen || 'Desconocido';

        if (!propiedadId || !fechaInicio || !fechaFin || !cliente?.email || !cliente?.nombre) {
            return res.status(400).json({
                error: 'Campos requeridos: propiedadId (o alojamiento_id), fechaInicio (o checkin), fechaFin (o checkout), cliente.nombre, cliente.email'
            });
        }

        const inicio = parseISO(fechaInicio + 'T00:00:00Z');
        const fin = parseISO(fechaFin + 'T00:00:00Z');

        if (!isValid(inicio) || !isValid(fin) || inicio >= fin) {
            return res.status(400).json({ error: 'Fechas inválidas' });
        }

        const propDoc = await findPropertyById(db, propiedadId);

        if (!propDoc) {
            return res.status(404).json({ error: 'Propiedad no encontrada' });
        }

        const propData = propDoc.data();
        const empresaId = propDoc.ref.parent.parent.id;

        const availabilityData = await getAvailabilityData(db, empresaId, inicio, fin, false, null);
        const isAvailable = availabilityData.availableProperties.some(p => p.id === propiedadId);

        if (!isAvailable) {
            return res.status(409).json({
                error: 'Propiedad no disponible',
                code: 'NOT_AVAILABLE'
            });
        }

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

        const resultadoCliente = await crearOActualizarCliente(db, empresaId, {
            nombre: cliente.nombre,
            email: cliente.email,
            telefono: cliente.telefono || '',
            canalNombre: 'IA Reserva',
            idReservaCanal: null
        });

        const clienteId = resultadoCliente.cliente.id;

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

        const linkPago = await crearPreferencia(
            empresaId,
            propuestaCreada.id,
            `Seña reserva ${propData.nombre} - ${precioCalculado.nights} noches`,
            senaPagar,
            'CLP'
        );

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
