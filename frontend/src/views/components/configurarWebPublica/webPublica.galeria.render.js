import { renderPlanBannerHtml, renderSlotsGrid } from './webPublica.galeria.grid.js';

function renderComponenteGaleriaBlock(comp, plan, imgs) {
    const images = imgs[comp.id] || [];
    return `
                        <div class="border border-gray-100 rounded-xl p-5 bg-gray-50">
                            <div class="flex justify-between items-center mb-4">
                                <h4 class="font-medium text-gray-700 flex items-center gap-2">
                                    <i class="fa-solid fa-box text-gray-400"></i>
                                    ${comp.nombre}
                                    <span class="text-xs text-gray-400">(${comp.tipo})</span>
                                </h4>
                                <div class="flex gap-2 flex-wrap">
                                    <button class="start-wizard-btn btn-primary text-xs flex items-center gap-1.5"
                                        data-component-id="${comp.id}"
                                        data-component-name="${comp.nombre}"
                                        data-component-type="${comp.tipo}"
                                        data-shot-list='${JSON.stringify(plan[comp.id]?.map((p) => ({ description: p.description, guidelines: p.guidelines })) || [{ description: 'Vista General', guidelines: null }]).replace(/'/g, '&apos;')}'
                                    >
                                        <i class="fa-solid fa-camera"></i> Asistente IA
                                    </button>
                                    <label class="btn-outline text-xs cursor-pointer flex items-center gap-1.5">
                                        <i class="fa-solid fa-upload"></i> Subir
                                        <input type="file" multiple accept="image/*" class="subir-imagenes-input hidden" data-component-id="${comp.id}">
                                    </label>
                                    <button class="pick-gallery-btn btn-secondary text-xs flex items-center gap-1.5"
                                        data-component-id="${comp.id}"
                                        data-component-name="${comp.nombre}"
                                    >
                                        <i class="fa-solid fa-images"></i> Galería
                                    </button>
                                    <button class="eliminar-componente-btn btn-danger text-xs"
                                        title="Eliminar Espacio Completo"
                                        data-component-id="${comp.id}"
                                    >
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div id="upload-status-${comp.id}" class="text-xs text-primary-600 mb-2 h-4"></div>
                            <div id="ai-feedback-${comp.id}" class="hidden mb-4 p-3 bg-warning-50 border border-warning-200 rounded text-sm text-warning-800"></div>
                            <div id="galeria-${comp.id}" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                ${renderSlotsGrid(images, comp.id, plan)}
                            </div>
                        </div>
                    `;
}

export function buildGaleriaMarkup(componentes, plan, imgs) {
    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    Galería por Áreas
                    <span class="text-xs font-normal bg-success-100 text-success-800 px-2 py-1 rounded-full flex items-center gap-1">
                        <i class="fa-solid fa-robot"></i> Auditor IA Activo
                    </span>
                </h3>
            </div>
            ${renderPlanBannerHtml(plan)}
            <div id="galerias-wrapper" class="space-y-8">
                ${componentes.map((comp) => renderComponenteGaleriaBlock(comp, plan, imgs)).join('')}
            </div>
        </div>
    `;
}
