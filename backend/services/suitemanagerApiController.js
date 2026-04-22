const pool = require('../db/postgres');
const { parseISO, isValid } = require('date-fns');
const { getAvailabilityData } = require('./publicWebsiteService');

exports.disponibilidad = async (req, res) => {
    try {
        const empresaId = req.query.empresa_id || req.query.empresaId;
        const checkin   = req.query.checkin  || req.query.fechaLlegada;
        const checkout  = req.query.checkout || req.query.fechaSalida;
        const personas  = parseInt(req.query.adultos || req.query.personas || 0);

        if (!empresaId || !checkin || !checkout) {
            return res.status(400).json({ error: 'Requeridos: empresa_id, checkin, checkout' });
        }

        const inicio = parseISO(checkin + 'T00:00:00Z');
        const fin    = parseISO(checkout + 'T00:00:00Z');
        if (!isValid(inicio) || !isValid(fin) || inicio >= fin) {
            return res.status(400).json({ error: 'Fechas inválidas' });
        }

        const db = require('firebase-admin').firestore();
        const { availableProperties, unavailableProperties } = await getAvailabilityData(db, empresaId, inicio, fin);

        let disponibles = availableProperties;
        if (personas > 0) disponibles = disponibles.filter(p => (p.capacidad || 0) >= personas);

        return res.json({
            success: true,
            empresa_id: empresaId,
            checkin,
            checkout,
            total: availableProperties.length + unavailableProperties.length,
            disponibles: disponibles.length,
            alojamientos: [
                ...disponibles.map(p => ({ id: p.id, nombre: p.nombre, disponible: true, capacidad: p.capacidad || 0 })),
                ...unavailableProperties.map(p => ({ id: p.id, nombre: p.nombre, disponible: false, capacidad: p.capacidad || 0 }))
            ]
        });
    } catch (error) {
        console.error('[disponibilidad]', error.message);
        return res.status(500).json({ error: 'Error al consultar disponibilidad' });
    }
};

exports.detalle = async (req, res) => {
    try {
        const alojamientoId = req.query.alojamiento_id;
        if (!alojamientoId) return res.status(400).json({ error: 'Requerido: alojamiento_id' });

        const { rows } = await pool.query(
            'SELECT id, nombre, capacidad, descripcion FROM propiedades WHERE id = $1 AND activo = true LIMIT 1',
            [alojamientoId]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Alojamiento no encontrado' });

        const p = rows[0];
        return res.json({ success: true, id: p.id, nombre: p.nombre, capacidad: p.capacidad, descripcion: p.descripcion || '' });
    } catch (error) {
        console.error('[detalle]', error.message);
        return res.status(500).json({ error: 'Error al obtener detalle' });
    }
};

exports.alternativas = async (req, res) => {
    try {
        const destino = req.query.destino || req.query.ubicacion || '';

        const { rows } = await pool.query(
            `SELECT p.id, p.nombre, p.capacidad, e.id AS empresa_id
             FROM propiedades p JOIN empresas e ON p.empresa_id = e.id
             WHERE p.activo = true
               AND ($1 = '' OR p.nombre ILIKE $2 OR e.nombre ILIKE $2)
             LIMIT 10`,
            [destino, `%${destino}%`]
        );

        return res.json({ success: true, alojamientos: rows.map(r => ({ id: r.id, nombre: r.nombre, capacidad: r.capacidad, empresa_id: r.empresa_id })) });
    } catch (error) {
        console.error('[alternativas]', error.message);
        return res.status(500).json({ error: 'Error al buscar alternativas' });
    }
};

exports.crearReserva = async (req, res) => {
    const publicAiController = require('../controllers/publicAiController');
    return publicAiController.createPublicReservation(req, res);
};

exports.busquedaGeneral = async (req, res) => {
    try {
        const q        = req.query.q || '';
        const checkin  = req.query.checkin;
        const checkout = req.query.checkout;
        const personas = parseInt(req.query.personas || 0);

        const { rows } = await pool.query(
            `SELECT p.id, p.nombre, p.capacidad, e.id AS empresa_id, e.nombre AS empresa_nombre
             FROM propiedades p JOIN empresas e ON p.empresa_id = e.id
             WHERE p.activo = true
               AND ($1 = '' OR p.nombre ILIKE $2 OR e.nombre ILIKE $2)
               AND ($3 = 0 OR p.capacidad >= $3)
             ORDER BY p.nombre LIMIT 20`,
            [q, `%${q}%`, personas]
        );

        return res.json({ success: true, total: rows.length, resultados: rows });
    } catch (error) {
        console.error('[busquedaGeneral]', error.message);
        return res.status(500).json({ error: 'Error en búsqueda general' });
    }
};

exports.imagenes = async (req, res) => {
    try {
        const alojamientoId = req.query.alojamiento_id;
        if (!alojamientoId) return res.status(400).json({ error: 'Requerido: alojamiento_id' });

        const { rows } = await pool.query(
            'SELECT storage_url, alt_text, rol FROM galeria WHERE propiedad_id = $1 AND estado = $2 ORDER BY orden ASC LIMIT 20',
            [alojamientoId, 'activo']
        );

        return res.json({ success: true, total: rows.length, fotos: rows.map(r => ({ url: r.storage_url, descripcion: r.alt_text || '', tipo: r.rol || 'general' })) });
    } catch (error) {
        console.error('[imagenes]', error.message);
        return res.status(500).json({ error: 'Error al obtener imágenes' });
    }
};

exports.agentConfig = async (req, res) => {
    try {
        const empresaId = req.query.empresa_id;
        if (!empresaId) return res.status(400).json({ error: 'Requerido: empresa_id' });

        const { rows } = await pool.query(
            'SELECT nombre FROM empresas WHERE id = $1 LIMIT 1',
            [empresaId]
        );

        const nombreEmpresa = rows[0]?.nombre || empresaId;

        const instrucciones = `Eres el asistente oficial de ${nombreEmpresa}. Ayuda a huéspedes a consultar disponibilidad, ver detalles y gestionar reservas. No inventes información. Usa siempre las Actions. Responde en español con tono cálido.`;

        return res.json({ empresa_id: empresaId, nombre_empresa: nombreEmpresa, instrucciones });
    } catch (error) {
        console.error('[agentConfig]', error.message);
        return res.status(500).json({ error: 'Error al obtener configuración' });
    }
};
