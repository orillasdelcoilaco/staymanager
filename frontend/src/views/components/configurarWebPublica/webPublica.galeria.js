// frontend/src/views/components/configurarWebPublica/webPublica.galeria.js
import { fetchAPI } from '../../../api.js';
import { openEditor } from '../../../utils/imageEditorModal.js';

let currentPropiedadId = null;
let currentImages = {};

// Helper para limpiar datos undefined
const clean = (val) => (val === undefined || val === null || val === 'undefined') ? '' : val;

export function initGaleria(propiedadId, images) {
    currentPropiedadId = propiedadId;
    currentImages = images || {};
}

export function renderGaleria(componentes) {
    if (!componentes || componentes.length === 0) {
        return `<p class="text-sm text-gray-500 p-4">Define 'Componentes' en Gestionar Alojamientos para subir fotos.</p>`;
    }
    return `
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Galería por Áreas</h3>
        ${componentes.map(comp => renderComponenteBloque(comp)).join('')}
    `;
}

function renderComponenteBloque(componente) {
    const imagenes = currentImages[componente.id] || [];
    return `
        <fieldset class="border p-4 rounded-md mb-4">
            <legend class="px-2 font-semibold text-gray-700">${componente.nombre}</legend>
            <div class="mt-4 space-y-3">
                <div id="galeria-${componente.id}" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    ${renderImagenesGrid(imagenes, componente.id)}
                </div>
                
                <div class="flex flex-col gap-1 mt-4 p-3 bg-gray-50 rounded border border-dashed border-gray-300">
                    <label for="input-${componente.id}" class="block text-sm font-medium text-gray-700 cursor-pointer hover:text-indigo-600">
                        📂 Seleccionar imágenes para subir (Múltiples permitidas)
                    </label>
                    <input type="file" multiple accept="image/*" id="input-${componente.id}" data-component-id="${componente.id}" class="subir-imagenes-input block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
                    <div id="upload-status-${componente.id}" class="text-xs mt-1 text-gray-500 min-h-[20px]"></div>
                </div>
            </div>
        </fieldset>`;
}

function renderImagenesGrid(imagenes, componentId) {
    if (imagenes.length === 0) return '<p class="text-xs text-gray-500 col-span-full py-2">No hay imágenes en esta sección.</p>';
    return imagenes.map(img => `
        <div class="relative border rounded-md overflow-hidden group h-32 bg-gray-100">
            <img src="${img.storagePath}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
             <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100 gap-3">
                <button data-component-id="${componentId}" data-image-id="${img.imageId}" class="eliminar-imagen-btn bg-white text-red-600 rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-50 shadow-md" title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                </button>
                <button data-component-id="${componentId}" data-image-url="${img.storagePath}" data-old-image-id="${img.imageId}" class="editar-existente-btn bg-white text-blue-600 rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-50 shadow-md" title="Recortar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                </button>
            </div>
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-1">
                <p class="text-[10px] text-white truncate text-center">${clean(img.altText) || 'Sin descripción'}</p>
            </div>
        </div>
    `).join('');
}

export function setupGaleriaEvents() {
    // Listener para el INPUT de archivo (Subida Múltiple Secuencial)
    document.querySelectorAll('.subir-imagenes-input').forEach(input => {
        // Clonar para limpiar eventos previos
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        
        newInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            const compId = e.target.dataset.componentId;
            
            if (files.length === 0) return;
            
            // Iniciar la cola de procesamiento
            procesarColaDeImagenes(compId, files);
            
            // Limpiar input para permitir subir los mismos archivos de nuevo si se desea
            newInput.value = ''; 
        });
    });

    // Delegación de eventos para los botones dentro del grid
    const contenedoresGaleria = document.querySelectorAll('[id^="galeria-"]');
    contenedoresGaleria.forEach(container => {
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);

        newContainer.addEventListener('click', (e) => {
            // Eliminar
            const btnEliminar = e.target.closest('.eliminar-imagen-btn');
            if (btnEliminar) {
                handleEliminar(btnEliminar.dataset.componentId, btnEliminar.dataset.imageId);
            }
            
            // Editar Existente
            const btnEditar = e.target.closest('.editar-existente-btn');
            if (btnEditar) {
                openEditor(btnEditar.dataset.imageUrl, (blob) => handleSubirGaleria(btnEditar.dataset.componentId, blob, btnEditar.dataset.oldImageId));
            }
        });
    });
}

// Función recursiva para procesar múltiples imágenes una por una con el editor
function procesarColaDeImagenes(componentId, filesArray, index = 0) {
    if (index >= filesArray.length) {
        // Fin de la cola
        const statusEl = document.getElementById(`upload-status-${componentId}`);
        if (statusEl) {
            statusEl.textContent = `✅ Proceso finalizado. ${filesArray.length} imágenes procesadas.`;
            statusEl.classList.remove('text-blue-600');
            statusEl.classList.add('text-green-600');
            setTimeout(() => statusEl.textContent = '', 5000);
        }
        return;
    }

    const file = filesArray[index];
    const statusEl = document.getElementById(`upload-status-${componentId}`);
    if (statusEl) {
        statusEl.textContent = `🔄 Editando imagen ${index + 1} de ${filesArray.length}...`;
        statusEl.classList.add('text-blue-600');
    }

    // Abrir editor para la imagen actual
    openEditor(file, async (blob) => {
        // Callback al confirmar el recorte
        await handleSubirGaleria(componentId, blob);
        
        // Procesar la siguiente imagen
        procesarColaDeImagenes(componentId, filesArray, index + 1);
    });
}

async function handleSubirGaleria(componentId, blob, oldImageId = null) {
    const statusEl = document.getElementById(`upload-status-${componentId}`);
    if (statusEl) statusEl.textContent = oldImageId ? 'Actualizando...' : 'Subiendo a la nube...';
    
    const formData = new FormData();
    // El backend espera 'images' como array, enviamos uno a la vez
    formData.append('images', blob, 'gallery-image.jpg');

    try {
        // 1. Subir la nueva imagen
        const resultados = await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/upload-image/${componentId}`, {
            method: 'POST',
            body: formData
        });
        
        // 2. Si es edición (reemplazo), borrar la antigua
        if (oldImageId) {
            try {
                await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/delete-image/${componentId}/${oldImageId}`, {
                    method: 'DELETE'
                });
                // Actualizar estado local eliminando la vieja
                if (currentImages[componentId]) {
                    currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== oldImageId);
                }
            } catch (delError) {
                console.warn("No se pudo borrar la imagen antigua automáticamente:", delError);
            }
        }
        
        // 3. Actualizar estado local añadiendo la nueva
        if (!currentImages[componentId]) currentImages[componentId] = [];
        currentImages[componentId].push(...resultados);
        
        // 4. Re-renderizar UI
        const container = document.getElementById(`galeria-${componentId}`);
        if (container) {
            container.innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
        }
        
        // IMPORTANTE: No es necesario llamar a setupGaleriaEvents() aquí porque usamos delegación de eventos en el contenedor padre, que no se destruye.
        
    } catch (error) {
        if (statusEl) {
            statusEl.textContent = `❌ Error: ${error.message}`;
            statusEl.classList.add('text-red-500');
        }
    }
}

async function handleEliminar(componentId, imageId) {
    if (!confirm('¿Estás seguro de eliminar esta imagen permanentemente?')) return;
    try {
        await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/delete-image/${componentId}/${imageId}`, {
            method: 'DELETE'
        });
        
        currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== imageId);
        
        const container = document.getElementById(`galeria-${componentId}`);
        if (container) {
            container.innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
        }
    } catch (error) {
        alert(`Error al eliminar: ${error.message}`);
    }
}