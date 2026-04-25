// backend/services/resenasService.js
const pool = require('../db/postgres');
const { sqlReservaPrincipalSemanticaIgual } = require('./estadosService');
const { getSSROptimizedData } = require('./buildContextService');
const { registrarComunicacion } = require('./comunicacionesService');

/** propiedades.id / reservas.propiedad_id son slugs (texto); la tabla vieja tiene uuid y rompe INSERT/UPDATE. */
let _ensurePropiedadTextPromise;

async function _ensureResenasPropiedadIdTextColumn() {
    if (!pool) return;
    if (_ensurePropiedadTextPromise) return _ensurePropiedadTextPromise;
    _ensurePropiedadTextPromise = (async () => {
        const { rows } = await pool.query(
            `SELECT udt_name FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'resenas'
               AND column_name = 'propiedad_id'`
        );
        if (!rows[0]) return;
        if (String(rows[0].udt_name || '').toLowerCase() !== 'uuid') return;
        await pool.query(
            `ALTER TABLE resenas
             ALTER COLUMN propiedad_id TYPE TEXT USING propiedad_id::text`
        );
        console.warn('[resenasService] resenas.propiedad_id migrado UUID → TEXT (compatible con slugs).');
    })().catch((e) => {
        _ensurePropiedadTextPromise = null;
        const msg = String(e.message || e);
        throw new Error(
            `${msg}. La columna resenas.propiedad_id debe ser TEXT para IDs tipo slug. `
                + 'Ejecutá como superusuario: '
                + 'ALTER TABLE resenas ALTER COLUMN propiedad_id TYPE TEXT USING propiedad_id::text;'
        );
    });
    return _ensurePropiedadTextPromise;
}

/** Reserva con cliente bloqueado en la misma empresa (no puede recibir/generar reseña). */
async function _clienteBloqueadoParaReserva(empresaId, reservaId) {
    if (!reservaId) return false;
    const { rows } = await pool.query(
        `SELECT COALESCE(c.bloqueado, false) AS bloq
           FROM reservas r
           LEFT JOIN clientes c ON c.id = r.cliente_id AND c.empresa_id = r.empresa_id
          WHERE r.empresa_id = $1 AND r.id::text = $2`,
        [empresaId, String(reservaId)]
    );
    return Boolean(rows[0]?.bloq);
}

/** Token público de reseña ligado a reserva con cliente bloqueado. */
async function clienteBloqueadoParaResenaToken(token) {
    const { rows } = await pool.query(
        `SELECT COALESCE(c.bloqueado, false) AS bloq
           FROM resenas r
           LEFT JOIN reservas res ON res.empresa_id = r.empresa_id AND res.id::text = r.reserva_id::text
           LEFT JOIN clientes c ON c.empresa_id = r.empresa_id AND c.id = res.cliente_id
          WHERE r.token = $1`,
        [token]
    );
    return Boolean(rows[0]?.bloq);
}

function _throwClienteBloqueado(mensaje) {
    const e = new Error(mensaje || 'Este huésped no puede enviar reseñas (cliente bloqueado).');
    e.code = 'CLIENTE_BLOQUEADO';
    throw e;
}

async function generarTokenParaReserva(empresaId, reservaId, propiedadId, nombreHuesped) {
    await _ensureResenasPropiedadIdTextColumn();
    if (await _clienteBloqueadoParaReserva(empresaId, reservaId)) {
        _throwClienteBloqueado('No se puede generar el enlace de reseña: el cliente está bloqueado.');
    }
    const existing = await pool.query(
        'SELECT id, token FROM resenas WHERE empresa_id = $1 AND reserva_id = $2 LIMIT 1',
        [empresaId, reservaId]
    );
    if (existing.rows.length > 0) return existing.rows[0].token;

    const { rows } = await pool.query(
        `INSERT INTO resenas (empresa_id, reserva_id, propiedad_id, nombre_huesped)
         VALUES ($1, $2, $3, $4) RETURNING token`,
        [empresaId, reservaId, propiedadId || null, nombreHuesped || null]
    );
    return rows[0].token;
}

async function obtenerPorToken(token) {
    const { rows } = await pool.query(
        `SELECT r.*, p.nombre AS propiedad_nombre,
                e.nombre AS empresa_nombre, e.google_maps_url,
                e.configuracion->>'logoUrl' AS logo_url,
                e.configuracion->>'primaryColor' AS primary_color
         FROM resenas r
         JOIN empresas e ON e.id::text = r.empresa_id
         LEFT JOIN propiedades p ON p.id = r.propiedad_id::text
         WHERE r.token = $1`,
        [token]
    );
    return rows[0] || null;
}

async function marcarTokenUsado(token) {
    await pool.query(
        'UPDATE resenas SET token_usado_at = NOW() WHERE token = $1 AND token_usado_at IS NULL',
        [token]
    );
}

/** Una vez por reserva: cliente cargó el pixel 1×1 del correo de evaluación (apertura sin clic en el enlace). */
async function registrarPixelAperturaEvaluacionEmail(token) {
    if (!token || !pool) return;
    const { rows } = await pool.query(
        `SELECT r.empresa_id, r.reserva_id::text AS reserva_id, rv.cliente_id
           FROM resenas r
           JOIN reservas rv ON rv.empresa_id = r.empresa_id AND rv.id::text = r.reserva_id::text
          WHERE r.token = $1`,
        [token]
    );
    const row = rows[0];
    if (!row?.cliente_id) return;
    const relId = String(row.reserva_id);
    const { rows: dup } = await pool.query(
        `SELECT 1 FROM comunicaciones
          WHERE empresa_id = $1 AND cliente_id = $2 AND evento = 'evaluacion-correo-abierto'
            AND relacion_tipo = 'reserva' AND relacion_id = $3
          LIMIT 1`,
        [row.empresa_id, row.cliente_id, relId]
    );
    if (dup[0]) return;
    try {
        await registrarComunicacion(null, row.empresa_id, row.cliente_id, {
            tipo: 'email',
            evento: 'evaluacion-correo-abierto',
            asunto: 'Correo de evaluación abierto (pixel)',
            destinatario: '',
            relacionadoCon: { tipo: 'reserva', id: relId },
            estado: 'leido',
        });
    } catch (e) {
        console.warn('[resenas] registrar pixel evaluación:', e.message);
    }
}

/** Una vez por reserva: huésped abrió el formulario desde enlace del correo (?ref=email). */
async function registrarAperturaFormularioEvaluacionEmail(token) {
    if (!token || !pool) return;
    const { rows } = await pool.query(
        `SELECT r.empresa_id, r.reserva_id::text AS reserva_id, rv.cliente_id
           FROM resenas r
           JOIN reservas rv ON rv.empresa_id = r.empresa_id AND rv.id::text = r.reserva_id::text
          WHERE r.token = $1`,
        [token]
    );
    const row = rows[0];
    if (!row?.cliente_id) return;
    const relId = String(row.reserva_id);
    const { rows: dup } = await pool.query(
        `SELECT 1 FROM comunicaciones
          WHERE empresa_id = $1 AND cliente_id = $2 AND evento = 'evaluacion-formulario-abierto'
            AND relacion_tipo = 'reserva' AND relacion_id = $3
          LIMIT 1`,
        [row.empresa_id, row.cliente_id, relId]
    );
    if (dup[0]) return;
    try {
        await registrarComunicacion(null, row.empresa_id, row.cliente_id, {
            tipo: 'email',
            evento: 'evaluacion-formulario-abierto',
            asunto: 'Abrió enlace de evaluación (desde correo)',
            destinatario: '',
            relacionadoCon: { tipo: 'reserva', id: relId },
            estado: 'leido',
        });
    } catch (e) {
        console.warn('[resenas] registrar apertura evaluación:', e.message);
    }
}

async function guardarResena(token, datos) {
    if (await clienteBloqueadoParaResenaToken(token)) {
        _throwClienteBloqueado('No puedes enviar esta reseña porque el cliente está bloqueado.');
    }
    const {
        punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
        punt_comunicacion, punt_equipamiento, punt_valor,
        texto_positivo, texto_negativo
    } = datos;

    const { rows } = await pool.query(
        `UPDATE resenas SET
            punt_general = $1, punt_limpieza = $2, punt_ubicacion = $3,
            punt_llegada = $4, punt_comunicacion = $5, punt_equipamiento = $6,
            punt_valor = $7, texto_positivo = $8, texto_negativo = $9,
            estado = 'pendiente'
         WHERE token = $10 AND punt_general IS NULL
         RETURNING id, empresa_id, reserva_id`,
        [punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
         punt_comunicacion, punt_equipamiento, punt_valor,
         texto_positivo || null, texto_negativo || null, token]
    );
    const upd = rows[0];
    if (upd) {
        try {
            const { rows: rv } = await pool.query(
                `SELECT r.cliente_id FROM reservas r
                 WHERE r.empresa_id = $1 AND r.id::text = $2 LIMIT 1`,
                [upd.empresa_id, String(upd.reserva_id)]
            );
            const cid = rv[0]?.cliente_id;
            if (cid) {
                await registrarComunicacion(null, upd.empresa_id, cid, {
                    tipo: 'email',
                    evento: 'evaluacion-completada',
                    asunto: 'Reseña enviada por huésped',
                    destinatario: '',
                    relacionadoCon: { tipo: 'reserva', id: String(upd.reserva_id) },
                    estado: 'recibido',
                });
            }
        } catch (e) {
            console.warn('[resenas] registrarComunicacion evaluación:', e.message);
        }
    }
    return upd || null;
}

async function registrarClickGoogle(token) {
    await pool.query(
        'UPDATE resenas SET google_click_at = NOW() WHERE token = $1',
        [token]
    );
}

async function buscarReservaParaResena(empresaId, canalId, termino) {
    const { rows } = await pool.query(
        `SELECT r.id, r.id_reserva_canal, r.propiedad_id, r.alojamiento_nombre,
                r.cliente_id, r.fecha_llegada, c.nombre AS cliente_nombre
         FROM reservas r
         LEFT JOIN clientes c ON r.cliente_id = c.id AND c.empresa_id = r.empresa_id
         WHERE r.empresa_id = $1 AND r.canal_id = $2 AND r.id_reserva_canal ILIKE $3
           AND COALESCE(c.bloqueado, false) = false
         LIMIT 10`,
        [empresaId, canalId, `${termino}%`]
    );
    return rows.map(r => ({
        id: r.id,
        idReservaCanal: r.id_reserva_canal,
        propiedadId: r.propiedad_id,
        alojamientoNombre: r.alojamiento_nombre,
        clienteId: r.cliente_id,
        clienteNombre: r.cliente_nombre || '—',
        fechaLlegada: r.fecha_llegada instanceof Date
            ? r.fecha_llegada.toISOString().split('T')[0]
            : String(r.fecha_llegada || ''),
    }));
}

async function crearResenaManual(empresaId, datos, _files = {}) {
    const {
        reservaId, propiedadId, clienteNombre,
        fechaResena, punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
        punt_comunicacion, punt_equipamiento, punt_valor,
        texto_positivo, texto_negativo
    } = datos;

    if (!reservaId || !punt_general || !fechaResena) {
        throw new Error('reservaId, punt_general y fechaResena son requeridos');
    }
    if (await _clienteBloqueadoParaReserva(empresaId, reservaId)) {
        _throwClienteBloqueado('No se puede registrar la reseña: el cliente de la reserva está bloqueado.');
    }

    await _ensureResenasPropiedadIdTextColumn();

    const { rows } = await pool.query(
        `INSERT INTO resenas (
            empresa_id, reserva_id, propiedad_id, nombre_huesped,
            punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
            punt_comunicacion, punt_equipamiento, punt_valor,
            texto_positivo, texto_negativo, estado
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'publicada')
         RETURNING id`,
        [
            empresaId,
            reservaId,
            propiedadId || null,
            clienteNombre || null,
            parseInt(punt_general, 10),
            punt_limpieza ? parseInt(punt_limpieza, 10) : null,
            punt_ubicacion ? parseInt(punt_ubicacion, 10) : null,
            punt_llegada ? parseInt(punt_llegada, 10) : null,
            punt_comunicacion ? parseInt(punt_comunicacion, 10) : null,
            punt_equipamiento ? parseInt(punt_equipamiento, 10) : null,
            punt_valor ? parseInt(punt_valor, 10) : null,
            texto_positivo || null,
            texto_negativo || null,
        ]
    );
    return rows[0];
}

function _clampPunt(v) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return undefined;
    return Math.min(5, Math.max(1, n));
}

/**
 * Lista reseñas del tenant (SSR + SPA).
 * Opciones: estado, propiedadId, q (buscar texto), sort, limit/offset (solo si vienen definidos).
 */
async function obtenerResenas(empresaId, opts = {}) {
    const estado = opts.estado ?? null;
    const propiedadId = opts.propiedadId ?? null;
    const qRaw = opts.q ?? opts.buscar ?? null;
    const sortKey = opts.sort || 'created_at_desc';

    let sql = `
        SELECT r.*, p.nombre AS propiedad_nombre
        FROM resenas r
        LEFT JOIN propiedades p ON p.id = r.propiedad_id::text
        WHERE r.empresa_id = $1`;
    const params = [empresaId];

    const soloConPuntuacion = opts.soloConPuntuacion !== false;
    if (soloConPuntuacion) sql += ' AND r.punt_general IS NOT NULL';

    if (estado) {
        params.push(estado);
        sql += ` AND r.estado = $${params.length}`;
    }
    if (propiedadId) {
        params.push(propiedadId);
        sql += ` AND r.propiedad_id::text = $${params.length}::text`;
    }

    const q = typeof qRaw === 'string' ? qRaw.trim() : '';
    if (q) {
        params.push(`%${q}%`);
        const qi = params.length;
        sql += ` AND (
            COALESCE(r.nombre_huesped, '') ILIKE $${qi}
            OR COALESCE(r.texto_positivo, '') ILIKE $${qi}
            OR COALESCE(r.texto_negativo, '') ILIKE $${qi}
            OR COALESCE(p.nombre, '') ILIKE $${qi}
            OR COALESCE(r.reserva_id::text, '') ILIKE $${qi}
            OR COALESCE(r.origen, '') ILIKE $${qi}
        )`;
    }

    const orderMap = {
        created_at_desc: 'r.created_at DESC',
        created_at_asc: 'r.created_at ASC',
        fecha_resena_desc: 'r.fecha_resena DESC NULLS LAST, r.created_at DESC',
        fecha_resena_asc: 'r.fecha_resena ASC NULLS LAST',
        punt_general_desc: 'r.punt_general DESC NULLS LAST',
        punt_general_asc: 'r.punt_general ASC NULLS LAST',
        nombre_asc: 'LOWER(COALESCE(r.nombre_huesped, \'\')) ASC',
        nombre_desc: 'LOWER(COALESCE(r.nombre_huesped, \'\')) DESC',
        propiedad_asc: 'LOWER(COALESCE(p.nombre, \'\')) ASC',
        propiedad_desc: 'LOWER(COALESCE(p.nombre, \'\')) DESC',
    };
    sql += ` ORDER BY ${orderMap[sortKey] || orderMap.created_at_desc}`;

    const hasLimit = opts.limit !== undefined && opts.limit !== null && opts.limit !== '';
    if (hasLimit) {
        const lim = Math.min(500, Math.max(1, parseInt(String(opts.limit), 10) || 100));
        const off = Math.max(0, parseInt(String(opts.offset ?? 0), 10) || 0);
        params.push(lim);
        sql += ` LIMIT $${params.length}`;
        params.push(off);
        sql += ` OFFSET $${params.length}`;
    }

    const { rows } = await pool.query(sql, params);
    return rows;
}

async function eliminarResena(id, empresaId) {
    const { rows } = await pool.query(
        `DELETE FROM resenas WHERE id = $1 AND empresa_id = $2 RETURNING id`,
        [id, empresaId]
    );
    return rows[0] || null;
}

async function actualizarResenaAdmin(empresaId, id, datos = {}) {
    const sets = [];
    const vals = [];
    let pn = 3;

    const addSet = (col, value) => {
        sets.push(`${col} = $${pn}`);
        vals.push(value);
        pn += 1;
    };

    if (datos.nombre_huesped !== undefined) {
        const v = datos.nombre_huesped;
        addSet('nombre_huesped', v === null || v === '' ? null : String(v));
    }
    if (datos.texto_positivo !== undefined) {
        const v = datos.texto_positivo;
        addSet('texto_positivo', v === null || v === '' ? null : String(v));
    }
    if (datos.texto_negativo !== undefined) {
        const v = datos.texto_negativo;
        addSet('texto_negativo', v === null || v === '' ? null : String(v));
    }

    if (datos.estado !== undefined && ['pendiente', 'publicada', 'oculta'].includes(datos.estado)) {
        addSet('estado', datos.estado);
    }

    const puntCols = [
        'punt_general',
        'punt_limpieza',
        'punt_ubicacion',
        'punt_llegada',
        'punt_comunicacion',
        'punt_equipamiento',
        'punt_valor',
    ];
    for (const col of puntCols) {
        if (datos[col] === undefined) continue;
        const c = _clampPunt(datos[col]);
        if (c === undefined) continue;
        addSet(col, c);
    }

    if (!sets.length) throw new Error('No hay campos válidos para actualizar.');

    const sql = `UPDATE resenas SET ${sets.join(', ')} WHERE id = $1 AND empresa_id = $2 RETURNING id`;
    const { rows } = await pool.query(sql, [id, empresaId, ...vals]);
    return rows[0] || null;
}

async function obtenerResumen(empresaId) {
    const { rows } = await pool.query(
        `SELECT
            COUNT(*)::int AS total,
            ROUND(AVG(punt_general), 1)::float AS promedio_general,
            ROUND(AVG(punt_limpieza), 1)::float AS promedio_limpieza,
            ROUND(AVG(punt_ubicacion), 1)::float AS promedio_ubicacion,
            ROUND(AVG(punt_llegada), 1)::float AS promedio_llegada,
            ROUND(AVG(punt_comunicacion), 1)::float AS promedio_comunicacion,
            ROUND(AVG(punt_equipamiento), 1)::float AS promedio_equipamiento,
            ROUND(AVG(punt_valor), 1)::float AS promedio_valor,
            COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes
         FROM resenas
         WHERE empresa_id = $1 AND punt_general IS NOT NULL`,
        [empresaId]
    );
    return rows[0];
}

/** Resumen solo reseñas publicadas de una propiedad (SSR ficha alojamiento). */
async function obtenerResumenPorPropiedad(empresaId, propiedadId) {
    if (!propiedadId) return null;
    const { rows } = await pool.query(
        `SELECT
            COUNT(*)::int AS total,
            ROUND(AVG(punt_general), 1)::float AS promedio_general,
            ROUND(AVG(punt_limpieza), 1)::float AS promedio_limpieza,
            ROUND(AVG(punt_ubicacion), 1)::float AS promedio_ubicacion,
            ROUND(AVG(punt_llegada), 1)::float AS promedio_llegada,
            ROUND(AVG(punt_comunicacion), 1)::float AS promedio_comunicacion,
            ROUND(AVG(punt_equipamiento), 1)::float AS promedio_equipamiento,
            ROUND(AVG(punt_valor), 1)::float AS promedio_valor,
            COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes
         FROM resenas
         WHERE empresa_id = $1
           AND propiedad_id IS NOT NULL
           AND propiedad_id::text = $2::text
           AND punt_general IS NOT NULL
           AND estado = 'publicada'`,
        [empresaId, String(propiedadId)]
    );
    return rows[0] || {
        total: 0,
        promedio_general: null,
        promedio_limpieza: null,
        promedio_ubicacion: null,
        promedio_llegada: null,
        promedio_comunicacion: null,
        promedio_equipamiento: null,
        promedio_valor: null,
        pendientes: 0,
    };
}

/**
 * Promedio y total de reseñas publicadas por varias propiedades (una sola query).
 * @param {{ empresa_id: string, propiedad_id: string }[]} pairs
 * @returns {Promise<Map<string, { total: number, promedio_general: number|null }>>} clave `${empresa_id}\0${propiedad_id}`
 */
async function obtenerPromedioResenasBatchPorPropiedades(pairs) {
    const map = new Map();
    if (!pool || !pairs?.length) return map;
    const uniq = [];
    const seen = new Set();
    for (const p of pairs) {
        const eid = String(p.empresa_id || '').trim();
        const pid = String(p.propiedad_id || '').trim();
        if (!eid || !pid) continue;
        const k = `${eid}\0${pid}`;
        if (seen.has(k)) continue;
        seen.add(k);
        uniq.push({ empresa_id: eid, propiedad_id: pid });
    }
    if (!uniq.length) return map;

    const vals = uniq.map((_, i) => `($${i * 2 + 1}::text, $${i * 2 + 2}::text)`).join(', ');
    const params = uniq.flatMap((p) => [p.empresa_id, p.propiedad_id]);
    const { rows } = await pool.query(
        `WITH wanted(empresa_id, propiedad_id) AS (VALUES ${vals})
         SELECT w.empresa_id,
                w.propiedad_id,
                COUNT(r.id)::int AS total,
                ROUND(AVG(r.punt_general), 1)::float AS promedio_general
           FROM wanted w
           LEFT JOIN resenas r
             ON r.empresa_id::text = w.empresa_id
            AND r.propiedad_id::text = w.propiedad_id
            AND r.estado = 'publicada'
            AND r.punt_general IS NOT NULL
          GROUP BY w.empresa_id, w.propiedad_id`,
        params
    );
    for (const r of rows) {
        map.set(`${r.empresa_id}\0${r.propiedad_id}`, {
            total: Number(r.total) || 0,
            promedio_general: r.promedio_general != null ? Number(r.promedio_general) : null,
        });
    }
    return map;
}

async function responderResena(id, empresaId, texto, autor) {
    const { rows } = await pool.query(
        `UPDATE resenas SET respuesta_texto = $1, respuesta_fecha = NOW(), respuesta_autor = $2
         WHERE id = $3 AND empresa_id = $4 RETURNING id`,
        [texto, autor, id, empresaId]
    );
    return rows[0] || null;
}

async function cambiarEstado(id, empresaId, estado) {
    const { rows } = await pool.query(
        `UPDATE resenas SET estado = $1 WHERE id = $2 AND empresa_id = $3 RETURNING id`,
        [estado, id, empresaId]
    );
    return rows[0] || null;
}

/** Huéspedes con al menos una reserva confirmada ya finalizada y sin reseña publicada (una fila por cliente). */
async function listarClientesCandidatosResenaAutomatica(empresaId, limit = 80) {
    const lim = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 80));
    const { rows } = await pool.query(
        `SELECT DISTINCT ON (r.cliente_id)
                r.cliente_id AS id,
                c.nombre,
                r.id::text AS reserva_id,
                r.propiedad_id::text AS propiedad_id,
                r.alojamiento_nombre,
                r.fecha_llegada
           FROM reservas r
           JOIN clientes c ON c.id = r.cliente_id AND c.empresa_id = r.empresa_id
          WHERE r.empresa_id = $1
            AND ${sqlReservaPrincipalSemanticaIgual('confirmada')}
            AND r.fecha_salida::date < CURRENT_DATE
            AND COALESCE(c.bloqueado, false) = false
            AND NOT EXISTS (
                SELECT 1 FROM resenas rv
                 WHERE rv.empresa_id = $1
                   AND rv.reserva_id = r.id::text
                   AND rv.punt_general IS NOT NULL
            )
          ORDER BY r.cliente_id, r.fecha_llegada DESC
          LIMIT $2`,
        [empresaId, lim]
    );
    return rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        reservaId: r.reserva_id,
        propiedadId: r.propiedad_id,
        alojamientoNombre: r.alojamiento_nombre || '',
        fechaLlegada: r.fecha_llegada instanceof Date
            ? r.fecha_llegada.toISOString().split('T')[0]
            : String(r.fecha_llegada || '').slice(0, 10),
    }));
}

const FRASES_POSITIVAS_AUTO = [
    'Todo impecable, volveríamos sin dudarlo.',
    'Ubicación excelente y la comunicación con el anfitrión fue muy fluida.',
    'Muy buena relación calidad-precio; el alojamiento superó lo esperado.',
    'Limpieza impecable y detalles que se notan cuidados.',
    'Check-in sencillo y lugar tranquilo para descansar.',
    'Espacios amplios y bien equipados; ideal para familias.',
    'La cama muy cómoda y la cocina tenía lo necesario.',
    'Vistas hermosas y entorno muy agradable.',
    'Anfitrión atento y recomendaciones locales muy útiles.',
    'Todo funcionó perfecto; la estadía fue memorable.',
    'Muy recomendable para quienes buscan calidad y buen trato.',
    'El lugar es tal como en las fotos, incluso mejor.',
    'Silencioso por la noche y buena temperatura en las habitaciones.',
    'Baños limpios y agua caliente sin problemas.',
    'Buena señal de internet para teletrabajar unos días.',
    'Decoración acogedora y buena iluminación natural.',
    'Acceso fácil y estacionamiento cómodo.',
    'Ideal para desconectar un fin de semana.',
    'Nos encantó el entorno y la privacidad.',
    'Rápida respuesta a nuestras consultas antes de llegar.',
    'Detalles de bienvenida que se agradecen mucho.',
    'Muy seguro y vecindario tranquilo.',
    'Las sábanas y toallas de buena calidad.',
    'Cerca de servicios y restaurantes sin estar en zona ruidosa.',
    'Perfecto para nuestra escapada; todo en orden.',
    'El equipamiento cumplió con creces nuestras expectativas.',
    'Llegada puntual y sin complicaciones.',
    'Espacio cálido y bien cuidado.',
    'Volveremos en otra temporada.',
    'La estadía fue corta pero intensa en buenos momentos.',
    'Recomendamos totalmente esta propiedad.',
    'Todo coordinado con profesionalismo.',
    'Ambiente familiar y acogedor.',
    'Buena ventilación y olor a limpio.',
    'Las fotos no le hacen justicia: es mejor en persona.',
    'Áreas comunes bien mantenidas.',
    'Atención al detalle en la limpieza.',
    'Ideal para quienes valoran el descanso.',
    'La reserva fue clara y sin sorpresas desagradables.',
    'Salimos muy contentos con la experiencia.',
    'El lugar invita a quedarse más días.',
    'Comodidad de hotel con calidez de hogar.',
    'Muy buena relación con el equipo de la empresa.',
    'Proceso de reserva y pago transparente.',
    'Nos sentimos bienvenidos desde el primer minuto.',
    'Espacio luminoso y ordenado.',
    'Buena presión de agua y ducha amplia.',
    'Zona segura para caminar de noche.',
    'El entorno natural es un plus enorme.',
    'Todo listo para nuestra llegada tarde.',
    'Superó nuestras expectativas en limpieza y orden.',
    'Una joya escondida; ojalá podamos repetir.',
];

function _hashEmpresa(empresaId) {
    const s = String(empresaId || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

function _shuffleScoresForTarget(n, empresaId) {
    const target10 = 9.3 + (Math.random() * 0.399);
    const targetSum = Math.round((target10 / 2) * n);
    const minSum = 4 * n;
    const maxSum = 5 * n;
    const sClamped = Math.min(maxSum, Math.max(minSum, targetSum));
    const extras = sClamped - minSum;
    const indices = Array.from({ length: n }, (_, i) => i);
    const seed = _hashEmpresa(empresaId);
    for (let i = n - 1; i > 0; i -= 1) {
        const j = (seed + i * 17) % (i + 1);
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const arr = Array(n).fill(4);
    for (let k = 0; k < extras; k += 1) arr[indices[k]] = 5;
    return arr;
}

function _frasePositiva(empresaId, index) {
    const h = _hashEmpresa(empresaId);
    const k = (h + index * 17 + index * index) % FRASES_POSITIVAS_AUTO.length;
    return FRASES_POSITIVAS_AUTO[k];
}

/** Recorte legible de historia (misma fuente que SSR/wizard). */
function _primerOracionHistoria(historia, maxLen) {
    if (!historia || typeof historia !== 'string') return '';
    const t = historia.replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const cap = Math.min(maxLen, 140);
    let cut = t.length <= cap ? t.length : t.lastIndexOf(' ', cap);
    if (cut < 30) cut = Math.min(cap, t.length);
    const out = t.slice(0, cut).trim();
    return out + (t.length > cut ? '…' : '');
}

function _limTextoResena(s, max = 480) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const cut = t.lastIndexOf(' ', max - 1);
    const end = cut > 40 ? cut : max - 1;
    return `${t.slice(0, end).trim()}…`;
}

/**
 * Texto de reseña auto_seed solo con contexto empresa (getSSROptimizedData / wizard).
 * uniqueKey (p. ej. reserva_id) evita dos estancias con la misma plantilla y texto idéntico en la ficha.
 */
function _frasePositivaContextual(ssr, alojamientoNombre, empresaId, index, uniqueKey) {
    const seed = `${index}|${String(uniqueKey || '')}`;
    if (!ssr || typeof ssr !== 'object') {
        return _frasePositiva(empresaId, _hashEmpresa(`${empresaId}|${seed}`) % 256);
    }
    const nombre = String(ssr.nombre || '').trim() || 'el equipo';
    const ciudad = String(ssr.ubicacion?.ciudad || '').trim();
    const region = String(ssr.ubicacion?.region || '').trim();
    const loc = [ciudad, region].filter(Boolean).join(', ');
    const slogan = String(ssr.slogan || '').trim().slice(0, 90);
    const propuesta = String(ssr.brand?.propuestaValor || '').trim().slice(0, 130);
    const historiaCorta = _primerOracionHistoria(ssr.historia || '', 95);
    const tipoAloj = String(ssr.tipoAlojamientoPrincipal || '').trim().slice(0, 70);
    const anios = Number(ssr.aniosExperiencia) > 0 ? Math.min(80, Math.floor(Number(ssr.aniosExperiencia))) : 0;
    const aloj = String(alojamientoNombre || '').trim().slice(0, 80);
    const h = _hashEmpresa(`${empresaId}|ctx|${seed}`);
    const refAloj = aloj ? `"${aloj}"` : 'el alojamiento';

    const plantillas = [
        () => `Excelente experiencia con ${nombre}. ${refAloj} cumplió con todo lo prometido.${loc ? ` Ubicación ideal en ${loc}.` : ''}`,
        () => `${nombre} se preocupó de cada detalle.${propuesta ? ` Se nota su propuesta: ${propuesta}` : ' Muy profesional y cercano.'}`,
        () => `Recomendamos ${nombre}${loc ? ` en ${loc}` : ''}.${slogan ? ` ${slogan}` : ''} La estadía superó nuestras expectativas.`,
        () => `${historiaCorta ? `Se percibe la trayectoria de ${nombre}: ${historiaCorta} ` : ''}Muy satisfechos con ${refAloj}.`,
        () => `Gracias a ${nombre} por la coordinación${loc ? ` en ${loc}` : ''}. ${tipoAloj ? `Ideal para quienes buscan ${tipoAloj}.` : 'Volveríamos sin dudarlo.'}`,
        () => (anios > 0
            ? `Con ${anios} años de trayectoria, ${nombre} cumple.${aloj ? ` ${refAloj} destacó` : ' El lugar destacó'} por limpieza y buena comunicación.`
            : `${nombre} respondió rápido y el proceso fue transparente.${loc ? ` ${loc} es un gran punto.` : ''}`),
    ];
    const pick = plantillas[h % plantillas.length];
    let base = pick().replace(/\s+/g, ' ').trim();
    const hc = _hashEmpresa(seed);
    const matices = [
        ' Todo salió fluido.',
        ' Sin sorpresas desagradables.',
        ' La coordinación fue clara.',
        ' Salimos con buen sabor.',
        ' Destacamos la buena disposición.',
        ' El trato fue muy humano.',
        ' Se nota experiencia en el rubro.',
        ' Recomendamos la experiencia.',
    ];
    base = `${base} ${matices[hc % matices.length]}`.replace(/\s+/g, ' ').trim();
    return _limTextoResena(base);
}

/** Sub-puntuaciones 4–5 coherentes con la general (limpieza, ubicación, etc.), variación por empresa/índice. */
function _subPuntuacionesAuto(pg, empresaId, idx) {
    const h = _hashEmpresa(`${empresaId}|${idx}`);
    const bits = [(h >> 1) & 1, (h >> 3) & 1, (h >> 5) & 1, (h >> 7) & 1, (h >> 9) & 1, (h >> 11) & 1];
    return bits.map((bit) => {
        if (pg === 5) return bit ? 5 : 4;
        if (pg === 4) return bit ? 4 : 4;
        return Math.min(5, Math.max(1, pg));
    });
}

/**
 * Crea hasta 10 reseñas publicadas ligadas a reservas reales del mismo tenant.
 * Puntajes enteros 1–5 con promedio del lote equivalente a ~9.3–9.7 sobre 10 en SSR (×2).
 */
async function generarResenasAutomaticas(empresaId, clienteIds) {
    await _ensureResenasPropiedadIdTextColumn();

    const ids = [...new Set((clienteIds || []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 10);
    if (ids.length > 10) throw new Error('Máximo 10 clientes por lote.');

    let candidatos = [];

    if (ids.length === 0) {
        const rows = await listarClientesCandidatosResenaAutomatica(empresaId, 10);
        candidatos = rows.map((r) => ({
            reserva_id: r.reservaId,
            propiedad_id: r.propiedadId || null,
            alojamiento_nombre: r.alojamientoNombre || '',
            cliente_nombre: r.nombre || '',
        }));
    } else {
        for (let i = 0; i < ids.length; i += 1) {
            const cid = ids[i];
            const { rows } = await pool.query(
                `SELECT r.id::text AS reserva_id, r.propiedad_id::text AS propiedad_id,
                        r.alojamiento_nombre, c.nombre AS cliente_nombre
                   FROM reservas r
                   JOIN clientes c ON c.id = r.cliente_id AND c.empresa_id = r.empresa_id
                  WHERE r.empresa_id = $1 AND r.cliente_id = $2
                    AND ${sqlReservaPrincipalSemanticaIgual('confirmada')}
                    AND r.fecha_salida::date < CURRENT_DATE
                    AND COALESCE(c.bloqueado, false) = false
                    AND NOT EXISTS (
                        SELECT 1 FROM resenas rv
                         WHERE rv.empresa_id = $1
                           AND rv.reserva_id = r.id::text
                           AND rv.punt_general IS NOT NULL
                    )
                  ORDER BY r.fecha_llegada DESC
                  LIMIT 1`,
                [empresaId, cid]
            );
            if (rows[0]) candidatos.push(rows[0]);
        }
    }

    if (!candidatos.length) {
        throw new Error(
            ids.length === 0
                ? 'No hay clientes con reserva finalizada sin reseña (máx. 10 automáticos).'
                : 'No hay reservas finalizadas sin reseña para los clientes seleccionados.'
        );
    }

    let ssrOptimized = null;
    if (pool) {
        try {
            ssrOptimized = await getSSROptimizedData(empresaId);
        } catch (e) {
            console.warn('[generarResenasAutomaticas] Contexto SSR no disponible, textos genéricos:', e?.message || e);
        }
    }

    const n = candidatos.length;
    const scores = _shuffleScoresForTarget(n, empresaId);
    const client = await pool.connect();
    const creadas = [];
    try {
        await client.query('BEGIN');
        for (let i = 0; i < n; i += 1) {
            const row = candidatos[i];
            const pg = scores[i];
            const texto = _frasePositivaContextual(
                ssrOptimized,
                row.alojamiento_nombre,
                empresaId,
                i,
                row.reserva_id
            );
            const [pl, pu, pll, pc, pe, pv] = _subPuntuacionesAuto(pg, empresaId, i);
            const up = await client.query(
                `UPDATE resenas SET
                    propiedad_id = COALESCE(
                        NULLIF(trim(COALESCE($3::text, '')), ''),
                        propiedad_id::text
                    ),
                    nombre_huesped = $4,
                    punt_general = $5, punt_limpieza = $6, punt_ubicacion = $7, punt_llegada = $8,
                    punt_comunicacion = $9, punt_equipamiento = $10, punt_valor = $11,
                    texto_positivo = $12, texto_negativo = $13, estado = 'publicada'
                 WHERE empresa_id = $1 AND reserva_id = $2 AND punt_general IS NULL
                 RETURNING id`,
                [
                    empresaId,
                    row.reserva_id,
                    row.propiedad_id || null,
                    row.cliente_nombre,
                    pg,
                    pl,
                    pu,
                    pll,
                    pc,
                    pe,
                    pv,
                    texto,
                    null,
                ]
            );
            if (up.rows[0]) {
                creadas.push(up.rows[0].id);
                continue;
            }
            const ins = await client.query(
                `INSERT INTO resenas (
                    empresa_id, reserva_id, propiedad_id, nombre_huesped,
                    punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
                    punt_comunicacion, punt_equipamiento, punt_valor,
                    texto_positivo, texto_negativo, estado
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'publicada')
                 RETURNING id`,
                [
                    empresaId,
                    row.reserva_id,
                    row.propiedad_id || null,
                    row.cliente_nombre,
                    pg,
                    pl,
                    pu,
                    pll,
                    pc,
                    pe,
                    pv,
                    texto,
                    null,
                ]
            );
            creadas.push(ins.rows[0].id);
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }

    return { creadas: creadas.length, ids: creadas };
}

module.exports = {
    generarTokenParaReserva,
    obtenerPorToken,
    clienteBloqueadoParaResenaToken,
    marcarTokenUsado,
    registrarAperturaFormularioEvaluacionEmail,
    registrarPixelAperturaEvaluacionEmail,
    guardarResena,
    registrarClickGoogle,
    buscarReservaParaResena,
    crearResenaManual,
    obtenerResenas,
    obtenerResumen,
    obtenerResumenPorPropiedad,
    obtenerPromedioResenasBatchPorPropiedades,
    responderResena,
    cambiarEstado,
    eliminarResena,
    actualizarResenaAdmin,
    listarClientesCandidatosResenaAutomatica,
    generarResenasAutomaticas,
};
