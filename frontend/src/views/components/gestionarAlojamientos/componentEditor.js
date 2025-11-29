// frontend/src/views/components/gestionarAlojamientos/componentEditor.js

/**
 * Genera el HTML para la lista de componentes y sus elementos internos.
 * @param {Array} componentes - Lista de componentes (espacios).
 * @param {Array} tiposElemento - Catálogo de tipos de elemento disponibles.
 * @returns {string} HTML string.
 */
export function renderComponentList(componentes, tiposElemento) {
    if (!componentes || componentes.length === 0) {
        return '<div class="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg"><p class="text-gray-500">No hay espacios definidos.</p><p class="text-xs text-gray-400 mt-1">Agrega dormitorios, baños, cocina, etc.</p></div>';
    }

    return componentes.map((comp, compIndex) => `
        <div class="bg-white border rounded-lg shadow-sm mb-4 overflow-hidden group">
            <!-- Header del Componente -->
            <div class="bg-gray-50 p-3 flex justify-between items-center border-b cursor-pointer hover:bg-gray-100 transition-colors" onclick="window.toggleComponente(${compIndex})">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${comp.icono || '📦'}</span>
                    <div>
                        <h4 class="font-semibold text-gray-800">${comp.nombre}</h4>
                        <span class="text-xs text-gray-500 uppercase tracking-wider bg-gray-200 px-1.5 py-0.5 rounded">${comp.tipo}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="window.eliminarComponente(${compIndex}, event)" class="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors" title="Eliminar Espacio">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <span class="transform transition-transform duration-200 text-gray-400" id="arrow-${compIndex}">▼</span>
                </div>
            </div>

            <!-- Cuerpo del Componente (Elementos) -->
            <div id="body-comp-${compIndex}" class="p-4 hidden bg-white">
                <!-- Lista de Elementos Actuales -->
                <div class="space-y-3 mb-4">
                    ${renderElementsList(comp.elementos, compIndex)}
                </div>

                <!-- Agregar Nuevo Elemento -->
                <div class="flex gap-2 items-center border-t pt-3 mt-2 bg-gray-50 p-2 rounded-md">
                    <select id="select-elemento-${compIndex}" class="form-select text-sm w-full border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="">+ Agregar elemento...</option>
                        ${renderOpcionesElementos(tiposElemento)}
                    </select>
                    <button type="button" onclick="window.agregarElemento(${compIndex})" class="bg-indigo-600 text-white px-3 py-2 rounded-md text-sm hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap">
                        Añadir
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderElementsList(elementos, compIndex) {
    if (!elementos || elementos.length === 0) {
        return '<p class="text-sm text-gray-400 italic text-center py-2">Sin elementos (camas, muebles, etc).</p>';
    }

    return elementos.map((elem, elemIndex) => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200 gap-3">
            <div class="flex items-center gap-3 flex-grow">
                <span class="text-xl">${elem.icono || '🔹'}</span>
                <div class="flex flex-col">
                    <span class="text-sm font-semibold text-gray-700">${elem.nombre}</span>
                    <span class="text-[10px] text-gray-500 uppercase tracking-wide">${elem.categoria}</span>
                </div>
            </div>
            
            <!-- Configuración del Elemento (Amenidad + Cantidad) -->
            <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
                
                <!-- Input de Amenidad (Detalle) -->
                <input type="text" 
                    placeholder="Detalle (ej: King, Con Vista)" 
                    value="${elem.amenity || ''}" 
                    onchange="window.actualizarAmenidad(${compIndex}, ${elemIndex}, this.value)"
                    class="form-input text-xs py-1 px-2 w-32 border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                    title="Detalle específico (ej: King Size, En suite)"
                >

                ${elem.permiteCantidad ? `
                    <div class="flex items-center border border-gray-300 rounded bg-white h-8">
                        <button type="button" onclick="window.cambiarCantidadElemento(${compIndex}, ${elemIndex}, -1)" class="px-2 text-gray-500 hover:bg-gray-100 h-full rounded-l">-</button>
                        <span class="px-2 text-sm font-semibold min-w-[1.5rem] text-center">${elem.cantidad}</span>
                        <button type="button" onclick="window.cambiarCantidadElemento(${compIndex}, ${elemIndex}, 1)" class="px-2 text-gray-500 hover:bg-gray-100 h-full rounded-r">+</button>
                    </div>
                ` : ''}
                
                <button type="button" onclick="window.eliminarElemento(${compIndex}, ${elemIndex})" class="text-gray-400 hover:text-red-500 p-1 transition-colors" title="Quitar elemento">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    `).join('');
}

function renderOpcionesElementos(tiposElemento) {
    const categorias = { 'CAMA': [], 'BANO_ELEMENTO': [], 'EQUIPAMIENTO': [] };

    // Clasificar
    tiposElemento.forEach(t => {
        if (categorias[t.categoria]) {
            categorias[t.categoria].push(t);
        } else {
            // Fallback para categorías nuevas o desconocidas
            if (!categorias['OTROS']) categorias['OTROS'] = [];
            categorias['OTROS'].push(t);
        }
    });

    let html = '';
    for (const [cat, items] of Object.entries(categorias)) {
        if (items && items.length > 0) {
            html += `<optgroup label="${cat}">`;
            html += items.map(i => `<option value="${i.id}">${i.icono || ''} ${i.nombre}</option>`).join('');
            html += `</optgroup>`;
        }
    }
    return html;
}
