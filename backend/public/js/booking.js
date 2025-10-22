// backend/public/js/booking.js

document.addEventListener('DOMContentLoaded', () => {
    // Leer datos iniciales pasados desde EJS
    const propiedadId = window.initialBookingData.propiedadId;
    const defaultPriceData = window.initialBookingData.defaultPrice;

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

    let currentPriceCLP = defaultPriceData.totalPriceCLP || null; // Almacenar el último precio calculado en CLP
    let currentNights = defaultPriceData.nights || 0;

    // Función para formatear CLP
    const formatCLP = (value) => `$${(Math.round(value || 0)).toLocaleString('es-CL')} CLP`;

    // Función para actualizar la UI del precio
    const updatePriceDisplay = (priceData) => {
        if (priceData && priceData.totalPrice !== undefined && priceData.numNoches !== undefined) {
            currentPriceCLP = priceData.totalPrice;
            currentNights = priceData.numNoches;
            priceTotalDisplay.textContent = priceData.formattedTotalPrice; // Usar el string formateado de la API
            priceLabelDisplay.textContent = ` / por ${currentNights} noche${currentNights !== 1 ? 's' : ''}`;
            priceDisplay.classList.remove('hidden');
            submitButton.disabled = false;
        } else {
            currentPriceCLP = null;
            currentNights = 0;
            priceTotalDisplay.textContent = 'No disponible';
            priceLabelDisplay.textContent = '';
            priceDisplay.classList.remove('hidden'); // Mostrar "No disponible"
            submitButton.disabled = true;
        }
        priceLoader.classList.add('hidden'); // Siempre ocultar loader al final
    };

    // Función Principal: Calcular Precio (AJAX)
    const calculatePriceAJAX = async () => {
        const fechaLlegada = fechaLlegadaInput.value;
        const fechaSalida = fechaSalidaInput.value;

        // Validaciones básicas
        const today = new Date().toISOString().split('T')[0];
        if (!fechaLlegada || !fechaSalida || fechaSalida <= fechaLlegada) {
            updatePriceDisplay(null); // Borrar precio si las fechas son inválidas
            if (fechaLlegada && fechaLlegada < today) fechaLlegadaInput.value = today; // Corregir si la fecha es pasada
            if (fechaSalida && fechaSalida <= fechaLlegada) fechaSalidaInput.value = ''; // Limpiar salida si es inválida
            return;
        }

        // Actualizar mínima fecha de salida
        const nextDay = new Date(new Date(fechaLlegada).getTime() + 86400000).toISOString().split('T')[0];
        if (fechaSalidaInput.min !== nextDay) {
            fechaSalidaInput.min = nextDay;
        }
        if (fechaSalidaInput.value <= fechaLlegadaInput.value) {
            fechaSalidaInput.value = nextDay; // Auto-seleccionar el día siguiente si es necesario
        }

        // Mostrar loader y deshabilitar botón mientras se calcula
        priceLoader.classList.remove('hidden');
        priceDisplay.classList.add('hidden'); // Ocultar precio anterior
        submitButton.disabled = true;

        try {
            // Llamar a la API interna
            const response = await fetch(`/api/propiedad/${propiedadId}/calcular-precio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechaLlegada, fechaSalida }) // Enviar solo fechas
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'No se pudo calcular el precio.');
            }

            // Usar la respuesta formateada de la API
            updatePriceDisplay(data);

        } catch (error) {
            console.error('Error calculando precio AJAX:', error);
            updatePriceDisplay(null);
            priceTotalDisplay.textContent = 'Error';
            priceDisplay.classList.remove('hidden');
        }
    };

    // Event Listeners para cambios en las fechas
    fechaLlegadaInput.addEventListener('change', calculatePriceAJAX);
    fechaSalidaInput.addEventListener('change', calculatePriceAJAX);
    
    // Validar fecha mínima de llegada al cargar
    fechaLlegadaInput.min = new Date().toISOString().split('T')[0];

    // Inicialización: Mostrar precio por defecto del finde (ya está en el HTML)
    // y habilitar el botón si el precio es válido
    if (defaultPriceData.totalPriceCLP > 0) {
        submitButton.disabled = false;
    } else if (fechaLlegadaInput.value && fechaSalidaInput.value && personasInput.value) {
        // Si no hubo precio default pero las fechas están pre-llenadas (ej. deep link), calcular
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

        // Construir la URL para la página /reservar
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