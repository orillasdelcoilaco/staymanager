import { fetchAPI } from '../../../api.js';
import { openEditor } from '../../../utils/imageEditorModal.js';
import { renderSlotsGrid } from './webPublica.galeria.grid.js';
import { galeriaRuntime } from './webPublica.galeria.runtime.js';

export async function mostrarFeedbackIA(componentId, resultados) {
    const feedbackContainer = document.getElementById(`ai-feedback-${componentId}`);
    if (!feedbackContainer) return;

    const errores = resultados.filter((r) => r.advertencia);
    if (errores.length > 0) {
        const listaErrores = errores.map((err) => `<li class="mb-1">• ${err.advertencia}</li>`).join('');
        feedbackContainer.innerHTML = `
        <p class="font-bold mb-1">⚠️ Atención:</p>
        <ul class="list-none pl-0">${listaErrores}</ul>
    `;
        feedbackContainer.classList.remove('hidden');
    } else {
        feedbackContainer.classList.add('hidden');
    }
}

export async function handleSubirMasivo(componentId, files) {
    const statusEl = document.getElementById(`upload-status-${componentId}`);
    statusEl.textContent = `Subiendo ${files.length}...`;

    const formData = new FormData();
    for (const file of files) formData.append('images', file);

    try {
        const resultados = await fetchAPI(
            `/website/propiedad/${galeriaRuntime.currentPropiedadId}/upload-image/${componentId}`,
            { method: 'POST', body: formData }
        );
        if (!galeriaRuntime.currentImages[componentId]) galeriaRuntime.currentImages[componentId] = [];
        galeriaRuntime.currentImages[componentId].push(...resultados);

        document.getElementById(`galeria-${componentId}`).innerHTML = renderSlotsGrid(
            galeriaRuntime.currentImages[componentId],
            componentId,
            galeriaRuntime.currentPhotoPlan
        );
        await mostrarFeedbackIA(componentId, resultados);

        statusEl.textContent = 'Listo.';
        setTimeout(() => { statusEl.textContent = ''; }, 2000);

        fetchAPI(`/galeria/${galeriaRuntime.currentPropiedadId}/sync`, { method: 'POST' }).catch(() => {});

        const input = document.getElementById(`input-${componentId}`);
        if (input) input.value = '';
    } catch (error) {
        statusEl.textContent = 'Error.';
        alert(error.message);
    }
}

export async function handleReemplazarImagen(componentId, blob, oldImageId) {
    const oldImage = galeriaRuntime.currentImages[componentId]?.find((img) => img.imageId === oldImageId);
    const shotContext = oldImage ? oldImage.shotContext : null;

    const formData = new FormData();
    formData.append('images', blob, 'edited.jpg');
    if (shotContext) formData.append('shotContext', shotContext);

    try {
        const resultados = await fetchAPI(
            `/website/propiedad/${galeriaRuntime.currentPropiedadId}/upload-image/${componentId}`,
            { method: 'POST', body: formData }
        );
        await fetchAPI(
            `/website/propiedad/${galeriaRuntime.currentPropiedadId}/delete-image/${componentId}/${oldImageId}`,
            { method: 'DELETE' }
        );

        galeriaRuntime.currentImages[componentId] = galeriaRuntime.currentImages[componentId].filter((img) => img.imageId !== oldImageId);
        galeriaRuntime.currentImages[componentId].push(...resultados);

        document.getElementById(`galeria-${componentId}`).innerHTML = renderSlotsGrid(
            galeriaRuntime.currentImages[componentId],
            componentId,
            galeriaRuntime.currentPhotoPlan
        );
    } catch (error) {
        alert(error.message);
    }
}

export async function handleEliminar(componentId, imageId) {
    if (!confirm('¿Eliminar imagen?')) return;
    try {
        await fetchAPI(
            `/website/propiedad/${galeriaRuntime.currentPropiedadId}/delete-image/${componentId}/${imageId}`,
            { method: 'DELETE' }
        );
        galeriaRuntime.currentImages[componentId] = galeriaRuntime.currentImages[componentId].filter((img) => img.imageId !== imageId);
        document.getElementById(`galeria-${componentId}`).innerHTML = renderSlotsGrid(
            galeriaRuntime.currentImages[componentId],
            componentId,
            galeriaRuntime.currentPhotoPlan
        );
    } catch (error) {
        alert(error.message);
    }
}

export async function handleEliminarComponente(componentId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este espacio completo? Se borrarán todas las fotos asociadas. Esta acción no se puede deshacer.')) return;

    try {
        await fetchAPI(`/website/propiedad/${galeriaRuntime.currentPropiedadId}/componente/${componentId}`, { method: 'DELETE' });

        const container = document.getElementById(`galeria-${componentId}`)?.closest('.border.rounded-lg');
        if (container) container.remove();

        const wrapper = document.getElementById('galerias-wrapper');
        if (wrapper && wrapper.children.length === 0) {
            wrapper.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Sin componentes.</p>';
        }
    } catch (error) {
        alert('Error al eliminar componente: ' + error.message);
    }
}

/** Para enlazar desde setupGaleriaEvents (editor externo). */
export function bindEditorReemplazo(componentId, imageUrl, oldImageId) {
    openEditor(imageUrl, (blob) => handleReemplazarImagen(componentId, blob, oldImageId));
}
