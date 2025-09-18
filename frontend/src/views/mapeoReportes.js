import { fetchAPI } from '../api.js';

let mapeos = [];
let canales = [];
let canalSiendoEditado = null;

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

// --- Lógica del Modal de Edición ---
function abrirModal(canal) {
    canalSiendoEditado = canal;
    const modal = document.getElementById('mapeo-modal');
    const modalTitle = document.getElementById('modal-title');
    const fieldsContainer = document.getElementById('mapeo-fields-modal');

    if (!modal || !modalTitle || !fieldsContainer) return;

    modalTitle.textContent = `Editando Mapeos para: ${canal.nombre}`;
    
    const mapeosDelCanal = mapeos.filter(m => m.canalId === canal.id);

    fieldsContainer.innerHTML = camposInternos.map(campo => {
        const mapeoExistente = mapeosDelCanal.find(m => m.campoInterno === campo.id);
        const nombresExternos = mapeoExistente ? mapeoExistente.nombresExternos.join(', ') : '';
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <label for="modal-campo-${campo.id}" class="text-sm font-medium text-gray-700 md:justify-self-end">${campo.nombre}:</label>
                <input type="text" id="modal-campo-${campo.id}" data-campo-interno="${campo.id}" 
                       value="${nombresExternos}"
                       placeholder="Ej: Check-in, Fecha Llegada, Arrival Date"
                       class="form-input mapeo-input-modal">
            </div>
        `;
    }).join('');

    modal.classList.remove('hidden');
}

function cerrarModal() {
    const modal = document.getElementById('mapeo-modal');
    if (modal) modal.classList.add('hidden');
    canalSiendoEditado = null;
}

// --- Lógica de la Tabla Principal de Canales ---
function renderTablaCanales() {
    const tbody = document.getElementById('canales-mapeo-tbody');
    if (!tbody) return;

    tbody.innerHTML = canales.map(c => `
        <tr class="border-b">
            <td class="py-3 px-4 font-medium">${c.nombre}</td>
            <td class="py-3 px-4 text-center">
                <button data-id="${c.id}" class="edit-btn px-4 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm font-medium">
                    Editar Mapeos
                </button>
            </td>
        </tr>
    `).join('');
}

// --- Lógica Principal de la Vista ---
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
        <div class="bg-white p-8 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">Mapeo de Columnas de Reportes</h2>
            <p class="text-gray-600 mb-6">
                Selecciona un canal para configurar las reglas que usará el sistema para leer los reportes de reservas.
            </p>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th">Canal de Venta</th>
                            <th class="th text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="canales-mapeo-tbody"></tbody>
                </table>
            </div>
        </div>

        <div id="mapeo-modal" class="modal hidden">
            <div class="modal-content !max-w-3xl">
                <div class="flex justify-between items-center pb-3 border-b mb-4">
                    <h3 id="modal-title" class="text-xl font-semibold"></h3>
                    <button id="close-modal-btn" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
                </div>
                <div id="mapeo-fields-modal" class="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
                    </div>
                <div class="flex justify-end pt-4 mt-4 border-t">
                    <button type="button" id="cancel-btn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md mr-2 hover:bg-gray-300">Cancelar</button>
                    <button type="button" id="guardar-mapeo-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Guardar Cambios</button>
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    const canalesTbody = document.getElementById('canales-mapeo-tbody');
    if (!canalesTbody) return;

    renderTablaCanales();

    document.getElementById('close-modal-btn').addEventListener('click', cerrarModal);
    document.getElementById('cancel-btn').addEventListener('click', cerrarModal);

    // Event listener para los botones "Editar" de la tabla principal
    canalesTbody.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('edit-btn')) {
            const canalId = target.dataset.id;
            const canal = canales.find(c => c.id === canalId);
            if (canal) {
                abrirModal(canal);
            }
        }
    });

    // Event listener para el botón de guardar dentro del modal
    document.getElementById('guardar-mapeo-btn').addEventListener('click', async () => {
        if (!canalSiendoEditado) return;

        const inputs = document.querySelectorAll('.mapeo-input-modal');
        const promesas = [];

        inputs.forEach(input => {
            promesas.push(fetchAPI('/mapeos', {
                method: 'POST',
                body: {
                    canalId: canalSiendoEditado.id,
                    canalNombre: canalSiendoEditado.nombre,
                    campoInterno: input.dataset.campoInterno,
                    nombresExternos: input.value
                }
            }));
        });

        try {
            await Promise.all(promesas);
            alert(`Mapeo para "${canalSiendoEditado.nombre}" guardado con éxito.`);
            mapeos = await fetchAPI('/mapeos'); // Actualizamos los mapeos locales
            cerrarModal();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    });
}