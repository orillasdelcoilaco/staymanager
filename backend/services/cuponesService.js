// backend/services/cuponesService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

const generarCodigoUnico = (nombreCliente, porcentaje) => {
    const iniciales = nombreCliente.split(' ').map(n => n[0]).join('').toUpperCase();
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${iniciales}${porcentaje}-${randomChars}`;
};

const generarCuponParaCliente = async (db, empresaId, clienteId, porcentajeDescuento) => {
    if (!clienteId || !porcentajeDescuento) throw new Error('Se requieren el ID del cliente y el porcentaje de descuento.');

    if (pool) {
        const { rows: cliRows } = await pool.query('SELECT nombre FROM clientes WHERE id=$1 AND empresa_id=$2', [clienteId, empresaId]);
        if (!cliRows[0]) throw new Error('El cliente especificado no existe.');
        const nombreCliente = cliRows[0].nombre;
        const codigo = generarCodigoUnico(nombreCliente, porcentajeDescuento);
        await pool.query(
            `INSERT INTO cupones (empresa_id, codigo, descuento, tipo_descuento, activo, usos_maximos) VALUES ($1,$2,$3,'porcentaje',true,1)`,
            [empresaId, codigo, porcentajeDescuento]
        );
        return { codigo, clienteIdPropietario: clienteId, nombrePropietario: nombreCliente, porcentajeDescuento, estado: 'disponible' };
    }

    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    const clienteDoc = await clienteRef.get();
    if (!clienteDoc.exists) throw new Error('El cliente especificado no existe.');
    const nombreCliente = clienteDoc.data().nombre;

    const cuponesRef = db.collection('empresas').doc(empresaId).collection('cupones');
    const snapshot = await cuponesRef.where('clienteIdPropietario', '==', clienteId).where('estado', '==', 'disponible').get();
    if (!snapshot.empty) throw new Error('Este cliente ya tiene un cupón de descuento activo.');

    const codigo = generarCodigoUnico(nombreCliente, porcentajeDescuento);
    const nuevoCupon = {
        codigo, clienteIdPropietario: clienteId, nombrePropietario: nombreCliente,
        porcentajeDescuento, estado: 'disponible',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        fechaUso: null, reservaIdUso: null, clienteIdUso: null
    };
    await cuponesRef.doc(codigo).set(nuevoCupon);
    return nuevoCupon;
};

const validarCupon = async (db, empresaId, codigo) => {
    if (!codigo) throw new Error('Se requiere un código de cupón.');

    if (pool) {
        const { rows } = await pool.query('SELECT * FROM cupones WHERE empresa_id=$1 AND codigo=$2 LIMIT 1', [empresaId, codigo]);
        if (!rows[0]) throw { status: 404, message: 'El cupón no existe.' };
        const c = rows[0];
        if (!c.activo || c.usos_actuales >= (c.usos_maximos || 1)) {
            throw { status: 400, message: 'Este cupón ya fue utilizado.' };
        }
        return { codigo: c.codigo, porcentajeDescuento: c.descuento, estado: 'disponible' };
    }

    const cuponDoc = await db.collection('empresas').doc(empresaId).collection('cupones').doc(codigo).get();
    if (!cuponDoc.exists) throw { status: 404, message: 'El cupón no existe.' };
    const cupon = cuponDoc.data();
    if (cupon.estado !== 'disponible') throw { status: 400, message: `Este cupón ya fue utilizado el ${cupon.fechaUso.toDate().toLocaleDateString()}.` };
    return cupon;
};

const marcarCuponComoUtilizado = async (transaction, db, empresaId, codigo, reservaId, clienteIdUso) => {
    if (!codigo || !reservaId || !clienteIdUso) return;

    if (pool) {
        const { rowCount } = await pool.query(
            `UPDATE cupones SET activo=false, usos_actuales=usos_actuales+1 WHERE empresa_id=$1 AND codigo=$2 AND activo=true`,
            [empresaId, codigo]
        );
        if (rowCount === 0) throw new Error(`El cupón ${codigo} no es válido o ya fue utilizado.`);
        return;
    }

    const cuponRef = db.collection('empresas').doc(empresaId).collection('cupones').doc(codigo);
    const cuponDoc = await transaction.get(cuponRef);
    if (!cuponDoc.exists || cuponDoc.data().estado !== 'disponible') throw new Error(`El cupón ${codigo} no es válido o ya fue utilizado.`);
    transaction.update(cuponRef, {
        estado: 'utilizado',
        fechaUso: admin.firestore.FieldValue.serverTimestamp(),
        reservaIdUso: reservaId,
        clienteIdUso
    });
};

module.exports = { generarCuponParaCliente, validarCupon, marcarCuponComoUtilizado };
