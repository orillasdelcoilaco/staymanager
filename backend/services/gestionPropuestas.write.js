// backend/services/gestionPropuestas.write.js
const { randomUUID } = require('crypto');
const pool = require('../db/postgres');
const admin = require('firebase-admin');
const { crearOActualizarCliente } = require('./clientesService');
const { recalcularValoresDesdeTotal } = require('./utils/calculoValoresService');
const { registrarAjusteValor } = require('./utils/trazabilidadService');
const { enviarEmailPropuesta } = require('./gestionPropuestas.email');

function _calcularFinanciero(valorOriginal, moneda, valorDolarDia, descuentoPct, descuentoFijo, valorFinalFijado, configuracionIva) {
    let ancla_Subtotal_USD = valorOriginal;
    if (moneda === 'CLP' && valorDolarDia > 0) {
        ancla_Subtotal_USD = valorOriginal / valorDolarDia;
    } else if (moneda === 'CLP' && !valorDolarDia) {
        throw new Error("Se requiere un valor de dólar para convertir el ancla de CLP a USD.");
    }
    let ancla_Iva_USD, ancla_TotalCliente_USD;
    if (configuracionIva === 'agregar') {
        ancla_Iva_USD = ancla_Subtotal_USD * 0.19;
        ancla_TotalCliente_USD = ancla_Subtotal_USD + ancla_Iva_USD;
    } else {
        ancla_TotalCliente_USD = ancla_Subtotal_USD;
        ancla_Iva_USD = ancla_TotalCliente_USD / 1.19 * 0.19;
    }
    let actual_TotalCliente_USD;
    if (valorFinalFijado && valorFinalFijado > 0) {
        if (!valorDolarDia) throw new Error("Se requiere un valor de dólar para convertir el Valor Final Fijo.");
        actual_TotalCliente_USD = valorFinalFijado / valorDolarDia;
    } else if (descuentoPct && descuentoPct > 0) {
        actual_TotalCliente_USD = ancla_TotalCliente_USD * (1 - (descuentoPct / 100));
    } else if (descuentoFijo && descuentoFijo > 0) {
        if (!valorDolarDia) throw new Error("Se requiere un valor de dólar para convertir el Descuento Fijo.");
        actual_TotalCliente_USD = ancla_TotalCliente_USD - (descuentoFijo / valorDolarDia);
    } else {
        actual_TotalCliente_USD = ancla_TotalCliente_USD;
    }
    const valoresActuales = recalcularValoresDesdeTotal(actual_TotalCliente_USD, configuracionIva, 0);
    return { ancla_TotalCliente_USD, ancla_Payout_USD: ancla_Subtotal_USD, ancla_Iva_USD, actual_TotalCliente_USD, valoresActuales };
}

function _buildValoresPropiedad(fin, proporcion, valorDolarDia, valorOriginal, descuentoPct, descuentoFijo, valorFinalFijado) {
    const { valoresActuales, ancla_TotalCliente_USD, ancla_Payout_USD, ancla_Iva_USD } = fin;
    const vd = valorDolarDia || 1;
    return {
        valorHuesped:   Math.round(valoresActuales.valorHuespedOriginal * proporcion * vd),
        valorTotal:     Math.round(valoresActuales.valorTotalOriginal   * proporcion * vd),
        comision: 0, costoCanal: 0,
        iva:            Math.round(valoresActuales.ivaOriginal          * proporcion * vd),
        valorOriginal,
        valorHuespedOriginal: valoresActuales.valorHuespedOriginal * proporcion,
        valorTotalOriginal:   valoresActuales.valorTotalOriginal   * proporcion,
        ivaOriginal:          valoresActuales.ivaOriginal          * proporcion,
        valorHuespedCalculado: ancla_TotalCliente_USD * proporcion,
        valorTotalCalculado:   ancla_Payout_USD       * proporcion,
        ivaCalculado:         ancla_Iva_USD           * proporcion,
        descuentoPct: descuentoPct || 0, descuentoFijo: descuentoFijo || 0, valorFinalFijado: valorFinalFijado || 0,
    };
}

async function _pgTransactionPropuesta(client, empresaId, idGrupo, propiedades, datos, fin, clienteId) {
    const { fechaLlegada, fechaSalida, noches, canalId, canalNombre, moneda, valorDolarDia, origen, icalUid, codigoCupon, personas, idPropuestaExistente, descuentoPct, descuentoFijo, valorFinalFijado, valorOriginal } = datos;
    let idCargaParaPreservar = null;
    if (idPropuestaExistente) {
        const { rows: ex } = await client.query(`SELECT id_carga FROM reservas WHERE empresa_id=$1 AND id_reserva_canal=$2 AND estado='Propuesta' LIMIT 1`, [empresaId, idPropuestaExistente]);
        if (ex.length > 0) idCargaParaPreservar = ex[0].id_carga;
        await client.query(`DELETE FROM reservas WHERE empresa_id=$1 AND id_reserva_canal=$2 AND estado='Propuesta'`, [empresaId, idPropuestaExistente]);
    }
    let personasAsignadas = false;
    for (const prop of propiedades) {
        const p = 1 / propiedades.length;
        const valores = _buildValoresPropiedad(fin, p, valorDolarDia, valorOriginal, descuentoPct, descuentoFijo, valorFinalFijado);
        await client.query(
            `INSERT INTO reservas (empresa_id, id_reserva_canal, propiedad_id, alojamiento_nombre, canal_id, canal_nombre, cliente_id, total_noches, estado, moneda, valor_dolar_dia, valores, cantidad_huespedes, fecha_llegada, fecha_salida, id_carga, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Propuesta',$9,$10,$11,$12,$13,$14,$15,$16)`,
            [empresaId, idGrupo, prop.id, prop.nombre, canalId, canalNombre, clienteId, noches, moneda, valorDolarDia || null, JSON.stringify(valores), personasAsignadas ? 0 : (personas || 0), fechaLlegada, fechaSalida, idCargaParaPreservar, JSON.stringify({ origen: origen || 'manual', icalUid: icalUid || null, cuponUtilizado: codigoCupon || null, edicionesManuales: {} })]
        );
        personasAsignadas = true;
    }
}

async function _fsTransactionPropuesta(transaction, db, reservasRef, idGrupo, propiedades, datos, fin, clienteId, usuarioEmail) {
    const { fechaLlegada, fechaSalida, noches, canalId, canalNombre, moneda, valorDolarDia, origen, icalUid, codigoCupon, personas, idPropuestaExistente, descuentoPct, descuentoFijo, valorFinalFijado, valorOriginal } = datos;
    let idCargaParaPreservar = null;
    if (idPropuestaExistente) {
        const snap = await transaction.get(reservasRef.where('idReservaCanal', '==', idPropuestaExistente).where('estado', '==', 'Propuesta'));
        if (!snap.empty) idCargaParaPreservar = snap.docs[0].data().idCarga;
        snap.forEach(doc => transaction.delete(doc.ref));
    }
    let personasAsignadas = false;
    for (const prop of propiedades) {
        const ref = reservasRef.doc();
        const p = 1 / propiedades.length;
        const valores = { ..._buildValoresPropiedad(fin, p, valorDolarDia, valorOriginal, descuentoPct, descuentoFijo, valorFinalFijado), comisionOriginal: 0, costoCanalOriginal: 0, comisionCalculado: 0, costoCanalCalculado: 0 };
        transaction.set(ref, {
            id: ref.id, idUnicoReserva: `${idGrupo}-${prop.id}`, idCarga: idCargaParaPreservar,
            idReservaCanal: idGrupo, icalUid: icalUid || null, clienteId, alojamientoId: prop.id,
            alojamientoNombre: prop.nombre, canalId: canalId || null, canalNombre: canalNombre || 'Por Defecto',
            fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(fechaLlegada + 'T00:00:00Z')),
            fechaSalida:  admin.firestore.Timestamp.fromDate(new Date(fechaSalida  + 'T00:00:00Z')),
            totalNoches: noches, cantidadHuespedes: personasAsignadas ? 0 : (personas || 0),
            estado: 'Propuesta', origen: origen || 'manual', moneda, valorDolarDia,
            cuponUtilizado: codigoCupon || null, valores, historialAjustes: [],
            fechaReserva: admin.firestore.FieldValue.serverTimestamp(),
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp(), fechaActualizacion: new Date()
        });
        await registrarAjusteValor(transaction, db, empresaId, ref, {
            fuente: idPropuestaExistente ? 'Edición Propuesta' : 'Creación Propuesta',
            usuarioEmail, valorAnteriorUSD: fin.ancla_TotalCliente_USD * p,
            valorNuevoUSD: fin.actual_TotalCliente_USD * p, valorDolarUsado: valorDolarDia
        });
        personasAsignadas = true;
    }
}

const guardarOActualizarPropuesta = async (db, empresaId, usuarioEmail, datos, idPropuestaExistente = null) => {
    const { cliente, propiedades, canalId, canalNombre, moneda, valorDolarDia, valorOriginal, descuentoPct, descuentoFijo, valorFinalFijado, idReservaCanal, plantillaId, enviarEmail, linkPago, noches, personas } = datos;
    const idGrupo = idReservaCanal || idPropuestaExistente || randomUUID();

    let clienteId, clienteData = cliente;
    if (cliente.id) {
        clienteId = cliente.id;
    } else if (cliente.nombre && cliente.telefono) {
        const res = await crearOActualizarCliente(db, empresaId, { nombre: cliente.nombre, telefono: cliente.telefono, email: cliente.email, canalNombre, idReservaCanal: idGrupo });
        clienteId = res.cliente.id; clienteData = res.cliente;
    } else { clienteId = null; }

    let configuracionIva;
    if (pool) {
        const { rows } = await pool.query('SELECT metadata FROM canales WHERE id = $1 AND empresa_id = $2', [canalId, empresaId]);
        if (!rows[0]) throw new Error("El canal seleccionado no es válido.");
        configuracionIva = rows[0].metadata?.configuracionIva || 'incluido';
    } else {
        const canalDoc = await db.collection('empresas').doc(empresaId).collection('canales').doc(canalId).get();
        if (!canalDoc.exists) throw new Error("El canal seleccionado no es válido.");
        configuracionIva = canalDoc.data().configuracionIva || 'incluido';
    }

    const fin = _calcularFinanciero(valorOriginal, moneda, valorDolarDia, descuentoPct, descuentoFijo, valorFinalFijado, configuracionIva);
    const datosCompletos = { ...datos, idPropuestaExistente };

    if (pool) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await _pgTransactionPropuesta(client, empresaId, idGrupo, propiedades, datosCompletos, fin, clienteId);
            await client.query('COMMIT');
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } else {
        await db.runTransaction(async (transaction) => {
            await _fsTransactionPropuesta(transaction, db, db.collection('empresas').doc(empresaId).collection('reservas'), idGrupo, propiedades, datosCompletos, fin, clienteId, usuarioEmail);
        });
    }

    if (enviarEmail && plantillaId && clienteData?.email) {
        try {
            await enviarEmailPropuesta(db, empresaId, { plantillaId, cliente: clienteData, propiedades, fechaLlegada: datos.fechaLlegada, fechaSalida: datos.fechaSalida, noches, personas, precioFinal: fin.actual_TotalCliente_USD * (valorDolarDia || 1), propuestaId: idGrupo, linkPago: datos.linkPago });
        } catch (e) { console.error('❌ Error enviando email de propuesta:', e.message); }
    }

    return { id: idGrupo };
};

const guardarPresupuesto = async (db, empresaId, datos) => {
    const { id, cliente, fechaLlegada, fechaSalida, propiedades, precioFinal, noches, texto } = datos;
    let clienteId = cliente.id;
    if (!clienteId && cliente.nombre) {
        const res = await crearOActualizarCliente(db, empresaId, { nombre: cliente.nombre, telefono: cliente.telefono, email: cliente.email });
        clienteId = res.cliente.id;
    }
    const datosPresupuesto = { clienteId, clienteNombre: cliente.nombre, fechaLlegada, fechaSalida, propiedades, monto: precioFinal, noches, texto, estado: 'Borrador' };

    if (pool) {
        if (id) {
            await pool.query(`UPDATE presupuestos SET datos = datos || $1::jsonb, updated_at = NOW() WHERE id = $2 AND empresa_id = $3`, [JSON.stringify(datosPresupuesto), id, empresaId]);
            return { id };
        }
        const { rows } = await pool.query(`INSERT INTO presupuestos (empresa_id, cliente_id, estado, datos) VALUES ($1,$2,'Borrador',$3) RETURNING id`, [empresaId, clienteId, JSON.stringify(datosPresupuesto)]);
        return { id: rows[0].id };
    }

    const ref = db.collection('empresas').doc(empresaId).collection('presupuestos');
    const fsData = { ...datosPresupuesto, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() };
    if (id) { await ref.doc(id).update(fsData); return { id }; }
    fsData.fechaCreacion = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await ref.add(fsData);
    return { id: docRef.id };
};

const rechazarPropuesta = async (db, empresaId, idsReservas) => {
    if (!idsReservas || idsReservas.length === 0) throw new Error("No se proporcionaron IDs de reserva para rechazar.");
    if (pool) { await pool.query(`DELETE FROM reservas WHERE id = ANY($1) AND empresa_id = $2`, [idsReservas, empresaId]); return; }
    const batch = db.batch();
    idsReservas.forEach(id => batch.delete(db.collection('empresas').doc(empresaId).collection('reservas').doc(id)));
    await batch.commit();
};

const rechazarPresupuesto = async (db, empresaId, presupuestoId) => {
    if (pool) { await pool.query(`UPDATE presupuestos SET estado = 'Rechazado', updated_at = NOW() WHERE id = $1 AND empresa_id = $2`, [presupuestoId, empresaId]); return; }
    await db.collection('empresas').doc(empresaId).collection('presupuestos').doc(presupuestoId).update({ estado: 'Rechazado' });
};

module.exports = { guardarOActualizarPropuesta, guardarPresupuesto, rechazarPropuesta, rechazarPresupuesto };
