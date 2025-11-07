// backend/services/publicWebsiteService.js
// Lógica específica para la búsqueda y precios del sitio web público SSR.

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService'); // Dependencia de utilidad compartida
const { parseISO, isValid, differenceInDays, addDays, format } = require('date-fns');

// --- INICIO DE FUNCIONES MOVIDAS/NUEVAS ---

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

/**
 * Versión simplificada de crearOActualizarCliente solo para el sitio web público.
 * No sincroniza con Google, no calcula RFM.
 */
const crearOActualizarClientePublico = async (db, empresaId, datosCliente) => {
    const clientesRef = db.collection('empresas').doc(empresaId).collection('clientes');
    
    const telefonoNormalizado = normalizarTelefono(datosCliente.telefono);
    const nombreNormalizado = normalizarNombre(datosCliente.nombre);

    // Buscar por teléfono
    if (telefonoNormalizado) {
        const q = clientesRef.where('telefonoNormalizado', '==', telefonoNormalizado);
        const snapshot = await q.get();
        if (!snapshot.empty) {
            const clienteDoc = snapshot.docs[0];
            const clienteExistente = clienteDoc.data();
            // Actualizar el nombre si es diferente (ej. cliente guardó "Juan" y ahora pone "Juan Perez")
            if (clienteExistente.nombre !== nombreNormalizado) {
                await clienteDoc.ref.update({ nombre: nombreNormalizado });
                clienteExistente.nombre = nombreNormalizado;
            }
            return { cliente: clienteExistente, status: 'encontrado' };
        }
    }

    // Crear nuevo cliente
    const nuevoClienteRef = clientesRef.doc();
    const nuevoCliente = {
        id: nuevoClienteRef.id,
        nombre: nombreNormalizado || 'Cliente Web',
        email: datosCliente.email || '',
        telefono: datosCliente.telefono || '',
        telefonoNormalizado: telefonoNormalizado,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        origen: 'website', // Origen claro
        googleContactSynced: false,
        tipoCliente: 'Cliente Nuevo',
        numeroDeReservas: 0,
        totalGastado: 0
    };
    await nuevoClienteRef.set(nuevoCliente);

    return { cliente: nuevoCliente, status: 'creado' };
};


// --- Funciones de Reservas (de reservasService) ---

const crearReservaPublica = async (db, empresaId, datosFormulario) => {
    const { propiedadId, fechaLlegada, fechaSalida, personas, precioFinal, noches, nombre, email, telefono } = datosFormulario;

    // 1. Crear o encontrar al cliente (Usando la versión PÚBLICA)
    const resultadoCliente = await crearOActualizarClientePublico(db, empresaId, { nombre, email, telefono });
    const clienteId = resultadoCliente.cliente.id;

    // 2. Obtener datos del canal por defecto
    const canalesSnapshot = await db.collection('empresas').doc(empresaId).collection('canales').where('esCanalPorDefecto', '==', true).limit(1).get();
    if (canalesSnapshot.empty) throw new Error('No se encontró un canal por defecto para asignar la reserva.');
    const canalPorDefecto = canalesSnapshot.docs[0].data();
    const canalId = canalesSnapshot.docs[0].id;
    
    // 3. Obtener datos de la propiedad
    // (Usamos la función local que también moveremos a este archivo)
    const propiedadData = await obtenerPropiedadPorId(db, empresaId, propiedadId);
    if (!propiedadData) throw new Error('La propiedad seleccionada ya no existe.');

    // 4. Crear la reserva
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
        valores: {
            valorHuesped: parseFloat(precioFinal)
        },
        fechaReserva: admin.firestore.FieldValue.serverTimestamp(),
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp()
    };

    await nuevaReservaRef.set(nuevaReserva);
    return nuevaReserva;
};


// --- Funciones de Propiedades (de propiedadesService) ---

const obtenerPropiedadesPorEmpresa = async (db, empresaId) => {
    // *** INICIO DEPURACIÓN ***
    console.log(`[DEBUG] obtenerPropiedadesPorEmpresa (SSR) - Intentando obtener doc para empresaId: '${empresaId}' (Tipo: ${typeof empresaId})`);
    if (!empresaId || typeof empresaId !== 'string' || empresaId.trim() === '') {
        console.error(`[ERROR] obtenerPropiedadesPorEmpresa (SSR) - empresaId es INVÁLIDO. No se puede continuar.`);
        throw new Error(`Se intentó obtener propiedades con un empresaId inválido: '${empresaId}'`);
    }
    // *** FIN DEPURACIÓN ***

    const propiedadesSnapshot = await db.collection('empresas').doc(empresaId).collection('propiedades').orderBy('fechaCreacion', 'desc').get();

    if (propiedadesSnapshot.empty) {
        return [];
    }

    return propiedadesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

const obtenerPropiedadPorId = async (db, empresaId, propiedadId) => {
    if (!propiedadId || typeof propiedadId !== 'string' || propiedadId.trim() === '') {
        console.error(`[publicWebsiteService] Error: Se llamó a obtenerPropiedadPorId con un ID inválido: '${propiedadId}'`);
        return null;
    }
    const propiedadRef = db.collection('empresas').doc(empresaId).collection('propiedades').doc(propiedadId);
    const doc = await propiedadRef.get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() };
};


// --- Funciones de Empresa (de empresaService) ---

const obtenerDetallesEmpresa = async (db, empresaId) => {
    if (!empresaId) {
        throw new Error('El ID de la empresa es requerido.');
    }
    const empresaRef = db.collection('empresas').doc(empresaId);
    const doc = await empresaRef.get();
    if (!doc.exists) {
        throw new Error('La empresa no fue encontrada.');
    }
    return doc.data();
};

// --- FIN DE FUNCIONES MOVIDAS/NUEVAS ---


// --- Funciones de Disponibilidad y Precios (del Paso 1) ---

async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    // (Esta función ya estaba correctamente simplificada en tu archivo, la mantenemos)
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            .where('estado', 'in', ['Confirmada', 'Propuesta']) // Ocupadas
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
         } catch(e) { return null; }
        return { ...data, id: doc.id, fechaInicio, fechaTermino };
    }).filter(Boolean);

     // Filtrar propiedades que tienen tarifa definida en el rango
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
    // (Se mantiene, es lógica genérica)
    const sortedCabanas = availableProperties.sort((a, b) => b.capacidad - a.capacidad);

    for (const prop of sortedCabanas) {
        if (prop.capacidad >= requiredCapacity) {
            console.log(`[Public Site - findNormalCombination] Solución individual: ${prop.id}`);
            return { combination: [prop], capacity: prop.capacidad };
        }
    }

    console.log(`[Public Site - findNormalCombination] Intentando combinación greedy para ${requiredCapacity}pax...`);
    let currentCombination = [];
    let currentCapacity = 0;
    for (const prop of sortedCabanas) {
        if (currentCapacity < requiredCapacity) {
            currentCombination.push(prop);
            currentCapacity += prop.capacidad;
        }
    }

    if (currentCapacity >= requiredCapacity) {
         console.log(`[Public Site - findNormalCombination] Combinación encontrada: ${currentCombination.map(p=>p.id).join(', ')}`);
        return { combination: currentCombination, capacity: currentCapacity };
    }

    console.log(`[Public Site - findNormalCombination] No se encontró combinación.`);
    return { combination: [], capacity: 0 };
}

async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, valorDolarDiaOverride = null) {
    // (Función simplificada en el paso anterior, se mantiene)
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const canalDefectoSnapshot = await canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get();
    
    if (canalDefectoSnapshot.empty) {
        throw new Error("No se ha configurado un canal por defecto para calcular el precio público.");
    }
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
            } else {
                 console.warn(`[WARN Public] No se encontró tarifa base para ${prop.nombre} en ${format(currentDate, 'yyyy-MM-dd')}`);
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
             console.error(`Error crítico: Se necesita valor del dólar (USD->CLP) pero no se obtuvo o es inválido.`);
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
    // Funciones de Disponibilidad y Precios
    getAvailabilityData,
    findNormalCombination,
    calculatePrice,
    
    // Funciones de Propiedades
    obtenerPropiedadesPorEmpresa,
    obtenerPropiedadPorId,

    // Funciones de Reservas
    crearReservaPublica,

    // Funciones de Empresa
    obtenerDetallesEmpresa
};