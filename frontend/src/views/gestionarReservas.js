import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let todasLasReservas = [];
let historialCargas = [];
let editandoReserva = null;
let clienteOriginal = null;

// ... (Las funciones del modal como toggleDolarFields, abrirModalEditar, etc. no cambian)
function toggleDolarFields() {
    const form = document.getElementById('reserva-form-edit');
    const moneda = form.moneda.value;
    const dolarContainer = document.getElementById('dolar-container');
    const valorTotalInput = form.valorTotal;
    const valorOriginalInput = form.valorOriginal;

    valorOriginalInput.step = moneda === 'USD' ? '0.01' : '1';

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
        form.valorTotal.value = Math.round(valorOriginal * valorDolar);
    }
}

async function abrirModalEditar(reservaId) {
    const modal = document.getElementById('reserva-modal-edit');
    const form = document.getElementById('reserva-form-edit');
    if (!modal || !form) return;

    try {
        editandoReserva = await fetchAPI(`/reservas/${reservaId}`);
        clienteOriginal = { ...editandoReserva.cliente };
        
        document.getElementById('modal-title').textContent = `Editar Reserva: ${editandoReserva.idReservaCanal}`;
        
        const alojamientos = await fetchAPI('/propiedades');
        document.getElementById('alojamiento-select').innerHTML = alojamientos.map(a => `<option value="${a.id}" ${a.id === editandoReserva.alojamientoId ? 'selected' : ''}>${a.nombre}</option>`).join('');

        form.idReservaCanal.value = editandoReserva.idReservaCanal || '';
        form.estado.value = editandoReserva.estado;
        form.fechaLlegada.value = editandoReserva.fechaLlegada;
        form.fechaSalida.value = editandoReserva.fechaSalida;
        form.moneda.value = editandoReserva.moneda || 'CLP';
        form.valorOriginal.value = editandoReserva.valores?.valorOriginal || 0;
        form.valorTotal.value = editandoReserva.valores?.valorTotal || 0;
        form.valorDolarDia.value = editandoReserva.valorDolarDia || '';
        form.nombreCliente.value = editandoReserva.cliente.nombre || '';
        form.telefonoCliente.value = editandoReserva.cliente.telefono || '';
        form.emailCliente.value = editandoReserva.cliente.email || '';
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
    clienteOriginal = null;
}


function renderTabla(filtros) {
    const tbody = document.getElementById('reservas-tbody');
    if (!tbody) return;
    
    const filtroLowerCase = filtros.busqueda.toLowerCase();
    
    const reservasFiltradas = todasLasReservas.filter(r => {
        const busquedaMatch = (r.nombreCliente?.toLowerCase().includes(filtroLowerCase)) ||
                              (r.alojamientoNombre?.toLowerCase().includes(filtroLowerCase)) ||
                              (r.idReservaCanal?.toLowerCase().includes(filtroLowerCase));
        
        const cargaMatch = !filtros.carga || r.idCarga === filtros.carga;

        return busquedaMatch && cargaMatch;
    });

    if (reservasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-gray-500 py-4">No se encontraron reservas.</td></tr>';
        return;
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    };
    
    const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

    tbody.innerHTML = reservasFiltradas.map(r => {
        const reporte = historialCargas.find(h => h.id === r.idCarga);
        const idNumericoCarga = reporte ? reporte.idNumerico : 'N/A';

        return `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3 font-mono">${r.idReservaCanal}</td>
            <td class="py-2 px-3 font-mono text-center font-bold">${idNumericoCarga}</td>
            <td class="py-2 px-3 font-medium">${r.nombreCliente}</td>
            <td class="py-2 px-3">${r.alojamientoNombre}</td>
            <td class="py-2 px-3 whitespace-nowrap">${formatDate(r.fechaLlegada)}</td>
            <td class="py-2 px-3 whitespace-nowrap">${formatDate(r.fechaSalida)}</td>
            <td class="py-2 px-3">${r.estado}</td>
            <td class="py-2 px-3">${r.estadoGestion || 'Pendiente'}</td>
            <td class="py-2 px-3 text-right">
                <div class="font-semibold" title="Total Pagado por el Huésped">${formatCurrency(r.valores.valorHuesped)}</div>
                <div class="text-xs text-gray-600" title="Payout para el Anfitrión">${formatCurrency(r.valores.valorTotal)}</div>
            </td>
            <td class="py-2 px-3 whitespace-nowrap text-center">
                <button data-id="${r.clienteId}" class="view-btn text-blue-600 hover:text-blue-800 font-medium" title="Ver Perfil del Cliente">Ver</button>
                <button data-id="${r.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 font-medium ml-2" title="Editar Reserva">Editar</button>
                <button data-id="${r.id}" class="delete-btn text-red-600 hover:text-red-800 font-medium ml-2" title="Eliminar Reserva">Eliminar</button>
            </td>
        </tr>
    `}).join('');
}


export async function render() {
    try {
        [todasLasReservas, historialCargas] = await Promise.all([
            fetchAPI('/reservas'),
            fetchAPI('/historial-cargas')
        ]);
    } catch (error) {
        return `<p class="text-red-500">Error al cargar las reservas. Por favor, intente de nuevo.</p>`;
    }

    const opcionesCarga = historialCargas.map(h => `<option value="${h.id}">#${h.idNumerico} - ${h.nombreArchivo}</option>`).join('');

    return `
        <div class="bg-white p-8 rounded-lg shadow">
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 class="text-2xl font-semibold text-gray-900">Gestionar Reservas</h2>
                <div class="w-full md:w-1/2 grid grid-cols-2 gap-4">
                    <input type="text" id="search-input" placeholder="Buscar por cliente, ID..." class="form-input w-full">
                    <select id="carga-filter" class="form-select w-full">
                        <option value="">-- Filtrar por reporte de carga --</option>
                        ${opcionesCarga}
                    </select>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white"><thead class="bg-gray-50"><tr>
                    <th class="th text-xs">ID Canal</th>
                    <th class="th text-xs">ID Carga</th>
                    <th class="th text-xs">Nombre</th>
                    <th class="th text-xs">Alojamiento</th>
                    <th class="th text-xs">Check-in</th>
                    <th class="th text-xs">Check-out</th>
                    <th class="th text-xs">Estado</th>
                    <th class="th text-xs">Estado Gestión</th>
                    <th class="th text-xs text-right">Datos Financieros</th>
                    <th class="th text-xs text-center">Acciones</th>
                </tr></thead><tbody id="reservas-tbody"></tbody></table>
            </div>
        </div>

        <div id="reserva-modal-edit" class="modal hidden"><div class="modal-content !max-w-4xl">
            <h3 id="modal-title" class="text-xl font-semibold mb-4">Editar Reserva</h3>
            <form id="reserva-form-edit" class="space-y-6 max-h-[75vh] overflow-y-auto pr-4">
                
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Datos de la Reserva</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label for="idReservaCanal" class="label">ID Reserva Canal</label><input type="text" name="idReservaCanal" class="form-input"></div>
                        <div><label for="alojamiento-select" class="label">Alojamiento</label><select id="alojamiento-select" name="alojamientoId" class="form-select"></select></div>
                        <div><label for="estado" class="label">Estado</label><select name="estado" class="form-select"><option value="Confirmada">Confirmada</option><option value="Cancelada">Cancelada</option><option value="Desconocido">Desconocido</option></select></div>
                    </div>
                </fieldset>

                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Fechas y Huéspedes</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label for="fechaLlegada" class="label">Fecha Llegada</label><input type="date" name="fechaLlegada" class="form-input"></div>
                        <div><label for="fechaSalida" class="label">Fecha Salida</label><input type="date" name="fechaSalida" class="form-input"></div>
                        <div><label for="cantidadHuespedes" class="label">Nº Huéspedes</label><input type="number" name="cantidadHuespedes" class="form-input"></div>
                    </div>
                </fieldset>

                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Montos</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label for="moneda" class="label">Moneda</label><select name="moneda" class="form-select"><option value="CLP">CLP</option><option value="USD">USD</option></select></div>
                        <div><label for="valorOriginal" class="label">Valor Original (Payout)</label><input type="number" name="valorOriginal" class="form-input"></div>
                        <div><label for="valorTotal" class="label">Valor Final (Payout CLP)</label><input type="number" name="valorTotal" step="1" class="form-input"></div>
                    </div>
                    <div id="dolar-container" class="hidden mt-4"><label for="valorDolarDia" class="label">Valor Dólar del Día</label><input type="number" step="0.01" name="valorDolarDia" class="form-input w-full md:w-1/3"></div>
                </fieldset>

                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Datos del Cliente</legend>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label for="nombreCliente" class="label">Nombre</label><input type="text" name="nombreCliente" class="form-input"></div>
                        <div><label for="telefonoCliente" class="label">Teléfono</label><input type="tel" name="telefonoCliente" class="form-input"></div>
                        <div><label for="emailCliente" class="label">Email</label><input type="email" name="emailCliente" class="form-input"></div>
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
    const cargaFilter = document.getElementById('carga-filter');
    const tbody = document.getElementById('reservas-tbody');
    const formEdit = document.getElementById('reserva-form-edit');
    const urlParams = new URLSearchParams(window.location.search);
    const reservaIdParaEditar = urlParams.get('reservaId');

    const getFiltros = () => ({
        busqueda: searchInput ? searchInput.value : '',
        carga: cargaFilter ? cargaFilter.value : ''
    });
    
    renderTabla(getFiltros());
    
    if (searchInput) searchInput.addEventListener('input', () => renderTabla(getFiltros()));
    if (cargaFilter) cargaFilter.addEventListener('change', () => renderTabla(getFiltros()));
    if (document.getElementById('cancel-edit-btn')) document.getElementById('cancel-edit-btn').addEventListener('click', cerrarModalEditar);

    if (formEdit) {
        formEdit.moneda.addEventListener('change', toggleDolarFields);
        formEdit.valorOriginal.addEventListener('input', calcularValorFinal);
        formEdit.valorDolarDia.addEventListener('input', calcularValorFinal);
    }
    
    if (reservaIdParaEditar) {
        abrirModalEditar(reservaIdParaEditar);
    }

    tbody.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;
        if (e.target.classList.contains('view-btn')) handleNavigation(`/cliente/${id}`);
        if (e.target.classList.contains('edit-btn')) abrirModalEditar(id);
        if (e.target.classList.contains('delete-btn')) {
            if (confirm('¿Estás seguro de que quieres eliminar esta reserva? Esta acción no se puede deshacer.')) {
                try {
                    await fetchAPI(`/reservas/${id}`, { method: 'DELETE' });
                    todasLasReservas = todasLasReservas.filter(r => r.id !== id);
                    renderTabla(getFiltros());
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });

    formEdit.addEventListener('submit', async(e) => {
        e.preventDefault();
        if (!editandoReserva) return;
        
        const clienteActualizado = {
            nombre: formEdit.nombreCliente.value,
            telefono: formEdit.telefonoCliente.value,
            email: formEdit.emailCliente.value
        };

        const clienteHaCambiado = JSON.stringify(clienteActualizado) !== JSON.stringify(clienteOriginal);

        if (clienteHaCambiado) {
            try {
                await fetchAPI(`/clientes/${editandoReserva.clienteId}`, { method: 'PUT', body: clienteActualizado });
            } catch (error) {
                alert(`Error al actualizar los datos del cliente: ${error.message}`);
                return;
            }
        }

        const datosReserva = {
            idReservaCanal: formEdit.idReservaCanal.value,
            alojamientoId: formEdit.alojamientoId.value,
            fechaLlegada: formEdit.fechaLlegada.value,
            fechaSalida: formEdit.fechaSalida.value,
            estado: formEdit.estado.value,
            moneda: formEdit.moneda.value,
            cantidadHuespedes: parseInt(formEdit.cantidadHuespedes.value) || 0,
            valorDolarDia: parseFloat(formEdit.valorDolarDia.value) || null,
            valores: {
                ...editandoReserva.valores,
                valorOriginal: parseFloat(formEdit.valorOriginal.value) || 0,
                valorTotal: parseFloat(formEdit.valorTotal.value) || 0,
            },
            nombreCliente: formEdit.nombreCliente.value
        };

        if (datosReserva.estado === 'Confirmada' && editandoReserva.estado === 'Desconocido') {
            datosReserva.estadoGestion = 'Pendiente Bienvenida';
        }

        try {
            await fetchAPI(`/reservas/${editandoReserva.id}`, { method: 'PUT', body: datosReserva });
            if (window.location.search.includes('reservaId')) {
                handleNavigation('/gestion-diaria');
            } else {
                todasLasReservas = await fetchAPI('/reservas');
                renderTabla(getFiltros());
                cerrarModalEditar();
            }
        } catch (error) {
            alert(`Error al guardar los cambios de la reserva: ${error.message}`);
        }
    });
}