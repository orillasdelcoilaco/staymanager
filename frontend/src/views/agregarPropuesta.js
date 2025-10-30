import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { 
  formatCurrency,
  loadInitialData,
  filterClients,
  selectClient,
  clearClientSelection,
  createPropertyCheckbox,
  renderSelectionUI,
  handleSelectionChange,
  updateSummary,
  handleCanalChange
} from './utils.js';

export function render() {
  return `
    <div class="bg-white p-8 rounded-lg shadow space-y-8">
      <div>
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Crear/Editar Propuesta de Reserva</h2>
        
        <div class="p-4 border rounded-md bg-gray-50 mb-6">
          <h3 class="font-semibold text-gray-800 mb-2">1. Fechas, Personas y Disponibilidad</h3>
          <div class="flex flex-col md:flex-row items-end space-y-4 md:space-y-0 md:space-x-4">
            <div>
              <label for="fecha-llegada" class="block text-sm font-medium text-gray-700">Llegada</label>
              <input type="date" id="fecha-llegada" class="form-input mt-1">
            </div>
            <div>
              <label for="fecha-salida" class="block text-sm font-medium text-gray-700">Salida</label>
              <input type="date" id="fecha-salida" class="form-input mt-1">
            </div>
            <div>
              <label for="personas" class="block text-sm font-medium text-gray-700">N° Personas</label>
              <input type="number" id="personas" min="1" class="form-input mt-1">
            </div>
            <div class="flex items-center pt-6">
              <input id="sin-camarotes" type="checkbox" class="h-4 w-4 text-indigo-600 border-gray-300 rounded">
              <label for="sin-camarotes" class="ml-2 block text-sm font-medium text-gray-700">Excluir Camarotes</label>
            </div>
            <div class="flex items-center pt-6">
              <input id="permitir-cambios" type="checkbox" class="h-4 w-4 text-indigo-600 border-gray-300 rounded">
              <label for="permitir-cambios" class="ml-2 block text-sm font-medium text-gray-700">Permitir cambios de cabaña</label>
            </div>
            <button id="buscar-btn" class="btn-primary w-full md:w-auto">Buscar Disponibilidad</button>
          </div>
        </div>

        <div id="status-container" class="text-center text-gray-500 hidden p-4"></div>

        <div id="results-container" class="hidden">
          <div id="propiedades-section" class="p-4 border rounded-md bg-gray-50 mb-6">
            <h3 class="font-semibold text-gray-800">2. Selección de Propiedades</h3>
            <div id="suggestion-list" class="mt-2 space-y-2"></div>
            <h4 class="font-medium text-gray-700 mt-4">Otras Disponibles</h4>
            <div id="available-list" class="mt-2 space-y-2"></div>
          </div>

          <div id="cliente-section" class="p-4 border rounded-md bg-gray-50 mb-6">
            <h3 class="font-semibold text-gray-800 mb-2">3. Cliente y Canal de Venta</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="relative"> 
                <label id="client-form-title" class="block text-sm font-medium text-gray-700">Buscar o Crear Cliente</label>
                <input type="text" id="client-search" placeholder="Buscar por nombre o teléfono..." class="form-input mt-1">
                <div id="client-results-list" class="hidden mt-1 border rounded-md max-h-32 overflow-y-auto bg-white z-10 absolute w-full max-w-sm"></div>
                <input type="text" id="new-client-name" placeholder="Nombre completo" class="form-input mt-2">
                <input type="tel" id="new-client-phone" placeholder="Teléfono" class="form-input mt-2">
                <input type="email" id="new-client-email" placeholder="Email (opcional)" class="form-input mt-2">
              </div>
              <div>
                <label for="canal-select" class="block text-sm font-medium text-gray-700">Canal de Venta</label>
                <select id="canal-select" class="form-select mt-1"></select>
                <div class="mt-2">
                  <label for="id-reserva-canal-input" class="block text-sm font-medium text-gray-700">ID Reserva Canal</label>
                  <input type="text" id="id-reserva-canal-input" class="form-input mt-1">
                </div>
                <div id="ical-uid-container" class="mt-2 hidden">
                  <label for="ical-uid-input" class="block text-sm font-medium text-gray-500">iCal UID (Referencia)</label>
                  <input type="text" id="ical-uid-input" class="form-input mt-1 bg-gray-100" readonly>
                </div>
              </div>
            </div>
          </div>

          <div id="pricing-section" class="p-4 border rounded-md bg-gray-50">
            <h3 class="font-semibold text-gray-800 mb-4">4. Descuentos y Resumen Final</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="space-y-4 md:col-span-1">
                <div id="valor-dolar-container" class="hidden"><p id="valor-dolar-info" class="text-sm font-semibold text-blue-600"></p></div>
                <div><label for="cupon-input" class="block text-sm font-medium">Código de Descuento</label><input type="text" id="cupon-input" class="form-input mt-1"><div id="cupon-status" class="text-xs mt-1"></div></div>
                <div><label for="descuento-pct" class="block text-sm font-medium">Descuento Manual (%)</label><input type="number" id="descuento-pct" placeholder="Ej: 15" class="discount-input form-input mt-1"></div>
                <div><label id="descuento-fijo-label" for="descuento-fijo-total" class="block text-sm font-medium">Descuento Fijo Manual</label><input type="number" id="descuento-fijo-total" placeholder="Ej: 20000" class="discount-input form-input mt-1"></div>
              </div>
              <div id="summary-original-currency-container" class="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-2 md:col-span-1 hidden"></div>
              <div id="summary-clp-container" class="p-4 bg-white rounded-md border space-y-2 md:col-span-1"></div>
            </div>
          </div>

          <div class="text-right pt-6 border-t mt-8">
            <button id="guardar-propuesta-btn" class="btn-primary btn-lg">Crear Reserva Tentativa</button>
          </div>
        </div>
      </div>
    </div>

    <div id="propuesta-guardada-modal" class="modal hidden">
      <div class="modal-content !max-w-2xl">
        <h3 class="text-xl font-semibold mb-4">Propuesta Guardada con Éxito</h3>
        <p class="text-sm text-gray-600 mb-4">Copia el siguiente resumen y envíalo al cliente. Puedes gestionar esta y otras propuestas en la nueva sección "Gestionar Propuestas".</p>
        <textarea id="propuesta-texto" rows="15" class="form-input w-full bg-gray-50 font-mono text-xs"></textarea>
        <div class="flex justify-end space-x-2 mt-4">
          <button id="copiar-propuesta-btn" class="btn-secondary">Copiar</button>
          <button id="cerrar-propuesta-modal-btn" class="btn-primary">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

export async function afterRender() {
  await loadInitialData();

  document.getElementById('buscar-btn').addEventListener('click', runSearch);
  document.getElementById('client-search').addEventListener('input', filterClients);
  document.getElementById('canal-select').addEventListener('change', handleCanalChange);
  document.getElementById('cupon-input').addEventListener('change', handleCuponChange);
  document.getElementById('guardar-propuesta-btn').addEventListener('click', handleGuardarPropuesta);
  document.getElementById('copiar-propuesta-btn').addEventListener('click', handleCopyPropuesta);
  document.getElementById('cerrar-propuesta-modal-btn').addEventListener('click', handleCerrarModal);

  document.querySelectorAll('.discount-input').forEach(input => input.addEventListener('input', () => updateSummary(currentPricing)));

  handleEditMode();
}