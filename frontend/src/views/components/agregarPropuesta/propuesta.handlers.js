// frontend/src/views/components/agregarPropuesta/propuesta.handlers.js

import { fetchAPI } from '../../../api.js';
import { handleNavigation } from '../../../router.js';
import { formatCurrency } from '../../../shared/formatters.js';
import { handleCuponChange as handleCuponChangeShared, getCuponAplicado, clearCupon } from '../../../shared/cuponesValidator.js';
import { renderSelectionWidgets } from './propuesta.ui.js';
import { state, fetchInitialData, resetSearchState } from './propuesta.state.js';

// ... (MANTENER TODO EL CÓDIGO DE INICIALIZACIÓN Y CLIENTES IGUAL) ...
// Solo estoy mostrando la función modificada para ahorrar espacio, pero
// asegúrate de mantener el resto del archivo handlers.js intacto.

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

// --- Gestión de Clientes (MANTENER IGUAL) ---
export function filterClients(e) {
    const searchTerm = e.target.value.toLowerCase();
    const resultsList = document.getElementById('client-results-list');
    resultsList.innerHTML = '';
    resultsList.classList.add('hidden');
    
    if (!searchTerm) {
        clearClientSelection();
        return;
    }
    
    const filtered = state.allClients.filter(c => c.nombre.toLowerCase().includes(searchTerm) || (c.telefono && c.telefono.includes(searchTerm)));
    
    if (filtered.length > 0) {
        resultsList.classList.remove('hidden');
    }
    
    filtered.slice(0, 5).forEach(client => {
        const div = document.createElement('div');
        div.className = 'p-2 cursor-pointer hover:bg-gray-100';
        div.textContent = `${client.nombre} (${client.telefono})`;
        div.onclick = () => selectClient(client);
        resultsList.appendChild(div);
    });
}

export function selectClient(client) {
    state.selectedClient = client;
    document.getElementById('client-form-title').textContent = '... o actualiza los datos del cliente seleccionado';
    document.getElementById('client-search').value = client.nombre;
    document.getElementById('client-results-list').classList.add('hidden');
    document.getElementById('new-client-name').value = client.nombre || '';
    document.getElementById('new-client-phone').value = client.telefono || '';
    document.getElementById('new-client-email').value = client.email || '';
}

export function clearClientSelection() {
    state.selectedClient = null;
    document.getElementById('client-form-title').textContent = '... o añade un cliente nuevo';
    ['new-client-name', 'new-client-phone', 'new-client-email'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

async function obtenerOcrearCliente() {
    const nombre = document.getElementById('new-client-name').value.trim();
    const telefono = document.getElementById('new-client-phone').value.trim();
    const email = document.getElementById('new-client-email').value.trim();
  
    if (!nombre || !telefono) {
      alert('Nombre y teléfono son obligatorios.');
      return null;
    }
  
    try {
      if (state.selectedClient && state.selectedClient.id) {
        const datosCargados = { nombre: state.selectedClient.nombre, telefono: state.selectedClient.telefono, email: state.selectedClient.email };
        const datosFormulario = { nombre, telefono, email };
        const hayCambios = JSON.stringify(datosCargados) !== JSON.stringify(datosFormulario);
  
        if (hayCambios) {
          const clienteActualizado = { id: state.selectedClient.id, nombre, telefono, email: email || null };
          const response = await fetchAPI(`/clientes/${state.selectedClient.id}`, { method: 'PUT', body: clienteActualizado });
          state.selectedClient = response;
          return response;
        } else {
          return state.selectedClient;
        }
      } else {
        const nuevoCliente = { nombre, telefono, email: email || null };
        const response = await fetchAPI('/clientes', { method: 'POST', body: nuevoCliente });
        state.selectedClient = response.cliente;
        return response.cliente;
      }
    } catch (error) {
      console.error('Error al procesar cliente:', error);
      alert(`Error con el cliente: ${error.message}`);
      return null;
    }
}

// --- Lógica de Propuesta (MANTENER IGUAL HASTA handleCuponChange) ---

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

export function updateSummary(pricing) {
    if (!pricing) pricing = state.currentPricing; 
    state.currentPricing = pricing;
  
    const { totalPriceOriginal, currencyOriginal, nights, totalPriceCLP } = pricing;
    
    const summaryOriginalContainer = document.getElementById('summary-original-currency-container');
    const summaryCLPContainer = document.getElementById('summary-clp-container');
  
    const valorFinalFijoInput = document.getElementById('valor-final-fijo');
    const cuponInput = document.getElementById('cupon-input');
    const pctInput = document.getElementById('descuento-pct');
    const fijoInput = document.getElementById('descuento-fijo-total');
  
    let precioFinalEnMonedaOriginal = 0;
    let descuentoTotalEnMonedaOriginal = 0;
    
    const valorFijo = parseFloat(valorFinalFijoInput.value) || 0;
    const precioLista = totalPriceOriginal || 0;
  
    if (valorFijo > 0) {
      [cuponInput, pctInput, fijoInput].forEach(input => { if(input) input.disabled = true; });
  
      precioFinalEnMonedaOriginal = valorFijo;
      
      if (precioFinalEnMonedaOriginal < precioLista) {
        descuentoTotalEnMonedaOriginal = precioLista - precioFinalEnMonedaOriginal;
      } else {
        descuentoTotalEnMonedaOriginal = 0;
      }
      
    } else {
      [cuponInput, pctInput, fijoInput].forEach(input => { if(input) input.disabled = false; });
  
      const pct = parseFloat(pctInput.value) || 0;
      const fijo = parseFloat(fijoInput.value) || 0;
      
      let descuentoManual = 0;
      if (pct > 0) {
          descuentoManual = precioLista * (pct / 100);
      } else if (fijo > 0) {
          descuentoManual = fijo;
      }
  
      const cuponAplicado = getCuponAplicado();
      const descuentoCupon = cuponAplicado ? precioLista * (cuponAplicado.porcentajeDescuento / 100) : 0;
      
      descuentoTotalEnMonedaOriginal = descuentoManual + descuentoCupon;
      precioFinalEnMonedaOriginal = precioLista - descuentoTotalEnMonedaOriginal;
    }
  
    const precioFinalCLP = currencyOriginal === 'USD' 
      ? Math.round(precioFinalEnMonedaOriginal * state.valorDolarDia) 
      : precioFinalEnMonedaOriginal;
    
    const descuentoTotalCLP = totalPriceCLP - precioFinalCLP;
  
    if (currencyOriginal !== 'CLP') {
      summaryOriginalContainer.classList.remove('hidden');
      summaryOriginalContainer.innerHTML = `
        <h4 class="font-bold text-blue-800 text-center mb-1">Valores en ${currencyOriginal}</h4>
        <div class="flex justify-between text-sm"><span class="text-gray-600">Precio de Lista:</span><span class="font-medium">${formatCurrency(precioLista, currencyOriginal)}</span></div>
        <div class="flex justify-between text-sm text-red-600"><span class="font-medium">Descuento Total:</span><span class="font-medium">-${formatCurrency(descuentoTotalEnMonedaOriginal, currencyOriginal)}</span></div>
        <div class="flex justify-between text-base font-bold border-t pt-2 mt-2"><span>Total (${currencyOriginal}):</span><span class="text-blue-600">${formatCurrency(precioFinalEnMonedaOriginal, currencyOriginal)}</span></div>
      `;
      summaryCLPContainer.classList.add('md:col-span-1');
      summaryCLPContainer.classList.remove('md:col-span-2');
    } else {
      summaryOriginalContainer.classList.add('hidden');
      summaryOriginalContainer.innerHTML = '';
      summaryCLPContainer.classList.remove('md:col-span-1');
      summaryCLPContainer.classList.add('md:col-span-2');
    }
    
    summaryCLPContainer.innerHTML = `
      <h4 class="font-bold text-gray-800 text-center mb-1">Totales en CLP</h4>
      <div class="flex justify-between text-sm"><span class="text-gray-600">Noches Totales:</span><span id="summary-noches" class="font-medium">${nights || 0}</span></div>
      <div class="flex justify-between text-sm"><span class="text-gray-600">Precio Lista (CLP):</span><span class="font-medium">${formatCurrency(totalPriceCLP)}</span></div>
      <div class="flex justify-between text-sm text-red-600"><span class="font-medium">Descuento Total (CLP):</span><span class="font-medium">-${formatCurrency(descuentoTotalCLP)}</span></div>
      <div class="flex justify-between text-lg font-bold border-t pt-2 mt-2"><span>Precio Final a Cobrar:</span><span id="summary-precio-final" class="text-indigo-600">${formatCurrency(precioFinalCLP)}</span></div>
    `;
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

// --- MODIFICADO: Handler de cupón con acción "Crear" ---
export async function handleCuponChange() {
    await handleCuponChangeShared(
        updateSummary, 
        state.currentPricing, 
        // Callback onNotFoundAction
        (codigoIntentado) => {
            if (!state.selectedClient) {
                alert("Por favor, selecciona o crea un cliente primero.");
                return;
            }
            
            // Redirigir al CRM con parámetros pre-cargados si es posible, 
            // o simplemente ir a la vista de gestión de cupones.
            if(confirm(`¿Quieres ir a la sección de CRM para crear el cupón "${codigoIntentado}" para ${state.selectedClient.nombre}?`)) {
                handleNavigation('/crm-promociones'); 
            }
        }
    );
}

// ... (MANTENER EL RESTO DE FUNCIONES: handleGuardarPropuesta, handleCopyPropuesta, etc. IGUAL) ...
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
      document.getElementById('propuesta-guardada-modal').classList.remove('hidden');
  
    } catch (error) {
      console.error('Error al guardar propuesta:', error);
      alert(`Error al guardar: ${error.message}`);
    } finally {
      guardarBtn.disabled = false;
      guardarBtn.textContent = state.editId ? 'Actualizar Propuesta' : 'Crear Reserva Tentativa';
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
  
export function handleCerrarModal() {
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
          state.selectedClient = propuesta.cliente;
          document.getElementById('client-search').value = propuesta.cliente.nombre;
          document.getElementById('client-form-title').textContent = '... o actualiza los datos del cliente seleccionado';
        }
        document.getElementById('new-client-name').value = propuesta.cliente.nombre || '';
        document.getElementById('new-client-phone').value = propuesta.cliente.telefono || '';
        document.getElementById('new-client-email').value = propuesta.cliente.email || '';
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