/**
 * Fragmentos de `abrirModalAlojamiento` extraídos para cumplir límites de complejidad.
 */
import { fetchAPI } from '../../../api.js';
import { renderUbicacionWidget, setupUbicacionWidget } from '../ubicacionWidget.js';

export async function loadModalCatalogCaches() {
    const timestamp = Date.now();
    const [tiposComp, tiposElem, areasData] = await Promise.all([
        fetchAPI(`/componentes?t=${timestamp}`),
        fetchAPI(`/tipos-elemento?t=${timestamp}`),
        fetchAPI('/website/empresa/areas-comunes').catch(() => ({ activo: false, espacios: [] })),
    ]);
    return {
        tiposComp,
        tiposElem,
        areasCompanyCache: areasData.activo ? (areasData.espacios || []) : [],
    };
}

export function buildIcalInputsHtml(canales) {
    return canales
        .filter((canal) => canal.nombre.toLowerCase() !== 'app')
        .map((canal) => `
            <input type="url" id="ical-${canal.id}" data-canal-key="${canal.nombre.toLowerCase()}" class="ical-input">
        `).join('');
}

/**
 * Monta checkboxes de áreas comunes y listeners; oculta sección si no hay datos.
 */
export function mountAreasComunesIfNeeded(areasSection, areasChecks, areasCompanyCache, propiedad) {
    if (!areasSection || !areasChecks) return;

    if (areasCompanyCache.length > 0) {
        const selectedIds = propiedad?.areas_comunes_ids || [];
        areasChecks.innerHTML = `
            <label class="flex items-center gap-2 text-sm cursor-pointer border border-success-200 rounded-lg px-3 py-2 bg-success-50 hover:bg-success-100 transition-colors mb-2">
                <input type="checkbox" id="select-all-areas"
                       class="rounded text-success-600" ${selectedIds.length === areasCompanyCache.length ? 'checked' : ''}>
                <span class="font-medium text-success-700">✅ Seleccionar todas las instalaciones</span>
            </label>
            <div class="flex flex-wrap gap-2">
                ${areasCompanyCache.map((area) => `
                    <label class="flex items-center gap-2 text-sm cursor-pointer border rounded-lg px-3 py-2 hover:bg-success-50 transition-colors">
                        <input type="checkbox" name="area-comun-check" value="${area.id}"
                            class="area-checkbox rounded text-success-600" ${selectedIds.includes(area.id) ? 'checked' : ''}>
                        <span>${area.icono || '🌿'} ${area.nombre}</span>
                    </label>
                `).join('')}
            </div>
        `;
        areasSection.classList.remove('hidden');

        const selectAllCheckbox = document.getElementById('select-all-areas');
        const areaCheckboxes = document.querySelectorAll('.area-checkbox');

        if (selectAllCheckbox && areaCheckboxes.length > 0) {
            selectAllCheckbox.addEventListener('change', function () {
                const isChecked = this.checked;
                areaCheckboxes.forEach((checkbox) => { checkbox.checked = isChecked; });
            });

            areaCheckboxes.forEach((checkbox) => {
                checkbox.addEventListener('change', function () {
                    const allChecked = Array.from(areaCheckboxes).every((cb) => cb.checked);
                    const anyChecked = Array.from(areaCheckboxes).some((cb) => cb.checked);
                    if (selectAllCheckbox) {
                        selectAllCheckbox.checked = allChecked;
                        selectAllCheckbox.indeterminate = anyChecked && !allChecked;
                    }
                });
            });

            const anyChecked = Array.from(areaCheckboxes).some((cb) => cb.checked);
            const allChecked = Array.from(areaCheckboxes).every((cb) => cb.checked);
            if (selectAllCheckbox && anyChecked && !allChecked) {
                selectAllCheckbox.indeterminate = true;
            }
        }
    } else {
        areasSection.classList.add('hidden');
    }
}

export function mountUbicacionCarteraIfNeeded(tipoNegocioEmpresa, propiedad, ubicacionContainer, ubicacionWidgetEl) {
    if (!ubicacionContainer || !ubicacionWidgetEl) return;
    if (tipoNegocioEmpresa === 'cartera') {
        const datosUbicacion = propiedad?.ubicacion || {};
        ubicacionWidgetEl.innerHTML = renderUbicacionWidget('prop-ubicacion', datosUbicacion);
        ubicacionContainer.classList.remove('hidden');
        setupUbicacionWidget('prop-ubicacion');
    } else {
        ubicacionContainer.classList.add('hidden');
        ubicacionWidgetEl.innerHTML = '';
    }
}
