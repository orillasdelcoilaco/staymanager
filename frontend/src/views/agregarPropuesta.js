// frontend/src/views/agregarPropuesta.js

import { handleNavigation } from '../router.js';

// Componentes Modulares
import { renderPropuestaLayout } from './components/agregarPropuesta/propuesta.ui.js';
import { state } from './components/agregarPropuesta/propuesta.state.js';
import {
  initializeView,
  filterClients,
  runSearch,
  handleCanalChange,
  handleCuponChange,
  handleGuardarPropuesta,
  handleCopyPropuesta,
  handleCerrarModal,
  handleEditMode,
  updateSummary,
  actualizarEstadoCheckboxEmail
} from './components/agregarPropuesta/propuesta.handlers.js';

export function render() {
  // Delegamos el renderizado completo al componente UI
  return renderPropuestaLayout();
}

export async function afterRender() {
  await initializeView();

  // Asignación de Eventos (Handlers)
  
  // Botones Principales
  document.getElementById('buscar-btn')?.addEventListener('click', runSearch);
  document.getElementById('guardar-propuesta-btn')?.addEventListener('click', handleGuardarPropuesta);
  
  // Gestión de Clientes
  document.getElementById('client-search')?.addEventListener('input', filterClients);
  document.getElementById('new-client-email')?.addEventListener('input', actualizarEstadoCheckboxEmail);
  
  // Gestión de Canales
  document.getElementById('canal-select')?.addEventListener('change', handleCanalChange);
  
  // Gestión de Descuentos y Precios
  document.getElementById('valor-final-fijo')?.addEventListener('input', () => updateSummary(state.currentPricing));
  document.getElementById('descuento-pct')?.addEventListener('input', () => updateSummary(state.currentPricing));
  document.getElementById('descuento-fijo-total')?.addEventListener('input', () => updateSummary(state.currentPricing));
  document.getElementById('cupon-input')?.addEventListener('change', handleCuponChange);

  // Refresco de Búsqueda
  document.getElementById('sin-camarotes')?.addEventListener('change', runSearch);
  document.getElementById('permitir-cambios')?.addEventListener('change', runSearch);

  // Modal de Éxito
  document.getElementById('copiar-propuesta-btn')?.addEventListener('click', handleCopyPropuesta);
  document.getElementById('cerrar-propuesta-modal-btn')?.addEventListener('click', () => {
    handleCerrarModal();
    handleNavigation('/gestionar-propuestas');
  });

  // Modo Edición (si hay parámetros en URL)
  handleEditMode();
}