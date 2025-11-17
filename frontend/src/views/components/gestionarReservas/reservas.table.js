// frontend/src/views/components/gestionarReservas/reservas.table.js

import { formatDate, formatCurrency } from './reservas.utils.js';

export function renderTabla(filtros, todasLasReservas, historialCargas) {
    const tbody = document.getElementById('reservas-tbody');
    if (!tbody) return;
    
    const filtroLowerCase = filtros.busqueda.toLowerCase();
    
    const reservasFiltradas = todasLasReservas.filter(r => {
        const busquedaMatch = !filtroLowerCase ||
                              (r.nombreCliente?.toLowerCase().includes(filtroLowerCase)) ||
                              (r.alojamientoNombre?.toLowerCase().includes(filtroLowerCase)) ||
                              (r.idReservaCanal?.toLowerCase().includes(filtroLowerCase)) ||
                              (r.totalNoches?.toString().includes(filtroLowerCase));
        
        const cargaMatch = !filtros.carga || r.idCarga === filtros.carga;
        const canalMatch = !filtros.canal || r.canalNombre === filtros.canal;
        const estadoMatch = !filtros.estado || r.estado === filtros.estado;
        const estadoGestionMatch = !filtros.estadoGestion || r.estadoGestion === filtros.estadoGestion;
        const fechaMatch = (!filtros.fechaInicio || r.fechaLlegada >= filtros.fechaInicio) &&
                           (!filtros.fechaFin || r.fechaLlegada <= filtros.fechaFin);

        return busquedaMatch && cargaMatch && canalMatch && estadoMatch && estadoGestionMatch && fechaMatch;
    });

    if (reservasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="text-center text-gray-500 py-4">No se encontraron reservas que coincidan con los filtros.</td></tr>';
        return;
    }

    tbody.innerHTML = reservasFiltradas.map((r, index) => {
        const reporte = historialCargas.find(h => h.id === r.idCarga);
        const idNumericoCarga = reporte ? reporte.idNumerico : 'N/A';

        return `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="py-2 px-3 text-center font-medium text-gray-500">${index + 1}</td>
            <td class="py-2 px-3 font-mono">${r.idReservaCanal}</td>
            <td class="py-2 px-3 font-mono text-center font-bold">${idNumericoCarga}</td>
            <td class="py-2 px-3 font-medium">${r.nombreCliente}</td>
            <td class="py-2 px-3">${r.alojamientoNombre}</td>
            <td class="py-2 px-3">${r.canalNombre}</td>
            <td class="py-2 px-3 whitespace-nowrap">${formatDate(r.fechaLlegada)}</td>
            <td class="py-2 px-3 whitespace-nowrap">${formatDate(r.fechaSalida)}</td>
            <td class="py-2 px-3 text-center">${r.totalNoches || '-'}</td>
            <td class="py-2 px-3">${r.estado}</td>
            <td class="py-2 px-3">${r.estadoGestion || 'N/A'}</td>
            <td class="py-2 px-3 text-right">
                <div class="font-semibold" title="Total Pagado por el Huésped">${formatCurrency(r.valores.valorHuesped)}</div>
                <div class="text-xs text-gray-600" title="Payout para el Anfitrión">${formatCurrency(r.valores.valorTotal)}</div>
            </td>
            <td class="py-2 px-3 whitespace-nowrap text-center space-x-2">
                <button data-id="${r.id}" class="view-btn btn-table-view">Ver</button>
                <button data-id="${r.id}" class="edit-btn btn-table-edit">Editar</button>
                <button data-id="${r.id}" class="delete-btn btn-table-delete">Eliminar</button>
            </td>
        </tr>
    `}).join('');
}