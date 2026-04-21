// frontend/src/views/components/configurarWebPublica/webPublica.galeria.helpers.js

// --- Helpers privados del estado del Wizard ---
// Estas funciones reciben el objeto activeWizard como parámetro para evitar acoplamiento de módulo.

function _renderStepUpload(wizardBody, newNextBtn, activeWizard, totalSteps, currentRequirement, currentShot, handleWizardUpload, renderWizardStep) {
    wizardBody.innerHTML = `
        <div class="text-center py-4">
            <div class="mb-6">
                <span class="inline-block px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-bold mb-2">Requisito Obligatorio</span>
                <h4 class="text-2xl font-bold text-gray-800">"${currentRequirement}"</h4>
            </div>
            <div class="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-6 text-left max-w-sm mx-auto">
                <p class="text-xs font-semibold text-primary-800 mb-1 flex items-center gap-1.5">
                    <i class="fa-solid fa-lightbulb text-primary-500"></i> Guía para esta foto:
                </p>
                ${currentShot?.guidelines
                    ? `<p class="text-xs text-primary-700 leading-relaxed">${currentShot.guidelines}</p>`
                    : `<ul class="text-xs text-primary-700 list-disc pl-4 space-y-1">
                        <li>Asegura buena iluminación (luz natural ideal).</li>
                        <li>El elemento principal debe ser el foco central.</li>
                        <li>Evita fotos borrosas o movidas.</li>
                       </ul>`
                }
            </div>
            <label for="wizard-file-input" class="cursor-pointer flex flex-col items-center justify-center h-40 border-2 border-dashed border-primary-400 rounded-xl hover:bg-primary-50 transition-all bg-white max-w-sm mx-auto shadow-sm group">
                <div class="p-3 bg-primary-100 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <i class="fa-solid fa-camera text-3xl text-primary-500"></i>
                </div>
                <span class="text-primary-700 font-bold text-sm">Subir Foto Requerida</span>
                <span class="text-gray-400 text-xs mt-1">Clic para seleccionar</span>
                <input type="file" id="wizard-file-input" accept="image/*" class="hidden">
            </label>
        </div>
    `;

    newNextBtn.classList.remove('hidden');
    newNextBtn.textContent = 'Saltar este paso';
    newNextBtn.className = 'btn-ghost text-xs';
    newNextBtn.disabled = false;
    newNextBtn.onclick = () => {
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
}

function _renderStepSuccessTransition(wizardBody, newNextBtn, data, renderWizardStep) {
    wizardBody.innerHTML = `
        <div class="text-center py-10 fade-in-up">
            <div class="h-16 w-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fa-solid fa-check text-3xl text-success-600"></i>
            </div>
            <h4 class="text-xl font-bold text-success-800 mb-2">¡Foto Aprobada!</h4>
            <p class="text-gray-600 mb-4">IA detectó correctamente: "${data.title}"</p>
            <div class="h-48 w-full max-w-xs mx-auto rounded-xl overflow-hidden border-2 border-success-200 shadow-md bg-gray-100">
                <img src="${data.storagePath}" class="w-full h-full object-contain">
            </div>
        </div>
    `;
    setTimeout(() => { renderWizardStep('upload'); }, 1500);
    newNextBtn.classList.add('hidden');
}

function _renderStepError(wizardBody, newNextBtn, data, activeWizard, totalSteps, renderWizardStep) {
    const errorMsg = data.advertencia || "La imagen no cumple con los requisitos mínimos de calidad o contenido.";
    wizardBody.innerHTML = `
        <div class="text-center py-4 bg-danger-50 rounded-xl border border-danger-200 p-6 max-w-sm mx-auto">
            <div class="h-16 w-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-danger-200">
                <i class="fa-solid fa-ban text-3xl text-danger-600"></i>
            </div>
            <h4 class="text-lg font-bold text-danger-800 mb-2">Imagen Rechazada</h4>
            <p class="text-sm text-danger-700 font-medium mb-4 bg-white p-3 rounded-lg border border-danger-100 shadow-sm text-left">
                "${errorMsg}"
            </p>
            <div class="h-40 w-full mx-auto mb-6 rounded-xl overflow-hidden border-2 border-danger-300 relative bg-gray-100">
                <img src="${data.storagePath}" class="w-full h-full object-contain opacity-75 grayscale">
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <i class="fa-solid fa-xmark text-5xl text-danger-500 drop-shadow"></i>
                </div>
            </div>
            <div class="space-y-2">
                <button id="retry-step-btn" class="btn-danger w-full flex items-center justify-center gap-2">
                    <i class="fa-solid fa-rotate"></i> Intentar con otra foto
                </button>
                <button id="skip-error-btn" class="btn-ghost w-full text-sm">
                    Saltar este requisito
                </button>
            </div>
        </div>
    `;
    newNextBtn.classList.add('hidden');

    document.getElementById('retry-step-btn').addEventListener('click', () => renderWizardStep('upload'));
    document.getElementById('skip-error-btn').addEventListener('click', () => {
        activeWizard.currentStep++;
        if (activeWizard.currentStep >= totalSteps) {
            renderWizardStep('finish');
        } else {
            renderWizardStep('upload');
        }
    });
}

function _renderStepFinish(wizardBody, newNextBtn, activeWizard, closeWizard) {
    document.getElementById('wizard-progress-bar').style.width = `100%`;
    wizardBody.innerHTML = `
        <div class="text-center py-10">
            <div class="h-20 w-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <i class="fa-solid fa-circle-check text-5xl text-success-500"></i>
            </div>
            <h4 class="text-2xl font-bold text-success-800 mb-2">¡Excelente Trabajo!</h4>
            <p class="text-gray-600 mb-6">Has completado la sesión de fotos para <strong>${activeWizard.componentName}</strong>.</p>
            <p class="text-sm text-gray-400">Todas las fotos han sido optimizadas y etiquetadas para SEO.</p>
            <button id="finish-wizard-btn-center" class="btn-success mt-6 flex items-center gap-2 mx-auto">
                <i class="fa-solid fa-check"></i> Finalizar y Ver Galería
            </button>
        </div>
    `;
    newNextBtn.classList.add('hidden');
    document.getElementById('finish-wizard-btn-center').onclick = closeWizard;
}

export function bindPhotoHoverPreview(gridId, itemClass, previewId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.addEventListener('mouseover', e => {
        const item = e.target.closest(`.${itemClass}`);
        if (!item) return;
        const src = item.dataset.fotoUrl || item.querySelector('img')?.src || '';
        if (!src) return;
        let preview = document.getElementById(previewId);
        if (!preview) {
            preview = document.createElement('div');
            preview.id = previewId;
            preview.className = 'fixed pointer-events-none rounded-xl overflow-hidden shadow-2xl border-2 border-white';
            preview.style.cssText = 'width:220px;height:165px;transition:opacity 0.15s;z-index:9999';
            preview.innerHTML = `<img src="" class="w-full h-full object-cover">`;
            document.body.appendChild(preview);
        }
        const imgEl = preview.querySelector('img');
        preview.style.opacity = '0';
        imgEl.onload = () => { preview.style.opacity = '1'; };
        imgEl.src = src;
        const rect = item.getBoundingClientRect();
        const left = rect.right + 8 + 220 > window.innerWidth ? rect.left - 228 : rect.right + 8;
        const top = Math.min(rect.top, window.innerHeight - 175);
        preview.style.left = `${left}px`;
        preview.style.top = `${top}px`;
    });
    grid.addEventListener('mouseout', e => {
        const item = e.target.closest(`.${itemClass}`);
        if (!item) return;
        const preview = document.getElementById(previewId);
        if (preview) preview.style.opacity = '0';
    });
}

export function construirSlotPickerHtml(requirement, fotos) {
    const fotosGrid = fotos.map(f => {
        const src = f.thumbnailUrl || f.storageUrl || '';
        const espacioLabel = f.espacio ? `<span class="text-[9px] text-white bg-black bg-opacity-50 px-1 rounded truncate max-w-full">${f.espacio}</span>` : '';
        return `<div class="sgp-pick-item relative cursor-pointer rounded-lg overflow-hidden border-2 border-transparent hover:border-primary-400 transition-all group"
                     data-foto-id="${f.id}" data-foto-url="${f.storageUrl || f.thumbnailUrl || ''}">
            <div class="overflow-hidden h-32 bg-gray-100">
                <img src="${src}" alt="" class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110">
            </div>
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent px-1 py-1 flex items-center justify-center">${espacioLabel}</div>
            <div class="absolute inset-0 bg-primary-600 bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-start justify-end p-1">
                <span class="opacity-0 group-hover:opacity-100 text-white text-[10px] font-bold bg-primary-700 bg-opacity-90 px-1.5 py-0.5 rounded transition-opacity">✓ Elegir</span>
            </div>
        </div>`;
    }).join('');

    return `
    <div id="slot-gallery-picker-modal" class="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[85vh]">
            <div class="bg-primary-700 p-4 text-white flex-shrink-0">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-md">Seleccionar foto para slot</h3>
                        <p class="text-primary-200 text-xs mt-1">Requisito: <strong>"${requirement}"</strong></p>
                        <p class="text-primary-300 text-[10px] mt-0.5">La IA verificará si la foto cumple el requisito antes de asignarla.</p>
                    </div>
                    <button id="sgp-close" class="text-primary-200 hover:text-white text-2xl hover:bg-primary-600 rounded-full w-8 h-8 flex items-center justify-center">&times;</button>
                </div>
            </div>
            <div id="sgp-audit-status" class="hidden px-4 py-3 bg-primary-50 border-b border-primary-100 text-sm text-primary-800 flex items-center gap-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                <span id="sgp-audit-msg">Auditando imagen con IA...</span>
            </div>
            ${fotos.length === 0
                ? `<div class="flex-1 flex items-center justify-center p-10 text-gray-400"><p>No hay fotos en la galería de esta propiedad.</p></div>`
                : `<div id="sgp-grid" class="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">${fotosGrid}</div>`
            }
            <div id="sgp-rejection" class="hidden px-4 py-3 bg-danger-50 border-t border-danger-200 text-sm text-danger-800">
                <p class="font-bold">⚠️ La IA rechazó esta foto:</p>
                <p id="sgp-rejection-msg" class="mt-1 text-xs"></p>
                <p class="text-xs text-gray-500 mt-1">Elige otra foto o súbela directo con el Asistente IA.</p>
            </div>
            <div class="bg-gray-50 p-3 border-t border-gray-100 flex justify-end flex-shrink-0">
                <button id="sgp-cancel" class="px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">Cancelar</button>
            </div>
        </div>
    </div>`;
}

export function renderWizardStep(state = 'upload', data = null, activeWizard, closeWizard, handleWizardUpload) {
    const wizardBody = document.getElementById('wizard-body');
    const nextBtn = document.getElementById('wizard-next-btn');
    const totalSteps = activeWizard.shotList.length;
    const stepIndex = activeWizard.currentStep;
    const currentShot = activeWizard.shotList[stepIndex];
    const currentRequirement = currentShot?.description || currentShot;

    document.getElementById('wizard-title').innerHTML = `
        <div class="flex flex-col">
            <span class="text-xs uppercase tracking-wider text-primary-200">${activeWizard.componentName} (${activeWizard.componentType})</span>
            <span>Paso ${stepIndex + 1} de ${totalSteps}</span>
        </div>
    `;
    const progressPercent = ((stepIndex) / totalSteps) * 100;
    document.getElementById('wizard-progress-bar').style.width = `${progressPercent}%`;

    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

    // Self-referencing wrapper so sub-functions can call renderWizardStep
    const self = (s, d = null) => renderWizardStep(s, d, activeWizard, closeWizard, handleWizardUpload);

    if (state === 'upload') {
        _renderStepUpload(wizardBody, newNextBtn, activeWizard, totalSteps, currentRequirement, currentShot, handleWizardUpload, self);
    } else if (state === 'success_transition') {
        _renderStepSuccessTransition(wizardBody, newNextBtn, data, self);
    } else if (state === 'error') {
        _renderStepError(wizardBody, newNextBtn, data, activeWizard, totalSteps, self);
    } else if (state === 'finish') {
        _renderStepFinish(wizardBody, newNextBtn, activeWizard, closeWizard);
    }
}
