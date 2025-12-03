const publicAiController = require("../controllers/publicAiController");

// Wrapper para reutilizar la lógica de publicAiController
// Mapea los parámetros de la API de ChatGPT a lo que espera el controlador existente

exports.disponibilidad = async (req, res) => {
    // ChatGPT envía empresa_id, checkin, checkout, adultos
    // publicAiController espera empresaId, fechaLlegada, fechaSalida, capacidad

    if (req.query.empresa_id) {
        req.query.empresaId = req.query.empresa_id;
    }
    if (req.query.checkin) {
        req.query.fechaLlegada = req.query.checkin;
    }
    if (req.query.checkout) {
        req.query.fechaSalida = req.query.checkout;
    }
    if (req.query.adultos) {
        req.query.capacidad = req.query.adultos;
    }

    return publicAiController.getProperties(req, res);
};

exports.detalle = async (req, res) => {
    // ChatGPT envía alojamiento_id
    // publicAiController espera req.params.id

    if (req.query.alojamiento_id) {
        req.params.id = req.query.alojamiento_id;
    }

    return publicAiController.getPropertyDetail(req, res);
};

exports.alternativas = async (req, res) => {
    // ChatGPT envía destino, checkin, checkout
    // publicAiController espera ubicacion, fechaLlegada, fechaSalida

    if (req.query.destino) {
        req.query.ubicacion = req.query.destino;
    }
    if (req.query.checkin) {
        req.query.fechaLlegada = req.query.checkin;
    }
    if (req.query.checkout) {
        req.query.fechaSalida = req.query.checkout;
    }

    // Alternativas es una búsqueda global (sin empresaId) filtrada por ubicación
    return publicAiController.getProperties(req, res);
};

exports.crearReserva = async (req, res) => {
    // ChatGPT envía body con snake_case
    // publicAiController espera body con camelCase o lo maneja internamente
    // Vamos a verificar createReservation en publicAiController
    // Asumimos que createReservation maneja la lógica, pero tal vez necesitemos adaptar el body

    // Mapeo de campos si es necesario
    /*
    Body esperado por ChatGPT:
    {
        empresa_id, alojamiento_id, checkin, checkout, adultos, ninos, origen, huesped: { ... }
    }
    */

    // Si publicAiController espera otros nombres, los mapeamos aqui.
    // Por ahora pasamos el request directo, asumiendo que el controller es robusto o que los nombres coinciden
    // (createReservation suele esperar propertyId, startDate, endDate, guestDetails)

    // IMPORTANTE: publicAiController.createReservation podría no estar exportado o implementado como esperamos.
    // Si falla, tendremos que implementarlo aquí.

    // IMPORTANTE: publicAiController.createReservation podría no estar exportado o implementado como esperamos.
    // Si falla, tendremos que implementarlo aquí.

    return publicAiController.createReservation(req, res);
};

exports.busquedaGeneral = async (req, res) => {
    // Endpoint: /ai/busqueda-general
    // Parámetros: destino, checkin, checkout, adultos, ninos, habitaciones

    // Mapeo de parámetros a publicAiController.getProperties
    if (req.query.destino) req.query.ubicacion = req.query.destino;
    if (req.query.checkin) req.query.fechaLlegada = req.query.checkin;
    if (req.query.checkout) req.query.fechaSalida = req.query.checkout;
    if (req.query.adultos) req.query.capacidad = req.query.adultos;

    // Forzar búsqueda global (asegurar que no haya empresaId si es búsqueda general)
    delete req.query.empresaId;
    delete req.params.id;

    // Interceptamos la respuesta para formatearla según requerimiento
    const originalJson = res.json;
    res.json = (body) => {
        // Restaurar res.json original para futuras llamadas
        res.json = originalJson;

        if (!body || !body.data) {
            return originalJson.call(res, { success: false, resultados: [] });
        }

        const resultados = body.data.map(prop => ({
            empresaId: prop.empresa?.id,
            nombre: prop.empresa?.nombre,
            alojamientoId: prop.id,
            titulo: prop.titulo || prop.nombre || 'Alojamiento',
            precio: prop.precioBase || 0,
            imagenPrincipal: prop.imagenesDestacadas?.[0]?.url || ''
        }));

        return originalJson.call(res, {
            success: true,
            resultados: resultados
        });
    };

    return publicAiController.getProperties(req, res);
};

exports.imagenes = async (req, res) => {
    // Endpoint: /api/alojamientos/imagenes
    // Parámetros: empresa_id, alojamiento_id

    const alojamientoId = req.query.alojamiento_id;
    if (!alojamientoId) {
        return res.status(400).json({ error: "Missing alojamiento_id" });
    }

    // Usamos getPropertyDetail pero interceptamos para formatear
    req.params.id = alojamientoId;

    const originalJson = res.json;
    res.json = (body) => {
        res.json = originalJson;

        if (!body || !body.imagenesDestacadas) { // Asumiendo estructura de getPropertyDetail
            // Si getPropertyDetail devuelve la estructura completa de la propiedad en body (sin wrapper data en algunos casos, o dentro de data)
            // Revisando publicAiController.getPropertyDetail, devuelve formatResponse(sanitizedProperty) -> { meta, data: property }
            // Ojo: getPropertyDetail en publicAiController devuelve formatResponse({ ...sanitizedProperty, ... }) ? 
            // Revisemos el código de publicAiController:
            // res.json(formatResponse({ ...sanitizedProperty, imagenesDestacadas: enrichedImages ... }));
            // Entonces body.data contiene la propiedad.
        }

        const propData = body.data || body;

        const categorias = {
            dormitorio: [],
            bano: [], // Evitar ñ en claves JSON por compatibilidad
            cocina: [],
            living: [],
            exterior: [],
            otros: []
        };

        const images = propData.imagenesDestacadas || [];
        // Si hay más imágenes en websiteData que no están en imagenesDestacadas (que solo trae 5), 
        // idealmente deberíamos acceder a todas. getPropertyDetail ya procesa 'enrichedImages'.
        // Pero getPropertyDetail podría estar limitando o no. 
        // Asumiremos que propData tiene las imágenes procesadas.

        // Si publicAiController devuelve todas las imágenes en alguna propiedad, las usamos.
        // Si no, trabajamos con lo que hay.

        images.forEach(img => {
            const cat = img.category ? img.category.toLowerCase() : 'general';
            const url = img.url;

            if (cat.includes('dormitorio') || cat.includes('habitacion')) categorias.dormitorio.push(url);
            else if (cat.includes('baño') || cat.includes('bano')) categorias.bano.push(url);
            else if (cat.includes('cocina')) categorias.cocina.push(url);
            else if (cat.includes('living') || cat.includes('sala')) categorias.living.push(url);
            else if (cat.includes('exterior') || cat.includes('patio') || cat.includes('jardin') || cat.includes('piscina')) categorias.exterior.push(url);
            else categorias.otros.push(url);
        });

        return originalJson.call(res, {
            success: true,
            categorias: categorias
        });
    };

    return publicAiController.getPropertyDetail(req, res);
};

exports.agentConfig = async (req, res) => {
    // Endpoint: /api/agent-config
    // Parámetros: empresa_id

    const empresaId = req.query.empresa_id;
    if (!empresaId) {
        return res.status(400).json({ error: "Missing empresa_id" });
    }

    try {
        const db = require('firebase-admin').firestore();
        const { obtenerDetallesEmpresa } = require('./empresaService'); // Asegurar importación correcta o usar db directo

        // Usamos db directo para evitar dependencias circulares si no están disponibles
        const empresaDoc = await db.collection('empresas').doc(empresaId).get();

        if (!empresaDoc.exists) {
            return res.status(404).json({ error: "Empresa no encontrada" });
        }

        const empresaData = empresaDoc.data();
        const nombreEmpresa = empresaData.nombreFantasia || empresaData.razonSocial || empresaData.nombre || 'Empresa';

        // Generar instrucciones dinámicas
        const instructions = `
Eres el asistente oficial de ${nombreEmpresa}.
Responde con tono cálido y profesional.
Usa siempre las Actions de SuiteManager para consultar disponibilidad, precios y detalles.
No inventes datos que no provengan de la API.
Si el usuario pregunta por disponibilidad, usa getProperties con las fechas indicadas.
Si el usuario quiere reservar, guíalo para obtener los datos necesarios y usa crearReserva.
        `.trim();

        // Generar manifiesto dinámico
        const manifest = {
            name: `${nombreEmpresa} — Asistente IA`,
            description: `Concierge virtual de ${nombreEmpresa}`,
            instructions: instructions,
            actions: {
                openapi_url: "https://suite-manager.onrender.com/openapi-chatgpt.yaml"
            }
        };

        return res.json({
            empresa_id: empresaId,
            nombre_empresa: nombreEmpresa,
            instrucciones: instructions,
            manifiesto: manifest
        });

    } catch (error) {
        console.error("Error in agentConfig:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
