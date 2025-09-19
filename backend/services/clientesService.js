const admin = require('firebase-admin');

const normalizarTelefono = (telefono) => {
    if (!telefono) return null;
    let fono = telefono.toString().replace(/\D/g, '');
    if (fono.startsWith('569') && fono.length === 11) return fono;
    return fono;
};

const crearOActualizarCliente = async (db, empresaId, datosCliente) => {
    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');
    
    const telefonoNormalizado = normalizarTelefono(datosCliente.telefono);
    if (telefonoNormalizado) {
        const q = clientesRef.where('telefonoNormalizado', '==', telefonoNormalizado);
        const snapshot = await q.get();
        if (!snapshot.empty) {
            const clienteDoc = snapshot.docs[0];
            const datosAActualizar = {
                nombre: clienteDoc.data().nombre === 'Cliente por Asignar' ? (datosCliente.nombre || 'Cliente por Asignar') : clienteDoc.data().nombre,
                email: clienteDoc.data().email ? clienteDoc.data().email : (datosCliente.email || ''),
                fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
            };
            await clienteDoc.ref.update(datosAActualizar);
            const clienteData = clienteDoc.data();
            return { ...clienteData, ...datosAActualizar };
        }
    }

    if (datosCliente.idCompuesto) {
        const q = clientesRef.where('idCompuesto', '==', datosCliente.idCompuesto);
        const snapshot = await q.get();
        if (!snapshot.empty) {
            return snapshot.docs[0].data();
        }
    }

    const nuevoClienteRef = clientesRef.doc();
    const nuevoCliente = {
        id: nuevoClienteRef.id,
        nombre: datosCliente.nombre || 'Cliente por Asignar',
        email: datosCliente.email || '',
        telefono: datosCliente.telefono || '56999999999',
        telefonoNormalizado: telefonoNormalizado,
        idCompuesto: datosCliente.idCompuesto || null,
        pais: datosCliente.pais || '',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        origen: 'Importado'
    };
    await nuevoClienteRef.set(nuevoCliente);
    return nuevoCliente;
};

const obtenerClientesPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('clientes').orderBy('nombre').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const actualizarCliente = async (db, empresaId, clienteId, datosActualizados) => {
    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    if (datosActualizados.telefono) {
        datosActualizados.telefonoNormalizado = normalizarTelefono(datosActualizados.telefono);
    }
    await clienteRef.update({
        ...datosActualizados,
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    });
    return { id: clienteId, ...datosActualizados };
};

const eliminarCliente = async (db, empresaId, clienteId) => {
    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    await clienteRef.delete();
};

module.exports = {
    crearOActualizarCliente,
    obtenerClientesPorEmpresa,
    actualizarCliente,
    eliminarCliente
};