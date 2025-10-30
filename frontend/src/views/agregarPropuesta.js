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

export { render, afterRender };

