const admin = require('firebase-admin');

/**
 * Normaliza un número de teléfono para usarlo como ID.
 * @param {string} telefono - El número de teléfono.
 * @returns {string|null} - El número normalizado o null si no es válido.
 */
const normalizarTelefono = (telefono) => {
    if (!telefono) return null;
    let fono = telefono.toString().replace(/\D/g, '');
    if (fono.startsWith('569') && fono.length === 11) {
        return fono;
    }
    return fono;
};

/**
 * Contiene la lógica de negocio para la gestión de clientes.
 */

const crearOActualizarCliente = async (db, empresaId, datosCliente) => {
    const telefonoNormalizado = normalizarTelefono(datosCliente.telefono);
    const telefonoParaBuscar = telefonoNormalizado || '56999999999';

    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');

    // Si el teléfono es el genérico, siempre creamos un cliente nuevo para evitar colisiones.
    if (telefonoParaBuscar === '56999999999') {
        const nuevoClienteRef = clientesRef.doc();
        const nuevoCliente = {
            id: nuevoClienteRef.id,
            nombre: datosCliente.nombre || 'Cliente por Asignar',
            email: datosCliente.email || '',
            telefono: datosCliente.telefono || '56999999999',
            telefonoNormalizado: telefonoParaBuscar,
            pais: datosCliente.pais || '',
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
            origen: datosCliente.origen || 'Importado'
        };
        await nuevoClienteRef.set(nuevoCliente);
        return nuevoCliente;
    }

    // Si el teléfono es único, buscamos si ya existe para actualizarlo.
    const q = clientesRef.where('telefonoNormalizado', '==', telefonoParaBuscar);
    const snapshot = await q.get();

    if (snapshot.empty) {
        const nuevoClienteRef = clientesRef.doc();
        const nuevoCliente = {
            id: nuevoClienteRef.id,
            nombre: datosCliente.nombre || 'Cliente por Asignar',
            email: datosCliente.email || '',
            telefono: datosCliente.telefono,
            telefonoNormalizado: telefonoParaBuscar,
            pais: datosCliente.pais || '',
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
            origen: datosCliente.origen || 'Importado'
        };
        await nuevoClienteRef.set(nuevoCliente);
        return nuevoCliente;
    } else {
        const clienteDoc = snapshot.docs[0];
        const datosAActualizar = {
            nombre: clienteDoc.data().nombre === 'Cliente por Asignar' ? (datosCliente.nombre || 'Cliente por Asignar') : clienteDoc.data().nombre,
            email: clienteDoc.data().email ? clienteDoc.data().email : (datosCliente.email || ''),
            fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
        };
        await clienteDoc.ref.update(datosAActualizar);
        return { id: clienteDoc.id, ...clienteDoc.data(), ...datosAActualizar };
    }
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