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

    // 1. Obtener todos los datos necesarios en paralelo
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
    const allCanales = canalesSnapshot.docs.map(doc => doc.data());

    // 2. Filtrar y clasificar reservas
    const reservasDelPeriodo = [];
    reservasSnapshot.forEach(doc => {
        const data = doc.data();
        const reservaStartDate = data.fechaLlegada.toDate();
        const reservaEndDate = data.fechaSalida.toDate();
        if (reservaStartDate <= endDate && reservaEndDate > startDate) {
            if (!canalFiltro || data.canalNombre === canalFiltro) {
                 reservasDelPeriodo.push({ id: doc.id, ...data });
            }
        }
    });

    const reservasConfirmadas = reservasDelPeriodo.filter(r => r.estado === 'Confirmada');
    const reservasFacturadas = reservasDelPeriodo.filter(r => r.estadoGestion === 'Facturado');

    // 3. Inicializar contadores y estructuras
    const kpis = {
        ingresoFacturado: 0,
        payoutFacturado: 0,
        costoCanalFacturado: 0,
        ingresoProyectado: 0,
        payoutProyectado: 0,
        valorPotencialTotal: 0,
        nochesOcupadasFacturadas: 0,
        nochesOcupadasConfirmadas: 0,
        nochesDisponibles: todasLasPropiedades.length * daysInPeriod,
        reservasPorCanal: {},
        rendimientoPorPropiedad: {}
    };

    todasLasPropiedades.forEach(prop => {
        kpis.rendimientoPorPropiedad[prop.nombre] = {
            nochesOcupadasFacturadas: 0,
            nochesOcupadasConfirmadas: 0,
            ingresoTotalFacturado: 0,
            payoutTotalFacturado: 0,
            descuentoPromedio: 0,
            totalDescuentos: 0,
            reservasConDescuento: 0
        };
    });

    // 4. Procesar Reservas Facturadas
    reservasFacturadas.forEach(reserva => {
        const nochesEnRango = calcularNochesEnPeriodo(reserva.fechaLlegada.toDate(), reserva.fechaSalida.toDate(), startDate, endDate);
        kpis.nochesOcupadasFacturadas += nochesEnRango;

        const valorPorNoche = (reserva.valores.valorHuesped || 0) / reserva.totalNoches;
        const ingresoReservaEnPeriodo = valorPorNoche * nochesEnRango;
        kpis.ingresoFacturado += ingresoReservaEnPeriodo;

        const costoCanalPorNoche = (reserva.valores.costoCanal || 0) / reserva.totalNoches;
        const costoCanalReservaEnPeriodo = costoCanalPorNoche * nochesEnRango;
        kpis.costoCanalFacturado += costoCanalReservaEnPeriodo;

        const payout = ingresoReservaEnPeriodo - costoCanalReservaEnPeriodo;
        kpis.payoutFacturado += payout;
        
        if(kpis.rendimientoPorPropiedad[reserva.alojamientoNombre]) {
            kpis.rendimientoPorPropiedad[reserva.alojamientoNombre].nochesOcupadasFacturadas += nochesEnRango;
            kpis.rendimientoPorPropiedad[reserva.alojamientoNombre].ingresoTotalFacturado += ingresoReservaEnPeriodo;
            kpis.rendimientoPorPropiedad[reserva.alojamientoNombre].payoutTotalFacturado += payout;
        }
    });

    // 5. Procesar Reservas Confirmadas
    reservasConfirmadas.forEach(reserva => {
        const nochesEnRango = calcularNochesEnPeriodo(reserva.fechaLlegada.toDate(), reserva.fechaSalida.toDate(), startDate, endDate);
        kpis.nochesOcupadasConfirmadas += nochesEnRango;

        const valorPorNoche = (reserva.valores.valorHuesped || 0) / reserva.totalNoches;
        const ingresoReservaEnPeriodo = valorPorNoche * nochesEnRango;
        kpis.ingresoProyectado += ingresoReservaEnPeriodo;

        const costoCanalPorNoche = (reserva.valores.costoCanal || 0) / reserva.totalNoches;
        const costoCanalReservaEnPeriodo = costoCanalPorNoche * nochesEnRango;
        kpis.payoutProyectado += (ingresoReservaEnPeriodo - costoCanalReservaEnPeriodo);

        if (reserva.valores.valorPotencial && reserva.valores.valorPotencial > 0) {
            const potencialPorNoche = reserva.valores.valorPotencial / reserva.totalNoches;
            const potencialEnPeriodo = potencialPorNoche * nochesEnRango;
            kpis.valorPotencialTotal += potencialEnPeriodo;
            
            const descuento = potencialEnPeriodo - ingresoReservaEnPeriodo;
            if (descuento > 0 && kpis.rendimientoPorPropiedad[reserva.alojamientoNombre]) {
                kpis.rendimientoPorPropiedad[reserva.alojamientoNombre].totalDescuentos += descuento;
                kpis.rendimientoPorPropiedad[reserva.alojamientoNombre].reservasConDescuento++;
            }
        }
        
        if(kpis.rendimientoPorPropiedad[reserva.alojamientoNombre]) {
            kpis.rendimientoPorPropiedad[reserva.alojamientoNombre].nochesOcupadasConfirmadas += nochesEnRango;
        }

        const canal = reserva.canalNombre || 'Desconocido';
        if (!kpis.reservasPorCanal[canal]) {
            kpis.reservasPorCanal[canal] = { noches: 0, ingreso: 0, payout: 0 };
        }
        kpis.reservasPorCanal[canal].noches += nochesEnRango;
        kpis.reservasPorCanal[canal].ingreso += ingresoReservaEnPeriodo;
        kpis.reservasPorCanal[canal].payout += (ingresoReservaEnPeriodo - costoCanalReservaEnPeriodo);
    });
    
    // 6. Calcular KPIs finales
    kpis.descuentoTotalIdentificado = kpis.valorPotencialTotal - kpis.ingresoProyectado;
    kpis.tasaOcupacionFacturada = kpis.nochesDisponibles > 0 ? (kpis.nochesOcupadasFacturadas / kpis.nochesDisponibles) * 100 : 0;
    kpis.tasaOcupacionProyectada = kpis.nochesDisponibles > 0 ? (kpis.nochesOcupadasConfirmadas / kpis.nochesDisponibles) * 100 : 0;
    kpis.adrFacturado = kpis.nochesOcupadasFacturadas > 0 ? kpis.ingresoFacturado / kpis.nochesOcupadasFacturadas : 0;
    kpis.revParFacturado = kpis.nochesDisponibles > 0 ? kpis.ingresoFacturado / kpis.nochesDisponibles : 0;

    Object.values(kpis.rendimientoPorPropiedad).forEach(prop => {
        prop.tasaOcupacion = daysInPeriod > 0 ? (prop.nochesOcupadasConfirmadas / daysInPeriod) * 100 : 0;
        prop.adr = prop.nochesOcupadasFacturadas > 0 ? prop.ingresoTotalFacturado / prop.nochesOcupadasFacturadas : 0;
        prop.descuentoPromedio = prop.reservasConDescuento > 0 ? prop.totalDescuentos / prop.reservasConDescuento : 0;
    });

    return kpis;
}

function calcularNochesEnPeriodo(llegada, salida, inicioPeriodo, finPeriodo) {
    const start = new Date(Math.max(llegada, inicioPeriodo));
    const end = new Date(Math.min(salida, finPeriodo));

    if (end <= start) {
        return 0;
    }
    
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}


module.exports = {
    calculateKPIs
};