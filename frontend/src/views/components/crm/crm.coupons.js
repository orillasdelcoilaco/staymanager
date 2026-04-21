// frontend/src/views/components/crm/crm.coupons.js
import { fetchAPI } from '../../../api.js';

const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CL') : '—';
const formatDateInput = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
const formatCurrency = (v) => '$' + Math.round(v || 0).toLocaleString('es-CL');

export function renderCoupons() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-gray-900">Gestión de Cupones</h3>
                <div class="flex items-center gap-3">
                    <select id="cupones-filtro" class="form-select text-sm">
                        <option value="todos">Todos</option>
                        <option value="activos">Activos</option>
                        <option value="vencidos">Vencidos</option>
                        <option value="agotados">Usos agotados</option>
                    </select>
                    <span id="cupones-count" class="text-sm text-gray-500"></span>
                </div>
            </div>

            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="th text-xs py-2.5 px-3">Código</th>
                                <th class="th text-xs py-2.5 px-3">Cliente</th>
                                <th class="th text-xs py-2.5 px-3">Descuento</th>
                                <th class="th text-xs py-2.5 px-3">Vigencia</th>
                                <th class="th text-xs py-2.5 px-3">Usos</th>
                                <th class="th text-xs py-2.5 px-3">Estado</th>
                                <th class="th text-xs py-2.5 px-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="cupones-tbody"></tbody>
                    </table>
                </div>
            </div>
        </div>

        <div id="cupon-detalle-modal" class="modal hidden">
            <div class="modal-content !max-w-2xl">
                <div class="flex items-center justify-between mb-4 pb-4 border-b">
                    <h3 class="text-lg font-semibold text-gray-900">Detalle de Uso</h3>
                    <button id="cupon-detalle-close" class="btn-ghost text-xl"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="cupon-detalle-content" class="space-y-3"></div>
            </div>
        </div>

        <div id="cupon-edit-modal" class="modal hidden">
            <div class="modal-content !max-w-md">
                <div class="flex items-center justify-between mb-4 pb-4 border-b">
                    <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2"><i class="fa-solid fa-pen text-gray-400"></i> Editar Cupón</h3>
                    <button id="cupon-edit-close" class="btn-ghost text-xl"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <input type="hidden" id="cupon-edit-id">
                <div class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">% Descuento</label>
                            <input type="number" id="cupon-edit-pct" class="form-input w-full" min="1" max="100">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Usos máximos</label>
                            <input type="number" id="cupon-edit-usos" class="form-input w-full" min="1">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Vigencia desde</label>
                            <input type="date" id="cupon-edit-desde" class="form-input w-full text-sm">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Vigencia hasta</label>
                            <input type="date" id="cupon-edit-hasta" class="form-input w-full text-sm">
                        </div>
                    </div>
                    <label class="flex items-center gap-2 text-sm">
                        <input type="checkbox" id="cupon-edit-activo" class="rounded">
                        <span>Cupón activo</span>
                    </label>
                    <div id="cupon-edit-status" class="text-sm"></div>
                </div>
                <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
                    <button id="cupon-edit-cancel" class="btn-outline text-sm">Cancelar</button>
                    <button id="cupon-edit-save" class="btn-primary text-sm">Guardar</button>
                </div>
            </div>
        </div>`;
}

function _calcEstado(c) {
    const hoy = new Date().toISOString().split('T')[0];
    if (c.vigenciaHasta && hoy > new Date(c.vigenciaHasta).toISOString().split('T')[0]) return { label: 'Vencido', cls: 'bg-gray-200 text-gray-600' };
    if (c.usosActuales >= c.usosMaximos) return { label: 'Agotado', cls: 'bg-amber-100 text-amber-700' };
    if (!c.activo) return { label: 'Inactivo', cls: 'bg-gray-200 text-gray-600' };
    return { label: 'Activo', cls: 'bg-success-100 text-success-700' };
}

function _vigenciaLabel(c) {
    if (!c.vigenciaDesde && !c.vigenciaHasta) return '<span class="text-gray-400">Sin vigencia</span>';
    const desde = c.vigenciaDesde ? formatDate(c.vigenciaDesde) : '...';
    const hasta = c.vigenciaHasta ? formatDate(c.vigenciaHasta) : '...';
    return `${desde} → ${hasta}`;
}

function _renderFila(c) {
    const estado = _calcEstado(c);
    const usosRestantes = Math.max(0, (c.usosMaximos || 1) - (c.usosActuales || 0));
    const puedeEliminar = (c.usosActuales || 0) === 0;
    return `
    <tr class="border-b hover:bg-gray-50 text-sm" data-estado="${estado.label.toLowerCase()}">
        <td class="py-2.5 px-3 font-mono font-semibold text-primary-600">${c.codigo}</td>
        <td class="py-2.5 px-3">${c.clienteNombre || '—'}</td>
        <td class="py-2.5 px-3 font-semibold">${c.porcentajeDescuento}%</td>
        <td class="py-2.5 px-3 text-xs">${_vigenciaLabel(c)}</td>
        <td class="py-2.5 px-3">
            <span class="font-medium">${c.usosActuales || 0}</span>/<span class="text-gray-400">${c.usosMaximos || 1}</span>
            <span class="text-xs text-gray-500 ml-1">(${usosRestantes} rest.)</span>
        </td>
        <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${estado.cls}">${estado.label}</span>
        </td>
        <td class="py-2.5 px-3 text-right space-x-1">
            <button class="cupon-editar btn-outline text-xs py-1 px-2" data-id="${c.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button class="cupon-ver-detalle btn-outline text-xs py-1 px-2" data-codigo="${c.codigo}" title="Ver detalle"><i class="fa-solid fa-clipboard-list"></i></button>
            ${puedeEliminar ? `<button class="cupon-eliminar btn-danger text-xs py-1 px-2" data-id="${c.id}" data-codigo="${c.codigo}" title="Eliminar"><i class="fa-solid fa-trash"></i></button>` : ''}
        </td>
    </tr>`;
}

export async function setupCoupons() {
    let allCupones = [];

    async function cargar() {
        try {
            allCupones = await fetchAPI('/crm/cupones/todos');
            renderTabla('todos');
        } catch (err) {
            document.getElementById('cupones-tbody').innerHTML =
                `<tr><td colspan="7" class="text-center text-danger-500 py-6">Error: ${err.message}</td></tr>`;
        }
    }

    function renderTabla(filtro) {
        const tbody = document.getElementById('cupones-tbody');
        let filtered = allCupones;
        if (filtro === 'activos') filtered = allCupones.filter(c => _calcEstado(c).label === 'Activo');
        else if (filtro === 'vencidos') filtered = allCupones.filter(c => _calcEstado(c).label === 'Vencido');
        else if (filtro === 'agotados') filtered = allCupones.filter(c => _calcEstado(c).label === 'Agotado');

        document.getElementById('cupones-count').textContent = `${filtered.length} cupones`;
        tbody.innerHTML = filtered.length === 0
            ? '<tr><td colspan="7" class="text-center text-gray-400 py-8">No hay cupones.</td></tr>'
            : filtered.map(_renderFila).join('');
    }

    document.getElementById('cupones-filtro')?.addEventListener('change', (e) => renderTabla(e.target.value));

    // Delegated events on tbody
    document.getElementById('cupones-tbody')?.addEventListener('click', async e => {
        // Ver detalle
        const detBtn = e.target.closest('.cupon-ver-detalle');
        if (detBtn) return _handleVerDetalle(detBtn, allCupones);

        // Editar
        const editBtn = e.target.closest('.cupon-editar');
        if (editBtn) return _handleEditar(editBtn, allCupones, cargar);

        // Eliminar
        const delBtn = e.target.closest('.cupon-eliminar');
        if (delBtn) return _handleEliminar(delBtn, cargar);
    });

    document.getElementById('cupon-detalle-close')?.addEventListener('click', () => {
        document.getElementById('cupon-detalle-modal').classList.add('hidden');
    });
    document.getElementById('cupon-edit-close')?.addEventListener('click', () => {
        document.getElementById('cupon-edit-modal').classList.add('hidden');
    });
    document.getElementById('cupon-edit-cancel')?.addEventListener('click', () => {
        document.getElementById('cupon-edit-modal').classList.add('hidden');
    });
    document.getElementById('cupon-edit-save')?.addEventListener('click', async () => {
        const id = document.getElementById('cupon-edit-id').value;
        const btn = document.getElementById('cupon-edit-save');
        const statusEl = document.getElementById('cupon-edit-status');
        btn.disabled = true; btn.textContent = 'Guardando...';
        try {
            await fetchAPI(`/crm/cupones/${id}`, { method: 'PUT', body: {
                porcentajeDescuento: parseInt(document.getElementById('cupon-edit-pct').value, 10),
                usosMaximos: parseInt(document.getElementById('cupon-edit-usos').value, 10),
                vigenciaDesde: document.getElementById('cupon-edit-desde').value || null,
                vigenciaHasta: document.getElementById('cupon-edit-hasta').value || null,
                activo: document.getElementById('cupon-edit-activo').checked
            }});
            document.getElementById('cupon-edit-modal').classList.add('hidden');
            await cargar();
        } catch (err) {
            statusEl.innerHTML = `<span class="text-danger-500">Error: ${err.message}</span>`;
        } finally { btn.disabled = false; btn.textContent = 'Guardar'; }
    });

    await cargar();
}

async function _handleVerDetalle(btn, allCupones) {
    const codigo = btn.dataset.codigo;
    const cupon = allCupones.find(c => c.codigo === codigo);
    const content = document.getElementById('cupon-detalle-content');
    btn.textContent = '...';
    try {
        const reservas = await fetchAPI(`/crm/cupones/${encodeURIComponent(codigo)}/uso`);
        content.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div><p class="text-xs text-gray-500">Código</p><p class="font-mono font-bold text-primary-600">${codigo}</p></div>
                <div><p class="text-xs text-gray-500">Descuento</p><p class="font-bold">${cupon?.porcentajeDescuento || '—'}%</p></div>
                <div><p class="text-xs text-gray-500">Usos</p><p class="font-bold">${cupon?.usosActuales || 0} / ${cupon?.usosMaximos || 1}</p></div>
                <div><p class="text-xs text-gray-500">Vigencia</p><p class="text-sm">${cupon ? _vigenciaLabel(cupon) : '—'}</p></div>
            </div>
            <h4 class="font-semibold text-sm mt-4">Reservas donde se aplicó</h4>
            ${reservas.length === 0
                ? '<p class="text-gray-400 text-sm py-4">Este cupón aún no ha sido utilizado en reservas.</p>'
                : `<table class="min-w-full mt-2">
                    <thead class="bg-gray-50"><tr>
                        <th class="th text-xs py-2 px-3">ID Reserva</th>
                        <th class="th text-xs py-2 px-3">Alojamiento</th>
                        <th class="th text-xs py-2 px-3">Check-in</th>
                        <th class="th text-xs py-2 px-3">Estado</th>
                        <th class="th text-xs py-2 px-3">Valor Total</th>
                        <th class="th text-xs py-2 px-3">Descuento</th>
                    </tr></thead>
                    <tbody>${reservas.map(r => `
                        <tr class="border-b text-sm">
                            <td class="py-2 px-3 font-mono text-xs">${r.idReservaCanal || r.id?.substring(0, 8)}</td>
                            <td class="py-2 px-3">${r.alojamientoNombre || '—'}</td>
                            <td class="py-2 px-3">${formatDate(r.fechaLlegada)}</td>
                            <td class="py-2 px-3">${r.estado || '—'}</td>
                            <td class="py-2 px-3">${formatCurrency(r.valorHuesped)}</td>
                            <td class="py-2 px-3 text-danger-600 font-semibold">-${formatCurrency(r.descuentoCupon)}</td>
                        </tr>`).join('')}
                    </tbody></table>`}`;
        document.getElementById('cupon-detalle-modal').classList.remove('hidden');
    } catch (err) {
        content.innerHTML = `<p class="text-danger-500">Error: ${err.message}</p>`;
        document.getElementById('cupon-detalle-modal').classList.remove('hidden');
    } finally { btn.innerHTML = '<i class="fa-solid fa-clipboard-list"></i>'; }
}

function _handleEditar(btn, allCupones) {
    const cupon = allCupones.find(c => c.id === btn.dataset.id);
    if (!cupon) return;
    document.getElementById('cupon-edit-id').value = cupon.id;
    document.getElementById('cupon-edit-pct').value = cupon.porcentajeDescuento;
    document.getElementById('cupon-edit-usos').value = cupon.usosMaximos || 1;
    document.getElementById('cupon-edit-desde').value = formatDateInput(cupon.vigenciaDesde);
    document.getElementById('cupon-edit-hasta').value = formatDateInput(cupon.vigenciaHasta);
    document.getElementById('cupon-edit-activo').checked = cupon.activo;
    document.getElementById('cupon-edit-status').textContent = '';
    document.getElementById('cupon-edit-modal').classList.remove('hidden');
}

async function _handleEliminar(btn, recargar) {
    const codigo = btn.dataset.codigo;
    if (!confirm(`¿Eliminar cupón ${codigo}? Esta acción no se puede deshacer.`)) return;
    btn.disabled = true; btn.textContent = '...';
    try {
        await fetchAPI(`/crm/cupones/${btn.dataset.id}`, { method: 'DELETE' });
        await recargar();
    } catch (err) {
        alert(`Error: ${err.message}`);
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    }
}
