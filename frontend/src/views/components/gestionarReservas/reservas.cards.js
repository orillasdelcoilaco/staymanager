// frontend/src/views/components/gestionarReservas/reservas.cards.js

import { formatDate, formatCurrency } from './reservas.utils.js';
import { getStatusInfo, getNombresConSemantica } from '../estadosStore.js';

const hoyISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
})();

function iniciales(nombre) {
    if (!nombre) return '?';
    return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function badgeEstado(estadoNombre, allEstados = []) {
    const info = getStatusInfo(estadoNombre, allEstados);
    const hex = info.color;
    return `<span class="badge-estado" style="background-color:${hex}22;color:${hex};border:1px solid ${hex}44">${estadoNombre}</span>`;
}

function badgeGestion(estadoNombre, allEstados = []) {
    if (!estadoNombre) return '<span class="badge-estado" style="background-color:rgb(243 244 246);color:rgb(107 114 128)">N/A</span>';
    const info = getStatusInfo(estadoNombre, allEstados);
    const hex = info.color;
    return `<span class="badge-estado" style="background-color:${hex}22;color:${hex};border:1px solid ${hex}44">${estadoNombre}</span>`;
}

function hoyPlus7() {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function filtrarReservas(reservas, filtros, allEstados = []) {
    const fl = filtros.busqueda.toLowerCase();
    let r = reservas.filter(res => {
        const busq = !fl ||
            res.nombreCliente?.toLowerCase().includes(fl) ||
            res.alojamientoNombre?.toLowerCase().includes(fl) ||
            res.idReservaCanal?.toLowerCase().includes(fl) ||
            res.totalNoches?.toString().includes(fl);
        const carga  = !filtros.carga         || res.idCarga       === filtros.carga;
        const canal  = !filtros.canal         || res.canalNombre   === filtros.canal;
        const estado = !filtros.estado        || res.estado        === filtros.estado;
        const estG   = !filtros.estadoGestion || res.estadoGestion === filtros.estadoGestion;
        const fIni   = !filtros.fechaInicio   || res.fechaLlegada  >= filtros.fechaInicio;
        const fFin   = !filtros.fechaFin      || res.fechaLlegada  <= filtros.fechaFin;
        return busq && carga && canal && estado && estG && fIni && fFin;
    });

    const plus7 = hoyPlus7();
    const nombresBienvenida = getNombresConSemantica(allEstados, ['pendiente_bienvenida']);
    const nombresSinPago    = getNombresConSemantica(allEstados, ['pendiente_cobro', 'pendiente_pago']);

    switch (filtros.chip) {
        case 'checkin-hoy':          return r.filter(res => res.fechaLlegada === hoyISO);
        case 'checkout-hoy':         return r.filter(res => res.fechaSalida  === hoyISO);
        case 'bienvenida-pendiente': return r.filter(res => nombresBienvenida.includes(res.estadoGestion));
        case 'sin-pago':             return r.filter(res => nombresSinPago.includes(res.estadoGestion));
        case 'proximas-7':           return r.filter(res => res.fechaLlegada > hoyISO && res.fechaLlegada <= plus7);
        default:                     return r;
    }
}

function renderStats(reservas, allEstados = []) {
    const nombresConfirmada = getNombresConSemantica(allEstados, ['confirmada']);
    const nombresCobro      = getNombresConSemantica(allEstados, ['pendiente_cobro', 'pendiente_pago']);
    const confirmadas = reservas.filter(r => nombresConfirmada.includes(r.estado));
    const pagoPend    = reservas.filter(r => nombresCobro.includes(r.estadoGestion));
    const ingresos    = confirmadas.reduce((s, r) => s + (r.valores?.valorHuesped || 0), 0);
    return `
        <div class="stat-card"><p class="stat-val">${reservas.length}</p><p class="stat-label">Total reservas</p></div>
        <div class="stat-card"><p class="stat-val text-success-600">${confirmadas.length}</p><p class="stat-label">Confirmadas</p></div>
        <div class="stat-card"><p class="stat-val text-warning-600">${pagoPend.length}</p><p class="stat-label">Pago pendiente</p></div>
        <div class="stat-card"><p class="stat-val text-primary-600 !text-xl">${formatCurrency(ingresos)}</p><p class="stat-label">Ingresos CLP</p></div>`;
}

function renderCardItem(r, idNumericoCarga, allEstados = []) {
    return `
    <div class="reserva-card" id="card-${r.id}">
        <div class="reserva-card-header">
            <div class="reserva-card-guest">
                <div class="reserva-avatar">${iniciales(r.nombreCliente)}</div>
                <div class="min-w-0">
                    <div class="font-semibold text-gray-900 text-sm truncate">${r.nombreCliente}</div>
                    <div class="text-xs text-gray-500 truncate">${r.alojamientoNombre}</div>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1 flex-shrink-0">
                <span class="badge-canal">${r.canalNombre}</span>
                ${badgeEstado(r.estado, allEstados)}
            </div>
        </div>

        ${r.alertaBloqueo ? `
        <div class="px-4 py-2 bg-danger-50 border border-danger-200 rounded-lg text-xs flex items-start gap-2 mb-2">
            <i class="fa-solid fa-ban text-danger-500 flex-shrink-0"></i>
            <div><span class="font-semibold text-danger-700">Huésped Bloqueado:</span> <span class="text-danger-600">${r.motivoBloqueo || 'Sin motivo especificado'}</span></div>
        </div>` : ''}

        <div class="reserva-card-dates">
            <div>
                <div class="text-gray-500 mb-0.5">Check-in</div>
                <div class="font-medium text-gray-900">${formatDate(r.fechaLlegada)}</div>
            </div>
            <div class="text-center">
                <div class="text-gray-500 mb-0.5">Noches</div>
                <div class="font-bold text-primary-600 text-sm">${r.totalNoches || '—'}</div>
            </div>
            <div class="text-right">
                <div class="text-gray-500 mb-0.5">Check-out</div>
                <div class="font-medium text-gray-900">${formatDate(r.fechaSalida)}</div>
            </div>
        </div>

        <div class="reserva-card-footer">
            <div class="text-gray-400 font-mono text-xs truncate">${r.idReservaCanal} · #${idNumericoCarga}</div>
            <div class="font-bold text-gray-900 text-sm flex-shrink-0">${formatCurrency(r.valores?.valorHuesped)}</div>
        </div>

        <div class="reserva-card-actions">
            ${badgeGestion(r.estadoGestion, allEstados)}
            <div class="flex gap-1.5">
                <button data-id="${r.id}" class="view-btn btn-table-view">Ver</button>
                <button data-id="${r.id}" class="edit-btn btn-table-edit">Editar</button>
                <button data-id="${r.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </div>
        </div>
    </div>`;
}

export function renderCards(filtros, todasLasReservas, historialCargas, allEstados = []) {
    const filtradas = filtrarReservas(todasLasReservas, filtros, allEstados);

    const statsEl = document.getElementById('reservas-stats');
    if (statsEl) statsEl.innerHTML = renderStats(filtradas, allEstados);

    const grid = document.getElementById('reservas-cards-grid');
    if (!grid) return;

    if (filtradas.length === 0) {
        grid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-12">No se encontraron reservas.</p>';
        return;
    }

    grid.innerHTML = filtradas.map(r => {
        const rep = historialCargas.find(h => h.id === r.idCarga);
        return renderCardItem(r, rep ? rep.idNumerico : 'N/A', allEstados);
    }).join('');
}
