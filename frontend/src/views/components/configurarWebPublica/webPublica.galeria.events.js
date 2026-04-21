import { fetchAPI } from '../../../api.js';
import { renderPlanBannerHtml, renderSlotsGrid } from './webPublica.galeria.grid.js';
import { galeriaRuntime } from './webPublica.galeria.runtime.js';
import { startWizard } from './webPublica.galeria.wizard.js';
import { openGalleryPicker, openSlotGalleryPicker } from './webPublica.galeria.pickers.js';
import {
    handleEliminar,
    handleEliminarComponente,
    handleSubirMasivo,
    bindEditorReemplazo,
} from './webPublica.galeria.imageActions.js';

function onGaleriasWrapperClick(e) {
    const btnWizard = e.target.closest('.start-wizard-btn');
    if (btnWizard) {
        startWizard(
            btnWizard.dataset.componentId,
            JSON.parse(btnWizard.dataset.shotList),
            btnWizard.dataset.componentName || 'Espacio',
            btnWizard.dataset.componentType || 'General'
        );
        return;
    }

    const btnSlot = e.target.closest('.start-single-slot-wizard');
    if (btnSlot) {
        const componentId = btnSlot.dataset.componentId;
        const plan = galeriaRuntime.currentPhotoPlan[componentId] || [];
        const shotList = plan.map((p) => ({ description: p.description, guidelines: p.guidelines }));
        const stepIndex = parseInt(btnSlot.dataset.stepIndex || 0, 10);
        startWizard(componentId, shotList, 'Espacio', 'General', stepIndex);
        return;
    }

    const btnSlotGallery = e.target.closest('.slot-gallery-btn');
    if (btnSlotGallery) {
        openSlotGalleryPicker(
            btnSlotGallery.dataset.componentId,
            parseInt(btnSlotGallery.dataset.stepIndex || 0, 10),
            btnSlotGallery.dataset.requirement
        );
        return;
    }

    const btnEliminar = e.target.closest('.eliminar-imagen-btn');
    if (btnEliminar) {
        handleEliminar(btnEliminar.dataset.componentId, btnEliminar.dataset.imageId);
        return;
    }

    const btnEliminarComp = e.target.closest('.eliminar-componente-btn');
    if (btnEliminarComp) {
        handleEliminarComponente(btnEliminarComp.dataset.componentId);
        return;
    }

    const btnEditar = e.target.closest('.editar-existente-btn');
    if (btnEditar) {
        bindEditorReemplazo(btnEditar.dataset.componentId, btnEditar.dataset.imageUrl, btnEditar.dataset.oldImageId);
        return;
    }

    const btnGallery = e.target.closest('.pick-gallery-btn');
    if (btnGallery) {
        openGalleryPicker(btnGallery.dataset.componentId, btnGallery.dataset.componentName);
    }
}

function bindGenerarPlanIa() {
    document.getElementById('btn-generar-plan-ia')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-generar-plan-ia');
        const banner = document.getElementById('plan-fotos-banner');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando…'; }
        try {
            const nuevoPlan = await fetchAPI(`/website/propiedad/${galeriaRuntime.currentPropiedadId}/generar-plan-fotos`, { method: 'POST' });
            galeriaRuntime.currentPhotoPlan = nuevoPlan;
            if (banner) banner.outerHTML = renderPlanBannerHtml(galeriaRuntime.currentPhotoPlan);
            document.getElementById('btn-generar-plan-ia')?.addEventListener('click', () => {});
            document.querySelectorAll('[id^="galeria-"]').forEach((el) => {
                const compId = el.id.replace('galeria-', '');
                el.innerHTML = renderSlotsGrid(
                    galeriaRuntime.currentImages[compId] || [],
                    compId,
                    galeriaRuntime.currentPhotoPlan
                );
            });
            document.querySelectorAll('.start-wizard-btn').forEach((b) => {
                const cId = b.dataset.componentId;
                const shots = (galeriaRuntime.currentPhotoPlan[cId] || []).map((p) => ({ description: p.description, guidelines: p.guidelines }));
                if (!shots.length) shots.push({ description: 'Vista General', guidelines: null });
                b.dataset.shotList = JSON.stringify(shots).replace(/'/g, '&apos;');
            });
            setupGaleriaEvents();
        } catch (err) {
            alert('Error al generar el plan: ' + err.message);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-robot"></i> Generar plan IA'; }
        }
    });
}

export function setupGaleriaEvents() {
    bindGenerarPlanIa();

    const wrapper = document.getElementById('galerias-wrapper');
    if (!wrapper) return;

    const newWrapper = wrapper.cloneNode(true);
    wrapper.parentNode.replaceChild(newWrapper, wrapper);

    newWrapper.addEventListener('click', onGaleriasWrapperClick);

    newWrapper.querySelectorAll('.subir-imagenes-input').forEach((input) => {
        input.addEventListener('change', (ev) => {
            if (ev.target.files.length > 0) {
                handleSubirMasivo(ev.target.dataset.componentId, ev.target.files);
            }
        });
    });
}
