import { fetchAPI } from '../../../api.js';
import { construirSlotPickerHtml, bindPhotoHoverPreview } from './webPublica.galeria.helpers.js';
import { renderSlotsGrid } from './webPublica.galeria.grid.js';
import { galeriaRuntime } from './webPublica.galeria.runtime.js';

function construirModalPickerHtml(fotos, componentName, renderGrid) {
    return `
    <div id="gallery-picker-modal" class="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[85vh]">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <div>
                    <h3 class="font-semibold text-gray-900">Seleccionar desde Galería</h3>
                    <p class="text-xs text-gray-400 mt-0.5">Para: <strong class="text-gray-600">${componentName}</strong> — Elige las fotos a asignar</p>
                </div>
                <button id="gp-close" class="btn-ghost text-xl leading-none"><i class="fa-solid fa-xmark"></i></button>
            </div>
            ${fotos.length === 0
        ? `<div class="flex-1 flex flex-col items-center justify-center p-10 text-center">
                       <i class="fa-solid fa-images text-4xl text-gray-200 mb-3"></i>
                       <p class="text-sm font-medium text-gray-600">Sin fotos en la galería</p>
                       <p class="text-xs text-gray-400 mt-1">Sube fotos desde la Galería de Fotos primero.</p>
                   </div>`
        : `<div id="gp-grid" class="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">${renderGrid()}</div>`
            }
            <div class="px-6 py-4 flex justify-between items-center border-t border-gray-100 flex-shrink-0">
                <span id="gp-count" class="text-xs text-gray-500">0 fotos seleccionadas</span>
                <div class="flex gap-2">
                    <button id="gp-cancel" class="btn-ghost">Cancelar</button>
                    <button id="gp-assign" class="btn-primary text-xs disabled:opacity-50" disabled>
                        <i class="fa-solid fa-check mr-1"></i> Asignar a ${componentName}
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

async function asignarFotosSeleccionadas(componentId, componentName, fotos, selectedIds, closeModal) {
    const btn = document.getElementById('gp-assign');
    btn.disabled = true;
    btn.textContent = 'Asignando...';
    try {
        const compEl = document.querySelector(`[data-component-id="${componentId}"].pick-gallery-btn`);
        const compName = compEl?.dataset.componentName || componentName;
        await Promise.all([...selectedIds].map((fotoId) =>
            fetchAPI(`/galeria/${galeriaRuntime.currentPropiedadId}/${fotoId}`, {
                method: 'PATCH',
                body: { espacio: compName, espacioId: componentId },
            })
        ));
        await fetchAPI(`/galeria/${galeriaRuntime.currentPropiedadId}/sync`, { method: 'POST' }).catch(() => {});
        const syncResult = await fetchAPI(`/website/propiedad/${galeriaRuntime.currentPropiedadId}/componente/${componentId}`).catch(() => null);
        if (syncResult?.images) {
            galeriaRuntime.currentImages[componentId] = syncResult.images;
        } else {
            if (!galeriaRuntime.currentImages[componentId]) galeriaRuntime.currentImages[componentId] = [];
            fotos.filter((f) => selectedIds.has(f.id)).forEach((f) => {
                if (!galeriaRuntime.currentImages[componentId].find((i) => i.imageId === f.id)) {
                    galeriaRuntime.currentImages[componentId].push({
                        imageId: f.id,
                        storagePath: f.storageUrl || '',
                        altText: f.altText || '',
                        title: f.espacio || '',
                        shotContext: null,
                    });
                }
            });
        }
        const galeriaEl = document.getElementById(`galeria-${componentId}`);
        if (galeriaEl) {
            galeriaEl.innerHTML = renderSlotsGrid(
                galeriaRuntime.currentImages[componentId],
                componentId,
                galeriaRuntime.currentPhotoPlan
            );
        }
        closeModal();
    } catch (e) {
        alert('Error al asignar fotos: ' + e.message);
        btn.disabled = false;
        btn.textContent = `Asignar a ${componentName}`;
    }
}

function buildGalleryPickGridHtml(fotos, selectedIds) {
    return fotos.map((f) => {
        const imgSrc = f.thumbnailUrl || f.storageUrl || '';
        const conf = Math.round((f.confianza || 0) * 100);
        const isSelected = selectedIds.has(f.id);
        const espacioLabel = f.espacio ? `<span class="text-[9px] text-white truncate">${f.espacio}</span>` : '';
        return `<div class="gallery-pick-item relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all group ${isSelected ? 'border-primary-500 ring-2 ring-primary-300' : 'border-transparent hover:border-gray-300'}" data-foto-id="${f.id}">
            <div class="overflow-hidden h-28 bg-gray-100">
                <img src="${imgSrc}" alt="" class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110">
            </div>
            ${isSelected ? '<div class="absolute top-1 right-1 bg-primary-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold pointer-events-none z-10">✓</div>' : ''}
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent px-1 py-1 flex items-center gap-1"><span class="text-white text-[9px]">${conf}%</span>${espacioLabel}</div>
        </div>`;
    }).join('');
}

function updateGalleryPickerSelectionUI(selectedIds) {
    document.getElementById('gp-count').textContent = `${selectedIds.size} foto${selectedIds.size !== 1 ? 's' : ''} seleccionada${selectedIds.size !== 1 ? 's' : ''}`;
    document.getElementById('gp-assign').disabled = selectedIds.size === 0;
    document.getElementById('gp-grid')?.querySelectorAll('.gallery-pick-item').forEach((el) => {
        const id = el.dataset.fotoId;
        const selected = selectedIds.has(id);
        el.classList.toggle('border-primary-500', selected);
        el.classList.toggle('ring-2', selected);
        el.classList.toggle('ring-primary-300', selected);
        el.classList.toggle('border-transparent', !selected);
        const check = el.querySelector('.bg-primary-500');
        if (selected && !check) {
            el.insertAdjacentHTML('beforeend', '<div class="absolute top-1 right-1 bg-primary-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold pointer-events-none">✓</div>');
        } else if (!selected && check) check.remove();
    });
}

export async function openGalleryPicker(componentId, componentName) {
    document.getElementById('gallery-picker-modal')?.remove();
    let fotos = [];
    try {
        const all = await fetchAPI(`/galeria/${galeriaRuntime.currentPropiedadId}`);
        fotos = Array.isArray(all) ? all.filter((f) => f.estado !== 'descartada') : [];
    } catch (e) {
        alert('Error al cargar la galería.');
        return;
    }
    const selectedIds = new Set();
    const renderGrid = () => buildGalleryPickGridHtml(fotos, selectedIds);

    document.body.insertAdjacentHTML('beforeend', construirModalPickerHtml(fotos, componentName, renderGrid));

    const closeModal = () => {
        document.getElementById('gallery-picker-modal')?.remove();
        document.getElementById('gp-hover-preview')?.remove();
    };
    document.getElementById('gp-grid')?.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-pick-item');
        if (!item) return;
        const id = item.dataset.fotoId;
        if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
        updateGalleryPickerSelectionUI(selectedIds);
    });
    bindPhotoHoverPreview('gp-grid', 'gallery-pick-item', 'gp-hover-preview');
    document.getElementById('gp-close').addEventListener('click', closeModal);
    document.getElementById('gp-cancel').addEventListener('click', closeModal);
    document.getElementById('gp-assign').addEventListener('click', () =>
        asignarFotosSeleccionadas(componentId, componentName, fotos, selectedIds, closeModal));
}

function bindSlotGalleryAuditClick(componentId, requirement, closeModal) {
    document.getElementById('sgp-grid')?.addEventListener('click', async (e) => {
        const item = e.target.closest('.sgp-pick-item');
        if (!item) return;

        const fotoId = item.dataset.fotoId;
        const fotoUrl = item.dataset.fotoUrl;

        const auditStatus = document.getElementById('sgp-audit-status');
        const rejectionEl = document.getElementById('sgp-rejection');
        rejectionEl.classList.add('hidden');
        auditStatus.classList.remove('hidden');
        document.getElementById('sgp-audit-msg').textContent = 'Auditando imagen con IA…';
        document.querySelectorAll('.sgp-pick-item').forEach((el) => { el.style.pointerEvents = 'none'; });

        try {
            const result = await fetchAPI(`/website/propiedad/${galeriaRuntime.currentPropiedadId}/audit-slot`, {
                method: 'POST',
                body: { componentId, imageUrl: fotoUrl, imageId: fotoId, shotContext: requirement },
            });

            if (result.aprobada) {
                if (!galeriaRuntime.currentImages[componentId]) galeriaRuntime.currentImages[componentId] = [];
                galeriaRuntime.currentImages[componentId].push(result.imagen);
                const galeriaEl = document.getElementById(`galeria-${componentId}`);
                if (galeriaEl) {
                    galeriaEl.innerHTML = renderSlotsGrid(
                        galeriaRuntime.currentImages[componentId],
                        componentId,
                        galeriaRuntime.currentPhotoPlan
                    );
                }
                closeModal();
            } else {
                auditStatus.classList.add('hidden');
                document.getElementById('sgp-rejection-msg').textContent = result.advertencia;
                rejectionEl.classList.remove('hidden');
                document.querySelectorAll('.sgp-pick-item').forEach((el) => { el.style.pointerEvents = ''; });
            }
        } catch (err) {
            auditStatus.classList.add('hidden');
            document.getElementById('sgp-rejection-msg').textContent = 'Error de conexión: ' + err.message;
            rejectionEl.classList.remove('hidden');
            document.querySelectorAll('.sgp-pick-item').forEach((el) => { el.style.pointerEvents = ''; });
        }
    });
}

export async function openSlotGalleryPicker(componentId, _stepIndex, requirement) {
    document.getElementById('slot-gallery-picker-modal')?.remove();

    let fotos = [];
    try {
        const all = await fetchAPI(`/galeria/${galeriaRuntime.currentPropiedadId}`);
        fotos = Array.isArray(all) ? all.filter((f) => f.estado !== 'descartada') : [];
    } catch (e) {
        alert('Error al cargar la galería: ' + e.message);
        return;
    }

    document.body.insertAdjacentHTML('beforeend', construirSlotPickerHtml(requirement, fotos));

    const closeModal = () => {
        document.getElementById('slot-gallery-picker-modal')?.remove();
        document.getElementById('sgp-hover-preview')?.remove();
    };
    document.getElementById('sgp-close').addEventListener('click', closeModal);
    document.getElementById('sgp-cancel').addEventListener('click', closeModal);
    bindPhotoHoverPreview('sgp-grid', 'sgp-pick-item', 'sgp-hover-preview');

    bindSlotGalleryAuditClick(componentId, requirement, closeModal);
}
