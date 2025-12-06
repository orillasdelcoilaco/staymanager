// backend/public/js/booking.js

document.addEventListener('DOMContentLoaded', () => {
    // *** CAMBIO: Usar 10% de abono ***
    const DEPOSIT_PERCENTAGE = 0.10;

    // Intentar leer configuración desde el atributo de datos (Más robusto)
    const widgetContainer = document.getElementById('booking-widget-container');
    let configData = null;

    if (widgetContainer && widgetContainer.dataset.bookingConfig) {
        try {
            configData = JSON.parse(widgetContainer.dataset.bookingConfig);
            console.log("Booking configuration loaded from data attribute:", configData);
        } catch (e) {
            console.error("Error parsing booking config from data attribute:", e);
        }
    }

    // Fallback a variable global (Legacy/Backup)
    if (!configData && window.initialBookingData) {
        configData = window.initialBookingData;
        console.log("Booking configuration loaded from window global.");
    }

    if (!configData) {
        console.error("Error: No se encontraron los datos iniciales de booking (ni en data attr ni en window).");
        const priceDisplay = document.getElementById('price-display');
        if (priceDisplay) {
            priceDisplay.innerHTML = '<span class="text-red-500 font-bold">Error al cargar (B01)</span>';
        }
        return;
    }

    const { propiedadId, defaultPrice } = configData;
    let defaultPriceData = defaultPrice || { totalPriceCLP: 0, nights: 0, formattedTotalPrice: 'Error' };

    // Obtener elementos del DOM
    const fechaLlegadaInput = document.getElementById('fechaLlegada');
    const fechaSalidaInput = document.getElementById('fechaSalida');
    const personasInput = document.getElementById('personas');
    const submitButton = document.getElementById('submit-button');
    const priceDisplay = document.getElementById('price-display');
    const priceTotalDisplay = document.getElementById('price-total-display');
    const priceLabelDisplay = document.getElementById('price-label-display');
    const priceLoader = document.getElementById('price-loader');
    const bookingForm = document.getElementById('booking-form');
    const depositInfoEl = document.getElementById('deposit-info'); // Obtener div de abono

    if (!fechaLlegadaInput || !fechaSalidaInput || !personasInput || !submitButton || !priceTotalDisplay || !priceLabelDisplay || !priceLoader || !bookingForm || !depositInfoEl) {
        console.error("Error: Faltan elementos clave del DOM en el formulario de reserva (B02).");
        if (priceDisplay) priceDisplay.innerHTML = '<span class="text-red-500 font-bold">Error (B02)</span>';
        return;
    }

    let currentPriceCLP = defaultPriceData?.totalPriceCLP || null;
    let currentNights = defaultPriceData?.nights || 0;

    const formatCLP = (value) => `$${(Math.round(value || 0)).toLocaleString('es-CL')}`;

    // Función para actualizar la UI del precio
    const updatePriceDisplay = (priceData) => {
        if (priceData && priceData.totalPrice !== undefined && priceData.numNoches !== undefined && priceData.totalPrice > 0) {
            currentPriceCLP = priceData.totalPrice;
            currentNights = priceData.numNoches;
            priceTotalDisplay.textContent = priceData.formattedTotalPrice;
            priceLabelDisplay.textContent = ` / por ${currentNights} noche${currentNights !== 1 ? 's' : ''}`;
            priceDisplay.classList.remove('hidden');
            submitButton.disabled = false;

            // *** CAMBIO: Actualizar texto de abono (10%) ***
            const abono = currentPriceCLP * DEPOSIT_PERCENTAGE;
            depositInfoEl.innerHTML = `Reserva abonando solo <strong class="text-indigo-600">${formatCLP(abono)}</strong>`;
            // *** FIN CAMBIO ***

        } else {
            currentPriceCLP = null;
            currentNights = 0;
            priceTotalDisplay.textContent = 'No disponible';
            priceLabelDisplay.textContent = '';
            priceDisplay.classList.remove('hidden');
            submitButton.disabled = true;

            // *** CAMBIO: Actualizar texto de abono (Error/Default) ***
            if (priceData && priceData.totalPrice === 0) {
                depositInfoEl.innerHTML = 'Estadía no disponible para estas fechas.';
            } else {
                depositInfoEl.innerHTML = 'Ingresa tus fechas para ver el abono.';
            }
            // *** FIN CAMBIO ***
        }
        priceLoader.classList.add('hidden');
    };

    // Función Principal: Calcular Precio (AJAX)
    const calculatePriceAJAX = async () => {
        const fechaLlegada = fechaLlegadaInput.value;
        const fechaSalida = fechaSalidaInput.value;

        const today = new Date().toISOString().split('T')[0];
        if (!fechaLlegada || !fechaSalida || fechaSalida <= fechaLlegada) {
            updatePriceDisplay(null);
            if (fechaLlegada && fechaLlegada < today) fechaLlegadaInput.value = today;
            if (fechaSalida && fechaSalida <= fechaLlegada) fechaSalidaInput.value = '';
            return;
        }

        if (fechaLlegada < today) {
            fechaLlegadaInput.value = today;
        }

        const nextDay = new Date(new Date(fechaLlegadaInput.value).getTime() + 86400000).toISOString().split('T')[0];
        if (fechaSalidaInput.min !== nextDay) {
            fechaSalidaInput.min = nextDay;
        }
        if (fechaSalidaInput.value <= fechaLlegadaInput.value) {
            fechaSalidaInput.value = nextDay;
        }

        priceLoader.classList.remove('hidden');
        priceDisplay.classList.add('hidden');
        submitButton.disabled = true;
        depositInfoEl.textContent = 'Calculando abono...';

        try {
            const response = await fetch(`/propiedad/${propiedadId}/calcular-precio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechaLlegada: fechaLlegadaInput.value, fechaSalida: fechaSalidaInput.value })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'No se pudo calcular el precio.');
            }
            updatePriceDisplay(data);
        } catch (error) {
            console.error('Error calculando precio AJAX:', error);
            updatePriceDisplay(null);
            priceTotalDisplay.textContent = 'Error';
            priceLabelDisplay.textContent = `: ${error.message}`;
            priceDisplay.classList.remove('hidden');
            depositInfoEl.textContent = 'Error al calcular el precio.';
        }
    };

    // Event Listeners
    fechaLlegadaInput.addEventListener('change', calculatePriceAJAX);
    fechaSalidaInput.addEventListener('change', calculatePriceAJAX);

    // Inicialización: Mostrar abono inicial si hay precio default
    fechaLlegadaInput.min = new Date().toISOString().split('T')[0];
    if (defaultPriceData && defaultPriceData.totalPriceCLP > 0) {
        updatePriceDisplay({ // Llamar a updatePriceDisplay para calcular y mostrar abono inicial
            totalPrice: defaultPriceData.totalPriceCLP,
            numNoches: defaultPriceData.nights,
            formattedTotalPrice: defaultPriceData.formattedTotalPrice
        });
    } else if (fechaLlegadaInput.value && fechaSalidaInput.value && personasInput.value) {
        calculatePriceAJAX();
    } else {
        submitButton.disabled = true;
        depositInfoEl.innerHTML = 'Ingresa tus fechas para ver el abono.'; // Mensaje inicial
    }

    // Handle form submission
    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("Booking form submitted");

        const personas = parseInt(personasInput.value, 10);
        const capacidadMax = parseInt(personasInput.max, 10);

        console.log(`Personas: ${personas}, Capacidad: ${capacidadMax}, Price: ${currentPriceCLP}, Nights: ${currentNights}`);

        if (currentPriceCLP === null || currentNights <= 0) {
            alert('Por favor, selecciona fechas válidas para calcular el precio antes de reservar.');
            return;
        }
        if (isNaN(personas) || personas <= 0) {
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
            propiedadId: propiedadId,
            fechaLlegada: fechaLlegadaInput.value,
            fechaSalida: fechaSalidaInput.value,
            personas: personas,
            noches: currentNights,
            precioFinal: currentPriceCLP
        });

        const redirectUrl = `/reservar?${params.toString()}`;
        console.log(`Redirecting to: ${redirectUrl}`);
        window.location.href = redirectUrl;
    });
});