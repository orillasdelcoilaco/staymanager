import { fetchAPI } from '../../../api.js';

let currentPropiedadId = null;
let currentImages = {};

export function initGaleria(propiedadId, images) {
    currentPropiedadId = propiedadId;
    currentImages = images || {};
}

export function renderGaleria(componentes) {
    if (!componentes || componentes.length === 0) {
        return `<h3 class="text-lg font-semibold text-gray-800 mb-2">Galería</h3>
                <p class="text-sm text-gray-500 p-4 border rounded-md bg-gray-50">
                   Define 'Componentes Adicionales' en 'Gestionar Alojamientos' para subir más imágenes.
                </p>`;
    }

    return `
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Imágenes Adicionales (Galería)</h3>
        ${componentes.map(comp => renderComponenteBloque(comp)).join('')}
    `;
}

function renderComponenteBloque(componente) {
    const imagenes = currentImages[componente.id] || [];
    return `
        <fieldset class="border p-4 rounded-md mb-4">
            <legend class="px-2 font-semibold text-gray-700">${componente.nombre} (Tipo: ${componente.tipo})</legend>
            <div class="mt-4 space-y-3">
                <div id="galeria-${componente.id}" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    ${renderImagenesGrid(imagenes, componente.id)}
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Subir Nuevas Imágenes</label>
                    <input type="file" multiple accept="image/*" data-component-id="${componente.id}" class="subir-imagenes-input form-input-file mt-1">
                    <div id="upload-status-${componente.id}" class="text-xs mt-1"></div>
                </div>
            </div>
        </fieldset>`;
}

function renderImagenesGrid(imagenes, componentId) {
    if (imagenes.length === 0) return '<p class="text-xs text-gray-500 col-span-full">Sin imágenes.</p>';
    
    return imagenes.map(img => `
        <div class="relative border rounded-md overflow-hidden group">
            <img src="${img.storagePath}" class="w-full h-24 object-cover">
             <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-opacity flex flex-col justify-between p-1 text-white opacity-0 group-hover:opacity-100">
                <button data-component-id="${componentId}" data-image-id="${img.imageId}" class="eliminar-imagen-btn absolute top-1 right-1 bg-red-600 rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">&times;</button>
                <div class="bg-black bg-opacity-50 p-0.5 rounded-sm overflow-hidden text-[10px]">
                    <p class="truncate">Alt: ${img.altText || '...'}</p>
                </div>
            </div>
        </div>
    `).join('');
}

export function setupGaleriaEvents() {
    document.querySelectorAll('.subir-imagenes-input').forEach(input => {
        input.addEventListener('change', (e) => handleSubir(e.target.dataset.componentId, e.target.files));
    });
    document.querySelectorAll('.eliminar-imagen-btn').forEach(button => {
        button.addEventListener('click', (e) => handleEliminar(e.currentTarget.dataset.componentId, e.currentTarget.dataset.imageId));
    });
}

async function handleSubir(componentId, files) {
    if (!files.length) return;
    const statusEl = document.getElementById(`upload-status-${componentId}`);
    statusEl.textContent = `Subiendo ${files.length} imágenes...`;
    
    const formData = new FormData();
    for (const file of files) formData.append('images', file);

    try {
        const resultados = await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/upload-image/${componentId}`, {
            method: 'POST',
            body: formData
        });
        
        if (!currentImages[componentId]) currentImages[componentId] = [];
        currentImages[componentId].push(...resultados);
        
        // Re-renderizar solo este grid
        document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
        
        // Re-attach listeners solo para este bloque (o re-setup todo para simplificar)
        setupGaleriaEvents(); 
        statusEl.textContent = 'Subida completada.';
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
    }
}

async function handleEliminar(componentId, imageId) {
    if (!confirm('¿Eliminar imagen?')) return;
    try {
        await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/delete-image/${componentId}/${imageId}`, {
            method: 'DELETE'
        });
        currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== imageId);
        document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
        setupGaleriaEvents();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}