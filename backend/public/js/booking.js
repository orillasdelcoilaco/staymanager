// backend/public/js/booking.js

document.addEventListener('DOMContentLoaded', () => {
    const widgetContainer = document.getElementById('booking-widget-container');
    const lang = window.StayWebI18n?.getLang ? window.StayWebI18n.getLang() : (String(document.documentElement.lang || 'es').toLowerCase().startsWith('en') ? 'en' : 'es');
    const locale = window.StayWebI18n?.getLocale ? window.StayWebI18n.getLocale(lang) : (lang === 'en' ? 'en-US' : 'es-CL');
    const i18n = window.StayWebI18n?.dictionaries?.bookingWidget || {};
    const t = window.StayWebI18n?.createTranslator
        ? window.StayWebI18n.createTranslator(i18n, lang)
        : ((key, ...args) => {
            const msg = i18n[lang]?.[key] ?? i18n.es[key];
            return typeof msg === 'function' ? msg(...args) : msg;
        });
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
        if (priceDisplay) priceDisplay.innerHTML = `<span class="text-danger-600 font-bold">${t('loadError')}</span>`;
        return;
    }

    const {
        propiedadId,
        defaultPrice,
        minNoches: minNochesRaw,
        depositoActivo: depositoActivoRaw,
        depositoTipo: depositoTipoRaw,
        depositoPorcentaje: depositoPorcentajeRaw,
        depositoMontoSugeridoCLP: depositoMontoSugeridoCLPRaw,
    } = configData;
    const depositoActivo = depositoActivoRaw !== false;
    const depositoTipo = depositoTipoRaw === 'monto_fijo' ? 'monto_fijo' : 'porcentaje';
    const depositoPorcentaje = Math.min(100, Math.max(1, parseInt(String(depositoPorcentajeRaw ?? 10), 10) || 10));
    const depositoMontoSugeridoCLP = Math.max(0, parseInt(String(depositoMontoSugeridoCLPRaw ?? 0), 10) || 0);
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
    const bookingMinNochesHint = document.getElementById('booking-minnoches-hint');
    const priceAbonoLabel = document.getElementById('price-abono-label');
    const priceSaldoPctLabel = document.getElementById('price-saldo-pct-label');
    const otaComparatorCard = document.getElementById('ota-comparator-card');
    const otaComparatorSummary = document.getElementById('ota-comparator-summary');
    const otaComparatorChannels = document.getElementById('ota-comparator-channels');
    const otaComparatorBadge = document.getElementById('ota-comparator-badge');
    const otaComparatorLegal = document.getElementById('ota-comparator-legal');
    const otaComparatorCanalSelect = document.getElementById('ota-comparator-canal-select');
    let otaCanalesLoaded = false;

    if (!fechaLlegadaInput || !fechaSalidaInput || !personasInput || !submitButton || !priceLoader || !bookingForm) {
        console.error('Error: Missing DOM elements in booking widget.');
        return;
    }

    let currentPriceCLP = defaultPriceData?.totalPriceCLP || null;
    let currentNights = defaultPriceData?.nights || 0;

    const formatCLP = (value) => `$${(Math.round(value || 0)).toLocaleString(locale)}`;
    const hideOtaComparator = () => {
        if (!otaComparatorCard) return;
        otaComparatorCard.classList.add('hidden');
        if (otaComparatorSummary) otaComparatorSummary.textContent = '';
        if (otaComparatorChannels) otaComparatorChannels.textContent = '';
        if (otaComparatorLegal) otaComparatorLegal.textContent = t('cmpFallback');
        if (otaComparatorBadge) otaComparatorBadge.classList.add('hidden');
    };
    const updateOtaComparator = (payload) => {
        if (!otaComparatorCard || !payload || payload.ok !== true || payload.comparableComplete !== true) {
            hideOtaComparator();
            return;
        }
        if (otaComparatorCanalSelect && Array.isArray(payload.canalesComparables) && !otaCanalesLoaded) {
            otaComparatorCanalSelect.innerHTML = payload.canalesComparables
                .map((c) => `<option value="${String(c.id || '')}">${String(c.nombre || t('channelLabel'))}</option>`)
                .join('');
            const exists = payload.canalesComparables.some((c) => String(c.id) === String(payload.canalComparado?.id || ''));
            if (exists) otaComparatorCanalSelect.value = String(payload.canalComparado?.id || '');
            otaCanalesLoaded = payload.canalesComparables.length > 0;
        } else if (otaComparatorCanalSelect && payload.canalComparado?.id && !otaComparatorCanalSelect.value) {
            otaComparatorCanalSelect.value = String(payload.canalComparado.id);
        }
        const ahorro = Number(payload.totales?.ahorroCLP || 0);
        const pct = payload.totales?.ahorroPctSobreComparado;
        const directo = Number(payload.totales?.directoCLP || 0);
        const comparado = Number(payload.totales?.comparadoCLP || 0);
        const nights = Number(payload.rango?.noches || 0);
        const canalDirecto = payload.canalDirecto?.nombre || t('channelDirect');
        const canalComparado = payload.canalComparado?.nombre || t('channelCompared');
        if (directo <= 0 || comparado <= 0 || nights <= 0) {
            hideOtaComparator();
            return;
        }

        if (otaComparatorSummary) {
            if (ahorro > 0) {
                const pctTxt = Number.isFinite(Number(pct)) ? ` (${pct}% menos)` : '';
                otaComparatorSummary.textContent = t('cmpSavings', formatCLP(directo), canalComparado, formatCLP(comparado), formatCLP(ahorro), pctTxt);
            } else if (ahorro === 0) {
                otaComparatorSummary.textContent = t('cmpSameTotal', formatCLP(directo));
            } else {
                otaComparatorSummary.textContent = t('cmpComparedLower', formatCLP(Math.abs(ahorro)));
            }
        }
        if (otaComparatorChannels) {
            otaComparatorChannels.textContent = t('cmpChannels', canalDirecto, canalComparado, nights);
        }
        if (otaComparatorLegal) {
            otaComparatorLegal.textContent = String(
                payload.legalCopy
                || payload.disclaimer
                || t('cmpFallback'),
            );
        }
        if (otaComparatorBadge) {
            if (ahorro > 0) otaComparatorBadge.classList.remove('hidden');
            else otaComparatorBadge.classList.add('hidden');
        }
        otaComparatorCard.classList.remove('hidden');
    };
    const refreshOtaComparator = async () => {
        if (!otaComparatorCard) return;
        const fechaLlegada = fechaLlegadaInput.value;
        const fechaSalida = fechaSalidaInput.value;
        if (!fechaLlegada || !fechaSalida || fechaSalida <= fechaLlegada) {
            hideOtaComparator();
            return;
        }
        try {
            const qs = new URLSearchParams({ fechaLlegada, fechaSalida });
            if (otaComparatorCanalSelect && otaComparatorCanalSelect.value) {
                qs.set('canalId', otaComparatorCanalSelect.value);
            }
            const response = await fetch(`/propiedad/${propiedadId}/comparador-ota.json?${qs.toString()}`);
            if (!response.ok) {
                hideOtaComparator();
                return;
            }
            const payload = await response.json();
            updateOtaComparator(payload);
        } catch (_e) {
            hideOtaComparator();
        }
    };
    if (otaComparatorCanalSelect) {
        otaComparatorCanalSelect.addEventListener('change', () => {
            refreshOtaComparator();
        });
    }
    const calculateDeposit = (total) => {
        const totalNum = Math.max(0, Math.round(Number(total) || 0));
        if (!depositoActivo) return 0;
        if (depositoTipo === 'monto_fijo') return Math.min(totalNum, depositoMontoSugeridoCLP);
        return Math.round(totalNum * (depositoPorcentaje / 100));
    };

    const formatDateHuman = (iso) => {
        if (!iso || typeof iso !== 'string') return '';
        const p = iso.split('-').map(Number);
        if (p.length !== 3 || !p[0]) return iso;
        const d = new Date(p[0], p[1] - 1, p[2]);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatDateShort = (iso) => {
        if (!iso || typeof iso !== 'string') return '';
        const p = iso.split('-').map(Number);
        if (p.length !== 3 || !p[0]) return iso;
        const d = new Date(p[0], p[1] - 1, p[2]);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
    };

    const updateDatesSummary = () => {
        const a = fechaLlegadaInput.value;
        const b = fechaSalidaInput.value;
        if (bookingDatesSummary) {
            if (a && b) bookingDatesSummary.textContent = `${formatDateHuman(a)} → ${formatDateHuman(b)}`;
            else if (a) bookingDatesSummary.textContent = t('checkInSummary', formatDateHuman(a));
            else bookingDatesSummary.textContent = '';
        }
        if (bookingMinNochesHint) {
            if (!a) {
                bookingMinNochesHint.textContent = '';
            } else {
                const effMin = typeof window.__pbcMinNochesEfectivas === 'function'
                    ? window.__pbcMinNochesEfectivas(a)
                    : minNoches;
                bookingMinNochesHint.textContent = t('minHint', formatDateShort(a), effMin);
            }
        }
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

            const abono = calculateDeposit(currentPriceCLP);
            const pxNoche = Math.round(currentPriceCLP / currentNights);
            const saldo = Math.max(0, currentPriceCLP - abono);
            const saldoPct = currentPriceCLP > 0 ? Math.round((saldo / currentPriceCLP) * 100) : 0;

            if (heroAbonoAmount) {
                heroAbonoAmount.textContent = depositoActivo ? formatCLP(abono) : t('noDeposit');
            }
            if (priceTotalDisplay) priceTotalDisplay.textContent = formatCLP(currentPriceCLP);
            if (priceLabelDisplay) {
                priceLabelDisplay.textContent = t('nightsLabel', currentNights);
            }
            if (priceDisplay) priceDisplay.classList.remove('hidden');

            if (priceBreakdownLines) {
                const nightsLabel = document.getElementById('price-nights-label');
                const nightsValue = document.getElementById('price-nights-value');
                const abonoValue = document.getElementById('price-abono-value');
                if (nightsLabel) {
                    nightsLabel.textContent = t('nightsBreakdown', formatCLP(pxNoche), currentNights);
                }
                if (nightsValue) nightsValue.textContent = formatCLP(currentPriceCLP);
                if (abonoValue) abonoValue.textContent = formatCLP(abono);
                if (priceRestoValue) priceRestoValue.textContent = formatCLP(saldo);
                if (priceAbonoLabel) {
                    priceAbonoLabel.textContent = depositoTipo === 'monto_fijo'
                        ? t('depositLabelFixed')
                        : t('depositLabelPct', depositoPorcentaje);
                }
                if (priceSaldoPctLabel) priceSaldoPctLabel.textContent = String(saldoPct);
            }

            if (priceUsdLine) {
                const isUsd =
                    priceData.currencyOriginal === 'USD'
                    && priceData.valorDolarDia > 0
                    && priceData.totalPriceOriginal != null;
                if (isUsd) {
                    const usd = Number(priceData.totalPriceOriginal);
                    const tc = Math.round(priceData.valorDolarDia);
                    priceUsdLine.textContent = t(
                        'usdRef',
                        usd.toLocaleString(locale, { maximumFractionDigits: 0 }),
                        tc.toLocaleString(locale),
                    );
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
            if (heroAbonoAmount) heroAbonoAmount.textContent = noDisp ? t('notAvailable') : t('chooseDates');
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
            hideOtaComparator();
            if (fechaLlegada && fechaLlegada < today) fechaLlegadaInput.value = today;
            if (fechaSalida && fechaSalida <= fechaLlegada) fechaSalidaInput.value = '';
            updateDatesSummary();
            return;
        }

        if (fechaLlegada < today) fechaLlegadaInput.value = today;

        const effMinNoches = typeof window.__pbcMinNochesEfectivas === 'function'
            ? window.__pbcMinNochesEfectivas(fechaLlegadaInput.value)
            : minNoches;
        const minSalida = addDaysLocalIso(fechaLlegadaInput.value, effMinNoches);
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
            if (!response.ok) throw new Error(data.error || t('priceCalcError'));
            updatePriceDisplay(data);
            await refreshOtaComparator();
        } catch (error) {
            console.error('Error calculando precio:', error);
            updatePriceDisplay(null);
            hideOtaComparator();
            if (heroAbonoAmount) heroAbonoAmount.textContent = t('genericError');
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
        refreshOtaComparator();
    } else if (fechaLlegadaInput.value && fechaSalidaInput.value) {
        calculatePriceAJAX();
    } else {
        submitButton.disabled = true;
        if (heroAbonoAmount) heroAbonoAmount.textContent = t('chooseDates');
        hideOtaComparator();
    }

    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const personas = parseInt(personasInput.value, 10);
        const capacidadMax = parseInt(personasInput.max, 10);

        if (currentPriceCLP === null || currentNights <= 0) {
            alert(t('selectValidDates'));
            return;
        }
        const nightsSel = countNightsBetween(fechaLlegadaInput.value, fechaSalidaInput.value);
        const effMinSubmit = typeof window.__pbcMinNochesEfectivas === 'function'
            ? window.__pbcMinNochesEfectivas(fechaLlegadaInput.value)
            : minNoches;
        if (nightsSel < effMinSubmit) {
            alert(t('minStayAlert', effMinSubmit));
            return;
        }
        if (Number.isNaN(personas) || personas <= 0) {
            alert(t('guestsRequired'));
            return;
        }
        if (personas > capacidadMax) {
            alert(t('guestsExceeded', personas, capacidadMax));
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = t('processing');

        const params = new URLSearchParams({
            propiedadId,
            fechaLlegada: fechaLlegadaInput.value,
            fechaSalida: fechaSalidaInput.value,
            personas: String(personas),
            noches: String(currentNights),
            precioFinal: String(currentPriceCLP),
        });

        const ext = typeof window.PUBLIC_BOOKING_BASE_URL === 'string' ? window.PUBLIC_BOOKING_BASE_URL.trim() : '';
        const extValidoParaReserva = ext && /\/reservar(?:[/?#]|$)/i.test(ext);
        if (extValidoParaReserva) {
            const join = ext.includes('?') ? '&' : '?';
            window.location.href = `${ext}${join}${params.toString()}`;
        } else {
            window.location.href = `/reservar?${params.toString()}`;
        }
    });
});
