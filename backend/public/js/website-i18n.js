(function initStayWebI18n() {
    const getLang = () => (String(document.documentElement.lang || 'es').toLowerCase().startsWith('en') ? 'en' : 'es');
    const getLocale = (lang) => (lang === 'en' ? 'en-US' : 'es-CL');

    const createTranslator = (dictionary, lang) => {
        const resolvedLang = lang || getLang();
        return (key, ...args) => {
            const msg = dictionary?.[resolvedLang]?.[key] ?? dictionary?.es?.[key];
            return typeof msg === 'function' ? msg(...args) : msg;
        };
    };

    const dictionaries = {
        bookingWidget: {
            es: {
                loadError: 'Error al cargar',
                cmpFallback: 'Comparación referencial para estas fechas.',
                channelLabel: 'Canal',
                channelDirect: 'Canal directo',
                channelCompared: 'Canal comparado',
                cmpSavings: (directo, canalComparado, comparado, ahorro, pctTxt) => `Directo ${directo} vs ${canalComparado} ${comparado}. Ahorras ${ahorro}${pctTxt}.`,
                cmpSameTotal: (directo) => `Mismo total para estas fechas: ${directo}.`,
                cmpComparedLower: (delta) => `Para estas fechas, el canal comparado está ${delta} por debajo.`,
                cmpChannels: (canalDirecto, canalComparado, nights) => `${canalDirecto} vs ${canalComparado} · ${nights} noche${nights !== 1 ? 's' : ''}`,
                checkInSummary: (a) => `Entrada: ${a} — selecciona una salida`,
                minHint: (date, effMin) => `Para llegada el ${date}, mínimo ${effMin} noche${effMin !== 1 ? 's' : ''}.`,
                noDeposit: 'Sin abono',
                nightsLabel: (n) => `(${n} noche${n !== 1 ? 's' : ''})`,
                nightsBreakdown: (px, n) => `${px} × ${n} noche${n !== 1 ? 's' : ''}`,
                depositLabelFixed: 'Abono para reservar (monto fijo)',
                depositLabelPct: (pct) => `Abono para reservar (${pct}%)`,
                usdRef: (usd, tc) => `Referencia: ~${usd} USD × $${tc} CLP/USD`,
                notAvailable: 'No disponible',
                chooseDates: 'Elige fechas',
                priceCalcError: 'No se pudo calcular el precio.',
                genericError: 'Error',
                selectValidDates: 'Por favor, selecciona fechas válidas para calcular el precio antes de reservar.',
                minStayAlert: (n) => `La estadía mínima es de ${n} noche(s).`,
                guestsRequired: 'Por favor, indica cuántos huéspedes serán.',
                guestsExceeded: (p, max) => `El número de huéspedes (${p}) excede la capacidad máxima (${max}).`,
                processing: 'Procesando...',
            },
            en: {
                loadError: 'Load error',
                cmpFallback: 'Reference comparison for selected dates.',
                channelLabel: 'Channel',
                channelDirect: 'Direct channel',
                channelCompared: 'Compared channel',
                cmpSavings: (directo, canalComparado, comparado, ahorro, pctTxt) => `Direct ${directo} vs ${canalComparado} ${comparado}. You save ${ahorro}${pctTxt}.`,
                cmpSameTotal: (directo) => `Same total for selected dates: ${directo}.`,
                cmpComparedLower: (delta) => `For selected dates, compared channel is ${delta} lower.`,
                cmpChannels: (canalDirecto, canalComparado, nights) => `${canalDirecto} vs ${canalComparado} · ${nights} night${nights !== 1 ? 's' : ''}`,
                checkInSummary: (a) => `Check-in: ${a} — select check-out`,
                minHint: (date, effMin) => `For check-in on ${date}, minimum ${effMin} night${effMin !== 1 ? 's' : ''}.`,
                noDeposit: 'No deposit',
                nightsLabel: (n) => `(${n} night${n !== 1 ? 's' : ''})`,
                nightsBreakdown: (px, n) => `${px} × ${n} night${n !== 1 ? 's' : ''}`,
                depositLabelFixed: 'Deposit to book (fixed amount)',
                depositLabelPct: (pct) => `Deposit to book (${pct}%)`,
                usdRef: (usd, tc) => `Reference: ~${usd} USD × $${tc} CLP/USD`,
                notAvailable: 'Not available',
                chooseDates: 'Choose dates',
                priceCalcError: 'Could not calculate price.',
                genericError: 'Error',
                selectValidDates: 'Please select valid dates to calculate price before booking.',
                minStayAlert: (n) => `Minimum stay is ${n} night(s).`,
                guestsRequired: 'Please indicate number of guests.',
                guestsExceeded: (p, max) => `Guest count (${p}) exceeds maximum capacity (${max}).`,
                processing: 'Processing...',
            },
        },
        checkout: {
            es: {
                processingFallback: 'Procesando reserva...',
                phoneInvalid: 'El teléfono debe tener formato +56912345678.',
                rutInvalid: 'El RUT debe tener formato 12345678-9 (sin puntos) y dígito verificador válido.',
                genericError: 'No se pudo completar la reserva.',
                successRedirecting: 'Reserva creada. Redirigiendo a confirmación...',
                detailPrefix: 'Detalle',
                errorPrefix: 'Error',
                minimo_noches: 'La estadía seleccionada no cumple el mínimo de noches para esa fecha de llegada.',
                dia_llegada_no_permitido: 'La llegada no está permitida para ese día de la semana. Elige otra fecha.',
                anticipacion_minima: 'La llegada requiere más anticipación. Elige una fecha más adelante.',
                ventana_reserva_meses: 'La fecha de llegada está fuera de la ventana máxima de reserva.',
                maximo_noches: 'La estadía supera el máximo de noches permitido.',
                fechas_invalidas: 'Las fechas de la reserva no son válidas. Revisa llegada y salida.',
                precio_desalineado: 'El precio cambió mientras reservabas. Revisa el total y vuelve a confirmar.',
                terminos_no_aceptados: 'Debes aceptar los términos y condiciones para completar tu reserva.',
                telefono_invalido: 'El teléfono no es válido. Usa formato +56912345678.',
                rut_invalido: 'El RUT no es válido. Usa formato 12345678-9, sin puntos.',
            },
            en: {
                processingFallback: 'Processing booking...',
                phoneInvalid: 'Phone number must use format +56912345678.',
                rutInvalid: 'RUT must use format 12345678-9 (no dots) and a valid check digit.',
                genericError: 'Could not complete the booking.',
                successRedirecting: 'Booking created. Redirecting to confirmation...',
                detailPrefix: 'Details',
                errorPrefix: 'Error',
                minimo_noches: 'Selected stay does not meet the minimum nights required for this check-in date.',
                dia_llegada_no_permitido: 'Check-in is not allowed on that weekday. Please choose another date.',
                anticipacion_minima: 'This check-in requires more advance notice. Please choose a later date.',
                ventana_reserva_meses: 'Check-in date is outside the maximum booking window.',
                maximo_noches: 'The stay exceeds the maximum nights allowed.',
                fechas_invalidas: 'Booking dates are invalid. Please review check-in and check-out.',
                precio_desalineado: 'Price changed while you were booking. Please review total and confirm again.',
                terminos_no_aceptados: 'You must accept terms and conditions to complete your booking.',
                telefono_invalido: 'Phone number is invalid. Use format +56912345678.',
                rut_invalido: 'RUT is invalid. Use format 12345678-9 without dots.',
            },
        },
    };

    window.StayWebI18n = {
        getLang,
        getLocale,
        createTranslator,
        dictionaries,
    };
}());
