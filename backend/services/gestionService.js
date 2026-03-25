// backend/services/gestionService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { getValoresCLP } = require('./utils/calculoValoresService');
const { obtenerEstados } = require('./estadosService');

const splitIntoChunks = (arr, size) => {
    if (!arr || arr.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
};

// Normalizes a PG reserva row to the shape the aggregation logic expects
function normalizarReservaPG(row) {
    const valores = row.valores || {};
    return {
        id:                    row.id,
        idReservaCanal:        row.id_reserva_canal,
        propiedadId:           row.propiedad_id,
        canalId:               row.canal_id,
        clienteId:             row.cliente_id,
        alojamientoNombre:     row.alojamiento_nombre,
        canalNombre:           row.canal_nombre,
        nombreCliente:         row.nombre_cliente,
        fechaLlegada:          { toDate: () => new Date(row.fecha_llegada) },
        fechaSalida:           { toDate: () => new Date(row.fecha_salida) },
        totalNoches:           row.total_noches,
        estado:                row.estado,
        estadoGestion:         row.estado_gestion,
        moneda:                row.moneda || 'CLP',
        valores,
        documentos:            row.documentos || {},
        alertaBloqueo:         valores.alertaBloqueo || false,
        motivoBloqueo:         valores.motivoBloqueo || '',
        ajusteManualRealizado: row.ajuste_manual_realizado || false,
        potencialCalculado:    row.potencial_calculado    || false,
        clienteGestionado:     row.cliente_gestionado     || false,
    };
}

const getReservasPendientes = async (db, empresaId) => {
    if (pool) {
        const { rows: estadosRows } = await pool.query(
            'SELECT nombre FROM estados_reserva WHERE empresa_id = $1 AND es_gestion = true',
            [empresaId]
        );
        const estadosDeGestion = estadosRows.map(r => r.nombre);

        let reservasRows;
        if (estadosDeGestion.length > 0) {
            const { rows } = await pool.query(
                `SELECT * FROM reservas
                 WHERE empresa_id = $1
                   AND ((estado = 'Confirmada' AND estado_gestion = ANY($2)) OR estado = 'Desconocido')
                 ORDER BY fecha_llegada ASC`,
                [empresaId, estadosDeGestion]
            );
            reservasRows = rows;
        } else {
            const { rows } = await pool.query(
                `SELECT * FROM reservas WHERE empresa_id = $1 AND estado = 'Desconocido'
                 ORDER BY fecha_llegada ASC`,
                [empresaId]
            );
            reservasRows = rows;
        }

        if (!reservasRows.length) return { grupos: [], hasMore: false, lastVisible: null };

        const allReservasData = reservasRows.map(normalizarReservaPG);

        const allReservasConCLP = await Promise.all(
            allReservasData.map(async (reserva) => {
                const valoresCLP = await getValoresCLP(db, empresaId, reserva);
                return { ...reserva, valoresCLP };
            })
        );

        const clienteIds     = [...new Set(allReservasConCLP.map(r => r.clienteId).filter(Boolean))];
        const idsCanalUnicos = [...new Set(allReservasConCLP.map(r => r.idReservaCanal).filter(Boolean))];

        const [clientesRes, notasRes, transRes, historialRes] = await Promise.all([
            clienteIds.length
                ? pool.query('SELECT * FROM clientes WHERE empresa_id = $1 AND id = ANY($2)', [empresaId, clienteIds])
                : { rows: [] },
            idsCanalUnicos.length
                ? pool.query(
                    `SELECT id_reserva_canal, COUNT(*)::int AS count
                     FROM bitacora WHERE empresa_id = $1 AND id_reserva_canal = ANY($2)
                     GROUP BY id_reserva_canal`,
                    [empresaId, idsCanalUnicos]
                  )
                : { rows: [] },
            idsCanalUnicos.length
                ? pool.query(
                    `SELECT id_reserva_canal, SUM(monto) AS total, COUNT(*)::int AS count
                     FROM transacciones WHERE empresa_id = $1 AND id_reserva_canal = ANY($2)
                     GROUP BY id_reserva_canal`,
                    [empresaId, idsCanalUnicos]
                  )
                : { rows: [] },
            clienteIds.length
                ? pool.query(
                    `SELECT * FROM reservas WHERE empresa_id = $1 AND cliente_id = ANY($2) AND estado = 'Confirmada'`,
                    [empresaId, clienteIds]
                  )
                : { rows: [] },
        ]);

        const historialReservasConCLP = await Promise.all(
            historialRes.rows.map(normalizarReservaPG).map(async (reserva) => {
                const valoresCLP = await getValoresCLP(db, empresaId, reserva);
                return { ...reserva, valoresCLP };
            })
        );

        const clientsMap = new Map();
        clientesRes.rows.forEach(row => {
            const m = row.metadata || {};
            const historialCliente = historialReservasConCLP.filter(r => r.clienteId === row.id);
            const totalGastado     = historialCliente.reduce((s, r) => s + (r.valoresCLP.valorHuesped || 0), 0);
            const numeroDeReservas = historialCliente.length;
            let tipoCliente = 'Cliente Nuevo';
            if (totalGastado > 1000000) tipoCliente = 'Cliente Premium';
            else if (numeroDeReservas > 1) tipoCliente = 'Cliente Frecuente';
            clientsMap.set(row.id, {
                id: row.id, nombre: row.nombre, telefono: row.telefono,
                tipoCliente: m.tipoCliente || tipoCliente,
                numeroDeReservas: m.numeroDeReservas ?? numeroDeReservas,
            });
        });

        const notesCountMap = new Map(notasRes.rows.map(r => [r.id_reserva_canal, r.count]));
        const abonosMap     = new Map(transRes.rows.map(r => [r.id_reserva_canal, parseFloat(r.total) || 0]));
        const transCountMap = new Map(transRes.rows.map(r => [r.id_reserva_canal, r.count]));

        return _agruparYProcesar(allReservasConCLP, clientsMap, notesCountMap, abonosMap, transCountMap);
    }

    // Firestore fallback
    const reservasRef    = db.collection('empresas').doc(empresaId).collection('reservas');
    const estadosSnap    = await db.collection('empresas').doc(empresaId).collection('estadosReserva')
        .where('esEstadoDeGestion', '==', true).get();
    const estadosDeGestion = estadosSnap.docs.map(doc => doc.data().nombre);

    const queries = [];
    if (estadosDeGestion.length > 0) {
        splitIntoChunks(estadosDeGestion, 30).forEach(chunk => {
            queries.push(reservasRef.where('estado', '==', 'Confirmada').where('estadoGestion', 'in', chunk).get());
        });
    }
    queries.push(reservasRef.where('estado', '==', 'Desconocido').get());

    const snapshots = await Promise.all(queries);
    const allDocs   = [];
    const docIds    = new Set();
    snapshots.forEach(snapshot => {
        if (snapshot) snapshot.forEach(doc => {
            if (!docIds.has(doc.id)) { allDocs.push(doc); docIds.add(doc.id); }
        });
    });

    if (!allDocs.length) return { grupos: [], hasMore: false, lastVisible: null };

    allDocs.sort((a, b) => a.data().fechaLlegada.toDate() - b.data().fechaLlegada.toDate());
    const allReservasData = allDocs.map(doc => ({ id: doc.id, ...doc.data() }));

    const allReservasConCLP = await Promise.all(
        allReservasData.map(async (reserva) => {
            const valoresCLP = await getValoresCLP(db, empresaId, reserva);
            return { ...reserva, valoresCLP };
        })
    );

    const clienteIds          = [...new Set(allReservasConCLP.map(r => r.clienteId).filter(Boolean))];
    const reservaIdsOriginales = [...new Set(allReservasConCLP.map(r => r.idReservaCanal))];
    const clienteIdChunks     = splitIntoChunks(clienteIds, 30);
    const reservaIdChunks     = splitIntoChunks(reservaIdsOriginales, 30);

    const fetchInBatches = async (col, field, chunks) => {
        if (!chunks.length) return { docs: [] };
        const snaps = await Promise.all(chunks.map(c => db.collection('empresas').doc(empresaId).collection(col).where(field, 'in', c).get()));
        return { docs: snaps.flatMap(s => s.docs) };
    };
    const fetchByIdBatches = async (col, chunks) => {
        if (!chunks.length) return { docs: [] };
        const snaps = await Promise.all(chunks.map(c => db.collection('empresas').doc(empresaId).collection(col).where(admin.firestore.FieldPath.documentId(), 'in', c).get()));
        return { docs: snaps.flatMap(s => s.docs) };
    };

    const [clientesSnapshot, notasSnapshot, transaccionesSnapshot, historialSnap] = await Promise.all([
        fetchByIdBatches('clientes', clienteIdChunks),
        fetchInBatches('gestionNotas', 'reservaIdOriginal', reservaIdChunks),
        fetchInBatches('transacciones', 'reservaIdOriginal', reservaIdChunks),
        fetchInBatches('reservas', 'clienteId', clienteIdChunks),
    ]);

    const historialReservasConCLP = await Promise.all(
        historialSnap.docs.map(doc => doc.data()).filter(r => r.estado === 'Confirmada').map(async (reserva) => {
            const valoresCLP = await getValoresCLP(db, empresaId, reserva);
            return { ...reserva, valoresCLP };
        })
    );

    const clientsMap = new Map();
    clientesSnapshot.docs.forEach(doc => {
        const clienteData  = doc.data();
        const historialC   = historialReservasConCLP.filter(r => r.clienteId === doc.id);
        const totalGastado = historialC.reduce((s, r) => s + (r.valoresCLP.valorHuesped || 0), 0);
        const numReservas  = historialC.length;
        let tipoCliente = 'Cliente Nuevo';
        if (totalGastado > 1000000) tipoCliente = 'Cliente Premium';
        else if (numReservas > 1)   tipoCliente = 'Cliente Frecuente';
        clientsMap.set(doc.id, { ...clienteData, numeroDeReservas: numReservas, tipoCliente });
    });

    const notesCountMap = new Map();
    notasSnapshot.docs.forEach(doc => {
        const id = doc.data().reservaIdOriginal;
        notesCountMap.set(id, (notesCountMap.get(id) || 0) + 1);
    });
    const abonosMap = new Map();
    transaccionesSnapshot.docs.forEach(doc => {
        const id = doc.data().reservaIdOriginal;
        abonosMap.set(id, (abonosMap.get(id) || 0) + (parseFloat(doc.data().monto) || 0));
    });
    const transCountMap = new Map();
    transaccionesSnapshot.docs.forEach(doc => {
        const id = doc.data().reservaIdOriginal;
        transCountMap.set(id, (transCountMap.get(id) || 0) + 1);
    });

    return _agruparYProcesar(allReservasConCLP, clientsMap, notesCountMap, abonosMap, transCountMap);
};

function _agruparYProcesar(allReservasConCLP, clientsMap, notesCountMap, abonosMap, transCountMap) {
    const reservasAgrupadas = new Map();
    allReservasConCLP.forEach(data => {
        const reservaId = data.idReservaCanal;
        if (!reservasAgrupadas.has(reservaId)) {
            const clienteActual = clientsMap.get(data.clienteId);
            reservasAgrupadas.set(reservaId, {
                reservaIdOriginal: reservaId,
                clienteId:         data.clienteId,
                clienteNombre:     clienteActual?.nombre || data.nombreCliente || 'Cliente Desconocido',
                telefono:          clienteActual?.telefono || 'N/A',
                tipoCliente:       clienteActual?.tipoCliente || 'Nuevo',
                numeroDeReservas:  clienteActual?.numeroDeReservas || 1,
                fechaLlegada:      data.fechaLlegada?.toDate(),
                fechaSalida:       data.fechaSalida?.toDate(),
                totalNoches:       data.totalNoches,
                estado:            data.estado,
                estadoGestion:     data.estadoGestion,
                clienteBloqueado:  data.alertaBloqueo === true,
                motivoBloqueo:     data.motivoBloqueo || '',
                abonoTotal:        abonosMap.get(reservaId) || 0,
                notasCount:        notesCountMap.get(reservaId) || 0,
                transaccionesCount: transCountMap.get(reservaId) || 0,
                reservasIndividuales: [],
            });
        }
        reservasAgrupadas.get(reservaId).reservasIndividuales.push(data);
    });

    const gruposProcesados = Array.from(reservasAgrupadas.values()).map(grupo => {
        const primerReserva    = grupo.reservasIndividuales[0];
        const monedaGrupo      = primerReserva.moneda || 'CLP';
        const estadoGestionGrupo = primerReserva.estadoGestion;

        const valoresAgregados = grupo.reservasIndividuales.reduce((acc, r) => {
            acc.valorTotalHuesped    += r.valoresCLP.valorHuesped;
            acc.costoCanal           += r.valoresCLP.costoCanal;
            acc.payoutFinalReal      += r.valoresCLP.payout;
            acc.valorListaBaseTotal  += r.valores?.valorOriginal || 0;
            if (r.ajusteManualRealizado) acc.ajusteManualRealizado = true;
            if (r.potencialCalculado)    acc.potencialCalculado    = true;
            if (r.clienteGestionado)     acc.clienteGestionado     = true;
            if (r.documentos) acc.documentos = { ...acc.documentos, ...r.documentos };
            return acc;
        }, { valorTotalHuesped: 0, costoCanal: 0, payoutFinalReal: 0, valorListaBaseTotal: 0, ajusteManualRealizado: false, potencialCalculado: false, clienteGestionado: false, documentos: {} });

        const resultado = { ...grupo, ...valoresAgregados, esUSD: monedaGrupo === 'USD' };

        if (resultado.esUSD) {
            const valorDolarParaCalculo = (estadoGestionGrupo === 'Facturado')
                ? (primerReserva.valores?.valorDolarFacturacion || primerReserva.valoresCLP.valorDolarUsado || 950)
                : (primerReserva.valoresCLP.valorDolarUsado || 950);
            const totalPayoutUSD = grupo.reservasIndividuales.reduce((s, r) => s + (r.valores?.valorTotalOriginal || 0), 0);
            const totalIvaUSD    = grupo.reservasIndividuales.reduce((s, r) => s + (r.valores?.ivaOriginal    || 0), 0);
            resultado.valoresUSD = { payout: totalPayoutUSD, iva: totalIvaUSD, totalCliente: totalPayoutUSD + totalIvaUSD, valorDolar: valorDolarParaCalculo };
        }
        return resultado;
    });

    return { grupos: gruposProcesados, hasMore: false, lastVisible: null };
}

const actualizarEstadoGrupo = async (db, empresaId, idsIndividuales, nuevoEstado) => {
    const allEstados = await obtenerEstados(db, empresaId);
    const estadoDef  = allEstados.find(e => e.nombre === nuevoEstado);

    const updateData = {};
    if (estadoDef) {
        if (estadoDef.esEstadoPrincipal)  updateData.estado = nuevoEstado;
        if (estadoDef.esEstadoDeGestion)  updateData.estadoGestion = nuevoEstado;
        else if (estadoDef.esEstadoPrincipal) updateData.estadoGestion = null;
    } else {
        console.warn(`[actualizarEstadoGrupo] Estado "${nuevoEstado}" no encontrado. Actualizando solo estadoGestion.`);
        updateData.estadoGestion = nuevoEstado;
    }
    if (!Object.keys(updateData).length) updateData.estadoGestion = nuevoEstado;

    if (pool) {
        await pool.query(
            `UPDATE reservas SET
                estado         = COALESCE($2, estado),
                estado_gestion = $3,
                updated_at     = NOW()
             WHERE id = ANY($1) AND empresa_id = $4`,
            [idsIndividuales, updateData.estado || null, updateData.estadoGestion ?? null, empresaId]
        );
        return;
    }

    const batch = db.batch();
    idsIndividuales.forEach(id => {
        batch.update(
            db.collection('empresas').doc(empresaId).collection('reservas').doc(id),
            updateData
        );
    });
    await batch.commit();
};

const getNotas = async (db, empresaId, reservaIdOriginal) => {
    if (pool) {
        const { rows } = await pool.query(
            `SELECT * FROM bitacora WHERE empresa_id = $1 AND id_reserva_canal = $2 ORDER BY created_at DESC`,
            [empresaId, reservaIdOriginal]
        );
        return rows.map(row => ({
            id:                row.id,
            reservaIdOriginal: row.id_reserva_canal,
            texto:             row.texto,
            autor:             row.autor || '',
            fecha:             row.created_at?.toLocaleString('es-CL') || '',
        }));
    }
    const snapshot = await db.collection('empresas').doc(empresaId).collection('gestionNotas')
        .where('reservaIdOriginal', '==', reservaIdOriginal)
        .orderBy('fecha', 'desc')
        .get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        id:    doc.id,
        fecha: doc.data().fecha.toDate().toLocaleString('es-CL'),
    }));
};

const addNota = async (db, empresaId, notaData) => {
    if (pool) {
        const { rows } = await pool.query(
            `INSERT INTO bitacora (empresa_id, id_reserva_canal, texto, autor)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [empresaId, notaData.reservaIdOriginal, notaData.texto, notaData.autor || '']
        );
        return {
            id:                rows[0].id,
            reservaIdOriginal: rows[0].id_reserva_canal,
            texto:             rows[0].texto,
            autor:             rows[0].autor || '',
            fecha:             rows[0].created_at,
        };
    }
    const nota   = { ...notaData, fecha: admin.firestore.FieldValue.serverTimestamp() };
    const docRef = await db.collection('empresas').doc(empresaId).collection('gestionNotas').add(nota);
    return { id: docRef.id, ...nota };
};

const getTransacciones = async (db, empresaId, idsIndividuales) => {
    if (pool) {
        const { rows: reservaRows } = await pool.query(
            'SELECT id_reserva_canal FROM reservas WHERE id = $1 AND empresa_id = $2',
            [idsIndividuales[0], empresaId]
        );
        if (!reservaRows[0]) return [];
        const idReservaCanal = reservaRows[0].id_reserva_canal;
        const { rows } = await pool.query(
            `SELECT * FROM transacciones WHERE empresa_id = $1 AND id_reserva_canal = $2 ORDER BY created_at DESC`,
            [empresaId, idReservaCanal]
        );
        return rows.map(row => ({
            id:               row.id,
            reservaIdOriginal: row.id_reserva_canal,
            tipo:             row.tipo,
            monto:            row.monto,
            medioDePago:      row.metadata?.medioDePago || '',
            enlaceComprobante: row.metadata?.enlaceComprobante || null,
            fecha:            row.created_at || new Date(),
        }));
    }

    const reservaDoc = await db.collection('empresas').doc(empresaId).collection('reservas').doc(idsIndividuales[0]).get();
    if (!reservaDoc.exists) return [];
    const reservaIdOriginal = reservaDoc.data().idReservaCanal;
    const snapshot = await db.collection('empresas').doc(empresaId).collection('transacciones')
        .where('reservaIdOriginal', '==', reservaIdOriginal)
        .get();
    if (snapshot.empty) return [];
    const transacciones = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, fecha: data.fecha ? data.fecha.toDate() : new Date() };
    });
    transacciones.sort((a, b) => b.fecha - a.fecha);
    return transacciones;
};

const marcarClienteComoGestionado = async (db, empresaId, reservaIdOriginal) => {
    if (pool) {
        const { rowCount } = await pool.query(
            `UPDATE reservas SET cliente_gestionado = true, updated_at = NOW()
             WHERE empresa_id = $1 AND id_reserva_canal = $2`,
            [empresaId, reservaIdOriginal]
        );
        if (!rowCount) throw new Error('No se encontraron reservas para marcar al cliente como gestionado.');
        return;
    }
    const snapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('idReservaCanal', '==', reservaIdOriginal).get();
    if (snapshot.empty) throw new Error('No se encontraron reservas para marcar al cliente como gestionado.');
    const batch = db.batch();
    snapshot.forEach(doc => batch.update(doc.ref, { clienteGestionado: true }));
    await batch.commit();
};

module.exports = {
    getReservasPendientes,
    actualizarEstadoGrupo,
    getNotas,
    addNota,
    getTransacciones,
    marcarClienteComoGestionado,
};
