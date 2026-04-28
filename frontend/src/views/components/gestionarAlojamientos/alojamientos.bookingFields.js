export function aplicarBookingAlojamientoAlDom(booking) {
    const b = booking || {};
    const setVal = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        const raw = b[key];
        el.value = raw === undefined || raw === null ? '' : String(raw);
    };
    setVal('bookingMinNoches', 'minNoches');
    setVal('bookingMaxNochesEstadia', 'maxNochesEstadia');
    setVal('bookingMinDiasAnticipacionReserva', 'minDiasAnticipacionReserva');
    setVal('bookingMesesReservableAdelante', 'mesesReservableAdelante');

    const set = new Set(Array.isArray(b.diasSemanaLlegadaPermitidos) ? b.diasSemanaLlegadaPermitidos.map((d) => parseInt(d, 10)) : []);
    document.querySelectorAll('.booking-dia-llegada').forEach((cb) => {
        cb.checked = set.has(parseInt(cb.value, 10));
    });
}

export function leerBookingAlojamientoDelDom() {
    const asOptInt = (id) => {
        const v = document.getElementById(id)?.value?.trim();
        if (!v && v !== '0') return undefined;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : undefined;
    };
    const dias = Array.from(document.querySelectorAll('.booking-dia-llegada:checked'))
        .map((cb) => parseInt(cb.value, 10))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

    const booking = {
        minNoches: asOptInt('bookingMinNoches'),
        maxNochesEstadia: asOptInt('bookingMaxNochesEstadia'),
        minDiasAnticipacionReserva: asOptInt('bookingMinDiasAnticipacionReserva'),
        mesesReservableAdelante: asOptInt('bookingMesesReservableAdelante'),
    };

    if (dias.length) booking.diasSemanaLlegadaPermitidos = Array.from(new Set(dias));
    return booking;
}
