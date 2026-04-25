const pool = require('../db/postgres');
const { parseISO, isValid } = require('date-fns');
const { resolveEmpresaDbId } = require('./resolveEmpresaDbId');
const { fetchTarifasYCanal } = require('../routes/website.shared');
const { mergeEffectiveRules } = require('./houseRulesService');
const { obtenerResumenPorPropiedad } = require('./resenasService');
const {
    buildAgentPropertyDetailPayload,
    enrichPropertyRowsForPublicAi,
    resolvePrecioNocheReferencia,
} = require('./publicAiProductSnapshot');
const { mapEspacioToTipoIa, resolveGaleriaPrincipalIndex } = require('./publicAiMarketingLayer');
const {
    parseStayDatesForAgentDetalle,
    buildPrecioEstimadoDetallePublico,
} = require('./publicAiPrecioEstimadoService');
const { buildDisponibilidadAgentResponse } = require('./publicAiDisponibilidadService');

const resolveEmpresaPgId = resolveEmpresaDbId;

function _cardMatchesAnyVibe(card, vibes) {
    const chunks = [
        card.nombre,
        card.descripcion,
        ...(card.amenidades_publicas || []),
        ...(card.contexto_turistico?.tipo_viaje || []),
        ...(card.contexto_turistico?.entorno || []),
        ...(card.contexto_turistico?.destacados || []),
        ...(card.amenidades || []).slice(0, 40),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return vibes.some((v) => {
        const needle = v.replace(/_/g, ' ');
        if (chunks.includes(v) || chunks.includes(needle)) return true;
        if (v === 'naturaleza' && /bosque|naturaleza|montaña|montana|lago|río|rio|sendero|volcán|volcan/.test(chunks))
            return true;
        if (v === 'wifi' && /wifi|wi-?fi|internet/.test(chunks)) return true;
        if (v === 'tinaja' && /tinaja|hidromasaje|jacuzzi|hot\s*tub/.test(chunks)) return true;
        if ((v === 'rio' || v === 'río') && /río|rio|fluvial|ribereñ|river/.test(chunks)) return true;
        if (v === 'mascotas' && /mascota|pet/.test(chunks)) return true;
        return chunks.includes(needle.replace(/-/g, ' '));
    });
}

function _filtrarResultadosPorVibes(resultados, vibeRaw) {
    const vibes = String(vibeRaw || '')
        .split(/[,+]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    if (!vibes.length) return resultados;
    return resultados.filter((card) => _cardMatchesAnyVibe(card, vibes));
}

exports.disponibilidad = async (req, res) => {
    try {
        const empresaIdRaw = req.query.empresa_id || req.query.empresaId;
        const checkin      = req.query.checkin  || req.query.fechaLlegada;
        const checkout     = req.query.checkout || req.query.fechaSalida;
        const personas     = parseInt(req.query.adultos || req.query.personas || 0);

        if (!empresaIdRaw || !checkin || !checkout) {
            return res.status(400).json({ error: 'Requeridos: empresa_id, checkin, checkout' });
        }
        if (!pool) return res.status(503).json({ error: 'PostgreSQL requerido para disponibilidad enriquecida' });

        const inicio = parseISO(checkin + 'T00:00:00Z');
        const fin    = parseISO(checkout + 'T00:00:00Z');
        if (!isValid(inicio) || !isValid(fin) || inicio >= fin) {
            return res.status(400).json({ error: 'Fechas inválidas' });
        }

        const empresaId = await resolveEmpresaPgId(empresaIdRaw);

        const payload = await buildDisponibilidadAgentResponse({
            empresaIdRaw,
            empresaId,
            checkin,
            checkout,
            personas,
            inicio,
            fin,
        });
        return res.json(payload);
    } catch (error) {
        console.error('[disponibilidad]', error.stack || error.message);
        return res.status(500).json({ error: 'Error al consultar disponibilidad' });
    }
};

exports.detalle = async (req, res) => {
    try {
        const alojamientoId = req.query.alojamiento_id;
        if (!alojamientoId) return res.status(400).json({ error: 'Requerido: alojamiento_id' });
        if (!pool) return res.status(503).json({ error: 'PostgreSQL requerido' });

        const { rows } = await pool.query(
            `SELECT p.id, p.nombre, p.capacidad, p.descripcion, p.metadata, p.empresa_id,
                    e.nombre AS empresa_nombre, e.configuracion
               FROM propiedades p
               JOIN empresas e ON e.id = p.empresa_id
              WHERE p.id = $1::text AND p.activo = true
              LIMIT 1`,
            [alojamientoId]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Alojamiento no encontrado' });

        const row = rows[0];
        const empresaConfig =
            row.configuracion && typeof row.configuracion === 'object' ? row.configuracion : {};
        const empresaHouseRules = empresaConfig.websiteSettings?.houseRules || null;
        const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const mergedRules = mergeEffectiveRules(empresaHouseRules, meta.normasAlojamiento || {});

        const [{ rows: galRows }, resumenResenas, { allTarifas, canalPorDefectoId, canalMoneda }] =
            await Promise.all([
                pool.query(
                    `SELECT storage_url, thumbnail_url, alt_text, rol, orden, espacio
                       FROM galeria
                      WHERE propiedad_id::text = $1::text
                        AND estado IN ('auto', 'manual')
                      ORDER BY (rol = 'principal') DESC, orden ASC NULLS LAST, id ASC
                      LIMIT 40`,
                    [String(row.id)]
                ),
                obtenerResumenPorPropiedad(row.empresa_id, row.id),
                fetchTarifasYCanal(row.empresa_id),
            ]);

        const defaultCanalByEmpresa = new Map();
        if (canalPorDefectoId) {
            defaultCanalByEmpresa.set(String(row.empresa_id), {
                id: canalPorDefectoId,
                moneda: canalMoneda || 'CLP',
            });
        }
        const rowForPrecio = {
            id: row.id,
            empresa_id: row.empresa_id,
            metadata: row.metadata,
        };
        const { clp: precioFinal, origen: precioOrigen } = resolvePrecioNocheReferencia(
            rowForPrecio,
            allTarifas,
            defaultCanalByEmpresa
        );

        const stay = parseStayDatesForAgentDetalle(req.query);
        let precio_estimado = null;
        if (stay) {
            try {
                const adultos = parseInt(req.query.adultos || req.query.personas || '2', 10);
                precio_estimado = await buildPrecioEstimadoDetallePublico({
                    empresaId: String(row.empresa_id),
                    propiedadId: String(row.id),
                    nombrePropiedad: row.nombre,
                    inicio: stay.inicio,
                    fin: stay.fin,
                    moneda: canalMoneda || 'CLP',
                    legal: empresaConfig.websiteSettings?.legal,
                    adultos,
                    capacidadMax: row.capacidad,
                });
            } catch (peErr) {
                console.warn('[detalle] precio_estimado:', peErr.message);
                precio_estimado = { calculo_ok: false, codigo: 'ERROR', mensaje: peErr.message };
            }
        }

        const aviso_precio_estimado = stay
            ? null
            : {
                  requiere_query: ['checkin', 'checkout'],
                  mensaje:
                      'Para total de estadía, noches, promedio por noche y desglose referencial (incl. extras de checkout), envía checkin y checkout en YYYY-MM-DD. Opcional: adultos o personas.',
              };

        const payload = buildAgentPropertyDetailPayload({
            row: {
                id: row.id,
                nombre: row.nombre,
                capacidad: row.capacidad,
                descripcion: row.descripcion,
                metadata: row.metadata,
                empresa_id: row.empresa_id,
                empresa_nombre: row.empresa_nombre,
            },
            galeriaRows: galRows,
            resumenResenas,
            precioNocheReferencia: precioFinal,
            moneda: canalMoneda || 'CLP',
            mergedRules,
            precioOrigen,
            precio_estimado,
            empresaConfig,
            aviso_precio_estimado,
        });

        return res.json(payload);
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

exports.cotizarReserva = async (req, res) => {
    try {
        if (req.body?.empresa_id) {
            req.body.empresa_id = await resolveEmpresaPgId(req.body.empresa_id);
        }
        const { cotizarReservaIaPublica } = require('./publicAiReservaCotizacionService');
        const result = await cotizarReservaIaPublica(req.body || {});
        return res.status(result.http).json(result.body);
    } catch (error) {
        console.error('[cotizarReserva]', error.message);
        return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
    }
};

exports.crearReserva = async (req, res) => {
    if (req.body?.empresa_id) {
        req.body.empresa_id = await resolveEmpresaPgId(req.body.empresa_id);
    }
    const publicAiController = require('../controllers/publicAiController');
    return publicAiController.createPublicReservation(req, res);
};

exports.busquedaGeneral = async (req, res) => {
    try {
        if (!pool) {
            return res.status(503).json({ error: 'PostgreSQL requerido para búsqueda enriquecida' });
        }
        const q =
            (req.query.q || req.query.destino || '').trim();
        const checkin = req.query.checkin;
        const checkout = req.query.checkout;
        const personas = parseInt(String(req.query.personas || req.query.adultos || '0'), 10) || 0;
        const limRaw = parseInt(String(req.query.limit || '15'), 10) || 15;
        const limit = Math.min(Math.max(limRaw, 1), 20);

        const { rows } = await pool.query(
            `SELECT p.id, p.nombre, p.capacidad, p.descripcion, p.metadata, p.empresa_id,
                    e.nombre AS empresa_nombre, e.configuracion AS empresa_configuracion
             FROM propiedades p
             JOIN empresas e ON p.empresa_id = e.id
             WHERE p.activo = true
               AND (
                 $1::text = ''
                 OR p.nombre ILIKE $2
                 OR e.nombre ILIKE $2
                 OR COALESCE(p.descripcion, '') ILIKE $2
               )
               AND ($3 = 0 OR p.capacidad >= $3)
             ORDER BY e.nombre ASC, p.nombre ASC
             LIMIT $4`,
            [q, `%${q}%`, personas, limit]
        );

        const compact =
            req.query.compact !== '0' &&
            req.query.compact !== 'false' &&
            String(req.query.compact).toLowerCase() !== 'full';
        let resultados = await enrichPropertyRowsForPublicAi(rows, { compact });
        const vibeRaw = req.query.vibe || req.query.vibes || '';
        resultados = _filtrarResultadosPorVibes(resultados, vibeRaw);

        return res.json({
            success: true,
            total: resultados.length,
            resultados,
            meta: {
                limit,
                compact,
                payload: 'producto_ia_v2',
                checkin: checkin || null,
                checkout: checkout || null,
                personas,
                vibe: String(vibeRaw || '').trim() || null,
            },
        });
    } catch (error) {
        console.error('[busquedaGeneral]', error.message);
        return res.status(500).json({ error: 'Error en búsqueda general' });
    }
};

exports.imagenes = async (req, res) => {
    try {
        const alojamientoId = req.query.alojamiento_id;
        if (!alojamientoId) return res.status(400).json({ error: 'Requerido: alojamiento_id' });
        if (!pool) return res.status(503).json({ error: 'PostgreSQL requerido' });

        const [{ rows }, metaRes] = await Promise.all([
            pool.query(
                `SELECT storage_url, thumbnail_url, alt_text, rol, orden, espacio
                   FROM galeria
                  WHERE propiedad_id::text = $1::text
                    AND estado IN ('auto', 'manual')
                  ORDER BY (rol = 'principal') DESC, orden ASC NULLS LAST
                  LIMIT 20`,
                [String(alojamientoId)]
            ),
            pool.query(`SELECT metadata FROM propiedades WHERE id::text = $1::text LIMIT 1`, [
                String(alojamientoId),
            ]),
        ]);
        const meta =
            metaRes.rows[0]?.metadata && typeof metaRes.rows[0].metadata === 'object'
                ? metaRes.rows[0].metadata
                : {};
        const principalIdx = resolveGaleriaPrincipalIndex(rows, meta);

        return res.json({
            success: true,
            total: rows.length,
            fotos: rows.map((r, idx) => {
                const espacioLabel = (r.espacio && String(r.espacio).trim()) || '';
                const rol = r.rol || 'adicional';
                const alt = r.alt_text || '';
                return {
                    url: r.storage_url,
                    descripcion: alt,
                    tipo: rol,
                    espacio: espacioLabel || null,
                    tipo_ia: mapEspacioToTipoIa(espacioLabel, rol, alt),
                    orden: r.orden != null ? Number(r.orden) : idx + 1,
                    principal: principalIdx >= 0 && idx === principalIdx,
                };
            }),
        });
    } catch (error) {
        console.error('[imagenes]', error.message);
        return res.status(500).json({ error: 'Error al obtener imágenes' });
    }
};

exports.agentConfig = async (req, res) => {
    try {
        const empresaIdRaw = req.query.empresa_id;
        if (!empresaIdRaw) return res.status(400).json({ error: 'Requerido: empresa_id' });

        const empresaId = await resolveEmpresaPgId(empresaIdRaw);
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
