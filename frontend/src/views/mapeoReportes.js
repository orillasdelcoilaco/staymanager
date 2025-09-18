import { fetchAPI } from '../api.js';

let mapeos = [];
let canales = [];

const camposInternos = [
    { id: 'idReservaCanal', nombre: 'ID de Reserva' },
    { id: 'canalNombre', nombre: 'Nombre del Canal' },
    { id: 'estado', nombre: 'Estado de la Reserva' },
    { id: 'fechaReserva', nombre: 'Fecha de Creación' },
    { id: 'fechaLlegada', nombre: 'Fecha de Llegada (Check-in)' },
    { id: 'fechaSalida', nombre: 'Fecha de Salida (Check-out)' },
    { id: 'totalNoches', nombre: 'Total de Noches' },
    { id: 'invitados', nombre: 'Cantidad de Huéspedes' },
    { id: 'nombreCliente', nombre: 'Nombre del Cliente' },
    { id: 'correoCliente', nombre: 'Email del Cliente' },
    { id: 'telefonoCliente', nombre: 'Teléfono del Cliente' },
    { id: 'moneda', nombre: 'Moneda del Precio' },
    { id: 'valorTotal', nombre: 'Valor Total' },
    { id: 'comision', nombre: 'Comisión' },
    { id: 'abono', nombre: 'Abono' },
    { id: 'pendiente', nombre: 'Pendiente de Pago' },
    { id: 'alojamientoNombre', nombre: 'Nombre del Alojamiento' },
    { id: 'pais', nombre: 'País del Cliente' },
];

function renderizarFormulario(canalSeleccionadoId = null) {
    const canalSelect = document.getElementById('canal-select');
    const mapeoFieldsContainer = document.getElementById('mapeo-fields');
    if (!canalSelect || !mapeoFieldsContainer) return;

    canalSelect.innerHTML = `<option value="">Seleccione un canal</option>` + 
        canales.map(c => `<option value="${c.id}" data-nombre="${c.nombre}" ${c.id === canalSeleccionadoId ? 'selected' : ''}>${c.nombre}</option>`).join('');

    if (canalSeleccionadoId) {
        canalSelect.dispatchEvent(new Event('change'));
    }
}

function renderTablaMapeos() {
    const tbody = document.getElementById('mapeos-tbody');
    if (!tbody) return;

    if (mapeos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay mapeos guardados.</td></tr>`;
        return;
    }

    tbody.innerHTML = mapeos.map(m => `
        <tr class="border-b">
            <td class="py-3 px-4 font-medium">${m.canalNombre}</td>
            <td class="py-3 px-4">${camposInternos.find(c => c.id === m.campoInterno)?.nombre || m.campoInterno}</td>
            <td class="py-3 px-4 font-mono text-sm">${m.nombresExternos.join(', ')}</td>
            <td class="py-3 px-4">
                <button data-id="${m.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Editar</button>
                <button data-id="${m.id}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

export async function render() {
    try {
        [mapeos, canales] = await Promise.all([
            fetchAPI('/mapeos'),
            fetchAPI('/canales')
        ]);
    } catch (error) {
        return `<p class="text-red-500">Error al cargar los datos.</p>`;
    }

    return `
        <div class="space-y-8">
            <div class="bg-white p-8 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-900 mb-2">Mapeo de Columnas de Reportes</h2>
                <p class="text-gray-600 mb-6">
                    Define las reglas para que el sistema pueda leer tus reportes. Selecciona un canal y asigna los nombres de columna de tus archivos a los campos del sistema.
                </p>
                <div id="mapeo-container" class="space-y-6">
                    <div>
                        <label for="canal-select" class="block text-lg font-medium text-gray-800">1. Canal a Configurar</label>
                        <select id="canal-select" class="mt-2 form-select w-full md:w-1/3"></select>
                    </div>
                    <div id="mapeo-fields" class="space-y-3 border-t pt-6"></div>
                    <div id="form-actions" class="flex justify-end pt-6 border-t hidden">
                        <button id="guardar-mapeo-btn" class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                            Guardar Mapeo para este Canal
                        </button>
                    </div>
                </div>
            </div>

            <div class="bg-white p-8 rounded-lg shadow">
                <h3 class="text-xl font-semibold text-gray-800 mb-4">Mapeos Guardados</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="th">Canal</th>
                                <th class="th">Campo del Sistema</th>
                                <th class="th">Nombres en el Reporte (separados por coma)</th>
                                <th class="th">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="mapeos-tbody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    const container = document.getElementById('mapeo-container');
    if (!container) return;

    const canalSelect = document.getElementById('canal-select');
    const mapeoFieldsContainer = document.getElementById('mapeo-fields');
    const formActions = document.getElementById('form-actions');
    const saveButton = document.getElementById('guardar-mapeo-btn');
    const mapeosTbody = document.getElementById('mapeos-tbody');

    renderizarFormulario();
    renderTablaMapeos();

    canalSelect.addEventListener('change', () => {
        const canalId = canalSelect.value;
        if (!canalId) {
            mapeoFieldsContainer.innerHTML = '<p class="text-gray-500">Selecciona un canal para ver y editar sus mapeos.</p>';
            formActions.classList.add('hidden');
            return;
        }
        formActions.classList.remove('hidden');

        mapeoFieldsContainer.innerHTML = camposInternos.map(campo => {
            const mapeoExistente = mapeos.find(m => m.canalId === canalId && m.campoInterno === campo.id);
            const nombresExternos = mapeoExistente ? mapeoExistente.nombresExternos.join(', ') : '';
            return `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <label for="campo-${campo.id}" class="text-sm font-medium text-gray-700 md:justify-self-end">${campo.nombre}:</label>
                    <input type="text" id="campo-${campo.id}" data-campo-interno="${campo.id}" 
                           value="${nombresExternos}"
                           placeholder="Ej: Check-in, Fecha Llegada, Arrival Date"
                           class="form-input mapeo-input">
                </div>
            `;
        }).join('');
    });

    saveButton.addEventListener('click', async () => {
        const canalId = canalSelect.value;
        const canalNombre = canalSelect.options[canalSelect.selectedIndex].dataset.nombre;
        if (!canalId) return;

        const inputs = document.querySelectorAll('.mapeo-input');
        const promesas = [];

        inputs.forEach(input => {
            promesas.push(fetchAPI('/mapeos', {
                method: 'POST',
                body: {
                    canalId,
                    canalNombre,
                    campoInterno: input.dataset.campoInterno,
                    nombresExternos: input.value
                }
            }));
        });

        try {
            await Promise.all(promesas);
            alert(`Mapeo para "${canalNombre}" guardado con éxito.`);
            mapeos = await fetchAPI('/mapeos');
            renderTablaMapeos();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });

    mapeosTbody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        const mapeo = mapeos.find(m => m.id === id);
        if (!mapeo) return;

        if (target.classList.contains('edit-btn')) {
            renderizarFormulario(mapeo.canalId);
            window.scrollTo(0, 0);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm(`¿Seguro que quieres eliminar el mapeo para "${mapeo.campoInterno}" en el canal "${mapeo.canalNombre}"?`)) {
                try {
                    await fetchAPI(`/mapeos/${id}`, { method: 'DELETE' });
                    mapeos = await fetchAPI('/mapeos');
                    renderTablaMapeos();
                    // Limpiar el formulario si se borra un mapeo del canal seleccionado
                    if (canalSelect.value === mapeo.canalId) {
                        canalSelect.dispatchEvent(new Event('change'));
                    }
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}