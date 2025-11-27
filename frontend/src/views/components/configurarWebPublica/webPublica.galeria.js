import { fetchAPI } from '../../../api.js';
// import { openEditor } from '../../../utils/imageEditorModal.js'; // Desactivamos editor en wizard por simplicidad

let currentPropiedadId = null;
let currentImages = {};
let activeWizard = null; // Estado del wizard activo

const clean = (val) => (val === undefined || val === null || val === 'undefined') ? '' : val;

// --- Lógica del Wizard ---

const startWizard = (componentId, shotList) => {
    activeWizard = {
        componentId,
        shotList: shotList || ['Vista General'], // Fallback si no hay lista
        currentStep: 0,
        uploadedInSession: []
    };
    renderWizardModal();
};

const closeWizard = () => {
    activeWizard = null;
    document.getElementById('wizard-modal').remove();
    // Recargar la galería principal para mostrar las nuevas fotos
    const componentId = activeWizard?.componentId;
    if (componentId) {
         document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
         document.getElementById(`ai-feedback-${componentId}`).classList.add('hidden'); // Limpiar feedback viejo
    }
};

const handleWizardUpload = async (file) => {
    if (!activeWizard || !file) return;
    
    const stepData = activeWizard.shotList[activeWizard.currentStep];
    const wizardBody = document.getElementById('wizard-body');
    wizardBody.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 space-y-4">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p class="text-lg text-indigo-800 font-medium">Analizando imagen...</p>
            <p class="text-sm text-gray-600">Verificando requisito: "${stepData}"</p>
        </div>
    `;
    document.getElementById('wizard-next-btn').disabled = true;

    const formData = new FormData();
    formData.append('images', file);
    formData.append('shotContext', stepData); // ¡Enviamos el contexto a la IA!

    try {
        const resultados = await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/upload-image/${activeWizard.componentId}`, {
            method: 'POST',
            body: formData
        });

        const imagenSubida = resultados[0];
        
        if (imagenSubida.advertencia) {
            // FALLÓ LA VALIDACIÓN
            renderWizardStep('error', imagenSubida);
        } else {
            // ÉXITO
            activeWizard.uploadedInSession.push(imagenSubida);
            
            // Actualizar estado global de imágenes
            if (!currentImages[activeWizard.componentId]) currentImages[activeWizard.componentId] = [];
            currentImages[activeWizard.componentId].push(imagenSubida);

            activeWizard.currentStep++;
            if (activeWizard.currentStep >= activeWizard.shotList.length) {
                renderWizardStep('finish');
            } else {
                renderWizardStep('upload');
            }
        }

    } catch (error) {
        alert('Error crítico en el wizard: ' + error.message);
        closeWizard();
    }
};

const renderWizardStep = (state = 'upload', errorData = null) => {
    const wizardBody = document.getElementById('wizard-body');
    const nextBtn = document.getElementById('wizard-next-btn');
    const totalSteps = activeWizard.shotList.length;
    const stepIndex = activeWizard.currentStep;
    
    // Actualizar título y progreso
    document.getElementById('wizard-title').textContent = `Asistente de Fotos: Paso ${stepIndex + 1} de ${totalSteps}`;
    const progressPercent = ((stepIndex) / totalSteps) * 100;
    document.getElementById('wizard-progress-bar').style.width = `${progressPercent}%`;

    if (state === 'upload') {
        const requirement = activeWizard.shotList[stepIndex];
        wizardBody.innerHTML = `
            <div class="text-center py-6">
                <h4 class="text-xl font-bold text-gray-800 mb-2">Requisito: ${requirement}</h4>
                <p class="text-sm text-gray-500 mb-6">Sube una foto que cumpla exactamente con esta descripción.</p>
                
                <label for="wizard-file-input" class="cursor-pointer flex flex-col items-center justify-center h-48 border-2 border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors bg-white">
                    <span class="text-4xl mb-2">📸</span>
                    <span class="text-indigo-600 font-medium">Seleccionar foto para "${requirement}"</span>
                    <input type="file" id="wizard-file-input" accept="image/*" class="hidden">
                </label>
            </div>
        `;
        nextBtn.textContent = 'Omitir este paso (No recomendado)';
        nextBtn.onclick = () => {
            if(confirm('¿Seguro que quieres saltar este requisito? La IA podría penalizar el SEO.')){
                 activeWizard.currentStep++;
                 renderWizardStep(activeWizard.currentStep >= totalSteps ? 'finish' : 'upload');
            }
        };
        
        document.getElementById('wizard-file-input').addEventListener('change', (e) => {
            if (e.target.files[0]) handleWizardUpload(e.target.files[0]);
        });

    } else if (state === 'error') {
        wizardBody.innerHTML = `
            <div class="text-center py-6 bg-red-50 rounded-lg border border-red-200 p-4">
                <span class="text-5xl block mb-2">⚠️</span>
                <h4 class="text-xl font-bold text-red-800 mb-2">La IA ha rechazado la imagen</h4>
                <p class="text-md text-red-700 font-medium mb-4">${errorData.advertencia}</p>
                
                <div class="h-32 w-32 mx-auto mb-4 rounded-md overflow-hidden border-2 border-red-300">
                    <img src="${errorData.storagePath}" class="w-full h-full object-cover grayscale opacity-75">
                </div>
                
                <p class="text-sm text-gray-600 mb-4">Esta imagen no se usará para este requisito. Por favor, intenta con otra.</p>
                
                <button id="retry-step-btn" class="btn-primary bg-red-600 hover:bg-red-700">Intentar de nuevo</button>
            </div>
        `;
        // Borrar la imagen mala del estado global para que no salga en la galería final
        if (currentImages[activeWizard.componentId]) {
             currentImages[activeWizard.componentId] = currentImages[activeWizard.componentId].filter(img => img.imageId !== errorData.imageId);
        }
        // Eliminar del backend (opcional, para no llenar storage de basura, se puede implementar después)

        nextBtn.disabled = true;
        document.getElementById('retry-step-btn').addEventListener('click', () => renderWizardStep('upload'));

    } else if (state === 'finish') {
        document.getElementById('wizard-progress-bar').style.width = `100%`;
        wizardBody.innerHTML = `
            <div class="text-center py-10">
                <span class="text-6xl block mb-4">🎉</span>
                <h4 class="text-2xl font-bold text-green-800 mb-2">¡Galería Completada con Éxito!</h4>
                <p class="text-gray-600">Has subido ${activeWizard.uploadedInSession.length} fotos validadas por la IA para este espacio.</p>
            </div>
        `;
        nextBtn.textContent = 'Finalizar y Cerrar';
        nextBtn.disabled = false;
        nextBtn.onclick = closeWizard;
    }
};

const renderWizardModal = () => {
    const modalHtml = `
        <div id="wizard-modal" class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
                <div class="bg-indigo-600 p-4 text-white flex justify-between items-center">
                    <h3 id="wizard-title" class="text-lg font-bold">Asistente de Fotos</h3>
                    <button id="wizard-close-btn" class="text-indigo-200 hover:text-white text-2xl">&times;</button>
                </div>
                <div class="h-2 bg-indigo-100">
                    <div id="wizard-progress-bar" class="h-full bg-green-500 transition-all duration-500" style="width: 0%"></div>
                </div>
                <div id="wizard-body" class="p-6 min-h-[400px] flex flex-col justify-center">
                    </div>
                <div class="bg-gray-50 p-4 flex justify-end border-t">
                    <button id="wizard-next-btn" class="btn-secondary">Omitir</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('wizard-close-btn').addEventListener('click', closeWizard);
    renderWizardStep('upload');
};


// --- Funciones Principales de la Galería ---

export function initGaleria(propiedadId, images) {
    currentPropiedadId = propiedadId;
    currentImages = images || {};
}

export function renderGaleria(componentes, tiposMaestros = []) {
    if (!componentes || componentes.length === 0) {
        return `<p class="text-sm text-gray-500 p-4 border border-yellow-200 bg-yellow-50 rounded">
            ⚠️ Esta propiedad no tiene componentes definidos.
        </p>`;
    }
    return `
        <div class="space-y-8">
            ${componentes.map(comp => renderComponenteBloque(comp, tiposMaestros)).join('')}
        </div>
    `;
}

function renderComponenteBloque(componente, tiposMaestros) {
    const imagenes = currentImages[componente.id] || [];
    
    // 1. Buscar definición y Shot List
    const tipoDefinicion = tiposMaestros.find(t => t.id === componente.tipoId) 
                        || tiposMaestros.find(t => t.nombreNormalizado === componente.tipo); 
    
    const hasShotList = tipoDefinicion && tipoDefinicion.shotList && tipoDefinicion.shotList.length > 0;
    const shotListJson = hasShotList ? JSON.stringify(tipoDefinicion.shotList).replace(/"/g, '&quot;') : '[]';

    // 2. Renderizar guía visual (Shot List pasivo)
    let checklistHtml = '';
    if (hasShotList) {
        const itemsHtml = tipoDefinicion.shotList.map((req, idx) => {
            // Verificar si ya tenemos una foto que cumpla este requisito (lógica simple por ahora)
            const cumplido = imagenes.some(img => !img.advertencia && idx < imagenes.length); // Aproximación
            return `
            <li class="flex items-center gap-2 text-xs ${cumplido ? 'text-green-700 font-medium' : 'text-gray-600'}">
                <span class="${cumplido ? 'text-green-500' : 'text-indigo-300'}">${cumplido ? '✓' : '○'}</span> ${req}
            </li>`;
        }).join('');
        
        checklistHtml = `
            <div class="bg-indigo-50 border border-indigo-100 rounded-md p-4">
                <div class="flex justify-between items-start mb-3">
                    <div>
                         <h5 class="text-sm font-bold text-indigo-800 flex items-center gap-2">
                            ${tipoDefinicion.icono || '📸'} Lista de Tomas Requeridas (IA)
                         </h5>
                        <p class="text-xs text-indigo-600 mt-1">Sigue esta guía para un SEO perfecto.</p>
                    </div>
                    <button class="start-wizard-btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 shadow-sm" 
                            data-component-id="${componente.id}" 
                            data-shot-list="${shotListJson}">
                        <span>✨</span> Iniciar Asistente Guiado
                    </button>
                </div>
                <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    ${itemsHtml}
                </ul>
            </div>
        `;
    }

    // 3. Renderizar bloque principal
    return `
        <fieldset class="border border-gray-200 p-5 rounded-lg bg-white shadow-sm relative">
            <legend class="px-3 font-bold text-gray-800 text-lg flex items-center gap-2 bg-white border rounded-md shadow-sm py-1">
                ${componente.nombre} 
                <span class="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wider">${componente.tipo}</span>
            </legend>
            
            <div class="space-y-5 mt-2">
                ${checklistHtml}

                <div id="ai-feedback-${componente.id}" class="hidden p-4 bg-red-50 border-l-4 border-red-500 text-red-800 rounded shadow-sm"></div>

                <div id="galeria-${componente.id}" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${renderImagenesGrid(imagenes, componente.id)}
                </div>

                <div class="mt-4 pt-4 border-t border-gray-100">
                     <p class="text-xs text-gray-400 mb-2 text-center uppercase tracking-widest font-bold">O subida manual sin asistente</p>
                    <label for="input-${componente.id}" class="group flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer bg-gray-50">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400 group-hover:text-indigo-600 transition-colors mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span class="text-sm text-gray-600 group-hover:text-indigo-700 font-medium">Arrastra fotos aquí o haz click</span>
                        <input type="file" multiple accept="image/*" id="input-${componente.id}" data-component-id="${componente.id}" class="subir-imagenes-input hidden">
                    </label>
                    <div id="upload-status-${componente.id}" class="text-center text-xs mt-2 text-gray-500 min-h-[20px]"></div>
                </div>
            </div>
        </fieldset>`;
}

function renderImagenesGrid(imagenes, componentId) {
    if (imagenes.length === 0) return '<p class="text-sm text-gray-500 col-span-full py-8 text-center italic bg-gray-50 rounded border border-dashed">No hay imágenes. Usa el Asistente ✨ para empezar.</p>';
    
    return imagenes.map(img => {
        const tieneAdvertencia = !!img.advertencia;
        const statusHtml = tieneAdvertencia
            ? `<div class="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 cursor-help z-10" title="${img.advertencia}">⚠️ Revisar</div>`
            : `<div class="absolute top-1 right-1 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 z-10">✅ OK</div>`;

        const bordeClass = tieneAdvertencia ? "border-red-500 ring-2 ring-red-100" : "border-gray-200 hover:border-indigo-300";

        // FIX CSS GRID: Usamos aspect-square en el contenedor
        return `
        <div class="relative border-2 ${bordeClass} rounded-lg overflow-hidden group bg-white flex flex-col shadow-sm hover:shadow-lg transition-all duration-300">
            ${statusHtml}
            <div class="relative w-full aspect-square bg-gray-100">
                <img src="${img.storagePath}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                    <button data-component-id="${componentId}" data-image-id="${img.imageId}" class="eliminar-imagen-btn bg-white text-red-600 p-2 rounded-full hover:bg-red-100 shadow-sm transition-transform hover:scale-110" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
            </div>

            <div class="p-2 bg-white flex-grow flex flex-col justify-end border-t border-gray-50">
                <p class="text-gray-900 font-semibold text-xs truncate leading-tight mb-0.5" title="${img.title}">${img.title || 'Sin Título'}</p>
                <p class="text-gray-500 text-[10px] truncate" title="${clean(img.altText)}">${clean(img.altText) || '...'}</p>
            </div>
        </div>
    `}).join('');
}

export function setupGaleriaEvents() {
    // Eventos para el botón del Wizard
    document.querySelectorAll('.start-wizard-btn').forEach(btn => {
        // Clonar para evitar listeners duplicados si se renderiza varias veces
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            const componentId = e.currentTarget.dataset.componentId;
            const shotList = JSON.parse(e.currentTarget.dataset.shotList);
            startWizard(componentId, shotList);
        });
    });

    // Eventos de subida manual y eliminación (se mantienen igual)
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
        });
    });
}

// ... (Funciones auxiliares mostrarFeedbackIA, handleSubirMasivo, handleEliminar se mantienen igual que en la versión anterior, si las necesitas te las paso, pero el foco era el wizard)
async function mostrarFeedbackIA(componentId, resultados) { /* ... código anterior ... */ }
async function handleSubirMasivo(componentId, files) { /* ... código anterior para subida manual ... */ }
async function handleEliminar(componentId, imageId) { /* ... código anterior ... */ }