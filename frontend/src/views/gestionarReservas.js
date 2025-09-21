import { fetchAPI } from '../api.js';

let todasLasReservas = [];
let clientes = [];
let alojamientos = [];
let editandoReserva = null;

function formatTelefono(telefono) {
    if (!telefono) return 'N/A';
    const digitos = telefono.toString().replace(/\D/g, '');
    if (digitos.startsWith('569') && digitos.length === 11) return digitos;
    if (digitos.length === 9 && digitos.startsWith('9')) return `56${digitos}`;
    if (digitos.length === 8) return `569${digitos}`;
    return digitos || 'N/A';
}

function abrirModalEditar(reserva) {
    editandoReserva = reserva;
    const modal = document.getElementById('reserva-modal-edit');
    const form = document.getElementById('reserva-form-edit');
    if (!modal || !form) return;

    document.getElementById('modal-title').textContent = `Editar Reserva: ${reserva.idReservaCanal}`;

    // Poblar selects
    document.getElementById('cliente-select').innerHTML = clientes.map(c => `<option value="${c.id}" ${c.id === reserva.clienteId ? 'selected' : ''}>${c.nombre}</option>`).join('');
    document.getElementById('alojamiento-select').innerHTML = alojamientos.map(a => `<option value="${a.id}" ${a.id === reserva.alojamientoId ? 'selected' : ''}>${a.nombre}</option>`).join('');

    const toInputDate = (isoDate) => isoDate ? isoDate.split('T')[0] : '';
    form.fechaLlegada.value = toInputDate(reserva.fechaLlegada);
    form.fechaSalida.value = toInputDate(reserva.fechaSalida);
    form.estado.value = reserva.estado;
    
    modal.classList.remove('hidden');
}

function cerrarModalEditar() {
    document.getElementById('reserva-modal-edit').classList.add('hidden');
    editandoReserva = null;
}

function renderTabla(filtro = '') {
    const tbody = document.getElementById('reservas-tbody');
    if (!tbody) return;

    const filtroLowerCase = filtro.toLowerCase();
    const reservasFiltradas = todasLasReservas.filter(r => 
        (r.nombreCliente && r.nombreCliente.toLowerCase().includes(filtroLowerCase)) ||
        (r.alojamientoNombre && r.alojamientoNombre.toLowerCase().includes(filtroLowerCase)) ||
        (r.idReservaCanal && r.idReservaCanal.toLowerCase().includes(filtroLowerCase)) ||
        (r.telefono && r.telefono.includes(filtroLowerCase))
    );

    if (reservasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-gray-500 py-4">No se encontraron reservas.</td></tr>';
        return;
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'No definida';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    };

    const lapiz = '✏️';
    tbody.innerHTML = reservasFiltradas.map(r => {
        const ediciones = r.edicionesManuales || {};
        return `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3">${ediciones.clienteId ? lapiz : ''} ${r.nombreCliente}</td>
            <td class="py-2 px-3 font-mono">${r.telefono}</td>
            <td class="py-2 px-3">${r.idReservaCanal}</td>
            <td class="py-2 px-3">${ediciones.alojamientoId ? lapiz : ''} ${r.alojamientoNombre}</td>
            <td class="py-2 px-3">${r.canalNombre}</td>
            <td class="py-2 px-3 whitespace-nowrap">${ediciones.fechaLlegada ? lapiz : ''} ${formatDate(r.fechaLlegada)}</td>
            <td class="py-2 px-3 whitespace-nowrap">${ediciones.fechaSalida ? lapiz : ''} ${formatDate(r.fechaSalida)}</td>
            <td class="py-2 px-3">${ediciones.estado ? lapiz : ''} ${r.estado}</td>
            <td class="py-2 px-3 whitespace-nowrap">
                <button data-id="${r.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 font-medium">Editar</button>
                <button data-id="${r.id}" class="delete-btn text-red-600 hover:text-red-800 font-medium ml-2">Eliminar</button>
            </td>
        </tr>
    `}).join('');
}

export async function render() {
    try {
        [todasLasReservas, clientes, alojamientos] = await Promise.all([
            fetchAPI('/reservas'),
            fetchAPI('/clientes'),
            fetchAPI('/propiedades')
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

        <div id="reserva-modal-edit" class="modal hidden">
             <div class="modal-content">
                <h3 id="modal-title" class="text-xl font-semibold mb-4">Editar Reserva</h3>
                <form id="reserva-form-edit" class="space-y-4">
                    <div>
                        <label for="cliente-select" class="block text-sm font-medium text-gray-700">Cliente</label>
                        <select id="cliente-select" name="clienteId" class="mt-1 form-select"></select>
                    </div>
                     <div>
                        <label for="alojamiento-select" class="block text-sm font-medium text-gray-700">Alojamiento</label>
                        <select id="alojamiento-select" name="alojamientoId" class="mt-1 form-select"></select>
                    </div>
                    <div>
                        <label for="fechaLlegada" class="block text-sm font-medium text-gray-700">Fecha Llegada</label>
                        <input type="date" name="fechaLlegada" class="mt-1 form-input">
                    </div>
                     <div>
                        <label for="fechaSalida" class="block text-sm font-medium text-gray-700">Fecha Salida</label>
                        <input type="date" name="fechaSalida" class="mt-1 form-input">
                    </div>
                     <div>
                        <label for="estado" class="block text-sm font-medium text-gray-700">Estado</label>
                        <select name="estado" class="mt-1 form-select">
                            <option value="Confirmada">Confirmada</option>
                            <option value="Cancelada">Cancelada</option>
                            <option value="Pendiente">Pendiente</option>
                        </select>
                    </div>
                    <div class="flex justify-end pt-4 border-t">
                        <button type="button" id="cancel-edit-btn" class="btn-secondary">Cancelar</button>
                        <button type="submit" class="btn-primary ml-2">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

export function afterRender() {
    const searchInput = document.getElementById('search-input');
    const tbody = document.getElementById('reservas-tbody');
    const formEdit = document.getElementById('reserva-form-edit');
    
    renderTabla();
    
    searchInput.addEventListener('input', (e) => renderTabla(e.target.value));
    document.getElementById('cancel-edit-btn').addEventListener('click', cerrarModalEditar);

    tbody.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;
        
        const reserva = todasLasReservas.find(r => r.id === id);
        if (!reserva) return;

        if (target.classList.contains('edit-btn')) {
            abrirModalEditar(reserva);
        }

        if (target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar esta reserva?')) {
                try {
                    await fetchAPI(`/reservas/${id}`, { method: 'DELETE' });
                    todasLasReservas = todasLasReservas.filter(r => r.id !== id);
                    renderTabla(searchInput.value);
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });

    formEdit.addEventListener('submit', async(e) => {
        e.preventDefault();
        if (!editandoReserva) return;

        const alojamientoSelect = formEdit.querySelector('#alojamiento-select');
        const clienteSelect = formEdit.querySelector('#cliente-select');

        const datos = {
            clienteId: clienteSelect.value,
            alojamientoId: alojamientoSelect.value,
            alojamientoNombre: alojamientoSelect.options[alojamientoSelect.selectedIndex].text,
            fechaLlegada: formEdit.fechaLlegada.value ? new Date(formEdit.fechaLlegada.value) : null,
            fechaSalida: formEdit.fechaSalida.value ? new Date(formEdit.fechaSalida.value) : null,
            estado: formEdit.estado.value,
        };
        
        try {
            await fetchAPI(`/reservas/${editandoReserva.id}`, { method: 'PUT', body: datos });
            todasLasReservas = await fetchAPI('/reservas');
            renderTabla(searchInput.value);
            cerrarModalEditar();
        } catch (error) {
            alert(`Error al guardar los cambios: ${error.message}`);
        }
    });
}