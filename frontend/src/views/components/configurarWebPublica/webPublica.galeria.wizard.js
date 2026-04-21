import { fetchAPI } from '../../../api.js';
import { renderWizardStep as _renderWizardStep } from './webPublica.galeria.helpers.js';
import { renderSlotsGrid } from './webPublica.galeria.grid.js';
import { galeriaRuntime } from './webPublica.galeria.runtime.js';

export const startWizard = (componentId, shotList, componentName = 'Espacio', componentType = 'General', startStep = 0) => {
    const normalizedShots = (shotList || ['Vista General']).map((s) =>
        (typeof s === 'string' ? { description: s, guidelines: null } : s)
    );
    galeriaRuntime.activeWizard = {
        componentId,
        componentName,
        componentType,
        shotList: normalizedShots,
        currentStep: startStep,
        uploadedInSession: [],
    };
    renderWizardModal();
};

export const closeWizard = () => {
    const componentId = galeriaRuntime.activeWizard?.componentId;
    const modal = document.getElementById('wizard-modal');
    if (modal) modal.remove();

    if (componentId) {
        const container = document.getElementById(`galeria-${componentId}`);
        if (container) {
            container.innerHTML = renderSlotsGrid(
                galeriaRuntime.currentImages[componentId],
                componentId,
                galeriaRuntime.currentPhotoPlan
            );
        }
    }
    galeriaRuntime.activeWizard = null;

    if (galeriaRuntime.currentPropiedadId) {
        fetchAPI(`/galeria/${galeriaRuntime.currentPropiedadId}/sync`, { method: 'POST' })
            .then((result) => console.log('[DEBUG IMG-001] Sync exitoso:', result))
            .catch((err) => console.error('[DEBUG IMG-001] Sync fallido:', err.message));
    }
};

const handleWizardUpload = async (file) => {
    const aw = galeriaRuntime.activeWizard;
    if (!aw || !file) return;

    const stepData = aw.shotList[aw.currentStep];
    const shotDescription = stepData?.description || stepData || '';
    const wizardBody = document.getElementById('wizard-body');
    wizardBody.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 space-y-4">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p class="text-lg text-primary-800 font-medium">Analizando imagen...</p>
            <p class="text-sm text-gray-600">Verificando cumplimiento: "${shotDescription}"</p>
            <p class="text-xs text-gray-400 mt-2">Optimizando y generando metadatos SEO...</p>
        </div>
    `;
    document.getElementById('wizard-next-btn').disabled = true;

    const formData = new FormData();
    formData.append('images', file);
    formData.append('shotContext', shotDescription);

    try {
        const resultados = await fetchAPI(
            `/website/propiedad/${galeriaRuntime.currentPropiedadId}/upload-image/${aw.componentId}`,
            { method: 'POST', body: formData }
        );

        const imagenSubida = resultados[0];
        if (!galeriaRuntime.currentImages[aw.componentId]) galeriaRuntime.currentImages[aw.componentId] = [];
        galeriaRuntime.currentImages[aw.componentId].push(imagenSubida);

        if (imagenSubida.advertencia) {
            renderWizardStep('error', imagenSubida);
        } else {
            aw.uploadedInSession.push(imagenSubida);
            aw.currentStep++;
            if (aw.currentStep >= aw.shotList.length) {
                renderWizardStep('finish');
            } else {
                renderWizardStep('success_transition', imagenSubida);
            }
        }
    } catch (error) {
        alert('Error crítico en el wizard: ' + error.message);
        closeWizard();
    }
};

export const renderWizardStep = (state = 'upload', data = null) => {
    _renderWizardStep(state, data, galeriaRuntime.activeWizard, closeWizard, handleWizardUpload);
};

const renderWizardModal = () => {
    const modalHtml = `
        <div id="wizard-modal" class="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm transition-opacity duration-300">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden transform transition-all scale-100">
                <div class="bg-primary-700 p-4 text-white flex justify-between items-center bg-pattern">
                    <h3 id="wizard-title" class="text-md font-bold leading-tight">Asistente de Carga</h3>
                    <button id="wizard-close-btn" class="text-primary-200 hover:text-white text-2xl hover:bg-primary-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors">&times;</button>
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
