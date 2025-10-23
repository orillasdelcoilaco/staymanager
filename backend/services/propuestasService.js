// backend/services/propuestasService.js

const admin = require('firebase-admin');
const { obtenerValorDolar } = require('./dolarService');

// Función para obtener datos de disponibilidad (sin cambios)
async function getAvailabilityData(db, empresaId, startDate, endDate, sinCamarotes = false) {
    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<', admin.firestore.Timestamp.fromDate(endDate))
            // *** CORRECCIÓN: Considerar Propuestas y Confirmadas como ocupadas ***
            .where('estado', 'in', ['Confirmada', 'Propuesta'])
            .get()
    ]);

    let allProperties = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (sinCamarotes) {
        allProperties = allProperties.map(prop => {
            if (prop.camas && prop.camas.camarotes > 0) {
                // Restar la capacidad de los camarotes (asumiendo 2 personas por camarote)
                const capacidadReducida = prop.capacidad - (prop.camas.camarotes * 2);
                return { ...prop, capacidad: Math.max(0, capacidadReducida) }; // Asegurar que no sea negativo
            }
            return prop;
        });
    }

    const allTarifas = tarifasSnapshot.docs.map(doc => {
        const data = doc.data();
        let fechaInicio, fechaTermino;

        // Intentar parsear fechas desde Timestamp o String ISO (UTC)
        if (data.fechaInicio && typeof data.fechaInicio.toDate === 'function') {
            fechaInicio = data.fechaInicio.toDate();
        } else if (typeof data.fechaInicio === 'string') {
            fechaInicio = new Date(data.fechaInicio + 'T00:00:00Z'); // Asumir UTC si es string
        } else {
            console.warn(`[WARN] Tarifa ${doc.id} tiene fechaInicio inválida.`);
            return null; // Ignorar tarifa si fechaInicio es inválida
        }

        if (data.fechaTermino && typeof data.fechaTermino.toDate === 'function') {
            fechaTermino = data.fechaTermino.toDate();
        } else if (typeof data.fechaTermino === 'string') {
            fechaTermino = new Date(data.fechaTermino + 'T00:00:00Z'); // Asumir UTC si es string
        } else {
             console.warn(`[WARN] Tarifa ${doc.id} tiene fechaTermino inválida.`);
            return null; // Ignorar tarifa si fechaTermino es inválida
        }

        // Validar que las fechas parseadas sean válidas
        if (isNaN(fechaInicio.getTime()) || isNaN(fechaTermino.getTime())) {
             console.warn(`[WARN] Tarifa ${doc.id} resultó con fechas NaN tras parseo.`);
            return null;
        }

        return { ...data, id: doc.id, fechaInicio, fechaTermino };
    }).filter(Boolean); // Filtrar resultados null

    // Propiedades que tienen al menos una tarifa que se solapa con el rango de búsqueda
    const propiedadesConTarifa = allProperties.filter(prop => {
        return allTarifas.some(tarifa => {
            return tarifa.alojamientoId === prop.id && tarifa.fechaInicio <= endDate && tarifa.fechaTermino >= startDate;
        });
    });

    // Reservas existentes que se solapan con el rango de búsqueda
    const overlappingReservations = [];
    reservasSnapshot.forEach(doc => {
        const reserva = doc.data();
        // Asegurarse de que fechaSalida sea un objeto Date
        const fechaSalidaReserva = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? new Date(reserva.fechaSalida) : null);
        if (fechaSalidaReserva && !isNaN(fechaSalidaReserva.getTime()) && fechaSalidaReserva > startDate) {
            overlappingReservations.push(reserva);
        }
    });

    // Mapa de disponibilidad: ID de propiedad -> array de reservas que la ocupan
    const availabilityMap = new Map();
    allProperties.forEach(prop => availabilityMap.set(prop.id, []));
    overlappingReservations.forEach(reserva => {
        if (availabilityMap.has(reserva.alojamientoId)) {
            // Asegurarse de que start y end sean objetos Date
            const start = reserva.fechaLlegada?.toDate ? reserva.fechaLlegada.toDate() : (reserva.fechaLlegada ? new Date(reserva.fechaLlegada) : null);
            const end = reserva.fechaSalida?.toDate ? reserva.fechaSalida.toDate() : (reserva.fechaSalida ? new Date(reserva.fechaSalida) : null);
            if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
                availabilityMap.get(reserva.alojamientoId).push({ start, end });
            }
        }
    });

    // Propiedades CON TARIFA que NO están ocupadas en el rango solicitado
    const availableProperties = propiedadesConTarifa.filter(prop => {
        const reservations = availabilityMap.get(prop.id) || [];
        // Verifica si ALGUNA reserva existente se solapa con el rango [startDate, endDate)
        return !reservations.some(res => startDate < res.end && endDate > res.start);
    });

    return { availableProperties, allProperties, allTarifas, availabilityMap };
}

// *** FUNCIÓN REFACTORIZADA PARA BUSCAR COMBINACIÓN ***
function findNormalCombination(availableProperties, requiredCapacity) {
    // Ordenar disponibles por capacidad descendente
    const sortedCabanas = availableProperties.sort((a, b) => b.capacidad - a.capacidad);

    // 1. Verificar si alguna propiedad individual cumple
    for (const prop of sortedCabanas) {
        if (prop.capacidad >= requiredCapacity) {
            // Encontrada una solución simple de una propiedad
            console.log(`[findNormalCombination] Encontrada solución individual: ${prop.id} (Cap: ${prop.capacidad}) para ${requiredCapacity} personas.`);
            return { combination: [prop], capacity: prop.capacidad };
        }
    }

    // 2. Si no, intentar combinar (enfoque greedy)
    console.log(`[findNormalCombination] No hay solución individual para ${requiredCapacity}. Intentando combinación greedy...`);
    let currentCombination = [];
    let currentCapacity = 0;

    for (const prop of sortedCabanas) {
        // Añadir propiedad si aún no se alcanza la capacidad
        if (currentCapacity < requiredCapacity) {
            currentCombination.push(prop);
            currentCapacity += prop.capacidad;
            console.log(`[findNormalCombination] Añadida ${prop.id} (Cap: ${prop.capacidad}). Capacidad actual: ${currentCapacity}`);
        } else {
            // Ya se alcanzó o superó la capacidad necesaria con las propiedades anteriores
            console.log(`[findNormalCombination] Capacidad ${currentCapacity} >= ${requiredCapacity}. Deteniendo combinación.`);
            break; // Detener una vez alcanzada la capacidad
        }
    }

    // 3. Verificar si la combinación encontrada es válida
    if (currentCapacity >= requiredCapacity) {
        console.log(`[findNormalCombination] Combinación encontrada: ${currentCombination.map(p=>p.id).join(', ')} (Cap Total: ${currentCapacity})`);
        return { combination: currentCombination, capacity: currentCapacity };
    }

    // 4. Si no se encontró combinación
    console.log(`[findNormalCombination] No se encontró combinación válida para ${requiredCapacity} personas.`);
    return { combination: [], capacity: 0 };
}
// *** FIN FUNCIÓN REFACTORIZADA ***


// Lógica para encontrar combinación segmentada (sin cambios)
function findSegmentedCombination(allProperties, allTarifas, availabilityMap, requiredCapacity, startDate, endDate) {

    const allDailyOptions = [];
    let isPossible = true;

    // 1. Encontrar opciones CADA DÍA
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d); // Crear nueva instancia para no modificar 'd'

        // Propiedades disponibles ESE DÍA que cumplen la capacidad
        const dailyAvailable = allProperties.filter(prop => {
            // A. Debe tener capacidad suficiente
            if (prop.capacidad < requiredCapacity) return false;

            // B. Debe tener tarifa definida para ese día
            const hasTarifa = allTarifas.some(t =>
                t.alojamientoId === prop.id && t.fechaInicio <= currentDate && t.fechaTermino >= currentDate
            );
            if (!hasTarifa) return false;

            // C. No debe estar ocupada ese día
            const isOccupied = (availabilityMap.get(prop.id) || []).some(res =>
                currentDate >= res.start && currentDate < res.end // Ocupada si currentDate está entre [llegada, salida)
            );
            return !isOccupied;
        });

        if (dailyAvailable.length === 0) {
            console.log(`[findSegmented] No hay opción disponible para ${currentDate.toISOString().split('T')[0]} con capacidad >= ${requiredCapacity}`);
            isPossible = false; // Si un solo día falla, la segmentación no es posible
            break;
        }

        // Guardar la MEJOR opción (mayor capacidad) para ese día
        const bestOption = dailyAvailable.sort((a, b) => b.capacidad - a.capacidad)[0];
        allDailyOptions.push({ date: new Date(currentDate), option: bestOption }); // Guardar copia de currentDate
    }

    if (!isPossible || allDailyOptions.length === 0) {
        return { combination: [], capacity: 0, dailyOptions: [] };
    }

    // 2. Construir el itinerario agrupando por la propiedad seleccionada
    let itinerary = [];
    if (allDailyOptions.length > 0) {
        let currentSegment = {
            propiedad: allDailyOptions[0].option, // Es un objeto propiedad
            startDate: allDailyOptions[0].date,
            endDate: new Date(new Date(allDailyOptions[0].date).setDate(allDailyOptions[0].date.getDate() + 1)) // El fin es la mañana siguiente
        };

        for (let i = 1; i < allDailyOptions.length; i++) {
            const day = allDailyOptions[i];

            // Si el día siguiente usa la MISMA propiedad
            if (day.option.id === currentSegment.propiedad.id) {
                // Extender el segmento
                currentSegment.endDate = new Date(new Date(day.date).setDate(day.date.getDate() + 1));
            } else {
                // Se rompió el segmento, guardar el anterior y empezar uno nuevo
                itinerary.push(currentSegment);
                currentSegment = {
                    propiedad: day.option,
                    startDate: day.date,
                    endDate: new Date(new Date(day.date).setDate(day.date.getDate() + 1))
                };
            }
        }
        itinerary.push(currentSegment); // Añadir el último segmento
    }

    // 'combination' es el itinerario
    return { combination: itinerary, capacity: requiredCapacity, dailyOptions: allDailyOptions };
}

// Lógica para calcular precios (sin cambios)
async function calculatePrice(db, empresaId, items, startDate, endDate, allTarifas, canalObjetivoId, valorDolarDiaOverride = null, isSegmented = false) {

    const canalesRef = db.collection('empresas').doc(empresaId).collection('canales');
    const [canalDefectoSnapshot, canalObjetivoDoc] = await Promise.all([
        canalesRef.where('esCanalPorDefecto', '==', true).limit(1).get(),
        canalesRef.doc(canalObjetivoId).get()
    ]);

    if (canalDefectoSnapshot.empty) throw new Error("No se ha configurado un canal por defecto.");
    if (!canalObjetivoDoc.exists) throw new Error("El canal de venta seleccionado no es válido.");

    const canalPorDefecto = { id: canalDefectoSnapshot.docs[0].id, ...canalDefectoSnapshot.docs[0].data() };
    const canalObjetivo = { id: canalObjetivoDoc.id, ...canalObjetivoDoc.data() };

    // Obtener valor del dólar solo si es necesario y no se proveyó override
    const valorDolarDia = valorDolarDiaOverride ??
                          ((canalPorDefecto.moneda === 'USD' || canalObjetivo.moneda === 'USD')
                              ? await obtenerValorDolar(db, empresaId, startDate)
                              : null);


    let totalPrecioOriginal = 0; // Precio final en la moneda del canal objetivo
    const priceDetails = [];
    let totalNights = 0;

    if (isSegmented) {
        // 'items' es el itinerario: [{ propiedad: {...}, startDate: Date, endDate: Date }, ...]
        for (const segment of items) {
            const segmentStartDate = segment.startDate;
            const segmentEndDate = segment.endDate; // endDate es el día de check-out (exclusivo)
            const segmentNights = Math.max(1, Math.round((segmentEndDate - segmentStartDate) / (1000 * 60 * 60 * 24)));
            totalNights += segmentNights;

            let propPrecioBaseTotalSegmento = 0; // Precio base en moneda default
            const prop = segment.propiedad; // La propiedad única para este segmento

            for (let d = new Date(segmentStartDate); d < segmentEndDate; d.setDate(d.getDate() + 1)) {
                const currentDate = new Date(d); // Nueva instancia para no modificar 'd'
                const tarifasDelDia = allTarifas.filter(t =>
                    t.alojamientoId === prop.id &&
                    t.fechaInicio <= currentDate &&
                    t.fechaTermino >= currentDate
                );

                if (tarifasDelDia.length > 0) {
                    const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0]; // Más específica
                    const precioBaseObj = tarifa.precios?.[canalPorDefecto.id]; // Acceder al precio base guardado
                    // El precio base ya está guardado como un número simple
                    const precioNocheBase = typeof precioBaseObj === 'number' ? precioBaseObj : 0;
                    propPrecioBaseTotalSegmento += precioNocheBase;
                }
            }

            // Aplicar modificador y conversión al total de la propiedad en el segmento
            let precioPropModificadoSegmento = propPrecioBaseTotalSegmento; // Sigue en moneda default
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    precioPropModificadoSegmento *= (1 + (canalObjetivo.modificadorValor / 100));
                } else if (canalObjetivo.modificadorTipo === 'fijo') {
                     // El modificador fijo es por NOCHE
                    precioPropModificadoSegmento += (canalObjetivo.modificadorValor * segmentNights);
                }
            }

            let precioPropEnMonedaObjetivo = precioPropModificadoSegmento;
            if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir USD a CLP.");
                precioPropEnMonedaObjetivo = precioPropModificadoSegmento * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir CLP a USD.");
                 precioPropEnMonedaObjetivo = valorDolarDia > 0 ? (precioPropModificadoSegmento / valorDolarDia) : 0;
            }
             // Si las monedas son iguales, no se hace conversión

            totalPrecioOriginal += precioPropEnMonedaObjetivo; // Sumar al total general (en moneda objetivo)

            priceDetails.push({
                nombre: prop.nombre, // Nombre de la propiedad del segmento
                precioTotal: precioPropEnMonedaObjetivo,
                precioPorNoche: segmentNights > 0 ? precioPropEnMonedaObjetivo / segmentNights : 0,
                // Añadir detalles del segmento
                noches: segmentNights,
                fechaInicio: segmentStartDate.toISOString().split('T')[0],
                fechaTermino: segmentEndDate.toISOString().split('T')[0] // Fecha de checkout
            });
        }
    } else {
        // Calcular precio normal (no segmentado)
        totalNights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (totalNights <= 0) return { totalPriceCLP: 0, totalPriceOriginal: 0, currencyOriginal: canalObjetivo.moneda, valorDolarDia, nights: 0, details: [] };

        for (const prop of items) { // 'items' es el array de propiedades
            let propPrecioBaseTotal = 0; // Precio base total de la propiedad (moneda default)

            for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
                const currentDate = new Date(d); // Nueva instancia
                const tarifasDelDia = allTarifas.filter(t =>
                    t.alojamientoId === prop.id &&
                    t.fechaInicio <= currentDate &&
                    t.fechaTermino >= currentDate
                );

                if (tarifasDelDia.length > 0) {
                    const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
                    const precioBaseObj = tarifa.precios?.[canalPorDefecto.id];
                    const precioNocheBase = typeof precioBaseObj === 'number' ? precioBaseObj : 0;
                    propPrecioBaseTotal += precioNocheBase;
                }
            }

            let precioPropModificado = propPrecioBaseTotal; // Sigue en moneda default
            if (canalObjetivo.id !== canalPorDefecto.id && canalObjetivo.modificadorValor) {
                if (canalObjetivo.modificadorTipo === 'porcentaje') {
                    precioPropModificado *= (1 + (canalObjetivo.modificadorValor / 100));
                } else if (canalObjetivo.modificadorTipo === 'fijo') {
                    precioPropModificado += (canalObjetivo.modificadorValor * totalNights);
                }
            }

            let precioPropEnMonedaObjetivo = precioPropModificado;
            if (canalPorDefecto.moneda === 'USD' && canalObjetivo.moneda === 'CLP') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir USD a CLP.");
                 precioPropEnMonedaObjetivo = precioPropModificado * valorDolarDia;
            } else if (canalPorDefecto.moneda === 'CLP' && canalObjetivo.moneda === 'USD') {
                 if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para convertir CLP a USD.");
                 precioPropEnMonedaObjetivo = valorDolarDia > 0 ? (precioPropModificado / valorDolarDia) : 0;
            }
             // Si las monedas son iguales, no se hace conversión

            totalPrecioOriginal += precioPropEnMonedaObjetivo;

            priceDetails.push({
                nombre: prop.nombre,
                precioTotal: precioPropEnMonedaObjetivo,
                precioPorNoche: totalNights > 0 ? precioPropEnMonedaObjetivo / totalNights : 0,
            });
        }
    }

    // Calcular el precio final en CLP para devolverlo siempre
    let totalPriceCLP = totalPrecioOriginal;
    if (canalObjetivo.moneda === 'USD') {
         if (valorDolarDia === null) throw new Error("Se necesita valor del dólar para calcular el total en CLP desde USD.");
        totalPriceCLP = totalPrecioOriginal * valorDolarDia;
    }

    return {
        totalPriceCLP: Math.round(totalPriceCLP),      // Precio final TOTAL en CLP
        totalPriceOriginal: totalPrecioOriginal,       // Precio final TOTAL en moneda del canal objetivo
        currencyOriginal: canalObjetivo.moneda,        // Moneda del canal objetivo
        valorDolarDia: valorDolarDia,                  // Valor del dólar usado (si aplica)
        nights: totalNights,                           // Noches totales
        details: priceDetails                          // Desglose por propiedad/segmento en moneda objetivo
    };
}


module.exports = {
    getAvailabilityData,
    findNormalCombination,
    findSegmentedCombination,
    calculatePrice
};
