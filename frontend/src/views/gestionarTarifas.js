import { fetchAPI } from '../api.js';

let tarifas = [];
let alojamientos = [];
let canales = [];
let editandoTarifa = null;
let canalPorDefecto = null;

// --- Lógica del Formulario Principal ---
function poblarSelectAlojamientos(alojamientoSeleccionadoId = '') {
    const select = document.getElementById('alojamiento-select');
    if (!select) return;
    select.innerHTML = alojamientos.map(a => 
        `<option value="${a.id}" ${a.id === alojamientoSeleccionadoId ? 'selected' : ''}>${a.nombre}</option>`
    ).join('');
}

function limpiarFormularioPrincipal() {
    const form = document.getElementById('tarifa-form');
    if (form) form.reset();
    poblarSelectAlojamientos();
}

// --- Lógica del Modal de Edición ---
function abrirModalEditar(tarifa) {
    editandoTarifa = tarifa;
    const modal = document.getElementById('tarifa-modal-edit');
    const form = document.getElementById('tarifa-form-edit');
    if (!modal || !form) return;

    const precioBaseObj = tarifa.precios[canalPorDefecto.id];

    form.alojamientoNombre.value = tarifa.alojamientoNombre;
    form.temporada.value = tarifa.temporada;
    form.fechaInicio.value = tarifa.fechaInicio;
    form.fechaTermino.value = tarifa.fechaTermino;
    form.precioBase.value = precioBaseObj ? precioBaseObj.valor : 0;
    
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

    if (tarifas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay tarifas registradas.</td></tr>`;
        return;
    }

    const extraerNumero = (texto) => {
        const match = texto.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    };

    const tarifasOrdenadas = [...tarifas].sort((a, b) => {
        const numA = extraerNumero(a.alojamientoNombre);
        const numB = extraerNumero(b.alojamientoNombre);

        if (numA !== numB) {
            return numA - numB;
        }
        
        const nombreA = a.alojamientoNombre.toLowerCase();
        const nombreB = b.alojamientoNombre.toLowerCase();
        if (nombreA !== nombreB) {
            return nombreA.localeCompare(nombreB);
        }

        return new Date(b.fechaInicio) - new Date(a.fechaInicio);
    });

    tbody.innerHTML = tarifasOrdenadas.map((t, index) => {
        const preciosHtml = canales.map(c => {
            const precio = t.precios[c.id];
            return `<li><strong>${c.nombre}:</strong> ${precio ? `${new Intl.NumberFormat().format(Math.round(precio.valor))} ${c.moneda}` : 'No definido'}</li>`;
        }).join('');

        return `
            <tr class="border-b">
                <td class="py-3 px-4 text-center font-medium text-gray-500">${index + 1}</td>
                <td class="py-3 px-4">${t.alojamientoNombre}</td>
                <td class="py-3 px-4">${t.temporada}</td>
                <td class="py-3 px-4">${t.fechaInicio}</td>
                <td class="py-3 px-4">${t.fechaTermino}</td>
                <td class="py-3 px-4 text-xs"><ul>${preciosHtml}</ul></td>
                <td class="py-3 px-4 whitespace-nowrap">
                    <button data-id="${t.id}" class="copy-btn btn-table-copy mr-2">Copiar</button>
                    <button data-id="${t.id}" class="edit-btn btn-table-edit mr-2">Editar</button>
                    <button data-id="${t.id}" class="delete-btn btn-table-delete">Eliminar</button>
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
        canalPorDefecto = canales.find(c => c.esCanalPorDefecto);
        if (!canalPorDefecto) {
            return `<div class="bg-red-100 p-4 rounded-md text-red-800"><b>Error de configuración:</b> No se ha definido un "Canal por Defecto". Por favor, ve a la sección de "Gestionar Canales" y marca uno con la estrella ⭐.</div>`;
        }
    } catch (error) {
        console.error("Error al cargar datos para tarifas:", error);
        return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
    }

    return `
        <div class="bg-white p-6 rounded-lg shadow mb-8">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Añadir Nuevo Período de Tarifa</h2>
            <form id="tarifa-form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div>
                        <label for="alojamiento-select" class="block text-sm font-medium text-gray-700">Alojamiento</label>
                        <select id="alojamiento-select" class="form-input mt-1"></select>
                    </div>
                    <div>
                        <label for="temporada-input" class="block text-sm font-medium text-gray-700">Temporada</label>
                        <input type="text" id="temporada-input" placeholder="Ej: Alta Verano 2025" required class="form-input mt-1">
                    </div>
                    <div>
                        <label for="fecha-inicio-input" class="block text-sm font-medium text-gray-700">Fecha Inicio</label>
                        <input type="date" id="fecha-inicio-input" required class="form-input mt-1">
                    </div>
                    <div>
                        <label for="fecha-termino-input" class="block text-sm font-medium text-gray-700">Fecha Término</label>
                        <input type="date" id="fecha-termino-input" required class="form-input mt-1">
                    </div>
                    <div>
                        <label for="precio-base-input" class="block text-sm font-medium text-gray-700">Precio Base (${canalPorDefecto.moneda})</label>
                        <input type="number" id="precio-base-input" required class="form-input mt-1">
                    </div>
                </div>
                <div class="flex justify-end pt-4 border-t">
                    <button type="submit" class="btn-primary">Guardar Tarifa</button>
                </div>
            </form>
        </div>

        <div class="bg-white p-6 rounded-lg shadow">
            <h2 class="text-xl font-semibold text-gray-800 mb-4">Historial de Tarifas</h2>
            <div class="table-container">
                <table class="min-w-full bg-white">
                    <thead>
                        <tr>
                            <th class="th w-12">#</th>
                            <th class="th">Alojamiento</th>
                            <th class="th">Temporada</th>
                            <th class="th">Fecha Inicio</th>
                            <th class="th">Fecha Término</th>
                            <th class="th">Tarifas Calculadas</th>
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
                    <input type="text" id="alojamientoNombre" name="alojamientoNombre" disabled class="form-input mt-1 bg-gray-100">
                    <input type="text" id="temporada" name="temporada" placeholder="Temporada" required class="form-input mt-1">
                    <input type="date" id="fechaInicio" name="fechaInicio" required class="form-input mt-1">
                    <input type="date" id="fechaTermino" name="fechaTermino" required class="form-input mt-1">
                    <div>
                        <label for="precioBase" class="block text-sm font-medium text-gray-700">Precio Base (${canalPorDefecto.moneda})</label>
                        <input type="number" id="precioBase" name="precioBase" required class="form-input mt-1">
                    </div>
                    <div class="flex justify-end pt-4 border-t">
                        <button type="button" id="cancel-edit-btn" class="btn-secondary mr-2">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

export function afterRender() {
    if (!canalPorDefecto) return;
    
    poblarSelectAlojamientos();
    renderTabla();

    const form = document.getElementById('tarifa-form');
    const formEdit = document.getElementById('tarifa-form-edit');
    const tbody = document.getElementById('tarifas-tbody');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const datos = {
            alojamientoId: document.getElementById('alojamiento-select').value,
            temporada: document.getElementById('temporada-input').value,
            fechaInicio: document.getElementById('fecha-inicio-input').value,
            fechaTermino: document.getElementById('fecha-termino-input').value,
            precioBase: document.getElementById('precio-base-input').value
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

    document.getElementById('cancel-edit-btn').addEventListener('click', cerrarModalEditar);

    formEdit.addEventListener('submit', async(e) => {
        e.preventDefault();
        
        const datos = {
            temporada: e.target.elements.temporada.value,
            fechaInicio: e.target.elements.fechaInicio.value,
            fechaTermino: e.target.elements.fechaTermino.value,
            precioBase: e.target.elements.precioBase.value
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
            
            const precioBaseObj = tarifa.precios[canalPorDefecto.id];
            document.getElementById('precio-base-input').value = precioBaseObj ? precioBaseObj.valor : '';

            window.scrollTo(0, 0);
        }
        
        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar este período de tarifa?')) {
                fetchAPI(`/tarifas/${id}`, { method: 'DELETE' }).then(async () => {
                    tarifas = await fetchAPI('/tarifas');
                    renderTabla();
                }).catch(error => alert(`Error al eliminar: ${error.message}`));
            }
        }
    });
}