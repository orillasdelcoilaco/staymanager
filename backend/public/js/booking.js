// backend/public/js/booking.js

document.addEventListener('DOMContentLoaded', () => {
    const DEPOSIT_PERCENTAGE = 0.10;

    const widgetContainer = document.getElementById('booking-widget-container');
    let configData = null;

    if (widgetContainer && widgetContainer.dataset.bookingConfig) {
        try {
            configData = JSON.parse(widgetContainer.dataset.bookingConfig);
        } catch (e) {
            console.error('Error parsing booking config:', e);
        }
    }

    if (!configData && window.initialBookingData) {
        configData = window.initialBookingData;
    }

    if (!configData) {
        console.error('Error: No booking config found.');
        const priceDisplay = document.getElementById('price-display');
        if (priceDisplay) priceDisplay.innerHTML = '<span class="text-danger-600 font-bold">Error al cargar</span>';
        return;
    }

    const { propiedadId, defaultPrice, minNoches: minNochesRaw } = configData;
    const minNoches = Math.max(1, parseInt(String(minNochesRaw ?? 1), 10) || 1);
    let defaultPriceData = defaultPrice || { totalPriceCLP: 0, nights: 0, formattedTotalPrice: '' };

    const addDaysLocalIso = (isoStr, daysToAdd) => {
        const p = String(isoStr || '').split('-').map(Number);
        if (p.length !== 3 || !p[0]) return '';
        const d = new Date(p[0], p[1] - 1, p[2]);
        d.setDate(d.getDate() + daysToAdd);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const countNightsBetween = (inStr, outStr) => {
        const p0 = String(inStr).split('-').map(Number);
        const p1 = String(outStr).split('-').map(Number);
        if (p0.length !== 3 || p1.length !== 3) return 0;
        const a = new Date(p0[0], p0[1] - 1, p0[2]);
        const b = new Date(p1[0], p1[1] - 1, p1[2]);
        const n = Math.round((b.getTime() - a.getTime()) / 86400000);
        return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const fechaLlegadaInput = document.getElementById('fechaLlegada');
    const fechaSalidaInput = document.getElementById('fechaSalida');
    const personasInput = document.getElementById('personas');
    const submitButton = document.getElementById('submit-button');
    const priceDisplay = document.getElementById('price-display');
    const priceTotalDisplay = document.getElementById('price-total-display');
    const priceLabelDisplay = document.getElementById('price-label-display');
    const priceLoader = document.getElementById('price-loader');
    const bookingForm = document.getElementById('booking-form');
    const weekendHint = document.getElementById('weekend-hint');
    const heroAbonoAmount = document.getElementById('hero-abono-amount');
    const priceBreakdownPlaceholder = document.getElementById('price-breakdown-placeholder');
    const priceBreakdownLines = document.getElementById('price-breakdown-lines');
    const priceUsdLine = document.getElementById('price-usd-line');
    const priceRestoValue = document.getElementById('price-resto-value');
    const bookingDatesSummary = document.getElementById('booking-dates-summary');

    if (!fechaLlegadaInput || !fechaSalidaInput || !personasInput || !submitButton || !priceLoader || !bookingForm) {
        console.error('Error: Missing DOM elements in booking widget.');
        return;
    }

    let currentPriceCLP = defaultPriceData?.totalPriceCLP || null;
    let currentNights = defaultPriceData?.nights || 0;

    const formatCLP = (value) => `$${(Math.round(value || 0)).toLocaleString('es-CL')}`;

    const formatDateHuman = (iso) => {
        if (!iso || typeof iso !== 'string') return '';
        const p = iso.split('-').map(Number);
        if (p.length !== 3 || !p[0]) return iso;
        const d = new Date(p[0], p[1] - 1, p[2]);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    const updateDatesSummary = () => {
        if (!bookingDatesSummary) return;
        const a = fechaLlegadaInput.value;
        const b = fechaSalidaInput.value;
        if (a && b) bookingDatesSummary.textContent = `${formatDateHuman(a)} → ${formatDateHuman(b)}`;
        else if (a) bookingDatesSummary.textContent = `Entrada: ${formatDateHuman(a)} — elige salida en el calendario`;
        else bookingDatesSummary.textContent = '';
    };

    const hideWeekendHint = () => {
        if (weekendHint) weekendHint.style.display = 'none';
    };

    const updatePriceDisplay = (priceData) => {
        const showLines = priceData && priceData.totalPrice > 0 && priceData.numNoches > 0;

        if (showLines) {
            currentPriceCLP = priceData.totalPrice;
            currentNights = priceData.numNoches;
            submitButton.disabled = false;

            const abono = Math.round(currentPriceCLP * DEPOSIT_PERCENTAGE);
            const pxNoche = Math.round(currentPriceCLP / currentNights);

            if (heroAbonoAmount) heroAbonoAmount.textContent = formatCLP(abono);
            if (priceTotalDisplay) priceTotalDisplay.textContent = formatCLP(currentPriceCLP);
            if (priceLabelDisplay) {
                priceLabelDisplay.textContent = `(${currentNights} noche${currentNights !== 1 ? 's' : ''})`;
            }
            if (priceDisplay) priceDisplay.classList.remove('hidden');

            if (priceBreakdownLines) {
                const nightsLabel = document.getElementById('price-nights-label');
                const nightsValue = document.getElementById('price-nights-value');
                const abonoValue = document.getElementById('price-abono-value');
                if (nightsLabel) {
                    nightsLabel.textContent = `${formatCLP(pxNoche)} × ${currentNights} noche${currentNights !== 1 ? 's' : ''}`;
                }
                if (nightsValue) nightsValue.textContent = formatCLP(currentPriceCLP);
                if (abonoValue) abonoValue.textContent = formatCLP(abono);
                if (priceRestoValue) priceRestoValue.textContent = formatCLP(Math.round(currentPriceCLP * (1 - DEPOSIT_PERCENTAGE)));
            }

            if (priceUsdLine) {
                const isUsd =
                    priceData.currencyOriginal === 'USD'
                    && priceData.valorDolarDia > 0
                    && priceData.totalPriceOriginal != null;
                if (isUsd) {
                    const usd = Number(priceData.totalPriceOriginal);
                    const tc = Math.round(priceData.valorDolarDia);
                    priceUsdLine.textContent = `Referencia: ~${usd.toLocaleString('es-CL', { maximumFractionDigits: 0 })} USD × $${tc.toLocaleString('es-CL')} CLP/USD`;
                    priceUsdLine.classList.remove('hidden');
                } else {
                    priceUsdLine.textContent = '';
                    priceUsdLine.classList.add('hidden');
                }
            }

            if (priceBreakdownPlaceholder) priceBreakdownPlaceholder.classList.add('hidden');
            if (priceBreakdownLines) priceBreakdownLines.classList.remove('hidden');
        } else {
            currentPriceCLP = null;
            currentNights = 0;
            submitButton.disabled = true;

            const noDisp = priceData && priceData.totalPrice === 0;
            if (heroAbonoAmount) heroAbonoAmount.textContent = noDisp ? 'No disponible' : 'Elige fechas';
            if (priceTotalDisplay) priceTotalDisplay.textContent = '';
            if (priceLabelDisplay) priceLabelDisplay.textContent = '';
            if (priceDisplay) priceDisplay.classList.add('hidden');
            if (priceUsdLine) {
                priceUsdLine.textContent = '';
                priceUsdLine.classList.add('hidden');
            }
            if (priceBreakdownPlaceholder) priceBreakdownPlaceholder.classList.remove('hidden');
            if (priceBreakdownLines) priceBreakdownLines.classList.add('hidden');
        }
        priceLoader.classList.add('hidden');
    };

    const calculatePriceAJAX = async () => {
        const fechaLlegada = fechaLlegadaInput.value;
        const fechaSalida = fechaSalidaInput.value;
        const today = new Date().toISOString().split('T')[0];

        if (!fechaLlegada || !fechaSalida || fechaSalida <= fechaLlegada) {
            updatePriceDisplay(null);
            if (fechaLlegada && fechaLlegada < today) fechaLlegadaInput.value = today;
            if (fechaSalida && fechaSalida <= fechaLlegada) fechaSalidaInput.value = '';
            updateDatesSummary();
            return;
        }

        if (fechaLlegada < today) fechaLlegadaInput.value = today;

        const minSalida = addDaysLocalIso(fechaLlegadaInput.value, minNoches);
        if (minSalida && fechaSalidaInput.min !== minSalida) fechaSalidaInput.min = minSalida;
        if (
            !fechaSalidaInput.value
            || fechaSalidaInput.value <= fechaLlegadaInput.value
            || (minSalida && fechaSalidaInput.value < minSalida)
        ) {
            if (minSalida) fechaSalidaInput.value = minSalida;
        }

        hideWeekendHint();
        priceLoader.classList.remove('hidden');
        if (priceDisplay) priceDisplay.classList.add('hidden');
        submitButton.disabled = true;
        if (heroAbonoAmount) heroAbonoAmount.textContent = '…';

        try {
            const response = await fetch(`/propiedad/${propiedadId}/calcular-precio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechaLlegada: fechaLlegadaInput.value, fechaSalida: fechaSalidaInput.value }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'No se pudo calcular el precio.');
            updatePriceDisplay(data);
        } catch (error) {
            console.error('Error calculando precio:', error);
            updatePriceDisplay(null);
            if (heroAbonoAmount) heroAbonoAmount.textContent = 'Error';
            priceLoader.classList.add('hidden');
        }
        updateDatesSummary();
        if (typeof window.__bookingCalendarSync === 'function') window.__bookingCalendarSync();
    };

    fechaLlegadaInput.addEventListener('change', calculatePriceAJAX);
    fechaSalidaInput.addEventListener('change', calculatePriceAJAX);

    fechaLlegadaInput.min = new Date().toISOString().split('T')[0];

    window.__bookingRecalcPrice = calculatePriceAJAX;

    updateDatesSummary();

    if (defaultPriceData && defaultPriceData.totalPriceCLP > 0) {
        updatePriceDisplay({
            totalPrice: defaultPriceData.totalPriceCLP,
            numNoches: defaultPriceData.nights,
            formattedTotalPrice: defaultPriceData.formattedTotalPrice,
            currencyOriginal: 'CLP',
        });
    } else if (fechaLlegadaInput.value && fechaSalidaInput.value) {
        calculatePriceAJAX();
    } else {
        submitButton.disabled = true;
        if (heroAbonoAmount) heroAbonoAmount.textContent = 'Elige fechas';
    }

    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const personas = parseInt(personasInput.value, 10);
        const capacidadMax = parseInt(personasInput.max, 10);

        if (currentPriceCLP === null || currentNights <= 0) {
            alert('Por favor, selecciona fechas válidas para calcular el precio antes de reservar.');
            return;
        }
        const nightsSel = countNightsBetween(fechaLlegadaInput.value, fechaSalidaInput.value);
        if (nightsSel < minNoches) {
            alert(`La estadía mínima es de ${minNoches} noche(s).`);
            return;
        }
        if (Number.isNaN(personas) || personas <= 0) {
            alert('Por favor, indica cuántos huéspedes serán.');
            return;
        }
        if (personas > capacidadMax) {
            alert(`El número de huéspedes (${personas}) excede la capacidad máxima (${capacidadMax}).`);
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Procesando...';

        const params = new URLSearchParams({
            propiedadId,
            fechaLlegada: fechaLlegadaInput.value,
            fechaSalida: fechaSalidaInput.value,
            personas: String(personas),
            noches: String(currentNights),
            precioFinal: String(currentPriceCLP),
        });

        const ext = typeof window.PUBLIC_BOOKING_BASE_URL === 'string' ? window.PUBLIC_BOOKING_BASE_URL.trim() : '';
        if (ext) {
            const join = ext.includes('?') ? '&' : '?';
            window.location.href = `${ext}${join}${params.toString()}`;
        } else {
            window.location.href = `/reservar?${params.toString()}`;
        }
    });
});
