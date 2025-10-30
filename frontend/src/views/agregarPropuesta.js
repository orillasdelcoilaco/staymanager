import { render } from './components/agregarPropuesta/cards.js';
import { initPropuestaGuardadaModal } from './components/agregarPropuesta/modals.js';
import {
  loadInitialData,
  filterClients,
  handleCanalChange,
  runSearch,
  handleGuardarPropuesta,
  handleCuponChange,
  handleCopyPropuesta,
  handleCerrarModal,
  handleEditMode
} from './components/agregarPropuesta/utils.js';

export { render };

export async function afterRender() {
  await loadInitialData();
  initPropuestaGuardadaModal();

  document.getElementById('buscar-btn').addEventListener('click', runSearch);
  document.getElementById('client-search').addEventListener('input', filterClients);
  document.getElementById('canal-select').addEventListener('change', handleCanalChange);
  document.getElementById('cupon-input').addEventListener('change', handleCuponChange);
  document.getElementById('guardar-propuesta-btn').addEventListener('click', handleGuardarPropuesta);
  document.getElementById('copiar-propuesta-btn').addEventListener('click', handleCopyPropuesta);
  document.getElementById('cerrar-propuesta-modal-btn').addEventListener('click', handleCerrarModal);

  handleEditMode();
}