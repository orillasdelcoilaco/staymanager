// backend/services/publicWebsiteService.js
// Lógica específica para la búsqueda y precios del sitio web público SSR.

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');
const { parseISO, isValid, differenceInDays, addDays, format } = require('date-fns');

// --- Funciones de Utilidad (de clientesService) ---

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

const crearOActualizarClientePublico = async (db, empresaId, datosCliente) => {
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

    const nuevoClienteRef = clientesRef.doc();
    const nuevoCliente = {
        id: nuevoClienteRef.id,
        nombre: nombreNormalizado || 'Cliente Web',
        email: datosCliente.email || '',
        telefono: datosCliente.telefono || '',
        telefonoNormalizado: telefonoNormalizado,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        origen: 'website',
        googleContactSynced: false,
        tipoCliente: 'Cliente Nuevo',
        numeroDeReservas: 0,
        totalGastado: 0
    };
    await nuevoClienteRef.set(nuevoCliente);

    return { cliente: nuevoCliente, status: 'creado' };
};

// --- Funciones de Propiedades (Lectura SSR) ---

const obtenerPropiedadesPorEmpresa = async (db, empresaId) => {
    if (!empresaId || typeof empresaId !== 'string' || empresaId.trim() === '') {
        console.error(`[ERROR] obtenerPropiedadesPorEmpresa (SSR) - empresaId es INVÁLIDO.`);
        throw new Error(`Se intentó obtener propiedades con un empresaId inválido.`);
    }

    const propiedadesSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('fechaCreacion', 'desc').get();

    if (propiedadesSnapshot.empty) {
        return [];
    }

    return propiedadesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })).filter(p => p.googleHotelData?.isListed === true);
};

const obtenerPropiedadPorId = async (db, empresaId, propiedadId) => {
    console.log(`[DEBUG] obtenerPropiedadPorId: empresaId=${empresaId}, propiedadId=${propiedadId}`);
    if (!propiedadId || typeof propiedadId !== 'string' || propiedadId.trim() === '') {
        console.error(`[publicWebsiteService] Error: ID inválido: '${propiedadId}'`);
        return null;
    }
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    const doc = await propiedadRef.get();
    if (!doc.exists) {
        console.log(`[DEBUG] Propiedad ${propiedadId} no encontrada en la colección de la empresa ${empresaId}.`);
        return null;
    }

    const data = doc.data();

    // --- LEER SUBCOLECCIONES (NUEVO MODELO SSR) ---
    // Usamos Promise.allSettled para evitar que un fallo en una subcolección rompa todo, aunque aquí usamos catch individual
    const [componentesSnap, amenidadesSnap, fotosSnap] = await Promise.all([
        propiedadRef.collection('componentes').orderBy('orden', 'asc').get().catch(() => ({ empty: true, docs: [] })),
        propiedadRef.collection('amenidades').get().catch(() => ({ empty: true, docs: [] })),
        propiedadRef.collection('fotos').where('visibleEnSSR', '==', true).orderBy('prioridad', 'asc').get().catch(() => ({ empty: true, docs: [] }))
    ]);

    // Priorizar subcolecciones si existen, si no, usar legacy arrays
    let componentes = [];
    if (!componentesSnap.empty) {
        componentes = componentesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
        componentes = data.componentes || [];
    }

    let amenidades = [];
    if (!amenidadesSnap.empty) {
        amenidades = amenidadesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
        amenidades = data.amenidades || [];
    }

    // Fotos: Si hay subcolección, usarla. Si no, usar websiteData.images (Legacy)
    let fotos = [];
    if (!fotosSnap.empty) {
        fotos = fotosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else if (data.websiteData && data.websiteData.images) {
        // Convertir estructura legacy de objeto a array
        fotos = Object.values(data.websiteData.images).flat().filter(img => img && img.storagePath);
    }

    // Construir objeto final enriquecido para SSR
    const propiedadEnriquecida = {
        id: doc.id,
        ...data,
        componentes,
        amenidades,
        fotosSSR: fotos // Campo específico para SSR
    };

    return propiedadEnriquecida;
};

const obtenerDetallesEmpresa = async (db, empresaId) => {
    if (!empresaId) throw new Error('El ID de la empresa es requerido.');
    const empresaRef = db.collection('empresas').doc(empresaId);
    const doc = await empresaRef.get();
    if (!doc.exists) throw new Error('La empresa no fue encontrada.');
    return doc.data();
};

// --- Funciones de Reservas ---

const crearReservaPublica = async (db, empresaId, datosFormulario) => {
    const { propiedadId, fechaLlegada, fechaSalida, personas, precioFinal, noches, nombre, email, telefono } = datosFormulario;

    const resultadoCliente = await crearOActualizarClientePublico(db, empresaId, { nombre, email, telefono });
    const clienteId = resultadoCliente.cliente.id;

    const canalesSnapshot = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
    if (canalesSnapshot.empty) throw new Error('No se encontró un canal por defecto.');
    const canalPorDefecto = canalesSnapshot.docs[0].data();
    const canalId = canalesSnapshot.docs[0].id;

    const propiedadData = await obtenerPropiedadPorId(db, empresaId, propiedadId);
    if (!propiedadData) throw new Error('La propiedad seleccionada ya no existe.');

    const reservasRef = db.collection('empresas').doc(empresaId).collection('reservas');
    const nuevaReservaRef = reservasRef.doc();
    const idReservaCanal = `WEB-${nuevaReservaRef.id.substring(0, 8).toUpperCase()}`;

    const nuevaReserva = {
        id: nuevaReservaRef.id,
        idUnicoReserva: `${idReservaCanal}-${propiedadId}`,
        idReservaCanal: idReservaCanal,
        canalId: canalId,
        canalNombre: canalPorDefecto.nombre,
        clienteId: clienteId,
        alojamientoId: propiedadId,
        alojamientoNombre: propiedadData.nombre,
        fechaLlegada: admin.firestore.Timestamp.fromDate(new Date(fechaLlegada + 'T00:00:00Z')),
        fechaSalida: admin.firestore.Timestamp.fromDate(new Date(fechaSalida + 'T00:00:00Z')),
        totalNoches: parseInt(noches),
        cantidadHuespedes: parseInt(personas),
        estado: 'Confirmada',
        estadoGestion: 'Pendiente Bienvenida',
        origen: 'website',
        moneda: 'CLP',
        valores: { valorHuesped: parseFloat(precioFinal) },
        fechaReserva: admin.firestore.FieldValue.serverTimestamp(),
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };

    await nuevaReservaRef.set(nuevaReserva);
    return nuevaReserva;
};

// --- Funciones de Disponibilidad y Precios ---

async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            .where('estado', 'in', ['Confirmada', 'Propuesta'])
            .get()
    ]);

    let allProperties = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (sinCamarotes) {
        allProperties = allProperties.map(prop => {
            if (prop.camas && prop.camas.camarotes > 0) {
                const capacidadReducida = prop.capacidad - (prop.camas.camarotes * 2);
                return { ...prop, capacidad: Math.max(0, capacidadReducida) };
            }
            return prop;
        });
    }

    const allTarifas = tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        let fechaInicio, fechaTermino;
        try {
            fechaInicio = data.fechaInicio?.toDate ? data.fechaInicio.toDate() : (data.fechaInicio ? parseISO(data.fechaInicio + 'T00:00:00Z') : null);
            fechaTermino = data.fechaTermino?.toDate ? data.fechaTermino.toDate() : (data.fechaTermino ? parseISO(data.fechaTermino + 'T00:00:00Z') : null);
            if (!isValid(fechaInicio) || !isValid(fechaTermino)) throw new Error('Fecha inválida');
        } catch (e) { return null; }
        return { ...data, id: doc.id, fechaInicio, fechaTermino };
    }).filter(Boolean);

    const propiedadesConTarifa = allProperties.filter(prop => {
        return allTarifas.some(tarifa => {
            return tarifa.alojamientoId === prop.id && tarifa.fechaInicio <= endDate && tarifa.fechaTermino >= startDate;
        });
    });

    const overlappingReservations = [];
    reservasSnapshot.forEach(doc => {
        const reserva = doc.data();
        const fechaSalidaReserva = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? parseISO(reserva.fechaSalida + 'T00:00:00Z') : null);
        if (fechaSalidaReserva && isValid(fechaSalidaReserva) && fechaSalidaReserva > startDate) {
            overlappingReservations.push(reserva);
        }
    });

    const availabilityMap = new Map();
    allProperties.forEach(prop => availabilityMap.set(prop.id, []));
    overlappingReservations.forEach(reserva => {
        if (availabilityMap.has(reserva.alojamientoId)) {
            const start = reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate() : (reserva.fechaLlegada ? parseISO(reserva.fechaLlegada + 'T00:00:00Z') : null);
            const end = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? parseISO(reserva.fechaSalida + 'T00:00:00Z') : null);
            if (start && end && isValid(start) && isValid(end)) {
                availabilityMap.get(reserva.alojamientoId).push({ start, end });
            }
        }
    });

    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });

    return { availableProperties, allProperties, allTarifas, availabilityMap };
}

function findNormalCombination(availableProperties, requiredCapacity) {
    const sortedCabanas = availableProperties.sort((a, b) => b.capacidad - a.capacidad);

    for (const prop of sortedCabanas) {
        if (prop.capacidad >= requiredCapacity) {
            return { combination: [prop], capacity: prop.capacidad };
        }
    }

    let currentCombination = [];
    let currentCapacity = 0;
    for (const prop of sortedCabanas) {
        if (currentCapacity < requiredCapacity) {
            currentCombination.push(prop);
            currentCapacity += prop.capacidad;
        }
    }

    if (currentCapacity >= requiredCapacity) {
        return { combination: currentCombination, capacity: currentCapacity };
    }

    return { combination: [], capacity: 0 };
}

async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, valorDolarDiaOverride = null) {
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const canalDefectoSnapshot = await canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get();

    if (canalDefectoSnapshot.empty) throw new Error("No se ha configurado un canal por defecto.");
    const canalPorDefecto = { id: canalDefectoSnapshot.docs[0].id, ...canalDefectoSnapshot.docs[0].data() };

    const valorDolarDia = valorDolarDiaOverride ??
        (canalPorDefecto.moneda === 'USD'
            ? await obtenerValorDolar(db, empresaId, startDate)
            : null);

    let totalPrecioEnMonedaDefecto = 0;
    const priceDetails = [];
    let totalNights = differenceInDays(endDate, startDate);

    if (totalNights <= 0) {
        return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalPorDefecto.moneda, valorDolarDia, nights: 0, details: [] };
    }

    for (const prop of items) {
        let propPrecioBaseTotal = 0;
        for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
            const currentDate = new Date(d);
            const tarifasDelDia = allTarifas.filter(t =>
                t.alojamientoId === prop.id &&
                t.fechaInicio <= currentDate &&
                t.fechaTermino >= currentDate
            );

            if (tarifasDelDia.length > 0) {
                const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                propPrecioBaseTotal += (typeof precioBaseObj === 'number' ? precioBaseObj : 0);
            }
        }

        totalPrecioEnMonedaDefecto += propPrecioBaseTotal;

        priceDetails.push({
            nombre: prop.nombre,
            id: prop.id,
            precioTotal: propPrecioBaseTotal,
            precioPorNoche: totalNights > 0 ? propPrecioBaseTotal / totalNights : 0,
        });
    }

    let totalPriceCLP = totalPrecioEnMonedaDefecto;
    if (canalPorDefecto.moneda === 'USD') {
        if (valorDolarDia === null || valorDolarDia <= 0) {
            return { totalPriceCLP: 0, totalPriceOriginal: totalPrecioEnMonedaDefecto, currencyOriginal: canalPorDefecto.moneda, valorDolarDia, nights: totalNights, details: priceDetails, error: "Missing dollar value" };
        }
        totalPriceCLP = totalPrecioEnMonedaDefecto * valorDolarDia;
    }

    return {
        totalPriceCLP: Math.round(totalPriceCLP),
        totalPriceOriginal: totalPrecioEnMonedaDefecto,
        currencyOriginal: canalPorDefecto.moneda,
        valorDolarDia: valorDolarDia,
        nights: totalNights,
        details: priceDetails
    };
}

module.exports = {
    getAvailabilityData,
    findNormalCombination,
    calculatePrice,
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,
    obtenerDetallesEmpresa,
    crearReservaPublica
};