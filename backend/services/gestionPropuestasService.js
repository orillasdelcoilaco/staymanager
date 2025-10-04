// backend/services/gestionPropuestasService.js

const admin = require('firebase-admin');
const { getAvailabilityData } = require('./propuestasService');
const { crearOActualizarCliente } = require('./clientesService');

const guardarOActualizarPropuesta = async (db, empresaId, datos, idPropuestaExistente = null) => {
    const { cliente, fechaLlegada, fechaSalida, propiedades, precioFinal, noches, canalId, canalNombre, moneda, valorDolarDia, valorOriginal } = datos;
    
    const idGrupo = idPropuestaExistente || db.collection('empresas').doc().id;

    let clienteId;
    if (cliente.id) {
        clienteId = cliente.id;
    } else {
        const resultadoCliente = await crearOActualizarCliente(db, empresaId, {
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            email: cliente.email,
            canalNombre: canalNombre,
            idReservaCanal: idGrupo
        });
        clienteId = resultadoCliente.cliente.id;
    }
    
    await db.runTransaction(async (transaction) => {
        const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
        
        if (idPropuestaExistente) {
            const queryExistentes = reservasRef.where('idReservaCanal', '==', idPropuestaExistente).where('estado', '==', 'Propuesta');
            const snapshotExistentes = await transaction.get(queryExistentes);
            snapshotExistentes.forEach(doc => transaction.delete(doc.ref));
        }

        for (const prop of propiedades) {
            const nuevaReservaRef = reservasRef.doc();
            const idUnicoReserva = `${idGrupo}-${prop.id}`;
            const precioFinalPorPropiedad = Math.round(precioFinal / propiedades.length);
            const valorOriginalPorPropiedad = moneda === 'USD' ? (valorOriginal / propiedades.length) : precioFinalPorPropiedad;

            const datosReserva = {
                id: nuevaReservaRef.id,
                idUnicoReserva,
                idReservaCanal: idGrupo,
                clienteId,
                alojamientoId: prop.id,
                alojamientoNombre: prop.nombre,
                canalId: canalId || 'APP',
                canalNombre: canalNombre || 'App',
                fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(fechaLlegada + 'T00:00:00Z')),
                fechaSalida: admin.firestore.Timestamp.fromDate(new Date(fechaSalida + 'T00:00:00Z')),
                totalNoches: noches,
                cantidadHuespedes: prop.capacidad,
                estado: 'Propuesta',
                moneda,
                valorDolarDia,
                valores: {
                    valorOriginal: valorOriginalPorPropiedad,
                    valorTotal: precioFinalPorPropiedad,
                    valorHuesped: precioFinalPorPropiedad
                },
                fechaReserva: admin.firestore.FieldValue.serverTimestamp(), // <-- CORRECCIÓN AQUÍ
                fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
                fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
            };
            transaction.set(nuevaReservaRef, datosReserva);
        }
    });

    return { id: idGrupo };
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
        fechaActualizacion: admin.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
        await presupuestosRef.doc(id).update(datosPresupuesto);
        return { id };
    } else {
        datosPresupuesto.fechaCreacion = admin.firestore.FieldValue.serverTimestamp();
        const docRef = await presupuestosRef.add(datosPresupuesto);
        return { id: docRef.id };
    }
};

const obtenerPropuestasYPresupuestos = async (db, empresaId) => {
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const presupuestosRef = db.collection('empresas').doc(empresaId).collection('presupuestos');
    const propiedadesRef = db.collection('empresas').doc(empresaId).collection('propiedades');

    const [propuestasSnapshot, presupuestosSnapshot, propiedadesSnapshot, clientesSnapshot] = await Promise.all([
        reservasRef.where('estado', '==', 'Propuesta').orderBy('fechaCreacion', 'desc').get(),
        presupuestosRef.where('estado', 'in', ['Borrador', 'Enviado']).orderBy('fechaCreacion', 'desc').get(),
        propiedadesRef.get(),
        db.collection('empresas').doc(empresaId).collection('clientes').get()
    ]);

    const propiedadesMap = new Map(propiedadesSnapshot.docs.map(doc => [doc.id, doc.data()]));
    const clientesMap = new Map(clientesSnapshot.docs.map(doc => [doc.id, doc.data().nombre]));

    const propuestasAgrupadas = new Map();
    propuestasSnapshot.forEach(doc => {
        const data = doc.data();
        const id = data.idReservaCanal;
        if (!id) return;

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
        const propiedad = propiedadesMap.get(data.alojamientoId);
        grupo.propiedades.push({
            id: data.alojamientoId,
            nombre: data.alojamientoNombre,
            capacidad: propiedad ? propiedad.capacidad : 0
        });
        grupo.idsReservas.push(data.id);
    });

    const presupuestos = presupuestosSnapshot.docs.map(doc => {
        const data = doc.data();
        const propiedadesConCapacidad = data.propiedades.map(p => {
            const propiedad = propiedadesMap.get(p.id);
            return { ...p, capacidad: propiedad ? propiedad.capacidad : 0 };
        });
        return {
            id: doc.id,
            tipo: 'presupuesto',
            ...data,
            propiedades: propiedadesConCapacidad
        };
    });

    const resultado = [...propuestasAgrupadas.values(), ...presupuestos];

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
                const idReserva = dataConflicto.idReservaCanal || 'Desconocido';
                const fechaReservaTimestamp = dataConflicto.fechaCreacion || dataConflicto.fechaReserva;
                const fechaReserva = fechaReservaTimestamp ? fechaReservaTimestamp.toDate().toLocaleDateString('es-CL') : 'una fecha no registrada';
                throw new Error(`La cabaña ${reserva.alojamientoNombre} ya no está disponible. Fue reservada por la reserva ${idReserva} del canal ${dataConflicto.canalNombre}, creada el ${fechaReserva}.`);
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
            const reservasConflictivas = await db.collection('empresas').doc(empresaId).collection('reservas')
                .where('alojamientoId', '==', prop.id)
                .where('estado', '==', 'Confirmada')
                .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
                .get();
            const conflicto = reservasConflictivas.docs.find(doc => doc.data().fechaSalida.toDate() > startDate);
            if (conflicto) {
                const dataConflicto = conflicto.data();
                const idReserva = dataConflicto.idReservaCanal || 'Desconocido';
                const fechaReservaTimestamp = dataConflicto.fechaCreacion || dataConflicto.fechaReserva;
                const fechaReserva = fechaReservaTimestamp ? fechaReservaTimestamp.toDate().toLocaleDateString('es-CL') : 'una fecha no registrada';
                throw new Error(`La cabaña ${prop.nombre} ya no está disponible. Fue reservada por la reserva ${idReserva} del canal ${dataConflicto.canalNombre}, creada el ${fechaReserva}.`);
            }
        }
    }

    const batch = db.batch();
    const idUnicoPresupuesto = presupuestoId;

    for (const prop of presupuesto.propiedades) {
        const reservaRef = db.collection('empresas').doc(empresaId).collection('reservas').doc();
        const datosReserva = {
            id: reservaRef.id,
            idUnicoReserva: `${idUnicoPresupuesto}-${prop.id}`,
            idReservaCanal: idUnicoPresupuesto,
            clienteId: presupuesto.clienteId,
            alojamientoId: prop.id,
            alojamientoNombre: prop.nombre,
            canalId: 'APP',
            canalNombre: 'App',
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
    guardarOActualizarPropuesta,
    guardarPresupuesto,
    obtenerPropuestasYPresupuestos,
    aprobarPropuesta,
    rechazarPropuesta,
    aprobarPresupuesto,
    rechazarPresupuesto
};