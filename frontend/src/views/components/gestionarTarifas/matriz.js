// frontend/src/views/components/gestionarTarifas/matriz.js
import { fetchAPI } from '../../../api.js';

let canalesCache    = [];
let canalPorDefecto = null;
let onReloadCallback = null;

export function initMatriz(canales, onReload) {
    canalesCache     = canales;
    canalPorDefecto  = canales.find(c => c.esCanalPorDefecto);
    onReloadCallback = onReload || null;
}

// ── Cálculo de precio por canal (espejo del backend) ─────────────────────────

function calcularPrecioCanal(precioBase, canal, valorDolarDia) {
    if (!canalPorDefecto) return { label: '—', raw: 0 };
    let val = precioBase;
    const mc = canal.moneda || 'CLP';
    const md = canalPorDefecto.moneda || 'CLP';
    if (mc === 'USD' && md === 'CLP' && valorDolarDia > 0) val = precioBase / valorDolarDia;
    else if (mc === 'CLP' && md === 'USD' && valorDolarDia > 0) val = precioBase * valorDolarDia;
    if (canal.id !== canalPorDefecto.id && canal.modificadorValor) {
        if (canal.modificadorTipo === 'porcentaje') val *= (1 + canal.modificadorValor / 100);
        else if (canal.modificadorTipo === 'fijo')  val += canal.modificadorValor;
    }
    const label = mc === 'USD'
        ? `USD ${val.toFixed(2)}`
        : `CLP ${Math.round(val).toLocaleString('es-CL')}`;
    return { label, raw: val };
}

function renderCanalesTooltip(precioBase, valorDolarDia) {
    if (!precioBase || precioBase <= 0) return '';
    return canalesCache.map(canal => {
        const { label } = calcularPrecioCanal(precioBase, canal, valorDolarDia || 0);
        const esBase = canal.id === canalPorDefecto?.id;
        return `<div class="flex justify-between gap-4 text-xs py-0.5 ${esBase ? 'font-semibold text-primary-700' : 'text-gray-700'}">
            <span>${canal.nombre}${esBase ? ' (base)' : ''}</span>
            <span>${label}</span>
        </div>`;
    }).join('');
}

// ── Renderizado de la matriz ──────────────────────────────────────────────────

export function renderMatriz(temporada, tarifas, propiedades) {
    const container = document.getElementById('matriz-container');
    if (!container) return;

    if (!temporada) {
        container.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-gray-400 py-20">
                <div class="text-5xl mb-4">👈</div>
                <p class="text-sm">Selecciona una temporada para ver y editar los precios</p>
            </div>`;
        return;
    }

    // Mapa de tarifas existentes por propiedadId
    const tarifaMap = new Map(tarifas.map(t => [t.alojamientoId, t]));

    // Agrupar propiedades por categoría
    const grupos = new Map();
    propiedades.forEach(p => {
        const cat = p.categoria || p.tipoNegocio || 'General';
        if (!grupos.has(cat)) grupos.set(cat, []);
        grupos.get(cat).push(p);
    });

    const monedaLabel = canalPorDefecto?.moneda || 'CLP';
    const totalConPrecio = tarifas.length;
    const totalProps     = propiedades.length;

    container.innerHTML = `
        <div class="flex flex-col h-full">
            <!-- Header de la temporada seleccionada -->
            <div class="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                    <h3 class="text-lg font-semibold text-gray-900">${temporada.nombre}</h3>
                    <p class="text-sm text-gray-500">${temporada.fechaInicio} → ${temporada.fechaTermino}
                        <span class="ml-2 text-xs ${totalConPrecio === totalProps ? 'text-success-600' : 'text-warning-600'} font-medium">
                            ${totalConPrecio}/${totalProps} propiedades con precio
                        </span>
                    </p>
                </div>
                <div class="flex gap-2">
                    <button id="guardar-matriz-btn" class="btn-primary">Guardar cambios</button>
                    <button id="limpiar-matriz-btn" class="btn-outline text-sm">Limpiar sin precio</button>
                </div>
            </div>

            <!-- Tabla -->
            <div class="overflow-auto flex-grow">
                <table class="min-w-full bg-white border border-gray-200 rounded-xl overflow-hidden text-sm">
                    <thead class="bg-gray-50 border-b">
                        <tr>
                            <th class="th text-left pl-4">Alojamiento</th>
                            <th class="th text-left w-20">Cat.</th>
                            <th class="th w-52">Precio base / noche (${monedaLabel})</th>
                            <th class="th">Precios por canal</th>
                            <th class="th w-20"></th>
                        </tr>
                    </thead>
                    <tbody id="matriz-tbody">
                        ${[...grupos.entries()].map(([cat, props]) => `
                            <tr class="bg-gray-50 border-b">
                                <td colspan="5" class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    ${cat}
                                    <button data-cat="${cat}" class="aplicar-categoria-btn ml-2 text-primary-600 hover:underline font-normal normal-case">
                                        Aplicar mismo precio a todos
                                    </button>
                                </td>
                            </tr>
                            ${props.map(p => {
                                const tarifa = tarifaMap.get(p.id);
                                const precio = tarifa?.precioBase || '';
                                const tienePrecio = precio > 0;
                                return `
                                <tr class="border-b hover:bg-gray-50 tarifa-row" data-propiedad-id="${p.id}" data-categoria="${cat}">
                                    <td class="py-3 px-4 font-medium text-gray-800">${p.nombre}</td>
                                    <td class="py-2 px-3 text-xs text-gray-400">${cat}</td>
                                    <td class="py-2 px-3">
                                        <div class="relative">
                                            <span class="absolute inset-y-0 left-3 flex items-center text-gray-400 text-xs pointer-events-none">$</span>
                                            <input type="number" min="0"
                                                   class="precio-input form-input pl-6 pr-2 py-1.5 text-sm w-full ${!tienePrecio ? 'border-warning-300 bg-warning-50' : ''}"
                                                   value="${precio}"
                                                   placeholder="Sin precio"
                                                   data-tarifa-id="${tarifa?.id || ''}"
                                                   data-valor-dolar="${tarifa?.valorDolarDia || 0}">
                                        </div>
                                    </td>
                                    <td class="py-2 px-3">
                                        <div class="canales-preview text-xs text-gray-400" data-precio="${precio}" data-valor-dolar="${tarifa?.valorDolarDia || 0}">
                                            ${tienePrecio ? renderCanalesTooltip(precio, tarifa?.valorDolarDia) : '<span class="italic">—</span>'}
                                        </div>
                                    </td>
                                    <td class="py-2 px-2 text-center">
                                        <div class="flex items-center justify-center gap-2">
                                            ${tarifa ? `<button data-tarifa-id="${tarifa.id}" class="delete-tarifa-btn text-gray-300 hover:text-danger-500 text-xs" title="Quitar precio de esta temporada"><i class="fa-solid fa-xmark"></i></button>` : ''}
                                            <button data-propiedad-id="${p.id}" data-propiedad-nombre="${p.nombre}" class="delete-propiedad-btn text-gray-400 hover:text-danger-600 transition-colors" title="Eliminar alojamiento permanentemente">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>`;
                            }).join('')}
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

    _setupMatrizEvents(temporada, propiedades);
}

async function _limpiarSinPrecio(tbody) {
    const sinPrecio = [...tbody.querySelectorAll('.tarifa-row')].filter(row => {
        const val = parseFloat(row.querySelector('.precio-input')?.value);
        return !val || val <= 0;
    });
    if (sinPrecio.length === 0) {
        alert('Todas las propiedades ya tienen precio asignado.');
        return;
    }
    const conTarifa = sinPrecio.filter(row => row.querySelector('.precio-input')?.dataset.tarifaId);
    const msg = conTarifa.length > 0
        ? `${sinPrecio.length} propiedad(es) no tienen precio.\n${conTarifa.length} de ellas tienen una tarifa guardada que será eliminada de la base de datos.\n\n¿Continuar?`
        : `${sinPrecio.length} propiedad(es) no tienen precio. Se limpiarán sus filas.\n\n¿Continuar?`;
    if (!confirm(msg)) return;

    for (const row of sinPrecio) {
        const input = row.querySelector('.precio-input');
        const tarifaId = input?.dataset.tarifaId;
        if (tarifaId) {
            try {
                await fetchAPI(`/tarifas/${tarifaId}`, { method: 'DELETE' });
                input.dataset.tarifaId = '';
                row.querySelector('.delete-tarifa-btn')?.remove();
            } catch (err) {
                console.error(`Error al eliminar tarifa ${tarifaId}:`, err.message);
            }
        }
        if (input) {
            input.value = '';
            input.classList.add('border-warning-300', 'bg-warning-50');
        }
        row.querySelector('.canales-preview').innerHTML = '<span class="italic">—</span>';
    }

    tbody.querySelectorAll('.tarifa-row').forEach(row => {
        const input = row.querySelector('.precio-input');
        if (parseFloat(input?.value) > 0) input.classList.remove('border-warning-300', 'bg-warning-50');
    });

    onReloadCallback?.();
}

function _setupMatrizEvents(temporada, propiedades) {
    const tbody = document.getElementById('matriz-tbody');
    if (!tbody) return;

    // Live preview al escribir precio
    tbody.addEventListener('input', (e) => {
        if (!e.target.classList.contains('precio-input')) return;
        const row     = e.target.closest('.tarifa-row');
        const preview = row?.querySelector('.canales-preview');
        if (!preview) return;
        const val = parseFloat(e.target.value) || 0;
        const vd  = parseFloat(e.target.dataset.valorDolar) || 0;
        preview.innerHTML = val > 0
            ? renderCanalesTooltip(val, vd)
            : '<span class="italic text-gray-300">—</span>';
        e.target.classList.toggle('border-warning-300', val <= 0);
        e.target.classList.toggle('bg-warning-50', val <= 0);
    });

    // Aplicar mismo precio a todos en categoría
    tbody.addEventListener('click', (e) => {
        const applyBtn = e.target.closest('.aplicar-categoria-btn');
        if (!applyBtn) return;
        const cat = applyBtn.dataset.cat;
        const valor = prompt(`Precio base para todas las propiedades de "${cat}" (${canalPorDefecto?.moneda || 'CLP'}):`);
        if (!valor || isNaN(parseFloat(valor))) return;
        tbody.querySelectorAll(`.tarifa-row[data-categoria="${cat}"] .precio-input`).forEach(input => {
            input.value = parseFloat(valor);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });

    // Eliminar tarifa individual
    tbody.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-tarifa-btn');
        if (!deleteBtn) return;
        const tarifaId = deleteBtn.dataset.tarifaId;
        if (!tarifaId) return;
        if (!confirm('¿Quitar el precio de esta propiedad en esta temporada?')) return;
        try {
            await fetchAPI(`/tarifas/${tarifaId}`, { method: 'DELETE' });
            const row = deleteBtn.closest('.tarifa-row');
            const input = row?.querySelector('.precio-input');
            if (input) {
                input.value = '';
                input.dataset.tarifaId = '';
                input.classList.add('border-warning-300', 'bg-warning-50');
                input.dispatchEvent(new Event('input'));
            }
            deleteBtn.remove();
        } catch (err) { alert(`Error: ${err.message}`); }
    });

    // Eliminar tarifa de esta propiedad en esta temporada (la fila permanece sin precio)
    tbody.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.delete-propiedad-btn');
        if (!delBtn) return;
        const propiedadNombre = delBtn.dataset.propiedadNombre;
        const row             = delBtn.closest('.tarifa-row');
        const input           = row?.querySelector('.precio-input');
        const tarifaId        = input?.dataset.tarifaId;
        if (!tarifaId) { alert(`"${propiedadNombre}" no tiene precio asignado en esta temporada.`); return; }
        if (!confirm(`¿Eliminar el precio de "${propiedadNombre}" en esta temporada?\n\nEl alojamiento seguirá apareciendo en la matriz sin precio asignado.`)) return;
        try {
            await fetchAPI(`/tarifas/${tarifaId}`, { method: 'DELETE' });
            input.value = '';
            input.dataset.tarifaId = '';
            input.classList.add('border-warning-300', 'bg-warning-50');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            row.querySelector('.delete-tarifa-btn')?.remove();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    });

    // Guardar todos los cambios
    document.getElementById('guardar-matriz-btn')?.addEventListener('click', async () => {
        const precios = [];
        tbody.querySelectorAll('.tarifa-row').forEach(row => {
            const input = row.querySelector('.precio-input');
            const val   = parseFloat(input?.value);
            const propId = row.dataset.propiedadId;
            if (propId && !isNaN(val) && val > 0) {
                precios.push({ propiedadId: propId, precioBase: val });
            }
        });

        if (precios.length === 0) { alert('No hay precios para guardar.'); return; }
        const btn = document.getElementById('guardar-matriz-btn');
        btn.disabled    = true;
        btn.textContent = 'Guardando…';
        try {
            await fetchAPI('/tarifas/bulk', { method: 'POST', body: { temporadaId: temporada.id, precios } });
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardado';
            onReloadCallback?.();
            setTimeout(() => { btn.disabled = false; btn.textContent = 'Guardar cambios'; }, 2000);
        } catch (err) {
            alert(`Error al guardar: ${err.message}`);
            btn.disabled = false;
            btn.textContent = 'Guardar cambios';
        }
    });

    document.getElementById('limpiar-matriz-btn')?.addEventListener('click', () => _limpiarSinPrecio(tbody));
}
