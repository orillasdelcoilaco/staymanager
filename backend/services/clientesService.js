// backend/services/clientesService.js

const admin = require('firebase-admin');
const { createGoogleContact, findContactByName, updateGoogleContact } = require('./googleContactsService');

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
        origen: 'Importado',
        googleContactSynced: false,
        tipoCliente: 'Cliente Nuevo',
        numeroDeReservas: 0,
        totalGastado: 0
    };
    await nuevoClienteRef.set(nuevoCliente);

    if (datosCliente.canalNombre && datosCliente.idReservaCanal && telefonoNormalizado) {
        const datosParaGoogle = {
            nombre: nuevoCliente.nombre,
            telefono: nuevoCliente.telefono,
            email: nuevoCliente.email,
            canalNombre: datosCliente.canalNombre,
            idReservaCanal: datosCliente.idReservaCanal
        };
        sincronizarClienteGoogle(db, empresaId, nuevoCliente.id, datosParaGoogle).catch(err => {
            console.warn(`[Auto-Sync] No se pudo crear el contacto en Google para ${nuevoCliente.email}, pero el cliente fue creado localmente. Razón: ${err.message}`);
        });
    }

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
    const clienteDoc = await clienteRef.get();
    if (!clienteDoc.exists) throw new Error("El cliente a actualizar no fue encontrado.");
    const datosAntiguos = clienteDoc.data();
    
    if (datosActualizados.telefono) {
        datosActualizados.telefonoNormalizado = normalizarTelefono(datosActualizados.telefono);
    }
    if (datosActualizados.nombre) {
        datosActualizados.nombre = normalizarNombre(datosActualizados.nombre);
    }
    
    await clienteRef.update({ ...datosActualizados, fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() });
    
    if (datosAntiguos.googleContactSynced) {
        const reservaSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
            .where('clienteId', '==', clienteId)
            .orderBy('fechaCreacion', 'desc') // <-- CORRECCIÓN AQUÍ
            .limit(1)
            .get();

        if (!reservaSnapshot.empty) {
            const reservaData = reservaSnapshot.docs[0].data();
            const oldContactName = `${datosAntiguos.nombre} ${reservaData.canalNombre} ${reservaData.idReservaCanal}`;
            
            const newContactData = {
                nombre: datosActualizados.nombre || datosAntiguos.nombre,
                telefono: datosActualizados.telefono || datosAntiguos.telefono,
                email: datosActualizados.email || datosAntiguos.email,
                canalNombre: reservaData.canalNombre,
                idReservaCanal: reservaData.idReservaCanal,
            };

            updateGoogleContact(db, empresaId, oldContactName, newContactData).catch(err => {
                console.error(`[Auto-Update] Falló la actualización del contacto en Google para ${clienteId}: ${err.message}`);
            });
        }
    }
    
    return { id: clienteId, ...datosActualizados };
};


const eliminarCliente = async (db, empresaId, clienteId) => {
    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    await clienteRef.delete();
};

const sincronizarClienteGoogle = async (db, empresaId, clienteId, overrideData = null) => {
    const clienteRef = db.collection('empresas').doc(empresaId).collection('clientes').doc(clienteId);
    
    let contactPayload;

    if (overrideData) {
        contactPayload = overrideData;
    } else {
        const clienteDoc = await clienteRef.get();
        if (!clienteDoc.exists) throw new Error('El cliente no existe.');
        const clienteData = clienteDoc.data();

        const reservaSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
            .where('clienteId', '==', clienteId)
            .orderBy('fechaCreacion', 'desc') // <-- CORRECCIÓN AQUÍ
            .limit(1)
            .get();

        if (reservaSnapshot.empty) {
            throw new Error('No se encontraron reservas para este cliente, no se puede generar el nombre del contacto.');
        }
        const reservaData = reservaSnapshot.docs[0].data();
        
        contactPayload = {
            nombre: clienteData.nombre,
            telefono: clienteData.telefono,
            email: clienteData.email,
            canalNombre: reservaData.canalNombre,
            idReservaCanal: reservaData.idReservaCanal,
        };
    }

    const result = await createGoogleContact(db, empresaId, contactPayload);

    if (result.status === 'created' || result.status === 'exists') {
        await clienteRef.update({ googleContactSynced: true });
        return { success: true, message: `Contacto para "${contactPayload.nombre}" ${result.status === 'exists' ? 'ya existía' : 'fue creado'} en Google.` };
    } else {
        throw new Error(result.message);
    }
};

const recalcularEstadisticasClientes = async (db, empresaId) => {
    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');

    const [clientesSnapshot, reservasSnapshot] = await Promise.all([
        clientesRef.get(),
        reservasRef.where('estado', '==', 'Confirmada').get()
    ]);

    if (clientesSnapshot.empty) {
        return { actualizados: 0, total: 0 };
    }

    const reservasPorCliente = new Map();
    reservasSnapshot.forEach(doc => {
        const reserva = doc.data();
        if (!reservasPorCliente.has(reserva.clienteId)) {
            reservasPorCliente.set(reserva.clienteId, []);
        }
        reservasPorCliente.get(reserva.clienteId).push(reserva);
    });

    const batch = db.batch();
    let clientesActualizados = 0;

    clientesSnapshot.forEach(doc => {
        const clienteId = doc.id;
        const historialReservas = reservasPorCliente.get(clienteId) || [];
        
        const totalGastado = historialReservas.reduce((sum, r) => sum + (r.valores?.valorHuesped || 0), 0);
        const numeroDeReservas = historialReservas.length;

        let tipoCliente = 'Cliente Nuevo';
        if (numeroDeReservas === 0) {
            tipoCliente = 'Sin Reservas';
        } else if (totalGastado > 1000000) {
            tipoCliente = 'Cliente Premium';
        } else if (numeroDeReservas > 1) {
            tipoCliente = 'Cliente Frecuente';
        }

        const updates = {
            totalGastado,
            numeroDeReservas,
            tipoCliente
        };

        batch.update(doc.ref, updates);
        clientesActualizados++;
    });

    await batch.commit();
    return { actualizados: clientesActualizados, total: clientesSnapshot.size };
};

module.exports = {
    crearOActualizarCliente,
    obtenerClientesPorEmpresa,
    obtenerClientePorId,
    actualizarCliente,
    eliminarCliente,
    sincronizarClienteGoogle,
    normalizarTelefono,
    recalcularEstadisticasClientes
};