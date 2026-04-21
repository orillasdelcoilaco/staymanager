// HTML de rejilla de galería por componente (extraído de webPublica.galeria.js por tamaño de archivo).

const clean = (val) => (val === undefined || val === null || val === 'undefined') ? '' : val;

export function renderPlanBannerHtml(currentPhotoPlan) {
    const aiGenerated = currentPhotoPlan._aiGenerated;
    const generatedAt = currentPhotoPlan._generatedAt;
    const dateLabel = generatedAt
        ? new Date(generatedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
        : null;

    if (!aiGenerated) {
        return `
        <div id="plan-fotos-banner" class="flex items-start gap-3 bg-warning-50 border border-warning-200 rounded-xl px-4 py-3 text-sm">
            <i class="fa-solid fa-triangle-exclamation text-warning-500 text-xl flex-shrink-0 mt-0.5"></i>
            <div class="flex-1 min-w-0">
                <p class="font-semibold text-warning-900">Sin plan de fotos IA</p>
                <p class="text-xs text-warning-700 mt-0.5">
                    Genera el plan para que la IA determine qué fotos necesita cada espacio
                    según sus activos reales — optimizado para Airbnb, Booking y SEO.
                </p>
            </div>
            <button id="btn-generar-plan-ia"
                class="btn-primary text-xs flex-shrink-0 flex items-center gap-1.5 whitespace-nowrap">
                <i class="fa-solid fa-robot"></i> Generar plan IA
            </button>
        </div>`;
    }

    return `
    <div id="plan-fotos-banner" class="flex items-center gap-3 bg-success-50 border border-success-200 rounded-xl px-4 py-2.5 text-sm">
        <i class="fa-solid fa-circle-check text-success-500 flex-shrink-0"></i>
        <p class="flex-1 text-xs text-success-800">
            <strong>Plan IA activo</strong>${dateLabel ? ` · Generado el ${dateLabel}` : ''}
            · Basado en los activos reales de cada espacio.
        </p>
        <button id="btn-generar-plan-ia"
            class="text-xs text-success-700 hover:text-success-900 underline underline-offset-2 flex-shrink-0">
            Regenerar
        </button>
    </div>`;
}

function renderImageCard(img, componentId, label, isRequired) {
    const tieneAdvertencia = !!img.advertencia;

    let statusHtml;
    if (tieneAdvertencia) {
        statusHtml = `<div class="absolute top-1 right-1 bg-danger-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 cursor-help z-10" title="${img.advertencia}">⚠️ Alerta</div>`;
    } else if (img.confianza !== undefined) {
        const pct = Math.round((img.confianza || 0) * 100);
        if (pct >= 85) {
            statusHtml = `<div class="absolute top-1 right-1 bg-success-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow z-10" title="Clasificada por IA">✅ ${pct}%</div>`;
        } else if (pct >= 60) {
            statusHtml = `<div class="absolute top-1 right-1 bg-warning-400 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow z-10 cursor-help" title="Confianza media — revisa si es el espacio correcto">⚠️ ${pct}%</div>`;
        } else {
            statusHtml = `<div class="absolute top-1 right-1 bg-warning-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow z-10 cursor-help" title="Confianza baja — confirma o reclasifica en Galería">? ${pct}%</div>`;
        }
    } else {
        statusHtml = `<div class="absolute top-1 right-1 bg-success-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1 z-10">✅</div>`;
    }

    const bordeClass = tieneAdvertencia ? 'border-danger-400 ring-2 ring-danger-50' : (isRequired ? 'border-primary-200 ring-2 ring-primary-50' : 'border-gray-200');

    return `
    <div class="relative border ${bordeClass} rounded-md overflow-hidden group bg-white shadow-sm hover:shadow-md transition-all">
        <div class="relative w-full bg-gray-100 overflow-hidden" style="aspect-ratio:4/3">
            <img src="${img.storagePath}" class="absolute inset-0 w-full h-full object-cover">

            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                <button data-component-id="${componentId}" data-image-id="${img.imageId}" class="eliminar-imagen-btn bg-white text-danger-600 p-1.5 rounded-full hover:bg-danger-100 shadow-sm transition-transform hover:scale-110" title="Eliminar imagen">
                    <i class="fa-solid fa-trash h-4 w-4 text-sm"></i>
                </button>
                <button data-component-id="${componentId}" data-image-url="${img.storagePath}" data-old-image-id="${img.imageId}" class="editar-existente-btn bg-white text-primary-600 p-1.5 rounded-full hover:bg-primary-100 shadow-sm transition-transform hover:scale-110" title="Editar imagen">
                    <i class="fa-solid fa-pen h-4 w-4 text-sm"></i>
                </button>
            </div>
            ${statusHtml}
        </div>

        <div class="px-2 py-1.5 border-t border-gray-50 bg-white">
            <p class="text-primary-900 font-bold text-[10px] truncate" title="${label}">${label}</p>
            <p class="text-gray-400 text-[9px] truncate" title="${clean(img.altText)}">${clean(img.altText) || '...'}</p>
        </div>
    </div>
    `;
}

function htmlSlotVacio(componentId, req, index) {
    return `
            <div class="relative border-2 border-dashed border-primary-200 rounded-xl bg-primary-50 flex flex-col items-center justify-center p-4 text-center min-h-[160px] group hover:bg-primary-100 transition-colors">
                <i class="fa-solid fa-camera text-2xl text-primary-300 mb-2 group-hover:text-primary-500 transition-colors"></i>
                <p class="text-xs font-semibold text-primary-800 mb-1">Requerido</p>
                <p class="text-xs text-primary-600 leading-tight mb-3">${req.description}</p>
                <div class="flex flex-col gap-1.5 w-full">
                    <button class="start-single-slot-wizard btn-outline text-[10px] w-full flex items-center justify-center gap-1"
                        data-component-id="${componentId}"
                        data-requirement="${req.description}"
                        data-step-index="${index}">
                        <i class="fa-solid fa-upload"></i> Subir foto
                    </button>
                    <button class="slot-gallery-btn btn-primary text-[10px] w-full flex items-center justify-center gap-1"
                        data-component-id="${componentId}"
                        data-requirement="${req.description}"
                        data-step-index="${index}">
                        <i class="fa-solid fa-images"></i> Desde Galería
                    </button>
                </div>
            </div>
            `;
}

function htmlGridVacio() {
    return `
        <div class="col-span-full py-8 text-center">
            <i class="fa-solid fa-camera text-3xl text-gray-200 mb-3"></i>
            <p class="text-sm text-gray-400">Sin requisitos ni imágenes aún.</p>
        </div>`;
}

export function renderSlotsGrid(images, componentId, currentPhotoPlan) {
    const plan = (currentPhotoPlan && currentPhotoPlan[componentId]) || [];
    const usedImageIds = new Set();
    let html = '';

    const sinContexto = (images || []).filter((img) =>
        !img.shotContext || img.shotContext === '[object Object]'
    );
    plan.forEach((req, index) => {
        const match = images?.find((img) =>
            !usedImageIds.has(img.imageId) &&
            (img.shotContext === req.description || img.title === req.description)
        );

        const fallback = !match ? sinContexto.find((img) => !usedImageIds.has(img.imageId)) : null;
        const chosen = match || fallback;

        if (chosen) {
            usedImageIds.add(chosen.imageId);
            html += renderImageCard(chosen, componentId, req.description, true);
        } else {
            html += htmlSlotVacio(componentId, req, index);
        }
    });

    if (images) {
        images.forEach((img) => {
            if (!usedImageIds.has(img.imageId)) {
                html += renderImageCard(img, componentId, 'Adicional', false);
            }
        });
    }

    if (html === '') return htmlGridVacio();
    return html;
}
