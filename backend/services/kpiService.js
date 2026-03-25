// backend/services/kpiService.js
const pool = require('../db/postgres');
const admin = require('firebase-admin');

function getUTCDate(dateStr) {
    const date = new Date(dateStr);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calcularNochesEnPeriodo(llegada, salida, inicioPeriodo, finPeriodo) {
    const start = new Date(Math.max(llegada, inicioPeriodo));
    const end   = new Date(Math.min(salida,  finPeriodo));
    if (end <= start) return 0;
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function obtenerTarifaBase(propiedadId, fecha, allTarifas, canalPorDefectoId) {
    if (!canalPorDefectoId) return 0;
    const tarifasDelDia = allTarifas.filter(t =>
        t.alojamientoId === propiedadId && t.fechaInicio <= fecha && t.fechaTermino >= fecha
        && t.precios?.[canalPorDefectoId]
    );
    if (!tarifasDelDia.length) return 0;
    const tarifa = tarifasDelDia.sort((a, b) => b.fechaInicio - a.fechaInicio)[0];
    return tarifa.precios[canalPorDefectoId].valor || tarifa.precios[canalPorDefectoId] || 0;
}

async function calculateKPIs(db, empresaId, fechaInicio, fechaFin, canalFiltro) {
    const startDate     = getUTCDate(fechaInicio);
    const endDate       = getUTCDate(fechaFin);
    const daysInPeriod  = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    let todasLasPropiedades, allTarifas, allReservas, allCanales, allBloqueos;

    if (pool) {
        const [propRes, tarifaRes, reservaRes, canalRes, bloqueoRes] = await Promise.all([
            pool.query('SELECT id, nombre FROM propiedades WHERE empresa_id = $1', [empresaId]),
            pool.query('SELECT * FROM tarifas WHERE empresa_id = $1', [empresaId]),
            pool.query(
                `SELECT id, id_reserva_canal, propiedad_id, canal_id, canal_nombre, nombre_cliente,
                        fecha_llegada, fecha_salida, total_noches, estado, estado_gestion, moneda, valores
                 FROM reservas WHERE empresa_id = $1 AND fecha_llegada <= $2`,
                [empresaId, fechaFin]
            ),
            pool.query('SELECT id, nombre, metadata FROM canales WHERE empresa_id = $1', [empresaId]),
            pool.query(
                `SELECT * FROM bloqueos WHERE empresa_id = $1 AND fecha_fin >= $2`,
                [empresaId, fechaInicio]
            ),
        ]);

        todasLasPropiedades = propRes.rows.map(r => ({ id: r.id, nombre: r.nombre }));
        allTarifas = tarifaRes.rows.map(row => ({
            alojamientoId: row.propiedad_id,
            fechaInicio:   new Date((row.reglas?.fechaInicio  || '') + 'T00:00:00Z'),
            fechaTermino:  new Date((row.reglas?.fechaTermino || '') + 'T00:00:00Z'),
            precios:       row.reglas?.precios || {},
        }));
        allReservas = reservaRes.rows.map(row => ({
            id:             row.id,
            idReservaCanal: row.id_reserva_canal,
            alojamientoId:  row.propiedad_id,
            canalId:        row.canal_id,
            canalNombre:    row.canal_nombre,
            totalNoches:    row.total_noches,
            estado:         row.estado,
            estadoGestion:  row.estado_gestion,
            valores:        row.valores || {},
            fechaLlegada:   { toDate: () => new Date(row.fecha_llegada) },
            fechaSalida:    { toDate: () => new Date(row.fecha_salida)  },
        }));
        allCanales = canalRes.rows.map(row => ({
            id:               row.id,
            nombre:           row.nombre,
            esCanalPorDefecto: row.metadata?.esCanalPorDefecto || false,
        }));
        allBloqueos = bloqueoRes.rows.map(row => {
            const m = row.metadata || {};
            return {
                id:            row.id,
                todos:         m.todos || row.propiedad_id === null,
                alojamientoIds: m.alojamientoIds || (row.propiedad_id ? [row.propiedad_id] : []),
                fechaInicio:   { toDate: () => new Date(row.fecha_inicio) },
                fechaFin:      { toDate: () => new Date(row.fecha_fin)   },
            };
        });
    } else {
        const [propSnap, tarifaSnap, reservaSnap, canalSnap, bloqueoSnap] = await Promise.all([
            db.collection('empresas').doc(empresaId).collection('propiedades').get(),
            db.collection('empresas').doc(empresaId).collection('tarifas').get(),
            db.collection('empresas').doc(empresaId).collection('reservas')
                .where('fechaLlegada', '<=', admin.firestore.Timestamp.fromDate(endDate)).get(),
            db.collection('empresas').doc(empresaId).collection('canales').get(),
            db.collection('empresas').doc(empresaId).collection('bloqueos')
                .where('fechaFin', '>=', admin.firestore.Timestamp.fromDate(startDate)).get(),
        ]);

        if (propSnap.empty) throw new Error('No se encontraron propiedades para la empresa.');

        todasLasPropiedades = propSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allTarifas = tarifaSnap.docs.map(doc => {
            const data = doc.data();
            return { ...data, fechaInicio: data.fechaInicio.toDate(), fechaTermino: data.fechaTermino.toDate() };
        });
        allReservas = reservaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allCanales  = canalSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        allBloqueos = bloqueoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    if (!todasLasPropiedades.length) throw new Error('No se encontraron propiedades para la empresa.');

    const canalPorDefecto = allCanales.find(c => c.esCanalPorDefecto);

    const reservasDelPeriodo = allReservas.filter(data => {
        const llegada = data.fechaLlegada.toDate();
        const salida  = data.fechaSalida.toDate();
        return llegada <= endDate && salida > startDate && (!canalFiltro || data.canalId === canalFiltro);
    });

    const reservasConfirmadas = reservasDelPeriodo.filter(r => r.estado === 'Confirmada');
    const reservasFacturadas  = reservasDelPeriodo.filter(r => r.estadoGestion === 'Facturado');

    const kpisGenerales = {
        ingresoFacturado: 0, payoutFacturado: 0, costoCanalFacturado: 0,
        ingresoProyectado: 0, payoutProyectado: 0,
        descuentosDeCanalExterno: 0, ajustesManualesInternos: 0,
        nochesOcupadasFacturadas: 0, nochesOcupadasConfirmadas: 0,
        nochesDisponibles: todasLasPropiedades.length * daysInPeriod,
    };

    const rendimientoPorPropiedad = {};
    todasLasPropiedades.forEach(prop => {
        rendimientoPorPropiedad[prop.id] = {
            id: prop.id, nombre: prop.nombre,
            nochesOcupadasFacturadas: 0, nochesOcupadasConfirmadas: 0,
            nochesDisponibles: daysInPeriod,
            reservasFacturadas: 0, ingresoTotalFacturado: 0, payoutTotalFacturado: 0,
            descuentosDeCanalExterno: 0, ajustesManualesInternos: 0, nochesPorCanal: {},
        };
    });

    const analisisPorCanal = {};
    allCanales.forEach(canal => {
        analisisPorCanal[canal.id] = { id: canal.id, nombre: canal.nombre, numeroReservas: 0, nochesVendidas: 0, ingresoTotal: 0, payoutNeto: 0, costoTotal: 0 };
    });

    const procesarReserva = (reserva, esFacturada) => {
        const nochesEnRango = calcularNochesEnPeriodo(reserva.fechaLlegada.toDate(), reserva.fechaSalida.toDate(), startDate, endDate);
        if (!nochesEnRango) return;

        const valorPorNoche           = (reserva.valores.valorHuesped || 0) / reserva.totalNoches;
        const ingresoReservaEnPeriodo = valorPorNoche * nochesEnRango;
        const costoCanalPorNoche      = (reserva.valores.costoCanal   || 0) / reserva.totalNoches;
        const costoCanalEnPeriodo     = costoCanalPorNoche * nochesEnRango;
        const payout                  = ingresoReservaEnPeriodo - costoCanalEnPeriodo;

        if (esFacturada) {
            kpisGenerales.ingresoFacturado     += ingresoReservaEnPeriodo;
            kpisGenerales.payoutFacturado      += payout;
            kpisGenerales.costoCanalFacturado  += costoCanalEnPeriodo;
            kpisGenerales.nochesOcupadasFacturadas += nochesEnRango;
        }
        kpisGenerales.ingresoProyectado        += ingresoReservaEnPeriodo;
        kpisGenerales.payoutProyectado         += payout;
        kpisGenerales.nochesOcupadasConfirmadas += nochesEnRango;

        const tarifaBase   = obtenerTarifaBase(reserva.alojamientoId, reserva.fechaLlegada.toDate(), allTarifas, canalPorDefecto?.id || null);
        const valorDeLista = tarifaBase * nochesEnRango;

        if (reserva.valores.valorPotencial > 0) {
            const descuentoCanal = (reserva.valores.valorPotencial / reserva.totalNoches * nochesEnRango) - ingresoReservaEnPeriodo;
            if (descuentoCanal > 0) {
                kpisGenerales.descuentosDeCanalExterno += descuentoCanal;
                if (rendimientoPorPropiedad[reserva.alojamientoId]) rendimientoPorPropiedad[reserva.alojamientoId].descuentosDeCanalExterno += descuentoCanal;
            }
        } else if (valorDeLista > ingresoReservaEnPeriodo) {
            const ajuste = valorDeLista - ingresoReservaEnPeriodo;
            kpisGenerales.ajustesManualesInternos += ajuste;
            if (rendimientoPorPropiedad[reserva.alojamientoId]) rendimientoPorPropiedad[reserva.alojamientoId].ajustesManualesInternos += ajuste;
        }

        const prop = rendimientoPorPropiedad[reserva.alojamientoId];
        if (prop) {
            if (esFacturada) {
                prop.nochesOcupadasFacturadas += nochesEnRango;
                prop.ingresoTotalFacturado    += ingresoReservaEnPeriodo;
                prop.payoutTotalFacturado     += payout;
                prop.reservasFacturadas       += 1;
            }
            prop.nochesOcupadasConfirmadas += nochesEnRango;
            const cn = reserva.canalNombre || 'Desconocido';
            prop.nochesPorCanal[cn] = (prop.nochesPorCanal[cn] || 0) + nochesEnRango;
        }

        if (analisisPorCanal[reserva.canalId]) {
            analisisPorCanal[reserva.canalId].nochesVendidas += nochesEnRango;
            analisisPorCanal[reserva.canalId].ingresoTotal   += ingresoReservaEnPeriodo;
            analisisPorCanal[reserva.canalId].payoutNeto     += payout;
            analisisPorCanal[reserva.canalId].costoTotal     += costoCanalEnPeriodo;
        }
    };

    const procesadas = new Set();
    reservasFacturadas.forEach(r  => { procesarReserva(r, true);  procesadas.add(r.id); });
    reservasConfirmadas.forEach(r => { if (!procesadas.has(r.id)) procesarReserva(r, false); });

    const reservasUnicasCanal = new Map();
    reservasConfirmadas.forEach(r => {
        if (!reservasUnicasCanal.has(r.canalId)) reservasUnicasCanal.set(r.canalId, new Set());
        reservasUnicasCanal.get(r.canalId).add(r.idReservaCanal);
    });
    reservasUnicasCanal.forEach((ids, canalId) => {
        if (analisisPorCanal[canalId]) analisisPorCanal[canalId].numeroReservas = ids.size;
    });

    const todosLosIdsKpi = todasLasPropiedades.map(p => p.id);
    allBloqueos.forEach(b => {
        const bInicio = b.fechaInicio.toDate();
        const bFin    = new Date(b.fechaFin.toDate().getTime() + 86400000);
        if (bInicio >= endDate || bFin <= startDate) return;
        const nochesBloqueo = calcularNochesEnPeriodo(bInicio, bFin, startDate, endDate);
        if (!nochesBloqueo) return;
        const idsAfectados = b.todos ? todosLosIdsKpi : (b.alojamientoIds || []);
        idsAfectados.forEach(propId => {
            kpisGenerales.nochesDisponibles -= nochesBloqueo;
            if (rendimientoPorPropiedad[propId]) rendimientoPorPropiedad[propId].nochesDisponibles -= nochesBloqueo;
        });
    });

    kpisGenerales.tasaOcupacionConfirmada = kpisGenerales.nochesDisponibles > 0 ? (kpisGenerales.nochesOcupadasConfirmadas / kpisGenerales.nochesDisponibles) * 100 : 0;
    kpisGenerales.adrFacturado   = kpisGenerales.nochesOcupadasFacturadas > 0 ? kpisGenerales.ingresoFacturado / kpisGenerales.nochesOcupadasFacturadas : 0;
    kpisGenerales.revParFacturado = kpisGenerales.nochesDisponibles > 0 ? kpisGenerales.ingresoFacturado / kpisGenerales.nochesDisponibles : 0;

    Object.values(rendimientoPorPropiedad).forEach(prop => {
        prop.ocupacion             = prop.nochesDisponibles > 0 ? (prop.nochesOcupadasConfirmadas / prop.nochesDisponibles) * 100 : 0;
        prop.adr                   = prop.nochesOcupadasFacturadas > 0 ? prop.ingresoTotalFacturado / prop.nochesOcupadasFacturadas : 0;
        prop.duracionPromedio      = prop.reservasFacturadas > 0 ? prop.nochesOcupadasFacturadas / prop.reservasFacturadas : 0;
        prop.valorPromedioReserva  = prop.reservasFacturadas > 0 ? prop.ingresoTotalFacturado / prop.reservasFacturadas : 0;
    });

    Object.values(analisisPorCanal).forEach(canal => {
        canal.ingresoPromedioPorReserva = canal.numeroReservas > 0 ? canal.ingresoTotal / canal.numeroReservas : 0;
        canal.costoPromedioPorReserva   = canal.numeroReservas > 0 ? canal.costoTotal   / canal.numeroReservas : 0;
    });

    return {
        kpisGenerales,
        rendimientoPorPropiedad: Object.values(rendimientoPorPropiedad),
        analisisPorCanal: Object.values(analisisPorCanal).filter(c => c.nochesVendidas > 0),
    };
}

module.exports = { calculateKPIs };
