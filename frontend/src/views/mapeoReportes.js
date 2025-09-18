import { fetchAPI } from '../api.js';

let mapeos = [];
let canales = [];

// Lista de campos internos que necesitamos mapear
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

// --- Lógica de la Vista ---
function renderizarFormulario() {
    const canalSelect = document.getElementById('canal-select');
    const mapeoFieldsContainer = document.getElementById('mapeo-fields');
    if (!canalSelect || !mapeoFieldsContainer) return;

    canalSelect.innerHTML = `<option value="">Seleccione un canal</option>` + 
        canales.map(c => `<option value="${c.id}" data-nombre="${c.nombre}">${c.nombre}</option>`).join('');

    canalSelect.addEventListener('change', () => {
        const canalId = canalSelect.value;
        if (!canalId) {
            mapeoFieldsContainer.innerHTML = '';
            return;
        }

        mapeoFieldsContainer.innerHTML = camposInternos.map(campo => {
            const mapeoExistente = mapeos.find(m => m.canalId === canalId && m.campoInterno === campo.id);
            const nombresExternos = mapeoExistente ? mapeoExistente.nombresExternos.join(', ') : '';
            return `
                <div class="grid grid-cols-2 gap-4 items-center">
                    <label for="campo-${campo.id}" class="text-sm font-medium text-gray-700 justify-self-end">${campo.nombre}:</label>
                    <input type="text" id="campo-${campo.id}" data-campo-interno="${campo.id}" 
                           value="${nombresExternos}"
                           placeholder="Ej: Check-in, Fecha Llegada, Arrival Date"
                           class="form-input mapeo-input">
                </div>
            `;
        }).join('');
    });
}

// --- Lógica Principal de la Vista ---
export async function render() {
    try {
        [mapeos, canales] = await Promise.all([
            fetchAPI('/mapeos'),
            fetchAPI('/canales')
        ]);
    } catch (error) {
        console.error("Error al cargar datos para mapeo:", error);
        return `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <strong class="font-bold">Error al cargar los datos.</strong>
                    <span class="block sm:inline">No se pudo comunicar con el servidor. Es posible que falte un índice en Firestore.</span>
                    <p class="text-xs mt-2 font-mono">${error.message}</p>
                </div>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">Mapeo de Columnas de Reportes por Canal</h2>
            <p class="text-gray-600 mb-6">
                Para cada canal, define los posibles nombres de columna que pueden aparecer en sus reportes. 
                Esto permite al sistema encontrar los datos correctos sin importar el idioma o el formato del archivo.
                Separa los diferentes nombres con comas.
            </p>
            
            <div id="mapeo-container" class="space-y-6">
                <div>
                    <label for="canal-select" class="block text-lg font-medium text-gray-800">1. Selecciona un Canal</label>
                    <select id="canal-select" class="mt-2 form-select w-full md:w-1/3"></select>
                </div>

                <div id="mapeo-fields" class="space-y-3 border-t pt-6">
                    </div>

                <div class="flex justify-end pt-6 border-t">
                    <button id="guardar-mapeo-btn" class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                        Guardar Mapeo para este Canal
                    </button>
                </div>
            </div>
        </div>
    `;
}

export function afterRender() {
    // Si el render falló, los elementos no existirán. Hacemos una comprobación.
    const container = document.getElementById('mapeo-container');
    if (!container) return; 

    renderizarFormulario();

    document.getElementById('guardar-mapeo-btn').addEventListener('click', async () => {
        const canalSelect = document.getElementById('canal-select');
        const canalId = canalSelect.value;
        const canalNombre = canalSelect.options[canalSelect.selectedIndex].dataset.nombre;

        if (!canalId) {
            alert('Por favor, selecciona un canal antes de guardar.');
            return;
        }

        const inputs = document.querySelectorAll('.mapeo-input');
        const promesas = [];

        inputs.forEach(input => {
            const campoInterno = input.dataset.campoInterno;
            const nombresExternos = input.value;

            if (nombresExternos.trim()) {
                const datos = {
                    canalId,
                    canalNombre,
                    campoInterno,
                    nombresExternos
                };
                promesas.push(fetchAPI('/mapeos', { method: 'POST', body: datos }));
            }
        });

        try {
            await Promise.all(promesas);
            alert(`Mapeo para el canal "${canalNombre}" guardado con éxito.`);
            mapeos = await fetchAPI('/mapeos');
        } catch (error) {
            alert(`Error al guardar el mapeo: ${error.message}`);
        }
    });
}