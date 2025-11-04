import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let allClients = [];
let allProperties = [];
let allCanales = [];
let allPlantillas = []; // AÑADIDO: para usar plantillas en memoria
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
  allClients, allProperties, allCanales, allPlantillas, // AÑADIDO allPlantillas
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
    [allClients, allProperties, allCanales, allPlantillas] = await Promise.all([
      fetchAPI('/clientes'),
      fetchAPI('/propiedades'),
      fetchAPI('/canales'),
      fetchAPI('/plantillas') // AÑADIDO: carga todas las plantillas
    ]);

    const canalSelect = document.getElementById('canal-select');
    if (canalSelect) {
      canalSelect.innerHTML = allCanales.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
      const appChannel = allCanales.find(c => c.nombre.toLowerCase() === 'app');
      if (appChannel) canalSelect.value = appChannel.id;
    }

    const plantillaSelect = document.getElementById('plantilla-select');
    if (plantillaSelect) {
      plantillaSelect.innerHTML = allPlantillas
        .map(p => `<option value="${p.id}">${p.nombre}</option>`)
        .join('');
      const defaultPlantilla = allPlantillas.find(p => p.nombre.toLowerCase().includes('propuesta'));
      if (defaultPlantilla) plantillaSelect.value = defaultPlantilla.id;
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
  const filtered = allClients.filter(c => c.nombre.toLowerCase().includes(searchTerm) || (c.telefono && c.telefono.includes(searchTerm)));
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

// frontend/src/views/utils.js

export function renderSelectionUI() {
  const suggestionList = document.getElementById('suggestion-list');
  const availableList = document.getElementById('available-list');
  suggestionList.innerHTML = '';
  availableList.innerHTML = '';

  if (!availabilityData.suggestion) return;

  // --- INICIO DE LA CORRECCIÓN ---
  // Determinar propiedades seleccionadas (puede ser un itinerario o una selección normal)
  if (availabilityData.suggestion.isSegmented) {
    // En modo segmentado, las propiedades seleccionadas son todas las que aparecen en el itinerario
    const propMap = new Map();
    availabilityData.suggestion.itinerary.forEach(segment => {
        segment.propiedades.forEach(prop => propMap.set(prop.id, prop));
    });
    selectedProperties = Array.from(propMap.values());
  } else {
    // En modo normal, son las propiedades sugeridas
    selectedProperties = [...availabilityData.suggestion.propiedades];
  }

  // Renderizar la UI
  if (availabilityData.suggestion.isSegmented) {
    // UI para MODO ITINERARIO (Segmentado)
    suggestionList.innerHTML = `
      <h4 class="font-medium text-gray-700">Propuesta de Itinerario</h4>
      <div class="space-y-3 p-3 bg-white rounded-md border">${
        availabilityData.suggestion.itinerary.map((segment) => {
          const fechaSalidaSegmento = new Date(segment.endDate); 
          
          // Iterar sobre el array segment.propiedades (plural)
          const propertiesHtml = segment.propiedades.map(prop => `
            <div class="grid grid-cols-5 gap-4 items-center text-sm">
              <span class="font-semibold col-span-2">${prop.nombre}</span>
              <span class="col-span-3 text-xs text-gray-500">(Cap: ${prop.capacidad} pers.)</span>
            </div>
          `).join('');

          return `
            <div class="border-b pb-2 last:border-b-0">
              <div class="grid grid-cols-5 gap-4 items-center text-sm font-medium mb-1">
                <span class="col-span-2">Fechas:</span>
                <span class="col-span-3">${new Date(segment.startDate).toLocaleDateString('es-CL', {timeZone: 'UTC'})} al ${fechaSalidaSegmento.toLocaleDateString('es-CL', {timeZone: 'UTC'})}</span>
              </div>
              ${propertiesHtml}
            </div>`;
        }).join('')
      }</div>`;
    availableList.innerHTML = '<p class="text-sm text-gray-500">Modo itinerario: no se pueden añadir otras cabañas.</p>';
  
  } else {
    // UI para MODO NORMAL (Checkboxes)
    const suggestedIds = new Set(selectedProperties.map(p => p.id));
    suggestionList.innerHTML = `<h4 class="font-medium text-gray-700">Propiedades Sugeridas</h4>` + 
      selectedProperties.map(p => createPropertyCheckbox(p, true)).join('');

    const availableWithId = availabilityData.allValidProperties || [];
    availableList.innerHTML = availableWithId
      .filter(p => !suggestedIds.has(p.id))
      .map(p => createPropertyCheckbox(p, false))
      .join('');
  }
  // --- FIN DE LA CORRECCIÓN ---
  
  // Adjuntar listeners (solo para modo normal)
  document.querySelectorAll('.propiedad-checkbox').forEach(cb => cb.addEventListener('change', handleSelectionChange));
  // Mostrar el precio que vino del backend
  updateSummary(availabilityData.suggestion.pricing);
}

export async function handleSelectionChange() {
  const selectedIds = new Set(Array.from(document.querySelectorAll('.propiedad-checkbox:checked')).map(cb => cb.dataset.id));
  
  // --- INICIO DE LA CORRECCIÓN ---
  // Usar la lista 'allValidProperties' que creamos en 'runSearch'.
  // Esta lista SÍ está filtrada y es la fuente de verdad para la selección actual.
  if (availabilityData.allValidProperties) {
      selectedProperties = availabilityData.allValidProperties.filter(p => selectedIds.has(p.id));
  } else {
      // Fallback de seguridad, aunque no debería ocurrir si runSearch es exitoso.
      selectedProperties = allProperties.filter(p => selectedIds.has(p.id));
      console.warn("availabilityData.allValidProperties no estaba definida durante handleSelectionChange");
  }
  // --- FIN DE LA CORRECCIÓN ---

  if (selectedProperties.length === 0) {
    // Si no hay nada seleccionado, limpiar el resumen de precios.
    updateSummary({ 
      totalPriceOriginal: 0, 
      totalPriceCLP: 0, 
      nights: currentPricing.nights, 
      details: [], 
      currencyOriginal: currentPricing.currencyOriginal || 'CLP'
    });
    return;
  }

  try {
    const payload = {
      fechaLlegada: document.getElementById('fecha-llegada').value,
      fechaSalida: document.getElementById('fecha-salida').value,
      propiedades: selectedProperties, // Enviar la lista limpia
      canalId: document.getElementById('canal-select').value
    };
    // Pedir al backend que recalcule el precio solo para esta selección
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
  // 1. OBTENER EL PAYLOAD DE BÚSQUEDA DEL DOM
  const payload = {
    fechaLlegada: document.getElementById('fecha-llegada').value,
    fechaSalida: document.getElementById('fecha-salida').value,
    personas: document.getElementById('personas').value,
    sinCamarotes: document.getElementById('sin-camarotes').checked,
    permitirCambios: document.getElementById('permitir-cambios').checked,
    canalId: document.getElementById('canal-select').value
  };

  // 2. VALIDACIÓN TEMPRANA
  if (!payload.fechaLlegada || !payload.fechaSalida || !payload.personas) {
    alert('Por favor, completa las fechas y la cantidad de personas.');
    return false;
  }

  // 3. ACTUALIZAR ESTADO DE LA UI A "CARGANDO"
  const statusContainer = document.getElementById('status-container');
  const buscarBtn = document.getElementById('buscar-btn');
  buscarBtn.disabled = true;
  buscarBtn.textContent = 'Buscando...';
  statusContainer.textContent = 'Buscando disponibilidad y sugerencias...';
  statusContainer.classList.remove('hidden');
  document.getElementById('results-container').classList.add('hidden');
  document.getElementById('suggestion-list').innerHTML = ''; // Limpiar DOM
  document.getElementById('available-list').innerHTML = ''; // Limpiar DOM

  // --- INICIO DE LA CORRECCIÓN ---
  // 4. LIMPIEZA AGRESIVA DEL ESTADO (COMO SOLICITASTE)
  // Borramos todas las variables involucradas en el cálculo anterior.
  try {
    availabilityData = {};     // Borrar datos de disponibilidad antiguos
    selectedProperties = [];   // Borrar propiedades seleccionadas antiguas
    currentPricing = {};       // Borrar el precio "pegado" anterior

    // Limpiar campos de descuento del DOM
    document.getElementById('descuento-pct').value = '';
    document.getElementById('descuento-fijo-total').value = '';
    document.getElementById('cupon-input').value = '';
    
    // Limpiar estado de cupón en memoria y DOM
    const cuponStatus = document.getElementById('cupon-status');
    if (cuponStatus) {
      cuponStatus.textContent = '';
      cuponStatus.className = 'text-xs mt-1';
    }
    cuponAplicado = null;
  } catch (e) {
    console.warn("Error al limpiar estado:", e);
  }
  // --- FIN DE LA CORRECCIÓN ---

  // 5. EJECUTAR EL NUEVO FLUJO DE BÚSQUEDA
  try {
    // 5a. Obtener Dólar (estado nuevo)
    const dolar = await fetchAPI(`/dolar/valor/${payload.fechaLlegada}`);
    valorDolarDia = dolar.valor;
    document.getElementById('valor-dolar-info').textContent = `Valor Dólar para el Check-in: ${formatCurrency(valorDolarDia)}`;

    // 5b. Llamar al Backend con el payload limpio
    // El backend decidirá si usar `findSegmentedCombination` o `findNormalCombination`
    availabilityData = await fetchAPI('/propuestas/generar', { method: 'POST', body: payload });
    
    // 5c. Crear la lista de propiedades válidas *solo* para esta búsqueda
    const suggested = availabilityData.suggestion?.propiedades || [];
    const available = availabilityData.availableProperties || [];
    const suggestedIds = new Set(suggested.map(p => p.id));
    
    // Esta lista (`allValidProperties`) la usará `handleSelectionChange` si el usuario
    // (en modo normal) desmarca una cabaña.
    availabilityData.allValidProperties = [
      ...suggested,
      ...available.filter(p => !suggestedIds.has(p.id))
    ];

    // 6. PROCESAR EL RESULTADO
    if (availabilityData.suggestion) {
      statusContainer.classList.add('hidden');
      document.getElementById('results-container').classList.remove('hidden');
      // Renderizar la UI (itinerario o checkboxes) y mostrar el precio
      // que vino *directamente* del backend.
      renderSelectionUI(); 
      return true;
    } else {
      statusContainer.textContent = availabilityData.message || 'No se encontró disponibilidad.';
      return false;
    }
  } catch (error) {
    statusContainer.textContent = `Error: ${error.message}`;
    return false;
  } finally {
    // 7. RESTAURAR UI
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
  // 1. Validaciones y obtención de cliente
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

  // 2. Obtener precios calculados desde la UI/estado
  const precioFinalCalculado = parseFloat(document.getElementById('summary-precio-final')?.textContent.replace(/[$.]/g, '')) || 0;
  const nochesCalculadas = parseInt(document.getElementById('summary-noches')?.textContent) || 0;
  
  // --- INICIO DE LA CORRECCIÓN ---
  // Leer el precio de lista (Subtotal) directamente del estado, no del DOM.
  // currentPricing.totalPriceCLP es el valor *antes* de descuentos manuales/cupones.
  const precioListaCLPCalculado = currentPricing.totalPriceCLP || 0;
  // --- FIN DE LA CORRECCIÓN ---
  
  const descuentoCLPCalculado = precioListaCLPCalculado - precioFinalCalculado;

  // 3. Construir el payload para *guardar* la propuesta (para gestionPropuestasService)
  const propuestaPayloadGuardar = {
    fechaLlegada: document.getElementById('fecha-llegada').value,
    fechaSalida: document.getElementById('fecha-salida').value,
    personas: parseInt(document.getElementById('personas').value),
    canalId: document.getElementById('canal-select').value,
    canalNombre: allCanales.find(c => c.id === document.getElementById('canal-select').value)?.nombre || 'Desconocido',
    cliente: cliente, // Pasa el objeto cliente completo
    propiedades: selectedProperties,
    precioFinal: precioFinalCalculado, // El precio final con descuentos
    noches: nochesCalculadas,
    moneda: currentPricing.currencyOriginal,
    valorDolarDia: valorDolarDia,
    valorOriginal: currentPricing.totalPriceOriginal, // El precio de lista en moneda original
    codigoCupon: cuponAplicado?.codigo || null,
    idReservaCanal: document.getElementById('id-reserva-canal-input').value || null,
    icalUid: document.getElementById('ical-uid-input').value || null,
    origen: origenReserva,
    sinCamarotes: document.getElementById('sin-camarotes').checked,
    permitirCambios: document.getElementById('permitir-cambios').checked,
    descuentoPct: parseFloat(document.getElementById('descuento-pct').value) || 0,
    descuentoFijo: parseFloat(document.getElementById('descuento-fijo-total').value) || 0,
    plantillaId: document.getElementById('plantilla-select').value || null
  };

  // 4. Iniciar el proceso de guardado
  const guardarBtn = document.getElementById('guardar-propuesta-btn');
  try {
    guardarBtn.disabled = true;
    guardarBtn.textContent = editId ? 'Actualizando...' : 'Guardando...';

    // 5. LLAMADA A LA API DE GUARDADO
    let propuestaGuardada;
    if (editId) {
      // Al editar, el payload se envía al endpoint de actualización
      propuestaGuardada = await fetchAPI(`/gestion-propuestas/propuesta-tentativa/${editId}`, {
        method: 'PUT',
        body: propuestaPayloadGuardar
      });
      // Aseguramos que el ID de la propuesta sea el `editId` para el generador de texto
      propuestaGuardada.id = editId;
    } else {
      // Al crear, se envía al endpoint de creación
      propuestaGuardada = await fetchAPI('/gestion-propuestas/propuesta-tentativa', {
        method: 'POST',
        body: propuestaPayloadGuardar
      });
    }

    // 6. Construir el payload para *generar el texto* (para mensajeService)
    // Este payload SÍ necesita los detalles de precios.
    const payloadTexto = {
      ...propuestaPayloadGuardar, // Reutiliza la mayoría de los datos
      idPropuesta: propuestaGuardada.id, // El ID devuelto/usado al guardar
      precioListaCLP: precioListaCLPCalculado, // <-- Este valor ahora será correcto
      descuentoCLP: descuentoCLPCalculado,
      pricingDetails: currentPricing.details || [] // Los detalles del desglose de precios
    };

    // 7. LLAMADA A LA API DE GENERACIÓN DE TEXTO
    const resultadoTexto = await fetchAPI('/propuestas/generar-texto', {
        method: 'POST',
        body: payloadTexto
    });

    // 8. Mostrar el resultado
    document.getElementById('propuesta-texto').value = resultadoTexto.texto;
    document.getElementById('propuesta-guardada-modal').classList.remove('hidden');

  } catch (error) {
    console.error('Error al guardar propuesta:', error);
    alert(`Error al guardar: ${error.message}`);
  } finally {
    // 9. Resetear el botón
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
    // NOTA: Esta ruta no existe en el backend. Debería ser /reservas/:id o algo similar.
    // Asumiendo que /gestion-propuestas/propuesta-tentativa/:id PUEDE LEER
    // o que /gestionar-reservas/:id es la ruta correcta.
    // Por ahora, supondremos que la ruta del GET es la de /reservas/:id
    // pero la lógica de /gestionar-propuestas se basa en `idReservaCanal`.
    
    // Vamos a asumir que el ID que llega es el `idReservaCanal` y que la API
    // puede encontrarlo. Si 'editId' es el ID de uno de los documentos de reserva,
    // necesitamos la lógica de /reservas/:id.
    
    // Basado en `gestionarPropuestas.js`, el `editId` parece ser el `idReservaCanal`.
    // Pero la API de `gestionar-propuestas` no tiene un GET.
    // La API de `gestionar-reservas` (`/api/reservas/:id`) SÍ tiene un GET.
    
    // VOY A ASUMIR QUE EL `editId` que llega en la URL es el ID de la *primera*
    // reserva del grupo, y que la API de `/reservas/:id` devuelve la info
    // completa del grupo (como lo hace para el modal de 'ver').
    
    // Mirando `gestionarPropuestas.js` (frontend) - `handleNavigation(url)`:
    // El `editId` que se pasa en la URL es `item.id`, que puede ser 
    // el `idReservaCanal` (para `tipo: 'propuesta'`) o el ID del doc (`para tipo: 'presupuesto'`).
    // El `handleGuardarPropuesta` (en utils.js) usa `editId` para llamar a
    // `PUT /gestion-propuestas/propuesta-tentativa/:id`.
    
    // OK, el flujo de "gestionarPropuestas" (frontend) está enviando el `idReservaCanal` como `editId`.
    // El backend `gestionPropuestasService.js` en `guardarOActualizarPropuesta` USA `idPropuestaExistente`
    // para BUSCAR por `idReservaCanal`. Esto es consistente.
    
    // PERO... ¿Cómo cargamos los datos? No hay un GET en `gestion-propuestas`.
    // El único GET que trae datos de reserva es `GET /api/reservas/:id`.
    // Esto implica que `gestionarPropuestas.js` (frontend) está pasando el ID incorrecto.
    // Debería pasar `item.idsReservas[0]` en lugar de `item.id`.
    
    // VOY A IGNORAR ESE ERROR EN `gestionarPropuestas.js` POR AHORA Y ASUMIRÉ
    // QUE EL `editId` que llega es el `idReservaCanal` y que necesitamos
    // una forma de cargar los datos.
    
    // No puedo arreglar `handleCargarPropuesta` si no hay un endpoint de dónde cargar.
    // VOY A ASUMIR QUE EL `editId` es el ID del *primer documento de reserva* // (`item.idsReservas[0]`) y que la lógica en `gestionarPropuestas.js` (frontend) está mal.
    
    const propuesta = await fetchAPI(`/reservas/${editId}`);
    if (!propuesta) {
      alert('Propuesta no encontrada');
      handleNavigation('/gestionar-propuestas');
      return;
    }

    document.getElementById('fecha-llegada').value = propuesta.fechaLlegada;
    document.getElementById('fecha-salida').value = propuesta.fechaSalida;
    document.getElementById('personas').value = propuesta.cantidadHuespedes; // Usar el de la reserva
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

    // Estos campos no existen en el modelo de 'reserva' que devuelve la API.
    // document.getElementById('sin-camarotes').checked = propuesta.sinCamarotes || false;
    // document.getElementById('permitir-cambios').checked = propuesta.permitirCambios || false;
    // document.getElementById('descuento-pct').value = propuesta.descuentoPct || '';
    // document.getElementById('descuento-fijo-total').value = propuesta.descuentoFijo || '';
    // if (propuesta.plantillaId) {
    //   document.getElementById('plantilla-select').value = propuesta.plantillaId;
    // }

    const searchSuccess = await runSearch();
    
    if (searchSuccess) {
        // Necesitamos cargar TODAS las propiedades del grupo.
        // La `propuesta` que cargamos es solo UN documento.
        // `propuesta.datosGrupo.propiedades` (del GET /reservas/:id) tiene los NOMBRES.
        // `gestionarPropuestas.js` (frontend) está pasando mal los `propiedades` en la URL.
        // Debería ser `item.propiedades.map(p => p.id).join(',')`
        
        // Asumiendo que la URL SÍ trae los IDs de propiedad correctos:
        const propIds = new URLSearchParams(window.location.search).get('propiedades').split(',');
        
        const selectedIds = new Set(propIds);
        document.querySelectorAll('.propiedad-checkbox').forEach(cb => {
          cb.checked = selectedIds.has(cb.dataset.id);
        });

        const missingIds = [...selectedIds].filter(id => !document.querySelector(`#cb-${id}`));
        if (missingIds.length > 0) {
          const missingProperties = allProperties.filter(p => missingIds.includes(p.id));
          const availableList = document.getElementById('available-list');
          missingProperties.forEach(p => {
            const checkboxHtml = createPropertyCheckbox(p, true);
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `${checkboxHtml} <span class="text-red-500 ml-2 text-sm">(Reservado para esta propuesta)</span>`;
            availableList.appendChild(wrapper);
          });
          availableList.querySelectorAll('.propiedad-checkbox').forEach(cb => cb.addEventListener('change', handleSelectionChange));
        }

        selectedProperties = allProperties.filter(p => selectedIds.has(p.id));
        
        // Forzar el recálculo para obtener el precio
        await handleSelectionChange();

        if (propuesta.cuponUtilizado) {
          document.getElementById('cupon-input').value = propuesta.cuponUtilizado;
          await handleCuponChange(); // Validar y aplicar
        }
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
      const datosCargados = { nombre: selectedClient.nombre, telefono: selectedClient.telefono, email: selectedClient.email };
      const datosFormulario = { nombre, telefono, email };
      const hayCambios = JSON.stringify(datosCargados) !== JSON.stringify(datosFormulario);

      if (hayCambios) {
        const clienteActualizado = { id: selectedClient.id, nombre, telefono, email: email || null };
        const response = await fetchAPI(`/clientes/${selectedClient.id}`, { method: 'PUT', body: clienteActualizado });
        selectedClient = response;
        return response;
      } else {
        return selectedClient;
      }
    } else {
      const nuevoCliente = { nombre, telefono, email: email || null };
      const response = await fetchAPI('/clientes', { method: 'POST', body: nuevoCliente });
      selectedClient = response.cliente;
      return response.cliente;
    }
  } catch (error) {
    console.error('Error al procesar cliente:', error);
    alert(`Error con el cliente: ${error.message}`);
    return null;
  }
}

// --- FUNCIONES ELIMINADAS ---
// export async function generarTextoWhatsApp(propuesta, cliente) { ... }
// function replacePlaceholders(texto, propuesta, cliente) { ... }