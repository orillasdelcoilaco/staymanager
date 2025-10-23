// backend/services/reservasService.js

const admin = require('firebase-admin');
const { crearOActualizarCliente } = require('./clientesService');
const { obtenerPropiedadPorId } = require('./propiedadesService');
const { parseISO } = require('date-fns');

// --- Función crearOActualizarReserva (Existente, sin cambios) ---
// (Esta función es para el panel de admin y la sincronización)
const crearOActualizarReserva = async (db, empresaId, datosReserva) => {
    // ... (Tu lógica existente para crear o actualizar reservas desde el panel/sincronización) ...
    // ... (Asegúrate de que esta función completa esté aquí) ...
    
    // Placeholder de la lógica existente
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    let q = reservasRef.where('idUnicoReserva', '==', datosReserva.idUnicoReserva);
    let snapshot = await q.get();
    if (snapshot.empty) {
        const nuevaReservaRef = reservasRef.doc();
        const nuevaReserva = { id: nuevaReservaRef.id, ...datosReserva, fechaCreacion: admin.firestore.FieldValue.serverTimestamp() };
        await nuevaReservaRef.set(nuevaReserva);
        return { reserva: nuevaReserva, status: 'creada' };
    } else {
        await snapshot.docs[0].ref.update(datosReserva);
        return { reserva: { ...snapshot.docs[0].data(), ...datosReserva }, status: 'actualizada' };
    }
};

// --- Función obtenerReservasPorEmpresa (Existente, sin cambios) ---
// (Asegúrate de que esta función completa esté aquí)
const obtenerReservasPorEmpresa = async (db, empresaId) => {
    // ... (Tu lógica existente) ...
    // Placeholder
    return [];
};

// --- Función obtenerReservaPorId (Existente, sin cambios) ---
// (Asegúrate de que esta función completa esté aquí)
const obtenerReservaPorId = async (db, empresaId, reservaId) => {
    // ... (Tu lógica existente) ...
    // Placeholder
    const doc = await db.collection('empresas').doc(empresaId).collection('reservas').doc(reservaId).get();
    if (doc.exists) return doc.data();
    throw new Error('Reserva no encontrada');
};


// *** FUNCIÓN MODIFICADA PARA RESERVAS PÚBLICAS (INDIVIDUALES Y GRUPOS) ***
/**
 * Crea una reserva (o un grupo de reservas) desde la web pública.
 * @param {object} db - Instancia de Firestore DB.
 * @param {string} empresaId - ID de la empresa.
 * @param {object} body - Datos del formulario de checkout.
 * (ej: { propiedadId: "id1,id2", nombreCliente: "...", emailCliente: "...", ... })
 */
const crearReservaPublica = async (db, empresaId, body) => {
    const {
        propiedadId, // Puede ser "id1" o "id1,id2,id3"
        nombreCliente,
        emailCliente,
        telefonoCliente,
        fechaLlegada, // string 'yyyy-MM-dd'
        fechaSalida,  // string 'yyyy-MM-dd'
        noches,
        personas,
        precioFinal,
        // ...otros campos del formulario
    } = body;

    if (!propiedadId || !nombreCliente || !emailCliente || !fechaLlegada || !fechaSalida || !noches || !personas || !precioFinal) {
        throw new Error("Faltan datos esenciales para crear la reserva.");
    }

    // 1. Crear o actualizar al cliente
    const clienteId = await crearOActualizarCliente(db, empresaId, {
        nombre: nombreCliente,
        email: emailCliente,
        telefono: telefonoCliente || '',
    });

    // 2. Preparar datos comunes de la reserva
    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const idReservaCanal = `WEB-${Date.now()}`; // ID único para el grupo o reserva individual
    const fechaReserva = admin.firestore.FieldValue.serverTimestamp();
    const precioTotalNum = parseFloat(precioFinal) || 0;
    const abonoNum = precioTotalNum * 0.10; // Asumir 10% de abono

    const datosBaseReserva = {
        idReservaCanal: idReservaCanal,
        idUnicoReserva: `${idReservaCanal}`, // ID único inicial, se sufijará por propiedad
        origen: 'Web Pública',
        canalNombre: 'Web Pública',
        estado: 'Propuesta', // Inicia como Propuesta hasta confirmar pago
        estadoGestion: 'Pendiente Abono (Web)',
        clienteId: clienteId,
        nombreCliente: nombreCliente, // Redundante pero útil
        fechaLlegada: admin.firestore.Timestamp.fromDate(parseISO(fechaLlegada + 'T00:00:00Z')),
        fechaSalida: admin.firestore.Timestamp.fromDate(parseISO(fechaSalida + 'T00:00:00Z')),
        totalNoches: parseInt(noches) || 0,
        cantidadHuespedes: parseInt(personas) || 0,
        moneda: 'CLP', // Asumir CLP
        valores: {
            valorHuesped: precioTotalNum, // Precio total del grupo
            valorBase: precioTotalNum,
            comision: 0,
            costoLimpieza: 0,
            abono: abonoNum,
            saldoPendiente: precioTotalNum - abonoNum,
        },
        fechaReserva: fechaReserva,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        edicionesManuales: {},
    };

    // 3. Separar IDs y crear reservas
    const propiedadIds = propiedadId.split(',').map(id => id.trim()).filter(Boolean);
    const batch = db.batch();

    let isFirst = true;
    for (const pId of propiedadIds) {
        const propDoc = await obtenerPropiedadPorId(db, empresaId, pId);
        if (!propDoc) {
            console.warn(`[crearReservaPublica] No se encontró la propiedad ${pId}. Omitiendo.`);
            continue;
        }

        const nuevaReservaRef = reservasRef.doc(); // Generar nuevo ID para esta reserva
        const datosReservaIndividual = {
            ...datosBaseReserva,
            id: nuevaReservaRef.id,
            idUnicoReserva: `${idReservaCanal}-${pId}`, // ID único por propiedad
            alojamientoId: pId,
            alojamientoNombre: propDoc.nombre || 'Nombre no encontrado',
        };

        if (propiedadIds.length > 1) {
            // Si es un grupo, ajustar valores
            // Asignar el valor total y abono solo a la PRIMERA reserva del grupo
            // y 0 a las demás para evitar duplicar contabilidad.
            if (isFirst) {
                isFirst = false;
                // Los valores ya están correctos desde datosBaseReserva
            } else {
                // Poner valores en 0 para las siguientes reservas del grupo
                datosReservaIndividual.valores = {
                    valorHuesped: 0,
                    valorBase: 0,
                    comision: 0,
                    costoLimpieza: 0,
                    abono: 0,
                    saldoPendiente: 0,
                };
            }
            // Podríamos añadir un campo para indicar que es parte de un grupo
            datosReservaIndividual.esGrupo = true;
            datosReservaIndividual.totalGrupo = precioTotalNum; // Guardar el total del grupo en todas
        }
        
        batch.set(nuevaReservaRef, datosReservaIndividual);
    }

    if (isFirst && propiedadIds.length > 0) {
        // Esto significa que el bucle corrió pero no encontró ninguna propiedad válida
        throw new Error("No se pudo crear la reserva. Propiedades no encontradas.");
    }

    // 4. Ejecutar el batch
    await batch.commit();

    console.log(`[crearReservaPublica] Reserva(s) creadas con idReservaCanal: ${idReservaCanal}`);
    
    // Devolver el ID del grupo (idReservaCanal) para la página de confirmación
    return { idReservaCanal: idReservaCanal };
};


module.exports = {
    crearOActualizarReserva,
    obtenerReservasPorEmpresa,
    obtenerReservaPorId,
    crearReservaPublica // Exportar la nueva función
};