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
      return `<div class="bg-red-100 p-4 rounded-md text-red-800"><b>Error de configuración:</b> No se ha definido un "Canal por Defecto". Por favor, ve a la sección de "Gestionar Canales" y marca uno con la estrella.</div>`;
    }
  } catch (error) {
    console.error("Error al cargar datos para tarifas:", error);
    return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
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
    
    <div id="tarifa-modal-edit" class="modal hidden">
      <div class="modal-content">
        <h3 class="text-xl font-semibold mb-4">Editar Tarifa</h3>
        <form id="tarifa-form-edit" class="space-y-4">
          <input type="text" id="alojamientoNombre" name="alojamientoNombre" disabled class="form-input mt-1 bg-gray-100">
          <input type="text" id="temporada" name="temporada" placeholder="Temporada" required class="form-input mt-1">
          <input type="date" id="fechaInicio" name="fechaInicio" required class="form-input mt-1">
          <input type="date" id="fechaTermino" name="fechaTermino" required class="form-input mt-1">
          <div>
            <label for="precioBase" class="block text-sm font-medium text-gray-700">Precio Base (${canalPorDefecto.moneda})</label>
            <input type="number" id="precioBase" name="precioBase" required class="form-input mt-1">
          </div>
          <div class="flex justify-end pt-4 border-t">
            <button type="button" id="cancel-edit-btn" class="btn-secondary mr-2">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
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
      abrirModalEditar(tarifa, canalPorDefecto);
    }

    if (target.classList.contains('copy-btn')) {
      handleCopyClick(tarifa, canalPorDefecto);
    }

    if (target.classList.contains('delete-btn')) {
      handleDeleteClick(id, tarifas, renderTabla, fetchAPI);
    }
  });
}