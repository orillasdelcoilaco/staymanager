// backend/services/resenasService.js
const pool = require('../db/postgres');
const { uploadFile } = require('./storageService');
const { v4: uuidv4 } = require('uuid');

const STORAGE_PATH = (empresaId) => `empresas/${empresaId}/resenas`;

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
         RETURNING id`,
        [punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
         punt_comunicacion, punt_equipamiento, punt_valor,
         texto_positivo || null, texto_negativo || null, token]
    );
    return rows[0] || null;
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

async function crearResenaManual(empresaId, datos, files = {}) {
    const {
        reservaId, propiedadId, clienteNombre, canalId,
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

    let foto1_url = null, foto2_url = null;
    const sp = STORAGE_PATH(empresaId);
    if (files.foto1?.[0]) {
        foto1_url = await uploadFile(
            files.foto1[0].buffer,
            `${sp}/${uuidv4()}_${files.foto1[0].originalname}`,
            files.foto1[0].mimetype
        );
    }
    if (files.foto2?.[0]) {
        foto2_url = await uploadFile(
            files.foto2[0].buffer,
            `${sp}/${uuidv4()}_${files.foto2[0].originalname}`,
            files.foto2[0].mimetype
        );
    }

    const { rows } = await pool.query(
        `INSERT INTO resenas (
            empresa_id, reserva_id, propiedad_id, nombre_huesped, cliente_nombre,
            canal_id, punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
            punt_comunicacion, punt_equipamiento, punt_valor,
            texto_positivo, texto_negativo, estado, origen,
            foto1_url, foto2_url, fecha_resena
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'publicada','manual',$16,$17,$18)
         RETURNING id`,
        [
            empresaId, reservaId, propiedadId || null,
            clienteNombre || null, clienteNombre || null,
            canalId || null,
            parseInt(punt_general),
            punt_limpieza ? parseInt(punt_limpieza) : null,
            punt_ubicacion ? parseInt(punt_ubicacion) : null,
            punt_llegada ? parseInt(punt_llegada) : null,
            punt_comunicacion ? parseInt(punt_comunicacion) : null,
            punt_equipamiento ? parseInt(punt_equipamiento) : null,
            punt_valor ? parseInt(punt_valor) : null,
            texto_positivo || null, texto_negativo || null,
            foto1_url, foto2_url, fechaResena
        ]
    );
    return rows[0];
}

async function obtenerResenas(empresaId, { estado, propiedadId } = {}) {
    let sql = `
        SELECT r.*, p.nombre AS propiedad_nombre
        FROM resenas r
        LEFT JOIN propiedades p ON p.id = r.propiedad_id::text
        WHERE r.empresa_id = $1 AND r.punt_general IS NOT NULL`;
    const params = [empresaId];

    if (estado) { params.push(estado); sql += ` AND r.estado = $${params.length}`; }
    if (propiedadId) { params.push(propiedadId); sql += ` AND r.propiedad_id = $${params.length}`; }

    sql += ' ORDER BY r.created_at DESC';
    const { rows } = await pool.query(sql, params);
    return rows;
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
            AND r.estado = 'Confirmada'
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
    const ids = [...new Set((clienteIds || []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 10);
    if (!ids.length) throw new Error('Selecciona al menos un cliente.');
    if (ids.length > 10) throw new Error('Máximo 10 clientes por lote.');

    const { rows: canalRows } = await pool.query(
        `SELECT id FROM canales WHERE empresa_id = $1 AND (metadata->>'esCanalPorDefecto')::boolean = true LIMIT 1`,
        [empresaId]
    );
    const canalId = canalRows[0]?.id || null;

    const candidatos = [];
    for (let i = 0; i < ids.length; i += 1) {
        const cid = ids[i];
        const { rows } = await pool.query(
            `SELECT r.id::text AS reserva_id, r.propiedad_id::text AS propiedad_id,
                    r.alojamiento_nombre, c.nombre AS cliente_nombre
               FROM reservas r
               JOIN clientes c ON c.id = r.cliente_id AND c.empresa_id = r.empresa_id
              WHERE r.empresa_id = $1 AND r.cliente_id = $2 AND r.estado = 'Confirmada'
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

    if (!candidatos.length) {
        throw new Error('No hay reservas finalizadas sin reseña para los clientes seleccionados.');
    }

    const n = candidatos.length;
    const scores = _shuffleScoresForTarget(n, empresaId);
    const hoy = new Date();
    const client = await pool.connect();
    const creadas = [];
    try {
        await client.query('BEGIN');
        for (let i = 0; i < n; i += 1) {
            const row = candidatos[i];
            const pg = scores[i];
            const diasAtras = 10 + ((i + _hashEmpresa(empresaId)) % 120);
            const fr = new Date(hoy);
            fr.setDate(fr.getDate() - diasAtras);
            const fechaResena = fr.toISOString().split('T')[0];
            const texto = _frasePositiva(empresaId, i);
            const [pl, pu, pll, pc, pe, pv] = _subPuntuacionesAuto(pg, empresaId, i);
            const up = await client.query(
                `UPDATE resenas SET
                    propiedad_id = COALESCE(NULLIF(trim($3::text), ''), propiedad_id),
                    nombre_huesped = $4, cliente_nombre = $5, canal_id = $6,
                    punt_general = $7, punt_limpieza = $8, punt_ubicacion = $9, punt_llegada = $10,
                    punt_comunicacion = $11, punt_equipamiento = $12, punt_valor = $13,
                    texto_positivo = $14, texto_negativo = $15, estado = 'publicada', origen = 'auto_seed',
                    fecha_resena = $16
                 WHERE empresa_id = $1 AND reserva_id = $2 AND punt_general IS NULL
                 RETURNING id`,
                [
                    empresaId,
                    row.reserva_id,
                    row.propiedad_id || null,
                    row.cliente_nombre,
                    row.cliente_nombre,
                    canalId,
                    pg,
                    pl,
                    pu,
                    pll,
                    pc,
                    pe,
                    pv,
                    texto,
                    null,
                    fechaResena,
                ]
            );
            if (up.rows[0]) {
                creadas.push(up.rows[0].id);
                continue;
            }
            const ins = await client.query(
                `INSERT INTO resenas (
                    empresa_id, reserva_id, propiedad_id, nombre_huesped, cliente_nombre,
                    canal_id, punt_general, punt_limpieza, punt_ubicacion, punt_llegada,
                    punt_comunicacion, punt_equipamiento, punt_valor,
                    texto_positivo, texto_negativo, estado, origen,
                    foto1_url, foto2_url, fecha_resena
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'publicada','auto_seed',NULL,NULL,$16)
                 RETURNING id`,
                [
                    empresaId,
                    row.reserva_id,
                    row.propiedad_id || null,
                    row.cliente_nombre,
                    row.cliente_nombre,
                    canalId,
                    pg,
                    pg,
                    pg,
                    pg,
                    pg,
                    pg,
                    pg,
                    texto,
                    null,
                    fechaResena,
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
    guardarResena,
    registrarClickGoogle,
    buscarReservaParaResena,
    crearResenaManual,
    obtenerResenas,
    obtenerResumen,
    obtenerResumenPorPropiedad,
    responderResena,
    cambiarEstado,
    listarClientesCandidatosResenaAutomatica,
    generarResenasAutomaticas,
};
