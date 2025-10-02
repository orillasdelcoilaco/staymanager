const admin = require('firebase-admin');
const { getAvailabilityData } = require('./propuestasService');
const { crearOActualizarCliente } = require('./clientesService');

const guardarPropuestaComoReservaTentativa = async (db, empresaId, datos) => {
    const { cliente, fechaLlegada, fechaSalida, propiedades, precioFinal, noches } = datos;

    let clienteId = cliente.id;
    if (!clienteId) {
        const resultadoCliente = await crearOActualizarCliente(db, empresaId, {
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            email: cliente.email
        });
        clienteId = resultadoCliente.cliente.id;
    }

    const batch = db.batch();
    const canal = { id: 'APP_INTERNA', nombre: 'App Interna' };

    const idUnicoPropuesta = db.collection('empresas').doc().id; // ID único para agrupar las reservas

    for (const prop of propiedades) {
        const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc();
        const idUnicoReserva = `${idUnicoPropuesta}-${prop.id}`;

        const datosReserva = {
            id: reservaRef.id,
            idUnicoReserva,
            idPropuesta: idUnicoPropuesta,
            clienteId,
            alojamientoId: prop.id,
            alojamientoNombre: prop.nombre,
            canalId: canal.id,
            canalNombre: canal.nombre,
            fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(fechaLlegada + 'T00:00:00Z')),
            fechaSalida: admin.firestore.Timestamp.fromDate(new Date(fechaSalida + 'T00:00:00Z')),
            totalNoches: noches,
            cantidadHuespedes: prop.capacidad,
            estado: 'Propuesta', // Estado clave
            valores: {
                valorHuesped: Math.round(precioFinal / propiedades.length), // Distribuir el precio
            },
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(reservaRef, datosReserva);
    }

    await batch.commit();
    return { id: idUnicoPropuesta };
};

const guardarPresupuesto = async (db, empresaId, datos) => {
    const { id, cliente, fechaLlegada, fechaSalida, propiedades, precioFinal, noches, texto } = datos;
    const presupuestosRef = db.collection('empresas').doc(empresaId).collection('presupuestos');
    
    let clienteId = cliente.id;
    if (!clienteId && cliente.nombre) {
         const resultadoCliente = await crearOActualizarCliente(db, empresaId, {
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            email: cliente.email
        });
        clienteId = resultadoCliente.cliente.id;
    }

    const datosPresupuesto = {
        clienteId,
        clienteNombre: cliente.nombre,
        fechaLlegada,
        fechaSalida,
        propiedades,
        monto: precioFinal,
        noches,
        texto,
        estado: 'Borrador',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
        await presupuestosRef.doc(id).update(datosPresupuesto);
        return { id };
    } else {
        const docRef = await presupuestosRef.add(datosPresupuesto);
        return { id: docRef.id };
    }
};

const obtenerPropuestasYPresupuestos = async (db, empresaId) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const presupuestosRef = db.collection('empresas').doc(empresaId).collection('presupuestos');

    const [propuestasSnapshot, presupuestosSnapshot] = await Promise.all([
        reservasRef.where('estado', '==', 'Propuesta').orderBy('fechaCreacion', 'desc').get(),
        presupuestosRef.where('estado', 'in', ['Borrador', 'Enviado']).orderBy('fechaCreacion', 'desc').get()
    ]);

    const propuestasAgrupadas = new Map();
    propuestasSnapshot.forEach(doc => {
        const data = doc.data();
        const id = data.idPropuesta || data.idUnicoReserva;
        if (!propuestasAgrupadas.has(id)) {
            propuestasAgrupadas.set(id, {
                id,
                tipo: 'propuesta',
                clienteId: data.clienteId,
                fechaLlegada: data.fechaLlegada.toDate().toISOString().split('T')[0],
                fechaSalida: data.fechaSalida.toDate().toISOString().split('T')[0],
                monto: 0,
                propiedades: [],
                idsReservas: []
            });
        }
        const grupo = propuestasAgrupadas.get(id);
        grupo.monto += data.valores.valorHuesped || 0;
        grupo.propiedades.push({ id: data.alojamientoId, nombre: data.alojamientoNombre });
        grupo.idsReservas.push(data.id);
    });

    const presupuestos = presupuestosSnapshot.docs.map(doc => ({
        id: doc.id,
        tipo: 'presupuesto',
        ...doc.data()
    }));

    const resultado = [...propuestasAgrupadas.values(), ...presupuestos];
    
    const clientesSnapshot = await db.collection('empresas').doc(empresaId).collection('clientes').get();
    const clientesMap = new Map(clientesSnapshot.docs.map(doc => [doc.id, doc.data().nombre]));

    return resultado.map(item => ({...item, clienteNombre: clientesMap.get(item.clienteId) || item.clienteNombre || 'N/A', propiedadesNombres: item.propiedades.map(p => p.nombre).join(', ')}));
};

const aprobarPropuesta = async (db, empresaId, idsReservas) => {
    const reservasSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas').where(admin.firestore.FieldPath.documentId(), 'in', idsReservas).get();
    if (reservasSnapshot.empty) throw new Error('No se encontraron las reservas de la propuesta.');

    const propuestaReservas = reservasSnapshot.docs.map(d => d.data());
    const startDate = propuestaReservas[0].fechaLlegada.toDate();
    const endDate = propuestaReservas[0].fechaSalida.toDate();
    
    const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
    const availableIds = new Set(availableProperties.map(p => p.id));
    
    for (const reserva of propuestaReservas) {
        if (!availableIds.has(reserva.alojamientoId)) {
            const reservasConflictivas = await db.collection('empresas').doc(empresaId).collection('reservas')
                .where('alojamientoId', '==', reserva.alojamientoId)
                .where('estado', '==', 'Confirmada')
                .where('fechaLlegada', '<', reserva.fechaSalida)
                .get();

            const conflicto = reservasConflictivas.docs.find(doc => doc.data().fechaSalida.toDate() > startDate);
            if (conflicto) {
                const dataConflicto = conflicto.data();
                throw new Error(`La disponibilidad ha cambiado. La cabaña ${reserva.alojamientoNombre} ya no está disponible. Conflicto con reserva ${dataConflicto.idReservaCanal} del canal ${dataConflicto.canalNombre}.`);
            }
        }
    }

    const batch = db.batch();
    idsReservas.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.update(ref, { estado: 'Confirmada', estadoGestion: 'Pendiente Bienvenida' });
    });
    await batch.commit();
};

const rechazarPropuesta = async (db, empresaId, idsReservas) => {
    const batch = db.batch();
    idsReservas.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.update(ref, { estado: 'Rechazada' });
    });
    await batch.commit();
};

const aprobarPresupuesto = async (db, empresaId, presupuestoId) => {
    const presupuestoRef = db.collection('empresas').doc(empresaId).collection('presupuestos').doc(presupuestoId);
    const presupuestoDoc = await presupuestoRef.get();
    if (!presupuestoDoc.exists) throw new Error('El presupuesto no fue encontrado.');

    const presupuesto = presupuestoDoc.data();
    const startDate = new Date(presupuesto.fechaLlegada + 'T00:00:00Z');
    const endDate = new Date(presupuesto.fechaSalida + 'T00:00:00Z');

    const { availableProperties } = await getAvailabilityData(db, empresaId, startDate, endDate);
    const availableIds = new Set(availableProperties.map(p => p.id));

    for (const prop of presupuesto.propiedades) {
        if (!availableIds.has(prop.id)) {
            throw new Error(`La disponibilidad ha cambiado. La cabaña ${prop.nombre} ya no está disponible para las fechas solicitadas.`);
        }
    }

    const batch = db.batch();
    const idUnicoPresupuesto = presupuestoId;

    for (const prop of presupuesto.propiedades) {
        const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc();
        const datosReserva = {
            id: reservaRef.id,
            idUnicoReserva: `${idUnicoPresupuesto}-${prop.id}`,
            idPresupuesto: idUnicoPresupuesto,
            clienteId: presupuesto.clienteId,
            alojamientoId: prop.id,
            alojamientoNombre: prop.nombre,
            canalId: 'PRESUPUESTO',
            canalNombre: 'Presupuesto Aprobado',
            fechaLlegada: admin.firestore.Timestamp.fromDate(startDate),
            fechaSalida: admin.firestore.Timestamp.fromDate(endDate),
            totalNoches: presupuesto.noches,
            cantidadHuespedes: prop.capacidad,
            estado: 'Confirmada',
            estadoGestion: 'Pendiente Bienvenida',
            valores: {
                valorHuesped: Math.round(presupuesto.monto / presupuesto.propiedades.length)
            },
            fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.set(reservaRef, datosReserva);
    }
    
    batch.update(presupuestoRef, { estado: 'Aprobado' });
    await batch.commit();
};

const rechazarPresupuesto = async (db, empresaId, presupuestoId) => {
    const presupuestoRef = db.collection('empresas').doc(empresaId).collection('presupuestos').doc(presupuestoId);
    await presupuestoRef.update({ estado: 'Rechazado' });
};

module.exports = {
    guardarPropuestaComoReservaTentativa,
    guardarPresupuesto,
    obtenerPropuestasYPresupuestos,
    aprobarPropuesta,
    rechazarPropuesta,
    aprobarPresupuesto,
    rechazarPresupuesto
};