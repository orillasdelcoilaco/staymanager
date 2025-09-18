import { fetchAPI } from '../api.js';

let tarifas = [];
let alojamientos = [];
let canales = [];
let editandoTarifa = null;

// --- Lógica del Formulario Principal ---
function poblarSelectAlojamientos(alojamientoSeleccionadoId = '') {
    const select = document.getElementById('alojamiento-select');
    if (!select) return;
    select.innerHTML = alojamientos.map(a => 
        `<option value="${a.id}" ${a.id === alojamientoSeleccionadoId ? 'selected' : ''}>${a.nombre}</option>`
    ).join('');
}

function renderizarCamposDePrecio(precios = {}) {
    const container = document.getElementById('precios-dinamicos-container');
    if (!container) return;
    container.innerHTML = canales.map(c => `
        <div>
            <label for="precio-${c.id}" class="block text-sm font-medium text-gray-700">${c.nombre} (${precios[c.id]?.moneda || 'CLP'})</label>
            <input type="number" id="precio-${c.id}" name="precio-${c.id}" data-canal-id="${c.id}" 
                   value="${precios[c.id]?.valor || ''}"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
            <input type="hidden" name="moneda-${c.id}" value="${precios[c.id]?.moneda || 'CLP'}">
        </div>
    `).join('');
}

function limpiarFormularioPrincipal() {
    const form = document.getElementById('tarifa-form');
    if (form) form.reset();
    poblarSelectAlojamientos();
    renderizarCamposDePrecio();
}

// --- Lógica del Modal de Edición ---
function abrirModalEditar(tarifa) {
    editandoTarifa = tarifa;
    const modal = document.getElementById('tarifa-modal-edit');
    const form = document.getElementById('tarifa-form-edit');
    if (!modal || !form) return;

    form.alojamientoNombre.value = tarifa.alojamientoNombre;
    form.temporada.value = tarifa.temporada;
    form.fechaInicio.value = tarifa.fechaInicio;
    form.fechaTermino.value = tarifa.fechaTermino;

    const preciosContainer = document.getElementById('precios-dinamicos-container-edit');
    preciosContainer.innerHTML = canales.map(c => `
        <div>
            <label for="edit-precio-${c.id}" class="block text-sm font-medium text-gray-700">${c.nombre} (${tarifa.precios[c.id]?.moneda || 'CLP'})</label>
            <input type="number" id="edit-precio-${c.id}" name="precio-${c.id}" data-canal-id="${c.id}" 
                   value="${tarifa.precios[c.id]?.valor || ''}"
                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
             <input type="hidden" name="moneda-${c.id}" value="${tarifa.precios[c.id]?.moneda || 'CLP'}">
        </div>
    `).join('');
    
    modal.classList.remove('hidden');
}

function cerrarModalEditar() {
    const modal = document.getElementById('tarifa-modal-edit');
    if (modal) modal.classList.add('hidden');
    editandoTarifa = null;
}

// --- Lógica de la Tabla Historial ---
function renderTabla() {
    const tbody = document.getElementById('tarifas-tbody');
    if (!tbody) return;

    // Función para extraer el número de un string (ej: "Cabaña 10" -> 10)
    const extraerNumero = (texto) => {
        const match = texto.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };

    // Ordenamiento inteligente
    const tarifasOrdenadas = [...tarifas].sort((a, b) => {
        const numA = extraerNumero(a.alojamientoNombre);
        const numB = extraerNumero(b.alojamientoNombre);

        // Primero, comparar por el número extraído del nombre del alojamiento
        if (numA !== numB) {
            return numA - numB;
        }
        
        // Si los números son iguales (o no hay), comparar por el nombre completo
        const nombreA = a.alojamientoNombre.toLowerCase();
        const nombreB = b.alojamientoNombre.toLowerCase();
        if (nombreA !== nombreB) {
            return nombreA.localeCompare(nombreB);
        }

        // Si los alojamientos son idénticos, ordenar por fecha de inicio descendente
        return new Date(b.fechaInicio) - new Date(a.fechaInicio);
    });

    tbody.innerHTML = tarifasOrdenadas.map(t => {
        const preciosHtml = canales.map(c => {
            const precio = t.precios[c.id];
            return `<li><strong>${c.nombre}:</strong> ${precio ? `${new Intl.NumberFormat().format(precio.valor)} ${precio.moneda}` : 'No definido'}</li>`;
        }).join('');

        return `
            <tr class="border-b">
                <td class="py-3 px-4">${t.alojamientoNombre}</td>
                <td class="py-3 px-4">${t.temporada}</td>
                <td class="py-3 px-4">${t.fechaInicio}</td>
                <td class="py-3 px-4">${t.fechaTermino}</td>
                <td class="py-3 px-4"><ul>${preciosHtml}</ul></td>
                <td class="py-3 px-4 whitespace-nowrap">
                    <button data-id="${t.id}" class="copy-btn text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">Copiar</button>
                    <button data-id="${t.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Editar</button>
                    <button data-id="${t.id}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- Lógica Principal de la Vista ---
export async function render() {
    try {
        [tarifas, alojamientos, canales] = await Promise.all([
            fetchAPI('/tarifas'),
            fetchAPI('/propiedades'),
            fetchAPI('/canales')
        ]);
    } catch (error) {
        console.error("Error al cargar datos para tarifas:", error);
        return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }

    return `
        <div class="bg-white p-6 rounded-lg shadow mb-8">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Añadir Nuevo Período de Tarifa</h2>
            <form id="tarifa-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label for="alojamiento-select" class="block text-sm font-medium text-gray-700">Alojamiento</label>
                        <select id="alojamiento-select" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"></select>
                    </div>
                    <div>
                        <label for="temporada-input" class="block text-sm font-medium text-gray-700">Temporada</label>
                        <input type="text" id="temporada-input" placeholder="Ej: Alta Verano 2025" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label for="fecha-inicio-input" class="block text-sm font-medium text-gray-700">Fecha Inicio</label>
                        <input type="date" id="fecha-inicio-input" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    </div>
                    <div>
                        <label for="fecha-termino-input" class="block text-sm font-medium text-gray-700">Fecha Término</label>
                        <input type="date" id="fecha-termino-input" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    </div>
                </div>
                <div id="precios-dinamicos-container" class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                    </div>
                <div class="flex justify-end">
                    <button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Guardar Tarifa</button>
                </div>
            </form>
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Historial de Tarifas</h2>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th">Alojamiento</th>
                            <th class="th">Temporada</th>
                            <th class="th">Fecha Inicio</th>
                            <th class="th">Fecha Término</th>
                            <th class="th">Tarifas por Canal</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tarifas-tbody"></tbody>
                </table>
            </div>
        </div>
        
        <div id="tarifa-modal-edit" class="modal hidden">
             <div class="modal-content">
                <h3 class="text-xl font-semibold mb-4">Editar Tarifa</h3>
                <form id="tarifa-form-edit" class="space-y-4">
                    <input type="text" id="alojamientoNombre" disabled class="mt-1 block w-full bg-gray-100 px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    <input type="text" id="temporada" placeholder="Temporada" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    <input type="date" id="fechaInicio" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    <input type="date" id="fechaTermino" required class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm">
                    <div id="precios-dinamicos-container-edit" class="grid grid-cols-2 gap-4 pt-4 border-t"></div>
                    <div class="flex justify-end pt-4">
                        <button type="button" id="cancel-edit-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md mr-2 hover:bg-gray-300">Cancelar</button>
                        <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

export function afterRender() {
    poblarSelectAlojamientos();
    renderizarCamposDePrecio();
    renderTabla();

    const form = document.getElementById('tarifa-form');
    const formEdit = document.getElementById('tarifa-form-edit');
    const tbody = document.getElementById('tarifas-tbody');

    // --- Event Listeners Formulario Principal ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alojamientoSelect = document.getElementById('alojamiento-select');
        const precios = {};
        document.querySelectorAll('#precios-dinamicos-container input[data-canal-id]').forEach(input => {
            const canalId = input.dataset.canalId;
            const moneda = form[`moneda-${canalId}`].value;
            precios[canalId] = { valor: parseFloat(input.value) || 0, moneda: moneda };
        });

        const datos = {
            alojamientoId: alojamientoSelect.value,
            alojamientoNombre: alojamientoSelect.options[alojamientoSelect.selectedIndex].text,
            temporada: document.getElementById('temporada-input').value,
            fechaInicio: document.getElementById('fecha-inicio-input').value,
            fechaTermino: document.getElementById('fecha-termino-input').value,
            precios
        };

        try {
            await fetchAPI('/tarifas', { method: 'POST', body: datos });
            tarifas = await fetchAPI('/tarifas');
            renderTabla();
            limpiarFormularioPrincipal();
        } catch (error) {
            alert(`Error al guardar tarifa: ${error.message}`);
        }
    });

    // --- Event Listeners Modal de Edición ---
    document.getElementById('cancel-edit-btn').addEventListener('click', cerrarModalEditar);
    formEdit.addEventListener('submit', async(e) => {
        e.preventDefault();
        const precios = {};
        document.querySelectorAll('#precios-dinamicos-container-edit input[data-canal-id]').forEach(input => {
            const canalId = input.dataset.canalId;
            const moneda = formEdit[`moneda-${canalId}`].value;
            precios[canalId] = { valor: parseFloat(input.value) || 0, moneda: moneda };
        });

        const datos = {
            temporada: formEdit.temporada.value,
            fechaInicio: formEdit.fechaInicio.value,
            fechaTermino: formEdit.fechaTermino.value,
            precios
        };

        try {
            await fetchAPI(`/tarifas/${editandoTarifa.id}`, { method: 'PUT', body: datos });
            tarifas = await fetchAPI('/tarifas');
            renderTabla();
            cerrarModalEditar();
        } catch (error) {
            alert(`Error al actualizar tarifa: ${error.message}`);
        }
    });


    // --- Event Listeners Tabla ---
    tbody.addEventListener('click', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        const tarifa = tarifas.find(t => t.id === id);
        if (!tarifa) return;

        if (target.classList.contains('edit-btn')) {
            abrirModalEditar(tarifa);
        }

        if (target.classList.contains('copy-btn')) {
            poblarSelectAlojamientos(tarifa.alojamientoId);
            document.getElementById('temporada-input').value = tarifa.temporada;
            document.getElementById('fecha-inicio-input').value = tarifa.fechaInicio;
            document.getElementById('fecha-termino-input').value = tarifa.fechaTermino;
            renderizarCamposDePrecio(tarifa.precios);
            window.scrollTo(0, 0); // Scroll al principio para ver el formulario
        }
        
        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este período de tarifa?')) {
                fetchAPI(`/tarifas/${id}`, { method: 'DELETE' }).then(async () => {