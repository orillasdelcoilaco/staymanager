// backend/services/clientesService.js
const pool = require('../db/postgres');
const { createGoogleContact, updateGoogleContact } = require('./googleContactsService');
const { segmentarClienteRFM } = require('./crmService');
const { obtenerValorDolarHoy } = require('./dolarService');

const normalizarTelefono = (telefono) => {
    if (!telefono) return null;
    let fono = telefono.toString().replace(/\D/g, '');
    if (fono.startsWith('569') && fono.length === 11) return fono;
    return fono;
};

const normalizarNombre = (nombre) => {
    if (!nombre) return '';
    return nombre
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(' ');
};

function mapearCliente(row) {
    if (!row) return null;
    const m = row.metadata || {};
    return {
        id: row.id,
        nombre: row.nombre,
        apellido: row.apellido || '',
        email: row.email || '',
        telefono: row.telefono || '',
        pais: row.pais || '',
        calificacion: row.calificacion || 0,
        bloqueado: row.bloqueado || false,
        motivoBloqueo: row.motivo_bloqueo || '',
        notas: row.notas || '',
        telefonoNormalizado: row.telefono_normalizado || m.telefonoNormalizado || null,
        idCompuesto: m.idCompuesto || null,
        origen: m.origen || 'Importado',
        googleContactSynced: m.googleContactSynced || false,
        tipoCliente: m.tipoCliente || 'Cliente Nuevo',
        numeroDeReservas: m.numeroDeReservas || 0,
        totalGastado: m.totalGastado || 0,
        rfmSegmento: m.rfmSegmento || null,
        ubicacion: m.ubicacion || '',
        fechaCreacion: row.created_at?.toISOString() || null,
    };
}

async function _buscarClientePG(empresaId, campo, valor, nombreNormalizado) {
    let query;
    if (campo === 'telefonoNormalizado') {
        query = `SELECT * FROM clientes WHERE empresa_id = $1
                 AND (telefono_normalizado = $2 OR metadata->>'telefonoNormalizado' = $2)
                 LIMIT 1`;
    } else {
        query = `SELECT * FROM clientes WHERE empresa_id = $1 AND metadata->>'${campo}' = $2 LIMIT 1`;
    }
    const { rows } = await pool.query(query, [empresaId, valor]);
    if (!rows[0]) return null;
    const cliente = mapearCliente(rows[0]);
    if (cliente.nombre !== nombreNormalizado) {
        await pool.query('UPDATE clientes SET nombre = $1, updated_at = NOW() WHERE id = $2', [nombreNormalizado, rows[0].id]);
        cliente.nombre = nombreNormalizado;
    }
    return { cliente, status: 'encontrado' };
}

async function _crearClientePG(empresaId, datosCliente, telefonoNormalizado, nombreNormalizado) {
    const metadata = {
        telefonoNormalizado,
        idCompuesto: datosCliente.idCompuesto || null,
        origen: 'Importado',
        googleContactSynced: false,
        tipoCliente: 'Cliente Nuevo',
        numeroDeReservas: 0,
        totalGastado: 0,
        ubicacion: datosCliente.ubicacion || '',
    };
    const { rows } = await pool.query(
        `INSERT INTO clientes
             (empresa_id, nombre, email, telefono, pais, calificacion, bloqueado,
              motivo_bloqueo, notas, metadata, telefono_normalizado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (empresa_id, telefono_normalizado)
             WHERE telefono_normalizado IS NOT NULL
         DO UPDATE SET
             nombre = EXCLUDED.nombre,
             updated_at = NOW()
         RETURNING *`,
        [empresaId, nombreNormalizado || 'Cliente por Asignar', datosCliente.email || '',
         datosCliente.telefono || '56999999999', datosCliente.pais || '',
         datosCliente.calificacion || 0, false, '', datosCliente.notas || '',
         JSON.stringify(metadata), telefonoNormalizado || null]
    );
    return mapearCliente(rows[0]);
}

const crearOActualizarCliente = async (db, empresaId, datosCliente) => {
    const telefonoNormalizado = normalizarTelefono(datosCliente.telefono);
    const nombreNormalizado = normalizarNombre(datosCliente.nombre);

    if (telefonoNormalizado) {
        const found = await _buscarClientePG(empresaId, 'telefonoNormalizado', telefonoNormalizado, nombreNormalizado);
        if (found) return found;
    }
    if (datosCliente.idCompuesto) {
        const found = await _buscarClientePG(empresaId, 'idCompuesto', datosCliente.idCompuesto, nombreNormalizado);
        if (found) return found;
    }
    const nuevoCliente = await _crearClientePG(empresaId, datosCliente, telefonoNormalizado, nombreNormalizado);
    if (datosCliente.canalNombre && datosCliente.idReservaCanal && telefonoNormalizado) {
        sincronizarClienteGoogle(db, empresaId, nuevoCliente.id, {
            nombre: nuevoCliente.nombre, telefono: nuevoCliente.telefono,
            email: nuevoCliente.email, canalNombre: datosCliente.canalNombre,
            idReservaCanal: datosCliente.idReservaCanal,
        }).catch(err => console.warn(`[Auto-Sync] No se pudo crear el contacto en Google para ${nuevoCliente.email}: ${err.message}`));
    }
    return { cliente: nuevoCliente, status: 'creado' };
};

const obtenerClientesPorEmpresa = async (_db, empresaId) => {
    const { rows } = await pool.query(
        'SELECT * FROM clientes WHERE empresa_id = $1 ORDER BY nombre ASC',
        [empresaId]
    );
    return rows.map(mapearCliente);
};

const obtenerClientePorId = async (_db, empresaId, clienteId) => {
    const { rows: clienteRows } = await pool.query(
        'SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2',
        [clienteId, empresaId]
    );
    if (!clienteRows[0]) throw new Error('Cliente no encontrado');
    const cliente = mapearCliente(clienteRows[0]);
    const { rows: reservaRows } = await pool.query(
        `SELECT id, id_reserva_canal, propiedad_id, canal_id, alojamiento_nombre, canal_nombre,
                nombre_cliente, fecha_llegada, fecha_salida, total_noches, estado, estado_gestion,
                moneda, valores, documentos, created_at
         FROM reservas WHERE empresa_id = $1 AND cliente_id = $2
         ORDER BY fecha_llegada DESC`,
        [empresaId, clienteId]
    );
    const reservas = reservaRows.map(r => ({
        id: r.id,
        idReservaCanal: r.id_reserva_canal,
        propiedadId: r.propiedad_id,
        canalId: r.canal_id,
        alojamientoNombre: r.alojamiento_nombre,
        canalNombre: r.canal_nombre,
        nombreCliente: r.nombre_cliente,
        fechaLlegada: r.fecha_llegada?.toISOString() || null,
        fechaSalida: r.fecha_salida?.toISOString() || null,
        totalNoches: r.total_noches,
        estado: r.estado,
        estadoGestion: r.estado_gestion,
        moneda: r.moneda,
        valores: r.valores || {},
        documentos: r.documentos || {},
        fechaCreacion: r.created_at?.toISOString() || null,
    }));
    return { ...cliente, reservas };
};

async function _actualizarClientePG(empresaId, clienteId, datosActualizados, datosAntiguos, db) {
    const metadataUpdates = {};
    if (datosActualizados.telefonoNormalizado !== undefined) metadataUpdates.telefonoNormalizado = datosActualizados.telefonoNormalizado;
    if (datosActualizados.tipoCliente !== undefined)        metadataUpdates.tipoCliente          = datosActualizados.tipoCliente;
    if (datosActualizados.googleContactSynced !== undefined) metadataUpdates.googleContactSynced = datosActualizados.googleContactSynced;
    if (datosActualizados.ubicacion !== undefined)          metadataUpdates.ubicacion            = datosActualizados.ubicacion;

    await pool.query(
        `UPDATE clientes SET
            nombre         = COALESCE($2, nombre),
            email          = COALESCE($3, email),
            telefono       = COALESCE($4, telefono),
            pais           = COALESCE($5, pais),
            calificacion   = COALESCE($6, calificacion),
            bloqueado      = COALESCE($7, bloqueado),
            motivo_bloqueo = COALESCE($8, motivo_bloqueo),
            notas          = COALESCE($9, notas),
            metadata       = metadata || $10::jsonb,
            updated_at     = NOW()
         WHERE id = $1 AND empresa_id = $11`,
        [clienteId, datosActualizados.nombre || null, datosActualizados.email || null,
         datosActualizados.telefono || null, datosActualizados.pais || null,
         datosActualizados.calificacion ?? null, datosActualizados.bloqueado ?? null,
         datosActualizados.motivoBloqueo ?? null, datosActualizados.notas || null,
         JSON.stringify(metadataUpdates), empresaId]
    );

    if (datosActualizados.bloqueado === true || datosActualizados.bloqueado === false) {
        const bloqueoPayload = datosActualizados.bloqueado
            ? { alertaBloqueo: true,  motivoBloqueo: datosActualizados.motivoBloqueo || '' }
            : { alertaBloqueo: false, motivoBloqueo: '' };
        await pool.query(
            `UPDATE reservas SET valores = valores || $1::jsonb, updated_at = NOW() WHERE empresa_id = $2 AND cliente_id = $3`,
            [JSON.stringify(bloqueoPayload), empresaId, clienteId]
        );
    }

    if (datosAntiguos.googleContactSynced) {
        const { rows: rRows } = await pool.query(
            `SELECT id_reserva_canal, canal_nombre FROM reservas WHERE empresa_id = $1 AND cliente_id = $2 ORDER BY created_at DESC LIMIT 1`,
            [empresaId, clienteId]
        );
        if (rRows[0]) {
            updateGoogleContact(db, empresaId, `${datosAntiguos.nombre} ${rRows[0].canal_nombre} ${rRows[0].id_reserva_canal}`, {
                nombre: datosActualizados.nombre || datosAntiguos.nombre,
                telefono: datosActualizados.telefono || datosAntiguos.telefono,
                email: datosActualizados.email || datosAntiguos.email,
                canalNombre: rRows[0].canal_nombre, idReservaCanal: rRows[0].id_reserva_canal,
            }).catch(err => console.error(`[Auto-Update] Falló actualización contacto Google para ${clienteId}: ${err.message}`));
        }
    }
}

const actualizarCliente = async (db, empresaId, clienteId, datosActualizados) => {
    if (datosActualizados.telefono) {
        datosActualizados.telefonoNormalizado = normalizarTelefono(datosActualizados.telefono);
    }
    if (datosActualizados.nombre) {
        datosActualizados.nombre = normalizarNombre(datosActualizados.nombre);
    }
    const { rows: ex } = await pool.query('SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2', [clienteId, empresaId]);
    if (!ex[0]) throw new Error('El cliente a actualizar no fue encontrado.');
    await _actualizarClientePG(empresaId, clienteId, datosActualizados, mapearCliente(ex[0]), db);
    return { id: clienteId, ...datosActualizados };
};

const eliminarCliente = async (_db, empresaId, clienteId) => {
    await pool.query('DELETE FROM clientes WHERE id = $1 AND empresa_id = $2', [clienteId, empresaId]);
};

const sincronizarClienteGoogle = async (db, empresaId, clienteId, overrideData = null) => {
    let contactPayload;
    if (overrideData) {
        contactPayload = overrideData;
    } else {
        const { rows: cRows } = await pool.query(
            'SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2',
            [clienteId, empresaId]
        );
        if (!cRows[0]) throw new Error('El cliente no existe.');
        const clienteData = mapearCliente(cRows[0]);
        const { rows: rRows } = await pool.query(
            `SELECT id_reserva_canal, canal_nombre FROM reservas
             WHERE empresa_id = $1 AND cliente_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [empresaId, clienteId]
        );
        if (!rRows[0]) throw new Error('No se encontraron reservas para este cliente.');
        contactPayload = {
            nombre: clienteData.nombre,
            telefono: clienteData.telefono,
            email: clienteData.email,
            canalNombre: rRows[0].canal_nombre,
            idReservaCanal: rRows[0].id_reserva_canal,
        };
    }

    const result = await createGoogleContact(db, empresaId, contactPayload);
    if (result.status === 'created' || result.status === 'exists') {
        await pool.query(
            `UPDATE clientes SET metadata = metadata || '{"googleContactSynced": true}'::jsonb, updated_at = NOW()
             WHERE id = $1 AND empresa_id = $2`,
            [clienteId, empresaId]
        );
        return {
            success: true,
            message: `Contacto para "${contactPayload.nombre}" ${result.status === 'exists' ? 'ya existía' : 'fue creado'} en Google.`,
        };
    }
    throw new Error(result.message);
};

const recalcularEstadisticasClientes = async (db, empresaId) => {
    const dolarHoyData = await obtenerValorDolarHoy(db, empresaId);
    const valorDolarHoy = dolarHoyData ? dolarHoyData.valor : 950;
    const fechaActual = new Date();
    fechaActual.setUTCHours(0, 0, 0, 0);

    const [{ rows: clientes }, { rows: reservas }] = await Promise.all([
        pool.query('SELECT id FROM clientes WHERE empresa_id = $1', [empresaId]),
        pool.query(
            `SELECT cliente_id, moneda, estado_gestion, fecha_llegada, valores
             FROM reservas WHERE empresa_id = $1 AND estado = 'Confirmada'`,
            [empresaId]
        ),
    ]);
    if (!clientes.length) return { actualizados: 0, total: 0 };

    const reservasPorCliente = new Map();
    for (const r of reservas) {
        if (!reservasPorCliente.has(r.cliente_id)) reservasPorCliente.set(r.cliente_id, []);
        reservasPorCliente.get(r.cliente_id).push(r);
    }

    let actualizados = 0;
    for (const c of clientes) {
        const historial = reservasPorCliente.get(c.id) || [];
        const numeroDeReservas = historial.length;
        const totalGastado = historial.reduce((sum, r) => {
            const moneda = r.moneda || 'CLP';
            const fechaLlegada = r.fecha_llegada ? new Date(r.fecha_llegada) : null;
            const esFacturado = r.estado_gestion === 'Facturado';
            const esPasado = fechaLlegada && fechaLlegada < fechaActual;
            const esFijo = esFacturado || esPasado;
            let val = r.valores?.valorHuesped || 0;
            if (moneda !== 'CLP' && !esFijo) {
                const original = r.valores?.valorHuespedOriginal || 0;
                if (original > 0) val = Math.round(original * valorDolarHoy);
            }
            return sum + val;
        }, 0);

        let tipoCliente = 'Cliente Nuevo';
        if (numeroDeReservas === 0) tipoCliente = 'Sin Reservas';
        else if (totalGastado > 1000000) tipoCliente = 'Cliente Premium';
        else if (numeroDeReservas > 1) tipoCliente = 'Cliente Frecuente';

        const rfmSegmento = segmentarClienteRFM(historial, totalGastado);
        await pool.query(
            `UPDATE clientes SET metadata = metadata || $2::jsonb, updated_at = NOW()
             WHERE id = $1 AND empresa_id = $3`,
            [c.id, JSON.stringify({ totalGastado, numeroDeReservas, tipoCliente, rfmSegmento }), empresaId]
        );
        actualizados++;
    }
    return { actualizados, total: clientes.length };
};

module.exports = {
    crearOActualizarCliente,
    obtenerClientesPorEmpresa,
    obtenerClientePorId,
    actualizarCliente,
    eliminarCliente,
    sincronizarClienteGoogle,
    normalizarTelefono,
    recalcularEstadisticasClientes,
};
