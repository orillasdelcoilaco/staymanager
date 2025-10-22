// backend/public/js/booking.js

document.addEventListener('DOMContentLoaded', () => {
    // *** CORRECCIÓN: Leer datos desde data-* attributes ***
    const scriptTag = document.getElementById('booking-script');
    if (!scriptTag) {
        console.error("Error: No se encontró el tag <script id='booking-script'>.");
        return;
    }
    
    const propiedadId = scriptTag.dataset.propiedadId;
    let defaultPriceData = null;
    try {
        // Decodificar el JSON string
        const decodedPriceString = scriptTag.dataset.defaultPrice.replace(/&quot;/g, '"');
        defaultPriceData = JSON.parse(decodedPriceString);
    } catch (e) {
        console.error("Error parsing default price data:", e);
        defaultPriceData = { totalPriceCLP: 0, nights: 0, formattedTotalPrice: 'Error' }; // Fallback
    }
    // *** FIN CORRECCIÓN ***

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

    let currentPriceCLP = defaultPriceData?.totalPriceCLP || null;
    let currentNights = defaultPriceData?.nights || 0;

    // Función para formatear CLP
    const formatCLP = (value) => `$${(Math.round(value || 0)).toLocaleString('es-CL')} CLP`;

    // Función para actualizar la UI del precio
    const updatePriceDisplay = (priceData) => {
        if (priceData && priceData.totalPrice !== undefined && priceData.numNoches !== undefined) {
            currentPriceCLP = priceData.totalPrice;
            currentNights = priceData.numNoches;
            priceTotalDisplay.textContent = priceData.formattedTotalPrice;
            priceLabelDisplay.textContent = ` / por ${currentNights} noche${currentNights !== 1 ? 's' : ''}`;
            priceDisplay.classList.remove('hidden');
            submitButton.disabled = false;
        } else {
            currentPriceCLP = null;
            currentNights = 0;
            priceTotalDisplay.textContent = 'No disponible';
            priceLabelDisplay.textContent = '';
            priceDisplay.classList.remove('hidden');
            submitButton.disabled = true;
        }
        priceLoader.classList.add('hidden');
    };

    // Función Principal: Calcular Precio (AJAX)
    const calculatePriceAJAX = async () => {
        const fechaLlegada = fechaLlegadaInput.value;
        const fechaSalida = fechaSalidaInput.value;

        // Validaciones básicas
        const today = new Date().toISOString().split('T')[0];
        if (!fechaLlegada || !fechaSalida || fechaSalida <= fechaLlegada) {
             updatePriceDisplay(null);
             if (fechaLlegada && fechaLlegada < today) fechaLlegadaInput.value = today;
             if (fechaSalida && fechaSalida <= fechaLlegada) fechaSalidaInput.value = '';
            return;
        }
        
        if (fechaLlegada < today) {
            fechaLlegadaInput.value = today;
            return; // Detener cálculo si la fecha de llegada era inválida
        }

        const nextDay = new Date(new Date(fechaLlegada).getTime() + 86400000).toISOString().split('T')[0];
        if (fechaSalidaInput.min !== nextDay) {
            fechaSalidaInput.min = nextDay;
        }
        if (fechaSalidaInput.value <= fechaLlegadaInput.value) {
            fechaSalidaInput.value = nextDay;
        }

        priceLoader.classList.remove('hidden');
        priceDisplay.classList.add('hidden');
        submitButton.disabled = true;

        try {
            const response = await fetch(`/api/propiedad/${propiedadId}/calcular-precio`, {
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
            priceDisplay.classList.remove('hidden');
        }
    };

    // Event Listeners
    fechaLlegadaInput.addEventListener('change', calculatePriceAJAX);
    fechaSalidaInput.addEventListener('change', calculatePriceAJAX);

    // Inicialización
    fechaLlegadaInput.min = new Date().toISOString().split('T')[0];
    if (defaultPriceData && defaultPriceData.totalPriceCLP > 0) {
        submitButton.disabled = false;
    } else if (fechaLlegadaInput.value && fechaSalidaInput.value && personasInput.value) {
        calculatePriceAJAX();
    }


    // Handle form submission
    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const personas = parseInt(personasInput.value, 10);
        const capacidadMax = parseInt(personasInput.max, 10);

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

        window.location.href = `/reservar?${params.toString()}`;
    });
});