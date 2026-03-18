// frontend/src/views/components/configurarWebPublica/webPublica.galeria.js
import { fetchAPI } from '../../../api.js';
import { openEditor } from '../../../utils/imageEditorModal.js';

let currentPropiedadId = null;
let currentImages = {};
let activeWizard = null;
let currentPhotoPlan = {};

const clean = (val) => (val === undefined || val === null || val === 'undefined') ? '' : val;

// --- Lógica del Wizard ---

// shotList puede ser array de strings O array de objetos { description, guidelines }
const startWizard = (componentId, shotList, componentName = 'Espacio', componentType = 'General', startStep = 0) => {
    // Normalizar a objetos siempre
    const normalizedShots = (shotList || ['Vista General']).map(s =>
        typeof s === 'string' ? { description: s, guidelines: null } : s
    );
    activeWizard = {
        componentId,
        componentName,
        componentType,
        shotList: normalizedShots,
        currentStep: startStep,
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
            container.innerHTML = renderSlotsGrid(currentImages[componentId], componentId);
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
            <p class="text-sm text-gray-600">Verificando cumplimiento: "${stepData}"</p>
            <p class="text-xs text-gray-400 mt-2">Optimizando y generando metadatos SEO...</p>
        </div>
    `;
    document.getElementById('wizard-next-btn').disabled = true;

    const formData = new FormData();
    formData.append('images', file);
    formData.append('shotContext', stepData);

    try {
        const resultados = await fetchAPI(`/website/propiedad/${currentPropiedadId}/upload-image/${activeWizard.componentId}`, {
            method: 'POST',
            body: formData
        });

        const imagenSubida = resultados[0];

        // IMPORTANTE: NO agregamos a currentImages si hay error, para obligar a reintentar
        // PERO el backend ya la guardó. Si es "strict blocking", idealmente deberíamos borrarla si el usuario cancela,
        // pero por ahora solo le impedimos avanzar.
        if (!currentImages[activeWizard.componentId]) currentImages[activeWizard.componentId] = [];

        // Solo la agregamos visualmente si NO tiene advertencia grave, 
        // O si decidimos que advertencia = guardada pero con flag.
        // El requisito dice "Rechace la foto": Asumiremos que el backend la guarda con flag, pero el wizard NO avanza.

        currentImages[activeWizard.componentId].push(imagenSubida);

        if (imagenSubida.advertencia) {
            // ESTADO: RECHAZADO (Strict Mode)
            renderWizardStep('error', imagenSubida);
        } else {
            // ESTADO: APROBADO
            activeWizard.uploadedInSession.push(imagenSubida);
            activeWizard.currentStep++;
            if (activeWizard.currentStep >= activeWizard.shotList.length) {
                renderWizardStep('finish');
            } else {
                renderWizardStep('success_transition', imagenSubida); // Nuevo estado para feedback positivo breve
            }
        }

    } catch (error) {
        alert('Error crítico en el wizard: ' + error.message);
        closeWizard();
    }
};

const renderWizardStep = (state = 'upload', data = null) => {
    const wizardBody = document.getElementById('wizard-body');
    const nextBtn = document.getElementById('wizard-next-btn');
    const totalSteps = activeWizard.shotList.length;
    const stepIndex = activeWizard.currentStep;
    const currentShot = activeWizard.shotList[stepIndex];
    const currentRequirement = currentShot?.description || currentShot;

    // Header Info
    document.getElementById('wizard-title').innerHTML = `
        <div class="flex flex-col">
            <span class="text-xs uppercase tracking-wider text-indigo-200">${activeWizard.componentName} (${activeWizard.componentType})</span>
            <span>Paso ${stepIndex + 1} de ${totalSteps}</span>
        </div>
    `;
    const progressPercent = ((stepIndex) / totalSteps) * 100;
    document.getElementById('wizard-progress-bar').style.width = `${progressPercent}%`;

    // Re-bind del botón Omitir/Saltar
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

    if (state === 'upload') {
        wizardBody.innerHTML = `
            <div class="text-center py-4">
                <div class="mb-6">
                    <span class="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold mb-2">Requisito Obligatorio</span>
                    <h4 class="text-2xl font-bold text-gray-800">"${currentRequirement}"</h4>
                </div>
                
                <div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-left max-w-sm mx-auto">
                    <p class="text-xs font-bold text-blue-800 mb-1">💡 Guía para esta foto:</p>
                    ${currentShot?.guidelines
                        ? `<p class="text-xs text-blue-700 leading-relaxed">${currentShot.guidelines}</p>`
                        : `<ul class="text-xs text-blue-700 list-disc pl-4 space-y-1">
                            <li>Asegura buena iluminación (luz natural ideal).</li>
                            <li>El elemento principal debe ser el foco central.</li>
                            <li>Evita fotos borrosas o movidas.</li>
                           </ul>`
                    }
                </div>
                
                <label for="wizard-file-input" class="cursor-pointer flex flex-col items-center justify-center h-40 border-2 border-dashed border-indigo-400 rounded-xl hover:bg-indigo-50 transition-all bg-white max-w-sm mx-auto shadow-sm group">
                    <div class="p-3 bg-indigo-100 rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <span class="text-3xl">📸</span>
                    </div>
                    <span class="text-indigo-700 font-bold text-sm">Subir Foto Requerida</span>
                    <span class="text-gray-400 text-xs mt-1">Click para seleccionar</span>
                    <input type="file" id="wizard-file-input" accept="image/*" class="hidden">
                </label>
            </div>
        `;

        // FIX: Ensure button is visible and styled as a button
        newNextBtn.style.display = 'block';
        newNextBtn.textContent = 'Saltar este paso';
        newNextBtn.className = 'px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium';
        newNextBtn.disabled = false;
        newNextBtn.onclick = () => {
            // Lógica de SALTAR
            activeWizard.currentStep++;
            if (activeWizard.currentStep >= totalSteps) {
                renderWizardStep('finish');
            } else {
                renderWizardStep('upload');
            }
        };

        document.getElementById('wizard-file-input').addEventListener('change', (e) => {
            if (e.target.files[0]) handleWizardUpload(e.target.files[0]);
        });

    } else if (state === 'success_transition') {
        // Paso intermedio de éxito
        wizardBody.innerHTML = `
            <div class="text-center py-10 fade-in-up">
                <div class="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="text-3xl">✅</span>
                </div>
                <h4 class="text-xl font-bold text-green-800 mb-2">¡Foto Aprobada!</h4>
                <p class="text-gray-600 mb-4">IA detectó correctamente: "${data.title}"</p>
                <div class="h-48 w-full max-w-xs mx-auto rounded-lg overflow-hidden border-2 border-green-200 shadow-md bg-gray-100">
                    <img src="${data.storagePath}" class="w-full h-full object-contain">
                </div>
            </div>
        `;
        // Auto-advance after 1.5s
        setTimeout(() => {
            renderWizardStep('upload');
        }, 1500);
        newNextBtn.style.display = 'none';

    } else if (state === 'error') {
        const errorMsg = data.advertencia || "La imagen no cumple con los requisitos mínimos de calidad o contenido.";

        wizardBody.innerHTML = `
            <div class="text-center py-4 bg-red-50 rounded-xl border border-red-200 p-6 max-w-sm mx-auto">
                <div class="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-200">
                    <span class="text-3xl">🛑</span>
                </div>
                <h4 class="text-lg font-bold text-red-800 mb-2">Imagen Rechazada</h4>
                <p class="text-sm text-red-700 font-medium mb-4 bg-white p-3 rounded border border-red-100 shadow-sm text-left">
                    "${errorMsg}"
                </p>
                <div class="h-40 w-full mx-auto mb-6 rounded-md overflow-hidden border-2 border-red-300 relative bg-gray-100">
                    <img src="${data.storagePath}" class="w-full h-full object-contain opacity-75 grayscale">
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span class="text-4xl drop-shadow-md">❌</span>
                    </div>
                </div>
                
                <div class="space-y-2">
                    <button id="retry-step-btn" class="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center justify-center gap-2">
                        <span>🔄</span> Intentar con otra foto
                    </button>
                    <button id="skip-error-btn" class="w-full py-2 px-4 bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors">
                        Saltar este requisito
                    </button>
                </div>
            </div>
        `;
        newNextBtn.style.display = 'none'; // Ocultamos el botón inferior estándar

        document.getElementById('retry-step-btn').addEventListener('click', () => renderWizardStep('upload'));
        document.getElementById('skip-error-btn').addEventListener('click', () => {
            activeWizard.currentStep++;
            if (activeWizard.currentStep >= totalSteps) {
                renderWizardStep('finish');
            } else {
                renderWizardStep('upload');
            }
        });

    } else if (state === 'finish') {
        document.getElementById('wizard-progress-bar').style.width = `100%`;
        wizardBody.innerHTML = `
            <div class="text-center py-10">
                <div class="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-short">
                    <span class="text-4xl">🎉</span>
                </div>
                <h4 class="text-2xl font-bold text-green-800 mb-2">¡Excelente Trabajo!</h4>
                <p class="text-gray-600 mb-6">Has completado la sesión de fotos para <strong>${activeWizard.componentName}</strong>.</p>
                <p class="text-sm text-gray-500">Todas las fotos han sido optimizadas y etiquetadas para SEO.</p>
                
                <button id="finish-wizard-btn-center" class="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow hover:bg-green-700 transition-colors">
                    Finalizar y Ver Galería
                </button>
            </div>
        `;
        newNextBtn.style.display = 'none';
        document.getElementById('finish-wizard-btn-center').onclick = closeWizard;
    }
};

const renderWizardModal = () => {
    const modalHtml = `
        <div id="wizard-modal" class="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm transition-opacity duration-300">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden transform transition-all scale-100">
                <div class="bg-indigo-700 p-4 text-white flex justify-between items-center bg-pattern">
                    <h3 id="wizard-title" class="text-md font-bold leading-tight">Asistente de Carga</h3>
                    <button id="wizard-close-btn" class="text-indigo-200 hover:text-white text-2xl hover:bg-indigo-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors">&times;</button>
                </div>
                <div class="h-1.5 bg-gray-100 w-full">
                    <div id="wizard-progress-bar" class="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500 ease-out" style="width: 0%"></div>
                </div>
                <div id="wizard-body" class="p-6 min-h-[400px] flex flex-col justify-center bg-white"></div>
                <div class="bg-gray-50 p-4 flex justify-between items-center border-t border-gray-100">
                    <div class="text-xs text-gray-400 italic">🤖 Potenciado por Gemini AI</div>
                    <button id="wizard-next-btn" class="text-gray-400 hover:text-gray-600 text-xs underline">Omitir</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('wizard-close-btn').addEventListener('click', closeWizard);
    renderWizardStep('upload');
};

// --- Funciones Principales ---

export async function initGaleria(propiedadId, images) {
    currentPropiedadId = propiedadId;
    currentImages = images || {};
    try {
        currentPhotoPlan = await fetchAPI(`/website/propiedad/${propiedadId}/photo-plan`);
    } catch (error) {
        console.error("Error fetching photo plan:", error);
        currentPhotoPlan = {};
    }
}

export function renderGaleria(componentes) {
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
            <div id="galerias-wrapper" class="space-y-8">
                ${componentes.map(comp => {
        const images = currentImages[comp.id] || [];
        return `
                        <div class="border rounded-lg p-4 bg-gray-50">
                            <div class="flex justify-between items-center mb-4">
                                <h4 class="font-medium text-gray-700 flex items-center gap-2">
                                    <span class="text-xl">${comp.icono || '📦'}</span>
                                    ${comp.nombre}
                                    <span class="text-xs text-gray-500">(${comp.tipo})</span>
                                </h4>
                                <div class="flex gap-2 flex-wrap">
                                    <button class="start-wizard-btn btn-primary text-xs flex items-center gap-1"
                                        data-component-id="${comp.id}"
                                        data-component-name="${comp.nombre}"
                                        data-component-type="${comp.tipo}"
                                        data-shot-list='${JSON.stringify(currentPhotoPlan[comp.id]?.map(p => ({ description: p.description, guidelines: p.guidelines })) || [{ description: "Vista General", guidelines: null }]).replace(/'/g, "&apos;")}'
                                    >
                                        📸 Asistente IA
                                    </button>
                                    <label class="btn-primary text-xs cursor-pointer flex items-center gap-1">
                                        📤 Subir
                                        <input type="file" multiple accept="image/*" class="subir-imagenes-input hidden" data-component-id="${comp.id}">
                                    </label>
                                    <button class="pick-gallery-btn btn-secondary text-xs flex items-center gap-1"
                                        data-component-id="${comp.id}"
                                        data-component-name="${comp.nombre}"
                                    >
                                        🖼️ Galería
                                    </button>
                                    <button class="eliminar-componente-btn text-xs bg-red-50 text-red-600 border border-red-200 p-1.5 rounded hover:bg-red-100 transition-colors"
                                        title="Eliminar Espacio Completo"
                                        data-component-id="${comp.id}"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            
                            <div id="upload-status-${comp.id}" class="text-xs text-blue-600 mb-2 h-4"></div>
                            <div id="ai-feedback-${comp.id}" class="hidden mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800"></div>

                            <div id="galeria-${comp.id}" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                ${renderSlotsGrid(images, comp.id)}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

function renderSlotsGrid(images, componentId) {
    const plan = currentPhotoPlan[componentId] || [];
    const usedImageIds = new Set();
    let html = '';

    // 1. Renderizar Slots Requeridos
    plan.forEach((req, index) => {
        // Intentar encontrar imagen que coincida (por shotContext o fallback a title)
        const match = images?.find(img =>
            !usedImageIds.has(img.imageId) &&
            (img.shotContext === req.description || img.title === req.description)
        );

        if (match) {
            usedImageIds.add(match.imageId);
            html += renderImageCard(match, componentId, req.description, true);
        } else {
            // Slot Vacío
            html += `
            <div class="relative border-2 border-dashed border-indigo-200 rounded-md bg-indigo-50 flex flex-col items-center justify-center p-4 text-center min-h-[160px] group hover:bg-indigo-100 transition-colors cursor-pointer start-single-slot-wizard"
                 data-component-id="${componentId}"
                 data-requirement="${req.description}"
                 data-step-index="${index}"
            >
                <div class="text-3xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity">📸</div>
                <p class="text-xs font-bold text-indigo-800 mb-1">Requerido</p>
                <p class="text-xs text-indigo-600 leading-tight">${req.description}</p>
                <button class="mt-3 text-[10px] bg-white border border-indigo-300 text-indigo-700 px-2 py-1 rounded shadow-sm hover:bg-indigo-50">
                    Subir Foto
                </button>
            </div>
            `;
        }
    });

    // 2. Renderizar Imágenes Extra (no mapeadas a requisitos)
    if (images) {
        images.forEach(img => {
            if (!usedImageIds.has(img.imageId)) {
                html += renderImageCard(img, componentId, 'Adicional', false);
            }
        });
    }

    if (html === '') return '<p class="text-xs text-gray-400 col-span-full text-center py-4">Sin requisitos ni imágenes.</p>';
    return html;
}

function renderImageCard(img, componentId, label, isRequired) {
    const tieneAdvertencia = !!img.advertencia;
    const statusHtml = tieneAdvertencia
        ? `<div class="absolute top-1 right-1 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 cursor-help z-10" title="${img.advertencia}">⚠️ Alerta</div>`
        : `<div class="absolute top-1 right-1 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10">✅</div>`;

    const bordeClass = tieneAdvertencia ? "border-red-400 ring-2 ring-red-50" : (isRequired ? "border-indigo-200 ring-2 ring-indigo-50" : "border-gray-200");

    return `
    <div class="relative border ${bordeClass} rounded-md overflow-hidden group bg-white shadow-sm hover:shadow-md transition-all">
        <div class="relative w-full aspect-square bg-gray-100 flex items-center justify-center">
            <img src="${img.storagePath}" class="w-full h-full object-contain">
            
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                <button data-component-id="${componentId}" data-image-id="${img.imageId}" class="eliminar-imagen-btn bg-white text-red-600 p-1.5 rounded-full hover:bg-red-100 shadow-sm transition-transform hover:scale-110" title="Eliminar Imagen">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                </button>
                <button data-component-id="${componentId}" data-image-url="${img.storagePath}" data-old-image-id="${img.imageId}" class="editar-existente-btn bg-white text-blue-600 p-1.5 rounded-full hover:bg-blue-100 shadow-sm transition-transform hover:scale-110" title="Recortar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                </button>
            </div>
            ${statusHtml}
        </div>

        <div class="px-2 py-1.5 border-t border-gray-50 bg-white">
            <p class="text-indigo-900 font-bold text-[10px] truncate" title="${label}">${label}</p>
            <p class="text-gray-400 text-[9px] truncate" title="${clean(img.altText)}">${clean(img.altText) || '...'}</p>
        </div>
    </div>
    `;
}

async function openGalleryPicker(componentId, componentName) {
    // Eliminar modal anterior si existe
    document.getElementById('gallery-picker-modal')?.remove();

    // Cargar fotos de la galería (excluyendo descartadas)
    let fotos = [];
    try {
        const all = await fetchAPI(`/galeria/${currentPropiedadId}`);
        fotos = Array.isArray(all) ? all.filter(f => f.estado !== 'descartada') : [];
    } catch (e) {
        alert('Error al cargar la galería.');
        return;
    }

    const selectedIds = new Set();

    const renderGrid = () => fotos.map(f => {
        const imgSrc = f.thumbnailUrl || f.storageUrl || '';
        const conf = Math.round((f.confianza || 0) * 100);
        const isSelected = selectedIds.has(f.id);
        const espacioLabel = f.espacio ? `<span class="text-[9px] text-blue-600 bg-blue-50 px-1 rounded">${f.espacio}</span>` : '';
        return `
        <div class="gallery-pick-item relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent hover:border-gray-300'}"
             data-foto-id="${f.id}">
            <img src="${imgSrc}" alt="" class="w-full h-24 object-cover bg-gray-100">
            ${isSelected ? '<div class="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">✓</div>' : ''}
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-40 px-1 py-0.5 flex items-center gap-1">
                <span class="text-white text-[9px]">${conf}%</span>
                ${espacioLabel}
            </div>
        </div>`;
    }).join('');

    const modalHtml = `
    <div id="gallery-picker-modal" class="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[85vh]">
            <div class="bg-indigo-700 p-4 text-white flex justify-between items-center flex-shrink-0">
                <div>
                    <h3 class="font-bold text-md">Seleccionar desde Galería</h3>
                    <p class="text-indigo-200 text-xs mt-0.5">Para: <strong>${componentName}</strong> — Elige las fotos a asignar</p>
                </div>
                <button id="gp-close" class="text-indigo-200 hover:text-white text-2xl hover:bg-indigo-600 rounded-full w-8 h-8 flex items-center justify-center">&times;</button>
            </div>
            ${fotos.length === 0
                ? `<div class="flex-1 flex items-center justify-center p-10 text-gray-400"><p>No hay fotos en la galería de esta propiedad.</p></div>`
                : `<div id="gp-grid" class="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">${renderGrid()}</div>`
            }
            <div class="bg-gray-50 p-4 flex justify-between items-center border-t border-gray-100 flex-shrink-0">
                <span id="gp-count" class="text-xs text-gray-500">0 fotos seleccionadas</span>
                <div class="flex gap-2">
                    <button id="gp-cancel" class="px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">Cancelar</button>
                    <button id="gp-assign" class="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50" disabled>
                        Asignar a ${componentName}
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const updateUI = () => {
        document.getElementById('gp-count').textContent = `${selectedIds.size} foto${selectedIds.size !== 1 ? 's' : ''} seleccionada${selectedIds.size !== 1 ? 's' : ''}`;
        document.getElementById('gp-assign').disabled = selectedIds.size === 0;
        document.getElementById('gp-grid')?.querySelectorAll('.gallery-pick-item').forEach(el => {
            const id = el.dataset.fotoId;
            const selected = selectedIds.has(id);
            el.classList.toggle('border-blue-500', selected);
            el.classList.toggle('ring-2', selected);
            el.classList.toggle('ring-blue-300', selected);
            el.classList.toggle('border-transparent', !selected);
            const check = el.querySelector('.bg-blue-500');
            if (selected && !check) {
                el.insertAdjacentHTML('beforeend', '<div class="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold pointer-events-none">✓</div>');
            } else if (!selected && check) {
                check.remove();
            }
        });
    };

    document.getElementById('gp-grid')?.addEventListener('click', e => {
        const item = e.target.closest('.gallery-pick-item');
        if (!item) return;
        const id = item.dataset.fotoId;
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        updateUI();
    });

    const closeModal = () => document.getElementById('gallery-picker-modal')?.remove();
    document.getElementById('gp-close').addEventListener('click', closeModal);
    document.getElementById('gp-cancel').addEventListener('click', closeModal);

    document.getElementById('gp-assign').addEventListener('click', async () => {
        if (selectedIds.size === 0) return;
        const btn = document.getElementById('gp-assign');
        btn.disabled = true;
        btn.textContent = 'Asignando...';

        try {
            // Encontrar el nombre del componente desde el wrapper
            const compEl = document.querySelector(`[data-component-id="${componentId}"].pick-gallery-btn`);
            const compName = compEl?.dataset.componentName || componentName;

            // Patch cada foto seleccionada con el componentId
            await Promise.all([...selectedIds].map(fotoId =>
                fetchAPI(`/galeria/${currentPropiedadId}/${fotoId}`, {
                    method: 'PATCH',
                    body: { espacio: compName, espacioId: componentId }
                })
            ));

            // Sincronizar al websiteData.images
            await fetchAPI(`/galeria/${currentPropiedadId}/sync`, { method: 'POST' });

            // Recargar imágenes del componente en el estado local
            const syncResult = await fetchAPI(`/website/propiedad/${currentPropiedadId}/componente/${componentId}`).catch(() => null);
            if (syncResult?.images) {
                currentImages[componentId] = syncResult.images;
            } else {
                // Fallback: construir desde las fotos seleccionadas
                const fotosSeleccionadas = fotos.filter(f => selectedIds.has(f.id));
                if (!currentImages[componentId]) currentImages[componentId] = [];
                fotosSeleccionadas.forEach(f => {
                    const exists = currentImages[componentId].find(i => i.imageId === f.id);
                    if (!exists) {
                        currentImages[componentId].push({
                            imageId: f.id,
                            storagePath: f.storageUrl || f.storageUrl,
                            altText: f.altText || '',
                            title: f.espacio || '',
                            shotContext: null
                        });
                    }
                });
            }

            // Actualizar grid del componente
            const galeriaEl = document.getElementById(`galeria-${componentId}`);
            if (galeriaEl) galeriaEl.innerHTML = renderSlotsGrid(currentImages[componentId], componentId);

            closeModal();
        } catch (e) {
            alert('Error al asignar fotos: ' + e.message);
            btn.disabled = false;
            btn.textContent = `Asignar a ${componentName}`;
        }
    });
}

export function setupGaleriaEvents() {
    // Delegación de eventos en el wrapper principal
    const wrapper = document.getElementById('galerias-wrapper');
    if (wrapper) {
        // Clonar para limpiar listeners viejos
        const newWrapper = wrapper.cloneNode(true);
        wrapper.parentNode.replaceChild(newWrapper, wrapper);

        newWrapper.addEventListener('click', (e) => {
            // Wizard Completo
            const btnWizard = e.target.closest('.start-wizard-btn');
            if (btnWizard) {
                const componentId = btnWizard.dataset.componentId;
                const componentName = btnWizard.dataset.componentName || 'Espacio';
                const componentType = btnWizard.dataset.componentType || 'General';
                const shotList = JSON.parse(btnWizard.dataset.shotList);
                startWizard(componentId, shotList, componentName, componentType);
                return;
            }

            // Wizard Single Slot
            const btnSlot = e.target.closest('.start-single-slot-wizard');
            if (btnSlot) {
                const componentId = btnSlot.dataset.componentId;
                const plan = currentPhotoPlan[componentId] || [];
                const shotList = plan.map(p => ({ description: p.description, guidelines: p.guidelines }));
                const stepIndex = parseInt(btnSlot.dataset.stepIndex || 0);

                let name = 'Espacio', type = 'General';
                // Could traverse up for name if needed, but defaults are safe
                startWizard(componentId, shotList, name, type, stepIndex);
                return;
            }

            // Eliminar Imagen Individual
            const btnEliminar = e.target.closest('.eliminar-imagen-btn');
            if (btnEliminar) {
                handleEliminar(btnEliminar.dataset.componentId, btnEliminar.dataset.imageId);
                return;
            }

            // Eliminar Componente Completo (Espacio)
            const btnEliminarComp = e.target.closest('.eliminar-componente-btn');
            if (btnEliminarComp) {
                handleEliminarComponente(btnEliminarComp.dataset.componentId);
                return;
            }

            // Editar Imagen
            const btnEditar = e.target.closest('.editar-existente-btn');
            if (btnEditar) {
                openEditor(btnEditar.dataset.imageUrl, (blob) => handleReemplazarImagen(btnEditar.dataset.componentId, blob, btnEditar.dataset.oldImageId));
                return;
            }

            // Seleccionar fotos de la galería
            const btnGallery = e.target.closest('.pick-gallery-btn');
            if (btnGallery) {
                openGalleryPicker(btnGallery.dataset.componentId, btnGallery.dataset.componentName);
                return;
            }
        });

        // Listeners para inputs de archivo
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
        const resultados = await fetchAPI(`/website/propiedad/${currentPropiedadId}/upload-image/${componentId}`, { method: 'POST', body: formData });
        if (!currentImages[componentId]) currentImages[componentId] = [];
        currentImages[componentId].push(...resultados);

        document.getElementById(`galeria-${componentId}`).innerHTML = renderSlotsGrid(currentImages[componentId], componentId);
        mostrarFeedbackIA(componentId, resultados);

        statusEl.textContent = 'Listo.';
        setTimeout(() => statusEl.textContent = '', 2000);

        const input = document.getElementById(`input-${componentId}`);
        if (input) input.value = '';
    } catch (error) {
        statusEl.textContent = 'Error.';
        alert(error.message);
    }
}

async function handleReemplazarImagen(componentId, blob, oldImageId) {
    // Buscar el contexto de la imagen original para mantenerlo
    const oldImage = currentImages[componentId]?.find(img => img.imageId === oldImageId);
    const shotContext = oldImage ? oldImage.shotContext : null;

    const formData = new FormData();
    formData.append('images', blob, 'edited.jpg');
    if (shotContext) {
        formData.append('shotContext', shotContext);
    }

    try {
        const resultados = await fetchAPI(`/website/propiedad/${currentPropiedadId}/upload-image/${componentId}`, { method: 'POST', body: formData });
        await fetchAPI(`/website/propiedad/${currentPropiedadId}/delete-image/${componentId}/${oldImageId}`, { method: 'DELETE' });

        currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== oldImageId);
        currentImages[componentId].push(...resultados);

        document.getElementById(`galeria-${componentId}`).innerHTML = renderSlotsGrid(currentImages[componentId], componentId);
    } catch (error) { alert(error.message); }
}

async function handleEliminar(componentId, imageId) {
    if (!confirm('¿Eliminar imagen?')) return;
    try {
        await fetchAPI(`/website/propiedad/${currentPropiedadId}/delete-image/${componentId}/${imageId}`, { method: 'DELETE' });
        currentImages[componentId] = currentImages[componentId].filter(img => img.imageId !== imageId);
        document.getElementById(`galeria-${componentId}`).innerHTML = renderSlotsGrid(currentImages[componentId], componentId);
    } catch (error) { alert(error.message); }
}

async function handleEliminarComponente(componentId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este espacio completo? Se borrarán todas las fotos asociadas. Esta acción no se puede deshacer.')) return;

    try {
        await fetchAPI(`/website/propiedad/${currentPropiedadId}/componente/${componentId}`, { method: 'DELETE' });

        // Eliminar visualmente del DOM
        const container = document.getElementById(`galeria-${componentId}`)?.closest('.border.rounded-lg');
        if (container) {
            container.remove();
        }

        // Opcional: Recargar si está vacío
        const wrapper = document.getElementById('galerias-wrapper');
        if (wrapper && wrapper.children.length === 0) {
            wrapper.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Sin componentes.</p>';
        }

    } catch (error) {
        alert('Error al eliminar componente: ' + error.message);
    }
}