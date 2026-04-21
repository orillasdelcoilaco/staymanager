// frontend/src/views/components/crm/crm.table.js
import { fetchAPI } from '../../../api.js';
import { handleNavigation } from '../../../router.js';

const SEGMENTO_BADGE = {
    '🏆 Campeones':   'bg-warning-100 text-warning-800',
    '❤️ Leales':      'bg-success-100 text-success-800',
    '🤝 Potenciales': 'bg-primary-100 text-primary-800',
    '😟 En Riesgo':   'bg-orange-100 text-orange-800',
    '🥶 Hibernando':  'bg-gray-100 text-gray-600',
    'Sin Reservas':    'bg-gray-50 text-gray-400',
};

const formatCurrency = (v) => `$${(Math.round(v) || 0).toLocaleString('es-CL')}`;
const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CL') : '—';

let allClientes = [];
let sortField = 'nombre';
let sortDir = 'asc';

function sortClientes(list) {
    return [...list].sort((a, b) => {
        let va = a[sortField], vb = b[sortField];
        if (sortField === 'totalGastado' || sortField === 'numeroDeReservas') {
            va = va || 0; vb = vb || 0;
            return sortDir === 'asc' ? va - vb : vb - va;
        }
        va = (va || '').toString().toLowerCase();
        vb = (vb || '').toString().toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
}

function filterClientes() {
    const search = (document.getElementById('crm-table-search')?.value || '').toLowerCase();
    const segFilter = document.getElementById('crm-table-seg-filter')?.value || '';
    let list = allClientes;
    if (search) list = list.filter(c =>
        (c.nombre || '').toLowerCase().includes(search) ||
        (c.email || '').toLowerCase().includes(search) ||
        (c.telefono || '').includes(search)
    );
    if (segFilter) list = list.filter(c => c.rfmSegmento === segFilter);
    return sortClientes(list);
}

function renderRows() {
    const tbody = document.getElementById('crm-table-tbody');
    const count = document.getElementById('crm-table-count');
    if (!tbody) return;
    const list = filterClientes();
    count.textContent = `${list.length} cliente${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-400 py-8">No se encontraron clientes</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(c => {
        const seg = c.rfmSegmento || 'Sin Reservas';
        const badgeCls = SEGMENTO_BADGE[seg] || 'bg-gray-100 text-gray-600';
        const segLabel = seg.replace(/^[^\s]+\s/, '');
        return `
        <tr class="border-b hover:bg-gray-50 text-sm transition-colors">
            <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">${c.nombre}</span>
                    ${c.bloqueado ? '<span class="text-danger-500 text-xs">🚫</span>' : ''}
                </div>
            </td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ${badgeCls}">${segLabel}</span></td>
            <td class="py-3 px-4 text-center font-medium">${c.numeroDeReservas || 0}</td>
            <td class="py-3 px-4 text-right font-semibold">${formatCurrency(c.totalGastado)}</td>
            <td class="py-3 px-4 text-gray-500">${c.telefono || '—'}</td>
            <td class="py-3 px-4 text-gray-500 truncate max-w-[160px]">${c.email || '—'}</td>
            <td class="py-3 px-4 text-center">
                <button class="crm-view-btn btn-outline text-xs py-1 px-2" data-id="${c.id}">Ver</button>
            </td>
        </tr>`;
    }).join('');
}

export function renderTable() {
    const segmentos = ['🏆 Campeones', '❤️ Leales', '🤝 Potenciales', '😟 En Riesgo', '🥶 Hibernando', 'Sin Reservas'];

    return `
        <div class="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div class="flex flex-wrap gap-3 items-center">
                <input type="text" id="crm-table-search" placeholder="Buscar nombre, email o teléfono..."
                       class="form-input flex-1 min-w-[200px]">
                <select id="crm-table-seg-filter" class="form-select w-auto">
                    <option value="">Todos los segmentos</option>
                    ${segmentos.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
                <span id="crm-table-count" class="text-sm text-gray-500"></span>
            </div>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full">
                    <thead class="bg-gray-50 border-b">
                        <tr>
                            <th class="th py-3 px-4 cursor-pointer select-none" data-sort="nombre">Nombre ↕</th>
                            <th class="th py-3 px-4">Segmento</th>
                            <th class="th py-3 px-4 text-center cursor-pointer select-none" data-sort="numeroDeReservas">Reservas ↕</th>
                            <th class="th py-3 px-4 text-right cursor-pointer select-none" data-sort="totalGastado">Gasto Total ↕</th>
                            <th class="th py-3 px-4">Teléfono</th>
                            <th class="th py-3 px-4">Email</th>
                            <th class="th py-3 px-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="crm-table-tbody"></tbody>
                </table>
            </div>
        </div>`;
}

export async function setupTable() {
    try {
        allClientes = await fetchAPI('/clientes');
    } catch {
        allClientes = [];
    }
    renderRows();

    document.getElementById('crm-table-search')?.addEventListener('input', renderRows);
    document.getElementById('crm-table-seg-filter')?.addEventListener('change', renderRows);

    // Sort headers
    document.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (sortField === field) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            else { sortField = field; sortDir = 'asc'; }
            renderRows();
        });
    });

    // View button
    document.getElementById('crm-table-tbody')?.addEventListener('click', e => {
        const btn = e.target.closest('.crm-view-btn');
        if (btn) handleNavigation(`/cliente/${btn.dataset.id}`);
    });
}
