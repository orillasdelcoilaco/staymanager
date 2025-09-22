const admin = require('firebase-admin');

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

const crearOActualizarCliente = async (db, empresaId, datosCliente) => {
    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');
    
    const telefonoNormalizado = normalizarTelefono(datosCliente.telefono);
    const nombreNormalizado = normalizarNombre(datosCliente.nombre);

    if (telefonoNormalizado) {
        const q = clientesRef.where('telefonoNormalizado', '==', telefonoNormalizado);
        const snapshot = await q.get();
        if (!snapshot.empty) {
            const clienteDoc = snapshot.docs[0];
            const clienteExistente = clienteDoc.data();
            if (clienteExistente.nombre !== nombreNormalizado) {
                await clienteDoc.ref.update({ nombre: nombreNormalizado });
                clienteExistente.nombre = nombreNormalizado;
            }
            return { cliente: clienteExistente, status: 'encontrado' };
        }
    }

    if (datosCliente.idCompuesto) {
        const q = clientesRef.where('idCompuesto', '==', datosCliente.idCompuesto);
        const snapshot = await q.get();
        if (!snapshot.empty) {
            const clienteDoc = snapshot.docs[0];
            const clienteExistente = clienteDoc.data();
            if (clienteExistente.nombre !== nombreNormalizado) {
                await clienteDoc.ref.update({ nombre: nombreNormalizado });
                clienteExistente.nombre = nombreNormalizado;
            }
            return { cliente: clienteExistente, status: 'encontrado' };
        }
    }

    const nuevoClienteRef = clientesRef.doc();
    const nuevoCliente = {
        id: nuevoClienteRef.id,
        nombre: nombreNormalizado || 'Cliente por Asignar',
        email: datosCliente.email || '',
        telefono: datosCliente.telefono || '56999999999',
        telefonoNormalizado: telefonoNormalizado,
        idCompuesto: datosCliente.idCompuesto || null,
        pais: datosCliente.pais || '',
        calificacion: datosCliente.calificacion || 0,
        ubicacion: datosCliente.ubicacion || '',
        notas: datosCliente.notas || '',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        origen: 'Importado'
    };
    await nuevoClienteRef.set(nuevoCliente);
    return { cliente: nuevoCliente, status: 'creado' };
};

const obtenerClientesPorEmpresa = async (db, empresaId) => {
    const snapshot = await db.collection('empresas').doc(empresaId).collection('clientes').orderBy('nombre').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
};

const obtenerClientePorId = async (db, empresaId, clienteId) => {
    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    const clienteDoc = await clienteRef.get();

    if (!clienteDoc.exists) {
        throw new Error('Cliente no encontrado');
    }

    const cliente = clienteDoc.data();

    const reservasSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('clienteId', '==', clienteId)
        .orderBy('fechaLlegada', 'desc')
        .get();

    const reservas = reservasSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            fechaLlegada: data.fechaLlegada?.toDate().toISOString() || null,
            fechaSalida: data.fechaSalida?.toDate().toISOString() || null,
        };
    });

    return { ...cliente, reservas };
};

const actualizarCliente = async (db, empresaId, clienteId, datosActualizados) => {
    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    if (datosActualizados.telefono) {
        datosActualizados.telefonoNormalizado = normalizarTelefono(datosActualizados.telefono);
    }
    if (datosActualizados.nombre) {
        datosActualizados.nombre = normalizarNombre(datosActualizados.nombre);
    }
    await clienteRef.update({ ...datosActualizados, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() });
    return { id: clienteId, ...datosActualizados };
};

const eliminarCliente = async (db, empresaId, clienteId) => {
    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    await clienteRef.delete();
};

module.exports = {
    crearOActualizarCliente,
    obtenerClientesPorEmpresa,
    obtenerClientePorId,
    actualizarCliente,
    eliminarCliente
};