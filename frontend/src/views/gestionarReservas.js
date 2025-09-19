import { fetchAPI } from '../api.js';

let todasLasReservas = [];
let clientes = [];

// Función para buscar el nombre de un cliente por su ID
function obtenerNombreCliente(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nombre : 'Cliente no encontrado';
}

// Lógica de la Tabla y Búsqueda
function renderTabla(filtro = '') {
    const tbody = document.getElementById('reservas-tbody');
    if (!tbody) return;

    const filtroLowerCase = filtro.toLowerCase();
    const reservasFiltradas = todasLasReservas.filter(r => 
        obtenerNombreCliente(r.clienteId).toLowerCase().includes(filtroLowerCase) ||
        r.alojamientoNombre.toLowerCase().includes(filtroLowerCase) ||
        r.idReservaCanal.toLowerCase().includes(filtroLowerCase)
    );

    if (reservasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-4">No se encontraron reservas.</td></tr>';
        return;
    }

    tbody.innerHTML = reservasFiltradas.map(r => `
        <tr class="border-b">
            <td class="py-3 px-4">${obtenerNombreCliente(r.clienteId)}</td>
            <td class="py-3 px-4">${r.alojamientoNombre}</td>
            <td class="py-3 px-4">${r.canalNombre}</td>
            <td class="py-3 px-4">${r.fechaLlegada ? new Date(r.fechaLlegada).toLocaleDateString() : '-'}</td>
            <td class="py-3 px-4">${r.fechaSalida ? new Date(r.fechaSalida).toLocaleDateString() : '-'}</td>
            <td class="py-3 px-4 text-center">${r.totalNoches}</td>
            <td class="py-3 px-4 text-center">${r.cantidadHuespedes}</td>
            <td class="py-3 px-4">${r.estado}</td>
        </tr>
    `).join('');
}

// Lógica Principal de la Vista
export async function render() {
    try {
        // Obtenemos tanto las reservas como los clientes para poder cruzar los datos
        [todasLasReservas, clientes] = await Promise.all([
            fetchAPI('/reservas'),
            fetchAPI('/clientes')
        ]);
    } catch (error) {
        return `<p class="text-red-500">Error al cargar las reservas. Por favor, intente de nuevo.</p>`;
    }

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Reservas</h2>
                <div class="w-full md:w-1/2">
                    <input type="text" id="search-input" placeholder="Buscar por cliente, alojamiento o ID de reserva..." class="form-input w-full">
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th">Cliente</th>
                            <th class="th">Alojamiento</th>
                            <th class="th">Canal</th>
                            <th class="th">Llegada</th>
                            <th class="th">Salida</th>
                            <th class="th">Noches</th>
                            <th class="th">Huéspedes</th>
                            <th class="th">Estado</th>
                        </tr>
                    </thead>
                    <tbody id="reservas-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export function afterRender() {
    // Si el render falló, el input no existirá
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    renderTabla();
    searchInput.addEventListener('input', (e) => renderTabla(e.target.value));
}