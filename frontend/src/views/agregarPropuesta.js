import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let allClients = [];
let allProperties = [];
let selectedClient = null;
let availabilityData = {};
let selectedProperties = [];
let currentPricing = {};
let editId = null;

function formatCurrency(value) { return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`; }

async function loadClients() {
    try {
        allClients = await fetchAPI('/clientes');
    } catch (error) {
        console.error("No se pudieron cargar los clientes:", error);
    }
}

function filterClients(e) {
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
    ['new-client-name', 'new-client-phone', 'new-client-email'].forEach(id => document.getElementById(id).value = '');
}

function createPropertyCheckbox(prop, isSuggested) {
    return `
    <div class="p-2 border rounded-md flex items-center justify-between bg-white">
        <div>
            <input type="checkbox" id="cb-${prop.id}" data-id="${prop.id}" class="propiedad-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded" ${isSuggested ? 'checked' : ''}>
            <label for="cb-${prop.id}" class="ml-2 font-medium">${prop.nombre}</label>
            <span class="ml-2 text-sm text-gray-500">(Cap: ${prop.capacidad})</span>
        </div>
    </div>`;
}

function renderSelectionUI() {
    const suggestionList = document.getElementById('suggestion-list');
    const availableList = document.getElementById('available-list');
    suggestionList.innerHTML = '';
    availableList.innerHTML = '';

    if (!availabilityData.suggestion) return;
    
    selectedProperties = [...availabilityData.suggestion.propiedades];

    if (availabilityData.suggestion.isSegmented) {
         suggestionList.innerHTML = `
            <h4 class="font-medium text-gray-700">Propuesta de Itinerario</h4>
            <div class="space-y-2 p-3 bg-white rounded-md border">${
                availabilityData.suggestion.itinerary.map((segment, index) => {
                    return `
                        <div class="grid grid-cols-5 gap-4 items-center text-sm">
                            <span class="font-semibold">${segment.propiedad.nombre}</span>
                            <span>${new Date(segment.startDate).toLocaleDateString('es-CL', {timeZone: 'UTC'})}</span>
                            <span>al</span>
                            <span>${new Date(segment.endDate).toLocaleDateString('es-CL', {timeZone: 'UTC'})}</span>
                        </div>`;
                }).join('')
            }</div>`;
    } else {
        const suggestedIds = new Set(availabilityData.suggestion.propiedades.map(p => p.id));
        suggestionList.innerHTML = `<h4 class="font-medium text-gray-700">Propiedades Sugeridas</h4>` + availabilityData.suggestion.propiedades.map(p => createPropertyCheckbox(p, true)).join('');
        availableList.innerHTML = availabilityData.availableProperties.filter(p => !suggestedIds.has(p.id)).map(p => createPropertyCheckbox(p, false)).join('');
    }
    
    document.querySelectorAll('.propiedad-checkbox').forEach(cb => cb.addEventListener('change', handleSelectionChange));
    updateSummary(availabilityData.suggestion.pricing);
}

async function handleSelectionChange() {
    const selectedIds = new Set(Array.from(document.querySelectorAll('.propiedad-checkbox:checked')).map(cb => cb.dataset.id));
    selectedProperties = availabilityData.allProperties.filter(p => selectedIds.has(p.id));

    if (selectedProperties.length === 0) {
        updateSummary({ totalPrice: 0, nights: currentPricing.nights, details: [] });
        return;
    }
    try {
        const payload = {
            fechaLlegada: document.getElementById('fecha-llegada').value,
            fechaSalida: document.getElementById('fecha-salida').value,
            propiedades: selectedProperties
        };
        const newPricing = await fetchAPI('/propuestas/recalcular', { method: 'POST', body: payload });
        updateSummary(newPricing);
    } catch (error) {
        alert(`Error al recalcular: ${error.message}`);
    }
}

function updateSummary(pricing) {
    currentPricing = pricing;
    const precioLista = pricing.totalPrice;
    document.getElementById('summary-noches').textContent = pricing.nights || 0;
    document.getElementById('summary-precio-lista').textContent = formatCurrency(precioLista);

    const valorFinalInput = document.getElementById('valor-final-input');
    const pctInput = document.getElementById('descuento-pct');
    const fijoInput = document.getElementById('descuento-fijo-total');

    let descuentoTotal = 0;
    let precioFinal;

    if (valorFinalInput.value) {
        precioFinal = parseFloat(valorFinalInput.value) || 0;
        descuentoTotal = precioLista - precioFinal;
    } else {
        const pct = parseFloat(pctInput.value) || 0;
        const fijo = parseFloat(fijoInput.value) || 0;
        if (pct > 0) descuentoTotal = precioLista * (pct / 100);
        else if (fijo > 0) descuentoTotal = fijo;
        precioFinal = precioLista - descuentoTotal;
    }

    document.getElementById('summary-descuento').textContent = `-${formatCurrency(descuentoTotal)}`;
    document.getElementById('summary-precio-final').textContent = formatCurrency(precioFinal);
}

export function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-8">
            <div>
                <h2 class="text-2xl font-semibold text-gray-900 mb-6">Crear Nueva Propuesta de Reserva</h2>
                
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
                            <div>
                                <label id="client-form-title" class="block text-sm font-medium text-gray-700">Buscar o Crear Cliente</label>
                                <input type="text" id="client-search" placeholder="Buscar por nombre o teléfono..." class="form-input mt-1">
                                <div id="client-results-list" class="hidden mt-1 border rounded-md max-h-32 overflow-y-auto bg-white z-10 absolute w-full max-w-sm"></div>
                                <input type="text" id="new-client-name" placeholder="Nombre completo" class="form-input mt-2">
                                <input type="tel" id="new-client-phone" placeholder="Teléfono" class="form-input mt-2">
                                <input type="email" id="new-client-email" placeholder="Email (opcional)" class="form-input mt-2">
                            </div>
                         </div>
                    </div>

                    <div id="pricing-section" class="p-4 border rounded-md bg-gray-50">
                        <h3 class="font-semibold text-gray-800 mb-4">4. Descuentos y Resumen Final</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div class="space-y-4">
                                <div><label for="descuento-pct" class="block text-sm font-medium">Descuento (%)</label><input type="number" id="descuento-pct" placeholder="Ej: 15" class="discount-input form-input mt-1"></div>
                                <div><label for="descuento-fijo-total" class="block text-sm font-medium">Descuento Fijo (CLP)</label><input type="number" id="descuento-fijo-total" placeholder="Ej: 20000" class="discount-input form-input mt-1"></div>
                                <div><label for="valor-final-input" class="block text-sm font-medium">O Ingresar Valor Final (CLP)</label><input type="number" id="valor-final-input" placeholder="Ej: 350000" class="discount-input form-input mt-1"></div>
                            </div>
                            <div class="p-4 bg-white rounded-md border space-y-2">
                                <div class="flex justify-between text-sm"><span class="text-gray-600">Noches Totales:</span><span id="summary-noches" class="font-medium">0</span></div>
                                <div class="flex justify-between text-sm"><span class="text-gray-600">Precio de Lista:</span><span id="summary-precio-lista" class="font-medium">$0</span></div>
                                <div class="flex justify-between text-sm text-red-600"><span class="font-medium">Descuento:</span><span id="summary-descuento" class="font-medium">-$0</span></div>
                                <div class="flex justify-between text-lg font-bold border-t pt-2 mt-2"><span>Precio Final:</span><span id="summary-precio-final" class="text-indigo-600">$0</span></div>
                            </div>
                        </div>
                    </div>

                    <div class="text-right pt-6 border-t mt-8">
                        <button id="guardar-propuesta-btn" class="btn-primary btn-lg">Crear Reserva Tentativa</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function afterRender() {
    const buscarBtn = document.getElementById('buscar-btn');
    
    const runSearch = async () => {
        const payload = {
            fechaLlegada: document.getElementById('fecha-llegada').value,
            fechaSalida: document.getElementById('fecha-salida').value,
            personas: document.getElementById('personas').value,
            permitirCambios: document.getElementById('permitir-cambios').checked
        };
        if (!payload.fechaLlegada || !payload.fechaSalida || !payload.personas) {
            alert('Por favor, completa las fechas y la cantidad de personas.'); return null;
        }

        const statusContainer = document.getElementById('status-container');
        buscarBtn.disabled = true;
        buscarBtn.textContent = 'Buscando...';
        statusContainer.textContent = 'Buscando disponibilidad y sugerencias...';
        statusContainer.classList.remove('hidden');
        document.getElementById('results-container').classList.add('hidden');

        try {
            availabilityData = await fetchAPI('/propuestas/generar', { method: 'POST', body: payload });
            allProperties = availabilityData.allProperties;
            if (availabilityData.suggestion) {
                statusContainer.classList.add('hidden');
                document.getElementById('results-container').classList.remove('hidden');
                renderSelectionUI();
                return availabilityData;
            } else {
                statusContainer.textContent = availabilityData.message || 'No se encontró disponibilidad.';
                return null;
            }
        } catch (error) {
            statusContainer.textContent = `Error: ${error.message}`;
            return null;
        } finally {
            buscarBtn.disabled = false;
            buscarBtn.textContent = 'Buscar Disponibilidad';
        }
    };

    buscarBtn.addEventListener('click', runSearch);
    
    document.getElementById('client-search').addEventListener('input', filterClients);
    document.querySelectorAll('.discount-input').forEach(input => input.addEventListener('input', () => updateSummary(currentPricing)));

    document.getElementById('guardar-propuesta-btn').addEventListener('click', async () => {
        const btn = document.getElementById('guardar-propuesta-btn');
        let clienteParaGuardar = selectedClient;
        
        if (!clienteParaGuardar) {
            const nombre = document.getElementById('new-client-name').value;
            if (nombre) {
                clienteParaGuardar = {
                    nombre: nombre,
                    telefono: document.getElementById('new-client-phone').value,
                    email: document.getElementById('new-client-email').value,
                };
            } else {
                alert('Debes seleccionar o crear un cliente.');
                return;
            }
        }
        
        if (selectedProperties.length === 0) {
            alert('Debes seleccionar al menos una propiedad.');
            return;
        }

        const payload = {
            cliente: clienteParaGuardar,
            fechaLlegada: document.getElementById('fecha-llegada').value,
            fechaSalida: document.getElementById('fecha-salida').value,
            propiedades: selectedProperties,
            precioFinal: parseFloat(document.getElementById('summary-precio-final').textContent.replace(/\$|\./g, '').replace(',','.')) || 0,
            noches: currentPricing.nights
        };
        
        btn.disabled = true;
        btn.textContent = editId ? 'Actualizando...' : 'Guardando...';

        try {
            const endpoint = editId ? `/gestion-propuestas/propuesta-tentativa/${editId}` : '/gestion-propuestas/propuesta-tentativa';
            const method = editId ? 'PUT' : 'POST';
            
            await fetchAPI(endpoint, { method, body: payload });
            alert(`Propuesta ${editId ? 'actualizada' : 'creada'} con éxito. Puedes gestionarla en "Gestionar Propuestas".`);
            handleNavigation('/gestionar-propuestas');
        } catch (error) {
            alert(`Error al guardar la propuesta: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = editId ? 'Actualizar Propuesta' : 'Crear Reserva Tentativa';
        }
    });

    await loadClients();
    const params = new URLSearchParams(window.location.search);
    editId = params.get('edit');

    if (editId) {
        document.getElementById('fecha-llegada').value = params.get('fechaLlegada');
        document.getElementById('fecha-salida').value = params.get('fechaSalida');
        document.getElementById('personas').value = params.get('personas');
        
        const clienteId = params.get('clienteId');
        const client = allClients.find(c => c.id === clienteId);
        if (client) {
            selectClient(client);
        }

        const data = await runSearch();
        if (data) {
            const propIds = params.get('propiedades').split(',');
            document.querySelectorAll('.propiedad-checkbox').forEach(cb => {
                cb.checked = propIds.includes(cb.dataset.id);
            });
            await handleSelectionChange();
        }
        document.getElementById('guardar-propuesta-btn').textContent = 'Actualizar Propuesta';
    }
}