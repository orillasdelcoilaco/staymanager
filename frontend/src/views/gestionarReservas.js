import { fetchAPI } from '../api.js';

let todasLasReservas = [];
let clientes = [];
let alojamientos = [];
let editandoReserva = null;

function toggleDolarFields() {
    const form = document.getElementById('reserva-form-edit');
    const moneda = form.moneda.value;
    const dolarContainer = document.getElementById('dolar-container');
    const valorTotalInput = form.valorTotal;

    if (moneda === 'USD') {
        dolarContainer.style.display = 'grid';
        valorTotalInput.readOnly = true;
        valorTotalInput.classList.add('bg-gray-100');
    } else {
        dolarContainer.style.display = 'none';
        valorTotalInput.readOnly = false;
        valorTotalInput.classList.remove('bg-gray-100');
    }
}

function calcularValorFinal() {
    const form = document.getElementById('reserva-form-edit');
    if (form.moneda.value === 'USD') {
        const valorOriginal = parseFloat(form.valorOriginal.value) || 0;
        const valorDolar = parseFloat(form.valorDolarDia.value) || 0;
        form.valorTotal.value = (valorOriginal * valorDolar).toFixed(0);
    }
}

async function abrirModalEditar(reservaId) {
    const modal = document.getElementById('reserva-modal-edit');
    const form = document.getElementById('reserva-form-edit');
    if (!modal || !form) return;

    try {
        editandoReserva = await fetchAPI(`/reservas/${reservaId}`);
        
        document.getElementById('modal-title').textContent = `Editar Reserva: ${editandoReserva.idReservaCanal}`;

        document.getElementById('cliente-select').innerHTML = clientes.map(c => `<option value="${c.id}" ${c.id === editandoReserva.clienteId ? 'selected' : ''}>${c.nombre}</option>`).join('');
        document.getElementById('alojamiento-select').innerHTML = alojamientos.map(a => `<option value="${a.id}" ${a.id === editandoReserva.alojamientoId ? 'selected' : ''}>${a.nombre}</option>`).join('');

        form.idReservaCanal.value = editandoReserva.idReservaCanal || '';
        form.fechaLlegada.value = editandoReserva.fechaLlegada;
        form.fechaSalida.value = editandoReserva.fechaSalida;
        form.estado.value = editandoReserva.estado;
        form.moneda.value = editandoReserva.moneda || 'CLP';
        form.valorOriginal.value = editandoReserva.valores?.valorOriginal || 0;
        form.valorTotal.value = editandoReserva.valores?.valorTotal || 0;
        form.valorDolarDia.value = editandoReserva.valorDolarDia || '';
        form.cantidadHuespedes.value = editandoReserva.cantidadHuespedes || 0;

        toggleDolarFields();
        modal.classList.remove('hidden');
    } catch (error) {
        alert(`Error al cargar los detalles de la reserva: ${error.message}`);
    }
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
        (r.nombreCliente?.toLowerCase().includes(filtroLowerCase)) ||
        (r.alojamientoNombre?.toLowerCase().includes(filtroLowerCase)) ||
        (r.idReservaCanal?.toLowerCase().includes(filtroLowerCase)) ||
        (r.telefono?.includes(filtroLowerCase))
    );

    if (reservasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-gray-500 py-4">No se encontraron reservas.</td></tr>';
        return;
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'No definida';
        return new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    };

    const lapiz = '✏️';
    tbody.innerHTML = reservasFiltradas.map(r => {
        const e = r.edicionesManuales || {};
        return `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3">${e.clienteId ? lapiz : ''} ${r.nombreCliente}</td>
            <td class="py-2 px-3 font-mono">${r.telefono}</td>
            <td class="py-2 px-3">${e.idReservaCanal ? lapiz : ''} ${r.idReservaCanal}</td>
            <td class="py-2 px-3">${e.alojamientoId ? lapiz : ''} ${r.alojamientoNombre}</td>
            <td class="py-2 px-3">${e.canalNombre ? lapiz : ''} ${r.canalNombre}</td>
            <td class="py-2 px-3 whitespace-nowrap">${e.fechaLlegada ? lapiz : ''} ${formatDate(r.fechaLlegada)}</td>
            <td class="py-2 px-3 whitespace-nowrap">${e.fechaSalida ? lapiz : ''} ${formatDate(r.fechaSalida)}</td>
            <td class="py-2 px-3">${e.estado ? lapiz : ''} ${r.estado}</td>
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
                <div class="w-full md:w-1/2"><input type="text" id="search-input" placeholder="Buscar por cliente, teléfono, ID de reserva..." class="form-input w-full"></div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white"><thead class="bg-gray-50"><tr>
                    <th class="th text-xs py-2 px-3">Cliente</th><th class="th text-xs py-2 px-3">Teléfono</th>
                    <th class="th text-xs py-2 px-3">ID Canal</th><th class="th text-xs py-2 px-3">Alojamiento</th>
                    <th class="th text-xs py-2 px-3">Canal</th><th class="th text-xs py-2 px-3">Check-in</th>
                    <th class="th text-xs py-2 px-3">Check-out</th><th class="th text-xs py-2 px-3">Estado</th>
                    <th class="th text-xs py-2 px-3">Acciones</th>
                </tr></thead><tbody id="reservas-tbody"></tbody></table>
            </div>
        </div>

        <div id="reserva-modal-edit" class="modal hidden"><div class="modal-content !max-w-4xl">
            <h3 id="modal-title" class="text-xl font-semibold mb-4">Editar Reserva</h3>
            <form id="reserva-form-edit" class="space-y-6 max-h-[75vh] overflow-y-auto pr-4">
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Datos de la Reserva</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="idReservaCanal" class="label">ID Reserva Canal</label><input type="text" name="idReservaCanal" class="form-input"></div>
                        <div><label for="alojamiento-select" class="label">Alojamiento</label><select id="alojamiento-select" name="alojamientoId" class="form-select"></select></div>
                        <div><label for="estado" class="label">Estado</label><select name="estado" class="form-select"><option value="Confirmada">Confirmada</option><option value="Cancelada">Cancelada</option><option value="Pendiente">Pendiente</option></select></div>
                    </div>
                </fieldset>
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Fechas</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="fechaLlegada" class="label">Fecha Llegada</label><input type="date" name="fechaLlegada" class="form-input"></div>
                        <div><label for="fechaSalida" class="label">Fecha Salida</label><input type="date" name="fechaSalida" class="form-input"></div>
                    </div>
                </fieldset>
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Montos</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label for="moneda" class="label">Moneda Original</label><select name="moneda" class="form-select"><option value="CLP">CLP</option><option value="USD">USD</option></select></div>
                        <div><label for="valorOriginal" class="label">Valor Original</label><input type="number" step="0.01" name="valorOriginal" class="form-input"></div>
                        <div id="dolar-container" class="hidden"><label for="valorDolarDia" class="label">Valor Dólar del Día</label><input type="number" step="0.01" name="valorDolarDia" class="form-input"></div>
                    </div>
                     <div class="mt-4"><label for="valorTotal" class="label">Valor Final (CLP)</label><input type="number" name="valorTotal" class="form-input"></div>
                </fieldset>
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Cliente y Huéspedes</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="cliente-select" class="label">Cliente</label><select id="cliente-select" name="clienteId" class="form-select"></select></div>
                        <div><label for="cantidadHuespedes" class="label">Nº Huéspedes</label><input type="number" name="cantidadHuespedes" class="form-input"></div>
                    </div>
                </fieldset>
                <div class="flex justify-end pt-4 border-t">
                    <button type="button" id="cancel-edit-btn" class="btn-secondary">Cancelar</button>
                    <button type="submit" class="btn-primary ml-2">Guardar Cambios</button>
                </div>
            </form>
        </div></div>
    `;
}

export function afterRender() {
    const searchInput = document.getElementById('search-input');
    const tbody = document.getElementById('reservas-tbody');
    const formEdit = document.getElementById('reserva-form-edit');
    
    renderTabla();
    
    searchInput.addEventListener('input', (e) => renderTabla(e.target.value));
    document.getElementById('cancel-edit-btn').addEventListener('click', cerrarModalEditar);

    formEdit.moneda.addEventListener('change', () => {
        toggleDolarFields();
        calcularValorFinal();
    });
    formEdit.valorOriginal.addEventListener('input', calcularValorFinal);
    formEdit.valorDolarDia.addEventListener('input', calcularValorFinal);

    tbody.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;
        if (e.target.classList.contains('edit-btn')) abrirModalEditar(id);
        if (e.target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar esta reserva? Esta acción no se puede deshacer.')) {
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
        const datos = {
            idReservaCanal: formEdit.idReservaCanal.value,
            clienteId: formEdit.clienteId.value,
            alojamientoId: formEdit.alojamientoId.value,
            fechaLlegada: formEdit.fechaLlegada.value,
            fechaSalida: formEdit.fechaSalida.value,
            estado: formEdit.estado.value,
            moneda: formEdit.moneda.value,
            cantidadHuespedes: parseInt(formEdit.cantidadHuespedes.value) || 0,
            valorDolarDia: parseFloat(formEdit.valorDolarDia.value) || null,
            valores: {
                valorOriginal: parseFloat(formEdit.valorOriginal.value) || 0,
                valorTotal: parseFloat(formEdit.valorTotal.value) || 0,
            }
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