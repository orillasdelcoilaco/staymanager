// backend/services/kpiService.js
const admin = require('firebase-admin');

function getUTCDate(dateStr) {
    const date = new Date(dateStr);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function calculateKPIs(db, empresaId, fechaInicio, fechaFin, canalFiltro) {
    const startDate = getUTCDate(fechaInicio);
    const endDate = getUTCDate(fechaFin);
    const daysInPeriod = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    const [propiedadesSnapshot, tarifasSnapshot, reservasSnapshot, canalesSnapshot] = await Promise.all([
        db.collection('empresas').doc(empresaId).collection('propiedades').get(),
        db.collection('empresas').doc(empresaId).collection('tarifas').get(),
        db.collection('empresas').doc(empresaId).collection('reservas')
            .where('fechaLlegada', '<=', admin.firestore.Timestamp.fromDate(endDate))
            .get(),
        db.collection('empresas').doc(empresaId).collection('canales').get()
    ]);

    if (propiedadesSnapshot.empty) {
        throw new Error("No se encontraron propiedades para la empresa.");
    }

    const todasLasPropiedades = propiedadesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allTarifas = tarifasSnapshot.docs.map(doc => ({ ...doc.data(), fechaInicio: doc.data().fechaInicio.toDate(), fechaTermino: doc.data().fechaTermino.toDate() }));
    const allCanales = canalesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const canalPorDefecto = allCanales.find(c => c.esCanalPorDefecto);

    const reservasDelPeriodo = [];
    reservasSnapshot.forEach(doc => {
        const data = doc.data();
        const reservaStartDate = data.fechaLlegada.toDate();
        const reservaEndDate = data.fechaSalida.toDate();
        if (reservaStartDate <= endDate && reservaEndDate > startDate) {
            if (!canalFiltro || data.canalId === canalFiltro) {
                 reservasDelPeriodo.push({ id: doc.id, ...data });
            }
        }
    });

    const reservasConfirmadas = reservasDelPeriodo.filter(r => r.estado === 'Confirmada');
    const reservasFacturadas = reservasDelPeriodo.filter(r => r.estadoGestion === 'Facturado');

    const kpisGenerales = {
        ingresoFacturado: 0,
        payoutFacturado: 0,
        costoCanalFacturado: 0,
        ingresoProyectado: 0,
        payoutProyectado: 0,
        descuentosDeCanalExterno: 0,
        ajustesManualesInternos: 0,
        nochesOcupadasFacturadas: 0,
        nochesOcupadasConfirmadas: 0,
        nochesDisponibles: todasLasPropiedades.length * daysInPeriod
    };

    const rendimientoPorPropiedad = {};
    todasLasPropiedades.forEach(prop => {
        rendimientoPorPropiedad[prop.id] = {
            id: prop.id,
            nombre: prop.nombre,
            nochesOcupadasFacturadas: 0,
            nochesOcupadasConfirmadas: 0,
            nochesDisponibles: daysInPeriod,
            reservasFacturadas: 0,
            ingresoTotalFacturado: 0,
            payoutTotalFacturado: 0,
            descuentosDeCanalExterno: 0,
            ajustesManualesInternos: 0,
            nochesPorCanal: {}
        };
    });

    const analisisPorCanal = {};
    allCanales.forEach(canal => {
        analisisPorCanal[canal.id] = {
            id: canal.id,
            nombre: canal.nombre,
            numeroReservas: 0,
            nochesVendidas: 0,
            ingresoTotal: 0,
            payoutNeto: 0,
            costoTotal: 0
        };
    });

    const procesarReserva = (reserva, esFacturada) => {
        const nochesEnRango = calcularNochesEnPeriodo(reserva.fechaLlegada.toDate(), reserva.fechaSalida.toDate(), startDate, endDate);
        if (nochesEnRango === 0) return;

        const valorPorNoche = (reserva.valores.valorHuesped || 0) / reserva.totalNoches;
        const ingresoReservaEnPeriodo = valorPorNoche * nochesEnRango;

        const costoCanalPorNoche = (reserva.valores.costoCanal || 0) / reserva.totalNoches;
        const costoCanalReservaEnPeriodo = costoCanalPorNoche * nochesEnRango;
        
        const payout = ingresoReservaEnPeriodo - costoCanalReservaEnPeriodo;

        if (esFacturada) {
            kpisGenerales.ingresoFacturado += ingresoReservaEnPeriodo;
            kpisGenerales.payoutFacturado += payout;
            kpisGenerales.costoCanalFacturado += costoCanalReservaEnPeriodo;
            kpisGenerales.nochesOcupadasFacturadas += nochesEnRango;
        }

        kpisGenerales.ingresoProyectado += ingresoReservaEnPeriodo;
        kpisGenerales.payoutProyectado += payout;
        kpisGenerales.nochesOcupadasConfirmadas += nochesEnRango;
        
        const tarifaBase = obtenerTarifaBase(reserva.alojamientoId, reserva.fechaLlegada.toDate(), allTarifas, canalPorDefecto ? canalPorDefecto.id : null);
        const valorDeLista = tarifaBase * nochesEnRango;
        
        if (reserva.valores.valorPotencial && reserva.valores.valorPotencial > 0) {
            const potencialPorNoche = reserva.valores.valorPotencial / reserva.totalNoches;
            const potencialEnPeriodo = potencialPorNoche * nochesEnRango;
            const descuentoCanal = potencialEnPeriodo - ingresoReservaEnPeriodo;
            if (descuentoCanal > 0) {
                kpisGenerales.descuentosDeCanalExterno += descuentoCanal;
                if (rendimientoPorPropiedad[reserva.alojamientoId]) {
                    rendimientoPorPropiedad[reserva.alojamientoId].descuentosDeCanalExterno += descuentoCanal;
                }
            }
        } else if (valorDeLista > ingresoReservaEnPeriodo) {
            const ajusteInterno = valorDeLista - ingresoReservaEnPeriodo;
            kpisGenerales.ajustesManualesInternos += ajusteInterno;
            if (rendimientoPorPropiedad[reserva.alojamientoId]) {
                rendimientoPorPropiedad[reserva.alojamientoId].ajustesManualesInternos += ajusteInterno;
            }
        }

        if (rendimientoPorPropiedad[reserva.alojamientoId]) {
            const prop = rendimientoPorPropiedad[reserva.alojamientoId];
            if (esFacturada) {
                prop.nochesOcupadasFacturadas += nochesEnRango;
                prop.ingresoTotalFacturado += ingresoReservaEnPeriodo;
                prop.payoutTotalFacturado += payout;
                prop.reservasFacturadas += 1; // Se cuenta por reserva, no por noche
            }
            prop.nochesOcupadasConfirmadas += nochesEnRango;
            const canalNombre = reserva.canalNombre || 'Desconocido';
            prop.nochesPorCanal[canalNombre] = (prop.nochesPorCanal[canalNombre] || 0) + nochesEnRango;
        }

        if (analisisPorCanal[reserva.canalId]) {
            const canal = analisisPorCanal[reserva.canalId];
            canal.nochesVendidas += nochesEnRango;
            canal.ingresoTotal += ingresoReservaEnPeriodo;
            canal.payoutNeto += payout;
            canal.costoTotal += costoCanalReservaEnPeriodo;
        }
    };
    
    const reservasProcesadas = new Set();
    reservasFacturadas.forEach(reserva => {
        procesarReserva(reserva, true);
        reservasProcesadas.add(reserva.id);
    });
    
    reservasConfirmadas.forEach(reserva => {
        if (!reservasProcesadas.has(reserva.id)) {
            procesarReserva(reserva, false);
        }
    });

    // Contar reservas únicas por canal
    const reservasUnicasCanal = new Map();
    reservasConfirmadas.forEach(r => {
        if (!reservasUnicasCanal.has(r.canalId)) {
            reservasUnicasCanal.set(r.canalId, new Set());
        }
        reservasUnicasCanal.get(r.canalId).add(r.idReservaCanal);
    });
    reservasUnicasCanal.forEach((idSet, canalId) => {
        if (analisisPorCanal[canalId]) {
            analisisPorCanal[canalId].numeroReservas = idSet.size;
        }
    });

    kpisGenerales.tasaOcupacionConfirmada = kpisGenerales.nochesDisponibles > 0 ? (kpisGenerales.nochesOcupadasConfirmadas / kpisGenerales.nochesDisponibles) * 100 : 0;
    kpisGenerales.adrFacturado = kpisGenerales.nochesOcupadasFacturadas > 0 ? kpisGenerales.ingresoFacturado / kpisGenerales.nochesOcupadasFacturadas : 0;
    kpisGenerales.revParFacturado = kpisGenerales.nochesDisponibles > 0 ? kpisGenerales.ingresoFacturado / kpisGenerales.nochesDisponibles : 0;

    Object.values(rendimientoPorPropiedad).forEach(prop => {
        prop.ocupacion = prop.nochesDisponibles > 0 ? (prop.nochesOcupadasConfirmadas / prop.nochesDisponibles) * 100 : 0;
        prop.adr = prop.nochesOcupadasFacturadas > 0 ? prop.ingresoTotalFacturado / prop.nochesOcupadasFacturadas : 0;
        prop.duracionPromedio = prop.reservasFacturadas > 0 ? prop.nochesOcupadasFacturadas / prop.reservasFacturadas : 0;
        prop.valorPromedioReserva = prop.reservasFacturadas > 0 ? prop.ingresoTotalFacturado / prop.reservasFacturadas : 0;
    });

    Object.values(analisisPorCanal).forEach(canal => {
        canal.ingresoPromedioPorReserva = canal.numeroReservas > 0 ? canal.ingresoTotal / canal.numeroReservas : 0;
        canal.costoPromedioPorReserva = canal.numeroReservas > 0 ? canal.costoTotal / canal.numeroReservas : 0;
    });

    return {
        kpisGenerales,
        rendimientoPorPropiedad: Object.values(rendimientoPorPropiedad),
        analisisPorCanal: Object.values(analisisPorCanal).filter(c => c.nochesVendidas > 0),
        reservasPorCanal: kpisGenerales.reservasPorCanal // Mantener para los gráficos existentes
    };
}

function calcularNochesEnPeriodo(llegada, salida, inicioPeriodo, finPeriodo) {
    const start = new Date(Math.max(llegada, inicioPeriodo));
    const end = new Date(Math.min(salida, finPeriodo));

    if (end <= start) {
        return 0;
    }
    
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function obtenerTarifaBase(propiedadId, fecha, allTarifas, canalPorDefectoId) {
    if (!canalPorDefectoId) return 0;
    
    const tarifasDelDia = allTarifas.filter(t => 
        t.alojamientoId === propiedadId &&
        t.fechaInicio <= fecha &&
        t.fechaTermino >= fecha &&
        t.precios && t.precios[canalPorDefectoId]
    );

    if (tarifasDelDia.length > 0) {
        const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
        return tarifa.precios[canalPorDefectoId].valor || 0;
    }
    return 0;
}


module.exports = {
    calculateKPIs
};