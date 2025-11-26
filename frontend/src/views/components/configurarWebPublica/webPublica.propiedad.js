// frontend/src/views/components/configurarWebPublica/webPublica.propiedad.js
import { fetchAPI } from '../../../api.js';
// IMPORTAR EL EDITOR
import { openEditor } from '../../../utils/imageEditorModal.js';

let currentPropiedad = null;
let currentWebsiteData = null;
let currentEmpresaName = '';

const clean = (val) => (val === undefined || val === null || val === 'undefined') ? '' : val;

export function initPropiedad(propiedad, websiteData, nombreEmpresa) {
    currentPropiedad = propiedad;
    currentWebsiteData = websiteData;
    currentEmpresaName = nombreEmpresa;
}

export function renderPropiedadSettings() {
    if (!currentPropiedad) return '';
    
    const cardImage = currentWebsiteData.cardImage;
    const isListed = currentPropiedad.googleHotelData?.isListed || false;
    let previewContent;

    if (cardImage && cardImage.storagePath) {
        previewContent = `
            <p class="text-xs text-green-600 mb-2 font-medium">Imagen de tarjeta actual:</p>
            <div class="relative w-48 border rounded-md overflow-hidden group">
                <img src="${cardImage.storagePath}" 
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/100x60.png?text=Error';"
                     alt="${clean(cardImage.altText) || 'Imagen Tarjeta'}" 
                     class="w-full h-32 object-cover">
            </div>`;
    } else if (isListed) {
        previewContent = `<p class="text-sm font-medium text-red-600 mb-2">⚠️ Esta propiedad está "Listada" y requiere una imagen principal.</p>`;
    } else {
        previewContent = `<p class="text-sm text-gray-500 mb-2">No se ha subido una imagen principal.</p>`;
    }

    return `
        <fieldset class="p-4 rounded-md mb-4 border-indigo-500 border-2">
            <legend class="px-2 font-semibold text-indigo-700">Imagen Principal (Tarjeta/Home)</legend>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start mt-2">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Subir/Reemplazar Imagen</label>
                    <input type="file" accept="image/*" id="subir-card-image-input" class="form-input-file mt-1">
                    <div id="upload-status-card-image" class="text-xs mt-1"></div>
                    <button type="button" id="upload-card-image-btn" class="btn-secondary btn-sm mt-2">Subir Imagen</button>
                </div>
                <div id="preview-card-image-container">${previewContent}</div>
            </div>
        </fieldset>

        <fieldset class="border p-4 rounded-md mb-4">
            <legend class="px-2 font-semibold text-gray-700">Descripción Optimizada (IA)</legend>
            <p class="text-xs text-gray-500 mt-1 mb-3">Descripción para la página pública.</p>
            <div class="space-y-2">
                <textarea id="ai-description-textarea" rows="8" class="form-input w-full">${clean(currentWebsiteData.aiDescription)}</textarea>
                <div class="flex flex-wrap gap-2">
                    <button type="button" id="btn-generar-ai-desc" class="btn-secondary btn-sm">Generar con IA</button>
                    <button type="button" id="btn-guardar-ai-desc" class="btn-primary btn-sm">Guardar Descripción</button>
                </div>
                <div id="save-ai-description-status" class="text-xs mt-1"></div>
            </div>
        </fieldset>
    `;
}

export function setupPropiedadEvents() {
    const attach = (id, handler) => {
        const el = document.getElementById(id);
        if (el) {
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            newEl.addEventListener('click', handler);
        }
    };

    // CAMBIO AQUÍ: Usar el editor
    attach('upload-card-image-btn', () => {
        const input = document.getElementById('subir-card-image-input');
        const file = input.files?.[0];
        if (!file) return alert('Selecciona un archivo.');
        
        openEditor(file, (editedBlob) => handleSubirCardImage(editedBlob));
    });
    attach('btn-generar-ai-desc', generarTextoDescripcionPropiedad);
    attach('btn-guardar-ai-desc', guardarTextoDescripcionPropiedad);
}

async function handleSubirCardImage() {
const statusEl = document.getElementById('upload-status-card-image');
    const btn = document.getElementById('upload-card-image-btn');
    
    statusEl.textContent = 'Subiendo y optimizando...';
    statusEl.className = 'text-xs mt-1';
    btn.disabled = true;

    const formData = new FormData();
    // Usar el blob editado
    formData.append('cardImage', imageBlob, 'card-image-edited.jpg');

    try {
        const result = await fetchAPI(`/website-config/propiedad/${currentPropiedad.id}/upload-card-image`, {
            method: 'POST',
            body: formData
        });
        currentWebsiteData.cardImage = result;
        statusEl.textContent = '¡Imagen subida con éxito!';
        statusEl.classList.add('text-green-500');
        
        document.getElementById('preview-card-image-container').innerHTML = `
            <p class="text-xs text-green-600 mb-2 font-medium">Imagen de tarjeta actual:</p>
            <div class="relative w-48 border rounded-md overflow-hidden group">
                <img src="${result.storagePath}" class="w-full h-32 object-cover">
            </div>`;
        document.getElementById('subir-card-image-input').value = '';
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
    } finally {
        btn.disabled = false;
    }
}

async function generarTextoDescripcionPropiedad() {
    const btn = document.getElementById('btn-generar-ai-desc');
    const textarea = document.getElementById('ai-description-textarea');
    btn.disabled = true;
    btn.textContent = 'Generando...';
    try {
        const { texto } = await fetchAPI(`/website-config/propiedad/${currentPropiedad.id}/generate-ai-text`, { method: 'POST' });
        textarea.value = clean(texto);
    } catch (error) {
        alert(`Error: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Generar con IA';
    }
}

async function guardarTextoDescripcionPropiedad() {
    const isListed = currentPropiedad.googleHotelData?.isListed || false;
    const hasCardImage = currentWebsiteData.cardImage?.storagePath;

    if (isListed && !hasCardImage) {
        return alert('Error: Propiedad "Listada" requiere Imagen Principal antes de guardar.');
    }

    const aiDescription = document.getElementById('ai-description-textarea').value;
    const statusEl = document.getElementById('save-ai-description-status');
    statusEl.textContent = 'Guardando...';
    statusEl.className = 'text-xs mt-1';

    try {
        await fetchAPI(`/website-config/propiedad/${currentPropiedad.id}`, {
            method: 'PUT',
            body: { aiDescription }
        });
        statusEl.textContent = 'Guardado con éxito.';
        currentWebsiteData.aiDescription = aiDescription;
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
    }
}