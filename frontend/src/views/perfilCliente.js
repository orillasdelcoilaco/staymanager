import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { renderModalCliente, abrirModalCliente, setupModalCliente } from './components/gestionarClientes/clientes.modals.js';

let cliente = null;
let comunicaciones = [];
let reservaDeOrigenId = null;

const SEGMENTO_BADGE_CLASS = {
    '🏆 Campeones':   'badge-segmento-campeones',
    '❤️ Leales':      'badge-segmento-leales',
    '🤝 Potenciales': 'badge-segmento-potenciales',
    '😟 En Riesgo':   'badge-segmento-riesgo',
    '🥶 Hibernando':  'badge-segmento-hibernando',
    'Sin Reservas':   'badge-segmento-sin-reservas',
};

function renderStars(rating) {
    if (!rating) return '<span class="text-gray-400 text-xs">Sin calificar</span>';
    return Array.from({ length: 5 }, (_, i) =>
        `<i class="fa-solid fa-star ${i < rating ? 'text-warning-400' : 'text-gray-200'} text-sm"></i>`
    ).join('');
}

const formatCurrency = (v) => `$${(Math.round(v) || 0).toLocaleString('es-CL')}`;
const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '—';
const formatDateTime = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('es-CL') + ' ' + dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

function buildTimeline() {
    const events = [];

    // Reservas
    if (cliente.reservas) {
        for (const r of cliente.reservas) {
            events.push({
                date: r.fechaLlegada || r.fechaCreacion,
                type: 'reserva',
                icon: '<i class="fa-solid fa-clipboard"></i>',
                title: `Reserva en ${r.alojamientoNombre || 'Alojamiento'}`,
                subtitle: `${formatDate(r.fechaLlegada)} → ${formatDate(r.fechaSalida)} · ${r.totalNoches || '?'} noches`,
                detail: `${r.canalNombre || ''} · ${r.estado || ''}`,
                value: formatCurrency(r.valores?.valorHuesped || 0),
                color: 'primary',
            });
        }
    }

    // Comunicaciones
    if (comunicaciones) {
        for (const c of comunicaciones) {
            const badges = {
                'propuesta-enviada': { label: 'Propuesta Enviada', color: 'primary' },
                'reserva-confirmada': { label: 'Confirmación', color: 'success' },
                'promocion': { label: 'Promoción', color: 'warning' },
                'cancelacion': { label: 'Cancelación', color: 'danger' },
                'general': { label: 'Email', color: 'gray' },
            };
            const badge = badges[c.evento] || badges['general'];
            events.push({
                date: c.fechaEnvio,
                type: 'comunicacion',
                icon: '<i class="fa-solid fa-envelope"></i>',
                title: c.asunto || badge.label,
                subtitle: `${c.destinatario || ''}`,
                detail: c.estado === 'enviado' ? '<i class="fa-solid fa-check text-success-500 mr-1"></i>Enviado' : c.estado === 'fallido' ? '<i class="fa-solid fa-xmark text-danger-500 mr-1"></i>Fallido' : 'Pendiente',
                color: badge.color,
            });
        }
    }

    events.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return events;
}

function _renderClienteHeader(c, seg, segBadgeClass) {
    return `
    <div class="bg-white rounded-xl border border-gray-200 p-6">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <h1 class="text-2xl font-bold text-gray-900">${c.nombre}</h1>
                    <span class="${segBadgeClass}">${seg}</span>
                    ${c.bloqueado ? '<span class="badge-cliente-bloqueado"><i class="fa-solid fa-ban"></i> Bloqueado</span>' : ''}
                </div>
                <div class="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span>📞 ${c.telefono || '—'}</span>
                    <span>✉️ ${c.email || '—'}</span>
                    <span>📍 ${c.pais || 'No especificado'}</span>
                </div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
                <button id="edit-cliente-btn" class="btn-primary text-sm flex items-center gap-1.5"><i class="fa-solid fa-pen"></i> Editar</button>
                ${c.telefono ? `<a href="https://wa.me/${(c.telefono||'').replace(/\D/g,'')}" target="_blank" class="btn-outline text-sm">WhatsApp</a>` : ''}
                <button id="back-btn" class="btn-outline text-sm flex items-center gap-1.5"><i class="fa-solid fa-arrow-left"></i> Volver</button>
            </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div><p class="text-xs text-gray-500 uppercase tracking-wide">Valor Lifetime</p><p class="text-xl font-bold text-success-600">${formatCurrency(c.totalGastado)}</p></div>
            <div><p class="text-xs text-gray-500 uppercase tracking-wide">Reservas</p><p class="text-xl font-bold text-gray-900">${c.numeroDeReservas || 0}</p></div>
            <div><p class="text-xs text-gray-500 uppercase tracking-wide">Calificación</p><p class="text-xl">${renderStars(c.calificacion)}</p></div>
            <div><p class="text-xs text-gray-500 uppercase tracking-wide">Tipo</p><p class="text-sm font-semibold text-gray-900">${c.tipoCliente || 'Sin clasificar'}</p></div>
        </div>
    </div>`;
}

function _renderPanelTimeline(timeline) {
    if (timeline.length === 0) return '<p class="text-gray-400 text-center py-8">No hay actividad registrada para este cliente.</p>';
    return `<div class="relative">
        <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        <div class="space-y-6">
            ${timeline.map(ev => `
            <div class="relative flex gap-4 ml-1">
                <div class="w-8 h-8 rounded-full bg-${ev.color}-100 flex items-center justify-center text-sm flex-shrink-0 z-10 border-2 border-white">${ev.icon}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <p class="font-medium text-sm text-gray-900">${ev.title}</p>
                        ${ev.value ? `<span class="text-sm font-bold text-success-600 flex-shrink-0">${ev.value}</span>` : ''}
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">${ev.subtitle}</p>
                    ${ev.detail ? `<p class="text-xs text-gray-400 mt-0.5">${ev.detail}</p>` : ''}
                    <p class="text-xs text-gray-400 mt-1">${formatDateTime(ev.date)}</p>
                </div>
            </div>`).join('')}
        </div>
    </div>`;
}

function _renderPanelReservas(c) {
    const filas = (!c.reservas || c.reservas.length === 0)
        ? '<tr><td colspan="7" class="text-center text-gray-400 py-8">Sin reservas</td></tr>'
        : c.reservas.map(r => `<tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3">${r.idReservaCanal || '—'}</td>
            <td class="py-2 px-3">${r.alojamientoNombre || '—'}</td>
            <td class="py-2 px-3">${r.canalNombre || '—'}</td>
            <td class="py-2 px-3">${formatDate(r.fechaLlegada)}</td>
            <td class="py-2 px-3">${r.totalNoches || '—'}</td>
            <td class="py-2 px-3">${r.estado || '—'}</td>
            <td class="py-2 px-3 font-semibold">${formatCurrency(r.valores?.valorHuesped || 0)}</td>
        </tr>`).join('');
    return `<div class="overflow-x-auto"><table class="min-w-full">
        <thead class="bg-gray-50"><tr>
            <th class="th text-xs py-2 px-3">ID Canal</th><th class="th text-xs py-2 px-3">Alojamiento</th>
            <th class="th text-xs py-2 px-3">Canal</th><th class="th text-xs py-2 px-3">Check-in</th>
            <th class="th text-xs py-2 px-3">Noches</th><th class="th text-xs py-2 px-3">Estado</th>
            <th class="th text-xs py-2 px-3">Total</th>
        </tr></thead>
        <tbody id="historial-tbody">${filas}</tbody>
    </table></div>`;
}

export async function render() {
    const pathParts = window.location.pathname.split('/');
    const clienteId = pathParts[pathParts.length - 1];
    reservaDeOrigenId = new URLSearchParams(window.location.search).get('from-reserva');

    try {
        [cliente, comunicaciones] = await Promise.all([
            fetchAPI(`/clientes/${clienteId}`),
            fetchAPI(`/clientes/${clienteId}/comunicaciones`).catch(() => [])
        ]);
    } catch (error) {
        return `<p class="text-danger-500">Error al cargar el perfil del cliente: ${error.message}</p>`;
    }

    const seg = cliente.rfmSegmento || 'Sin Reservas';
    const segBadgeClass = SEGMENTO_BADGE_CLASS[seg] || 'badge-segmento-hibernando';
    const timeline = buildTimeline();

    return `
        <div class="space-y-6">
            ${_renderClienteHeader(cliente, seg, segBadgeClass)}
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="border-b"><nav class="flex -mb-px">
                    <button id="tab-timeline" class="perfil-tab active px-6 py-3 text-sm font-medium border-b-2 border-primary-500 text-primary-600" data-tab="timeline"><i class="fa-solid fa-timeline mr-1.5"></i>Timeline (${timeline.length})</button>
                    <button id="tab-reservas" class="perfil-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" data-tab="reservas"><i class="fa-solid fa-calendar-check mr-1.5"></i>Reservas (${cliente.reservas?.length || 0})</button>
                    <button id="tab-notas" class="perfil-tab px-6 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300" data-tab="notas"><i class="fa-solid fa-note-sticky mr-1.5"></i>Notas</button>
                </nav></div>
                <div id="panel-timeline" class="perfil-panel p-6">${_renderPanelTimeline(timeline)}</div>
                <div id="panel-reservas" class="perfil-panel p-6 hidden">${_renderPanelReservas(cliente)}</div>
                <div id="panel-notas" class="perfil-panel p-6 hidden">
                    <div class="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-wrap min-h-[120px]">${cliente.notas || 'Sin notas.'}</div>
                </div>
            </div>
        </div>
        ${renderModalCliente()}
    `;
}

export function afterRender() {
    // Tabs
    document.querySelectorAll('.perfil-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.perfil-tab').forEach(t => {
                t.classList.remove('active', 'border-primary-500', 'text-primary-600');
                t.classList.add('border-transparent', 'text-gray-500');
            });
            tab.classList.add('active', 'border-primary-500', 'text-primary-600');
            tab.classList.remove('border-transparent', 'text-gray-500');
            document.querySelectorAll('.perfil-panel').forEach(p => p.classList.add('hidden'));
            document.getElementById(`panel-${tab.dataset.tab}`)?.classList.remove('hidden');
        });
    });

    const backBtn = document.getElementById('back-btn');
    backBtn.addEventListener('click', () => {
        const path = reservaDeOrigenId ? '/gestion-diaria' : '/crm';
        handleNavigation(path);
    });

    document.getElementById('edit-cliente-btn')?.addEventListener('click', () => abrirModalCliente(cliente));

    setupModalCliente(async () => {
        handleNavigation(window.location.pathname);
    });
}