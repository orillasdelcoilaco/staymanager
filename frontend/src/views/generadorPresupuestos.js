import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let allClients = [];
let allProperties = [];
let availabilityData = {};
let selectedProperties = [];
let currentPricing = {};

function formatCurrency(value) { return `$${(Math.round(value) || 0).toLocaleString('es-CL')}`; }

// --- Lógica del Cliente ---
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
    document.getElementById('client-search').value = client.nombre;
    document.getElementById('client-results-list').classList.add('hidden');
    document.getElementById('new-client-name').value = client.nombre || '';
    document.getElementById('new-client-phone').value = client.telefono || '';
    document.getElementById('new-client-email').value = client.email || '';
    document.getElementById('new-client-company').value = ''; // Campo opcional
}

function clearClientSelection() {
    ['new-client-name', 'new-client-phone', 'new-client-email', 'new-client-company'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = '';
    });
}

// --- Lógica de UI y Presupuesto ---

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

async function renderSelectionUI() {
    const suggestionList = document.getElementById('suggestion-list');
    const availableList = document.getElementById('available-list');
    suggestionList.innerHTML = '';
    availableList.innerHTML = '';

    if (!availabilityData.suggestion) return;
    
    selectedProperties = [...availabilityData.suggestion.propiedades];
    
    const suggestedIds = new Set(availabilityData.suggestion.propiedades.map(p => p.id));
    suggestionList.innerHTML = `<h4 class="font-medium text-gray-700">Propiedades Sugeridas</h4>` + availabilityData.suggestion.propiedades.map(p => createPropertyCheckbox(p, true)).join('');
    availableList.innerHTML = availabilityData.availableProperties.filter(p => !suggestedIds.has(p.id)).map(p => createPropertyCheckbox(p, false)).join('');
    
    document.querySelectorAll('.propiedad-checkbox').forEach(cb => cb.addEventListener('change', handleSelectionChange));
    
    // Asignar el precio inicial y generar el texto
    updateSummary(availabilityData.suggestion.pricing);
    await generateBudgetText();
}

async function handleSelectionChange() {
    const selectedIds = new Set(Array.from(document.querySelectorAll('.propiedad-checkbox:checked')).map(cb => cb.dataset.id));
    selectedProperties = allProperties.filter(p => selectedIds.has(p.id));

    if (selectedProperties.length === 0) {
        document.getElementById('presupuesto-preview').value = 'Selecciona al menos una cabaña para generar el presupuesto.';
        updateSummary({ totalPrice: 0, nights: currentPricing.nights, details: [] });
        return;
    }
    
    await updatePricingAndBudgetText();
}

async function updatePricingAndBudgetText() {
    const previewTextarea = document.getElementById('presupuesto-preview');
    previewTextarea.value = 'Calculando precios y generando presupuesto...';

    try {
        const payload = {
            fechaLlegada: document.getElementById('fecha-llegada').value,
            fechaSalida: document.getElementById('fecha-salida').value,
            propiedades: selectedProperties
        };
        const newPricing = await fetchAPI('/propuestas/recalcular', { method: 'POST', body: payload });
        updateSummary(newPricing);
        await generateBudgetText();
    } catch (error) {
        previewTextarea.value = `Error al recalcular: ${error.message}`;
        updateSummary({ totalPrice: 0, nights: currentPricing.nights || 0, details: [] });
    }
}

function updateSummary(pricing) {
    currentPricing = pricing;
    document.getElementById('summary-precio-final').textContent = formatCurrency(pricing.totalPrice);
}

async function generateBudgetText() {
    const previewTextarea = document.getElementById('presupuesto-preview');
    previewTextarea.value = 'Generando presupuesto...';

    try {
        const payload = {
            cliente: {
                nombre: document.getElementById('new-client-name').value || 'Cliente',
                empresa: document.getElementById('new-client-company').value,
            },
            fechaLlegada: document.getElementById('fecha-llegada').value,
            fechaSalida: document.getElementById('fecha-salida').value,
            propiedades: selectedProperties,
            personas: document.getElementById('personas').value
        };
        const result = await fetchAPI('/presupuestos/generar-texto', { method: 'POST', body: payload });
        previewTextarea.value = result.texto;
    } catch (error) {
        previewTextarea.value = `Error al generar el presupuesto: ${error.message}`;
    }
}

// --- Lógica Principal y Eventos ---

export async function render() {
    return `
        <div class="bg-white p-8 rounded-lg shadow space-y-6">
            <h2 class="text-2xl font-semibold text-gray-900">Generador de Presupuestos</h2>
            
            <fieldset class="p-4 border rounded-md">
                <legend class="px-2 font-semibold">1. Datos del Cliente</legend>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label for="client-search" class="block text-sm font-medium">Buscar cliente existente</label>
                        <input type="text" id="client-search" placeholder="Escribe para buscar..." class="form-input mt-1">
                        <div id="client-results-list" class="hidden mt-1 border rounded-md max-h-32 overflow-y-auto bg-white z-10 absolute w-full max-w-sm"></div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium">... o añade/actualiza los datos del cliente</label>
                        <div class="grid grid-cols-2 gap-4 mt-1">
                            <input type="text" id="new-client-name" placeholder="Nombre completo" class="form-input col-span-2">
                            <input type="text" id="new-client-company" placeholder="Empresa (Opcional)" class="form-input">
                            <input type="tel" id="new-client-phone" placeholder="Teléfono (Opcional)" class="form-input">
                            <input type="email" id="new-client-email" placeholder="Email(s) separados por ;" class="form-input col-span-2">
                        </div>
                    </div>
                </div>
            </fieldset>

            <fieldset class="p-4 border rounded-md">
                <legend class="px-2 font-semibold">2. Fechas y Personas</legend>
                <div class="flex flex-wrap items-end gap-4">
                    <div>
                        <label for="fecha-llegada" class="block text-sm font-medium">Fecha de Llegada</label>
                        <input type="date" id="fecha-llegada" class="form-input mt-1">
                    </div>
                    <div>
                        <label for="fecha-salida" class="block text-sm font-medium">Fecha de Salida</label>
                        <input type="date" id="fecha-salida" class="form-input mt-1">
                    </div>
                    <div>
                        <label for="personas" class="block text-sm font-medium">N° de Personas</label>
                        <input type="number" id="personas" min="1" class="form-input mt-1">
                    </div>
                    <div class="flex items-center">
                        <input id="sin-camarotes" type="checkbox" class="h-4 w-4 text-indigo-600 border-gray-300 rounded">
                        <label for="sin-camarotes" class="ml-2 block text-sm font-medium">Sin Camarotes</label>
                    </div>
                    <button id="generar-propuesta-btn" class="btn-primary">Generar Propuesta</button>
                </div>
            </fieldset>

            <div id="status-container" class="text-center text-gray-500 hidden p-4"></div>
            
            <div id="results-container" class="hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                <fieldset class="p-4 border rounded-md">
                    <legend class="px-2 font-semibold">3. Propuesta y Modificación de Cabañas</legend>
                    <div id="suggestion-list" class="space-y-2"></div>
                    <h4 class="font-medium text-gray-700 mt-4 border-t pt-4">Otras Cabañas Disponibles</h4>
                    <div id="available-list" class="mt-2 space-y-2 max-h-60 overflow-y-auto"></div>
                </fieldset>
                <fieldset class="p-4 border rounded-md flex flex-col">
                    <legend class="px-2 font-semibold">4. Presupuesto Final</legend>
                    <div class="flex-grow flex flex-col">
                        <div class="p-2 bg-gray-800 text-white rounded-t-md flex justify-between items-center">
                            <span class="font-semibold">Resumen de Precios</span>
                            <span id="summary-precio-final" class="text-lg font-bold">$0</span>
                        </div>
                        <textarea id="presupuesto-preview" class="form-input w-full flex-grow rounded-b-md rounded-t-none"></textarea>
                    </div>
                    <div class="flex justify-end gap-2 mt-2">
                        <button id="guardar-presupuesto-btn" class="btn-secondary">Guardar Borrador</button>
                        <button id="copy-btn" class="btn-secondary">Copiar</button>
                        <button id="email-btn" class="btn-primary" disabled>Enviar por Email</button>
                    </div>
                </fieldset>
            </div>
        </div>
    `;
}

export async function afterRender() {
    loadClients();
    document.getElementById('client-search').addEventListener('input', filterClients);

    const generarBtn = document.getElementById('generar-propuesta-btn');
    
    const runSearch = async () => {
        const payload = {
            fechaLlegada: document.getElementById('fecha-llegada').value,
            fechaSalida: document.getElementById('fecha-salida').value,
            personas: document.getElementById('personas').value,
            sinCamarotes: document.getElementById('sin-camarotes').checked
        };
        if (!payload.fechaLlegada || !payload.fechaSalida || !payload.personas) {
            alert('Por favor, completa las fechas y la cantidad de personas.');
            return;
        }

        const statusContainer = document.getElementById('status-container');
        generarBtn.disabled = true;
        generarBtn.textContent = 'Generando...';
        statusContainer.textContent = 'Buscando disponibilidad y sugerencias...';
        statusContainer.classList.remove('hidden');
        document.getElementById('results-container').classList.add('hidden');

        try {
            availabilityData = await fetchAPI('/propuestas/generar', { method: 'POST', body: payload });
            allProperties = availabilityData.allProperties;
            if (availabilityData.suggestion) {
                statusContainer.classList.add('hidden');
                document.getElementById('results-container').classList.remove('hidden');
                await renderSelectionUI();
            } else {
                statusContainer.textContent = availabilityData.message || 'No se encontró disponibilidad.';
            }
        } catch (error) {
            statusContainer.textContent = `Error: ${error.message}`;
        } finally {
            generarBtn.disabled = false;
            generarBtn.textContent = 'Generar Propuesta';
        }
    };

    generarBtn.addEventListener('click', runSearch);

    document.getElementById('copy-btn').addEventListener('click', () => {
        const textarea = document.getElementById('presupuesto-preview');
        textarea.select();
        document.execCommand('copy');
        alert('Presupuesto copiado al portapapeles.');
    });

    ['new-client-name', 'new-client-company', 'fecha-llegada', 'fecha-salida'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async () => {
                if (selectedProperties.length > 0) {
                    await generateBudgetText();
                }
            });
        }
    });

    document.getElementById('guardar-presupuesto-btn').addEventListener('click', async () => {
        const btn = document.getElementById('guardar-presupuesto-btn');
        const clienteParaGuardar = {
            id: allClients.find(c => c.nombre === document.getElementById('new-client-name').value)?.id,
            nombre: document.getElementById('new-client-name').value,
            telefono: document.getElementById('new-client-phone').value,
            email: document.getElementById('new-client-email').value,
        };
        
        if (!clienteParaGuardar.nombre) {
            alert('Debes ingresar al menos el nombre del cliente para guardar un presupuesto.');
            return;
        }
        
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit');

        const payload = {
            id: editId,
            cliente: clienteParaGuardar,
            fechaLlegada: document.getElementById('fecha-llegada').value,
            fechaSalida: document.getElementById('fecha-salida').value,
            propiedades: selectedProperties,
            precioFinal: currentPricing.totalPrice || 0,
            noches: currentPricing.nights || 0,
            texto: document.getElementById('presupuesto-preview').value
        };

        btn.disabled = true;
        btn.textContent = 'Guardando...';

        try {
            await fetchAPI('/gestion-propuestas/presupuesto', { method: 'POST', body: payload });
            alert('Presupuesto guardado como borrador. Puedes gestionarlo en "Gestionar Propuestas".');
            if (editId) {
                handleNavigation('/gestionar-propuestas');
            }
        } catch (error) {
            alert(`Error al guardar el presupuesto: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar Borrador';
        }
    });
    
    // --- LÓGICA DE EDICIÓN ---
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');

    if (editId) {
        await loadClients();
        console.log('[Debug Presupuesto] Modo edición detectado. ID:', editId);
        
        document.getElementById('fecha-llegada').value = params.get('fechaLlegada');
        document.getElementById('fecha-salida').value = params.get('fechaSalida');
        document.getElementById('personas').value = params.get('personas');
        
        const clienteId = params.get('clienteId');
        const client = allClients.find(c => c.id === clienteId);
        if (client) {
            console.log('[Debug Presupuesto] Cliente encontrado para edición:', client);
            selectClient(client);
        } else {
            console.warn('[Debug Presupuesto] No se encontró el cliente con ID:', clienteId);
        }

        await runSearch();
        
        if (availabilityData && availabilityData.suggestion) {
            console.log('[Debug Presupuesto] Datos de disponibilidad cargados, seleccionando propiedades.');
            const propIds = params.get('propiedades').split(',');
            document.querySelectorAll('.propiedad-checkbox').forEach(cb => {
                cb.checked = propIds.includes(cb.dataset.id);
            });
            await handleSelectionChange();
            console.log('[Debug Presupuesto] Proceso de edición completado.');
        } else {
            console.error('[Debug Presupuesto] No se pudieron cargar los datos de disponibilidad en modo edición.');
        }
    }
}