import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';

let todasLasReservas = [];
let historialCargas = [];
let alojamientos = [];
let clientes = [];
let editandoReserva = null;
let clienteOriginal = null;

function toggleDolarFields(form) {
    const moneda = form.moneda.value;
    const dolarContainer = form.querySelector('#dolar-container');
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

function calcularValorFinal(form) {
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
        
        document.getElementById('modal-title-edit').textContent = `Editar Reserva: ${editandoReserva.idReservaCanal}`;
        
        document.getElementById('alojamiento-select').innerHTML = alojamientos.map(a => `<option value="${a.id}" ${a.id === editandoReserva.alojamientoId ? 'selected' : ''}>${a.nombre}</option>`).join('');
        
        const clienteSelect = document.getElementById('cliente-select');
        clienteSelect.innerHTML = clientes.map(c => `<option value="${c.id}" ${c.id === editandoReserva.clienteId ? 'selected' : ''}>${c.nombre}</option>`).join('');

        form.idReservaCanal.value = editandoReserva.idReservaCanal || '';
        form.estado.value = editandoReserva.estado;
        form.estadoGestion.value = editandoReserva.estadoGestion || '';
        form.fechaLlegada.value = editandoReserva.fechaLlegada;
        form.fechaSalida.value = editandoReserva.fechaSalida;
        form.moneda.value = editandoReserva.moneda || 'CLP';
        form.valorOriginal.value = editandoReserva.valores?.valorOriginal || 0;
        form.valorTotal.value = editandoReserva.valores?.valorTotal || 0;
        form.valorDolarDia.value = editandoReserva.valorDolarDia || '';
        form.cantidadHuespedes.value = editandoReserva.cantidadHuespedes || 0;

        toggleDolarFields(form);
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
            <td class="py-2 px-3 text-center">${r.totalNoches || '-'}</td>
            <td class="py-2 px-3">${r.estado}</td>
            <td class="py-2 px-3">${r.estadoGestion || 'N/A'}</td>
            <td class="py-2 px-3 text-right">
                <div class="font-semibold" title="Total Pagado por el Huésped">${formatCurrency(r.valores.valorHuesped)}</div>
                <div class="text-xs text-gray-600" title="Payout para el Anfitrión">${formatCurrency(r.valores.valorTotal)}</div>
            </td>
            <td class="py-2 px-3 whitespace-nowrap text-center">
                <button data-id="${r.id}" class="view-btn text-blue-600 hover:text-blue-800 font-medium" title="Ver Detalles de la Reserva">Ver</button>
                <button data-id="${r.id}" class="edit-btn text-indigo-600 hover:text-indigo-800 font-medium ml-2" title="Editar Reserva">Editar</button>
                <button data-id="${r.id}" class="delete-btn text-red-600 hover:text-red-800 font-medium ml-2" title="Eliminar Reserva">Eliminar</button>
            </td>
        </tr>
    `}).join('');
}


export async function render() {
    try {
        [todasLasReservas, historialCargas, alojamientos, clientes] = await Promise.all([
            fetchAPI('/reservas'),
            fetchAPI('/historial-cargas'),
            fetchAPI('/propiedades'),
            fetchAPI('/clientes')
        ]);
    } catch (error) {
        return `<p class="text-red-500">Error al cargar los datos. Por favor, intente de nuevo.</p>`;
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
                    <th class="th text-xs">Noches</th>
                    <th class="th text-xs">Estado</th>
                    <th class="th text-xs">Estado Gestión</th>
                    <th class="th text-xs text-right">Datos Financieros</th>
                    <th class="th text-xs text-center">Acciones</th>
                </tr></thead><tbody id="reservas-tbody"></tbody></table>
            </div>
        </div>

        <div id="reserva-modal-edit" class="modal hidden"><div class="modal-content !max-w-4xl">
            <h3 id="modal-title-edit" class="text-xl font-semibold mb-4">Editar Reserva</h3>
            <form id="reserva-form-edit" class="space-y-6 max-h-[75vh] overflow-y-auto pr-4">
                
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Datos de la Reserva</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="idReservaCanal" class="label">ID Reserva Canal</label><input type="text" name="idReservaCanal" class="form-input"></div>
                        <div><label for="alojamiento-select" class="label">Alojamiento</label><select id="alojamiento-select" name="alojamientoId" class="form-select"></select></div>
                    </div>
                </fieldset>
                
                <fieldset class="border p-4 rounded-md"><legend class="px-2 font-semibold text-gray-700">Estados</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label for="estado" class="label">Estado Reserva</label><select name="estado" class="form-select"><option value="Confirmada">Confirmada</option><option value="Cancelada">Cancelada</option><option value="Desconocido">Desconocido</option></select></div>
                        <div><label for="estadoGestion" class="label">Estado Gestión</label><select name="estadoGestion" class="form-select"><option value="">N/A</option><option value="Pendiente Bienvenida">Pendiente Bienvenida</option><option value="Pendiente Cobro">Pendiente Cobro</option><option value="Pendiente Pago">Pendiente Pago</option><option value="Pendiente Boleta">Pendiente Boleta</option><option value="Pendiente Cliente">Pendiente Cliente</option><option value="Facturado">Facturado</option></select></div>
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
                    <div><label for="cliente-select" class="label">Cliente</label><select id="cliente-select" name="clienteId" class="form-select"></select></div>
                </fieldset>

                <div class="flex justify-end pt-4 border-t">
                    <button type="button" id="cancel-edit-btn" class="btn-secondary">Cancelar</button>
                    <button type="submit" class="btn-primary ml-2">Guardar Cambios</button>
                </div>
            </form>
        </div></div>

        <div id="reserva-modal-view" class="modal hidden"><div class="modal-content !max-w-4xl">
             <div class="flex justify-between items-center pb-3 border-b mb-4">
                <h3 id="modal-title-view" class="text-xl font-semibold"></h3>
                <button id="close-view-btn" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
            </div>
            <div id="reserva-view-content" class="space-y-6 max-h-[75vh] overflow-y-auto pr-4">
                </div>
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
    
    document.getElementById('cancel-edit-btn').addEventListener('click', cerrarModalEditar);
    document.getElementById('close-view-btn').addEventListener('click', () => document.getElementById('reserva-modal-view').classList.add('hidden'));

    if (formEdit) {
        const monedaSelect = formEdit.querySelector('[name="moneda"]');
        const valorOriginalInput = formEdit.querySelector('[name="valorOriginal"]');
        const valorDolarInput = formEdit.querySelector('[name="valorDolarDia"]');
        
        monedaSelect.addEventListener('change', () => toggleDolarFields(formEdit));
        valorOriginalInput.addEventListener('input', () => calcularValorFinal(formEdit));
        valorDolarInput.addEventListener('input', () => calcularValorFinal(formEdit));
    }
    
    if (reservaIdParaEditar) {
        abrirModalEditar(reservaIdParaEditar);
    }

    tbody.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;

        if (e.target.classList.contains('view-btn')) {
            // Lógica para abrir modal de vista
        }
        if (e.target.classList.contains('edit-btn')) {
            abrirModalEditar(id);
        }
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
        
        const datosReserva = {
            idReservaCanal: formEdit.idReservaCanal.value,
            alojamientoId: formEdit.alojamientoId.value,
            clienteId: formEdit.clienteId.value,
            fechaLlegada: formEdit.fechaLlegada.value,
            fechaSalida: formEdit.fechaSalida.value,
            estado: formEdit.estado.value,
            estadoGestion: formEdit.estadoGestion.value || null,
            moneda: formEdit.moneda.value,
            cantidadHuespedes: parseInt(formEdit.cantidadHuespedes.value) || 0,
            valorDolarDia: parseFloat(formEdit.valorDolarDia.value) || null,
            valores: {
                ...editandoReserva.valores,
                valorOriginal: parseFloat(formEdit.valorOriginal.value) || 0,
                valorTotal: parseFloat(formEdit.valorTotal.value) || 0,
            }
        };

        try {
            await fetchAPI(`/reservas/${editandoReserva.id}`, { method: 'PUT', body: datosReserva });
            
            // Refrescar datos y UI
            todasLasReservas = await fetchAPI('/reservas');
            renderTabla(getFiltros());
            cerrarModalEditar();

            if (window.location.search.includes('reservaId')) {
                handleNavigation('/gestion-diaria');
            }
            
        } catch (error) {
            alert(`Error al guardar los cambios de la reserva: ${error.message}`);
        }
    });
}