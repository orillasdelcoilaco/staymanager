// frontend/src/views/components/gestionarTarifas/temporadas.js
import { fetchAPI } from '../../../api.js';

let onSeleccionarCallback = null;
let temporadaActiva       = null;
let temporadasRef         = [];   // espejo mutable — se actualiza en renderListaTemporadas
let totalPropiedadesRef   = 0;

export function initTemporadas(onSeleccionar) {
    onSeleccionarCallback = onSeleccionar;
}

export function renderModalTemporada() {
    return `
    <div id="temporada-modal" class="modal hidden">
        <div class="modal-content !max-w-md">
            <div class="flex items-center gap-4 mb-6 pb-5 border-b">
                <div class="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0"><i class="fa-solid fa-calendar-days"></i></div>
                <div>
                    <h3 id="temporada-modal-title" class="text-xl font-semibold text-gray-900">Nueva Temporada</h3>
                    <p id="temporada-modal-subtitle" class="text-sm text-gray-500">Define el nombre y las fechas del período</p>
                </div>
            </div>
            <form id="temporada-form" class="space-y-4">
                <div>
                    <label class="label">Nombre <span class="text-danger-500">*</span></label>
                    <input type="text" name="nombre" required placeholder="Ej: Alta Verano 2026, Semana Santa…" class="form-input mt-1">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="label">Fecha inicio <span class="text-danger-500">*</span></label>
                        <input type="date" name="fechaInicio" required class="form-input mt-1">
                    </div>
                    <div>
                        <label class="label">Fecha término <span class="text-danger-500">*</span></label>
                        <input type="date" name="fechaTermino" required class="form-input mt-1">
                    </div>
                </div>
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" id="temporada-cancel-btn" class="btn-outline">Cancelar</button>
                    <button type="submit" class="btn-primary">Guardar</button>
                </div>
            </form>
        </div>
    </div>`;
}

export function renderListaTemporadas(temporadas, totalPropiedades) {
    temporadasRef       = temporadas;
    totalPropiedadesRef = totalPropiedades;
    const container = document.getElementById('temporadas-lista');
    if (!container) return;

    if (temporadas.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <div class="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <i class="fa-solid fa-calendar-days text-2xl text-gray-300"></i>
                </div>
                <p class="text-sm font-medium text-gray-600">No hay temporadas</p>
                <p class="text-xs mt-1">Crea la primera para comenzar.</p>
            </div>`;
        return;
    }

    container.innerHTML = temporadas.map(t => {
        const cobertura = totalPropiedades > 0 ? Math.round((t.totalTarifas / totalPropiedades) * 100) : 0;
        const isActiva = temporadaActiva?.id === t.id;
        const colorCobertura = cobertura === 100 ? 'bg-success-500' : cobertura > 0 ? 'bg-warning-500' : 'bg-gray-200';

        return `
        <div data-id="${t.id}" class="temporada-item group cursor-pointer rounded-xl border p-4 transition-all
             ${isActiva ? 'border-primary-400 bg-primary-50 shadow-sm' : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'}">
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-gray-900 truncate">${t.nombre}</p>
                    <p class="text-xs text-gray-500 mt-0.5">${t.fechaInicio} → ${t.fechaTermino}</p>
                </div>
                <div class="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button data-id="${t.id}" class="edit-temporada-btn p-1 text-gray-400 hover:text-primary-600" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button data-id="${t.id}" class="delete-temporada-btn p-1 text-gray-400 hover:text-danger-600" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="mt-3">
                <div class="flex justify-between text-xs text-gray-400 mb-1">
                    <span>${t.totalTarifas} / ${totalPropiedades} propiedades</span>
                    <span>${cobertura}%</span>
                </div>
                <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full ${colorCobertura} rounded-full transition-all" style="width:${cobertura}%"></div>
                </div>
            </div>
        </div>`;
    }).join('');
}

export function abrirModalTemporada(temporada = null) {
    const modal = document.getElementById('temporada-modal');
    const form  = document.getElementById('temporada-form');
    const title = document.getElementById('temporada-modal-title');
    const sub   = document.getElementById('temporada-modal-subtitle');
    if (!modal || !form) return;

    if (temporada) {
        title.textContent = 'Editar Temporada';
        sub.textContent   = temporada.nombre;
        form.nombre.value      = temporada.nombre;
        form.fechaInicio.value = temporada.fechaInicio;
        form.fechaTermino.value = temporada.fechaTermino;
        form.dataset.editId = temporada.id;
    } else {
        title.textContent = 'Nueva Temporada';
        sub.textContent   = 'Define el nombre y las fechas del período';
        form.reset();
        delete form.dataset.editId;
    }
    modal.classList.remove('hidden');
}

export function cerrarModalTemporada() {
    document.getElementById('temporada-modal')?.classList.add('hidden');
}

// Llamar UNA SOLA VEZ desde afterRender — no llamar desde recargar()
export function initEventosTemporadas(onReload) {
    // Lista: event delegation sobre el contenedor estable
    const lista = document.getElementById('temporadas-lista');
    if (lista) {
        lista.addEventListener('click', async (e) => {
            const item      = e.target.closest('.temporada-item');
            const editBtn   = e.target.closest('.edit-temporada-btn');
            const deleteBtn = e.target.closest('.delete-temporada-btn');

            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                const t  = temporadasRef.find(x => x.id === id);
                if (!t) return;
                if (t.totalTarifas > 0) {
                    alert(`Esta temporada tiene ${t.totalTarifas} tarifa(s) asignadas. Elimínalas primero desde la matriz.`);
                    return;
                }
                if (!confirm(`¿Eliminar la temporada "${t.nombre}"?`)) return;
                try {
                    await fetchAPI(`/tarifas/temporadas/${id}`, { method: 'DELETE' });
                    onReload();
                } catch (err) { alert(`Error: ${err.message}`); }
                return;
            }

            if (editBtn) {
                const id = editBtn.dataset.id;
                const t  = temporadasRef.find(x => x.id === id);
                if (t) abrirModalTemporada(t);
                return;
            }

            if (item) {
                const id = item.dataset.id;
                temporadaActiva = temporadasRef.find(x => x.id === id) || null;
                renderListaTemporadas(temporadasRef, totalPropiedadesRef);
                if (onSeleccionarCallback) onSeleccionarCallback(temporadaActiva);
            }
        });
    }

    // Form: clonar para limpiar cualquier listener previo
    const oldForm = document.getElementById('temporada-form');
    if (oldForm) {
        const form = oldForm.cloneNode(true);
        oldForm.parentNode.replaceChild(form, oldForm);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const datos = {
                nombre:       form.nombre.value.trim(),
                fechaInicio:  form.fechaInicio.value,
                fechaTermino: form.fechaTermino.value,
            };
            try {
                if (form.dataset.editId) {
                    await fetchAPI(`/tarifas/temporadas/${form.dataset.editId}`, { method: 'PUT', body: datos });
                } else {
                    await fetchAPI('/tarifas/temporadas', { method: 'POST', body: datos });
                }
                cerrarModalTemporada();
                onReload();
            } catch (err) { alert(`Error: ${err.message}`); }
        });

        form.querySelector('#temporada-cancel-btn')?.addEventListener('click', cerrarModalTemporada);
    }
}
