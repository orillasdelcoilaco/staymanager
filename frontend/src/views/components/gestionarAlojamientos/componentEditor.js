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
                    <button type="button" onclick="window.eliminarComponente(${compIndex}, event)" class="text-gray-400 hover:text-danger-600 p-1 rounded hover:bg-danger-50 transition-colors" title="Eliminar Espacio">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <span class="transform transition-transform duration-200 text-gray-400" id="arrow-${compIndex}"><i class="fa-solid fa-chevron-down"></i></span>
                </div>
            </div>

            <!-- Cuerpo del Componente (Elementos) -->
            <div id="body-comp-${compIndex}" class="p-4 hidden bg-white">
                <!-- Lista de Elementos Actuales -->
                <div class="space-y-3 mb-4">
                    ${renderElementsList(comp.elementos, compIndex)}
                </div>

                <!-- SECCIÓN: Guía de Fotos IA -->
                ${renderPhotoRequirements(comp.requerimientosFotos)}

                <!-- Agregar Nuevo Elemento (Bulk Selection) -->
                <div class="border-t pt-3 mt-2 bg-gray-50 p-2 rounded-md">
                    <button type="button" onclick="window.toggleBulkPanel(${compIndex})" class="w-full text-left flex justify-between items-center text-sm font-medium text-primary-700 hover:text-primary-900 focus:outline-none">
                        <span>+ Agregar Activos (Selección Múltiple)</span>
                        <span id="bulk-arrow-${compIndex}" class="transform transition-transform text-xs"><i class="fa-solid fa-chevron-down"></i></span>
                    </button>

                    <!-- Panel de Selección Múltiple (Oculto por defecto) -->
                    <div id="bulk-add-panel-${compIndex}" class="hidden mt-3 space-y-3 border-t border-primary-100 pt-3">
                        ${renderCheckboxList(tiposElemento, compIndex)}
                        
                        <div class="flex justify-end pt-2">
                            <button type="button" onclick="window.agregarSeleccionados(${compIndex})" class="btn-primary text-sm">
                                Agregar Seleccionados
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Renderiza la sección de requerimientos de fotos sugeridos por IA.
 * @param {Array} reqs - Lista de requerimientos de fotos.
 */
function renderPhotoRequirements(reqs) {
    if (!reqs || !Array.isArray(reqs) || reqs.length === 0) return '';

    return `
        <div class="mb-4 bg-primary-50/30 border border-primary-100 rounded-md p-3">
            <h5 class="text-xs font-bold text-primary-800 uppercase mb-2 flex items-center gap-1">
                <i class="fa-solid fa-camera"></i> Fotos Sugeridas (IA)
            </h5>
            <div class="flex flex-wrap gap-2">
                ${reqs.map(req => {
        const isObligatory = req.obligatoria;
        const badgeClass = isObligatory
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-white text-gray-600 border-gray-200';
        const icon = isObligatory
            ? '<i class="fa-solid fa-triangle-exclamation"></i>'
            : '<i class="fa-solid fa-camera"></i>';

        return `
                        <div class="group relative cursor-help flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${badgeClass} transition-colors hover:shadow-sm">
                            <span>${icon}</span>
                            <span>${req.activo}</span>
                            
                            <!-- Tooltip -->
                            <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-gray-800 text-white text-[11px] leading-tight p-2.5 rounded shadow-xl z-50 text-center pointer-events-none">
                                ${req.metadataSugerida}
                                <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
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
                    class="form-input text-xs py-1 px-2 w-32 border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500"
                    title="Detalle específico (ej: King Size, En suite)"
                >

                ${elem.permiteCantidad ? `
                    <div class="flex items-center border border-gray-300 rounded bg-white h-8">
                        <button type="button" onclick="window.cambiarCantidadElemento(${compIndex}, ${elemIndex}, -1)" class="px-2 text-gray-500 hover:bg-gray-100 h-full rounded-l">-</button>
                        <span class="px-2 text-sm font-semibold min-w-[1.5rem] text-center">${elem.cantidad}</span>
                        <button type="button" onclick="window.cambiarCantidadElemento(${compIndex}, ${elemIndex}, 1)" class="px-2 text-gray-500 hover:bg-gray-100 h-full rounded-r">+</button>
                    </div>
                ` : ''}
                
                ${elem.capacity > 0 ? `
                <label class="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer select-none" title="¿Este mueble suma personas a la capacidad total?">
                    <input type="checkbox"
                        class="form-checkbox h-3.5 w-3.5 text-primary-600 rounded"
                        ${elem.sumaCapacidad !== false ? 'checked' : ''}
                        onchange="window.toggleSumaCapacidad(${compIndex}, ${elemIndex}, this.checked)"
                    >
                    <span>Cap.</span>
                </label>` : ''}

                <button type="button" onclick="window.eliminarElemento(${compIndex}, ${elemIndex})" class="text-gray-400 hover:text-danger-500 p-1 transition-colors" title="Quitar elemento">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    `).join('');
}

function renderOpcionesElementos(tiposElemento) {
    const categorias = {};

    // Clasificación dinámica con Normalización
    (tiposElemento || []).forEach(t => {
        const rawCat = t.categoria || 'OTROS';
        // Normalizamos la clave para agrupar (Trim + Upper)
        const key = rawCat.trim().toUpperCase();

        if (!categorias[key]) {
            categorias[key] = {
                label: rawCat.trim(), // Guardamos la primera etiqueta encontrada como display
                items: []
            };
        }
        categorias[key].items.push(t);
    });

    // Ordenar claves alfabéticamente
    const clavesOrdenadas = Object.keys(categorias).sort();

    let html = '';
    for (const key of clavesOrdenadas) {
        const group = categorias[key];
        if (group.items && group.items.length > 0) {
            // Capitalizar etiqueta para visualización consistente (Primera mayúscula)
            const label = group.label.charAt(0).toUpperCase() + group.label.slice(1);

            html += `<optgroup label="${label}">`;
            html += group.items.map(i => `<option value="${i.id}">${i.icono || ''} ${i.nombre}</option>`).join('');
            html += `</optgroup>`;
        }
    }
    return html;
}

/**
 * Genera el HTML de la lista de checkboxes agrupada por categoría.
 */
function renderCheckboxList(tiposElemento, compIndex) {
    const categorias = {};

    // Clasificación dinámica
    (tiposElemento || []).forEach(t => {
        const rawCat = t.categoria || 'OTROS';
        const key = rawCat.trim().toUpperCase();
        if (!categorias[key]) {
            categorias[key] = { label: rawCat.trim(), items: [] };
        }
        categorias[key].items.push(t);
    });

    const clavesOrdenadas = Object.keys(categorias).sort();

    // Buscador
    let html = `
        <div class="sticky top-0 z-20 bg-white pb-2">
            <input type="text"
                id="bulk-search-${compIndex}"
                oninput="window.filtrarActivos(${compIndex}, this.value)"
                placeholder="Buscar activo..."
                class="form-input w-full text-sm"
            >
        </div>
    `;

    // Contenedor con scroll
    html += `<div id="bulk-list-${compIndex}" class="space-y-4 max-h-52 overflow-y-auto pr-1 custom-scrollbar">`;

    for (const key of clavesOrdenadas) {
        const group = categorias[key];

        if (group.items && group.items.length > 0) {
            const label = group.label.charAt(0).toUpperCase() + group.label.slice(1);

            html += `
                <div class="bg-white border border-gray-200 rounded-md overflow-hidden" data-bulk-cat="${key}">
                    <!-- Header Categoría con Checkbox 'Select All' -->
                    <div class="bg-gray-100 px-3 py-2 flex items-center justify-between sticky top-0 z-10">
                        <label class="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" 
                                class="form-checkbox text-primary-600 rounded border-gray-400 focus:ring-primary-500 h-4 w-4"
                                onchange="window.toggleCategoryGroup(${compIndex}, '${key}', this.checked)"
                            >
                            <span class="text-xs font-bold text-gray-700 uppercase tracking-wide">${label}</span>
                        </label>
                        <span class="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">${group.items.length}</span>
                    </div>
                    
                    <!-- Grid de Items -->
                    <div class="p-2 grid grid-cols-2 gap-2">
                        ${group.items.map(i => `
                            <label class="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer border border-transparent hover:border-gray-100 transition-colors">
                                <input type="checkbox" 
                                    name="bulk-check-${compIndex}" 
                                    value="${i.id}" 
                                    data-category="${key}"
                                    class="form-checkbox text-primary-600 rounded border-gray-300 focus:ring-primary-500 h-4 w-4"
                                >
                                <span class="text-lg">${i.icono || '🔹'}</span>
                                <span class="text-xs text-gray-700 truncate" title="${i.nombre}">${i.nombre}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    html += '</div>';
    return html;
}
