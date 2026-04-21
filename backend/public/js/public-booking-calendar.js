// backend/public/js/public-booking-calendar.js
// Calendario público de dos meses (debajo del mapa). Sincroniza con #fechaLlegada / #fechaSalida y booking.js.

document.addEventListener('DOMContentLoaded', () => {
    const section = document.getElementById('public-booking-calendar-section');
    if (!section) return;

    const propiedadId = section.dataset.propiedadId;
    const fechaIn = document.getElementById('fechaLlegada');
    const fechaOut = document.getElementById('fechaSalida');
    if (!propiedadId || !fechaIn || !fechaOut) return;

    const elLabel0 = document.getElementById('pbc-label-0');
    const elLabel1 = document.getElementById('pbc-label-1');
    const elGrid0 = document.getElementById('pbc-grid-0');
    const elGrid1 = document.getElementById('pbc-grid-1');
    const btnPrev = document.getElementById('pbc-prev');
    const btnNext = document.getElementById('pbc-next');
    const btnClear = document.getElementById('pbc-clear');
    const elLoading = document.getElementById('pbc-loading');
    const elError = document.getElementById('pbc-error');
    const minNoches = Math.max(1, parseInt(String(section.dataset.minNoches || '1'), 10) || 1);

    const MONTH_NAMES = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];

    const toIso = (d) => {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const parseIso = (s) => {
        if (!s || typeof s !== 'string') return null;
        const p = s.split('-').map(Number);
        if (p.length !== 3 || !p[0]) return null;
        const d = new Date(p[0], p[1] - 1, p[2]);
        return Number.isNaN(d.getTime()) ? null : d;
    };

    const todayIso = () => toIso(new Date());

    const monthStartMin = () => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return new Date(t.getFullYear(), t.getMonth(), 1);
    };

    const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
    const endOfMonth = (y, m) => new Date(y, m + 1, 0);

    let leftMonth = monthStartMin();
    let occ = { reservas: [], bloqueos: [] };
    /** @type {Map<string, number>} */
    let nightlyMap = new Map();
    let calCurrency = 'CLP';
    let calDolar = null;
    let checkIn = fechaIn.value || null;
    let checkOut = fechaOut.value || null;
    let hoverIso = null;
    let fetchGen = 0;
    let rafRender = null;

    const syncFromInputs = () => {
        checkIn = fechaIn.value || null;
        checkOut = fechaOut.value || null;
        if (checkIn) {
            const d = parseIso(checkIn);
            if (d) leftMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        }
        const minM = monthStartMin();
        if (leftMonth < minM) leftMonth = new Date(minM.getTime());
    };

    /** booking.js puede ajustar fechas (mínimos, día siguiente); mantener UI alineada */
    window.__bookingCalendarSync = () => {
        checkIn = fechaIn.value || null;
        checkOut = fechaOut.value || null;
        scheduleRender();
    };

    const nightBlocked = (iso, o) => {
        if (o.reservas.some((r) => iso >= r.checkIn && iso < r.checkOut)) return true;
        if (o.bloqueos.some((b) => iso >= b.desde && iso <= b.hasta)) return true;
        return false;
    };

    const checkInAllowed = (iso, o) => {
        if (iso < todayIso()) return false;
        return !nightBlocked(iso, o);
    };

    const rangeValid = (cin, cout, o) => {
        if (!cin || !cout || cin >= cout) return false;
        let d = parseIso(cin);
        const end = parseIso(cout);
        if (!d || !end) return false;
        let nights = 0;
        while (d < end) {
            if (nightBlocked(toIso(d), o)) return false;
            nights += 1;
            d.setDate(d.getDate() + 1);
        }
        return nights >= minNoches;
    };

    const inStrictStay = (iso, o) => o.reservas.some((r) => r.checkIn < iso && iso < r.checkOut);

    const pushInputs = () => {
        fechaIn.value = checkIn || '';
        fechaOut.value = checkOut || '';
        if (checkIn && !checkOut) fechaOut.value = '';
    };

    const recalc = () => {
        if (typeof window.__bookingRecalcPrice === 'function') window.__bookingRecalcPrice();
    };

    const mobileHeader = document.getElementById('pbc-mobile-header');
    const expandBtn = document.getElementById('pbc-expand-mobile');
    const closeBtn = document.getElementById('pbc-close-mobile');
    let pbcMobileOpen = false;

    const setPbcMobileOpen = (open) => {
        pbcMobileOpen = !!open;
        section.classList.toggle('pbc-is-open', pbcMobileOpen);
        if (window.matchMedia('(max-width: 1023px)').matches) {
            document.body.classList.toggle('pbc-noscroll', pbcMobileOpen);
        } else {
            document.body.classList.remove('pbc-noscroll');
        }
        if (mobileHeader) {
            mobileHeader.classList.toggle('hidden', !pbcMobileOpen);
            mobileHeader.classList.toggle('flex', pbcMobileOpen);
        }
        if (pbcMobileOpen) section.scrollTop = 0;
    };

    expandBtn?.addEventListener('click', () => setPbcMobileOpen(true));
    closeBtn?.addEventListener('click', () => setPbcMobileOpen(false));
    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && pbcMobileOpen) setPbcMobileOpen(false);
    });
    window.addEventListener('resize', () => {
        if (window.matchMedia('(min-width: 1024px)').matches) {
            if (pbcMobileOpen) setPbcMobileOpen(false);
            document.body.classList.remove('pbc-noscroll');
        }
    });

    window.__pbcOpenMobile = () => {
        if (window.matchMedia('(max-width: 1023px)').matches) setPbcMobileOpen(true);
        else section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const showErr = (msg) => {
        if (!elError) return;
        if (!msg) {
            elError.classList.add('hidden');
            elError.textContent = '';
            return;
        }
        elError.textContent = msg;
        elError.classList.remove('hidden');
    };

    const fetchOcc = async () => {
        const gen = ++fetchGen;
        const from = toIso(leftMonth);
        const endM = addMonths(leftMonth, 1);
        const y = endM.getFullYear();
        const m = endM.getMonth();
        const to = toIso(endOfMonth(y, m));
        if (elLoading) elLoading.classList.remove('hidden');
        showErr('');
        try {
            const u = `/propiedad/${encodeURIComponent(propiedadId)}/calendario-ocupacion?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
            const res = await fetch(u, { credentials: 'same-origin' });
            const data = await res.json().catch(() => ({}));
            if (gen !== fetchGen) return;
            if (!res.ok) throw new Error(data.error || 'No se pudo cargar la disponibilidad.');
            occ = {
                reservas: Array.isArray(data.reservas) ? data.reservas : [],
                bloqueos: Array.isArray(data.bloqueos) ? data.bloqueos : [],
            };
            nightlyMap = new Map(
                (Array.isArray(data.nightly) ? data.nightly : [])
                    .filter((n) => n && n.date && Number(n.amount) > 0)
                    .map((n) => [n.date, Number(n.amount)])
            );
            calCurrency = data.currency === 'USD' ? 'USD' : 'CLP';
            calDolar = typeof data.valorDolarDia === 'number' && data.valorDolarDia > 0 ? data.valorDolarDia : null;
        } catch (e) {
            if (gen !== fetchGen) return;
            console.error(e);
            occ = { reservas: [], bloqueos: [] };
            nightlyMap = new Map();
            calCurrency = 'CLP';
            calDolar = null;
            showErr(e.message || 'Error al cargar disponibilidad.');
        } finally {
            if (gen === fetchGen && elLoading) elLoading.classList.add('hidden');
        }
        scheduleRender();
    };

    const cellDisabled = (iso) => {
        if (iso < todayIso()) return true;
        if (!checkIn || checkOut) {
            return !checkInAllowed(iso, occ);
        }
        if (iso <= checkIn) return !checkInAllowed(iso, occ);
        return !rangeValid(checkIn, iso, occ);
    };

    const inPreviewRange = (iso) => {
        if (!checkIn || checkOut || !hoverIso) return false;
        if (hoverIso <= checkIn) return false;
        if (!rangeValid(checkIn, hoverIso, occ)) return false;
        return iso > checkIn && iso < hoverIso;
    };

    const inSelectedRange = (iso) => {
        if (!checkIn || !checkOut) return false;
        return iso > checkIn && iso < checkOut;
    };

    const cellPriceParts = (iso) => {
        if (iso < todayIso()) return { line: '', title: '' };
        if (nightBlocked(iso, occ)) return { line: '', title: '' };
        const amt = nightlyMap.get(iso);
        if (amt == null || !(amt > 0)) return { line: '', title: '' };
        if (calCurrency === 'USD') {
            const line = `US$${Math.round(amt).toLocaleString('es-CL')}`;
            let title = '';
            if (calDolar) title = `≈ $${Math.round(amt * calDolar).toLocaleString('es-CL')} CLP`;
            return { line, title };
        }
        return { line: `$${Math.round(amt).toLocaleString('es-CL')}`, title: '' };
    };

    const renderMonth = (gridEl, labelEl, year, month) => {
        if (!gridEl || !labelEl) return;
        labelEl.textContent = `${MONTH_NAMES[month]} ${year}`;
        gridEl.innerHTML = '';
        const first = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0).getDate();
        const offset = (first.getDay() + 6) % 7;
        const t0 = todayIso();

        for (let i = 0; i < offset; i += 1) {
            const ph = document.createElement('div');
            gridEl.appendChild(ph);
        }

        for (let day = 1; day <= lastDay; day += 1) {
            const d = new Date(year, month, day);
            const iso = toIso(d);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.pbcDate = iso;
            const { line: priceLine, title: priceTitle } = cellPriceParts(iso);
            if (priceTitle) btn.title = priceTitle;

            let cls =
                'relative min-h-[3.35rem] rounded-xl text-sm font-medium transition-colors text-center '
                + 'flex flex-col items-center justify-center gap-0 leading-tight py-1 px-0.5 '
                + 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1';

            const disabled = cellDisabled(iso);
            const stayMid = inStrictStay(iso, occ);

            if (disabled) {
                btn.disabled = true;
                cls += ' cursor-not-allowed';
                if (iso < t0) cls += ' text-gray-300 line-through decoration-gray-300';
                else if (stayMid || nightBlocked(iso, occ)) cls += ' bg-gray-100 text-gray-400';
                else cls += ' text-gray-300';
            } else {
                cls += ' text-gray-900 hover:bg-gray-100 cursor-pointer';
            }

            if (inSelectedRange(iso) || inPreviewRange(iso)) cls += ' bg-primary-50';
            if (checkIn && iso === checkIn) cls += ' ring-2 ring-gray-900 ring-inset font-semibold bg-white z-[1]';
            if (checkOut && iso === checkOut) cls += ' ring-2 ring-gray-900 ring-inset font-semibold bg-white z-[1]';
            if (iso === t0 && !btn.disabled) cls += ' border border-primary-300';

            btn.className = cls;
            const dayEl = document.createElement('span');
            dayEl.textContent = String(day);
            dayEl.className = 'tabular-nums';
            btn.appendChild(dayEl);
            if (priceLine) {
                const pEl = document.createElement('span');
                pEl.textContent = priceLine;
                pEl.className = btn.disabled
                    ? 'text-[10px] font-normal text-gray-400 max-w-[3.5rem] truncate leading-tight'
                    : 'text-[10px] font-normal text-gray-600 max-w-[3.5rem] truncate leading-tight';
                btn.appendChild(pEl);
            }
            gridEl.appendChild(btn);
        }
    };

    const render = () => {
        const y0 = leftMonth.getFullYear();
        const m0 = leftMonth.getMonth();
        const d1 = addMonths(leftMonth, 1);
        const y1 = d1.getFullYear();
        const m1 = d1.getMonth();
        renderMonth(elGrid0, elLabel0, y0, m0);
        renderMonth(elGrid1, elLabel1, y1, m1);

        if (btnPrev) {
            const minM = monthStartMin();
            btnPrev.disabled = leftMonth <= minM;
            btnPrev.classList.toggle('opacity-40', btnPrev.disabled);
            btnPrev.classList.toggle('cursor-not-allowed', btnPrev.disabled);
        }
    };

    const scheduleRender = () => {
        if (rafRender) cancelAnimationFrame(rafRender);
        rafRender = requestAnimationFrame(() => {
            rafRender = null;
            render();
        });
    };

    const onCellClick = (iso) => {
        if (!iso || cellDisabled(iso)) return;

        const cin0 = checkIn;
        const cout0 = checkOut;

        if (!cin0 || cout0) {
            checkIn = iso;
            checkOut = null;
        } else if (iso <= cin0) {
            checkIn = iso;
            checkOut = null;
        } else {
            checkOut = iso;
        }

        const justCompleted = !!(checkIn && checkOut);

        pushInputs();
        recalc();
        scheduleRender();
        if (justCompleted && pbcMobileOpen) setPbcMobileOpen(false);
    };

    btnClear?.addEventListener('click', () => {
        checkIn = null;
        checkOut = null;
        hoverIso = null;
        pushInputs();
        recalc();
        scheduleRender();
    });

    btnPrev?.addEventListener('click', () => {
        const minM = monthStartMin();
        const prev = addMonths(leftMonth, -1);
        if (prev >= minM) {
            leftMonth = prev;
            hoverIso = null;
            fetchOcc();
        }
    });

    btnNext?.addEventListener('click', () => {
        leftMonth = addMonths(leftMonth, 1);
        hoverIso = null;
        fetchOcc();
    });

    section.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-pbc-date]');
        if (!btn || btn.disabled) return;
        onCellClick(btn.dataset.pbcDate);
    });

    section.addEventListener('mouseover', (ev) => {
        const btn = ev.target.closest('[data-pbc-date]');
        if (!btn || btn.disabled) {
            if (hoverIso !== null) {
                hoverIso = null;
                scheduleRender();
            }
            return;
        }
        const iso = btn.dataset.pbcDate;
        if (iso !== hoverIso) {
            hoverIso = iso;
            scheduleRender();
        }
    });

    section.addEventListener('mouseleave', () => {
        if (hoverIso !== null) {
            hoverIso = null;
            scheduleRender();
        }
    });

    syncFromInputs();
    render();
    fetchOcc();
});
