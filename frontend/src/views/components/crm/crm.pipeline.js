// frontend/src/views/components/crm/crm.pipeline.js
import { fetchAPI } from '../../../api.js';
import { handleNavigation } from '../../../router.js';
import { pickAvatarRgb } from '../../../shared/colorAvatar.js';

const SEGMENTOS_CONFIG = [
    { key: '🏆 Campeones',   color: 'warning',  icon: '🏆', label: 'Campeones' },
    { key: '❤️ Leales',      color: 'success',  icon: '❤️', label: 'Leales' },
    { key: '🤝 Potenciales', color: 'primary',  icon: '🤝', label: 'Potenciales' },
    { key: '😟 En Riesgo',   color: 'orange',   icon: '😟', label: 'En Riesgo' },
    { key: '🥶 Hibernando',  color: 'gray',     icon: '🥶', label: 'Hibernando' },
];

function getColorAvatar(name) {
    return pickAvatarRgb(name || '');
}

function getIniciales(name) {
    return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const formatCurrency = (v) => `$${(Math.round(v) || 0).toLocaleString('es-CL')}`;

export function renderPipeline(dashboard) {
    const { segmentos, kpis } = dashboard;

    const kpisHtml = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-500 mb-1 uppercase tracking-wide">Total Clientes</p>
                <p class="text-2xl font-bold text-gray-900">${kpis.totalClientes}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-500 mb-1 uppercase tracking-wide">Nuevos este mes</p>
                <p class="text-2xl font-bold text-primary-600">${kpis.nuevosMes}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-500 mb-1 uppercase tracking-wide">Retención</p>
                <p class="text-2xl font-bold text-success-600">${Math.round(kpis.retencionRate * 100)}%</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-xs text-gray-500 mb-1 uppercase tracking-wide">Lifetime Value Prom.</p>
                <p class="text-2xl font-bold text-warning-600">${formatCurrency(kpis.lifetimeValuePromedio)}</p>
            </div>
        </div>`;

    const columnsHtml = SEGMENTOS_CONFIG.map(seg => {
        const data = segmentos[seg.key] || { count: 0, totalGastado: 0 };
        const badgeColor = seg.color === 'orange'
            ? 'bg-orange-100 text-orange-800 border-orange-200'
            : `bg-${seg.color}-100 text-${seg.color}-800 border-${seg.color}-200`;
        const headerBorder = seg.color === 'orange'
            ? 'border-orange-300'
            : `border-${seg.color}-300`;

        return `
        <div class="flex-1 min-w-[200px]">
            <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div class="px-4 py-3 border-b-2 ${headerBorder} bg-gray-50">
                    <div class="flex items-center justify-between">
                        <span class="font-semibold text-sm">${seg.icon} ${seg.label}</span>
                        <span class="px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}">${data.count}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">${formatCurrency(data.totalGastado)} total</p>
                </div>
                <div id="pipeline-col-${seg.label.toLowerCase()}" class="p-2 space-y-2 max-h-[400px] overflow-y-auto pipeline-column"
                     data-segmento="${seg.key}">
                    <p class="text-xs text-gray-400 text-center py-4">Cargando...</p>
                </div>
            </div>
        </div>`;
    }).join('');

    return `
        ${kpisHtml}
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Pipeline por Segmento</h3>
            <button id="pipeline-recalcular-btn" class="btn-outline text-sm flex items-center gap-1.5"><i class="fa-solid fa-rotate"></i> Recalcular Segmentos</button>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-4">${columnsHtml}</div>

        <div id="pipeline-sidebar" class="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 transform translate-x-full transition-transform duration-300 z-50">
            <div class="p-6 h-full overflow-y-auto">
                <div class="flex items-center justify-between mb-6">
                    <h3 id="sidebar-title" class="text-lg font-semibold"></h3>
                    <button id="sidebar-close" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div id="sidebar-content"></div>
            </div>
        </div>
        <div id="pipeline-overlay" class="fixed inset-0 bg-black/20 z-40 hidden"></div>`;
}

export async function setupPipeline() {
    const columns = document.querySelectorAll('.pipeline-column');
    for (const col of columns) {
        const segmento = col.dataset.segmento;
        try {
            const clientes = await fetchAPI(`/crm/segmento/${encodeURIComponent(segmento)}`);
            if (clientes.length === 0) {
                col.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Sin clientes</p>';
                continue;
            }
            col.innerHTML = clientes.slice(0, 20).map(c => `
                <div class="p-3 rounded-lg border border-gray-100 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer bg-white pipeline-card"
                     data-cliente='${JSON.stringify({ id: c.id, nombre: c.nombre, telefono: c.telefono, email: c.email, totalGastado: c.totalGastado, numeroDeReservas: c.numeroDeReservas }).replace(/'/g, '&#39;')}'>
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                             style="background:${getColorAvatar(c.nombre)}">${getIniciales(c.nombre)}</div>
                        <div class="min-w-0">
                            <p class="text-sm font-medium text-gray-900 truncate">${c.nombre}</p>
                            <p class="text-xs text-gray-500">${c.numeroDeReservas || 0} res. · ${formatCurrency(c.totalGastado || 0)}</p>
                        </div>
                    </div>
                </div>
            `).join('');
            if (clientes.length > 20) {
                col.innerHTML += `<p class="text-xs text-gray-400 text-center py-2">+${clientes.length - 20} más</p>`;
            }
        } catch {
            col.innerHTML = '<p class="text-xs text-danger-500 text-center py-4">Error al cargar</p>';
        }
    }

    const closePipelineSidebar = () => {
        document.getElementById('pipeline-sidebar')?.classList.add('translate-x-full');
        document.getElementById('pipeline-overlay')?.classList.add('hidden');
    };

    // Card click → sidebar
    document.addEventListener('click', e => {
        const card = e.target.closest('.pipeline-card');
        if (card) {
            const c = JSON.parse(card.dataset.cliente);
            document.getElementById('sidebar-title').textContent = c.nombre;
            document.getElementById('sidebar-content').innerHTML = `
                <div class="space-y-4">
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between"><span class="text-gray-500">Teléfono</span><span class="font-medium">${c.telefono || '—'}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Email</span><span class="font-medium truncate ml-4">${c.email || '—'}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Reservas</span><span class="font-bold">${c.numeroDeReservas || 0}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Gasto total</span><span class="font-bold text-success-600">${formatCurrency(c.totalGastado || 0)}</span></div>
                    </div>
                    <div class="pt-4 border-t space-y-2">
                        <div class="flex flex-col gap-2">
                            <div class="flex gap-2">
                                <button type="button" class="sidebar-ver-perfil btn-primary text-sm flex-1">Ver perfil</button>
                                <button type="button" class="sidebar-ver-correos btn-outline text-sm flex-1"><i class="fa-solid fa-envelope mr-1"></i>Correos</button>
                            </div>
                            ${c.telefono ? `<a href="https://wa.me/${(c.telefono||'').replace(/\D/g,'')}" target="_blank" class="btn-outline text-sm w-full text-center">WhatsApp</a>` : ''}
                        </div>
                        <p class="text-xs font-medium text-gray-700 mt-2 flex items-center gap-1"><i class="fa-solid fa-ticket"></i> Generar Cupón</p>
                        <div class="grid grid-cols-2 gap-2">
                            <input type="number" id="sidebar-cupon-pct" class="form-input text-sm" min="1" max="100" value="10" placeholder="% Desc.">
                            <input type="number" id="sidebar-cupon-usos" class="form-input text-sm" min="1" value="1" placeholder="Usos máx.">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <input type="date" id="sidebar-cupon-desde" class="form-input text-xs" title="Vigencia desde (opcional)">
                            <input type="date" id="sidebar-cupon-hasta" class="form-input text-xs" title="Vigencia hasta (opcional)">
                        </div>
                        <button id="sidebar-cupon-btn" class="btn-outline text-sm w-full flex items-center justify-center gap-1.5" data-cliente-id="${c.id}"><i class="fa-solid fa-ticket"></i> Generar Cupón</button>
                        <div id="sidebar-cupon-result" class="text-xs"></div>
                    </div>
                </div>`;
            document.getElementById('pipeline-sidebar').classList.remove('translate-x-full');
            document.getElementById('pipeline-overlay').classList.remove('hidden');

            document.querySelector('#sidebar-content .sidebar-ver-perfil')?.addEventListener('click', () => {
                closePipelineSidebar();
                handleNavigation(`/cliente/${c.id}`);
            });
            document.querySelector('#sidebar-content .sidebar-ver-correos')?.addEventListener('click', () => {
                closePipelineSidebar();
                handleNavigation(`/cliente/${c.id}?tab=correos`);
            });

            // Coupon generation handler
            document.getElementById('sidebar-cupon-btn')?.addEventListener('click', async (ev) => {
                const clienteId = ev.target.dataset.clienteId;
                const pct = parseInt(document.getElementById('sidebar-cupon-pct')?.value || '10', 10);
                const usos = parseInt(document.getElementById('sidebar-cupon-usos')?.value || '1', 10);
                const desde = document.getElementById('sidebar-cupon-desde')?.value || null;
                const hasta = document.getElementById('sidebar-cupon-hasta')?.value || null;
                const resultEl = document.getElementById('sidebar-cupon-result');
                ev.target.disabled = true;
                ev.target.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generando...';
                try {
                    const cupon = await fetchAPI('/crm/cupones', {
                        method: 'POST', body: { clienteId, porcentajeDescuento: pct, usosMaximos: usos, vigenciaDesde: desde, vigenciaHasta: hasta }
                    });
                    resultEl.innerHTML = `<span class="text-success-600 font-mono flex items-center gap-1"><i class="fa-solid fa-check"></i> ${cupon.codigo} (${pct}% OFF, ${usos} uso${usos > 1 ? 's' : ''})</span>`;
                } catch (err) {
                    resultEl.innerHTML = `<span class="text-danger-500">${err.message}</span>`;
                } finally {
                    ev.target.disabled = false;
                    ev.target.innerHTML = '<i class="fa-solid fa-ticket"></i> Generar Cupón';
                }
            });
        }
    });

    document.getElementById('sidebar-close')?.addEventListener('click', closePipelineSidebar);
    document.getElementById('pipeline-overlay')?.addEventListener('click', closePipelineSidebar);

    // Recalcular
    document.getElementById('pipeline-recalcular-btn')?.addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Recalculando...';
        try {
            await fetchAPI('/crm/recalcular-segmentos', { method: 'POST' });
            window.location.reload();
        } catch (err) {
            alert(`Error: ${err.message}`);
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Recalcular Segmentos';
        }
    });
}
