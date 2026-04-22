// backend/services/cuponesService.js
const pool = require('../db/postgres');

const generarCodigoUnico = (nombreCliente, porcentaje) => {
    const iniciales = nombreCliente.split(' ').map(n => n[0]).join('').toUpperCase();
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${iniciales}${porcentaje}-${randomChars}`;
};

function _mapearCupon(row) {
    return {
        id: row.id,
        codigo: row.codigo,
        porcentajeDescuento: Number(row.descuento),
        tipoDescuento: row.tipo_descuento,
        activo: row.activo,
        usosMaximos: row.usos_maximos,
        usosActuales: row.usos_actuales,
        vigenciaDesde: row.vigencia_desde,
        vigenciaHasta: row.vigencia_hasta,
        clienteId: row.cliente_id,
        clienteNombre: row.cliente_nombre || null,
        fechaCreacion: row.created_at,
        estado: row.activo ? 'disponible' : 'utilizado',
    };
}

/**
 * Genera un cupón vinculado a un cliente.
 * @param {object} opciones - { porcentajeDescuento, usosMaximos?, vigenciaDesde?, vigenciaHasta? }
 *                           Backward-compatible: acepta número simple como porcentajeDescuento.
 */
const generarCuponParaCliente = async (_db, empresaId, clienteId, opciones) => {
    const opts = typeof opciones === 'number' ? { porcentajeDescuento: opciones } : opciones;
    const { porcentajeDescuento, usosMaximos = 1, vigenciaDesde = null, vigenciaHasta = null } = opts;
    if (!clienteId || !porcentajeDescuento) throw new Error('Se requieren el ID del cliente y el porcentaje de descuento.');

    const { rows: cliRows } = await pool.query(
        'SELECT nombre FROM clientes WHERE id=$1 AND empresa_id=$2',
        [clienteId, empresaId]
    );
    if (!cliRows[0]) throw new Error('El cliente especificado no existe.');
    const nombreCliente = cliRows[0].nombre;
    const codigo = generarCodigoUnico(nombreCliente, porcentajeDescuento);
    const { rows } = await pool.query(
        `INSERT INTO cupones (empresa_id, codigo, descuento, tipo_descuento, activo, usos_maximos, cliente_id, vigencia_desde, vigencia_hasta)
         VALUES ($1,$2,$3,'porcentaje',true,$4,$5,$6,$7) RETURNING *`,
        [empresaId, codigo, porcentajeDescuento, usosMaximos, clienteId, vigenciaDesde, vigenciaHasta]
    );
    return { ..._mapearCupon(rows[0]), nombrePropietario: nombreCliente };
};

/**
 * Valida un cupón. Prioridad de reglas: fechas > usos.
 */
const validarCupon = async (_db, empresaId, codigo) => {
    if (!codigo) throw new Error('Se requiere un código de cupón.');
    const { rows } = await pool.query(
        'SELECT * FROM cupones WHERE empresa_id=$1 AND codigo=$2 LIMIT 1',
        [empresaId, codigo]
    );
    if (!rows[0]) throw { status: 404, message: 'El cupón no existe.' };
    const c = rows[0];
    const hoy = new Date().toISOString().split('T')[0];
    if (c.vigencia_hasta && hoy > c.vigencia_hasta.toISOString().split('T')[0]) {
        throw { status: 400, message: 'Este cupón ha expirado.' };
    }
    if (c.vigencia_desde && hoy < c.vigencia_desde.toISOString().split('T')[0]) {
        throw { status: 400, message: 'Este cupón aún no está vigente.' };
    }
    if (!c.activo || c.usos_actuales >= (c.usos_maximos || 1)) {
        throw { status: 400, message: 'Este cupón ya alcanzó el máximo de usos.' };
    }
    return _mapearCupon(c);
};

/**
 * Marca un cupón como utilizado (incrementa usos, desactiva si llegó al máximo).
 * El parámetro `transaction` es legacy (transacciones Firestore), ignorado en PG.
 */
const marcarCuponComoUtilizado = async (_transaction, _db, empresaId, codigo, _reservaId, _clienteIdUso) => {
    if (!codigo) return;
    const { rows } = await pool.query(
        `UPDATE cupones SET usos_actuales = usos_actuales + 1,
                activo = CASE WHEN usos_actuales + 1 >= usos_maximos THEN false ELSE true END
         WHERE empresa_id=$1 AND codigo=$2 AND activo=true RETURNING id`,
        [empresaId, codigo]
    );
    if (rows.length === 0) throw new Error(`El cupón ${codigo} no es válido o ya fue utilizado.`);
};

/**
 * Obtiene cupones activos de un cliente (para auto-detección en Agregar Propuesta).
 */
const obtenerCuponesCliente = async (_db, empresaId, clienteId) => {
    const { rows } = await pool.query(
        `SELECT * FROM cupones WHERE empresa_id=$1 AND cliente_id=$2 AND activo=true
         AND (vigencia_hasta IS NULL OR vigencia_hasta >= CURRENT_DATE)
         ORDER BY created_at DESC`,
        [empresaId, clienteId]
    );
    return rows.map(_mapearCupon);
};

/**
 * Obtiene todos los cupones con nombre del cliente (para tab CRM Cupones).
 */
const obtenerTodosCupones = async (_db, empresaId) => {
    const { rows } = await pool.query(
        `SELECT cu.*, cl.nombre AS cliente_nombre
         FROM cupones cu LEFT JOIN clientes cl ON cu.cliente_id = cl.id
         WHERE cu.empresa_id=$1 ORDER BY cu.created_at DESC`,
        [empresaId]
    );
    return rows.map(_mapearCupon);
};

/**
 * Obtiene detalle de uso de un cupón (reservas donde se aplicó).
 */
const obtenerUsoCupon = async (_db, empresaId, cuponCodigo) => {
    const { rows } = await pool.query(
        `SELECT r.id, r.id_reserva_canal, r.fecha_llegada, r.fecha_salida,
                r.estado, p.nombre AS alojamiento_nombre,
                (r.valores->>'valorHuesped')::numeric AS valor_huesped,
                (r.valores->>'descuentoCupon')::numeric AS descuento_cupon
         FROM reservas r LEFT JOIN propiedades p ON r.propiedad_id = p.id AND r.empresa_id = p.empresa_id
         WHERE r.empresa_id=$1 AND r.valores->>'codigoCupon'=$2
         ORDER BY r.fecha_llegada DESC`,
        [empresaId, cuponCodigo]
    );
    return rows.map(r => ({
        id: r.id, idReservaCanal: r.id_reserva_canal,
        fechaLlegada: r.fecha_llegada, fechaSalida: r.fecha_salida,
        estado: r.estado, alojamientoNombre: r.alojamiento_nombre,
        valorHuesped: Number(r.valor_huesped || 0),
        descuentoCupon: Number(r.descuento_cupon || 0),
    }));
};

/**
 * Edita un cupón existente (descuento, vigencia, usos, activo).
 */
const editarCupon = async (_db, empresaId, cuponId, datos) => {
    const { porcentajeDescuento, usosMaximos, vigenciaDesde, vigenciaHasta, activo } = datos;
    const { rows } = await pool.query(
        `UPDATE cupones SET descuento=COALESCE($3,descuento), usos_maximos=COALESCE($4,usos_maximos),
                vigencia_desde=$5, vigencia_hasta=$6, activo=COALESCE($7,activo)
         WHERE id=$1 AND empresa_id=$2 RETURNING *`,
        [cuponId, empresaId, porcentajeDescuento, usosMaximos, vigenciaDesde || null, vigenciaHasta || null, activo]
    );
    if (!rows[0]) throw new Error('Cupón no encontrado.');
    return _mapearCupon(rows[0]);
};

/**
 * Elimina un cupón solo si no ha sido usado.
 */
const eliminarCupon = async (_db, empresaId, cuponId) => {
    const { rows } = await pool.query(
        'DELETE FROM cupones WHERE id=$1 AND empresa_id=$2 AND usos_actuales=0 RETURNING id',
        [cuponId, empresaId]
    );
    if (!rows[0]) throw new Error('No se puede eliminar: el cupón no existe o ya fue utilizado.');
    return { deleted: true };
};

module.exports = {
    generarCuponParaCliente, validarCupon, marcarCuponComoUtilizado,
    obtenerCuponesCliente, obtenerTodosCupones, obtenerUsoCupon,
    editarCupon, eliminarCupon
};
