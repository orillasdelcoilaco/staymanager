const admin = require('firebase-admin');

/**
 * Normaliza un número de teléfono para usarlo como ID.
 * @param {string} telefono - El número de teléfono.
 * @returns {string|null} - El número normalizado o null si no es válido.
 */
const normalizarTelefono = (telefono) => {
    if (!telefono) return null;
    // Elimina caracteres no numéricos y el signo '+' inicial si existe
    let fono = telefono.toString().replace(/\D/g, '');
    // Si empieza con 569 y tiene 11 dígitos, es un móvil chileno válido
    if (fono.startsWith('569') && fono.length === 11) {
        return fono;
    }
    // Si no, devuelve el número limpio para otros casos
    return fono;
};

/**
 * Contiene la lógica de negocio para la gestión de clientes.
 */

const crearOActualizarCliente = async (db, empresaId, datosCliente) => {
    const telefono = normalizarTelefono(datosCliente.telefono) || '56999999999';

    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');
    const q = clientesRef.where('telefonoNormalizado', '==', telefono);
    const snapshot = await q.get();

    if (snapshot.empty) {
        // --- Crear Cliente Nuevo ---
        const nuevoClienteRef = clientesRef.doc();
        const nuevoCliente = {
            id: nuevoClienteRef.id,
            nombre: datosCliente.nombre || 'Cliente por Asignar',
            email: datosCliente.email || '',
            telefono: datosCliente.telefono || '56999999999',
            telefonoNormalizado: telefono,
            pais: datosCliente.pais || '',
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
            origen: datosCliente.origen || 'Manual'
        };
        await nuevoClienteRef.set(nuevoCliente);
        return nuevoCliente;
    } else {
        // --- Actualizar Cliente Existente ---
        const clienteDoc = snapshot.docs[0];
        const datosAActualizar = {
            // Solo actualizamos si el dato nuevo tiene valor y el antiguo no
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
    // Al actualizar manualmente, sí permitimos cambiar el teléfono
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
    // Nota: Considerar qué pasa con las reservas asociadas a este cliente en el futuro.
    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    await clienteRef.delete();
};

module.exports = {
    crearOActualizarCliente,
    obtenerClientesPorEmpresa,
    actualizarCliente,
    eliminarCliente
};