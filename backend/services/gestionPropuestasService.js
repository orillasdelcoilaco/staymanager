// backend/services/gestionPropuestasService.js
const admin = require('firebase-admin');
const { getAvailabilityData } = require('./propuestasService');
const { crearOActualizarCliente } = require('./clientesService');
const { marcarCuponComoUtilizado } = require('./cuponesService');

const guardarOActualizarPropuesta = async (db, empresaId, datos, idPropuestaExistente = null) => {
    const { cliente, fechaLlegada, fechaSalida, propiedades, precioFinal, noches, canalId, canalNombre, moneda, valorDolarDia, valorOriginal, origen, icalUid, idReservaCanal, codigoCupon } = datos;
    
    const idGrupo = idReservaCanal || idPropuestaExistente || db.collection('empresas').doc().id;

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
        
        let idCargaParaPreservar = null;

        if (idPropuestaExistente) {
            const queryExistentes = reservasRef.where('idReservaCanal', '==', idPropuestaExistente).where('estado', '==', 'Propuesta');
            const snapshotExistentes = await transaction.get(queryExistentes);
            
            if (!snapshotExistentes.empty) {
                idCargaParaPreservar = snapshotExistentes.docs[0].data().idCarga;
            }

            snapshotExistentes.forEach(doc => transaction.delete(doc.ref));
        }

        for (const prop of propiedades) {
            const nuevaReservaRef = reservasRef.doc();
            const idUnicoReserva = `${idGrupo}-${prop.id}`;
            const precioFinalPorPropiedad = (propiedades.length > 0) ? Math.round(precioFinal / propiedades.length) : 0;
            const valorOriginalPorPropiedad = (propiedades.length > 0 && moneda === 'USD') ? (valorOriginal / propiedades.length) : precioFinalPorPropiedad;

            const datosReserva = {
                id: nuevaReservaRef.id,
                idUnicoReserva,
                idCarga: idCargaParaPreservar,
                idReservaCanal: idGrupo,
                icalUid: icalUid || null,
                clienteId,
                alojamientoId: prop.id,
                alojamientoNombre: prop.nombre,
                canalId: canalId || null,
                canalNombre: canalNombre || 'Por Defecto',
                fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(fechaLlegada + 'T00:00:00Z')),
                fechaSalida: admin.firestore.Timestamp.fromDate(new Date(fechaSalida + 'T00:00:00Z')),
                totalNoches: noches,
                cantidadHuespedes: prop.capacidad || datos.personas || 0,
                estado: 'Propuesta',
                origen: origen || 'manual',
                moneda,
                valorDolarDia,
                cuponUtilizado: codigoCupon || null,
                valores: {
                    valorOriginal: valorOriginalPorPropiedad,
                    valorTotal: precioFinalPorPropiedad,
                    valorHuesped: precioFinalPorPropiedad
                },
                fechaReserva: admin.firestore.FieldValue.serverTimestamp(),
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

// backend/services/gestionPropuestasService.js

// (Función completa para reemplazar)
const obtenerPropuestasYPresupuestos = async (db, empresaId) => {
    // 1. Obtener todas las reservas en estado 'Propuesta' y 'Presupuesto'
    const reservasSnapshot = await db.collection('empresas').doc(empresaId).collection('reservas')
        .where('estado', 'in', ['Propuesta', 'Presupuesto'])
        .orderBy('fechaCreacion', 'desc')
        .get();

    if (reservasSnapshot.empty) {
        return [];
    }

    // 2. Obtener todos los clientes para mapeo
    const clientesSnapshot = await db.collection('empresas').doc(empresaId).collection('clientes').get();
    const clientesMap = new Map(clientesSnapshot.docs.map(doc => [doc.id, doc.data()]));

    // 3. Agrupar reservas por 'idReservaCanal'
    const grupos = new Map();
    reservasSnapshot.forEach(doc => {
        const reserva = doc.data();
        // Usar idReservaCanal como ID de grupo, o el ID del documento si es un presupuesto sin grupo
        const grupoId = reserva.idReservaCanal || doc.id; 

        if (!grupos.has(grupoId)) {
            grupos.set(grupoId, {
                id: grupoId,
                idsReservas: [],
                propiedades: [],
                tipo: reserva.estado, // 'Propuesta' o 'Presupuesto'
                clienteId: reserva.clienteId,
                canalId: reserva.canalId,
                canalNombre: reserva.canalNombre,
                fechaLlegada: reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate().toISOString().split('T')[0] : reserva.fechaLlegada,
                fechaSalida: reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate().toISOString().split('T')[0] : reserva.fechaSalida,
                fechaCreacion: reserva.fechaCreacion?.toDate ? reserva.fechaCreacion.toDate().toISOString() : new Date().toISOString(),
                origen: reserva.origen,
                icalUid: reserva.icalUid,
                idReservaCanal: reserva.idReservaCanal,
                monto: 0,
                reservas: [],
            });
        }

        const grupo = grupos.get(grupoId);
        grupo.idsReservas.push(doc.id);
        grupo.propiedades.push({ id: reserva.alojamientoId, nombre: reserva.alojamientoNombre });
        grupo.monto += (reserva.valores?.valorHuesped || 0);
        grupo.reservas.push(reserva);
    });

    // 4. Procesar los grupos para el frontend
    return Array.from(grupos.values()).map(grupo => {
        const cliente = grupo.clienteId ? clientesMap.get(grupo.clienteId) : null;
        
        // --- INICIO DE LA CORRECCIÓN ---
        // Sumar 'cantidadHuespedes' de todas las reservas en el grupo
        const totalPersonas = grupo.reservas.reduce((sum, res) => sum + (res.cantidadHuespedes || 0), 0);
        // --- FIN DE LA CORRECCIÓN ---

        return {
            id: grupo.id,
            tipo: grupo.tipo,
            idsReservas: grupo.idsReservas,
            clienteId: grupo.clienteId,
            clienteNombre: cliente ? cliente.nombre : (grupo.origen === 'ical' ? (grupo.idReservaCanal || 'Reserva iCal') : 'Cliente no asignado'),
            canalId: grupo.canalId,
            canalNombre: grupo.canalNombre,
            fechaLlegada: grupo.fechaLlegada,
            fechaSalida: grupo.fechaSalida,
            fechaCreacion: grupo.fechaCreacion,
            propiedades: grupo.propiedades,
            propiedadesNombres: grupo.propiedades.map(p => p.nombre).join(', '),
            monto: grupo.monto,
            origen: grupo.origen,
            icalUid: grupo.icalUid,
            idReservaCanal: grupo.idReservaCanal,
            personas: totalPersonas // <-- Dato añadido
        };
    });
};


const aprobarPropuesta = async (db, empresaId, idsReservas) => {
    if (!idsReservas || idsReservas.length === 0) {
        throw new Error("No se proporcionaron IDs de reserva para aprobar.");
    }
    
    const reservasRefs = idsReservas.map(id => db.collection('empresas').doc(empresaId).collection('reservas').doc(id));
    
    await db.runTransaction(async (transaction) => {
        const reservasDocs = await transaction.getAll(...reservasRefs);

        if (reservasDocs.some(doc => !doc.exists)) {
            throw new Error('Una o más reservas de la propuesta no fueron encontradas.');
        }

        const propuestaReservas = reservasDocs.map(d => d.data());
        const primeraReserva = propuestaReservas[0];
        const startDate = primeraReserva.fechaLlegada.toDate();
        const endDate = primeraReserva.fechaSalida.toDate();
        const codigoCupon = primeraReserva.cuponUtilizado;
    
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

        if (codigoCupon) {
            await marcarCuponComoUtilizado(transaction, db, empresaId, codigoCupon, primeraReserva.id, primeraReserva.clienteId);
        }

        reservasDocs.forEach(doc => {
            transaction.update(doc.ref, { estado: 'Confirmada', estadoGestion: 'Pendiente Bienvenida' });
        });
    });
};

const rechazarPropuesta = async (db, empresaId, idsReservas) => {
    if (!idsReservas || idsReservas.length === 0) {
        throw new Error("No se proporcionaron IDs de reserva para rechazar.");
    }
    const batch = db.batch();
    idsReservas.forEach(id => {
        const ref = db.collection('empresas').doc(empresaId).collection('reservas').doc(id);
        batch.delete(ref);
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

    const canalesSnapshot = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
    if (canalesSnapshot.empty) {
        throw new Error("No se ha configurado un canal por defecto. Por favor, marque uno en 'Gestionar Canales' para poder aprobar presupuestos.");
    }
    const canalPorDefecto = canalesSnapshot.docs[0].data();
    const canalPorDefectoId = canalesSnapshot.docs[0].id;

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
            canalId: canalPorDefectoId,
            canalNombre: canalPorDefecto.nombre,
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