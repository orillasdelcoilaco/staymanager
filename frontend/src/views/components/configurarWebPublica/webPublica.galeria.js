// frontend/src/views/components/configurarWebPublica/webPublica.galeria.js
import { fetchAPI } from '../../../api.js';
import { openEditor } from '../../../utils/imageEditorModal.js';

let currentPropiedadId = null;
let currentImages = {};
let activeWizard = null;

const clean = (val) => (val === undefined || val === null || val === 'undefined') ? '' : val;

// --- Lógica del Wizard ---

const startWizard = (componentId, shotList) => {
    activeWizard = {
        componentId,
        shotList: shotList || ['Vista General'],
        currentStep: 0,
        uploadedInSession: []
    };
    renderWizardModal();
};

const closeWizard = () => {
    const componentId = activeWizard?.componentId;
    const modal = document.getElementById('wizard-modal');
    if (modal) modal.remove();
    
    // CRÍTICO: Actualizar la UI con las nuevas fotos
    if (componentId) {
         const container = document.getElementById(`galeria-${componentId}`);
         if (container) {
             container.innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
         }
    }
    activeWizard = null;
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
    formData.append('shotContext', stepData);

    try {
        const resultados = await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/upload-image/${activeWizard.componentId}`, {
            method: 'POST',
            body: formData
        });

        const imagenSubida = resultados[0];
        
        // Actualizar estado global INMEDIATAMENTE
        if (!currentImages[activeWizard.componentId]) currentImages[activeWizard.componentId] = [];
        currentImages[activeWizard.componentId].push(imagenSubida);

        if (imagenSubida.advertencia) {
            renderWizardStep('error', imagenSubida);
        } else {
            activeWizard.uploadedInSession.push(imagenSubida);
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
    
    document.getElementById('wizard-title').textContent = `Asistente de Fotos: Paso ${stepIndex + 1} de ${totalSteps}`;
    const progressPercent = ((stepIndex) / totalSteps) * 100;
    document.getElementById('wizard-progress-bar').style.width = `${progressPercent}%`;

    if (state === 'upload') {
        const requirement = activeWizard.shotList[stepIndex];
        wizardBody.innerHTML = `
            <div class="text-center py-6">
                <h4 class="text-xl font-bold text-gray-800 mb-2">Requisito: ${requirement}</h4>
                <p class="text-sm text-gray-500 mb-6">Sube una foto que cumpla exactamente con esta descripción.</p>
                
                <label for="wizard-file-input" class="cursor-pointer flex flex-col items-center justify-center h-32 border-2 border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors bg-white max-w-sm mx-auto">
                    <span class="text-3xl mb-2">📸</span>
                    <span class="text-indigo-600 font-medium text-sm">Seleccionar foto</span>
                    <input type="file" id="wizard-file-input" accept="image/*" class="hidden">
                </label>
            </div>
        `;
        nextBtn.textContent = 'Saltar este paso';
        nextBtn.onclick = () => {
            if(confirm('¿Saltar requisito?')){
                 activeWizard.currentStep++;
                 renderWizardStep(activeWizard.currentStep >= totalSteps ? 'finish' : 'upload');
            }
        };
        
        document.getElementById('wizard-file-input').addEventListener('change', (e) => {
            if (e.target.files[0]) handleWizardUpload(e.target.files[0]);
        });

    } else if (state === 'error') {
        wizardBody.innerHTML = `
            <div class="text-center py-4 bg-red-50 rounded-lg border border-red-200 p-4">
                <h4 class="text-lg font-bold text-red-800 mb-2">⚠️ Rechazada por el Auditor</h4>
                <p class="text-sm text-red-700 font-medium mb-4">${errorData.advertencia}</p>
                <div class="h-24 w-24 mx-auto mb-4 rounded-md overflow-hidden border border-red-300">
                    <img src="${errorData.storagePath}" class="w-full h-full object-cover grayscale">
                </div>
                <button id="retry-step-btn" class="btn-primary bg-red-600 hover:bg-red-700 btn-sm">Intentar otra foto</button>
            </div>
        `;
        // La imagen ya se guardó (con advertencia), pero la quitamos del wizard session para no contarla como éxito
        nextBtn.disabled = true;
        document.getElementById('retry-step-btn').addEventListener('click', () => renderWizardStep('upload'));

    } else if (state === 'finish') {
        document.getElementById('wizard-progress-bar').style.width = `100%`;
        wizardBody.innerHTML = `
            <div class="text-center py-8">
                <span class="text-5xl block mb-4">🎉</span>
                <h4 class="text-xl font-bold text-green-800 mb-2">¡Excelente!</h4>
                <p class="text-gray-600 text-sm">Has completado la sesión de fotos para este espacio.</p>
            </div>
        `;
        nextBtn.textContent = 'Finalizar';
        nextBtn.disabled = false;
        nextBtn.onclick = closeWizard;
    }
};

const renderWizardModal = () => {
    const modalHtml = `
        <div id="wizard-modal" class="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div class="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div class="bg-indigo-600 p-3 text-white flex justify-between items-center">
                    <h3 id="wizard-title" class="text-md font-bold">Asistente</h3>
                    <button id="wizard-close-btn" class="text-indigo-200 hover:text-white text-xl">&times;</button>
                </div>
                <div class="h-1 bg-indigo-100">
                    <div id="wizard-progress-bar" class="h-full bg-green-500 transition-all duration-500" style="width: 0%"></div>
                </div>
                <div id="wizard-body" class="p-4 min-h-[300px] flex flex-col justify-center"></div>
                <div class="bg-gray-50 p-3 flex justify-end border-t">
                    <button id="wizard-next-btn" class="btn-secondary text-xs">Omitir</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('wizard-close-btn').addEventListener('click', closeWizard);
    renderWizardStep('upload');
};

// --- Funciones Principales ---

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
        <div class="space-y-6">
            <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                Galería por Áreas 
                <span class="text-xs font-normal bg-green-100 text-green-800 px-2 py-1 rounded-full">Auditor IA Activo</span>
            </h3>
            <div id="galerias-wrapper">
                ${componentes.map(comp => renderComponenteBloque(comp, tiposMaestros)).join('')}
            </div>
        </div>
    `;
}

function renderComponenteBloque(componente, tiposMaestros) {
    const imagenes = currentImages[componente.id] || [];
    const tipoDefinicion = tiposMaestros.find(t => t.id === componente.tipoId) 
                        || tiposMaestros.find(t => t.nombreNormalizado === componente.tipo); 
    
    const hasShotList = tipoDefinicion && tipoDefinicion.shotList && tipoDefinicion.shotList.length > 0;
    const shotListJson = hasShotList ? JSON.stringify(tipoDefinicion.shotList).replace(/"/g, '&quot;') : '[]';

    let checklistHtml = '';
    if (hasShotList) {
        const itemsHtml = tipoDefinicion.shotList.map((req, idx) => {
            const cumplido = imagenes.some(img => !img.advertencia && idx < imagenes.length);
            return `
            <li class="flex items-center gap-2 text-xs ${cumplido ? 'text-green-700 font-medium' : 'text-gray-600'}">
                <span class="${cumplido ? 'text-green-500' : 'text-indigo-300'}">${cumplido ? '✓' : '○'}</span> ${req}
            </li>`;
        }).join('');
        
        checklistHtml = `
            <div class="bg-indigo-50 border border-indigo-100 rounded-md p-3 mb-4">
                <div class="flex justify-between items-center mb-2">
                     <h5 class="text-xs font-bold text-indigo-800 flex items-center gap-1">
                        ${tipoDefinicion.icono || '📸'} Requisitos
                     </h5>
                    <button class="start-wizard-btn btn-primary py-1 px-2 text-[10px] flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 shadow-sm h-6" 
                            data-component-id="${componente.id}" 
                            data-shot-list="${shotListJson}">
                        <span>✨</span> Iniciar Asistente
                    </button>
                </div>
                <ul class="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    ${itemsHtml}
                </ul>
            </div>
        `;
    }

    return `
        <fieldset class="border border-gray-200 p-4 rounded-lg bg-white shadow-sm relative">
            <legend class="px-2 font-bold text-gray-700 text-sm flex items-center gap-2 bg-white border rounded-md shadow-sm py-1">
                ${componente.nombre} 
                <span class="text-[10px] font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">${componente.tipo}</span>
            </legend>
            
            <div class="mt-2">
                ${checklistHtml}

                <div id="ai-feedback-${componente.id}" class="hidden p-3 mb-3 bg-red-50 border-l-4 border-red-500 text-red-800 text-xs rounded shadow-sm"></div>

                <div id="galeria-${componente.id}" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    ${renderImagenesGrid(imagenes, componente.id)}
                </div>

                <div class="mt-3 pt-3 border-t border-gray-100">
                    <label for="input-${componente.id}" class="group flex flex-row items-center justify-center gap-2 p-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer bg-gray-50 h-16"> <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span class="text-xs text-gray-600 group-hover:text-indigo-700 font-medium">Subir fotos manualmente</span>
                        <input type="file" multiple accept="image/*" id="input-${componente.id}" data-component-id="${componente.id}" class="subir-imagenes-input hidden">
                    </label>
                    <div id="upload-status-${componente.id}" class="text-center text-[10px] mt-1 text-gray-500 min-h-[16px]"></div>
                </div>
            </div>
        </fieldset>`;
}

function renderImagenesGrid(imagenes, componentId) {
    if (imagenes.length === 0) return '<p class="text-xs text-gray-400 col-span-full py-4 text-center italic">Sin imágenes.</p>';
    
    return imagenes.map(img => {
        const tieneAdvertencia = !!img.advertencia;
        const statusHtml = tieneAdvertencia
            ? `<div class="absolute top-1 right-1 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 cursor-help z-10" title="${img.advertencia}">⚠️ Alerta</div>`
            : `<div class="absolute top-1 right-1 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10">✅</div>`;

        const bordeClass = tieneAdvertencia ? "border-red-400 ring-2 ring-red-50" : "border-gray-200 hover:border-indigo-300";

        return `
        <div class="relative border ${bordeClass} rounded-md overflow-hidden group bg-white shadow-sm hover:shadow-md transition-all">
            <div class="relative w-full aspect-square bg-gray-100">
                <img src="${img.storagePath}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                    <button data-component-id="${componentId}" data-image-id="${img.imageId}" class="eliminar-imagen-btn bg-white text-red-600 p-1.5 rounded-full hover:bg-red-100 shadow-sm transition-transform hover:scale-110" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                    </button>
                    <button data-component-id="${componentId}" data-image-url="${img.storagePath}" data-old-image-id="${img.imageId}" class="editar-existente-btn bg-white text-blue-600 p-1.5 rounded-full hover:bg-blue-100 shadow-sm transition-transform hover:scale-110" title="Recortar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                    </button>
                </div>
                ${statusHtml}
            </div>

            <div class="px-2 py-1.5 border-t border-gray-50 bg-white">
                <p class="text-gray-900 font-medium text-[10px] truncate" title="${img.title}">${img.title || 'Sin Título'}</p>
                <p class="text-gray-400 text-[9px] truncate" title="${clean(img.altText)}">${clean(img.altText) || '...'}</p>
            </div>
        </div>
    `}).join('');
}

export function setupGaleriaEvents() {
    // Delegación de eventos en el wrapper principal (MÁS ROBUSTO)
    const wrapper = document.getElementById('galerias-wrapper');
    if (wrapper) {
        // Clonar para limpiar listeners viejos
        const newWrapper = wrapper.cloneNode(true);
        wrapper.parentNode.replaceChild(newWrapper, wrapper);

        newWrapper.addEventListener('click', (e) => {
            // Wizard
            const btnWizard = e.target.closest('.start-wizard-btn');
            if (btnWizard) {
                const componentId = btnWizard.dataset.componentId;
                const shotList = JSON.parse(btnWizard.dataset.shotList);
                startWizard(componentId, shotList);
                return;
            }

            // Eliminar
            const btnEliminar = e.target.closest('.eliminar-imagen-btn');
            if (btnEliminar) {
                handleEliminar(btnEliminar.dataset.componentId, btnEliminar.dataset.imageId);
                return;
            }
            
            // Editar
            const btnEditar = e.target.closest('.editar-existente-btn');
            if (btnEditar) {
                openEditor(btnEditar.dataset.imageUrl, (blob) => handleReemplazarImagen(btnEditar.dataset.componentId, blob, btnEditar.dataset.oldImageId));
                return;
            }
        });

        // Listeners para inputs de archivo (delegados o directos, aquí directos es más fácil por el change event)
        newWrapper.querySelectorAll('.subir-imagenes-input').forEach(input => {
            input.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleSubirMasivo(e.target.dataset.componentId, e.target.files);
                }
            });
        });
    }
}

async function mostrarFeedbackIA(componentId, resultados) {
    const feedbackContainer = document.getElementById(`ai-feedback-${componentId}`);
    if (!feedbackContainer) return;

    const errores = resultados.filter(r => r.advertencia);
    if (errores.length > 0) {
        const listaErrores = errores.map(err => `<li class="mb-1">• ${err.advertencia}</li>`).join('');
        feedbackContainer.innerHTML = `
            <p class="font-bold mb-1">⚠️ Atención:</p>
            <ul class="list-none pl-0">${listaErrores}</ul>
        `;
        feedbackContainer.classList.remove('hidden');
    } else {
        feedbackContainer.classList.add('hidden');
    }
}

async function handleSubirMasivo(componentId, files) {
    const statusEl = document.getElementById(`upload-status-${componentId}`);
    statusEl.textContent = `Subiendo ${files.length}...`;
    
    const formData = new FormData();
    for (const file of files) formData.append('images', file);

    try {
        const resultados = await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/upload-image/${componentId}`, { method: 'POST', body: formData });
        if (!currentImages[componentId]) currentImages[componentId] = [];
        currentImages[componentId].push(...resultados);
        
        document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
        mostrarFeedbackIA(componentId, resultados);
        
        statusEl.textContent = 'Listo.';
        setTimeout(() => statusEl.textContent = '', 2000);
        
        const input = document.getElementById(`input-${componentId}`);
        if(input) input.value = '';
    } catch (error) {
        statusEl.textContent = 'Error.';
        alert(error.message);
    }
}

async function handleReemplazarImagen(componentId, blob, oldImageId) {
    // Lógica idéntica a la anterior
    const formData = new FormData();
    formData.append('images', blob, 'edited.jpg');
    try {
        const resultados = await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/upload-image/${componentId}`, { method: 'POST', body: formData });
        await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/delete-image/${componentId}/${oldImageId}`, { method: 'DELETE' });
        
        currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== oldImageId);
        currentImages[componentId].push(...resultados);
        
        document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
    } catch (error) { alert(error.message); }
}

async function handleEliminar(componentId, imageId) {
    if (!confirm('¿Eliminar imagen?')) return;
    try {
        await fetchAPI(`/website-config/propiedad/${currentPropiedadId}/delete-image/${componentId}/${imageId}`, { method: 'DELETE' });
        currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== imageId);
        document.getElementById(`galeria-${componentId}`).innerHTML = renderImagenesGrid(currentImages[componentId], componentId);
    } catch (error) { alert(error.message); }
}