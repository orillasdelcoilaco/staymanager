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
                <div class="flex items-end gap-2">
                    <div class="flex-grow">
                        <label class="block text-sm font-medium text-gray-700">Agregar Imagen</label>
                        <input type="file" accept="image/*" id="input-${componente.id}" class="form-input-file mt-1">
                    </div>
                    <button type="button" data-component-id="${componente.id}" class="btn-subir-img btn-secondary btn-sm mb-[2px]">
                        Recortar y Subir
                    </button>
                </div>
                <div id="upload-status-${componente.id}" class="text-xs mt-1"></div>
            </div>
        </fieldset>`;
}

function renderImagenesGrid(imagenes, componentId) {
    if (imagenes.length === 0) return '<p class="text-xs text-gray-500 col-span-full">Sin imágenes.</p>';
    return imagenes.map(img => `
        <div class="relative border rounded-md overflow-hidden group h-24">
            <img src="${img.storagePath}" class="w-full h-full object-cover">
             <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                <button data-component-id="${componentId}" data-image-id="${img.imageId}" class="eliminar-imagen-btn bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center" title="Eliminar">&times;</button>
                <button data-component-id="${componentId}" data-image-url="${img.storagePath}" data-old-image-id="${img.imageId}" class="editar-existente-btn bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs" title="Editar">✎</button>
            </div>
        </div>
    `).join('');
}

export function setupGaleriaEvents() {
    document.querySelectorAll('.btn-subir-img').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', (e) => {
            const compId = e.target.dataset.componentId;
            const input = document.getElementById(`input-${compId}`);
            const file = input.files?.[0];
            if (!file) return alert('Selecciona una imagen.');
            
            openEditor(file, (blob) => handleSubirGaleria(compId, blob));
        });
    });

    const contenedoresGaleria = document.querySelectorAll('[id^="galeria-"]');
    contenedoresGaleria.forEach(container => {
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);

        newContainer.addEventListener('click', (e) => {
            if (e.target.closest('.eliminar-imagen-btn')) {
                const btn = e.target.closest('.eliminar-imagen-btn');
                handleEliminar(btn.dataset.componentId, btn.dataset.imageId);
            }
            if (e.target.closest('.editar-existente-btn')) {
                const btn = e.target.closest('.editar-existente-btn');
                // Pasamos el oldImageId para que handleSubirGaleria sepa que debe borrar el antiguo
                openEditor(btn.dataset.imageUrl, (blob) => handleSubirGaleria(btn.dataset.componentId, blob, btn.dataset.oldImageId));
            }
        });
    });
}

async function handleSubirGaleria(componentId, blob, oldImageId = null) {
    const statusEl = document.getElementById(`upload-status-${componentId}`);
    statusEl.textContent = oldImageId ? 'Actualizando...' : 'Subiendo...';
    
    const formData = new FormData();
    formData.append('images', blob, 'gallery.jpg');

    try {
        // 1. Subir la nueva imagen
        const resultados = await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/upload-image/${componentId}`, {
            method: 'POST',
            body: formData
        });
        
        // 2. Si estamos editando, borrar la vieja
        if (oldImageId) {
            try {
                await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/delete-image/${componentId}/${oldImageId}`, {
                    method: 'DELETE'
                });
                // Eliminar del estado local la vieja
                if (currentImages[componentId]) {
                    currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== oldImageId);
                }
            } catch (delError) {
                console.warn("No se pudo borrar la imagen antigua automáticamente:", delError);
            }
        }
        
        // 3. Actualizar estado y UI
        if (!currentImages[componentId]) currentImages[componentId] = [];
        currentImages[componentId].push(...resultados);
        
        document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
        setupGaleriaEvents(); 
        
        statusEl.textContent = oldImageId ? 'Editado con éxito.' : 'Subida completada.';
        const input = document.getElementById(`input-${componentId}`);
        if(input) input.value = '';
        
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
    }
}

async function handleEliminar(componentId, imageId) {
    if (!confirm('¿Borrar imagen?')) return;
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