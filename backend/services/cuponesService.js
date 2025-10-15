// backend/services/cuponesService.js
const admin = require('firebase-admin');

const generarCodigoUnico = (nombreCliente, porcentaje) => {
    const iniciales = nombreCliente.split(' ').map(n => n[0]).join('').toUpperCase();
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${iniciales}${porcentaje}-${randomChars}`;
};

const generarCuponParaCliente = async (db, empresaId, clienteId, porcentajeDescuento) => {
    if (!clienteId || !porcentajeDescuento) {
        throw new Error('Se requieren el ID del cliente y el porcentaje de descuento.');
    }

    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    const clienteDoc = await clienteRef.get();
    if (!clienteDoc.exists) {
        throw new Error('El cliente especificado no existe.');
    }
    const nombreCliente = clienteDoc.data().nombre;

    const cuponesRef = db.collection('empresas').doc(empresaId).collection('cupones');
    
    // Opcional: Validar si el cliente ya tiene un cupón activo
    const q = cuponesRef.where('clienteIdPropietario', '==', clienteId).where('estado', '==', 'disponible');
    const snapshot = await q.get();
    if (!snapshot.empty) {
        throw new Error('Este cliente ya tiene un cupón de descuento activo.');
    }

    const codigo = generarCodigoUnico(nombreCliente, porcentajeDescuento);
    
    const nuevoCupon = {
        codigo,
        clienteIdPropietario: clienteId,
        nombrePropietario: nombreCliente,
        porcentajeDescuento,
        estado: 'disponible',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        fechaUso: null,
        reservaIdUso: null,
        clienteIdUso: null
    };

    await cuponesRef.doc(codigo).set(nuevoCupon);
    return nuevoCupon;
};

const validarCupon = async (db, empresaId, codigo) => {
    if (!codigo) {
        throw new Error('Se requiere un código de cupón.');
    }
    const cuponRef = db.collection('empresas').doc(empresaId).collection('cupones').doc(codigo);
    const cuponDoc = await cuponRef.get();

    if (!cuponDoc.exists) {
        throw { status: 404, message: 'El cupón no existe.' };
    }
    const cupon = cuponDoc.data();
    if (cupon.estado !== 'disponible') {
        throw { status: 400, message: `Este cupón ya fue utilizado el ${cupon.fechaUso.toDate().toLocaleDateString()}.` };
    }

    return cupon;
};

const marcarCuponComoUtilizado = async (transaction, db, empresaId, codigo, reservaId, clienteIdUso) => {
    if (!codigo || !reservaId || !clienteIdUso) return;

    const cuponRef = db.collection('empresas').doc(empresaId).collection('cupones').doc(codigo);
    const cuponDoc = await transaction.get(cuponRef);

    if (!cuponDoc.exists || cuponDoc.data().estado !== 'disponible') {
        throw new Error(`El cupón ${codigo} no es válido o ya fue utilizado.`);
    }

    transaction.update(cuponRef, {
        estado: 'utilizado',
        fechaUso: admin.firestore.FieldValue.serverTimestamp(),
        reservaIdUso: reservaId,
        clienteIdUso: clienteIdUso
    });
};

module.exports = {
    generarCuponParaCliente,
    validarCupon,
    marcarCuponComoUtilizado
};