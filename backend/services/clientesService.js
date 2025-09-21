const admin = require('firebase-admin');

const normalizarTelefono = (telefono) => {
    if (!telefono) return null;
    let fono = telefono.toString().replace(/\D/g, '');
    if (fono.startsWith('569') && fono.length === 11) return fono;
    return fono;
};

// --- NUEVA FUNCIÓN --- para dar formato de Título a los nombres
const normalizarNombre = (nombre) => {
    if (!nombre) return '';
    return nombre
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ') // Reemplaza múltiples espacios por uno solo
        .split(' ')
        .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(' ');
};

const crearOActualizarCliente = async (db, empresaId, datosCliente) => {
    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');
    
    const telefonoNormalizado = normalizarTelefono(datosCliente.telefono);
    const nombreNormalizado = normalizarNombre(datosCliente.nombre);

    // Busca por teléfono si está disponible
    if (telefonoNormalizado) {
        const q = clientesRef.where('telefonoNormalizado', '==', telefonoNormalizado);
        const snapshot = await q.get();
        if (!snapshot.empty) {
            const clienteDoc = snapshot.docs[0];
            const clienteExistente = clienteDoc.data();
            // Si el nombre en la BD no coincide con el nombre normalizado, lo actualiza
            if (clienteExistente.nombre !== nombreNormalizado) {
                await clienteDoc.ref.update({ nombre: nombreNormalizado });
                clienteExistente.nombre = nombreNormalizado;
            }
            return { cliente: clienteExistente, status: 'encontrado' };
        }
    }

    // Busca por ID compuesto si no hay teléfono
    if (datosCliente.idCompuesto) {
        const q = clientesRef.where('idCompuesto', '==', datosCliente.idCompuesto);
        const snapshot = await q.get();
        if (!snapshot.empty) {
            const clienteDoc = snapshot.docs[0];
            const clienteExistente = clienteDoc.data();
             // Si el nombre en la BD no coincide con el nombre normalizado, lo actualiza
            if (clienteExistente.nombre !== nombreNormalizado) {
                await clienteDoc.ref.update({ nombre: nombreNormalizado });
                clienteExistente.nombre = nombreNormalizado;
            }
            return { cliente: clienteExistente, status: 'encontrado' };
        }
    }

    // Si no se encuentra, se crea un nuevo cliente con el nombre ya normalizado
    const nuevoClienteRef = clientesRef.doc();
    const nuevoCliente = {
        id: nuevoClienteRef.id,
        nombre: nombreNormalizado || 'Cliente por Asignar',
        email: datosCliente.email || '',
        telefono: datosCliente.telefono || '56999999999',
        telefonoNormalizado: telefonoNormalizado,
        idCompuesto: datosCliente.idCompuesto || null,
        pais: datosCliente.pais || '',
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

const actualizarCliente = async (db, empresaId, clienteId, datosActualizados) => {
    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    if (datosActualizados.telefono) {
        datosActualizados.telefonoNormalizado = normalizarTelefono(datosActualizados.telefono);
    }
    // --- MODIFICADO --- Aplica la normalización al actualizar manualmente
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
    actualizarCliente,
    eliminarCliente
};