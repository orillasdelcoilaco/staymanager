/**
 * Pruebas mínimas de reservaWebRestriccionesService (sin DB).
 */
const { addDays, format, startOfDay, parseISO } = require('date-fns');
const {
    validarRestriccionesFechasReservaWeb,
    evaluarRestriccionesReservaWebCodigo,
    mergeRestriccionesBookingEmpresaUnaPropiedad,
} = require('../services/reservaWebRestriccionesService');

const fmt = (d) => format(d, 'yyyy-MM-dd');
const d0 = startOfDay(new Date());

function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
}

const booking = { minNoches: 2, maxNochesEstadia: 0, minDiasAnticipacionReserva: 0, mesesReservableAdelante: 0 };
const lleg = fmt(addDays(d0, 10));
const salBad = fmt(addDays(parseISO(`${lleg}T12:00:00`), 1)); // 1 noche
const errMin = validarRestriccionesFechasReservaWeb(booking, [], lleg, salBad, 'es');
assert(errMin && errMin.includes('2'), `min noches: ${errMin}`);

const salOk = fmt(addDays(parseISO(`${lleg}T12:00:00`), 3)); // 3 noches
assert(validarRestriccionesFechasReservaWeb(booking, [], lleg, salOk, 'es') === null, 'debe pasar con 3 noches y min 2');

const errMax = validarRestriccionesFechasReservaWeb(
    { ...booking, maxNochesEstadia: 2 },
    [],
    lleg,
    fmt(addDays(parseISO(`${lleg}T12:00:00`), 5)),
    'es',
);
assert(errMax && errMax.includes('2'), `max noches: ${errMax}`);

const llegHoy = fmt(d0);
const salMan = fmt(addDays(d0, 2));
const errAnt = validarRestriccionesFechasReservaWeb(
    { minNoches: 1, minDiasAnticipacionReserva: 2, maxNochesEstadia: 0, mesesReservableAdelante: 0 },
    [],
    llegHoy,
    salMan,
    'es',
);
assert(errAnt, `anticipación: ${errAnt}`);

const m1 = mergeRestriccionesBookingEmpresaUnaPropiedad({ minNoches: 2 }, { minNoches: 5 });
assert(m1.minNoches === 5, `merge min: empresa 2 + prop 5 → ${m1.minNoches}`);

const m2 = mergeRestriccionesBookingEmpresaUnaPropiedad({ minNoches: 7 }, { minNoches: 3 });
assert(m2.minNoches === 7, `merge min: empresa 7 + prop 3 → ${m2.minNoches}`);

const m3 = mergeRestriccionesBookingEmpresaUnaPropiedad(
    { maxNochesEstadia: 10, mesesReservableAdelante: 12 },
    { maxNochesEstadia: 6, mesesReservableAdelante: 24 },
);
assert(m3.maxNochesEstadia === 6, `merge max tope: ${m3.maxNochesEstadia}`);
assert(m3.mesesReservableAdelante === 12, `merge meses ventana: ${m3.mesesReservableAdelante}`);

const m4 = mergeRestriccionesBookingEmpresaUnaPropiedad(
    { minDiasAnticipacionReserva: 1 },
    { minDiasAnticipacionReserva: 4 },
);
assert(m4.minDiasAnticipacionReserva === 4, `merge anticipación max: ${m4.minDiasAnticipacionReserva}`);

// Día de llegada permitido (0=domingo...6=sábado)
const llegLunes = fmt(addDays(d0, (8 - d0.getDay()) % 7 || 7)); // próximo lunes
const salLunesOk = fmt(addDays(parseISO(`${llegLunes}T12:00:00`), 2));
const errDia = validarRestriccionesFechasReservaWeb(
    { minNoches: 1, diasSemanaLlegadaPermitidos: [5, 6] }, // viernes/sábado
    [],
    llegLunes,
    salLunesOk,
    'es',
);
assert(errDia && errDia.includes('día de la semana'), `día llegada: ${errDia}`);

const evDia = evaluarRestriccionesReservaWebCodigo(
    { minNoches: 1, diasSemanaLlegadaPermitidos: [5, 6] },
    [],
    llegLunes,
    salLunesOk,
);
assert(evDia && evDia.ok === false && evDia.codigo === 'dia_llegada_no_permitido', `codigo día llegada: ${JSON.stringify(evDia)}`);

const bookingDemanda = {
    minNoches: 1,
    maxNochesEstadia: 0,
    minDiasAnticipacionReserva: 0,
    mesesReservableAdelante: 0,
    eventosDemandaMapaCalor: [
        { nombre: 'Alta', desde: '2030-06-10', hasta: '2030-06-15', nivel: 4, minNochesLlegada: 4 },
    ],
};
const llegD = '2030-06-12';
const salD2 = fmt(addDays(parseISO(`${llegD}T12:00:00`), 2)); // 2 noches
const errDem = validarRestriccionesFechasReservaWeb(bookingDemanda, [], llegD, salD2, 'es');
assert(errDem && errDem.includes('4'), `heatmap min noches: ${errDem}`);
const salD4 = fmt(addDays(parseISO(`${llegD}T12:00:00`), 4));
assert(validarRestriccionesFechasReservaWeb(bookingDemanda, [], llegD, salD4, 'es') === null, '4 noches debe pasar con demanda 4');

const evOk = evaluarRestriccionesReservaWebCodigo(bookingDemanda, [], llegD, salD4);
assert(evOk.ok === true && evOk.reglas_resumen.minimo_noches === 4, `resumen min efectivo: ${JSON.stringify(evOk.reglas_resumen)}`);

const mergeDias = mergeRestriccionesBookingEmpresaUnaPropiedad(
    { diasSemanaLlegadaPermitidos: [1, 2, 3, 4, 5] },
    { diasSemanaLlegadaPermitidos: [5, 6] },
);
assert(Array.isArray(mergeDias.diasSemanaLlegadaPermitidos), 'merge días debe ser array');
assert(mergeDias.diasSemanaLlegadaPermitidos.length === 1 && mergeDias.diasSemanaLlegadaPermitidos[0] === 5, `merge días intersección: ${mergeDias.diasSemanaLlegadaPermitidos}`);

console.log('test-reserva-web-restricciones: OK');
