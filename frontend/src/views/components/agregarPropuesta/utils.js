import { fetchAPI } from '../../../api.js';
import { handleNavigation } from '../../../router.js';

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
  if (!searchTerm) return clearClientSelection();
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

function selectClient(client) {
  selectedClient = client;
  document.getElementById('client-form-title').textContent = '... o actualiza los datos del cliente seleccionado';
  document.getElementById('client-search').value = client.nombre;
  document.getElementById('client-results-list').classList.add('hidden');
  document.getElementById('new-client-name').value = client.nombre || '';
  document.getElementById('new-client-phone').value = client.telefono || '';
  document.getElementById('new-client-email').value = client.email || '';
}

function clearClientSelection() {
  selectedClient = null;
  document.getElementById('client-form-title').textContent = '... o añade un cliente nuevo';
  ['new-client-name', 'new-client-phone', 'new-client-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
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
  if (availabilityData.suggestion) handleSelectionChange();
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
    updateSummary();
    return;
  }

  try {
    statusEl.textContent = 'Validando...';
    cuponAplicado = await fetchAPI(`/crm/cupones/validar/${codigo}`);
    statusEl.textContent = `Cupón válido: ${cuponAplicado.porcentajeDescuento}% de descuento.`;
    statusEl.className = 'text-xs mt-1 text-green-600';
    updateSummary();
  } catch (error) {
    cuponAplicado = null;
    statusEl.textContent = `${error.message}`;
    statusEl.className = 'text-xs mt-1 text-red-600';
    updateSummary();
  }
}

export async function handleGuardarPropuesta() {
  // ... (te lo entrego completo en el siguiente mensaje)
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