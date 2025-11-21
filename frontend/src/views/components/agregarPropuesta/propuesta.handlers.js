// frontend/src/views/components/agregarPropuesta/propuesta.handlers.js

import { fetchAPI } from '../../../api.js';
import { handleNavigation } from '../../../router.js';
import { formatCurrency } from '../../../shared/formatters.js';
import { handleCuponChange as handleCuponChangeShared, getCuponAplicado, clearCupon } from '../../../shared/cuponesValidator.js';
import { renderSelectionWidgets } from './propuesta.ui.js';
import { state, fetchInitialData, resetSearchState } from './propuesta.state.js';

// Importamos los nuevos módulos especializados
import { filterClients, selectClient, clearClientSelection, obtenerOcrearCliente } from './propuesta.clientes.js';
import { updateSummary } from './propuesta.precios.js';

// Re-exportamos las funciones de clientes para que agregarPropuesta.js las use en los listeners
export { filterClients, selectClient, clearClientSelection, updateSummary };

// Variable para almacenar datos necesarios para el envío de correo
let datosParaCorreo = null;

// --- Inicialización ---

export async function initializeView() {
    const success = await fetchInitialData();
    if (!success) {
        alert("Error al cargar datos iniciales. Por favor, recargue la página.");
        return;
    }

    const canalSelect = document.getElementById('canal-select');
    if (canalSelect) {
        canalSelect.innerHTML = state.allCanales.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        const appChannel = state.allCanales.find(c => c.nombre.toLowerCase() === 'app');
        if (appChannel) canalSelect.value = appChannel.id;
    }

    const plantillaSelect = document.getElementById('plantilla-select');
    if (plantillaSelect) {
        plantillaSelect.innerHTML = state.allPlantillas.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        const defaultPlantilla = state.allPlantillas.find(p => p.nombre.toLowerCase().includes('propuesta'));
        if (defaultPlantilla) plantillaSelect.value = defaultPlantilla.id;
    }

    handleCanalChange();
}

// --- Lógica de Propuesta ---

export function handleCanalChange() {
    const canalSelect = document.getElementById('canal-select');
    if (!canalSelect) return;
    const canalId = canalSelect.value;
    const canal = state.allCanales.find(c => c.id === canalId);
    if (!canal) return;
  
    const moneda = canal.moneda;
    document.getElementById('descuento-fijo-label').textContent = `Descuento Fijo Manual (${moneda})`;
    document.getElementById('valor-dolar-container').classList.toggle('hidden', moneda !== 'USD');
  
    if (state.availabilityData.suggestion) {
      handleSelectionChange();
    }
}

export function renderSelectionUI() {
    const suggestionList = document.getElementById('suggestion-list');
    const availableList = document.getElementById('available-list');
    
    if (!state.availabilityData.suggestion) return;
  
    if (state.availabilityData.suggestion.isSegmented) {
      const propMap = new Map();
      state.availabilityData.suggestion.itinerary.forEach(segment => {
          segment.propiedades.forEach(prop => propMap.set(prop.id, prop));
      });
      state.selectedProperties = Array.from(propMap.values());
    } else {
      state.selectedProperties = [...state.availabilityData.suggestion.propiedades];
    }
  
    renderSelectionWidgets(
        suggestionList,
        availableList,
        state.availabilityData,
        state.selectedProperties,
        handleSelectionChange
    );
    
    updateSummary(state.availabilityData.suggestion.pricing);
}

export async function handleSelectionChange() {
    const selectedIds = new Set(Array.from(document.querySelectorAll('.propiedad-checkbox:checked')).map(cb => cb.dataset.id));
    
    if (state.availabilityData.allValidProperties) {
        state.selectedProperties = state.availabilityData.allValidProperties.filter(p => selectedIds.has(p.id));
    } else {
        state.selectedProperties = state.allProperties.filter(p => selectedIds.has(p.id));
    }
  
    if (state.selectedProperties.length === 0) {
      updateSummary({ 
        totalPriceOriginal: 0, 
        totalPriceCLP: 0, 
        nights: state.currentPricing.nights, 
        details: [], 
        currencyOriginal: state.currentPricing.currencyOriginal || 'CLP'
      });
      return;
    }
  
    try {
      const payload = {
        fechaLlegada: document.getElementById('fecha-llegada').value,
        fechaSalida: document.getElementById('fecha-salida').value,
        propiedades: state.selectedProperties,
        canalId: document.getElementById('canal-select').value
      };
      const newPricing = await fetchAPI('/propuestas/recalcular', { method: 'POST', body: payload });
      updateSummary(newPricing);
    } catch (error) {
      alert(`Error al recalcular: ${error.message}`);
    }
}

export async function runSearch() {
    const payload = {
      fechaLlegada: document.getElementById('fecha-llegada').value,
      fechaSalida: document.getElementById('fecha-salida').value,
      personas: document.getElementById('personas').value,
      sinCamarotes: document.getElementById('sin-camarotes').checked,
      permitirCambios: document.getElementById('permitir-cambios').checked,
      canalId: document.getElementById('canal-select').value,
      editId: state.editId
    };
  
    if (!payload.fechaLlegada || !payload.fechaSalida || !payload.personas) {
      alert('Por favor, completa las fechas y la cantidad de personas.');
      return false;
    }
  
    const statusContainer = document.getElementById('status-container');
    const buscarBtn = document.getElementById('buscar-btn');
    buscarBtn.disabled = true;
    buscarBtn.textContent = 'Buscando...';
    statusContainer.textContent = 'Buscando disponibilidad y sugerencias...';
    statusContainer.classList.remove('hidden');
    document.getElementById('results-container').classList.add('hidden');
    document.getElementById('suggestion-list').innerHTML = '';
    document.getElementById('available-list').innerHTML = '';
  
    try {
      resetSearchState();
      document.getElementById('descuento-pct').value = '';
      document.getElementById('descuento-fijo-total').value = '';
      
      clearCupon(updateSummary, state.currentPricing);
    } catch (e) {
      console.warn("Error al limpiar estado:", e);
    }
  
    try {
      const [dolar, availability] = await Promise.all([
        fetchAPI(`/dolar/valor/${payload.fechaLlegada}`),
        fetchAPI('/propuestas/generar', { method: 'POST', body: payload })
      ]);

      state.valorDolarDia = dolar.valor;
      document.getElementById('valor-dolar-info').textContent = `Valor Dólar para el Check-in: ${formatCurrency(state.valorDolarDia)}`;
  
      state.availabilityData = availability;
      
      const suggested = state.availabilityData.suggestion?.propiedades || [];
      const available = state.availabilityData.availableProperties || [];
      const suggestedIds = new Set(suggested.map(p => p.id));
      
      state.availabilityData.allValidProperties = [
        ...suggested,
        ...available.filter(p => !suggestedIds.has(p.id))
      ];
  
      if (state.availabilityData.suggestion) {
        statusContainer.classList.add('hidden');
        document.getElementById('results-container').classList.remove('hidden');
        renderSelectionUI(); 
        return true;
      } else {
        statusContainer.textContent = state.availabilityData.message || 'No se encontró disponibilidad.';
        return false;
      }
    } catch (error) {
      statusContainer.textContent = `Error: ${error.message}`;
      return false;
    } finally {
      buscarBtn.disabled = false;
      buscarBtn.textContent = 'Buscar Disponibilidad';
    }
}

export async function handleCuponChange() {
    await handleCuponChangeShared(
        updateSummary, 
        state.currentPricing, 
        (codigoIntentado) => {
            if (!state.selectedClient) {
                alert("Por favor, selecciona o crea un cliente primero.");
                return;
            }
            if(confirm(`¿Quieres ir a la sección de CRM para crear el cupón "${codigoIntentado}" para ${state.selectedClient.nombre}?`)) {
                handleNavigation('/crm-promociones'); 
            }
        }
    );
}

export async function handleGuardarPropuesta() {
    if (!state.availabilityData.suggestion) {
      alert('Primero realiza una búsqueda de disponibilidad.');
      return;
    }
  
    const cliente = await obtenerOcrearCliente();
    if (!cliente || !cliente.id) {
      alert('No se pudo procesar el cliente. Verifica los datos.');
      return;
    }
    
    const precioFinalCalculado = parseFloat(document.getElementById('summary-precio-final')?.textContent.replace(/[$.]/g, '')) || 0;
    const nochesCalculadas = parseInt(document.getElementById('summary-noches')?.textContent) || 0;
    
    const summaryContainer = document.getElementById('summary-clp-container');
    const precioListaElement = summaryContainer.querySelector('div:nth-child(2) > span:nth-child(2)');
    const precioListaCLPCalculado = precioListaElement ? parseFloat(precioListaElement.textContent.replace(/[$.]/g, '')) : (state.currentPricing.totalPriceCLP || 0);
    
    const descuentoCLPCalculado = precioListaCLPCalculado - precioFinalCalculado;
  
    const valorFinalFijado = parseFloat(document.getElementById('valor-final-fijo').value) || 0;
    const cuponAplicado = getCuponAplicado();
  
    const propuestaPayloadGuardar = {
      fechaLlegada: document.getElementById('fecha-llegada').value,
      fechaSalida: document.getElementById('fecha-salida').value,
      personas: parseInt(document.getElementById('personas').value),
      canalId: document.getElementById('canal-select').value,
      canalNombre: state.allCanales.find(c => c.id === document.getElementById('canal-select').value)?.nombre || 'Desconocido',
      cliente: cliente,
      propiedades: state.selectedProperties,
      precioFinal: precioFinalCalculado,
      noches: nochesCalculadas,
      moneda: state.currentPricing.currencyOriginal,
      valorDolarDia: state.valorDolarDia,
      valorOriginal: state.currentPricing.totalPriceOriginal,
      codigoCupon: cuponAplicado?.codigo || null,
      idReservaCanal: document.getElementById('id-reserva-canal-input').value || null,
      icalUid: document.getElementById('ical-uid-input').value || null,
      origen: state.origenReserva,
      sinCamarotes: document.getElementById('sin-camarotes').checked,
      permitirCambios: document.getElementById('permitir-cambios').checked,
      descuentoPct: parseFloat(document.getElementById('descuento-pct').value) || 0,
      descuentoFijo: parseFloat(document.getElementById('descuento-fijo-total').value) || 0,
      valorFinalFijado: valorFinalFijado,
      plantillaId: document.getElementById('plantilla-select').value || null
    };
  
    const guardarBtn = document.getElementById('guardar-propuesta-btn');
    try {
      guardarBtn.disabled = true;
      guardarBtn.textContent = state.editId ? 'Actualizando...' : 'Guardando...';
  
      let propuestaGuardada;
      if (state.editId) {
        propuestaGuardada = await fetchAPI(`/gestion-propuestas/propuesta-tentativa/${state.editId}`, {
          method: 'PUT',
          body: propuestaPayloadGuardar
        });
        propuestaGuardada.id = state.editId;
      } else {
        propuestaGuardada = await fetchAPI('/gestion-propuestas/propuesta-tentativa', {
          method: 'POST',
          body: propuestaPayloadGuardar
        });
      }
  
      const payloadTexto = {
        ...propuestaPayloadGuardar,
        idPropuesta: propuestaGuardada.id,
        precioListaCLP: precioListaCLPCalculado,
        descuentoCLP: descuentoCLPCalculado,
        pricingDetails: state.currentPricing.details || []
      };
      
      const resultadoTexto = await fetchAPI('/propuestas/generar-texto', {
          method: 'POST',
          body: payloadTexto
      });
  
      document.getElementById('propuesta-texto').value = resultadoTexto.texto;
      
      // Configurar el checkbox de envío de correo
      configurarCheckboxCorreo(cliente, propuestaGuardada.id, payloadTexto);
      
      document.getElementById('propuesta-guardada-modal').classList.remove('hidden');
  
    } catch (error) {
      console.error('Error al guardar propuesta:', error);
      alert(`Error al guardar: ${error.message}`);
    } finally {
      guardarBtn.disabled = false;
      guardarBtn.textContent = state.editId ? 'Actualizar Propuesta' : 'Crear Reserva Tentativa';
    }
}

/**
 * Configura el estado del checkbox de envío de correo según los datos del cliente
 */
function configurarCheckboxCorreo(cliente, propuestaId, payloadTexto) {
    const checkbox = document.getElementById('enviar-propuesta-email');
    const emailDestinatario = document.getElementById('email-destinatario');
    const emailAdvertencia = document.getElementById('email-advertencia');
    const contenedor = document.getElementById('enviar-correo-container');
    
    if (!checkbox || !emailDestinatario || !emailAdvertencia || !contenedor) return;
    
    const emailCliente = cliente.email || '';
    
    // Guardar datos para el envío posterior
    datosParaCorreo = {
        clienteId: cliente.id,
        clienteEmail: emailCliente,
        clienteNombre: cliente.nombre,
        propuestaId: propuestaId,
        plantillaId: document.getElementById('plantilla-select').value,
        textoMensaje: document.getElementById('propuesta-texto').value,
        payloadTexto: payloadTexto
    };
    
    if (emailCliente && emailCliente.trim() !== '') {
        // Cliente tiene email - habilitar checkbox
        checkbox.checked = true;
        checkbox.disabled = false;
        emailDestinatario.textContent = `Se enviará a: ${emailCliente}`;
        emailDestinatario.classList.remove('hidden');
        emailAdvertencia.classList.add('hidden');
        contenedor.classList.remove('bg-amber-50', 'border-amber-200');
        contenedor.classList.add('bg-gray-50');
    } else {
        // Cliente NO tiene email - deshabilitar checkbox y mostrar advertencia
        checkbox.checked = false;
        checkbox.disabled = true;
        emailDestinatario.classList.add('hidden');
        emailAdvertencia.textContent = '⚠️ No se puede enviar correo: el cliente no tiene email registrado';
        emailAdvertencia.classList.remove('hidden');
        contenedor.classList.remove('bg-gray-50');
        contenedor.classList.add('bg-amber-50', 'border-amber-200');
    }
}

export function handleCopyPropuesta() {
    const textarea = document.getElementById('propuesta-texto');
    textarea.select();
    navigator.clipboard.writeText(textarea.value);
    const btn = document.getElementById('copiar-propuesta-btn');
    btn.textContent = '¡Copiado!';
    setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
}
  
export async function handleCerrarModal() {
    const checkbox = document.getElementById('enviar-propuesta-email');
    
    // Si el checkbox está marcado y tenemos datos, enviar el correo
    if (checkbox && checkbox.checked && !checkbox.disabled && datosParaCorreo) {
        const cerrarBtn = document.getElementById('cerrar-propuesta-modal-btn');
        
        try {
            cerrarBtn.disabled = true;
            cerrarBtn.textContent = 'Enviando correo...';
            
            await fetchAPI('/comunicaciones/enviar-propuesta', {
                method: 'POST',
                body: {
                    clienteId: datosParaCorreo.clienteId,
                    clienteEmail: datosParaCorreo.clienteEmail,
                    clienteNombre: datosParaCorreo.clienteNombre,
                    propuestaId: datosParaCorreo.propuestaId,
                    plantillaId: datosParaCorreo.plantillaId,
                    textoMensaje: datosParaCorreo.textoMensaje
                }
            });
            
            // Mostrar confirmación breve
            cerrarBtn.textContent = '✅ Correo enviado';
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.error('Error al enviar correo:', error);
            // No bloquear el cierre, solo mostrar advertencia
            alert(`Advertencia: No se pudo enviar el correo. ${error.message}`);
        } finally {
            cerrarBtn.disabled = false;
            cerrarBtn.textContent = 'Cerrar';
        }
    }
    
    // Limpiar datos y cerrar modal
    datosParaCorreo = null;
    document.getElementById('propuesta-guardada-modal').classList.add('hidden');
    handleNavigation('/gestionar-propuestas');
}

export function handleEditMode() {
    const params = new URLSearchParams(window.location.search);
    
    state.editId = params.get('edit');
    const loadDocId = params.get('load');
    const propIds = params.get('props');
    
    state.origenReserva = params.get('origen') || 'manual';
  
    if (state.editId && loadDocId) {
      handleCargarPropuesta(loadDocId, state.editId, propIds);
    }
}

export async function handleCargarPropuesta(loadDocId, editIdGrupo, propIdsQuery) {
    const params = new URLSearchParams(window.location.search);
  
    try {
      const fechaLlegada = params.get('fechaLlegada');
      const fechaSalida = params.get('fechaSalida');
      const personas = params.get('personas');
      const canalId = params.get('canalId');
      
      document.getElementById('fecha-llegada').value = fechaLlegada || '';
      document.getElementById('fecha-salida').value = fechaSalida || '';
      document.getElementById('personas').value = personas || '1';
      if (canalId) {
        document.getElementById('canal-select').value = canalId;
      }
  
      const searchSuccess = await runSearch();
      
      const propuesta = await fetchAPI(`/reservas/${loadDocId}`);
      if (!propuesta) {
        alert('Reserva no encontrada');
        handleNavigation('/gestionar-propuestas');
        return;
      }
  
      if (propuesta.cliente) {
        if (propuesta.cliente.id) {
          selectClient(propuesta.cliente); // Usamos la función importada
        } else {
            document.getElementById('new-client-name').value = propuesta.cliente.nombre || '';
            document.getElementById('new-client-phone').value = propuesta.cliente.telefono || '';
            document.getElementById('new-client-email').value = propuesta.cliente.email || '';
        }
      }
  
      document.getElementById('id-reserva-canal-input').value = propuesta.idReservaCanal || editIdGrupo;
      if (propuesta.icalUid) {
        document.getElementById('ical-uid-input').value = propuesta.icalUid;
        document.getElementById('ical-uid-container').classList.remove('hidden');
      }
      document.getElementById('guardar-propuesta-btn').textContent = 'Actualizar Propuesta';
      if (propuesta.plantillaId) {
        document.getElementById('plantilla-select').value = propuesta.plantillaId;
      }
  
      if (searchSuccess && propIdsQuery) {
          const selectedIds = new Set(propIdsQuery.split(','));
          
          document.querySelectorAll('.propiedad-checkbox').forEach(cb => {
            cb.checked = selectedIds.has(cb.dataset.id);
          });
  
          if (state.availabilityData.allValidProperties) {
            state.selectedProperties = state.availabilityData.allValidProperties.filter(p => selectedIds.has(p.id));
          } else {
            state.selectedProperties = state.allProperties.filter(p => selectedIds.has(p.id));
          }
          
          await handleSelectionChange(); 
  
          if (propuesta.valores?.codigoCupon) {
            document.getElementById('cupon-input').value = propuesta.valores.codigoCupon;
            await handleCuponChange();
          }
          
          const valorFijoGuardado = propuesta.valores?.valorFinalFijado || 0;
          if (valorFijoGuardado > 0) {
              document.getElementById('valor-final-fijo').value = valorFijoGuardado;
          } else {
              document.getElementById('descuento-pct').value = propuesta.valores?.descuentoPct || '';
              document.getElementById('descuento-fijo-total').value = propuesta.valores?.descuentoFijo || '';
          }
          
          updateSummary(state.currentPricing);
      }
    } catch (error) {
      console.error('Error al cargar la propuesta:', error);
      alert(`Error al cargar la propuesta: ${error.message}`);
      handleNavigation('/gestionar-propuestas');
    }
}