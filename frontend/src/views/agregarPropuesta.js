import { render } from './components/agregarPropuesta/cards.js';
import { afterRender as initModals } from './components/agregarPropuesta/modals.js';

export { render };

export async function afterRender() {
  await loadInitialData();
  initModals();

  document.getElementById('buscar-btn').addEventListener('click', runSearch);
  document.getElementById('client-search').addEventListener('input', filterClients);
  document.getElementById('canal-select').addEventListener('change', handleCanalChange);
  document.getElementById('cupon-input').addEventListener('change', handleCuponChange);
  document.getElementById('guardar-propuesta-btn').addEventListener('click', handleGuardarPropuesta);
  document.getElementById('copiar-propuesta-btn').addEventListener('click', handleCopyPropuesta);
  document.getElementById('cerrar-propuesta-modal-btn').addEventListener('click', handleCerrarModal);

  handleEditMode();
}