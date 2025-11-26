// frontend/src/views/components/configurarWebPublica/webPublica.galeria.js
import { fetchAPI } from '../../../api.js';
import { openEditor } from '../../../utils/imageEditorModal.js';

let currentPropiedadId = null;
let currentImages = {};

const clean = (val) => (val === undefined || val === null || val === 'undefined') ? '' : val;

export function initGaleria(propiedadId, images) {
    currentPropiedadId = propiedadId;
    currentImages = images || {};
}

/**
 * Renderiza la galería completa con la guía de IA (Auditor Visual).
 * @param {Array} componentes - Componentes de la propiedad.
 * @param {Array} tiposMaestros - Lista de tipos definidos en la empresa (para buscar shotList).
 */
export function renderGaleria(componentes, tiposMaestros = []) {
    if (!componentes || componentes.length === 0) {
        return `<p class="text-sm text-gray-500 p-4 border border-yellow-200 bg-yellow-50 rounded">
            ⚠️ Esta propiedad no tiene componentes definidos (Dormitorios, Baños, etc.). 
            Ve a <strong>Gestionar Alojamientos</strong> para definirlos y activar la guía de fotos IA.
        </p>`;
    }
    return `
        <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            Galería por Áreas 
            <span class="text-xs font-normal bg-green-100 text-green-800 px-2 py-1 rounded-full">Auditor IA Activo</span>
        </h3>
        ${componentes.map(comp => renderComponenteBloque(comp, tiposMaestros)).join('')}
    `;
}

function renderComponenteBloque(componente, tiposMaestros) {
    const imagenes = currentImages[componente.id] || [];
    
    // 1. Buscar la definición inteligente del tipo
    const tipoDefinicion = tiposMaestros.find(t => t.id === componente.tipoId) 
                        || tiposMaestros.find(t => t.nombreNormalizado === componente.tipo); // Fallback por nombre

    // 2. Generar el Checklist (Shot List)
    let checklistHtml = '';
    if (tipoDefinicion && tipoDefinicion.shotList) {
        const itemsHtml = tipoDefinicion.shotList.map(req => `
            <li class="flex items-start gap-2 text-xs text-gray-600">
                <span class="text-indigo-500 mt-0.5">•</span> ${req}
            </li>
        `).join('');
        
        checklistHtml = `
            <div class="mb-4 bg-indigo-50 border border-indigo-100 rounded-md p-3">
                <p class="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1">
                    ${tipoDefinicion.icono || '📸'} Guía de Fotos Sugerida (IA)
                </p>
                <ul class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                    ${itemsHtml}
                </ul>
            </div>
        `;
    }

    return `
        <fieldset class="border p-4 rounded-md mb-6 bg-white shadow-sm">
            <legend class="px-2 font-semibold text-gray-700 flex items-center gap-2">
                ${componente.nombre} 
                <span class="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">${componente.tipo}</span>
            </legend>
            
            ${checklistHtml}

            <div class="space-y-3">
                <div id="galeria-${componente.id}" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    ${renderImagenesGrid(imagenes, componente.id)}
                </div>
                
                <div class="flex flex-col gap-1 mt-4 p-3 bg-gray-50 rounded border border-dashed border-gray-300 hover:border-indigo-400 transition-colors">
                    <label for="input-${componente.id}" class="block text-sm font-medium text-gray-700 cursor-pointer hover:text-indigo-600 flex items-center gap-2 w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Subir imágenes para ${componente.nombre}
                    </label>
                    <input type="file" multiple accept="image/*" id="input-${componente.id}" data-component-id="${componente.id}" class="subir-imagenes-input block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
                    <div id="upload-status-${componente.id}" class="text-xs mt-1 text-gray-500 min-h-[20px]"></div>
                </div>
            </div>
        </fieldset>`;
}

function renderImagenesGrid(imagenes, componentId) {
    if (imagenes.length === 0) return '<p class="text-xs text-gray-500 col-span-full py-4 text-center italic">Aún no hay imágenes. Usa la guía de arriba para empezar.</p>';
    
    return imagenes.map(img => `
        <div class="relative border rounded-md overflow-hidden group h-32 bg-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <img src="${img.storagePath}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
             <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100 gap-3">
                <button data-component-id="${componentId}" data-image-id="${img.imageId}" class="eliminar-imagen-btn bg-white text-red-600 rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-50 shadow-md transition-transform hover:scale-110" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                </button>
                <button data-component-id="${componentId}" data-image-url="${img.storagePath}" data-old-image-id="${img.imageId}" class="editar-existente-btn bg-white text-blue-600 rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-50 shadow-md transition-transform hover:scale-110" title="Recortar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                </button>
            </div>
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-1">
                <p class="text-[10px] text-white truncate text-center" title="${clean(img.altText)}">${clean(img.altText) || 'Analizando...'}</p>
            </div>
        </div>
    `).join('');
}

// ... (resto de funciones setupGaleriaEvents, handleSubirMasivo, etc. IGUALES que la versión anterior) ...
export function setupGaleriaEvents() {
    document.querySelectorAll('.subir-imagenes-input').forEach(input => {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        newInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleSubirMasivo(e.target.dataset.componentId, e.target.files);
        });
    });
    const contenedoresGaleria = document.querySelectorAll('[id^="galeria-"]');
    contenedoresGaleria.forEach(container => {
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        newContainer.addEventListener('click', (e) => {
            const btnEliminar = e.target.closest('.eliminar-imagen-btn');
            if (btnEliminar) handleEliminar(btnEliminar.dataset.componentId, btnEliminar.dataset.imageId);
            const btnEditar = e.target.closest('.editar-existente-btn');
            if (btnEditar) openEditor(btnEditar.dataset.imageUrl, (blob) => handleReemplazarImagen(btnEditar.dataset.componentId, blob, btnEditar.dataset.oldImageId));
        });
    });
}

async function handleSubirMasivo(componentId, files) {
    const statusEl = document.getElementById(`upload-status-${componentId}`);
    statusEl.textContent = `Subiendo ${files.length} imágenes y generando descripciones IA...`;
    statusEl.className = 'text-xs mt-1 text-blue-600 font-medium animate-pulse';
    const formData = new FormData();
    for (const file of files) formData.append('images', file);
    try {
        const resultados = await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/upload-image/${componentId}`, { method: 'POST', body: formData });
        if (!currentImages[componentId]) currentImages[componentId] = [];
        currentImages[componentId].push(...resultados);
        document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
        statusEl.textContent = '¡Listo! Imágenes subidas y analizadas.';
        statusEl.className = 'text-xs mt-1 text-green-600 font-medium';
        document.getElementById(`input-${componentId}`).value = '';
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'text-xs mt-1 text-red-500 font-medium';
    }
}

async function handleReemplazarImagen(componentId, blob, oldImageId) {
    const statusEl = document.getElementById(`upload-status-${componentId}`);
    statusEl.textContent = 'Actualizando imagen...';
    const formData = new FormData();
    formData.append('images', blob, 'edited-image.jpg');
    try {
        const resultados = await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/upload-image/${componentId}`, { method: 'POST', body: formData });
        await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/delete-image/${componentId}/${oldImageId}`, { method: 'DELETE' });
        currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== oldImageId);
        currentImages[componentId].push(...resultados);
        document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
        statusEl.textContent = 'Edición guardada.';
    } catch (error) { alert(`Error al guardar edición: ${error.message}`); }
}

async function handleEliminar(componentId, imageId) {
    if (!confirm('¿Estás seguro de eliminar esta imagen permanentemente?')) return;
    try {
        await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/delete-image/${componentId}/${imageId}`, { method: 'DELETE' });
        currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== imageId);
        document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
    } catch (error) { alert(`Error al eliminar: ${error.message}`); }
}