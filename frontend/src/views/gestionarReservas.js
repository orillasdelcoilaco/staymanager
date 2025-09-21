import { fetchAPI } from '../api.js';

let todasLasReservas = [];
let clientes = [];

// --- NUEVA FUNCIÓN --- para normalizar la visualización de teléfonos
function formatTelefono(telefono) {
    if (!telefono) return 'N/A';
    // Elimina todo lo que no sea un dígito
    const digitos = telefono.toString().replace(/\D/g, '');
    
    // Maneja casos comunes de números chilenos
    if (digitos.startsWith('569') && digitos.length === 11) {
        return digitos;
    }
    if (digitos.length === 9 && digitos.startsWith('9')) {
        return `56${digitos}`;
    }
    if (digitos.length === 8) { // Asume que falta el 9
        return `569${digitos}`;
    }
    // Devuelve el número limpio si no coincide con los patrones
    return digitos || 'N/A';
}

function obtenerCliente(clienteId) {
    return clientes.find(c => c.id === clienteId) || {};
}

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
            return 'Inválida';
        }
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    };
    
    // --- MODIFICADO --- Se aplica la clase text-xs para reducir tamaño de letra
    // Se reduce el padding (py-2 px-3) para una tabla más compacta
    // Se llama a la nueva función formatTelefono
    tbody.innerHTML = reservasFiltradas.map(r => {
        const cliente = obtenerCliente(r.clienteId);
        return `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3">${cliente.nombre || 'Cliente no encontrado'}</td>
            <td class="py-2 px-3 font-mono">${formatTelefono(r.telefono)}</td>
            <td class="py-2 px-3">${r.idReservaCanal}</td>
            <td class="py-2 px-3">${r.alojamientoNombre}</td>
            <td class="py-2 px-3">${r.canalNombre}</td>
            <td class="py-2 px-3 whitespace-nowrap">${formatDate(r.fechaLlegada)}</td>
            <td class="py-2 px-3 whitespace-nowrap">${formatDate(r.fechaSalida)}</td>
            <td class="py-2 px-3">${r.estado}</td>
            <td class="py-2 px-3 whitespace-nowrap">
                <button data-id="${r.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 font-medium">Editar</button>
                <button data-id="${r.id}" class="delete-btn text-red-600 hover:text-red-800 font-medium ml-2">Eliminar</button>
            </td>
        </tr>
    `}).join('');
}

export async function render() {
    try {
        [todasLasReservas, clientes] = await Promise.all([
            fetchAPI('/reservas'),
            fetchAPI('/clientes')
        ]);
    } catch (error) {
        return `<p class="text-red-500">Error al cargar las reservas. Por favor, intente de nuevo.</p>`;
    }

    // --- MODIFICADO --- Se cambia el texto de los encabezados para ser más cortos y claros
    // Se reduce el padding en la clase 'th' (definida en style.css, pero aquí se controla el texto)
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
                            <th class="th text-xs py-2 px-3">Cliente</th>
                            <th class="th text-xs py-2 px-3">Teléfono</th>
                            <th class="th text-xs py-2 px-3">ID Canal</th>
                            <th class="th text-xs py-2 px-3">Alojamiento</th>
                            <th class="th text-xs py-2 px-3">Canal</th>
                            <th class="th text-xs py-2 px-3">Check-in</th>
                            <th class="th text-xs py-2 px-3">Check-out</th>
                            <th class="th text-xs py-2 px-3">Estado</th>
                            <th class="th text-xs py-2 px-3">Acciones</th>
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

    document.getElementById('reservas-tbody').addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('edit-btn')) {
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