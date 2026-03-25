import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { renderModalCliente, abrirModalCliente, setupModalCliente } from './components/gestionarClientes/clientes.modals.js';

let cliente = null;
let comunicaciones = [];
let reservaDeOrigenId = null; 

function renderStars(rating) {
    const filledStar = '⭐';
    const emptyStar = '☆';
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? filledStar : emptyStar;
    }
    return stars || 'Sin calificar';
}


function renderHistorialReservas() {
    const tbody = document.getElementById('historial-tbody');
    if (!tbody || !cliente || !cliente.reservas || cliente.reservas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No hay reservas para este cliente.</td></tr>';
        return;
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-CL', { timeZone: 'UTC' });
    };

    const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

    tbody.innerHTML = cliente.reservas.map(r => `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3">${r.idReservaCanal}</td>
            <td class="py-2 px-3">${r.alojamientoNombre}</td>
            <td class="py-2 px-3">${r.canalNombre}</td>
            <td class="py-2 px-3">${formatDate(r.fechaLlegada)}</td>
            <td class="py-2 px-3">${r.totalNoches}</td>
            <td class="py-2 px-3">${r.estado}</td>
            <td class="py-2 px-3 font-semibold">${formatCurrency(r.valores.valorHuesped)}</td>
        </tr>
    `).join('');
}

function renderComunicaciones() {
    const tbody = document.getElementById('comunicaciones-tbody');
    if (!tbody) return;

    if (!comunicaciones || comunicaciones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-4">No hay comunicaciones registradas.</td></tr>';
        return;
    }

    const formatDateTime = (date) => {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleDateString('es-CL') + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    };

    const getEventoBadge = (evento) => {
        const badges = {
            'propuesta-enviada': { bg: 'bg-primary-100', text: 'text-primary-800', label: 'Propuesta Enviada' },
            'reserva-confirmada': { bg: 'bg-success-100', text: 'text-success-800', label: 'Reserva Confirmada' },
            'promocion': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Promoción' },
            'cancelacion': { bg: 'bg-danger-100', text: 'text-danger-800', label: 'Cancelación' },
            'general': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'General' }
        };
        const badge = badges[evento] || badges['general'];
        return `<span class="px-2 py-0.5 ${badge.bg} ${badge.text} text-xs font-semibold rounded-full">${badge.label}</span>`;
    };

    const getEstadoBadge = (estado) => {
        if (estado === 'enviado') {
            return '<span class="px-2 py-0.5 bg-success-100 text-success-800 text-xs rounded-full">✓ Enviado</span>';
        } else if (estado === 'fallido') {
            return '<span class="px-2 py-0.5 bg-danger-100 text-danger-800 text-xs rounded-full">✗ Fallido</span>';
        }
        return '<span class="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full">Pendiente</span>';
    };

    tbody.innerHTML = comunicaciones.map(c => `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3">${formatDateTime(c.fechaEnvio)}</td>
            <td class="py-2 px-3">${getEventoBadge(c.evento)}</td>
            <td class="py-2 px-3">${c.asunto || '-'}</td>
            <td class="py-2 px-3 text-gray-500">${c.destinatario || '-'}</td>
            <td class="py-2 px-3">${getEstadoBadge(c.estado)}</td>
        </tr>
    `).join('');
}

export async function render() {
    const pathParts = window.location.pathname.split('/');
    const clienteId = pathParts[pathParts.length - 1];
    
    const urlParams = new URLSearchParams(window.location.search);
    reservaDeOrigenId = urlParams.get('from-reserva');

    try {
        [cliente, comunicaciones] = await Promise.all([
            fetchAPI(`/clientes/${clienteId}`),
            fetchAPI(`/clientes/${clienteId}/comunicaciones`).catch(() => [])
        ]);
    } catch (error) {
        return `<p class="text-danger-500">Error al cargar el perfil del cliente: ${error.message}</p>`;
    }

    const formatCurrency = (value) => `$${(Math.round(value) || 0).toLocaleString('es-CL')}`;

    return `
        <div class="bg-white p-8 rounded-lg shadow mb-8">
            <div class="flex justify-between items-start mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">${cliente.nombre}</h2>
                    <div class="flex items-center gap-4 mt-1">
                        <span class="px-2 py-1 bg-primary-100 text-primary-800 text-xs font-semibold rounded-full">${cliente.tipoCliente} (${cliente.numeroDeReservas})</span>
                        <span class="text-sm text-gray-600">${cliente.email || ''}</span>
                        <span class="text-sm text-gray-600">${cliente.telefono || ''} - ${cliente.pais || 'País no especificado'}</span>
                    </div>
                </div>
                <div>
                    <button id="edit-cliente-btn" class="btn-primary mr-2">Editar Cliente</button>
                    <button id="back-btn" class="btn-secondary">Volver</button>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-6">
                <div class="md:col-span-1">
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Datos Adicionales</h3>
                    <dl>
                        <dt class="font-medium text-gray-600 text-sm">Valor Histórico Total</dt>
                        <dd class="text-success-600 text-xl font-bold mb-3">${formatCurrency(cliente.totalGastado)}</dd>

                        <dt class="font-medium text-gray-600 text-sm">Calificación</dt>
                        <dd class="text-warning-500 text-xl mb-3">${renderStars(cliente.calificacion)}</dd>
                        
                        <dt class="font-medium text-gray-600 text-sm">Ubicación Geográfica</dt>
                        <dd class="text-gray-800 text-sm">${cliente.ubicacion || 'No especificada'}</dd>
                    </dl>
                </div>
                <div class="md:col-span-2">
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Notas</h3>
                    <div class="bg-gray-50 p-3 rounded-md text-sm text-gray-700 whitespace-pre-wrap h-40 overflow-y-auto">
                        ${cliente.notas || 'Sin notas.'}
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabs para Reservas y Comunicaciones -->
        <div class="bg-white rounded-lg shadow">
            <div class="border-b">
                <nav class="flex -mb-px">
                    <button id="tab-reservas" class="tab-btn active px-6 py-3 text-sm font-medium border-b-2 border-primary-500 text-primary-600">
                        📋 Historial de Reservas (${cliente.reservas?.length || 0})
                    </button>
                    <button id="tab-comunicaciones" class="tab-btn px-6 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">
                        📧 Comunicaciones (${comunicaciones?.length || 0})
                    </button>
                </nav>
            </div>

            <!-- Panel Reservas -->
            <div id="panel-reservas" class="tab-panel p-6">
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="th text-xs py-2 px-3">ID Canal</th>
                                <th class="th text-xs py-2 px-3">Alojamiento</th>
                                <th class="th text-xs py-2 px-3">Canal</th>
                                <th class="th text-xs py-2 px-3">Check-in</th>
                                <th class="th text-xs py-2 px-3">Noches</th>
                                <th class="th text-xs py-2 px-3">Estado</th>
                                <th class="th text-xs py-2 px-3">Total Cliente</th>
                            </tr>
                        </thead>
                        <tbody id="historial-tbody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Panel Comunicaciones -->
            <div id="panel-comunicaciones" class="tab-panel p-6 hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="th text-xs py-2 px-3">Fecha</th>
                                <th class="th text-xs py-2 px-3">Tipo</th>
                                <th class="th text-xs py-2 px-3">Asunto</th>
                                <th class="th text-xs py-2 px-3">Destinatario</th>
                                <th class="th text-xs py-2 px-3">Estado</th>
                            </tr>
                        </thead>
                        <tbody id="comunicaciones-tbody"></tbody>
                    </table>
                </div>
            </div>
        </div>
        
        ${renderModalCliente()}
    `;
}

export function afterRender() {
    renderHistorialReservas();
    renderComunicaciones();

    // Tabs
    document.getElementById('tab-reservas')?.addEventListener('click', () => {
        document.getElementById('tab-reservas').classList.add('active', 'border-primary-500', 'text-primary-600');
        document.getElementById('tab-reservas').classList.remove('border-transparent', 'text-gray-500');
        document.getElementById('tab-comunicaciones').classList.remove('active', 'border-primary-500', 'text-primary-600');
        document.getElementById('tab-comunicaciones').classList.add('border-transparent', 'text-gray-500');
        document.getElementById('panel-reservas').classList.remove('hidden');
        document.getElementById('panel-comunicaciones').classList.add('hidden');
    });

    document.getElementById('tab-comunicaciones')?.addEventListener('click', () => {
        document.getElementById('tab-comunicaciones').classList.add('active', 'border-primary-500', 'text-primary-600');
        document.getElementById('tab-comunicaciones').classList.remove('border-transparent', 'text-gray-500');
        document.getElementById('tab-reservas').classList.remove('active', 'border-primary-500', 'text-primary-600');
        document.getElementById('tab-reservas').classList.add('border-transparent', 'text-gray-500');
        document.getElementById('panel-comunicaciones').classList.remove('hidden');
        document.getElementById('panel-reservas').classList.add('hidden');
    });

    const backBtn = document.getElementById('back-btn');
    backBtn.textContent = reservaDeOrigenId ? 'Volver a Gestión Diaria' : 'Volver a Clientes';
    backBtn.addEventListener('click', () => {
        const path = reservaDeOrigenId ? '/gestion-diaria' : '/clientes';
        handleNavigation(path);
    });

    document.getElementById('edit-cliente-btn').addEventListener('click', () => abrirModalCliente(cliente));

    setupModalCliente(async () => {
        handleNavigation(window.location.pathname);
    });
}