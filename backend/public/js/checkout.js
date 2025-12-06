// backend/public/js/checkout.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('checkout-form');
    const submitButton = form.querySelector('button[type="submit"]');
    // Support both IDs just in case
    const statusMessage = document.getElementById('status-message') || document.getElementById('error-message');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Deshabilitar botón y mostrar carga
        submitButton.disabled = true;
        const originalBtnText = submitButton.textContent;
        submitButton.textContent = 'Procesando Reserva...';

        if (statusMessage) {
            statusMessage.textContent = '';
            statusMessage.classList.remove('hidden', 'text-red-600');
            statusMessage.classList.add('text-gray-600');
        }

        // 2. Obtener los datos del formulario
        const formData = new FormData(form);
        const formEntries = Object.fromEntries(formData.entries());

        // 3. Combinar con los datos de la reserva inyectados desde EJS (window.checkoutData)
        // Esto es CRÍTICO porque el formulario visual solo tiene datos de contacto,
        // pero necesitamos enviar propiedadId, fechas, precios, etc.
        const datosReserva = {
            ...window.checkoutData,
            ...formEntries
        };

        console.log("Enviando reserva:", datosReserva);

        // 4. Enviar al endpoint
        try {
            const response = await fetch('/crear-reserva-publica', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(datosReserva),
            });

            const resultado = await response.json();

            if (!response.ok) {
                throw new Error(resultado.error || 'No se pudo completar la reserva.');
            }

            // 5. Éxito: Redirigir a confirmación
            window.location.href = `/confirmacion?reservaId=${resultado.reservaId}`;

        } catch (error) {
            console.error("Error en reserva:", error);
            // 6. Error: Reactivar botón
            submitButton.disabled = false;
            submitButton.textContent = originalBtnText; // Restaurar texto original

            if (statusMessage) {
                statusMessage.textContent = `Error: ${error.message}`;
                statusMessage.classList.add('text-red-600');
                statusMessage.classList.remove('hidden');
            } else {
                alert(`Error: ${error.message}`);
            }
        }
    });
});