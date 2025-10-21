// backend/public/js/checkout.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('checkout-form');
    const submitButton = form.querySelector('button[type="submit"]');
    const statusMessage = document.getElementById('status-message');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Deshabilitar botón y mostrar carga
        submitButton.disabled = true;
        submitButton.textContent = 'Procesando Reserva...';
        statusMessage.textContent = '';
        statusMessage.className = 'text-sm';

        // 2. Obtener los datos del formulario (incluyendo los ocultos)
        const formData = new FormData(form);
        const datosReserva = Object.fromEntries(formData.entries());

        // 3. Enviar al nuevo endpoint público
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
                // Si el servidor devuelve un error (ej. "ya reservado")
                throw new Error(resultado.error || 'No se pudo completar la reserva.');
            }

            // 4. Éxito: Redirigir a la página de confirmación
            // Pasamos el ID de la nueva reserva a la página de confirmación
            window.location.href = `/confirmacion?reservaId=${resultado.reservaId}`;

        } catch (error) {
            // 5. Error: Reactivar el botón y mostrar error
            submitButton.disabled = false;
            submitButton.textContent = 'Confirmar Reserva';
            statusMessage.textContent = `Error: ${error.message}`;
            statusMessage.classList.add('text-red-600');
        }
    });
});