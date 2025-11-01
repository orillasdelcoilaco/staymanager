// frontend/src/views/utils.js
import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let allClients = [];
let allProperties = [];
let allCanales = [];
let selectedClient = null;
let availabilityData = {};
let selectedProperties = [];
let currentPricing = {};
let editId = null;
let valorDolarDia = 0;
let origenReserva = 'manual';
let cuponAplicado = null;

// Exporta variables de estado
export {
  allClients, allProperties, allCanales,
  selectedClient, availabilityData, selectedProperties,
  currentPricing, editId, valorDolarDia, origenReserva, cuponAplicado
};

export function formatCurrency(value, currency = 'CLP') {
  if (currency === 'USD') {
    return `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;
}

export async function loadInitialData() {
  try {
    [allClients, allProperties, allCanales] = await Promise.all([
      fetchAPI('/clientes'),
      fetchAPI('/propiedades'),
      fetchAPI('/canales')
    ]);
    const canalSelect = document.getElementById('canal-select');
    if (canalSelect) {
      canalSelect.innerHTML = allCanales.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
      const appChannel = allCanales.find(c => c.nombre.toLowerCase() === 'app');
      if (appChannel) canalSelect.value = appChannel.id;
    }
    handleCanalChange();
  } catch (error) {
    console.error("No se pudieron cargar los datos iniciales:", error);
    alert("Error al cargar datos iniciales. Por favor, recargue la página.");
  }
}

export function filterClients(e) {
  const searchTerm = e.target.value.toLowerCase();
  const resultsList = document.getElementById('client-results-list');
  resultsList.innerHTML = '';
  resultsList.classList.add('hidden');
  if (!searchTerm) {
    clearClientSelection();
    return;
  }
  const filtered = allClients.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm) || 
    (c.telefono && c.telefono.includes(searchTerm))
  );
  if (filtered.length > 0) resultsList.classList.remove('hidden');
  filtered.slice(0, 5).forEach(client => {
    const div = document.createElement('div');
    div.className = 'p-2 cursor-pointer hover:bg-gray-100';
    div.textContent = `${client.nombre} (${client.telefono})`;
    div.onclick = () => selectClient(client);
    resultsList.appendChild(div);
  });
}

export function selectClient(client) {
  selectedClient = client;
  document.getElementById('client-form-title').textContent = '... o actualiza los datos del cliente seleccionado';
  document.getElementById('client-search').value = client.nombre;
  document.getElementById('client-results-list').classList.add('hidden');
  document.getElementById('new-client-name').value = client.nombre || '';
  document.getElementById('new-client-phone').value = client.telefono || '';
  document.getElementById('new-client-email').value = client.email || '';
}

export function clearClientSelection() {
  selectedClient = null;
  document.getElementById('client-form-title').textContent = '... o añade un cliente nuevo';
  ['new-client-name', 'new-client-phone', 'new-client-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

export function createPropertyCheckbox(prop, isSuggested) {
  return `
    <div class="p-2 border rounded-md flex items-center justify-between bg-white">
      <div>
        <input type="checkbox" id="cb-${prop.id}" data-id="${prop.id}" class="propiedad-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded" ${isSuggested ? 'checked' : ''}>
        <label for="cb-${prop.id}" class="ml-2 font-medium">${prop.nombre}</label>
        <span class="ml-2 text-sm text-gray-500">(Cap: ${prop.capacidad})</span>
      </div>
    </div>`;
}

export function renderSelectionUI() {
  const suggestionList = document.getElementById('suggestion-list');
  const availableList = document.getElementById('available-list');
  suggestionList.innerHTML = '';
  availableList.innerHTML = '';

  if (!availabilityData.suggestion) return;

  const sourceSuggested = availabilityData.suggestion.isSegmented
    ? availabilityData.suggestion.itinerary.map(s => s.propiedad)
    : availabilityData.suggestion.propiedades;

  selectedProperties = [...sourceSuggested]; // ← Fuente con .id

  if (availabilityData.suggestion.isSegmented) {
    // ... (mismo código)
  } else {
    const suggestedIds = new Set(sourceSuggested.map(p => p.id));
    suggestionList.innerHTML = `<h4 class="font-medium text-gray-700">Propiedades Sugeridas</h4>` + 
      sourceSuggested.map(p => createPropertyCheckbox(p, true)).join('');
    
   const availableWithId = availabilityData.allPropertiesWithId || [];
    availableList.innerHTML = availableWithId
      .filter(p => !suggestedIds.has(p.id))
      .map(p => createPropertyCheckbox(p, false))
      .join('');
  }
  
  document.querySelectorAll('.propiedad-checkbox').forEach(cb => cb.addEventListener('change', handleSelectionChange));
  updateSummary(availabilityData.suggestion.pricing);
}

export async function handleSelectionChange() {
  const selectedIds = new Set(Array.from(document.querySelectorAll('.propiedad-checkbox:checked')).map(cb => cb.dataset.id));
  
  const allWithId = availabilityData.allPropertiesWithId || [];
  selectedProperties = allWithId.filter(p => selectedIds.has(p.id));

  if (selectedProperties.length === 0) {
    updateSummary({ totalPriceOriginal: 0, nights: currentPricing.nights, details: [] });
    return;
  }

  try {
    const payload = {
      fechaLlegada: document.getElementById('fecha-llegada').value,
      fechaSalida: document.getElementById('fecha-salida').value,
      propiedades: selectedProperties,
      canalId: document.getElementById('canal-select').value
    };
    const newPricing = await fetchAPI('/propuestas/recalcular', { method: 'POST', body: payload });
    updateSummary(newPricing);
  } catch (error) {
    alert(`Error al recalcular: ${error.message}`);
  }
}

export function updateSummary(pricing) {
  currentPricing = pricing;
  if (!pricing) return;

  const { totalPriceOriginal, currencyOriginal, nights, totalPriceCLP } = pricing;
  
  const summaryOriginalContainer = document.getElementById('summary-original-currency-container');
  const summaryCLPContainer = document.getElementById('summary-clp-container');

  let descuentoManualEnMonedaOriginal = 0;
  const pct = parseFloat(document.getElementById('descuento-pct').value) || 0;
  const fijo = parseFloat(document.getElementById('descuento-fijo-total').value) || 0;
  if (pct > 0) descuentoManualEnMonedaOriginal = totalPriceOriginal * (pct / 100);
  else if (fijo > 0) descuentoManualEnMonedaOriginal = fijo;

  const descuentoCuponEnMonedaOriginal = cuponAplicado ? totalPriceOriginal * (cuponAplicado.porcentajeDescuento / 100) : 0;
  const descuentoTotalEnMonedaOriginal = descuentoManualEnMonedaOriginal + descuentoCuponEnMonedaOriginal;
  const precioFinalEnMonedaOriginal = totalPriceOriginal - descuentoTotalEnMonedaOriginal;

  const precioFinalCLP = currencyOriginal === 'USD' 
    ? Math.round(precioFinalEnMonedaOriginal * valorDolarDia) 
    : precioFinalEnMonedaOriginal;
  
  const descuentoTotalCLP = totalPriceCLP - precioFinalCLP;

  if (currencyOriginal !== 'CLP') {
    summaryOriginalContainer.classList.remove('hidden');
    summaryOriginalContainer.innerHTML = `
      <h4 class="font-bold text-blue-800 text-center mb-1">Valores en ${currencyOriginal}</h4>
      <div class="flex justify-between text-sm"><span class="text-gray-600">Precio de Lista:</span><span class="font-medium">${formatCurrency(totalPriceOriginal, currencyOriginal)}</span></div>
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

export function handleCanalChange() {
  const canalSelect = document.getElementById('canal-select');
  if (!canalSelect) return;
  const canalId = canalSelect.value;
  const canal = allCanales.find(c => c.id === canalId);
  if (!canal) return;

  const moneda = canal.moneda;
  document.getElementById('descuento-fijo-label').textContent = `Descuento Fijo Manual (${moneda})`;
  document.getElementById('valor-dolar-container').classList.toggle('hidden', moneda !== 'USD');

  if (availabilityData.suggestion) {
    handleSelectionChange();
  }
}

export async function runSearch() {
  const payload = {
    fechaLlegada: document.getElementById('fecha-llegada').value,
    fechaSalida: document.getElementById('fecha-salida').value,
    personas: document.getElementById('personas').value,
    sinCamarotes: document.getElementById('sin-camarotes').checked,
    permitirCambios: document.getElementById('permitir-cambios').checked,
    canalId: document.getElementById('canal-select').value
  };
  if (!payload.fechaLlegada || !payload.fechaSalida || !payload.personas) {
    alert('Por favor, completa las fechas y la cantidad de personas.');
    return;
  }

  const statusContainer = document.getElementById('status-container');
  const buscarBtn = document.getElementById('buscar-btn');
  buscarBtn.disabled = true;
  buscarBtn.textContent = 'Buscando...';
  statusContainer.textContent = 'Buscando disponibilidad y sugerencias...';
  statusContainer.classList.remove('hidden');
  document.getElementById('results-container').classList.add('hidden');

  try {
    const dolar = await fetchAPI(`/dolar/valor/${payload.fechaLlegada}`);
    valorDolarDia = dolar.valor;
    document.getElementById('valor-dolar-info').textContent = `Valor Dólar para el Check-in: ${formatCurrency(valorDolarDia)}`;

    availabilityData = await fetchAPI('/propuestas/generar', { method: 'POST', body: payload });
    
    // UNIFICAR FUENTE CON .id
    const allPropsWithId = [
      ...(availabilityData.suggestion?.propiedades || []),
      ...(availabilityData.availableProperties || [])
    ].filter(p => p && p.id); // Asegurar .id

    availabilityData.allPropertiesWithId = allPropsWithId;

    if (availabilityData.suggestion) {
      statusContainer.classList.add('hidden');
      document.getElementById('results-container').classList.remove('hidden');
      renderSelectionUI();
    } else {
      statusContainer.textContent = availabilityData.message || 'No se encontró disponibilidad.';
    }
  } catch (error) {
    statusContainer.textContent = `Error: ${error.message}`;
  } finally {
    buscarBtn.disabled = false;
    buscarBtn.textContent = 'Buscar Disponibilidad';
  }
}

export async function handleCuponChange() {
  const codigo = document.getElementById('cupon-input').value.trim();
  const statusEl = document.getElementById('cupon-status');
  if (!codigo) {
    cuponAplicado = null;
    statusEl.textContent = '';
    updateSummary(currentPricing);
    return;
  }

  try {
    statusEl.textContent = 'Validando...';
    cuponAplicado = await fetchAPI(`/crm/cupones/validar/${codigo}`);
    statusEl.textContent = `Cupón válido: ${cuponAplicado.porcentajeDescuento}% de descuento.`;
    statusEl.className = 'text-xs mt-1 text-green-600';
    updateSummary(currentPricing);
  } catch (error) {
    cuponAplicado = null;
    statusEl.textContent = `${error.message}`;
    statusEl.className = 'text-xs mt-1 text-red-600';
    updateSummary(currentPricing);
  }
}

export async function handleGuardarPropuesta() {
  if (!availabilityData.suggestion) {
    alert('Primero realiza una búsqueda de disponibilidad.');
    return;
  }

  const cliente = await obtenerOcrearCliente();
  if (!cliente || !cliente.id) {
    console.error('Cliente no válido:', cliente);
    alert('No se pudo procesar el cliente. Verifica los datos.');
    return;
  }

  const propuesta = {
    fechaLlegada: document.getElementById('fecha-llegada').value,
    fechaSalida: document.getElementById('fecha-salida').value,
    personas: parseInt(document.getElementById('personas').value),
    canalId: document.getElementById('canal-select').value,
    clienteId: cliente.id,
    propiedades: selectedProperties, // ← OBJ juvenil
    pricing: currentPricing,
    codigoCupon: cuponAplicado?.codigo || null,
    idReservaCanal: document.getElementById('id-reserva-canal-input').value || null,
    icalUid: document.getElementById('ical-uid-input').value || null,
    origen: origenReserva
  };

  try {
    const guardarBtn = document.getElementById('guardar-propuesta-btn');
    guardarBtn.disabled = true;
    guardarBtn.textContent = editId ? 'Actualizando...' : 'Guardando...';

    let propuestaGuardada;
    if (editId) {
      propuestaGuardada = await fetchAPI(`/gestion-propuestas/propuesta-tentativa/${editId}`, {
        method: 'PUT',
        body: propuesta
      });
    } else {
      propuestaGuardada = await fetchAPI('/gestion-propuestas/propuesta-tentativa', {
        method: 'POST',
        body: propuesta
      });
    }

    console.log('Propuesta guardada:', propuestaGuardada);

    const textoWhatsApp = generarTextoWhatsApp(propuestaGuardada, cliente);
    document.getElementById('propuesta-texto').value = textoWhatsApp;
    document.getElementById('propuesta-guardada-modal').classList.remove('hidden');
  } catch (error) {
    console.error('Error al guardar propuesta:', error);
    alert(`Error al guardar: ${error.message}`);
  } finally {
    const guardarBtn = document.getElementById('guardar-propuesta-btn');
    guardarBtn.disabled = false;
    guardarBtn.textContent = editId ? 'Actualizar Propuesta' : 'Crear Reserva Tentativa';
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
  editId = params.get('edit');
  origenReserva = params.get('origen') || 'manual';
  if (editId) {
    handleCargarPropuesta(editId);
  }
}

export async function handleCargarPropuesta(editId) {
  try {
    const propuesta = await fetchAPI(`/gestion-propuestas/propuesta-tentativa/${editId}`);
    if (!propuesta) {
      alert('Propuesta no encontrada');
      handleNavigation('/gestionar-propuestas');
      return;
    }

    document.getElementById('fecha-llegada').value = propuesta.fechaLlegada;
    document.getElementById('fecha-salida').value = propuesta.fechaSalida;
    document.getElementById('personas').value = propuesta.personas;
    document.getElementById('canal-select').value = propuesta.canalId;

    if (propuesta.cliente) {
      if (propuesta.cliente.id) {
        selectedClient = propuesta.cliente;
        document.getElementById('client-search').value = propuesta.cliente.nombre;
        document.getElementById('client-form-title').textContent = '... o actualiza los datos del cliente seleccionado';
      }
      document.getElementById('new-client-name').value = propuesta.cliente.nombre || '';
      document.getElementById('new-client-phone').value = propuesta.cliente.telefono || '';
      document.getElementById('new-client-email').value = propuesta.cliente.email || '';
    }

    document.getElementById('id-reserva-canal-input').value = propuesta.idReservaCanal || '';
    if (propuesta.icalUid) {
      document.getElementById('ical-uid-input').value = propuesta.icalUid;
      document.getElementById('ical-uid-container').classList.remove('hidden');
    }

    document.getElementById('guardar-propuesta-btn').textContent = 'Actualizar Propuesta';

    await runSearch();

    const selectedIds = new Set(propuesta.propiedades.map(p => p.id));
    document.querySelectorAll('.propiedad-checkbox').forEach(cb => {
      cb.checked = selectedIds.has(cb.dataset.id);
    });

    currentPricing = propuesta.pricing || availabilityData.suggestion.pricing;
    updateSummary(currentPricing);

    if (propuesta.codigoCupon) {
      document.getElementById('cupon-input').value = propuesta.codigoCupon;
      cuponAplicado = { codigo: propuesta.codigoCupon, porcentajeDescuento: propuesta.porcentajeDescuentoCupon || 0 };
      document.getElementById('cupon-status').textContent = `Cupón aplicado: ${cuponAplicado.porcentajeDescuento}%`;
      document.getElementById('cupon-status').className = 'text-xs mt-1 text-green-600';
      updateSummary(currentPricing);
    }
  } catch (error) {
    console.error('Error al cargar la propuesta:', error);
    alert(`Error al cargar la propuesta: ${error.message}`);
    handleNavigation('/gestionar-propuestas');
  }
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
    if (selectedClient && selectedClient.id) {
      // Actualizar cliente existente
      const clienteActualizado = {
        id: selectedClient.id,
        nombre,
        telefono,
        email: email || null
      };
      console.log('Actualizando cliente existente:', clienteActualizado);
      const response = await fetchAPI(`/clientes/${selectedClient.id}`, {
        method: 'PUT',
        body: clienteActualizado
      });
      console.log('Cliente actualizado:', response);
      return response; // Debe tener .id
    } else {
      // Crear nuevo cliente
      const nuevoCliente = { nombre, telefono, email: email || null };
      console.log('Creando nuevo cliente:', nuevoCliente);
      const response = await fetchAPI('/clientes', {
        method: 'POST',
        body: nuevoCliente
      });
      console.log('Cliente creado:', response);
      return response; // Debe tener .id
    }
  } catch (error) {
    console.error('Error al procesar cliente:', error);
    alert(`Error con el cliente: ${error.message}`);
    return null;
  }
}

function generarTextoWhatsApp(propuesta, cliente) {
  const canal = allCanales.find(c => c.id === propuesta.canalId);
  const moneda = canal?.moneda || 'CLP';
  const simbolo = moneda === 'USD' ? 'USD' : 'CLP';

  const noches = currentPricing.nights;
  const precioFinal = moneda === 'USD' 
    ? currentPricing.totalPriceOriginal - (currentPricing.totalPriceOriginal * (cuponAplicado?.porcentajeDescuento || 0) / 100)
    : currentPricing.totalPriceCLP - (currentPricing.totalPriceCLP - Math.round((currentPricing.totalPriceOriginal - (currentPricing.totalPriceOriginal * (cuponAplicado?.porcentajeDescuento || 0) / 100)) * valorDolarDia));

  const propiedadesTexto = propuesta.propiedades.map(p => p.nombre).join(', ');

  return `
¡Hola ${cliente.nombre}! 👋

Gracias por tu interés en *Suite Manager*. Aquí tienes tu **propuesta personalizada**:

Check-in: *${new Date(propuesta.fechaLlegada).toLocaleDateString('es-CL')}*  
Check-out: *${new Date(propuesta.fechaSalida).toLocaleDateString('es-CL')}*  
Noches: *${noches}*  
Huéspedes: *${propuesta.personas}*  
Alojamiento: *${propiedadesTexto}*

**Total a pagar: ${formatCurrency(precioFinal, moneda)}**

${cuponAplicado ? `Cupón aplicado: *${cuponAplicado.codigo}* (-${cuponAplicado.porcentajeDescuento}%)` : ''}

¿Te gustaría reservar? Responde *SÍ* y coordinamos el pago.

¡Quedan pocas fechas disponibles!  
Suite Manager
  `.trim();
}