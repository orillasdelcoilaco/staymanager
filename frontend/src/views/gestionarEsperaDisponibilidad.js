import { fetchAPI } from '../api.js';

let rows = [];
let estados = [];

function renderRows() {
    const tbody = document.getElementById('espera-disponibilidad-tbody');
    if (!tbody) return;
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-6">No hay registros de lista de espera.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map((r) => {
        const estadoOpts = estados.map((e) => `<option value="${e.id}" ${e.id === r.estadoId ? 'selected' : ''}>${e.nombre}</option>`).join('');
        const nombre = [r.nombre, r.apellido].filter(Boolean).join(' ').trim();
        return `
        <tr class="border-b">
            <td class="py-2 px-3 text-sm">${nombre || '—'}</td>
            <td class="py-2 px-3 text-sm">${r.email || '—'}</td>
            <td class="py-2 px-3 text-sm">${r.telefono || '—'}</td>
            <td class="py-2 px-3 text-sm">${r.fechaLlegada} → ${r.fechaSalida}</td>
            <td class="py-2 px-3 text-sm">${r.personas}</td>
            <td class="py-2 px-3 text-sm">${r.propiedadIdPreferida || 'Sin preferencia'}</td>
            <td class="py-2 px-3 text-sm">
                <span class="px-2 py-1 rounded text-white" style="background:${r.estadoColor || 'rgb(107 114 128)'}">${r.estadoNombre}</span>
            </td>
            <td class="py-2 px-3 text-sm">
                <select class="form-select text-xs espera-estado-select" data-id="${r.id}">
                    ${estadoOpts}
                </select>
            </td>
        </tr>`;
    }).join('');
}

async function loadData() {
    [estados, rows] = await Promise.all([
        fetchAPI('/espera-disponibilidad/estados'),
        fetchAPI('/espera-disponibilidad'),
    ]);
    renderRows();
}

async function handleEstadoChange(e) {
    const select = e.target.closest('.espera-estado-select');
    if (!select) return;
    const id = String(select.dataset.id || '').trim();
    const estadoId = String(select.value || '').trim();
    if (!id || !estadoId) return;
    try {
        await fetchAPI(`/espera-disponibilidad/${id}/estado`, {
            method: 'PUT',
            body: { estadoId },
        });
        await loadData();
    } catch (error) {
        alert(`No se pudo actualizar estado: ${error.message}`);
    }
}

async function handleReconcileClick() {
    const btn = document.getElementById('espera-reconciliar-btn');
    const status = document.getElementById('espera-reconciliar-status');
    try {
        btn.disabled = true;
        btn.textContent = 'Revisando...';
        const result = await fetchAPI('/espera-disponibilidad/reconciliar', { method: 'POST', body: {} });
        status.textContent = `Reconciliación: revisados ${result.scanned || 0}, notificados ${result.notified || 0}, expirados ${result.expired || 0}, fallidos ${result.failed || 0}.`;
        await loadData();
    } catch (error) {
        status.textContent = `Error: ${error.message}`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Reconciliar ahora';
    }
}

export async function render() {
    return `
    <div class="bg-white p-8 rounded-lg shadow space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-semibold text-gray-900">Lista de espera de disponibilidad</h2>
          <p class="text-sm text-gray-500 mt-1">Seguimiento de clientes sin disponibilidad y estado de notificación.</p>
        </div>
        <button id="espera-reconciliar-btn" class="btn-outline">Reconciliar ahora</button>
      </div>
      <p id="espera-reconciliar-status" class="text-xs text-gray-500"></p>
      <div class="table-container">
        <table class="min-w-full bg-white">
          <thead>
            <tr>
              <th class="th">Cliente</th>
              <th class="th">Email</th>
              <th class="th">Teléfono</th>
              <th class="th">Fechas</th>
              <th class="th">Pax</th>
              <th class="th">Propiedad</th>
              <th class="th">Estado</th>
              <th class="th">Cambiar</th>
            </tr>
          </thead>
          <tbody id="espera-disponibilidad-tbody"></tbody>
        </table>
      </div>
    </div>`;
}

export async function afterRender() {
    await loadData();
    document.getElementById('espera-disponibilidad-tbody')?.addEventListener('change', handleEstadoChange);
    document.getElementById('espera-reconciliar-btn')?.addEventListener('click', handleReconcileClick);
}
