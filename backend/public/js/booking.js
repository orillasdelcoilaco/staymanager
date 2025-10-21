// backend/public/js/booking.js

// Esperar a que el contenido del DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    
    // Encontrar el script actual para leer los atributos data-*
    const scriptTag = document.querySelector('script[src="/public/js/booking.js"]');
    if (!scriptTag) {
        console.error("No se pudo encontrar el script tag de booking.js");
        return;
    }

    // Obtener datos pasados desde EJS
    const PROPIEDAD_ID = scriptTag.dataset.propiedadId;
    const PREFILL_LLEGADA = scriptTag.dataset.prefillLlegada;
    const PREFILL_SALIDA = scriptTag.dataset.prefillSalida;

    // Obtener elementos del DOM
    const form = document.getElementById('booking-form');
    const fechaLlegadaEl = document.getElementById('fechaLlegada');
    const fechaSalidaEl = document.getElementById('fechaSalida');
    const personasEl = document.getElementById('personas');
    const priceSummaryEl = document.getElementById('price-summary');
    const priceLoaderEl = document.getElementById('price-loader');
    const submitButton = document.getElementById('submit-button');
    
    // Elementos del resumen de precio
    const priceLabelEl = document.getElementById('price-label');
    const priceSubtotalEl = document.getElementById('price-subtotal');
    const priceTotalEl = document.getElementById('price-total');
    
    let currentPriceData = null; // Almacena el resultado del cálculo

    if (!form || !fechaLlegadaEl || !fechaSalidaEl || !personasEl || !priceSummaryEl || !priceLoaderEl || !submitButton) {
        console.error("Error: Faltan elementos clave del DOM para el formulario de reserva.");
        return;
    }

    // --- Función Principal: Calcular Precio ---
    async function calcularPrecio() {
        const fechaLlegada = fechaLlegadaEl.value;
        const fechaSalida = fechaSalidaEl.value;
        currentPriceData = null; // Resetear precio actual

        // Validaciones básicas de fecha
        const today = new Date().toISOString().split('T')[0];
        if (!fechaLlegada || !fechaSalida || fechaSalida <= fechaLlegada || fechaLlegada < today) {
            priceSummaryEl.classList.add('hidden');
            submitButton.disabled = true;
            if (fechaLlegada && fechaLlegada < today) fechaLlegadaEl.value = today;
            if (fechaSalida && fechaSalida <= fechaLlegada) fechaSalidaEl.value = '';
            return;
        }

        // Actualizar min de fechaSalida
        fechaSalidaEl.min = new Date(new Date(fechaLlegada).getTime() + 86400000).toISOString().split('T')[0];
        
        priceLoaderEl.classList.remove('hidden');
        priceSummaryEl.classList.add('hidden');
        submitButton.disabled = true;

        try {
            // Usar la ruta API interna que creamos en website.js
            const response = await fetch(`/propiedad/${PROPIEDAD_ID}/calcular-precio`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fechaLlegada, fechaSalida })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'No se pudo calcular el precio. Puede que no haya tarifas o disponibilidad.');
            }

            const data = await response.json();
            currentPriceData = data; // Guardar datos para el submit

            // Formatear moneda localmente
            const formatCLP = (value) => `$${Math.round(value || 0).toLocaleString('es-CL')}`;

            // Actualizar el DOM
            priceLabelEl.textContent = `${formatCLP(data.totalPriceCLP / data.nights)} x ${data.nights} noche(s)`;
            priceSubtotalEl.textContent = formatCLP(data.totalPriceCLP);
            priceTotalEl.textContent = formatCLP(data.totalPriceCLP);

            priceSummaryEl.classList.remove('hidden');
            submitButton.disabled = false; // Habilitar botón de reserva

        } catch (error) {
            console.error(error);
            alert(error.message);
            priceSummaryEl.classList.add('hidden');
            submitButton.disabled = true;
        } finally {
            priceLoaderEl.classList.add('hidden');
        }
    }

    // --- Event Listener para el Submit del Formulario ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentPriceData || !personasEl.value) {
            alert('Por favor, selecciona fechas válidas y el número de huéspedes.');
            return;
        }
        if (parseInt(personasEl.value, 10) > parseInt(personasEl.max, 10)) {
             alert(`El número de huéspedes (${personasEl.value}) excede la capacidad máxima (${personasEl.max}).`);
            return;
        }

        // Construir la URL para la página /reservar
        const params = new URLSearchParams({
            propiedadId: PROPIEDAD_ID,
            fechaLlegada: fechaLlegadaEl.value,
            fechaSalida: fechaSalidaEl.value,
            personas: personasEl.value,
            noches: currentPriceData.nights,
            precioFinal: currentPriceData.totalPriceCLP
        });

        // Redirigir al checkout
        window.location.href = `/reservar?${params.toString()}`;
    });

    // --- Listeners para cambios en las fechas ---
    fechaLlegadaEl.addEventListener('change', calcularPrecio);
    fechaSalidaEl.addEventListener('change', calcularPrecio);

    // --- Inicialización ---
    // Calcular precio al cargar si las fechas ya están (viene de prefill o búsqueda)
    if (PREFILL_LLEGADA && PREFILL_SALIDA) {
        fechaLlegadaEl.value = PREFILL_LLEGADA;
        fechaSalidaEl.value = PREFILL_SALIDA;
        
        const today = new Date().toISOString().split('T')[0];
        if (fechaLlegadaEl.value < today) fechaLlegadaEl.value = today;
        if (fechaSalidaEl.value <= fechaLlegadaEl.value) {
             const nextDay = new Date(new Date(fechaLlegadaEl.value).getTime() + 86400000).toISOString().split('T')[0];
             fechaSalidaEl.value = nextDay;
        }
        calcularPrecio();
    } else {
         // Si no hay prefill, poner fecha de llegada mínima hoy
         fechaLlegadaEl.min = new Date().toISOString().split('T')[0];
    }
});