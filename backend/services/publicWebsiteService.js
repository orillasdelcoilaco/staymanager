// backend/services/publicWebsiteService.js
// Lógica específica para la búsqueda y precios del sitio web público SSR.

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService'); // Necesario para precios
const { parseISO, isValid, differenceInDays, addDays, format } = require('date-fns');

// --- Copia de getAvailabilityData (adaptada si es necesario para web pública) ---
async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    // Copiar aquí la lógica completa y funcional de getAvailabilityData
    // (Asegúrate de que es la versión que considera 'Confirmada' y 'Propuesta' como ocupadas)
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            .where('estado', 'in', ['Confirmada', 'Propuesta']) // Ocupadas
            .get()
    ]);

    let allProperties = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (sinCamarotes) { // Lógica para excluir camarotes (si aplica a la web pública)
        allProperties = allProperties.map(prop => {
            // ... (lógica sin camarotes) ...
            if (prop.camas && prop.camas.camarotes > 0) {
                const capacidadReducida = prop.capacidad - (prop.camas.camarotes * 2);
                return { ...prop, capacidad: Math.max(0, capacidadReducida) };
            }
            return prop;
        });
    }

    const allTarifas = tarifasSnapshot.docs.map(doc => {
        // ... (lógica para parsear fechas de tarifas) ...
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
        // ... (lógica para encontrar reservas solapadas) ...
        const reserva = doc.data();
        const fechaSalidaReserva = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? parseISO(reserva.fechaSalida + 'T00:00:00Z') : null);
        if (fechaSalidaReserva && isValid(fechaSalidaReserva) && fechaSalidaReserva > startDate) {
            overlappingReservations.push(reserva);
        }
    });

    const availabilityMap = new Map();
    allProperties.forEach(prop => availabilityMap.set(prop.id, []));
    overlappingReservations.forEach(reserva => {
        // ... (lógica para llenar el mapa de disponibilidad) ...
        if (availabilityMap.has(reserva.alojamientoId)) {
            const start = reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate() : (reserva.fechaLlegada ? parseISO(reserva.fechaLlegada + 'T00:00:00Z') : null);
            const end = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? parseISO(reserva.fechaSalida + 'T00:00:00Z') : null);
            if (start && end && isValid(start) && isValid(end)) {
                availabilityMap.get(reserva.alojamientoId).push({ start, end });
            }
        }
    });

    // Propiedades disponibles (con tarifa y sin solapamiento en el rango)
    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });

    return { availableProperties, allProperties, allTarifas, availabilityMap };
}

// --- Copia de findNormalCombination (la versión que funciona para grupos en la web pública) ---
function findNormalCombination(availableProperties, requiredCapacity) {
    // Copiar aquí la lógica completa y funcional de findNormalCombination (la última versión)
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

// --- Copia de calculatePrice (adaptada si es necesario para web pública) ---
async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, canalObjetivoId, valorDolarDiaOverride = null, isSegmented = false) { // isSegmented probablemente siempre false aquí
    // Copiar aquí la lógica completa y funcional de calculatePrice
    // (Asegúrate de que maneje correctamente la moneda y los modificadores del canalPorDefecto)
    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    // Para la web pública, SIEMPRE calculamos contra el canal por defecto
    const canalDefectoSnapshot = await canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get();

    // Usar canalObjetivoId solo si se pasa explícitamente (poco probable para web pública)
    // De lo contrario, usar el canal por defecto.
    const targetCanalId = canalObjetivoId || (!canalDefectoSnapshot.empty ? canalDefectoSnapshot.docs[0].id : null);
    if (!targetCanalId) throw new Error("No se encontró canal por defecto o canal objetivo para calcular el precio.");

    const canalObjetivoDoc = await canalesRef.doc(targetCanalId).get();
    if (!canalObjetivoDoc.exists) throw new Error("El canal para calcular el precio no es válido.");

    const canalPorDefecto = !canalDefectoSnapshot.empty ? { id: canalDefectoSnapshot.docs[0].id, ...canalDefectoSnapshot.docs[0].data() } : null;
    const canalObjetivo = { id: canalObjetivoDoc.id, ...canalObjetivoDoc.data() }; // Este será usualmente el canal por defecto

    // Si el canal objetivo es el mismo que el por defecto, no necesitamos canalPorDefecto (simplifica)
    const effectiveCanalDefecto = canalPorDefecto && canalPorDefecto.id === canalObjetivo.id ? null : canalPorDefecto;

    const valorDolarDia = valorDolarDiaOverride ??
                          ((canalObjetivo.moneda === 'USD' || effectiveCanalDefecto?.moneda === 'USD')
                              ? await obtenerValorDolar(db, empresaId, startDate)
                              : null);

    let totalPrecioOriginal = 0; // Moneda del canal OBJETIVO (usualmente el default)
    const priceDetails = [];
    let totalNights = differenceInDays(endDate, startDate);
    if (totalNights <= 0) return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, valorDolarDia, nights: 0, details: [] };

    // La web pública no usa segmentado complejo, así que simplificamos
    for (const prop of items) { // items es [Prop1, Prop2...]
        let propPrecioBaseTotal = 0; // Moneda del canal POR DEFECTO

        for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
            const currentDate = new Date(d);
            const tarifasDelDia = allTarifas.filter(t =>
                t.alojamientoId === prop.id &&
                t.fechaInicio <= currentDate &&
                t.fechaTermino >= currentDate
            );
            if (tarifasDelDia.length > 0) {
                const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                // *** IMPORTANTE: Leer el precio del canal POR DEFECTO ***
                const precioBaseObj = tarifa.precios?.[canalPorDefecto.id]; // Usar ID del canal por defecto
                propPrecioBaseTotal += (typeof precioBaseObj === 'number' ? precioBaseObj : 0);
            } else {
                 console.warn(`[WARN Public] No se encontró tarifa base para ${prop.nombre} en ${format(currentDate, 'yyyy-MM-dd')}`);
            }
        }

        // Aplicar modificador SOLO si el canal objetivo es DIFERENTE al por defecto
        let precioPropModificado = propPrecioBaseTotal; // Moneda default
        if (effectiveCanalDefecto && canalObjetivo.modificadorValor) { // effectiveCanalDefecto es null si objetivo == default
            if (canalObjetivo.modificadorTipo === 'porcentaje') {
                precioPropModificado *= (1 + (canalObjetivo.modificadorValor / 100));
            } else if (canalObjetivo.modificadorTipo === 'fijo') {
                precioPropModificado += (canalObjetivo.modificadorValor * totalNights);
            }
        }

        // Convertir moneda si es necesario (entre default y objetivo)
        let precioPropEnMonedaObjetivo = precioPropModificado;
        if (effectiveCanalDefecto) { // Solo si hay conversión necesaria
            if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar (USD->CLP).");
                 precioPropEnMonedaObjetivo = precioPropModificado * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar (CLP->USD).");
                 precioPropEnMonedaObjetivo = valorDolarDia > 0 ? (precioPropModificado / valorDolarDia) : 0;
            }
        }


        totalPrecioOriginal += precioPropEnMonedaObjetivo;

        priceDetails.push({
            nombre: prop.nombre,
            id: prop.id,
            precioTotal: precioPropEnMonedaObjetivo, // En moneda objetivo
            precioPorNoche: totalNights > 0 ? precioPropEnMonedaObjetivo / totalNights : 0,
        });
    }

    // Calcular el total final en CLP
    let totalPriceCLP = totalPrecioOriginal;
    if (canalObjetivo.moneda === 'USD') {
         if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para total CLP desde USD.");
        totalPriceCLP = totalPrecioOriginal * valorDolarDia;
    }

    return {
        totalPriceCLP: Math.round(totalPriceCLP),
        totalPriceOriginal: totalPrecioOriginal, // En moneda objetivo
        currencyOriginal: canalObjetivo.moneda, // Moneda objetivo
        valorDolarDia: valorDolarDia,
        nights: totalNights,
        details: priceDetails
    };
}


module.exports = {
    getAvailabilityData,
    findNormalCombination,
    calculatePrice
    // No necesitamos findSegmentedCombination para la web pública por ahora
};