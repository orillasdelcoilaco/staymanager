const { addDays, parseISO, isValid } = require('date-fns');

function resolvePublicStayDates(req, defaultCheckin, defaultCheckout) {
    const rawIn = req.query.fechaLlegada || req.query.check_in || req.query.checkin;
    const rawOut = req.query.fechaSalida || req.query.check_out || req.query.checkout;
    const qL = rawIn ? parseISO(String(rawIn).slice(0, 10) + 'T00:00:00Z') : null;
    const qS = rawOut ? parseISO(String(rawOut).slice(0, 10) + 'T00:00:00Z') : null;
    const qC = req.query.checkin ? parseISO(req.query.checkin + 'T00:00:00Z') : null;
    let isDefaultWeekend = false;
    let checkinDate;
    let checkoutDate;
    if (qL && qS && isValid(qL) && isValid(qS) && qS > qL) {
        checkinDate = qL;
        checkoutDate = qS;
    } else if (qC && isValid(qC) && req.query.nights) {
        checkinDate = qC;
        const n = parseInt(req.query.nights, 10);
        checkoutDate = !isNaN(n) && n > 0 ? addDays(checkinDate, n) : addDays(checkinDate, 1);
    } else {
        checkinDate = defaultCheckin;
        checkoutDate = defaultCheckout;
        isDefaultWeekend = true;
    }
    if (!isValid(checkinDate)) checkinDate = defaultCheckin;
    if (!isValid(checkoutDate) || checkoutDate <= checkinDate) checkoutDate = addDays(checkinDate, 1);
    return { checkinDate, checkoutDate, isDefaultWeekend };
}

function computeHostingDurationLabel(empresaCompleta, differenceInYears, differenceInMonths) {
    if (!empresaCompleta.fechaCreacion || !empresaCompleta.fechaCreacion.toDate) {
        return 'Anfitrión';
    }
    const c = empresaCompleta.fechaCreacion.toDate();
    const n = new Date();
    const y = differenceInYears(n, c);
    const m = differenceInMonths(n, c) % 12;
    const d = [];
    if (y > 0) d.push(`${y} año${y !== 1 ? 's' : ''}`);
    if (m > 0) d.push(`${m} mes${m !== 1 ? 'es' : ''}`);
    return d.length > 0 ? `${d.join(' y ')} como anfitrión` : 'Recién comenzando';
}

module.exports = { resolvePublicStayDates, computeHostingDurationLabel };
