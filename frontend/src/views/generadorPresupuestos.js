import { fetchAPI } from '../api.js';

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
    await generateBudgetText();
}

async function handleSelectionChange() {
    const selectedIds = new Set(Array.from(document.querySelectorAll('.propiedad-checkbox:checked')).map(cb => cb.dataset.id));
    selectedProperties = allProperties.filter(p => selectedIds.has(p.id));

    if (selectedProperties.length === 0) {
        document.getElementById('presupuesto-preview').value = 'Selecciona al menos una cabaña para generar el presupuesto.';
        return;
    }
    
    await generateBudgetText();
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
                <fieldset class="p-4 border rounded-md">
                    <legend class="px-2 font-semibold">4. Presupuesto Final</legend>
                    <textarea id="presupuesto-preview" rows="15" class="form-input w-full h-full"></textarea>
                    <div class="flex justify-end gap-2 mt-2">
                        <button id="copy-btn" class="btn-secondary">Copiar</button>
                        <button id="email-btn" class="btn-primary" disabled>Enviar por Email</button>
                    </div>
                </fieldset>
            </div>
        </div>
    `;
}

export function afterRender() {
    loadClients();
    document.getElementById('client-search').addEventListener('input', filterClients);

    document.getElementById('generar-propuesta-btn').addEventListener('click', async () => {
        const payload = {
            fechaLlegada: document.getElementById('fecha-llegada').value,
            fechaSalida: document.getElementById('fecha-salida').value,
            personas: document.getElementById('personas').value,
            sinCamarotes: document.getElementById('sin-camarotes').checked
        };
        if (!payload.fechaLlegada || !payload.fechaSalida || !payload.personas) {
            alert('Por favor, completa las fechas y la cantidad de personas.'); return;
        }

        const btn = document.getElementById('generar-propuesta-btn');
        const statusContainer = document.getElementById('status-container');
        btn.disabled = true;
        btn.textContent = 'Generando...';
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
            btn.disabled = false;
            btn.textContent = 'Generar Propuesta';
        }
    });
    
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
}