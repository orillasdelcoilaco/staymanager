// frontend/src/views/components/agregarPropuesta/propuesta.ui.js

/**
 * Genera el HTML de un checkbox para una propiedad.
 * @param {Object} prop - Objeto propiedad.
 * @param {boolean} isSuggested - Si está sugerida o no.
 */
export function createPropertyCheckbox(prop, isSuggested) {
    return `
      <div class="p-2 border rounded-md flex items-center justify-between bg-white">
        <div>
          <input type="checkbox" id="cb-${prop.id}" data-id="${prop.id}" class="propiedad-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded" ${isSuggested ? 'checked' : ''}>
          <label for="cb-${prop.id}" class="ml-2 font-medium">${prop.nombre}</label>
          <span class="ml-2 text-sm text-gray-500">(Cap: ${prop.capacidad})</span>
        </div>
      </div>`;
}

/**
 * Renderiza los widgets de selección de propiedades (Sugerencias y Disponibles).
 * @param {HTMLElement} containerSuggestion - Contenedor de la lista de sugerencias.
 * @param {HTMLElement} containerAvailable - Contenedor de la lista de otras disponibles.
 * @param {Object} availabilityData - Datos de disponibilidad devueltos por el backend.
 * @param {Array} selectedProperties - Lista de propiedades actualmente seleccionadas.
 * @param {Function} onSelectionChange - Callback para manejar el evento 'change' de los checkboxes.
 */
export function renderSelectionWidgets(containerSuggestion, containerAvailable, availabilityData, selectedProperties, onSelectionChange) {
    if (!availabilityData.suggestion) return;

    containerSuggestion.innerHTML = '';
    containerAvailable.innerHTML = '';

    if (availabilityData.suggestion.isSegmented) {
        // Modo Itinerario (Segmentado)
        containerSuggestion.innerHTML = `
        <h4 class="font-medium text-gray-700">Propuesta de Itinerario</h4>
        <div class="space-y-3 p-3 bg-white rounded-md border">${
            availabilityData.suggestion.itinerary.map((segment) => {
            const fechaSalidaSegmento = new Date(segment.endDate); 
            
            const propertiesHtml = segment.propiedades.map(prop => `
                <div class="grid grid-cols-5 gap-4 items-center text-sm">
                <span class="font-semibold col-span-2">${prop.nombre}</span>
                <span class="col-span-3 text-xs text-gray-500">(Cap: ${prop.capacidad} pers.)</span>
                </div>
            `).join('');

            return `
                <div class="border-b pb-2 last:border-b-0">
                <div class="grid grid-cols-5 gap-4 items-center text-sm font-medium mb-1">
                    <span class="col-span-2">Fechas:</span>
                    <span class="col-span-3">${new Date(segment.startDate).toLocaleDateString('es-CL', {timeZone: 'UTC'})} al ${fechaSalidaSegmento.toLocaleDateString('es-CL', {timeZone: 'UTC'})}</span>
                </div>
                ${propertiesHtml}
                </div>`;
            }).join('')
        }</div>`;
        
        containerAvailable.innerHTML = '<p class="text-sm text-gray-500">Modo itinerario: no se pueden añadir otras cabañas.</p>';
    
    } else {
        // Modo Estándar (Checkbox)
        const suggestedIds = new Set(selectedProperties.map(p => p.id));
        
        containerSuggestion.innerHTML = `<h4 class="font-medium text-gray-700">Propiedades Sugeridas</h4>` + 
        selectedProperties.map(p => createPropertyCheckbox(p, true)).join('');

        const availableWithId = availabilityData.allValidProperties || [];
        
        containerAvailable.innerHTML = availableWithId
        .filter(p => !suggestedIds.has(p.id))
        .map(p => createPropertyCheckbox(p, false))
        .join('');
    }
    
    // Asignar eventos a los nuevos elementos
    document.querySelectorAll('.propiedad-checkbox').forEach(cb => cb.addEventListener('change', onSelectionChange));
}