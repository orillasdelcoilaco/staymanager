// frontend/src/views/components/configurarWebPublica/webPublica.galeria.js
import { fetchAPI } from '../../../api.js';
import { galeriaRuntime } from './webPublica.galeria.runtime.js';
import { buildGaleriaMarkup } from './webPublica.galeria.render.js';
import { setupGaleriaEvents } from './webPublica.galeria.events.js';

export async function initGaleria(propiedadId, images) {
    galeriaRuntime.currentPropiedadId = propiedadId;
    galeriaRuntime.currentImages = images || {};
    try {
        galeriaRuntime.currentPhotoPlan = await fetchAPI(`/website/propiedad/${propiedadId}/photo-plan`);
    } catch (error) {
        console.error('Error fetching photo plan:', error);
        galeriaRuntime.currentPhotoPlan = {};
    }
}

export function renderGaleria(componentes) {
    if (!componentes || componentes.length === 0) {
        return `
        <div class="py-10 text-center border border-warning-200 bg-warning-50 rounded-xl">
            <i class="fa-solid fa-triangle-exclamation text-3xl text-warning-400 mb-3"></i>
            <p class="text-sm font-medium text-warning-800">Esta propiedad no tiene espacios definidos</p>
            <p class="text-xs text-warning-600 mt-1">Define los espacios del alojamiento antes de agregar fotos.</p>
        </div>`;
    }
    return buildGaleriaMarkup(componentes, galeriaRuntime.currentPhotoPlan, galeriaRuntime.currentImages);
}

export { setupGaleriaEvents };
