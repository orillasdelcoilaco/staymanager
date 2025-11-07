// frontend/src/views/components/gestionarComentarios/utils.js

/**
 * Puebla un <select> con la lista de canales.
 */
export function poblarSelectCanales(canales, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Seleccione un canal...</option>' + canales.map(c => 
        `<option value="${c.id}">${c.nombre}</option>`
    ).join('');
}

/**
 * Maneja la búsqueda de reservas.
 */
export async function handleSearchFormSubmit(fetchAPI) {
    const canalId = document.getElementById('canal-select').value;
    const termino = document.getElementById('termino-busqueda').value;
    const resultsContainer = document.getElementById('search-results-container');

    if (!canalId || !termino) {
        alert('Por favor, seleccione un canal y escriba un término de búsqueda.');
        return;
    }

    resultsContainer.innerHTML = `<p class="text-gray-500">Buscando...</p>`;

    try {
        const reservas = await fetchAPI(`/comentarios/buscar-reserva?canalId=${canalId}&termino=${termino}`);
        renderSearchResults(reservas, resultsContainer, canalId);
    } catch (error) {
        resultsContainer.innerHTML = `<p class="text-red-500">Error al buscar: ${error.message}</p>`;
    }
}

/**
 * Renderiza los resultados de la búsqueda de reservas.
 */
function renderSearchResults(reservas, container, canalId) {
    if (reservas.length === 0) {
        container.innerHTML = `<p class="text-gray-500">No se encontraron reservas con esos criterios.</p>`;
        return;
    }

    container.innerHTML = `<h3 class="text-lg font-medium mb-2">Resultados:</h3>` + reservas.map(r => `
        <div class="border p-3 rounded-md mb-2 flex justify-between items-center">
            <div>
                <p class="font-semibold">${r.clienteNombre}</p>
                <p class="text-sm text-gray-600">${r.alojamientoNombre} (ID: ${r.idReservaCanal})</p>
                <p class="text-sm text-gray-600">Llegada: ${r.fechaLlegada}</p>
            </div>
            <button type="button" class="btn-secondary select-reserva-btn" 
                data-reserva-id="${r.id}"
                data-cliente-id="${r.clienteId || ''}"
                data-cliente-nombre="${r.clienteNombre}"
                data-alojamiento-nombre="${r.alojamientoNombre}"
                data-canal-id="${canalId}"
                data-id-reserva-canal="${r.idReservaCanal}"
            >
                Seleccionar
            </button>
        </div>
    `).join('');
}

/**
 * Configura un listener de delegación de eventos para los botones "Seleccionar".
 */
export function setupSearchResultsListener(containerId, formId) {
    const container = document.getElementById(containerId);
    const form = document.getElementById(formId);
    
    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('select-reserva-btn')) {
            const button = e.target;
            const data = button.dataset;

            // Rellenar el formulario de nuevo comentario
            form.reservaId.value = data.reservaId;
            form.clienteId.value = data.clienteId;
            form.clienteNombre.value = data.clienteNombre;
            form.alojamientoNombre.value = data.alojamientoNombre;
            form.canalId.value = data.canalId;
            form.idReservaCanal.value = data.idReservaCanal;
            
            // Limpiar resultados y hacer scroll
            container.innerHTML = `<p class="text-green-600 font-medium">Reserva "${data.clienteNombre} - ${data.alojamientoNombre}" seleccionada.</p>`;
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

/**
 * Maneja el envío del formulario de nuevo comentario (con FormData para archivos).
 */
export async function handleNewCommentFormSubmit(form, fetchAPI, onComplete) {
    const formData = new FormData(form);

    // Validar campos clave
    if (!formData.get('reservaId') || !formData.get('comentario') || !formData.get('fecha') || !formData.get('nota')) {
        alert('Por favor, seleccione una reserva y complete el comentario, la fecha y la nota.');
        return;
    }

    try {
        // fetchAPI no soporta FormData directamente, así que usamos fetch estándar con sus headers
        const token = localStorage.getItem('idToken');
        const response = await fetch('/api/comentarios', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
                // No 'Content-Type', el navegador lo pone solo con FormData
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error en el servidor');
        }

        alert('Comentario guardado con éxito.');
        form.reset();
        document.getElementById('search-results-container').innerHTML = ''; // Limpiar selección

        // Recargar la lista de comentarios
        const nuevosComentarios = await fetchAPI('/comentarios');
        onComplete(nuevosComentarios);

    } catch (error) {
        alert(`Error al guardar el comentario: ${error.message}`);
    }
}

/**
 * Maneja la eliminación de un comentario.
 */
export async function handleDeleteCommentClick(id, fetchAPI, onComplete) {
    if (!confirm('¿Estás seguro de que quieres eliminar este comentario? Esta acción también borrará las fotos asociadas.')) {
        return;
    }

    try {
        await fetchAPI(`/comentarios/${id}`, { method: 'DELETE' });
        
        // Recargar la lista
        const nuevosComentarios = await fetchAPI('/comentarios');
        onComplete(nuevosComentarios);
    } catch (error) {
        alert(`Error al eliminar: ${error.message}`);
    }
}