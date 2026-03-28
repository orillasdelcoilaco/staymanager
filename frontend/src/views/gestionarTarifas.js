// frontend/src/views/gestionarTarifas.js

import { renderTabla } from './components/gestionarTarifas/cards.js';
import { initModals, abrirModalEditar, cerrarModalEditar } from './components/gestionarTarifas/modals.js';
import { 
  poblarSelectAlojamientos, 
  limpiarFormularioPrincipal, 
  handleFormSubmit, 
  handleCopyClick, 
  handleDeleteClick,
  handleEditSubmit 
} from './components/gestionarTarifas/utils.js';
import { fetchAPI } from '../api.js';

let tarifas = [];
let alojamientos = [];
let canales = [];
let editandoTarifa = null;
let canalPorDefecto = null;

function renderModalEditarTarifa(moneda) {
  return `
    <div id="tarifa-modal-edit" class="modal hidden">
      <div class="modal-content !max-w-lg">
        <div class="flex items-center gap-4 mb-6 pb-5 border-b">
          <div class="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 text-xl flex-shrink-0">💲</div>
          <div>
            <h3 class="text-xl font-semibold text-gray-900">Editar Tarifa</h3>
            <p id="modal-tarifa-subtitle" class="text-sm text-gray-500">Ajusta los valores de esta temporada</p>
          </div>
        </div>
        <form id="tarifa-form-edit">
          <div class="mb-4">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alojamiento</label>
            <input type="text" id="alojamientoNombre" name="alojamientoNombre" disabled
                   class="form-input mt-1 bg-gray-50 text-gray-500 cursor-not-allowed">
          </div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Temporada</p>
          <div class="grid grid-cols-1 gap-3 mb-4">
            <div>
              <label class="label">Nombre <span class="text-danger-500">*</span></label>
              <input type="text" id="temporada" name="temporada" placeholder="Ej: Alta 2026, Semana Santa…"
                     required class="form-input mt-1">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">Fecha inicio <span class="text-danger-500">*</span></label>
                <input type="date" id="fechaInicio" name="fechaInicio" required class="form-input mt-1">
              </div>
              <div>
                <label class="label">Fecha término <span class="text-danger-500">*</span></label>
                <input type="date" id="fechaTermino" name="fechaTermino" required class="form-input mt-1">
              </div>
            </div>
          </div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Precio</p>
          <div class="mb-5">
            <label class="label" for="precioBase">Precio base por noche
              <span class="ml-1 text-xs font-normal text-gray-400">(${moneda})</span>
            </label>
            <div class="relative mt-1">
              <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 font-medium pointer-events-none">$</span>
              <input type="number" id="precioBase" name="precioBase" required class="form-input pl-7" placeholder="0">
            </div>
          </div>
          <div class="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden mb-5">
            <div class="px-4 py-2.5 border-b border-gray-100 bg-white">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Precios calculados por canal</p>
            </div>
            <div id="precios-canales-preview" class="divide-y divide-gray-100"></div>
          </div>
          <div class="flex justify-end gap-3 pt-4 border-t">
            <button type="button" id="cancel-edit-btn" class="btn-outline">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar cambios</button>
          </div>
        </form>
      </div>
    </div>`;
}

export async function render() {
  try {
    [tarifas, alojamientos, canales] = await Promise.all([
      fetchAPI('/tarifas'),
      fetchAPI('/propiedades'),
      fetchAPI('/canales')
    ]);
    canalPorDefecto = canales.find(c => c.esCanalPorDefecto);

    // --- INICIO DE LA CORRECCIÓN 1 ---
    // Asignamos las variables a 'window' para que los utils (limpiarFormulario, etc.)
    // puedan acceder a ellas, como esperan.
    window.alojamientos = alojamientos;
    window.canales = canales;
    window.canalPorDefecto = canalPorDefecto;
    // --- FIN DE LA CORRECCIÓN 1 ---

    if (!canalPorDefecto) {
      return `<div class="bg-danger-100 p-4 rounded-md text-danger-800"><b>Error de configuración:</b> No se ha definido un "Canal por Defecto". Por favor, ve a la sección de "Gestionar Canales" y marca uno con la estrella.</div>`;
    }
  } catch (error) {
    console.error("Error al cargar datos para tarifas:", error);
    return `<p class="text-danger-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
  }

  return `
    <div class="bg-white p-6 rounded-lg shadow mb-8">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Añadir Nuevo Período de Tarifa</h2>
      <form id="tarifa-form" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label for="alojamiento-select" class="block text-sm font-medium text-gray-700">Alojamiento</label>
            <select id="alojamiento-select" class="form-input mt-1"></select>
          </div>
          <div>
            <label for="temporada-input" class="block text-sm font-medium text-gray-700">Temporada</label>
            <input type="text" id="temporada-input" placeholder="Ej: Alta Verano 2025" required class="form-input mt-1">
          </div>
          <div>
            <label for="fecha-inicio-input" class="block text-sm font-medium text-gray-700">Fecha Inicio</label>
            <input type="date" id="fecha-inicio-input" required class="form-input mt-1">
          </div>
          <div>
            <label for="fecha-termino-input" class="block text-sm font-medium text-gray-700">Fecha Término</label>
            <input type="date" id="fecha-termino-input" required class="form-input mt-1">
          </div>
          <div>
            <label for="precio-base-input" class="block text-sm font-medium text-gray-700">Precio Base (${canalPorDefecto.moneda})</label>
            <input type="number" id="precio-base-input" required class="form-input mt-1">
          </div>
        </div>
        <div class="flex justify-end pt-4 border-t">
          <button type="submit" class="btn-primary">Guardar Tarifa</button>
        </div>
      </form>
    </div>

    <div class="bg-white p-6 rounded-lg shadow">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Historial de Tarifas</h2>
      <div class="table-container">
        <table class="min-w-full bg-white">
          <thead>
            <tr>
              <th class="th w-12">#</th>
              <th class="th">Alojamiento</th>
              <th class="th">Temporada</th>
              <th class="th">Fecha Inicio</th>
              <th class="th">Fecha Término</th>
              <th class="th">Valor Dólar</th>
              <th class="th">Tarifas Calculadas</th>
              <th class="th">Acciones</th>
            </tr>
          </thead>
          <tbody id="tarifas-tbody"></tbody>
        </table>
      </div>
    </div>
    
    ${renderModalEditarTarifa(canalPorDefecto.moneda)}
  `;
}

export function afterRender() {
  if (!canalPorDefecto) return;

  // --- INICIO DE LA CORRECCIÓN 2 ---
  // Pasamos la variable 'alojamientos' (que SÍ existe en este scope)
  // a la función, que la espera como primer argumento.
  poblarSelectAlojamientos(alojamientos);
  // --- FIN DE LA CORRECCIÓN 2 ---
  
  renderTabla(tarifas, canales, canalPorDefecto);

  initModals();

  const form = document.getElementById('tarifa-form');
  const formEdit = document.getElementById('tarifa-form-edit');
  const tbody = document.getElementById('tarifas-tbody');

  form.addEventListener('submit', (e) => handleFormSubmit(e, tarifas, renderTabla, limpiarFormularioPrincipal, fetchAPI));
  formEdit.addEventListener('submit', (e) => handleEditSubmit(e, editandoTarifa, tarifas, renderTabla, cerrarModalEditar, fetchAPI));
  document.getElementById('cancel-edit-btn').addEventListener('click', cerrarModalEditar);

  tbody.addEventListener('click', (e) => {
    const target = e.target;
    const id = target.dataset.id;
    if (!id) return;

    const tarifa = tarifas.find(t => t.id === id);
    if (!tarifa) return;

    if (target.classList.contains('edit-btn')) {
      editandoTarifa = tarifa;
      abrirModalEditar(tarifa, canalPorDefecto, canales);
    }

    if (target.classList.contains('copy-btn')) {
      handleCopyClick(tarifa, canalPorDefecto);
    }

    if (target.classList.contains('delete-btn')) {
      handleDeleteClick(id, tarifas, renderTabla, fetchAPI);
    }
  });
}