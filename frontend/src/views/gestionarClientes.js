// frontend/src/views/gestionarClientes.js

import { fetchAPI } from '../api.js';
import { handleNavigation } from '../router.js';
import { filtrarClientes } from './components/gestionarClientes/clientes.utils.js';
import { renderModalCliente, setupModalCliente, abrirModalCliente, getIniciales, getColorAvatar } from './components/gestionarClientes/clientes.modals.js';

let clientes = [];
let chipActivo = 'todos';

const TIPO_BADGE_CLASS = {
    'Cliente Premium':   'badge-cliente-tipo-premium',
    'Cliente Frecuente': 'badge-cliente-tipo-frecuente',
    'Cliente Nuevo':     'badge-cliente-tipo-nuevo',
    'Sin Reservas':      'badge-cliente-tipo-sin-reservas',
};

function renderStars(rating) {
    if (!rating) return '<span class="text-gray-400 text-xs">Sin calificar</span>';
    return Array.from({ length: 5 }, (_, i) =>
        `<span class="${i < rating ? 'text-warning-400' : 'text-gray-200'} text-sm">★</span>`
    ).join('');
}

function renderCards(lista) {
    const grid = document.getElementById('clientes-grid');
    const count = document.getElementById('clientes-count');
    if (!grid) return;

    count.textContent = `Mostrando ${lista.length} cliente${lista.length !== 1 ? 's' : ''}`;

    if (lista.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400">
            <p class="text-4xl mb-3">👥</p>
            <p class="font-medium">No se encontraron clientes</p>
        </div>`;
        return;
    }

    grid.innerHTML = lista.map(c => {
        const iniciales  = getIniciales(c.nombre);
        const color      = getColorAvatar(c.nombre);
        const tipoBadge  = TIPO_BADGE_CLASS[c.tipoCliente] || 'badge-cliente-tipo-nuevo';
        const tipoLabel  = c.tipoCliente?.replace('Cliente ', '') || 'Nuevo';
        const syncColor  = c.googleContactSynced ? 'text-success-600' : 'text-gray-400';
        const syncLabel  = c.googleContactSynced ? 'Sincronizado' : 'Sin sincronizar';
        const pais       = c.pais ? `<span class="text-xs uppercase font-mono">${c.pais}</span> ${c.pais.toUpperCase()}` : '—';

        return `
        <div class="bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all flex flex-col" data-id="${c.id}">
            <div class="p-4 flex-1">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 select-none"
                             style="background:${color}">${iniciales}</div>
                        <div>
                            <p class="font-semibold text-gray-900 leading-tight">${c.nombre || '—'}</p>
                            <p class="text-xs text-gray-500">${c.telefono || '—'}</p>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="${tipoBadge}">${tipoLabel}</span>
                        ${c.bloqueado ? '<span class="badge-soft-danger-sm">🚫 Bloqueado</span>' : ''}
                    </div>
                </div>

                <div class="space-y-1 text-sm text-gray-600">
                    <div class="flex items-center gap-1.5">
                        <span class="text-gray-400">📍</span>
                        <span>${pais}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="text-gray-400">✉</span>
                        <span class="truncate">${c.email || '—'}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="text-gray-400">📋</span>
                        <span>${c.numeroDeReservas || 0} reservas</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="text-gray-400">☆</span>
                        <span>${renderStars(c.calificacion)}</span>
                    </div>
                </div>
            </div>

            <div class="border-t px-4 py-2.5 flex items-center justify-between bg-gray-50 rounded-b-xl">
                <span class="text-xs font-medium ${syncColor}">${syncLabel}</span>
                <div class="flex items-center gap-1">
                    <button class="view-btn btn-outline text-xs py-1 px-2" data-id="${c.id}">Ver</button>
                    <button class="edit-btn btn-outline text-xs py-1 px-2" data-id="${c.id}">Editar</button>
                    <button class="delete-btn text-danger-500 hover:text-danger-700 hover:bg-danger-50 rounded p-1 transition-colors" data-id="${c.id}" title="Eliminar">🗑</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function getFiltros() {
    return {
        texto: document.getElementById('search-input')?.value || '',
        pais:  document.getElementById('pais-filter')?.value  || '',
        chip:  chipActivo,
    };
}

function aplicarFiltros() {
    const { texto, pais, chip } = getFiltros();
    let lista = filtrarClientes(clientes, texto, '', pais);

    if (chip === 'premium')    lista = lista.filter(c => c.tipoCliente === 'Cliente Premium');
    if (chip === 'frecuentes') lista = lista.filter(c => c.tipoCliente === 'Cliente Frecuente');
    if (chip === 'sin-sync')   lista = lista.filter(c => !c.googleContactSynced);
    if (chip === 'sin-email')  lista = lista.filter(c => !c.email);
    if (chip === 'con-reservas') lista = lista.filter(c => (c.numeroDeReservas || 0) > 0);

    renderCards(lista);
}

export async function render() {
    try {
        clientes = await fetchAPI('/clientes');
    } catch (error) {
        return `<p class="text-danger-500">Error al cargar los clientes.</p>`;
    }

    const paises = [...new Set(clientes.map(c => c.pais).filter(Boolean))].sort();
    const total     = clientes.length;
    const premium   = clientes.filter(c => c.tipoCliente === 'Cliente Premium').length;
    const frecuentes= clientes.filter(c => c.tipoCliente === 'Cliente Frecuente').length;
    const sinSync   = clientes.filter(c => !c.googleContactSynced).length;

    return `
        <div class="space-y-4">
            <!-- Filtros -->
            <div class="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <input type="text" id="search-input"
                       placeholder="Buscar por nombre, teléfono o email..."
                       class="form-input w-full">
                <div class="flex gap-3">
                    <select id="pais-filter" class="form-select flex-1">
                        <option value="">Todos los países</option>
                        ${paises.map(p => `<option value="${p}">${p.toUpperCase()}</option>`).join('')}
                    </select>
                    <button id="add-cliente-btn" class="btn-primary whitespace-nowrap">+ Nuevo cliente</button>
                </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                ${[
                    { label: 'Total clientes',   value: total,      color: 'text-gray-900' },
                    { label: 'Premium',          value: premium,    color: 'text-warning-600' },
                    { label: 'Frecuentes',       value: frecuentes, color: 'text-primary-600' },
                    { label: 'Sin sincronizar',  value: sinSync,    color: 'text-gray-600' },
                ].map(s => `
                    <div class="bg-white rounded-xl border border-gray-200 p-4">
                        <p class="text-xs text-gray-500 mb-1">${s.label}</p>
                        <p class="text-2xl font-bold ${s.color}">${s.value}</p>
                    </div>`).join('')}
            </div>

            <!-- Chips -->
            <div id="chips-container" class="flex flex-wrap gap-2">
                ${[
                    { id: 'todos',       label: 'Todos' },
                    { id: 'premium',     label: 'Premium' },
                    { id: 'frecuentes',  label: 'Frecuentes' },
                    { id: 'sin-sync',    label: 'Sin sincronizar' },
                    { id: 'sin-email',   label: 'Sin email' },
                    { id: 'con-reservas',label: 'Con reservas' },
                ].map(ch => `
                    <button class="chip-filter px-4 py-1.5 rounded-full text-sm border border-gray-300 text-gray-600
                                   hover:border-primary-400 hover:text-primary-700 transition-colors
                                   ${ch.id === 'todos' ? 'active bg-gray-900 text-white border-gray-900' : ''}"
                            data-chip="${ch.id}">${ch.label}</button>`).join('')}
            </div>

            <!-- Grid -->
            <p id="clientes-count" class="text-sm text-gray-500"></p>
            <div id="clientes-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
        </div>

        ${renderModalCliente()}
    `;
}

export function afterRender() {
    aplicarFiltros();

    setupModalCliente(async () => {
        clientes = await fetchAPI('/clientes');
        aplicarFiltros();
    });

    document.getElementById('add-cliente-btn').addEventListener('click', () => abrirModalCliente());
    document.getElementById('search-input').addEventListener('input', aplicarFiltros);
    document.getElementById('pais-filter').addEventListener('change', aplicarFiltros);

    document.getElementById('chips-container').addEventListener('click', e => {
        const btn = e.target.closest('.chip-filter');
        if (!btn) return;
        document.querySelectorAll('.chip-filter').forEach(b => {
            b.classList.remove('active', 'bg-gray-900', 'text-white', 'border-gray-900');
            b.classList.add('border-gray-300', 'text-gray-600');
        });
        btn.classList.add('active', 'bg-gray-900', 'text-white', 'border-gray-900');
        btn.classList.remove('border-gray-300', 'text-gray-600');
        chipActivo = btn.dataset.chip;
        aplicarFiltros();
    });

    document.getElementById('clientes-grid').addEventListener('click', async e => {
        const btn = e.target.closest('[data-id]');
        if (!btn) return;
        const id = btn.dataset.id;
        const cliente = clientes.find(c => c.id === id);
        if (!cliente) return;

        if (btn.classList.contains('view-btn')) {
            handleNavigation(`/cliente/${id}`);
        } else if (btn.classList.contains('edit-btn')) {
            abrirModalCliente(cliente);
        } else if (btn.classList.contains('delete-btn')) {
            if (confirm(`¿Eliminar a ${cliente.nombre}?`)) {
                try {
                    await fetchAPI(`/clientes/${id}`, { method: 'DELETE' });
                    clientes = await fetchAPI('/clientes');
                    aplicarFiltros();
                } catch (error) {
                    alert(`Error al eliminar: ${error.message}`);
                }
            }
        }
    });
}
