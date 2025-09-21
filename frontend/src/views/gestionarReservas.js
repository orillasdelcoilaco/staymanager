import { fetchAPI } from '../api.js';

let todasLasReservas = [];
let clientes = [];

// Función para buscar el nombre de un cliente por su ID
function obtenerCliente(clienteId) {
    return clientes.find(c => c.id === clienteId) || {};
}

// Lógica de la Tabla y Búsqueda
function renderTabla(filtro = '') {
    const tbody = document.getElementById('reservas-tbody');
    if (!tbody) return;

    const filtroLowerCase = filtro.toLowerCase();
    const reservasFiltradas = todasLasReservas.filter(r => {
        const cliente = obtenerCliente(r.clienteId);
        return (
            (cliente.nombre && cliente.nombre.toLowerCase().includes(filtroLowerCase)) ||
            (r.alojamientoNombre && r.alojamientoNombre.toLowerCase().includes(filtroLowerCase)) ||
            (r.idReservaCanal && r.idReservaCanal.toLowerCase().includes(filtroLowerCase)) ||
            (r.telefono && r.telefono.includes(filtroLowerCase))
        );
    });

    if (reservasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-gray-500 py-4">No se encontraron reservas.</td></tr>';
        return;
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Fecha inválida';
        }
        return date.toLocaleDateString('es-CL', { timeZone: 'UTC' });
    };

    tbody.innerHTML = reservasFiltradas.map(r => {
        const cliente = obtenerCliente(r.clienteId);
        return `
        <tr class="border-b">
            <td class="py-3 px-4">${cliente.nombre || 'Cliente no encontrado'}</td>
            <td class="py-3 px-4">${r.telefono || 'N/A'}</td>
            <td class="py-3 px-4">${r.idReservaCanal}</td>
            <td class="py-3 px-4">${r.alojamientoNombre}</td>
            <td class="py-3 px-4">${r.canalNombre}</td>
            <td class="py-3 px-4">${formatDate(r.fechaLlegada)}</td>
            <td class="py-3 px-4">${formatDate(r.fechaSalida)}</td>
            <td class="py-3 px-4">${r.estado}</td>
            <td class="py-3 px-4">
                <button data-id="${r.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Editar</button>
                <button data-id="${r.id}" class="delete-btn text-red-600 hover:text-red-800 text-sm font-medium">Eliminar</button>
            </td>
        </tr>
    `}).join('');
}

// Lógica Principal de la Vista
export async function render() {
    try {
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
                    <input type="text" id="search-input" placeholder="Buscar por cliente, teléfono, ID de reserva..." class="form-input w-full">
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="th">Cliente</th>
                            <th class="th">Teléfono</th>
                            <th class="th">ID Reserva</th>
                            <th class="th">Alojamiento</th>
                            <th class="th">Canal</th>
                            <th class="th">Llegada</th>
                            <th class="th">Salida</th>
                            <th class="th">Estado</th>
                            <th class="th">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="reservas-tbody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export function afterRender() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    renderTabla();
    searchInput.addEventListener('input', (e) => renderTabla(e.target.value));

    // Event listeners para los botones de acción (a implementar en el futuro)
    document.getElementById('reservas-tbody').addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('edit-btn')) {
            // Lógica para editar
            alert(`Funcionalidad de editar para la reserva ${id} se implementará a continuación.`);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar esta reserva? Esta acción no se puede deshacer.')) {
                try {
                    await fetchAPI(`/reservas/${id}`, { method: 'DELETE' });
                    todasLasReservas = todasLasReservas.filter(r => r.id !== id);
                    renderTabla(searchInput.value);
                } catch (error) {
                    alert(`Error al eliminar la reserva: ${error.message}`);
                }
            }
        }
    });
}